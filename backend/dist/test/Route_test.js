"use strict";
console.log(process.env.ORS_API_KEY)
Object.defineProperty(exports, "__esModule", { value: true });
const getRoute_1 = require("../src/Route/getRoute");
(async () => {
    const bangkok = { latitude: 13.7563, longitude: 100.5018 };
    const siam = { latitude: 13.7466, longitude: 100.5348 };
    try {
        const result = await (0, getRoute_1.getRoute)(bangkok, siam);
        console.log("📍 ระยะทางรวม:", result.distance.toFixed(0), "เมตร");
        console.log("⏱️ ใช้เวลา:", (result.duration / 60).toFixed(1), "นาที");
        console.log("📋 คำแนะนำเส้นทาง:");
        result.steps.forEach((s, i) => {
            console.log(`${i + 1}. ${s.instruction} (${s.distance.toFixed(0)} ม.)`);
        });
    }
    catch (error) {
        console.error("❌ Error:", error);
    }
})();
