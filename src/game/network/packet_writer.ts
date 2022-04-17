//
// This file contains code for writing the contents of packets.
//

import {ZERO_CHAR_CODE} from "@/game/network/packets";
import {assert, pad} from "@/common/utils";
import {Vec2} from "@/common/vectors";
import {Board, GameState} from "@/game/game/board";

/**
 * Allows the construction of outgoing packets.
 * @param typeID the type ID of the outgoing packet.
 */
export class PacketOut {

    id: number;
    data: string;

    constructor(id: number) {
        assert(id >= 0, "Invalid type ID " + id);

        this.id = id;
        this.data = String.fromCharCode(id + ZERO_CHAR_CODE);
    }

    getDataNoType(): string {
        return this.data.substring(1);
    }

    pushRaw(value: any) {
        this.data += value;
    }

    pushDigit(digit: number) {
        assert(digit >= 0 && digit <= 9, "expected digit to be a single digit from 0 -> 9 inclusive");
        this.pushRaw(digit);
    }

    pushInt(value: number, digits: number) {
        assert(Number.isInteger(value), "value must be an integer");
        assert(value >= 0, "value must be >= 0");
        assert(digits > 0, "digits must be positive");

        let encoded = value.toString();
        assert(encoded.length <= digits, "value has too many digits");

        this.pushRaw(pad(encoded, digits, '0'));
    }

    pushBool(value: boolean) {
        this.pushRaw(value ? 't' : 'f');
    }

    pushVarString(value: string, lengthChars: number=2) {
        assert(lengthChars > 0, "lengthChars must be positive");
        assert(value.length.toString().length <= lengthChars, "the string is too long");

        this.pushInt(value.length, lengthChars)
        this.pushRaw(value);
    }

    pushLocation(loc: Vec2) {
        this.pushDigit(loc.x);
        this.pushDigit(loc.y);
    }

    pushPlayer(playerNo: number) {
        assert(playerNo === 1 || playerNo === 2, "invalid playerNo " + playerNo);
        this.pushDigit(playerNo);
    }

    pushBoard(board: Board) {
        for (let index = 0; index < Board.TILE_COUNT; ++index) {
            this.pushDigit(board.tiles[index]);
        }
    }

    pushGameState(state: GameState) {
        this.pushDigit(state.lightTiles);
        this.pushDigit(state.lightScore);
        this.pushDigit(state.darkTiles);
        this.pushDigit(state.darkScore);
        this.pushBoard(state.board);
        this.pushPlayer(state.activePlayerNo);
    }
}
