//
// This file contains logic for analysing a game board.
//

const TILES_WIDTH = 3,
      TILES_HEIGHT = 8,
      TILES_COUNT = TILES_WIDTH * TILES_HEIGHT;

const TILE_LOCS = [];
for(let x = 0; x < TILES_WIDTH; ++x) {
    for(let y = 0; y < TILES_HEIGHT; ++y) {
        TILE_LOCS.push(vec(x, y));
    }
}

const TILE_EMPTY = 0,
      TILE_DARK = 1,
      TILE_LIGHT = 2;

const LIGHT_PLAYER_NO = TILE_LIGHT,
      DARK_PLAYER_NO = TILE_DARK;

const LIGHT_PATH = vecList(
    0, 4,
    0, 3,
    0, 2,
    0, 1,
    0, 0,
    1, 0,
    1, 1,
    1, 2,
    1, 3,
    1, 4,
    1, 5,
    1, 6,
    1, 7,
    0, 7,
    0, 6,
    0, 5
);

const DARK_PATH = vecList(
    2, 4,
    2, 3,
    2, 2,
    2, 1,
    2, 0,
    1, 0,
    1, 1,
    1, 2,
    1, 3,
    1, 4,
    1, 5,
    1, 6,
    1, 7,
    2, 7,
    2, 6,
    2, 5
);

const LIGHT_START = LIGHT_PATH[0],
      LIGHT_END = LIGHT_PATH[LIGHT_PATH.length - 1],
      DARK_START = DARK_PATH[0],
      DARK_END = DARK_PATH[DARK_PATH.length - 1];

const ROSETTE_LOCATIONS = vecList(
    0, 0,
    2, 0,
    1, 3,
    0, 6,
    2, 6
);

function isTileValid(tile) {
    return tile === TILE_EMPTY || tile === TILE_DARK || tile === TILE_LIGHT;
}

function isTileLocValid(loc) {
    return loc.x >= 0 && loc.y >= 0 && loc.x < TILES_WIDTH && loc.y < TILES_HEIGHT;
}

function isTileLocOnBoard(loc) {
    if(!isTileLocValid(loc))
        return false;

    return loc.x === 1 || (loc.y !== 4 && loc.y !== 5);
}

function getTilePath(playerNo) {
    switch (playerNo) {
        case LIGHT_PLAYER_NO: return LIGHT_PATH;
        case DARK_PLAYER_NO:  return DARK_PATH;
        default:
            throw "Unknown playerNo " + playerNo;
    }
}

function getStartTile(playerNo) {
    switch (playerNo) {
        case LIGHT_PLAYER_NO: return LIGHT_START;
        case DARK_PLAYER_NO:  return DARK_START;
        default:
            throw "Unknown playerNo " + playerNo;
    }
}

function getEndTile(playerNo) {
    switch (playerNo) {
        case LIGHT_PLAYER_NO: return LIGHT_END;
        case DARK_PLAYER_NO:  return DARK_END;
        default:
            throw "Unknown playerNo " + playerNo;
    }
}

function isStartTile(playerNo, loc) {
    return vecEquals(getStartTile(playerNo), loc);
}

function isEndTile(playerNo, loc) {
    return vecEquals(getEndTile(playerNo), loc);
}

function isRosetteTile(loc) {
    return vecListContains(ROSETTE_LOCATIONS, loc);
}

function getTileMoveToLocation(playerNo, loc, moveDistance) {
    const path = getTilePath(playerNo),
          fromIndex = vecListIndexOf(path, loc),
          toIndex = fromIndex + moveDistance;

    return (fromIndex >= 0 && toIndex < path.length ? path[toIndex] : null);
}


/**
 * Holds all of the tiles on the game board.
 */
function Board() {
    // Initialise an empty board
    this.tiles = [];
    for (let index = 0; index < TILES_COUNT; ++index) {
        this.tiles.push(TILE_EMPTY);
    }
}
Board.prototype.copyFrom = function(other) {
    for (let index = 0; index < TILES_COUNT; ++index) {
        this.tiles[index] = other.tiles[index];
    }
};
Board.prototype.getTile = function (loc) {
    return (isTileLocValid(loc) ? this.tiles[loc.x + loc.y * TILES_WIDTH] : TILE_EMPTY);
};
Board.prototype.setTile = function (loc, tile) {
    assert(isTileLocValid(loc), "invalid tile location " + loc);
    assert(isTileValid(tile), "invalid tile value " + tile);
    this.tiles[loc.x + loc.y * TILES_WIDTH] = tile;
};
Board.prototype.loadTileState = function(flat) {
    assert(flat.length === TILES_COUNT, "Expected " + TILES_COUNT + " tiles, got " + flat.length);

    for (let index = 0; index < TILES_COUNT; ++index) {
        const tile = flat[index];
        assert(isTileValid(tile), "invalid tile value at index " + index + ", " + tile);
        this.tiles[index] = tile;
    }
};
Board.prototype.clearTiles = function() {
    for (let index = 0; index < TILES_COUNT; ++index) {
        this.tiles[index] = TILE_EMPTY;
    }
};
Board.prototype.isValidMoveFrom = function(playerNo, loc, moveDistance) {
    if(moveDistance <= 0)
        return false;

    const to = getTileMoveToLocation(playerNo, loc, moveDistance);
    if(to === null)
        return false;

    const toOwner = this.getTile(to),
        fromOwner = this.getTile(loc);

    if (fromOwner !== playerNo)
        return false;
    if(toOwner === fromOwner)
        return false;
    if(toOwner === TILE_EMPTY)
        return true;
    return !isRosetteTile(to);
};
Board.prototype.getAllValidMoves = function(playerNo, moveDistance, outList) {
    if (outList === undefined) {
        outList = [];
    } else {
        outList.length = 0;
    }
    if (moveDistance <= 0)
        return outList;

    for (let index = 0; index < TILES_COUNT; ++index) {
        const loc = TILE_LOCS[index];
        if (this.isValidMoveFrom(playerNo, loc, moveDistance)) {
            outList.push(loc);
        }
    }
    return outList;
};


