import { TOTPBaseConfig } from '@/common/constants';
import { addEmailToQueue } from '@/queues/emailQueue';
import bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'crypto';
import type { CookieOptions, Response } from 'express';
import { encode } from 'hi-base32';
import Redis from 'ioredis';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Require_id } from 'mongoose';
import * as OTPAuth from 'otpauth';
import qrcode from 'qrcode';
import { promisify } from 'util';
import { ENVIRONMENT } from '../config';
import { IHashData } from '../interfaces/helper';
import { IUser } from '../interfaces/user';

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
	return jwt.sign({ ...data }, secret ? secret : ENVIRONMENT.JWT.ACCESS_KEY, {
		expiresIn: options?.expiresIn || '15m',
	});
};

const decodeData = async (token: string, secret?: string) => {
	const verifyAsync: (arg1: string, arg2: string) => jwt.JwtPayload = promisify(jwt.verify);
	return await verifyAsync(token, secret ? secret : ENVIRONMENT.JWT.ACCESS_KEY!);
};

const setCookie = (res: Response, name: string, value: string | number, options: CookieOptions = {}) => {
	res.cookie(name, value, {
		httpOnly: true,
		secure: ENVIRONMENT.APP.ENV === 'production',
		path: '/',
		sameSite: 'none',
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
		qrcode.toDataURL(data, (err, url) => {
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

const sendVerificationEmail = async (user: Require_id<IUser>) => {
	// add welcome email to queue for user to verify account
	const tokenString = await generateRandomString();
	const emailVerificationToken = await hashData({ token: tokenString });

	addEmailToQueue({
		type: 'welcomeEmail',
		data: {
			to: user.email,
			name: user.firstName,
			verificationLink: `${ENVIRONMENT.FRONTEND_URL}/verify-email/${user._id}?token=${emailVerificationToken}`,
		},
	});

	return tokenString;
};

export {
	decodeData,
	generateRandom6DigitKey,
	generateRandomBase32,
	generateRandomString,
	generateTimeBased2fa,
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
};
