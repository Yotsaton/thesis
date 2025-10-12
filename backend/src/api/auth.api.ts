// .src/api/user.api.ts
import { Router } from 'express';
import { registerUser, resendOTP, verifyOTP,
  login, logout, me, requestResetLink, confirmResetWithLink,
  changePassword } from '../authentication/index';
import { requireAuth } from '../middleware/requireAuth';
import { activityLogger } from '../middleware/activityLogger';

const router = Router();

// POST /api/v1/auth/register
router.post('/register', registerUser);

// POST /api/v1/auth/otp/resendotp
router.post('/otp/resendotp', resendOTP);

// POST /api/v1/auth/otp/verify
router.post('/otp/verify', verifyOTP);

// POST /api/v1/auth/login
router.post('/login', login);

// POST /api/v1/auth/logout
router.post('/logout', requireAuth,
  activityLogger(() => ({ action: 'logout' })),
  logout
);

// GET /api/v1/auth/me
router.get('/me', requireAuth,
  activityLogger(() => ({ action: 'get_user_info' })),
  me
);

// POST /api/v1/auth/password/forgotpass
router.post('/password/forgotpass', requestResetLink);

// POST /api/v1/auth/password/verifylink
router.post('/password/verifylink', confirmResetWithLink);

// POST /api/v1/auth/password/changepass
router.post('/password/changepass', requireAuth,
  activityLogger(
    () => ({ action: 'change_password' }),
    (req) => (req as any).auth?.username,
    {
      onFinishOnly: true, // บันทึกเฉพาะเมื่อ สำเร็จ
    }
  ),
  changePassword
);

export default router;