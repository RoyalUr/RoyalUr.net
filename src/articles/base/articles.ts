//
// This file manages the loading of resources for article pages.
//

import {ArticleResourceLoader} from "./article_resources"
import {ImageSystem} from "@/common/resources/image_system";


const resourceLoader = new ArticleResourceLoader(null),
      imageSystem = new ImageSystem(resourceLoader);

imageSystem.populateDynamicImages();
imageSystem.loadDynamicButtons();
