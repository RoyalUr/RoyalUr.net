//
// This file stores the logic for controlling the game.
//

const DOUBLE_CLICK_MOVE_TIME_SECONDS = 0.3;

let computerIntelligence = 5,
    previousGameState = null;


//
// The parent Game class that each different play option derives from.
//

function Game() {
    this.__class_name__ = "Game";

    this.lastTileClickWasSelect = false;
    this.lastTileReleaseTime = LONG_TIME_AGO;
    this.lastTileReleaseTile = [-1, -1];
}

Game.prototype.onPacketMessage = unimplemented("onPacketMessage");
Game.prototype.onPacketMove = unimplemented("onPacketMove");
Game.prototype.onPacketState = unimplemented("onPacketState");
Game.prototype.onDiceClick = unimplemented("onDiceClick");

Game.prototype.onTileHover = function(loc) {
    if(isAwaitingMove() && !isTileSelected() && board.isValidMoveFrom(ownPlayer.playerNo, loc, countDiceUp())) {
        playSound("hover");
    }
};
Game.prototype.onTileClick = function(loc) {
    this.lastTileClickWasSelect = false;

    if(isTileSelected()) {
        const to = getTileMoveToLocation(ownPlayer.playerNo, selectedTile, countDiceUp());
        if(vecEquals(loc, to)) {
            this.performMove(selectedTile);
            return;
        }
    }
    if(isTileSelected(loc))
        return;

    const tileOwner = board.getTile(loc);
    if(!isAwaitingMove() || tileOwner !== ownPlayer.playerNo
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
};
Game.prototype.onTileRelease = function(loc) {
    if(getTime() - this.lastTileReleaseTime < DOUBLE_CLICK_MOVE_TIME_SECONDS
        && vecEquals(loc, this.lastTileReleaseTile)
        && isAwaitingMove()
        && board.isValidMoveFrom(ownPlayer.playerNo, loc, countDiceUp())) {

        this.performMove(selectedTile);
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
        this.performMove(selectedTile, true);
    }
};
Game.prototype.setupStartTiles = function() {
    const activePlayer = getActivePlayer();
    if(activePlayer.tiles.current === 0)
        return;

    const playerNo = activePlayer.playerNo,
          location = getStartTile(playerNo);

    board.setTile(location, playerNo);

    if(!board.isValidMoveFrom(playerNo, location, countDiceUp())) {
        board.setTile(location, TILE_EMPTY);
    }
};
Game.prototype.clearStartTiles = function() {
    board.setTile(LIGHT_START, TILE_EMPTY);
    board.setTile(DARK_START, TILE_EMPTY);
};
Game.prototype.onFinishMove = unimplemented("onFinishMove");
Game.prototype.performMove = function(from, noAnimation) {
    const diceValue = countDiceUp(),
          fromTile = board.getTile(from),
          player = getPlayer(fromTile),
          to = getTileMoveToLocation(fromTile, from, diceValue),
          toTile = board.getTile(to);

    // Moving a new piece onto the board.
    if (vecEquals(from, getStartTile(fromTile))) {
        takeTile(player);
    }

    // Taking out a piece.
    if (toTile !== TILE_EMPTY) {
        addTile(getPlayer(toTile));
    }

    animateTileMove(from, to, this.onFinishMove.bind(this));
    board.setTile(to, fromTile);
    board.setTile(from, TILE_EMPTY);

    unselectTile();
    player.active = false;
    this.clearStartTiles();
    if (noAnimation) {
        finishTileMove();
    }
};



//
// Represents games that are played online.
//

function OnlineGame() {
    Game.apply(this);
    this.__class_name__ = "OnlineGame";
}

OnlineGame.prototype = Object.create(Game.prototype);
Object.defineProperty(OnlineGame.prototype, "constructor", {
    value: OnlineGame, enumerable: false, writable: true
});

OnlineGame.prototype.init = function() {
    connect();
    resetDice();
};
OnlineGame.prototype.onPacketMessage = function(data) {
    if (data.text === "No moves") {
        setMessage(data.text, DEFAULT_MESSAGE_FADE_IN_DURATION, 1, DEFAULT_MESSAGE_FADE_OUT_DURATION);
        setTimeout(() => {playSound("error");}, 1000 * (DEFAULT_MESSAGE_FADE_IN_DURATION + 0.25));
        return;
    }

    setMessage(data.text);
};
OnlineGame.prototype.onPacketMove = function(move) {
    const tile = board.getTile(move.from);

    if(tile !== TILE_EMPTY) {
        animateTileMove(move.from, move.to);
        board.setTile(move.to, tile);
        board.setTile(move.from, TILE_EMPTY);
    }
};
OnlineGame.prototype.onPacketState = function(state) {
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

        dice.callback = this.onFinishDice.bind(this);
        setDiceValues(state.roll);
    } else {
        setWaitingForDiceRoll();
    }
};
OnlineGame.prototype.onDiceClick = function() {
    if(!dice.active || dice.rolling || !ownPlayer.active)
        return false;

    startRollingDice();
    sendPacket(writeDiceRollPacket());
    return true;
};
OnlineGame.prototype.onFinishDice = function () {
    this.setupStartTiles();

    // If the player has only one available move, select it for them.
    if (ownPlayer.active) {
        const availableMoves = board.getAllValidMoves(ownPlayer.playerNo, countDiceUp());
        if (availableMoves.length === 1) {
            selectTile(availableMoves[0]);
        }
    }
};
OnlineGame.prototype.performMove = function(from, noAnimation) {
    Game.prototype.performMove.call(this, from, noAnimation);
    sendPacket(writeMovePacket(from));
};
OnlineGame.prototype.onFinishMove = function() { /* Do nothing. */ };



//
// Represents games that are fully local to the browser.
//

