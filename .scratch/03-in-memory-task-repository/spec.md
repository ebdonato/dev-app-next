# Spec: In-memory task repository

Status: ready-for-agent
Plan step: 3 of 13 (see `docs/implementation-plan.md`, Step 3)
Depends on: Step 2 (task domain schemas)
Blocks: Step 5 (task router)

## Problem Statement

The case requires the backend to keep the task list **in memory**, with no database (R4), and every CRUD operation must behave predictably. That includes what happens when a task doesn't exist (R6) and how the list is paginated for infinite scroll (B1).

If storage and business rules live inside the tRPC procedures, they can't be tested without the API layer, the router gets fat, and swapping storage later means rewriting the API. There's also a Next.js-specific pitfall: in development, hot reloading re-evaluates modules, so a plain module-level `Map` would silently empty itself on every code change.

## Solution

A small, framework-agnostic repository module owns the in-memory store and all task business rules: id and timestamp generation, ordering, keyset pagination, and not-found signaling. It exposes plain functions with plain inputs and outputs and knows nothing about Next.js, React or tRPC. The store lives on `globalThis`, so it survives dev hot reloads. In development it's seeded with fictitious tasks, so the list and infinite scroll can be demoed right away.

## User Stories

1. As a user, I want a task I create to get a unique id automatically, so that I never have to provide one.
2. As a user, I want a task's creation date set automatically when I create it, so that I can see when it was added.
3. As a user, I want the newest tasks to appear first, so that what I just added is immediately visible.
4. As a user, I want tasks created at the exact same moment to still appear in a stable order, so that the list doesn't reshuffle between loads.
5. As a user, I want to load the list in pages, so that it stays fast even with many tasks.
6. As a user, I want no task skipped or shown twice while I scroll, even if I delete tasks in between, so that I can trust the list.
7. As a user, I want editing a task to keep its original creation date, so that the list order doesn't change when I fix a typo.
8. As a user, I want editing a task to keep its id, so that links to it keep working.
9. As a user, I want to clear a task's description by saving it empty, so that I can remove details I no longer need.
10. As a user, I want deleting a task to remove it from every later list request, so that deleted tasks never come back.
11. As a user, I want my tasks to survive code reloads while the dev server runs, so that I don't lose demo data every time a file changes.
12. As the candidate, I want "not found" signaled with return values (`null` / `false`) instead of exceptions, so that the router decides how to report it (as `NOT_FOUND`) and the repository stays framework-agnostic.
13. As the candidate, I want the repository to return copies of stored tasks, so that no caller can change stored data by mutating a returned object.
14. As the candidate, I want a `reset` function, so that every test starts from an empty store.
15. As the candidate, I want the store seeded automatically in development only, so that tests and production start empty and predictable.
16. As the candidate, I want the seed data to be obviously fictitious, so that the public repo contains no personal or sensitive information.
17. As the candidate, I want the repository to have no Next.js, React or tRPC imports, so that it can be unit-tested in isolation and replaced by a real database later without touching the API or UI.
18. As a reviewer, I want storage behind a small, explicit interface, so that I can see the separation of concerns between API and storage.
19. As a reviewer, I want the dev hot-reload workaround explained in a comment, so that the `globalThis` usage is clearly intentional.
20. As an AI agent implementing Step 5, I want the exact function names and return contracts documented, so that the router can be a thin mapping layer.

## Implementation Decisions

- **Module:** a task-repository module inside the tasks feature folder. It imports only types (and, if useful, cursor helpers) from the task-schema module (Step 2). It never imports Next.js, React or tRPC.
- **Public interface:**

  | Function | Input | Output | Not found |
  |---|---|---|---|
  | `create` | `CreateTaskInput` | `Task` | n/a |
  | `list` | `ListTasksInput` | `{ items: Task[], nextCursor: Cursor \| null }` | n/a |
  | `getById` | `id` | `Task \| null` | `null` |
  | `update` | `UpdateTaskInput` | `Task \| null` | `null` |
  | `remove` | `id` | `boolean` | `false` |
  | `reset` | none | nothing | n/a |
  | `seed` | none | nothing | n/a |

