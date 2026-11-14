import { languages } from '../config/languages.js';
import { sandboxConfig } from '../config/sandbox.js';
import { AppError } from './AppError.js';

export function validateExecution(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError('Expected a JSON object with language, code, and optional stdin', 400);
  }
  const { language, code, stdin = '' } = input;
  if (typeof language !== 'string' || !Object.hasOwn(languages, language)) {
    throw new AppError('Unsupported language', 400);
  }
  if (typeof code !== 'string' || !code.trim()) {
    throw new AppError('Code must be a non-empty string', 400);
  }
  if (typeof stdin !== 'string') throw new AppError('stdin must be a string', 400);
  if (Buffer.byteLength(code) > sandboxConfig.maxCodeBytes) {
    throw new AppError(`Code exceeds ${sandboxConfig.maxCodeBytes} bytes`, 413);
  }
  if (Buffer.byteLength(stdin) > sandboxConfig.maxStdinBytes) {
    throw new AppError(`stdin exceeds ${sandboxConfig.maxStdinBytes} bytes`, 413);
  }
  return { language, code, stdin };
}
