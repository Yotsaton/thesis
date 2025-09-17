// test/TSP_test.ts
import { solveTSPWithStartEnd } from '../src/Route/functions/TSP_func'; // Import the main TSP solver function
import { Coordinate, TSPResult } from '../src/TSP_Medthod/TSP_types'; // Import interfaces

// สมมติว่านี่คือข้อมูลของคุณ
const myCoordinates: Coordinate[] = [
    { name: "A", lat: 13.7563, lon: 100.5018 }, // index 0
    { name: "B", lat: 14.0046, lon: 100.5255 }, // index 1
    { name: "C", lat: 13.8475, lon: 100.6018 }, // index 2
    { name: "D", lat: 13.6899, lon: 100.7501 }  // index 3
];

// เรียกใช้ฟังก์ชันใหม่ โดยระบุ index เริ่มต้นและสิ้นสุด
const result = solveTSPWithStartEnd(myCoordinates, 0, 0);

console.log("Best Path:", result.path.map(p => p.name).join(" -> "));
console.log("Total Distance:", result.distance.toFixed(2), "km");

// ผลลัพธ์ที่เป็นไปได้ (ลำดับของ B และ C อาจสลับกันขึ้นอยู่กับระยะทางจริง)
// Best Path: A -> C -> B -> D
// Total Distance: 85.34 km