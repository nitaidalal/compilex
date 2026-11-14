import { runCode } from '../src/services/sandbox.service.js';
import { languages } from '../src/config/languages.js';

try {
  for (const language of Object.values(languages)) {
    console.log(`\n${language.displayName} hello world`);
    console.log(await runCode({ language: language.id, code: language.starterCode, stdin: 'Ada\n' }));
  }
  console.log('\nC++ compile error');
  console.log(await runCode({ language: 'cpp', code: 'int main() { broken syntax }' }));
  console.log('\nPython infinite loop');
  console.log(await runCode({ language: 'python', code: 'while True:\n    pass\n' }));
} catch (error) {
  console.error('Sandbox demo failed:', error.message);
  process.exitCode = 1;
}
