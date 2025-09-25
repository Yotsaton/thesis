// src/api/user.api.ts
import { Router } from 'express';
import {registerUser, sendOTP, resendOTP, verifyOTP,
  login, logout, me, requestResetLink, confirmResetWithLink,
  changePassword} from '../authentication/index';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

// POST /api/v1/auth
router.post('/register', registerUser);
//router.post('/otp/sendotp', sendOTP);
router.post('/otp/resendotp', resendOTP);
router.post('/otp/verify', verifyOTP);
router.post('/login', login);
router.post('/logout', requireAuth, logout)
router.get('/me', requireAuth, me)
router.post('/password/forgotpass', requestResetLink)
router.post('/password/verifylink', confirmResetWithLink)
router.post('/password/changepass', requireAuth, changePassword)

export default router;