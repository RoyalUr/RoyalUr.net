//
// This file mediates interactions between the client, the server, the model, and the rendering of the game.
//

console.log("\nCurious how the client works? Check out the source: https://github.com/Sothatsit/RoyalUrClient\n ");

const clientStartTime = getTime();
let menuResourcesLoadedTime = LONG_TIME_AGO,
    clientFinishSetupTime = LONG_TIME_AGO;

resourceLoader.setStageLoadedCallback(onStageLoaded);
resourceLoader.setResourceLoadedCallback(redrawLoadingBar);
function onStageLoaded(stage) {
    if (stage === 0) {
        setup();
    } else if (stage === 1) {
        setupGameElements();
    }
    resize();
    maybeSwitchOffLoadingScreen(stage);
}

function setup() {
    menuResourcesLoadedTime = getTime();

    imageSystem.populateDynamicImages();
    setupMenuElements();
    setInterval(updateRenderStatistics, 1000);

    document.addEventListener("keyup", handleKeyPress);
    window.onhashchange = onHashChange;
    onHashChange();

    window.requestAnimationFrame(function() {
        resize();
        redrawLoop();
        finishSetup();
    });
    window.onbeforeunload = onBeforeUnload;
}

function finishSetup() {
    clientFinishSetupTime = getTime();

    if (debug) {
        reportStartupPerformance();
    }
}

function reportStartupPerformance() {
    const startupDuration = clientFinishSetupTime - clientStartTime,
          resourceLoadDuration = menuResourcesLoadedTime - clientStartTime,
          setupDuration = clientFinishSetupTime - menuResourcesLoadedTime,
          resourceLoadPercentage = resourceLoadDuration / startupDuration,
          setupPercentage = setupDuration / startupDuration;

    let report = "\nClient startup took " + (Math.round(startupDuration * 1000 * 10) / 10) + "ms\n";

    report += "  " + (Math.round(resourceLoadPercentage * 1000) / 10) + "% - Resource Loading ";
    report += "(" + (Math.round(resourceLoadDuration * 1000 * 10) / 10) + "ms)\n";

    report += "  " + (Math.round(setupPercentage * 1000) / 10) + "% - Setup ";
    report += "(" + (Math.round(setupDuration * 1000 * 10) / 10) + "ms)\n ";

    console.log(report);
}

function getReloadConfirmation() {
    if (!isOnScreen(SCREEN_GAME) && screenState.exitTargetScreen !== SCREEN_GAME)
        return null;
    if (!game || !game.exitLosesGame)
        return "Are you sure you wish to exit?";
    return "Your game will be lost if you exit. Are you sure you wish to exit?";
}

function getExitConfirmation() {
    if (!isOnScreen(SCREEN_GAME))
        return null;
    if (!game || !game.exitLosesGame)
        return "Are you sure you wish to exit?";
    return "Your game will be lost if you exit. Are you sure you wish to exit?";
}

function onBeforeUnload(event) {
    event = event || window.event;
    const message = getReloadConfirmation();
    if (!message)
        return;

    event.preventDefault();
    event.returnValue = message;
    return message;
}



//
// Menu interaction.
//

function onPlayClicked(event) {
    if (gameSetup.mode === null) {
        audioSystem.playSound("error");
        return;
    }

    switch (gameSetup.mode) {
        case GAME_MODE_LOCAL:
            window.game = new LocalGame();
            switchToScreen(SCREEN_GAME);
            break;

        case GAME_MODE_COMPUTER:
            if (!gameSetup.difficulty) {
                audioSystem.playSound("error");
                return;
            }

            window.game = new ComputerGame(gameSetup.difficulty);
            switchToScreen(SCREEN_GAME);
            break;

        case GAME_MODE_ONLINE:
            window.game = new OnlineGame();
            switchToScreen(SCREEN_CONNECTING);
            break;

        case GAME_MODE_FRIEND:
            window.game = new FriendGame();
            switchToScreen(SCREEN_CONNECTING);
            break;

        default:
            audioSystem.playSound("error");
            break;
    }
}

function onSettingsControlClick(event) {
    event.stopPropagation();
    console.log("settings control clicked");
}

function onExitClick(event) {
    event.stopPropagation();

    // Instead of taking the user back to the game selection screen,
    // we'd rather just take them back to the site's home page.
    if (isOnScreen([SCREEN_MENU, SCREEN_GAME, SCREEN_WIN])) {
        window.location.href = "/";
        return;
    }

    const message = getExitConfirmation();
    if (message && !window.confirm(message))
        return;

    switchToScreen(screenState.exitTargetScreen);
}



//
// Establishing a network connection.
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
        game.sendOpenGamePacket();
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
// Interactions with a networked game.
//

function onPacketError(data) {
    setMessage("An unexpected error occurred", "", true, 0, 2, 1)
    console.error("Error: " + data.error);
}

