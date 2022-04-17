//
// Code to listen to and handle mouse events.
//

import {Vec2} from "@/common/vectors";
import {getTime, LONG_TIME_AGO} from "@/common/utils";


/**
 * The mouse listener methods should return whether they wish to consume
 * the event and stop it propagating to any HTML components.
 */
export interface MouseListener {
    onMouseMove(loc: Vec2): boolean;
    onMouseDown(loc: Vec2): boolean;
    onMouseUp(loc: Vec2): boolean;
    onTouchStart(loc: Vec2): boolean;
    onTouchEnd(loc: Vec2): boolean;
}

abstract class MouseAdapter implements MouseListener {
    private readonly mouseListeners: MouseListener[] = [];

    addMouseListener(listener: MouseListener) {
        this.mouseListeners.push(listener);
    }

    removeMouseListener(listener: MouseListener) {
        const index = this.mouseListeners.indexOf(listener);
        if (index >= 0) {
            this.mouseListeners.splice(index, 1);
        }
    }

    protected abstract adaptMouseLoc(loc: Vec2): Vec2;

    protected abstract getRawMouseLoc(): Vec2;

    abstract isMouseDown(): boolean;

    abstract getMouseDownTime(): number;

    protected abstract getRawMouseDownLoc(): Vec2;

    getMouseLoc(): Vec2 {
        return this.adaptMouseLoc(this.getRawMouseLoc());
    }

    getMouseDownLoc(): Vec2 {
        return this.adaptMouseLoc(this.getRawMouseDownLoc());
    }

    private invokeMouseListeners(loc: Vec2, invokeFn: (listener: MouseListener, adaptedLoc: Vec2) => boolean): boolean {
        const adaptedLoc = this.adaptMouseLoc(loc);

        let consumeEvent = false;
        for (let index = 0; index < this.mouseListeners.length; ++index) {
            consumeEvent = invokeFn(this.mouseListeners[index], adaptedLoc) || consumeEvent;
        }
        return consumeEvent;
    }

    onMouseMove(loc: Vec2): boolean {
        return this.invokeMouseListeners(loc, (listener, adaptedLoc) => listener.onMouseMove(adaptedLoc));
    }

    onMouseDown(loc: Vec2): boolean {
        return this.invokeMouseListeners(loc, (listener, adaptedLoc) => listener.onMouseDown(adaptedLoc));
    }

    onMouseUp(loc: Vec2): boolean {
        return this.invokeMouseListeners(loc, (listener, adaptedLoc) => listener.onMouseUp(adaptedLoc));
    }

    onTouchStart(loc: Vec2): boolean {
        return this.invokeMouseListeners(loc, (listener, adaptedLoc) => listener.onTouchStart(adaptedLoc));
    }

    onTouchEnd(loc: Vec2): boolean {
        return this.invokeMouseListeners(loc, (listener, adaptedLoc) => listener.onTouchEnd(adaptedLoc));
    }
}

abstract class DelegatedMouseAdapter extends MouseAdapter {

    private readonly parent: MouseAdapter;

    protected constructor(parent: MouseAdapter) {
        super();
        this.parent = parent;
    }

    protected override getRawMouseLoc(): Vec2 {
        return this.parent.getMouseLoc();
    }

    override isMouseDown(): boolean {
        return this.parent.isMouseDown();
    }

    override getMouseDownTime(): number {
        return this.parent.getMouseDownTime();
    }

    protected override getRawMouseDownLoc(): Vec2 {
        return this.parent.getMouseDownLoc();
    }
}


/**
 * Performs a linear shift and scale to the mouse location, and optionally rounds the result.
 */
export class LinearMouseAdapter extends DelegatedMouseAdapter {

    private anchorLoc: Vec2 = Vec2.ZERO;
    private scale: number = 1;
    private floor: boolean;

    constructor(parent: MouseAdapter) {
        super(parent);
    }

    setTransform(anchorLoc: Vec2, scale: number, floor?: boolean) {
        this.anchorLoc = anchorLoc;
        this.scale = scale;
        this.floor = !!floor;
    }

    protected override adaptMouseLoc(loc: Vec2): Vec2 {
        const adapted = loc.sub(this.anchorLoc).mul(this.scale);
        return this.floor ? adapted.floor() : adapted;
    }
}

export class MouseEventSource extends MouseAdapter {

    mouseLoc: Vec2 = Vec2.NEG1;
    mouseDown: boolean = false;
    mouseDownTime: number = LONG_TIME_AGO;
    mouseDownLoc: Vec2 = Vec2.NEG1;

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
        element.addEventListener("touchstart", this.onTouchMoveEvent.bind(this));
        element.addEventListener("touchend", this.onTouchMoveEvent.bind(this));
    }

    protected override adaptMouseLoc(loc: Vec2): Vec2 {
        return loc;
    }

    protected override getRawMouseLoc(): Vec2 {
        return this.mouseLoc;
    }

    override isMouseDown(): boolean {
        return this.mouseDown;
    }

    override getMouseDownTime(): number {
        return this.mouseDownTime;
    }

    protected override getRawMouseDownLoc(): Vec2 {
        return this.mouseDownLoc;
    }

    private updateMouse(loc: Vec2, isDown?: boolean) {
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
