import { AppError, authenticate, setCookie } from '@/common/utils';
import { catchAsync } from '@/middlewares';
import type { NextFunction, Request, Response } from 'express';

export const protect = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
	// get the cookies from the request headers
	const { abegAccessToken, abegRefreshToken } = req.cookies;

	const { currentUser, accessToken } = await authenticate({ abegAccessToken, abegRefreshToken });

	if (accessToken) {
		setCookie(res, 'abegAccessToken', accessToken, {
			maxAge: 15 * 60 * 1000, // 15 minutes
		});
	}

	// attach the user to the request object
	req.user = currentUser;

	const reqPath = req.path;

	// check if user has been authenticated but has not verified 2fa
	if (!reqPath.includes('/2fa/') && req.user.twoFA.active) {
		const lastLoginTimeInMilliseconds = new Date(currentUser.lastLogin).getTime();
		const lastVerificationTimeInMilliseconds = new Date(currentUser.twoFA.verificationTime as Date).getTime();

		if (lastLoginTimeInMilliseconds > lastVerificationTimeInMilliseconds) {
			throw new AppError('2FA verification is required', 403, {
				type: currentUser.twoFA.type,
				email: currentUser.email,
			});
		}
	}

	next();
});
