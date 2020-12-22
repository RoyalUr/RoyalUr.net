//
// This file manages the loading of resources such as audio and images that the client needs.
//

const resolutions = ["u_720", "u_1080", "u_1440", "u_2160", "u_u"];
const resolution = (function() {
    const width = document.documentElement.clientWidth * window.devicePixelRatio,
          height = document.documentElement.clientHeight * window.devicePixelRatio;
    for (let index = 0; index < resolutions.length; ++index) {
        const resolution = resolutions[index],
              wh_specs = resolution.split("_"),
              res_width = (wh_specs[0] === "u" ? -1 : parseInt(wh_specs[0])),
              res_height = (wh_specs[1] === "u" ? -1 : parseInt(wh_specs[1]));
        if (res_width > 0 && width > res_width)
            continue;
        if (res_height > 0 && height > res_height)
            continue;
        return resolution;
    }
})();
const imageExtension = (function() {
    // Check if Google WebP is supported.
    const webpCanvas = document.createElement('canvas');
    if (!!(webpCanvas.getContext && webpCanvas.getContext('2d'))) {
        const webpData = webpCanvas.toDataURL('image/webp');
        if (webpData.indexOf('data:image/webp') === 0)
            return "webp";
    }
    return "png";
})();
function completeURL(url, extension) {
    extension = (extension !== undefined ? extension : imageExtension);
    return url + (resolution !== "u_u" ? "." + resolution : "") + (extension.length > 0 ? "." + extension : "");
}


//
// Loading bar.
//

const loadingBar = {
    element: document.getElementById("loading-bar"),
    stage: 0
};

function getPercentageLoaded() {
    const stage = min(loadingBar.stage, loading.stage);
    if (stage < 0 || stage >= stagedResources.length)
        return 0;

    const resources = stagedResources[stage];
    let loaded = 0, total = 0;
    for (let index = 0; index < resources.length; ++index) {
        const resource = resources[index];
        if (!resource.hasMeaningfulLoadStats())
            continue;

        total += 1;
        if (resource.loaded) {
            loaded += 1;
        }
    }
    return (total === 0 ? 0 : loaded / total);
}

function redrawLoadingBar() {
    loadingBar.element.style.width = (getPercentageLoaded() * 100) + "%";
}


//
// Management of the loading.
//

const loading = {
    callback: function() {},
    stage: 0
};

function loadResources() {
    annotationsResource.load();
    startLoadingStage();
}

function setLoadingCallback(callback) {
    loading.callback = callback;
    for (let missed = 0; missed < loading.stage; ++missed) {
        callback(missed);
    }
}

function getStageLoadingMessage(stage) {
    if (stage === 1)
        return "Fetching Game Assets...";
    if (stage >= 2)
        return "Fetching Teaching Materials...";
    return "The Royal Ur is Loading...";
}

function startLoadingStage() {
    if (loading.stage >= stagedResources.length)
        return;

    const resources = stagedResources[loading.stage];
    for (let index = 0; index < resources.length; ++index) {
        resources[index].load();
    }
    // In case there are no resources left to load at this stage.
    onResourceLoaded(null);
}

function onResourceLoaded(resource) {
    redrawLoadingBar();

    if (loading.stage >= stagedResources.length)
        return;
    const resources = stagedResources[loading.stage];

    // Check that there are no resources that are not yet loaded.
    for (let index = 0; index < resources.length; ++index) {
        if (!resources[index].loaded)
            return;
    }

    // All resources at the current stage have loaded.
    const previousStage = loading.stage;
    loading.stage += 1;
    loading.callback(previousStage);
    startLoadingStage();
}

function getResourcesLoading() {
    const loading = [];
    for (let index = 0; index < allResources.length; ++index) {
        const resource = allResources[index];
        if (resource.loading) {
            loading.push(resource);
        }
    }
    return loading;
}

function getResourcesLoaded() {
    const loaded = [];
    for (let index = 0; index < allResources.length; ++index) {
        const resource = allResources[index];
        if (resource.loaded) {
            loaded.push(resource);
        }
    }
    return loaded;
}

