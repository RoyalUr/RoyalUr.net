//
// This file contains the code that manages
// the loading of resources for Royal Ur.
//

import {testWebPSupport, max, min} from "@/common/utils";
import {Vec2} from "@/common/vectors";
import {Resource} from "@/common/resources/resource_types";


export enum WebPSupport {
    UNKNOWN,
    SUPPORTED,
    UNSUPPORTED
}

export class Resolution {

    static u_u = new Resolution(null, null);
    static u_2160 = new Resolution(null, 2160);
    static u_1440 = new Resolution(null, 1440);
    static u_1080 = new Resolution(null, 1080);
    static u_720 = new Resolution(null, 720);
    static standardResolutions = [
        Resolution.u_720, Resolution.u_1080, Resolution.u_1440,
        Resolution.u_2160, Resolution.u_u
    ];

    readonly width: number | null;
    readonly height: number | null;

    constructor(width: number | null, height: number | null) {
        this.width = width;
        this.height = height;
    }

    toString(): string {
        return (width === null ? "u" : width) + "_" + (height === null ? "u" : height);
    }

    contains(size: Vec2): boolean {
        return (this.width === null || size.x <= this.width)
            && (this.height === null || size.y <= this.height);
    }

    static findResolutionThatContains(size: Vec2): Resolution {
        for (let index = 0; index < Resolution.standardResolutions.length; ++index) {
            const resolution = Resolution.standardResolutions[index];
            if (resolution.contains(size))
                return resolution;
        }
        throw new Error("Could not find a standard resolution to contain the given width and height");
    }
}

export class ResourceLoader {

    webpSupport: WebPSupport = WebPSupport.UNKNOWN;
    readonly webpSupportListeners: ((supported: boolean) => void)[] = [];
    readonly resolution: Resolution;

    loadingStage: number;
    stagedResources?: Resource[][];
    allResources: Resource[];

    resourceLoadedCallback?: (loaded: Resource) => void;
    stageLoadedCallback?: (stage: number) => void;

    constructor(stagedResources?: Resource[][]) {
        this.resolution = this.calculateResolution();

        this.loadingStage = -1;
        this.stagedResources = (stagedResources ? stagedResources : null);
        this.allResources = [];
        if (stagedResources) {
            for (let index = 0; index < stagedResources.length; ++index) {
                this.allResources.push.apply(this.allResources, stagedResources[index]);
            }
        }

        testWebPSupport(supported => {
            this.webpSupport = (supported ? WebPSupport.SUPPORTED : WebPSupport.UNSUPPORTED);
            for (let index = 0; index < this.webpSupportListeners.length; ++index) {
                this.webpSupportListeners[index](supported);
            }
            this.webpSupportListeners.length = 0;
            document.body.classList.add(supported ? "webp" : "no-webp");
        })
    }

    setStageLoadedCallback(callback: (stage: number) => void) {
        this.stageLoadedCallback = callback;
        for (let missed = 0; missed < this.loadingStage; ++missed) {
            callback(missed);
        }
    }

    setResourceLoadedCallback(callback: (loaded: Resource) => void) {
        this.resourceLoadedCallback = callback;
    }

    calculateResolution(): Resolution {
        return Resolution.findResolutionThatContains(this.getEffectiveScreenSize());
    }

    getEffectiveScreenSize(): Vec2 {
        const width = document.documentElement.clientWidth,
              height = document.documentElement.clientHeight,
              normedSize = Vec2.create(max(width, height), min(width, height));
        return normedSize.mul(window.devicePixelRatio);
    }

    testWebP(callback: (supported: boolean) => void) {
        if (this.webpSupport === WebPSupport.UNKNOWN) {
            this.webpSupportListeners.push(callback);
        } else {
            callback(this.webpSupport === WebPSupport.SUPPORTED);
        }
    }

    findRasterImageExtension(callback: (extension: string) => void) {
        this.testWebP(supported => callback(supported ? "webp" : "png"));
    }

    completeRasterImageURL(url: string, callback: (url: string) => void, skipResolution?: boolean) {
        this.findRasterImageExtension((ext) => {
            const size = (!skipResolution && this.resolution !== Resolution.u_u ? "." + this.resolution : "");
            callback(url + size + (ext.length ? "." + ext : ""));
        });
    }

    getPercentageLoaded(stage: number): number {
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
    }

    startLoading() {
        if (this.loadingStage !== -1)
            return;
        this.loadingStage = 0;
        this.startLoadingStage();
    }

    startLoadingStage() {
        if (this.loadingStage >= this.stagedResources.length)
            return;
        // Start the loading of all resources of the current stage.
        const resources = this.stagedResources[this.loadingStage];
        for (let index = 0; index < resources.length; ++index) {
            resources[index].load(this);
        }
        // In case there are no resources left to load at this stage.
        this.onResourceLoaded(null);
    }

    onResourceLoaded(resource) {
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
    }
}
