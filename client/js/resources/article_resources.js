//
// This file manages the loading of resources for article pages.
//

function ArticleResourceLoader() {
    ResourceLoader.call(this, null);
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


const resourceLoader = new ArticleResourceLoader(),
      imageSystem = new ImageSystem(resourceLoader);

imageSystem.populateDynamicImages();
