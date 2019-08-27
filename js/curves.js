//
// This file contains logic to construct and use curves.
//

function findQuadraticBezierPoint(prev, curr, next, t) {
    const a = (1 - t)*(1 - t),
        b = 2*(1-t)*t,
        c = t*t;

    return [
        a * prev[0] + b * curr[0] + c * next[0],
        a * prev[1] + b * curr[1] + c * next[1]
    ];
}

function findBezierCurveIndexFromPathIndex(path, curve, pathIndex) {
    if (pathIndex < 0 || pathIndex >= path.length)
        return -1;
    if (pathIndex === 0)
        return 0;
    if (pathIndex === path.length - 1)
        return curve.length - 1;

    const resolution = (curve.length - 2) / (path.length - 2);
    return Math.round(1 + (pathIndex - 0.5) * resolution);
}

/**
 * Given the list of locations path, construct a quadratic bezier curve.
 *
 * @param path       A list of locations to construct the bezier curve from.
 * @param resolution The number of points to place between each point in the given path.
 *
 * @returns A list of locations that make up the curve
 */
function createBezierCurveFromPath(path, resolution) {
    resolution = (resolution !== undefined ? resolution : 30);

    // Cannot create a curve with less than 2 points
    if (path.length < 2)
        return path;

    const curve = [];

    // Add a straight line from the start to the first midpoint
    for (let t=0; t < resolution / 2; ++t) {
        const point = vecLin(t / resolution, path[0], path[1]);
        curve.push(point);
    }

    for (let index = 1; index < path.length - 1; ++index) {
        const curr = path[index],
              prev = vecMidpoint(curr, path[index - 1]),
              next = vecMidpoint(curr, path[index + 1]);

        for (let t=0; t < resolution; ++t) {
            const point = findQuadraticBezierPoint(prev, curr, next, t / resolution);
            curve.push(point);
        }
    }

    // Add a straight line from the last midpoint to the end
    for (let t=Math.ceil(resolution / 2); t < resolution; ++t) {
        const point = vecLin(t / resolution, path[path.length - 2], path[path.length - 1]);
        curve.push(point);
    }

    curve.push(path[path.length - 1]);
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
function isPointAheadInPath(point, path, index, epsilon) {
    epsilon = (epsilon !== undefined ? epsilon : 0);

    if (path.length <= 1)
        throw "Path must be at least length 2";

    const currLoc = path[index];

    // Check if in-front on the prev -> curr line
    if (index > 0) {
        const line = vecSub(currLoc, path[index - 1]),
            relPoint = vecSub(point, path[index - 1]);
        if (vecProject(relPoint, line) < epsilon)
            return false;
    }

    // Check if in-front on the curr -> next line
    if (index < path.length - 1) {
        const line = vecSub(path[index + 1], currLoc),
            relPoint = vecSub(point, currLoc);
        if (vecProject(relPoint, line) < epsilon)
            return false;
    }

    return true;
}
