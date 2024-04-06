import { StatusEnum } from '@/common/constants';
import { AppError, AppResponse } from '@/common/utils';
import { campaignModel } from '@/models';
import { Request, Response } from 'express';
import { DateTime } from 'luxon';

export const stepTwo = async (req: Request, res: Response) => {
	const { title, fundraiser, goal, deadline, campaignId } = req.body;
	const { user } = req;

	if (!title || !fundraiser || !goal || !deadline || !campaignId) {
		throw new AppError('Please provide required details', 400);
	}

	const currentDate = new Date();
	const deadlineDate = new Date(deadline);
	const plusOneDay = DateTime.now().plus({ days: 1 }).toJSDate().getTime();

	if (currentDate.getTime() > deadlineDate.getTime()) {
		throw new AppError('Deadline cannot be a past date', 400);
	}

	if (deadlineDate.getTime() < plusOneDay) {
		throw new AppError('Deadline must be more than 1 day from today', 400);
	}

	if (goal < 5000) {
		throw new AppError('Goal amount must be at least 5000 naira', 400);
	}

	const updatedCampaign = await campaignModel.findOneAndUpdate(
		{ _id: campaignId, creator: user?._id, status: { $ne: StatusEnum.APPROVED } },
		[
			{
				$set: {
					title: title,
					fundraiser: fundraiser,
					goal: goal,
					deadline: deadlineDate,
					currentStep: {
						$cond: {
							if: { $eq: ['$status', StatusEnum.REJECTED] },
							then: '$currentStep',
							else: 2,
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

	if (!updatedCampaign) {
		throw new AppError(`Unable to update campaign, try again later`, 404);
	}

	AppResponse(res, 200, updatedCampaign, 'Proceed to step 3');
};
