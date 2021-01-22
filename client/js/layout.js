//
// This file stores the logic for laying out the elements in the client.
//

const maxWidthOnHeightRatio = 1.5;

const menuOuterDiv = document.getElementById("menu-outer"),
      menuDiv = document.getElementById("menu"),
      menuTitleDiv = document.getElementById("title"),
      playButton = document.getElementById("play-button"),
      playButtonCanvas = document.getElementById("play-canvas"),
      playButtonCtx = playButtonCanvas.getContext("2d"),
      playButtonTiles = playButton.getElementsByTagName("img"),
      learnButton = document.getElementById("learn-button"),
      learnButtonCanvas = document.getElementById("learn-canvas"),
      learnButtonCtx = learnButtonCanvas.getContext("2d"),
      watchButton = document.getElementById("watch-button"),
      watchButtonCanvas = document.getElementById("watch-canvas"),
      watchButtonCtx = watchButtonCanvas.getContext("2d");

const controlsDiv = document.getElementById("controls"),
      discordControlButton = document.getElementById("discord-control"),
      githubControlButton = document.getElementById("github-control"),
      settingsControlButton = document.getElementById("settings-control"),
      learnControlButton = document.getElementById("learn-control"),
      exitControlButton = document.getElementById("exit-control");

const playSelectDiv = document.getElementById("play-select"),
      playLocalButton = document.getElementById("play-local"),
      playOnlineButton = document.getElementById("play-online"),
      playComputerButton = document.getElementById("play-computer"),
      playSelectDescriptionDiv = document.getElementById("play-select-description");

const difficultyDiv = document.getElementById("computer-difficulty"),
      playComputerEasyButton = document.getElementById("play-computer-easy"),
      playComputerMediumButton = document.getElementById("play-computer-medium"),
      playComputerHardButton = document.getElementById("play-computer-hard");

const learnDiv = document.getElementById("learn");

const loadingDiv = document.getElementById("loading"),
      loadingTextSpan = document.getElementById("loading-text");

const boardCanvas = document.getElementById("board"),
      boardCtx = boardCanvas.getContext("2d");

const tilesCanvas = document.getElementById("tiles"),
      tilesCtx = tilesCanvas.getContext("2d");

const winDiv = document.getElementById("win"),
      winMessageDiv = document.getElementById("winner-message"),
      winBackButton = document.getElementById("win-back-button");

const networkStatusElement = document.getElementById("network-status");

const messageContainerElement = document.getElementById("message-container"),
      messageTitleElement = document.getElementById("message-title"),
      messageSubtitleElement = document.getElementById("message-subtitle"),
      joinDiscordElement = document.getElementById("join-discord"),
      starGithubElement = document.getElementById("star-github");

const overlayCanvas = document.getElementById("overlay"),
      overlayCtx = overlayCanvas.getContext("2d");

const creditsDiv = document.getElementById("credits");
const learnBackButton = document.getElementById("learn-back-button");

const dynamicImagesByClass = {
    "logo_image": "logo_with_shadow",
    "play_local_image": "play_local",
    "play_online_image": "play_online",
    "play_computer_image": "play_computer",
    "tile_dark_image": "tile_dark",
};


let width = NaN,
    height = NaN,
    useWidth = NaN,
    useHeight = NaN,
    centreLeft = NaN,
    centreTop = NaN;

let mouseLoc = VEC_NEG1,
    hoveredTile = VEC_NEG1;

let mouseDown = false,
    mouseDownTime = LONG_TIME_AGO,
    mouseDownLoc = VEC_NEG1,
    draggedTile = VEC_NEG1;

