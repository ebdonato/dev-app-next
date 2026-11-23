# Implementation Plan: Task Manager (Part 2, Practical Challenge)

A simple but complete task-management app built with **Next.js 15 (App Router)** and **tRPC**. The task list is kept **in memory** on the server.

This plan breaks the work into small, ordered steps. **Each step is meant to become its own spec** (see `docs/agents/issue-tracker.md`: `.scratch/<feature-slug>/spec.md`). Every step lists its goal, scope, deliverables, acceptance criteria and dependencies, so a spec can be written from it directly.

> Guiding rule (from `AGENTS.md`): **as simple as possible, without giving up clean code and good design.** When in doubt, cut scope, not quality.

---

## 1. Requirements recap

| # | Requirement (from the case) | Covered by |
|---|---|---|
| R1 | Next.js project on the latest version (v15) | Step 1 |
| R2 | tRPC configured so the frontend consumes the backend endpoints | Steps 4, 6 |
| R3 | Task model: `id` (unique, auto), `titulo` (required string), `descricao` (optional string), `dataCriacao` (timestamp) | Step 2 |
| R4 | CRUD via tRPC: create, list, update, delete | Steps 3, 5 |
| R5 | Tasks cannot be created without a title | Steps 2, 5, 10 |
| R6 | Meaningful errors (e.g. updating a task that does not exist) | Step 5 |
| R7 | List page pre-loaded with **SSR** | Step 8 |
| R8 | Simple list layout | Step 8 |
| R9 | Delete from the list, with visual feedback (success/error) | Step 9 |
| R10 | Create/edit form using functional components and hooks | Steps 10, 11 |
| R11 | Form validation (e.g. block submit when the title is empty) | Step 10 |
| R12 | Error messages from both backend and frontend logic | Steps 7, 9, 10, 11 |
| R13 | Loading, success and failure states considered in the UX | Steps 7–12 |
| B1 | *(Bonus)* Infinite scroll on the list page | Step 12 |
| B2 | *(Bonus)* Comments on key decisions + README | Step 13 (and inline throughout) |
| D1 | Delivered as a **public GitHub repo**, no sensitive data, fictitious data only | Step 13 |

---

## 2. Technical decisions

| Topic | Decision | Rationale |
|---|---|---|
| Framework | Next.js **15.x** (latest 15 release), App Router, React 19, TypeScript `strict` | The case asks for v15 explicitly. App Router gives server components for SSR. |
| API layer | **tRPC v11** with `@trpc/server`, `@trpc/client`, `@trpc/tanstack-react-query` | The current official integration for TanStack Query and the App Router. |
| Data fetching | **TanStack Query v5** | Required by the tRPC React integration. It provides cache, mutations, infinite queries and hydration. |
| Validation | **Zod**, with schemas shared by the server and the form | One definition of what a valid task is (R5, R11). |
| Storage | In-memory `Map`, held in a `globalThis` singleton, behind a small repository module | Meets "in memory, no database". The singleton survives dev hot reloads. The repository boundary keeps storage swappable. |
| IDs | `crypto.randomUUID()` | Built in, unique, no dependency. |
| `dataCriacao` | Stored and sent as an **ISO 8601 string** (UTC) | A timestamp that serializes as-is across server → RSC → client hydration, so no `superjson` transformer is needed. Formatted for display only in the UI. |
| Pagination | **Cursor-based (keyset)**, ordered by `dataCriacao` desc then `id` | Works naturally with `useInfiniteQuery` (B1), and deletions don't cause skipped or duplicated items, unlike offsets. |
| SSR strategy | The server component prefetches the first page into a request-scoped `QueryClient` and hydrates it on the client | The HTML arrives with the tasks already rendered (R7). The client then takes over for mutations and scrolling. |
| Rendering mode | List and edit pages are **dynamic** (rendered per request) | Data changes at runtime. A static prerender at build time would freeze the list. |
| Styling | Plain **CSS Modules** plus a small `globals.css` | "No elaborate design needed." Zero extra dependencies. |
| User feedback | One `FeedbackProvider` (context + hook) rendered in the root layout, with an `aria-live` region | One mechanism for every success/error message. It survives client navigation, e.g. "Task created" shown after redirecting to the list. |
| Testing | **Vitest** (dev-only) for the repository and the router (`createCaller`) | Covers the business rules (R4–R6) cheaply, with no browser. UI is checked manually against the acceptance criteria. |
| Language | Code, comments and docs in English. Task field names stay as the case specifies (`titulo`, `descricao`, `dataCriacao`). | Matches `AGENTS.md`. |

