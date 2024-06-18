import { SchemaDefinitionProperty } from 'mongoose';
import { PaymentStatusEnum } from '../constants';

export interface IDonation {
	reference: string;
	campaignId: SchemaDefinitionProperty;
	donorEmail: string;
	donorName: string;
	amount: number;
	paymentStatus: PaymentStatusEnum;
	paymentDate: string;
	paymentMeta?: object;
	hideDonorDetails: boolean;
}

export interface IProcessDonationCompleted {
	campaignId: string;
	paidAt: string;
	reference: string;
	status: string;
	amount: number;
}
