//
// This file stores and manages the state of the game.
//

let game = null;

function resetGame() {
    resetTiles();
    resetDice();
    resetNetworkStatus();
}


//
// MENU
//

const GAME_MODE_LOCAL = "game_mode_local",
      GAME_MODE_COMPUTER = "game_mode_computer",
      GAME_MODE_ONLINE = "game_mode_online",
      GAME_MODE_FRIEND = "game_mode_friend";

const defaultGameSetup = {
    mode: null,
    difficulty: null
};
const gameSetup = {};
resetGameSetup();

function resetGameSetup() {
    Object.assign(gameSetup, defaultGameSetup);
}



//
// TILES
//

const board = new Board();

let selectedTile = VEC_NEG1;

function selectTile(loc) {
    if(!ownPlayer.active) {
        unselectTile();
        return;
    }

    if(!isTileLocValid(loc) || board.getTile(loc) === TILE_EMPTY) {
        unselectTile();
        return;
    }

    selectedTile = loc;
}

function unselectTile() {
    selectedTile = VEC_NEG1;
}

function isTileSelected(loc) {
    return !vecEquals(selectedTile, VEC_NEG1) && (loc === undefined || vecEquals(loc, selectedTile));
}

function isTileHovered(loc) {
    return !vecEquals(hoveredTile, VEC_NEG1) && (loc === undefined || vecEquals(loc, hoveredTile));
}

function resetTiles() {
    board.clearTiles();
}



//
// PLAYERS
//

const darkPlayer = initPlayer(TILE_DARK, "Dark"),
      lightPlayer = initPlayer(TILE_LIGHT, "Light");

let leftPlayer = darkPlayer,
    rightPlayer = lightPlayer;

let ownPlayer = darkPlayer,
    otherPlayer = lightPlayer;

function initPlayer(playerNo, name) {
    return {
        playerNo: playerNo,
        name: name,

        active: (playerNo === 1),
        connected: true,

        tiles: {
            current: 7,
            added: [],
            removed: []
        },

        score: {
            current: 0,
            added: [],
            removed: []
        }
    };
}

function updatePlayerState(player, tiles, score, active) {
    while(player.tiles.current < tiles) addTile(player);
    while(player.tiles.current > tiles) takeTile(player);
    while(player.score.current < score) addScore(player);

    player.tiles.current = tiles;
    player.score.current = score;
    player.active = active;
}

function addTile(player) {
    player.tiles.current += 1;
    player.tiles.added.push(getTime());
}

function takeTile(player) {
    player.tiles.current -= 1;
    player.tiles.removed.push(getTime());
}

function addScore(player) {
    player.score.current += 1;
    player.score.added.push(getTime());
}

function setOwnPlayer(player) {
    if(player === "light") {
        ownPlayer = lightPlayer;
        otherPlayer = darkPlayer;
    } else {
        ownPlayer = darkPlayer;
        otherPlayer = lightPlayer;
    }
    // With the exception of local games, ownPlayer is left and otherPlayer is right.
    leftPlayer = ownPlayer;
    rightPlayer = otherPlayer;
}

function getPlayer(playerNo) {
    switch (playerNo) {
        case LIGHT_PLAYER_NO: return lightPlayer;
        case DARK_PLAYER_NO:  return darkPlayer;
        default:
            throw "Unknown playerNo " + playerNo;
    }
}

function getActivePlayer() {
    return (lightPlayer.active ? lightPlayer : (darkPlayer.active ? darkPlayer : null));
}

function isAwaitingMove() {
    return !dice.active && !dice.rolling && ownPlayer.active;
}



//
// DICE
//

/**
 * The time to roll the dice for before selecting their values.
 */
const DEFAULT_DICE_SELECT_DELAY = 0.25;

const dice = {
    active: false,
    rolling: false,

    values: null,
    valuesSelected: 0,

    rollStartTime: LONG_TIME_AGO,
    selectTime: LONG_TIME_AGO,

    rollingValues: null,
    rollingValuesChangeTime: LONG_TIME_AGO,

    callback: null
};

function startRollingDice(selectDelay) {
    selectDelay = (selectDelay !== undefined ? selectDelay : DEFAULT_DICE_SELECT_DELAY);

    dice.rolling = true;
    dice.values = null;
    dice.valuesSelected = 0;
    dice.rollStartTime = getTime();
    dice.selectTime = getTime() + selectDelay;
    dice.rollingValuesChangeTime = LONG_TIME_AGO;
}

