//
// Code to listen to and handle mouse events.
//

import {Vec2} from "@/common/vectors";
import {getTime, LONG_TIME_AGO} from "@/common/utils";
import {StylePixels} from "@/common/units";


/**
 * The mouse listener methods should return whether they wish to consume
 * the event and stop it propagating to any HTML components.
 */
export interface MouseListener<UNITS extends number> {
    onMouseMove(loc: Vec2<UNITS>): boolean;
    onMouseDown(loc: Vec2<UNITS>): boolean;
    onMouseUp(loc: Vec2<UNITS>): boolean;
    onTouchStart(loc: Vec2<UNITS>): boolean;
    onTouchEnd(loc: Vec2<UNITS>): boolean;
}

abstract class MouseAdapter<RAW extends number, ADAPTED extends number> implements MouseListener<RAW> {
    private readonly mouseListeners: MouseListener<ADAPTED>[] = [];

    addMouseListener(listener: MouseListener<ADAPTED>) {
        this.mouseListeners.push(listener);
    }

    removeMouseListener(listener: MouseListener<ADAPTED>) {
        const index = this.mouseListeners.indexOf(listener);
        if (index >= 0) {
            this.mouseListeners.splice(index, 1);
        }
    }

    protected abstract adaptMouseLoc(loc: Vec2<RAW>): Vec2<ADAPTED>;

    protected abstract getRawMouseLoc(): Vec2<RAW>;

    abstract isMouseDown(): boolean;

    abstract getMouseDownTime(): number;

    protected abstract getRawMouseDownLoc(): Vec2<RAW>;

    getMouseLoc(): Vec2<ADAPTED> {
        return this.adaptMouseLoc(this.getRawMouseLoc());
    }

    getMouseDownLoc(): Vec2<ADAPTED> {
        return this.adaptMouseLoc(this.getRawMouseDownLoc());
    }

    private invokeMouseListeners(
            loc: Vec2<RAW>,
            invokeFn: (listener: MouseListener<ADAPTED>, loc: Vec2<ADAPTED>) => boolean): boolean {

        const adaptedLoc = this.adaptMouseLoc(loc);

        let consumeEvent = false;
        for (let index = 0; index < this.mouseListeners.length; ++index) {
            consumeEvent = invokeFn(this.mouseListeners[index], adaptedLoc) || consumeEvent;
        }
        return consumeEvent;
    }

    onMouseMove(loc: Vec2<RAW>): boolean {
        return this.invokeMouseListeners(loc, (listener, loc) => listener.onMouseMove(loc));
    }

    onMouseDown(loc: Vec2<RAW>): boolean {
        return this.invokeMouseListeners(loc, (listener, loc) => listener.onMouseDown(loc));
    }

    onMouseUp(loc: Vec2<RAW>): boolean {
        return this.invokeMouseListeners(loc, (listener, loc) => listener.onMouseUp(loc));
    }

    onTouchStart(loc: Vec2<RAW>): boolean {
        return this.invokeMouseListeners(loc, (listener, loc) => listener.onTouchStart(loc));
    }

    onTouchEnd(loc: Vec2<RAW>): boolean {
        return this.invokeMouseListeners(loc, (listener, loc) => listener.onTouchEnd(loc));
    }
}

abstract class DelegatedMouseAdapter<RAW extends number, ADAPTED extends number>
        extends MouseAdapter<RAW, ADAPTED> {

    private readonly parent: MouseAdapter<any, RAW>;

    protected constructor(parent: MouseAdapter<any, RAW>) {
        super();
        this.parent = parent;
    }

    protected override getRawMouseLoc(): Vec2<RAW> {
        return this.parent.getMouseLoc();
    }

    override isMouseDown(): boolean {
        return this.parent.isMouseDown();
    }

    override getMouseDownTime(): number {
        return this.parent.getMouseDownTime();
    }

    protected override getRawMouseDownLoc(): Vec2<RAW> {
        return this.parent.getMouseDownLoc();
    }
}


/**
 * Performs a linear shift and scale to the mouse location, and optionally rounds the result.
 */
