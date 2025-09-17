// ตัวอย่างโค้ดใน Frontend (HTML/JS file)
async function solveTSPFromAPI() {
    const locationsToSend = [
        { name: "Tokyo", lat: 35.6762, lon: 139.6503 },
        { name: "Seoul", lat: 37.5665, lon: 126.9780 },
        { name: "Beijing", lat: 39.9042, lon: 116.4074 },
        { name: "Singapore", lat: 1.3521, lon: 103.8198 }
    ];

    try {
        const response = await fetch('http://localhost:3000/solve-tsp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ locations: locationsToSend })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error: ${response.status} - ${errorData.error}`);
        }

        const data = await response.json();
        console.log("Shortest Path:", data.path);
        console.log("Total Distance:", data.distance.toFixed(2), "km");

        // แสดงผลลัพธ์ใน UI ของ Frontend (ถ้ามี)
        const resultDiv = document.getElementById('tsp-result');
        if (resultDiv) {
            resultDiv.innerHTML = `
                <h2>TSP Result:</h2>
                <p>Total Distance: <strong>${data.distance.toFixed(2)} km</strong></p>
                <p>Path: ${data.path.map(loc => loc.name).join(' -> ')} -> ${data.path[0].name} (กลับจุดเริ่มต้น)</p>
            `;
        }

    } catch (error) {
        console.error("Failed to fetch TSP solution:", error);
        const resultDiv = document.getElementById('tsp-result');
        if (resultDiv) {
            resultDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        }
    }
}

// เรียกใช้ฟังก์ชันเมื่อต้องการ
solveTSPFromAPI();