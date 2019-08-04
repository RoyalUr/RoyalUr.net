//
// MENU
//

function onPlayClick(hasty) {
    setOnMenu(false, hasty);
    connect();
}

function onLearnClick() {
    console.log("learn");
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
    history.pushState(game.gameID, "RoyalUr Game", "#" + game.gameID);
    
    setInGame(true);
    setOwnPlayer(game.ownPlayer);
    otherPlayer.name = game.opponentName;
}

function onPacketMessage(data) {
    console.log("message: " + data.message);

    setMessage(data.message);
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
        return;
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

    if (window.location.hash) {
        onPlayClick(true);
    }

    loadAudio(function() {
        updateAudioVolumes();
        playSong();
    });

    setInterval(updateFPS, 1000);
}
