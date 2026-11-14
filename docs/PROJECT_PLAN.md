# CompileX: Project Plan

## Overview
CompileX is an online code compiler in the style of Programiz. Users pick a language, write code in the browser, optionally provide input, and run it. Every run executes inside a locked-down, throwaway Docker container, so untrusted code never touches the host.

## Tech stack
- Frontend: React (Vite), Tailwind CSS, Monaco editor, axios, react-hot-toast, react-router
- Backend: Node.js, Express, Mongoose, dockerode
- Database: MongoDB
- Auth: JWT in an httpOnly cookie, bcrypt
- Plain JavaScript only (no TypeScript)
- Runs locally only (Docker Desktop + local MongoDB). No cloud deployment.

## Languages (v1)
C++, Python, JavaScript. More later through config.

## Features
- Monaco editor, language selector, starter code per language
- Stdin input box (sent before running)
- Output console: stdout, stderr, status badge, execution time
- Result statuses: success, compile_error, runtime_error, timeout, memory_limit
- Register, login, logout
- Save snippets, run history
- Shareable public links: read-only view, run, fork
- Concurrency limit, queue and rate limiting on execution
- Light and dark orange-themed UI

## Folder structure
compilex/
  AGENTS.md
  docs/PROJECT_PLAN.md
  server/
    sandbox/            (Dockerfiles: cpp, python, node)
    src/config/ routes/ controllers/ services/ models/ middleware/ utils/
  client/
    src/components/ pages/ context/ lib/ index.css

## Data models
- User: name, email (unique), passwordHash, timestamps
- Snippet: owner, title, language, code, stdin, shareId (unique, nullable), timestamps
- Run: user (nullable), language, code, stdin, status, stdout, stderr, durationMs, createdAt

## Main API
- GET  /api/health
- GET  /api/languages
- POST /api/execute
- POST /api/auth/register | /login | /logout, GET /api/auth/me
- CRUD /api/snippets, POST /api/snippets/:id/share
- GET  /api/shared/:shareId, POST /api/shared/:shareId/fork
- GET  /api/runs

## Sandbox rules
Network off, memory/CPU/PID limits, read-only root filesystem, all capabilities dropped, non-root user, hard timeout, output cap, container always removed afterwards.

## Build checklist
- [x] 1. Project scaffold and backend foundation
- [x] 2. Sandbox images and language config
- [x] 3. Execution engine (dockerode)
- [ ] 4. Execute API, queue and rate limiting
- [ ] 5. Authentication
- [ ] 6. Snippets, run history and share links
- [ ] 7. Frontend foundation (Vite, Tailwind, theming, auth pages)
- [ ] 8. Playground UI
- [ ] 9. Dashboard, saving and sharing
- [ ] 10. Security hardening and README

