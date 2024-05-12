import { Gender, IDType, Provider, Role } from '@/common/constants';
import type { IUser, UserMethods } from '@/common/interfaces';
import bcrypt from 'bcryptjs';
import mongoose, { HydratedDocument, Model } from 'mongoose';
import { TwoFAModel } from './twoFactorModel';

type UserModel = Model<IUser, unknown, UserMethods>;

const userSchema = new mongoose.Schema<IUser, unknown, UserMethods>(
	{
		firstName: {
			type: String,
			min: [2, 'First name must be at least 2 characters long'],
			max: [50, 'First name must not be more than 50 characters long'],
			required: [true, 'First name is required'],
		},
		lastName: {
			type: String,
			min: [2, 'Last name must be at least 2 characters long'],
			max: [50, 'Last name must not be more than 50 characters long'],
			required: [true, 'Last name is required'],
		},
		email: {
			type: String,
			required: [true, 'Email field is required'],
			unique: true,
			lowercase: true,
			trim: true,
		},
		password: {
			type: String,
			min: [8, 'Password must be at least 8 characters long'],
			required: [true, 'Password field is required'],
			select: false,
		},
		refreshToken: {
			type: String,
			select: false,
		},
		phoneNumber: {
			type: String,
			unique: true,
			sparse: true,
		},
		photo: {
			type: String,
			default: null,
		},
		blurHash: {
			type: String,
		},
		role: {
			type: String,
			enum: Object.values(Role),
			default: Role.User,
		},
		isProfileComplete: {
			type: Boolean,
			default: false,
		},
		provider: {
			type: String,
			enum: Object.values(Provider),
			default: Provider.Local,
			select: false,
		},
		passwordResetToken: {
			type: String,
			select: false,
		},
		passwordResetExpires: {
			type: Date,
			select: false,
		},
		passwordResetRetries: {
			type: Number,
			default: 0,
			select: false,
		},
		passwordChangedAt: {
			type: Date,
			select: false,
		},
		ipAddress: {
			type: String,
			select: false,
		},
		loginRetries: {
			type: Number,
			default: 0,
			select: false,
		},
		gender: {
			type: String,
			enum: Object.values(Gender),
		},
		verificationMethod: {
			type: String,
			enum: Object.values(IDType),
		},
		isIdVerified: {
			type: Boolean,
			default: false,
		},
		isSuspended: {
			type: Boolean,
			default: false,
		},
		isEmailVerified: {
			type: Boolean,
			default: false,
		},
		isMobileVerified: {
			type: Boolean,
			default: false,
		},
		isDeleted: {
			type: Boolean,
			default: false,
			select: false,
		},
		lastLogin: {
			type: Date,
			default: Date.now(),
		},
		verificationToken: {
			type: String,
			select: false,
		},
		accountRestoreToken: {
			type: String,
			select: false,
		},
		twoFA: {
			type: TwoFAModel,
			default: {},
		},
		isTermAndConditionAccepted: {
			type: Boolean,
			default: false,
			required: [true, 'Term and condition is required'],
		},
	},
	{
		timestamps: true,
		versionKey: false,
	}
);

// only pick users that are not deleted or suspended
userSchema.pre(/^find/, function (this: Model<IUser>, next) {
	// pick deleted users if the query has isDeleted
	if (Object.keys(this['_conditions']).includes('isDeleted')) {
		this.find({ isSuspended: { $ne: true } });
		return next();
	}

	// do not select users that are deleted or suspended
	this.find({ $or: [{ isDeleted: { $ne: true } }, { isSuspended: { $ne: true } }] });
	next();
});

// Hash password before saving to the database
userSchema.pre('save', async function (next) {
	if (!this.isProfileComplete) {
		const profiles = [
			this.firstName,
			this.lastName,
			this.email,
			this.phoneNumber,
			this.photo,
			this.gender,
			this.isIdVerified,
			this.isMobileVerified,
			this.isEmailVerified,
		];
		this.isProfileComplete = profiles.every((profile) => Boolean(profile));
	}
	next();
});

// Verify user password
userSchema.method('verifyPassword', async function (this: HydratedDocument<IUser>, enteredPassword: string) {
	if (!this.password) {
		return false;
	}
	const isValid = await bcrypt.compare(enteredPassword, this.password);
	return isValid;
});

export const UserModel = (mongoose.models.User as UserModel) || mongoose.model<IUser, UserModel>('User', userSchema);
