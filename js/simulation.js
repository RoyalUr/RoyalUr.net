//
// This file contains logic to simulate future moves of a game.
//

const MOVE_PROBABILITIES = [
    1 / 16,
    4 / 16,
    6 / 16,
    4 / 16,
    1 / 16,
];

function GameState(board, activePlayerNo, lightTiles, lightScore, darkTiles, darkScore) {
    this.board = board;
    this.activePlayerNo = activePlayerNo;
    this.lightTiles = lightTiles;
    this.lightScore = lightScore;
    this.darkTiles = darkTiles;
    this.darkScore = darkScore;

    this.calculateUtility = function(playerNo) {
        let lightUtility = 15 * (this.lightScore - this.darkScore);
        for (let index = 0; index < TILES_COUNT; ++index) {
            const loc = TILE_LOCS[index],
                  tile = this.board.getTile(loc);

            if (!isTileLocOnBoard(loc))
                continue;

            switch (tile) {
                case TILE_LIGHT:
                    lightUtility += vecListIndexOf(LIGHT_PATH, loc);
                    break;
                case TILE_DARK:
                    lightUtility -= vecListIndexOf(DARK_PATH, loc);
                    break;
                default:
                    break;
            }
        }

        switch (playerNo) {
            case LIGHT_PLAYER_NO:
                return lightUtility;
            case DARK_PLAYER_NO:
                return -lightUtility;
            default:
                throw "Invalid playerNo " + playerNo;
        }
    }.bind(this);

    this.setupStartTiles = function() {
        this.board.setTile(LIGHT_START, (this.lightTiles > 0 ? TILE_LIGHT : TILE_EMPTY));
        this.board.setTile(DARK_START, (this.darkTiles > 0 ? TILE_DARK : TILE_EMPTY));
    }.bind(this);

    this.findBestMove = function(moveDistance, depth) {
        const bestMove = this.findTieredBestMoveAndUtility(moveDistance, depth);
        return bestMove.from;
    }.bind(this);

    this.findTieredBestMoveAndUtility = function(moveDistance, depth) {
        const moveStates = this.findMoveStates(moveDistance);

        let bestFrom = null,
            bestUtility = 0;

        for (let index = 0; index < moveStates.length; ++index) {
            const move = moveStates[index];

            let utility = NaN;
            if (depth <= 1) {
                utility = move.state.calculateUtility(this.activePlayerNo);
            } else {
                utility = move.state.findTieredWeightedUtility(depth - 1);
                // Correct for if the utility is for the other player
                utility *= (this.activePlayerNo === move.state.activePlayerNo ? 1 : -1);
            }

            if (bestFrom === null || utility > bestUtility) {
                bestFrom = move.from;
                bestUtility = utility;
            }
        }

        return {
            from: bestFrom,
            utility: bestUtility
        };
    }.bind(this);

    this.findTieredWeightedUtility = function(depth) {
        let weighted = 0;
        for (let moveDistance = 0; moveDistance <= 4; ++moveDistance) {
            const bestMove = this.findTieredBestMoveAndUtility(moveDistance, depth);

            weighted += MOVE_PROBABILITIES[moveDistance] * bestMove.utility;
        }
        return weighted;
    }.bind(this);

    this.findMoveStates = function(moveDistance) {
        this.setupStartTiles();

        const moves = this.board.getAllValidMoves(this.activePlayerNo, moveDistance),
              states = [];

        for (let index = 0; index < moves.length; ++index) {
            const from = moves[index],
                  to = getTileMoveToLocation(this.activePlayerNo, from, moveDistance),
                  toTile = this.board.getTile(to),
                  newBoard = this.board.clone();

            let newLightTiles = this.lightTiles,
                newLightScore = this.lightScore,
                newDarkTiles = this.darkTiles,
                newDarkScore = this.darkScore,
                newActivePlayerNo = this.activePlayerNo;

            if (!isLocusTile(to)) {
                newActivePlayerNo = (this.activePlayerNo === LIGHT_PLAYER_NO ? DARK_PLAYER_NO : LIGHT_PLAYER_NO);
            }

            newBoard.setTile(from, TILE_EMPTY);
            if (isStartTile(this.activePlayerNo, from)) {
                if (this.activePlayerNo === LIGHT_PLAYER_NO) {
                    newLightTiles -= 1;
                } else {
                    newDarkTiles -= 1;
                }
            }

            if (!isEndTile(this.activePlayerNo, to)) {
                newBoard.setTile(to, this.activePlayerNo);

                if (toTile === TILE_LIGHT) {
                    newLightTiles += 1;
                } else if (toTile === TILE_DARK) {
                    newDarkTiles += 1;
                }

            } else if (this.activePlayerNo === LIGHT_PLAYER_NO) {
                newLightScore += 1;
            } else {
                newDarkScore += 1;
            }

            const newState = new GameState(
                newBoard, newActivePlayerNo,
                newLightTiles, newLightScore,
                newDarkTiles, newDarkScore
            );

            states.push({
                from: from,
                state: newState
            });
        }

        // If there are no available moves
        if (states.length === 0) {
            const newActivePlayerNo = (this.activePlayerNo === LIGHT_PLAYER_NO ? DARK_PLAYER_NO : LIGHT_PLAYER_NO),
                  newState = new GameState(
                      this.board.clone(), newActivePlayerNo,
                      this.lightTiles, this.lightScore,
                      this.darkTiles, this.darkScore
                  );

            states.push({
                from: null,
                state: newState
            });
        }

        return states;
    }.bind(this);
}

function captureCurrentGameState() {
    return new GameState(
        board.clone(), getActivePlayer().playerNo,
        lightPlayer.tiles.current, lightPlayer.score.current,
        darkPlayer.tiles.current, darkPlayer.score.current
    );
}