- **Inputs are trusted:** the repository receives already-validated, already-parsed values (validation happens at the tRPC boundary with the Step 2 schemas). It doesn't re-validate.
- **Storage:** a `Map<string, Task>` keyed by id, held on `globalThis` under a single namespaced key and created lazily on first access. Add a comment explaining why: Next.js dev hot reloads re-evaluate modules, and `globalThis` keeps one store per server process.
- **`create`:** generates `id` with `crypto.randomUUID()` and `dataCriacao` with the current time as an ISO 8601 UTC string. `descricao` is stored only when present, so absent stays absent.
- **`update`:** **full replace** of `titulo` and `descricao`. An absent `descricao` removes the description. `id` and `dataCriacao` are always preserved. Returns the updated task, or `null` if the id doesn't exist.
- **`remove`:** returns `true` if a task was removed, `false` if the id doesn't exist.
- **Ordering:** `dataCriacao` descending, then `id` descending as the tie-breaker. ISO 8601 strings in the single `toISOString` format compare correctly as plain strings. Add a short comment saying so.
- **Keyset pagination in `list`:**
  - Without a cursor, start from the newest task.
  - With a cursor `{ dataCriacao, id }`, return only tasks that sort strictly after it: an older `dataCriacao`, or the same `dataCriacao` with a smaller `id`.
  - Return at most `limit` items.
  - `nextCursor` is the `{ dataCriacao, id }` of the last returned item when more tasks remain, otherwise `null`. Check for more by looking at one item past the limit.
  - The cursor task doesn't need to still exist. Comparing by key, not by position, is what makes deletions safe.
  - Sorting the whole `Map` per call is fine at this scale. Keep it simple.
- **Copies:** every returned task is a shallow copy. Tasks are flat, so a spread is enough.
- **`reset`:** empties the store. Intended for tests (`beforeEach`).
- **`seed`:**
  - Inserts ~25 fictitious tasks, e.g. "Review sprint backlog", "Write release notes" (generic work-style titles, no real names or personal data).
  - Some have descriptions and some don't.
  - `dataCriacao` values are staggered (e.g. one minute apart), so the order is deterministic.
  - Runs **automatically on first store initialization only when `NODE_ENV === 'development'`**. Never in tests (`NODE_ENV` is `test` under Vitest) and never in production.
  - Seeding must not run twice on hot reload, because it's tied to store creation.
- **Concurrency:** Node.js runs this on a single thread, and every operation is synchronous, so no locking is needed. State is per process. That limitation is documented in the README (Step 13).

## Testing Decisions

- **Seam:** the repository's public functions. That's the highest seam below the API, and the one the router will use. Tests call `reset` in `beforeEach` and assert only on returned values: never on the internal `Map`, the `globalThis` key or sort internals.
- **Module tested:** the task-repository module, with co-located unit tests (Vitest, Node environment).
- **Cases to cover:**
  - `create`:
    - Returns a task with a UUID `id` and an ISO `dataCriacao`.
    - Two creates produce different ids.
    - An absent `descricao` stays absent.
  - `getById`:
    - Returns the created task.
    - Returns `null` for an unknown id.
  - `update`:
    - Changes `titulo` and `descricao`, and keeps `id` and `dataCriacao`.
    - Omitting `descricao` clears it.
    - Returns `null` for an unknown id.
  - `remove`:
    - Returns `true`, after which the task is no longer returned by `getById` or `list`.
    - Returns `false` for an unknown id.
  - Copies: mutating a returned task doesn't change what `getById` returns afterwards.
  - `list` ordering:
    - Newest first.
    - Tasks with equal `dataCriacao` are ordered by `id` descending.
    - Use fake timers or controlled clock values to create ties and a known order.
  - `list` pagination:
    - With 25 tasks and `limit` 10, walking `nextCursor` yields 10, 10 and 5 items.
    - The final `nextCursor` is `null`.
    - The union of the pages equals all tasks, with no duplicates.
  - Pagination after deletion: delete the task used as the cursor (and another task on an earlier page), then request the next page. No task is skipped or repeated.
  - Empty store: `list` returns `{ items: [], nextCursor: null }`.
  - `seed`: inserts the expected number of tasks, and `list` returns them in the documented order.
- **Prior art:** the schema tests from Step 2 (same runner, same co-location convention).

## Out of Scope

- Input validation (Step 2 schemas, enforced in Step 5).
- Mapping not-found results to `TRPCError` (Step 5).
- Persistence across restarts, multi-instance consistency and databases.
- Search, filtering or sorting options beyond the fixed newest-first order.
- Optimistic concurrency or versioning.

## Further Notes

- The functions are synchronous. If storage became a database later, they'd become async. That's a localized change at the router call sites, and that's acceptable.
- Every way the seed can be disabled must keep tests deterministic. Because seeding is gated on `NODE_ENV === 'development'`, Vitest runs never see seed data.
- Name the module's exports so the router reads naturally, e.g. calls like "repository.create(input)". Whether the functions are grouped under one exported object or exported individually is the implementer's choice, as long as the names above are kept.
