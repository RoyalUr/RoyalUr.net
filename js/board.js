//
// This file contains logic for analysing a game board.
//

const TILES_WIDTH = 3,
      TILES_HEIGHT = 8,
      TILES_COUNT = TILES_WIDTH * TILES_HEIGHT;

const TILE_LOCS = [];
{
    for(let x = 0; x < TILES_WIDTH; ++x) {
        for(let y = 0; y < TILES_HEIGHT; ++y) {
            TILE_LOCS.push(vec(x, y));
        }
    }
}

const TILE_EMPTY = 0,
      TILE_DARK = 1,
      TILE_LIGHT = 2;

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

const LOCUS_LOCATIONS = vecList(
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

function isLocusTile(loc) {
    return vecListContains(LOCUS_LOCATIONS, loc);
}

function getTileMoveToLocation(playerNo, loc, moveDistance) {
    const path = getTilePath(playerNo),
          fromIndex = vecListIndexOf(path, loc),
          toIndex = fromIndex + moveDistance;

    return (fromIndex >= 0 && toIndex < path.length ? path[toIndex] : null);
}


function Board(tiles) {
    // Initialise an empty board
    if (tiles === undefined) {
        tiles = [];
        for(let x = 0; x < TILES_WIDTH; ++x) {
            const col = [];
            for(let y = 0; y < TILES_HEIGHT; ++y) {
                col.push(TILE_EMPTY);
            }
            tiles.push(col);
        }
    }

    if (tiles.length !== TILES_WIDTH)
        throw "tiles should be of length " + TILES_WIDTH + ", is length " + tiles.length;
    for (let index = 0; index < TILES_WIDTH; ++index) {
        if (tiles[index].length !== TILES_HEIGHT)
            throw "tiles[" + index + "] should be of length " + TILES_HEIGHT + ", is length " + tiles[index].length;
    }

    this.tiles = tiles;

    this.clone = function() {
        const clone = new Board();
        for(let x = 0; x < TILES_WIDTH; ++x) {
            for(let y = 0; y < TILES_HEIGHT; ++y) {
                clone.tiles[x][y] = this.tiles[x][y];
            }
        }
        return clone;
    }.bind(this);

    this.getTile = function (loc) {
        return (isTileLocValid(loc) ? this.tiles[loc.x][loc.y] : TILE_EMPTY);
    }.bind(this);

    this.setTile = function (loc, tile) {
        assert(isTileLocValid(loc), "invalid tile location " + loc);
        assert(isTileValid(tile), "invalid tile value " + tile);
        this.tiles[loc.x][loc.y] = tile;
    }.bind(this);
    this.loadTileState = function(flat) {
        assert(flat.length === TILES_COUNT, "Expected " + TILES_COUNT + " tiles, got " + flat.length);

        for(let x = 0; x < TILES_WIDTH; ++x) {
            for(let y = 0; y < TILES_HEIGHT; ++y) {
                const tile = flat[x + y * TILES_WIDTH];

                assert(isTileValid(tile), "invalid tile value at (" + x + ", " + y + "), " + tile);

                this.tiles[x][y] = tile;
            }
        }
    }.bind(this);

    this.clearTiles = function() {
        for(let x = 0; x < TILES_WIDTH; ++x) {
            for(let y = 0; y < TILES_HEIGHT; ++y) {
                this.tiles[x][y] = TILE_EMPTY;
            }
        }
    }.bind(this);

    this.isValidMoveFrom = function(playerNo, loc, moveDistance) {
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

        return !isLocusTile(to);
    }.bind(this);

    this.getAllValidMoves = function(playerNo, moveDistance) {
        const moves = [];
        for (let index = 0; index < TILES_COUNT; ++index) {
            const loc = TILE_LOCS[index];
            if (!this.isValidMoveFrom(playerNo, loc, moveDistance))
                continue;

            moves.push(loc);
        }
        return moves;
    }.bind(this);
}
