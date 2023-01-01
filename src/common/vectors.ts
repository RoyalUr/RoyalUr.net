
/**
 * A vector with two elements.
 */
export class Vec2 {

    static NEG1: Vec2 = new Vec2(-1, -1);
    static ZERO: Vec2 = new Vec2(0, 0);

    readonly x: number;
    readonly y: number;

    constructor(x: number, y: number) {
        if (isNaN(x) || isNaN(y))
            throw "x and y cannot be NaN: " + x + ", " + y;

        this.x = x;
        this.y = y;
    }

    toString(): string {
        return "Vec2(" + this.x + ", " + this.y + ")";
    }

    cast(): Vec2 {
        return this;
    }

    add(other: Vec2): Vec2 {
        if (other.equals(Vec2.ZERO))
            return this;
        return Vec2.create(this.x + other.x, this.y + other.y);
    }

    sub(other: Vec2): Vec2 {
        if (other.equals(Vec2.ZERO))
            return this;
        return Vec2.create(this.x - other.x, this.y - other.y);
    }

    mul(scale: number): Vec2 {
        if (scale === 1)
            return this;
        return Vec2.create(this.x * scale, this.y * scale);
    }

    lenSquared(): number {
        return this.x * this.x + this.y * this.y;
    }

    len(): number {
        return Math.sqrt(this.lenSquared());
    }

    distSquared(other: Vec2): number {
        return this.sub(other).lenSquared();
    }

    dist(other: Vec2): number {
        return this.sub(other).len();
    }

    equals(other: Vec2): boolean {
        return this.x === other.x && this.y === other.y;
    }

    /**
     * Takes a unit length step towards {@param other}.
     */
    stepTowards(other: Vec2): Vec2 {
        if (this.distSquared(other) <= 1)
            return other;

        const dx = other.x - this.x,
              dy = other.y - this.y;

        if (Math.abs(dx) < Math.abs(dy)) {
            return Vec2.create(this.x, this.y + Math.sign(dy));
        } else {
            return Vec2.create(this.x + Math.sign(dx), this.y);
        }
    }

    floor(): Vec2 {
        return Vec2.create(Math.floor(this.x), Math.floor(this.y));
    }

    static dotProduct<N extends number>(v1: Vec2, v2: Vec2): number {
        return v1.x * v2.x + v1.y * v2.y;
    }

    static project<N extends number>(v1: Vec2, v2: Vec2): number {
        return Vec2.dotProduct(v1, v2) / v2.len();
    }

    static midpoint<N extends number>(v1: Vec2, v2: Vec2): Vec2 {
        return Vec2.create(
            (v1.x + v2.x) / 2,
            (v1.y + v2.y) / 2
        );
    }

    /**
     * Linearly interpolate between {@param v1} and {@param v2} with {@param t}
     * where t=0 gives v1, and t=1 gives v2.
     */
    static linearlyInterpolate<N extends number>(v1: Vec2, v2: Vec2, t: number): Vec2 {
        return Vec2.create(
            v1.x * (1 - t) + v2.x * t,
            v1.y * (1 - t) + v2.y * t
        );
    }

    static quadratic<N extends number>(a: Vec2, b: Vec2, c: Vec2, t: number): Vec2 {
        return Vec2.create(
            0.5*a.x*t*t + b.x*t + c.x,
            0.5*a.y*t*t + b.y*t + c.y
        );
    }

    /**
     * We are lenient for convenience.
     */
    static create<N extends number>(x: number, y: number): Vec2 {
        if (x === -1 && y === -1)
            return <Vec2> Vec2.NEG1;
        if (x === 0 && y === 0)
            return <Vec2> Vec2.ZERO;
        return new Vec2(<N> x, <N> y);
    }

    static polar<N extends number>(length: N, angle: number): Vec2 {
        return Vec2.create(
            Math.cos(angle) * length,
            Math.sin(angle) * length
        );
    }
}


/**
 * A list of length-2 vectors.
 *
 * TODO : This should probably be a subclass of Array or ReadonlyArray...
 */
export class Vec2List {

    static EMPTY: Vec2List = new Vec2List([]);

    readonly vectors: Vec2[];
    length: number;
    [index: number]: Vec2;

    constructor(vectors: Vec2[]) {
        this.vectors = [];
        this.length = 0;
        for (let index = 0; index < vectors.length; ++index) {
            this.push(vectors[index]);
        }
    }

    push(vector: Vec2) {
        this[this.length] = vector;
        this.vectors.push(vector);
        this.length = this.vectors.length;
    }

    get(index: number): Vec2 {
        return this.vectors[index];
    }

    indexOf(vec: Vec2): number {
        for (let index = 0; index < this.vectors.length; ++index) {
            if(vec.equals(this.vectors[index]))
                return index;
        }
        return -1;
    }

    contains(vec: Vec2): boolean {
        return this.indexOf(vec) !== -1;
    }

    /**
     * Construct a list of vectors from a list of tuples of coordinates
     * in the form [[x1, y1], [x2, y2], ..., [xn, yn]].
     */
    static create<N extends number>(...args: [number, number][]): Vec2List {
        const vectors: Vec2[] = [];
        for (let index = 0; index < arguments.length; index += 2) {
            const loc = args[index];
            vectors.push(Vec2.create(loc[0], loc[1]));
        }
        return new Vec2List(vectors);
    }

    /**
     * Constructs a path of vectors from a list of coordinates of waypoints
     * on the path in the form [[x1, y1], [x2, y2], ..., [xn, yn]].
     *
     * All of the waypoints must be integer points.
     */
    static path<N extends number>(...args: [number, number][]): Vec2List {
        const waypoints: Vec2List<N> = Vec2List.create(...args);

        let curr: Vec2 = waypoints.get(0);
        const path: Vec2[] = [curr];
        for (let index = 1; index < waypoints.length; ++index) {
            const next = waypoints.get(index);
            while (!curr.equals(next)) {
                curr = curr.stepTowards(next);
                path.push(curr);
            }
        }
        return new Vec2List(path);
    }

    /**
     * Constructs a list of vectors for all integer positions within
     * the region from 0, 0 inclusive to width, height exclusive.
     */
    static all<N extends number>(width: number, height: number): Vec2List {
        if (width <= 0 || height <= 0 || !Number.isInteger(width) || !Number.isInteger(height))
            throw new Error("width and height must be positive integers");

        const vectors: Vec2[] = [];
        for (let x = 0; x < width; ++x) {
            for (let y = 0; y < height; ++y) {
                vectors.push(Vec2.create(x, y));
            }
        }
        return new Vec2List(vectors);
    }
}
