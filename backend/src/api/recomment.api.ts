// .src/api/recomment.api.ts

import { Router } from 'express';
import { recommentFromProvinceApi } from '../recomment/functions/recommentFromProvince.api'
import { withAuth } from '../middleware/withAuth';
import { requireAuth } from '../middleware/requireAuth';



// สร้าง Router instance
const router = Router();

// POST /api/v1/auth/recomment/from-province
router.post('/from-province', requireAuth, withAuth(recommentFromProvinceApi as any))


export default router;