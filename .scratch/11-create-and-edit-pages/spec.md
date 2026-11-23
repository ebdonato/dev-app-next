# Spec: Create and edit pages

Status: ready-for-agent
Plan step: 11 of 13 (see `docs/implementation-plan.md`, Step 11)
Depends on: Steps 6 (client and server tRPC wiring) and 10 (shared task form component)
Blocks: Step 13 (documentation, final QA and delivery)

## Problem Statement

Users can see and delete tasks, but they can't add a new task or change an existing one. The case asks for a create/update page with a form, validation and clear feedback. The shared `TaskForm` (Step 10) handles input and client-side validation, but nothing connects it to the backend yet: no route renders it, no mutation is sent, and nothing happens after a successful or failed save.

## Solution

Two routes, both built on the shared `TaskForm`:

- **`/tasks/new`** shows an empty form. On a valid submit it creates the task with `task.create`, shows "Task created." and returns to the list, where the new task appears first.
- **`/tasks/[id]/edit`** is rendered on the server with the task's current values. On submit it saves with `task.update`, shows "Task updated." and returns to the list. If the task doesn't exist, the app's not-found page is shown.

When a save fails, the user stays on the form with the typed values intact and sees the backend's message, both as a general error and on the affected field.

## User Stories

1. As a user, I want a "New task" entry point that opens a creation form, so that I can add work to my list.
2. As a user, I want the creation form to start empty, so that I don't have to clear placeholder content.
3. As a user, I want the form to refuse to submit when the title is empty or only whitespace, so that I don't create meaningless tasks.
4. As a user, I want to see "Title is required." next to the title field when I forget it, so that I know exactly what to fix.
5. As a user, I want to add an optional description, so that I can record extra detail only when I need it.
6. As a user, I want the submit button to show a saving state and be disabled while the request is in flight, so that I know something is happening and can't submit twice.
7. As a user, I want to land back on the task list after creating a task, so that I can see it in context.
8. As a user, I want the new task to appear at the top of the list after creating it, so that I can confirm it was saved.
9. As a user, I want a "Task created." success message after creating a task, so that I get explicit confirmation.
10. As a user, I want the success message to still be visible after I'm redirected to the list, so that I don't miss it during navigation.
11. As a user, I want an "Edit" action on each task that opens the edit form, so that I can correct or update a task.
12. As a user, I want the edit form pre-filled with the task's current title and description, so that I only change what I need.
13. As a user, I want the edit page to load with the data already in place (rendered on the server), so that I never see an empty form flash before the values appear.
14. As a user, I want the same validation rules when editing as when creating, so that the behavior is predictable.
15. As a user, I want a "Task updated." success message after saving an edit, so that I know the change was applied.
16. As a user, I want the list to show the updated values when I return to it, so that I never see stale data.
17. As a user, I want the task's creation date to stay the same after editing, so that the list order and history stay meaningful.
18. As a user, I want a clear not-found page when I open the edit page of a task that doesn't exist, so that I understand why there's no form.
19. As a user, I want to see the backend's error message when a save fails (e.g. the task was deleted meanwhile), so that I understand what went wrong.
20. As a user, I want my typed values kept when a save fails, so that I don't have to retype them.
21. As a user, I want field-level errors returned by the server shown on the matching field, so that server-side validation feels the same as client-side validation.
22. As a user, I want a "Cancel" option that returns to the list without saving, so that I can back out safely.
23. As a keyboard or screen-reader user, I want errors to be announced and focus to move to the first invalid field, so that I can use the form without a mouse.
24. As a reviewer, I want the create and edit pages to share one form component and differ only in their thin wrappers, so that I can see deliberate reuse and separation of concerns.
25. As a developer, I want each wrapper to own its mutation and post-save behavior while the form stays free of tRPC, so that the form remains easy to reuse and test.
26. As a developer, I want cache invalidation done in one obvious place after each mutation, so that the list and detail data never drift from the server.

## Implementation Decisions

- **Routes:** `/tasks/new` (create) and `/tasks/[id]/edit` (edit). The header's "New task" link (Step 7) points to `/tasks/new`. Each list item's "Edit" action (Step 8) points to `/tasks/[id]/edit`.
- **Create page:** a server component that renders a heading and a thin client wrapper, `CreateTaskForm`. No data needs prefetching.
- **Edit page:** a **dynamic** server component, because data changes at runtime and must not be prerendered at build time.
  - It reads `id` from the route params. In Next.js 15, route params are a Promise and must be awaited.
  - It fetches the task server-side through the server-only tRPC module (`task.byId`) and awaits the result before rendering.
  - If the procedure throws `NOT_FOUND`, the page calls Next.js `notFound()`, which renders the app's not-found page from Step 7. Any other error propagates to the route error boundary (Step 7).
  - The task's `titulo` and `descricao` go to the client wrapper `EditTaskForm` as plain props, together with the `id`. The wrapper does not refetch the task on the client.
