import { FlaggedReasonTypeEnum, StatusEnum } from '@/common/constants';
import { AppError } from '@/common/utils';
import { campaignModel } from '@/models';
import BadWords from 'bad-words';
import { ENVIRONMENT } from '@/common/config';
import { CampaignJobEnum, campaignQueue } from '@/queues';
import { OpenAI } from 'openai';

export const processCampaign = async (id: string) => {
	try {
		const reasons: {
			type: FlaggedReasonTypeEnum;
			reason: string;
		}[] = [];

		const campaign = await campaignModel.findById(id);

		if (!campaign) {
			throw new AppError('Campaign not found', 404);
		}

		// perform checks
		const [
			titleIsInAppropriate,
			storyIsInAppropriate,
			titleAndStoryAreSimilar,
			similarCampaignExist,
			tagIsInappropriate,
		] = await Promise.all([
			containsInappropriateContent(campaign.title),
			containsInappropriateContent(campaign.story),
			checkSimilarity(campaign.title, campaign.story),
			checkForSimilarCampaign(campaign.creator, campaign.title),
			containsInappropriateContent(campaign.tags.join(' ').replaceAll('#', '')),
		]);

		if (titleIsInAppropriate || storyIsInAppropriate) {
			reasons.push({
				type: FlaggedReasonTypeEnum.INAPPROPRIATE_CONTENT,
				reason: `Campaign ${titleIsInAppropriate ? 'title' : 'story'} contains inappropriate content`,
			});
		}

		if (tagIsInappropriate) {
			reasons.push({
				type: FlaggedReasonTypeEnum.INAPPROPRIATE_CONTENT,
				reason: `tags contains inappropriate content`,
			});
		}
		if (!titleAndStoryAreSimilar) {
			reasons.push({
				type: FlaggedReasonTypeEnum.MISMATCH,
				reason: `Campaign story does not seem relevant to fundraising or the title.`,
			});
		}

		if (similarCampaignExist) {
			reasons.push({
				type: FlaggedReasonTypeEnum.EXISTS,
				reason: `Similar campaign already exists in your account.`,
			});
		}

		await campaignModel.findByIdAndUpdate(campaign._id, {
			flaggedReasons: reasons,
			isFlagged: reasons.length > 0 ? true : false,
			status: reasons.length > 0 ? StatusEnum.REJECTED : StatusEnum.APPROVED,
			isPublished: reasons.length > 0 ? false : true,
		});

		return campaign;
	} catch (e) {
		await campaignQueue.add(CampaignJobEnum.PROCESS_CAMPAIGN_REVIEW, { id });
		console.log('processCampaign error : ', e);
	}
};

function containsInappropriateContent(value: string): boolean {
	const filter = new BadWords();

	const result = filter.isProfane(value);

	return result;
}

const openai = new OpenAI({
	apiKey: ENVIRONMENT.OPENAI.API_KEY,
	timeout: 20 * 1000,
	maxRetries: 5,
});

async function checkSimilarity(title: string, story: string) {
	const prompt = `You are a helpful assistant, you are given a title and a story for a fundraising website, please provide a relevance score between 1 and 10, where:

1 indicates very little to no relevance to fundraising and the title is not relevant to the story.
5 indicates moderate relevance, with connections to fundraising and story sufficiently relates to the title.
10 indicates a very strong and direct relevance to fundraising, with both the title and story closely aligned to the fundraising domain.

Consider the following:
Both the title and the story should be related to fundraising, charity, or philanthropic endeavors.
Ensure that the content is not spam or irrelevant to the fundraising domain.
Ensure that the context of the title relates the story, providing a cohesive message.
A score of 10 should be given when both the title and the story closely align with the theme of fundraising, conveying a clear and relevant message. This includes titles and stories that promote charitable causes, community initiatives, or donation drives in a cohesive manner.
Conversely, a score of 1 should be given when either the title or the story has no apparent connection to fundraising, charity, or philanthropy, and does not serve the purpose of the fundraising website.
Please return only the relevance score as a whole number, without explanations or context."

Here is the title and story below
title: ${title}
story: ${story}`;

	try {
		const params: OpenAI.Chat.ChatCompletionCreateParams = {
			messages: [{ role: 'user', content: prompt }],
			model: 'gpt-3.5-turbo',
		};
		const response: OpenAI.Chat.ChatCompletion = await openai.chat.completions.create(params);

		const rating = Number(response?.choices[0]?.message?.content);
		if (!isNaN(rating) && rating >= 5 && rating <= 10) {
			return true;
		} else {
			return false;
		}
	} catch (error) {
		return false; // Or handle this error case accordingly
	}
}
async function checkForSimilarCampaign(creator, title: string): Promise<boolean> {
	//TODO: CHECK db wide with fuzzy matching on title or use a search engine like elastic search
	const existingFundraiser = await campaignModel.find({
		creator: creator._id ? creator._id : creator,
		title: { $regex: new RegExp('^' + title + '$', 'i') },
	});

	if (existingFundraiser.length > 1) return true;

	return false;
}
