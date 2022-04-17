//
// This file manages the connection to the game server.
//

import {LONG_TIME_AGO, getTime} from "@/common/utils";
import {ReconnectingWebSocket} from "@/game/lib/reconnecting-websocket"
import {networkPackets, writeOpenPacket, writeReOpenPacket} from "@/game/network/network_packets";

const isLocalhost = (window.location.hostname === "localhost"),
      address = (isLocalhost ? "ws://localhost:9113" : "wss://royalur.net:9113");

export let debug = isLocalhost;
export function printDebug(message) {
    if(debug) console.log(message);
}



//
// CONNECTION
//

let socket = null,
    socketState = "closed",
    uniqueId = null,
    networkConnectTime = LONG_TIME_AGO;

const networkStatusHandlers = {
    connecting: () => {},
    connected: () => {},
    disconnect: () => {},
    lostConnection: () => {}
};

export function setNetworkConnectingHandler(handler: () => void) {
    networkStatusHandlers.connecting = handler;
}
export function setNetworkConnectedHandler(handler: () => void) {
    networkStatusHandlers.connected = handler;
}
export function setNetworkDisconnectHandler(handler: () => void) {
    networkStatusHandlers.disconnect = handler;
}
export function setNetworkLostConnectionHandler(handler: () => void) {
    networkStatusHandlers.lostConnection = handler;
}


// Fix for bug in FireFox.
window.onbeforeunload = function() { disconnect(); };

export function sendPacket(packet) {
    socket.send(packet.data);
}

function getName() {
    const queryString = window.location.search,
          params = new URLSearchParams(queryString);
    return params.has("name") ? params.get("name") : "unknown";
}

export function reconnect() {
    disconnect();
    connect();
}

export function connect() {
    // Already connected
    if (socket)
        return;

    networkStatusHandlers.connecting();
    connectSocket();
}

export function disconnect() {
    // Already disconnected
    if (!socket)
        return;

    networkStatusHandlers.disconnect();
    const prevSocket = socket;
    socket = null;
    prevSocket.close();
}

export function connectSocket() {
    socket = new ReconnectingWebSocket(address, null, {
        debug: false,

        timeoutInterval: 15000,
        reconnectInterval: 1000,
        maxReconnectInterval: 5000,
        reconnectDecay: 1.5
    });

    socket.onconnecting = function() {
        if(socketState === "opened")
            return;

        networkStatusHandlers.connecting();
    }.bind(socket);

    socket.onopen = function() {
        if(socket.readyState !== WebSocket.OPEN || socketState === "opened")
            return;

        socketState = "opened";
        uniqueId = sessionStorage.getItem("uniqueId");
        networkConnectTime = getTime();

        if(uniqueId) {
            sendPacket(writeReOpenPacket(uniqueId, getName()));
        } else {
            sendPacket(writeOpenPacket(getName()));
        }

        networkStatusHandlers.connected();
    }.bind(socket);

    socket.onclose = function() {
        const lastState = socketState;
        socketState = "closed";

        // When the connection has been intentionally closed.
        if (socket !== this)
            return;
        // When the connection was closed without connecting in the first place.
        if(lastState !== "opened")
            return;

        // When the socket was connected, but then lost connection.
        networkStatusHandlers.lostConnection();
        console.info("Connection lost, attempting to reconnect...");
    }.bind(socket);

    socket.onmessage = function(event) {
        receiveMessage(event.data);
    }.bind(socket);

    socket.onerror = function() {}.bind(socket);
}

export function receiveMessage(message: string) {
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

const packetHandlers: {[name: string]: (packet: {[key: string]: any}) => void} = {};

export function registerPacketHandler(name: string, handler: (packet: {[key: string]: any}) => void) {
    packetHandlers[name] = handler;
}

function onPacketSetID(data) {
    uniqueId = data.id;
    sessionStorage.setItem("uniqueId", data.id)
}
registerPacketHandler("set_id", onPacketSetID);
