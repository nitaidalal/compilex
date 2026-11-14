import { app } from './app.js';
import { config } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';

let server;
let stopping = false;

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: shutting down`);
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    await disconnectDatabase();
    clearTimeout(deadline);
  } catch (error) {
    console.error('Shutdown failed:', error.message);
    process.exitCode = 1;
  }
}

try {
  await connectDatabase();
  server = app.listen(config.port);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  console.log(`RunBox API listening on http://localhost:${config.port}`);
  process.on('SIGINT', () => { void shutdown('SIGINT'); });
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
} catch (error) {
  console.error('Startup failed:', error.message);
  await disconnectDatabase();
  process.exitCode = 1;
}
