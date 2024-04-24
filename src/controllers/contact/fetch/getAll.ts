import { AppResponse, QueryHandler } from '@/common/utils';
import { catchAsync } from '@/middlewares';
import { contactModel } from '@/models';
import { Request, Response } from 'express';
import { sanitize } from 'express-mongo-sanitize';

export const getAllContactMessages = catchAsync(async (req: Request, res: Response) => {
	const query = sanitize(req.query);

	// create a new QueryHandler instance
	const queryHandler = new QueryHandler(contactModel.find({}), query);

	// TODO: add caching

	const contactMessages = await queryHandler.paginate().execute();

	AppResponse(res, 200, contactMessages, 'Messages fetched successfully!');
});
