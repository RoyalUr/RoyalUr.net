//
// Represents games that are played against the computer.
//

import {EventName} from "@/game/analytics/analytics";
import {board, players} from "@/game/model/game_model";
import {Board, GameState, PlayerNo, Tile} from "@/game/game/board";
import {Dice, dice} from "@/game/model/dice_model";
import {BrowserGame} from "@/game/game/browser_game";
import {computerWorker} from "@/game/game/ai_worker_invoker";
import {Vec2} from "@/common/vectors";
import {writeAIMoveRequestPacket} from "@/game/network/ai_packets";
import {animateTileMove} from "@/game/rendering/render_board";


export enum ComputerDifficulty {
    EASY = 1,
    MEDIUM = 2,
    HARD = 5,
    PANDA = 7
}
export namespace ComputerDifficulty {
    export function getEventName(difficulty: ComputerDifficulty): EventName {
        switch (difficulty) {
            case ComputerDifficulty.EASY:   return EventName.COMPUTER_GAME_EASY;
            case ComputerDifficulty.MEDIUM: return EventName.COMPUTER_GAME_MEDIUM;
            case ComputerDifficulty.HARD:   return EventName.COMPUTER_GAME_HARD;
            case ComputerDifficulty.PANDA:  return EventName.COMPUTER_GAME_PANDA;
            default:
                return EventName.COMPUTER_GAME_UNKNOWN;
        }
    }
}


export class ComputerGame extends BrowserGame {

    private readonly difficulty: ComputerDifficulty;

    private waitingForComputerMove: boolean = false;
    private computerMove: Vec2 = null;

    protected constructor(difficulty: ComputerDifficulty) {
        super(ComputerDifficulty.getEventName(difficulty));
        this.difficulty = difficulty;

        players.setOwnPlayer(PlayerNo.random());
        players.own.name = "Human";
        players.other.name = "Computer";
        this.turnPlayer = players.light;

        computerWorker.load();
    }

    isComputerTurn() {
        return this.turnPlayer === players.other;
    }

    isHumanTurn() {
        return this.turnPlayer === players.own;
    }

    updateActivePlayer() {
        players.own.active = this.isHumanTurn();
        players.other.active = this.isComputerTurn();
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
            this.turnPlayer = (this.isHumanTurn() ? players.other : players.own);
        }

        this.setupRoll();
    }

    override swapPlayerAfterNoMoves() {
        this.turnPlayer = (this.isHumanTurn() ? players.other : players.own);
        this.setupRoll();
    }

    override setupRoll() {
        this.updateActivePlayer();
        layoutDice();
        board.clearSelected();
        if (this.isHumanTurn()) {
            dice.setWaitingForRoll();
            dice.canBeRolled = players.own.active;
        } else {
            dice.startRolling();
            dice.callback = this.onFinishDice.bind(this);
            const diceValues = Dice.generateRandomValues();
            this.findComputerMove(Dice.count(diceValues));
            dice.setValues(diceValues);
        }
    }

    override onFinishDice() {
        this.setupStartTiles();

        const roll = dice.count(),
              availableMoves = board.getAllValidMoves(this.turnPlayer.playerNo, roll);

        if (availableMoves.length === 0) {
            if (roll === 0) {
                const player = (this.isHumanTurn() ? "You" : "Computer");
                this.triggerNoMovesMessage(player + " rolled a zero");
            } else {
                this.triggerNoMovesMessage("All moves are blocked");
            }
            return;
        } else if (availableMoves.length === 1 && this.isHumanTurn()) {
            board.select(availableMoves[0]);
        }

        // Check if we've already found the computer move.
        if (this.computerMove !== null) {
            this.performComputerMove();
        }
    }

    findComputerMove(roll: number) {
        this.computerMove = null;

        const state = new GameState();
        state.copyFromCurrentGame();
        const availableMoves = state.board.getAllValidMoves(this.turnPlayer.playerNo, roll);
        if (availableMoves.length === 0)
            return;

        // Get the AI involved.
        const workerRequest = writeAIMoveRequestPacket(state, roll, this.difficulty, this.difficulty > 5);
        this.waitingForComputerMove = true;
        computerWorker.postMessage(workerRequest.data);
    }

    onReceiveComputerMove(from: Vec2) {
        if (!this.waitingForComputerMove)
            return;

        this.waitingForComputerMove = false;
        this.computerMove = from;

        // We don't play the move until the dice are finished rolling.
        if (!dice.rolling) {
            this.performComputerMove();
        }
    }

    performComputerMove() {
        const from = this.computerMove;
        this.computerMove = null;

        const diceValue = dice.count(),
              computerPlayer = players.other,
              to = Board.getMoveDest(computerPlayer.playerNo, from, diceValue),
              toTile = board.getTile(to);

        // Moving a new piece onto the board.
        if (from.equals(Board.getStart(computerPlayer.playerNo))) {
            computerPlayer.takeTile();
        }

        // Taking out a piece.
        if (toTile !== Tile.EMPTY) {
            players.get(Tile.getPlayerNo(toTile)).addTile();
        }

        animateTileMove(from, to, this.onFinishMove.bind(this));
        board.setTile(to, computerPlayer.tile);
        board.setTile(from, Tile.EMPTY);
        computerPlayer.active = false;

        this.clearStartTiles();
    }
}
