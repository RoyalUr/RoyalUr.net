const ZERO_CHAR_CODE = "0".charCodeAt(0),
      GAME_ID_LENGTH = 6;

//
// INCOMING
//

const incomingPackets = [
    "error",
    "setid",
    "invalid_game",
    "game",
    "message",
    "state",
    "move",
    "win"
];

const incomingPacketReaders = {
    "error": readErrorPacket,
    "setid": readSetIdPacket,
    "invalid_game": readInvalidGamePacket,
    "game": readGamePacket,
    "message": readMessagePacket,
    "state": readStatePacket,
    "move": readMovePacket,
    "win": readWinPacket
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
    return {
        error: packet.consumeAll()
    };
}

function readSetIdPacket(packet) {
    return {
        id: packet.nextUUID()
    };
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
    return {
        text: packet.nextVarString()
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

function readWinPacket(packet) {
    return {
        winner: packet.nextPlayer()
    };
}

function PacketIn(data) {
    assert(data.length > 0, "data must contain initial type character")

    const typeId = data.charCodeAt(0) - ZERO_CHAR_CODE;

    assert(typeId >= 0 && typeId <= incomingPackets.length, "invalid typeId " + typeId + "(" + data.charAt(0) + ")");

    this.type = incomingPackets[typeId];
    this.data = data;
    this.index = 1;

    this.consumeAll = function() {
        const from = this.index;
        this.index = this.data.length;

        return this.data.substring(from, this.index);
    }

    this.nextChar = function() {
        assert(this.index < this.data.length, "there are no characters left in the packet");

        return this.data[this.index++];
    }.bind(this);

    this.nextString = function(length) {
        assert(length >= 0, "length must be >= 0");
        assert(this.index + length <= this.data.length, "there are not " + length + " characters left in the packet");

        const from = this.index;
        this.index += length;

        return this.data.substring(from, this.index);
    }.bind(this);

    this.nextVarString = function(lengthCharacters) {
        if(lengthCharacters === undefined) lengthCharacters = 2;

        assert(lengthCharacters > 0, "lengthCharacters must be positive");

        const length = this.nextInt(lengthCharacters);

        return this.nextString(length);
    };

    this.nextInt = function(length) {
        const string = this.nextString(length);

        return parseInt(string);
    }.bind(this);

    this.nextDigit = function() {
        return this.nextInt(1);
    }.bind(this);

    this.nextUUID = function() {
        return this.nextString(36);
    }.bind(this);

    this.nextGameID = function() {
        return this.nextString(GAME_ID_LENGTH);
    };
    
    this.nextBool = function() {
        const char = this.nextChar();

        if(char === 't') return true;
        if(char === 'f') return false;

        assert(false, "expected a boolean, 't' or 'f'");
    }.bind(this);

    this.nextLocation = function() {
        return [this.nextDigit(), this.nextDigit()];
    }.bind(this);

    this.nextPlayer = function() {
        const player = this.nextDigit();

        if(player === 1) return "dark";
        if(player === 2) return "light";

        assert(false, "invalid player " + player);
    }.bind(this);

    this.nextPlayerState = function(player) {
        return {
            player: player,
            tiles: this.nextDigit(),
            score: this.nextDigit()
        };
    }.bind(this);

    this.nextBoard = function() {
        const WIDTH = 3,
              HEIGHT = 8,
              TILE_COUNT = 24;

        const owners = [];

        for(let index = 0; index < TILE_COUNT; ++index) {
            owners.push(this.nextDigit());
        }

        return owners;
    }.bind(this);

    this.assertEmpty = function() {
        assert(this.index === this.data.length, "expected packet " + this.type + " to be fully read");
    }.bind(this);
}



//
// OUTGOING
//

const outgoingPackets = [
    "open",
    "reopen",
    "join_game",
    "find_game",
    "create_game",
    "roll",
    "move"
];

function PacketOut(type) {
    const typeId = outgoingPackets.indexOf(type);

    assert(typeId >= 0, "unknown type " + type);

    this.type = type;
    this.data = String.fromCharCode(typeId + ZERO_CHAR_CODE);

    this.write = function(value) {
        this.data += value;
    }.bind(this);

    this.writeDigit = function(digit) {
        assert(digit >= 0 && digit <= 9, "expected digit to be a single digit from 0 -> 9 inclusive")

        this.write(digit);
    }.bind(this);
}

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
    assert(from.length === 2, "from must be a length 2 array")

    const packet = new PacketOut("move");

    packet.writeDigit(from[0]);
    packet.writeDigit(from[1]);

    return packet;
}
