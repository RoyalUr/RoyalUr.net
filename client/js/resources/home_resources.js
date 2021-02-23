//
// This file manages the loading of resources for the home page.
//

const resourceLoader = new ResourceLoader(),
      imageSystem = new ImageSystem(resourceLoader);

imageSystem.populateDynamicImages();
