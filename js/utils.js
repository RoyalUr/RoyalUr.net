//
// This file contains non-game-specific utility functions.
//

function def(value, defaultValue) {
    return (value === undefined ? defaultValue : value);
}

function callListeners(listeners) {
    const args = Array.prototype.slice.call(arguments, 1);

    for(let index = 0; index < listeners.length; ++index) {
        listeners[index].apply(this, args);
    }
}



//
// COMPATIBILITY
//

window.requestAnimationFrame = window.requestAnimationFrame ||
                               window.mozRequestAnimationFrame ||
                               window.webkitRequestAnimationFrame ||
                               window.msRequestAnimationFrame ||
                               function(f) {setTimeout(f, 1000/60)};

let getTime;

if (window.performance.now) {
    getTime = function() { return window.performance.now() / 1000; };
} else if (window.performance.webkitNow) {
    getTime = function() { return window.performance.webkitNow() / 1000; };
} else {
    getTime = function() { return new Date().getTime() / 1000; };
}



//
// ERRORS
//

function error(cause) {
    const error = "[ERROR] " + cause;
    console.error(error);
    throw error;
}

function assert(predicate, message) {
    if(!predicate) {
        error(message);
    }
}



//
// GRAPHIC UTILITIES
//


const LONG_TIME_AGO = -1000;

function rgb(r, g, b) {
    if(g === undefined) {
        g = r;
        b = r;
    }

    return "rgb(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ")";
}

function rgba(r, g, b, a) {
    if(b === undefined) {
        a = g;
        g = r;
        b = r;
    }

    a = (a === undefined ? 1 : a);

    return "rgba(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ", " + a + ")";
}

