//
// This file stores the logic for playing games online.
//

import {analytics, EventName} from "@/game/analytics/analytics";
import {board, players} from "@/game/model/game_model";
import {Tile} from "@/game/game/board";
import {dice} from "@/game/model/dice_model";
import {Game} from "@/game/game/game";
import {connect, disconnect, sendPacket} from "@/game/network/network"
import {writeDiceRollPacket, writeFindGamePacket, writeMovePacket} from "@/game/network/network_packets";
import {message} from "@/game/model/messages_model";
import {animateTileMove, runOnTileMoveFinish} from "@/game/rendering/render_board";
import {Vec2} from "@/common/vectors";


export class OnlineGame extends Game {

    protected constructor(analyticsGameType: EventName = EventName.ONLINE_GAME) {
        super(analyticsGameType, true);
    }

    override _init() {
        connect();
        dice.reset();
    }

    sendOpenGamePacket() {
        analytics.recordSearchForOnlineGame();
        sendPacket(writeFindGamePacket());
    }

    override onPacketMessage(data) {
        if (data.title === "No moves") {
            this.triggerNoMovesMessage(data.subtitle);
            return;
        }
        message.set(data.title, data.subtitle, true)
    }

    override swapPlayerAfterNoMoves() {
        // Do nothing, we will get sent a state packet.
    }

    override onPacketPlayerStatus(data) {
        if (data.player === "light") {
            players.light.connected = data.connected;
        } else if (data.player === "dark") {
            players.dark.connected = data.connected;
        }
    }

    override onPacketMove(move) {
        const tile = board.getTile(move.from);

        if(tile !== Tile.EMPTY) {
            animateTileMove(move.from, move.to);
            board.setTile(move.to, tile);
            board.setTile(move.from, Tile.EMPTY);
        }
    }

    override onPacketState(state) {
        players.dark.updateState(state.dark.tiles, state.dark.score, state.currentPlayer === "dark");
        players.light.updateState(state.light.tiles, state.light.score, state.currentPlayer === "light");

        layoutDice();
        board.clearSelected();
        board.loadTileState(state.board);

        if (state.isGameWon) {
            runOnTileMoveFinish(function() {
                switchToScreen(SCREEN_WIN);
            });
            disconnect();
            return;
        }

        if(state.hasRoll) {
            if (!dice.rolling) {
                dice.startRolling();
            }

            dice.callback = this.onFinishDice.bind(this);
            dice.setValues(state.roll);
        } else {
            dice.setWaitingForRoll();
            dice.canBeRolled = players.own.active;
        }
    }

    override onDiceClick() {
        if(!dice.active || dice.rolling || !players.own.active)
            return false;

        dice.startRolling();
        sendPacket(writeDiceRollPacket());
        return true;
    }

    onFinishDice() {
        this.setupStartTiles();

        // If the player has only one available move, select it for them.
        if (players.own.active) {
            const availableMoves = board.getAllValidMoves(players.own.playerNo, dice.count());
            if (availableMoves.length === 1) {
                board.select(availableMoves[0]);
            }
        }
    }

    override performMove(from: Vec2, isDragMove?: boolean) {
        super.performMove(from, isDragMove);
        sendPacket(writeMovePacket(from));
    }

    override onFinishMove() {
        // Nothing to do.
    }
}
