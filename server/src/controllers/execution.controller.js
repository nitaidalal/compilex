import { executeCode, listLanguages } from '../services/execution.service.js';
import { validateExecution } from '../utils/validateExecution.js';
import { AppError } from '../utils/AppError.js';

export function getLanguages(req, res) {
  res.json({ success: true, data: listLanguages() });
}

export async function execute(req, res) {
  if (!req.is('application/json')) {
    throw new AppError('Content-Type must be application/json', 415);
  }
  const input = validateExecution(req.body);
  const cancellation = new AbortController();
  const onClose = () => cancellation.abort();
  res.once('close', onClose);
  if (res.destroyed) cancellation.abort();
  try {
    const result = await executeCode(input, cancellation.signal);
    if (!res.destroyed) res.json({ success: true, data: result });
  } finally {
    res.removeListener('close', onClose);
  }
}
