import { Country, FlaggedReasonTypeEnum, FundraiserEnum, StatusEnum } from '@/common/constants';

export interface ICampaign {
	shortId: string;
	category: {
		type: string;
		ref: string;
	};
	country: Country;
	tags: string[];
	goal: number;
	amountRaised: number;
	story: string;
	storyHtml: string;
	images: string[];
	title: string;
	fundraiser: FundraiserEnum;
	deadline: Date;
	creator: {
		type: string;
		ref: string;
	};
	isPublished: boolean;
	status: StatusEnum;
	isFlagged: boolean;
	flaggedReasons: Array<{
		type: FlaggedReasonTypeEnum;
		reason: string;
	}>;
	isDeleted: boolean;
	featured: boolean;
	currentStep: number;
}

export interface ICampaignCategory {
	name: string;
	isDeleted: boolean;
	image: string;
}
