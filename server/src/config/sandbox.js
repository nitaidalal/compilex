import './loadEnv.js';

function integer(name, fallback, minimum = 1) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer >= ${minimum}`);
  }
  return value;
}

const memoryMb = integer('SANDBOX_MEMORY_MB', 256, 16);
const timeoutMs = integer('SANDBOX_TIMEOUT_MS', 10000);
const requestTimeoutMs = integer('DOCKER_REQUEST_TIMEOUT_MS', 30000);
if (timeoutMs > 2147483647 || requestTimeoutMs <= timeoutMs) {
  throw new Error('SANDBOX_TIMEOUT_MS must fit a Node timer and be less than DOCKER_REQUEST_TIMEOUT_MS');
}

export const sandboxConfig = Object.freeze({
  socketPath: process.env.DOCKER_SOCKET_PATH || (process.platform === 'win32'
    ? '//./pipe/dockerDesktopLinuxEngine' : '/var/run/docker.sock'),
  requestTimeoutMs,
  timeoutMs,
  memoryBytes: memoryMb * 1024 * 1024,
  memorySwapBytes: memoryMb * 1024 * 1024, // Equal limits disable additional swap.
  nanoCpus: integer('SANDBOX_NANO_CPUS', 1000000000),
  pidsLimit: integer('SANDBOX_PIDS_LIMIT', 64),
  tmpfsMb: integer('SANDBOX_TMPFS_MB', 64),
  maxCodeBytes: integer('SANDBOX_MAX_CODE_BYTES', 65536),
  maxStdinBytes: integer('SANDBOX_MAX_STDIN_BYTES', 65536),
  maxOutputBytes: integer('SANDBOX_MAX_OUTPUT_BYTES', 65536),
  archiveChunkChars: 32768, // Keep each encoded Docker exec argument below Linux's per-argument limit.
  user: '10001:10001',
  workDir: '/tmp',
  stdinFile: 'stdin.txt',
  label: 'compilex.sandbox',
  idleCommand: ['sleep', 'infinity'],
});
