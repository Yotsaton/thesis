"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/TSP_API.ts
const express_1 = __importDefault(require("express"));
const TSP_func_1 = require("./TSP_func");
const app = (0, express_1.default)();
const port = process.env.PORT || 3000; // ใช้ port 3000 หรือ port ที่กำหนดใน Environment Variable
// Middleware เพื่อ parse JSON body ของ request
app.use(express_1.default.json());
// CORS (Cross-Origin Resource Sharing)
// อนุญาตให้ frontend ที่มาจาก origin อื่นๆ เรียกใช้ API ได้
// ใน Production ควรจะระบุ origin ที่แน่นอน (เช่น 'http://localhost:8080' หรือ 'https://your-frontend-domain.com')
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // อนุญาตทุก Origin (สำหรับ Development)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') { // Pre-flight request for CORS
        return res.sendStatus(200);
    }
    next();
});
// API Endpoint สำหรับคำนวณ TSP
app.post('/solve-tsp', (req, res) => {
    const locations = req.body.locations;
    if (!locations || !Array.isArray(locations) || locations.length === 0) {
        return res.status(400).json({ error: 'Invalid input: "locations" array is required and must not be empty.' });
    }
    // ตรวจสอบโครงสร้างของแต่ละพิกัด
    const isValid = locations.every(loc => typeof loc.name === 'string' &&
        typeof loc.lat === 'number' &&
        typeof loc.lon === 'number');
    if (!isValid) {
        return res.status(400).json({ error: 'Invalid location format. Each location must have name (string), lat (number), and lon (number).' });
    }
    console.log(`Received ${locations.length} locations for TSP calculation.`);
    // console.log(locations); // Uncomment to see received locations in console
    try {
        const result = (0, TSP_func_1.solveTSP)(locations);
        console.log(`TSP calculation complete. Total distance: ${result.distance.toFixed(2)} km`);
        res.json(result);
    }
    catch (error) {
        console.error('Error during TSP calculation:', error.message);
        res.status(500).json({ error: 'An error occurred during TSP calculation.', details: error.message });
    }
});
// Default route
app.get('/', (req, res) => {
    res.send('TSP Solver API is running. Use POST /solve-tsp to calculate.');
});
// Start the server
app.listen(port, () => {
    console.log(`TSP Solver API listening at http://localhost:${port}`);
    console.log(`Try POST to http://localhost:${port}/solve-tsp with a JSON body like:`);
    console.log(`
{
    "locations": [
        {"name": "A", "lat": 13.7563, "lon": 100.5018},
        {"name": "B", "lat": 14.9750, "lon": 102.0984},
        {"name": "C", "lat": 18.7880, "lon": 98.9870}
    ]
}
`);
});