**Known limitation (documented in the README):** in-memory state lives in a single server process. It is lost on restart and not shared across serverless instances. That is acceptable for this case.

---

## 3. Target architecture

```
Browser ──(HTTP, batched)──► /api/trpc/[trpc] (route handler)
                                  │
Server Component (page.tsx) ──────┤  (direct call, no HTTP, via createTRPCOptionsProxy)
                                  ▼
                            taskRouter (thin: validate input → call repository → map errors)
                                  ▼
                            taskRepository (business rules + in-memory Map)
```

### Folder structure (target)

```
src/
├── app/
│   ├── layout.tsx                 # Root layout: providers, header, feedback region
│   ├── page.tsx                   # Task list (SSR prefetch + hydrate)
│   ├── loading.tsx / error.tsx / not-found.tsx
│   ├── tasks/
│   │   ├── new/page.tsx           # Create page
│   │   └── [id]/edit/page.tsx     # Edit page (SSR prefetch of one task)
│   └── api/trpc/[trpc]/route.ts   # tRPC HTTP endpoint
├── features/tasks/
│   ├── task.schema.ts             # Zod schemas + inferred types (single source of truth)
│   ├── task.repository.ts         # In-memory store + CRUD + pagination
│   ├── task.router.ts             # tRPC procedures for tasks
│   └── components/
│       ├── task-list.tsx          # Client: infinite query, renders items
│       ├── task-item.tsx          # Client: one task + delete action
│       └── task-form.tsx          # Client: shared create/edit form
├── components/feedback/           # FeedbackProvider + useFeedback + FeedbackRegion
├── hooks/use-in-view.ts           # IntersectionObserver hook (infinite scroll)
└── trpc/
    ├── init.ts                    # initTRPC, context, base procedure, error formatter
    ├── router.ts                  # appRouter = { task: taskRouter }, AppRouter type
    ├── query-client.ts            # makeQueryClient (shared by server and client)
    ├── client.tsx                 # TRPCReactProvider, useTRPC (client-only)
    └── server.tsx                 # trpc options proxy, getQueryClient, HydrateClient (server-only)
```

The task code is grouped **by feature** (`features/tasks`), and the generic tRPC plumbing stays in `trpc/`. That's enough structure to read well without layering ceremony.

---

## 4. Steps

Order and dependencies at a glance:

| Step | Title | Depends on | Phase |
|---|---|---|---|
| 1 | Project scaffold and tooling | — | Foundation |
| 2 | Task domain schemas | 1 | Backend |
| 3 | In-memory task repository | 2 | Backend |
| 4 | tRPC server foundation | 1 | Backend |
| 5 | Task router (CRUD, validation, errors) | 3, 4 | Backend |
| 6 | Client and server tRPC wiring | 5 | Integration |
| 7 | App shell and feedback system | 6 | Frontend |
| 8 | Task list page with SSR | 6, 7 | Frontend |
| 9 | Delete from the list, with feedback | 8 | Frontend |
| 10 | Shared task form component | 2, 7 | Frontend |
| 11 | Create and edit pages | 6, 10 | Frontend |
| 12 | Infinite scroll (bonus) | 8, 9 | Bonus |
| 13 | Documentation, final QA and delivery | all | Delivery |

Steps 2 and 4 can run in parallel, and so can 9 and 10–11.

---

### Step 1: Project scaffold and tooling

