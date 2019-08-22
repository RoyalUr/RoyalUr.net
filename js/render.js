//
// LOADING SCREEN
//

const loadingDiv = document.getElementById("loading"),
      loadingFade = createFade(0.5).visible();

function redrawLoading() {
    const opacity = loadingFade.get();
    loadingDiv.style.opacity = opacity;
    loadingDiv.style.display = (opacity === 0 ? "none" : "")
}



//
// MENU
//

const menuDiv = document.getElementById("menu"),
      playButton = document.getElementById("play"),
      learnButton = document.getElementById("learn"),
      exitButton = document.getElementById("exit");

function redrawMenu() {
    menuDiv.style.opacity = screenState.menuFade.get();
    exitButton.style.opacity = screenState.exitFade.get();
    networkStatus.hidden = false;

    if (isOnScreen(SCREEN_CONNECTING)) {
        if (networkStatus.connected) {
            setMessageAndFade("Searching for a Game" + createDots(), screenState.connectionFade);
        } else {
            networkStatus.hidden = true;
            setMessageAndFade(getNetworkStatus(), screenState.connectionFade);
        }
    }

    const boardFade = screenState.boardFade.get(),
          one = clamp(boardFade * 2, 0, 1),
          two = clamp(boardFade * 2 - 1, 0, 1);

    boardCanvas.style.opacity = one;
    tilesCanvas.style.opacity = one;
    diceCanvas.style.opacity = two;
    leftPlayerRenderTarget.scoreCanvas.style.opacity = two;
    leftPlayerRenderTarget.tilesCanvas.style.opacity = two;
    rightPlayerRenderTarget.scoreCanvas.style.opacity = two;
    rightPlayerRenderTarget.tilesCanvas.style.opacity = two;
}



//
// BOARD
//

const boardCanvas = document.getElementById("board"),
      boardCtx = boardCanvas.getContext("2d"),
      boardPadding = 30;

let boardCanvasWidth = NaN,
    boardCanvasHeight = NaN,
    boardCanvasLeft = NaN,
    boardCanvasTop = NaN,
    boardX = NaN,
    boardY = NaN,
    boardWidth = NaN,
    boardHeight = NaN;

const tileWidthRatio = 0.75;

let boardWithToHeightRatio = null,
    boardTileRegions = null,
    boardTilePositions = null,
    tileWidth = null;

function resizeBoard() {
    boardX = boardPadding;
    boardY = boardPadding;
    boardWidth = boardCanvasWidth - 2 * boardPadding;
    boardHeight = boardCanvasHeight - 2 * boardPadding;
}

/**
 * Called to redraw the board.
 */
function redrawBoard() {
    const ctx = boardCtx;

    ctx.shadowColor = 'black';
    ctx.shadowBlur = 30;

    ctx.clearRect(0, 0, boardCanvasWidth, boardCanvasHeight);
    ctx.drawImage(getImageResource("board", boardCanvasWidth), boardX, boardY, boardWidth, boardHeight);
}

function getTileWidth() {
    if (isNaN(boardCanvasWidth))
        return 1;
    if (tileWidth)
        return Math.round(tileWidth * boardWidth);

    const regions = getBoardTileRegions();

    let cumulativeTileWidth = 0,
        tilesRecordedCount = 0;

    for (let x = 0; x < TILES_WIDTH; ++x) {
        for (let y = 0; y < TILES_HEIGHT; ++y) {
            if (!isTileOnBoard(x, y))
                continue;

            cumulativeTileWidth += regions[x + y * TILES_WIDTH][2];
            tilesRecordedCount += 1;
        }
    }

    tileWidth = tileWidthRatio * cumulativeTileWidth / tilesRecordedCount;

    return Math.round(tileWidth * boardWidth);
}

function getBoardWidthToHeightRatio() {
    if (boardWithToHeightRatio)
        return boardWithToHeightRatio;

    const boardImage = getRawImageResource("board");
    if (!boardImage)
        throw "Missing board image";

    boardWithToHeightRatio = boardImage.height / boardImage.width;
}

/**
 * @returns An array of length 4 arrays representing the [x, y, width, height] regions of
 *          each tile as a percentage across the board image in the range [0, 1].
 */
