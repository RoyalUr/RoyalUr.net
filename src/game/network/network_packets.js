//
// This file contains all of the network packets that
// are sent to and received from the game servers.
//

const networkPackets = new PacketSet("Network", debug);

networkPackets.addIncoming("error", readErrorPacket);
networkPackets.addIncoming("set_id", readSetIdPacket);
networkPackets.addIncoming("invalid_game", readInvalidGamePacket);
networkPackets.addIncoming("game_pending", readGamePendingPacket);
networkPackets.addIncoming("game", readGamePacket);
networkPackets.addIncoming("game_end", readGameEndPacket);
networkPackets.addIncoming("message", readMessagePacket);
networkPackets.addIncoming("player_status", readPlayerStatusPacket);
networkPackets.addIncoming("state", readStatePacket);
networkPackets.addIncoming("move", readMovePacket);

networkPackets.addOutgoing("open");
networkPackets.addOutgoing("reopen");
networkPackets.addOutgoing("join_game");
networkPackets.addOutgoing("find_game");
networkPackets.addOutgoing("create_game");
networkPackets.addOutgoing("roll");
networkPackets.addOutgoing("move");


//
// INCOMING PACKETS.
//

function readErrorPacket(packet) {
    return { error: packet.consumeAll() };
}

function readSetIdPacket(packet) {
    return { id: packet.nextUUID() };
}

function readInvalidGamePacket(packet) {
    return { gameID: packet.nextGameID() };
}

function readGamePendingPacket(packet) {
    return { gameID: packet.nextGameID() };
}

function readGamePacket(packet) {
    return {
        gameID: packet.nextGameID(),
        ownPlayer: packet.nextPlayer(),
        lightName: packet.nextVarString(),
        darkName: packet.nextVarString(),
        lightConnected: packet.nextBool(),
        darkConnected: packet.nextBool()
    };
}

function readGameEndPacket(packet) {
    return { reason: packet.consumeAll() };
}

function readMessagePacket(packet) {
    return {
        title: packet.nextVarString(),
        subtitle: packet.nextVarString()
    };
}

function readPlayerStatusPacket(packet) {
    return {
        player: packet.nextPlayer(),
        connected: packet.nextBool()
    };
}

function readStatePacket(packet) {
    const values = {
        light: packet.nextPlayerState(),
        dark: packet.nextPlayerState(),
        board: packet.nextBoard(),

        isGameWon: packet.nextBool(),
        currentPlayer: packet.nextPlayer(),
        hasRoll: packet.nextBool()
    };

    if(values.hasRoll) {
        values.roll = [
            packet.nextDigit(),
            packet.nextDigit(),
            packet.nextDigit(),
            packet.nextDigit()
        ];
        values.hasMoves = packet.nextBool();
    }
    return values;
}

function readMovePacket(packet) {
    return {
        from: packet.nextLocation(),
        to: packet.nextLocation()
    };
}


//
// OUTGOING PACKETS.
//

function writeOpenPacket(name) {
    const packet = networkPackets.newPacketOut("open");
    packet.pushInt(PROTOCOL_VERSION, 4);
    packet.pushVarString(name, 2);
    return packet;
}

function writeReOpenPacket(previousId, name) {
    assert(previousId.length === 36, "previousId must be a uuid");
    const packet = networkPackets.newPacketOut("reopen");
    packet.pushInt(PROTOCOL_VERSION, 4);
    packet.pushRaw(previousId);
    packet.pushVarString(name, 2);
    return packet;
}

function writeJoinGamePacket(gameID) {
    assert(gameID.length === GAME_ID_LENGTH, "gameId must have " + GAME_ID_LENGTH + " characters");
    const packet = networkPackets.newPacketOut("join_game");
    packet.pushRaw(gameID);
    return packet;
}

function writeFindGamePacket() {
    return networkPackets.newPacketOut("find_game");
}

function writeCreateGamePacket() {
    return networkPackets.newPacketOut("create_game");
}

function writeDiceRollPacket() {
    return networkPackets.newPacketOut("roll");
}

function writeMovePacket(from) {
    const packet = networkPackets.newPacketOut("move");
    packet.pushLocation(from);
    return packet;
}