/**
 * Represents the current state of a game.
 */
function GameState() {
    this.board = new Board();
    this.activePlayerNo = -1;
    this.lightTiles = -1;
    this.lightScore = -1;
    this.darkTiles = -1;
    this.darkScore = -1;
    this.lightWon = false;
    this.darkWon = false;
    this.won = false;
    this.lastMoveFrom = null;
}
GameState.prototype.copyFrom = function(other) {
    this.board.copyFrom(other.board);
    this.activePlayerNo = other.activePlayerNo;
    this.lightTiles = other.lightTiles;
    this.lightScore = other.lightScore;
    this.darkTiles = other.darkTiles;
    this.darkScore = other.darkScore;
    this.lightWon = other.lightWon;
    this.darkWon = other.darkWon;
    this.won = other.won;
};
GameState.prototype.copyFromCurrentGame = function() {
    this.board.copyFrom(board);
    this.activePlayerNo = getActivePlayer().playerNo;
    this.lightTiles = lightPlayer.tiles.current;
    this.lightScore = lightPlayer.score.current;
    this.darkTiles = darkPlayer.tiles.current;
    this.darkScore = darkPlayer.score.current;
    this.lightWon = (this.lightScore >= 7);
    this.darkWon = (this.darkScore >= 7);
    this.won = (this.lightWon || this.darkWon);
};
GameState.prototype.getValidMoves = function(diceValue, outList) {
    this.board.setTile(LIGHT_START, (this.lightTiles > 0 ? TILE_LIGHT : TILE_EMPTY));
    this.board.setTile(DARK_START, (this.darkTiles > 0 ? TILE_DARK : TILE_EMPTY));
    return this.board.getAllValidMoves(this.activePlayerNo, diceValue, outList);
};
GameState.prototype.applyMove = function(from, diceValue) {
    const to = getTileMoveToLocation(this.activePlayerNo, from, diceValue),
        toTile = this.board.getTile(to);

    // Remove the old tile.
    this.board.setTile(from, TILE_EMPTY);

    // Reduce the player's tile count if they moved a new tile onto the board.
    if (isStartTile(this.activePlayerNo, from)) {
        if (this.activePlayerNo === LIGHT_PLAYER_NO) {
            this.lightTiles -= 1;
        } else {
            this.darkTiles -= 1;
        }
    }

    // If the tile isn't being moved off the board, move the tile.
    // Else, increase the player's score.
    if (!isEndTile(this.activePlayerNo, to)) {
        this.board.setTile(to, this.activePlayerNo);

        // If the opponent's tile is taken off the board, add it back to their tile count.
        if (toTile === TILE_LIGHT) {
            this.lightTiles += 1;
        } else if (toTile === TILE_DARK) {
            this.darkTiles += 1;
        }

    } else if (this.activePlayerNo === LIGHT_PLAYER_NO) {
        this.lightScore += 1;
        if (this.lightScore >= 7) {
            this.lightWon = true;
            this.won = true;
        }
    } else {
        this.darkScore += 1;
        if (this.darkScore >= 7) {
            this.darkWon = true;
            this.won = true;
        }
    }

    // If the tile isn't a rosette, swap the current player.
    if (!isRosettesTile(to)) {
        this.swapActivePlayer();
    }

    // Update the last move that was applied.
    this.lastMoveFrom = from;
};
GameState.prototype.swapActivePlayer = function() {
    this.activePlayerNo = (this.activePlayerNo === LIGHT_PLAYER_NO ? DARK_PLAYER_NO : LIGHT_PLAYER_NO);
    this.lastMoveFrom = null;
};
GameState.prototype.calculateUtility = function(playerNo) {
    // We give 1 extra utility for taking a tile off the board.
    let lightUtility = 16 * (this.lightScore - this.darkScore);
    for (let index = 0; index < TILES_COUNT; ++index) {
        const loc = TILE_LOCS[index],
            tile = this.board.getTile(loc);

        // Ignore empty, start, and end tiles
        if (tile === TILE_EMPTY || !isTileLocOnBoard(loc))
            continue;

        // Add utility based on how far each tile has been moved.
        if (tile === TILE_LIGHT) {
            lightUtility += vecListIndexOf(LIGHT_PATH, loc);
        } else {
            lightUtility -= vecListIndexOf(DARK_PATH, loc);
        }
    }
    return playerNo === LIGHT_PLAYER_NO ? lightUtility : -lightUtility;
};
