//
// This file contains logic to simulate future moves of a game.
//

function captureCurrentGameState() {
    const board = [];
    for(let x = 0; x < TILES_WIDTH; ++x) {
        const col = [];
        for(let y = 0; y < TILES_HEIGHT; ++y) {
            col.push(getTile(x, y));
        }
        board.push(col);
    }

    return {
        board: board,
        active_player: getActivePlayer().playerNo,
        light_tiles: lightPlayer.tiles.current,
        light_score: lightPlayer.score.current,
        dark_tiles: darkPlayer.tiles.current,
        dark_score: darkPlayer.score.current
    };
}

function calculateStateUtility(state, playerNo) {
    let utility = 15 * (state.light_score - state.dark_score);
    for(let x = 0; x < TILES_WIDTH; ++x) {
        const col = state.board[x];
        for(let y = 0; y < TILES_HEIGHT; ++y) {
            const tile = col[y];
            if (tile === playerNo) {
                utility += 1;
            } else if (tile !== TILE_EMPTY) {
                utility -= 1;
            }
        }
    }
    return utility;
}
