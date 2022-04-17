//
// This file contains all of the different types of resources
// that Royal Ur may need to load, and code to load them.
//

import {
    LONG_TIME_AGO, getOrDefault, getTime,
    renderResource, isAudioElementPlaying
} from "@/common/utils";
import {ResourceLoader} from "@/common/resources/resource_loader";
import {AudioSystem} from "@/common/resources/audio_system";


export abstract class Resource {

    resourceLoader: ResourceLoader = null;
    readonly name: string;
    readonly url: string;
    blocksLoading: boolean = true;

    loadStart: number = -1;
    loadEnd: number = -1;
    loadDuration: number = -1;
    loading: boolean;
    loaded: boolean;
    errored: boolean;
    error: string;

    protected constructor(name: string, url: string) {
        this.name = name;
        this.url = url;
    }

    setBlocksLoading(blocksLoading: boolean) {
        this.blocksLoading = blocksLoading;
    }

    hasMeaningfulLoadStats() {
        return true;
    }

    updateState(state: {[key: string]: boolean | string}) {
        this.loading = getOrDefault(state, "loading", false) as boolean;
        this.loaded = getOrDefault(state, "loaded", false) as boolean;
        this.errored = getOrDefault(state, "errored", false) as boolean;
        this.error = getOrDefault(state, "error", null) as string;
    }

    load(resourceLoader: ResourceLoader) {
        this.resourceLoader = resourceLoader;
        if (this.loading)
            return;
        this.updateState({loading: true});
        this.loadStart = getTime();
        this._load();
    }

    abstract _load();

    onLoad() {
        this.updateState({loaded: true});
        this.loadEnd = getTime();
        this.loadDuration = this.loadEnd - this.loadStart;
        this.resourceLoader.onResourceLoaded(this);
    }

    onError(error: string) {
        this.updateState({errored: true, error: (error ? error : null)});
        console.error(error);
    }
}


export class AnnotationsResource extends Resource {

    data: {[key: string]: any} = null;

    constructor(name: string, url: string) {
        super(name, url);
    }

    get(key: string): any {
        return this.data ? this.data[key] : undefined;
    }

    _load() {
        const client = new XMLHttpRequest();
        client.onreadystatechange = function() {
            if (client.readyState !== 4)
                return;
            if (client.status !== 200) {
                this.onError("Error " + client.status + " loading image annotations: " + client.responseText);
                return;
            }
            this.data = JSON.parse(client.responseText);
            this.onLoad();
        }.bind(this);
        client.open('GET', this.url);
        client.send();
    }
}


export class PreloadImageResource extends Resource {

    image: HTMLImageElement = null;

    constructor(name: string, url: string) {
        super(name, url);
        this.setBlocksLoading(false);
    }

    _load() {
        this.image = new Image();
        this.image.onerror = function() {
            this.onError("Image Error: " + this.image.error);
        }.bind(this);
        this.image.src = this.url;
        // We don't want this to block the loading of the page.
        this.onLoad();
    }
}


export class ImageResource extends Resource {

    image: HTMLImageElement = null;
    imageSrcURL: string = null;
    readonly maxWidth: number;
    readonly maxHeight: number;
    aspectRatio: number;
    readonly scaledImages: HTMLCanvasElement[] = [];

    constructor(name: string, url: string, maxWidth?: number, maxHeight?: number) {
        super(name, url);
        this.maxWidth = maxWidth;
        this.maxHeight = maxHeight;
        this.aspectRatio = (maxWidth && maxHeight ? maxWidth / maxHeight : null);
    }

    _onImageLoad() {
        this.aspectRatio = this.image.width / this.image.height;
        this.onLoad();
    }

    _load() {
        this.image = new Image();
        this.image.onload = function() {
            if (!this.image.width || !this.image.height) {
                this.onError(
                    "Failed to load image " + this.name + ", "
                    + "invalid width or height (" + this.image.width + " x " + this.image.height + ")"
                );
                return;
            }
            this._onImageLoad();
        }.bind(this);
        this.image.onerror = function() {
            this.onError("Image Error: " + this.image.error);
        }.bind(this);
        this.resourceLoader.completeRasterImageURL(this.url, function(completedURL) {
            this.imageSrcURL = this.image.src = completedURL;
        }.bind(this));
    }

