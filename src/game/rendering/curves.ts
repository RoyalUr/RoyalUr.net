//
// This file contains logic to construct and use curves.
//

import {Vec2} from "@/common/vectors";
import {min} from "@/common/utils";


export function findQuadraticBezierPoint(prev: Vec2, curr: Vec2, next: Vec2, t: number): Vec2 {
    const a = (1 - t)*(1 - t),
          b = 2*(1-t)*t,
          c = t*t;

    return Vec2.create(
        a * prev.x + b * curr.x + c * next.x,
        a * prev.y + b * curr.y + c * next.y
    );
}

/**
 * Does not include from and to, just the points in between.
 */
export function pushLineToCurve(curve: Vec2[], from: Vec2, to: Vec2, resolution: number) {
    const steps = Math.ceil(from.dist(to) / resolution);
    for (let step = 1; step < steps; ++step) {
        curve.push(Vec2.linearlyInterpolate(from, to, step / steps));
    }
}

/**
 * Given the list of locations path, construct a quadratic bezier curve.
 *
 * @param path       A list of locations to construct the bezier curve from.
 * @param resolution The maximum distance between consecutive points on the curve.
 *
 * @returns [[]] A list of locations that make up the curve
 */
export function createBezierCurveFromPath(path: Vec2[], resolution: number=2): Vec2[] {
    // Cannot create a curve with less than 2 points
    if (path.length < 2)
        return path;

    const curve: Vec2[] = [];

    // Add a straight line from the start to the first midpoint
    curve.push(path[0]);
    pushLineToCurve(curve, path[0], Vec2.midpoint(path[0], path[1]), resolution);

    for (let index = 1; index < path.length - 1; ++index) {
        const curr = path[index],
              prev = Vec2.midpoint(curr, path[index - 1]),
              next = Vec2.midpoint(curr, path[index + 1]);

        const curveIndex = curve.length;
        curve.push(prev);
        curve.push(next);

        let dist = next.dist(prev);
        while (dist > resolution) {
            const oldCount = curve.length - curveIndex,
                  newCount = 2 * oldCount - 1,
                  splits = newCount - oldCount;

            for (let splitIndex = 0; splitIndex < splits; ++splitIndex) {
                const belowIndex = curveIndex + splitIndex * 2,
                      below = curve[belowIndex],
                      above = curve[belowIndex + 1],
                      t = (splitIndex * 2 + 1) / (newCount - 1),
                      point = findQuadraticBezierPoint(prev, curr, next, t);

                curve.splice(belowIndex + 1, 0, point);
                dist = min(dist, min(point.dist(below), point.dist(above)));
            }
        }
    }

    // Add a straight line from the last midpoint to the end
    const from = path[path.length - 2],
          to = path[path.length - 1];

    pushLineToCurve(curve, Vec2.midpoint(from, to), to, resolution);
    curve.push(to);
    return curve;
}

/**
 * Returns whether a point is in front of the point at the given index in the path.
 *
 * @param point   A canvas location.
 * @param path    A tile path.
 * @param index   The index of the node to check in the path.
 * @param epsilon The radius of the object at point.
 */
export function isPointAheadInPath(point: Vec2, path: Vec2[], index: number, epsilon: number) {
    epsilon = (epsilon !== undefined ? epsilon : 0);

    if (path.length <= 1)
        throw "Path must be at least length 2";

    const currLoc = path[index];

    // Check if in-front on the prev -> curr line
    if (index > 0) {
        const line = currLoc.sub(path[index - 1]),
              relPoint = point.sub(path[index - 1]);
        if (Vec2.project(relPoint, line) < epsilon)
            return false;
    }

    // Check if in-front on the curr -> next line
    if (index < path.length - 1) {
        const line = path[index + 1].sub(currLoc),
              relPoint = point.sub(currLoc);
        if (Vec2.project(relPoint, line) < epsilon)
            return false;
    }
    return true;
}
