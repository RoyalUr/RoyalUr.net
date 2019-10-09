//
// This file contains logic to simulate future moves of a game.
//

function captureCurrentGameState() {
    return {
        board: board.clone(),
        active_player: getActivePlayer().playerNo,
        light_tiles: lightPlayer.tiles.current,
        light_score: lightPlayer.score.current,
        dark_tiles: darkPlayer.tiles.current,
        dark_score: darkPlayer.score.current
    };
}

function calculateStateUtility(state, playerNo) {
    let lightUtility = 15 * (state.light_score - state.dark_score);
    for (let index = 0; index < TILES_COUNT; ++index) {
        const tile = state.board.getTile(TILE_LOCS[index]);
        switch (tile) {
            case TILE_LIGHT:
                lightUtility += 1;
                break;
            case TILE_DARK:
                lightUtility -= 1;
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
            throw "Invalid player no " + playerNo;
    }
}
