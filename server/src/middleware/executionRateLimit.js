import { rateLimit } from 'express-rate-limit';
import { executionConfig } from '../config/execution.js';
import { AppError } from '../utils/AppError.js';

export const executionRateLimit = rateLimit({
  windowMs: executionConfig.rateWindowMs,
  limit: executionConfig.rateMaxRequests,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler(req, res, next) {
    next(new AppError('Too many execution requests from this IP. Try again later.', 429));
  },
});
