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
    creditsDiv.style.opacity = screenState.creditsFade.get();
    networkStatus.hidden = false;
    gameSetupMenu.redraw();

    let totalControlFades = 0;
    for (let index = 0; index < allControlFades.length; ++index) {
        totalControlFades += allControlFades[index].get();
    }
    controlsDiv.style.display = (totalControlFades > 0 ? "block" : "none");
    discordControlButton.style.opacity = screenState.discordControlFade.get();
    githubControlButton.style.opacity = screenState.githubControlFade.get();
    settingsControlButton.style.opacity = screenState.settingsControlFade.get();
    learnControlButton.style.opacity = screenState.learnControlFade.get();
    exitControlButton.style.opacity = screenState.exitControlFade.get();

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

    boardCanvas.style.opacity = one;
    tilesCanvas.style.opacity = one;
    diceCanvas.style.opacity = two;
    leftPlayerRenderTarget.scoreCanvas.style.opacity = two;
    leftPlayerRenderTarget.tilesCanvas.style.opacity = two;
    rightPlayerRenderTarget.scoreCanvas.style.opacity = two;
    rightPlayerRenderTarget.tilesCanvas.style.opacity = two;
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
    const opacity = screenState.loadingFade.get();
    loadingDiv.style.opacity = opacity;
    loadingDiv.style.display = (opacity === 0 ? "none" : "")
    if (screenState.loadingFade.isFadeIn()) {
        loadingTextSpan.textContent = getStageLoadingMessage(getRenderedLoadingStage());
    }
}

function redrawLoadingBar() {
    const stage = getRenderedLoadingStage();
    loadingBar.element.style.width = (resourceLoader.getPercentageLoaded(stage) * 100) + "%";
}



//
// Rendering of the network status.
//

function redrawNetworkStatus() {
    networkStatusElement.style.display = (networkStatus.hidden ? "none" : "block");
    networkStatusElement.style.opacity = networkStatus.fade.get();
    networkStatusElement.textContent = getNetworkStatus();
}



//
// Rendering of simple screens.
//

function renderWaitingForFriendScreen() {
    waitingForFriendDiv.style.opacity = screenState.waitingForFriendFade.get();
}

function redrawWinScreen() {
    winDiv.style.opacity = screenState.winFade.get();
    if (isOnScreen(SCREEN_WIN)) {
        spawnWinFireworks();
    }
}