function getBoardTileRegions() {
    if (boardTileRegions)
        return boardTileRegions;

    const boardImage = getRawImageResource("board"),
          tileRegions = getImageAnnotation("board");

    if (!boardImage)
        throw "Missing board image";
    if (!tileRegions)
        throw "Missing board tile annotations";
    if (tileRegions.length !== TILES_COUNT)
        throw "Invalid board tile annotations : invalid length, expected " + TILES_COUNT + ", received " + tileRegions.length;

    const boardImgWidth = boardImage.width,
          boardImgHeight = boardImage.height;

    boardTileRegions = [];

    for (let index = 0; index < tileRegions.length; ++index) {
        const region = tileRegions[index],
            x = region[0],
            y = region[1],
            width = region[2],
            height = region[3];

        boardTileRegions.push([
            x / boardImgWidth,
            y / boardImgHeight,
            width / boardImgWidth,
            height / boardImgHeight
        ]);
    }

    return boardTileRegions;
}

/**
 * @returns An array of length 2 arrays representing the [x, y] positions of
 *          each tile as a percentage across the board image in the range [0, 1].
 */
function getBoardTilePositions() {
    if (boardTilePositions)
        return boardTilePositions;

    const tileRegions = getBoardTileRegions();

    boardTilePositions = [];

    for (let index = 0; index < tileRegions.length; ++index) {
        const region = tileRegions[index],
              x = region[0],
              y = region[1],
              width = region[2],
              height = region[3];

        boardTilePositions.push([
            x + width / 2,
            y + height / 2
        ]);
    }

    return boardTilePositions;
}

function tileToCanvas(x, y) {
    if(y === undefined) {
        y = x[1];
        x = x[0];
    }

    // If we're flipping the board
    if(ownPlayer === darkPlayer) {
        x = TILES_WIDTH - x - 1;
    }

    if (x < 0 || y < 0 || x >= TILES_WIDTH || y >= TILES_HEIGHT)
        return null;

    const tilesXOffset = boardX + (tilesWidth - boardCanvasWidth) / 2,
          tilesYOffset = boardY,
          tilePositions = getBoardTilePositions(),
          index = x + y * TILES_WIDTH;

    const position = tilePositions[index],
          canvas_x = position[0] * boardWidth + tilesXOffset,
          canvas_y = position[1] * boardHeight + tilesYOffset;

    return [canvas_x, canvas_y];
}

function canvasToTile(x, y) {
    if(y === undefined) {
        y = x[1];
        x = x[0];
    }

    // The tiles canvas is bigger than the board canvas
    x -= (tilesWidth - boardCanvasWidth) / 2;

    x -= boardX;
    y -= boardY;

    let prop_x = x / boardWidth,
        prop_y = y / boardHeight;

    if (prop_x < 0 || prop_x >= 1 || prop_y < 0 || prop_y >= 1)
        return [-1, -1];

    if (ownPlayer === darkPlayer) {
        prop_x = 1 - prop_x;
    }

    let closest_index = -1,
        closest_dist = -1;

    const tilePositions = getBoardTilePositions();

    for (let index = 0; index < tilePositions.length; ++index) {
        const pos = tilePositions[index],
              pos_x = pos[0],
              pos_y = pos[1],
              dx = pos_x - prop_x,
              dy = pos_y - prop_y,
              dist_sq = dx*dx + dy*dy;

        if (closest_index === -1 || dist_sq < closest_dist) {
            closest_index = index;
            closest_dist = dist_sq;
        }
    }

    return [
        closest_index % TILES_WIDTH,
        Math.floor(closest_index / TILES_WIDTH)
    ];
}



//
// TILES
//

const tilesCanvas = document.getElementById("tiles"),
      tilesCtx = tilesCanvas.getContext("2d");

let tilesWidth = NaN,
    tilesHeight = NaN,
    tilesLeft = NaN,
    tilesTop = NaN,
    tilesLeftOffset = NaN;

const hoverWidthRatio = 1.1,
      shadowWidthRatio = hoverWidthRatio * 1.05;

let tilePathAnchorTime = 0,
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

let lastTilesWidth = NaN;

