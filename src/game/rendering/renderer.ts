//
// This file stores all rendering logic for the game.
//
// Terminology of rendering methods:
// - redraw: Only draws if necessary, and draws based upon its internal state only.
// - draw: Draws based upon its arguments, and some internal state.
// - render: Stateless; draws based upon its arguments only.
//

import {recordRenderCallStatistics, RenderStat} from "@/game/analytics/stats";
import {boardRenderer} from "@/game/rendering/render_board";

function redrawLoop() {
    redraw(false);
    window.requestAnimationFrame(redrawLoop);
}

/**
 * @param forceRedraw Whether to ignore any attempts to avoid redrawing elements.
 */
function redraw(forceRedraw) {
    forceRedraw = !!forceRedraw;

    function callRedraw(statistic, redrawFn) {
        recordRenderCallStatistics(statistic, () => {
            redrawFn(forceRedraw);
        });
    }

    recordRenderCallStatistics(RenderStat.OVERALL, () => {
        callRedraw(RenderStat.BOARD, boardRenderer.redrawBoard);
        callRedraw(RenderStat.LOADING, redrawLoading);
        callRedraw(RenderStat.MENU, redrawMenu);
        callRedraw(RenderStat.TILES, boardRenderer.redrawTiles);
        callRedraw(RenderStat.DICE, redrawDice);
        callRedraw(RenderStat.SCORES, redrawScores);
        callRedraw(RenderStat.NETWORK_STATUS, redrawNetworkStatus);
        callRedraw(RenderStat.WAIT_FRIEND, renderWaitingForFriendScreen);
        callRedraw(RenderStat.MESSAGE, redrawMessage);
        callRedraw(RenderStat.WIN_SCREEN, redrawWinScreen);
        callRedraw(RenderStat.OVERLAY, redrawOverlay);
    });
}
