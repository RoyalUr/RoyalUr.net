//
// This file contains the code that manages
// the loading of resources for Royal Ur.
//

function ResourceLoader(stagedResources) {
    this.__class_name__ = "ResourceLoader";

    // Detection of WebP support.
    this.webpSupportKnown = false;
    this.supportsWebP = "unknown";
    this.webpSupportListeners = [];
    testWebPSupport(function(supported) {
        this.webpSupportKnown = true;
        this.supportsWebP = supported;
        for (let index = 0; index < this.webpSupportListeners.length; ++index) {
            this.webpSupportListeners[index](supported);
        }
        this.webpSupportListeners.length = 0;
        document.body.classList.add(supported ? "webp" : "no-webp");
    }.bind(this));

    // Detection of the resolution of the user's browser.
    this.max_resolution = "u_u";
    this.resolutions = ["u_720", "u_1080", "u_1440", "u_2160", this.max_resolution];
    this.resolution = this.calculateResolution();

    // Organise all of the resources to be loaded.
    this.loadingStage = -1;
    this.stagedResources = (stagedResources ? stagedResources : null);
    this.allResources = [];
    if (stagedResources) {
        for (let index = 0; index < stagedResources.length; ++index) {
            this.allResources.push.apply(this.allResources, stagedResources[index]);
        }
    }

    // Some callbacks to be set elsewhere.
    this.resourceLoadedCallback = null;
    this.stageLoadedCallback = null;
}
ResourceLoader.prototype.setStageLoadedCallback = function(callback) {
    this.stageLoadedCallback = callback;
    for (let missed = 0; missed < this.loadingStage; ++missed) {
        callback(missed);
    }
};
ResourceLoader.prototype.setResourceLoadedCallback = function(callback) {
    this.resourceLoadedCallback = callback;
};
ResourceLoader.prototype.testWebP = function(callback) {
    if (this.webpSupportKnown) {
        callback(this.supportsWebP);
    } else {
        this.webpSupportListeners.push(callback);
    }
};
ResourceLoader.prototype.findRasterImageExtension = function(callback) {
    this.testWebP(supported => callback(supported ? "webp" : "png"));
};
ResourceLoader.prototype.completeRasterImageURL = function(url, callback) {
    this.findRasterImageExtension(function(ext) {
        const size = (this.resolution !== this.max_resolution ? "." + this.resolution : "");
        callback(url + size + (ext.length ? "." + ext : ""));
    }.bind(this));
}
ResourceLoader.prototype.getEffectiveScreenSize = function() {
    const unscaledSize = vec(document.documentElement.clientWidth, document.documentElement.clientHeight);
    return vecMul(unscaledSize, window.devicePixelRatio);
};
ResourceLoader.prototype.calculateResolution = function() {
    const size = this.getEffectiveScreenSize();
    for (let index = 0; index < this.resolutions.length; ++index) {
        const resolution = this.resolutions[index],
              resolution_parts = resolution.split("_"),
              res_width = (resolution_parts[0] === "u" ? -1 : parseInt(resolution_parts[0])),
              res_height = (resolution_parts[1] === "u" ? -1 : parseInt(resolution_parts[1]));
        if (res_width > 0 && size.x > res_width)
            continue;
        if (res_height > 0 && size.y > res_height)
            continue;
        return resolution;
    }
    return this.max_resolution;
};
ResourceLoader.prototype.getPercentageLoaded = function(stage) {
    if (stage < 0 || stage >= this.stagedResources.length)
        return 0;

    const resources = this.stagedResources[stage];
    let loaded = 0, total = 0;
    for (let index = 0; index < resources.length; ++index) {
        const resource = resources[index];
        if (!resource.hasMeaningfulLoadStats() || !resource.blocksLoading)
            continue;

        total += 1;
        if (resource.loaded) {
            loaded += 1;
        }
    }
    return (total === 0 ? 0 : loaded / total);
};
ResourceLoader.prototype.startLoading = function() {
    if (this.loadingStage !== -1)
        return;
    this.loadingStage = 0;
    this.startLoadingStage();
};
ResourceLoader.prototype.startLoadingStage = function() {
    if (this.loadingStage >= this.stagedResources.length)
        return;
    // Start the loading of all resources of the current stage.
    const resources = this.stagedResources[this.loadingStage];
    for (let index = 0; index < resources.length; ++index) {
        resources[index].load(this);
    }
    // In case there are no resources left to load at this stage.
    this.onResourceLoaded(null);
};
ResourceLoader.prototype.onResourceLoaded = function(resource) {
    if (this.resourceLoadedCallback) {
        this.resourceLoadedCallback(resource);
    }
    // Check if there are resources that are not yet loaded.
    const resources = this.stagedResources[this.loadingStage];
    for (let index = 0; index < resources.length; ++index) {
        const resource = resources[index];
        if (resource.blocksLoading && !resource.loaded)
            return;
    }
    // All resources at the current stage have been loaded.
    const previousStage = this.loadingStage;
    this.loadingStage += 1;
    if (this.stageLoadedCallback) {
        this.stageLoadedCallback(previousStage);
    }
    this.startLoadingStage();
};
