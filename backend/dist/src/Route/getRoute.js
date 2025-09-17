"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoute = getRoute;
require("dotenv/config");
const API_KEY = process.env.ORS_API_KEY;
const ORS_URL = "https://api.openrouteservice.org/v2/directions/driving-car";
async function getRoute(start, end) {
    const body = {
        coordinates: [
            [start.longitude, start.latitude],
            [end.longitude, end.latitude],
        ],
        instructions: true,
        language: "th",
        geometry: false,
    };
    const response = await fetch(ORS_URL, {
        method: "POST",
        headers: {
            Authorization: API_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const steps = data.features[0].properties.segments[0].steps.map((step) => ({
        instruction: step.instruction,
        distance: step.distance,
        duration: step.duration,
    }));
    return {
        distance: data.features[0].properties.summary.distance,
        duration: data.features[0].properties.summary.duration,
        steps: steps,
    };
}
