//
// This file manages the reading and writing of packets to the game server.
//

const ZERO_CHAR_CODE = "0".charCodeAt(0),
      GAME_ID_LENGTH = 6;



//
// INCOMING
//

const incomingPacketReaders = {
    "error": readErrorPacket,
    "setid": readSetIdPacket,
    "invalid_game": readInvalidGamePacket,
    "game": readGamePacket,
    "message": readMessagePacket,
    "state": readStatePacket,
    "move": readMovePacket
};
const incomingPacketTypes = [
    "error",
    "setid",
    "invalid_game",
    "game",
    "message",
    "state",
    "move"
];

/**
 * Holds the data of a packet and facilitates the reading of that data.
 * @param data a String holding the content of the packet.
 * @param isWorkerPacket indicates whether this is packet used to communicate with a web worker.
 */
function PacketIn(data, isWorkerPacket) {
    this.data = data;
    this.index = 0;

    // If this isn't a worker packet, read its type.
    if (!isWorkerPacket) {
        const typeID = this.nextChar().charCodeAt(0) - ZERO_CHAR_CODE;
        assert(
            typeID >= 0 && typeID <= incomingPacketTypes.length,
            "invalid typeId " + typeID + "(" + data.charAt(0) + ")"
        );
        this.type = incomingPacketTypes[typeID];
    } else {
        this.type = "worker_packet"
    }
}
PacketIn.prototype.consumeAll = function() {
    const from = this.index;
    this.index = this.data.length;
    return this.data.substring(from, this.index);
};
PacketIn.prototype.nextChar = function() {
    assert(this.index < this.data.length, "there are no characters left in the packet");
    return this.data[this.index++];
};
PacketIn.prototype.nextString = function(length) {
    assert(length >= 0, "length must be >= 0");
    assert(this.index + length <= this.data.length, "there are not " + length + " characters left in the packet");

    const from = this.index;
    this.index += length;
    return this.data.substring(from, this.index);
};
PacketIn.prototype.nextVarString = function(lengthCharacters) {
    if(lengthCharacters === undefined) lengthCharacters = 2;
    assert(lengthCharacters > 0, "lengthCharacters must be positive");
    const length = this.nextInt(lengthCharacters);
    return this.nextString(length);
};
PacketIn.prototype.nextInt = function(length) {
    return parseInt(this.nextString(length));
};
PacketIn.prototype.nextDigit = function() {
    return this.nextInt(1);
};
PacketIn.prototype.nextUUID = function() {
    return this.nextString(36);
};
PacketIn.prototype.nextGameID = function() {
    return this.nextString(GAME_ID_LENGTH);
};
PacketIn.prototype.nextBool = function() {
    const char = this.nextChar();
    if(char === 't') return true;
    if(char === 'f') return false;
    assert(false, "expected a boolean, 't' or 'f'");
};
PacketIn.prototype.nextLocation = function() {
    return vec(this.nextDigit(), this.nextDigit());
};
PacketIn.prototype.nextPlayer = function() {
    const player = this.nextDigit();
    if(player === 1) return "dark";
    if(player === 2) return "light";
    assert(false, "invalid player " + player);
};
PacketIn.prototype.nextPlayerState = function() {
    return {
        tiles: this.nextDigit(),
        score: this.nextDigit()
    };
};
PacketIn.prototype.nextBoard = function() {
    const owners = [];
    for(let index = 0; index < TILES_COUNT; ++index) {
        owners.push(this.nextDigit());
    }
    return owners;
};
PacketIn.prototype.nextGameState = function() {
    const state = new GameState();
    state.lightTiles = this.nextDigit();
    state.lightScore = this.nextDigit();
    state.darkTiles = this.nextDigit();
    state.darkScore = this.nextDigit();
    state.board.loadTileState(this.nextBoard());
    state.activePlayerNo = this.nextDigit();
    state.lightWon = (state.lightScore >= 7);
    state.darkWon = (state.darkScore >= 7);
    state.won = (state.lightWon || state.darkWon);
    return state;
};
PacketIn.prototype.assertEmpty = function() {
    assert(this.index === this.data.length, "expected packet " + this.type + " to be fully read");
};