function redrawTiles() {
    // Avoid redrawing if we don't have to
    if (!isOnScreen(SCREEN_GAME) && lastTilesWidth === tilesWidth)
        return;
    lastTilesWidth = tilesWidth;

    const ctx = tilesCtx;

    ctx.clearRect(0, 0, tilesWidth, tilesHeight);

    const width = getTileWidth(),
          path = getTilePath(),
          diceValue = countDiceUp();

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

            const hovered = locEquals([x, y], hoveredTile),
                  selected = isTileSelected(x, y),
                  tileWidth = width * (hovered ? hoverWidthRatio : 1),
                  shadowColour = (selected ? 255 : 0);

            renderTile(ctx, [x, y], tileWidth, tileWidth, tiles[x][y], shadowColour);
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
        ctx.lineDashOffset = (-0.75) * width * timeMouseDown + (-0.3) * width * (time - timeMouseDown) + (-0.5) * locDistance(mouseX, mouseY, mouseDownX, mouseDownY);
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

        ctx.moveTo(end[0] - crossSize, end[1] - crossSize);
        ctx.lineTo(end[0] + crossSize, end[1] + crossSize);

        ctx.moveTo(end[0] - crossSize, end[1] + crossSize);
        ctx.lineTo(end[0] + crossSize, end[1] - crossSize);

        ctx.stroke();
    }

    ctx.restore();

    const endHovered = locEquals(hoveredTile, to),
          tileHoverWidth = width * hoverWidthRatio,
          cyclicWidthMul = 1 + 0.03 * Math.cos(5 * time),
          tileCyclicWidth = tileHoverWidth * cyclicWidthMul;

    if(getTile(to) !== TILE_EMPTY) {
        const tileWidth = (isValidMove ? tileCyclicWidth : tileHoverWidth);
        renderTile(ctx, to, tileWidth, tileWidth, getTile(to), (endHovered ? 255 : 0));
    } else if(isValidMove) {
        renderTile(ctx, to, tileCyclicWidth, tileCyclicWidth, owner, (endHovered ? 255 : 0));
    }

    if(!isTileSelected(draggedTile)) {
        renderTile(ctx, pathTile, tileHoverWidth, tileHoverWidth, owner, (isTileSelected(pathTile) ? 255 : 0));
    } else {
        const fromCanvas = tileToCanvas(pathTile),
              location = locAdd(fromCanvas, [mouseX - mouseDownX, mouseY - mouseDownY]);

        location[0] = clamp(location[0], width, tilesWidth - width);
        location[1] = clamp(location[1], width, tilesHeight - width);

        const draggedOnBoard = isTileOnBoard(canvasToTile(mouseX, mouseY)),
              draggedWidth = width * (draggedOnBoard ? hoverWidthRatio : 1),
              draggedShadowWidth = width * (draggedOnBoard ? shadowWidthRatio : 1);

        paintTile(ctx, location[0], location[1], draggedWidth, draggedShadowWidth, owner, 255);
    }
}

function getTileImage(owner, width) {
    if(owner === TILE_DARK) return getImageResource("darkTile", width);
    if(owner === TILE_LIGHT)  return getImageResource("lightTile", width);
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

let scoreWidth = NaN,
    scoreHeight = NaN;

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
        scoreCtx: scoreCtx,

        renderedNameString: null,
        renderedIdleName: null,
        renderedActiveName: null
    };
}

function getPlayerRenderTarget(player) {
    return (player === ownPlayer ? leftPlayerRenderTarget : rightPlayerRenderTarget);
}

function drawName(player, isActive) {
    return renderResource(scoreWidth, scoreHeight, function(ctx) {
        // Render the text on another canvas, and then onto this one so that the alpha stacks correctly
        const text = renderResource(scoreWidth, scoreHeight, function(ctx) {
            const tileWidth = getTileWidth(),
                  offset = 0.01 * tileWidth;

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = Math.round(tileWidth * 0.75) + "px DuranGo";

            if (isActive) {
                // ctx.shadowBlur = 5;
                // ctx.shadowColor = rgb(255, 255, 255);
                ctx.save();
                ctx.shadowBlur = 5;
                ctx.shadowColor = rgba(255, 255, 255, 0.7);
                ctx.fillText(player.name, scoreWidth / 2, 0.5 * tileWidth);
                ctx.restore();
            }

            // ctx.fillStyle = rgba(255, 255, 255, 0.3);
            // ctx.fillText(player.name, scoreWidth / 2, 0.5 * tileWidth + offset);
            //
            // ctx.fillStyle = rgba(0, 0, 0, 0.7);
            // ctx.fillText(player.name, scoreWidth / 2, 0.5 * tileWidth - offset);

            ctx.fillStyle = rgb(255);
            ctx.fillText(player.name, scoreWidth / 2, 0.5 * tileWidth);
        });

        ctx.globalAlpha = (isActive ? 1.0 : 0.8);
        ctx.drawImage(text, 0, 0);
    });
}

function getRenderedPlayerName(player) {
    const renderTarget = getPlayerRenderTarget(player);

    if(renderTarget.renderedIdleName === null || renderTarget.renderedActiveName === null
        || scoreWidth !== renderTarget.renderedIdleName.width || player.name !== renderTarget.renderedNameString) {

        renderTarget.renderedIdleName = drawName(player, false);
        renderTarget.renderedActiveName = drawName(player, true);
        renderTarget.renderedNameString = player.name;
    }

    return (player.active ? renderTarget.renderedActiveName : renderTarget.renderedIdleName);
}

