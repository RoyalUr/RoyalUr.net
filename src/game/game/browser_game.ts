//
// This file stores the logic for games that are local to the browser.
//

import {board, GamePlayer, players} from "@/game/model/game_model";
import {Dice, dice} from "@/game/model/dice_model";
import {Game} from "@/game/game/game";
import {EventName} from "@/game/analytics/analytics";


export abstract class BrowserGame extends Game {

    protected turnPlayer: GamePlayer;

    protected constructor(analyticsGameType: EventName) {
        super(analyticsGameType, true);
    }

    abstract setupRoll();
    abstract onFinishDice();

    _init() {
        players.left.updateState(7, 0, this.isLeftTurn());
        players.right.updateState(7, 0, this.isRightTurn());
        players.left.connected = true;
        players.right.connected = true;

        board.clear();
        dice.reset();
        this.setupRoll();
    }

    isLeftTurn() {
        return this.turnPlayer == players.left;
    }

    isRightTurn() {
        return this.turnPlayer == players.right;
    }

    onDiceClick() {
        if(!dice.active || dice.rolling || !players.own.active)
            return false;

        dice.startRolling();
        dice.callback = this.onFinishDice.bind(this);
        dice.setValues(Dice.generateRandomValues());
        return true;
    }
}
