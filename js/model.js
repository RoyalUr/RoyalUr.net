//
// This file stores and manages the state of the game.
//

let game = null;

function resetGame() {
    game = null;
    resetTiles();
    resetDice();
    resetNetworkStatus();
}



//
// MENU
//

const BUTTON_STATE_INACTIVE = "inactive",
      BUTTON_STATE_HOVERED = "hovered";

const menuState = {
    playButton: BUTTON_STATE_INACTIVE,
    learnButton: BUTTON_STATE_INACTIVE,
    watchButton: BUTTON_STATE_INACTIVE
};



//
// BOARD
//

const TILES_WIDTH = 3,
      TILES_HEIGHT = 8,
      TILES_COUNT = TILES_WIDTH * TILES_HEIGHT;

function isTileValid(loc) {
    return loc.x >= 0 && loc.y >= 0 && loc.x < TILES_WIDTH && loc.y < TILES_HEIGHT;
}

function isTileOnBoard(loc) {
    if(!isTileValid(loc))
        return false;

    return loc.x === 1 || (loc.y !== 4 && loc.y !== 5);
}



//
// TILES
//

const TILE_EMPTY = 0,
      TILE_DARK = 1,
      TILE_LIGHT = 2;

const LIGHT_PATH = vecList(
    0, 4,
    0, 3,
    0, 2,
    0, 1,
    0, 0,
    1, 0,
    1, 1,
    1, 2,
    1, 3,
    1, 4,
    1, 5,
    1, 6,
    1, 7,
    0, 7,
    0, 6,
    0, 5
);

const DARK_PATH = vecList(
    2, 4,
    2, 3,
    2, 2,
    2, 1,
    2, 0,
    1, 0,
    1, 1,
    1, 2,
    1, 3,
    1, 4,
    1, 5,
    1, 6,
    1, 7,
    2, 7,
    2, 6,
    2, 5
);

const LIGHT_START = LIGHT_PATH[0],
      LIGHT_END = LIGHT_PATH[LIGHT_PATH.length - 1],
      DARK_START = DARK_PATH[0],
      DARK_END = DARK_PATH[DARK_PATH.length - 1];

const LOCUS_LOCATIONS = vecList(
    0, 0,
    2, 0,
    1, 3,
    0, 6,
    2, 6
);

const tiles = [];
{
    for(let x = 0; x < TILES_WIDTH; ++x) {
        const col = [];
        for(let y = 0; y < TILES_HEIGHT; ++y) {
            col.push(0);
        }
        tiles.push(col);
    }
}

let selectedTile = VEC_NEG1;

function getTile(loc) {
    return (isTileValid(loc) ? tiles[loc.x][loc.y] : TILE_EMPTY);
}

function setTile(loc, owner) {
    tiles[loc.x][loc.y] = owner;
}

function loadTileState(tileArray) {
    assert(tileArray.length === TILES_COUNT, "Expected " + TILES_COUNT + " tiles, found " + tileArray.length);

    for(let x = 0; x < TILES_WIDTH; ++x) {
        for(let y = 0; y < TILES_HEIGHT; ++y) {
            const tile = tileArray[x + y * TILES_WIDTH];

            assert(tile >= 0 && tile <= 2, "invalid tile value at (" + x + ", " + y + "). Expected 0, 1 or 2, found " + tile);

            tiles[x][y] = tile;
        }
    }
}

function clearTiles() {
    for(let x = 0; x < TILES_WIDTH; ++x) {
        for(let y = 0; y < TILES_HEIGHT; ++y) {
            tiles[x][y] = TILE_EMPTY;
        }
    }
}

function selectTile(loc) {
    if(!ownPlayer.active) {
        unselectTile();
        return;
    }

    if(loc.x < 0 || loc.x >= TILES_WIDTH || loc.y < 0 || loc.y >= TILES_HEIGHT || tiles[loc.x][loc.y] === TILE_EMPTY) {
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

function isValidMoveFrom(playerNo, loc) {
    if (loc === undefined) {
        loc = playerNo;
        playerNo = ownPlayer.playerNo;
    }

    const diceValue = countDiceUp();
    if(diceValue === 0)
        return false;

    const to = getTileMoveToLocation(playerNo, loc, diceValue);
    if(to === null)
        return false;

    const toOwner = getTile(to),
          fromOwner = getTile(loc);

    if (fromOwner !== playerNo)
        return false;
    if(toOwner === fromOwner)
        return false;
    if(toOwner === TILE_EMPTY)
        return true;

    return !isLocusTile(to);
}

function getAllValidMoveTiles(playerNo) {
    const moves = [];

    for(let x = 0; x < TILES_WIDTH; ++x) {
        for(let y = 0; y < TILES_HEIGHT; ++y) {
            const loc = vec(x, y);
            if (!isValidMoveFrom(playerNo, loc))
                continue;

            moves.push(loc);
        }
    }

    return moves;
}

function resetTiles() {
    clearTiles();
}



//
// PLAYERS
//

const LIGHT_PLAYER_NO = 2,
      DARK_PLAYER_NO = 1;

const darkPlayer = initPlayer(1, "Dark"),
      lightPlayer = initPlayer(2, "Light");

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
const DEFAULT_DICE_SELECT_DELAY = 0.75;

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

    fade: createFade(1.0),
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
    for(let i=0; i < dotCount; ++i) {
        dots += ".";
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

const DEFAULT_MESSAGE_FADE_IN_DURATION  = 0.25,
      DEFAULT_MESSAGE_STAY_DURATION     = 2,
      DEFAULT_TYPEWRITER_CHAR_DURATION  = 0.09,
      DEFAULT_MESSAGE_FADE_OUT_DURATION = 0.25;

const message = {
    text: "",
    text_set_time: 0,
    typewriter: 0,
    typewriter_last_length: 0,
    fade: createFade(0)
};

function setMessageAndFade(statusMessage, fade, typewriterDuration) {
    message.text = statusMessage;
    message.text_set_time = getTime();
    message.typewriter = (typewriterDuration ? typewriterDuration : 0);
    message.fade = fade;
}

function setMessageTypewriter(statusMessage, typewriterDuration, fadeInDuration, stayDuration, fadeOutDuration) {
    if (typewriterDuration === undefined) {
        typewriterDuration = DEFAULT_TYPEWRITER_CHAR_DURATION * statusMessage.length;
    }

    // We don't want the message to disappear before its completely shown
    if (stayDuration === undefined) {
        stayDuration = typewriterDuration;
    }

    setMessage(statusMessage, fadeInDuration, stayDuration, fadeOutDuration, typewriterDuration);
}

function setMessage(statusMessage, fadeInDuration, stayDuration, fadeOutDuration, typewriterDuration) {
    fadeInDuration     = (fadeInDuration !== undefined     ? fadeInDuration     : DEFAULT_MESSAGE_FADE_IN_DURATION);
    stayDuration       = (stayDuration !== undefined       ? stayDuration       : DEFAULT_MESSAGE_STAY_DURATION);
    fadeOutDuration    = (fadeOutDuration !== undefined    ? fadeOutDuration    : DEFAULT_MESSAGE_FADE_OUT_DURATION);
    typewriterDuration = (typewriterDuration !== undefined ? typewriterDuration : 0);

    const fade = createStagedFade(fadeInDuration, stayDuration, fadeOutDuration);

    setMessageAndFade(statusMessage, fade, typewriterDuration);
}
