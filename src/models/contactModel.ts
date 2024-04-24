import type { IContact } from '@/common/interfaces';
import mongoose, { Model } from 'mongoose';

type ContactModel = Model<IContact, unknown>;

const contactSchema = new mongoose.Schema<IContact, unknown>(
	{
		firstName: {
			type: String,
			required: [true, 'First name is required'],
		},
		lastName: {
			type: String,
			required: false,
			default: null,
		},
		email: {
			type: String,
			required: [true, 'Email field is required'],
			lowercase: true,
			trim: true,
		},
		message: {
			type: String,
			required: [true, 'Message field is required'],
		},
	},
	{
		timestamps: true,
		versionKey: false,
	}
);

export const contactModel = mongoose.model<IContact, ContactModel>('Contact', contactSchema);