function BrowserGame() {
    Game.apply(this);
    this.__class_name__ = "BrowserGame";
}
BrowserGame.prototype = Object.create(Game.prototype);
Object.defineProperty(BrowserGame.prototype, "constructor", {
    value: BrowserGame, enumerable: false, writable: true
});
BrowserGame.prototype.onFinishDice = unimplemented("onFinishDice");
BrowserGame.prototype.onDiceClick = function() {
    if(!dice.active || dice.rolling || !ownPlayer.active)
        return false;

    startRollingDice();
    dice.callback = this.onFinishDice.bind(this);
    setDiceValues(generateRandomDiceValues());
    return true;
};



//
// Represents games that are played against the computer.
//

function ComputerGame() {
    BrowserGame.apply(this);
    this.__class_name__ = "ComputerGame";

    setOwnPlayer(randBool() ? "light" : "dark");
    ownPlayer.name = "Human";
    otherPlayer.name = "Computer";

    this.turnPlayer = lightPlayer;
}
ComputerGame.prototype = Object.create(BrowserGame.prototype);
Object.defineProperty(ComputerGame.prototype, "constructor", {
    value: ComputerGame, enumerable: false, writable: true
});

ComputerGame.prototype.isComputersTurn = function() {
    return this.turnPlayer === otherPlayer;
};
ComputerGame.prototype.isHumansTurn = function() {
    return this.turnPlayer === ownPlayer;
};
ComputerGame.prototype.init = function() {
    updatePlayerState(ownPlayer, 7, 0, this.isHumansTurn());
    updatePlayerState(otherPlayer, 7, 0, this.isComputersTurn());

    board.clearTiles();
    resetDice();
    this.setupRoll(true);
};
ComputerGame.prototype.updateActivePlayer = function() {
    ownPlayer.active = this.isHumansTurn();
    otherPlayer.active = this.isComputersTurn();
};
ComputerGame.prototype.setupRoll = function(delayComputerRoll) {
    this.updateActivePlayer();
    layoutDice();
    unselectTile();
    if (this.isHumansTurn()) {
        setWaitingForDiceRoll();
    } else {
        setTimeout(function() {
            startRollingDice();
            dice.callback = this.onFinishDice.bind(this);
            setDiceValues(generateRandomDiceValues());
        }.bind(this), (delayComputerRoll ? 1500 : 0));
    }
};
ComputerGame.prototype.onFinishMove = function(fromTile, toTile) {
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
};
ComputerGame.prototype.onFinishDice = function() {
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
    } else if (availableMoves.length === 1 && this.isHumansTurn()) {
        selectTile(availableMoves[0]);
    }

    if (this.isComputersTurn()) {
        const start = getTime(),
              move = this.determineComputerMove(availableMoves),
              durationMS = (getTime() - start) * 1000;

        setTimeout(() => this.performComputerMove(move), Math.floor(max(0, 700 - durationMS)));
    }
};
ComputerGame.prototype.determineComputerMove = function(availableMoves) {
    const diceValue = countDiceUp();
    let from = availableMoves[0];

    if (availableMoves.length === 1)
        return from;

    // Get the AI involved
    previousGameState = captureCurrentGameState();
    return previousGameState.findBestMove(diceValue, computerIntelligence);
};
ComputerGame.prototype.performComputerMove = function(from) {
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

    animateTileMove(from, to, this.onFinishMove.bind(this));
    board.setTile(to, otherPlayer.playerNo);
    board.setTile(from, TILE_EMPTY);
    otherPlayer.active = false;

    this.clearStartTiles();
};



//
// Represents games that are played locally between players.
//

function LocalGame() {
    BrowserGame.apply(this);
    this.__class_name__ = "LocalGame";

    // Setup the game.
    setOwnPlayer(randBool() ? "light" : "dark");
    this.turnPlayer = lightPlayer;

    // Reset the names of the players.
    lightPlayer.name = "Light";
    darkPlayer.name = "Dark";
}
LocalGame.prototype = Object.create(BrowserGame.prototype);
Object.defineProperty(LocalGame.prototype, "constructor", {
    value: LocalGame, enumerable: false, writable: true
});

LocalGame.prototype.isLeftTurn = function() {
    return this.turnPlayer === leftPlayer;
};
LocalGame.prototype.isRightTurn = function() {
    return this.turnPlayer === rightPlayer;
};
LocalGame.prototype.init = function() {
    updatePlayerState(leftPlayer, 7, 0, this.isLeftTurn());
    updatePlayerState(rightPlayer, 7, 0, this.isRightTurn());

    board.clearTiles();
    resetDice();
    this.setupRoll();
};
LocalGame.prototype.updateActivePlayer = function() {
    leftPlayer.active = this.isLeftTurn();
    rightPlayer.active = this.isRightTurn();
    ownPlayer = (leftPlayer.active ? leftPlayer : rightPlayer);
    otherPlayer = (leftPlayer.active ? rightPlayer : leftPlayer);
};
LocalGame.prototype.setupRoll = function() {
    this.updateActivePlayer();
    layoutDice();
    unselectTile();
    setWaitingForDiceRoll();
};

LocalGame.prototype.onFinishMove = function(fromTile, toTile) {
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
        this.turnPlayer = (this.isLeftTurn() ? rightPlayer : leftPlayer);
    }

    this.setupRoll();
};
LocalGame.prototype.onFinishDice = function() {
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
            this.turnPlayer = (this.isLeftTurn() ? rightPlayer : leftPlayer);
            this.setupRoll();
        }.bind(this), 1000 * (DEFAULT_MESSAGE_FADE_IN_DURATION + 1 + DEFAULT_MESSAGE_FADE_OUT_DURATION));
    } else if (availableMoves.length === 1) {
        selectTile(availableMoves[0]);
    }
};
