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
    this.performMove = unimplemented("performMove");


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
                this.performMove();
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
            this.performMove();
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
            this.performMove(true);
        }
    }.bind(this);

    this.setupStartTiles = function() {
        const activePlayer = getActivePlayer();

        if(activePlayer.tiles.current === 0)
            return;

        const playerNo = activePlayer.playerNo,
              location = getTileStart(playerNo);

        setTile(location, playerNo);

        if(!isValidMoveFrom(playerNo, location)) {
            setTile(location, TILE_EMPTY);
        }
    }.bind(this);
}

function OnlineGame() {
    Game.apply(this);
    this.__class_name__ = "OnlineGame";

    this.init = function() {
        connect();
    }.bind(this);

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

        if (state.isGameWon) {
            runOnTileMoveFinish(function() {
                switchToScreen(SCREEN_WIN);
            });
            return;
        }

        if(state.hasRoll) {
            if (!dice.rolling) {
                startRollingDice();
            }

            dice.callback = this.setupStartTiles;
            setDiceValues(state.roll);
        } else {
            setWaitingForDiceRoll();
        }
    }.bind(this);

    this.onDiceClick = function() {
        if(!dice.active || dice.rolling || !ownPlayer.active)
            return;

        startRollingDice();
        sendPacket(writeDiceRollPacket());
    }.bind(this);

    this.performMove = function(noAnimation) {
        const to = getTileMoveToLocation(selectedTile);

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
}

function ComputerGame() {
    Game.apply(this);
    this.__class_name__ = "ComputerGame";

    setOwnPlayer(randBool() ? "light" : "dark");
    ownPlayer.name = "Human";
    otherPlayer.name = "Computer";

    this.turnPlayer = lightPlayer;

    this.isComputersTurn = function() {
        return this.turnPlayer === otherPlayer;
    }.bind(this);

    this.isHumansTurn = function() {
        return this.turnPlayer === ownPlayer;
    }.bind(this);

    this.init = function() {
        updatePlayerState(ownPlayer, 7, 0, this.isHumansTurn());
        updatePlayerState(otherPlayer, 7, 0, this.isComputersTurn());

        clearTiles();
        this.setupRoll(true);
    }.bind(this);

    this.onDiceClick = function() {
        if(!dice.active || dice.rolling || !ownPlayer.active)
            return;

        startRollingDice();
        dice.callback = this.onFinishDice;
        setDiceValues(generateRandomDiceValues());
    }.bind(this);

    this.performMove = function(noAnimation) {
        const to = getTileMoveToLocation(selectedTile),
              toTile = getTile(to);

        if (toTile !== TILE_EMPTY) {
            addTile(getPlayer(toTile));
        }

        if (!noAnimation) {
            animateTileMove(selectedTile, to, this.onFinishMove);
        } else {
            setTimeout(this.onFinishMove);
        }

        setTile(to, getTile(selectedTile));
        setTile(selectedTile, TILE_EMPTY);

        if(vecEquals(selectedTile, getTileStart())) {
            takeTile(getActivePlayer());
        }

        unselectTile();
    }.bind(this);

    this.updateActivePlayer = function() {
        ownPlayer.active = this.isHumansTurn();
        otherPlayer.active = this.isComputersTurn();
    }.bind(this);

    this.setupRoll = function(delayComputerRoll) {
        this.updateActivePlayer();
        layoutDice();
        unselectTile();

        if (this.isHumansTurn()) {
            setWaitingForDiceRoll();
        } else {
            setTimeout(function() {
                startRollingDice();
                dice.callback = this.onFinishDice;
                setDiceValues(generateRandomDiceValues());
            }.bind(this), (delayComputerRoll ? 1500 : 0));
        }
    }.bind(this);

    this.onFinishMove = function(fromTile, toTile) {
        // If they've just taken a piece off the board, give them some score
        if (vecEquals(toTile, getTileEnd(this.turnPlayer.playerNo))) {
            addScore(this.turnPlayer);
            setTile(toTile, TILE_EMPTY);

            if (this.turnPlayer.score.current === 7) {
                switchToScreen(SCREEN_WIN);
                return;
            }
        }

        if (!isLocusTile(toTile)) {
            this.turnPlayer = (this.isHumansTurn() ? otherPlayer : ownPlayer);
        }

        this.setupRoll();
    }.bind(this);

    this.onFinishDice = function() {
        this.setupStartTiles();

        const availableMoves = getAllValidMoveTiles(this.turnPlayer.playerNo);

        if (availableMoves.length === 0) {
            setMessage(
                "No moves",
                DEFAULT_MESSAGE_FADE_IN_DURATION, 1, DEFAULT_MESSAGE_FADE_OUT_DURATION
            );
            setTimeout(function() {
                playSound("error");
            }, 1000 * (DEFAULT_MESSAGE_FADE_IN_DURATION + 0.25));
            setTimeout(function() {
                this.turnPlayer = (this.isHumansTurn() ? otherPlayer : ownPlayer);
                this.setupRoll();
            }.bind(this), 1000 * (DEFAULT_MESSAGE_FADE_IN_DURATION + 1 + DEFAULT_MESSAGE_FADE_OUT_DURATION));
            return;
        }

        if (this.isComputersTurn()) {
            setTimeout(() => this.performComputerMove(availableMoves), 500);
        }
    }.bind(this);

    this.performComputerMove = function(availableMoves) {
        // TODO : Use an actual AI instead of just making a random move
        const from = randElement(availableMoves),
              to = getTileMoveToLocation(from),
              toTile = getTile(to);

        // Moving a new piece onto the board
        if (vecEquals(from, getTileStart(otherPlayer.playerNo))) {
            takeTile(otherPlayer);
        }

        // Taking out a piece
        if (toTile !== TILE_EMPTY) {
            addTile(getPlayer(toTile));
        }

        animateTileMove(from, to, this.onFinishMove);
        setTile(to, otherPlayer.playerNo);
        setTile(from, TILE_EMPTY);
    }.bind(this);
}
