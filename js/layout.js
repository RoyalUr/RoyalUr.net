//
// This file stores the logic for laying out the elements in the client.
//

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

    addTwitterButton();
}

function addTwitterButton() {
    document.getElementById("twitter-button").innerHTML = '<a class="twitter-follow-button" href="https://twitter.com/soth_dev" data-show-count="false"></a><script async src="http://platform.twitter.com/widgets.js" charset="utf-8"></script>';
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
    redraw(true);
}



//
// LOADING SCREEN
//

const loadingDiv = document.getElementById("loading");



//
// MENU
//

const menuDiv = document.getElementById("menu"),
      playButton = document.getElementById("play"),
      exitButton = document.getElementById("exit");



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

let boardWidthToHeightRatio = null,
    boardTileRegions = null,
    boardTilePositions = null,
    tileWidth = null;

function resizeBoard() {
    boardX = boardPadding;
    boardY = boardPadding;
    boardWidth = boardCanvasWidth - 2 * boardPadding;
    boardHeight = boardCanvasHeight - 2 * boardPadding;
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
    if (boardWidthToHeightRatio)
        return boardWidthToHeightRatio;

    const boardImage = getRawImageResource("board");
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



//
// SCORES
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

        renderedNameString: null,
        renderedIdleName: null,
        renderedActiveName: null
    };
}

function getPlayerRenderTarget(player) {
    return (player === ownPlayer ? leftPlayerRenderTarget : rightPlayerRenderTarget);
}



//
// DICE
//

const diceCanvas = document.getElementById("dice"),
    diceCtx = diceCanvas.getContext("2d");

let diceLeft = NaN,
    diceTop = NaN,
    diceWidth = NaN,
    diceHeight = NaN;

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



//
// NETWORK STATUS
//

const networkStatusElement = document.getElementById("network-status");



//
// MESSAGES
//

const messageContainerElement = document.getElementById("message-container"),
      messageElement = document.getElementById("message");



//
// OVERLAY
//

const overlayCanvas = document.getElementById("overlay"),
      overlayCtx = overlayCanvas.getContext("2d");

let overlayWidth = NaN,
    overlayHeight = NaN;

function resizeOverlay() {
    overlayWidth = Math.round(width / 3);
    overlayHeight = Math.round(height / 3);

    overlayCanvas.width = overlayWidth;
    overlayCanvas.height = overlayHeight;

    redrawOverlay();
}