**Goal:** a clean, runnable Next.js 15 + TypeScript project with the agreed dependencies and scripts.

**Scope**
- Create the app with `create-next-app` pinned to v15: TypeScript, App Router, `src/` directory, ESLint, **no Tailwind**, import alias `@/*`.
- Install runtime deps: `@trpc/server`, `@trpc/client`, `@trpc/tanstack-react-query`, `@tanstack/react-query`, `zod`, `server-only`.
- Install dev deps: `vitest`. Add the scripts `test` and `typecheck` (`tsc --noEmit`).
- Remove the boilerplate page content and assets.
- Merge the Next.js `.gitignore` entries (`node_modules`, `.next`, `.env*`, …) into the existing `.gitignore` without losing the current entries.
- Add Vitest to the library list in `AGENTS.md` (dev-only).

**Deliverables:** `package.json`, `tsconfig.json` (`strict: true`), `next.config.ts`, `eslint` config, `vitest.config.mts`, an empty `src/app` shell.

**Acceptance criteria**
- `npm run dev` serves a blank home page with no errors.
- `npm run build`, `npm run lint`, `npm run typecheck` and `npm test` all pass. `npm test` may report "no tests".
- `next` resolves to a 15.x version.
- The local reference PDFs are still ignored.

**Depends on:** none.

---

### Step 2: Task domain schemas

**Goal:** a single source of truth for the task's shape and validation rules.

**Scope**: `src/features/tasks/task.schema.ts`
- `taskSchema`: `id` (uuid string), `titulo` (string, trimmed, 1–120 chars), `descricao` (optional string, trimmed, max 1000 chars, empty string normalized to `undefined`), `dataCriacao` (ISO datetime string).
- `createTaskInput`: `titulo`, `descricao?`.
- `updateTaskInput`: `id`, plus `titulo` and `descricao?`. Full replace of the editable fields, which keeps it simple: the form always sends both.
- `taskIdInput`: `{ id }`.
- `listTasksInput`: `{ limit (1–50, default 10), cursor? }`, where the cursor is the keyset `{ dataCriacao, id }` of the last item seen.
- Export the inferred TS types (`Task`, `CreateTaskInput`, …). There are no hand-written duplicate types.
- Error messages are written for users, e.g. "Title is required.", because the form shows them directly.

**Acceptance criteria**
- Unit tests: an empty or whitespace-only `titulo` is rejected with "Title is required."; over-length values are rejected; an empty `descricao` becomes `undefined`; valid input passes.
- No other file declares a task type by hand.

**Depends on:** Step 1.

---

### Step 3: In-memory task repository

**Goal:** encapsulate storage and the task business rules behind a small, framework-agnostic module.

**Scope**: `src/features/tasks/task.repository.ts`
- Store: a `Map<string, Task>` held on `globalThis`, so Next.js dev hot reloads don't reset it. Add a short comment explaining why.
- Functions, all with plain inputs and outputs and no tRPC imports:
  - `create(input) → Task` (generates `id` and `dataCriacao`)
  - `list({ limit, cursor }) → { items: Task[]; nextCursor: Cursor | null }`, ordered newest first (`dataCriacao` desc, `id` desc as the tie-breaker)
  - `getById(id) → Task | null`
  - `update(input) → Task | null` (`null` when the task is not found; `id` and `dataCriacao` are preserved)
  - `remove(id) → boolean` (`false` when not found)
- `seed()` / `reset()` helpers: `reset()` is for test isolation. `seed()` loads ~25 **fictitious** tasks in development only, so the list and infinite scroll can be demoed. Its behavior is documented in the README.
- Return copies, so callers can't mutate stored objects.

**Acceptance criteria**
- Unit tests cover every function, including:
  - pagination across pages, with no duplicates and no gaps
  - pagination still correct after deleting an item that was on a previous page
  - `update` and `remove` on unknown ids return `null` / `false`
  - `update` keeps `id` and `dataCriacao`