## Decisions log
- Task 1 (2026-11-14): npm-workspaces monorepo with the server as the first workspace; client is an empty placeholder until Task 7. JavaScript ES modules throughout. Node.js 22.18+. Development uses `nodemon src/server.js` with the user's existing global nodemon installation, as requested; no local package added.
- Environment is loaded from server/.env regardless of the working directory. MONGODB_URI is required; NODE_ENV, PORT, and CLIENT_ORIGIN have validated defaults. The API listens only after a successful MongoDB connection (5-second selection timeout), and closes HTTP/Mongoose on termination signals.
- Health uses routes -> controllers -> services and reports 503 when MongoDB is disconnected. Credentialed CORS accepts the configured Vite origin (default http://localhost:5173); requests without Origin are accepted for CLI tools. JSON bodies are capped at 100 KB.
- Central errors use a consistent JSON envelope, retain expected AppError messages, and hide unexpected exception details. There are no public debug endpoints.
- Manual verification: real startup against local MongoDB succeeded; GET /api/health returned 200 with connected database, unknown route returned JSON 404, and startup without MONGODB_URI exited nonzero. npm installation audit reported zero vulnerabilities.
- Installed stable versions verified with npm view: express 5.3.0, mongoose 9.12.1, helmet 8.3.0, morgan 1.12.1, cookie-parser 1.4.7, cors 2.8.6, dotenv 18.0.10. Exact direct versions and the root lockfile are recorded in the scaffold for reproducible installs.
- Task 2 (2026-11-15): language definitions are keyed by cpp, python, and javascript in server/src/config/languages.js. Commands are argv arrays; interpreted languages use null compileCommand. Sources live at /workspace/main.cpp, main.py, or main.mjs; C++17 compilation writes /tmp/main. Starters read one input line and support empty input/EOF with a world fallback. JavaScript uses ES modules.
- Docker images use gcc:15, python:3.14-alpine, and node:24-alpine with no added packages, UID/GID 10001, and /workspace. Official GCC has no slim/Alpine variant, so its standard compiler image is the size exception. Local tags are compilex-sandbox-<id>:1, matching the current CompileX project name.
- npm run build:images works from the root or server workspace. The dependency-free build script derives Dockerfile.<id> from each language entry, pulls bases, builds sequentially, and stops on failure. No MongoDB connection or environment configuration is needed for image builds.
- README manual runs use read-only source mounts, network none, memory/CPU/PID limits, read-only root, dropped capabilities, no-new-privileges, a small executable /tmp, a 15-second wall-clock deadline, 64 KB combined output cap, and finally cleanup. Task 3 must enforce these restrictions in the execution service and track compilation/runtime status separately.
- Task 2 verification completed (2026-11-15): the earlier disk-full failure left the cached GCC /usr/bin/dash executable at zero bytes, causing exec format error despite matching AMD64 architecture. Removed only gcc:15 and its nine identified build-cache records, then rebuilt with npm run build:images successfully. All three starters printed Hello, Ada! using PowerShell stdin under the documented sandbox restrictions. Confirmed default UID/GID 10001 and /workspace on every image, and no remaining manual containers after finally cleanup. The C++ starter strips a trailing carriage return for Windows CRLF input. JavaScript syntax checks passed. No npm packages were installed.
- Task 3 (2026-11-15): runCode validates language/code/stdin, creates one non-root container per request, and removes it in finally. Network is disabled; memory and swap are equal; CPU/PID limits, read-only root, bounded executable /tmp, all capabilities dropped, no-new-privileges, init, and disabled Docker logging are set at creation. All limits live in config/sandbox.js with documented env overrides. Shared loadEnv.js lets the standalone demo read sandbox settings without requiring MongoDB config or a database connection.
- Source delivery uses an in-memory tar of trusted filenames, base64-encoded and split into small data arguments to a fixed non-root exec pipeline. No host files or Windows bind mounts are needed. Direct Docker archive upload rejects a read-only root even for the tmpfs, and hijacked stdin EOF is unreliable over Windows named pipes; argument-based archive delivery avoids both issues without weakening ReadonlyRootfs. Source/stdin and compiler output use the single bounded /tmp tmpfs. Language commands now use relative source filenames with /tmp as the working directory. Program stdin comes from a fixed file redirection, preserving bytes and EOF without shell interpolation.
- Compilation and execution use separate Docker exec calls and demultiplexed streams. One output byte budget covers stdout/stderr across both phases. Overflow kills the container and returns compile_error/runtime_error for the current phase; the five-status contract has no output_limit value. The host wall-clock deadline covers container startup, source delivery, compile, and execution and kills the whole container. durationMs includes setup and finally cleanup. Docker OOM events detect actual memory kills, including exec children; exit code 137 alone is not treated as OOM. Invalid requests and Docker failures throw; execution failures return the result contract.
- Manual verification: sandbox:demo produced three successful Hello, Ada! greetings with exit code 0, a C++ compile_error with compiler stderr, and a Python infinite-loop timeout around 10 seconds with exit code 137. Additional terminal runs confirmed runtime_error with separate stdout/stderr, output truncation at 65536 bytes, and memory_limit on an actual allocation OOM. No labeled sandbox containers remained after cleanup. Installed latest stable dockerode 5.0.1 and tar-stream 3.2.2 after npm view checks; installation audit reported zero vulnerabilities.
