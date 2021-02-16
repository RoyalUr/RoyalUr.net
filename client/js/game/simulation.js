//
// This file contains logic to simulate future moves of a game.
//

const MOVE_PROBABILITIES = [
    1 / 16.0,
    4 / 16.0,
    6 / 16.0,
    4 / 16.0,
    1 / 16.0,
];

/** Used to store the best move and utility that is tracked throughout simulations. **/
function BestMoveAndUtility() {
    this.from = null;
    this.utility = 0;
}
BestMoveAndUtility.prototype.set = function(from, utility) {
    this.from = from;
    this.utility = utility;
    return this;
};

/**
 * A simulator that is able to simulate and calculate the
 * utility of future moves to a certain depth into the future.
 */
function GameSimulator(depth) {
    this.depth = depth;

    // Objects we re-use to avoid allocations.
    this.stateLists = [];
    this.moveStateReturnLists = [];
    this.validMoveLists = [];
    this.bestMoveAndUtilityObjects = [];
    for (let index = 0; index < depth; ++index) {
        this.stateLists.push([]);
        this.moveStateReturnLists.push([]);
        this.validMoveLists.push([]);
        this.bestMoveAndUtilityObjects.push(new BestMoveAndUtility());
    }
}
GameSimulator.prototype.findBestMove = function(state, diceValue) {
    return this.calculateBestMoveAndUtility(state, diceValue, 1).from;
};
GameSimulator.prototype.calculateBestMoveAndUtility = function(state, diceValue, depth) {
    const moveStates = this.findMoveStates(state, diceValue, depth);
    let bestFrom = null,
        bestUtility = 0;

    for (let index = 0; index < moveStates.length; ++index) {
        const moveState = moveStates[index];

        let utility = NaN;
        if (depth >= this.depth || moveState.won) {
            utility = moveState.calculateUtility(state.activePlayerNo);
        } else {
            utility = this.calculateProbabilityWeightedUtility(moveState, depth + 1);
            // Correct for if the utility is for the other player
            utility *= (state.activePlayerNo === moveState.activePlayerNo ? 1 : -1);
        }

        if (bestFrom === null || utility > bestUtility || (utility === bestUtility && randBool())) {
            bestFrom = moveState.lastMoveFrom;
            bestUtility = utility;
        }
    }
    return this.bestMoveAndUtilityObjects[depth - 1].set(bestFrom, bestUtility);
};
GameSimulator.prototype.calculateProbabilityWeightedUtility = function(state, depth) {
    let utility = 0;
    for (let diceValue = 0; diceValue <= 4; ++diceValue) {
        const moveAndUtility = this.calculateBestMoveAndUtility(state, diceValue, depth);
        utility += MOVE_PROBABILITIES[diceValue] * moveAndUtility.utility;
    }
    return utility;
};
GameSimulator.prototype.getStateObject = function(depth, index) {
    const list = this.stateLists[depth - 1];
    while (list.length <= index) {
        list.push(new GameState());
    }
    return list[index];
};
GameSimulator.prototype.findMoveStates = function(state, diceValue, depth) {
    const moves = state.getValidMoves(diceValue, this.validMoveLists[depth - 1]),
          moveStates = this.moveStateReturnLists[depth - 1];
    // Clear the moveStates list.
    moveStates.length = 0;
    if (moves.length > 0) {
        // Find the new state after applying each available move.
        for (let index = 0; index < moves.length; ++index) {
            const moveState = this.getStateObject(depth, index);
            moveState.copyFrom(state);
            moveState.applyMove(moves[index], diceValue);
            moveStates.push(moveState);
        }
    } else {
        // If there are no available moves, just swap the current player.
        const moveState = this.getStateObject(depth, 0);
        moveState.copyFrom(state);
        moveState.swapActivePlayer();
        moveStates.push(moveState);
    }
    return moveStates;
};


//
// Web Worker Communication.
//

const simulators = {};
function getSimulator(depth) {
    if (!simulators.hasOwnProperty(depth)) {
        simulators[depth] = new GameSimulator(depth);
    }
    return simulators[depth];
}

onmessage = function(event) {
    // Read the request.
    const packet = new PacketIn(event.data, true),
          request = readSimWorkerRequest(packet);
    packet.assertEmpty();

    // Find the best move and respond with it.
    const bestMove = getSimulator(request.depth).findBestMove(request.state, request.diceValue),
          response = writeSimWorkerResponse(bestMove);
    postMessage(response.data)
};
