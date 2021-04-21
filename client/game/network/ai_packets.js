//
// This file contains all of the AI packets that are
// sent to and received from the AI web worker.
//

const aiPackets = new PacketSet("AI", true);

aiPackets.addBidirectional("ai_functionality", readAIFunctionalityPacket);
aiPackets.addBidirectional("ai_move_request", readAIMoveRequestPacket);
aiPackets.addBidirectional("ai_move_response", readAIMoveResponsePacket);

function readAIFunctionalityPacket(packet) {
    return {
        available: packet.nextBool(),
        pandaAvailable: packet.nextBool(),
        pandaUnsupported: packet.nextBool()
    };
}

function readAIMoveRequestPacket(packet) {
    return {
        depth: packet.nextInt(2),
        usePanda: packet.nextBool(),
        state: packet.nextGameState(),
        roll: packet.nextDigit()
    };
}

function readAIMoveResponsePacket(packet) {
    return { moveFrom: packet.nextLocation() };
}

function writeAIFunctionalityPacket(isAvailable, isPandaAvailable, isPandaUnsupported) {
    const packet = aiPackets.newPacketOut("ai_functionality");
    packet.pushBool(isAvailable);
    packet.pushBool(isPandaAvailable);
    packet.pushBool(isPandaUnsupported);
    return packet;
}

function writeAIMoveRequestPacket(state, diceValue, depth, usePanda) {
    const packet = aiPackets.newPacketOut("ai_move_request");
    packet.pushInt(depth, 2);
    packet.pushBool(usePanda);
    packet.pushGameState(state);
    packet.pushDigit(diceValue);
    return packet;
}

function writeAIMoveResponsePacket(moveFrom) {
    const packet = aiPackets.newPacketOut("ai_move_response");
    packet.pushLocation(moveFrom);
    return packet;
}
