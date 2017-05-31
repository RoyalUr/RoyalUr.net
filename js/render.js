//
// BOARD
//

const TILES_WIDTH = 3,
      TILES_HEIGHT = 8,
      TILES_COUNT = TILES_WIDTH * TILES_HEIGHT;

const boardCanvas = document.getElementById("board"),
      boardCtx = boardCanvas.getContext("2d");

let boardWidth = NaN,
    boardHeight = NaN,
    boardLeft = NaN,
    boardTop = NaN;

const boardWidthToHeightRatio = 812 / 345;

function resetBoard() {

}

function redrawBoard() {
    const ctx = boardCtx;

    ctx.clearRect(0, 0, boardWidth, boardHeight);

    ctx.save();

    // The board image is horizontal, we want it to be vertical
    ctx.translate(boardWidth / 2, boardHeight / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(getImageResource("board", boardWidth), -boardHeight / 2, -boardWidth / 2, boardHeight, boardWidth);

    ctx.restore();
}

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

const xBorderRatio = 0.095,
      yBorderRatio = 0.5 - (TILES_HEIGHT * (1 - 2 * xBorderRatio)) / (2 * boardWidthToHeightRatio * TILES_WIDTH),
      offboardXOffsetRatio = xBorderRatio * 0.25;

const tileWidthRatio = 0.6;

function getTileWidth() {
    if(isNaN(boardWidth))
        return 1;

    return Math.round((1 - 2 * xBorderRatio) / TILES_WIDTH * boardWidth * tileWidthRatio);
}

function tileToCanvas(x, y) {
    if(y === undefined) {
        y = x[1];
        x = x[0];
    }

    if(ownPlayer === darkPlayer) {
        x = TILES_WIDTH - x - 1;
    }

    const xBorder = xBorderRatio * boardWidth,
          yBorder = yBorderRatio * boardHeight,
          xStep = (1 - 2 * xBorderRatio) / TILES_WIDTH * boardWidth,
          yStep = (1 - 2 * yBorderRatio) / TILES_HEIGHT * boardHeight,
          xOffset = xBorder + xStep / 2 + tilesLeftOffset,
          yOffset = yBorder + yStep / 2;

    return [
        xOffset + x * xStep,
        yOffset + y * yStep
    ];
}

function canvasToTile(x, y) {
    if(y === undefined) {
        y = x[1];
        x = x[0];
    }

    const xBorder = xBorderRatio * boardWidth,
          yBorder = yBorderRatio * boardHeight,
          xStep = (1 - 2 * xBorderRatio) / TILES_WIDTH * boardWidth,
          yStep = (1 - 2 * yBorderRatio) / TILES_HEIGHT * boardHeight,
          xOffset = xBorder + xStep / 2 + tilesLeftOffset,
          yOffset = yBorder + yStep / 2;

    let tileX = (x - xOffset) / xStep,
        tileY = (y - yOffset) / yStep;

    if(ownPlayer === darkPlayer) {
        tileX = TILES_WIDTH - tileX - 1;
    }

    const tile = [
        Math.round(tileX),
        Math.round(tileY)
    ];

    return (isTileValid(tile) ? tile : [-1, -1]);
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
      LIGHT_END = LIGHT_PATH[LIGHT_PATH.length - 1],
      DARK_START = DARK_PATH[0],
      DARK_END = DARK_PATH[DARK_PATH.length - 1];

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

const tilesCanvas = document.getElementById("tiles"),
      tilesCtx = tilesCanvas.getContext("2d");

let tilesWidth = NaN,
    tilesHeight = NaN,
    tilesLeft = NaN,
    tilesTop = NaN,
    tilesLeftOffset = NaN;

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

    return locEquals([x, y], selectedTile);
}

function getTilePath() {
    return (lightPlayer.active ? LIGHT_PATH : DARK_PATH);
}

function getTileStart() {
    return (lightPlayer.active ? LIGHT_START : DARK_START);
}

function getTileMoveToLocation(x, y) {
    const path = getTilePath(),
          diceValue = getDiceUp(),
          index = locIndexOf(path, x, y);

    if(index === -1 || index + diceValue >= path.length)
        return null;

    return path[index + diceValue];
}

function isLocusTile(x, y) {
    return locContains(LOCUS_LOCATIONS, x, y);
}

function isStartTile(x, y) {
    if(y === undefined) {
        y = x[1];
        x = x[0];
    }

    return locEquals([x, y], getStartTile());
}

function getStartTile() {
    return (getActivePlayer() === lightPlayer ? LIGHT_START : DARK_START);
}

function isValidMoveFrom(x, y) {
    if(y === undefined) {
        y = x[1];
        x = x[0];
    }

    if(getDiceUp() === 0)
        return false;

    const to = getTileMoveToLocation(x, y);

    if(to === null)
        return false;

    const toOwner = getTile(to),
          fromOwner = (isStartTile(x, y) ? getActivePlayer().playerNo : getTile(x, y));

    if(toOwner === fromOwner)
        return false;

    if(toOwner === TILE_EMPTY)
        return true;

    return !isLocusTile(to);
}

const hoverWidthRatio = 1.1,
      shadowWidthRatio = hoverWidthRatio * 1.05;

function resetTiles() {
    clearTiles();
}

let tilePathAnchorTime = 0,
    tilePathAnchorLastTileReleaseTime = LONG_TIME_AGO,
    tilePathLastMouseDownTime = LONG_TIME_AGO;

function updateTilePathAnchorTime() {
    const duration = getTime() - mouseDownTime,
          width = getTileWidth(),
          distance = locDistance(mouseX, mouseY, mouseDownX, mouseDownY);

    tilePathAnchorTime += (9 / 15) * duration - (2 / 3) * distance / width;

    // Period in time when the pattern repeats
    const period = 2 / 3;

    tilePathAnchorTime = (tilePathAnchorTime % period) + (tilePathAnchorTime < 0 ? period : 0);
}

function redrawTiles() {
    const ctx = tilesCtx;

    ctx.clearRect(0, 0, tilesWidth, tilesHeight);

    const width = getTileWidth(),
          path = getTilePath(),
          diceValue = getDiceUp();

    let pathTile = (isTileSelected(draggedTile) || getTile(hoveredTile) !== ownPlayer.playerNo ? selectedTile : hoveredTile);

    if(!isAwaitingMove() || !isTileValid(pathTile) || getTile(pathTile) !== ownPlayer.playerNo) {
        pathTile = [-1, -1];
    }

    let startIndex = locIndexOf(path, pathTile),
        endIndex = (startIndex >= 0 ? min(startIndex + diceValue, path.length - 1) : -1),
        to = (endIndex >= 0 ? path[endIndex] : [-1, -1]);

    if(startIndex === endIndex) {
        pathTile = [-1, -1];
        to = [-1, -1];
    }

    for(let x = 0; x < TILES_WIDTH; ++x) {
        for(let y = 0; y < TILES_HEIGHT; ++y) {
            if(tiles[x][y] === TILE_EMPTY)
                continue;

            if(locEquals([x, y], pathTile) || locEquals([x, y], to))
                continue;

            renderTile(ctx, [x, y], width, width, tiles[x][y], (isTileSelected(x, y) ? 255 : 0));
        }
    }

    if(!isTileValid(pathTile))
        return;

    const isValidMove = isValidMoveFrom(pathTile),
          owner = ownPlayer.playerNo;

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = (!isValidMove ? rgb(255, 70, 70) : (locEquals(hoveredTile, to) ? rgb(100, 255, 100) : rgb(255)));
    ctx.shadowColor = rgb(0);
    ctx.shadowBlur = width / 10;
    ctx.lineWidth = width / 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([width / 6, width / 3]);

    const time = getTime() - tilePathAnchorTime,
          timeMouseDown = mouseDownTime - tilePathAnchorTime;

    tilePathLastMouseDownTime = mouseDownTime;

    if(mouseDown) {
        ctx.lineDashOffset = (-0.75) * width * timeMouseDown + (-0.3) * width * (time - timeMouseDown) - 0.5 * locDistance(mouseX, mouseY, mouseDownX, mouseDownY);
    } else {
        ctx.lineDashOffset = (-0.75) * width * time;
    }

    const end = tileToCanvas(path[endIndex]),
          draggingTile = (isTileSelected(draggedTile) && locDistance(mouseX, mouseY, mouseDownX, mouseDownY) >= width / 4);

    if(!draggingTile) {
        for(let index = startIndex; index < endIndex; ++index) {
            const current = tileToCanvas(path[index]),
                  next = tileToCanvas(path[index + 1]),
                  mid = locMidpoint(current, next);

            ctx.quadraticCurveTo(current[0], current[1], mid[0], mid[1])
        }

        ctx.lineTo(end[0], end[1]);
    } else {
        const fromCanvas = tileToCanvas(pathTile),
              location = locAdd(fromCanvas, [mouseX - mouseDownX, mouseY - mouseDownY]);

        location[0] = clamp(location[0], width, tilesWidth - width);
        location[1] = clamp(location[1], width, tilesHeight - width);

        ctx.moveTo(location[0], location[1]);
        ctx.lineTo(end[0], end[1]);
    }

    ctx.stroke();
    ctx.closePath();

    if(!isValidMove && getTile(to) === TILE_EMPTY) {
        ctx.beginPath();
        ctx.setLineDash([]);

        const crossSize = width / 6;

        ctx.moveTo(end[0] - crossSize, end[1] - crossSize)
        ctx.lineTo(end[0] + crossSize, end[1] + crossSize);

        ctx.moveTo(end[0] - crossSize, end[1] + crossSize)
        ctx.lineTo(end[0] + crossSize, end[1] - crossSize);

        ctx.stroke();
    }

    ctx.restore();

    if(isValidMove) {
        renderTile(ctx, to, width, width, owner, (locEquals(hoveredTile, to) ? 255 : 0));
    } else if(getTile(to) !== TILE_EMPTY) {
        renderTile(ctx, to, width, width, getTile(to), 0);
    }

    if(!isTileSelected(draggedTile)) {
        renderTile(ctx, pathTile, width, width, owner, (isTileSelected(pathTile) ? 255 : 0));
    } else {
        const fromCanvas = tileToCanvas(pathTile),
              location = locAdd(fromCanvas, [mouseX - mouseDownX, mouseY - mouseDownY]);

        location[0] = clamp(location[0], width, tilesWidth - width);
        location[1] = clamp(location[1], width, tilesHeight - width);

        const tileLocation = canvasToTile(location);

        const endHovered = locEquals(hoveredTile, to),
              shadowRed = (endHovered ? 0 : 255),
              shadowGreen = 255,
              shadowBlue = (endHovered ? 0 : 255);

        const draggedOnBoard = isTileOnBoard(canvasToTile(mouseX, mouseY)),
              draggedWidth = width * (draggedOnBoard ? hoverWidthRatio : 1),
              draggedShadowWidth = width * (draggedOnBoard ? shadowWidthRatio : 1);

        paintTile(ctx, location[0], location[1], draggedWidth, draggedShadowWidth, owner, shadowRed, shadowGreen, shadowBlue);
    }
}

function getTileImage(owner, width) {
    if(owner == TILE_DARK) return getImageResource("darkTile", width);
    if(owner == TILE_LIGHT)  return getImageResource("lightTile", width);
    return null;
}

function renderTile(ctx, location, width, shadowWidth, owner, shadowRed, shadowGreen, shadowBlue) {
    if(!isTileOnBoard(location)) {
        width /= hoverWidthRatio;
        shadowWidth /= shadowWidthRatio;
    }

    const loc = tileToCanvas(location);

    paintTile(ctx, loc[0], loc[1], width, shadowWidth, owner, shadowRed, shadowGreen, shadowBlue);
}

function paintTile(ctx, centreLeft, centreTop, width, shadowWidth, owner, shadowRed, shadowGreen, shadowBlue) {
    const left = centreLeft - width / 2,
          top = centreTop - width / 2,
          shadowRadius = shadowWidth / 2,
          tileImage = getTileImage(owner, width);

    if(shadowWidth > 0) {
        drawCircularShadow(ctx, centreLeft, centreTop, shadowRadius, shadowRed, shadowGreen, shadowBlue);
    }

    ctx.drawImage(tileImage, left, top, width, width);
}



//
// SCORES
//

const scoreTileRatio = 0.8;

const leftPlayerRenderTarget = initPlayerRenderTarget("left"),
      rightPlayerRenderTarget = initPlayerRenderTarget("right");

const darkPlayer = initPlayer(1, "Dark", leftPlayerRenderTarget),
      lightPlayer = initPlayer(2, "Light", rightPlayerRenderTarget);

let ownPlayer = darkPlayer,
    otherPlayer = lightPlayer;

let scoreWidth = NaN,
    scoreHeight = NaN;

function initPlayer(playerNo, name, renderTarget) {
    return {
        renderTarget: renderTarget,
        renderedIdleName: null,
        renderedActiveName: null,

        playerNo: playerNo,
        name: name,

        requiresRedraw: false,

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

function initPlayerRenderTarget(side) {
    const tilesCanvas = document.getElementById(side + "-tiles"),
          tilesCtx = tilesCanvas.getContext("2d");

    const scoreCanvas = document.getElementById(side + "-score"),
          scoreCtx = scoreCanvas.getContext("2d");

    return {
        side: side,

        tilesCanvas: tilesCanvas,
        tilesCtx: tilesCtx,

        scoreCanvas: scoreCanvas,
        scoreCtx: scoreCtx
    };
}

function setOwnPlayer(player) {
    if(player === "light") {
        ownPlayer = lightPlayer;
        otherPlayer = darkPlayer;
    } else {
        ownPlayer = darkPlayer;
        otherPlayer = lightPlayer;
    }

    ownPlayer.renderTarget = leftPlayerRenderTarget;
    otherPlayer.renderTarget = rightPlayerRenderTarget;
}

function getActivePlayer() {
    return (lightPlayer.active ? lightPlayer : darkPlayer);
}

function getPlayerState(player) {
    return (player === "light" ? lightPlayer : darkPlayer);
}

function isAwaitingMove() {
    return !diceActive && !diceRolling && ownPlayer.active;
}

function resetScores() {

}

function redrawScores() {
    const tileSpace = getTileWidth(),
          tileWidth = tileSpace * scoreTileRatio;

    function drawTiles(ctx, owner, left, top, tileCount) {
        ctx.clearRect(0, 0, scoreWidth, scoreHeight * 2);
        for(let index = 0; index < tileCount; ++index) {
            const tileLeft = left + (index + 0.5) * tileSpace;

            if(isNaN(tileLeft) || isNaN(top) || isNaN(tileWidth) || isNaN(tileWidth)) {
                console.log("(" + tileSpace + ", " + tileWidth + ", " + index + ", " + tileLeft + ", " + left + ", " + top + ", " + owner + ")");
                console.log("-> " + tileLeft + ", " + top + ", " + tileWidth + ", " + tileWidth);
            }

            paintTile(ctx, tileLeft, top, tileWidth, tileWidth, owner);
        }
    }

    function drawPlayer(player, tilesLeft, scoreLeft) {
        const tilesCtx = player.renderTarget.tilesCtx,
              scoreCtx = player.renderTarget.scoreCtx;

        drawTiles(tilesCtx, player.playerNo, tilesLeft, tileSpace * 1.5, player.tiles.current);
        drawTiles(scoreCtx, player.playerNo, scoreLeft, tileSpace * 0.5, player.score.current);

        if(player.renderedIdleName === null || scoreWidth !== player.renderedIdleName.width) {
            function initFont(ctx) {
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.font = Math.round(tileSpace * 0.75) + "px KorraFont";
            }

            player.renderedIdleName = renderResource(scoreWidth, scoreHeight, function(ctx) {
                initFont(ctx);

                const text = renderResource(scoreWidth, scoreHeight, function(ctx) {
                    initFont(ctx);
                    const offset = 0.01 * tileSpace;

                    ctx.fillStyle = rgba(255, 255, 255, 0.3);
                    ctx.fillText(player.name, scoreWidth / 2, 0.5 * tileSpace + offset);

                    ctx.fillStyle = rgba(0, 0, 0, 0.7);
                    ctx.fillText(player.name, scoreWidth / 2, 0.5 * tileSpace - offset);

                    ctx.fillStyle = rgb(0);
                    ctx.fillText(player.name, scoreWidth / 2, 0.5 * tileSpace);
                });

                ctx.globalAlpha = 0.5;
                ctx.drawImage(text, 0, 0);
            });

            player.renderedActiveName = renderResource(scoreWidth, scoreHeight, function(ctx) {
                initFont(ctx);

                const text = renderResource(scoreWidth, scoreHeight, function(ctx) {
                    initFont(ctx);
                    const offset = 0.01 * tileSpace;

                    ctx.shadowBlur = 5;
                    ctx.shadowColor = rgb(255, 255, 255);
                    ctx.fillText(player.name, scoreWidth / 2, 0.5 * tileSpace);
                    ctx.shadowBlur = 0;
                    ctx.shadowBlur = rgba(0, 0);

                    ctx.fillStyle = rgba(255, 255, 255, 0.3);
                    ctx.fillText(player.name, scoreWidth / 2, 0.5 * tileSpace + offset);

                    ctx.fillStyle = rgba(0, 0, 0, 0.7);
                    ctx.fillText(player.name, scoreWidth / 2, 0.5 * tileSpace - offset);

                    ctx.fillStyle = rgb(0);
                    ctx.fillText(player.name, scoreWidth / 2, 0.5 * tileSpace);
                });

                ctx.globalAlpha = 0.5;
                ctx.drawImage(text, 0, 0);
            });
        }

        tilesCtx.save();

        const renderedName = (player.active ? player.renderedActiveName : player.renderedIdleName);
        tilesCtx.drawImage(renderedName, 0, 0);

        tilesCtx.restore();
    }

    const p1TilesLeft = (6 - ownPlayer.tiles.current) * tileSpace,
          p1ScoreLeft = (6 - ownPlayer.score.current) * tileSpace;

    drawPlayer(ownPlayer, p1TilesLeft, p1ScoreLeft);
    drawPlayer(otherPlayer, 0, 0);
}



//
// DICE
//

const diceCanvas = document.getElementById("dice"),
      diceCtx = diceCanvas.getContext("2d");

const diceWidthRatio = 0.75;

let diceLeft = NaN,
    diceTop = NaN,
    diceWidth = NaN,
    diceHeight = NaN;

let diceActive = false,
    diceRolling = false,
    diceCallback = null,
    diceValues = null;

let diceHovered = false,
    diceRollStart = LONG_TIME_AGO,
    diceSelectTime = LONG_TIME_AGO,
    diceRollingValues = null,
    diceLastChange = LONG_TIME_AGO,
    diceSelected = 0;

function startRolling(callback) {
    diceRolling = true;
    diceCallback = callback;
    diceRollStart = getTime();
    diceSelectTime = getTime() + 0.75;
    diceValues = null;
    diceLastChange = LONG_TIME_AGO;
    diceSelected = 0;
    diceUpCount = 0;
}

function setWaitingForDiceRoll() {
    diceActive = true;
    diceHovered = false;
    diceRolling = false;
    diceRollStart = LONG_TIME_AGO;
    diceSelectTime = LONG_TIME_AGO;
    diceRollingValues = diceValues;
    diceValues = null;
    diceLastChange = LONG_TIME_AGO;
    diceSelected = 0;
}

function setDiceValues(values) {
    diceActive = false;
    diceValues = values;
}

function resetDice() {
    diceHovered = false;
    diceRolling = false;
    diceRollStart = LONG_TIME_AGO;
    diceSelectTime = LONG_TIME_AGO;
    diceValues = null;
    diceRollingValues = null;
    diceLastChange = LONG_TIME_AGO;
    diceSelected = 0;
}

function layoutDice() {
    if(ownPlayer.active) {
        diceLeft = boardLeft - diceWidth;
    } else {
        diceLeft = boardLeft + boardWidth;
    }

    diceTop = centreTop - diceHeight / 2;

    diceCanvas.style.top = diceTop + "px";
    diceCanvas.style.left = diceLeft + "px";
}

function redrawDice() {
    const active = (diceActive && !diceRolling && ownPlayer.active);

    if(active) {
        diceCanvas.style.cursor = "pointer";
    } else {
        diceCanvas.style.cursor = "";
    }

    diceCtx.save();

    let time = getTime(),
        animTime = time - diceRollStart,
        selectTime = time - diceSelectTime;

    if(diceValues === null && selectTime > 0) {
        diceSelectTime = diceLastChange + diceRollStart;
        diceSelected = 0;
        selectTime = 0;
    }

    if(diceRollingValues === null || (diceRolling && animTime - diceLastChange > 0.1)) {
        diceLastChange = animTime;
        diceSelected = clamp(Math.floor(4 * selectTime), 0, 4);
        diceRollingValues = [randInt(1, 6), randInt(1, 6), randInt(1, 6), randInt(1, 6)];

        if(diceSelected == 4) {
            diceRolling = false;
            diceCallback();
        }
    }

    const space = getTileWidth() / diceWidthRatio,
          width = space * 0.8;

    diceCtx.clearRect(0, 0, diceWidth, diceHeight);

    for(let index = 0; index < 4; ++index) {
        const timeToSelect = (0.5 + index * 0.25) - selectTime + 0.25;

        let sizeModifier = (diceRolling ? 1 : 0);

        if(timeToSelect > 0 && timeToSelect < 0.5) {
            const t = 1 - 2 * timeToSelect;

            sizeModifier = 1 - easeInSine(t);
        } else if(timeToSelect <= 0) {
            const a = 0.15;

            if(timeToSelect > -a) {
                const t = timeToSelect / (-a);

                sizeModifier = 0.2 * easeOutSine(t);
            } else if(timeToSelect > -2 * a) {
                const t = (timeToSelect + a) / (-a);

                sizeModifier = 0.2 * (1 - easeInSine(t));
            } else {
                sizeModifier = 0;
            }
        } else if(animTime < 0.5) {
            sizeModifier = easeOutSine(2 * animTime);
        }

        const diceWidth = (1 + 0.2 * sizeModifier) * width,
              diceValue = (index < diceSelected ? diceValues[index] : diceRollingValues[index]),
              diceImage = getDiceImageFromValue(diceValue, diceWidth),
              diceHighlighted = (index < diceSelected && diceValue <= 3);

        paintDice(diceCtx, diceImage, diceWidth, (index + 0.5) * space, 1.5 * space, diceHighlighted);
    }

    diceCtx.textAlign = "center";
    diceCtx.textBaseline = "middle";
    diceCtx.shadowColor = rgb(0);
    diceCtx.shadowBlur = 10;

    if(active) {
        if(diceHovered) {
            diceCtx.fillStyle = "#ddbe8f";
        } else {
            diceCtx.fillStyle = "white";
        }
    } else {
        diceCtx.fillStyle = rgb(200);
    }

    diceCtx.font = (active && diceHovered ? (space * 0.6) + "px KorraFont" : (space * 0.5) + "px KorraFont");
    diceCtx.fillText("Roll", diceWidth / 2, 0.75 * space);

    const diceUpCount = (diceValues === null ? 0 : getDiceUp(diceValues.slice(0, diceSelected)));

    diceCtx.fillStyle = "white";
    diceCtx.font = (space * 0.8) + "px KorraFont";
    diceCtx.fillText("" + diceUpCount, diceWidth / 2, 2.3 * space);

    diceCtx.restore();
}

function getDiceImageFromValue(diceValue, width) {
    switch(diceValue) {
        case 1:
        case 2:
        case 3:
            return getImageResource("diceUp" + diceValue, width);
        case 4:
        case 5:
        case 6:
            return getImageResource("diceDown" + (diceValue - 3), width);
        default:
            return null;
    }
}

function getDiceUp(values) {
    if(values === undefined) {
        values = diceValues;
    }

    if(values === undefined || values === null)
        return 0;

    let diceUp = 0;

    for(let index = 0; index < values.length; ++index) {
        if(values[index] > 3)
            continue;

        diceUp += 1;
    }

    return diceUp;
}

function paintDice(ctx, diceImage, width, centreLeft, centreTop, lightShadow) {
    ctx.save();

    const shadow = getImageResource((lightShadow ? "diceLightShadow" : "diceDarkShadow"), width);

    ctx.drawImage(shadow, centreLeft - width / 2, centreTop - width / 2, width, width);
    ctx.drawImage(diceImage, centreLeft - width / 2, centreTop - width / 2, width, width);

    ctx.restore();
}



//
// NETWORK STATUS
//

const networkStatusElement = document.getElementById("network-status");

const networkStatus = {
    status: "",

    fade: createFade(1.0),

    dots: false,
    lastChange: 0
};

networkStatus.fadeIn = networkStatus.fade.fadeIn;
networkStatus.fadeOut = networkStatus.fade.fadeOut;

function setNetworkStatus(status, dots) {
    networkStatus.status = status;
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

function redrawNetworkStatus() {
    networkStatusElement.style.opacity = networkStatus.fade.get();

    let status = networkStatus.status;
    {
        const time = getTime() - networkStatus.lastChange;

        if(networkStatus.dots) {
            const dotCount = Math.floor((time * 3) % 3) + 1;

            for(let i=0; i < dotCount; ++i) {
                status += ".";
            }
        }
    }
    networkStatusElement.textContent = status;
}



//
// MESSAGES
//

const messageContainerElement = document.getElementById("message-container"),
      messageElement = document.getElementById("message");

const message = {
    fade: createFade(),

    message: "",
    fade: createFade(0)
};

const DEFAULT_MESSAGE_FADE_IN_DURATION  = 0.25,
      DEFAULT_MESSAGE_STAY_DURATION     = 1.5,
      DEFAULT_MESSAGE_FADE_OUT_DURATION = 0.25;

function setMessage(statusMessage, fadeInDuration, stayDuration, fadeOutDuration) {
    message.message = statusMessage;
    messageElement.textContent = statusMessage;

    fadeInDuration  = (fadeInDuration !== undefined  ? fadeInDuration  : DEFAULT_MESSAGE_FADE_IN_DURATION);
    stayDuration    = (stayDuration !== undefined    ? stayDuration    : DEFAULT_MESSAGE_STAY_DURATION);
    fadeOutDuration = (fadeOutDuration !== undefined ? fadeOutDuration : DEFAULT_MESSAGE_FADE_OUT_DURATION);

    message.fade = createStagedFade(fadeInDuration, stayDuration, fadeOutDuration);
}

function redrawMessage() {
    messageContainerElement.style.opacity = message.fade.get();
}


//
// GAME SETUP
//

let startTime = NaN;

let width = NaN,
    height = NaN,
    viewport = null,
    centreLeft = NaN,
    centreTop = NaN;

let mouseX = -1,
    mouseY = -1,
    hoveredTile = [-1, -1];

let mouseDown = false,
    mouseDownTime = LONG_TIME_AGO,
    mouseDownX = -1,
    mouseDownY = -1,
    draggedTile = [-1, -1];

function setupElements() {
    startTime = getTime();

    diceCanvas.addEventListener("click", onDiceClick);
    diceCanvas.addEventListener("mouseover", function() { diceHovered = true; });
    diceCanvas.addEventListener("mouseout",  function() { diceHovered = false; });

    function updateMouse(x, y, down) {
        mouseX = x;
        mouseY = y;
        hoveredTile = canvasToTile(x, y);

        if(down === undefined)
            return;

        if(down) {
            mouseDown = true;
            mouseDownTime = getTime();
            mouseDownX = x;
            mouseDownY = y;
            draggedTile = canvasToTile(x, y);
        } else {
            mouseDown = false;
            mouseDownTime = LONG_TIME_AGO;
            mouseDownX = -1;
            mouseDownY = -1;
            draggedTile = [-1, -1];
        }
    }

    window.onresize = function(event) {
        window.requestAnimationFrame(resize);
    };

    document.onmousemove = function(event) {
        updateMouse(event.clientX - tilesLeft, event.clientY - tilesTop);
    };

    document.body.onmousedown = function(event) {
        updateMouse(mouseX, mouseY, true);

        onTileClick(hoveredTile);

        event.preventDefault();
    };

    document.onmouseup = function(event) {
        onTileRelease(hoveredTile);

        updateMouse(mouseX, mouseY, false);
    }

    window.requestAnimationFrame(function() {
        resize();
        redraw();
    });
}

let fps_start = new Date().getTime(),
    fps_redraws = 0,
    fps = 0;

function updateFPS() {
    fps = Math.round(fps_redraws / (new Date().getTime() - fps_start) * 1000);
    fps_start = new Date().getTime();
    fps_redraws = 0;
}

function resetGame() {
    resetBoard();
    resetTiles();
    resetDice();
    resetScores();
    resetNetworkStatus();
}

function redraw() {
    ++fps_redraws;

    redrawTiles();
    redrawDice();
    redrawScores();
    redrawNetworkStatus();
    redrawMessage();

    window.requestAnimationFrame(redraw);
}

function resize() {
    viewport = document.body.getBoundingClientRect();
    centreLeft = Math.round((viewport.left + viewport.right) / 2);
    centreTop = Math.round((viewport.top + viewport.bottom) / 2);
    width = viewport.right - viewport.left;
    height = viewport.bottom - viewport.top;

    // RESIZE BOARD
    {
        boardHeight = height;
        boardWidth = Math.round(height / boardWidthToHeightRatio);
        boardLeft = centreLeft - Math.round(boardWidth / 2);
        boardTop = centreTop - Math.round(boardHeight / 2);

        boardCanvas.width = boardWidth;
        boardCanvas.height = boardHeight;
        boardCanvas.style.left = boardLeft + "px";
        boardCanvas.style.top = boardTop + "px";
        boardCanvas.style.display = "block";

        tilesHeight = boardHeight;
        tilesWidth = boardWidth * 1.5;
        tilesLeft = centreLeft - Math.round(tilesWidth / 2);
        tilesTop = centreTop - Math.round(tilesHeight / 2);
        tilesLeftOffset = Math.round((tilesWidth - boardWidth) / 2);

        tilesCanvas.width = tilesWidth;
        tilesCanvas.height = tilesHeight;
        tilesCanvas.style.left = tilesLeft + "px";
        tilesCanvas.style.top = tilesTop + "px";
        tilesCanvas.style.display = "block";
    }

    // RESIZE SCORE
    {
        const tileWidth = getTileWidth(),
              tileSpace = Math.round(tileWidth / tileWidthRatio);

        scoreWidth = 6 * tileWidth;
        scoreHeight = tileWidth;

        const tilesCountWidth = scoreWidth,
              tilesCountHeight = scoreHeight * 2;

        const verticalPadding = Math.round(yBorderRatio * boardHeight),
              tilesCountTop = boardTop + verticalPadding,
              scoreTop = boardTop + boardHeight - scoreHeight - verticalPadding;
              p1Left = boardLeft - scoreWidth,
              p2Left = boardLeft + boardWidth;

        const leftTiles = leftPlayerRenderTarget.tilesCanvas,
              leftScore = leftPlayerRenderTarget.scoreCanvas,
              rightTiles = rightPlayerRenderTarget.tilesCanvas,
              rightScore = rightPlayerRenderTarget.scoreCanvas;

        leftTiles.width = tilesCountWidth;
        leftTiles.height = tilesCountHeight;
        leftTiles.style.top = tilesCountTop + "px";
        leftTiles.style.left = p1Left + "px";
        leftTiles.style.display = "block";

        rightTiles.width = tilesCountWidth;
        rightTiles.height = tilesCountHeight;
        rightTiles.style.top = tilesCountTop + "px";
        rightTiles.style.left = p2Left + "px";
        rightTiles.style.display = "block";

        leftScore.width = scoreWidth;
        leftScore.height = scoreHeight;
        leftScore.style.top = scoreTop + "px";
        leftScore.style.left = p1Left + "px";
        leftScore.style.display = "block";

        rightScore.width = scoreWidth;
        rightScore.height = scoreHeight;
        rightScore.style.top = scoreTop + "px";
        rightScore.style.left = p2Left + "px";
        rightScore.style.display = "block";
    }

    // RESIZE DICE
    {
        const space = Math.round(getTileWidth() / diceWidthRatio);

        diceWidth = 4 * space;
        diceHeight = 3 * space;

        diceCanvas.width = diceWidth;
        diceCanvas.height = diceHeight;
        diceCanvas.style.display = "block";

        layoutDice();
    }

    redraw();
    redrawBoard();
}
