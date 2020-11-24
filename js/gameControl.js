//
// This file stores the logic for controlling the game.
//

const DOUBLE_CLICK_MOVE_TIME_SECONDS = 0.3;

let computerIntelligence = 5,
    previousGameState = null;

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

    this.onTileHover = function(loc) {
        if(isAwaitingMove()
            && !isTileSelected()
            && board.isValidMoveFrom(ownPlayer.playerNo, loc, countDiceUp())) {

            playSound("hover");
        }
    }.bind(this);

    this.onTileClick = function(loc) {
        this.lastTileClickWasSelect = false;

        if(isTileSelected()) {
            const to = getTileMoveToLocation(ownPlayer.playerNo, selectedTile, countDiceUp());

            if(vecEquals(loc, to)) {
                this.performMove();
                return;
            }
        }

        if(isTileSelected(loc))
            return;

        const tileOwner = board.getTile(loc);

        if(!isAwaitingMove()
            || tileOwner !== ownPlayer.playerNo
            || !board.isValidMoveFrom(ownPlayer.playerNo, loc, countDiceUp())) {

            if(tileOwner !== TILE_EMPTY) {
                playSound("error");
            }

            unselectTile();
            return;
        }

        this.lastTileClickWasSelect = true;
        selectTile(loc);
        playSound("pickup");
    }.bind(this);

    this.onTileRelease = function(loc) {
        if(getTime() - this.lastTileReleaseTime < DOUBLE_CLICK_MOVE_TIME_SECONDS
            && vecEquals(loc, this.lastTileReleaseTile)
            && isAwaitingMove()
            && board.isValidMoveFrom(ownPlayer.playerNo, loc, countDiceUp())) {

            this.performMove();
            return;
        }

        this.lastTileReleaseTime = getTime();
        this.lastTileReleaseTile = loc;

        updateTilePathAnchorTime();

        if(!this.lastTileClickWasSelect && isTileSelected(loc)) {
            unselectTile();
            playSound("place");
            return;
        }

        const diceValue = countDiceUp();
        if(isTileSelected(draggedTile)
            && board.isValidMoveFrom(ownPlayer.playerNo, draggedTile, diceValue)
            && vecEquals(loc, getTileMoveToLocation(ownPlayer.playerNo, draggedTile, diceValue))) {
            this.performMove(true);
        }
    }.bind(this);

    this.setupStartTiles = function() {
        const activePlayer = getActivePlayer();
        if(activePlayer.tiles.current === 0)
            return;

        const playerNo = activePlayer.playerNo,
              location = getStartTile(playerNo);

        board.setTile(location, playerNo);

        if(!board.isValidMoveFrom(playerNo, location, countDiceUp())) {
            board.setTile(location, TILE_EMPTY);
        }
    }.bind(this);

    this.clearStartTiles = function() {
        board.setTile(LIGHT_START, TILE_EMPTY);
        board.setTile(DARK_START, TILE_EMPTY);
    }.bind(this);
}

