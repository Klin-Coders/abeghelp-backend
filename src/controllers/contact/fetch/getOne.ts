import { AppError, AppResponse } from '@/common/utils';
import { catchAsync } from '@/middlewares';
import { contactModel } from '@/models';
import { Request, Response } from 'express';
import { sanitize } from 'express-mongo-sanitize';

export const getOneContactMessage = catchAsync(async (req: Request, res: Response) => {
	const { id } = sanitize(req.params);

	const contact = await contactModel.findById(id);

	if (!contact) {
		throw new AppError('Contact message not found', 404);
	}

	AppResponse(res, 200, contact, 'Contact message fetched successfully!');
});
