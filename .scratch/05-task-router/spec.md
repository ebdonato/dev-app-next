# Spec: Task router (CRUD, validation, errors)

Status: ready-for-agent
Plan step: 5 of 13 (see `docs/implementation-plan.md`, Step 5)
Depends on: Steps 3 (in-memory task repository) and 4 (tRPC server foundation)
Blocks: Step 6 (client and server tRPC wiring)

## Problem Statement

The task rules and the in-memory store exist (Step 3), and so does the generic tRPC infrastructure (Step 4), but the frontend still has nothing to call. The case requires the four CRUD operations to be exposed **via tRPC**, tasks never created without a title, and operations failing with **meaningful errors**, for example when updating a task that doesn't exist. Without a typed task API, no page can list, create, edit or delete tasks.

## Solution

A `task` sub-router mounted on the app router, with five procedures: `task.list`, `task.byId`, `task.create`, `task.update` and `task.delete`. Every procedure validates its input with the shared Zod schemas from Step 2 and calls the repository. The only translation it does is turning "not found" results into a typed `NOT_FOUND` error with a readable message. Validation failures come back as `BAD_REQUEST` with per-field `zodError` details (from the Step 4 error formatter). The frontend therefore gets end-to-end types and errors it can show directly.

## User Stories

1. As the frontend developer, I want a `task.list` query, so that the list page can show tasks.
2. As the frontend developer, I want `task.list` to accept a `limit` and an optional `cursor`, so that the list can load page by page (infinite scroll, Step 12).
3. As the frontend developer, I want `task.list` to return `{ items, nextCursor }`, with `nextCursor` set to `null` on the last page, so that I know when to stop loading.
4. As the frontend developer, I want `task.list` to default to 10 items per page, so that callers don't have to pass a limit.
5. As the frontend developer, I want a `task.byId` query, so that the edit page can load the task being edited.
6. As the frontend developer, I want `task.byId` to fail with `NOT_FOUND` for an unknown id, so that the edit page can show the not-found UI.
7. As the frontend developer, I want a `task.create` mutation that returns the created task, so that I can confirm the result to the user.
8. As a user, I want a task without a title to be rejected by the server too, not just by the form, so that invalid data can never reach the list.
9. As a user, I want a whitespace-only title treated as empty, so that I can't create blank-looking tasks.
10. As the frontend developer, I want validation errors to carry per-field messages (`zodError`), so that the form can show "Title is required." next to the right field.
11. As the frontend developer, I want a `task.update` mutation that returns the updated task, so that the UI can show the saved values.
12. As a user, I want editing a task to keep its id and creation date, so that the task's identity and history stay intact.
13. As a user, I want a clear "Task <id> not found." error when I save a task that was deleted meanwhile, so that I understand why the save failed.
14. As the frontend developer, I want a `task.delete` mutation that returns `{ id }`, so that I know which task was removed.
15. As a user, I want deleting a task that no longer exists to fail with a clear message, so that I'm not told it succeeded when it didn't.
16. As the frontend developer, I want inputs and outputs inferred from the router type, so that a contract change breaks the build instead of failing at runtime.
17. As a reviewer, I want the router to be thin and readable, so that I can see the separation between the API layer and the business rules at a glance.
18. As a reviewer, I want every error path covered by tests, so that I can trust the error handling the case asks for.
19. As the candidate, I want the procedures testable without an HTTP server, so that the tests are fast and deterministic.
20. As an AI agent working on later steps, I want procedure names and error codes fixed in this spec, so that the UI specs can rely on them.

## Implementation Decisions

