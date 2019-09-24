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
      SCREEN_CONNECTING = "connecting",
      SCREEN_GAME = "game",
      SCREEN_WIN = "win";

const screenState = {
    screen: SCREEN_LOADING,

    enterHandlers: [],
    exitHandlers: [],

    menuFade: createFade(0.5),
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

registerScreenTransitionHandlers(SCREEN_LOADING,    onEnterLoadingScreen,    onExitLoadingScreen);
registerScreenTransitionHandlers(SCREEN_MENU,       onEnterMenuScreen,       onExitMenuScreen);
registerScreenTransitionHandlers(SCREEN_CONNECTING, onEnterConnectingScreen, onExitConnectingScreen);
registerScreenTransitionHandlers(SCREEN_GAME,       onEnterGameScreen,       onExitGameScreen);
registerScreenTransitionHandlers(SCREEN_WIN,        onEnterWinScreen,        onExitWinScreen);

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
    resetHash();
    setTimeout(() => {
        if (isOnScreen(SCREEN_MENU)) {
            screenState.menuFade.fadeIn(hasty ? 0 : undefined);
        }
    }, (hasty ? 0 : 500));
}

function onExitMenuScreen(hasty) {
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
    connect();
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



//
// MENU
//

function onPlayClick(hasty) {
    connectToGame(hasty);
}

function onExitClick() {
    switchToScreen(SCREEN_MENU);
}

function connectToGame(hasty) {
    switchToScreen(SCREEN_CONNECTING, hasty);
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

function onPacketGame(game) {
    setHash(game.gameID);
    switchToScreen(SCREEN_GAME);
    setOwnPlayer(game.ownPlayer);
    otherPlayer.name = game.opponentName;
}

function onPacketMessage(data) {
    if (data.text === "No moves") {
        setMessage(data.text, DEFAULT_MESSAGE_FADE_IN_DURATION, 1, DEFAULT_MESSAGE_FADE_OUT_DURATION);
        setTimeout(() => {playSound("error");}, 1000 * (DEFAULT_MESSAGE_FADE_IN_DURATION + 0.25));
        return;
    }

    setMessage(data.text);
}

function onPacketMove(move) {
    const tile = getTile(move.from),
          replaced = getTile(move.to);

    if(tile !== TILE_EMPTY) {
        animateTileMove(move.from, move.to);
        setTile(move.to, tile);
        setTile(move.from, TILE_EMPTY);
    }
}

function onPacketState(state) {
    updatePlayerState(darkPlayer, state.dark.tiles, state.dark.score, state.currentPlayer === "dark");
    updatePlayerState(lightPlayer, state.light.tiles, state.light.score, state.currentPlayer === "light");

    layoutDice();
    unselectTile();
    loadTileState(state.board);

    if(!state.isGameWon) {
        if(state.hasRoll) {
            if (!dice.rolling) {
                startRolling();
            }

            dice.callback = function() {
                setupStartTiles();
            };

            setDiceValues(state.roll);
        } else {
            setWaitingForDiceRoll();
        }
    } else {
        // One last redraw to make sure all the game state is drawn correctly
        redraw();
        switchToScreen(SCREEN_WIN);
    }
}



//
// BOARD
//

const DOUBLE_CLICK_MOVE_TIME_SECONDS = 0.3;

let lastTileClickWasSelect = false;

function onTileHover(x, y) {
    if(y === undefined) {
        y = x[1];
        x = x[0];
    }
    
    if(isAwaitingMove()
       && !isTileSelected()
       && getTile(x, y) === ownPlayer.playerNo
       && isValidMoveFrom([x, y])) {
        playSound("hover");
    }
}

function onTileClick(x, y) {
    if(y === undefined) {
        y = x[1];
        x = x[0];
    }

    lastTileClickWasSelect = false;

    if(isTileSelected()) {
        const to = getTileMoveToLocation(selectedTile);

        if(vecEquals([x, y], to)) {
            sendMove();
            return;
        }
    }

    if(isTileSelected(x, y))
        return;

    const tileOwner = getTile(x, y);
    
    if(!isAwaitingMove()
       || tileOwner !== ownPlayer.playerNo
       || !isValidMoveFrom([x, y])) {

        if(tileOwner !== TILE_EMPTY) {
            playSound("error");
        }
        
        unselectTile();
        return;
    }

    lastTileClickWasSelect = true;
    selectTile(x, y);
    playSound("pickup");
}

let lastReleaseTime = LONG_TIME_AGO,
    lastReleaseTile = [-1, -1];

function onTileRelease(x, y) {
    if(y === undefined) {
        y = x[1];
        x = x[0];
    }

    if(getTime() - lastReleaseTime < DOUBLE_CLICK_MOVE_TIME_SECONDS && vecEquals([x, y], lastReleaseTile)
       && isAwaitingMove() && getTile(x, y) === ownPlayer.playerNo &&  isValidMoveFrom([x, y])) {
        sendMove();
        return;
    }

    lastReleaseTime = getTime();
    lastReleaseTile = [x, y];

    updateTilePathAnchorTime();

    if(!lastTileClickWasSelect && isTileSelected(x, y)) {
        unselectTile();
        playSound("place");
        return;
    }

    if(isTileSelected(draggedTile) && isValidMoveFrom(draggedTile) && vecEquals([x, y], getTileMoveToLocation(draggedTile))) {
        sendMove(true);
    }
}

function sendMove(noAnimation) {
    const to = getTileMoveToLocation(selectedTile),
          replaced = getTile(to);

    if (!noAnimation) {
        animateTileMove(selectedTile, to);
    }

    setTile(to, getTile(selectedTile));
    setTile(selectedTile, TILE_EMPTY);

    if(vecEquals(selectedTile, getTileStart())) {
        takeTile(getActivePlayer());
    }

    sendPacket(writeMovePacket(selectedTile));

    unselectTile();
    ownPlayer.active = false;
}

function setupStartTiles() {
    const activePlayer = getActivePlayer();

    if(activePlayer.tiles.current === 0)
        return;

    const playerNo = activePlayer.playerNo,
          location = getTileStart(playerNo);

    if(!isValidMoveFrom(playerNo, location))
        return;

    setTile(location, playerNo);
}



//
// DICE
//

function onDiceClick() {
    if(!dice.active || dice.rolling || !ownPlayer.active)
        return;

    startRolling();
    sendPacket(writeDiceRollPacket());
}
