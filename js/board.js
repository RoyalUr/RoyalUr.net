//
// This file contains logic for analysing a game board.
//

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

function getTileMoveToLocation(playerNo, loc, moveDistance) {
    const path = getTilePath(playerNo),
          fromIndex = vecListIndexOf(path, loc),
          toIndex = fromIndex + moveDistance;

    return (fromIndex >= 0 && toIndex < path.length ? path[toIndex] : null);
}

function isLocusTile(loc) {
    return vecListContains(LOCUS_LOCATIONS, loc);
}

function isStartTile(playerNo, loc) {
    return vecEquals(getStartTile(playerNo), loc);
}

function isEndTile(playerNo, loc) {
    return vecEquals(getEndTile(playerNo), loc);
}
