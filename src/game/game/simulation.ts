//
// This file contains logic to simulate future moves of a game.
//

import {randBool} from "@/common/utils";
import {GameState} from "@/game/game/board";
import {Vec2} from "@/common/vectors";


/**
 * Used to store the best move and utility that is tracked throughout simulations.
 */
export class BestMoveAndUtility {
    from: Vec2 = null;
    utility: number = 0;

    set(from: Vec2, utility: number) {
        this.from = from;
        this.utility = utility;
        return this;
    }
}

/**
 * A simulator that is able to simulate and calculate the
 * utility of future moves to a certain depth into the future.
 */
export class GameSimulator {

    /**
     * This is limited to 7, as players only have 7 tiles.
     */
    static readonly MAX_POSSIBLE_MOVES = 7;
    static readonly MOVE_PROBABILITIES = [
        1 / 16.0,
        4 / 16.0,
        6 / 16.0,
        4 / 16.0,
        1 / 16.0,
    ];

    depth: number;

    stateLists: GameState[][] = [];
    moveStateReturnLists: GameState[][] = [];
    validMoveLists: Vec2[][] = [];
    bestMoveAndUtilityObjects: BestMoveAndUtility[] = [];

    constructor(depth: number) {
        this.depth = depth;

        for (let index = 0; index < depth; ++index) {
            const stateList: GameState[] = [];
            for (let moveIndex = 0; moveIndex < GameSimulator.MAX_POSSIBLE_MOVES; ++moveIndex) {
                stateList.push(new GameState());
            }
            this.stateLists.push(stateList);

            this.moveStateReturnLists.push([]);
            this.validMoveLists.push([]);
            this.bestMoveAndUtilityObjects.push(new BestMoveAndUtility());
        }
    }

    findBestMove(state: GameState, roll: number) {
        return this.calculateBestMoveAndUtility(state, roll, 1).from;
    }

    calculateBestMoveAndUtility(state: GameState, roll: number, currentDepth: number) {
        const moveStates = this.findMoveStates(state, roll, currentDepth);
        let bestFrom = null,
            bestUtility = 0;

        for (let index = 0; index < moveStates.length; ++index) {
            const moveState = moveStates[index];

            let utility = NaN;
            if (currentDepth >= this.depth || moveState.won) {
                utility = moveState.calculateUtility(state.activePlayerNo);
            } else {
                utility = this.calculateProbabilityWeightedUtility(moveState, currentDepth + 1);
                // Correct for if the utility is for the other player
                utility *= (state.activePlayerNo === moveState.activePlayerNo ? 1 : -1);
            }

            if (bestFrom === null || utility > bestUtility || (utility === bestUtility && randBool())) {
                bestFrom = moveState.lastMoveFrom;
                bestUtility = utility;
            }
        }
        return this.bestMoveAndUtilityObjects[currentDepth - 1].set(bestFrom, bestUtility);
    }

    calculateProbabilityWeightedUtility(state: GameState, currentDepth: number) {
        let utility = 0;
        for (let roll = 0; roll <= 4; ++roll) {
            const moveAndUtility = this.calculateBestMoveAndUtility(state, roll, currentDepth);
            utility += GameSimulator.MOVE_PROBABILITIES[roll] * moveAndUtility.utility;
        }
        return utility;
    }

    findMoveStates(state: GameState, roll: number, currentDepth: number) {
        const moves = state.getValidMoves(roll, this.validMoveLists[currentDepth - 1]),
              moveStates = this.moveStateReturnLists[currentDepth - 1],
              moveStateObjects = this.stateLists[currentDepth - 1];

        // Clear the moveStates list.
        moveStates.length = 0;
        if (moves.length > 0) {
            // Find the new state after applying each available move.
            for (let index = 0; index < moves.length; ++index) {
                const moveState = moveStateObjects[index];
                moveState.copyFrom(state);
                moveState.applyMove(moves[index], roll);
                moveStates.push(moveState);
            }
        } else {
            // If there are no available moves, just swap the current player.
            const moveState = moveStateObjects[0];
            moveState.copyFrom(state);
            moveState.swapActivePlayer();
            moveStates.push(moveState);
        }
        return moveStates;
    }
}
