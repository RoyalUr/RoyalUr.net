//
// This file stores the logic for controlling the game.
//

const NO_MOVES_DURATION = 2,
      NO_MOVES_TOTAL_DURATION = DEFAULT_MESSAGE_FADE_IN_TIME + NO_MOVES_DURATION + DEFAULT_MESSAGE_FADE_OUT_TIME;

const DIFFICULTY_EASY = 1,
      DIFFICULTY_MEDIUM = 2,
      DIFFICULTY_HARD = 5,
      DIFFICULTY_PANDA = 7;

let computerWorker = null,
    computerAvailable = false,
    computerUnsupported = false,
    computerPandaAvailable = false,
    computerPandaUnsupported = false;

function loadComputerWorker() {
    if (computerWorker == null && !computerUnsupported) {
        try {
            computerWorker = new Worker("/game/simulation.[ver].js");
            computerWorker.onmessage = onComputerWorkerMessage;
        } catch (e) {
            computerUnsupported = true;
            computerPandaUnsupported = true;
            gameSetupMenu.updateStates();
        }
    }
}
function getComputerWorker() {
    loadComputerWorker();
    return computerWorker;
}
function onComputerWorkerMessage(event) {
    const packet = aiPackets.readPacket(event.data);

    if (packet.type === "ai_functionality") {
        computerAvailable = packet.available;
        computerPandaAvailable = packet.pandaAvailable;
        computerPandaUnsupported = packet.pandaUnsupported;
        gameSetupMenu.updateStates();
    } else if (packet.type === "ai_move_response") {
        // See if the current game is waiting for a computer move.
        if (game && game instanceof ComputerGame) {
            game.onReceiveComputerMove(packet.moveFrom);
        }
    } else {
        throw "Unsupported packet type " + packet.type;
    }
}


//
// The parent Game class that each different play option derives from.
//

function Game(exitLosesGame) {
    this.__class_name__ = "Game";
    this.initialised = false;
    this.exitLosesGame = exitLosesGame;
    this.noMovesSwapPlayerTimeout = null;

    layoutDice();
}

Game.prototype.onPacketMessage = unimplemented("onPacketMessage");
Game.prototype.onPacketPlayerStatus = unimplemented("onPacketPlayerStatus");
Game.prototype.onPacketMove = unimplemented("onPacketMove");
Game.prototype.onPacketState = unimplemented("onPacketState");
Game.prototype.onDiceClick = unimplemented("onDiceClick");
Game.prototype.swapPlayerAfterNoMoves = unimplemented("swapPlayerAfterNoMoves");
Game.prototype.onFinishMove = unimplemented("onFinishMove");
Game.prototype._init = unimplemented("_init");
Game.prototype.onGameStart = unimplemented("onGameStart");
Game.prototype.onGameAborted = unimplemented("onGameAborted");
Game.prototype.onGameFinished = unimplemented("onGameFinished");

