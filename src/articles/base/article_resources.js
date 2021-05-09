//
// This file manages the loading of resources for article pages.
//

import {vec, min, max, setSuperClass} from "@src/common/utils";
import {ResourceLoader} from "@src/common/resources/resource_loader";


export function ArticleResourceLoader(staged_resources) {
    ResourceLoader.call(this, staged_resources);
    this.__class_name__ = "ArticleResourceLoader";
}
setSuperClass(ArticleResourceLoader, ResourceLoader);

ArticleResourceLoader.prototype.getEffectiveScreenSize = function() {
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
    return vec(1280 * multiplier, 720 * multiplier);
};
