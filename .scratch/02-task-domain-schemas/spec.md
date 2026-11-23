# Spec: Task domain schemas

Status: ready-for-agent
Plan step: 2 of 13 (see `docs/implementation-plan.md`, Step 2)
Depends on: Step 1 (project scaffold and tooling)
Blocks: Steps 3 (in-memory task repository) and 10 (shared task form component)

## Problem Statement

Every layer of the task manager needs the same answer to one question: what is a valid task? The repository stores tasks, the tRPC router validates inputs, and the form validates what the user types. Without a single shared definition, these layers drift apart. The form might accept a title the server rejects, a type might say a field is required when the API treats it as optional, and error messages might differ between client and server.

The case explicitly requires that tasks cannot be created without a title (R5), that the form blocks submission when the title is empty (R11), and it fixes the task's fields: `id`, `titulo`, `descricao`, `dataCriacao` (R3).

## Solution

A single feature module holds Zod schemas for the task and for every operation's input. TypeScript types are inferred from those schemas, never written by hand. The same schemas are used by the tRPC procedures (server-side validation) and by the form (client-side validation), so a rule and its user-facing message are defined exactly once.

## User Stories

1. As a user, I want to be stopped from creating a task with an empty title, so that every task in my list is identifiable.
2. As a user, I want a title made only of spaces to count as empty, so that I don't accidentally create blank-looking tasks.
3. As a user, I want leading and trailing spaces removed from my title and description, so that tasks display cleanly.
4. As a user, I want the message "Title is required." when I forget the title, so that I know exactly what to fix.
5. As a user, I want a clear message when my title is longer than 120 characters, so that I can shorten it.
6. As a user, I want a clear message when my description is longer than 1000 characters, so that I can shorten it.
7. As a user, I want to leave the description empty, so that I can create quick tasks with only a title.
8. As a user, I want an empty description to be treated as "no description", so that the list doesn't show an empty description block.
9. As a user, I want to see the same validation messages whether the error comes from the form or from the server, so that the app feels consistent.
10. As the candidate, I want one schema per operation input (create, update, by-id, list), so that each tRPC procedure declares exactly what it accepts.
11. As the candidate, I want the `Task`, `CreateTaskInput`, `UpdateTaskInput` and `ListTasksInput` types inferred from the schemas, so that types and runtime validation can never disagree.
12. As the candidate, I want the task's `id` to be a UUID, so that ids are unique without a counter or a database.
13. As the candidate, I want `dataCriacao` to be an ISO 8601 UTC string, so that it serializes unchanged from server to client without a data transformer.
14. As the candidate, I want the list input to carry a `limit` with a sensible default and bounds, so that clients can't request unbounded pages.
15. As the candidate, I want the list input's cursor to be a keyset `{ dataCriacao, id }`, so that pagination stays correct when tasks are deleted while scrolling.
16. As the candidate, I want a named `Cursor` type, so that the repository, router and list UI share one definition of the pagination cursor.
17. As the candidate, I want the schemas to have no dependency on Next.js, React, tRPC or the storage, so that they can be imported anywhere, including client components.
18. As a reviewer, I want field names to match the case exactly (`id`, `titulo`, `descricao`, `dataCriacao`), so that I can map the code to the requirements at a glance.
19. As a reviewer, I want validation rules in one obvious place, so that I can review them without hunting through components and procedures.
20. As an AI agent working on later steps, I want stable exported names (`taskSchema`, `createTaskInput`, `updateTaskInput`, `taskIdInput`, `listTasksInput`), so that every later spec can reference them reliably.

## Implementation Decisions

- **Module:** a single task-schema module inside the tasks feature folder. It depends only on Zod.
- **`taskSchema`** (the stored and returned task):
  - `id`: UUID string.
  - `titulo`: string, trimmed, 1–120 characters.
  - `descricao`: optional string, trimmed, max 1000 characters.
  - `dataCriacao`: ISO 8601 datetime string in UTC (the format produced by `Date.prototype.toISOString`).
