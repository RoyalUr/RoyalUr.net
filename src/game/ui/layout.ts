//
// This file stores the logic for laying out the elements in the client.
//

import {Vec2} from "@/common/vectors";
import {LONG_TIME_AGO} from "@/common/utils";
import {GameLayout} from "@/game/ui/game_layout";


export class Layout {
    gameLayout: GameLayout;
}


function setupMenuElements() {
    exitControlButton.addEventListener("click", onExitClick);
    winBackToHomeButton.addEventListener("click", onExitClick);
    winPlayAgainButton.addEventListener("click", () => switchToScreen(SCREEN_MENU));

    messageContainerElement.addEventListener("click", tryDismissMessage);

    waitingForFriendLinkTextBox.addEventListener("click", function() {
        if (document.activeElement === waitingForFriendLinkTextBox) {
            waitingForFriendLinkTextBox.blur();
        } else {
            selectText(waitingForFriendLinkTextBox);
        }
    });

    window.requestAnimationFrame(detectResize);
}


function setupGameElements() {
    diceCanvas.addEventListener("click", function() { if (game) {game.onDiceClick();} });
    diceCanvas.addEventListener("mouseover", function() { diceHovered = true; });
    diceCanvas.addEventListener("mouseout",  function() { diceHovered = false; });
}



//
// Layout of the board and tiles.
//

const boardPadding = 30,
      tileWidthRatio = 0.75;

let boardCanvasWidth = NaN,
    boardCanvasHeight = NaN,
    boardCanvasLeft = NaN,
    boardCanvasTop = NaN,
    boardX = NaN,
    boardY = NaN,
    boardWidth = NaN,
    boardHeight = NaN;

let tilesWidth = NaN,
    tilesHeight = NaN,
    tilesLeft = NaN,
    tilesTop = NaN,
    tilesLeftOffset = NaN;

let boardWidthToHeightRatio = null,
    boardTileRegions = null,
    boardTilePositions = null,
    tileWidth = null;

function resizeBoard() {
    boardCanvasHeight = useHeight;
    boardCanvasWidth = Math.ceil((useHeight - 2 * boardPadding) / getBoardWidthToHeightRatio()) + 2 * boardPadding;
    boardCanvasLeft = centreLeft - Math.round(boardCanvasWidth / 2);
    boardCanvasTop = centreTop - Math.round(boardCanvasHeight / 2);

    boardCanvas.width = boardCanvasWidth;
    boardCanvas.height = boardCanvasHeight;
    boardCanvas.style.width = screenPixels(boardCanvasWidth);
    boardCanvas.style.height = screenPixels(boardCanvasHeight);
    boardCanvas.style.left = screenPixels(boardCanvasLeft);
    boardCanvas.style.top = screenPixels(boardCanvasTop);

    tilesHeight = boardCanvasHeight;
    tilesWidth = boardCanvasWidth * 1.5;
    tilesLeft = centreLeft - Math.round(tilesWidth / 2);
    tilesTop = centreTop - Math.round(tilesHeight / 2);
    tilesLeftOffset = Math.round((tilesWidth - boardCanvasWidth) / 2);

    tilesCanvas.width = tilesWidth;
    tilesCanvas.height = tilesHeight;
    tilesCanvas.style.width = screenPixels(tilesWidth);
    tilesCanvas.style.height = screenPixels(tilesHeight);
    tilesCanvas.style.left = screenPixels(tilesLeft);
    tilesCanvas.style.top = screenPixels(tilesTop);

    boardX = boardPadding;
    boardY = boardPadding;
    boardWidth = boardCanvasWidth - 2 * boardPadding;
    boardHeight = boardCanvasHeight - 2 * boardPadding;
}

function getTileWidth() {
    if (isNaN(boardCanvasWidth))
        return 1;
    if (tileWidth)
        return Math.ceil(tileWidth * boardWidth);

    const regions = getBoardTileRegions();

    let cumulativeTileWidth = 0,
        tilesRecordedCount = 0;

    for (let x = 0; x < TILES_WIDTH; ++x) {
        for (let y = 0; y < TILES_HEIGHT; ++y) {
            const loc = vec(x, y);
            if (!isTileLocOnBoard(loc))
                continue;

            cumulativeTileWidth += regions[x + y * TILES_WIDTH].width;
            tilesRecordedCount += 1;
        }
    }

    tileWidth = tileWidthRatio * cumulativeTileWidth / tilesRecordedCount;

    return Math.ceil(tileWidth * boardWidth);
}

function getBoardWidthToHeightRatio() {
    if (boardWidthToHeightRatio)
        return boardWidthToHeightRatio;

    const boardImage = imageSystem.getImageResource("board");
    if (!boardImage)
        throw "Missing board image";

    boardWidthToHeightRatio = boardImage.height / boardImage.width;
    return boardWidthToHeightRatio;
}

/**
 * @returns An array of length 4 arrays representing the [x, y, width, height] regions of
 *          each tile as a percentage across the board image in the range [0, 1].
 */
function getBoardTileRegions() {
    if (boardTileRegions)
        return boardTileRegions;

    const tileRegions = annotationsResource.get("board");
    if (!tileRegions)
        throw "Missing board tile annotations";
    if (tileRegions.length !== TILES_COUNT)
        throw "Invalid board tile annotations : invalid length, expected " + TILES_COUNT + ", received " + tileRegions.length;

    boardTileRegions = [];

    for (let index = 0; index < tileRegions.length; ++index) {
        const region = tileRegions[index];
        boardTileRegions.push({
            x: region[0],
            y: region[1],
            width: region[2],
            height: region[3]
        });
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
        const region = tileRegions[index];

        boardTilePositions.push(vec(
            region.x + region.width / 2,
            region.y + region.height / 2
        ));
    }

    return boardTilePositions;
}

