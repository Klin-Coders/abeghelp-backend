import { AppError, AppResponse, extractUAData, generateUniqueIdentifier } from '@/common/utils';
import { catchAsync } from '@/middlewares';
import { Request, Response } from 'express';
import { donationModel } from '@/models';
import { PaymentStatusEnum } from '@/common/constants';
import { initializeTransaction } from '@/common/utils/payment_services/paystack';
import { campaignModel } from '@/models';
import { ILocation } from '@/common/interfaces';
import { locationModel } from '@/models/LocationModel';

export const createDonation = catchAsync(async (req: Request, res: Response) => {
	const { campaignId, donorEmail, donorName, amount, hideMyDetails, redirectUrl } = req.body;

	if (!campaignId || !donorEmail || !donorName || !amount) {
		throw new AppError('All fields are required', 400);
	}

	const campaignExist = await campaignModel.findById(campaignId);

	if (!campaignExist) {
		throw new AppError('Campaign with id does not exist', 404);
	}

	const reference = generateUniqueIdentifier();

	const paymentUrlResponse = await initializeTransaction({
		amount: amount * 100,
		email: donorEmail,
		reference,
		callback_url: redirectUrl,
		metadata: {
			campaignId,
		},
	});

	if (!paymentUrlResponse || !paymentUrlResponse?.data) {
		throw new AppError('Error processing donation, try again later', 500);
	}

	const donation = await donationModel.create({
		reference,
		campaignId,
		donorEmail,
		donorName,
		amount,
		paymentStatus: PaymentStatusEnum.UNPAID,
		hideDonorDetails: hideMyDetails,
	});

	if (!donation) {
		throw new AppError('Error processing donation, try again later', 500);
	}

	const userAgent: Partial<ILocation> = await extractUAData(req);

	// create an entry for login location metadata
	await locationModel.create({
		...userAgent,
		donation: donation._id,
	});

	return AppResponse(
		res,
		200,
		{ donation, paymentUrl: paymentUrlResponse?.data?.authorization_url },
		'Donation created successfully'
	);
});
