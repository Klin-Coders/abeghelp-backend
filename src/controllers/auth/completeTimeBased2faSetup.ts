import { Require_id } from 'mongoose';
import { IUser } from '../../common/interfaces';
import { validateTimeBased2fa, AppResponse, getFromCache, setCache, toJSON, decodeData } from '../../common/utils';
import AppError from '../../common/utils/appError';
import { catchAsync } from '../../middlewares';
import { UserModel } from '../../models';
import { Request, Response } from 'express';

export const completeTimeBased2fa = catchAsync(async (req: Request, res: Response) => {
	const { user } = req;
	const { token, receiveCodeViaEmail } = req.body;

	if (!token) {
		throw new AppError('Token is required', 400);
	}

	if (user?.timeBased2FA.active) {
		throw new AppError('2FA is already active', 400);
	}

	if (!user?.timeBased2FA.secret) {
		throw new AppError('2FA is not active', 400);
	}

	const decryptedSecret = await decodeData(user.timeBased2FA.secret);

	if (!decryptedSecret.token) {
		throw new AppError('Unable to complete 2FA, please try again', 400);
	}

	const isTokenValid = validateTimeBased2fa(decryptedSecret.token, token, 1);

	if (!isTokenValid) {
		throw new AppError('Invalid token', 400);
	}

	await UserModel.findByIdAndUpdate(user?._id, {
		'timeBased2FA.active': true,
		'timeBased2FA.receiveCodeViaEmail': receiveCodeViaEmail ?? false,
	});

	const userFromCache = await getFromCache<Require_id<IUser>>(user._id.toString());

	if (userFromCache) {
		// update cache
		await setCache(
			user._id.toString()!,
			toJSON(
				{ ...userFromCache, timeBased2FA: { active: true, receiveCodeViaEmail: receiveCodeViaEmail ?? false } },
				[]
			)
		);
	}

	return AppResponse(res, 200, null, '2FA enabled successfully');
});
