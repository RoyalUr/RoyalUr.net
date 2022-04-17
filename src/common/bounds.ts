
/**
 * A rectangular bounding box with a position and size.
 *
 * The left & top are in fake pixel coordinates.
 * The width & height are in real pixel coordinates.
 */
export class Bounds {
    left: number;
    top: number;
    width: number;
    height: number;

    constructor(left: number, top: number, width: number, height: number) {
        if (isNaN(left) || isNaN(top) || isNaN(width) || isNaN(height)) {
            throw new Error(
                "left, top, width, and height cannot be NaN: " +
                left + ", " + top + ", " + width + ", " + height
            );
        }

        this.left = left;
        this.top = top;
        this.width = width;
        this.height = height;
    }

    toString(): string {
        return "Bounds(" +
            "left=" + this.left + ", " +
            "top=" + this.top + ", " +
            "width=" + this.width + ", " +
            "height=" + this.height +
        ")";
    }

    equals(other: Bounds) {
        return this.left === other.left &&
               this.top === other.top &&
               this.width === other.width &&
               this.height === other.height;
    }

    static of(elem: HTMLElement) {
        const boundingBox = elem.getBoundingClientRect();
        return new Bounds(
            Math.round(boundingBox.left),
            Math.round(boundingBox.top),
            Math.ceil(boundingBox.width * window.devicePixelRatio),
            Math.ceil(boundingBox.height * window.devicePixelRatio)
        );
    }

    static create(left: number, top: number, width: number, height: number): Bounds {
        return new Bounds(left, top, width, height);
    }
}
