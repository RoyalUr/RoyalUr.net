//
// This file contains the code for managing finding image resources to display.
//

import {isImageLoaded} from "@/common/utils"
import {ImageResource} from "@/common/resources/resource_types";
import {ResourceLoader} from "@/common/resources/resource_loader";


export class ImageSystem {

    readonly resourceLoader: ResourceLoader;
    readonly dynamicButtons: DynamicButton[] = [];
    dynamicButtonRedrawLoopStarted: boolean = false;

    constructor(resourceLoader: ResourceLoader) {
        this.resourceLoader = resourceLoader;
    }

    loadImage(urlWithoutExt: string,
              loadCallback: (image: HTMLImageElement) => void,
              errorCallback: OnErrorEventHandler) {

        this.resourceLoader.completeRasterImageURL(urlWithoutExt, function(url) {
            const image = new Image();
            image.onload = () => loadCallback(image);
            image.onerror = errorCallback;
            image.src = url;
        }, true);
    }

    findImageResource(key: string) {
        const resources = this.resourceLoader.allResources;
        for (let index = 0; index < resources.length; ++index) {
            const resource = resources[index];
            if (resource instanceof ImageResource && resource.name === key)
                return resource;
        }
        return null;
    }

    getImageResource(key: string, width?: number, returnNullIfNotLoaded?: boolean) {
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
    }

    computeImageURL(key: string, callback: () => string) {
        const resource = this.findImageResource(key);
        this.resourceLoader.completeRasterImageURL(resource.url, callback);
    }

    populateDynamicImages() {
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
    }

    loadDynamicButtons() {
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
    }

    _redrawDynamicButtonsLoop() {
        for (let index = 0; index < this.dynamicButtons.length; ++index) {
            this.dynamicButtons[index].redraw();
        }
        window.requestAnimationFrame(() => this._redrawDynamicButtonsLoop());
    }
}


export class DynamicButton {

    readonly canvas: HTMLCanvasElement;
    readonly ctx: CanvasRenderingContext2D;

    readonly image: HTMLImageElement;
    readonly hoverImage: HTMLImageElement;

    hovered: boolean = false
    nextRedrawForced: boolean = false;
    isDrawn: boolean = false;
    isDrawnHovered: boolean = false;

    constructor(canvas, src, srcHover) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

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
    }

    onMouseOver() {
        this.hovered = true;
    }

    onMouseOut() {
        this.hovered = false;
    }

    resize() {
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
        this.forceRedraw();
    }

    forceRedraw() {
        this.nextRedrawForced = true;
    }

    redraw() {
        // Get the image to be drawn.
        const image = (this.hovered ? this.hoverImage : this.image);
        if (!isImageLoaded(image))
            return;

        // Check if we need to redraw the button.
        if (!this.nextRedrawForced && this.isDrawn && this.isDrawnHovered === this.hovered)
            return;

        // Redraw the button.
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(image, 0, 0, this.canvas.width, this.canvas.height);

        this.nextRedrawForced = false;
        this.isDrawn = true;
        this.isDrawnHovered = this.hovered;
    }
}
