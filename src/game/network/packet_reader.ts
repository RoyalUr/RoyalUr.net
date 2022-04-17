//
// This file contains code for reading the contents of packets.
//

import {assert} from "@/common/utils"
import {Vec2} from "@/common/vectors";
import {GAME_ID_LENGTH, ZERO_CHAR_CODE} from "@/game/network/packets";
import {GameState, TILES_COUNT} from "@/game/game/board";

/**
 * Holds the data of a packet and facilitates the reading of that data.
 * @param data a String holding the content of the packet.
 * @param skipType whether to skip reading the type from data.
 */
export class PacketIn {

    id: number;
    data: string;
    index: number;
    rawData: string;

    constructor(data: string, skipType?: boolean) {
        this.data = data;
        this.index = 0;

        // Read the type of this packet.
        if (!skipType) {
            this.id = this.nextChar().charCodeAt(0) - ZERO_CHAR_CODE;
        } else {
            this.id = -1;
        }

        // Store the whole unparsed contents of this packet, without the type.
        this.rawData = this.data.substring(this.index, this.data.length);
    }

    assertEmpty() {
        assert(this.index === this.data.length, "expected packet to be fully read");
    }

    consumeAll(): string {
        const from = this.index;
        this.index = this.data.length;
        return this.data.substring(from, this.index);
    }

    nextChar(): string {
        assert(this.index < this.data.length, "there are no characters left in the packet");
        return this.data[this.index++];
    }

    nextString(length: number): string {
        assert(length >= 0, "length must be >= 0");
        assert(this.index + length <= this.data.length,
            "there are not " + length + " characters left in the packet");

        const from = this.index;
        this.index += length;
        return this.data.substring(from, this.index);
    }

    nextVarString(lengthCharacters: number=2): string {
        assert(lengthCharacters > 0, "lengthCharacters must be positive");
        const length = this.nextInt(lengthCharacters);
        return this.nextString(length);
    }

    nextInt(length: number): number {
        return parseInt(this.nextString(length));
    }

    nextDigit(): number {
        return this.nextInt(1);
    }

    nextUUID(): string {
        return this.nextString(36);
    }

    nextGameID(): string {
        return this.nextString(GAME_ID_LENGTH);
    }

    nextBool(): boolean {
        const char = this.nextChar();
        if(char === 't') return true;
        if(char === 'f') return false;
        assert(false, "expected a boolean, 't' or 'f'");
    }

    nextLocation(): Vec2 {
        return Vec2.create(this.nextDigit(), this.nextDigit());
    }

    nextPlayer(): string {
        const player = this.nextDigit();
        if (player === 1) return "dark";
        if (player === 2) return "light";
        if (player === 3) return "spectator";
        assert(false, "invalid player " + player);
    }

    nextPlayerState(): object {
        return {
            tiles: this.nextDigit(),
            score: this.nextDigit()
        };
    }

    nextBoard(): number[] {
        const owners: number[] = [];
        for(let index = 0; index < TILES_COUNT; ++index) {
            owners.push(this.nextDigit());
        }
        return owners;
    }

    nextGameState(): GameState {
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
    }
}
