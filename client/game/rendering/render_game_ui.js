//
// This file contains the code to render the game's user interface.
// This includes the player's scores and tiles.
//

const scoreTileRatio = 0.8;

let renderedScoreText = {
    width: NaN,
    lastRefresh: -1,
    tiles: null,
    score: null
};

function drawScoreText(text, isActive, scale) {
    const renderedText = { width: NaN, img: null };
    renderedText.img = renderResource(scoreWidth, scoreHeight * scale, function(ctx) {
        const tileWidth = getTileWidth();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = Math.round(tileWidth * 1.6 * scale) + "px DuranGo";

        if (isActive) {
            ctx.save();
            ctx.shadowBlur = 5;
            ctx.shadowColor = rgba(255, 255, 255, 0.7);
            ctx.fillText(text, scoreWidth / 2, scoreHeight * scale / 2);
            ctx.restore();
        }

        ctx.fillStyle = rgb(255);
        ctx.fillText(text, scoreWidth / 2, scoreHeight * scale / 2);
        renderedText.width = ctx.measureText(text).width;
    });
    return renderedText;
}

function drawName(player, isActive) {
    return drawScoreText(player.name, isActive, 0.6);
}

function refreshRenderedScoreText() {
    // We refresh the score text periodically due to font-loading shenanigans.
    if (renderedScoreText.tiles != null && renderedScoreText.score != null) {
        const timeSinceRefresh = getTime() - renderedScoreText.lastRefresh;
        if (renderedScoreText.width === tilesWidth && timeSinceRefresh < 1)
            return;
    }

    renderedScoreText.lastRefresh = getTime();
    renderedScoreText.width = tilesWidth;
    renderedScoreText.tiles = drawScoreText("Tiles", false, 0.28);
    renderedScoreText.score = drawScoreText("Score", false, 0.28);
}

function getRenderedTilesText() {
    refreshRenderedScoreText();
    return renderedScoreText.tiles;
}

function getRenderedScoreText() {
    refreshRenderedScoreText();
    return renderedScoreText.score;
}

function getRenderedPlayerName(player) {
    const renderTarget = getPlayerRenderTarget(player);

    const timeSinceRefresh = getTime() - renderTarget.lastRefresh;
    if(renderTarget.renderedIdleName === null || renderTarget.renderedActiveName === null
        || scoreWidth !== renderTarget.renderedIdleName.width || player.name !== renderTarget.renderedNameString
        || timeSinceRefresh > 1) {

        renderTarget.lastRefresh = getTime();
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

    const potentialMoveTile = getDrawPotentialMoveTile();
    const highlightStartTile = (
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
        scoreCtx, player.playerNo, tileWidth * 1.75,
        player.score.current, false
    );

    tilesCtx.drawImage(getRenderedTilesText().img, 0, 1.25 * tileWidth);
    scoreCtx.drawImage(getRenderedScoreText().img, 0, 0.7 * tileWidth);

    tilesCtx.save();
    const renderedPlayerName = getRenderedPlayerName(player);
    tilesCtx.globalAlpha = (!player.active || !player.connected ? 0.8 : 1);
    tilesCtx.drawImage(renderedPlayerName.img, 0, 0);
    if (!player.connected) {
        const x = renderedPlayerName.img.width/2 + renderedPlayerName.width/2 + 0.25*tileWidth,
            y = (isLastCharCapitalised(player.name) ? 0.2 : 0.225) * tileWidth,
            width = 0.5 * tileWidth,
            angle = (getTime() % 1) * 2*Math.PI;

        tilesCtx.strokeStyle = "#FFFFFF";
        tilesCtx.lineWidth = 0.2*width;
        tilesCtx.lineCap = "butt";

        tilesCtx.beginPath();
        tilesCtx.arc(x, y, 0.125*tileWidth, angle, angle + 1.6*Math.PI);
        tilesCtx.stroke();
    }
    tilesCtx.restore();
}

function isLastCharCapitalised(string) {
    const last = string[string.length - 1];
    return last === last.toUpperCase();
}

function redrawScores(forceRedraw) {
    if (!isOnScreen(GAME_VISIBLE_SCREENS))
        return;

    redrawPlayerScores(leftPlayer, false);
    redrawPlayerScores(rightPlayer, true);
}
