//
// This file contains all of the AI packets that are
// sent to and received from the AI web worker.
//

import {PacketSet} from "@/game/network/packets";
import {PacketIn} from "@/game/network/packet_reader";
import {GameState} from "@/game/game/board";
import {Vec2} from "@/common/vectors";
import {PacketOut} from "@/game/network/packet_writer";


export const aiPackets = new PacketSet("AI", true);

aiPackets.addBidirectional("ai_functionality", readAIFunctionalityPacket);
aiPackets.addBidirectional("ai_move_request", readAIMoveRequestPacket);
aiPackets.addBidirectional("ai_move_response", readAIMoveResponsePacket);
aiPackets.addOutgoing("ai_panda_move_request");


function readAIFunctionalityPacket(packet: PacketIn): {[key: string]: any} {
    return {
        available: packet.nextBool(),
        pandaAvailable: packet.nextBool(),
        pandaUnsupported: packet.nextBool()
    };
}

function readAIMoveRequestPacket(packet: PacketIn): {[key: string]: any} {
    return {
        depth: packet.nextInt(2),
        usePanda: packet.nextBool(),
        state: packet.nextGameState(),
        roll: packet.nextDigit()
    };
}

function readAIMoveResponsePacket(packet: PacketIn): {[key: string]: any} {
    return { moveFrom: packet.nextLocation() };
}

export function writeAIFunctionalityPacket(
        isAvailable: boolean, isPandaAvailable: boolean, isPandaUnsupported: boolean): PacketOut {

    const packet = aiPackets.newPacketOut("ai_functionality");
    packet.pushBool(isAvailable);
    packet.pushBool(isPandaAvailable);
    packet.pushBool(isPandaUnsupported);
    return packet;
}

export function writeAIMoveRequestPacket(
        state: GameState, roll: number, depth: number, usePanda: boolean): PacketOut {

    const packet = aiPackets.newPacketOut("ai_move_request");
    packet.pushInt(depth, 2);
    packet.pushBool(usePanda);
    packet.pushGameState(state);
    packet.pushDigit(roll);
    return packet;
}

export function writeAIMoveResponsePacket(moveFrom: Vec2): PacketOut {
    const packet = aiPackets.newPacketOut("ai_move_response");
    packet.pushLocation(moveFrom);
    return packet;
}

export function writeAIPandaMoveRequestPacket(state: GameState, roll: number, depth: number): PacketOut {
    const packet = aiPackets.newPacketOut("ai_panda_move_request");
    packet.pushInt(depth, 2);
    packet.pushGameState(state);
    packet.pushDigit(roll);
    return packet;
}
