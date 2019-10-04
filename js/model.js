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

function isTileValid(x, y) {
    if(y === undefined) {
        y = x[1];
        x = x[0];
    }

    return x >= 0 && y >= 0 && x < TILES_WIDTH && y < TILES_HEIGHT;
}

function isTileOnBoard(x, y) {
    if(!isTileValid(x, y))
        return false;

    if(y === undefined) {
        y = x[1];
        x = x[0];
    }

    return x === 1 || (y !== 4 && y !== 5);
}



//
// TILES
//

const TILE_EMPTY = 0,
      TILE_DARK = 1,
      TILE_LIGHT = 2;

const LIGHT_PATH = [
    [0, 4],
    [0, 3],
    [0, 2],
    [0, 1],
    [0, 0],
    [1, 0],
    [1, 1],
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
    [1, 6],
    [1, 7],
    [0, 7],
    [0, 6],
    [0, 5]
];

const DARK_PATH = [
    [2, 4],
    [2, 3],
    [2, 2],
    [2, 1],
    [2, 0],
    [1, 0],
    [1, 1],
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
    [1, 6],
    [1, 7],
    [2, 7],
    [2, 6],
    [2, 5]
];

const LIGHT_START = LIGHT_PATH[0],
      DARK_START = DARK_PATH[0];

const LOCUS_LOCATIONS = [
    [0, 0],
    [2, 0],
    [1, 3],
    [0, 6],
    [2, 6]
];

const tiles = [];
{
    for(let x = 0; x < TILES_WIDTH; ++x) {
        const row = [];
        for(let y = 0; y < TILES_HEIGHT; ++y) {
            row.push(0);
        }
        tiles.push(row);
    }
}

let selectedTile = [-1, -1];

function getTile(x, y) {
    if(x.constructor === Array) {
        y = x[1];
        x = x[0];
    }

    if(x < 0 || y < 0 || x >= TILES_WIDTH || y >= TILES_HEIGHT)
        return TILE_EMPTY;

    return tiles[x][y];
}

function setTile(x, y, owner) {
    if(x.constructor === Array) {
        owner = y;
        y = x[1];
        x = x[0];
    }

    tiles[x][y] = owner;
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

function selectTile(x, y) {
    if(!ownPlayer.active) {
        unselectTile();
        return;
    }

    if(x.constructor === Array) {
        y = x[1];
        x = x[0];
    }

    if(x < 0 || x >= TILES_WIDTH || y < 0 || y >= TILES_HEIGHT || tiles[x][y] === TILE_EMPTY) {
        unselectTile();
        return;
    }

    selectedTile = [x, y];
}

function unselectTile() {
    selectedTile = [-1, -1];
}

function isTileSelected(x, y) {
    if(x !== undefined && y === undefined) {
        y = x[1];
        x = x[0];
    }

    if(selectedTile[0] === -1 && selectedTile[1] === -1)
        return false;

    if(x === undefined && y === undefined)
        return true;

    return vecEquals([x, y], selectedTile);
}

function isTileHovered(x, y) {
    if (y === undefined) {
        y = x[1];
        x = x[0];
    }

    return vecEquals([x, y], hoveredTile);
}

function getTilePath(playerNo) {
    playerNo = (playerNo !== undefined ? playerNo : getActivePlayer().playerNo);
    if (playerNo === lightPlayer.playerNo)
        return LIGHT_PATH;
    if (playerNo === darkPlayer.playerNo)
        return DARK_PATH;
    throw "Unknown playerNo " + playerNo;
}

function getTileStart(playerNo) {
    playerNo = (playerNo === undefined ? getActivePlayer().playerNo : playerNo);

    if (playerNo === lightPlayer.playerNo)
        return LIGHT_START;
    if (playerNo === darkPlayer.playerNo)
        return DARK_START;

    throw "Unknown playerNo " + playerNo;
}

function getTileMoveToLocation(x, y) {
    const path = getTilePath(),
          diceValue = countDiceUp(),
          index = vecListIndexOf(path, x, y);

    if(index === -1 || index + diceValue >= path.length)
        return null;

    return path[index + diceValue];
}

function isLocusTile(x, y) {
    return vecListContains(LOCUS_LOCATIONS, x, y);
}

function isStartTile(x, y) {
    if(y === undefined) {
        y = x[1];
        x = x[0];
    }

    return vecEquals([x, y], getStartTile());
}

function getStartTile() {
    return (getActivePlayer() === lightPlayer ? LIGHT_START : DARK_START);
}

function isValidMoveFrom(playerNo, loc) {
    if (loc === undefined) {
        loc = playerNo;
        playerNo = ownPlayer.playerNo;
    }

    const x = loc[0],
          y = loc[1];

    if(countDiceUp() === 0)
        return false;

    const to = getTileMoveToLocation(x, y);

    if(to === null)
        return false;

    const toOwner = getTile(to),
          fromOwner = (isStartTile(x, y) ? getActivePlayer().playerNo : getTile(x, y));

    if (fromOwner !== playerNo)
        return false;
    if(toOwner === fromOwner)
        return false;
    if(toOwner === TILE_EMPTY)
        return true;

    return !isLocusTile(to);
}

function resetTiles() {
    clearTiles();
}



//
// SCORES
//

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
        },

        diceRolling: true,
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

function getActivePlayer() {
    return (lightPlayer.active ? lightPlayer : darkPlayer);
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

function randomiseRollingDice() {
    dice.rollingValues = [randInt(1, 6), randInt(1, 6), randInt(1, 6), randInt(1, 6)];
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
