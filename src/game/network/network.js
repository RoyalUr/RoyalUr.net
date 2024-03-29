//
// This file manages the connection to the game server.
//

const isLocalhost = (window.location.hostname === "localhost"),
      isHTTPS = (window.location.protocol === "https:"),
      address = (isHTTPS ? "wss://" : "ws://") + window.location.hostname + (isHTTPS ? ":9113" : ":9112");
let debug = isLocalhost;


function printDebug(message) {
    if(debug) console.log(message);
}



//
// CONNECTION
//

let socket = null,
    socketState = "closed",
    uniqueId = null,
    networkConnectTime = LONG_TIME_AGO;

// Fix for bug in FireFox.
window.onbeforeunload = function() { disconnect(); };

function sendPacket(packet) {
    socket.send(packet.data);
}

function getName() {
    const queryString = window.location.search,
          params = new URLSearchParams(queryString);
    return params.has("name") ? params.get("name") : "unknown";
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
    socket = io(address);

    socket.on("open", function() {
        if(socketState === "opened")
            return;

        onNetworkConnecting();
    });

    socket.on("connect", function() {
        if(socketState === "opened")
            return;

        socketState = "opened";
        uniqueId = sessionStorage.getItem("uniqueId");
        networkConnectTime = getTime();
        analytics.recordConnected(address);

        if(uniqueId) {
            sendPacket(writeReOpenPacket(uniqueId, getName()));
        } else {
            sendPacket(writeOpenPacket(getName()));
        }

        onNetworkConnected();
    });

    socket.on("disconnect", function() {
        const lastState = socketState;
        socketState = "closed";

        // When the connection has been intentionally closed.
        if (socket !== this) {
            analytics.recordCloseConnection(address);
            return;
        }
        // When the connection was closed without connecting in the first place.
        if(lastState !== "opened")  {
            analytics.recordConnectionFailed(address);
            return;
        }

        // When the socket was connected, but then lost connection.
        analytics.recordLoseConnection(address);
        onNetworkLoseConnection();
        console.info("Connection lost, attempting to reconnect...");
    });

    socket.on("message", (data) => {
        receiveMessage(data);
    });
}

function receiveMessage(message) {
    const packet = networkPackets.readPacket(message);

    printDebug("Received packet length " + message.length + ": " + message + " - " + JSON.stringify(packet));

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
    "set_id": onPacketSetID,

    // client.js
    "error": onPacketError,
    "invalid_game": onPacketInvalidGame,
    "game_pending": onPacketGamePending,
    "game": onPacketGame,
    "game_end": onPacketGameEnd,
    "message": onPacketMessage,
    "player_status": onPacketPlayerStatus,
    "state": onPacketState,
    "move": onPacketMove
};

function onPacketSetID(data) {
    uniqueId = data.id;
    sessionStorage.setItem("uniqueId", data.id)
}
