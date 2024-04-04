///////////////////////////////////////////////////////////////////////
// DO NOT CHANGE THE ORDER OF THE IMPORTS;
// DOT ENV AND MODULE ALIAS WILL NOT WORK PROPERLY UNLESS THEY ARE IMPORTED FIRST

import * as dotenv from 'dotenv';
dotenv.config();
if (process.env.NODE_ENV === 'production') {
	require('module-alias/register');
}

///////////////////////////////////////////////////////////////////////
import { ENVIRONMENT, connectDb } from '@/common/config';
import '@/common/interfaces/request';
import { AppResponse, logger, stream } from '@/common/utils';
import { errorHandler, socketController } from '@/controllers';
import { catchSocketAsync, timeoutMiddleware, validateDataWithZod } from '@/middlewares';
import { campaignQueue, emailQueue, startAllQueuesAndWorkers, stopAllQueuesAndWorkers } from '@/queues';
import { authRouter, campaignRouter, donationRouter, paymentHookRouter, userRouter } from '@/routes';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express, NextFunction, Request, Response } from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import helmet, { HelmetOptions } from 'helmet';
import helmetCsp from 'helmet-csp';
import hpp from 'hpp';
import http from 'http';
import morgan from 'morgan';
import { Server, Socket } from 'socket.io';

////////////////////////////////
// XSS-CLEAN IS DEPRECATED
// TODO: REWRITE A CUSTOM XSS CLEANER
import xss from 'xss-clean';
import { runSeeders } from './scripts/seeders';
////////////////////////////////

dotenv.config();
/**
 *  uncaughtException handler
 */
process.on('uncaughtException', async (error: Error) => {
	console.log('UNCAUGHT EXCEPTION! 💥 Server Shutting down...');
	console.log(error.name, error.message);
	logger.error('UNCAUGHT EXCEPTION!! 💥 Server Shutting down... ' + new Date(Date.now()) + error.name, error.message);
	await stopAllQueuesAndWorkers();
	process.exit(1);
});

/**
 * Default app configurations
 */
const app: Express = express();
const port = ENVIRONMENT.APP.PORT;
const appName = ENVIRONMENT.APP.NAME;

// QUEUE
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/api/v1/queue');
createBullBoard({
	queues: [new BullMQAdapter(emailQueue), new BullMQAdapter(campaignQueue)],
	serverAdapter,
});

/**
 * Express configuration
 */
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']); // Enable trust proxy
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

/**
 * Compression Middleware
 */
app.use(compression());

// Rate limiter middleware
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per windowMs
	message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

//Middleware to allow CORS from frontend
app.use(
	cors({
		origin: ['https://abeghelp.me', 'https://www.abeghelp.me', 'http://localhost:3000', 'http://localhost:3001'],
		credentials: true,
	})
);
//Configure Content Security Policy (CSP)
//prevent Cross-Site Scripting (XSS) attacks by not allowing the loading of content from other domains.
const contentSecurityPolicy = {
	directives: {
		defaultSrc: ["'self'", 'https://www.abeghelp.me', 'https://abeghelp.me', 'https://api.abeghelp.me'],
		scriptSrc: ["'self'"],
		styleSrc: ["'self'"],
		imgSrc: ["'self'"],
		frameAncestors: ["'none'"],
		objectSrc: ["'none'"],
		upgradeInsecureRequests: [],
	},
};

// Use Helmet middleware for security headers
app.use(
	helmet({
		contentSecurityPolicy: false, // Disable the default CSP middleware
	})
);
// Use helmet-csp middleware for Content Security Policy
app.use(helmetCsp(contentSecurityPolicy));

const helmetConfig: HelmetOptions = {
	// X-Frame-Options header to prevent clickjacking
	frameguard: { action: 'deny' },
	// X-XSS-Protection header to enable browser's built-in XSS protection
	xssFilter: true,
	// Referrer-Policy header
	referrerPolicy: { policy: 'origin-when-cross-origin' },
	// Strict-Transport-Security (HSTS) header for HTTPS enforcement
	hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
};

app.use(helmet(helmetConfig));

