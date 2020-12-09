//
// This file mediates interactions between the client, the server, the model, and the rendering of the game.
//

console.log("\nCurious how the client works? Check out the source: https://github.com/Sothatsit/RoyalUrClient\n ");

const clientStartTime = getTime();
let resourcesLoadedTime = LONG_TIME_AGO,
    clientFinishSetupTime = LONG_TIME_AGO;

setLoadResourcesCompleteFn(setup);

function setup() {
    resourcesLoadedTime = getTime();

    setupElements();
    setInterval(updateRenderStatistics, 1000);

    updateAudioVolumes();
    playSong();

    document.addEventListener("keyup", handleKeyPress);
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

    if (debug) {
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
// Menu interaction.
//

function onPlayClick(event) {
    event.stopPropagation();
    switchToScreen(SCREEN_PLAY_SELECT);
}

function onPlayLocal(event) {
    event.stopPropagation();
    game = new LocalGame();
    switchToScreen(SCREEN_GAME);
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

function onHoverPlayLocal() {
    playSelectDescriptionDiv.textContent = "Two players, one computer.";
    playSelectDescriptionFade.fadeIn();
}

function onHoverPlayOnline() {
    playSelectDescriptionDiv.textContent = "Play people across the globe.";
    playSelectDescriptionFade.fadeIn();
}

function onHoverPlayComputer() {
    playSelectDescriptionDiv.textContent = "Try your luck against the computer.";
    playSelectDescriptionFade.fadeIn();
}

function onPlayUnhover() {
    playSelectDescriptionFade.fadeOut();
}

function onExitClick(event) {
    event.stopPropagation();
    switchToScreen(SCREEN_MENU);
}

function connectToGame() {
    switchToScreen(SCREEN_CONNECTING);
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
// Interactions with a networked game.
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
        connectToGame();
    } else {
        switchToScreen(SCREEN_MENU);
    }
}


//
// Game interactions.
//

function handleKeyPress(event) {
    if (event.defaultPrevented)
        return;

    const key = event.key || event.keyCode,
          keyIsEnter = (key === "Enter" || key === 13),
          keyIsSpace = (key === " " || key === "Space" || key === 32);

    if (keyIsEnter || keyIsSpace) {
        tryTakeSingleAction(event, keyIsSpace);
    } else if (key === "Escape" || key === "Esc" || key === 27) {
        if (screenState.exitFade.isFadeIn) {
            onExitClick(event);
        }
    }
}

function tryTakeSingleAction(event, keyIsSpace) {
    if (game) {
        event.stopPropagation();
        // Try roll the dice.
        if (game.onDiceClick())
            return;

        // See if there is a single tile that can be moved, or if space is pressed any available moves.
        const currentPlayer = getActivePlayer(),
              availableMoves = board.getAllValidMoves(currentPlayer.playerNo, countDiceUp());
        if (availableMoves.length === 0)
            return;

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
            return;
        }

        // If there is one available move, or enter is pressed, try move the selected tile.
        if (!isTileSelected()) {
            if (availableMoves.length === 1) {
                selectTile(availableMoves[0]);
            }
            return;
        }
        game.performMove(selectedTile);
    } else if (isOnScreen(SCREEN_MENU)) {
        onPlayClick(event);
    }
}
