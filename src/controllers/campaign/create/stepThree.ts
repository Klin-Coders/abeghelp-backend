import { AppError, AppResponse, uploadSingleFile } from '@/common/utils';
import { campaignModel } from '@/models';
import { CampaignJobEnum, campaignQueue } from '@/queues';
import { Request, Response } from 'express';
import { DateTime } from 'luxon';
import { StatusEnum } from '@/common/constants';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNPQRSTUVWXYZ', 6);

export const stepThree = async (req: Request, res: Response) => {
	const { story, storyHtml, campaignId } = req.body;

	const { user } = req;

	const files = req.files as Express.Multer.File[];

	if (!story || !storyHtml || !campaignId) {
		throw new AppError('Please provide required details', 400);
	}

	// this enable to ensure user is not trying to update a non existent or complete campaign from step 3 creation flow
	// helps save aws resources by early return
	const campaignExist = await campaignModel.findOne({ _id: campaignId, creator: user?._id });

	if (!campaignExist) {
		throw new AppError(`Campaign does not exist`, 404);
	}

	const uploadedFiles =
		files.length > 0
			? await Promise.all([
					...files.map(async (file, index) => {
						const dateInMilliseconds = DateTime.now().toMillis();
						const fileName = `${user!._id}/campaigns/${campaignId}/${index}_${dateInMilliseconds}.${
							file.mimetype.split('/')[1]
						}`;

						const { secureUrl, blurHash } = await uploadSingleFile({
							fileName,
							buffer: file.buffer,
							mimetype: file.mimetype,
						});
						return { secureUrl, blurHash };
					}),
				])
			: [];

	const updateCampaign = async () => {
		const updatedCampaign = await campaignModel.findOneAndUpdate(
			{ _id: campaignId, creator: user?._id },
			{
				images: [...campaignExist.images, ...uploadedFiles],
				story,
				storyHtml,
				status: StatusEnum.IN_REVIEW,
				shortId: nanoid(),
				currentStep: 3,
			},
			{ new: true }
		);

		if (!updateCampaign) {
			throw new AppError('Unable to update campaign', 500);
		}

		// add campaign to queue for auto processing and check
		await campaignQueue.add(CampaignJobEnum.PROCESS_CAMPAIGN_REVIEW, {
			id: updatedCampaign?._id?.toString(),
		});
		AppResponse(res, 200, updatedCampaign, 'Campaign Created Successfully');
	};

	try {
		await updateCampaign();
	} catch (err) {
		interface MongooseError extends Error {
			code?: number;
		}
		// retry the update if shortId collision is detected
		if ((err as MongooseError).code === 11000) {
			await updateCampaign();
		} else {
			throw new AppError(`Unable to update campaign, try again later`, 404);
		}
	}
};