function OnlineGame() {
    Game.apply(this);
    this.__class_name__ = "OnlineGame";

    this.init = function() {
        connect();
        resetDice();
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
        const tile = board.getTile(move.from);

        if(tile !== TILE_EMPTY) {
            animateTileMove(move.from, move.to);
            board.setTile(move.to, tile);
            board.setTile(move.from, TILE_EMPTY);
        }
    }.bind(this);

    this.onPacketState = function(state) {
        updatePlayerState(darkPlayer, state.dark.tiles, state.dark.score, state.currentPlayer === "dark");
        updatePlayerState(lightPlayer, state.light.tiles, state.light.score, state.currentPlayer === "light");

        layoutDice();
        unselectTile();
        board.loadTileState(state.board);

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
        const to = getTileMoveToLocation(ownPlayer.playerNo, selectedTile, countDiceUp());

        animateTileMove(selectedTile, to);
        board.setTile(to, board.getTile(selectedTile));
        board.setTile(selectedTile, TILE_EMPTY);

        if(vecEquals(selectedTile, getStartTile(ownPlayer.playerNo))) {
            takeTile(ownPlayer);
        }

        sendPacket(writeMovePacket(selectedTile));
        unselectTile();
        console.log(noAnimation);
        if (noAnimation) {
            finishTileMove();
        }

        ownPlayer.active = false;
        this.clearStartTiles();
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

        board.clearTiles();
        resetDice();
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
        const to = getTileMoveToLocation(ownPlayer.playerNo, selectedTile, countDiceUp()),
              toTile = board.getTile(to);

        if (toTile !== TILE_EMPTY) {
            addTile(getPlayer(toTile));
        }

        const from = selectedTile;
        animateTileMove(selectedTile, to, this.onFinishMove);
        board.setTile(to, board.getTile(selectedTile));
        board.setTile(selectedTile, TILE_EMPTY);

        if(vecEquals(selectedTile, getStartTile(ownPlayer.playerNo))) {
            takeTile(ownPlayer);
        }

        unselectTile();
        if (noAnimation) {
            setTimeout(function() {
                this.onFinishMove(from, to);
            }.bind(this));
            finishTileMove();
        }

        ownPlayer.active = false;
        this.clearStartTiles();
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
        if (vecEquals(toTile, getEndTile(this.turnPlayer.playerNo))) {
            this.updateActivePlayer();

            addScore(this.turnPlayer);
            board.setTile(toTile, TILE_EMPTY);

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

        const availableMoves = board.getAllValidMoves(this.turnPlayer.playerNo, countDiceUp());

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
            const start = getTime(),
                  move = this.determineComputerMove(availableMoves),
                  durationMS = (getTime() - start) * 1000;

            setTimeout(() => this.performComputerMove(move), Math.floor(max(0, 600 - durationMS)));
        }
    }.bind(this);

    this.determineComputerMove = function(availableMoves) {
        const diceValue = countDiceUp();
        let from = availableMoves[0];

        if (availableMoves.length === 1)
            return from;

        // Get the AI involved
        previousGameState = captureCurrentGameState();
        return previousGameState.findBestMove(diceValue, computerIntelligence);
    }.bind(this);

    this.performComputerMove = function(from) {
        const diceValue = countDiceUp(),
              to = getTileMoveToLocation(otherPlayer.playerNo, from, diceValue),
              toTile = board.getTile(to);

        // Moving a new piece onto the board
        if (vecEquals(from, getStartTile(otherPlayer.playerNo))) {
            takeTile(otherPlayer);
        }

        // Taking out a piece
        if (toTile !== TILE_EMPTY) {
            addTile(getPlayer(toTile));
        }

        animateTileMove(from, to, this.onFinishMove);
        board.setTile(to, otherPlayer.playerNo);
        board.setTile(from, TILE_EMPTY);
        otherPlayer.active = false;

        this.clearStartTiles();
    }.bind(this);
}

function LocalGame() {
    Game.apply(this);
    this.__class_name__ = "LocalGame";

    setOwnPlayer(randBool() ? "light" : "dark");
    lightPlayer.name = "Light";
    darkPlayer.name = "Dark";

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

        board.clearTiles();
        resetDice();
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
        const to = getTileMoveToLocation(ownPlayer.playerNo, selectedTile, countDiceUp()),
            toTile = board.getTile(to);

        if (toTile !== TILE_EMPTY) {
            addTile(getPlayer(toTile));
        }

        const from = selectedTile;
        animateTileMove(selectedTile, to, this.onFinishMove);
        board.setTile(to, board.getTile(selectedTile));
        board.setTile(selectedTile, TILE_EMPTY);

        if(vecEquals(selectedTile, getStartTile(ownPlayer.playerNo))) {
            takeTile(ownPlayer);
        }

        unselectTile();
        if (noAnimation) {
            setTimeout(function() {
                this.onFinishMove(from, to);
            }.bind(this));
            finishTileMove();
        }

        ownPlayer.active = false;
        this.clearStartTiles();
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
        if (vecEquals(toTile, getEndTile(this.turnPlayer.playerNo))) {
            this.updateActivePlayer();

            addScore(this.turnPlayer);
            board.setTile(toTile, TILE_EMPTY);

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

        const availableMoves = board.getAllValidMoves(this.turnPlayer.playerNo, countDiceUp());

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
            const start = getTime(),
                move = this.determineComputerMove(availableMoves),
                durationMS = (getTime() - start) * 1000;

            setTimeout(() => this.performComputerMove(move), Math.floor(max(0, 600 - durationMS)));
        }
    }.bind(this);

    this.determineComputerMove = function(availableMoves) {
        const diceValue = countDiceUp();
        let from = availableMoves[0];

        if (availableMoves.length === 1)
            return from;

        // Get the AI involved
        previousGameState = captureCurrentGameState();
        return previousGameState.findBestMove(diceValue, computerIntelligence);
    }.bind(this);

    this.performComputerMove = function(from) {
        const diceValue = countDiceUp(),
            to = getTileMoveToLocation(otherPlayer.playerNo, from, diceValue),
            toTile = board.getTile(to);

        // Moving a new piece onto the board
        if (vecEquals(from, getStartTile(otherPlayer.playerNo))) {
            takeTile(otherPlayer);
        }

        // Taking out a piece
        if (toTile !== TILE_EMPTY) {
            addTile(getPlayer(toTile));
        }

        animateTileMove(from, to, this.onFinishMove);
        board.setTile(to, otherPlayer.playerNo);
        board.setTile(from, TILE_EMPTY);
        otherPlayer.active = false;

        this.clearStartTiles();
    }.bind(this);
}