- The module has no dependency on Next.js, React or tRPC.

**Depends on:** Step 2.

---

### Step 4: tRPC server foundation

**Goal:** the generic tRPC infrastructure and the HTTP endpoint.

**Scope**
- `src/trpc/init.ts`: `initTRPC` with an (empty for now) `createTRPCContext`, and exports for `router`, `publicProcedure` and `createCallerFactory`. Add an **error formatter** that attaches flattened Zod field errors (`zodError`) to the error shape, so the form can show messages per field.
- `src/trpc/router.ts`: `appRouter` (temporarily with a `health` query) and `export type AppRouter`.
- `src/app/api/trpc/[trpc]/route.ts`: `fetchRequestHandler` for `GET` and `POST`. Log unexpected errors server-side in development only.

**Acceptance criteria**
- `GET /api/trpc/health` returns a success payload.
- Invalid input returns a `BAD_REQUEST` whose payload includes `zodError` field errors.
- No secrets or env vars are required.

**Depends on:** Step 1.

---

### Step 5: Task router (CRUD, validation, errors)

**Goal:** expose the four CRUD operations, plus a fetch-by-id for the edit page, with meaningful errors.

**Scope**: `src/features/tasks/task.router.ts`, mounted as `task` in `appRouter`
- `task.list` (query): input `listTasksInput` → `{ items, nextCursor }`
- `task.byId` (query): input `taskIdInput` → `Task`, or `NOT_FOUND`
- `task.create` (mutation): input `createTaskInput` → `Task`
- `task.update` (mutation): input `updateTaskInput` → `Task`, or `NOT_FOUND`
- `task.delete` (mutation): input `taskIdInput` → `{ id }`, or `NOT_FOUND`
- The router stays **thin**: validate (Zod), call the repository, and turn `null`/`false` into `TRPCError({ code: 'NOT_FOUND', message: 'Task <id> not found.' })`.

**Acceptance criteria**
- Integration tests using `createCaller`:
  - create without a title → `BAD_REQUEST`
  - create → list contains the task
  - update an existing task → changed fields returned
  - update / delete / byId with an unknown id → `NOT_FOUND` with a clear message
  - delete → task no longer listed
- No business logic lives in the router beyond the error mapping.

**Depends on:** Steps 3, 4.

---

### Step 6: Client and server tRPC wiring

**Goal:** let client components call the API with hooks, and let server components prefetch data and hand it to the client.

**Scope**
- `src/trpc/query-client.ts`: `makeQueryClient()` with a sensible `staleTime` (e.g. 30 s) and dehydration settings that include pending queries.
- `src/trpc/client.tsx` (`'use client'`): `createTRPCContext<AppRouter>()` → `TRPCProvider` and `useTRPC`. `TRPCReactProvider` creates the `QueryClient` (a singleton in the browser, a fresh one per request on the server) and a `trpcClient` with `httpBatchLink` to `/api/trpc`.
- `src/trpc/server.tsx` (`import 'server-only'`):
  - `getQueryClient = cache(makeQueryClient)`
  - `trpc = createTRPCOptionsProxy({ ctx, router: appRouter, queryClient: getQueryClient })`, which calls the router directly with no HTTP round-trip
  - a `HydrateClient` component built on the **stable** `HydrationBoundary` + `dehydrate` (preferred over the `unstable_` helper)
- Wrap the root layout in `TRPCReactProvider`.

**Acceptance criteria**
- A throwaway check (removed afterwards) shows a server component prefetching `task.list` and a client component reading it through `useTRPC()` **with no client-side network request on first load**.
- Importing `trpc/server.tsx` from a client component fails the build (`server-only`).

**Depends on:** Step 5.

---

### Step 7: App shell and feedback system

**Goal:** a consistent layout and one reusable way to show loading, success and error states.

