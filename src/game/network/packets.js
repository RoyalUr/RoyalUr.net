//
// This file manages the reading and writing of packets to the game server.
//

const ZERO_CHAR_CODE = "0".charCodeAt(0),
      GAME_ID_LENGTH = 6,
      PROTOCOL_VERSION = 4;


/** Represents the types of packets. **/
function PacketType(direction, name, id) {
    this.__class_name__ = "PacketType";
    this.direction = direction;
    this.name = name;
    this.id = id;
}


/** Types of packets that are incoming. **/
function IncomingPacketType(name, id, readFn) {
    PacketType.call(this, "incoming", name, id)
    this.__class_name__ = "IncomingPacketType";
    this.readFn = readFn;
}
setSuperClass(IncomingPacketType, PacketType);


/** Types of packets that are outgoing. **/
function OutgoingPacketType(name, id) {
    PacketType.call(this, "outgoing", name, id)
    this.__class_name__ = "OutgoingPacketType";
}
setSuperClass(OutgoingPacketType, PacketType);


/** Represents a set of incoming and outgoing packet types. **/
function PacketSet(name, debug) {
    this.__class_name__ = "PacketSet";
    this.name = name;
    this.debug = !!debug;
    this.incoming = [];
    this.outgoing = [];
    this.incomingByName = {};
    this.outgoingByName = {};
}
PacketSet.prototype.printDebug = function(message) {
    if (this.debug) {
        console.log(this.name + " PacketSet: " + message);
    }
};
PacketSet.prototype.addIncoming = function(typeName, readFn) {
    const type = new IncomingPacketType(typeName, this.incoming.length, readFn);
    this.incoming.push(type);
    this.incomingByName[typeName] = type;
};
PacketSet.prototype.addOutgoing = function(typeName) {
    const type = new OutgoingPacketType(typeName, this.outgoing.length);
    this.outgoing.push(type);
    this.outgoingByName[typeName] = type;
};
PacketSet.prototype.getIncoming = function(typeID) {
    return this.incoming[typeID];
};
PacketSet.prototype.getOutgoing = function(typeName) {
    return this.outgoingByName[typeName];
};
PacketSet.prototype.addBidirectional = function(typeName, readFn) {
    assert(this.incoming.length === this.outgoing.length,
        "Number of incoming and outgoing packets is uneven. Bidirectional packets require them to be even.");
    this.addIncoming(typeName, readFn);
    this.addOutgoing(typeName);
};
PacketSet.prototype.readPacket = function(data) {
    const packet = new PacketIn(data),
          type = this.getIncoming(packet.typeID);
    if (!type)
        throw "Unknown packet type " + packet.typeID;

    const out = type.readFn(packet);
    out.type = type.name;
    out.rawData = packet.rawData;
    packet.assertEmpty();

    this.printDebug("readPacket " + JSON.stringify(out));
    return out;
};
PacketSet.prototype.newPacketOut = function(typeName) {
    const type = this.getOutgoing(typeName);
    assert(!!type, "Unknown packet type " + typeName);
    return new PacketOut(type.id);
};