- **Thin client wrappers own the mutations.** Each wrapper:
  - uses `useTRPC()` with `useMutation(trpc.task.create.mutationOptions(...))` (create) or `useMutation(trpc.task.update.mutationOptions(...))` (edit);
  - renders `TaskForm` and passes `initialValues` (edit only), a `submitLabel` ("Create task" / "Save changes"), an `onSubmit(values) → Promise<void>` that awaits the mutation, `isSubmitting` from the mutation's pending state, and the server errors described below;
  - contains no validation logic of its own. `TaskForm` validates client-side with `createTaskInput.safeParse` before calling `onSubmit`.
- **On success** (in this order):
  1. Invalidate the task list with the query client and `trpc.task.list.pathKey()`. On edit, also invalidate that task's `task.byId` query.
  2. Call `notifySuccess("Task created.")` or `notifySuccess("Task updated.")` from `useFeedback()`.
  3. Navigate with `router.push('/')`. The feedback provider lives in the root layout, so the message survives the navigation.
- **On failure:**
  - The wrapper stays on the page and does not navigate.
  - The typed values are kept: `TaskForm` owns its field state, and the wrapper must not remount or reset it.
  - The wrapper passes server errors to `TaskForm`. One small shared helper, used by both wrappers, maps a tRPC error to the `serverError` shape from Step 10: a **general** message from `getErrorMessage(error)`, and **per-field** messages from `error.data.zodError` when present (`BAD_REQUEST`).
  - A `NOT_FOUND` on update (the task was deleted after the page loaded) shows "Task <id> not found." as the general error. The user can then cancel back to the list.
  - The wrapper does **not** also call `notifyError`, because the inline form error is the single place the message is shown.
- **Edit payload:** the wrapper sends `{ id, titulo, descricao }`, matching `updateTaskInput` (a full replace of the editable fields). `dataCriacao` is never sent and never changes. The repository preserves it (Step 3).
- **Double-submit protection:** `isSubmitting` disables the submit button. The wrapper also ignores `onSubmit` while a mutation is pending.
- **No optimistic updates.** The list is refetched through invalidation. That's simple and always consistent with the server.

## Testing Decisions

- **Seam:** the running app in the browser, through the two routes. That's the highest seam available: it covers the server-rendered edit page, the wrappers, the shared form, the mutations, cache invalidation and global feedback together. The backend behavior (create, update, `NOT_FOUND`, `BAD_REQUEST`) is already covered at the router seam by Step 5's `createCaller` tests, and this step doesn't duplicate those.
- **What makes a good test here:** a check of what the user can observe (what's on screen, where the app navigates, which messages appear), never of internal state or hook calls.
- **Manual verification checklist:**
  - Create with a valid title → redirected to `/`, the new task is first, and "Task created." is visible.
  - Create with an empty or whitespace-only title → "Title is required." and no network request (check the browser devtools Network tab).
  - Edit → the form is pre-filled in the initial HTML (view source shows the values). Save → redirected to `/`, the list shows the new values, the creation date is unchanged, and "Task updated." is visible.
  - Open `/tasks/<unknown-id>/edit` → the not-found page renders.
  - Open an edit page, delete that task in another tab, then save → the error "Task <id> not found." appears in the form and the typed values remain.
  - A rapid double-click on submit sends only one request.
  - Keyboard only: tab through the form, submit an invalid form, and focus moves to the first invalid field.
- **Automated tests:** none added in this step. There's no DOM test tooling in the project by design (see the plan's testing strategy).
- **Prior art:** Step 9 (delete with feedback) uses the same mutation → invalidate → notify pattern. Follow its structure.

## Out of Scope

- Changes to `TaskForm` itself (Step 10). If a gap is found, fix it there and note it.
- Optimistic updates and undo.
- Unsaved-changes warnings when leaving the page.
- Partial updates (patching single fields). Update always replaces `titulo` and `descricao`.
- Infinite scroll behavior after redirect (Step 12).
- Automated UI or end-to-end tests.

## Further Notes

- The wrappers are deliberately thin, so the create and edit flows differ only in which mutation they call, their initial values and their success message. If they start to duplicate logic, extract a small shared helper rather than adding branches to `TaskForm`.
- Passing the server-fetched task as props (instead of hydrating a `task.byId` query) keeps the edit flow simple. The `byId` invalidation on success is still worthwhile, so that any cached copy of that task is refreshed.
- Use the shared contract's exact messages: "Task created.", "Task updated." and "Task <id> not found.".
