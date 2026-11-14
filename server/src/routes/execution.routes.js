import { Router } from 'express';
import { execute, getLanguages } from '../controllers/execution.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const executionRouter = Router();
executionRouter.get('/languages', getLanguages);
executionRouter.post('/execute', asyncHandler(execute));