function redrawPlayerScores(player, tilesLeft, scoreLeft) {
    const tileWidth = getTileWidth(),
          tilePaintWidth = tileWidth * scoreTileRatio;

    function drawTiles(ctx, owner, left, top, tileCount, highlightStartTile) {
        ctx.clearRect(0, 0, scoreWidth, scoreHeight * 2);
        for(let index = 0; index < tileCount; ++index) {
            const tileLeft = left + (index + 0.5) * tileWidth,
                  shadowShade = (highlightStartTile && index === 0 ? 255 : 0);

            paintTile(ctx, tileLeft, top, tilePaintWidth, tilePaintWidth, owner, shadowShade);
        }
    }

    const renderTarget = getPlayerRenderTarget(player),
          tilesCtx = renderTarget.tilesCtx,
          scoreCtx = renderTarget.scoreCtx,
          startTile = getStartTile();

    const highlightStartTile = (
        player === ownPlayer && ownPlayer.active && isValidMoveFrom(startTile) && !dice.rolling
        && (locEquals(startTile, hoveredTile) || (isTileSelected(startTile) && !isValidMoveFrom(hoveredTile)))
    );

    drawTiles(
        tilesCtx, player.playerNo, tilesLeft, tileWidth * 1.5,
        player.tiles.current, highlightStartTile,
    );
    drawTiles(
        scoreCtx, player.playerNo, scoreLeft, tileWidth * 0.5,
        player.score.current, false
    );

    tilesCtx.drawImage(getRenderedPlayerName(player), 0, 0);
}

let lastScoresWidth = NaN;

function redrawScores() {
    // Avoid redrawing if we don't have to
    if (!isOnScreen(SCREEN_GAME) && lastScoresWidth === scoreWidth)
        return;
    lastScoresWidth = scoreWidth;

    const tileWidth = getTileWidth(),
          p1TilesLeft = (7 - ownPlayer.tiles.current) * tileWidth,
          p1ScoreLeft = (7 - ownPlayer.score.current) * tileWidth;

    redrawPlayerScores(ownPlayer, p1TilesLeft, p1ScoreLeft);
    redrawPlayerScores(otherPlayer, 0, 0);
}



//
// DICE
//

/**
 * The time between changing the value of the rolling dice.
 */
const ROLLING_DICE_CHANGE_INTERVAL = 0.1;

/**
 * The time taken to select all dice.
 */
const DICE_SELECT_DURATION = 1;

/**
 * The time it takes for the dice to hit the ground after falling from being rolled.
 */
const DICE_FALL_DURATION = 0.15;


const diceCanvas = document.getElementById("dice"),
      diceCtx = diceCanvas.getContext("2d");

const diceWidthRatio = 1.4;

let diceLeft = NaN,
    diceTop = NaN,
    diceWidth = NaN,
    diceHeight = NaN;

const lastDice = [0, 0, 0, 0],
      diceDown = [true, true, true, true];

let diceHovered = false,
    lastDiceSound = 0,
    lastDiceSelected = 0;

function layoutDice() {
    if(ownPlayer.active) {
        diceLeft = boardCanvasLeft - diceWidth;
    } else {
        diceLeft = boardCanvasLeft + boardCanvasWidth;
    }

    diceTop = centreTop - diceHeight / 2;

    diceCanvas.style.top = diceTop + "px";
    diceCanvas.style.left = diceLeft + "px";
}

let lastDiceWidth = NaN;

