//
// This file manages the loading of resources for the home page.
//

const resourceLoader = new ResourceLoader(),
      imageSystem = new ImageSystem(resourceLoader);

imageSystem.populateDynamicImages();
imageSystem.loadDynamicButtons();
imageSystem.loadImage("/res/board_background", function() {
    setTimeout(function() {
        document.getElementById("greeting-background").classList.add("loaded");
    }, 3000);
}, err => console.error("Failed to load home background: " + err))
