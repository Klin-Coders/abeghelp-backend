import { AppError, AppResponse, generateRandomString, hashData } from '@/common/utils';
import { catchAsync } from '@/middlewares';
import { UserModel } from '@/models';
import { addEmailToQueue } from '@/queues';
import { Request, Response } from 'express';
import { DateTime } from 'luxon';

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
	const { email } = req.body;

	if (!email) {
		throw new AppError('Email is required', 400);
	}

	const user = await UserModel.findOne({ email }).select(
		'+passwordResetToken +passwordResetExpires +passwordResetRetries'
	);

	if (!user) {
		throw new AppError('No user found with provided email', 404);
	}

	if (user.passwordResetRetries >= 3) {
		await UserModel.findByIdAndUpdate(user._id, {
			isSuspended: true,
		});

		throw new AppError('Password reset retries exceeded! and account suspended', 401);
	}

	const passwordResetToken = await generateRandomString();
	const hashedPasswordResetToken = hashData({
		token: passwordResetToken,
	});

	const passwordResetUrl = `${req.get('referer')}/reset-password?token=${hashedPasswordResetToken}`;

	await UserModel.findByIdAndUpdate(user._id, {
		passwordResetToken: passwordResetToken,
		passwordResetExpires: DateTime.now().plus({ minutes: 15 }).toJSDate(),
		$inc: {
			passwordResetRetries: 1,
		},
	});

	// add email to queue
	addEmailToQueue({
		type: 'forgotPassword',
		data: {
			to: email,
			priority: 'high',
			name: user.firstName,
			token: passwordResetUrl,
		},
	});

	return AppResponse(res, 200, null, `Password reset link sent to ${email}`);
});
