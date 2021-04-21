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
GameSimulator.prototype.findBestMove = function(state, roll) {
    return this.calculateBestMoveAndUtility(state, roll, 1).from;
};
GameSimulator.prototype.calculateBestMoveAndUtility = function(state, roll, depth) {
    const moveStates = this.findMoveStates(state, roll, depth);
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
    for (let roll = 0; roll <= 4; ++roll) {
        const moveAndUtility = this.calculateBestMoveAndUtility(state, roll, depth);
        utility += MOVE_PROBABILITIES[roll] * moveAndUtility.utility;
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
GameSimulator.prototype.findMoveStates = function(state, roll, depth) {
    const moves = state.getValidMoves(roll, this.validMoveLists[depth - 1]),
          moveStates = this.moveStateReturnLists[depth - 1];

    // Clear the moveStates list.
    moveStates.length = 0;
    if (moves.length > 0) {
        // Find the new state after applying each available move.
        for (let index = 0; index < moves.length; ++index) {
            const moveState = this.getStateObject(depth, index);
            moveState.copyFrom(state);
            moveState.applyMove(moves[index], roll);
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

function SimAPI() {
    this.__class_name__ = "SimAPI";
    this.simulators = {};

    postMessage(writeAIFunctionalityPacket(true, false, false).data);
    royalUrAnalysis.load(
        "/game/royal_ur_analysis.wasm",
        this.onRoyalUrAnalysisLoaded.bind(this),
        this.onRoyalUrAnalysisLoadErrored.bind(this)
    );
}
SimAPI.prototype.onMessage = function(event) {
    const packet = aiPackets.readPacket(event.data);

    if (packet.type === "ai_move_request") {
        this.onMoveRequest(packet);
    } else {
        throw "Unsupported packet type " + packet.type;
    }
};
SimAPI.prototype.onMoveRequest = function(request) {
    // Check if we should forward the request to RoyalUrAnalysis.
    if (request.usePanda) {
        const responsePacket = new PacketIn(royalUrAnalysis.sendRequest(request.rawData), true),
              responseMove = responsePacket.nextLocation();
        responsePacket.assertEmpty();

        postMessage(writeAIMoveResponsePacket(responseMove).data);
        return;
    }

    // Find the best move and respond with it.
    const moveFrom = this.getSimulator(request.depth).findBestMove(request.state, request.roll);
    postMessage(writeAIMoveResponsePacket(moveFrom).data)
};
SimAPI.prototype.getSimulator = function(depth) {
    if (!this.simulators.hasOwnProperty(depth)) {
        this.simulators[depth] = new GameSimulator(depth);
    }
    return this.simulators[depth];
};
SimAPI.prototype.onRoyalUrAnalysisLoaded = function() {
    postMessage(writeAIFunctionalityPacket(true, true, false).data);
};
SimAPI.prototype.onRoyalUrAnalysisLoadErrored = function(error) {
    console.error("There was an error loading RoyalUrAnalysis: " + error);
    postMessage(writeAIFunctionalityPacket(true, false, true).data);
};


// Load the simulator!
const simAPI = new SimAPI();
onmessage = simAPI.onMessage.bind(simAPI);

