//
// This file contains the model for managing the dice.
//

import {getTime, LONG_TIME_AGO, randInt} from "@/common/utils";


export class Dice {

    active: boolean = false;
    rolling: boolean = false;
    canBeRolled: boolean = false;

    values: [number, number, number, number] = null;
    selected: number = 0;

    rollStartTime: number = LONG_TIME_AGO;
    selectTime: number = LONG_TIME_AGO;

    rollingValues: [number, number, number, number] = null;
    rollingValuesChangeTime: number = LONG_TIME_AGO;

    callback: () => void = null;

    count(): number {
        return Dice.count(this.values);
    }

    startRolling(selectDelay: number=0.25) {
        this.canBeRolled = false;
        this.rolling = true;
        this.values = null;
        this.selected = 0;
        this.rollStartTime = getTime();
        this.selectTime = getTime() + selectDelay;
        this.rollingValuesChangeTime = LONG_TIME_AGO;
    }

    setWaitingForRoll(keepPreviousValue?: boolean) {
        this.active = true;
        this.rolling = false;
        this.canBeRolled = true;
        this.rollStartTime = LONG_TIME_AGO;
        this.selectTime = LONG_TIME_AGO;
        this.rollingValues = this.values;
        this.rollingValuesChangeTime = LONG_TIME_AGO;
        if (keepPreviousValue) {
            this.selected = 4;
        } else {
            this.values = null;
            this.selected = 0;
        }
    }

    setValues(values: [number, number, number, number]) {
        this.active = false;
        this.values = values;
    }

    reset() {
        this.active = false;
        this.rolling = false;
        this.values = null;
        this.selected = 0;
        this.rollStartTime = LONG_TIME_AGO;
        this.selectTime = LONG_TIME_AGO;
        this.rollingValues = null;
        this.rollingValuesChangeTime = LONG_TIME_AGO;
        this.callback = null;
    }

    randomiseRollingDice() {
        this.rollingValues = Dice.generateRandomValues();
        this.rollingValuesChangeTime = getTime();
    }

    static generateRandomValues(): [number, number, number, number] {
        return [randInt(1, 7), randInt(1, 7), randInt(1, 7), randInt(1, 7)];
    }

    static isUp(value: number) {
        return value <= 3;
    }

    static count(values: number[]) {
        if (values === null)
            return 0;

        let diceUp = 0;
        for(let index = 0; index < values.length; ++index) {
            if(Dice.isUp(values[index])) {
                diceUp += 1;
            }
        }
        return diceUp;
    }
}

export const dice = new Dice();
