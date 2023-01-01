//
// This file contains non-game-specific utility functions.
//

import {Milliseconds} from "@/common/units";

export const LONG_TIME_AGO = -1000;

export function getOrDefault<K extends keyof any, V>(dict: {[key in K]?: V}, key: K, defaultValue: V): V {
    if (!dict)
        return defaultValue;

    const value = dict[key];
    return (value ? value : defaultValue);
}

export function debounce(func, time: number = 100) {
    let timer = null;
    return function(event) {
        if (timer) {
            clearTimeout(timer);
        }

        const context = this, args = arguments;
        timer = setTimeout(() => func.apply(context, args), time, event);
    };
}


//
// DOM INTERACTION
//

declare global {
    interface HTMLElement { royalUrPreviousStyles: object; }
}

/** Sets the opacity of an element, and if that opacity is 0 sets the element to display: none. **/
export function setElemOpacity(elem: HTMLElement, opacity: number) {
    setElemStyle(elem, "opacity", opacity);
    setElemStyle(elem, "display", opacity <= 0 ? "none" : "");
}

/** Sets a style of an element, only if it has changed. **/
export function setElemStyle(elem: HTMLElement, style: string, value: any) {
    let previousStyles = elem.royalUrPreviousStyles;
    if (!previousStyles) {
        previousStyles = {};
        elem.royalUrPreviousStyles = previousStyles;
    }

    // Avoid updating the style if we do not need to.
    if (previousStyles[style] === value)
        return;

    elem.style[style] = value;
    previousStyles[style] = value;
}

export function selectText(textBox: HTMLTextAreaElement) {
    textBox.select();
    textBox.setSelectionRange(0, 99999);
    textBox.focus();
}

export function copyText(textBoxID: string) {
    const textBox = document.getElementById(textBoxID) as HTMLTextAreaElement;
    selectText(textBox);
    document.execCommand("copy");
    textBox.selectionStart = textBox.selectionEnd;
    textBox.blur();
}

export function isAudioElementPlaying(element: HTMLAudioElement): boolean {
    return element.currentTime > 0 && !element.paused && !element.ended && element.readyState > 2;
}

export function jumpToID(id: string) {
    const elem = document.createElement("a");
    elem.setAttribute("href", "#" + id);
    elem.click();
    elem.remove();
}

/**
 * Adds or removes a class from the given element {@param elem}.
 * If {@param added} is true, then the class {@param clazz} is added.
 * Otherwise, the class {@param clazz} is removed.
 */
export function setElementClass(elem: HTMLElement, clazz: string, added: boolean) {
    if (added) {
        elem.classList.add(clazz);
    } else {
        elem.classList.remove(clazz);
    }
}

export function getElemByID(id: string): HTMLElement {
    return document.getElementById(id);
}

export function getDivByID(id: string): HTMLDivElement {
    return <HTMLDivElement> getElemByID(id);
}

export function getCanvasByID(id: string): HTMLCanvasElement {
    return <HTMLCanvasElement> getElemByID(id);
}



//
// COMPATIBILITY
//

// Timing.
let getTimeFn: () => Milliseconds = null;
if (typeof window !== "undefined") {
    const win = window as any;
    win.requestAnimationFrame = win.requestAnimationFrame ||
        win.webkitRequestAnimationFrame ||
        ((f) => setTimeout(f, 1000/60.0));

    if (window.performance.now) {
        getTimeFn = () => window.performance.now() / 1000;
    }
}
if (getTimeFn === null) {
    getTimeFn = () => new Date().getTime() / 1000;
}
export function getTime(): Milliseconds {
    return getTimeFn();
}


// Check if an array includes an element.
if (!Array.prototype.includes) {
    Object.defineProperty(Array.prototype, "includes", {
        enumerable: false,
        value: function(obj) {
            for (let index = 0; index < this.length; ++index) {
                if (this[index] === obj)
                    return true;
            }
            return false;
        }
    });
}

// Get the first element from an array that matches a predicate.
if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
        value: function(predicate) {
            if (this == null)
                throw TypeError('"this" is null or not defined');
            if (typeof predicate !== 'function')
                throw TypeError('predicate must be a function');

            const o = Object(this),
                len = o.length >>> 0,
                thisArg = arguments[1];

            for (let k = 0; k < len; ++k) {
                const kValue = o[k];
                if (predicate.call(thisArg, kValue, k, o))
                    return kValue;
            }
            return undefined;
        },
        configurable: true,
        writable: true
    });
}


/**
 * @author James Westgate
 */
export function testWebPSupport(callback: (supported: boolean) => void) {
    const webP = new Image();
    webP.onload = webP.onerror = () => { callback(webP.height === 2); };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
}



//
// ERRORS
//

export function error(cause: string) {
    const error = "[ERROR] " + cause;
    console.trace(error);
    throw new Error(error);
}