function setupMenuElements() {
    playButton.addEventListener("click", onPlayClick);
    learnButton.addEventListener("click", onLearnClick);

    settingsControlButton.addEventListener("click", onSettingsControlClick);
    learnControlButton.addEventListener("click", onLearnControlClick);
    exitControlButton.addEventListener("click", onExitClick);
    learnBackButton.addEventListener("click", onExitClick);
    winBackButton.addEventListener("click", onExitClick);

    messageContainerElement.addEventListener("click", tryDismissMessage);

    // Adjust the font sizes of the play select options to fit their bounding boxes.
    fitty(".play-select-text", {
        couplingGroup: "play-select-text", // Ensure all play select options have the same font size.
        padding: 0.05
    });

    playSelectDiv.addEventListener("click", onExitClick);
    difficultyDiv.addEventListener("click", onExitClick);

    playLocalButton.addEventListener("click", onPlayLocal);
    playOnlineButton.addEventListener("click", onPlayOnline);
    playComputerButton.addEventListener("click", onPlayComputer);

    playLocalButton.addEventListener("mouseover", onHoverPlayLocal);
    playOnlineButton.addEventListener("mouseover", onHoverPlayOnline);
    playComputerButton.addEventListener("mouseover", onHoverPlayComputer);

    playLocalButton.addEventListener("mouseout", onPlayUnhover);
    playOnlineButton.addEventListener("mouseout", onPlayUnhover);
    playComputerButton.addEventListener("mouseout", onPlayUnhover);

    playComputerEasyButton.addEventListener("click", onPlayComputerEasy);
    playComputerMediumButton.addEventListener("click", onPlayComputerMedium);
    playComputerHardButton.addEventListener("click", onPlayComputerHard);

    playButton.addEventListener("mouseover", function() { menuState.playButton = BUTTON_STATE_HOVERED; });
    playButton.addEventListener("mouseout", function() { menuState.playButton = BUTTON_STATE_INACTIVE; });

    learnButton.addEventListener("mouseover", function() { menuState.learnButton = BUTTON_STATE_HOVERED; });
    learnButton.addEventListener("mouseout", function() { menuState.learnButton = BUTTON_STATE_INACTIVE; });

    watchButton.addEventListener("mouseover", function() { menuState.watchButton = BUTTON_STATE_HOVERED; });
    watchButton.addEventListener("mouseout", function() { menuState.watchButton = BUTTON_STATE_INACTIVE; });

    // Set the src properties of all the dynamic images.
    for (let className in dynamicImagesByClass) {
        if (!dynamicImagesByClass.hasOwnProperty(className))
            continue;

        const imageKey = dynamicImagesByClass[className],
              image = getImageResource(imageKey),
              imageURL = getImageURL(imageKey),
              elements = document.getElementsByClassName(className);

        for (let index = 0; index < elements.length; ++index) {
            const element = elements[index];
            element.width = image.width;
            element.height = image.height;
            element.src = imageURL;
        }
    }
    window.onresize = () => {window.requestAnimationFrame(resize);};
}

