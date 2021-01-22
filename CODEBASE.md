# 🛠️ Code Summary

This file contains a summary of the codebase to help
new contributors become familiar with the way the
codebase fits together. In a perfect world this would
be kept 100% consistent as changes are made, but in
reality small details might have changed since this
was updated. If you find any inconsistencies, please
make an issue, and we can sort them out ASAP!

**Please Note:** _This file is still a Work in Progress,
and does not yet cover all major aspects of the codebase._

## Table of Contents
- [1. Compilation](#1-compilation)
    * 🏗️ Compilation Preparation
    * 🚧️ Compilation Modes
    * ⚙ The files to compile are set in compilation.json
- [2. Resource Loading](#2-resource-loading)
    * 🗂️ Resources are loaded in stages.
    * 💻 Users on smaller devices load smaller assets
    * 🖼 WebP is used to serve images if supported
    * 🎨 Some images are combined into Sprites
    * 🏛️ Resources are versioned
    * 📝 Resource metadata is served in annotations.json


# 1. Compilation

| File             | Purpose                                      |
| ---------------- |--------------------------------------------- |
| compilation.json | Specifies everything to be compiled.         |
| compile.py       | Performs the compilation.                    |
| compile.sh       | Runs compile.py, and then post_compile.sh.   |
| post_compile.sh  | An optional script to run after compilation. |

The `compile.py` script does many small tasks to prepare the site:
* Generates a `sitemap.xml`.
* Copies the source HTML.
* Combines, transpiles, and minifies the JavaScript code.
* Minifies the CSS.
* Copies resource files.
* Generates different image sizes for different device resolutions.
* Generates sprites to group some images.
* Generates annotations to describe the board and sprites.
* Filters the HTML, JS, and CSS code to add resource versions to URLs.
* Zips the `/res` folder to be distributed for development.

## 🏗️ Compilation Preparation
The compilation requires the resources to be downloaded, the
target directory to be created, and for the required libraries
to be installed. Therefore, before the compilation can begin the
compilation script will check the following:

* It will make sure the `/res` directory exists. If it does not,
  it will attempt to download and unzip it from royalur.net.

* It will make sure the `/compiled` directory exists, as it is
  required to build the site into.

* It will make sure that the `/node_modules` directory exists, as
  it is expected that if it does exist then all the NPM dependencies
  needed for the compilation must already be installed.

## 🚧️ Compilation Modes
In a release build, all tasks described above will be performed,
but during development some of these are unnecessary. Therefore,
you can specify a compilation mode when you invoke `compile.sh`
so that the site can be compiled more quickly.

* `./compile.sh release` generates a full clean copy of the site
  from scratch, with all code minified, version numbers included,
  and it also creates res.zip.

* `./compile.sh dev` skips minification of the JavaScript code,
  doesn't add the version numbers, and only generates assets that
  are missing or have changed.

* `./compile.sh nojs` is similar to the dev mode, however it skips
  updating the JavaScript completely. This is sometimes nice when
  you are just updating the HTML or CSS, as compiling the JavaScript
  can sometimes be slow.

## ⚙ The files to compile are set in compilation.json
The source files, all resource files, and the target
sizes for images are all set in the `compilation.json`.
Therefore, to add new JavaScript files, image assets, or
new annotations to be included, they just have to be added
to `compilation.json` and they'll be added during compilation.


# 2. Resource Loading

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

## 🗂️ Resources are loaded in stages.
The resources are not all loaded at once. Instead,
the assets needed for the menu are loaded first, and
once they are loaded the game assets are loaded.

## 💻 Users on smaller devices load smaller assets
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

## 🖼 WebP is used to serve images if supported
Google WebP is an image format that compresses to much
smaller file sizes than PNG. Therefore, if your browser
has support for WebP, we load WebP versions of the
assets instead of the PNG versions.

## 🎨 Some images are combined into Sprites
The images for the dice and menu buttons are combined
into sprites so that they can be loaded all at once
instead of in several requests. This is only used for
images where it is unlikely that any one image would
change without the others having to change.

## 🏛️ Resources are versioned
The assets loaded by the client include a version number in their
URLs. This allows us to give those assets 10-year cache times,
which is great for repeat page load performance.

The versions added to the URLs are generated at compile time,
and are based on the last modification time of the assets.
Therefore, if any assets are updated, their versions should
automatically change. The Apache webserver is then configured
to ignore the version numbers when assets are requested.

## 📝 Resource metadata is served in annotations.json
When sprites are loaded, `resources.js` needs to know which images
are stored in each sprite. Additionally, the rendering script needs
to know where to place each tile on the board. This information is
served alongside the other assets in an `annotations.json` file that
is generated at compile time.
