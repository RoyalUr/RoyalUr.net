//
// This file contains the code that manages the playing of audio.
//

import {LONG_TIME_AGO, getTime, randElement, error} from "@/common/utils"
import {AudioResource} from "./resource_types.js";
import {ResourceLoader} from "@/common/resources/resource_loader";


/** When the audio is errored, how long to wait before trying to play audio again. **/
const ERRORED_AUDIO_PAUSE_DURATION = 60;

export class AudioSystem {

    readonly resourceLoader: ResourceLoader;
    readonly audioPacks: {[key: string]: string[]};

    muted: boolean = false;
    volume: number = 0.5;
    readonly errors: string[] = [];
    lastErrorTime: number = LONG_TIME_AGO;

    constructor(resourceLoader: ResourceLoader, audioPacks: {[key: string]: string[]}) {
        this.resourceLoader = resourceLoader;
        this.audioPacks = audioPacks;
    }

    isErrored() {
        return this.errors.length >= 5 && getTime() - this.lastErrorTime < ERRORED_AUDIO_PAUSE_DURATION;
    }

    setMuted(muted: boolean) {
        this.muted = muted;
        this.updateAudioElements();
    }

    setVolume(volume: number) {
        this.volume = volume;
        this.updateAudioElements();
    }

    updateAudioElements() {
        const resources = this.resourceLoader.allResources;
        for (let index = 0; index < resources.length; ++index) {
            const resource = resources[index];
            if (resource instanceof AudioResource) {
                resource.updateElementSettings(this);
            }
        }
    }

    playSound(key: string, onCompleteCallback?: () => void, overrideTabActive?: boolean): HTMLAudioElement {
        // We usually don't want to play any sounds if the tab is not active.
        if (document.hidden && !overrideTabActive)
            return null;

        // Allow random choice of sound from packs of audio clips.
        if(this.audioPacks[key]) {
            key = randElement(this.audioPacks[key]);
        }

        // Find and play the sound.
        const resources = this.resourceLoader.allResources;
        for (let index = 0; index < resources.length; ++index) {
            const resource = resources[index];
            if (resource instanceof AudioResource && resource.name === key)
                return resource.play(this, onCompleteCallback);
        }
        error("Unable to find the sound \"" + key + "\"");
        return null;
    }
}
