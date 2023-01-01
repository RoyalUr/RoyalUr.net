//
// Manages detecting the screen size and mouse interactions.
//

import {MouseEventSource} from "@/game/ui/mouse";
import {StylePixels} from "@/common/units";


export class Screen extends MouseEventSource {

    width: StylePixels = NaN;
    height: StylePixels = NaN;

    constructor() {
        super();
    }

    init() {
        this.addDocumentMouseListeners();
        window.addEventListener('resize', this.onScreenResize.bind(this));
    }

    onScreenResize(event: Event) {
        this.width = window.innerWidth
            || document.documentElement.clientWidth
            || document.body.clientWidth;

        this.height = window.innerHeight
            || document.documentElement.clientHeight
            || document.body.clientHeight;
    }
}

export const screen = new Screen();





const updateMouse = function(loc, down) {
    // mouseLoc = loc;

    const newHoveredTile = canvasToTile(loc);
    if(game && !vecEquals(hoveredTile, newHoveredTile)) {
        game.onTileHover(newHoveredTile);
    }
    hoveredTile = newHoveredTile;
    // if(down === undefined)
    //     return;
    //
    // if(down) {
    //     mouseDown = true;
    //     mouseDownTime = getTime();
    //     mouseDownLoc = loc;
    //     draggedTile = hoveredTile;
    // } else {
    //     mouseDown = false;
    //     mouseDownTime = LONG_TIME_AGO;
    //     mouseDownLoc = VEC_NEG1;
    //     draggedTile = VEC_NEG1;
    // }
};
document.onmousemove = function(event) {
    if (!game) return;
    updateMouse(vec(
        fromScreenPixels(event.clientX - gameLeft) - tilesLeft,
        fromScreenPixels(event.clientY - gameTop) - tilesTop
    ));
};
document.body.onmousedown = function(event) {
    if (mouseDown) return;
    updateMouse(mouseLoc, true);
    if (!game) return;
    game.onTileClick(hoveredTile);
    event.preventDefault();
};
document.onmouseup = function(event) {
    if (!mouseDown) return;
    try {
        if (!game) return;
        game.onTileRelease(hoveredTile);
    } finally {
        updateMouse(mouseLoc, false);
    }
};
tilesCanvas.ontouchmove = function(event) {
    if (!game || event.touches.length !== 1) return;
    const touch = event.touches[0];
    updateMouse(vec(
        fromScreenPixels(touch.clientX - gameLeft) - tilesLeft,
        fromScreenPixels(touch.clientY - gameTop) - tilesTop
    ));
    event.preventDefault();
};
tilesCanvas.ontouchstart = function(event) {
    if (event.touches.length !== 1) {
        updateMouse(mouseLoc, false);
        return;
    } else if (mouseDown) return;
    const touch = event.touches[0];
    updateMouse(vec(
        fromScreenPixels(touch.clientX - gameLeft) - tilesLeft,
        fromScreenPixels(touch.clientY - gameTop) - tilesTop
    ), true);

    if (!game) return;
    game.onTileTouchClick(hoveredTile);
    event.preventDefault();
};
tilesCanvas.ontouchend = function(event) {
    if (!mouseDown) return;
    try {
        if (!game) return;
        game.onTileTouchRelease(hoveredTile);
        event.preventDefault();
    } finally {
        updateMouse(VEC_NEG1, false);
    }
};
