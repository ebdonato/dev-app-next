# Task Manager

A small task-management app built as a technical challenge with **Next.js 15 (App Router)** and **tRPC**. Tasks are kept **in server memory**: there's no database. The list is **rendered on the server** on first load, and everything else (create, edit, delete, loading more) goes through type-safe tRPC procedures.

The goal was "less is more": a simple app that's still cleanly structured, validated and tested.

## Features

- **CRUD:** create, list, edit and delete tasks (`id`, `titulo`, `descricao`, `dataCriacao`).
- **SSR list:** the first page of tasks is in the initial HTML, with no client request on first load.
- **Validation:** the same Zod schema runs in the form (before submit) and on the server (on every procedure). A task can't be created without a title.
- **Feedback:** success and error messages, loading states, and clear backend errors (e.g. "Task <id> not found.").
- **Infinite scroll:** more tasks load as you scroll, with a keyboard-accessible "Load more" fallback.

## Tech stack

| | Version |
|---|---|
| Next.js (App Router) | 15.5 |
| React | 19.1 |
| TypeScript (`strict`) | 5 |
| tRPC (`@trpc/server`, `@trpc/client`, `@trpc/tanstack-react-query`) | 11 |
| TanStack Query | 5 |
| Zod | 4 |
| Vitest (dev only) | 5 |

**Why Next.js 15 and not 16?** The challenge explicitly asks for Next.js v15, so the project is pinned to the latest 15.x release.

Styling is plain CSS Modules, with no UI or CSS framework.

## Getting started

**Prerequisites:** Node.js **22.12 or newer** (required by Vitest 5) and npm.

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

```bash
npm test             # unit and integration tests (Vitest)
npm run lint         # ESLint
npm run typecheck    # TypeScript, no emit
npm run build && npm start   # production build and server
```

No environment variables or external services are needed.

### Development seed

In development (`npm run dev`) the store starts with **25 fictitious tasks**, so the list and infinite scroll can be tried right away (page size 10, so 3 pages). Tests and production (`npm start`) start with an empty store.

## Architecture

```
Browser ──(HTTP, batched)──► /api/trpc/[trpc]  (route handler)
                                   │
Server Component (page.tsx) ───────┤  direct in-process call, no HTTP
                                   ▼
                             taskRouter      thin: validate input → call repository → map errors
                                   ▼
                             taskRepository  business rules + in-memory Map
```

- **First load:** the home page (a server component) prefetches the first page of `task.list` in-process and passes it to the client through TanStack Query hydration. The client list reads that cache, so it makes no request on first load.
- **After that:** client components call tRPC over HTTP (`httpBatchLink`) and invalidate the list after each mutation.

### Project structure

```
src/
├── app/                       # Routes (App Router)
│   ├── page.tsx               # Task list (SSR prefetch + hydrate)
│   ├── tasks/new/             # Create page
│   ├── tasks/[id]/edit/       # Edit page (loads the task on the server)
│   ├── api/trpc/[trpc]/       # tRPC HTTP endpoint
│   └── layout.tsx, loading.tsx, error.tsx, not-found.tsx
├── features/tasks/            # Everything about tasks
│   ├── task.schema.ts         # Zod schemas + types (single source of truth)
│   ├── task.repository.ts     # In-memory store, CRUD, pagination
│   ├── task.router.ts         # tRPC procedures
│   └── components/            # TaskList, TaskItem, TaskForm, create/edit wrappers
├── components/feedback/       # Global success/error messages
├── hooks/use-in-view.ts       # IntersectionObserver hook (infinite scroll)
├── lib/get-error-message.ts   # Any error → user-friendly text
└── trpc/                      # tRPC plumbing (init, router, client, server)
```

## Key decisions

| Decision | Why |
|---|---|
| Repository module behind a thin tRPC router | Business rules don't depend on tRPC or Next.js, and storage could be replaced by a database without touching the API or the UI. |
| Store kept on `globalThis` | Next.js dev hot reloads re-run modules; a plain module-level `Map` would lose its data. |
| One set of Zod schemas for server and form | The validation rules and messages can't drift between client and server. |
| `dataCriacao` as an ISO 8601 string | JSON-safe end to end (server → RSC → client), so no serialization transformer such as `superjson` is needed. |
| Keyset (cursor) pagination on `dataCriacao` + `id` | Stable while tasks are deleted (no skipped or duplicated items), unlike offset pagination. |
| SSR prefetch is **awaited** and pages are dynamic | The HTML must contain the tasks, and the data changes at runtime, so no build-time snapshot. |
| Stable `HydrationBoundary` + `dehydrate` | Avoids relying on tRPC's `unstable_` hydration helper. |
| Global feedback provider in the root layout | One mechanism for every message, and messages survive navigation (e.g. "Task created." after redirecting to the list). |
| `useState` form without a form library | The form is small; this keeps dependencies minimal and meets the "hooks" requirement directly. |
| No optimistic updates | Simpler and always consistent with the server; the list refetches after each mutation. |

The full reasoning, step by step, is in [`docs/implementation-plan.md`](docs/implementation-plan.md).

## API reference

All procedures live under `task.*` at `/api/trpc`.

| Procedure | Type | Input | Output | Errors |
|---|---|---|---|---|
| `task.list` | query | `{ limit?: 1–50 (default 10), cursor?: { dataCriacao, id } \| null }` | `{ items: Task[], nextCursor: { dataCriacao, id } \| null }`, newest first | `BAD_REQUEST` |
| `task.byId` | query | `{ id: uuid }` | `Task` | `BAD_REQUEST`, `NOT_FOUND` |
| `task.create` | mutation | `{ titulo: string (1–120), descricao?: string (≤ 1000) }` | `Task` | `BAD_REQUEST` |
| `task.update` | mutation | `{ id: uuid, titulo, descricao? }` (full replace of the editable fields) | `Task` | `BAD_REQUEST`, `NOT_FOUND` |
| `task.delete` | mutation | `{ id: uuid }` | `{ id }` | `BAD_REQUEST`, `NOT_FOUND` |

```ts
type Task = {
  id: string;          // UUID, generated by the server
  titulo: string;      // required, trimmed
  descricao?: string;  // optional; empty becomes undefined
  dataCriacao: string; // ISO 8601 (UTC), set on creation, never changed
};
```

- **`BAD_REQUEST`:** invalid input. The error's `data.zodError` holds the field errors, e.g. `fieldErrors.titulo = ["Title is required."]`.
- **`NOT_FOUND`:** the task doesn't exist. Message: `Task <id> not found.`

## Testing

Vitest covers the backend and the shared logic, with no browser:

- **Schemas:** field rules, boundaries, trimming, defaults, cursor.
- **Repository:** CRUD, ordering, and pagination, including after deletions.
- **Router:** every procedure's success and error paths, through `createCaller`.
- **HTTP endpoint and error shaping:** the fetch handler, `zodError`, and `getErrorMessage` with real tRPC errors.

The UI (SSR, feedback, form validation, delete, infinite scroll) was verified manually in the browser against each step's acceptance criteria. End-to-end tests are a possible next step.

## Known limitations

- **In memory only:** data is lost when the server restarts.
- **Single process:** the store isn't shared between server instances, so serverless or multi-instance deployments would each see different data.
- **No authentication:** every visitor sees and edits the same tasks.
- **Dates are shown in UTC,** so the server and browser render identical text without hydration mismatches.

## Possible next steps

- Persistence (e.g. a database behind the same repository interface).
- Authentication and per-user tasks.
- Optimistic updates for snappier mutations.
- End-to-end tests (e.g. Playwright) for the UI flows.
- Showing dates in the viewer's local time zone.