**Scope**
- `layout.tsx`: page title, a header with a link to the list and a "New task" button, a main container, and the minimal `globals.css`.
- `components/feedback/`: `FeedbackProvider` holds the message `{ type: 'success' | 'error', text }`. `useFeedback()` exposes `notifySuccess(text)` and `notifyError(text)`. `FeedbackRegion` renders the message with `role="status"` / `aria-live="polite"`, auto-dismisses success after ~4 s, and has a close button.
- A small `getErrorMessage(error)` helper that turns a tRPC or unknown error into a user-friendly string (prefers the server message, falls back to a generic one).
- Route-level `loading.tsx`, `error.tsx` (with a "Try again" reset) and `not-found.tsx`.

**Acceptance criteria**
- A success or error message triggered on one page is still visible after client-side navigation to another page.
- Screen readers announce messages (live region present).
- `error.tsx` renders when a server component throws, and recovers on retry.

**Depends on:** Step 6.

---

### Step 8: Task list page with SSR

**Goal:** the home page lists tasks, rendered on the server on first load.

**Scope**
- `app/page.tsx` (server component, dynamic): **await** the prefetch of the first page of `task.list` (as an infinite query), so the HTML contains the tasks. Then render `<HydrateClient><TaskList /></HydrateClient>`.
- `features/tasks/components/task-list.tsx` (client): `useSuspenseInfiniteQuery` (or `useInfiniteQuery`) over `trpc.task.list.infiniteQueryOptions(...)` with `getNextPageParam: (last) => last.nextCursor`. It renders a simple list.
- `task-item.tsx`: shows `titulo`, `descricao` (if any) and `dataCriacao` formatted with `Intl.DateTimeFormat`, plus "Edit" and "Delete" actions. Delete is wired in Step 9.
- An empty state ("No tasks yet", with a link to create one).

**Acceptance criteria**
- Viewing the page source (or loading with JS disabled) shows the task titles in the HTML.
- No client-side `task.list` request fires on the initial load.
- Tasks are ordered newest first, and dates display in a readable local format.
- The empty state shows when there are no tasks.
- `npm run build` marks the route as dynamic (ƒ), not static.

**Depends on:** Steps 6, 7.

---

### Step 9: Delete from the list, with feedback

**Goal:** remove a task straight from the list, with clear feedback.

**Scope**
- In `task-item.tsx`: `useMutation(trpc.task.delete.mutationOptions(...))`. Ask for confirmation with the native `confirm()`, which keeps it simple.
- While the mutation is pending, disable that item's button and show "Deleting…".
- On success: invalidate the `task.list` queries (`trpc.task.list.pathKey()`) and call `notifySuccess("Task deleted.")`.
- On error: `notifyError(getErrorMessage(error))`, e.g. when the task was already deleted elsewhere (`NOT_FOUND`).

**Acceptance criteria**
- Deleting removes the item and shows a success message.
- Deleting a task that no longer exists shows the backend's error message, and the list resyncs.
- Double-clicking doesn't fire two requests.

**Depends on:** Step 8.

---

### Step 10: Shared task form component

**Goal:** one form component that serves both create and edit, managed with hooks and validated before submit.

**Scope**: `features/tasks/components/task-form.tsx` (client)
- Props: `initialValues?`, `submitLabel`, `onSubmit(values) → Promise<void>`, `isSubmitting`.
- State is held in `useState` (fields + field errors). There's no form library, so the hooks requirement is met explicitly and nothing is added.
- On submit: validate with the **same Zod schema** (`createTaskInput`, `safeParse`) and show per-field messages. Don't call `onSubmit` when the form is invalid (R11).
- Shows backend field errors (from `zodError`) and general errors passed in by the parent.
- UX: label/input association, `aria-invalid` and `aria-describedby` on errors, focus on the first invalid field, a submit button disabled with "Saving…" while submitting, and a "Cancel" link back to the list.

**Acceptance criteria**
- Submitting with an empty or whitespace-only title shows "Title is required." and sends no request.
- Field errors clear as the user fixes the field.
- The component has no knowledge of tRPC. It only receives `onSubmit` (easy to reuse and test).

