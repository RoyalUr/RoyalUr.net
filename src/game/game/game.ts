//
// This file stores the logic for controlling games.
//

import {Vec2} from "@/common/vectors";
import {audioSystem} from "@/game/game_resources";
import {dice} from "@/game/model/dice_model";
import {board, isAwaitingMove, players} from "@/game/model/game_model";
import {analytics, EventName} from "@/game/analytics/analytics";
import {Board, Tile} from "@/game/game/board";
import {message} from "@/game/model/messages_model";
import {animateTileDragMove, animateTileMove, updateTilePathAnchorTime} from "@/game/rendering/render_board";


/**
 * The parent Game class that each different play option derives from.
 */
export abstract class Game {

    readonly analyticsGameType: EventName;
    readonly exitLosesGame: boolean;

    initialised: boolean = false;
    noMovesSwapPlayerTimeout: number = null;

    protected constructor(analyticsGameType: EventName, exitLosesGame: boolean) {
        this.analyticsGameType = analyticsGameType;
        this.exitLosesGame = exitLosesGame;
    }

    onPacketMessage(data) {
        throw new Error("onPacketMessage is unsupported");
    }
    onPacketPlayerStatus(data) {
        throw new Error("onPacketPlayerStatus is unsupported");
    }
    onPacketMove(move) {
        throw new Error("onPacketMove is unsupported");
    }
    onPacketState(state) {
        throw new Error("onPacketState is unsupported");
    }

    abstract onDiceClick();
    abstract swapPlayerAfterNoMoves();
    abstract onFinishMove(fromTile: Vec2, toTile: Vec2);
    abstract _init();

    onGameStart() {
        analytics.recordStartGame(this.analyticsGameType);
    }

    onGameAborted() {
        analytics.recordAbortGame(this.analyticsGameType);
    }

    onGameFinished() {
        analytics.recordFinishGame(this.analyticsGameType)
    }

    init() {
        if (this.initialised)
            return;

        this._init();
        this.initialised = true;
    }

    onTileHover(loc: Vec2) {
        if(isAwaitingMove() && !board.isSelected() && board.isValidMoveFrom(players.own.playerNo, loc, dice.count())) {
            audioSystem.playSound("hover");
        }
    }

    /**
     * We handle desktop clicks and touch clicks differently, but they
     * have a lot in common. This is that common code.
     */
    private commonTileClick(loc: Vec2): boolean {
        const diceValue = dice.count();
        if(board.isSelected()) {
            const to = Board.getMoveDest(players.own.playerNo, board.selectedTile, diceValue);
            if(board.isSelected(loc) || to.equals(loc)) {
                this.performMove(board.selectedTile);
                return true;
            }
        }

        const tileOwner = Tile.getPlayerNo(board.getTile(loc));
        if(!isAwaitingMove() || tileOwner !== players.own.playerNo
            || !board.isValidMoveFrom(tileOwner, loc, diceValue)) {

            if (tileOwner) {
                audioSystem.playSound("error");
            }
            board.clearSelected();
            return true;
        }
        return false;
    }

    onTileClick(loc: Vec2) {
        if (this.commonTileClick(loc))
            return;

        // Normally, clicking a tile should move it. However, when a tile
        // is already selected, clicking should select instead of move.
        if (board.isSelected()) {
            board.select(loc);
            audioSystem.playSound("pickup");
        } else {
            this.performMove(loc);
        }
    }

    onTileTouchClick(loc: Vec2) {
        if (this.commonTileClick(loc))
            return;

        // On touch screens, clicking a tile should always select instead of move.
        board.select(loc);
        audioSystem.playSound("pickup");
    }

    onTileRelease(loc: Vec2) {}

    onTileTouchRelease(loc: Vec2) {
        updateTilePathAnchorTime();

        // Detect if a user dragged a tile to its end point.
        const diceValue = dice.count();
        if(board.isSelected(draggedTile)
                && board.isValidMoveFrom(players.own.playerNo, draggedTile, diceValue)
                && loc.equals(Board.getMoveDest(players.own.playerNo, draggedTile, diceValue))) {

            this.performMove(draggedTile, true);
            return;
        }

        // If a user ended a drag over a tile, select it.
        const tileOwner = Tile.getPlayerNo(board.getTile(loc));
        if (isAwaitingMove() && !board.isSelected() && tileOwner === players.own.playerNo
                && board.isValidMoveFrom(players.own.playerNo, loc, diceValue)) {

            board.select(loc);
            audioSystem.playSound("pickup");
        }
    }

    setupStartTiles() {
        const activePlayer = players.getActive();
        if(!activePlayer || activePlayer.tiles === 0)
            return;

        const playerNo = activePlayer.playerNo,
              startLoc = Board.getStart(playerNo);

        board.setTile(startLoc, Tile.getTile(playerNo));

        if(!board.isValidMoveFrom(playerNo, startLoc, dice.count())) {
            board.setTile(startLoc, Tile.EMPTY);
        }
    }

    clearStartTiles() {
        board.setTile(Board.LIGHT_START, Tile.EMPTY);
        board.setTile(Board.DARK_START, Tile.EMPTY);
    }

    triggerNoMovesMessage(reason: string, fadeDuration: number=0.25, stayDuration: number=2) {
        const totalDuration = 2 * fadeDuration + stayDuration;
        message.set("No moves", reason, true, fadeDuration, stayDuration, fadeDuration);
        setTimeout(() => {audioSystem.playSound("error");}, 1000 * (fadeDuration + 0.25));
        this.noMovesSwapPlayerTimeout = window.setTimeout(() => this.swapPlayerAfterNoMoves(), 1000 * totalDuration);
    }

    onMessageDismissed(title: string, subtitle: string) {
        if (title === "No moves" && this.noMovesSwapPlayerTimeout !== null) {
            window.clearTimeout(this.noMovesSwapPlayerTimeout);
            this.noMovesSwapPlayerTimeout = null;
            this.swapPlayerAfterNoMoves();
        }
    }

    performMove(from: Vec2, isDragMove?: boolean) {
        const diceValue = dice.count(),
              fromTile = board.getTile(from),
              player = players.get(Tile.getPlayerNo(fromTile)),
              to = Board.getMoveDest(player.playerNo, from, diceValue),
              toTile = board.getTile(to);

        // Moving a new piece onto the board.
        if (from.equals(Board.getStart(player.playerNo))) {
            player.takeTile();
        }

        // Taking out a piece.
        if (toTile !== Tile.EMPTY) {
            players.get(Tile.getPlayerNo(toTile)).addTile();
        }

        if (!isDragMove) {
            animateTileMove(from, to, this.onFinishMove.bind(this));
        } else {
            animateTileDragMove(from, to, this.onFinishMove.bind(this));
        }
        board.setTile(to, fromTile);
        board.setTile(from, Tile.EMPTY);

        board.clearSelected();
        player.active = false;
        this.clearStartTiles();
    }
}
