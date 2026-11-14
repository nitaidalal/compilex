import { Router } from 'express';
import { health } from '../controllers/health.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const healthRouter = Router();
healthRouter.get('/health', asyncHandler(health));
