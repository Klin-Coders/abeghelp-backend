import { ENVIRONMENT } from '@/common/config';
import { TOTPBaseConfig } from '@/common/constants';
import type { IHashData, IUser } from '@/common/interfaces';
import { UserModel } from '@/models';
import { addEmailToQueue } from '@/queues/emailQueue';
import bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'crypto';
import type { CookieOptions, Response } from 'express';
import { Request } from 'express';
import { encode } from 'hi-base32';
import Redis from 'ioredis';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Require_id } from 'mongoose';
import * as OTPAuth from 'otpauth';
import qrcode from 'qrcode';
import { promisify } from 'util';
import AppError from './appError';
import { nanoid } from 'nanoid';

if (!ENVIRONMENT.CACHE_REDIS.URL) {
	throw new Error('Cache redis url not found');
}
const redis = new Redis(ENVIRONMENT.CACHE_REDIS.URL!);

const toJSON = (obj: IUser, fields?: string[]): Partial<IUser> => {
	const user = JSON.parse(JSON.stringify(obj));

	if (fields && fields.length === 0) {
		return user;
	}

	const results = { ...user };

	if (fields && fields.length > 0) {
		for (const field of fields) {
			if (field in results) {
				delete results[field as keyof IUser];
			}
		}
		return results;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { refreshToken, loginRetries, lastLogin, password, updatedAt, ...rest } = user;

	return rest;
};

const generateRandomString = () => {
	return randomBytes(32).toString('hex');
};

const hashPassword = async (password: string) => {
	return await bcrypt.hash(password, 12);
};

const hashData = (data: IHashData, options?: SignOptions, secret?: string) => {
	return jwt.sign(
		{ ...data },
		secret ? secret : ENVIRONMENT.JWT.ACCESS_KEY,
		...[options?.expiresIn ? { expiresIn: options?.expiresIn } : {}]
	);
};

const decodeData = async (token: string, secret?: string) => {
	const verifyAsync: (arg1: string, arg2: string) => jwt.JwtPayload = promisify(jwt.verify);
	console.log(secret);

	const verify = await verifyAsync(token, secret ? secret : ENVIRONMENT.JWT.ACCESS_KEY!);
	return verify;
};

const setCookie = (res: Response, name: string, value: string, options: CookieOptions = {}) => {
	res.cookie(name, value, {
		httpOnly: true,
		secure: ENVIRONMENT.APP.ENV === 'production',
		path: '/',
		sameSite: ENVIRONMENT.APP.ENV === 'production' ? 'none' : 'lax',
		partitioned: ENVIRONMENT.APP.ENV === 'production',
		...options,
	});
};

const setCache = async (key: string, value: string | number | object | Buffer, expiry?: number) => {
	if (!key) {
		throw new Error('Invalid key provided');
	}
	if (!value) {
		throw new Error('Invalid value provided');
	}

	if (typeof value === 'object' && !(value instanceof Buffer)) {
		value = JSON.stringify(value);
	}

	if (expiry) {
		return await redis.set(key, value, 'EX', expiry);
	}

	return await redis.set(key, value);
};

const getFromCache = async <T = string>(key: string) => {
	if (!key) {
		throw new Error('Invalid key provided');
	}

	const data = await redis.get(key);
	if (!data) {
		return null;
	}

	let parseData;
	try {
		parseData = JSON.parse(data);
	} catch (error) {
		parseData = data;
	}

	return parseData as T;
};

const removeFromCache = async (key: string) => {
	if (!key) {
		throw new Error('Invalid key provided');
	}

	const data = await redis.del(key);

	if (!data) {
		return null;
	}
	return data;
};

const isValidFileNameAwsUpload = (fileName: string) => {
	const regex = /^[a-zA-Z0-9_\-/]+\/[a-zA-Z0-9_-]+(?:\.(jpg|png|jpeg))$/;
	return regex.test(fileName);
};

const generateRandomBase32 = () => {
	const buffer = randomBytes(15);
	return encode(buffer).replace(/=/g, '').substring(0, 24);
};

const generateQrCode = async (data: string | Record<string, string[]>) => {
	const code = new Promise((resolve, reject) => {
		const dataString = typeof data === 'object' ? JSON.stringify(data) : data;
		qrcode.toDataURL(dataString, (err, url) => {
			if (err) {
				reject(err);
			} else {
				resolve(url);
			}
		});
	});
	return code;
};

const generateTimeBased2fa = (secret: string) => {
	const otp = new OTPAuth.TOTP({
		...TOTPBaseConfig,
		secret,
	});

	return generateQrCode(otp.toString());
};

const validateTimeBased2fa = (secret: string, token: string, window?: number): boolean => {
	const otp = new OTPAuth.TOTP({
		...TOTPBaseConfig,
		secret,
	});

	const result = otp.validate({ token, window });

	if (result === null) {
		return false;
	}

	return true;
};

const generateRandom6DigitKey = () => {
	let randomNum = randomInt(0, 999999);

	// Ensure the number is within the valid range (000000 to 999999)
	while (randomNum < 100000) {
		randomNum = randomInt(0, 999999);
	}
	// Convert the random number to a string and pad it with leading zeros if necessary
	const tokenString = randomNum.toString().padStart(6, '0');

	return tokenString;
};

const sendVerificationEmail = async (user: Require_id<IUser>, req: Request) => {
	// add welcome email to queue for user to verify account
	const emailVerificationToken = hashData({ id: user._id.toString() });

	await addEmailToQueue({
		type: 'welcomeEmail',
		data: {
			to: user.email,
			name: user.firstName,
			email: user.email,
			verificationLink: `${getDomainReferer(req)}verify-email?token=${emailVerificationToken}`,
		},
	});
};

const get2faCodeViaEmailHelper = async (email: string) => {
	if (!email) {
		throw new AppError('Email is required', 400);
	}

	const user = await UserModel.findOne({ email });

	if (!user) {
		throw new AppError('No user found with provided email', 404);
	}

	const token = generateRandom6DigitKey();
	const hashedToken = hashData({ token }, { expiresIn: '5m' });

	await addEmailToQueue({
		type: 'get2faCodeViaEmail',
		data: {
			to: user.email,
			name: user.firstName,
			twoFactorCode: token,
			expiryTime: '5',
			priority: 'high',
		},
	});

	await setCache(`2FAEmailCode:${user._id.toString()}`, { token: hashedToken }, 300);
};

const dateFromString = async (value: string) => {
	const date = new Date(value);

	if (isNaN(date?.getTime())) {
		return false;
	}

	return date;
};

const extractUAData = (req: Request) => ({
	country: req.headers['cf-ipcountry']?.toString() || '',
	city: req.headers['cf-ipcity']?.toString() || '',
	postalCode: req.headers['cf-postal-code']?.toString() || '',
	ipv4: req.headers['cf-connecting-ip']?.toString() || '',
	ipv6: req.headers['x-envoy-external-address']?.toString() || '',
	geo: {
		lat: req.headers['cf-iplatitude']?.toString() || '',
		lng: req.headers['cf-iplongitude']?.toString() || '',
	},
	region: req.headers['cf-region']?.toString() || '',
	continent: req.headers['cf-ipcontinent']?.toString() || '',
	timezone: req.headers['cf-timezone']?.toString() || '',
	os: req.headers['sec-ch-ua-platform']?.toString() || '',
});

const generateUniqueIdentifier = () => {
	const prefix = 'ABG-RF-';
	const randomChars = nanoid();

	return `${prefix}${randomChars}`;
};

const getDomainReferer = (req: Request) => {
	try {
		const referer = req.get('x-referer');

		if (!referer) {
			return `${ENVIRONMENT.FRONTEND_URL}`;
		}

		return referer;
	} catch (error) {
		return null;
	}
};

export {
	extractUAData,
	dateFromString,
	decodeData,
	generateRandom6DigitKey,
	generateRandomBase32,
	generateRandomString,
	generateTimeBased2fa,
	get2faCodeViaEmailHelper,
	getFromCache,
	hashData,
	hashPassword,
	isValidFileNameAwsUpload,
	removeFromCache,
	sendVerificationEmail,
	setCache,
	setCookie,
	toJSON,
	validateTimeBased2fa,
	generateUniqueIdentifier,
	getDomainReferer,
};
