import {getTime, LONG_TIME_AGO} from "@/common/utils";
import {Milliseconds} from "@/common/units";


/**
 * Whether a fade is fading/faded in, or fading/faded out.
 */
export enum FadeDirection {
    OUT = 1,
    IN = 2
}
export namespace FadeDirection {
    export function inIf(fadeIn: boolean): FadeDirection {
        return fadeIn ? FadeDirection.IN : FadeDirection.OUT;
    }
}

/**
 * Allows controlling animations based on linearly interpolating between 0 and 1.
 */
export class Fade {

    readonly defaultInDuration: number;
    readonly defaultOutDuration: number;

    direction: FadeDirection = FadeDirection.OUT;
    start: Milliseconds = LONG_TIME_AGO;
    duration: Milliseconds = -1;

    constructor(defaultInDuration?: Milliseconds, defaultOutDuration?: Milliseconds) {
        this.defaultInDuration = (defaultInDuration === undefined ? -1 : defaultInDuration);
        this.defaultOutDuration = (defaultOutDuration === undefined ? this.defaultInDuration : defaultOutDuration);
    }

    getRaw0To1(): number {
        const time = getTime();
        if(time >= this.start + this.duration)
            return 1;
        if(time <= this.start)
            return 0;
        return (time - this.start) / this.duration;
    }

    get(): number {
        const raw = this.getRaw0To1();
        return this.direction === FadeDirection.IN ? raw : 1 - raw;
    }

    isFadeIn(): boolean {
        return this.direction == FadeDirection.IN;
    }

    isFadeOut(): boolean {
        return this.direction == FadeDirection.OUT;
    }

    fade(direction: FadeDirection, duration?: Milliseconds, fromStart?: boolean): Fade {
        if (duration === undefined) {
            duration = (direction == FadeDirection.IN ? this.defaultInDuration : this.defaultOutDuration);
        }

        const currentValue = this.get();
        this.start = getTime();
        this.direction = direction;
        this.duration = duration;

        // Correct the start time so the get() value never jumps.
        if (!fromStart) {
            if(direction == FadeDirection.IN) {
                this.start -= currentValue * this.duration;
            } else {
                this.start -= (1 - currentValue) * this.duration;
            }
        }
        return this;
    }

    fadeInOrOut(fadeIn: boolean, duration?: Milliseconds): Fade {
        return this.fade(FadeDirection.inIf(fadeIn), duration);
    }

    fadeIn(duration?: Milliseconds): Fade {
        return this.fade(FadeDirection.IN, duration);
    }

    fadeOut(duration?: Milliseconds): Fade {
        return this.fade(FadeDirection.OUT, duration);
    }

    visible(): Fade {
        return this.fadeIn(0);
    }

    invisible(): Fade {
        return this.fadeOut(0);
    }
}

/**
 * An asymmetric fade which fades in, waits, and then fades out.
 */
export class StagedFade extends Fade {

    readonly inDuration: Milliseconds;
    readonly stayDuration: Milliseconds;
    readonly outDuration: Milliseconds;
    readonly inRatio: number;
    readonly stayRatio: number;
    readonly outRatio: number;

    constructor(inDuration: Milliseconds, stayDuration: Milliseconds, outDuration: Milliseconds) {
        super(inDuration + stayDuration + outDuration, outDuration);

        this.inDuration = inDuration;
        this.stayDuration = stayDuration;
        this.outDuration = outDuration;
        this.inRatio = inDuration / this.defaultInDuration;
        this.stayRatio = stayDuration / this.defaultInDuration;
        this.outRatio = outDuration / this.defaultInDuration;
    }

    get(): number {
        let value = super.get();
        if (super.isFadeOut())
            return value;
        if (value <= this.inRatio)
            return value / this.inRatio;
        if (value <= this.inRatio + this.stayRatio)
            return 1;
        return (1 - value) / this.outRatio;
    }

    isFadeIn(): boolean {
        if (this.isFadeOut())
            return false;
        return super.get() <= this.inDuration + this.stayDuration;
    }

    isFadeOut(): boolean {
        return !this.isFadeIn();
    }

    fade(direction: FadeDirection, duration?: Milliseconds, fromStart?: boolean): Fade {
        const currentValue = this.get();
        super.fade(direction, duration, fromStart);

        // Correct the start time so that the fades line up.
        if (!fromStart) {
            if (direction == FadeDirection.IN) {
                this.start += currentValue * this.inDuration;
            } else {
                this.start -= (1 - currentValue) * this.outDuration;
            }
        }
        return this;
    }
}
