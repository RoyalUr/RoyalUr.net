//
// This file contains the code for managing finding image resources to display.
//

function ImageSystem(resourceLoader) {
    this.__class_name__ = "ImageSystem";
    this.resourceLoader = resourceLoader;
    this.dynamicButtons = [];
    this.dynamicButtonRedrawLoopStarted = false;
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
ImageSystem.prototype.populateDynamicImages = function() {
    const images = document.body.getElementsByTagName("img");
    for (let index = 0; index < images.length; ++index) {
        const image = images[index],
              dynamicSrc = image.getAttribute("data-src");

        if (!dynamicSrc)
            continue;

        image.removeAttribute("data-src");
        this.resourceLoader.completeRasterImageURL(dynamicSrc, function(completedURL) {
            image.src = completedURL;
        });
    }
};
ImageSystem.prototype.loadDynamicButtons = function() {
    const canvases = document.body.getElementsByTagName("canvas");
    for (let index = 0; index < canvases.length; ++index) {
        const canvas = canvases[index],
              dynamicSrcInactive = canvas.getAttribute("data-src-inactive"),
              dynamicSrcActive = canvas.getAttribute("data-src-active");

        if (!dynamicSrcInactive || !dynamicSrcActive)
            continue;

        canvas.removeAttribute("data-src-inactive");
        canvas.removeAttribute("data-src-active");

        this.resourceLoader.completeRasterImageURL(dynamicSrcInactive, function(srcInactive) {
            this.resourceLoader.completeRasterImageURL(dynamicSrcActive, function(srcActive) {
                const button = new DynamicButton(canvas, srcInactive, srcActive);
                this.dynamicButtons.push(button);
            }.bind(this));
        }.bind(this));
    }
    // Start the redraw loop for the dynamic buttons.
    if (!this.dynamicButtonRedrawLoopStarted) {
        this._redrawDynamicButtonsLoop();
        this.dynamicButtonRedrawLoopStarted = true;
    }
};
ImageSystem.prototype._redrawDynamicButtonsLoop = function() {
    for (let index = 0; index < this.dynamicButtons.length; ++index) {
        this.dynamicButtons[index].redraw();
    }
    window.requestAnimationFrame(() => this._redrawDynamicButtonsLoop());
};


function DynamicButton(canvas, src, srcHover) {
    this.__class_name__ = "DynamicButton";
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.hovered = false;
    canvas.addEventListener("mouseover", this.onMouseOver.bind(this));
    canvas.addEventListener("mouseout", this.onMouseOut.bind(this));
    window.addEventListener("resize", this.forceRedraw.bind(this));

    this.image = new Image();
    this.hoverImage = new Image();
    this.image.onload = this.resize.bind(this);
    this.hoverImage.onload = this.resize.bind(this);
    this.image.onerror = () => console.log("Error loading image " + src);
    this.hoverImage.onerror = () => console.log("Error loading image " + srcHover);
    this.image.src = src;
    this.hoverImage.src = srcHover;

    this.forceRedraw = false;
    this.isDrawn = false;
    this.isDrawnHovered = false;
}
DynamicButton.prototype.onMouseOver = function() {
    this.hovered = true;
};
DynamicButton.prototype.onMouseOut = function() {
    this.hovered = false;
};
DynamicButton.prototype.resize = function() {
    let width = -1,
        height = -1;

    if (isImageLoaded(this.image)) {
        width = this.image.width;
        height = this.image.height;
    }
    if (isImageLoaded(this.hoverImage)) {
        width = Math.max(width, this.image.width);
        height = Math.max(height, this.image.height);
    }
    if (width > 0 && height > 0) {
        this.canvas.width = width;
        this.canvas.height = height;
    }
};
DynamicButton.prototype.forceRedraw = function() {
    this.forceRedraw = true;
}
DynamicButton.prototype.redraw = function() {
    const image = (this.hovered ? this.hoverImage : this.image);

    // Clear the canvas.
    if (!this.forceRedraw && !this.isDrawn && !isImageLoaded(image))
        return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.isDrawn = false;

    // Draw the image.
    if (!this.forceRedraw && this.isDrawn && this.isDrawnHovered === this.hovered)
        return;
    this.ctx.drawImage(image, 0, 0, this.canvas.width, this.canvas.height);

    this.forceRedraw = false;
    this.isDrawn = true;
    this.isDrawnHovered = this.hovered;
};

