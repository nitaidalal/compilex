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
runbox/
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
- [ ] 2. Sandbox images and language config
- [ ] 3. Execution engine (dockerode)
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
