//
// This file contains all of the different types of resources
// that Royal Ur may need to load, and code to load them.
//

import {
    LONG_TIME_AGO, getOrDefault, getTime, unimplemented,
    setSuperClass, renderResource, isAudioElementPlaying
} from "../utils";


function Resource(name, url) {
    this.__class_name__ = "Resource";
    this.name = name;
    this.url = url;
    this.resourceLoader = null;
    this.loadStart = -1;
    this.loadEnd = -1;
    this.loadDuration = -1;
    this.loading = false;
    this.loaded = false;
    this.errored = false;
    this.error = null;
    this.blocksLoading = true;
}
Resource.prototype.updateState = function(state) {
    this.loading = getOrDefault(state, "loading", false);
    this.loaded = getOrDefault(state, "loaded", false);
    this.errored = getOrDefault(state, "errored", false);
    this.error = getOrDefault(state, "error", null);
};
Resource.prototype.load = function(resourceLoader) {
    this.resourceLoader = resourceLoader;
    if (this.loading)
        return;
    this.updateState({loading: true});
    this.loadStart = getTime();
    this._load();
};
Resource.prototype._load = unimplemented("_load");
Resource.prototype.onLoad = function() {
    this.updateState({loaded: true});
    this.loadEnd = getTime();
    this.loadDuration = this.loadEnd - this.loadStart;
    this.resourceLoader.onResourceLoaded(this);
};
Resource.prototype.onError = function(error) {
    this.updateState({errored: true, error: (error ? error : null)});
    console.error(error);
};
Resource.prototype.setBlocksLoading = function(blocksLoading) {
    this.blocksLoading = blocksLoading;
};
Resource.prototype.hasMeaningfulLoadStats = () => true;


/** Annotations about other resources. **/
export function AnnotationsResource(name, url) {
    Resource.call(this, name, url);
    this.__class_name__ = "AnnotationsResource";
    this.data = null;
}
setSuperClass(AnnotationsResource, Resource);
AnnotationsResource.prototype._load = function() {
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
};
AnnotationsResource.prototype.get = function(key) {
    return this.data ? this.data[key] : undefined;
}


/** Used to preload an image. **/
export function PreloadImageResource(name, url) {
    Resource.call(this, name, url);
    this.__class_name__ = "PreloadImageResource";
    this.image = null;
    this.setBlocksLoading(false);
}
setSuperClass(PreloadImageResource, Resource);
PreloadImageResource.prototype._load = function() {
    this.image = new Image();
    this.image.onerror = function() {
        this.onError("Image Error: " + this.image.error);
    }.bind(this);
    this.image.src = this.url;
    // We don't want this to block the loading of the page.
    this.onLoad();
};


/** Images to be displayed. **/
export function ImageResource(name, url, maxWidth, maxHeight) {
    Resource.call(this, name, url);
    this.__class_name__ = "ImageResource";
    this.image = null;
    this.imageSrcURL = null;
    this.maxWidth = maxWidth;
    this.maxHeight = maxHeight;
    this.aspectRatio = (maxWidth && maxHeight ? maxWidth / maxHeight : null);
    this.scaledImages = [];
}
setSuperClass(ImageResource, Resource);
ImageResource.prototype._onImageLoad = function() {
    this.aspectRatio = this.image.width / this.image.height;
    this.onLoad();
};
ImageResource.prototype._load = function() {
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
};
ImageResource.prototype.calcImageHeight = function(width) {
    if (!this.aspectRatio)
        throw "Image is not yet loaded, and no aspect ratio has been given";
    return width / this.aspectRatio;
}
ImageResource.prototype.getScaledImage = function(width) {
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
};


/** Sounds to be played. **/
export function AudioResource(name, url, options) {
    Resource.call(this, name, url);
    this.__class_name__ = "AudioResource";
    this.volume = getOrDefault(options, "volume", 1);
    this.instances = getOrDefault(options, "instances", 1);
    this.errors = [];
    this.lastErrorTime = LONG_TIME_AGO;
}
setSuperClass(AudioResource, Resource);
AudioResource.prototype._load = function() {
    this.element = new Audio();
    this.element.preload = "auto";
    this.element.addEventListener("error", function() {
        this.onError("Audio Error: " + this.element.error);
    }.bind(this));
    this.element.src = this.url;
    this.element.load();
    this.elements = [this.element];
    setTimeout(function() {
        for (let instance = 1; instance < this.instances; ++instance) {
            this.elements.push(this.element.cloneNode(false));
        }
    }.bind(this));
    this.onLoad(); // Browsers sometimes only load audio when it is played.
};
AudioResource.prototype.updateElementSettings = function(audioSystem) {
    if (!this.loaded)
        return;

    const volume = (audioSystem.muted ? 0 : this.volume * audioSystem.volume);
    for (let index = 0; index < this.elements.length; ++index) {
        this.elements[index].volume = volume;
    }
};
AudioResource.prototype.play = function(audioSystem, onCompleteCallback) {
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
};
AudioResource.prototype.hasMeaningfulLoadStats = () => false;
