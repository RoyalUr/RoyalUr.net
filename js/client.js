//
// This file mediates interactions between the client, the server, the model, and the rendering of the game.
//

console.log("\nCurious how the client works? Check out the source: https://github.com/Sothatsit/RoyalUrClient\n ");

const clientStartTime = getTime();
let resourcesLoadedTime = LONG_TIME_AGO,
    clientFinishSetupTime = LONG_TIME_AGO;

loadResources(setup);

function setup() {
    resourcesLoadedTime = getTime();

    setupElements();
    setInterval(updateRenderStatistics, 1000);

    updateAudioVolumes();
    playSong();

    window.onhashchange = onHashChange;
    if (getHashGameID() !== null) {
        connectToGame(true);
    } else {
        switchToScreen(SCREEN_MENU);
    }

    window.requestAnimationFrame(function() {
        resize();
        redrawLoop();
        finishSetup();
    });
}

function finishSetup() {
    clientFinishSetupTime = getTime();

    if (debugNetwork) {
        reportStartupPerformance();
    }
}

function reportStartupPerformance() {
    const startupDuration = clientFinishSetupTime - clientStartTime,
          resourceLoadDuration = resourcesLoadedTime - clientStartTime,
          setupDuration = clientFinishSetupTime - resourcesLoadedTime,
          resourceLoadPercentage = resourceLoadDuration / startupDuration,
          setupPercentage = setupDuration / startupDuration;

    let report = "\nClient startup took " + (Math.round(startupDuration * 1000 * 10) / 10) + "ms\n";

    report += "  " + (Math.round(resourceLoadPercentage * 1000) / 10) + "% - Resource Loading ";
    report += "(" + (Math.round(resourceLoadDuration * 1000 * 10) / 10) + "ms)\n";

    report += "  " + (Math.round(setupPercentage * 1000) / 10) + "% - Setup ";
    report += "(" + (Math.round(setupDuration * 1000 * 10) / 10) + "ms)\n ";

    console.log(report);
}



//
// MENU
//

function onPlayClick(event) {
    event.stopPropagation();
    switchToScreen(SCREEN_PLAY_SELECT);
}

function onPlayOnline(event) {
    event.stopPropagation();
    connectToGame();
}

function onPlayComputer(event) {
    event.stopPropagation();
    game = new ComputerGame();
    switchToScreen(SCREEN_GAME);
}

function onExitClick(event) {
    event.stopPropagation();
    switchToScreen(SCREEN_MENU);
}

function connectToGame() {
    switchToScreen(SCREEN_CONNECTING);
}



//
// NETWORK : CONNECTING
//

function onNetworkConnecting() {
    if(networkStatus.status === "Lost connection")
        return;

    setNetworkStatus("Connecting", true);
}

function onNetworkConnected() {
    resetGame();

    setNetworkStatus("Connected", false);
    fadeNetworkStatusOut();

    const gameID = getHashGameID();
    if (gameID !== null) {
        sendPacket(writeJoinGamePacket(gameID));
    } else {
        sendPacket(writeFindGamePacket())
    }
}

function onNetworkLoseConnection() {
    setNetworkStatus("Lost connection", true);
    fadeNetworkStatusIn();
}

function onNetworkDisconnect() {
    resetNetworkStatus();
    fadeNetworkStatusOut();
}



//
// NETWORK : GAME
//

function onPacketInvalidGame() {
    disconnect();
    resetNetworkStatus();
    switchToScreen(SCREEN_MENU, true);
    setMessage("Game could not be found", 0, 2, 1)
}

function onPacketGame(gameInfo) {
    game = new OnlineGame();
    setHash(gameInfo.gameID);
    setOwnPlayer(gameInfo.ownPlayer);
    otherPlayer.name = gameInfo.opponentName;
    switchToScreen(SCREEN_GAME);
}

function onPacketMessage(data) {
    game.onPacketMessage(data);
}

function onPacketMove(move) {
    game.onPacketMove(move);
}

function onPacketState(state) {
    game.onPacketState(state);
}



//
// GAME HASH
//

function getHashRaw() {
    if (!window.location.hash)
        return "";
    return window.location.hash.substr(1);
}

function setHash(hash) {
    if (getHashRaw() === hash)
        return;
    history.pushState(null, "Royal Ur", "#" + hash);
}

function resetHash() {
    setHash("");
}

function getHashGameID() {
    const gameID = getHashRaw();
    if (gameID.length !== GAME_ID_LENGTH) {
        resetHash();
        return null;
    }

    return gameID;
}

function onHashChange() {
    if (getHashGameID() !== null) {
        connectToGame();
    } else {
        switchToScreen(SCREEN_MENU);
    }
}



//
// SCREEN MANAGEMENT
//

const SCREEN_LOADING = "loading",
      SCREEN_MENU = "menu",
      SCREEN_PLAY_SELECT = "play_select",
      SCREEN_CONNECTING = "connecting",
      SCREEN_GAME = "game",
      SCREEN_WIN = "win";

const screenState = {
    screen: SCREEN_LOADING,

    enterHandlers: [],
    exitHandlers: [],

    menuFade: createFade(0.5),
    playSelectFade: createFade(0.5),
    boardFade: createFade(0.5),
    exitFade: createFade(0.25),
    connectionFade: createFade(2, 0.5)
};

function registerScreenHandler(screens, handler, handlersList) {
    // Screens should be an array
    if (typeof screens === 'string' || screens instanceof String) {
        screens = [screens];
    }

    handlersList.push({
        screens: screens,
        handlerFn: handler
    });
}

function registerScreenEnterHandler(screens, handler) {
    registerScreenHandler(screens, handler, screenState.enterHandlers);
}

