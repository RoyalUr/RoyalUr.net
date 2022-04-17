//
// This file contains all of the network packets that
// are sent to and received from the game servers.
//

import {GAME_ID_LENGTH, PacketSet, PROTOCOL_VERSION} from "@/game/network/packets";
import {debug} from "@/game/network/network";
import {PacketIn} from "@/game/network/packet_reader";
import {assert} from "@/common/utils";
import {PacketOut} from "@/game/network/packet_writer";
import {Vec2} from "@/common/vectors";


export const networkPackets = new PacketSet("Network", debug);

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

function readErrorPacket(packet: PacketIn): {[key: string]: any} {
    return { error: packet.consumeAll() };
}

function readSetIdPacket(packet: PacketIn): {[key: string]: any} {
    return { id: packet.nextUUID() };
}

function readInvalidGamePacket(packet: PacketIn): {[key: string]: any} {
    return { gameID: packet.nextGameID() };
}

function readGamePendingPacket(packet: PacketIn): {[key: string]: any} {
    return { gameID: packet.nextGameID() };
}

function readGamePacket(packet: PacketIn): {[key: string]: any} {
    return {
        gameID: packet.nextGameID(),
        ownPlayer: packet.nextPlayer(),
        lightName: packet.nextVarString(),
        darkName: packet.nextVarString(),
        lightConnected: packet.nextBool(),
        darkConnected: packet.nextBool()
    };
}

function readGameEndPacket(packet: PacketIn): {[key: string]: any} {
    return { reason: packet.consumeAll() };
}

function readMessagePacket(packet: PacketIn): {[key: string]: any} {
    return {
        title: packet.nextVarString(),
        subtitle: packet.nextVarString()
    };
}

function readPlayerStatusPacket(packet: PacketIn): {[key: string]: any} {
    return {
        player: packet.nextPlayer(),
        connected: packet.nextBool()
    };
}

function readStatePacket(packet: PacketIn): {[key: string]: any} {
    const values: {[key: string]: any} = {
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

function readMovePacket(packet: PacketIn): {[key: string]: any} {
    return {
        from: packet.nextLocation(),
        to: packet.nextLocation()
    };
}


//
// OUTGOING PACKETS.
//

export function writeOpenPacket(name: string): PacketOut {
    const packet = networkPackets.newPacketOut("open");
    packet.pushInt(PROTOCOL_VERSION, 4);
    packet.pushVarString(name, 2);
    return packet;
}

export function writeReOpenPacket(previousId: string, name: string): PacketOut {
    assert(previousId.length === 36, "previousId must be a uuid");
    const packet = networkPackets.newPacketOut("reopen");
    packet.pushInt(PROTOCOL_VERSION, 4);
    packet.pushRaw(previousId);
    packet.pushVarString(name, 2);
    return packet;
}

export function writeJoinGamePacket(gameID: string): PacketOut {
    assert(gameID.length === GAME_ID_LENGTH, "gameId must have " + GAME_ID_LENGTH + " characters");
    const packet = networkPackets.newPacketOut("join_game");
    packet.pushRaw(gameID);
    return packet;
}

export function writeFindGamePacket(): PacketOut {
    return networkPackets.newPacketOut("find_game");
}

export function writeCreateGamePacket(): PacketOut {
    return networkPackets.newPacketOut("create_game");
}

export function writeDiceRollPacket(): PacketOut {
    return networkPackets.newPacketOut("roll");
}

export function writeMovePacket(from: Vec2): PacketOut {
    const packet = networkPackets.newPacketOut("move");
    packet.pushLocation(from);
    return packet;
}
