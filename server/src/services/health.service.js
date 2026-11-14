import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';

export function getHealth() {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError('Database unavailable', 503);
  }
  return { status: 'ok', database: 'connected' };
}
