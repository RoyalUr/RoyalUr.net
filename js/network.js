//
// This file manages the connection to the game server.
//

const isLocalhost = (window.location.hostname === "localhost"),
      address = (isLocalhost ? "ws://localhost:9113" : "ws://game.royalur.net:9113");
let debug = isLocalhost;


function printDebug(message) {
    if(debug) console.log(message);
}



//
// CONNECTION
//

let socket = null,
    socketState = "closed",
    uniqueId = null;

function sendPacket(packet) {
    socket.send(packet.data);
}

function reconnect() {
    disconnect();
    connect();
}

function connect() {
    // Already connected
    if (socket)
        return;

    onNetworkConnecting();
    connectSocket();
}

function disconnect() {
    // Already disconnected
    if (!socket)
        return;

    onNetworkDisconnect();
    const prevSocket = socket;
    socket = null;
    prevSocket.close();
}

function connectSocket() {
    socket = new ReconnectingWebSocket(address, null, {
        debug: false,

        reconnectInterval: 1000,
        maxReconnectInterval: 5000,
        reconnectDecay: 1.5
    });

    socket.onconnecting = function() {
        if(socketState === "opened")
            return;

        onNetworkConnecting();
    }.bind(socket);

    socket.onopen = function() {
        if(socket.readyState !== WebSocket.OPEN || socketState === "opened")
            return;

        socketState = "opened";
        uniqueId = sessionStorage.getItem("uniqueId");

        if(uniqueId) {
            sendPacket(writeReOpenPacket(uniqueId));
        } else {
            sendPacket(writeOpenPacket());
        }

        onNetworkConnected();
    }.bind(socket);

    socket.onclose = function() {
        const lastState = socketState;
        socketState = "closed";

        if(socket !== this || lastState !== "opened")
            return;

        onNetworkLoseConnection();
        console.info("Connection lost, attempting to reconnect...");
    }.bind(socket);

    socket.onmessage = function(event) {
        receiveMessage(event.data);
    }.bind(socket);

    socket.onerror = function() {

    }.bind(socket);
}

function receiveMessage(message) {
    const packet = readPacket(message);

    printDebug("Recieved packet length " + message.length + ": " + message + " - " + JSON.stringify(packet));

    if (packet.type in packetHandlers) {
        packetHandlers[packet.type](packet);
    } else {
        console.error("Unhandled " + packet.type + " packet " + message + " - " + JSON.stringify(packet));
    }
}


//
// PACKET HANDLING
//

const packetHandlers = {
    "error": onPacketError,
    "setid": onPacketSetID,

    // client.js
    "invalid_game": onPacketInvalidGame,
    "game": onPacketGame,
    "message": onPacketMessage,
    "state": onPacketState,
    "move": onPacketMove
};

function onPacketError(data) {
    console.error("Error: " + data.error);
}

function onPacketSetID(data) {
    uniqueId = data.id;
    sessionStorage.setItem("uniqueId", data.id)
}
