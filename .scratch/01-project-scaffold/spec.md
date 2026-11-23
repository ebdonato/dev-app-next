# Spec: Project scaffold and tooling

Status: ready-for-agent
Plan step: 1 of 13 (see `docs/implementation-plan.md`, Step 1)
Blocks: Steps 2 (task domain schemas) and 4 (tRPC server foundation)

## Problem Statement

The repository holds only agent configuration and the implementation plan. There is no application yet. Before any task-manager feature can be built, the candidate needs a runnable Next.js 15 project with the agreed stack installed, and one-command checks (lint, typecheck, test, build) that every later step can rely on.

The repo will be **public** and reviewed by evaluators. The starting point must therefore be clean: no boilerplate noise, no unused dependencies, no confidential case material and no sensitive data.

## Solution

A minimal, empty Next.js 15 App Router project in TypeScript (strict). It includes the runtime dependencies that later steps need (tRPC, TanStack Query, Zod, `server-only`) and a Vitest setup for backend tests. Four green npm scripts act as the quality gate for the rest of the project. The home page renders a placeholder heading only, and everything else from the default template is removed.

## User Stories

1. As the candidate, I want to start the app with a single `npm run dev`, so that I can iterate on features immediately.
2. As the candidate, I want the project to use Next.js 15.x specifically, so that it matches the version the case requires.
3. As the candidate, I want TypeScript in strict mode from the first commit, so that type errors are caught early and the tRPC end-to-end typing is fully effective.
4. As the candidate, I want the App Router with a `src/` directory, so that the folder structure matches the target architecture in the plan.
5. As the candidate, I want the `@/*` import alias configured, so that imports stay short and stable as files move.
6. As the candidate, I want tRPC, TanStack Query, Zod and `server-only` installed up front, so that later steps add code, not setup.
7. As the candidate, I want no Tailwind or other styling framework, so that the dependency list stays minimal, in line with "less is more".
8. As the candidate, I want the default boilerplate (demo page content, demo assets, demo styles) removed, so that the repo contains only code I wrote and can explain.
9. As the candidate, I want `npm run lint` to work, so that code style issues are caught consistently.
10. As the candidate, I want `npm run typecheck` (no emit), so that I can check types without a full production build.
11. As the candidate, I want `npm test` to run Vitest and pass even before any test exists, so that the test gate is green from day one and later steps only add test files.
12. As the candidate, I want Vitest to resolve the `@/*` alias the same way Next.js does, so that tests import modules exactly like the app does.
13. As the candidate, I want `npm run build` to succeed, so that I know the project is deployable at every step.
14. As the candidate, I want the existing `.gitignore` entries kept when the Next.js entries are merged in, so that the local reference PDFs never reach the public repo.
15. As the candidate, I want `node_modules`, `.next`, env files and other build output ignored, so that no generated or sensitive files get committed.
16. As the candidate, I want the required Node.js version declared in `package.json`, so that reviewers know which runtime to use.
17. As a reviewer, I want a fresh clone to install and run with standard npm commands, so that I can evaluate the work without guesswork.
18. As a reviewer, I want a small, intentional dependency list, so that I can see the candidate made deliberate choices.
19. As an AI agent working on later steps, I want `AGENTS.md` to list Vitest as an allowed dev dependency, so that the documented principles match the actual toolchain.
20. As an AI agent working on later steps, I want stable script names (`dev`, `build`, `start`, `lint`, `typecheck`, `test`), so that every spec can reference the same quality gate.

## Implementation Decisions

