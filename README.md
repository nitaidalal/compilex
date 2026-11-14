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
2. Add a matching entry in `server/src/config/languages.js`: `id`, `displayName`, `image`, `sourceFile`, `compileCommand` (an argv array or `null`), `runCommand` (argv array), `starterCode`, and `monacoLanguage`. Use relative source filenames: the service runs in `/tmp`, where source and compile output fit inside one bounded tmpfs. The starter should greet the user and read one line from stdin.
3. Run `npm.cmd run build:images` and manually run the new starter with the same restrictions. The build script discovers `Dockerfile.<id>` from config; no script changes are needed. Preserve every sandbox security restriction when wiring it into the future execution service.

## Sandbox service

`runCode({ language, code, stdin })` in `server/src/services/sandbox.service.js` executes one request in one throwaway container. Language IDs are `cpp`, `python`, and `javascript`. Start Docker Desktop and build the images, then run the demo from the root or `server/`:

```powershell
npm.cmd run sandbox:demo
```

The demo prints three successful greetings with `Ada` as input, a C++ `compile_error`, and a Python infinite loop returning `timeout`. It needs neither a MongoDB connection nor a configured MongoDB URI.

The service packs source and stdin into an in-memory tar archive, base64-encodes it, and sends it as small data arguments to a fixed Docker exec extraction command. A non-root process decodes and extracts into the bounded `/tmp` tmpfs. This avoids Windows bind-mount paths and named-pipe half-close behavior. No host temp files or host code execution are involved. Docker's archive-copy endpoint cannot write to a read-only root, so the root stays read-only and extraction uses the existing tmpfs. A fixed shell wrapper redirects the uploaded stdin file into the program, preserving its bytes and delivering EOF. Source/input never become shell command text.

Limits are defined in `server/src/config/sandbox.js`, with environment overrides listed in `server/.env.example`: 256 MB memory with no additional swap, one CPU, 64 PIDs, 64 MB tmpfs, a 10-second deadline, and 64 KB each for source, input, and combined captured output. The root is read-only; network is disabled; capabilities are dropped; privilege escalation is disabled; all commands use UID/GID 10001. The timeout kills the entire container, and `finally` forcibly removes it. Docker logging is disabled so output cannot fill daemon log files.

Results contain `{ status, stdout, stderr, exitCode, durationMs }`. Compilation and execution use separate Docker exec calls. Statuses are `success`, `compile_error`, `runtime_error`, `timeout`, or `memory_limit`. Docker OOM events identify actual memory kills, including exec children; exit code 137 alone is not assumed to mean OOM. Output overflow kills the container and returns the current phase's error status with truncated output (there is no separate output-limit status). The byte cap is shared by both streams and phases. `durationMs` measures total elapsed time, including setup, compile, execution, and cleanup; `exitCode` may be null when interrupted before Docker reports it. Invalid requests and Docker infrastructure failures throw errors rather than masquerading as user-code failures.

`DOCKER_SOCKET_PATH` defaults to Docker Desktop's Linux-engine pipe on Windows and `/var/run/docker.sock` on Linux/macOS. Override it if your local Docker installation uses a different socket. Docker control requests have a separate configurable timeout, greater than the execution deadline.

## HTTP execution API

Start MongoDB and Docker Desktop, then run `npm.cmd start` from the root or `server/`. Build the images first if needed with `npm.cmd run build:images`.

`GET /api/languages` returns `{ success: true, data: [...] }`. Each entry contains only `id`, `displayName`, `starterCode`, and `monacoLanguage`. Docker image names, commands, and filesystem paths are not exposed as configuration fields.

`POST /api/execute` accepts JSON `{ language, code, stdin }`; stdin defaults to an empty string. Language, types, and UTF-8 byte sizes are validated before admission to the queue. Source and stdin each default to a 65536-byte limit. The JSON body limit is calculated to accommodate both fields and JSON escaping; individual field limits still apply.

Completed submissions return HTTP 200 with `{ success: true, data: { status, stdout, stderr, exitCode, durationMs } }`, including `compile_error` and `timeout` results. Invalid requests, full queues, and rate-limit rejections use `{ success: false, error: { message } }` with HTTP 400/413/415/429 as appropriate. Unexpected infrastructure errors use the same JSON shape with HTTP 500 and a generic message.

Admission settings in `server/.env`:

