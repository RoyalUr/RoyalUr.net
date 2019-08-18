const address = "ws://" + window.location.hostname + ":9113",
      debugNetwork = (window.location.hostname === "localhost");

function debug(message) {
    if(debugNetwork) console.log(message);
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

function connect() {
    onNetworkConnecting();

    // If we're debugging networking, fake a delay in the connection to the socket
    if (debugNetwork) {
        setTimeout(() => connectSocket(), 1000);
    } else {
        connectSocket();
    }
}

function disconnect() {
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

        onNetworkDisconnect();
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

    debug("Recieved packet length " + message.length + ": " + message + " - " + JSON.stringify(packet));

    if (packet.type in packetHandlers) {
        packetHandlers[packet.type](packet);
    } else {
        console.log("Unhandled " + packet.type + " packet " + message);
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
