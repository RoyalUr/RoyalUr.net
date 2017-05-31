let address = "ws://localhost:9113";

let debugNetwork = true;

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
    socket = new ReconnectingWebSocket(address, null, {
        debug: false,

        reconnectInterval: 1000,
        maxReconnectInterval: 5000,
        reconnectDecay: 1.5
    });

    onNetworkConnecting();

    socket.onconnecting = function() {
        if(socketState === "opened")
            return;

        onNetworkConnecting();
    }

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
    }

    socket.onclose = function() {
        const lastState = socketState;
        socketState = "closed";

        if(lastState !== "opened")
            return;

        onNetworkDisconnect();
        console.info("Connection lost, attempting to reconnect...");
    }

    socket.onmessage = function() {
        debug("Recieved packet length " + event.data.length + ": " + event.data);

        const packet = readPacket(event.data);

        if(packet.type in packetHandlers) {
            packetHandlers[packet.type](packet);
        } else {
            console.log("Unknown packet " + event.data);
        }
    }

    socket.onerror = function() {

    }
}


//
// PACKET HANDLING
//

const packetHandlers = {
    "error": onPacketError,
    "setid": onPacketSetID,

    // client.js
    "game": onPacketGame,
    "message": onPacketMessage,
    "state": onPacketState,
    "win": onPacketWin
};

function onPacketError(data) {
    console.error("Error: " + data.error);
}

function onPacketSetID(data) {
    uniqueId = data.id;
    sessionStorage.setItem("uniqueId", data.id)
}
