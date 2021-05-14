//
// This file contains the code to render the board and the tiles on it.
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
    isRosette: false,
    startTime: LONG_TIME_AGO,
    duration: -1,
    age: 0,
    ttl: -1,
    rosetteLandPlayed: false,
    hitSoundsPlayed: false,
    onComplete: null
};

function clearTileMove() {
    tileMove.owner = TILE_EMPTY;
    tileMove.replacingOwner = TILE_EMPTY;
    tileMove.fromTile = VEC_NEG1;
    tileMove.toTile = VEC_NEG1;
    tileMove.isRosette = false;
    tileMove.startTime = LONG_TIME_AGO;
    tileMove.duration = -1;
    tileMove.age = 0;
    tileMove.ttl = -1;
    tileMove.hitSoundsPlayed = false;
    tileMove.onComplete = null;
}

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
    tileMove.isRosette = isRosetteTile(toTile);
    tileMove.startTime = getTime();
    tileMove.hitSoundsPlayed = false;

    const path = getTilePath(owner),
          moveLength = vecListIndexOf(path, toTile) - vecListIndexOf(path, fromTile);

    tileMove.duration = TILE_MOVE_DURATIONS[moveLength];
    tileMove.age = 0;
    tileMove.ttl = tileMove.duration;
    tileMove.onComplete = onComplete;
}

function animateTileDragMove(fromTile, toTile, onComplete) {
    animateTileMove(fromTile, toTile, onComplete);
    tileMove.startTime -= tileMove.duration;
}

function updateTileMove(time) {
    // If there is no current tile moving
    if (!isTileLocValid(tileMove.fromTile))
        return;

    tileMove.age = (time - tileMove.startTime) / tileMove.duration;
    tileMove.ttl = (tileMove.startTime + tileMove.duration) - time;
    if (tileMove.age < 1)
        return;

    if (!tileMove.hitSoundsPlayed) {
        tileMove.hitSoundsPlayed = true;
        if (tileMove.replacingOwner !== TILE_EMPTY) {
            audioSystem.playSound("kill");
        } else {
            audioSystem.playSound("place");
        }
    }
    if (tileMove.isRosette && tileMove.ttl > -0.3)
        return;

    finishTileMove();
}

function finishTileMove() {
    const onComplete = tileMove.onComplete,
          fromTile = tileMove.fromTile,
          toTile = tileMove.toTile;

    clearTileMove();
    if (onComplete !== null) {
        onComplete(fromTile, toTile);
    }
}

function redrawBoard(forceRedraw) {
    if (!isOnScreen(GAME_VISIBLE_SCREENS) || !forceRedraw)
        return;

    const ctx = boardCtx;
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 30;
    ctx.clearRect(0, 0, boardCanvasWidth, boardCanvasHeight);

    const boardImage = imageSystem.getImageResource("board", boardWidth);
    ctx.drawImage(boardImage, boardX, boardY, boardWidth, boardHeight);
}

function redrawTiles() {
    if (!isOnScreen(GAME_VISIBLE_SCREENS))
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
    const ignoreDrawTiles = [pathTile, endTile, moveFrom, moveTo];
    for (let index = 0; index < otherPlayers.length; ++index) {
        ignoreDrawTiles.push(getStartTile(otherPlayers[index].playerNo));
    }

    // Draw all tiles not part of a drawn path.
    for (let index = 0; index < TILES_COUNT; ++index) {
        const loc = TILE_LOCS[index],
            tile = board.getTile(loc);

        if (tile === TILE_EMPTY || vecListContains(ignoreDrawTiles, loc))
            continue;

        const tileDrawWidth = tileWidth * (vecEquals(hoveredTile, loc) ? HOVER_WIDTH_RATIO : 1),
            shadowColour = (isTileSelected(loc) ? 255 : 0);

        renderTile(ctx, loc, tileDrawWidth, tileDrawWidth, tile, shadowColour);
    }

    // Draw a potential move.
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
            const shadowShade = (isTileSelected(pathTile) || isTileHovered(pathTile) ? 255 : 0);
            renderTile(ctx, pathTile, tileHoverWidth, tileHoverWidth, owner, shadowShade);
        } else {
            if (dragLoc === null)
                throw "This def shouldn't happen";

            const draggedOnBoard = isTileLocOnBoard(canvasToTile(mouseLoc)),
                draggedWidth = tileWidth * (draggedOnBoard ? HOVER_WIDTH_RATIO : 1),
                draggedShadowWidth = tileWidth * (draggedOnBoard ? SHADOW_WIDTH_RATIO : 1);

            paintTile(ctx, dragLoc.x, dragLoc.y, draggedWidth, draggedShadowWidth, owner, 255);
        }
    }

    // Draw the tile that is moving.
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

    const age = min(1, tileMove.age),
          startCurveIndex = min(curve.length - 1, Math.floor(easeInOutSine(age) * curve.length)),
          startLoc = curve[startCurveIndex],
          endLoc = curve[curve.length - 1];

    if (tileMove.replacingOwner !== TILE_EMPTY) {
        paintTile(ctx, endLoc.x, endLoc.y, tileWidth, tileWidth, tileMove.replacingOwner, 0);
    }

    const tileMovingWidth = tileWidth * (1 + 0.2 * 2 * (0.5 - Math.abs(easeInOutSine(age) - 0.5))),
          tileShadowColour = (tileMove.age > 1 ? 255 : 0);

    paintTile(ctx, startLoc.x, startLoc.y, tileMovingWidth, tileMovingWidth, tileMove.owner, tileShadowColour);
}

function getDrawPotentialMoveTile() {
    if (!isAwaitingMove())
        return VEC_NEG1;

    if (isTileSelected(draggedTile))
        return draggedTile;

    if (isTileSelected())
        return selectedTile;

    if (board.getTile(hoveredTile) === ownPlayer.playerNo)
        return hoveredTile;

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
    if(owner === TILE_DARK) return imageSystem.getImageResource("tile_dark", width);
    if(owner === TILE_LIGHT)  return imageSystem.getImageResource("tile_light", width);
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