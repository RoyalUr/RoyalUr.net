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

function redrawTiles(forceRedraw) {
    // Avoid redrawing if we don't have to
    if (!forceRedraw && !isOnScreen(SCREEN_GAME))
        return;

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
