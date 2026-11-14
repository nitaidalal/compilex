import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { config } from './config/env.js';
import { AppError } from './utils/AppError.js';
import { healthRouter } from './routes/health.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev', {
  skip: () => config.nodeEnv === 'test',
}));
app.use(cors({
  origin(origin, callback) {
    // Requests from CLI tools have no Origin header.
    if (!origin || origin === config.clientOrigin) return callback(null, true);
    callback(new AppError('Origin not allowed', 403));
  },
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api', healthRouter);
app.use(notFound);
app.use(errorHandler);