function drawCircularShadow(ctx, x, y, radius, r, g, b) {
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

function fillCircle(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
}

function drawLine(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function measureDrawn(image) {
    const pixels = image.getContext("2d").getImageData(0, 0, image.width, image.height).data;

    let left = image.width,
        right = 0,
        top = image.height,
        bottom = 0;

    for(let y = 0; y < image.height; ++y) {
        for(let x = 0; x < image.width; ++x) {
            const index = (y * image.width + x) * 4;

            if(pixels[index + 3] === 0)
                continue;

            if(x < left) left = x;
            if(x > right) right = x;
            if(y < top) top = y;
            if(y > bottom) bottom = y;
        }
    }

    // No filled in pixels
    if(left > right)
        return null;

    return {
        left: left,
        right: right,
        top: top,
        bottom: bottom,
        width: (right - left) + 1,
        height: (bottom - top) + 1
    };
}

function convertHSVtoRGB(h, s, v) {
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



//
// NUMBER UTILITIES
//

function max(a, b) {
    return a > b ? a : b;
}

function min(a, b) {
    return a < b ? a : b;
}

function clamp(num, min, max) {
    return (num < min ? min : (num > max ? max : num));
}

function randElement(array) {
    return array[randInt(array.length)];
}

function rand(min, max) {
    if(min === undefined)
        return Math.random();

    if(max === undefined)
        return min * Math.random();

    return min + (max - min) * Math.random();
}

function randInt(min, max) {
    if(max === undefined) {
        max = min;
        min = 0;
    }

    return Math.floor(rand(min, max));
}

function randBool() {
    return rand() < 0.5;
}

function signum(num) {
    return (num < 0 ? -1 : (num > 0 ? 1 : 0));
}

function abs(num) {
    return (num < 0 ? -num : num);
}

function square(num) {
    return num * num;
}

function ascending(num1, num2) {
    return num1 - num2;
}

function descending(num1, num2) {
    return num2 - num1;
}

function easeInOutSine(value) {
    return (1 - Math.cos(value * Math.PI)) / 2;
}

function easeOutSine(value) {
    return Math.sin(value * 0.5 * Math.PI);
}

function easeInSine(value) {
    return 1 - easeOutSine(1 - value);
}

function isWithin(x, y, left, top, width, height) {
    return x >= left && y >= top && x <= left + width && y <= top + height;
}

function formatNumber(num, totalLength, decimalPlaces) {
    if(decimalPlaces === undefined) decimalPlaces = 0;

    let string = num.toString(),
        dotIndex = string.indexOf('.');

    if(decimalPlaces === 0) {
        if(dotIndex !== -1) string = string.substring(0, dotIndex);
    } else {
        if(dotIndex === -1) {
            dotIndex = string.length;
            string += '.';
        }

        let decimals = string.length - dotIndex - 1,
            expectedLength = string.length + decimalPlaces - decimals;

        if(expectedLength < string.length) {
            string = string.substring(0, expectedLength);
        } else {
            while(string.length < expectedLength) {
                string += '0';
            }
        }
    }

    return pad(string, totalLength);
}

// Initially faded out
function createFade(defaultInDuration, defaultOutDuration) {
    if(defaultInDuration === undefined) {
        defaultInDuration = -1;
    }

    if(defaultOutDuration === undefined) {
        defaultOutDuration = defaultInDuration;
    }

    const fade = {
        defaultInDuration: defaultInDuration,
        defaultOutDuration: defaultOutDuration,

        isFadeIn: false,
        start: LONG_TIME_AGO,
        duration: -1
    };

    fade.fade = function(isFadeIn, duration) {
        const currentValue = this.get();

        this.start = getTime();
        this.isFadeIn = isFadeIn;
        this.duration = (duration !== undefined ? duration : (isFadeIn ? this.defaultInDuration : this.defaultOutDuration));

        if(isFadeIn) {
            this.start -= currentValue * this.duration;
        } else {
            this.start -= (1 - currentValue) * this.duration;
        }

        return this;
    }.bind(fade);

    fade.fadeIn = function(duration) {
        return this.fade(true, duration);
    }.bind(fade);

    fade.fadeOut = function(duration) {
        return this.fade(false, duration);
    }.bind(fade);

    fade.visible = function() {
        return this.fade(true, 0);
    }.bind(fade);

    fade.invisible = function() {
        return this.fade(false, 0);
    }.bind(fade);

    const getRaw0To1 = function() {
        const time = getTime();

        if(time >= this.start + this.duration)
            return 1;
        if(time <= this.start)
            return 0;

        return (time - this.start) / this.duration;
    }.bind(fade);

    fade.get = function() {
        const raw = getRaw0To1();

        return (this.isFadeIn ? raw : 1 - raw);
    }.bind(fade);

    return fade;
}

function createStagedFade(inDuration, stayDuration, outDuration) {
    if(inDuration === undefined || stayDuration === undefined || outDuration === undefined)
        throw "createStagedFade: Must specify inDuration, stayDuration and outDuration";

    const fade = {
        start: getTime(),

        fade: createFade(inDuration, outDuration),

        inDuration: inDuration,
        stayDuration: stayDuration,
        outDuration: outDuration
    };

    fade.get = function() {
        const time = getTime() - this.start;

        if(stayDuration >= 0 && this.fade.isFadeIn && time >= inDuration + stayDuration) {
            const timeDiff = time - (inDuration + stayDuration);

            this.fade.fadeOut();
            this.fade.start -= timeDiff;
        }

        return this.fade.get();
    }.bind(fade);

    fade.fade.fadeIn();

    return fade;
}



//
// STRING STUFF
//

function pad(value, length, prefix) {
    if(value.length >= length) return value;
    if(prefix === undefined) prefix = ' ';

    let string = value;

    while(string.length < length) {
        string = prefix + string;
    }

    return string.substring(string.length - length, string.length);
}



//
// VECTORS
//

function vecAdd(x1, y1, x2, y2) {
    if(x2 === undefined) {
        x2 = y1[0];
        y2 = y1[1];
        y1 = x1[1];
        x1 = x1[0];
    }

    return [x1 + x2, y1 + y2];
}

function vecSub(x1, y1, x2, y2) {
    if(x2 === undefined) {
        x2 = y1[0];
        y2 = y1[1];
        y1 = x1[1];
        x1 = x1[0];
    }

    return [x1 - x2, y1 - y2];
}

function vecMul(mul, x, y) {
    if (y === undefined) {
        y = x[1];
        x = x[0];
    }

    return [mul * x, mul * y];
}

function vecLin(t, x1, y1, x2, y2) {
    if(x2 === undefined) {
        x2 = y1[0];
        y2 = y1[1];
        y1 = x1[1];
        x1 = x1[0];
    }

    return [
        (1 - t) * x1 + t * x2,
        (1 - t) * y1 + t * y2
    ];
}

function vecLen(x, y) {
    if (y === undefined) {
        y = x[1];
        x = x[0];
    }

    return Math.sqrt(x*x + y*y);
}

function vecProject(x1, y1, x2, y2) {
    if(x2 === undefined) {
        x2 = y1[0];
        y2 = y1[1];
        y1 = x1[1];
        x1 = x1[0];
    }

    return (x1 * x2 + y1 * y2) / vecLen(x2, y2);
}

function vecMidpoint(x1, y1, x2, y2) {
    if(x2 === undefined) {
        x2 = y1[0];
        y2 = y1[1];
        y1 = x1[1];
        x1 = x1[0];
    }

    return [
        (x1 + x2) / 2,
        (y1 + y2) / 2
    ];
}

function vecEquals(x1, y1, x2, y2) {
    if(x2 === undefined) {
        x2 = y1[0];
        y2 = y1[1];
        y1 = x1[1];
        x1 = x1[0];
    }

    return x1 === x2 && y1 === y2;
}

function vecDist(x1, y1, x2, y2) {
    if(x2 === undefined) {
        x2 = y1[0];
        y2 = y1[1];
        y1 = x1[1];
        x1 = x1[0];
    }

    const dx = x2 - x1,
          dy = y2 - y1;

    return Math.sqrt(dx*dx + dy*dy);
}

function vecListIndexOf(locations, x, y) {
    if(y === undefined) {
        y = x[1];
        x = x[0];
    }

    for(let index = 0; index < locations.length; ++index) {
        if(vecEquals([x, y], locations[index]))
            return index;
    }

    return -1;
}

function vecListContains(locations, x, y) {
    return vecListIndexOf(locations, x, y) !== -1;
}