- **Shared field rules:** `titulo` and `descricao` are each defined once and reused by `taskSchema`, `createTaskInput` and `updateTaskInput`, so a rule can't diverge between operations.
  - `titulo`: trim first, then enforce the minimum. An empty or whitespace-only value fails with exactly **"Title is required."**. Over 120 characters fails with "Title must be at most 120 characters.".
  - `descricao`: trim first. An empty string after trimming becomes `undefined`. Over 1000 characters fails with "Description must be at most 1000 characters.".
- **`createTaskInput`:** `{ titulo, descricao? }`.
- **`updateTaskInput`:** `{ id, titulo, descricao? }`. This is a **full replace** of the editable fields (the form always sends both). An omitted or empty `descricao` clears the description. `id` and `dataCriacao` can never be changed through this input.
- **`taskIdInput`:** `{ id }` (UUID). Used by `task.byId` and `task.delete`.
- **`cursorSchema`** and the inferred **`Cursor`** type: `{ dataCriacao, id }`, the keyset of the last item seen, using the same field rules as `taskSchema`.
- **`listTasksInput`:** `{ limit, cursor? }`. `limit` is an integer from 1 to 50, defaulting to 10. `cursor` is optional and nullish (`null` or absent both mean "first page"), which matches how TanStack infinite queries pass the initial page param.
- **Inferred types:** export `Task`, `CreateTaskInput`, `UpdateTaskInput`, `ListTasksInput` and `Cursor`, all via Zod inference. Where input and output differ (e.g. `limit` has a default), the exported type is the **parsed output** type, because that's what the repository receives.
- **List result shape** (documented here; produced by the repository in Step 3): `{ items: Task[], nextCursor: Cursor | null }`, ordered by `dataCriacao` descending, then `id` descending. No output schema is needed: procedure outputs aren't validated at runtime, to keep it simple.
- **Messages are user-facing**, in English and short. The form (Step 10) shows them as-is, and the server returns them through `zodError` (Step 4).
- **Zod version:** use the Zod major installed in Step 1, with that version's idiomatic APIs (e.g. the current string-format helpers for UUID and ISO datetime).

## Testing Decisions

- **Seam:** the exported schemas themselves, exercised through `safeParse`. This is the module's public interface and the same call the form and tRPC make. Tests assert on parse success, parsed output values and error messages, never on Zod internals.
- **Module tested:** the task-schema module, with co-located unit tests (Vitest, Node environment, per Step 1).
- **Cases to cover:**
  - `createTaskInput`:
    - Missing, empty or whitespace-only `titulo` fails with "Title is required.".
    - `titulo` is trimmed in the output.
    - 120 characters passes; 121 fails with the max-length message.
    - Empty or whitespace-only `descricao` parses to `undefined`.
    - 1000-character `descricao` passes; 1001 fails.
    - Unknown extra fields don't leak into the output.
  - `updateTaskInput`:
    - Requires a valid UUID `id`.
    - Applies the same `titulo` and `descricao` rules.
  - `taskIdInput`: rejects a non-UUID id.
  - `listTasksInput`:
    - `limit` defaults to 10, and accepts 1 and 50.
    - Rejects 0, 51 and non-integers.
    - `cursor` may be absent, `null` or a valid `{ dataCriacao, id }`.
    - A malformed cursor (bad date, bad id) is rejected.
  - `taskSchema`: accepts a well-formed task and rejects a non-ISO `dataCriacao`.
- **Prior art:** none yet. These are the first tests in the repo and set the convention (co-located `*.test.ts`, `describe` per schema).

## Out of Scope

- Storage, id generation and timestamp generation (Step 3).
- tRPC procedures and the error formatter that exposes `zodError` (Steps 4 and 5).
- Form UI and how messages are rendered (Step 10).
- Output or response validation schemas.
- Any field beyond the case's four (status, priority, due date, …).
- Internationalization of messages.

## Further Notes

- Keeping the Portuguese field names is deliberate (see `AGENTS.md`): they're the case's contract. Everything else (schema names, messages, comments) is in English.
- The 120/1000 limits are product choices, not case requirements. They exist so the UI never has to handle unbounded text. Mention them in the README's API reference (Step 13).
- Trim-then-validate is the key detail that makes "   " count as an empty title. Add a short comment explaining it.
