import { JWTExpiresIn, Provider } from '@/common/constants';
import { setCache, setCookie } from '@/common/utils';
import AppError from '@/common/utils/appError';
import { AppResponse } from '@/common/utils/appResponse';
import { catchAsync } from '@/middlewares';
import { UserModel as User } from '@/models';
import { Request, Response } from 'express';

export const signUp = catchAsync(async (req: Request, res: Response) => {
	const { email, firstName, lastName, phoneNumber, password, gender } = req.body;

	if (!email || !firstName || !lastName || !phoneNumber || !password || !gender) {
		throw new AppError('Incomplete signup data', 400);
	}

	const existingUser = await User.findOne({ $or: [{ email }, { phoneNumber }] });
	if (existingUser) {
		throw new AppError(`${existingUser.email === email ? 'Email' : 'Phone number'} has already been used`, 409);
	}

	const user = await User.create({
		email,
		firstName,
		lastName,
		phoneNumber,
		password,
		gender,
		providers: Provider.Local,
	});

	const accessToken = user.generateAccessToken();
	const refreshToken = user.generateRefreshToken();

	setCookie(res, 'abegAccessToken', accessToken, {
		maxAge: JWTExpiresIn.Access / 1000,
	});

	setCookie(res, 'abegRefreshToken', refreshToken, {
		maxAge: JWTExpiresIn.Refresh / 1000,
	});

	await setCache(user._id.toString(), user.toJSON([]));

	AppResponse(res, 201, user.toJSON(), 'Account created successfully');
});
