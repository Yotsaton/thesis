// .src/api/recomment.api.ts

import { Router } from 'express';
import { recommentFromProvinceApi } from '../recomment/api/recommentFromProvince.api'
import { withAuth } from '../middleware/withAuth';
import { requireAuth } from '../middleware/requireAuth';
import { activityLogger } from '../middleware/activityLogger';



// สร้าง Router instance
const router = Router();

// POST /api/v1/auth/recomment/from-province
router.post('/from-province', requireAuth,
  activityLogger(() => ({ action: 'recomment_from_province' })),
  withAuth(recommentFromProvinceApi as any))


export default router;