//
// This file stores the logic for laying out the elements in the client.
//

const maxWidthOnHeightRatio = 1.5;

const menuDiv = document.getElementById("menu"),
      playButton = document.getElementById("play"),
      playButtonCanvas = document.getElementById("play-canvas"),
      playButtonCtx = playButtonCanvas.getContext("2d"),
      playButtonTiles = playButton.getElementsByTagName("img"),
      learnButton = document.getElementById("learn"),
      learnButtonCanvas = document.getElementById("learn-canvas"),
      learnButtonCtx = learnButtonCanvas.getContext("2d"),
      watchButton = document.getElementById("watch"),
      watchButtonCanvas = document.getElementById("watch-canvas"),
      watchButtonCtx = watchButtonCanvas.getContext("2d"),
      exitButton = document.getElementById("exit");

const playSelectDiv = document.getElementById("play-select"),
      playOnlineButton = document.getElementById("play-online"),
      playComputerButton = document.getElementById("play-computer");

const loadingDiv = document.getElementById("loading");

const boardCanvas = document.getElementById("board"),
      boardCtx = boardCanvas.getContext("2d");

const tilesCanvas = document.getElementById("tiles"),
      tilesCtx = tilesCanvas.getContext("2d");

const networkStatusElement = document.getElementById("network-status");

const messageContainerElement = document.getElementById("message-container"),
      messageElement = document.getElementById("message");

const overlayCanvas = document.getElementById("overlay"),
      overlayCtx = overlayCanvas.getContext("2d");


let width = NaN,
    height = NaN,
    useWidth = NaN,
    useHeight = NaN,
    viewport = null,
    centreLeft = NaN,
    centreTop = NaN;

let mouseLoc = VEC_NEG1,
    hoveredTile = VEC_NEG1;

let mouseDown = false,
    mouseDownTime = LONG_TIME_AGO,
    mouseDownLoc = VEC_NEG1,
    draggedTile = VEC_NEG1;

function setupElements() {
    playButton.addEventListener("click", onPlayClick);
    exitButton.addEventListener("click", onExitClick);

    // Adjust the font sizes of the play select options to fit their bounding boxes
    fitty(".play-select-text", {
        // Ensure all play select options have the same font size
        couplingGroup: "play-select-text",

        // We don't want the text to take up the whole available space
        padding: 0.05
    });

    playSelectDiv.addEventListener("click", onExitClick);

    playOnlineButton.addEventListener("click", onPlayOnline);
    playComputerButton.addEventListener("click", onPlayComputer);

    diceCanvas.addEventListener("click", function() { game.onDiceClick(); });
    diceCanvas.addEventListener("mouseover", function() { diceHovered = true; });
    diceCanvas.addEventListener("mouseout",  function() { diceHovered = false; });

    playButton.addEventListener("mouseover", function() { menuState.playButton = BUTTON_STATE_HOVERED; });
    playButton.addEventListener("mouseout", function() { menuState.playButton = BUTTON_STATE_INACTIVE; });

    learnButton.addEventListener("mouseover", function() { menuState.learnButton = BUTTON_STATE_HOVERED; });
    learnButton.addEventListener("mouseout", function() { menuState.learnButton = BUTTON_STATE_INACTIVE; });

    watchButton.addEventListener("mouseover", function() { menuState.watchButton = BUTTON_STATE_HOVERED; });
    watchButton.addEventListener("mouseout", function() { menuState.watchButton = BUTTON_STATE_INACTIVE; });

    function updateMouse(loc, down) {
        mouseLoc = loc;

        const newHoveredTile = canvasToTile(loc);
        if(!vecEquals(hoveredTile, newHoveredTile)) {
            game.onTileHover(newHoveredTile);
        }
        hoveredTile = newHoveredTile;

        if(down === undefined)
            return;

        if(down) {
            mouseDown = true;
            mouseDownTime = getTime();
            mouseDownLoc = loc;
            draggedTile = hoveredTile;
        } else {
            mouseDown = false;
            mouseDownTime = LONG_TIME_AGO;
            mouseDownLoc = VEC_NEG1;
            draggedTile = VEC_NEG1;
        }
    }

    window.onresize = function(event) {
        window.requestAnimationFrame(resize);
    };

    document.onmousemove = function(event) {
        if (!game)
            return;

        const loc = vec(
            event.clientX - tilesLeft,
            event.clientY - tilesTop
        );
        updateMouse(loc);
    };

    document.body.onmousedown = function(event) {
        if (!game)
            return;

        updateMouse(mouseLoc, true);
        game.onTileClick(hoveredTile);

        event.preventDefault();
    };

    document.onmouseup = function(event) {
        if (!game)
            return;

        game.onTileRelease(hoveredTile);
        updateMouse(mouseLoc, false);
    };

    // addTwitterButton();
}

