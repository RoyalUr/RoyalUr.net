//
// This file contains code for writing the contents of packets.
//

/**
 * Allows the construction of outgoing packets.
 * @param typeID the type ID of the outgoing packet.
 */
function PacketOut(typeID) {
    this.typeID = typeID;
    assert(typeID >= 0, "Invalid type ID " + typeID);
    this.data = String.fromCharCode(typeID + ZERO_CHAR_CODE);
}
PacketOut.prototype.pushRaw = function(value) {
    this.data += value;
};
PacketOut.prototype.pushDigit = function(digit) {
    assert(digit >= 0 && digit <= 9, "expected digit to be a single digit from 0 -> 9 inclusive");
    this.pushRaw(digit);
};
PacketOut.prototype.pushInt = function(value, digits) {
    assert(Number.isInteger(value), "value must be an integer");
    assert(value >= 0, "value must be >= 0");
    assert(digits > 0, "digits must be positive");

    let encoded = value.toString();
    assert(encoded.length <= digits, "value has too many digits");

    while (encoded.length < digits) {
        encoded = "0" + encoded;
    }
    this.pushRaw(encoded);
};
PacketOut.prototype.pushBool = function(value) {
    this.pushRaw(value ? 't' : 'f');
};
PacketOut.prototype.pushVarString = function(string, lengthCharacters) {
    if(lengthCharacters === undefined) lengthCharacters = 2;
    assert(lengthCharacters > 0, "lengthCharacters must be positive");
    assert(lengthCharacters > Math.log10(string.length), "the string is too long");
    this.pushRaw(string.length.toString().padStart(lengthCharacters, "0"));
    this.pushRaw(string);
};
PacketOut.prototype.pushLocation = function(loc) {
    this.pushDigit(loc.x);
    this.pushDigit(loc.y);
};
PacketOut.prototype.pushPlayer = function(playerNo) {
    assert(playerNo === 1 || playerNo === 2, "invalid playerNo " + playerNo);
    this.pushDigit(playerNo);
};
PacketOut.prototype.pushBoard = function(board) {
    for (let index = 0; index < TILES_COUNT; ++index) {
        this.pushDigit(board.tiles[index]);
    }
};
PacketOut.prototype.pushGameState = function(state) {
    this.pushDigit(state.lightTiles);
    this.pushDigit(state.lightScore);
    this.pushDigit(state.darkTiles);
    this.pushDigit(state.darkScore);
    this.pushBoard(state.board);
    this.pushPlayer(state.activePlayerNo);
};
