import { twoFactorTypeEnum } from '@/common/constants';
import { IUser } from '@/common/interfaces';
import {
	AppError,
	AppResponse,
	decodeData,
	getFromCache,
	removeFromCache,
	setCache,
	validateTimeBased2fa,
	toJSON,
	fetchInitialData,
} from '@/common/utils';
import { catchAsync } from '@/middlewares';
import { UserModel } from '@/models';
import { Request, Response } from 'express';
import { DateTime } from 'luxon';

export const verifyTimeBased2fa = catchAsync(async (req: Request, res: Response) => {
	const { user } = req;

	const { token } = req.body;

	const userFromDb = await UserModel.findOne({ email: user?.email }).select(
		'+twoFA.secret +twoFA.recoveryCode +lastLogin'
	);

	if (!user || !userFromDb || !userFromDb?.lastLogin || !userFromDb.twoFA.recoveryCode) {
		throw new AppError('Unable to complete request, try again later', 404);
	}

	if (!userFromDb.twoFA.active) {
		throw new AppError('2FA is not active', 400);
	}

	// TODO: add limit to tries to avoid brute force

	const lastLoginTimeInMilliseconds = new Date(userFromDb.lastLogin).getTime();
	const currentTimeInMilliseconds = DateTime.now().plus({ minutes: 5 }).toJSDate().getTime();

	if (lastLoginTimeInMilliseconds > currentTimeInMilliseconds) {
		throw new AppError('Timeout Error, Please log in again', 400);
	}

	const twoFAType = userFromDb.twoFA.type;

	if (twoFAType === twoFactorTypeEnum.APP) {
		const decryptedSecret = await decodeData(userFromDb.twoFA.secret!);
		const isTokenValid = validateTimeBased2fa(decryptedSecret.token, token, 1);

		if (!isTokenValid) {
			throw new AppError('Invalid token', 400);
		}
	}

	if (twoFAType === twoFactorTypeEnum.EMAIL) {
		const emailCode = await getFromCache(`2FAEmailCode:${user._id.toString()}`);

		if (!emailCode) {
			throw new AppError('Invalid verification code', 400);
		}

		const decodedData = await decodeData(Object(emailCode).token);

		if (!decodedData.token || decodedData.token !== token) {
			throw new AppError('Invalid verification code', 400);
		}

		await removeFromCache(`2FAEmailCode:${user._id.toString()}`);
	}

	const updatedUser = (await UserModel.findOneAndUpdate(
		{ _id: user._id },
		{
			$set: {
				'twoFA.verificationTime': DateTime.now().toJSDate(),
				'twoFA.isVerified': true,
			},
		},
		{ new: true }
	)) as IUser;

	if (!updatedUser) {
		throw new AppError('Unable to complete request, try again later', 400);
	}

	await setCache(user._id.toString(), { ...user, ...toJSON(updatedUser, ['password']) });
	const initialData = await fetchInitialData(user._id);
	return AppResponse(res, 200, { ...initialData, user: toJSON(updatedUser) }, '2FA verified successfully');
});