function addTwitterButton() {
    const button = document.getElementById("twitter-button"),
          link = document.createElement("a"),
          script = document.createElement("script");

    link.setAttribute("href", "https://twitter.com/soth_dev?ref_src=twsrc%5Etfw");
    link.setAttribute("class", "twitter-follow-button");
    link.setAttribute("data-show-count", "false");

    button.appendChild(link);

    script.setAttribute("charset", "utf-8");
    script.setAttribute("src", "https://platform.twitter.com/widgets.js");

    button.appendChild(script);
}

function resize() {
    viewport = document.body.getBoundingClientRect();
    centreLeft = Math.round((viewport.left + viewport.right) / 2);
    centreTop = Math.round((viewport.top + viewport.bottom) / 2);
    width = viewport.right - viewport.left;
    height = viewport.bottom - viewport.top;
    useWidth = width;
    useHeight = min(useWidth / maxWidthOnHeightRatio, height);

    resizeMenu();
    resizeBoard();
    resizeScores();
    resizeDice();
    resizeOverlay();

    redraw(true);
}



//
// MENU
//

const menuWidthOnHeightRatio = 760 / 840,
      menuVerticalPadding = 0.1,
      buttonMenuWidthPercentage = 0.5;

function layoutButton(buttonElem, canvasElem, ctx, imageKey, menuWidth, buttonWidth) {
    const image = getImageResource(imageKey, buttonWidth),
          height = calcImageHeight(image, buttonWidth);

    buttonElem.style.width = menuWidth + "px";
    buttonElem.style.height = height + "px";

    canvasElem.width = buttonWidth;
    canvasElem.height = height;
    canvasElem.style.width = buttonWidth + "px";
    canvasElem.style.height = height + "px";
}

function resizeMenu() {
    let menuWidth = menuWidthOnHeightRatio * height * (1 - 2 * menuVerticalPadding);
    if (menuWidth > width) {
        menuWidth = width;
    }

    const buttonWidth = menuWidth * buttonMenuWidthPercentage;

    menuDiv.style.width = menuWidth + "px";

    layoutButton(playButton, playButtonCanvas, playButtonCtx, "play", menuWidth, buttonWidth);
    layoutButton(learnButton, learnButtonCanvas, learnButtonCtx, "learn", menuWidth, buttonWidth);
    layoutButton(watchButton, watchButtonCanvas, watchButtonCtx, "watch", menuWidth, buttonWidth);

    // Set the spacing between the buttons and title
    playButton.style.marginTop = 0.05 * buttonWidth + "px";
    playButton.style.marginBottom = 0.1 * buttonWidth + "px";
    learnButton.style.marginBottom = 0.05 * buttonWidth + "px";

    // Set the size and spacing of the play selection buttons
    const playButtonWidth = min(buttonWidth, width / 2),
          playButtonSpacing = min(playButtonWidth / 2, (width - playButtonWidth * 2) / 3),
          onlineLeft = (width - playButtonSpacing) / 2 - playButtonWidth,
          computerLeft = (width + playButtonSpacing) / 2;

    playOnlineButton.style.width = playButtonWidth + "px";
    playOnlineButton.style.left = onlineLeft + "px";

    playComputerButton.style.width = playButtonWidth + "px";
    playComputerButton.style.left = computerLeft + "px";
}



//
// BOARD
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
    boardCanvasWidth = Math.round((useHeight - 2 * boardPadding) / getBoardWidthToHeightRatio()) + 2 * boardPadding;
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
            const loc = vec(x, y);
            if (!isTileOnBoard(loc))
                continue;

            cumulativeTileWidth += regions[x + y * TILES_WIDTH].width;
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

        boardTileRegions.push({
            x: x / boardImgWidth,
            y: y / boardImgHeight,
            width: width / boardImgWidth,
            height: height / boardImgHeight
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

function tileToCanvas(tileLoc) {
    let x = tileLoc.x,
        y = tileLoc.y;

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

    if (ownPlayer === darkPlayer) {
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

function resizeScores() {
    const tileWidth = getTileWidth();

    scoreWidth = 7 * tileWidth;
    scoreHeight = tileWidth * 1.75;

    const tilesCountWidth = scoreWidth,
          tilesCountHeight = scoreHeight + tileWidth;

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



//
// DICE
//

const diceCanvas = document.getElementById("dice"),
      diceCtx = diceCanvas.getContext("2d");

let diceLeft = NaN,
    diceTop = NaN,
    diceWidth = NaN,
    diceHeight = NaN;

function resizeDice() {
    const space = Math.round(getTileWidth() * diceWidthRatio);

    diceWidth = 4 * space;
    diceHeight = 3 * space;
    diceCanvas.width = diceWidth;
    diceCanvas.height = diceHeight;

    layoutDice();
}

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
// OVERLAY
//

let overlayWidth = NaN,
    overlayHeight = NaN;

function resizeOverlay() {
    overlayWidth = Math.round(width / 3);
    overlayHeight = Math.round(height / 3);

    overlayCanvas.width = overlayWidth;
    overlayCanvas.height = overlayHeight;
}
