//
// This file stores and manages the state of the game.
//

import {dice} from "@/game/model/dice_model";
import {Board, PlayerNo, Tile} from "@/game/game/board";
import {Vec2} from "@/common/vectors";
import {networkStatus} from "@/game/model/messages_model";


export function resetGame() {
    board.clear();
    dice.reset();
    networkStatus.reset();
}


//
// MENU
//

export enum GameMode {
    LOCAL,
    COMPUTER,
    ONLINE,
    FRIEND
}

export class GameSetup {
    mode: GameMode = null;
    difficulty: number = null;
}
export const gameSetup = new GameSetup();



//
// TILES
//

export class GameBoard extends Board {

    selectedTile: Vec2 = Vec2.NEG1;
    hoveredTile: Vec2 = Vec2.NEG1;

    select(loc: Vec2) {
        if(!Board.isLocValid(loc) || board.getTile(loc) === Tile.EMPTY) {
            this.clearSelected();
            return;
        }

        this.selectedTile = loc;
    }

    clearSelected() {
        this.selectedTile = Vec2.NEG1;
    }

    setHovered(loc?: Vec2) {
        this.hoveredTile = (loc ? loc : Vec2.NEG1);
    }

    clearHovered() {
        this.hoveredTile = Vec2.NEG1;
    }

    isSelected(loc?: Vec2): boolean {
        return Board.isLocValid(loc) && (!loc || loc.equals(this.selectedTile));
    }

    isHovered(loc?: Vec2): boolean {
        return Board.isLocValid(loc) && (!loc || loc.equals(this.selectedTile));
    }

    clear() {
        super.clear();
        this.clearSelected();
        this.clearHovered();
    }
}

export const board: GameBoard = new GameBoard();


//
// PLAYERS
//

export class GamePlayer {

    readonly playerNo: PlayerNo;
    readonly tile: Tile;
    name: string;

    active: boolean = false;
    connected: boolean = true;
    tiles: number = 7;
    score: number = 0;

    constructor(playerNo: PlayerNo, name: string) {
        this.playerNo = playerNo;
        this.tile = Tile.getTile(playerNo);
        this.name = name;
    }

    updateState(tiles, score, active) {
        this.tiles = tiles;
        this.score = score;
        this.active = active;
    }

    addTile() {
        this.tiles += 1;
    }

    takeTile() {
        this.tiles -= 1;
    }

    addScore() {
        this.score += 1;
    }
}

export class GamePlayers {

    readonly dark: GamePlayer = new GamePlayer(PlayerNo.DARK, "Dark");
    readonly light: GamePlayer = new GamePlayer(PlayerNo.LIGHT, "Light");
    readonly spectator: GamePlayer = new GamePlayer(PlayerNo.SPECTATOR, "Spectator");

    left: GamePlayer;
    right: GamePlayer;

    own: GamePlayer;
    other?: GamePlayer;
    others: GamePlayer[];

    get(player: PlayerNo): GamePlayer {
        switch (player) {
            case PlayerNo.LIGHT:
                return this.light;
            case PlayerNo.DARK:
                return this.dark;
            case PlayerNo.SPECTATOR:
                return this.spectator;
            default:
                throw new Error("Unknown PlayerNo " + player);
        }
    }

    getActive(): GamePlayer {
        return this.light.active ? this.light : (this.dark.active ? this.dark : null);
    }

    setOwnPlayer(player: PlayerNo) {
        switch (player) {
            case PlayerNo.LIGHT:
                this.own = this.light;
                this.other = this.dark;
                this.others = [this.other];
                this.left = this.light;
                this.right = this.dark;
                break

            case PlayerNo.DARK:
                this.own = this.dark;
                this.other = this.light;
                this.others = [this.other];
                this.left = this.dark;
                this.right = this.light;
                break;

            case PlayerNo.SPECTATOR:
                this.own = this.spectator;
                this.other = null;
                this.others = [this.light, this.dark];
                this.left = this.light;
                this.right = this.dark;
                break;

            default:
                throw new Error("Unknown PlayerNo " + player);
        }
    }
}

export const players: GamePlayers = new GamePlayers();



export function isAwaitingMove() {
    return !dice.active && !dice.rolling && players.own.active;
}