export class LinearMouseAdapter<RAW extends number, ADAPTED extends number>
        extends DelegatedMouseAdapter<RAW, ADAPTED> {

    private anchorLoc: Vec2<RAW> = Vec2.ZERO;
    private scale: number = 1;
    private floor: boolean;

    constructor(parent: MouseAdapter<any, RAW>) {
        super(parent);
    }

    setTransform(anchorLoc: Vec2<RAW>, scale: number, floor?: boolean) {
        this.anchorLoc = anchorLoc;
        this.scale = scale;
        this.floor = !!floor;
    }

    protected override adaptMouseLoc(loc: Vec2<RAW>): Vec2<ADAPTED> {
        const adapted: Vec2<ADAPTED> = loc.sub(this.anchorLoc).mul(this.scale).cast();
        return this.floor ? adapted.floor() : adapted;
    }
}

export class MouseEventSource extends MouseAdapter<StylePixels, StylePixels> {

    mouseLoc: Vec2<StylePixels> = Vec2.NEG1;
    mouseDown: boolean = false;
    mouseDownTime: number = LONG_TIME_AGO;
    mouseDownLoc: Vec2<StylePixels> = Vec2.NEG1;

    addDocumentMouseListeners() {
        document.addEventListener("mousemove", this.onMouseMoveEvent.bind(this));
        document.body.addEventListener("mousedown", this.onMouseDownEvent.bind(this));
        document.addEventListener("mouseup", this.onMouseUpEvent.bind(this));
    }

    addMouseListenersToElement(element: HTMLElement) {
        element.addEventListener("mousemove", this.onMouseMoveEvent.bind(this));
        element.addEventListener("mousedown", this.onMouseDownEvent.bind(this));
        element.addEventListener("mouseup", this.onMouseUpEvent.bind(this));
    }

    addTouchListenersToElement(element: HTMLElement) {
        element.addEventListener("touchmove", this.onTouchMoveEvent.bind(this));
        element.addEventListener("touchstart", this.onTouchStartEvent.bind(this));
        element.addEventListener("touchend", this.onTouchEndEvent.bind(this));
    }

    protected override adaptMouseLoc(loc: Vec2<StylePixels>): Vec2<StylePixels> {
        return loc;
    }

    protected override getRawMouseLoc(): Vec2<StylePixels> {
        return this.mouseLoc;
    }

    override isMouseDown(): boolean {
        return this.mouseDown;
    }

    override getMouseDownTime(): number {
        return this.mouseDownTime;
    }

    protected override getRawMouseDownLoc(): Vec2<StylePixels> {
        return this.mouseDownLoc;
    }

    private updateMouse(loc: Vec2<StylePixels>, isDown?: boolean) {
        this.mouseLoc = loc;
        if (isDown === undefined)
            return;

        if(isDown) {
            this.mouseDown = true;
            this.mouseDownTime = getTime();
            this.mouseDownLoc = loc;
        } else {
            this.mouseDown = false;
            this.mouseDownTime = LONG_TIME_AGO;
            this.mouseDownLoc = Vec2.NEG1;
        }
    }

    private onMouseMoveEvent(event: MouseEvent) {
        const loc = Vec2.create(event.clientX, event.clientY);
        this.updateMouse(loc);
        if (this.onMouseMove(loc)) {
            event.preventDefault();
        }
    }

    private onMouseDownEvent(event: MouseEvent) {
        const loc = Vec2.create(event.clientX, event.clientY);
        this.updateMouse(loc, true);
        if (this.onMouseDown(loc)) {
            event.preventDefault();
        }
    }

    private onMouseUpEvent(event: MouseEvent) {
        const loc = Vec2.create(event.clientX, event.clientY);
        this.updateMouse(loc, false);
        if (this.onMouseUp(loc)) {
            event.preventDefault();
        }
    }

    private onTouchMoveEvent(event: MouseEvent) {
        const loc = Vec2.create(event.clientX, event.clientY);
        this.updateMouse(loc);
        if (this.onMouseMove(loc)) {
            event.preventDefault();
        }
    }

    private onTouchStartEvent(event: MouseEvent) {
        const loc = Vec2.create(event.clientX, event.clientY);
        this.updateMouse(loc, true);
        let consumeEvent = this.onMouseMove(loc);
        consumeEvent = this.onTouchStart(loc) || consumeEvent;
        if (consumeEvent) {
            event.preventDefault();
        }
    }

    private onTouchEndEvent(event: MouseEvent) {
        const loc = Vec2.create(event.clientX, event.clientY);
        this.updateMouse(loc, false);
        let consumeEvent = this.onMouseMove(loc);
        consumeEvent = this.onTouchEnd(loc) || consumeEvent;
        if (consumeEvent) {
            event.preventDefault();
        }
    }
}
