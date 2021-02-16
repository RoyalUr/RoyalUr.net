//
// This file manages the screens for the game.
//

const SCREEN_LOADING = "screen_loading",
      SCREEN_MENU = "screen_menu",
      SCREEN_PLAY_SELECT = "screen_play_select",
      SCREEN_DIFFICULTY = "screen_difficulty",
      SCREEN_CONNECTING = "screen_connecting",
      SCREEN_WAITING_FOR_FRIEND = "screen_waiting_for_friend",
      SCREEN_GAME = "screen_game",
      SCREEN_WIN = "screen_win";

const MENU_VISIBLE_SCREENS = [SCREEN_MENU, SCREEN_PLAY_SELECT, SCREEN_DIFFICULTY],
      GAME_VISIBLE_SCREENS = [SCREEN_GAME, SCREEN_WIN],
      NETWORK_CONNECTED_SCREENS = [SCREEN_CONNECTING, SCREEN_WAITING_FOR_FRIEND, SCREEN_GAME],
      CREDITS_HIDDEN_SCREENS = [SCREEN_LOADING];

const controlFadeDuration = 0.25;
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
    playSelectFade: new Fade(0.5),
    difficultyFade: new Fade(0.5),
    learnFade: new Fade(0.5),
    boardFade: new Fade(0.5),
    connectionFade: new Fade(2, 0.5),
    waitingForFriendFade: new Fade(0.5, 0.5),
    creditsFade: new Fade(0.25),
    winFade: new Fade(0.5),

    discordControlFade: new Fade(controlFadeDuration),
    githubControlFade: new Fade(controlFadeDuration),
    settingsControlFade: new Fade(controlFadeDuration),
    learnControlFade: new Fade(controlFadeDuration),
    exitControlFade: new Fade(controlFadeDuration),

    socialsFade: new Fade(2.5, 0.5)
};
const allControlFades = [
    screenState.discordControlFade, screenState.githubControlFade,
    screenState.settingsControlFade, screenState.learnControlFade, screenState.exitControlFade
];

const screenRequiredLoadingStages = {};
screenRequiredLoadingStages[SCREEN_LOADING] = -1;
screenRequiredLoadingStages[SCREEN_MENU] = 0;
screenRequiredLoadingStages[SCREEN_PLAY_SELECT] = 0;
screenRequiredLoadingStages[SCREEN_DIFFICULTY] = 0;
screenRequiredLoadingStages[SCREEN_CONNECTING] = 1;
screenRequiredLoadingStages[SCREEN_WAITING_FOR_FRIEND] = 1;
screenRequiredLoadingStages[SCREEN_GAME] = 1;
screenRequiredLoadingStages[SCREEN_WIN] = 1;

const screenActiveControlFades = {};
(() => {
    const DISCORD = screenState.discordControlFade,
          GITHUB = screenState.githubControlFade,
          LEARN = screenState.learnControlFade,
          EXIT = screenState.exitControlFade;

    screenActiveControlFades[SCREEN_LOADING] = [];
    screenActiveControlFades[SCREEN_MENU] = [DISCORD, GITHUB];
    screenActiveControlFades[SCREEN_PLAY_SELECT] = [EXIT];
    screenActiveControlFades[SCREEN_DIFFICULTY] = [EXIT];
    screenActiveControlFades[SCREEN_CONNECTING] = [DISCORD, GITHUB, EXIT];
    screenActiveControlFades[SCREEN_WAITING_FOR_FRIEND] = [DISCORD, GITHUB, EXIT];
    screenActiveControlFades[SCREEN_GAME] = [DISCORD, LEARN, EXIT];
    screenActiveControlFades[SCREEN_WIN] = [DISCORD, LEARN, EXIT];
})();

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