function setWaitingForDiceRoll() {
    dice.active = true;
    dice.rolling = false;
    dice.rollStartTime = LONG_TIME_AGO;
    dice.selectTime = LONG_TIME_AGO;
    dice.rollingValues = dice.values;
    dice.values = null;
    dice.valuesSelected = 0;
    dice.rollingValuesChangeTime = LONG_TIME_AGO;
}

function setDiceValues(values) {
    dice.active = false;
    dice.values = values;
}

function resetDice() {
    dice.active = false;
    dice.rolling = false;
    dice.values = null;
    dice.valuesSelected = 0;
    dice.rollStartTime = LONG_TIME_AGO;
    dice.selectTime = LONG_TIME_AGO;
    dice.rollingValues = null;
    dice.rollingValuesChangeTime = LONG_TIME_AGO;
    dice.callback = null;
}

function generateRandomDiceValues() {
    return [randInt(1, 7), randInt(1, 7), randInt(1, 7), randInt(1, 7)];
}

function randomiseRollingDice() {
    dice.rollingValues = generateRandomDiceValues();
    dice.rollingValuesChangeTime = getTime();
}

function isDiceUp(value) {
    return value <= 3;
}

function countDiceUp(values) {
    values = (values !== undefined ? values : dice.values);
    if(values === null)
        return 0;

    let diceUp = 0;
    for(let index = 0; index < values.length; ++index) {
        if(isDiceUp(values[index])) {
            diceUp += 1;
        }
    }
    return diceUp;
}



//
// NETWORK STATUS
//

const networkStatus = {
    status: "",
    connected: false,

    fade: new Fade(1.0),
    hidden: false,

    dots: false,
    lastChange: 0
};

function setNetworkStatus(status, dots) {
    networkStatus.status = status;
    networkStatus.connected = (status === "Connected");
    networkStatus.fade.visible();
    networkStatus.dots = dots;
    networkStatus.lastChange = getTime();
    return networkStatus;
}

function resetNetworkStatus() {
    networkStatus.status = "";
    networkStatus.fade.invisible();
    networkStatus.dots = false;
    networkStatus.lastChange = 0;
}

function fadeNetworkStatusIn() {
    networkStatus.fade.fadeIn();
}

function fadeNetworkStatusOut() {
    networkStatus.fade.fadeOut();
}

function createDots() {
    const time = getTime() - networkStatus.lastChange,
          dotCount = Math.floor((time * 3) % 3) + 1;

    let dots = "";
    for (let i=0; i < 3; ++i) {
        dots += (i < dotCount ? "." : "\u00a0" /*&nbsp;*/);
    }
    return dots;
}

function getNetworkStatus() {
    let status = networkStatus.status;
    if(networkStatus.dots) {
        status += createDots();
    }
    return status;
}



//
// MESSAGES
//

const DEFAULT_MESSAGE_FADE_IN_TIME  = 0.25,
      DEFAULT_MESSAGE_STAY_TIME     = 2,
      DEFAULT_MESSAGE_FADE_OUT_TIME = 0.25;

const message = {
    title: "",
    subtitle: "",
    dismissable: true,
    fade: new Fade(0)
};

/**
 * Sets the current message shown on the screen.
 *
 * @param title The main text of the message.
 * @param subtitle The clarifying smaller text of the message.
 * @param dismissable Whether the message can be dismissed.
 * @param fade The fade that controls the messages visibility.
 */
function setMessageAndFade(title, subtitle, dismissable, fade) {
    message.title = title;
    message.subtitle = subtitle;
    message.dismissable = dismissable;
    message.fade = fade;
}

function setMessage(title, subtitle, dismissable, fadeInDuration, stayDuration, fadeOutDuration) {
    fadeInDuration     = (fadeInDuration !== undefined     ? fadeInDuration     : DEFAULT_MESSAGE_FADE_IN_TIME);
    stayDuration       = (stayDuration !== undefined       ? stayDuration       : DEFAULT_MESSAGE_STAY_TIME);
    fadeOutDuration    = (fadeOutDuration !== undefined    ? fadeOutDuration    : DEFAULT_MESSAGE_FADE_OUT_TIME);

    const fade = new StagedFade(fadeInDuration, stayDuration, fadeOutDuration).fadeIn();
    setMessageAndFade(title, subtitle, dismissable, fade);
}