function onPacketInvalidGame() {
    disconnect();
    resetNetworkStatus();
    switchToScreen(SCREEN_MENU, true);
    setMessage("Your game could not be found", "", true, 0, 5, 1)
}

function onPacketGamePending(gameInfo) {
    setHash(gameInfo.gameID);
    switchToScreen(SCREEN_WAITING_FOR_FRIEND);
}

function onPacketGame(gameInfo) {
    setHash(gameInfo.gameID);
    setOwnPlayer(gameInfo.ownPlayer);
    ownPlayer.name = gameInfo.ownName;
    ownPlayer.connected = true;
    otherPlayer.name = gameInfo.opponentName;
    otherPlayer.connected = gameInfo.opponentConnected;

    // TODO : Remove this when users are actually able to set their own names!
    lightPlayer.name = "Light";
    darkPlayer.name = "Dark";
    // TODO END

    switchToScreen(SCREEN_GAME);
    // If the user has been waiting a while to find a game, notify them with a sound!
    if (getTime() - networkConnectTime > 3) {
        audioSystem.playSound("game_found", null, true);
    }
}

function onPacketGameEnd(data) {
    if (game == null)
        return;

    game = null;
    setMessage("Your game ended ", data.reason, true, 0, 5, 1);
    switchToScreen(SCREEN_MENU);
}

function onPacketMessage(data) {
    game.onPacketMessage(data);
}

function onPacketPlayerStatus(data) {
    if (game != null) {
        game.onPacketPlayerStatus(data);
    }
}

function onPacketMove(move) {
    game.onPacketMove(move);
}

function onPacketState(state) {
    game.onPacketState(state);
}



//
// Game hash handling.
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
        connectToGame(new FriendGame());
    } else {
        switchToScreen(SCREEN_MENU);
    }
}

function connectToGame(newGame) {
    game = newGame;
    switchToScreen(SCREEN_CONNECTING);
}


//
// Game interactions.
//

const KEY_SPACE = [" ", "Space", 32],
      KEY_ESCAPE = ["Escape", "Esc", 27],
      KEY_ENTER = ["Enter", 13],
      KEY_Q = ["q", "KeyQ", 81];

function isKey(event, key) {
    const keyCode = event.key || event.keyCode;
    for (let index = 0; index < key.length; ++index) {
        if (keyCode === key[index])
            return true;
    }
    return false;
}

function handleKeyPress(event) {
    if (event.defaultPrevented)
        return;

    // Pressing any key while a message is shown will dismiss that message.
    if (tryDismissMessage())
        return;

    if (isKey(event, KEY_SPACE)) {
        tryTakeSingleAction(event, true);
        return;
    }
    if (isKey(event, KEY_ENTER) || isKey(event, KEY_Q)) {
        tryTakeSingleAction(event, false);
        return;
    }
    if (isKey(event, KEY_ESCAPE)) {
        if (screenState.exitControlFade.isFadeIn()) {
            onExitClick(event);
        }
    }
}

/** If there is a message on the screen, fade it out. **/
function tryDismissMessage() {
    if (message.dismissable && message.fade.isFadeIn() && message.fade.get() > 0.5) {
        message.fade.fadeOut();
        if (game) {
            game.onMessageDismissed(message.title, message.subtitle);
        }
        return true;
    } else {
        return false;
    }
}

function tryTakeSingleAction(event, keyIsSpace) {
    if (!game)
        return false;

    event.stopPropagation();
    // Try roll the dice.
    if (game.onDiceClick())
        return true;

    // Check that the player can make a move.
    const currentPlayer = getActivePlayer();
    if (!currentPlayer || !isAwaitingMove())
        return false;

    // See if there is a single tile that can be moved, or if space is pressed any available moves.
    const availableMoves = board.getAllValidMoves(currentPlayer.playerNo, countDiceUp());
    if (availableMoves.length === 0)
        return false;

    // Sort the available moves so that they are in a predictable order.
    const playerPath = getTilePath(currentPlayer.playerNo);
    availableMoves.sort(function(from1, from2) {
        return vecListIndexOf(playerPath, from1) - vecListIndexOf(playerPath, from2);
    });

    // If space is pressed we cycle through available tiles to move.
    if (keyIsSpace && availableMoves.length > 1) {
        const selectedIndex = vecListIndexOf(availableMoves, selectedTile),
              selectIndex = (selectedIndex + 1) % availableMoves.length;
        selectTile(availableMoves[selectIndex]);
        return true;
    }

    // If there is one available move, or enter is pressed, try move the selected tile.
    if (!isTileSelected()) {
        if (availableMoves.length === 1) {
            selectTile(availableMoves[0]);
            return true;
        }
        return false;
    }
    game.performMove(selectedTile);
    return true;
}
