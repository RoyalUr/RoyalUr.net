//
// This file manages the screens for the game.
//

const SCREEN_LOADING = "screen_loading",
      SCREEN_MENU = "screen_menu",
      SCREEN_PLAY_SELECT = "screen_play_select",
      SCREEN_DIFFICULTY = "screen_difficulty",
      SCREEN_LEARN = "screen_learn",
      SCREEN_CONNECTING = "screen_connecting",
      SCREEN_GAME = "screen_game",
      SCREEN_WIN = "screen_win";

const GAME_VISIBLE_SCREENS = [SCREEN_GAME, SCREEN_WIN];

const controlFadeDuration = 0.25;
const screenState = {
    screen: SCREEN_LOADING,
    lastScreenSwitchTime: LONG_TIME_AGO,
    loadingTargetScreen: null,
    loadingTargetStage: 0,

    exitTargetScreen: SCREEN_MENU,

    enterHandlers: [],
    exitHandlers: [],

    menuFade: createFade(0.5),
    useStaggeredMenuFade: true,
    playSelectFade: createFade(0.5),
    difficultyFade: createFade(0.5),
    learnFade: createFade(0.5),
    boardFade: createFade(0.5),
    connectionFade: createFade(2, 0.5),
    creditsFade: createFade(0.25),

    discordControlFade: createFade(controlFadeDuration),
    githubControlFade: createFade(controlFadeDuration),
    settingsControlFade: createFade(controlFadeDuration),
    learnControlFade: createFade(controlFadeDuration),
    exitControlFade: createFade(controlFadeDuration),

    joinDiscordFade: createFade(2.5, 0.5)
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
screenRequiredLoadingStages[SCREEN_LEARN] = 2;
screenRequiredLoadingStages[SCREEN_CONNECTING] = 1;
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
    screenActiveControlFades[SCREEN_LEARN] = [DISCORD, EXIT];
    screenActiveControlFades[SCREEN_CONNECTING] = [EXIT];
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

function getVisibleControlFades() {
    const fades = [];
    for (let index = 0; index < allControlFades.length; ++index) {
        const fade = allControlFades[index];
        if (fade.isFadeIn) {
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

    // When the learn screen is exited, it should return to its previous screen.
    if (screen === SCREEN_LEARN) {
        screenState.exitTargetScreen = fromScreen;
    } else {
        screenState.exitTargetScreen = SCREEN_MENU;
    }

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

registerScreenTransitionHandlers(SCREEN_LOADING,     onEnterLoadingScreen,    onExitLoadingScreen);
registerScreenTransitionHandlers(SCREEN_MENU,        onEnterMenuScreen,       onExitMenuScreen);
registerScreenTransitionHandlers(SCREEN_PLAY_SELECT, onEnterPlaySelectScreen, onExitPlaySelectScreen);
registerScreenTransitionHandlers(SCREEN_DIFFICULTY,  onEnterDifficultyScreen, onExitDifficultyScreen);
registerScreenTransitionHandlers(SCREEN_LEARN,       onEnterLearnScreen,      onExitLearnScreen);
registerScreenTransitionHandlers(SCREEN_CONNECTING,  onEnterConnectingScreen, onExitConnectingScreen);
registerScreenTransitionHandlers(SCREEN_GAME,        onEnterGameScreen,       onExitGameScreen);
registerScreenTransitionHandlers(SCREEN_WIN,         onEnterWinScreen,        onExitWinScreen);

// Screens where the menu should be shown.
registerScreenTransitionHandlers(
    [SCREEN_MENU, SCREEN_PLAY_SELECT, SCREEN_DIFFICULTY], onEnterMenuScreens, onExitMenuScreens
);

// Screens where the game should not disconnect from the server.
registerScreenTransitionHandlers(
    [SCREEN_CONNECTING, SCREEN_GAME, SCREEN_LEARN], onEnterServerScreen, onExitServerScreen
);

// Screens where the game board should be shown.
registerScreenTransitionHandlers(
    [SCREEN_GAME, SCREEN_WIN], onEnterBoardScreen, onExitBoardScreen
);

// Screens where the credits should be hidden.
registerScreenTransitionHandlers(
    [SCREEN_LOADING, SCREEN_LEARN], onEnterCreditsHiddenScreen, onExitCreditsHiddenScreen
);

function onEnterCreditsHiddenScreen(hasty) { screenState.creditsFade.fadeOut(hasty ? 0 : undefined); }
function onExitCreditsHiddenScreen(hasty) { screenState.creditsFade.fadeIn(hasty ? 0 : undefined); }

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

function onEnterDifficultyScreen(hasty) { screenState.difficultyFade.fadeIn(hasty ? 0 : undefined); }
function onExitDifficultyScreen(hasty) { screenState.difficultyFade.fadeOut(hasty ? 0 : undefined); }

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
            screenState.connectionFade.fadeIn(hasty ? 0 : undefined);
            screenState.joinDiscordFade.fadeIn(hasty ? 0 : undefined);
        }
    }, (hasty ? 0 : 500));
}
function onExitConnectingScreen(hasty) {
    screenState.joinDiscordFade.fadeOut(hasty ? 0 : undefined);
    screenState.connectionFade.fadeOut(hasty ? 0 : undefined);
}

function onEnterGameScreen(hasty) {
    setMessageAndFade("Found your Game", screenState.connectionFade);
    game.init();
    redrawBoard(true);
}
function onExitGameScreen(hasty) {
    redraw(true);
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
