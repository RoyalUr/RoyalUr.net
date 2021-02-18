//
// This file contains the code for managing finding image resources to display.
//

function ImageSystem(resourceLoader) {
    this.__class_name__ = "ImageSystem";
    this.resourceLoader = resourceLoader;
}
ImageSystem.prototype.findImageResource = function(key) {
    const resources = this.resourceLoader.allResources;
    for (let index = 0; index < resources.length; ++index) {
        const resource = resources[index];
        if (resource instanceof ImageResource && resource.name === key)
            return resource;
    }
    return null;
};
ImageSystem.prototype.getImageResource = function(key, width, returnNullIfNotLoaded) {
    const imageResource = this.findImageResource(key);
    if(!imageResource)
        throw "Missing image resource " + key;
    if(!imageResource.loaded) {
        if (returnNullIfNotLoaded)
            return null;
        throw "Image resource " + key + " is not yet loaded!";
    }
    if (!width)
        return imageResource.image;
    return imageResource.getScaledImage(width);
};
ImageSystem.prototype.computeImageURL = function(key, callback) {
    const resource = this.findImageResource(key);
    this.resourceLoader.completeRasterImageURL(resource.url, callback);
};
