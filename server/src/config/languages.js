// Commands are argv arrays for Docker exec, never interpolated shell strings.
// Source paths are relative to the sandbox working directory (/tmp).
export const languages = Object.freeze({
  cpp: {
    id: 'cpp',
    displayName: 'C++',
    image: 'compilex-sandbox-cpp:1',
    sourceFile: 'main.cpp',
    compileCommand: ['g++', 'main.cpp', '-std=c++17', '-O2', '-o', '/tmp/main'],
    runCommand: ['/tmp/main'],
    starterCode: `#include <iostream>
#include <string>

int main() {
    std::string name;
    std::getline(std::cin, name);
    if (!name.empty() && name.back() == '\\r') name.pop_back();
    std::cout << "Hello, " << (name.empty() ? "world" : name) << "!\\n";
    return 0;
}
`,
    monacoLanguage: 'cpp',
  },
  python: {
    id: 'python',
    displayName: 'Python',
    image: 'compilex-sandbox-python:1',
    sourceFile: 'main.py',
    compileCommand: null,
    runCommand: ['python', '-B', '-u', 'main.py'],
    starterCode: `import sys

name = sys.stdin.readline().rstrip("\\r\\n")
print(f"Hello, {name or 'world'}!")
`,
    monacoLanguage: 'python',
  },
  javascript: {
    id: 'javascript',
    displayName: 'JavaScript',
    image: 'compilex-sandbox-javascript:1',
    sourceFile: 'main.mjs',
    compileCommand: null,
    runCommand: ['node', 'main.mjs'],
    starterCode: `import { createInterface } from 'node:readline';

const input = createInterface({ input: process.stdin });
let greeted = false;

input.once('line', (name) => {
  greeted = true;
  console.log('Hello, ' + (name || 'world') + '!');
  input.close();
});

input.once('close', () => {
  if (!greeted) console.log('Hello, world!');
});
`,
    monacoLanguage: 'javascript',
  },
});