| Variable | Default | Meaning |
| --- | --- | --- |
| `EXECUTION_CONCURRENCY` | `2` | Maximum active sandbox runs |
| `EXECUTION_MAX_QUEUE_LENGTH` | `10` | Maximum waiting requests; `0` disables waiting |
| `EXECUTION_RATE_WINDOW_MS` | `60000` | Per-IP rate-limit window |
| `EXECUTION_RATE_MAX_REQUESTS` | `20` | Allowed execution POSTs per IP per window |

The queue is first-in, first-out. An active slot is released after container cleanup, including when the sandbox throws. Disconnected waiting clients are removed from the queue; a run already started completes under its sandbox limits. Queue wait is outside the sandbox execution timer and `durationMs`. Rate limiting runs before JSON parsing and counts every execution POST reaching it, including invalid submissions and queue-full responses. Rejected requests include rate-limit headers; rate-limited responses also include `Retry-After`.

The queue and rate counters are in memory in one Node process and reset on restart. This fits the local single-server setup. Requests use the direct client IP; proxy trust is left disabled. Health and language-list requests do not consume the execution rate allowance.

### Curl examples (PowerShell)

These commands send JSON through stdin to avoid PowerShell's native argument quoting issues. Use `curl.exe`, since Windows PowerShell can map `curl` to a different command. The examples assume the default API port 5000.

```powershell
# Supported languages
curl.exe -sS http://localhost:5000/api/languages

# Success: HTTP 200, data.status = success, stdout = Hello, Ada!
'{"language":"python","code":"print(input())","stdin":"Hello, Ada!\n"}' | curl.exe -sS -i http://localhost:5000/api/execute -H 'Content-Type: application/json' --data-binary '@-'

# Compile error: HTTP 200, data.status = compile_error, compiler message in stderr
'{"language":"cpp","code":"int main() { broken syntax }"}' | curl.exe -sS -i http://localhost:5000/api/execute -H 'Content-Type: application/json' --data-binary '@-'

# Timeout: HTTP 200, data.status = timeout (about 10 seconds by default)
'{"language":"python","code":"while True: pass"}' | curl.exe -sS -i http://localhost:5000/api/execute -H 'Content-Type: application/json' --data-binary '@-'

# Bad input: HTTP 400, Unsupported language
'{"language":"ruby","code":"puts 123"}' | curl.exe -sS -i http://localhost:5000/api/execute -H 'Content-Type: application/json' --data-binary '@-'

# Oversized stdin: HTTP 413 with the same JSON error shape
@{ language = 'python'; code = 'print(123)'; stdin = ('x' * 65537) } | ConvertTo-Json -Compress | curl.exe -sS -i http://localhost:5000/api/execute -H 'Content-Type: application/json' --data-binary '@-'
```

### Burst showing queue-full and rate-limit responses

Stop the API with Ctrl+C. In its terminal, start a fresh process with these temporary settings (the saved `.env` is unchanged):

```powershell
$env:EXECUTION_CONCURRENCY = '1'
$env:EXECUTION_MAX_QUEUE_LENGTH = '1'
$env:EXECUTION_RATE_WINDOW_MS = '60000'
$env:EXECUTION_RATE_MAX_REQUESTS = '3'
npm.cmd start
```

In another terminal, send four parallel requests as the first execution requests after restart:

```powershell
$burstFile = Join-Path ([IO.Path]::GetTempPath()) ('compilex-burst-' + [guid]::NewGuid().ToString('N') + '.json')
[IO.File]::WriteAllText($burstFile, '{"language":"python","code":"import time; time.sleep(1); print(123)"}')
try {
  curl.exe --parallel --parallel-immediate --parallel-max 4 -sS -i -H 'Content-Type: application/json' --data-binary "@$burstFile" http://localhost:5000/api/execute http://localhost:5000/api/execute http://localhost:5000/api/execute http://localhost:5000/api/execute
} finally {
  Remove-Item -LiteralPath $burstFile
}
```

Expect two HTTP 200 results (one active, one queued), a queue-full HTTP 429, and a per-IP rate-limit HTTP 429. Response order can vary. Queue-full says `Execution queue is full. Try again later.`; the IP limiter says `Too many execution requests from this IP. Try again later.` Do not submit other execution requests before this burst, since they consume the same IP allowance. Keep the normal sandbox timeout at 10 seconds so the one-second programs finish successfully.

Afterward, stop the server and open a fresh terminal, or remove the four temporary environment overrides before starting again, to restore the defaults from `.env`.
