import { faker } from '@faker-js/faker';
import mongoose from 'mongoose';
import { Category, Country, FundraiserEnum, Gender, Provider, StatusEnum } from '../../common/constants';
import { UserModel, campaignCategoryModel, campaignModel } from '../../models';
import { ENVIRONMENT } from '../../common/config';
import { customAlphabet } from 'nanoid';
import { ICampaignCategory, IUser } from '../../common/interfaces';

const nanoid = customAlphabet('123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNPQRSTUVWXYZ', 6);

async function seedCampaigns(size?: number) {
	// Seed data
	try {
		const campaignsToSeed: unknown[] = [];

		let creator: IUser | null = null;
		let category: ICampaignCategory | null = null;

		for (let i = 0; i < size! ?? 100; i++) {
			if (i % 3 === 0) {
				try {
					creator = await UserModel.create({
						firstName: faker.internet.userName(),
						lastName: faker.internet.userName(),
						email: faker.internet.email(),
						password: faker.internet.password(),
						phoneNumber: faker.phone.number(),
						isProfileComplete: true,
						provider: Provider.Local,
						isTermAndConditionAccepted: true,
						gender: Gender.Male,
					});
				} catch (error) {
					console.log(`Error creating creator ${error}`);
				}
			}

			if (!creator) {
				console.log('Unable to create creator');
				continue;
			}

			if (i % 2 === 0) {
				const categoryName = faker.helpers.arrayElement(Object.values(Category));

				category = await campaignCategoryModel.findOneAndUpdate(
					{
						name: categoryName,
					},
					{
						name: categoryName,
						isDeleted: false,
						image: faker.image.avatar(),
					},
					{ upsert: true, new: true }
				);
			}

			if (!category) {
				console.log('Unable to create category');
				continue;
			}

			const newCampaign = {
				url: `${ENVIRONMENT.FRONTEND_URL}/c/${nanoid()}`,
				category: category!['_id'],
				country: faker.helpers.arrayElement(Object.values(Country)),
				tags: [faker.lorem.word(), faker.lorem.word()], // Generate random tags
				title: faker.lorem.words(10),
				fundraiser: faker.helpers.arrayElement(Object.values(FundraiserEnum)),
				goal: faker.number.int({ min: 5000, max: 100000 }),
				amountRaised: faker.number.int({ min: 5000, max: 100000 }),
				deadline: faker.date.future(),
				images: [
					{
						secureUrl: faker.image.url(),
						blurHash: faker.image.urlPlaceholder(),
					},
				],
				story: faker.lorem.paragraph(20),
				storyHtml: faker.lorem.paragraphs(20),
				creator: creator!['_id'],
				status: StatusEnum.APPROVED,
				isFlagged: faker.datatype.boolean(),
				flaggedReasons: [],
				isDeleted: false,
				featured: faker.datatype.boolean(),
				isPublished: true,
			};

			campaignsToSeed.push(newCampaign);
		}

		// Insert data into MongoDB
		await campaignModel.insertMany(campaignsToSeed);

		console.log('Campaigns seeded successfully.');
	} catch (error) {
		console.error('Error seeding campaigns:', error);
	} finally {
		// Disconnect from MongoDB
		await mongoose.disconnect();
	}
}

export async function runSeeders(size: number) {
	try {
		// Seed the campaigns
		seedCampaigns(size);
	} catch (error) {
		console.log('Error seeding campaigns:', error);
	}
}
