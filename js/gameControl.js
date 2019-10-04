//
// This file stores the logic for controlling the game.
//

const DOUBLE_CLICK_MOVE_TIME_SECONDS = 0.3;

function Game() {
    this.__class_name__ = "Game";

    const unimplemented = function(name) {
        return function() {
            error(name + " is not implemented within " + this.__class_name__);
        }.bind(this);
    }.bind(this);

    this.onPacketMessage = unimplemented("onPacketMessage");
    this.onPacketMove = unimplemented("onPacketMove");
    this.onPacketState = unimplemented("onPacketState");

    this.onDiceClick = unimplemented("onDiceClick");
    this.onTileHover = unimplemented("onTileHover");
    this.onTileClick = unimplemented("onTileClick");
    this.onTileRelease = unimplemented("onTileRelease");
}

function NetworkGame() {
    Game.apply(this);

    this.__class_name__ = "NetworkGame";

    this.onPacketMessage = function(data) {
        if (data.text === "No moves") {
            setMessage(data.text, DEFAULT_MESSAGE_FADE_IN_DURATION, 1, DEFAULT_MESSAGE_FADE_OUT_DURATION);
            setTimeout(() => {playSound("error");}, 1000 * (DEFAULT_MESSAGE_FADE_IN_DURATION + 0.25));
            return;
        }

        setMessage(data.text);
    }.bind(this);

    this.onPacketMove = function(move) {
        const tile = getTile(move.from);

        if(tile !== TILE_EMPTY) {
            animateTileMove(move.from, move.to);
            setTile(move.to, tile);
            setTile(move.from, TILE_EMPTY);
        }
    }.bind(this);

    this.onPacketState = function(state) {
        updatePlayerState(darkPlayer, state.dark.tiles, state.dark.score, state.currentPlayer === "dark");
        updatePlayerState(lightPlayer, state.light.tiles, state.light.score, state.currentPlayer === "light");

        layoutDice();
        unselectTile();
        loadTileState(state.board);

        if(!state.isGameWon) {
            if(state.hasRoll) {
                if (!dice.rolling) {
                    startRollingDice();
                }

                dice.callback = this.setupStartTiles;
                setDiceValues(state.roll);
            } else {
                setWaitingForDiceRoll();
            }
        } else {
            // One last redraw to make sure all the game state is drawn correctly
            redraw();
            switchToScreen(SCREEN_WIN);
        }
    }.bind(this);

    this.onDiceClick = function() {
        if(!dice.active || dice.rolling || !ownPlayer.active)
            return;

        startRollingDice();
        sendPacket(writeDiceRollPacket());
    }.bind(this);

    this.lastTileClickWasSelect = false;
    this.lastTileReleaseTime = LONG_TIME_AGO;
    this.lastTileReleaseTile = [-1, -1];

    this.onTileHover = function(x, y) {
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
    }.bind(this);

    this.onTileClick = function(x, y) {
        if(y === undefined) {
            y = x[1];
            x = x[0];
        }

        this.lastTileClickWasSelect = false;

        if(isTileSelected()) {
            const to = getTileMoveToLocation(selectedTile);

            if(vecEquals([x, y], to)) {
                this.sendMove();
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

        this.lastTileClickWasSelect = true;
        selectTile(x, y);
        playSound("pickup");
    }.bind(this);

    this.onTileRelease = function(x, y) {
        if(y === undefined) {
            y = x[1];
            x = x[0];
        }

        if(getTime() - this.lastTileReleaseTime < DOUBLE_CLICK_MOVE_TIME_SECONDS && vecEquals([x, y], this.lastTileReleaseTile)
            && isAwaitingMove() && getTile(x, y) === ownPlayer.playerNo &&  isValidMoveFrom([x, y])) {
            this.sendMove();
            return;
        }

        this.lastTileReleaseTime = getTime();
        this.lastTileReleaseTile = [x, y];

        updateTilePathAnchorTime();

        if(!this.lastTileClickWasSelect && isTileSelected(x, y)) {
            unselectTile();
            playSound("place");
            return;
        }

        if(isTileSelected(draggedTile) && isValidMoveFrom(draggedTile) && vecEquals([x, y], getTileMoveToLocation(draggedTile))) {
            this.sendMove(true);
        }
    }.bind(this);

    this.sendMove = function(noAnimation) {
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
    }.bind(this);

    this.setupStartTiles = function() {
        const activePlayer = getActivePlayer();

        if(activePlayer.tiles.current === 0)
            return;

        const playerNo = activePlayer.playerNo,
            location = getTileStart(playerNo);

        if(!isValidMoveFrom(playerNo, location))
            return;

        setTile(location, playerNo);
    }.bind(this);
}
