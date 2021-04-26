//
// This file contains code that manages the rendering of the menus of the game.
//
// This includes the:
// - Main Menu
// - Control Icons
// - Loading Screen
// - Network Status
// - Waiting for a Friend Screen
// - Win Screen
//


function redrawMenu() {
    const gameControlsFade = screenState.gameControlsFade.get();
    setElemOpacity(controlsDiv, gameControlsFade);
    setElemOpacity(headerDiv, 1 - gameControlsFade);
    setElemOpacity(footerDiv, 1 - gameControlsFade);

    networkStatus.hidden = false;
    gameSetupMenu.redraw();

    if (isOnScreen(SCREEN_CONNECTING)) {
        if (networkStatus.connected) {
            setMessageAndFade("Searching for a Game" + createDots(), "", false, screenState.connectionFade);
        } else {
            networkStatus.hidden = true;
            setMessageAndFade(getNetworkStatus(), "", false, screenState.connectionFade);
        }
    }

    const boardFade = screenState.boardFade.get(),
          one = clamp(boardFade * 2, 0, 1),
          two = clamp(boardFade * 2 - 1, 0, 1);

    setElemOpacity(boardCanvas, one);
    setElemOpacity(tilesCanvas, one);
    setElemOpacity(diceCanvas, two);
    setElemOpacity(leftPlayerRenderTarget.scoreCanvas, two);
    setElemOpacity(leftPlayerRenderTarget.tilesCanvas, two);
    setElemOpacity(rightPlayerRenderTarget.scoreCanvas, two);
    setElemOpacity(rightPlayerRenderTarget.tilesCanvas, two);
}



//
// Rendering of the loading screen.
//
const loadingBar = {
    element: document.getElementById("loading-bar"),
    stage: 0
};

function getRenderedLoadingStage() {
    return min(loadingBar.stage, resourceLoader.loadingStage);
}

function redrawLoading() {
    setElemOpacity(loadingDiv, screenState.loadingFade.get());
    if (screenState.loadingFade.isFadeIn()) {
        loadingTextSpan.textContent = getStageLoadingMessage(getRenderedLoadingStage());
    }
}

function redrawLoadingBar() {
    const stage = getRenderedLoadingStage();
    setElemStyle(loadingBar.element, "width", (resourceLoader.getPercentageLoaded(stage) * 100) + "%");
}



//
// Rendering of the network status.
//

function redrawNetworkStatus() {
    setElemOpacity(networkStatusElement, networkStatus.hidden ? 0 : networkStatus.fade.get())
    networkStatusElement.textContent = getNetworkStatus();
}



//
// Rendering of simple screens.
//

function renderWaitingForFriendScreen() {
    setElemOpacity(waitingForFriendDiv, screenState.waitingForFriendFade.get());
}

function redrawWinScreen() {
    setElemOpacity(winDiv, screenState.winFade.get());
    if (isOnScreen(SCREEN_WIN)) {
        spawnWinFireworks();
    }
}
