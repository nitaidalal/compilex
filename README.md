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

Backend layers live in `server/src/{routes,controllers,services,models}`. Configuration, shared middleware, and utilities have separate folders. Sandbox Dockerfiles will live in `server/sandbox/`. Future work and decisions are tracked in [the project plan](docs/PROJECT_PLAN.md).