//Secure cookies and other helmet-related configurations
app.use(helmet.hidePoweredBy());
app.use(helmet.noSniff());
app.use(helmet.ieNoOpen());
app.use(helmet.dnsPrefetchControl());
app.use(helmet.permittedCrossDomainPolicies());
// Prevent browser from caching sensitive information
app.use((req, res, next) => {
	res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
	res.set('Pragma', 'no-cache');
	res.set('Expires', '0');
	next();
});
// Data sanitization against NoSQL query injection
app.use(mongoSanitize());
// Data sanitization against XSS
app.use(xss());
// Prevent parameter pollution
app.use(
	hpp({
		whitelist: ['date', 'createdAt'], // whitelist some parameters
	})
);

/**
 * Logger Middleware
 */
app.use(morgan(ENVIRONMENT.APP.ENV !== 'development' ? 'combined' : 'dev', { stream }));
// Add request time to req object
app.use((req: Request, res: Response, next: NextFunction) => {
	req['requestTime'] = new Date().toISOString();
	next();
});

/**
 * Initialize routes
 */
app.use(validateDataWithZod);
app.use('/api/v1/alive', (req, res) =>
	res.status(200).json({ status: 'success', message: 'Server is up and running' })
);
app.use('/api/v1/queue', serverAdapter.getRouter());
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/user', userRouter);
app.use('/api/v1/campaign', campaignRouter);
app.use('/api/v1/donation', donationRouter);
app.use('/api/v1/payment-hook', paymentHookRouter);

app.get('/api/v1/script/seeder', async (req, res) => {
	const size = Number(req?.query?.size || 20);

	await runSeeders(size);
	return AppResponse(res, 200, null, 'Seeders ran successfully');
});

app.all('/*', async (req, res) => {
	logger.error('route not found ' + new Date(Date.now()) + ' ' + req.originalUrl);
	res.status(404).json({
		status: 'error',
		message: `OOPs!! No handler defined for ${req.method.toUpperCase()}: ${
			req.url
		} route. Check the API documentation for more details.`,
	});
});

/**
 * Bootstrap server
 */

// to ensure all the express middlewares are set up before starting the socket server
// including security headers and other middlewares
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: ['https://abeghelp.me', 'https://www.abeghelp.me', 'http://localhost:3000', 'http://localhost:3001'],
		credentials: true,
	},
});

app.use((req: Request, res: Response, next: NextFunction) => {
	req.io = io;
	next();
});

/**
 * Socket.io
 */

io.use(
	catchSocketAsync(async () => {
		// Parse the cookies from the socket
		// const cookies = cookie.parse(socket.handshake.headers.cookie || '');
		// Check if cookies is defined
		// if (cookies) {
		// 	// Extract the access and refresh tokens
		// 	const { abegAccessToken, abegRefreshToken } = cookies;
		// 	// Send the tokens to the authenticate helper function
		// 	const { currentUser } = await authenticate({ abegAccessToken, abegRefreshToken });
		// 	// Attach the user to the socket object
		// 	socket.user = currentUser;
		// 	if (next) {
		// 		next();
		// 	}
		// } else {
		// 	console.log('No cookie sent with sockets ' + socket.id);
		// 	throw new Error('Authentication error');
		// }
	})
);

io.on(
	'connection',
	catchSocketAsync(async (socket: Socket) => {
		console.log('User connected ' + socket.id);
		socketController(socket, io);
	})
);

const appServer = server.listen(port, async () => {
	await connectDb();
	console.log('=> ' + appName + ' app listening on port ' + port + '!');
	// start the email worker and queues
	(async () => {
		await startAllQueuesAndWorkers();
	})();
});

/**
 * Error handler middlewares
 */
app.use(timeoutMiddleware);
app.use(errorHandler);

/**
 * unhandledRejection  handler
 */

process.on('unhandledRejection', async (error: Error) => {
	console.log('UNHANDLED REJECTION! 💥 Server Shutting down...');
	console.log(error.name, error.message);
	logger.error('UNHANDLED REJECTION! 💥 Server Shutting down... ' + new Date(Date.now()) + error.name, error.message);
	await stopAllQueuesAndWorkers();
	appServer.close(() => {
		process.exit(1);
	});
});
