import './loadEnv.js';
import { sandboxConfig } from './sandbox.js';

function integer(name, fallback, minimum = 1) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < minimum || value > 2147483647) {
    throw new Error(`${name} must be an integer between ${minimum} and 2147483647`);
  }
  return value;
}

export const executionConfig = Object.freeze({
  concurrency: integer('EXECUTION_CONCURRENCY', 2),
  maxQueueLength: integer('EXECUTION_MAX_QUEUE_LENGTH', 10, 0),
  rateWindowMs: integer('EXECUTION_RATE_WINDOW_MS', 60000),
  rateMaxRequests: integer('EXECUTION_RATE_MAX_REQUESTS', 20),
  // JSON escaping can use six bytes for each source/input byte, plus object fields.
  maxBodyBytes: 6 * (sandboxConfig.maxCodeBytes + sandboxConfig.maxStdinBytes) + 1024,
});
