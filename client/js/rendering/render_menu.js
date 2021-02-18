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

const playTilesButtonMargin = 0.1,
      playTilesHeightInactive = 0.6,
      playTilesHeightActive = 0.75;

const playSelectDescriptionFade = new Fade(0.1, 0.2).invisible();

const lastButtonImages = {};

function redrawButton(name, canvas, ctx, imageKey, text, isActive, forceRedraw) {
    // Avoid repainting if we don't need to!
    const last = lastButtonImages[name];
    if (!forceRedraw && last && last.key === imageKey && last.w === canvas.width && last.h === canvas.height)
        return;

    // We do need to repaint.
    const imageResource = imageSystem.findImageResource(imageKey);
    if (!imageResource)
        throw "Could not find button image resource " + imageKey;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (imageResource.loaded) {
        const image = imageResource.getScaledImage(canvas.width);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        lastButtonImages[name] = {
            key: imageKey, w: canvas.width, h: canvas.height
        };
    } else {
        const pad = 0.015 * canvas.width,
              radius = 0.1 * canvas.width,
              borderWidth = 0.015 * canvas.width,
              fontSize = (text === "Play" ? 0.25 : 0.2) * canvas.width;

        ctx.fillStyle = (isActive ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.5)");
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = borderWidth;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        pathRoundedRect(ctx, pad, pad, canvas.width - 2*pad, canvas.height - 2*pad, radius).fill();
        pathRoundedRect(ctx, pad, pad, canvas.width - 2*pad, canvas.height - 2*pad, radius).stroke();

        ctx.fillStyle = "#FFFFFF";
        ctx.font = fontSize + "px Nunito, sans-serif";
        ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 0.015*canvas.width);
    }
}

function redrawMenu(forceRedraw) {
    const menuFade = screenState.menuFade.get();
    menuOuterDiv.style.opacity = (menuFade > 0 ? 1 : 0);
    menuTitleDiv.style.opacity = menuFade;
    playButton.style.opacity = menuFade;
    learnButton.style.opacity = menuFade;
    watchButton.style.opacity = menuFade;

    creditsDiv.style.opacity = screenState.creditsFade.get();
    networkStatus.hidden = false;

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

    const descriptionFade = playSelectDescriptionFade.get();
    playSelectDiv.style.opacity = screenState.playSelectFade.get();
    playSelectDescriptionDiv.style.opacity = (screenState.playSelectFade.isFadeIn() ? descriptionFade : 0);

    difficultyDiv.style.opacity = screenState.difficultyFade.get();

    const menuVisible = isOnScreen([SCREEN_MENU, SCREEN_PLAY_SELECT, SCREEN_DIFFICULTY]);
    if (forceRedraw || menuVisible) {
        const playButtonActive = (menuState.playButton !== BUTTON_STATE_INACTIVE),
              learnButtonActive = (menuState.learnButton !== BUTTON_STATE_INACTIVE),
              watchButtonActive = (menuState.watchButton !== BUTTON_STATE_INACTIVE);

        const offMenuForceRedraw = (forceRedraw && !menuVisible);
        if (offMenuForceRedraw || menuFade > 0) {
            redrawButton(
                "play", playButtonCanvas, playButtonCtx,
                (playButtonActive ? "play_active" : "play"),
                "Play", playButtonActive, forceRedraw
            );
            redrawButton(
                "learn", learnButtonCanvas, learnButtonCtx,
                (learnButtonActive ? "learn_active" : "learn"),
                "Learn", learnButtonActive, forceRedraw
            );
            redrawButton(
                "watch", watchButtonCanvas, watchButtonCtx,
                (watchButtonActive ? "watch_active" : "watch"),
                "Watch", watchButtonActive, forceRedraw
            );
        }

        const playButtonHeight = playButton.getBoundingClientRect().height,
              playMargin = playButtonHeight * playTilesButtonMargin,
              tilesHeightActive = playButtonHeight * playTilesHeightActive,
              tilesHeightInactive = playButtonHeight * playTilesHeightInactive,
              tilesHeight =  (playButtonActive ? tilesHeightActive : tilesHeightInactive),
              tilesMargin = (tilesHeightActive - tilesHeight) / 2;

        playButtonCanvas.style.marginLeft = playMargin + "px";
        playButtonCanvas.style.marginRight = playMargin + "px";

        for (let index = 0; index < playButtonTiles.length; ++index) {
            const tile = playButtonTiles[index];
            tile.style.width = tilesHeight + "px";
            tile.style.height = tilesHeight + "px";
            tile.style.marginLeft = tilesMargin + "px";
            tile.style.marginRight = tilesMargin + "px";
        }
    }

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
