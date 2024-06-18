import { PaymentStatusEnum } from '@/common/constants';
import { IProcessDonationCompleted } from '@/common/interfaces/donation';
import { campaignModel, donationModel } from '@/models';

export const processDonationCompleted = async (payload: IProcessDonationCompleted, meta: Record<string, string[]>) => {
	try {
		const { campaignId, paidAt, reference, status, amount } = payload;

		if (status === 'success') {
			const donation = await donationModel.findOneAndUpdate(
				{ reference },
				{
					paymentStatus: PaymentStatusEnum.PAID,
					paymentDate: paidAt,
					paymentMeta: meta,
					amount: amount,
				}
			);

			if (donation) {
				await campaignModel.findByIdAndUpdate(campaignId, { $inc: { amountRaised: amount } });

				// send email to donor and campaign owner
			}
		}
	} catch (error) {
		console.log('Error processing donation', error);
	}
};