Game.prototype.init = function() {
    if (this.initialised)
        return;

    this._init();
    this.initialised = true;
};
Game.prototype.onTileHover = function(loc) {
    if(isAwaitingMove() && !isTileSelected() && board.isValidMoveFrom(ownPlayer.playerNo, loc, countDiceUp())) {
        audioSystem.playSound("hover");
    }
};
Game.prototype.onTileClick = function(loc) {
    const diceUp = countDiceUp();
    if(isTileSelected()) {
        const to = getTileMoveToLocation(ownPlayer.playerNo, selectedTile, diceUp);
        if(isTileSelected(loc) || vecEquals(loc, to)) {
            this.performMove(selectedTile);
            return;
        }
    }

    const tileOwner = board.getTile(loc);
    if(!isAwaitingMove() || tileOwner !== ownPlayer.playerNo || !board.isValidMoveFrom(tileOwner, loc, diceUp)) {
        if(tileOwner !== TILE_EMPTY) {
            audioSystem.playSound("error");
        }
        unselectTile();
        return;
    }

    // If a tile is already selected, then we want clicking a tile to select it instead of move it.
    if (isTileSelected()) {
        selectTile(loc);
        audioSystem.playSound("pickup");
    } else {
        this.performMove(loc);
    }
};
Game.prototype.onTileRelease = function(loc) {};
Game.prototype.onTileTouchClick = function(loc) {
    if(isTileSelected()) {
        const to = getTileMoveToLocation(ownPlayer.playerNo, selectedTile, countDiceUp());
        if(isTileSelected(loc) || vecEquals(loc, to)) {
            this.performMove(selectedTile);
            return;
        }
    }

    const tileOwner = board.getTile(loc);
    if(!isAwaitingMove() || tileOwner !== ownPlayer.playerNo
        || !board.isValidMoveFrom(ownPlayer.playerNo, loc, countDiceUp())) {

        if(tileOwner !== TILE_EMPTY) {
            audioSystem.playSound("error");
        }
        unselectTile();
        return;
    }

    selectTile(loc);
    audioSystem.playSound("pickup");
};
Game.prototype.onTileTouchRelease = function(loc) {
    updateTilePathAnchorTime();

    // Detect if a user dragged a tile to its end point.
    const diceValue = countDiceUp();
    if(isTileSelected(draggedTile)
        && board.isValidMoveFrom(ownPlayer.playerNo, draggedTile, diceValue)
        && vecEquals(loc, getTileMoveToLocation(ownPlayer.playerNo, draggedTile, diceValue))) {
        this.performMove(selectedTile, true);
        return;
    }

    // If a user ended a drag over a tile, select it.
    const tileOwner = board.getTile(loc);
    if (isAwaitingMove() && !isTileSelected() && tileOwner === ownPlayer.playerNo
         && board.isValidMoveFrom(ownPlayer.playerNo, loc, countDiceUp())) {

        selectTile(loc);
        audioSystem.playSound("pickup");
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
Game.prototype.triggerNoMovesMessage = function(reason) {
    setMessage("No moves", reason, true, undefined, NO_MOVES_DURATION, undefined);
    setTimeout(() => {audioSystem.playSound("error");}, 1000 * (DEFAULT_MESSAGE_FADE_IN_TIME + 0.25));
    this.noMovesSwapPlayerTimeout = setTimeout(this.swapPlayerAfterNoMoves.bind(this), 1000 * NO_MOVES_TOTAL_DURATION);
};
Game.prototype.onMessageDismissed = function(title, subtitle) {
    if (title === "No moves" && this.noMovesSwapPlayerTimeout !== null) {
        clearTimeout(this.noMovesSwapPlayerTimeout);
        this.noMovesSwapPlayerTimeout = null;
        this.swapPlayerAfterNoMoves();
    }
}
Game.prototype.performMove = function(from, isDragMove) {
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

    if (!isDragMove) {
        animateTileMove(from, to, this.onFinishMove.bind(this));
    } else {
        animateTileDragMove(from, to, this.onFinishMove.bind(this));
    }
    board.setTile(to, fromTile);
    board.setTile(from, TILE_EMPTY);

    unselectTile();
    player.active = false;
    this.clearStartTiles();
};



//
// Represents games that are played online.
//

function OnlineGame(hashID) {
    Game.call(this, false);
    this.__class_name__ = "OnlineGame";
}
setSuperClass(OnlineGame, Game);

OnlineGame.prototype.onGameStart = () => analytics.recordStartGame(EVENT_ONLINE_GAME);
OnlineGame.prototype.onGameAborted = () => analytics.recordAbortGame(EVENT_ONLINE_GAME);
OnlineGame.prototype.onGameFinished = () => analytics.recordFinishGame(EVENT_ONLINE_GAME);

OnlineGame.prototype._init = function() {
    connect();
    resetDice();
};
OnlineGame.prototype.sendOpenGamePacket = function() {
    analytics.recordSearchForOnlineGame();
    sendPacket(writeFindGamePacket("Name" + randInt(100, 1000)));
};
OnlineGame.prototype.onPacketMessage = function(data) {
    if (data.title === "No moves") {
        this.triggerNoMovesMessage(data.subtitle);
        return;
    }

    setMessage(data.title, data.subtitle, true);
};
OnlineGame.prototype.swapPlayerAfterNoMoves = function() { /* Do nothing, we will get sent a state packet. */ };
OnlineGame.prototype.onPacketPlayerStatus = function(data) {
    if (data.player === "light") {
        lightPlayer.connected = data.connected;
    } else if (data.player === "dark") {
        darkPlayer.connected = data.connected;
    }
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
// Represents an online game that is played against a friend.
//

function FriendGame() {
    OnlineGame.call(this);
    this.__class_name__ = "FriendGame";
}
setSuperClass(FriendGame, OnlineGame);

FriendGame.prototype.onGameStart = () => analytics.recordStartGame(EVENT_FRIEND_GAME);
FriendGame.prototype.onGameAborted = () => analytics.recordAbortGame(EVENT_FRIEND_GAME);
FriendGame.prototype.onGameFinished = () => analytics.recordFinishGame(EVENT_FRIEND_GAME);

FriendGame.prototype.sendOpenGamePacket = function() {
    analytics.recordCreateGame();
    sendPacket(writeCreateGamePacket("Name" + randInt(100, 1000)));
};



//
// Represents games that are fully local to the browser.
//

function BrowserGame() {
    Game.call(this, true);
    this.__class_name__ = "BrowserGame";
}
setSuperClass(BrowserGame, Game);

BrowserGame.prototype.setupRoll = unimplemented("setupRoll");
BrowserGame.prototype.setupRoll = unimplemented("setupRoll");
BrowserGame.prototype.onFinishDice = unimplemented("onFinishDice");
BrowserGame.prototype.getTurnPlayer = unimplemented("getTurnPlayer");
BrowserGame.prototype.isLeftTurn = function() {
    return this.getTurnPlayer() === leftPlayer;
};
BrowserGame.prototype.isRightTurn = function() {
    return this.getTurnPlayer() === rightPlayer;
};
BrowserGame.prototype._init = function() {
    updatePlayerState(leftPlayer, 7, 0, this.isLeftTurn());
    updatePlayerState(rightPlayer, 7, 0, this.isRightTurn());
    leftPlayer.connected = true;
    rightPlayer.connected = true;

    board.clearTiles();
    resetDice();
    this.setupRoll(true);
};
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

function ComputerGame(difficulty) {
    BrowserGame.call(this);
    this.__class_name__ = "ComputerGame";
    getComputerWorker();
    this.difficulty = difficulty;

    setOwnPlayer(randBool() ? "light" : "dark");
    ownPlayer.name = "Human";
    otherPlayer.name = "Computer";

    this.turnPlayer = lightPlayer;
    this.computerMove = null;
}
setSuperClass(ComputerGame, BrowserGame);

ComputerGame.prototype.getAnalyticsDifficultyId = function() {
    if (this.difficulty <= DIFFICULTY_EASY)
        return EVENT_COMPUTER_EASY;
    if (this.difficulty <= DIFFICULTY_MEDIUM)
        return EVENT_COMPUTER_MEDIUM;
    return EVENT_COMPUTER_HARD;
};
ComputerGame.prototype.onGameStart = function() {
    analytics.recordStartGame(EVENT_COMPUTER_GAME, this.getAnalyticsDifficultyId())
};
ComputerGame.prototype.onGameAborted = function() {
    analytics.recordAbortGame(EVENT_COMPUTER_GAME, this.getAnalyticsDifficultyId())
};
ComputerGame.prototype.onGameFinished = function() {
    analytics.recordFinishGame(EVENT_COMPUTER_GAME, this.getAnalyticsDifficultyId())
};

ComputerGame.prototype.getTurnPlayer = function() {
    return this.turnPlayer;
};
ComputerGame.prototype.isComputersTurn = function() {
    return this.turnPlayer === otherPlayer;
};
ComputerGame.prototype.isHumansTurn = function() {
    return this.turnPlayer === ownPlayer;
};
ComputerGame.prototype.updateActivePlayer = function() {
    ownPlayer.active = this.isHumansTurn();
    otherPlayer.active = this.isComputersTurn();
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

    if (!isRosetteTile(toTile)) {
        this.turnPlayer = (this.isHumansTurn() ? otherPlayer : ownPlayer);
    }

    this.setupRoll();
};
ComputerGame.prototype.swapPlayerAfterNoMoves = function() {
    this.turnPlayer = (this.isHumansTurn() ? otherPlayer : ownPlayer);
    this.setupRoll();
};
ComputerGame.prototype.setupRoll = function() {
    this.updateActivePlayer();
    layoutDice();
    unselectTile();
    if (this.isHumansTurn()) {
        setWaitingForDiceRoll();
    } else {
        startRollingDice();
        dice.callback = this.onFinishDice.bind(this);
        const diceValues = generateRandomDiceValues();
        this.findComputerMove(countDiceUp(diceValues));
        setDiceValues(diceValues);
    }
};
ComputerGame.prototype.onFinishDice = function() {
    this.setupStartTiles();

    const roll = countDiceUp(),
          availableMoves = board.getAllValidMoves(this.turnPlayer.playerNo, roll);

    if (availableMoves.length === 0) {
        if (roll === 0) {
            const player = (this.isHumansTurn() ? "You" : "Computer");
            this.triggerNoMovesMessage(player + " rolled a zero");
        } else {
            this.triggerNoMovesMessage("All moves are blocked");
        }
        return;
    } else if (availableMoves.length === 1 && this.isHumansTurn()) {
        selectTile(availableMoves[0]);
    }

    // Check if we've already found the computer move.
    if (this.computerMove !== null) {
        this.performComputerMove();
    }
};
ComputerGame.prototype.findComputerMove = function(roll) {
    this.computerMove = null;

    const state = new GameState();
    state.copyFromCurrentGame();
    const availableMoves = state.board.getAllValidMoves(this.turnPlayer.playerNo, roll);
    if (availableMoves.length === 0)
        return;

    // Get the AI involved.
    const workerRequest = writeAIMoveRequestPacket(state, roll, this.difficulty, this.difficulty > 5);
    this.waitingForComputerMove = true;
    getComputerWorker().postMessage(workerRequest.data);
};
ComputerGame.prototype.onReceiveComputerMove = function(from) {
    if (!this.waitingForComputerMove)
        return;

    this.waitingForComputerMove = false;
    this.computerMove = from;

    // We don't play the move until the dice are finished rolling.
    if (!dice.rolling) {
        this.performComputerMove();
    }
};
ComputerGame.prototype.performComputerMove = function() {
    const from = this.computerMove;
    this.computerMove = null;

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
    BrowserGame.call(this);
    this.__class_name__ = "LocalGame";

    // Setup the game.
    setOwnPlayer(randBool() ? "light" : "dark");
    this.turnPlayer = lightPlayer;

    // Reset the names of the players.
    lightPlayer.name = "Light";
    darkPlayer.name = "Dark";
}
setSuperClass(LocalGame, BrowserGame);

LocalGame.prototype.onGameStart = () => analytics.recordStartGame(EVENT_LOCAL_GAME);
LocalGame.prototype.onGameAborted = () => analytics.recordAbortGame(EVENT_LOCAL_GAME);
LocalGame.prototype.onGameFinished = () => analytics.recordFinishGame(EVENT_LOCAL_GAME);

LocalGame.prototype.getTurnPlayer = function() {
    return this.turnPlayer;
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

    if (!isRosetteTile(toTile)) {
        this.turnPlayer = (this.isLeftTurn() ? rightPlayer : leftPlayer);
    }

    this.setupRoll();
};
LocalGame.prototype.onFinishDice = function() {
    this.setupStartTiles();

    const diceCount = countDiceUp();
    const availableMoves = board.getAllValidMoves(this.turnPlayer.playerNo, diceCount);
    if (availableMoves.length === 0) {
        if (diceCount === 0) {
            this.triggerNoMovesMessage(this.turnPlayer.name + " rolled a zero");
        } else {
            this.triggerNoMovesMessage("All moves are blocked");
        }
    } else if (availableMoves.length === 1) {
        selectTile(availableMoves[0]);
    }
};
LocalGame.prototype.swapPlayerAfterNoMoves = function() {
    this.turnPlayer = (this.isLeftTurn() ? rightPlayer : leftPlayer);
    this.setupRoll();
};
