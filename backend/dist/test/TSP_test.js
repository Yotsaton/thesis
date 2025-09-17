"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// TSP_test.ts
const TSP_func_1 = require("../src/TSP_Medthod/TSP_func"); // Import the main TSP solver function
// --- Example Usage ---
const locations = [
    { name: "Location A (Bangkok)", lat: 13.7563, lon: 100.5018 },
    { name: "Location B (Nakhon Ratchasima)", lat: 14.9750, lon: 102.0984 },
    { name: "Location C (Chiang Mai)", lat: 18.7880, lon: 98.9870 },
    { name: "Location D (Phuket)", lat: 7.8804, lon: 98.3923 }
];
console.log("Solving TSP for the following locations:");
locations.forEach(loc => console.log(`- ${loc.name} (Lat: ${loc.lat}, Lon: ${loc.lon})`));
console.log("\nCalculating the shortest path...");
const result = (0, TSP_func_1.solveTSP)(locations);
console.log("\n--- TSP Result ---");
console.log("Shortest Path:");
result.path.forEach((loc, index) => {
    console.log(`${index + 1}. ${loc.name}`);
});
console.log(`Total Shortest Distance: ${result.distance.toFixed(2)} km`);
// Another example with fewer points
const smallLocations = [
    { name: "Point 1 (LA)", lat: 34.0522, lon: -118.2437 },
    { name: "Point 2 (NY)", lat: 40.7128, lon: -74.0060 },
    { name: "Point 3 (London)", lat: 51.5074, lon: -0.1278 }
];
console.log("\n-----------------------------------");
console.log("Solving TSP for a smaller set of locations:");
smallLocations.forEach(loc => console.log(`- ${loc.name} (Lat: ${loc.lat}, Lon: ${loc.lon})`));
console.log("\nCalculating the shortest path...");
const smallResult = (0, TSP_func_1.solveTSP)(smallLocations);
console.log("\n--- TSP Result (Smaller Set) ---");
console.log("Shortest Path:");
smallResult.path.forEach((loc, index) => {
    console.log(`${index + 1}. ${loc.name}`);
});
console.log(`Total Shortest Distance: ${smallResult.distance.toFixed(2)} km`);
