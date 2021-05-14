//
// This file contains code for reading the contents of packets.
//

/**
 * Holds the data of a packet and facilitates the reading of that data.
 * @param data a String holding the content of the packet.
 * @param skipType whether to skip reading the type from data.
 */
function PacketIn(data, skipType) {
    this.data = data;
    this.index = 0;

    // Read the type of this packet.
    if (!skipType) {
        this.typeID = this.nextChar().charCodeAt(0) - ZERO_CHAR_CODE;
    } else {
        this.typeID = -1;
    }

    // Store the whole unparsed contents of this packet.
    this.rawData = this.data.substring(this.index, this.data.length);
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
    if (player === 1) return "dark";
    if (player === 2) return "light";
    if (player === 3) return "spectator";
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
