// .src/api/register.api.ts

import 'dotenv/config'
import { Router, Request, Response } from 'express';
import { processPlaces } from '../place/functions/processPlaces'; // Import ฟังก์ชันหลักของเรา
import { ResolveInput } from '../place/types/place.type';

// สร้าง Router instance
const router = Router();

/**
 * @route   POST /api/places/process
 * @desc    รับ Array ของ ResolveInput แล้วประมวลผลเพื่อคืนค่าเป็น Array ของ Place
 * @access  Public
 * @body    ResolveInput[]
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    // 1. ตรวจสอบ Request Body
    const inputs: ResolveInput[] = req.body;
    if (!Array.isArray(inputs) || inputs.length === 0) {
      return res.status(400).json({ message: 'Request body must be a non-empty array.' });
    }

    // 2. ดึง API Key จาก Environment Variables (วิธีที่ปลอดภัย)
    const apiKey = process.env.Maps_API_KEY;
    if (!apiKey) {
      console.error('Maps_API_KEY is not set in environment variables.');
      return res.status(500).json({ message: 'Server configuration error.' });
    }

    // 3. เรียกใช้ฟังก์ชันหลักเพื่อประมวลผล
    console.log(`[API] Received request to process ${inputs.length} places.`);
    const finalPlaces = await processPlaces(inputs, apiKey);

    // 4. ส่งผลลัพธ์กลับไป
    res.status(200).json(finalPlaces);

  } catch (error) {
    console.error('[API Error] /process:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  }
});

export default router;