import { campaignModel } from '@/models';
import mongoose from 'mongoose';

export const fetchInitialData = async (userId: mongoose.Types.ObjectId) => {
	console.log(userId);
	const campaigns = await campaignModel.find({ creator: userId }).sort({ createdAt: -1 }).limit(10);

	console.log(campaigns);

	return {
		campaigns,
	};
};
