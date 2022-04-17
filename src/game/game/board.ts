//
// This file contains logic for analysing a game board.
//

import {Vec2, Vec2List} from "@/common/vectors";
import {assert, error, randBool} from "@/common/utils";
import {board, players} from "@/game/model/game_model";


/**
 * An identifying number for each player.
 */
export enum PlayerNo {
    DARK = 1,
    LIGHT = 2,
    SPECTATOR = 3
}
export namespace PlayerNo {
    export function random() {
        return randBool() ? PlayerNo.LIGHT : PlayerNo.DARK;
    }
}

/**
 * The state of a tile on the board.
 */
export enum Tile {
    EMPTY = 0,
    DARK = 1,
    LIGHT = 2
}
export namespace Tile {
    export function getPlayerNo(tile: Tile): PlayerNo {
        switch (tile) {
            case Tile.DARK: return PlayerNo.DARK;
            case Tile.LIGHT: return PlayerNo.LIGHT;
            case Tile.EMPTY:
                return null;
            default:
                throw "Unknown tile " + tile;
        }
    }

    export function getTile(playerNo: PlayerNo): Tile {
        switch (playerNo) {
            case PlayerNo.DARK: return Tile.DARK;
            case PlayerNo.LIGHT: return Tile.LIGHT;
            case PlayerNo.SPECTATOR:
                return null;
            default:
                throw "Unknown player number " + playerNo;
        }
    }

    export function isValid(tile: number): boolean {
        return tile === Tile.EMPTY || tile === Tile.DARK || tile === Tile.LIGHT;
    }
}


/**
 * Manages all the tiles on the game board.
 */
export class Board {

    static readonly WIDTH: number = 3;
    static readonly HEIGHT: number = 8;
    static readonly TILE_COUNT: number = Board.WIDTH * Board.HEIGHT;
    static readonly TILE_LOCS: Vec2List = Vec2List.all(Board.WIDTH, Board.HEIGHT);

    static readonly DARK_PATH: Vec2List = Vec2List.path(
        [0, 4], [0, 0], [1, 0], [1, 7], [0, 7], [0, 5]
    );
    static readonly DARK_START: Vec2 = Board.DARK_PATH.get(0);
    static readonly DARK_END: Vec2 = Board.DARK_PATH.get(Board.DARK_PATH.length - 1);

    static readonly LIGHT_PATH: Vec2List = Vec2List.path(
        [2, 4], [2, 0], [1, 0], [1, 7], [2, 7], [2, 5]
    );
    static readonly LIGHT_START: Vec2 = Board.LIGHT_PATH.get(0);
    static readonly LIGHT_END: Vec2 = Board.LIGHT_PATH.get(Board.LIGHT_PATH.length - 1);

    static readonly ROSETTES: Vec2List = Vec2List.create(
        [0, 0], [2, 0], [1, 3], [0, 6], [2, 6]
    );

    tiles: Tile[];

    constructor() {
        for (let index = 0; index < Board.TILE_COUNT; ++index) {
            this.tiles.push(Tile.EMPTY);
        }
    }

    copyFrom(other: Board) {
        for (let index = 0; index < Board.TILE_COUNT; ++index) {
            this.tiles[index] = other.tiles[index];
        }
    }

    getTile(loc: Vec2): Tile {
        return (Board.isLocValid(loc) ? this.tiles[loc.x + loc.y * Board.WIDTH] : Tile.EMPTY);
    }

    setTile(loc: Vec2, tile: Tile) {
        assert(Board.isLocValid(loc), "invalid tile location " + loc);
        this.tiles[loc.x + loc.y * Board.WIDTH] = tile;
    }

    loadTileState(flat: number[]) {
        assert(flat.length === Board.TILE_COUNT, "Expected " + Board.TILE_COUNT + " tiles, got " + flat.length);

        for (let index = 0; index < Board.TILE_COUNT; ++index) {
            const tileNo = flat[index];
            if (!Tile.isValid(tileNo)) {
                error("Invalid tile " + tileNo + " at index " + index);
                return
            }
            this.tiles[index] = tileNo as Tile;
        }
    }

