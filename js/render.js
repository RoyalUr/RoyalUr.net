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
        recordCallStatistics(statistic, () => {
            redrawFn(forceRedraw);
        });
    }

    recordCallStatistics(STATS_OVERALL, () => {
        callRedraw(STATS_BOARD, redrawBoard);
        callRedraw(STATS_LOADING, redrawLoading);
        callRedraw(STATS_MENU, redrawMenu);
        callRedraw(STATS_TILES, redrawTiles);
        callRedraw(STATS_DICE, redrawDice);
        callRedraw(STATS_SCORES, redrawScores);
        callRedraw(STATS_NETWORK_STATUS, redrawNetworkStatus);
        callRedraw(STATS_MESSAGE, redrawMessage);
        callRedraw(STATS_WIN_SCREEN, redrawWinScreen);
        callRedraw(STATS_OVERLAY, redrawOverlay);

        updateElementVisibilities([
            menuDiv, boardCanvas, tilesCanvas, exitButton,
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

function redrawMenu(forceRedraw) {
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

const TILE_MOVE_DURATIONS = [0, 0.3, 0.6, 0.7, 0.8],
      HOVER_WIDTH_RATIO = 1.1,
      SHADOW_WIDTH_RATIO = HOVER_WIDTH_RATIO * 1.05;

let tilePathAnchorTime = 0;

const tileMove = {
    owner: TILE_EMPTY,
    replacingOwner: TILE_EMPTY,
    fromTile: [-1, -1],
    toTile: [-1, -1],
    startTime: LONG_TIME_AGO
};

function updateTilePathAnchorTime() {
    const duration = getTime() - mouseDownTime,
          width = getTileWidth(),
          distance = vecDist(mouseX, mouseY, mouseDownX, mouseDownY);

    tilePathAnchorTime += (9 / 15) * duration - (2 / 3) * distance / width;

    // Period in time when the pattern repeats
    const period = 2 / 3;

    tilePathAnchorTime = (tilePathAnchorTime % period) + (tilePathAnchorTime < 0 ? period : 0);
}

function animateTileMove(fromTile, toTile) {
    const owner = getTile(fromTile);
    if (owner === TILE_EMPTY)
        return;

    tileMove.owner = owner;
    tileMove.replacingOwner = getTile(toTile);
    tileMove.fromTile = fromTile;
    tileMove.toTile = toTile;
    tileMove.startTime = getTime();

    const path = getTilePath(owner),
          moveLength = vecListIndexOf(path, toTile) - vecListIndexOf(path, fromTile);
    tileMove.duration = TILE_MOVE_DURATIONS[moveLength];
}

function clearTileMove() {
    tileMove.owner = TILE_EMPTY;
    tileMove.replacingOwner = TILE_EMPTY;
    tileMove.fromTile = [-1, -1];
    tileMove.toTile = [-1, -1];
    tileMove.startTime = LONG_TIME_AGO;
    tileMove.duration = -1;
}

function updateTileMove(time) {
    // If there is no current tile moving
    if (!isTileValid(tileMove.fromTile))
        return;

    const age = (time - tileMove.startTime) / tileMove.duration;
    if (age < 1)
        return;

    clearTileMove();
    if (tileMove.replacingOwner !== TILE_EMPTY) {
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
          path = getTilePath(),
          diceValue = countDiceUp();

    // Get the tile to draw a path for
    let pathTile = getDrawPotentialMoveTile(),
        startIndex = vecListIndexOf(path, pathTile),
        endIndex = (startIndex >= 0 ? min(startIndex + diceValue, path.length - 1) : -1),
        endTile = (endIndex >= 0 ? path[endIndex] : [-1, -1]);

    if(startIndex === endIndex) {
        pathTile = [-1, -1];
        endTile = [-1, -1];
    }

    // Get the tile we are currently moving
    updateTileMove(time);
    const moveFrom = tileMove.fromTile,
          moveTo = tileMove.toTile;

    // Tiles we will draw later
    const ignoreDrawTiles = [pathTile, endTile, moveFrom, moveTo];

    // Draw all tiles not part of a drawn path
    for(let x = 0; x < TILES_WIDTH; ++x) {
        for(let y = 0; y < TILES_HEIGHT; ++y) {
            if(tiles[x][y] === TILE_EMPTY)
                continue;

            const loc = [x, y];
            if (vecListContains(ignoreDrawTiles, loc))
                continue;

            const tileDrawWidth = tileWidth * (isTileHovered(loc) ? HOVER_WIDTH_RATIO : 1),
                  shadowColour = (isTileSelected(loc) ? 255 : 0);

            renderTile(ctx, loc, tileDrawWidth, tileDrawWidth, tiles[x][y], shadowColour);
        }
    }

    // Draw a potential move
    if(isTileValid(pathTile)) {
        const isValidMove = isValidMoveFrom(pathTile),
              draggingTile = isTileSelected(draggedTile),
              owner = ownPlayer.playerNo;

        // Find the location of the dragged tile
        let dragLoc = null;
        if (draggingTile) {
            dragLoc = vecAdd(tileToCanvas(pathTile), [mouseX - mouseDownX, mouseY - mouseDownY]);
            dragLoc[0] = clamp(dragLoc[0], tileWidth, tilesWidth - tileWidth);
            dragLoc[1] = clamp(dragLoc[1], tileWidth, tilesHeight - tileWidth);
        }

        // Convert the tile path to a canvas location curve
        const curve = computePathCurve(startIndex, endIndex);

        drawPath(ctx, time - tilePathAnchorTime, path[endIndex], curve, isValidMove, dragLoc);

        const endHovered = isTileHovered(endTile),
              tileHoverWidth = tileWidth * HOVER_WIDTH_RATIO,
              cyclicWidthMul = 1 + 0.03 * Math.cos(5 * time),
              tileCyclicWidth = tileHoverWidth * cyclicWidthMul;

        if(getTile(endTile) !== TILE_EMPTY) {
            const tileWidth = (isValidMove ? tileCyclicWidth : tileHoverWidth);
            renderTile(ctx, endTile, tileWidth, tileWidth, getTile(endTile), (endHovered ? 255 : 0));
        } else if(isValidMove) {
            renderTile(ctx, endTile, tileCyclicWidth, tileCyclicWidth, owner, (endHovered ? 255 : 0));
        }

        if(!draggingTile) {
            renderTile(ctx, pathTile, tileHoverWidth, tileHoverWidth, owner, (isTileSelected(pathTile) ? 255 : 0));
        } else {
            const draggedOnBoard = isTileOnBoard(canvasToTile(mouseX, mouseY)),
                draggedWidth = tileWidth * (draggedOnBoard ? HOVER_WIDTH_RATIO : 1),
                draggedShadowWidth = tileWidth * (draggedOnBoard ? SHADOW_WIDTH_RATIO : 1);

            paintTile(ctx, dragLoc[0], dragLoc[1], draggedWidth, draggedShadowWidth, owner, 255);
        }
    }

    // Draw a moving tile
    drawMovingTile(ctx, time, tileWidth);
}

function drawMovingTile(ctx, time, tileWidth) {
    // There is no moving tile
    if (!isTileValid(tileMove.fromTile))
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
        paintTile(ctx, endLoc[0], endLoc[1], tileWidth, tileWidth, tileMove.replacingOwner, 0);
    }

    const tileMovingWidth = tileWidth * (1 + 0.1 * 2 * (0.5 - Math.abs(easeInOutSine(age) - 0.5)));

    paintTile(ctx, startLoc[0], startLoc[1], tileMovingWidth, tileMovingWidth, tileMove.owner, 0);
}

function getDrawPotentialMoveTile() {
    if (!isAwaitingMove())
        return [-1, -1];

    if (getTile(hoveredTile) === ownPlayer.playerNo)
        return hoveredTile;

    if (isTileSelected(draggedTile))
        return selectedTile;

    return [-1, -1];
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

    // Defines what section of the curve we're gonna draw
    let startCurveIndex = 0,
        endCurveIndex = curve.length - 1;

    if (dragLoc !== null) {
        // We only want to consider connecting to a point within this distance,
        // otherwise we'll just connect straight to the end of the path.
        let closestDist = tileWidth / 2,
            closestIndex = NaN;

        for (let index = startCurveIndex; index < endCurveIndex; ++index) {
            const loc = curve[index],
                  dist = vecDist(dragLoc, loc);

            if (dist < closestDist && !isPointAheadInPath(dragLoc, curve, index)) {
                closestIndex = index;
                closestDist = dist;
            }
        }

        startCurveIndex = (!isNaN(closestIndex) ? closestIndex : endCurveIndex);
    }

    const endLoc = curve[endCurveIndex];

    // Draw the path backwards so that the dashes don't move due to dragging the tile
    ctx.moveTo(endLoc[0], endLoc[1]);
    for (let index = curve.length - 2; index >= startCurveIndex; --index) {
        const point = curve[index];
        ctx.lineTo(point[0], point[1]);
    }

    // Line straight to the drag location
    if (dragLoc !== null) {
        ctx.lineTo(dragLoc[0], dragLoc[1]);
    }

    ctx.stroke();
    ctx.closePath();

    // Draw a cross if its not a valid move
    if(!isValidMove && getTile(endTile) === TILE_EMPTY) {
        ctx.beginPath();
        ctx.setLineDash([]);

        const crossSize = tileWidth / 6;

        ctx.moveTo(endLoc[0] - crossSize, endLoc[1] - crossSize);
        ctx.lineTo(endLoc[0] + crossSize, endLoc[1] + crossSize);

        ctx.moveTo(endLoc[0] - crossSize, endLoc[1] + crossSize);
        ctx.lineTo(endLoc[0] + crossSize, endLoc[1] - crossSize);

        ctx.stroke();
    }

    ctx.restore();
}

function getTileImage(owner, width) {
    if(owner === TILE_DARK) return getImageResource("darkTile", width);
    if(owner === TILE_LIGHT)  return getImageResource("lightTile", width);
    return null;
}

function renderTile(ctx, location, width, shadowWidth, owner, shadowRed, shadowGreen, shadowBlue) {
    if(!isTileOnBoard(location)) {
        width /= HOVER_WIDTH_RATIO;
        shadowWidth /= SHADOW_WIDTH_RATIO;
    }

    const loc = tileToCanvas(location);

    paintTile(ctx, loc[0], loc[1], width, shadowWidth, owner, shadowRed, shadowGreen, shadowBlue);
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
                ctx.save();
                ctx.shadowBlur = 5;
                ctx.shadowColor = rgba(255, 255, 255, 0.7);
                ctx.fillText(player.name, scoreWidth / 2, 0.5 * tileWidth);
                ctx.restore();
            }

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
        && (isTileHovered(startTile) || (isTileSelected(startTile) && !isValidMoveFrom(hoveredTile)))
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

function redrawScores(forceRedraw) {
    // Avoid redrawing if we don't have to
    if (!forceRedraw && !isOnScreen(SCREEN_GAME))
        return;

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
