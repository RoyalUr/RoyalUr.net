//
// This file manages the screens for the game.
//

const SCREEN_LOADING = "loading",
      SCREEN_MENU = "menu",
      SCREEN_PLAY_SELECT = "play_select",
      SCREEN_LEARN = "learn",
      SCREEN_CONNECTING = "connecting",
      SCREEN_GAME = "game",
      SCREEN_WIN = "win";

const screenRequiredLoadingStages = {};
screenRequiredLoadingStages[SCREEN_LOADING] = -1;
screenRequiredLoadingStages[SCREEN_MENU] = 0;
screenRequiredLoadingStages[SCREEN_PLAY_SELECT] = 0;
screenRequiredLoadingStages[SCREEN_LEARN] = 2;
screenRequiredLoadingStages[SCREEN_CONNECTING] = 1;
screenRequiredLoadingStages[SCREEN_GAME] = 1;
screenRequiredLoadingStages[SCREEN_WIN] = 1;

const screenState = {
    screen: SCREEN_LOADING,
    loadingTargetScreen: null,
    loadingTargetStage: 0,

    enterHandlers: [],
    exitHandlers: [],

    menuFade: createFade(0.5),
    playSelectFade: createFade(0.5),
    learnFade: createFade(0.5),
    boardFade: createFade(0.5),
    exitFade: createFade(0.25),
    connectionFade: createFade(2, 0.5)
};

function registerScreenHandler(screens, handler, handlersList) {
    screens = (typeof screens === 'string' || screens instanceof String ? [screens] : screens);
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
            if (!handler.screens.includes(inScreen) || handler.screens.includes(outScreen))
                continue;

            handler.handlerFn(hasty);
        }
    }
    fireMatchingScreenHandlers(toScreen, fromScreen, screenState.enterHandlers);
    fireMatchingScreenHandlers(fromScreen, toScreen, screenState.exitHandlers);
}

function isOnScreen(screens) {
    if (typeof screens === "string" || screens instanceof String)
        return screenState.screen === screens;

    for (let index = 0; index < screens.length; ++index) {
        if (isOnScreen(screens[index]))
            return true;
    }
    return false;
}

function switchToScreen(screen, hasty) {
    // Check if we have to wait for resources to load before switching.
    const requiredLoadingStage = screenRequiredLoadingStages[screen];
    if (loading.stage <= requiredLoadingStage) {
        screenState.loadingTargetScreen = screen;
        screenState.loadingTargetStage = requiredLoadingStage;
        loadingBar.stage = requiredLoadingStage;
        setScreen(SCREEN_LOADING, hasty)
        return;
    }
    setScreen(screen, hasty);
}

function setScreen(screen, hasty) {
    const fromScreen = screenState.screen;
    if (fromScreen === screen)
        return;

    screenState.screen = screen;
    fireScreenHandlers(fromScreen, screen, !!hasty);
}

function maybeSwitchOffLoadingScreen(stage) {
    if (screenState.loadingTargetScreen === null || stage < screenState.loadingTargetStage)
        return;

    setScreen(screenState.loadingTargetScreen, false);
    screenState.loadingTargetScreen = null;
    screenState.loadingTargetStage = 0;
}


//
// SCREEN TRANSITIONS
//

registerScreenTransitionHandlers(SCREEN_LOADING,     onEnterLoadingScreen,    onExitLoadingScreen);
registerScreenTransitionHandlers(SCREEN_MENU,        onEnterMenuScreen,       onExitMenuScreen);
registerScreenTransitionHandlers(SCREEN_PLAY_SELECT, onEnterPlaySelectScreen, onExitPlaySelectScreen);
registerScreenTransitionHandlers(SCREEN_LEARN,       onEnterLearnScreen,      onExitLearnScreen);
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
    [SCREEN_CONNECTING, SCREEN_GAME, SCREEN_WIN, SCREEN_PLAY_SELECT, SCREEN_LEARN],
    onEnterExitableScreen, onExitExitableScreen
);


function onEnterLoadingScreen(hasty) {
    loadingFade.fadeIn(hasty ? 0 : undefined);
    redrawLoadingBar();
}

function onExitLoadingScreen(hasty) {
    loadingFade.fadeOut(hasty ? 0 : undefined);
}

function onEnterMenuScreen(hasty) {}

function onExitMenuScreen(hasty) {}

function onEnterPlaySelectScreen(hasty) {
    fitty.fitAll();
    screenState.playSelectFade.fadeIn(hasty ? 0 : undefined);
}

function onExitPlaySelectScreen(hasty) {
    screenState.playSelectFade.fadeOut(hasty ? 0 : undefined);
}

function onEnterLearnScreen(hasty) {
    setTimeout(() => {
        if (isOnScreen(SCREEN_LEARN)) {
            screenState.learnFade.fadeIn(hasty ? 0 : undefined);
        }
    }, (hasty ? 0 : 500));
}

function onExitLearnScreen(hasty) {
    screenState.learnFade.fadeOut(hasty ? 0 : undefined);
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
    redrawBoard(true);
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

function onEnterServerScreen(hasty) {}

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