**Depends on:** Steps 2, 7.

---

### Step 11: Create and edit pages

**Goal:** the routes that use the form to create and update tasks.

**Scope**
- `app/tasks/new/page.tsx`: renders `TaskForm`, using a small client wrapper that calls `task.create`. On success: invalidate the list, `notifySuccess("Task created.")`, then `router.push('/')`.
- `app/tasks/[id]/edit/page.tsx` (server, dynamic): fetch the task via the server proxy, call `notFound()` if it doesn't exist, and pass the initial values to a client wrapper that calls `task.update`. On success: invalidate the list and that `byId` query, notify, then redirect.
- Backend errors (e.g. `NOT_FOUND` if the task was deleted meanwhile, or `BAD_REQUEST`) are shown in the form, and the user's input is kept.

**Acceptance criteria**
- Creating a task redirects to the list, where the new task appears first along with a success message.
- Editing pre-fills the form with the current values. Saving updates the list and keeps `dataCriacao`.
- `/tasks/<unknown-id>/edit` renders the not-found page.
- A failed save keeps the typed values and shows the error.

**Depends on:** Steps 6, 10.

---

### Step 12: Infinite scroll (bonus)

**Goal:** load more tasks automatically as the user scrolls.

**Scope**
- `hooks/use-in-view.ts`: a tiny `IntersectionObserver` hook returning `{ ref, inView }`, with cleanup on unmount.
- In `task-list.tsx`: a sentinel element after the last item. When it's in view, `hasNextPage` is true and nothing is already fetching, call `fetchNextPage()`.
- States: "Loading more…" while fetching, an inline error with a "Retry" button if a page fails, and a subtle "You've reached the end" at the end.
- Keep a "Load more" button as a fallback that's also accessible by keyboard.

**Acceptance criteria**
- With the dev seed (~25 tasks) and a page size of 10, scrolling loads pages 2 and 3, then shows the end message.
- No duplicate or missing tasks across pages, including after deleting an item mid-scroll.
- Only one in-flight request at a time.

**Depends on:** Step 8 (and Step 9 for the delete interaction).

---

### Step 13: Documentation, final QA and delivery

**Goal:** a self-explanatory, safe public repository.

**Scope**
- `README.md` (English):
  - what the app does
  - stack and versions
  - how to run it (`npm install`, `npm run dev`, `npm test`, `npm run build && npm start`)
  - architecture overview (the diagram from §3)
  - key decisions (a summary of §2)
  - API reference (procedures, inputs and errors)
  - known limitations (in-memory storage, single process)
  - possible next steps (persistence, auth, optimistic updates)
- Comments in the code where a decision isn't obvious (globalThis store, ISO date, keyset cursor, awaited SSR prefetch, dynamic rendering). Don't comment the obvious.
- Final QA pass over every acceptance criterion and the requirements table (§1). Lint, typecheck, test and build must be green.
- Safety check: no `.env` files, tokens or personal data, and only fictitious seed data. The local reference PDFs are not tracked (`git ls-files docs`).
- Create the public GitHub repo, push, and confirm a fresh clone runs by following only the README.

**Acceptance criteria**
- Someone following only the README can run the app and the tests.
- Every row of the requirements table is checked off.
- The repo contains nothing sensitive.

**Depends on:** all previous steps.

---

## 5. Testing strategy

| Level | What | Tool |
|---|---|---|
| Unit | Zod schemas (Step 2), repository rules and pagination (Step 3) | Vitest |
| Integration | Router procedures end to end via `createCaller`, including error codes (Step 5) | Vitest |
| Manual | SSR in page source, feedback messages, form validation, infinite scroll (Steps 8–12) | Browser, following each step's acceptance criteria |

End-to-end browser tests (e.g. Playwright) are deliberately **out of scope** to keep the project simple. They're listed as a next step in the README.

## 6. Out of scope

Persistence/database, authentication, multi-user concurrency, optimistic updates, i18n, elaborate styling, deployment pipelines.