function registerScreenExitHandler(screens, handler) {
    registerScreenHandler(screens, handler, screenState.exitHandlers);
}

function registerScreenTransitionHandlers(screens, enterHandler, exitHandler) {
    registerScreenEnterHandler(screens, enterHandler);
    registerScreenExitHandler(screens, exitHandler);
}

function fireScreenHandlers(fromScreen, toScreen, hasty) {
    function fireMatchingScreenHandlers(inScreen, outScreen, handlersList) {
        for (let index = 0; index < handlersList.length; ++index) {
            const handler = handlersList[index];

            if (!handler.screens.includes(inScreen))
                continue;
            if (handler.screens.includes(outScreen))
                continue;

            handler.handlerFn(hasty);
        }
    }

    fireMatchingScreenHandlers(toScreen, fromScreen, screenState.enterHandlers);
    fireMatchingScreenHandlers(fromScreen, toScreen, screenState.exitHandlers);
}

function isOnScreen(screen) {
    return screenState.screen === screen;
}

function switchToScreen(screen, hasty) {
    hasty = (!hasty ? false : hasty);

    const fromScreen = screenState.screen;

    // Already on the given screen
    if (fromScreen === screen)
        return;

    screenState.screen = screen;
    fireScreenHandlers(fromScreen, screen, hasty);
}



//
// SCREEN TRANSITIONS
//

registerScreenTransitionHandlers(SCREEN_LOADING,     onEnterLoadingScreen,    onExitLoadingScreen);
registerScreenTransitionHandlers(SCREEN_MENU,        onEnterMenuScreen,       onExitMenuScreen);
registerScreenTransitionHandlers(SCREEN_PLAY_SELECT, onEnterPlaySelectScreen, onExitPlaySelectScreen);
registerScreenTransitionHandlers(SCREEN_CONNECTING,  onEnterConnectingScreen, onExitConnectingScreen);
registerScreenTransitionHandlers(SCREEN_GAME,        onEnterGameScreen,       onExitGameScreen);
registerScreenTransitionHandlers(SCREEN_WIN,         onEnterWinScreen,        onExitWinScreen);

// Screens where the menu should be shown
registerScreenTransitionHandlers(
    [SCREEN_MENU, SCREEN_PLAY_SELECT], onEnterMenuScreens, onExitMenuScreens
);

// Screens where the game should connect to the server
registerScreenTransitionHandlers(
    [SCREEN_CONNECTING, SCREEN_GAME], onEnterServerScreen, onExitServerScreen
);

// Screens where the game board should be shown
registerScreenTransitionHandlers(
    [SCREEN_GAME, SCREEN_WIN], onEnterBoardScreen, onExitBoardScreen
);

// Screens where the exit button should be shown
registerScreenTransitionHandlers(
    [SCREEN_CONNECTING, SCREEN_GAME, SCREEN_WIN], onEnterExitableScreen, onExitExitableScreen
);


function onEnterLoadingScreen(hasty) {
    loadingFade.fadeIn(hasty ? 0 : undefined);
}

function onExitLoadingScreen(hasty) {
    loadingFade.fadeOut(hasty ? 0 : undefined);
}

function onEnterMenuScreen(hasty) {

}

function onExitMenuScreen(hasty) {

}

function onEnterPlaySelectScreen(hasty) {
    fitty.fitAll();
    screenState.playSelectFade.fadeIn(hasty ? 0 : undefined);
}

function onExitPlaySelectScreen(hasty) {
    screenState.playSelectFade.fadeOut(hasty ? 0 : undefined);
}

function onEnterMenuScreens(hasty) {
    resetHash();
    setTimeout(() => {
        if (isOnScreen(SCREEN_MENU) || isOnScreen(SCREEN_PLAY_SELECT)) {
            screenState.menuFade.fadeIn(hasty ? 0 : undefined);
        }
    }, (hasty ? 0 : 500));
}

function onExitMenuScreens(hasty) {
    screenState.menuFade.fadeOut(hasty ? 0 : undefined);
}

function onEnterConnectingScreen(hasty) {
    reconnect();
    setMessageAndFade("", screenState.connectionFade.invisible());
    setTimeout(() => {
        if (isOnScreen(SCREEN_CONNECTING)) {
            screenState.connectionFade.fadeIn();
        }
    }, (hasty ? 0 : 500));
}

function onExitConnectingScreen(hasty) {
    screenState.connectionFade.fadeOut();
}

function onEnterGameScreen(hasty) {
    setMessageAndFade("Found your Game", screenState.connectionFade);

    game.init();
}

function onExitGameScreen(hasty) {
    // Nothing to do
}

function onEnterWinScreen(hasty) {
    setMessage(
        getActivePlayer().name + " wins!",
        0.25, -1, -1
    );
}

function onExitWinScreen(hasty) {
    setMessage(message.text, 0, 0, DEFAULT_MESSAGE_FADE_OUT_DURATION);
}

function onEnterServerScreen(hasty) {

}

function onExitServerScreen(hasty) {
    disconnect();
}

function onEnterBoardScreen(hasty) {
    setTimeout(() => {
        if (isOnScreen(SCREEN_GAME) || isOnScreen(SCREEN_WIN)) {
            screenState.boardFade.fadeIn(hasty ? 0 : undefined);
        }
    }, (hasty ? 0 : 500))
}

function onExitBoardScreen(hasty) {
    screenState.boardFade.fadeOut(hasty ? 0 : undefined);
}

function onEnterExitableScreen(hasty) {
    screenState.exitFade.fadeIn(hasty ? 0 : undefined);
}

function onExitExitableScreen(hasty) {
    screenState.exitFade.fadeOut(hasty ? 0 : undefined);
}