function reportResourceLoadingStatistics() {
    const loading = getResourcesLoading(),
          loaded = getResourcesLoaded();

    if (loading.length === 0 && loaded.length === 0) {
        console.log("No resources loaded or loading");
        return;
    }
    loaded.sort((a, b) => a.loadStart - b.loadStart);

    let report = "Resource Loading Statistics:\n";
    for (let index = 0; index < loading.length; ++index) {
        report += "  Loading : " + loading[index].name + "\n";
    }
    for (let index = 0; index < loaded.length; ++index) {
        const entry = loaded[index];
        if (!entry.hasMeaningfulLoadStats())
            continue;

        const start = Math.round(entry.loadStart * 10000) / 10 + "ms",
              duration = Math.round(entry.loadDuration * 10000) / 10 + "ms";
        report += "  " + start + " for " + duration + " : " + entry.name + "\n";
    }
    console.log(report);
}


//
// Resource Types.
//

function Resource(name, url) {
    this.__class_name__ = "Resource";
    this.name = name;
    this.url = url;
    this.loadStart = -1;
    this.loadEnd = -1;
    this.loadDuration = -1;
    this.loading = false;
    this.loaded = false;
    this.errored = false;
    this.error = null;
    this.onLoadCallbacks = [];
}
Resource.prototype.updateState = function(state) {
    this.loading = getOrDefault(state, "loading", false);
    this.loaded = getOrDefault(state, "loaded", false);
    this.errored = getOrDefault(state, "errored", false);
    this.error = getOrDefault(state, "error", null);
};
Resource.prototype.load = function() {
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
    for (let index = 0; index < this.onLoadCallbacks.length; ++index) {
        this.onLoadCallbacks[index]();
    }
    this.onLoadCallbacks = [];
    onResourceLoaded(this);
};
Resource.prototype.runOnLoad = function(callback) {
    if (!this.loaded) {
        this.onLoadCallbacks.push(callback);
    } else {
        callback();
    }
};
Resource.prototype.onError = function(error) {
    this.updateState({errored: true, error: (error ? error : null)});
};
Resource.prototype.hasMeaningfulLoadStats = () => true;


/** Annotations about other resources. **/
function AnnotationsResource(name, url) {
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
    return this.data !== undefined ? this.data[key] : undefined;
}


/** Images to be displayed. **/
function ImageResource(name, url) {
    Resource.call(this, name, url);
    this.__class_name__ = "ImageResource";
    this.image = null;
    this.scaledImages = [];
}
setSuperClass(ImageResource, Resource);
ImageResource.prototype._onImageLoad = function() {
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
    this.image.src = completeURL(this.url);
};
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
              nextWidth = Math.round(last.width / 2),
              nextHeight = Math.round(last.height / 2);

        this.scaledImages.push(renderResource(nextWidth, nextHeight, function(ctx) {
            ctx.drawImage(last, 0, 0, nextWidth, nextHeight);
        }));
    }

    // Return the required scaled image.
    return (scaleDowns <= 0 ? this.image : this.scaledImages[scaleDowns - 1]);
};


/** An ImageResource that should never be loaded. **/
function GeneratedImageResource(name, url, image) {
    ImageResource.call(this, name, url);
    this.image = image;
    this.load();
    this.onLoad();
}
setSuperClass(GeneratedImageResource, ImageResource);
GeneratedImageResource.prototype._load = () => {};
GeneratedImageResource.prototype.hasMeaningfulLoadStats = () => false;


