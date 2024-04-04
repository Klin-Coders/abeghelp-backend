import { AppError, AppResponse, generateRandomString, hashData, removeFromCache, setCookie } from '@/common/utils';
import { catchAsync } from '@/middlewares';
import { UserModel } from '@/models';
import { addEmailToQueue } from '@/queues';
import { Request, Response } from 'express';

export const deleteAccount = catchAsync(async (req: Request, res: Response) => {
	const { user } = req;

	if (!user) {
		throw new AppError('Unauthenticated', 401);
	}

	const accountRestorationToken = generateRandomString();
	const hashedAccountRestorationToken = hashData(
		{
			token: accountRestorationToken,
			id: user?._id?.toString(),
		},
		{
			expiresIn: '30d',
		}
	);

	await UserModel.findByIdAndUpdate(user._id, {
		isDeleted: true,
		accountRestoreToken: accountRestorationToken,
	});

	const accountRestorationUrl = `${req.protocol}://${req.get(
		'referer'
	)}/account/restore?token=${hashedAccountRestorationToken}`;

	addEmailToQueue({
		type: 'deleteAccount',
		data: {
			to: user.email,
			name: user.firstName,
			days: '30 days',
			restoreLink: accountRestorationUrl,
		},
	});

	// clear cache and cookies
	await removeFromCache(user?._id?.toString());

	setCookie(res, 'abegAccessToken', 'expired', { maxAge: -1 });
	setCookie(res, 'abegRefreshToken', 'expired', { maxAge: -1 });

	return AppResponse(res, 200, null, 'Account deleted successfully');
});
