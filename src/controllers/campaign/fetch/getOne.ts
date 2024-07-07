import { ICampaign } from '@/common/interfaces';
import { AppError, AppResponse, getFromCache, setCache } from '@/common/utils';
import { catchAsync } from '@/middlewares';
import { campaignModel } from '@/models';
import { Request, Response } from 'express';
import { Require_id } from 'mongoose';
import { sanitize } from 'express-mongo-sanitize';

export const getOneCampaign = catchAsync(async (req: Request, res: Response) => {
	const { shortId } = sanitize(req.params);

	if (!shortId) {
		return AppResponse(res, 400, null, 'Please provide a campaign url');
	}

	const cachedCampaign = await getFromCache<Require_id<ICampaign>>(shortId);

	// fetch from DB if not previously cached
	const campaign = cachedCampaign
		? cachedCampaign
		: ((await campaignModel.findOne({
				shortId,
				isPublished: true,
			})) as Require_id<ICampaign>);

	if (!campaign) {
		throw new AppError(`Campaign not found`, 404);
	}

	// cache for 15 hours if not previously cached
	if (!cachedCampaign && campaign) {
		await setCache(shortId, campaign, 15 * 60);
	}

	AppResponse(res, 200, campaign, 'Campaigns fetched successfully!');
});
