/**
 * A duration in milliseconds.
 *
 * When used for time, this is usually the number
 * of milliseconds since page load.
 */
export type Milliseconds = number;

/** A duration in seconds. **/
export type Seconds = number;


/** A displacement measured by a true number of pixels on the screen. **/
export type ScreenPixels = number;

/** A displacement measured by the 'px' unit in CSS. **/
export type StylePixels = number;


/** Convert milliseconds to seconds. **/
export function msToSecs(duration: Milliseconds): Seconds {
    return duration / 1000.0;
}

/** Convert seconds to milliseconds. **/
export function secsToMS(duration: Milliseconds): Seconds {
    return duration / 1000.0;
}


/** Convert screen pixels to style pixels. **/
export function screenToStylePx(screenPixels: ScreenPixels): StylePixels {
    return screenPixels / window.devicePixelRatio;
}

/** Convert style pixels to screen pixels. **/
export function styleToScreenPx(stylePixels: StylePixels): ScreenPixels {
    return stylePixels * window.devicePixelRatio;
}