function redrawDice() {
    // Avoid redrawing if we don't have to
    if (!isOnScreen(SCREEN_GAME) && lastDiceWidth === diceWidth)
        return;
    lastDiceWidth = diceWidth;

    const canBeRolled = (dice.active && !dice.rolling && ownPlayer.active);

    if(canBeRolled) {
        diceCanvas.style.cursor = "pointer";
    } else {
        diceCanvas.style.cursor = "";
    }

    diceCtx.save();

    let time = getTime(),
        animTime = time - dice.rollStartTime,
        selectTime = time - dice.selectTime,
        rollingChangeTime = time - dice.rollingValuesChangeTime;

    // If we haven't received dice values yet, just keep waiting before selecting them
    if(dice.values === null && selectTime > 0) {
        dice.selectTime = dice.rollingValuesChangeTime + ROLLING_DICE_CHANGE_INTERVAL;
        dice.selected = 0;
        selectTime = 0;
    }

    // Update the values of the rolling dice, and check whether to select any dice
    if(dice.rollingValues === null || (dice.rolling && rollingChangeTime > ROLLING_DICE_CHANGE_INTERVAL)) {
        randomiseRollingDice();

        dice.selected = clamp(Math.floor(4 * selectTime / DICE_SELECT_DURATION), 0, 4);

        // If we've selected another dice that's up, play a sound
        if(lastDiceSelected !== dice.selected) {
            lastDiceSelected = dice.selected;
            if(dice.rolling && dice.selected > 0 && isDiceUp(dice.values[dice.selected - 1])) {
                playSound("dice_select");
            }
        }

        // If we've selected all the dice
        if(dice.selected === 4) {
            dice.rolling = false;
            dice.callback();
        }
    }

    const space = getTileWidth() * diceWidthRatio,
          width = space * 0.9;

    diceCtx.clearRect(0, 0, diceWidth, diceHeight);

    for(let index = 0; index < 4; ++index) {
        const timeToSelect = (0.5 + index * 0.25) - selectTime + 0.25;

        let sizeModifier = (dice.rolling ? 1 : 0),
            down = false;
        
        if(timeToSelect > 0 && timeToSelect < 0.5) {
            const t = 1 - 2 * timeToSelect;

            sizeModifier = 1 - easeInSine(t);
        } else if(timeToSelect <= 0) {
            down = true;

            if(timeToSelect > -DICE_FALL_DURATION) {
                const t = timeToSelect / (-DICE_FALL_DURATION);

                sizeModifier = 0.2 * easeOutSine(t);
            } else if(timeToSelect > -2 * DICE_FALL_DURATION) {
                const t = (timeToSelect + DICE_FALL_DURATION) / (-DICE_FALL_DURATION);

                sizeModifier = 0.2 * (1 - easeInSine(t));
            } else {
                sizeModifier = 0;
            }
        } else if(animTime < 0.5) {
            sizeModifier = easeOutSine(2 * animTime);
        }
        
        const diceWidth = (1 + 0.2 * sizeModifier) * width,
              diceIsSelected = (index < dice.selected),
              diceValue = (diceIsSelected ? dice.values[index] : dice.rollingValues[index]),
              diceImage = getDiceImageFromValue(diceValue, diceWidth),
              diceHighlighted = (diceIsSelected && isDiceUp(diceValue));

        // Play a sound to indicate the dice has hit the ground
        if(down && !diceDown[index] && timeToSelect >= -2 * DICE_FALL_DURATION) {
            playSound("dice_hit");
        }
        diceDown[index] = down;
        
        if(diceValue !== lastDice[index] && (time - lastDiceSound) > 0.1) {
            lastDice[index] = diceValue;
            lastDiceSound = time;

            if (dice.rolling || (timeToSelect >= -DICE_FALL_DURATION && timeToSelect <= DICE_FALL_DURATION)) {
                playSound("dice_click");
            }
        }
        
        paintDice(diceCtx, diceImage, diceWidth, (index + 0.5) * space, 1.5 * space, diceHighlighted);
    }

    diceCtx.textAlign = "center";
    diceCtx.textBaseline = "middle";
    diceCtx.shadowColor = rgb(0);
    diceCtx.shadowBlur = 10;

    if(canBeRolled) {
        if(diceHovered) {
            diceCtx.fillStyle = "#ddbe8f";
        } else {
            diceCtx.fillStyle = "white";
        }
    } else {
        diceCtx.fillStyle = rgb(200);
    }

    diceCtx.font = (canBeRolled && diceHovered ? (space * 0.6) + "px DuranGo" : (space * 0.5) + "px DuranGo");
    diceCtx.fillText("Roll", diceWidth / 2, 0.75 * space);

    const diceUpCount = (dice.values === null ? 0 : countDiceUp(dice.values.slice(0, dice.selected)));

    diceCtx.fillStyle = "white";
    diceCtx.font = (space * 0.8) + "px DuranGo";
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

function redrawNetworkStatus() {
    networkStatusElement.style.display = (networkStatus.hidden ? "none" : "block");
    networkStatusElement.style.opacity = networkStatus.fade.get();
    networkStatusElement.textContent = getNetworkStatus();
}



//
// MESSAGES
//

const messageContainerElement = document.getElementById("message-container"),
      messageElement = document.getElementById("message");

function redrawMessage() {
    let messageText = message.text;

    if (message.typewriter) {
        const percentPerKey = 1 / messageText.length;

        const percentUnclamped = (getTime() - message.text_set_time) / message.typewriter,
              percent = clamp(percentUnclamped, 0, 1);

        const characters = Math.floor(percent * messageText.length);

        if (characters !== message.typewriter_last_length) {
            message.typewriter_last_length = characters;

            if (characters === messageText.length) {
                // If the tab has been closed/reopened we don't want to play the 'ding'
                if (percentUnclamped < 1 + 2 * percentPerKey) {
                    playSound("typewriter_end");
                }

                message.typewriter_last_length = 0;
                message.typewriter = 0;
            } else if (messageText[characters - 1] !== ' ') {
                playSound("typewriter_key");
            }
        }

        messageText = messageText.substr(0, characters);
    }

    messageElement.textContent = messageText;
    messageContainerElement.style.opacity = message.fade.get();
}



//
// OVERLAY
//

const overlayCanvas = document.getElementById("overlay"),
      overlayCtx = overlayCanvas.getContext("2d");

let overlayWidth = NaN,
    overlayHeight = NaN;

function redrawOverlay() {
    // If we don't have to draw to the canvas, just don't display it at all
    if (fireworks.length === 0 && particleBirthTime.length === 0) {
        overlayCanvas.style.display = "none";
        return;
    } else {
        overlayCanvas.style.display = "";
    }

    overlayCtx.clearRect(0, 0, overlayWidth, overlayHeight);

    simulateFireworks();
    simulateParticles();
    drawParticles(overlayCtx);
}

function resizeOverlay() {
    overlayWidth = Math.round(width / 3);
    overlayHeight = Math.round(height / 3);

    overlayCanvas.width = overlayWidth;
    overlayCanvas.height = overlayHeight;

    redrawOverlay();
}



//
// WIN SCREEN
//

const MIN_WIN_FIREWORK_PERIOD = 2.0,
      MAX_WIN_FIREWORK_PERIOD = 4.0,
      WIN_FIREWORK_REGIONS = [
          {"min_x": 0.15, "max_x": 0.35, "min_y": 0.15, "max_y": 0.5},
          {"min_x": 0.65, "max_x": 0.85, "min_y": 0.15, "max_y": 0.5}
      ],
      WIN_FIREWORK_SPEED = 300;

const nextFireworkTimes = []; {
    for (let index = 0; index < WIN_FIREWORK_REGIONS.length; ++index) {
        nextFireworkTimes.push(0);
    }
}

function redrawWinScreen() {
    if (isOnScreen(SCREEN_WIN)) {
        spawnWinFireworks();
    }
}

function spawnWinFireworks() {
    for (let index = 0; index < WIN_FIREWORK_REGIONS.length; ++index) {
        const timeToFirework = nextFireworkTimes[index] - getTime();

        if (timeToFirework > 0)
            continue;

        const timeToNext = rand(MIN_WIN_FIREWORK_PERIOD, MAX_WIN_FIREWORK_PERIOD);
        nextFireworkTimes[index] = getTime() + timeToNext;

        const region = WIN_FIREWORK_REGIONS[index],
              x1 = overlayWidth * rand(region.min_x, region.max_x),
              y1 = overlayHeight,
              x2 = overlayWidth * rand(region.min_x, region.max_x),
              y2 = overlayHeight * rand(region.min_y, region.max_y);

        // We want to cut out hues from 0.61 to 0.78 as they are too dark
        let hue = rand(1 - (0.78 - 0.61));
        hue = (hue <= 0.61 ? hue : hue + (0.78 - 0.61));
        const colour = convertHSVtoRGB(hue, 1, 1);

        createFirework(x1, y1, x2, y2, WIN_FIREWORK_SPEED, colour.r, colour.g, colour.b);
    }
}



//
// PARTICLES
//

const MAX_DT = 0.1;

let particlesLastSimTime = 0;
const particleBirthTime = [],
      particleLifetime = [],
      particleRadius = [],
      particleX = [],
      particleY = [],
      particleVX = [],
      particleVY = [],
      particleAX = [],
      particleAY = [],
      particleR = [],
      particleG = [],
      particleB = [];

function addParticle(lifetime, radius, x, y, vx, vy, ax, ay, r, g, b) {
    particleBirthTime.push(getTime());
    particleLifetime.push(lifetime);
    particleRadius.push(radius);
    particleX.push(x);
    particleY.push(y);
    particleVX.push(vx);
    particleVY.push(vy);
    particleAX.push(ax);
    particleAY.push(ay);
    particleR.push(r);
    particleG.push(g);
    particleB.push(b);
}

function createParticleExplosion(particleCount, x, y, speed, lifetime, red, green, blue, sphere, gravity) {
    for (let index=0; index < particleCount; ++index) {
        const angle = (index + Math.random()) * 360 / particleCount,
              vl = speed * (sphere ? Math.sqrt(Math.random()) : Math.random()),
              vx = Math.cos(angle) * vl,
              vy = Math.sin(angle) * vl;

        addParticle(lifetime * (0.6 * rand() + 0.7) , 1, x, y, vx, vy, 0, (gravity ? 200 : 0), red, green, blue);
    }
}

function removeParticle(index) {
    particleBirthTime.splice(index, 1);
    particleLifetime.splice(index, 1);
    particleRadius.splice(index, 1);
    particleX.splice(index, 1);
    particleY.splice(index, 1);
    particleVX.splice(index, 1);
    particleVY.splice(index, 1);
    particleAX.splice(index, 1);
    particleAY.splice(index, 1);
    particleR.splice(index, 1);
    particleG.splice(index, 1);
    particleB.splice(index, 1);
}

function simulateParticles() {
    const time = getTime(),
          dt = min(MAX_DT, time - particlesLastSimTime);

    particlesLastSimTime = time;

    let removed = 0;

    let index = particleBirthTime.length;
    while (index > 0) {
        index -= 1;

        const age = (time - particleBirthTime[index]) / particleLifetime[index];
        if (age >= 1) {
            removed += 1;
            removeParticle(index);
            continue;
        }

        particleX[index] = particleX[index] + dt * particleVX[index];
        particleY[index] = particleY[index] + dt * particleVY[index];
        particleVX[index] =  particleVX[index] + dt * particleAX[index];
        particleVY[index] = particleVY[index] + dt * particleAY[index];
    }
}

function drawParticles(ctx) {
    const time = getTime();

    for (let index = 0; index < particleBirthTime.length; ++index) {
        const age = (time - particleBirthTime[index]) / particleLifetime[index],
              x = particleX[index],
              y = particleY[index],
              radius = particleRadius[index],
              red = particleR[index],
              green = particleG[index],
              blue = particleB[index];

        if (age > 1)
            continue;

        const alpha = (0.25 * Math.cos(12 * Math.PI * age * age * age * age) + 0.75) * Math.sqrt(1 - age);

        ctx.fillStyle = rgba(red, green, blue, alpha);
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
}



//
// FIREWORKS
//

let fireworksLastSimTime = 0,
    fireworks = [];

function createFirework(x1, y1, x2, y2, speed, r, g, b) {
    const dx = x2 - x1,
        dy = y2 - y1,
        dl = Math.sqrt(dx*dx + dy*dy);

    fireworks.push({
        createTime: getTime(),
        lifetime: dl / speed,
        x: x1,
        y: y1,
        dx: x2 - x1,
        dy: y2 - y1,
        r: r,
        g: g,
        b: b,
        rocket_sound: playSound("firework_rocket")
    });
}

function removeFirework(index) {
    fireworks.splice(index, 1);
}

function simulateFireworks() {
    const time = getTime();

    let index = fireworks.length;
    while (index > 0) {
        index -= 1;

        const firework = fireworks[index],
            age = (time - firework.createTime) / firework.lifetime,
            effectiveAge = min(1, age),
            lastAge = max(0, (fireworksLastSimTime - firework.createTime) / firework.lifetime),
            x = firework.x + effectiveAge * firework.dx,
            y = firework.y + effectiveAge * firework.dy,
            dx = (effectiveAge - lastAge) * firework.dx,
            dy = (effectiveAge - lastAge) * firework.dy,
            dl = Math.sqrt(dx*dx + dy*dy);

        if (age > 1) {
            playSound("firework_explode");
            if (firework.rocket_sound && isAudioPlaying(firework.rocket_sound)) {
                firework.rocket_sound.pause();
                firework.rocket_sound.currentTime = 0;
            }

            createParticleExplosion(
                360, x, y,
                120, 1,
                firework.r, firework.g, firework.b,
                true, true
            );
            removeFirework(index);
            continue;
        }

        for (let index = dl - 1; index >= 0; --index) {
            const prop = index / dl;
            createParticleExplosion(
                2, x - prop * dx, y - prop * dy,
                30, 0.5,
                255, 255, 255,
                false, false
            );
        }
    }

    fireworksLastSimTime = time;
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

    playButton.addEventListener("click", onPlayClick);
    exitButton.addEventListener("click", onExitClick);

    diceCanvas.addEventListener("click", onDiceClick);
    diceCanvas.addEventListener("mouseover", function() { diceHovered = true; });
    diceCanvas.addEventListener("mouseout",  function() { diceHovered = false; });

    function updateMouse(x, y, down) {
        mouseX = x;
        mouseY = y;
        
        const newHoveredTile = canvasToTile(x, y);
        if(!locEquals(hoveredTile, newHoveredTile)) {
            onTileHover(newHoveredTile);
        }
        hoveredTile = newHoveredTile;

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
    };

    window.requestAnimationFrame(function() {
        resize();
        redraw();
    });
    
    addTwitterButton();
    resize();
}

function addTwitterButton() {
    document.getElementById("twitter-button").innerHTML = '<a class="twitter-follow-button" href="https://twitter.com/soth_dev" data-show-count="false"></a><script async src="http://platform.twitter.com/widgets.js" charset="utf-8"></script>';
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
    resetTiles();
    resetDice();
    resetNetworkStatus();
}

function updateElementVisibilities(elements) {
    for (let index = 0; index < elements.length; ++index) {
        let element = elements[index];

        if (element.style.opacity === "0") {
            element.style.display = "none";
        } else {
            element.style.display = "block";
        }
    }
}

function redraw() {
    ++fps_redraws;

    redrawLoading();
    redrawMenu();
    redrawTiles();
    redrawDice();
    redrawScores();
    redrawNetworkStatus();
    redrawMessage();
    redrawWinScreen();
    redrawOverlay();

    updateElementVisibilities([
        menuDiv, boardCanvas, tilesCanvas, exitButton,
        leftPlayerRenderTarget.tilesCanvas,
        leftPlayerRenderTarget.scoreCanvas,
        rightPlayerRenderTarget.tilesCanvas,
        rightPlayerRenderTarget.scoreCanvas
    ]);

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
        boardCanvasHeight = height;
        boardCanvasWidth = Math.round((height - 2 * boardPadding) / getBoardWidthToHeightRatio()) + 2 * boardPadding;
        boardCanvasLeft = centreLeft - Math.round(boardCanvasWidth / 2);
        boardCanvasTop = centreTop - Math.round(boardCanvasHeight / 2);

        boardCanvas.width = boardCanvasWidth;
        boardCanvas.height = boardCanvasHeight;
        boardCanvas.style.left = boardCanvasLeft + "px";
        boardCanvas.style.top = boardCanvasTop + "px";

        tilesHeight = boardCanvasHeight;
        tilesWidth = boardCanvasWidth * 1.5;
        tilesLeft = centreLeft - Math.round(tilesWidth / 2);
        tilesTop = centreTop - Math.round(tilesHeight / 2);
        tilesLeftOffset = Math.round((tilesWidth - boardCanvasWidth) / 2);

        tilesCanvas.width = tilesWidth;
        tilesCanvas.height = tilesHeight;
        tilesCanvas.style.left = tilesLeft + "px";
        tilesCanvas.style.top = tilesTop + "px";

        resizeBoard();
    }

    // RESIZE SCORE
    {
        const tileWidth = getTileWidth();

        scoreWidth = 7 * tileWidth;
        scoreHeight = tileWidth;

        const tilesCountWidth = scoreWidth,
              tilesCountHeight = scoreHeight * 2;

        const verticalPadding = Math.round(0.05 * boardCanvasHeight),
              tilesCountTop = boardCanvasTop + verticalPadding,
              scoreTop = boardCanvasTop + boardCanvasHeight - scoreHeight - verticalPadding,
              p1Left = boardCanvasLeft - scoreWidth,
              p2Left = boardCanvasLeft + boardCanvasWidth;

        const leftTiles = leftPlayerRenderTarget.tilesCanvas,
              leftScore = leftPlayerRenderTarget.scoreCanvas,
              rightTiles = rightPlayerRenderTarget.tilesCanvas,
              rightScore = rightPlayerRenderTarget.scoreCanvas;

        leftTiles.width = tilesCountWidth;
        leftTiles.height = tilesCountHeight;
        leftTiles.style.top = tilesCountTop + "px";
        leftTiles.style.left = p1Left + "px";

        rightTiles.width = tilesCountWidth;
        rightTiles.height = tilesCountHeight;
        rightTiles.style.top = tilesCountTop + "px";
        rightTiles.style.left = p2Left + "px";

        leftScore.width = scoreWidth;
        leftScore.height = scoreHeight;
        leftScore.style.top = scoreTop + "px";
        leftScore.style.left = p1Left + "px";

        rightScore.width = scoreWidth;
        rightScore.height = scoreHeight;
        rightScore.style.top = scoreTop + "px";
        rightScore.style.left = p2Left + "px";
    }

    // RESIZE DICE
    {
        const space = Math.round(getTileWidth() * diceWidthRatio);

        diceWidth = 4 * space;
        diceHeight = 3 * space;

        diceCanvas.width = diceWidth;
        diceCanvas.height = diceHeight;

        layoutDice();
    }

    resizeOverlay();
    redrawBoard();
}