/** An image that gets split up into multiple smaller images. **/
function SpriteResource(url, childrenIds) {
    ImageResource.call(this, url, url);
    this.__class_name__ = "SpriteResource";
    this.childrenIds = childrenIds;
}
setSuperClass(SpriteResource, ImageResource);
SpriteResource.prototype._onImageLoad = function() {
    annotationsResource.runOnLoad(function() {
        const annotations = annotationsResource.get("sprites")[completeURL(this.url, "")];
        if (!annotations) {
            this.onError("[FATAL] Could not find sprite annotations for sprite " + this.url);
            return;
        }

        for (let childURL in this.childrenIds) {
            if (!this.childrenIds.hasOwnProperty(childURL))
                continue;

            const childAnnotations = annotations[childURL];
            if (!childAnnotations) {
                this.onError("[FATAL] Could not find annotations for image " + childURL + " in sprite " + this.url);
                return;
            }

            const childImage = renderResource(childAnnotations["width"], childAnnotations["height"], function(ctx) {
                ctx.drawImage(this.image, -childAnnotations["x_offset"], -childAnnotations["y_offset"]);
            }.bind(this));

            const childImageResource = new GeneratedImageResource(this.childrenIds[childURL], childURL, childImage);
            imageResourcesFromSprites.push(childImageResource);
            updateAllResourcesArray();
        }
        this.onLoad();
    }.bind(this));
};


/** Sounds to be played. **/
function AudioResource(name, url, options) {
    Resource.call(this, name, url);
    this.__class_name__ = "AudioResource";
    this.volume = getOrDefault(options, "volume", 1);
    this.instances = getOrDefault(options, "instances", 1);
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
    for (let index = 1; index < this.instances; ++index) {
        this.elements.push(this.element.cloneNode());
    }
    this.onLoad(); // Browsers sometimes only load audio when it is played.
    this.updateElementSettings();
};
AudioResource.prototype.updateElementSettings = function() {
    if (!this.loaded)
        return;

    const volume = (audioSettings.muted ? 0 : this.volume * audioSettings.volume);
    for (let index = 0; index < this.elements.length; ++index) {
        this.elements[index].volume = volume;
    }
};
AudioResource.prototype.play = function(onCompleteCallback) {
    onCompleteCallback = (onCompleteCallback !== undefined ? onCompleteCallback : ()=>{});
    if (!this.loaded) {
        onCompleteCallback();
        return false;
    }
    for (let index = 0; index < this.elements.length; ++index) {
        const element = this.elements[index];
        if (isAudioElementPlaying(element))
            continue;

        element.onended = onCompleteCallback;
        const playPromise = element.play();

        // The audio can sometimes be stopped from playing randomly.
        if (playPromise !== undefined) {
            playPromise.catch(() => {
                element.play().catch((error2) => {
                    console.error("Unable to play sound " + this.name + " : " + error2);
                    onCompleteCallback();
                });
            });
        }
        return true;
    }
    onCompleteCallback();
    return false;
};
AudioResource.prototype.hasMeaningfulLoadStats = () => false;


//
// Audio management.
//

const audioSettings = {
    muted: false,
    volume: 0.5
};

function setAudioMuted(soundMuted) {
    audioSettings.muted = soundMuted;
    updateAudioElements();
}

function setAudioVolume(soundVolume) {
    audioSettings.volume = soundVolume;
    updateAudioElements();
}

function updateAudioElements() {
    for (let index = 0; index < allResources.length; ++index) {
        const resource = allResources[index];
        if (resource instanceof AudioResource) {
            resource.updateElementSettings();
        }
    }
}

function isAudioElementPlaying(element) {
    return element.currentTime > 0 && !element.paused && !element.ended && element.readyState > 2;
}

function playSound(key, onCompleteCallback, overrideTabActive) {
    // We usually don't want to play any sounds if the tab is not active.
    if (document.hidden && !overrideTabActive)
        return false;

    // Allow random choice of sound from packs of audio clips.
    if(audioPacks[key]) {
        key = randElement(audioPacks[key]);
    }
    for (let index = 0; index < allResources.length; ++index) {
        const resource = allResources[index];
        if (resource instanceof AudioResource && resource.name === key)
            return resource.play(onCompleteCallback);
    }
    error("Unable to find the sound \"" + key + "\"");
    return false;
}



//
// Image loading.
//

function findImageResource(key) {
    for (let index = 0; index < allResources.length; ++index) {
        const resource = allResources[index];
        if (resource instanceof ImageResource && resource.name === key)
            return resource;
    }
    return null;
}

function getImageURL(key) {
    return completeURL(findImageResource(key).url);
}

function getImageResource(key, width) {
    const imageResource = findImageResource(key);
    if(!imageResource)
        throw "Missing image resource " + key;
    return imageResource.getScaledImage(width);
}

