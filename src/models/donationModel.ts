import mongoose, { Model } from 'mongoose';
import { PaymentStatusEnum } from '@/common/constants';
import { IDonation } from '@/common/interfaces';

type donationModel = Model<IDonation>;

const donationSchema = new mongoose.Schema<IDonation>(
	{
		reference: {
			type: String,
			unique: true,
			required: true,
		},
		campaignId: {
			type: mongoose.Schema.ObjectId,
			ref: 'Campaign',
			required: true,
		},
		donorEmail: {
			type: String,
			required: true,
		},
		donorName: {
			type: String,
			required: true,
		},
		amount: {
			type: Number,
			required: true,
		},
		donorIp: {
			type: String,
			required: false,
		},
		donorIpMeta: {
			type: Object,
		},
		paymentStatus: {
			type: String,
			enum: PaymentStatusEnum,
			default: PaymentStatusEnum.UNPAID,
		},
		paymentDate: {
			type: String,
		},
		paymentMeta: {
			type: Object,
		},
		hideDonorDetails: {
			type: Boolean,
			default: false,
		},
	},
	{
		timestamps: true,
	}
);

export const donationModel = (mongoose.models.Donation as donationModel) || mongoose.model('Donation', donationSchema);
