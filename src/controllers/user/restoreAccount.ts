import { AppError, AppResponse, decodeData, getDomainReferer } from '@/common/utils';
import { catchAsync } from '@/middlewares';
import { UserModel } from '@/models';
import { addEmailToQueue } from '@/queues';
import { Request, Response } from 'express';
import { sanitize } from 'express-mongo-sanitize';

export const restoreAccount = catchAsync(async (req: Request, res: Response) => {
	const { token } = sanitize(req.query);

	if (!token) {
		throw new AppError('Token is required', 400);
	}

	let decodedToken;
	try {
		decodedToken = await decodeData(token.toString());
	} catch {
		throw new AppError('Invalid or expired token', 400);
	}

	if (!decodedToken.token || !decodedToken.id) {
		throw new AppError('Invalid token', 400);
	}

	const user = await UserModel.findOneAndUpdate(
		{ _id: decodedToken.id, isDeleted: true, accountRestoreToken: decodedToken.token },
		{
			isDeleted: false,
			passwordResetRetries: 0,
			$unset: {
				accountRestoreToken: 1,
				passwordResetToken: 1,
				passwordResetExpires: 1,
			},
		}
	);

	if (!user) {
		throw new AppError('Invalid or expired token', 400);
	}

	await addEmailToQueue({
		type: 'restoreAccount',
		data: {
			to: user?.email,
			name: user?.firstName || user?.lastName || 'User',
			loginLink: `${getDomainReferer(req)}/signin`,
		},
	});

	return AppResponse(res, 200, {}, 'Account restored successfully, please login');
});
