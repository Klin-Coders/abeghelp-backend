import { ENVIRONMENT } from '@/common/config';
import { Provider } from '@/common/constants';
import { generateRandomString, hashData, setCache, setCookie } from '@/common/utils';
import AppError from '@/common/utils/appError';
import { AppResponse } from '@/common/utils/appResponse';
import { catchAsync } from '@/middlewares';
import { UserModel as User } from '@/models';
import { addEmailToQueue } from '@/queues/emailQueue';
import { Request, Response } from 'express';

export const signUp = catchAsync(async (req: Request, res: Response) => {
	const { email, firstName, lastName, phoneNumber, password, gender } = req.body;

	if (!email || !firstName || !lastName || !phoneNumber || !password || !gender) {
		throw new AppError('Incomplete signup data', 400);
	}

	const existingUser = await User.findOne({ $or: [{ email }, { phoneNumber }] });
	if (existingUser) {
		if (existingUser.email === email && existingUser.phoneNumber === phoneNumber) {
			throw new AppError('Email and phone number has already been used', 409);
		} else {
			throw new AppError(`${existingUser.email === email ? 'Email' : 'Phone number'} has already been used`, 409);
		}
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

	const accessToken = await user.generateAccessToken();
	const refreshToken = await user.generateRefreshToken();

	setCookie(res, 'abegAccessToken', accessToken!, {
		maxAge: 15 * 60 * 1000, // 15 minutes
	});

	setCookie(res, 'abegRefreshToken', refreshToken, {
		maxAge: 24 * 60 * 60 * 1000, // 24 hours
	});

	// add welcome email to queue for user to verify account
	const tokenString = await generateRandomString();
	const emailVerificationToken = await hashData(tokenString);

	addEmailToQueue({
		type: 'welcomeEmail',
		data: {
			to: email,
			name: user.firstName,
			verificationLink: `${ENVIRONMENT.APP.CLIENT}/verify-email/${user._id}?token=${emailVerificationToken}`,
		},
	});

	// save email token to cache
	await setCache(`verification:${user._id.toString()}`, tokenString, 3600);

	// save user to cache without password
	await setCache(user._id.toString(), user.toJSON(['password']));

	AppResponse(
		res,
		201,
		user.toJSON([
			'refreshToken',
			'loginRetries',
			'isEmailVerified',
			'lastLogin',
			'password',
			'__v',
			'createdAt',
			'updatedAt',
		]),
		'Account created successfully'
	);
});