function readPacket(data) {
    const packet = new PacketIn(data);
    assert(packet.type in incomingPacketReaders, "Unknown packet type " + packet.type);

    const out = incomingPacketReaders[packet.type](packet);
    out.type = packet.type;
    packet.assertEmpty();
    return out;
}

function readErrorPacket(packet) {
    return { error: packet.consumeAll() };
}

function readSetIdPacket(packet) {
    return { id: packet.nextUUID() };
}

function readInvalidGamePacket(packet) {
    return {};
}

function readGamePacket(packet) {
    return {
        gameID: packet.nextGameID(),
        ownPlayer: packet.nextPlayer(),
        opponentName: packet.nextVarString()
    };
}

function readMessagePacket(packet) {
    return { text: packet.nextVarString() };
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

function readSimWorkerRequest(packet) {
    return {
        depth: packet.nextDigit(),
        state: packet.nextGameState(),
        diceValue: packet.nextDigit()
    };
}

function readSimWorkerResponse(packet) {
    return { moveFrom: packet.nextLocation() };
}



//
// OUTGOING
//

const outgoingPacketTypes = [
    "open",
    "reopen",
    "join_game",
    "find_game",
    "create_game",
    "roll",
    "move"
];

function PacketOut(type) {
    this.type = type;
    if (type !== "worker_packet") {
        const typeId = outgoingPacketTypes.indexOf(type);
        assert(typeId >= 0, "unknown type " + type);
        this.data = String.fromCharCode(typeId + ZERO_CHAR_CODE);
    } else {
        this.data = "";
    }
}
PacketOut.prototype.write = function(value) {
    this.data += value;
};
PacketOut.prototype.writeDigit = function(digit) {
    assert(digit >= 0 && digit <= 9, "expected digit to be a single digit from 0 -> 9 inclusive");
    this.write(digit);
};
PacketOut.prototype.writeLocation = function(loc) {
    this.writeDigit(loc.x);
    this.writeDigit(loc.y);
};
PacketOut.prototype.writePlayer = function(playerNo) {
    assert(playerNo === 1 || playerNo === 2, "invalid playerNo " + playerNo);
    this.writeDigit(playerNo);
};
PacketOut.prototype.writePlayerState = function(tiles, score) {
    this.writeDigit(tiles);
    this.writeDigit(score);
};
PacketOut.prototype.writeBoard = function(board) {
    for (let index = 0; index < TILES_COUNT; ++index) {
        this.writeDigit(board.tiles[index]);
    }
};
PacketOut.prototype.writeGameState = function(state) {
    this.writeDigit(state.lightTiles);
    this.writeDigit(state.lightScore);
    this.writeDigit(state.darkTiles);
    this.writeDigit(state.darkScore);
    this.writeBoard(state.board);
    this.writePlayer(state.activePlayerNo);
};


function writeOpenPacket() {
    return new PacketOut("open");
}

function writeReOpenPacket(previousId) {
    assert(previousId.length === 36, "previousId must be a uuid");
    const packet = new PacketOut("reopen");
    packet.write(previousId);
    return packet;
}

function writeJoinGamePacket(gameID) {
    assert(gameID.length === GAME_ID_LENGTH, "gameId must have " + GAME_ID_LENGTH + " characters");
    const packet = new PacketOut("join_game");
    packet.write(gameID);
    return packet;
}

function writeFindGamePacket() {
    return new PacketOut("find_game");
}

function writeDiceRollPacket() {
    return new PacketOut("roll");
}

function writeMovePacket(from) {
    const packet = new PacketOut("move");
    packet.writeDigit(from.x);
    packet.writeDigit(from.y);
    return packet;
}

function writeSimWorkerRequest(state, diceValue, depth) {
    const packet = new PacketOut("worker_packet");
    packet.writeDigit(depth);
    packet.writeGameState(state);
    packet.writeDigit(diceValue);
    return packet;
}

function writeSimWorkerResponse(loc) {
    const packet = new PacketOut("worker_packet");
    packet.writeLocation(loc)
    return packet;
}
