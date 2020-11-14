//
// This file stores all rendering logic for the game.
//

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

function redrawLoop() {
    redraw(false);
    window.requestAnimationFrame(redrawLoop);
}

/**
 * @param forceRedraw Whether to ignore any attempts to avoid redrawing elements.
 */
function redraw(forceRedraw) {
    forceRedraw = !!forceRedraw;

    function callRedraw(statistic, redrawFn) {
        recordRenderCallStatistics(statistic, () => {
            redrawFn(forceRedraw);
        });
    }

    recordRenderCallStatistics(STAT_OVERALL, () => {
        callRedraw(STAT_BOARD, redrawBoard);
        callRedraw(STAT_LOADING, redrawLoading);
        callRedraw(STAT_MENU, redrawMenu);
        callRedraw(STAT_TILES, redrawTiles);
        callRedraw(STAT_DICE, redrawDice);
        callRedraw(STAT_SCORES, redrawScores);
        callRedraw(STAT_NETWORK_STATUS, redrawNetworkStatus);
        callRedraw(STAT_MESSAGE, redrawMessage);
        callRedraw(STAT_WIN_SCREEN, redrawWinScreen);
        callRedraw(STAT_OVERLAY, redrawOverlay);

        updateElementVisibilities([
            menuDiv, playSelectDiv, boardCanvas, tilesCanvas, exitButton,
            leftPlayerRenderTarget.tilesCanvas,
            leftPlayerRenderTarget.scoreCanvas,
            rightPlayerRenderTarget.tilesCanvas,
            rightPlayerRenderTarget.scoreCanvas
        ]);
    });
}



//
// LOADING SCREEN
//

const loadingFade = createFade(0.5).visible();

function redrawLoading(forceRedraw) {
    const opacity = loadingFade.get();
    loadingDiv.style.opacity = opacity;
    loadingDiv.style.display = (opacity === 0 ? "none" : "")
}



//
// MENU
//

const playTilesButtonMargin = 0.1,
      playTilesHeightInactive = 0.6,
      playTilesHeightActive = 0.75;

function redrawButton(canvas, ctx, imageKey) {
    const image = getImageResource(imageKey, canvas.width);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
}