function renderResource(width, height, renderFunction) {
    if (isNaN(width) || isNaN(height))
        throw "Width and height cannot be NaN, was given " + width + " x " + height;
    if (width < 1 || height < 1)
        throw "Width and height must both be at least 1, was given " + width + " x " + height;

    const canvas = document.createElement("canvas"),
          ctx = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    renderFunction(ctx, canvas);
    return canvas;
}

function calcImageHeight(image, width) {
    return Math.ceil(image.height / image.width * width);
}


//
// The resources to be loaded.
//

const annotationsResource = new AnnotationsResource("annotations", "/res/annotations.json");
const stagedResources = [
    [ // Menu
        new ImageResource("logo", "res/logo"),
        new ImageResource("tile_dark", "res/tile_dark"),
        new ImageResource("play_local", "res/button_play_local"),
        new ImageResource("play_online", "res/button_play_online"),
        new ImageResource("play_computer", "res/button_play_computer"),
        new SpriteResource("res/play_button", {
            "res/buttons/play.png": "play",
            "res/buttons/play_active.png": "play_active"
        }),
        new SpriteResource("res/learn_button", {
            "res/buttons/learn.png": "learn",
            "res/buttons/learn_active.png": "learn_active"
        }),
        new SpriteResource("res/watch_button", {
            "res/buttons/watch.png": "watch",
            "res/buttons/watch_active.png": "watch_active"
        }),
    ],
    [ // Game
        new ImageResource("board", "res/board"),
        new ImageResource("tile_light", "res/tile_light"),
        new SpriteResource("res/dice", {
            "res/dice/up1.png": "diceUp1",
            "res/dice/up2.png": "diceUp2",
            "res/dice/up3.png": "diceUp3",
            "res/dice/down1.png": "diceDown1",
            "res/dice/down2.png": "diceDown2",
            "res/dice/down3.png": "diceDown3",
            "res/dice/darkShadow.png": "diceDarkShadow",
            "res/dice/lightShadow.png": "diceLightShadow"
        }),
        new AudioResource("place_1", "res/audio_place_1.mp4"),
        new AudioResource("place_2", "res/audio_place_2.mp4"),
        new AudioResource("place_3", "res/audio_place_3.mp4"),
        new AudioResource("place_4", "res/audio_place_4.mp4"),
        new AudioResource("pickup_1", "res/audio_pickup_1.mp4"),
        new AudioResource("pickup_2", "res/audio_pickup_2.mp4"),
        new AudioResource("pickup_3", "res/audio_pickup_3.mp4"),
        new AudioResource("error", "res/audio_error.mp4", {instances: 3, volume: 0.5}),
        new AudioResource("kill", "res/audio_kill.mp4", {volume: 0.5}),
        new AudioResource("hover", "res/audio_hover.mp4", {instances: 3, volume: 0.5}),
        new AudioResource("dice_click", "res/audio_dice_click.mp4", {instances: 5, volume: 0.5}),
        new AudioResource("dice_hit", "res/audio_dice_hit.mp4", {instances: 4, volume: 0.3}),
        new AudioResource("dice_select", "res/audio_dice_select.mp4", {instances: 4, volume: 0.5}),
        new AudioResource("firework_rocket", "res/audio_firework_rocket.mp4", {instances: 4, volume: 0.05}),
    ],
    [ // Learn Screen
    ]
];
const imageResourcesFromSprites = [];
const allResources = [];

/** Should be called as the underlying arrays holding the resources are changed. **/
function updateAllResourcesArray() {
    allResources.splice(0, allResources.length);
    allResources.push(annotationsResource);
    allResources.push.apply(allResources, imageResourcesFromSprites);
    for (let index = 0; index < stagedResources.length; ++index) {
        allResources.push.apply(allResources, stagedResources[index]);
    }
}
updateAllResourcesArray();

const audioPacks = {
    "place": ["place_1", "place_2", "place_3", "place_4"],
    "pickup": ["pickup_1", "pickup_2", "pickup_3"]
};


//
// Start the loading!
//

loadResources();
