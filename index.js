const server = require('http')
const fs = require('fs');
const screenshot = require('screenshot-desktop');
const robot = require("robotjs");

const FPSinMS = 100

// network Info
const port = 3032
let ipAddress = null
require('dns').lookup(require('os').hostname(), function (err, add) {
    console.log('addr: ' + add);
    ipAddress = add +':'+ port
})

let mousePosition = null
let keyPressed = null
let activeConnections = 0
let screenSendInterval = null;

// serve socket server
const io = require('socket.io')(server.createServer()
    .listen(port, () => console.log('Server started on port ' + port))
);

// serve client html
server.createServer(async (req, res) => {
    if (req.url) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream('./index.html').on('error', () => {
            res.writeHead(404);
            res.end();
        }).pipe(res)
    }
}).listen(80);

io.on('connection', (socket) => { 
    socket.emit('open', 'New Connection');
    activeConnections += 1

    // init screen share and emit to "answer"
    socket.on('reply', (reply) => onReplay (reply, socket));

    socket.on('inputKey', (key) => onInputKey(key))

    socket.on('inputMouse', (key) => onInputKey(key))
    
    socket.on('moveMouse', (axes) => onMoveMouse(axes))

    socket.on('disconnect', () => onDisconnect());
});

function onReplay (reply, socket) {
    console.log(reply.msg);
      
    // Create interval & send image
    if (!screenSendInterval) screenSendInterval = setInterval(async () => {
        const sendScreen = await getScreenImage(0)
        
        ui()

        const objectToReturn = {
            screen: sendScreen,
            currentDisplay: reply.screenDisplay ? reply.screenDisplay : 0,
        }

        if (sendScreen) socket.emit('answer', objectToReturn);
        else {
            clearInterval(screenSendInterval);
            screenSendInterval = null;
            console.log('getScreenImage returned NULL! INTERVAL STOPED!');
        }

        return
    }, FPSinMS);
}

function onInputKey (key) {
    keyPressed = key
    robot.keyTap(key.toLowerCase());
    return
}

function onMoveMouse (axes) {
    robot.moveMouse(axes.x, axes.y);
    mousePosition = axes
    return
}

function onDisconnect() {
    console.log('User disconnected');
    clearInterval(screenSendInterval);
    screenSendInterval = null;
    keyPressed = null;
    mousePosition = null;
    activeConnections -= 1
    return
}


function ui() {
    console.clear()
    process.stdout.write(`
    --------------[ REMOTE CONTROLE ]--------------

        IP : ${ipAddress}
        Mouse : ${JSON.stringify(mousePosition)}
        Key : ${keyPressed}
        connections : ${activeConnections}
        FPS in MS : ${FPSinMS}
        version : 0.1

    -----------------------------------------------
    `);
}

async function getScreenImage(screenDisplay = 0) {
    const displays = await screenshot.listDisplays()
    if (!displays[screenDisplay]) return null;
    const img = await screenshot({ screen: displays[screenDisplay].id }).catch(e =>{
        console.log(e);
        return null;
    })

    //console.log(JSON.stringify(img));
    return img
}