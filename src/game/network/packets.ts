//
// This file manages the reading and writing of packets to the game server.
//

import {assert} from "@/common/utils"
import {PacketIn} from "@/game/network/packet_reader";
import {PacketOut} from "@/game/network/packet_writer";

export const ZERO_CHAR_CODE = "0".charCodeAt(0);
export const GAME_ID_LENGTH = 6;
export const PROTOCOL_VERSION = 4;


/**
 * Whether this type of packet is incoming from the server,
 * or outgoing from the client.
 */
export enum PacketDirection {
    INCOMING = 1,
    OUTGOING = 2
}

/**
 * Represents a type of packet that the client can send or receive.
 */
export class PacketType {
    readonly direction: PacketDirection;
    readonly name: string;
    readonly id: number;

    constructor(direction: PacketDirection, name: string, id: number) {
        this.direction = direction;
        this.name = name;
        this.id = id;
    }
}

/**
 * Represents a type of packet that the client can receive.
 */
export class IncomingPacketType extends PacketType {
    readonly readFn: (packet: PacketIn) => {[key: string]: any};

    constructor(name: string, id: number, readFn: (packet: PacketIn) => {[key: string]: any}) {
        super(PacketDirection.INCOMING, name, id);
        this.readFn = readFn;
    }
}

/**
 * Represents a type of packet that the client can send.
 */
export class OutgoingPacketType extends PacketType {
    constructor(name: string, id: number) {
        super(PacketDirection.OUTGOING, name, id);
    }
}

/**
 * Groups a set of packet types for a specific purpose.
 */
export class PacketSet {
    readonly name: string;
    readonly debug: boolean;
    readonly incoming: IncomingPacketType[] = [];
    readonly outgoing: OutgoingPacketType[] = [];
    readonly incomingByName: Record<string, IncomingPacketType> = {};
    readonly outgoingByName: Record<string, OutgoingPacketType> = {};

    constructor(name: string, debug: boolean) {
        this.name = name;
        this.debug = debug;
    }

    printDebug(message: string) {
        if (this.debug) {
            console.log(this.name + " PacketSet: " + message);
        }
    }

    addIncoming(name: string, readFn: (packet: PacketIn) => {[key: string]: any}) {
        const type = new IncomingPacketType(name, this.incoming.length, readFn);
        this.incoming.push(type);
        this.incomingByName[name] = type;
    }

    addOutgoing(name: string) {
        const type = new OutgoingPacketType(name, this.outgoing.length);
        this.outgoing.push(type);
        this.outgoingByName[name] = type;
    }

    addBidirectional(name: string, readFn: (packet: PacketIn) => {[key: string]: any}) {
        assert(this.incoming.length === this.outgoing.length,
            "Number of incoming and outgoing packets is uneven. Bidirectional packets require them to be even.");
        this.addIncoming(name, readFn);
        this.addOutgoing(name);
    }

    getIncoming(id: number): IncomingPacketType {
        return this.incoming[id];
    }

    getOutgoing(name: string): OutgoingPacketType {
        return this.outgoingByName[name];
    }

    readPacket(data: string): {[key: string]: any} {
        const packet = new PacketIn(data),
              type = this.getIncoming(packet.id);

        if (!type)
            throw "Unknown packet type " + packet.id;

        const out = type.readFn(packet);
        out.type = type.name;
        out.rawData = packet.rawData;
        packet.assertEmpty();

        this.printDebug("readPacket " + JSON.stringify(out));
        return out;
    }

    newPacketOut(name: string): PacketOut {
        const type = this.getOutgoing(name);
        assert(!!type, "Unknown packet type " + name);
        return new PacketOut(type.id);
    }
}