function registerScreenTransitionFade(screens, fade, enterDelay) {
    const fadeInHandler = (_1, _2, hasty) => fade.fadeIn(hasty ? 0 : undefined),
          fadeOutHandler = (_1, _2, hasty) => fade.fadeOut(hasty ? 0 : undefined);

    // Some screens need a delay for the previous screen to fade out before this screen fades in.
    let enterHandler = fadeInHandler;
    if (enterDelay) {
        enterHandler = (_1, _2, hasty) => setTimeout(() => {
            if (isOnScreen(screens)) {
                fadeInHandler();
            }
        }, hasty ? 0 : enterDelay);
    }

    registerScreenTransitionHandlers(
        screens, enterHandler, fadeOutHandler
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

function getVisibleControlFades() {
    const fades = [];
    for (let index = 0; index < allControlFades.length; ++index) {
        const fade = allControlFades[index];
        if (fade.isFadeIn()) {
            fades.push(fade);
        }
    }
    return fades;
}

function setVisibleControlButtons(controlFades, hasty) {
    const previousFades = getVisibleControlFades(),
          fadeDuration = (hasty ? 0 : undefined);
    // Fade out all controls that are not visible any more.
    for (let index = 0; index < allControlFades.length; ++index) {
        const fade = allControlFades[index];
        if (!controlFades.includes(fade)) {
            fade.fadeOut(fadeDuration);
        }
    }
    // Fade out the controls that are going to change position.
    for (let index = 0; index < controlFades.length; ++index) {
        const fade = controlFades[index];
        if (controlFades.length - index !== previousFades.length - previousFades.indexOf(fade)) {
            fade.fadeOut(fadeDuration);
        }
    }
    // Fade in all the controls after the controls have faded out.
    const additionalFadeInDelay = (screenState.screen === SCREEN_MENU && screenState.useStaggeredMenuFade ? 0.5 : 0);
    setTimeout(() => {
        for (let index = 0; index < controlFades.length; ++index) {
            controlFades[index].fadeIn(fadeDuration);
        }
    }, (controlFadeDuration + (additionalFadeInDelay ? additionalFadeInDelay : 0)) * 1000);
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
    screenState.lastScreenSwitchTime = getTime();
    setVisibleControlButtons(screenActiveControlFades[screen], hasty);
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
registerScreenTransitionFade(SCREEN_PLAY_SELECT, screenState.playSelectFade);
registerScreenTransitionFade(SCREEN_DIFFICULTY, screenState.difficultyFade);
registerScreenTransitionFade(SCREEN_WAITING_FOR_FRIEND, screenState.waitingForFriendFade);
registerScreenTransitionFade(SCREEN_CONNECTING, screenState.connectionFade, 0, "connectionFade");
registerScreenTransitionFade(SCREEN_CONNECTING, screenState.socialsFade);
registerScreenTransitionFade(SCREEN_WIN, screenState.winFade);
registerScreenTransitionFade(MENU_VISIBLE_SCREENS, screenState.menuFade, 500);
registerScreenTransitionFade(GAME_VISIBLE_SCREENS, screenState.boardFade, 500);

registerScreenEnterHandler(SCREEN_LOADING, redrawLoadingBar);
registerScreenEnterHandler(SCREEN_MENU, resetHash);
registerScreenEnterHandler(SCREEN_WAITING_FOR_FRIEND, onEnterWaitingForFriendScreen);
registerScreenEnterHandler(SCREEN_CONNECTING, onEnterConnectingScreen);
registerScreenEnterHandler(SCREEN_WIN, onEnterWinScreen);
registerScreenExitHandler(NETWORK_CONNECTED_SCREENS, disconnect);
registerScreenTransitionHandlers(SCREEN_GAME, onEnterGameScreen, onExitGameScreen);
registerScreenTransitionHandlers(
    CREDITS_HIDDEN_SCREENS,
    (_1, _2, hasty) => screenState.creditsFade.fadeOut(hasty ? 0 : undefined),
    (_1, _2, hasty) => screenState.creditsFade.fadeIn(hasty ? 0 : undefined)
);


function onEnterWaitingForFriendScreen(fromScreen, toScreen, hasty) {
    waitingForFriendLinkTextBox.value = window.location.href;
}

function onEnterConnectingScreen(fromScreen, toScreen, hasty) {
    reconnect();
    setMessageAndFade("", "", false, screenState.connectionFade);
    socialsFadeAnchorTime = getTime();
}

function onEnterGameScreen(fromScreen, toScreen, hasty) {
    setMessageAndFade("Found your Game", "", true, screenState.connectionFade);
    game.init();
    redrawBoard(true);
    game.onGameStart();
}
function onExitGameScreen(fromScreen, toScreen, hasty) {
    redraw(true);
    if (toScreen === SCREEN_WIN) {
        game.onGameFinished();
    } else {
        game.onGameAborted();
    }
}

function onEnterWinScreen(fromScreen, toScreen, hasty) {
    winMessageDiv.textContent = getActivePlayer().name + " wins!";
}