    calcImageHeight(width) {
        if (!this.aspectRatio)
            throw "Image is not yet loaded, and no aspect ratio has been given";
        return width / this.aspectRatio;
    }

    getScaledImage(width) {
        if (width <= 0)
            throw "Width must be positive: " + width;

        // Determine how many times to halve the size of the image.
        const maxScaleDowns = 4;
        let nextWidth = Math.round(this.image.width / 2),
            scaleDowns = -1;
        while (nextWidth > width && scaleDowns < maxScaleDowns) {
            nextWidth = Math.round(nextWidth / 2);
            scaleDowns += 1;
        }

        // Generate the scaled images.
        while (this.scaledImages.length < scaleDowns) {
            const scaledCount = this.scaledImages.length,
                last = (scaledCount === 0 ? this.image : this.scaledImages[scaledCount - 1]),
                scaledWidth = Math.round(last.width / 2),
                scaledHeight = Math.round(last.height / 2);

            this.scaledImages.push(renderResource(scaledWidth, scaledHeight, function(ctx) {
                ctx.drawImage(last, 0, 0, scaledWidth, scaledHeight);
            }));
        }

        // Return the required scaled image.
        return (scaleDowns <= 0 ? this.image : this.scaledImages[scaleDowns - 1]);
    }
}


/** Sounds to be played. **/
export class AudioResource extends Resource {

    readonly volume: number;
    readonly instances: number;

    element: HTMLAudioElement = null;
    readonly elements: HTMLAudioElement[] = [];

    readonly errors: string[] = [];
    lastErrorTime: number = LONG_TIME_AGO;

    constructor(name: string, url: string, options?: {[key: string]: number}) {
        super(name, url);
        this.volume = getOrDefault(options, "volume", 1);
        this.instances = getOrDefault(options, "instances", 1);
    }

    hasMeaningfulLoadStats(): boolean {
        return false;
    }

    _load() {
        this.element = new Audio();
        this.element.preload = "auto";
        this.element.addEventListener("error", function() {
            this.onError("Audio Error: " + this.element.error);
        }.bind(this));
        this.element.src = this.url;
        this.element.load();
        this.elements.length = 0;
        this.elements.push(this.element);
        setTimeout(function() {
            for (let instance = 1; instance < this.instances; ++instance) {
                this.elements.push(this.element.cloneNode(false));
            }
        }.bind(this));
        this.onLoad(); // Browsers sometimes only load audio when it is played.
    }

    updateElementSettings(audioSystem: AudioSystem) {
        if (!this.loaded)
            return;

        const volume = (audioSystem.muted ? 0 : this.volume * audioSystem.volume);
        for (let index = 0; index < this.elements.length; ++index) {
            this.elements[index].volume = volume;
        }
    }

    play(audioSystem: AudioSystem, onCompleteCallback?: () => void): HTMLAudioElement {
        onCompleteCallback = (onCompleteCallback ? onCompleteCallback : ()=>{});

        // If we've received two errors trying to play this sound, stop trying for a minute.
        const errored = (this.errors.length >= 2 && getTime() - this.lastErrorTime < 60);
        if (!this.loaded || errored || audioSystem.isErrored()) {
            onCompleteCallback();
            return null;
        }
        // Find an Audio instance to play the sound.
        let element = null;
        for (let index = 0; index < this.elements.length; ++index) {
            if (!isAudioElementPlaying(this.elements[index])) {
                element = this.elements[index];
            }
        }
        // If there are no available Audio elements to play the sound.
        if (element === null) {
            onCompleteCallback();
            return null;
        }
        // Play the sound!
        this.updateElementSettings(audioSystem);
        element.onended = onCompleteCallback;
        const playPromise = element.play();
        // The audio can sometimes be stopped from playing randomly.
        if (playPromise !== undefined) {
            playPromise.then(function() {
                this.errors.length = 0;
                audioSystem.errors.length = 0;
            }.bind(this)).catch(function(error) {
                console.error("Unable to play sound " + this.name + " : " + error);
                this.errors.push(error);
                this.lastErrorTime = getTime();
                audioSystem.errors.push(error);
                audioSystem.lastErrorTime = getTime();
                onCompleteCallback();
            }.bind(this));
        }
        return element;
    }
}