- **Scaffold tool:** `create-next-app` pinned to major version 15, with TypeScript, ESLint, App Router, a `src/` directory, Turbopack for dev, the `@/*` import alias, npm, the empty template, no Tailwind and git initialization disabled. All flags are passed explicitly, so no prompts depend on saved local preferences.
- **Non-empty folder:** the repository root already holds `AGENTS.md`, `docs/`, `.scratch/` and `.gitignore`, and `create-next-app` may refuse to scaffold into a folder with conflicting files. Generate the project in a temporary directory **outside** the repo, then move the generated files into the root. Never overwrite the existing `AGENTS.md`, `docs/` or `.scratch/`.
- **`.gitignore` merge:** append the generated Next.js ignore rules to the existing file. The existing PDF ignore rule and its comment must remain unchanged.
- **Package identity:** package name `dev-app-next`, `private: true`. Add an `engines` field requiring Node.js 20 or newer (current LTS lines).
- **Runtime dependencies (exact set):** `next` (15.x), `react` and `react-dom` (versions chosen by the scaffold), `@trpc/server`, `@trpc/client`, `@trpc/tanstack-react-query` (v11), `@tanstack/react-query` (v5), `zod`, `server-only`. Nothing else.
- **Dev dependencies:** what the scaffold generates (TypeScript, types, ESLint config), plus `vitest`. No `vite-tsconfig-paths` plugin: the single `@/*` alias is configured directly in the Vitest config.
- **Scripts:** `dev`, `build`, `start`, `lint` (as generated by the scaffold), `typecheck` (TypeScript with no emit), `test` (Vitest in run mode, not watch mode).
- **Vitest configuration:** Node environment (later tests cover backend modules only, so no DOM). Test files are co-located as `*.test.ts`. `passWithNoTests` is enabled, so the gate is green before Step 2 adds the first tests. The `@/*` alias maps to `src/`.
- **TypeScript:** keep the generated config with `strict: true` confirmed. No extra compiler flags unless the build needs them.
- **Boilerplate cleanup:** the home page renders a single placeholder heading (e.g. "Task Manager"). Remove the default demo assets in `public/`, the demo CSS and the demo font setup if they're unused. Keep a minimal `globals.css` (basic reset and readable defaults) and the root layout with a proper `<title>`.
- **`AGENTS.md`:** in Engineering principles, update the scope bullet so the allowed libraries read "Next.js 15, tRPC, Zod, TanStack Query; Vitest (dev-only)".
- **No application code:** no tRPC setup, schemas or components. Those belong to Steps 2–12.

## Testing Decisions

- **Seam:** the four npm scripts (`lint`, `typecheck`, `test`, `build`) are the only seam for this step. It's the highest one available: it checks the project as a whole, the way a reviewer or CI would, rather than poking at individual config files.
- **What makes a good test here:** checks that observe external behavior (a command exits successfully, a page responds) rather than asserting on the contents of config files.
- **Verification checklist** (run from a clean install, `npm ci`):
  - `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` all exit with code 0.
  - `npm run dev` serves the home page with the placeholder heading and no errors in the terminal or browser console.
  - The installed `next` version is 15.x (`npm ls next`).
  - `git status` shows no `node_modules`, `.next` or env files, and `git ls-files docs` lists no PDFs.
- **Modules tested:** none yet. Step 2 adds the first unit tests (Zod schemas) on top of this setup.
- **Prior art:** none in the codebase. This step establishes the convention: Vitest, co-located `*.test.ts`, Node environment.

## Out of Scope

- Any tRPC, schema, repository or UI code (Steps 2–12).
- Styling beyond a minimal readable `globals.css` (layout and styling come in Step 7).
- Browser or end-to-end testing tools (Playwright, Testing Library, jsdom).
- CI pipelines, deployment configuration, Docker.
- Prettier or other formatters beyond what the scaffold generates.
- Creating the GitHub remote and pushing (Step 13).

## Further Notes

- The case says "use the latest versions" but also explicitly "NextJS (v15)". Next.js 16 exists at the time of writing, so pinning major 15 is deliberate; the README (Step 13) should say why.
- Turbopack is enabled for `next dev` only. Production builds use the default bundler for Next.js 15.
- Commit the scaffold as one commit, so the history clearly separates the generated baseline from hand-written code.
