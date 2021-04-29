//
// This file contains the model for managing the dice.
//

/**
 * The time to roll the dice for before selecting their values.
 */
const DEFAULT_DICE_SELECT_DELAY = 0.25;

const dice = {
    active: false,
    rolling: false,
    canBeRolled: false,

    values: null,
    selected: 0,

    rollStartTime: LONG_TIME_AGO,
    selectTime: LONG_TIME_AGO,

    rollingValues: null,
    rollingValuesChangeTime: LONG_TIME_AGO,

    callback: null
};

function startRollingDice(selectDelay) {
    selectDelay = (selectDelay !== undefined ? selectDelay : DEFAULT_DICE_SELECT_DELAY);

    dice.canBeRolled = false;
    dice.rolling = true;
    dice.values = null;
    dice.selected = 0;
    dice.rollStartTime = getTime();
    dice.selectTime = getTime() + selectDelay;
    dice.rollingValuesChangeTime = LONG_TIME_AGO;
}

function setWaitingForDiceRoll(keepPreviousValue) {
    dice.active = true;
    dice.rolling = false;
    dice.canBeRolled = true;
    dice.rollStartTime = LONG_TIME_AGO;
    dice.selectTime = LONG_TIME_AGO;
    dice.rollingValues = dice.values;
    dice.rollingValuesChangeTime = LONG_TIME_AGO;
    if (keepPreviousValue) {
        dice.selected = 4;
    } else {
        dice.values = null;
        dice.selected = 0;
    }
}

function setDiceValues(values) {
    dice.active = false;
    dice.values = values;
}

function resetDice() {
    dice.active = false;
    dice.rolling = false;
    dice.values = null;
    dice.selected = 0;
    dice.rollStartTime = LONG_TIME_AGO;
    dice.selectTime = LONG_TIME_AGO;
    dice.rollingValues = null;
    dice.rollingValuesChangeTime = LONG_TIME_AGO;
    dice.callback = null;
}

function generateRandomDiceValues() {
    return [randInt(1, 7), randInt(1, 7), randInt(1, 7), randInt(1, 7)];
}

function randomiseRollingDice() {
    dice.rollingValues = generateRandomDiceValues();
    dice.rollingValuesChangeTime = getTime();
}

function isDiceUp(value) {
    return value <= 3;
}

function countDiceUp(values) {
    values = (values !== undefined ? values : dice.values);
    if(values === null)
        return 0;

    let diceUp = 0;
    for(let index = 0; index < values.length; ++index) {
        if(isDiceUp(values[index])) {
            diceUp += 1;
        }
    }
    return diceUp;
}
