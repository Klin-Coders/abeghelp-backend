import { AppError, AppResponse, comparePassword, hashPassword } from '@/common/utils';
import { catchAsync } from '@/middlewares';
import { UserModel } from '@/models';
import { Request, Response } from 'express';

export const changePassword = catchAsync(async (req: Request, res: Response) => {
	const { oldPassword, newPassword, confirmPassword } = req.body;

	if (!oldPassword || !newPassword || !confirmPassword) {
		throw new AppError('All fields are required', 400);
	}

	const userId = req.user?._id;

	if (!userId) {
		throw new AppError('Unauthorized , kindly login again', 404);
	}

	if (newPassword !== confirmPassword) {
		throw new AppError('new password and confirm password do not match', 400);
	}

	const userFromDb = await UserModel.findById(userId).populate('password');

	if (!userFromDb) {
		throw new AppError('Unable to process request, try again later', 404);
	}

	if (!(await comparePassword(oldPassword, userFromDb.password))) {
		throw new AppError('Incorrect old password supplied', 400);
	}

	const hashedPassword = await hashPassword(newPassword);

	userFromDb.password = hashedPassword;
	userFromDb.refreshToken = '';
	await userFromDb.save();

	return AppResponse(res, 200, null, 'Password changed successfully');
});
