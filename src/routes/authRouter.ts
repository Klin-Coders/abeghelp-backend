import {
	complete2faSetup,
	disable2fa,
	forgotPassword,
	get2faCodeViaEmail,
	resendVerification,
	resetPassword,
	session,
	setupTimeBased2fa,
	signIn,
	signOut,
	signUp,
	verifyEmail,
	verifyTimeBased2fa,
} from '@/controllers';
import { pwned } from '@/controllers/pwned';
import { protect } from '@/middlewares';

import { Router } from 'express';

const router = Router();

router.get('/pwned', pwned);
router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/password/forgot', forgotPassword);
router.post('/password/reset', resetPassword);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

router.use(protect); // Protect all routes after this middleware
router.get('/session', session);
router.get('/signout', signOut);
router.post('/2fa/setup', setupTimeBased2fa);
router.post('/2fa/complete', complete2faSetup);
router.post('/2fa/verify', verifyTimeBased2fa);
router.get('/2fa/code/email', get2faCodeViaEmail);
router.post('/2fa/disable', disable2fa);

export { router as authRouter };
