//
// This file manages the loading of resources for article pages.
//

const resourceLoader = new ArticleResourceLoader(null),
      imageSystem = new ImageSystem(resourceLoader);

imageSystem.populateDynamicImages();
imageSystem.loadDynamicButtons();
