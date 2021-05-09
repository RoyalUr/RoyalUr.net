//
// This file manages the loading of resources for the home page.
//

import {ResourceLoader} from "@src/common/resources/resource_loader";
import {ImageSystem} from "@src/common/resources/image_system";


const resourceLoader = new ResourceLoader(),
      imageSystem = new ImageSystem(resourceLoader);

imageSystem.populateDynamicImages();
imageSystem.loadDynamicButtons();
imageSystem.loadImage("/res/board_background", function() {
    document.getElementById("greeting-background").classList.add("loaded");
}, err => console.error("Failed to load home background: " + err))
