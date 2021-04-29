//
// This file manages the screens for the game.
//

const SCREEN_LOADING = "screen_loading",
      SCREEN_MENU = "screen_menu",
      SCREEN_CONNECTING = "screen_connecting",
      SCREEN_WAITING_FOR_FRIEND = "screen_waiting_for_friend",
      SCREEN_GAME = "screen_game",
      SCREEN_WIN = "screen_win";

const MENU_VISIBLE_SCREENS = [SCREEN_MENU],
      GAME_VISIBLE_SCREENS = [SCREEN_GAME, SCREEN_WIN],
      NETWORK_CONNECTED_SCREENS = [SCREEN_CONNECTING, SCREEN_WAITING_FOR_FRIEND, SCREEN_GAME];

const screenState = {
    screen: SCREEN_LOADING,
    lastScreenSwitchTime: LONG_TIME_AGO,
    loadingTargetScreen: null,
    loadingTargetStage: 0,

    exitTargetScreen: SCREEN_MENU,

    enterHandlers: [],
    exitHandlers: [],

    loadingFade: new Fade(0.5).visible(),
    menuFade: new Fade(0.5),
    gameControlsFade: new Fade(0.5),
    boardFade: new Fade(0.5),
    connectionFade: new Fade(2, 0.5),
    waitingForFriendFade: new Fade(0.5, 0.5),
    winFade: new Fade(0.5),

    socialsFade: new Fade(2.5, 0.5)
};

const screenRequiredLoadingStages = {};
screenRequiredLoadingStages[SCREEN_LOADING] = -1;
screenRequiredLoadingStages[SCREEN_MENU] = 0;
screenRequiredLoadingStages[SCREEN_CONNECTING] = 1;
screenRequiredLoadingStages[SCREEN_WAITING_FOR_FRIEND] = 1;
screenRequiredLoadingStages[SCREEN_GAME] = 1;
screenRequiredLoadingStages[SCREEN_WIN] = 1;

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

function _addFadeHandlerDelay(screens, handler, delay, isExit) {
    if (!delay)
        return handler;

    return (fromScreen, toScreen, hasty) => setTimeout(() => {
        if (!!isOnScreen(screens) === !isExit) {
            handler(fromScreen, toScreen, hasty);
        }
    }, hasty ? 0 : delay);
}

function registerScreenTransitionFade(screens, fade, enterDelay, exitDelay) {
    const fadeInHandler = (_1, _2, hasty) => fade.fadeIn(hasty ? 0 : undefined),
          fadeOutHandler = (_1, _2, hasty) => fade.fadeOut(hasty ? 0 : undefined);

    registerScreenTransitionHandlers(
        screens,
        _addFadeHandlerDelay(screens, fadeInHandler, enterDelay),
        _addFadeHandlerDelay(screens, fadeOutHandler, exitDelay, true)
    )
}

function fireScreenHandlers(fromScreen, toScreen, hasty) {
    function fireMatchingScreenHandlers(inScreen, outScreen, handlersList) {
        for (let index = 0; index < handlersList.length; ++index) {
            const handler = handlersList[index];
            if (!handler.screens.includes(inScreen) || handler.screens.includes(outScreen))
                continue;

            handler.handlerFn(fromScreen, toScreen, hasty);
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
    const fromScreen = screenState.screen;
    if (fromScreen === screen)
        return;

    // Controls the screen that the exit button should take you to.
    screenState.exitTargetScreen = SCREEN_MENU;

    // When we switch to the menu screen, we want it to only load staggered if we've just loaded the page.
    screenState.useStaggeredMenuFade = (screen === SCREEN_MENU && fromScreen === SCREEN_LOADING);

    // Check if we have to wait for resources to load before switching.
    const requiredLoadingStage = screenRequiredLoadingStages[screen];
    if (resourceLoader.loadingStage <= requiredLoadingStage) {
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
    screenState.lastScreenSwitchTime = getTime();
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

registerScreenTransitionFade(SCREEN_LOADING, screenState.loadingFade);
registerScreenTransitionFade(SCREEN_WAITING_FOR_FRIEND, screenState.waitingForFriendFade);
registerScreenTransitionFade(SCREEN_CONNECTING, screenState.connectionFade, 0, "connectionFade");
registerScreenTransitionFade(SCREEN_CONNECTING, screenState.socialsFade);
registerScreenTransitionFade(SCREEN_WIN, screenState.winFade);
registerScreenTransitionFade(MENU_VISIBLE_SCREENS, screenState.menuFade, 600);
registerScreenTransitionFade(GAME_VISIBLE_SCREENS, screenState.boardFade, 600);
registerScreenTransitionFade(SCREEN_GAME, screenState.gameControlsFade, 0, 600);

registerScreenEnterHandler(SCREEN_LOADING, redrawLoadingBar);
registerScreenEnterHandler(SCREEN_MENU, onEnterMenuScreen);
registerScreenEnterHandler(SCREEN_WAITING_FOR_FRIEND, onEnterWaitingForFriendScreen);
registerScreenEnterHandler(SCREEN_CONNECTING, onEnterConnectingScreen);
registerScreenEnterHandler(SCREEN_WIN, onEnterWinScreen);
registerScreenExitHandler(NETWORK_CONNECTED_SCREENS, disconnect);
registerScreenTransitionHandlers(SCREEN_GAME, onEnterGameScreen, onExitGameScreen);


function onEnterMenuScreen() {
    resetHash();
}

function onEnterWaitingForFriendScreen() {
    waitingForFriendLinkTextBox.value = window.location.href;
    waitingForFriendLinkTextBox.style.minWidth = window.location.href.length + "ch";
}

function onEnterConnectingScreen() {
    reconnect();
    setMessageAndFade("", "", false, screenState.connectionFade);
    socialsFadeAnchorTime = getTime();
}

function onEnterGameScreen() {
    setMessageAndFade("Found your Game", "", true, screenState.connectionFade);
    game.init();
    redrawBoard(true);
    game.onGameStart();
}
function onExitGameScreen(fromScreen, toScreen) {
    redraw(true);
    if (toScreen === SCREEN_WIN) {
        game.onGameFinished();
    } else {
        game.onGameAborted();
    }
}

function onEnterWinScreen() {
    winMessageDiv.textContent = getActivePlayer().name + " wins!";
}
