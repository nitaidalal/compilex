# CompileX

Local online code compiler, built as a JavaScript npm-workspaces monorepo. Task 1 provides the Express API foundation; `client/` is reserved for the later Vite frontend.

Requires Node.js 22.18+ and a running local MongoDB instance. Development uses the existing global nodemon installation (`nodemon` must be on PATH). Docker Desktop will be required for later sandbox tasks.

From the repository root in PowerShell:

```powershell
npm.cmd ci
Copy-Item server/.env.example server/.env
npm.cmd run dev
```

Edit `server/.env` if your MongoDB URI or ports differ. Do not overwrite an existing `.env`. `MONGODB_URI` is required; defaults are `NODE_ENV=development`, `PORT=5000`, and `CLIENT_ORIGIN=http://localhost:5173`. The origin must have no trailing slash. Environment variables override the file. The API starts only after MongoDB connects, and exits on startup failure.

```powershell
# Regular startup (without automatic restart)
npm.cmd start
# With the API running in another terminal
curl.exe -i http://localhost:5000/api/health
curl.exe -i http://localhost:5000/api/missing
```

Health returns HTTP 200 and `{"success":true,"data":{"status":"ok","database":"connected"}}`. If MongoDB disconnects, health returns 503. Unknown routes return JSON with HTTP 404. Unexpected errors return HTTP 500 without private details. There is no public debug-error endpoint.

Backend layers live in `server/src/{routes,controllers,services,models}`. Configuration, shared middleware, and utilities have separate folders. Future work and decisions are tracked in [the project plan](docs/PROJECT_PLAN.md).

## Sandbox images

Start Docker Desktop in Linux-container mode, then run from the repository root (the same command also works inside `server/`):

```powershell
npm.cmd run build:images
```

The script reads `server/src/config/languages.js`, pulls updated base images, and builds sequentially. It needs Docker, not MongoDB or `.env`.

| Language ID | Local image tag | Official base | Source file |
| --- | --- | --- | --- |
| `cpp` | `compilex-sandbox-cpp:1` | `gcc:15` | `main.cpp` |
| `python` | `compilex-sandbox-python:1` | `python:3.14-alpine` | `main.py` |
| `javascript` | `compilex-sandbox-javascript:1` | `node:24-alpine` | `main.mjs` |

Python and Node use small Alpine images. The [official GCC image](https://hub.docker.com/_/gcc) has no slim or Alpine variant; its standard image includes the compiler toolchain. These Dockerfiles install no extra packages. All three create a sandbox user (UID/GID 10001) and `/workspace`, and run as that user. The [official Python](https://hub.docker.com/_/python) and [Node](https://hub.docker.com/_/node) image pages describe their base variants. Major/minor base tags receive updates when rebuilt; local `:1` tags identify the sandbox command/layout contract.

### Run the starters manually

From the repository root in PowerShell, write the configured starter source to a temporary directory. This only writes source files on the host; execution happens in Docker.

```powershell
$env:COMPILEX_EXAMPLES = Join-Path ([IO.Path]::GetTempPath()) 'compilex-examples'
@'
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { languages } from './server/src/config/languages.js';
mkdirSync(process.env.COMPILEX_EXAMPLES, { recursive: true });
for (const language of Object.values(languages)) {
  writeFileSync(join(process.env.COMPILEX_EXAMPLES, language.sourceFile), language.starterCode);
}
'@ | node --input-type=module
```

Use this PowerShell helper for each manual `docker run`. It applies runtime restrictions that Dockerfiles cannot enforce: no network, 256 MB RAM with no extra swap, one CPU, 64 PIDs, a read-only root and source, dropped capabilities, and no privilege escalation. A 64 MB `/tmp` permits compiler output; it needs execute permission for the C++ binary. The in-container deadline covers compilation and execution; combined stdout/stderr is capped at 64 KB. Cleanup runs even if the command fails or is interrupted.

```powershell
function Invoke-SandboxExample {
  param([string]$Image, [string]$SourceFile, [string]$Command)
  $containerName = 'compilex-manual-' + [guid]::NewGuid().ToString('N')
  $sourcePath = Join-Path $env:COMPILEX_EXAMPLES $SourceFile
  $dockerArgs = @(
    'run', '-i', '--name', $containerName,
    '--network', 'none', '--memory', '256m', '--memory-swap', '256m',
    '--cpus', '1', '--pids-limit', '64', '--read-only',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '--user', '10001:10001',
    '--tmpfs', '/tmp:rw,exec,nosuid,nodev,size=64m,mode=1777',
    '--mount', "type=bind,source=$sourcePath,target=/workspace/$SourceFile,readonly",
    '--entrypoint', 'timeout', $Image, '-s', 'KILL', '15',
    'sh', '-c', "($Command) 2>&1 | head -c 65536"
  )
  try {
    'Ada' | docker @dockerArgs
    if ($LASTEXITCODE -ne 0) { throw "Container exited with code $LASTEXITCODE" }
  } finally {
    docker rm -f $containerName 2>$null | Out-Null
  }
}

Invoke-SandboxExample 'compilex-sandbox-cpp:1' 'main.cpp' 'g++ /workspace/main.cpp -std=c++17 -O2 -o /tmp/main && /tmp/main'
Invoke-SandboxExample 'compilex-sandbox-python:1' 'main.py' 'python -B -u /workspace/main.py'
Invoke-SandboxExample 'compilex-sandbox-javascript:1' 'main.mjs' 'node /workspace/main.mjs'
```

Each should print `Hello, Ada!`. These are manual examples; the output-limiting shell pipeline reports the final pipeline command's status, so inspect compiler/runtime messages too. The execution service in Task 3 will track compile/run statuses separately and enforce its own deadline, output cap, and container cleanup.

### Add a language

1. Add `server/sandbox/Dockerfile.<id>` based on an official runtime/toolchain image. Create UID/GID 10001 and `/workspace`, select that non-root user, and avoid extra packages.
2. Add a matching entry in `server/src/config/languages.js`: `id`, `displayName`, `image`, `sourceFile`, `compileCommand` (an argv array or `null`), `runCommand` (argv array), `starterCode`, and `monacoLanguage`. Use fixed container paths under `/workspace` for source and `/tmp` for compiler output. The starter should greet the user and read one line from stdin.
3. Run `npm.cmd run build:images` and manually run the new starter with the same restrictions. The build script discovers `Dockerfile.<id>` from config; no script changes are needed. Preserve every sandbox security restriction when wiring it into the future execution service.