function setupGameElements() {
    diceCanvas.addEventListener("click", function() { if (game) {game.onDiceClick();} });
    diceCanvas.addEventListener("mouseover", function() { diceHovered = true; });
    diceCanvas.addEventListener("mouseout",  function() { diceHovered = false; });

    const updateMouse = function(loc, down) {
        mouseLoc = loc;

        const newHoveredTile = canvasToTile(loc);
        if(game && !vecEquals(hoveredTile, newHoveredTile)) {
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
    };
    document.onmousemove = function(event) {
        if (!game) return;
        updateMouse(vec(
            fromScreenPixels(event.clientX) - tilesLeft,
            fromScreenPixels(event.clientY) - tilesTop
        ));
    };
    document.body.onmousedown = function(event) {
        if (mouseDown) return;
        updateMouse(mouseLoc, true);
        if (!game) return;
        game.onTileClick(hoveredTile);
        event.preventDefault();
    };
    document.onmouseup = function(event) {
        if (!mouseDown) return;
        try {
            if (!game) return;
            game.onTileRelease(hoveredTile);
        } finally {
            updateMouse(mouseLoc, false);
        }
    };
    tilesCanvas.ontouchmove = function(event) {
        if (!game || event.touches.length !== 1) return;
        const touch = event.touches[0];
        updateMouse(vec(
            fromScreenPixels(touch.clientX) - tilesLeft,
            fromScreenPixels(touch.clientY) - tilesTop
        ));
        event.preventDefault();
    };
    tilesCanvas.ontouchstart = function(event) {
        if (event.touches.length !== 1) {
            updateMouse(mouseLoc, false);
            return;
        } else if (mouseDown) return;
        const touch = event.touches[0];
        updateMouse(vec(
            fromScreenPixels(touch.clientX) - tilesLeft,
            fromScreenPixels(touch.clientY) - tilesTop
        ), true);

        if (!game) return;
        game.onTileTouchClick(hoveredTile);
        event.preventDefault();
    };
    tilesCanvas.ontouchend = function(event) {
        if (!mouseDown) return;
        try {
            if (!game) return;
            game.onTileTouchRelease(hoveredTile);
            event.preventDefault();
        } finally {
            updateMouse(VEC_NEG1, false);
        }
    };
}

function toScreenPixels(size) {
    return size / window.devicePixelRatio;
}

function fromScreenPixels(size) {
    return size * window.devicePixelRatio;
}

function screenPixels(size) {
    return Math.round(toScreenPixels(size)) + "px";
}

function resize() {
    width = Math.round(document.documentElement.clientWidth * window.devicePixelRatio);
    height = Math.round(document.documentElement.clientHeight * window.devicePixelRatio);
    centreLeft = Math.round(width / 2);
    centreTop = Math.round(height / 2);
    useWidth = width;
    useHeight = min(Math.round(useWidth / maxWidthOnHeightRatio), height);

    resizeMenu();
    resizeOverlay();

    if (loading.stage > 1) {
        resizeBoard();
        resizeScores();
        resizeDice();
    }
    redraw(true);
}



//
// Layout of the menu screen.
//

const menuWidthOnHeightRatio = 760 / 840,
      menuVerticalPadding = 0.1,
      buttonMenuWidthPercentage = 0.5;

function layoutButton(buttonElem, canvasElem, ctx, imageKey, menuWidth, buttonWidth) {
    const image = getImageResource(imageKey, buttonWidth),
          height = calcImageHeight(image, buttonWidth);

    buttonElem.style.width = screenPixels(menuWidth);
    buttonElem.style.height = screenPixels(height);

    canvasElem.width = buttonWidth;
    canvasElem.height = height;
    canvasElem.style.width = screenPixels(buttonWidth);
    canvasElem.style.height = screenPixels(height);
}

function resizeMenu() {
    let menuWidth = menuWidthOnHeightRatio * height * (1 - 2 * menuVerticalPadding);
    if (menuWidth > width) {
        menuWidth = width;
    }

    const buttonWidth = menuWidth * buttonMenuWidthPercentage;

    menuDiv.style.width = screenPixels(menuWidth);

    layoutButton(playButton, playButtonCanvas, playButtonCtx, "play", menuWidth, buttonWidth);
    layoutButton(learnButton, learnButtonCanvas, learnButtonCtx, "learn", menuWidth, buttonWidth);
    layoutButton(watchButton, watchButtonCanvas, watchButtonCtx, "watch", menuWidth, buttonWidth);

    // Set the spacing between the buttons and title
    playButton.style.marginTop = screenPixels(0.05 * buttonWidth);
    playButton.style.marginBottom = screenPixels(0.1 * buttonWidth);
    learnButton.style.marginBottom = screenPixels(0.05 * buttonWidth);

    // Set the size and spacing of the play selection buttons
    const numButtons = 3,
          playButtonWidth = min(buttonWidth, width / numButtons),
          playButtonSpacing = min(playButtonWidth / 2, (width - playButtonWidth * numButtons) / (numButtons + 1)),
          buttonSeparation = playButtonSpacing / numButtons + playButtonWidth,
          middleAnchor = width / 2 - 0.5 * playButtonWidth;

    function layoutPlayButton(elem, left) {
        elem.style.width = screenPixels(playButtonWidth);
        elem.style.left = screenPixels(left);
    }
    layoutPlayButton(playLocalButton, middleAnchor - buttonSeparation);
    layoutPlayButton(playOnlineButton, middleAnchor);
    layoutPlayButton(playComputerButton, middleAnchor + buttonSeparation);

    playSelectDescriptionDiv.style.width = screenPixels(width);
    playSelectDescriptionDiv.style.top = screenPixels(0.5 * height + buttonSeparation / 2);
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
    boardCanvasWidth = Math.round((useHeight - 2 * boardPadding) / getBoardWidthToHeightRatio()) + 2 * boardPadding;
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
        return Math.round(tileWidth * boardWidth);

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

    return Math.round(tileWidth * boardWidth);
}

function getBoardWidthToHeightRatio() {
    if (boardWidthToHeightRatio)
        return boardWidthToHeightRatio;

    const boardImage = getImageResource("board");
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

function tileToCanvas(tileLoc) {
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
    const space = Math.round(getTileWidth() * diceWidthRatio);

    diceWidth = 4 * space;
    diceHeight = 3 * space;
    diceCanvas.width = diceWidth;
    diceCanvas.height = diceHeight;
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
    overlayWidth = Math.round(width / 3);
    overlayHeight = Math.round(height / 3);

    overlayCanvas.width = overlayWidth;
    overlayCanvas.height = overlayHeight;
}
