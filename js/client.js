//
// NETWORK : CONNECTING
//

function onNetworkConnecting() {
    if(networkStatus.status === "Lost connection")
        return;

    setNetworkStatus("Connecting", true);
}

function onNetworkConnected() {
    console.log("reset");

    resetGame();

    setNetworkStatus("Connected", false).fadeOut();
}

function onNetworkDisconnect() {
    setNetworkStatus("Lost connection", true).fadeIn();
}



//
// NETWORK : FINDING GAME
//



//
// NETWORK : GAME
//

function onPacketGame(game) {
    setOwnPlayer(game.ownPlayer);

    otherPlayer.name = game.opponentName;
}

function onPacketMessage(data) {
    console.log("message: " + data.message);

    setMessage(data.message);
}

function onPacketState(state) {
    console.log("state: " + JSON.stringify(state));

    updatePlayerState(darkPlayer, state.dark.tiles, state.dark.score, state.currentPlayer === "dark");
    updatePlayerState(lightPlayer, state.light.tiles, state.light.score, state.currentPlayer === "light");

    if(state.hasRoll) {
        startRolling(function() {
            setupStartTiles();
        });

        setDiceValues(state.roll);
    } else {
        setWaitingForDiceRoll();
    }

    layoutDice();

    unselectTile();
    loadTileState(state.board);
}

function onPacketWin(data) {
    const player = getPlayerState(data.winner);

    setMessage(player.name + " wins!", 0.25, -1, -1);
}



//
// BOARD
//

const DOUBLE_CLICK_MOVE_TIME_SECONDS = 0.3;

let lastTileClickWasSelect = false;

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

    if(!isAwaitingMove()
       || getTile(x, y) !== ownPlayer.playerNo
       || !isValidMoveFrom(x, y)) {

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

    const time = getTime();

    lastReleaseTime = time;
    lastReleaseTile = [x, y];

    updateTilePathAnchorTime();

    if(!lastTileClickWasSelect && isTileSelected(x, y)) {
        unselectTile();
        playSound("place");
        return;
    }

    if(isTileSelected(draggedTile) && isValidMoveFrom(draggedTile) && locEquals([x, y], getTileMoveToLocation(draggedTile))) {
        sendMove();
        return;
    }
}

function sendMove() {
    sendPacket(writeMovePacket(selectedTile));

    const to = getTileMoveToLocation(selectedTile);

    setTile(to, getTile(selectedTile));
    setTile(selectedTile, TILE_EMPTY);

    unselectTile();
    ownPlayer.active = false;
    playSound("place");
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

    takeTile(activePlayer);
    setTile(location, owner);
}



//
// DICE
//

function onDiceClick() {
    if(!diceActive || diceRolling || !ownPlayer.active)
        return;

    startRolling();
    sendPacket(writeDiceRollPacket());
}



//
// GAME SETUP
//

let gameLoaded = false;

loadImages(setup);

function setup() {
    setupElements();
    connect();

    loadAudio(function() {
        updateAudioVolumes();
        playSong();
    });

    setInterval(updateFPS, 1000);
}
