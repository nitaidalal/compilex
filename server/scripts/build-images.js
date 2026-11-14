import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { languages } from '../src/config/languages.js';

const sandboxDirectory = fileURLToPath(new URL('../sandbox/', import.meta.url));

function docker(args) {
  const result = spawnSync('docker', args, { stdio: 'inherit' });
  if (result.error) throw new Error(`Could not run Docker: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`docker ${args[0]} failed (${result.signal ?? result.status}). See Docker output above.`);
  }
}

try {
  docker(['info', '--format', '{{.OSType}}']);
  for (const language of Object.values(languages)) {
    const dockerfile = fileURLToPath(new URL(`../sandbox/Dockerfile.${language.id}`, import.meta.url));
    console.log(`\nBuilding ${language.displayName} -> ${language.image}`);
    docker(['build', '--pull', '--file', dockerfile, '--tag', language.image, sandboxDirectory]);
  }
  console.log('\nAll sandbox images built successfully.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
