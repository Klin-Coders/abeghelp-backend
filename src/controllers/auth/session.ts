import { AppError, AppResponse, fetchInitialData, toJSON } from '@/common/utils';
import { catchAsync } from '@/middlewares';
import { Request, Response } from 'express';

export const session = catchAsync(async (req: Request, res: Response) => {
	const currentUser = req.user;
	if (!currentUser) {
		throw new AppError('Unauthenticated', 401);
	}

	const initialData = await fetchInitialData(currentUser._id);
	return AppResponse(res, 200, { ...initialData, user: toJSON(currentUser) }, 'Authenticated');
});
