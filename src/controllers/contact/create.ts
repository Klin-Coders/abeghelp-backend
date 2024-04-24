import { AppError, AppResponse } from '@/common/utils';
import { catchAsync } from '@/middlewares';
import { Request, Response } from 'express';
import { contactModel } from '@/models';

export const createContactMessage = catchAsync(async (req: Request, res: Response) => {
	const { firstName, lastName, email, message } = req.body;

	if (!firstName || !email || !message) {
		throw new AppError('All fields are required', 400);
	}

	const newContact = await contactModel
		.create({
			firstName,
			lastName,
			email,
			message,
		})
		.catch(() => {
			throw new AppError('Unable to process request, try again later', 500);
		});

	return AppResponse(res, 200, newContact, 'Message sent successfully');
});
