import { executionConfig } from '../config/execution.js';
import { languages } from '../config/languages.js';
import { AppError } from '../utils/AppError.js';
import { runCode } from './sandbox.service.js';

let activeRuns = 0;
const waitingRequests = [];

export function listLanguages() {
  return Object.values(languages).map((language) => ({
    id: language.id,
    displayName: language.displayName,
    starterCode: language.starterCode,
    monacoLanguage: language.monacoLanguage,
  }));
}

async function acquireSlot(signal) {
  if (signal.aborted) throw new AppError('Request cancelled', 499);
  if (activeRuns < executionConfig.concurrency) {
    activeRuns += 1;
    return;
  }
  if (waitingRequests.length >= executionConfig.maxQueueLength) {
    throw new AppError('Execution queue is full. Try again later.', 429);
  }

  await new Promise((resolve, reject) => {
    const request = { resolve, signal, cancel };
    function cancel() {
      const index = waitingRequests.indexOf(request);
      if (index !== -1) waitingRequests.splice(index, 1);
      reject(new AppError('Request cancelled', 499));
    }
    waitingRequests.push(request);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

function releaseSlot() {
  const nextRequest = waitingRequests.shift();
  if (nextRequest) {
    // Hand the occupied slot directly to the next request so newcomers cannot take it.
    nextRequest.signal.removeEventListener('abort', nextRequest.cancel);
    nextRequest.resolve();
  } else {
    activeRuns -= 1;
  }
}

export async function executeCode(input, signal) {
  await acquireSlot(signal);
  try {
    if (signal.aborted) throw new AppError('Request cancelled', 499);
    return await runCode(input);
  } finally {
    // runCode finishes its container cleanup before a slot is released.
    releaseSlot();
  }
}