export function tileToCanvas(tileLoc): Vec2 {
    let x = tileLoc.x,
        y = tileLoc.y;

    // If we're flipping the board
    if(leftPlayer === darkPlayer) {
        x = TILES_WIDTH - x - 1;
    }

    if (x < 0 || y < 0 || x >= TILES_WIDTH || y >= TILES_HEIGHT)
        return null;

    const tilesXOffset = boardX + (tilesWidth - boardCanvasWidth) / 2,
          tilesYOffset = boardY,
          tilePositions = getBoardTilePositions(),
          index = x + y * TILES_WIDTH;

    const position = tilePositions[index],
          screen_x = position.x * boardWidth + tilesXOffset,
          screen_y = position.y * boardHeight + tilesYOffset;

    return vec(screen_x, screen_y);
}

function canvasToTile(screenLoc) {
    let x = screenLoc.x,
        y = screenLoc.y;

    // The tiles canvas is bigger than the board canvas
    x -= (tilesWidth - boardCanvasWidth) / 2;

    x -= boardX;
    y -= boardY;

    let prop_x = x / boardWidth,
        prop_y = y / boardHeight;

    if (prop_x < 0 || prop_x >= 1 || prop_y < 0 || prop_y >= 1)
        return VEC_NEG1;

    if (leftPlayer === darkPlayer) {
        prop_x = 1 - prop_x;
    }

    let closest_index = -1,
        closest_dist = -1;

    const tilePositions = getBoardTilePositions();

    for (let index = 0; index < tilePositions.length; ++index) {
        const pos = tilePositions[index],
              dx = pos.x - prop_x,
              dy = pos.y - prop_y,
              dist_sq = dx*dx + dy*dy;

        if (closest_index === -1 || dist_sq < closest_dist) {
            closest_index = index;
            closest_dist = dist_sq;
        }
    }

    const tile_x = closest_index % TILES_WIDTH,
          tile_y = Math.floor(closest_index / TILES_WIDTH);

    return vec(tile_x, tile_y);
}



//
// Layout of the player tiles and scores.
//

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

        lastRefresh: getTime(),
        renderedNameString: null,
        renderedIdleName: null,
        renderedActiveName: null
    };
}

function getPlayerRenderTarget(player) {
    return (player === leftPlayer ? leftPlayerRenderTarget : rightPlayerRenderTarget);
}

function resizeScores() {
    const tileWidth = getTileWidth();

    scoreWidth = 7 * tileWidth;
    scoreHeight = tileWidth * 2.25;

    const tilesCountWidth = scoreWidth,
          tilesCountHeight = scoreHeight + 0.5 * tileWidth;

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
    leftTiles.style.width = screenPixels(tilesCountWidth);
    leftTiles.style.height = screenPixels(tilesCountHeight);
    leftTiles.style.top = screenPixels(tilesCountTop);
    leftTiles.style.left = screenPixels(p1Left);

    rightTiles.width = tilesCountWidth;
    rightTiles.height = tilesCountHeight;
    rightTiles.style.width = screenPixels(tilesCountWidth);
    rightTiles.style.height = screenPixels(tilesCountHeight);
    rightTiles.style.top = screenPixels(tilesCountTop);
    rightTiles.style.left = screenPixels(p2Left);

    leftScore.width = scoreWidth;
    leftScore.height = scoreHeight;
    leftScore.style.width = screenPixels(scoreWidth);
    leftScore.style.height = screenPixels(scoreHeight);
    leftScore.style.top = screenPixels(scoreTop);
    leftScore.style.left = screenPixels(p1Left);

    rightScore.width = scoreWidth;
    rightScore.height = scoreHeight;
    rightScore.style.width = screenPixels(scoreWidth);
    rightScore.style.height = screenPixels(scoreHeight);
    rightScore.style.top = screenPixels(scoreTop);
    rightScore.style.left = screenPixels(p2Left);
}



//
// Layout of the dice.
//

const diceCanvas = document.getElementById("dice"),
      diceCtx = diceCanvas.getContext("2d");

let diceLeft = NaN,
    diceTop = NaN,
    diceWidth = NaN,
    diceHeight = NaN;

function resizeDice() {
    const space = Math.ceil(getTileWidth() * diceWidthRatio);

    diceWidth = 4 * space;
    diceHeight = 2.2 * space;
    diceCanvas.width = diceWidth + 1;
    diceCanvas.height = diceHeight + 1;
    diceCanvas.style.width = screenPixels(diceWidth);
    diceCanvas.style.height = screenPixels(diceHeight);

    layoutDice();
}

function layoutDice() {
    const centeringDelta = (scoreWidth - diceWidth) / 2;
    if(leftPlayer.active) {
        diceLeft = boardCanvasLeft - diceWidth - centeringDelta;
    } else {
        diceLeft = boardCanvasLeft + boardCanvasWidth + centeringDelta;
    }

    diceTop = centreTop - diceHeight / 2;
    diceCanvas.style.top = screenPixels(diceTop);
    diceCanvas.style.left = screenPixels(diceLeft);
    diceHovered = false;
}



//
// Layout of the fireworks overlay.
//

let overlayWidth = NaN,
    overlayHeight = NaN;

function resizeOverlay() {
    overlayWidth = Math.ceil(width / 3);
    overlayHeight = Math.ceil(height / 3);

    overlayCanvas.width = overlayWidth;
    overlayCanvas.height = overlayHeight;
}