export function assert(predicate: boolean, message: string) {
    if(!predicate) {
        error(message);
    }
}



//
// GRAPHIC UTILITIES
//

export function renderResource(
    width: number, height: number,
    renderFunction: (CanvasRenderingContext2D, HTMLCanvasElement) => void): HTMLCanvasElement {

    if (isNaN(width) || isNaN(height))
        throw "Width and height cannot be NaN, was given " + width + " x " + height;
    if (width < 1 || height < 1)
        throw "Width and height must both be at least 1, was given " + width + " x " + height;

    const canvas = document.createElement("canvas"),
          ctx = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    renderFunction(ctx, canvas);
    return canvas;
}

export function rgb(r: number, g?: number, b?: number): string {
    if(g === undefined) {
        g = r;
        b = r;
    }
    assert(b !== undefined, "Cannot only provide red and green, without blue")
    return "rgb(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ")";
}

export function rgba(r: number, g: number, b?: number, a?: number): string {
    if(b === undefined) {
        a = g;
        g = r;
        b = r;
    }
    a = (a === undefined ? 1 : a);
    return "rgba(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ", " + a + ")";
}

export function drawCircularShadow(
        ctx: CanvasRenderingContext2D,
        x: number, y: number, radius: number,
        r?: number, g?: number, b?: number) {

    if(r === undefined) {
        r = 0;
        g = 0;
        b = 0;
    } else if (g === undefined) {
        g = r;
        b = r;
    }
    assert(b !== undefined, "Cannot only provide red and green, without blue");

    ctx.save();

    const gradient = ctx.createRadialGradient(x, y, radius * 0.75, x, y, radius * 1.3);

    gradient.addColorStop(0, rgba(r, g, b, 1));
    gradient.addColorStop(0.33, rgba(r, g, b, 0.7));
    gradient.addColorStop(0.66, rgba(r, g, b, 0.4));
    gradient.addColorStop(1, rgba(r, g, b, 0));

    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.arc(x, y, radius * 1.5, 0, 2 * Math.PI);
    ctx.fill();

    ctx.restore();
}

export function pathRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number) {

    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y,   x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x,   y+h, r);
    ctx.arcTo(x,   y+h, x,   y,   r);
    ctx.arcTo(x,   y,   x+w, y,   r);
    ctx.closePath();
}

export function convertHSVtoRGB(h: number, s: number, v: number): {r: number, g: number, b: number} {
    let r, g, b, i, f, p, q, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

export function isImageLoaded(image: HTMLImageElement): boolean {
    return image.complete && image.naturalWidth !== 0;
}



//
// NUMBER UTILITIES
//

export function max(a: number, b: number): number {
    return a > b ? a : b;
}

export function min(a: number, b: number): number {
    return a < b ? a : b;
}

export function clamp(num: number, min: number, max: number): number {
    return (num < min ? min : (num > max ? max : num));
}

export function randElement<V>(array: V[]): V {
    return array[randInt(array.length)];
}

export function rand(min?: number, max?: number): number {
    if(min === undefined)
        return Math.random();
    if(max === undefined)
        return min * Math.random();
    return min + (max - min) * Math.random();
}

export function randInt(min: number, max?: number): number {
    if (max === undefined) {
        max = min;
        min = 0;
    }
    return clamp(Math.floor(rand(min, max)), min, max - 1);
}

export function randBool(): boolean {
    return rand() < 0.5;
}

export function easeInOutSine(value: number): number {
    return (1 - Math.cos(value * Math.PI)) / 2;
}

export function easeOutSine(value: number): number {
    return Math.sin(value * 0.5 * Math.PI);
}

export function easeInSine(value: number): number {
    return 1 - easeOutSine(1 - value);
}



//
// STRING STUFF
//

export function pad(value: string, length: number, prefix: string): string {
    if(value.length >= length) return value;
    if(prefix === undefined) prefix = ' ';
    let string = value;
    while(string.length < length) {
        string = prefix + string;
    }
    return string.substring(string.length - length, string.length);
}

/**
 * A format function used on Stack Overflow to format strings.
 *
 * e.g. formatUnicorn(
 *             "Hello, {name}, are you feeling {adjective}?",
 *             {name:"Gabriel", adjective: "OK"})
 *     outputs:
 *         "Hello, Gabriel, are you feeling OK?"
 */
export function formatUnicorn(str: string, ...parameters): string {
    if (!parameters.length)
        return str;

    const isArray = (typeof parameters[0] === "string" || typeof parameters[0] === "number"),
          args = isArray ? Array.prototype.slice.call(parameters) : parameters[0];
    for (let key in args) {
        if (args.hasOwnProperty(key)) {
            str = str.replace(new RegExp("\\{" + key + "\\}", "gi"), args[key]);
        }
    }
    return str;
}
