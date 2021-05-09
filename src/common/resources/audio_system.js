//
// This file contains the code that manages the playing of audio.
//

import {LONG_TIME_AGO, getTime, randElement, error} from "../utils.js"
import {AudioResource} from "./resource_types.js";


/** When the audio is errored, how long to wait before trying to play audio again. **/
const ERRORED_AUDIO_PAUSE_DURATION = 60;

export function AudioSystem(resourceLoader, audioPacks) {
    this.__class_name__ = "AudioSystem";
    this.resourceLoader = resourceLoader;
    this.audioPacks = audioPacks;
    this.muted = false;
    this.volume = 0.5;
    this.errors = [];
    this.lastErrorTime = LONG_TIME_AGO;
}
AudioSystem.prototype.isErrored = function() {
    return this.errors.length >= 5 && getTime() - this.lastErrorTime < ERRORED_AUDIO_PAUSE_DURATION;
};
AudioSystem.prototype.setMuted = function(muted) {
    this.muted = muted;
    this.updateAudioElements();
};
AudioSystem.prototype.setVolume = function(volume) {
    this.volume = volume;
    this.updateAudioElements();
};
AudioSystem.prototype.updateAudioElements = function() {
    const resources = this.resourceLoader.allResources;
    for (let index = 0; index < resources.length; ++index) {
        const resource = resources[index];
        if (resource instanceof AudioResource) {
            resource.updateElementSettings(this);
        }
    }
};
AudioSystem.prototype.playSound = function(key, onCompleteCallback, overrideTabActive) {
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
};
