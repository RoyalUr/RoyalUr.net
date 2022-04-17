//
// This file stores and manages the state of the game.
//


import {Fade, StagedFade} from "@/common/fades";
import {getTime, LONG_TIME_AGO} from "@/common/utils";



//
// MESSAGES
//

export class MessageDisplay {

    title: string = "";
    subtitle: string = "";
    dismissable: boolean = true;
    fade: Fade = new Fade(0);

    setWithFade(title: string, subtitle: string, dismissible: boolean, fade: Fade) {
        this.title = title;
        this.subtitle = subtitle;
        this.dismissable = dismissible;
        this.fade = fade;
    }

    set(title: string, subtitle: string,
        dismissible: boolean=false,
        fadeInTime: number=0.25,
        stayTime: number=2,
        fadeOutTime: number=0.25) {

        const fade = new StagedFade(fadeInTime, stayTime, fadeOutTime).fadeIn();
        this.setWithFade(title, subtitle, dismissible, fade)
    }
}

export const message: MessageDisplay = new MessageDisplay();



//
// NETWORK STATUS
//

export class NetworkStatus {

    status: string = "";
    connected: boolean = false;

    readonly fade: Fade = new Fade(1.0);
    hidden: boolean = false;

    dots: boolean = false;
    lastChange: number = LONG_TIME_AGO;

    set(status: string, dots: boolean=false) {
        this.status = status;
        this.connected = (status === "Connected");
        this.fade.visible();
        this.dots = dots;
        this.lastChange = getTime();
    }

    reset() {
        this.status = "";
        this.connected = false;
        this.fade.invisible();
        this.dots = false;
        this.lastChange = 0;
    }

    fadeIn() {
        this.fade.fadeIn();
    }

    fadeOut() {
        this.fade.fadeOut();
    }

    private createDots(): string {
        const time = getTime() - this.lastChange,
              dotCount = Math.floor((time * 3) % 3) + 1;

        let dots = "";
        for (let i=0; i < 3; ++i) {
            dots += (i < dotCount ? "." : "\u00a0" /*&nbsp;*/);
        }
        return dots;
    }

    get(): string {
        if (!this.dots)
            return this.status;

        return this.status + this.createDots();
    }
}

export const networkStatus: NetworkStatus = new NetworkStatus();