    clear() {
        for (let index = 0; index < Board.TILE_COUNT; ++index) {
            this.tiles[index] = Tile.EMPTY;
        }
    }

    isValidMoveFrom(playerNo: PlayerNo, loc: Vec2, moveDistance: number) {
        if(moveDistance <= 0)
            return false;

        const toLoc = Board.getMoveDest(playerNo, loc, moveDistance);
        if(toLoc === null)
            return false;

        const to = this.getTile(toLoc),
              from = this.getTile(loc);

        if (from === Tile.EMPTY || from !== Tile.getTile(playerNo) || to === from)
            return false;
        return to === Tile.EMPTY || !Board.isRosette(toLoc);
    }

    getAllValidMoves(playerNo: PlayerNo, moveDistance: number, outList?: Vec2[]): Vec2[] {
        if (outList === undefined) {
            outList = [];
        } else {
            outList.length = 0;
        }
        if (moveDistance <= 0)
            return outList;

        for (let index = 0; index < Board.TILE_COUNT; ++index) {
            const loc = Board.TILE_LOCS.get(index);
            if (this.isValidMoveFrom(playerNo, loc, moveDistance)) {
                outList.push(loc);
            }
        }
        return outList;
    }

    /**
     * Returns whether {@param loc} represents a valid location for a tile.
     * This returns true for the start and end positions.
     */
    static isLocValid(loc: Vec2): boolean {
        return loc.x >= 0 && loc.y >= 0 && loc.x < Board.WIDTH && loc.y < Board.HEIGHT;
    }

    /**
     * Returns whether {@param loc} represents a valid location for a tile that
     * is also on the board. This returns false for the start and end positions.
     */
    static isLocOnBoard(loc: Vec2): boolean {
        if(!Board.isLocValid(loc))
            return false;

        return loc.x === 1 || (loc.y !== 4 && loc.y !== 5);
    }

    static getPath(playerNo: PlayerNo): Vec2List {
        switch (playerNo) {
            case PlayerNo.LIGHT: return Board.LIGHT_PATH;
            case PlayerNo.DARK:  return Board.DARK_PATH;
            case PlayerNo.SPECTATOR: return Vec2List.EMPTY;
            default:
                throw "Unknown player number " + playerNo;
        }
    }

    static getStart(playerNo: PlayerNo): Vec2 {
        switch (playerNo) {
            case PlayerNo.LIGHT: return Board.LIGHT_START;
            case PlayerNo.DARK:  return Board.DARK_START;
            case PlayerNo.SPECTATOR: return Vec2.NEG1;
            default:
                throw "Unknown player number " + playerNo;
        }
    }

    static getEnd(playerNo: PlayerNo): Vec2 {
        switch (playerNo) {
            case PlayerNo.LIGHT: return Board.LIGHT_END;
            case PlayerNo.DARK:  return Board.DARK_END;
            case PlayerNo.SPECTATOR: return Vec2.NEG1;
            default:
                throw "Unknown player number " + playerNo;
        }
    }

    static isStart(playerNo: PlayerNo, loc: Vec2): boolean {
        return Board.getStart(playerNo).equals(loc);
    }

    static isEnd(playerNo: PlayerNo, loc: Vec2): boolean {
        return Board.getEnd(playerNo).equals(loc);
    }

    static isRosette(loc: Vec2): boolean {
        return Board.ROSETTES.contains(loc);
    }

    static getMoveDest(playerNo: PlayerNo, from: Vec2, moveDistance: number): Vec2 {
        const path = Board.getPath(playerNo),
            fromIndex = path.indexOf(from),
            toIndex = fromIndex + moveDistance;
        return (fromIndex >= 0 && toIndex < path.length ? path[toIndex] : null);
    }
}


/**
 * Represents the current state of a game.
 */
export class GameState {

    board: Board = new Board();
    activePlayerNo: PlayerNo = null;
    lightTiles: number = -1;
    lightScore: number = -1;
    darkTiles: number = -1;
    darkScore: number = -1;
    lightWon: boolean = false;
    darkWon: boolean = false;
    won: boolean = false;
    lastMoveFrom: Vec2 = null;

