//
// This file contains non-game-specific utility functions.
//

export const LONG_TIME_AGO = -1000;

export function unimplemented(name) {
    return () => { error(name + " is not implemented within " + this.__class_name__); };
}

export function getOrDefault(dict, key, defaultValue) {
    if (!dict)
        return defaultValue;
    const value = dict[key];
    return (value ? value : defaultValue);
}


//
// DOM INTERACTION
//

/** Sets the opacity of an element, and if that opacity is 0 sets the element to display: none. **/
export function setElemOpacity(elem, opacity) {
    setElemStyle(elem, "opacity", opacity);
    setElemStyle(elem, "display", opacity <= 0 ? "none" : "");
}

/** Sets a style of an element, only if it has changed. **/
export function setElemStyle(elem, style, value) {
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

export function setSuperClass(subclass, superclass) {
    subclass.prototype = Object.create(superclass.prototype);
    Object.defineProperty(subclass.prototype, "constructor", {
        value: subclass, enumerable: false, writable: true
    });
}

export function selectText(textBox) {
    textBox.select();
    textBox.setSelectionRange(0, 99999);
    textBox.focus();
}

export function copyText(textBoxID) {
    const textBox = document.getElementById(textBoxID);
    selectText(textBox);
    document.execCommand("copy");
    textBox.selectionStart = textBox.selectionEnd;
    textBox.blur();
}

export function isAudioElementPlaying(element) {
    return element.currentTime > 0 && !element.paused && !element.ended && element.readyState > 2;
}

export function jumpToID(id) {
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
export function setElementClass(elem, clazz, added) {
    if (added) {
        elem.classList.add(clazz);
    } else {
        elem.classList.remove(clazz);
    }
}



//
// COMPATIBILITY
//

// Timing.
let getTimeFn = null;
if (typeof window !== "undefined") {
    window.requestAnimationFrame = window.requestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function(f) {setTimeout(f, 1000/60)};

    if (window.performance.now) {
        getTimeFn = function() { return window.performance.now() / 1000; };
    } else if (window.performance.webkitNow) {
        getTimeFn = function() { return window.performance.webkitNow() / 1000; };
    }
}
if (getTimeFn === null) {
    getTimeFn = function() { return new Date().getTime() / 1000; };
}
export function getTime() {
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
export function testWebPSupport(callback) {
    const webP = new Image();
    webP.onload = webP.onerror = () => { callback(webP.height === 2); };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
}



//
// ERRORS
//

export function error(cause) {
    const error = "[ERROR] " + cause;
    console.trace(error);
    throw new Error(error);
}

export function assert(predicate, message) {
    if(!predicate) {
        error(message);
    }
}



//
// GRAPHIC UTILITIES
//

export function renderResource(width, height, renderFunction) {
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

export function rgb(r, g, b) {
    if(g === undefined) {
        g = r;
        b = r;
    }
    return "rgb(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ")";
}

export function rgba(r, g, b, a) {
    if(b === undefined) {
        a = g;
        g = r;
        b = r;
    }
    a = (a === undefined ? 1 : a);
    return "rgba(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ", " + a + ")";
}

export function drawCircularShadow(ctx, x, y, radius, r, g, b) {
    if(r === undefined) {
        r = 0;
        g = 0;
        b = 0;
    } else if(g === undefined) {
        g = r;
        b = r;
    }

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

export function pathRoundedRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y,   x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x,   y+h, r);
    ctx.arcTo(x,   y+h, x,   y,   r);
    ctx.arcTo(x,   y,   x+w, y,   r);
    ctx.closePath();
    return ctx;
}

export function convertHSVtoRGB(h, s, v) {
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

export function isImageLoaded(image) {
    return image.complete && image.naturalWidth !== 0;
}



//
// NUMBER UTILITIES
//

export function max(a, b) {
    return a > b ? a : b;
}

export function min(a, b) {
    return a < b ? a : b;
}

export function clamp(num, min, max) {
    return (num < min ? min : (num > max ? max : num));
}

export function randElement(array) {
    return array[randInt(array.length)];
}

export function rand(min, max) {
    if(min === undefined)
        return Math.random();

    if(max === undefined)
        return min * Math.random();

    return min + (max - min) * Math.random();
}

export function randInt(min, max) {
    if (min === undefined)
        return -1;
    if (max === undefined) {
        max = min;
        min = 0;
    }
    return clamp(Math.floor(rand(min, max)), min, max - 1);
}

export function randBool() {
    return rand() < 0.5;
}

export function easeInOutSine(value) {
    return (1 - Math.cos(value * Math.PI)) / 2;
}

export function easeOutSine(value) {
    return Math.sin(value * 0.5 * Math.PI);
}

export function easeInSine(value) {
    return 1 - easeOutSine(1 - value);
}

/** Allows the controlling of animations based on linearly interpolating between 0 and 1. **/
export function Fade(defaultInDuration, defaultOutDuration) {
    this.__class_name__ = "Fade";
    this.defaultInDuration = (defaultInDuration === undefined ? -1 : defaultInDuration);
    this.defaultOutDuration = (defaultOutDuration === undefined ? this.defaultInDuration : defaultOutDuration);
    this.direction = "out";
    this.start = LONG_TIME_AGO;
    this.duration = -1;
}
Fade.prototype.fade = function(isFadeIn, duration, fromStart) {
    const currentValue = this.get();
    this.start = getTime();
    this.direction = (isFadeIn ? "in" : "out");
    this.duration = (duration !== undefined ? duration : (isFadeIn ? this.defaultInDuration : this.defaultOutDuration));
    // Correct the start time so the get() value never jumps.
    if (!fromStart) {
        if(isFadeIn) {
            this.start -= currentValue * this.duration;
        } else {
            this.start -= (1 - currentValue) * this.duration;
        }
    }
    return this;
};
Fade.prototype.isFadeIn = function() {
    return this.direction === "in";
};
Fade.prototype.isFadeOut = function() {
    return this.direction === "out";
};
Fade.prototype.fadeIn = function(duration) {
    return this.fade(true, duration);
};
Fade.prototype.fadeOut = function(duration) {
    return this.fade(false, duration);
};
Fade.prototype.visible = function() {
    return this.fade(true, 0);
};
Fade.prototype.invisible = function() {
    return this.fade(false, 0);
};
Fade.prototype.getRaw0To1 = function() {
    const time = getTime();
    if(time >= this.start + this.duration)
        return 1;
    if(time <= this.start)
        return 0;
    return (time - this.start) / this.duration;
};
Fade.prototype.get = function() {
    const raw = this.getRaw0To1();
    return (this.direction === "in" ? raw : 1 - raw);
};


/** An asymmetric fade which fades in, waits, and then fades out. **/
export function StagedFade(inDuration, stayDuration, outDuration) {
    if(inDuration === undefined || stayDuration === undefined || outDuration === undefined)
        throw "Must specify inDuration, stayDuration, and outDuration";

    Fade.call(this, inDuration + stayDuration + outDuration, outDuration);
    this.__class_name__ = "StagedFade";
    this.inDuration = inDuration;
    this.stayDuration = stayDuration;
    this.outDuration = outDuration;
    this.inRatio = inDuration / this.defaultInDuration;
    this.stayRatio = stayDuration / this.defaultInDuration;
    this.outRatio = outDuration / this.defaultInDuration;
}
setSuperClass(StagedFade, Fade);

StagedFade.prototype.fade = function(isFadeIn, duration, fromStart) {
    const currentValue = this.get();
    Fade.prototype.fade.call(this, isFadeIn, duration, true);

    // Correct the start time so that the fades line up.
    if (!fromStart) {
        if (isFadeIn) {
            this.start += currentValue * this.inDuration;
        } else {
            this.start -= (1 - currentValue) * this.outDuration;
        }
    }
    return this;
};
StagedFade.prototype.get = function() {
    let value = Fade.prototype.get.call(this);
    if (Fade.prototype.isFadeOut.call(this))
        return value;
    if (value <= this.inRatio)
        return value / this.inRatio;
    if (value <= this.inRatio + this.stayRatio)
        return 1;
    return (1 - value) / this.outRatio;
};
StagedFade.prototype.isFadeIn = function() {
    if (Fade.prototype.isFadeOut.call(this))
        return false;
    return Fade.prototype.get.call(this) <= this.inDuration + this.stayDuration;
};
StagedFade.prototype.isFadeOut = function() {
    if (Fade.prototype.isFadeOut.call(this))
        return true;
    return Fade.prototype.get.call(this) > this.inDuration + this.stayDuration;
};



//
// STRING STUFF
//

export function pad(value, length, prefix) {
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
export function formatUnicorn(str, ...parameters) {
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


//
// VECTORS
//

const VEC_NEG1 = new Vector2D(-1, -1);

export function Vector2D(x, y) {
    this.x = x;
    this.y = y;
}
Vector2D.prototype.toString = function() {
    return "Vector2D(" + this.x + ", " + this.y + ")";
};

/**
 * Create a vector with the given {@param x} and {@param y} components.
 */
export function vec(x, y) {
    if (typeof x !== "number" || typeof y !== "number")
        throw "x and y must be numbers: " + x + ", " + y;
    if (isNaN(x) || isNaN(y))
        throw "x and y cannot be NaN: " + x + ", " + y;
    if (x === -1 && y === -1)
        return VEC_NEG1;
    return new Vector2D(x, y);
}

/**
 * Construct a list of vectors from a list of pairs of coordinates in the form [x1, y1, x2, y2, ..., xn, yn].
 */
export function vecList() {
    if (arguments.length % 2 !== 0)
        throw "Arguments must be of even length";

    const vecs = [];
    for (let index = 0; index < arguments.length; index += 2) {
        const x = arguments[index],
              y = arguments[index + 1],
              v = vec(x, y);

        vecs.push(v);
    }
    return vecs;
}

export function vecAdd(v1, v2) {
    return vec(v1.x + v2.x, v1.y + v2.y);
}

export function vecSub(v1, v2) {
    return vec(v1.x - v2.x, v1.y - v2.y);
}

export function vecMul(v, mul) {
    return vec(mul * v.x, mul * v.y);
}

/**
 * Linearly interpolate between {@param v1} and {@param v2} with {@param t}
 * giving the distance moved from v1 to v2 as a value from 0 to 1 inclusive.
 */
export function vecLin(v1, v2, t) {
    return vec(
        v1.x * (1 - t) + v2.x * t,
        v1.y * (1 - t) + v2.y * t
    );
}

export function vecLenSquared(v) {
    return v.x * v.x + v.y * v.y;
}

export function vecLen(v) {
    return Math.sqrt(vecLenSquared(v));
}

/**
 * Get the dot product of {@param v1} and {@param v2}.
 */
export function vecDot(v1, v2) {
    return v1.x * v2.x + v1.y * v2;
}

/**
 * Get the vector projection of {@param v1} onto {@param v2}.
 */
export function vecProject(v1, v2) {
    return vecDot(v1, v2) / vecLen(v2);
}

export function vecMidpoint(v1, v2) {
    return vec(
        (v1.x + v2.x) / 2,
        (v1.y + v2.y) / 2
    );
}

export function vecEquals(v1, v2) {
    return v1.x === v2.x && v1.y === v2.y;
}

export function vecDist(v1, v2) {
    return vecLen(vecSub(v1, v2));
}

export function vecListIndexOf(locations, v) {
    for(let index = 0; index < locations.length; ++index) {
        if(vecEquals(locations[index], v))
            return index;
    }
    return -1;
}

export function vecListContains(locations, v) {
    return vecListIndexOf(locations, v) !== -1;
}