function redrawMenu(forceRedraw) {
    menuDiv.style.opacity = screenState.menuFade.get();
    exitButton.style.opacity = screenState.exitFade.get();
    playSelectDiv.style.opacity = screenState.playSelectFade.get();
    networkStatus.hidden = false;

    if (forceRedraw || isOnScreen(SCREEN_MENU) || isOnScreen(SCREEN_PLAY_SELECT)) {
        const playButtonActive = (menuState.playButton !== BUTTON_STATE_INACTIVE),
              learnButtonActive = (menuState.learnButton !== BUTTON_STATE_INACTIVE),
              watchButtonActive = (menuState.watchButton !== BUTTON_STATE_INACTIVE);

        redrawButton(playButtonCanvas, playButtonCtx, (playButtonActive ? "play_active" : "play"));
        redrawButton(learnButtonCanvas, learnButtonCtx, (learnButtonActive ? "learn_active" : "learn"));
        redrawButton(watchButtonCanvas, watchButtonCtx, (watchButtonActive ? "watch_active" : "watch"));

        const playButtonHeight = playButton.getBoundingClientRect().height,
              playMargin = playButtonHeight * playTilesButtonMargin,
              tilesHeightActive = playButtonHeight * playTilesHeightActive,
              tilesHeightInactive = playButtonHeight * playTilesHeightInactive,
              tilesHeight =  (playButtonActive ? tilesHeightActive : tilesHeightInactive),
              tilesMargin = (tilesHeightActive - tilesHeight) / 2;

        playButtonCanvas.style.marginLeft = playMargin + "px";
        playButtonCanvas.style.marginRight = playMargin + "px";

        for (let index = 0; index < playButtonTiles.length; ++index) {
            const tile = playButtonTiles[index];
            tile.style.width = tilesHeight + "px";
            tile.style.height = tilesHeight + "px";
            tile.style.marginLeft = tilesMargin + "px";
            tile.style.marginRight = tilesMargin + "px";
        }
    }

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

function redrawBoard(forceRedraw) {
    // We only want to redraw the board when we have to
    if (!forceRedraw)
        return;

    const ctx = boardCtx;

    ctx.shadowColor = 'black';
    ctx.shadowBlur = 30;

    ctx.clearRect(0, 0, boardCanvasWidth, boardCanvasHeight);
    ctx.drawImage(getImageResource("board", boardCanvasWidth), boardX, boardY, boardWidth, boardHeight);
}



//
// TILES
//

const TILE_MOVE_DURATIONS = [0, 0.3, 0.4, 0.5, 0.6],
      HOVER_WIDTH_RATIO = 1.1,
      SHADOW_WIDTH_RATIO = HOVER_WIDTH_RATIO * 1.05,
      DRAG_DIRECT_LINE_TILE_WIDTHS = 0.25;

let tilePathAnchorTime = 0;

const tileMove = {
    owner: TILE_EMPTY,
    replacingOwner: TILE_EMPTY,
    fromTile: VEC_NEG1,
    toTile: VEC_NEG1,
    startTime: LONG_TIME_AGO,
    onComplete: null
};

function updateTilePathAnchorTime() {
    const duration = getTime() - mouseDownTime,
          width = getTileWidth(),
          distance = vecDist(mouseLoc, mouseDownLoc);

    tilePathAnchorTime += (9 / 15) * duration - (2 / 3) * distance / width;

    // Period in time when the pattern repeats
    const period = 2 / 3;

    tilePathAnchorTime = (tilePathAnchorTime % period) + (tilePathAnchorTime < 0 ? period : 0);
}

function runOnTileMoveFinish(onComplete) {
    // If there is no current tile moving
    if (!isTileLocValid(tileMove.fromTile)) {
        onComplete(VEC_NEG1, VEC_NEG1);
        return;
    }

    const previousOnComplete = tileMove.onComplete;

    if (previousOnComplete !== null) {
        tileMove.onComplete = function(fromTile, toTile) {
            onComplete(fromTile, toTile);
            previousOnComplete(fromTile, toTile);
        };
    } else {
        tileMove.onComplete = onComplete;
    }
}

function animateTileMove(fromTile, toTile, onComplete) {
    onComplete = (!onComplete ? null : onComplete);

    const owner = board.getTile(fromTile);
    if (owner === TILE_EMPTY) {
        if (onComplete !== null) {
            onComplete(VEC_NEG1, VEC_NEG1);
        }
        return;
    }

    tileMove.owner = owner;
    tileMove.replacingOwner = board.getTile(toTile);
    tileMove.fromTile = fromTile;
    tileMove.toTile = toTile;
    tileMove.startTime = getTime();

    const path = getTilePath(owner),
          moveLength = vecListIndexOf(path, toTile) - vecListIndexOf(path, fromTile);

    tileMove.duration = TILE_MOVE_DURATIONS[moveLength];
    tileMove.onComplete = onComplete;
}

function clearTileMove() {
    tileMove.owner = TILE_EMPTY;
    tileMove.replacingOwner = TILE_EMPTY;
    tileMove.fromTile = VEC_NEG1;
    tileMove.toTile = VEC_NEG1;
    tileMove.startTime = LONG_TIME_AGO;
    tileMove.duration = -1;
}

function updateTileMove(time) {
    // If there is no current tile moving
    if (!isTileLocValid(tileMove.fromTile))
        return;

    const age = (time - tileMove.startTime) / tileMove.duration;
    if (age < 1)
        return;

    finishTileMove();
}

function finishTileMove() {
    const onComplete = tileMove.onComplete,
        fromTile = tileMove.fromTile,
        toTile = tileMove.toTile,
        replacingOwner = tileMove.replacingOwner;

    clearTileMove();

    if (onComplete !== null) {
        onComplete(fromTile, toTile);
    }

    if (replacingOwner !== TILE_EMPTY) {
        playSound("kill");
    } else {
        playSound("place");
    }
}

function redrawTiles(forceRedraw) {
    // Avoid redrawing if we don't have to
    if (!forceRedraw && !isOnScreen(SCREEN_GAME))
        return;

    const ctx = tilesCtx,
          time = getTime();

    ctx.clearRect(0, 0, tilesWidth, tilesHeight);

    const tileWidth = getTileWidth(),
          path = getTilePath(ownPlayer.playerNo),
          diceValue = countDiceUp();

    // Get the tile to draw a path for
    let pathTile = getDrawPotentialMoveTile(),
        startIndex = vecListIndexOf(path, pathTile),
        endIndex = (startIndex >= 0 ? min(startIndex + diceValue, path.length - 1) : -1),
        endTile = (endIndex >= 0 ? path[endIndex] : VEC_NEG1);

    if(startIndex === endIndex) {
        pathTile = VEC_NEG1;
        endTile = VEC_NEG1;
    }

    // Get the tile we are currently moving
    updateTileMove(time);
    const moveFrom = tileMove.fromTile,
          moveTo = tileMove.toTile;

    // Tiles we will draw later (or just don't want to draw)
    const ignoreDrawTiles = [pathTile, endTile, moveFrom, moveTo, getStartTile(otherPlayer.playerNo)];

    // Draw all tiles not part of a drawn path
    for (let index = 0; index < TILES_COUNT; ++index) {
        const loc = TILE_LOCS[index],
              tile = board.getTile(loc);

        if (tile === TILE_EMPTY || vecListContains(ignoreDrawTiles, loc))
            continue;

        const tileDrawWidth = tileWidth * (vecEquals(pathTile, loc) ? HOVER_WIDTH_RATIO : 1),
              shadowColour = (isTileSelected(loc) ? 255 : 0);

        renderTile(ctx, loc, tileDrawWidth, tileDrawWidth, tile, shadowColour);
    }

    // Draw a potential move
    if(isTileLocValid(pathTile)) {
        const isValidMove = board.isValidMoveFrom(ownPlayer.playerNo, pathTile, diceValue),
              draggingTile = isTileSelected(draggedTile),
              owner = ownPlayer.playerNo;

        // Find the location of the dragged tile
        let dragLoc = null;
        if (draggingTile) {
            dragLoc = vecAdd(tileToCanvas(pathTile), vecSub(mouseLoc, mouseDownLoc));
            dragLoc.x = clamp(dragLoc.x, tileWidth, tilesWidth - tileWidth);
            dragLoc.y = clamp(dragLoc.y, tileWidth, tilesHeight - tileWidth);
        }

        // Convert the tile path to a canvas location curve
        const curve = computePathCurve(startIndex, endIndex);

        drawPath(ctx, time - tilePathAnchorTime, path[endIndex], curve, isValidMove, dragLoc);

        const endHovered = isTileHovered(endTile),
              tileHoverWidth = tileWidth * HOVER_WIDTH_RATIO,
              cyclicWidthMul = 1 + 0.03 * Math.cos(5 * time),
              tileCyclicWidth = tileHoverWidth * cyclicWidthMul;

        if(board.getTile(endTile) !== TILE_EMPTY) {
            const tileWidth = (isValidMove ? tileCyclicWidth : tileHoverWidth);
            renderTile(ctx, endTile, tileWidth, tileWidth, board.getTile(endTile), (endHovered ? 255 : 0));
        } else if(isValidMove) {
            renderTile(ctx, endTile, tileCyclicWidth, tileCyclicWidth, owner, (endHovered ? 255 : 0));
        }

        if(!draggingTile) {
            renderTile(ctx, pathTile, tileHoverWidth, tileHoverWidth, owner, (isTileSelected(pathTile) ? 255 : 0));
        } else {
            if (dragLoc === null)
                throw "This def shouldn't happen";

            const draggedOnBoard = isTileLocOnBoard(canvasToTile(mouseLoc)),
                  draggedWidth = tileWidth * (draggedOnBoard ? HOVER_WIDTH_RATIO : 1),
                  draggedShadowWidth = tileWidth * (draggedOnBoard ? SHADOW_WIDTH_RATIO : 1);

            paintTile(ctx, dragLoc.x, dragLoc.y, draggedWidth, draggedShadowWidth, owner, 255);
        }
    }

    // Draw a moving tile
    drawMovingTile(ctx, time, tileWidth);
}

function drawMovingTile(ctx, time, tileWidth) {
    // There is no moving tile
    if (!isTileLocValid(tileMove.fromTile))
        return;

    const path = getTilePath(tileMove.owner),
          startIndex = vecListIndexOf(path, tileMove.fromTile),
          endIndex = vecListIndexOf(path, tileMove.toTile),
          curve = computePathCurve(startIndex, endIndex, tileMove.owner);

    const age = (time - tileMove.startTime) / tileMove.duration,
          startCurveIndex = min(curve.length - 1, Math.floor(easeInOutSine(age) * curve.length)),
          startLoc = curve[startCurveIndex],
          endLoc = curve[curve.length - 1];

    if (tileMove.replacingOwner !== TILE_EMPTY) {
        paintTile(ctx, endLoc.x, endLoc.y, tileWidth, tileWidth, tileMove.replacingOwner, 0);
    }

    const tileMovingWidth = tileWidth * (1 + 0.2 * 2 * (0.5 - Math.abs(easeInOutSine(age) - 0.5)));

    paintTile(ctx, startLoc.x, startLoc.y, tileMovingWidth, tileMovingWidth, tileMove.owner, 0);
}

function getDrawPotentialMoveTile() {
    if (!isAwaitingMove())
        return VEC_NEG1;

    if (isTileSelected(draggedTile))
        return draggedTile;

    if (board.getTile(hoveredTile) === ownPlayer.playerNo)
        return hoveredTile;

    if (isTileSelected())
        return selectedTile;

    return VEC_NEG1;
}

function computePathCurve(startIndex, endIndex, playerNo) {
    playerNo = (playerNo !== undefined ? playerNo : getActivePlayer().playerNo);

    const tilePath = getTilePath(playerNo),
          locPath = [];

    for (let index = startIndex; index <= endIndex; ++index) {
        locPath.push(tileToCanvas(tilePath[index]));
    }

    return createBezierCurveFromPath(locPath);
}

function drawPath(ctx, time, endTile, curve, isValidMove, dragLoc) {
    const tileWidth = getTileWidth();

    ctx.save();
    ctx.beginPath();

    if (isValidMove) {
        ctx.strokeStyle = (isTileHovered(endTile) ? rgb(100, 255, 100) : rgb(255));
    } else {
        ctx.strokeStyle = rgb(255, 70, 70);
    }

    ctx.shadowColor = rgb(0);
    ctx.shadowBlur = tileWidth / 10;
    ctx.lineWidth = tileWidth / 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([tileWidth / 6, tileWidth / 3]);

    const timeMouseDown = mouseDownTime - tilePathAnchorTime;

    // Make the dashes move over time
    let dashOffset = 0.75 * tileWidth * time;
    if(mouseDown) {
        // Make the dashes move more slowly when dragging the tile
        dashOffset += 0.3 * tileWidth * (time - timeMouseDown);
    }
    ctx.lineDashOffset = dashOffset;


    const endLoc = curve[curve.length - 1];
    ctx.moveTo(endLoc.x, endLoc.y);

    if (dragLoc !== null && vecDist(dragLoc, curve[0]) > DRAG_DIRECT_LINE_TILE_WIDTHS * tileWidth) {
        // Just draw a direct line to the end point
        ctx.lineTo(dragLoc.x, dragLoc.y);
    } else {
        // Draw the path curve
        for (let index = curve.length - 2; index >= 0; --index) {
            const point = curve[index];
            ctx.lineTo(point.x, point.y);
        }
    }

    ctx.stroke();
    ctx.closePath();

    // Draw a cross if its not a valid move
    if(!isValidMove && board.getTile(endTile) === TILE_EMPTY) {
        ctx.beginPath();
        ctx.setLineDash([]);

        const crossSize = tileWidth / 6;

        ctx.moveTo(endLoc.x - crossSize, endLoc.y - crossSize);
        ctx.lineTo(endLoc.x + crossSize, endLoc.y + crossSize);

        ctx.moveTo(endLoc.x - crossSize, endLoc.y + crossSize);
        ctx.lineTo(endLoc.x + crossSize, endLoc.y - crossSize);

        ctx.stroke();
    }

    ctx.restore();
}

function getTileImage(owner, width) {
    if(owner === TILE_DARK) return getImageResource("tile_dark", width);
    if(owner === TILE_LIGHT)  return getImageResource("tile_light", width);
    return null;
}

function renderTile(ctx, location, width, shadowWidth, owner, shadowRed, shadowGreen, shadowBlue) {
    if(!isTileLocOnBoard(location)) {
        width /= HOVER_WIDTH_RATIO;
        shadowWidth /= SHADOW_WIDTH_RATIO;
    }

    const loc = tileToCanvas(location);

    paintTile(ctx, loc.x, loc.y, width, shadowWidth, owner, shadowRed, shadowGreen, shadowBlue);
}

// TODO : paintTile should take a location array, not left, top
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

let renderedScoreText = {
    width: NaN,
    tiles: null,
    score: null
};

function drawScoreText(text, isActive, scale) {
    return renderResource(scoreWidth, scoreHeight * scale, function(ctx) {
        // Render the text on another canvas, and then onto this one so that the alpha stacks correctly
        const renderedText = renderResource(scoreWidth, scoreHeight * scale, function(ctx) {
            const tileWidth = getTileWidth(),
                offset = 0.01 * tileWidth;

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = Math.round(tileWidth * 0.85 * scale) + "px DuranGo";

            if (isActive) {
                ctx.save();
                ctx.shadowBlur = 5;
                ctx.shadowColor = rgba(255, 255, 255, 0.7);
                ctx.fillText(text, scoreWidth / 2, 0.5 * tileWidth);
                ctx.restore();
            }

            ctx.fillStyle = rgb(255);
            ctx.fillText(text, scoreWidth / 2, 0.5 * tileWidth);
        });

        ctx.globalAlpha = (isActive ? 1.0 : 0.8);
        ctx.drawImage(renderedText, 0, 0);
    });
}

function drawName(player, isActive) {
    return drawScoreText(player.name, isActive, 1.0);
}

function checkForRenderedScoreTextResize() {
    if (renderedScoreText.width === tilesWidth)
        return;

    renderedScoreText.tiles = null;
    renderedScoreText.score = null;
    renderedScoreText.width = tilesWidth;
}

function getRenderedTilesText() {
    checkForRenderedScoreTextResize();

    if (renderedScoreText.tiles === null) {
        renderedScoreText.tiles = drawScoreText("Tiles", false, 0.5);
        renderedScoreText.width = tilesWidth;
    }
    return renderedScoreText.tiles;
}

function getRenderedScoreText() {
    checkForRenderedScoreTextResize();

    if (renderedScoreText.score === null) {
        renderedScoreText.score = drawScoreText("Score", false, 0.5);
        renderedScoreText.width = tilesWidth;
    }
    return renderedScoreText.score;
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

function redrawPlayerScores(player, drawFromLeft) {
    const tileWidth = getTileWidth(),
          tilePaintWidth = tileWidth * scoreTileRatio;

    function drawTiles(ctx, owner, top, tileCount, highlightStartTile) {
        ctx.clearRect(0, 0, scoreWidth, scoreHeight * 2);

        const originalAlpha = ctx.globalAlpha;

        const highlightIndex = (drawFromLeft ? tileCount - 1 : 7 - tileCount);
        for(let index = 0; index < 7; ++index) {
            const tileLeft = (index + 0.5) * tileWidth,
                  shadowShade = (highlightStartTile && index === highlightIndex ? 255 : 0);

            if ((drawFromLeft && index < tileCount) || (!drawFromLeft && index >= 7 - tileCount)) {
                ctx.globalAlpha = originalAlpha;
                paintTile(ctx, tileLeft, top, tilePaintWidth, tilePaintWidth, owner, shadowShade);
            } else {
                ctx.globalAlpha = 0.5 * originalAlpha;
                drawCircularShadow(ctx, tileLeft, top, tilePaintWidth / 2, shadowShade);
            }
        }

        ctx.globalAlpha = originalAlpha;
    }

    const renderTarget = getPlayerRenderTarget(player),
          tilesCtx = renderTarget.tilesCtx,
          scoreCtx = renderTarget.scoreCtx,
          startTile = getStartTile(ownPlayer.playerNo),
          diceValue = countDiceUp();

    const potentialMoveTile = getDrawPotentialMoveTile(),
          highlightStartTile = (
        player === ownPlayer
        && ownPlayer.active
        && board.isValidMoveFrom(ownPlayer.playerNo, startTile, diceValue)
        && !dice.rolling
        && vecEquals(startTile, potentialMoveTile)
    );

    drawTiles(
        tilesCtx, player.playerNo, tileWidth * 2.25,
        player.tiles.current, highlightStartTile,
    );
    drawTiles(
        scoreCtx, player.playerNo, tileWidth * 1.25,
        player.score.current, false
    );

    tilesCtx.drawImage(getRenderedPlayerName(player), 0, 0);
    tilesCtx.drawImage(getRenderedTilesText(), 0, tileWidth);
    scoreCtx.drawImage(getRenderedScoreText(), 0, 0);
}

function redrawScores(forceRedraw) {
    // Avoid redrawing if we don't have to
    if (!forceRedraw && !isOnScreen(SCREEN_GAME))
        return;

    redrawPlayerScores(ownPlayer, false);
    redrawPlayerScores(otherPlayer, true);
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


const diceWidthRatio = 1.4;

const lastDice = [0, 0, 0, 0],
      diceDown = [true, true, true, true];

let diceHovered = false,
    lastDiceSound = 0,
    lastDiceSelected = 0;

function redrawDice(forceRedraw) {
    // Avoid redrawing if we don't have to
    if (!forceRedraw && !isOnScreen(SCREEN_GAME))
        return;

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

function redrawNetworkStatus(forceRedraw) {
    networkStatusElement.style.display = (networkStatus.hidden ? "none" : "block");
    networkStatusElement.style.opacity = networkStatus.fade.get();
    networkStatusElement.textContent = getNetworkStatus();
}



//
// MESSAGES
//

function redrawMessage(forceRedraw) {
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

function redrawOverlay(forceRedraw) {
    // If we don't have to draw to the canvas, just don't display it at all
    if (fireworks.length === 0 && particles.birthTime.length === 0) {
        overlayCanvas.style.display = "none";
        return;
    } else {
        overlayCanvas.style.display = "";
    }

    overlayCtx.clearRect(0, 0, overlayWidth, overlayHeight);

    simulateFireworks();
    removeDeadParticles();
    drawParticles(overlayCtx);
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
      WIN_FIREWORK_SPEED = 300 / 1280;

const nextFireworkTimes = []; {
    for (let index = 0; index < WIN_FIREWORK_REGIONS.length; ++index) {
        nextFireworkTimes.push(0);
    }
}

function redrawWinScreen(forceRedraw) {
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

        createFirework(x1, y1, x2, y2, WIN_FIREWORK_SPEED * height, colour.r, colour.g, colour.b);
    }
}