    updateStartTiles() {
        this.board.setTile(Board.LIGHT_START, (this.lightTiles > 0 ? Tile.LIGHT : Tile.EMPTY));
        this.board.setTile(Board.DARK_START, (this.darkTiles > 0 ? Tile.DARK : Tile.EMPTY));
    }

    copyFrom(other: GameState) {
        this.board.copyFrom(other.board);
        this.activePlayerNo = other.activePlayerNo;
        this.lightTiles = other.lightTiles;
        this.lightScore = other.lightScore;
        this.darkTiles = other.darkTiles;
        this.darkScore = other.darkScore;
        this.lightWon = other.lightWon;
        this.darkWon = other.darkWon;
        this.won = other.won;
        this.updateStartTiles();
    }

    copyFromCurrentGame() {
        this.board.copyFrom(board);
        this.activePlayerNo = players.getActive().playerNo;
        this.lightTiles = players.light.tiles;
        this.lightScore = players.light.score;
        this.darkTiles = players.dark.tiles;
        this.darkScore = players.dark.score;
        this.lightWon = (this.lightScore >= 7);
        this.darkWon = (this.darkScore >= 7);
        this.won = (this.lightWon || this.darkWon);
        this.updateStartTiles();
    }

    getValidMoves(diceValue: number, outList?: Vec2[]): Vec2[] {
        this.updateStartTiles();
        return this.board.getAllValidMoves(this.activePlayerNo, diceValue, outList);
    }

    applyMove(from: Vec2, diceValue: number) {
        const to = Board.getMoveDest(this.activePlayerNo, from, diceValue),
              toTile = this.board.getTile(to);

        // Remove the old tile.
        this.board.setTile(from, Tile.EMPTY);

        // Reduce the player's tile count if they moved a new tile onto the board.
        if (Board.isStart(this.activePlayerNo, from)) {
            if (this.activePlayerNo === PlayerNo.LIGHT) {
                this.lightTiles -= 1;
            } else {
                this.darkTiles -= 1;
            }
        }

        // If the tile isn't being moved off the board, move the tile.
        // Else, increase the player's score.
        if (!Board.isEnd(this.activePlayerNo, to)) {
            this.board.setTile(to, Tile.getTile(this.activePlayerNo));

            // If the opponent's tile is taken off the board, add it back to their tile count.
            if (toTile === Tile.LIGHT) {
                this.lightTiles += 1;
            } else if (toTile === Tile.DARK) {
                this.darkTiles += 1;
            }
        } else if (this.activePlayerNo === PlayerNo.LIGHT) {
            this.lightScore += 1;
            if (this.lightScore >= 7) {
                this.lightWon = true;
                this.won = true;
            }
        } else {
            this.darkScore += 1;
            if (this.darkScore >= 7) {
                this.darkWon = true;
                this.won = true;
            }
        }

        // If the tile isn't a rosette, swap the current player.
        if (!Board.isRosette(to)) {
            this.swapActivePlayer();
        }

        // Update the last move that was applied.
        this.lastMoveFrom = from;
        this.updateStartTiles();
    }

    swapActivePlayer() {
        this.activePlayerNo = (this.activePlayerNo === PlayerNo.LIGHT ? PlayerNo.DARK : PlayerNo.LIGHT);
        this.lastMoveFrom = null;
    }

    calculateUtility(playerNo: PlayerNo): number {
        // We give 1 extra utility for taking a tile off the board.
        let lightUtility = 16 * (this.lightScore - this.darkScore);
        for (let index = 0; index < Board.TILE_COUNT; ++index) {
            const loc = Board.TILE_LOCS.get(index),
                tile = this.board.getTile(loc);

            // Ignore empty, start, and end tiles
            if (tile === Tile.EMPTY || !Board.isLocOnBoard(loc))
                continue;

            // Add utility based on how far each tile has been moved.
            if (tile === Tile.LIGHT) {
                lightUtility += Board.LIGHT_PATH.indexOf(loc);
            } else {
                lightUtility -= Board.DARK_PATH.indexOf(loc);
            }
        }
        return playerNo === PlayerNo.LIGHT ? lightUtility : -lightUtility;
    }
}
