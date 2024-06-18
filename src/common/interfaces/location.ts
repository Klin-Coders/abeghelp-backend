import { LocationTypeEnum } from '@/common/constants';
import mongoose from 'mongoose';

export interface ILocation {
	country: string;
	city: string;
	postalCode: string;
	ipv4: string;
	ipv6: string;
	geo: {
		lat: string;
		lng: string;
	};
	region: string;
	continent: string;
	timezone: string;
	os: string;
	createdAt: Date;
	updatedAt: Date;
	user: mongoose.Types.ObjectId;
	donation: mongoose.Types.ObjectId;
	type: LocationTypeEnum;
}

export type locationModel = ILocation;
