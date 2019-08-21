//
// CLIENT
//

const debugClient = (window.location.hostname === "localhost");

function getHashGameID() {
    if (!window.location.hash || window.location.hash === "")
        return null;

    const gameID = window.location.hash.substr(1);
    if (gameID.length !== GAME_ID_LENGTH) {
        history.pushState(null, "Royal Ur", "#");
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
// SCREENS
//

const SCREEN_LOADING = "loading",
      SCREEN_MENU = "menu",
      SCREEN_CONNECTING = "connecting",
      SCREEN_GAME = "game",
      SCREEN_WIN = "win";

const enterScreenHandlers = {};
enterScreenHandlers[SCREEN_LOADING] = onEnterLoadingScreen;
enterScreenHandlers[SCREEN_MENU] = onEnterMenuScreen;
enterScreenHandlers[SCREEN_CONNECTING] = onEnterConnectingScreen;
enterScreenHandlers[SCREEN_GAME] = onEnterGameScreen;
enterScreenHandlers[SCREEN_WIN] = onEnterWinScreen;

const exitScreenHandlers = {};
exitScreenHandlers[SCREEN_LOADING] = onExitLoadingScreen;
exitScreenHandlers[SCREEN_MENU] = onExitMenuScreen;
exitScreenHandlers[SCREEN_CONNECTING] = onExitConnectingScreen;
exitScreenHandlers[SCREEN_GAME] = onExitGameScreen;
exitScreenHandlers[SCREEN_WIN] = onExitWinScreen;

const screenState = {
    screen: SCREEN_LOADING,

    menuFade: createFade(0.5),
    boardFade: createFade(0.5),

    connectionFade: createFade(2, 0.5)
};

function getCurrentScreen() {
    return screenState.screen;
}

function isOnScreen(screen) {
    return screenState.screen === screen;
}

function switchToScreen(screen, hasty) {
    hasty = (!hasty ? false : hasty);

    // Already on the given screen
    if (screenState.screen === screen)
        return;

    const exitHandler = exitScreenHandlers[screenState.screen],
        enterHandler = enterScreenHandlers[screen];

    if (!exitHandler)
        throw "Could not find screen exit handler for screen " + screenState.screen;
    if (!enterHandler)
        throw "Could not find screen enter handler for screen " + screen;

    screenState.screen = screen;

    exitHandler(hasty);
    enterHandler(hasty);
}

function onEnterLoadingScreen(hasty) {
    loadingFade.fadeIn(hasty ? 0 : undefined);
}

function onExitLoadingScreen(hasty) {
    loadingFade.fadeOut(hasty ? 0 : undefined);
}

function onEnterMenuScreen(hasty) {
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
    onEnterGameOrWinScreen(hasty);
}

function onExitGameScreen(hasty) {
    disconnect();
    onExitGameOrWinScreen(hasty);
}

function onEnterWinScreen(hasty) {
    onEnterGameOrWinScreen(hasty);
    setMessage(
        getActivePlayer().name + " wins!",
        0.25, -1, -1
    );
}

function onExitWinScreen(hasty) {
    onExitGameOrWinScreen(hasty);
    setMessage(message.text, 0, 0, DEFAULT_MESSAGE_FADE_OUT_DURATION);
}

function onEnterGameOrWinScreen(hasty) {
    setTimeout(() => {
        if (isOnScreen(SCREEN_GAME) || isOnScreen(SCREEN_WIN)) {
            screenState.boardFade.fadeIn();
        }
    }, (hasty ? 0 : 500))
}

function onExitGameOrWinScreen(hasty) {
    if (!isOnScreen(SCREEN_GAME) && !isOnScreen(SCREEN_WIN)) {
        screenState.boardFade.fadeOut();
    }
}



//
// MENU
//

function onPlayClick(hasty) {
    connectToGame(hasty);
}

function onLearnClick() {
    console.log("learn");
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

function onNetworkDisconnect() {
    setNetworkStatus("Lost connection", true);
    fadeNetworkStatusIn();
}



//
// NETWORK : GAME
//

function onPacketInvalidGame() {
    disconnect();
    resetNetworkStatus();
    switchToScreen(SCREEN_MENU, true);

    history.pushState(null, "Royal Ur", "#");
    setMessage("Game could not be found", 0, 2, 1)
}

function onPacketGame(game) {
    history.pushState(game.gameID, "Royal Ur Game", "#" + game.gameID);

    switchToScreen(SCREEN_GAME);
    setOwnPlayer(game.ownPlayer);
    otherPlayer.name = game.opponentName;
}

function onPacketMessage(data) {
    console.log("message: " + data.text);

    setMessageTypewriter(data.text);
}

function onPacketMove(move) {
    console.log("move: " + JSON.stringify(move));
    
    const tile = getTile(move.from),
          replaced = getTile(move.to);
    if(tile !== TILE_EMPTY) {
        setTile(move.to, tile);
        setTile(move.from, TILE_EMPTY);
        
        if(replaced !== TILE_EMPTY) {
            playSound("kill");
        } else {
            playSound("place");
        }
    }
}

function onPacketState(state) {
    console.log("state: " + JSON.stringify(state));

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
       && isValidMoveFrom(x, y)) {
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

        if(locEquals([x, y], to)) {
            sendMove();
            return;
        }
    }

    if(isTileSelected(x, y))
        return;

    const tileOwner = getTile(x, y);
    
    if(!isAwaitingMove()
       || tileOwner !== ownPlayer.playerNo
       || !isValidMoveFrom(x, y)) {

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

    if(getTime() - lastReleaseTime < DOUBLE_CLICK_MOVE_TIME_SECONDS && locEquals([x, y], lastReleaseTile)
       && isAwaitingMove() && getTile(x, y) === ownPlayer.playerNo &&  isValidMoveFrom(x, y)) {
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

    if(isTileSelected(draggedTile) && isValidMoveFrom(draggedTile) && locEquals([x, y], getTileMoveToLocation(draggedTile))) {
        sendMove();
    }
}

function sendMove() {
    const to = getTileMoveToLocation(selectedTile),
          replaced = getTile(to);

    setTile(to, getTile(selectedTile));
    setTile(selectedTile, TILE_EMPTY);

    if(locEquals(selectedTile, getTileStart())) {
        takeTile(getActivePlayer());
    }

    sendPacket(writeMovePacket(selectedTile));

    unselectTile();
    ownPlayer.active = false;
    
    if(replaced !== TILE_EMPTY) {
        playSound("kill");
    } else {
        playSound("place");
    }
}

function setupStartTiles() {
    const activePlayer = getActivePlayer();

    if(activePlayer.tiles.current === 0)
        return;

    const location = getTileStart(),
          owner = activePlayer.playerNo,
          potentialMove = getTileMoveToLocation(location);

    if(!isValidMoveFrom(location))
        return;

    setTile(location, owner);
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



//
// GAME SETUP
//

loadResources(setup);

function setup() {
    setupElements();
    setInterval(updateFPS, 1000);

    updateAudioVolumes();
    playSong();

    switchToScreen(SCREEN_MENU);

    window.onhashchange = onHashChange;
    if (getHashGameID() !== null) {
        connectToGame(true);
    }
}
