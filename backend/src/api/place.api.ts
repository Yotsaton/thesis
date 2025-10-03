// .src/api/register.api.ts

import 'dotenv/config'
import { Router } from 'express';
import {processPlace} from '../place/index'

// สร้าง Router instance
const router = Router();

// POST /api/v1/place/process
router.post('/process', processPlace)

export default router;