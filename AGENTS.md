# RunBox: Agent Instructions

Read this file and `docs/PROJECT_PLAN.md` before every task.

## Tech stack
- Database: MongoDB (Mongoose)
- Backend: Node.js + Express
- Frontend: React (Vite) + Tailwind CSS
- Sandbox: Docker, controlled with `dockerode`
- Language: plain JavaScript only. NO TypeScript. ES modules everywhere.
- Structure: monorepo with `/server` and `/client`

## Package rule
- Always install the LATEST stable version of every package (check with `npm view <pkg> version`).
- Follow the current official docs for each package (especially Tailwind CSS and Vite setup).
- At the end of each task, list the package versions you installed.

## Code style: keep it simple
- Write simple, easy-to-understand code. A beginner should be able to read it.
- Do NOT write complex or clever code. Prefer the plain, obvious way over the short, smart way.
- Use clear, descriptive names for variables and functions (e.g. `userSnippets`, not `us`).
- Keep functions small and focused on one job.
- Avoid deeply nested logic, long one-liners, and unnecessary abstractions or design patterns.
- Do not over-engineer. Build only what the task asks for.
- Add short comments only where something is not obvious.
- If a simple approach and a "better" complex approach both work, choose the simple one.

## Backend conventions
- Layering: routes -> controllers -> services -> models
- Central error handler, `AppError` class, async handler wrapper
- Validate all inputs; never trust client data
- Config via `.env` (keep `.env.example` updated)
- Language support is config-driven in `server/src/config/languages.js`: adding a language = one config entry + one Dockerfile

## Frontend conventions
- All API calls use axios with async/await through one shared instance. No `.then/.catch` chains.
- All user-facing messages use react-hot-toast.
- Styling uses Tailwind CSS utility classes.
- Theming: light and dark themes switched with a `data-theme` attribute on the App root. Orange-based palette.
- Define ALL color tokens (primary, secondary, background, surface, card, text, text-muted, border, success, warning, danger, etc.) as CSS variables in `client/src/index.css`, one set per theme, and expose them to Tailwind through its theme configuration so utilities like `bg-card` and `text-primary` work.
- Components may use ONLY these token-based utilities for color. NO hardcoded colors: no hex values, no arbitrary color values, and no default Tailwind palette colors like `bg-orange-500`.
- Do not use `dark:` variants. The tokens change with `data-theme`, so components stay theme-agnostic.
- After finishing each code file, briefly explain the main thing implemented and any tricky code.

## Sandbox security rules (never weaken these)
- One throwaway container per run, always removed in a `finally` block
- NetworkMode none
- Memory, CPU and PID limits
- Read-only root filesystem (small tmpfs only for compile output)
- CapDrop ALL, no-new-privileges, non-root user
- Hard wall-clock timeout and output size cap
- Never run user code on the host

## When finishing a task
Do not create test files or test folders, or write automated tests. Verify behavior manually instead.

1. Give a short summary of what was built.
2. Give the exact commands to run it.
3. Explain how to verify it works.
4. Tick the task in `docs/PROJECT_PLAN.md` and log important decisions there.