- **Module:** a `task` router in the tasks feature, mounted as `task` on the app router. The `AppRouter` type exported from the app router is the only type the frontend imports.
- **Procedures (all `publicProcedure`):**

  | Procedure | Kind | Input schema | Output | Errors |
  |---|---|---|---|---|
  | `task.list` | query | `listTasksInput` | `{ items: Task[]; nextCursor: { dataCriacao: string; id: string } \| null }` | `BAD_REQUEST` on invalid input |
  | `task.byId` | query | `taskIdInput` | `Task` | `NOT_FOUND`, `BAD_REQUEST` |
  | `task.create` | mutation | `createTaskInput` | `Task` | `BAD_REQUEST` (e.g. missing title) |
  | `task.update` | mutation | `updateTaskInput` | `Task` | `NOT_FOUND`, `BAD_REQUEST` |
  | `task.delete` | mutation | `taskIdInput` | `{ id: string }` | `NOT_FOUND`, `BAD_REQUEST` |

- **Thin router rule:** each procedure does only three things: validate the input (via `.input(schema)`), call one repository function (`list`, `getById`, `create`, `update`, `remove`), and map the result. No business rules, sorting, id generation or timestamps live in the router.
- **Error mapping:** a `null` from `getById` / `update` or a `false` from `remove` becomes a `TRPCError` with code `NOT_FOUND` and the message `Task <id> not found.`, using the id from the input. One small local helper builds this error, so the message is defined once.
- **Validation errors:** these come from the input schemas automatically. The Step 4 error formatter adds the flattened `zodError` to the error shape. The router adds nothing for this.
- **Unexpected errors:** not caught in the router. They surface as `INTERNAL_SERVER_ERROR` and are logged by the route handler in development (Step 4).
- **No output validation:** outputs are typed through the repository's `Task` type. Adding `.output()` schemas would duplicate validation with no gain at this size.
- **Temporary `health` procedure (from Step 4):** removed once the `task` router is mounted. `task.list` now serves as the smoke endpoint.
- **No transformer:** all values are JSON-safe (`dataCriacao` is an ISO string), as the plan decides.

## Testing Decisions

- **Seam:** the app router invoked through a server-side caller (`createCallerFactory(appRouter)` with the empty context). This is the highest seam below HTTP: it exercises input validation, procedure wiring, repository behavior and error mapping together, exactly as the route handler and server components use them, with no network.
- **What makes a good test:** assert on what a client observes, meaning returned values, error codes (`BAD_REQUEST`, `NOT_FOUND`) and error messages. Don't mock the repository and don't assert on how the router calls it.
- **Isolation:** reset the repository (`reset`) before each test, so tests don't depend on order or on the development seed.
- **Cases to cover:**
  - create without a title, or with a whitespace-only title → `BAD_REQUEST`, and the error carries a `titulo` field error "Title is required."
  - create, then list → the task is first in `items`, with a generated `id` and an ISO `dataCriacao`
  - list across pages → `nextCursor` chains pages with no duplicates; the last page returns `nextCursor: null`
  - byId for an existing task → the task; for an unknown id → `NOT_FOUND` with "Task <id> not found."
  - update an existing task → the changed fields are returned and `id` / `dataCriacao` are unchanged
  - update for an unknown id → `NOT_FOUND`
  - delete → returns `{ id }`, and the task no longer appears in list or byId
  - delete for an unknown id → `NOT_FOUND`
- **Prior art:** the repository unit tests from Step 3 (Vitest, co-located `*.test.ts`, Node environment).

## Out of Scope

- HTTP-level tests against the route handler (already covered by Step 4's acceptance check).
- Authentication, authorization and per-user data.
- Partial updates (patch semantics). `task.update` replaces the editable fields, per Step 2.
- Search, filtering or alternative sort orders.
- Client hooks and server prefetch helpers (Step 6).

## Further Notes

- The `NOT_FOUND` message includes the id because it is generic and contains no sensitive data. The UI may show it as-is through `getErrorMessage` (Step 7).
- In tRPC v11, the raw `message` of a validation error is a serialized issue list, not user-friendly text. The UI should read `zodError` field errors for validation and use `message` for the other codes (handled in Step 7's `getErrorMessage`).
