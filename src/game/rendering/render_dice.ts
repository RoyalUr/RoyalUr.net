//
// This file contains code to render the dice in the game.
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

function redrawDice(forceRedraw?: boolean) {
    // Avoid redrawing if we don't have to.
    if (!isOnScreen(GAME_VISIBLE_SCREENS))
        return;

    const canBeRolled = (dice.canBeRolled && !dice.rolling);
    setElemStyle(diceCanvas, "cursor", canBeRolled ? "pointer" : "");

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
            if (dice.callback) {
                dice.callback();
            }
        }
    }

    const space = diceWidth / 4,
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

        paintDice(diceCtx, diceImage, diceWidth, (index + 0.5) * space, 1.15 * space, diceHighlighted);
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
    diceCtx.fillText("Roll", diceWidth / 2, 0.4 * space);

    diceCtx.fillStyle = "white";
    diceCtx.font = (space * 0.8) + "px DuranGo";
    diceCtx.fillText((dice.selected === 0 ? "0" : "" + countDiceUp()), diceWidth / 2, 1.95 * space);

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