//
// This file contains the code to render the game's user interface.
// This includes the player's scores and tiles, as well as the dice.
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



//
// Rendering of the dice.
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
    // Avoid redrawing if we don't have to.
    if (!isOnScreen(GAME_VISIBLE_SCREENS))
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
                audioSystem.playSound("dice_select");
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
            audioSystem.playSound("dice_hit");
        }
        diceDown[index] = down;

        if(diceValue !== lastDice[index] && (time - lastDiceSound) > 0.1) {
            lastDice[index] = diceValue;
            lastDiceSound = time;

            if (dice.rolling || (timeToSelect >= -DICE_FALL_DURATION && timeToSelect <= DICE_FALL_DURATION)) {
                audioSystem.playSound("dice_click");
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

    diceCtx.fillStyle = "white";
    diceCtx.font = (space * 0.8) + "px DuranGo";
    diceCtx.fillText((dice.selected === 0 ? "0" : "" + countDiceUp()), diceWidth / 2, 2.3 * space);

    diceCtx.restore();
}

function getDiceImageFromValue(diceValue, width) {
    switch(diceValue) {
        case 1:
        case 2:
        case 3:
            return imageSystem.getImageResource("dice_up" + diceValue, width);
        case 4:
        case 5:
        case 6:
            return imageSystem.getImageResource("dice_down" + (diceValue - 3), width);
        default:
            return null;
    }
}

function paintDice(ctx, diceImage, width, centreLeft, centreTop, lightShadow) {
    ctx.save();

    const shadow = imageSystem.getImageResource((lightShadow ? "dice_light_shadow" : "dice_dark_shadow"), width);
    ctx.drawImage(shadow, centreLeft - width / 2, centreTop - width / 2, width, width);
    ctx.drawImage(diceImage, centreLeft - width / 2, centreTop - width / 2, width, width);

    ctx.restore();
}