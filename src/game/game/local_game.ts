//
// This file stores logic for playing a local game
// against another player on the same computer.
//

import {EventName} from "@/game/analytics/analytics";
import {board, GamePlayer, players} from "@/game/model/game_model";
import {dice} from "@/game/model/dice_model";
import {Board, PlayerNo, Tile} from "@/game/game/board";
import {BrowserGame} from "@/game/game/browser_game";
import {randBool} from "@/common/utils";
import {Vec2} from "@/common/vectors";


export class LocalGame extends BrowserGame {

    protected constructor() {
        super(EventName.LOCAL_GAME);

        // Setup the game.
        players.setOwnPlayer(PlayerNo.random());
        this.turnPlayer = players.light;

        // Reset the names of the players.
        players.light.name = "Light";
        players.dark.name = "Dark";
    }

    updateActivePlayer() {
        players.left.active = this.isLeftTurn();
        players.right.active = this.isRightTurn();
        players.setOwnPlayer(players.left.active ? players.left.playerNo : players.right.playerNo);
    }

    override setupRoll() {
        this.updateActivePlayer();
        layoutDice();
        board.clearSelected();
        dice.setWaitingForRoll();
        dice.canBeRolled = players.own.active;
    }

    override onFinishMove(fromTile: Vec2, toTile: Vec2) {
        // If they've just taken a piece off the board, give them some score
        if (toTile.equals(Board.getEnd(this.turnPlayer.playerNo))) {
            this.updateActivePlayer();

            this.turnPlayer.addScore();
            board.setTile(toTile, Tile.EMPTY);

            if (this.turnPlayer.score === 7) {
                switchToScreen(SCREEN_WIN);
                return;
            }
        }

        if (!Board.isRosette(toTile)) {
            this.turnPlayer = (this.isLeftTurn() ? players.right : players.left);
        }
        this.setupRoll();
    }

    override onFinishDice() {
        this.setupStartTiles();

        const diceCount = dice.count();
        const availableMoves = board.getAllValidMoves(this.turnPlayer.playerNo, diceCount);
        if (availableMoves.length === 0) {
            if (diceCount === 0) {
                this.triggerNoMovesMessage(this.turnPlayer.name + " rolled a zero");
            } else {
                this.triggerNoMovesMessage("All moves are blocked");
            }
        } else if (availableMoves.length === 1) {
            board.select(availableMoves[0]);
        }
    }

    override swapPlayerAfterNoMoves() {
        this.turnPlayer = (this.isLeftTurn() ? players.right : players.left);
        this.setupRoll();
    }
}
