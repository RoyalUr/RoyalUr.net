//
// This file manages the screens for the game.
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
    game = null;
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
