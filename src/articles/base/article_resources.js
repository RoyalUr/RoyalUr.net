//
// This file manages the loading of resources for article pages.
//

import {min, max} from "@/common/utils";
import {ResourceLoader} from "@/common/resources/resource_loader";
import {Vec2} from "@/common/vectors";


/**
 * On article pages, the content has a maximum width and therefore it is
 * scaled differently to the game. Therefore, the size of images that need
 * to be loaded is different.
 */
export class ArticleResourceLoader extends ResourceLoader {
    constructor(staged_resources) {
        super(staged_resources);

    }

    getEffectiveScreenSize() {
        // We use the article content width, and scale it compared to its
        // expected size at a 720p resolution to find our target resolution.
        // Its messy, but should be more consistent than the window size.
        const expectedContentWidth = 900,
            currentContentWidth = document.getElementById("content").clientWidth,
            rotate90ContentWidth = min(document.documentElement.clientHeight, expectedContentWidth),
            maxPossibleContentWidth = max(rotate90ContentWidth, currentContentWidth),
            contentWidth = maxPossibleContentWidth * window.devicePixelRatio,
            effectiveDevicePixelRatio = contentWidth / expectedContentWidth,
            multiplier = 1 + 2 * (effectiveDevicePixelRatio - 1);
        return Vec2.create(1280 * multiplier, 720 * multiplier);
    }
}
