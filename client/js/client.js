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

    const key = event.key || event.keyCode;
    if (key === "Enter" || key === 13 || key === " " || key === "Space" || key === 32) {
        if (game) {
            event.stopPropagation();
            game.onDiceClick();
        } else if (isOnScreen(SCREEN_MENU)) {
            onPlayClick(event);
        }
    } else if (key === "Escape" || key === "Esc" || key === 27) {
        if (screenState.exitFade.isFadeIn) {
            onExitClick(event);
        }
    }
}
