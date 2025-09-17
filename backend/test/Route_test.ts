// test/Route_test.ts
import { getRoute } from "../src/Route/functions/getRoute";

(async () => {
  const bangkok = { latitude: 13.7563, longitude: 100.5018 };
  const siam = { latitude: 13.7466, longitude: 100.5348 };
  const cheangmai = { latitude: 18.7877, longitude: 98.9931 };

  try {
    const result = await getRoute([bangkok, siam, cheangmai]);

    console.log("📍 ระยะทางรวม:", result.distance.toFixed(0), "เมตร");
    console.log("⏱️ ใช้เวลา:", (result.duration / 60).toFixed(1), "นาที");
    console.log("📋 คำแนะนำเส้นทาง:");
    result.steps.forEach((s, i) => {
      console.log(`${i + 1}. ${s.instruction} (${s.distance.toFixed(0)} ม.)`);
    });
  } catch (error) {
    console.error("❌ Error:", error);
  }
})();
