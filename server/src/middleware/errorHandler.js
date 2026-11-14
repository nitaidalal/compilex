import { AppError } from '../utils/AppError.js';

export function notFound(req, res, next) {
  next(new AppError('Route not found', 404));
}

// Express identifies error middleware by all four parameters, including next.
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let statusCode = 500;
  let message = 'Internal server error';
  if (error instanceof AppError && Number.isInteger(error.statusCode)
      && error.statusCode >= 400 && error.statusCode <= 599) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON body';
  } else if (error.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body too large';
  }

  if (statusCode >= 500) console.error(error);
  res.status(statusCode).json({ success: false, error: { message } });
}
