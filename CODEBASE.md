# Code Summary

This file contains a summary of the codebase to help
new contributors become familiar with the way the
codebase fits together. In a perfect world this would
be kept 100% consistent as changes are made, but in
reality small details might have changed since this
was updated. If you find any inconsistencies, please
make an issue, and we can sort them out ASAP!

**Please Note:** _This file is still a Work in Progress,
and does not yet cover all major aspects of the codebase._


## Resource Loading

| File             | Purpose                                   |
| ---------------- |------------------------------------------ |
| resources.js     | Loads all of the game assets.             |
| compilation.json | Specifies names and sizes of game assets. |

The resource loading done by the client is unusually
complex. This is because it tries to prioritise what
it loads so that it can display the menu as quickly
as possible. At the start of the project, the client
used a naive approach of loading all the game assets,
and only then displayed the menu. This was simpler,
but led to load times of up to 12 seconds... Nowadays
thanks to some optimisations the client is able to get
to the menu in ~3 seconds, even with the cache disabled!

### 🗂️ Resources are loaded in stages.
The resources are not all loaded at once. Instead,
the assets needed for the menu are loaded first, and
once they are loaded the game assets are loaded.

### 💻 Users on smaller devices load smaller assets
Raster image assets are scaled into different copies for
different screen sizes. This allows smaller images to be
loaded on smaller devices. This is done by grouping device
sizes into "size classes", where each size class contains a
whole different set of assets scaled specifically
for those devices.

_e.g. A user with a 1080p screen will likely be classed
into the size class "u_1080"._

The scaled copies of each image are generated at compile time,
and the sizes they are scaled to are set in `compilation.json`.

### 🖼 WebP is used to serve images if supported
Google WebP is an image format that compresses to much
smaller file sizes than PNG. Therefore, if your browser
has support for WebP, we load WebP versions of the
assets instead of the PNG versions.

### 🎨 Some images are combined into Sprites
The images for the dice and menu buttons are combined
into sprites so that they can be loaded all at once
instead of in several requests. This is only used for
images where it is unlikely that any one image would
change without the others having to change.

### 📜 Resources are versioned
The assets loaded by the client include a version number in their
URLs. This allows us to give those assets 10-year cache times,
which is great for repeat page load performance.

The versions added to the URLs are generated at compile time,
and are based on the last modification time of the assets.
Therefore, if any assets are updated, their versions should
automatically change. The Apache webserver is then configured
to ignore the version numbers when assets are requested.

### 📝 Resource metadata is served in annotations.json
When sprites are loaded, `resources.js` needs to know which images
are stored in each sprite. Additionally, the rendering script needs
to know where to place each tile on the board. This information is
served alongside the other assets in an `annotations.json` file that
is generated at compile time.
