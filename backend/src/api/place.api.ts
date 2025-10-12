// .src/api/register.api.ts

import 'dotenv/config'
import { Router } from 'express';
import {processPlace} from '../place/index'
import { requireAuth } from '../middleware/requireAuth';
import { withAuth } from '../middleware/withAuth';
import { activityLogger } from '../middleware/activityLogger';

// สร้าง Router instance
const router = Router();

// POST /api/v1/place/process
router.post('/process', requireAuth,
  activityLogger(() => ({ action: 'process_place' })),
  processPlace);

export default router;