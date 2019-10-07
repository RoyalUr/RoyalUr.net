//
// This file contains logic to construct and use curves.
//

function findQuadraticBezierPoint(prev, curr, next, t) {
    const a = (1 - t)*(1 - t),
          b = 2*(1-t)*t,
          c = t*t;

    return vec(
        a * prev.x + b * curr.x + c * next.x,
        a * prev.y + b * curr.y + c * next.y
    );
}

/**
 * Does not include from and to, just the points in between.
 */
function pushLineToCurve(curve, from, to, resolution) {
    const steps = Math.ceil(vecDist(from, to) / resolution);
    for (let step = 1; step < steps; ++step) {
        curve.push(vecLin(from, to, step / steps));
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
function createBezierCurveFromPath(path, resolution) {
    resolution = (resolution !== undefined ? resolution : 2);

    // Cannot create a curve with less than 2 points
    if (path.length < 2)
        return path;

    const curve = [];

    // Add a straight line from the start to the first midpoint
    curve.push(path[0]);
    pushLineToCurve(curve, path[0], vecMidpoint(path[0], path[1]), resolution);

    for (let index = 1; index < path.length - 1; ++index) {
        const curr = path[index],
              prev = vecMidpoint(curr, path[index - 1]),
              next = vecMidpoint(curr, path[index + 1]);

        const curveIndex = curve.length;
        curve.push(prev);
        curve.push(next);

        let dist = vecDist(next, prev);
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
                dist = min(dist, min(vecDist(point, below), vecDist(point, above)));
            }
        }
    }

    // Add a straight line from the last midpoint to the end
    const from = path[path.length - 2],
          to = path[path.length - 1];

    pushLineToCurve(curve, vecMidpoint(from, to), to, resolution);
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
