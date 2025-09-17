"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.haversineDistance = haversineDistance;
exports.calculatePathDistance = calculatePathDistance;
exports.generatePermutations = generatePermutations;
exports.solveTSP = solveTSP;
/**
 * Calculates the Haversine distance between two sets of coordinates.
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    return distance;
}
/**
 * Calculates the total distance of a given path.
 * @param path An array of indices representing the order of visits.
 * @param coordinates An array of Coordinate objects.
 * @returns Total distance of the path in kilometers.
 */
function calculatePathDistance(path, coordinates) {
    let totalDistance = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const p1Index = path[i];
        const p2Index = path[i + 1];
        const p1 = coordinates[p1Index];
        const p2 = coordinates[p2Index];
        totalDistance += haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);
    }
    // Add distance from the last point back to the starting point
    const lastPointIndex = path[path.length - 1];
    const firstPointIndex = path[0];
    const lastPoint = coordinates[lastPointIndex];
    const firstPoint = coordinates[firstPointIndex];
    totalDistance += haversineDistance(lastPoint.lat, lastPoint.lon, firstPoint.lat, firstPoint.lon);
    return totalDistance;
}
/**
 * Generates all permutations of an array. This is a helper for the Brute Force TSP.
 * @param arr The array to generate permutations from.
 * @returns An array of arrays, where each inner array is a permutation.
 */
function generatePermutations(arr) {
    const result = [];
    function permute(currentPermutation, remainingElements) {
        if (remainingElements.length === 0) {
            result.push(currentPermutation);
            return;
        }
        for (let i = 0; i < remainingElements.length; i++) {
            const nextElement = remainingElements[i];
            const newRemaining = remainingElements.slice(0, i).concat(remainingElements.slice(i + 1));
            permute(currentPermutation.concat(nextElement), newRemaining);
        }
    }
    permute([], arr);
    return result;
}
/**
 * Solves the Traveling Salesperson Problem (TSP) using a Brute Force approach.
 * WARNING: This is computationally expensive and only suitable for a very small number of points.
 * @param coordinates An array of Coordinate objects representing the locations to visit.
 * @returns An object containing the best path (array of Coordinate objects) and its total distance.
 */
function solveTSP(coordinates) {
    if (coordinates.length === 0) {
        return { path: [], distance: 0 };
    }
    const numPoints = coordinates.length;
    const indices = Array.from({ length: numPoints }, (_, i) => i);
    let minDistance = Infinity;
    let bestPath = [];
    const startPointIndex = 0;
    const otherPointsIndices = indices.filter(i => i !== startPointIndex);
    const permutationsOfOthers = generatePermutations(otherPointsIndices);
    for (const perm of permutationsOfOthers) {
        const currentPath = [startPointIndex, ...perm];
        const currentDistance = calculatePathDistance(currentPath, coordinates);
        if (currentDistance < minDistance) {
            minDistance = currentDistance;
            bestPath = currentPath;
        }
    }
    const bestPathCoordinates = bestPath.map(index => coordinates[index]);
    return {
        path: bestPathCoordinates,
        distance: minDistance
    };
}
