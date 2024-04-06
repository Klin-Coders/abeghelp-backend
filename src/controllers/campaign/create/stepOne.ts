import { AppError, AppResponse } from '@/common/utils';
import { campaignModel } from '@/models';
import { Request, Response } from 'express';
import { StatusEnum } from '@/common/constants';

export const stepOne = async (req: Request, res: Response) => {
	const { country, tags, categoryId, campaignId } = req.body;
	const { user } = req;

	if (!user) {
		throw new AppError('Please log in again', 400);
	}

	if (!country || (tags && !Array.isArray(tags)) || !categoryId) {
		throw new AppError('Country and categoryId are required', 400);
	}

	let campaign;

	if (campaignId) {
		campaign = await campaignModel.findOneAndUpdate(
			{
				_id: campaignId,
				creator: user._id,
				status: { $in: [StatusEnum.DRAFT, StatusEnum.REJECTED] },
			},
			[
				{
					$set: {
						country: country,
						tags: tags,
						category: categoryId,
						currentStep: {
							$cond: {
								if: { $eq: ['$status', StatusEnum.REJECTED] },
								then: '$currentStep',
								else: 1,
							},
						},
						status: {
							$cond: {
								if: { $eq: ['$status', StatusEnum.REJECTED] },
								then: StatusEnum.IN_REVIEW,
								else: StatusEnum.DRAFT,
							},
						},
					},
				},
			],
			{ new: true }
		);
	} else {
		const existingCampaign = await campaignModel.findOne({ status: StatusEnum.DRAFT, creator: user._id });
		if (existingCampaign) {
			throw new AppError('Only one draft campaign allowed at a time.', 400);
		}

		campaign = await campaignModel.create({
			country,
			tags,
			category: categoryId,
			creator: user?._id,
			status: StatusEnum.DRAFT,
			currentStep: 1,
		});
	}

	if (!campaign) {
		throw new AppError('Unable to create or update campaign, please try again', 500);
	}
	AppResponse(res, 200, campaign, 'Proceed to step 2');
};
