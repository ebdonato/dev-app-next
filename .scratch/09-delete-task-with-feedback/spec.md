# Spec: Delete from the list, with feedback

Status: ready-for-agent
Plan step: 9 of 13 (see `docs/implementation-plan.md`, Step 9)
Depends on: Step 8 (task list page with SSR)
Blocks: Step 12 (infinite scroll, which must stay consistent after deletions)

## Problem Statement

The task list shows a "Delete" button on each task, but it does nothing. The case requires users to delete tasks **directly from the list**, with **visual feedback** for success and error. Without that, users can't remove tasks and don't know whether an action worked.

Deleting is destructive and can fail: the task may already have been deleted in another tab, or the network may drop. Users need protection against accidental clicks, a clear in-progress state, and a meaningful message when something goes wrong.

## Solution

Clicking "Delete" on a task asks for confirmation with the browser's native dialog. Once confirmed, that item's button shows "Deleting…" and is disabled while the `task.delete` mutation runs.

On success, the list queries are invalidated, the list refetches without the task, and a global "Task deleted." message appears. On failure, the server's message (for example "Task <id> not found.") appears as an error, and the list is still refreshed so it matches the server again.

## User Stories

1. As a user, I want to delete a task straight from the list, so that I don't have to open it first.
2. As a user, I want to confirm before a task is deleted, so that a misclick doesn't remove my work.
3. As a user, I want the confirmation to name the task, so that I'm sure I'm deleting the right one.
4. As a user, I want cancelling the confirmation to change nothing, so that backing out is safe.
5. As a user, I want the Delete button to show "Deleting…" while the request runs, so that I know my click registered.
6. As a user, I want the Delete button disabled while deleting, so that double clicks don't send two requests.
7. As a user, I want other tasks to stay usable while one is deleting, so that a slow request doesn't block the whole list.
8. As a user, I want the task to disappear from the list once deleted, so that the list reflects reality without a page reload.
9. As a user, I want a "Task deleted." success message, so that I know the action worked.
10. As a user, I want the success message to go away on its own, so that it doesn't clutter the page (behavior from the Step 7 feedback system).
11. As a user, if the task was already deleted elsewhere, I want to see "Task <id> not found.", so that I understand why the delete failed.
12. As a user, after that kind of failure, I want the list to refresh, so that the stale task disappears instead of lingering.
13. As a user, if the network or server fails, I want a clear error message rather than silence, so that I know to try again.
14. As a user, after a failed delete, I want the button usable again, so that I can retry.
15. As a screen-reader user, I want success and error messages announced, so that I get the same feedback as sighted users (live region from Step 7).
16. As a keyboard user, I want the Delete button reachable and operable with the keyboard, so that I can delete without a mouse.
17. As a screen-reader user, I want each Delete button's accessible name to include the task title, so that I know which task it affects.
18. As a reviewer, I want deletion to use the backend's typed `NOT_FOUND` error, so that I can see errors flow end to end from tRPC to the UI.
19. As a developer working on Step 12, I want deletions to invalidate every loaded page of the infinite list, so that scrolling after a delete shows no gaps or duplicates.

## Implementation Decisions

- **Ownership:** the delete behavior lives in `TaskItem` (client component). `TaskList` keeps rendering items and gains no delete logic.
- **Mutation:** `TaskItem` uses TanStack Query's `useMutation` with `trpc.task.delete.mutationOptions(...)` from `useTRPC()`. Input is `{ id }`; the procedure returns `{ id }`.
- **Confirmation:** use the native `confirm()` with a message that includes the task title (e.g. `Delete "<titulo>"?`). If cancelled, nothing happens and no request is sent. No custom modal, which keeps it simple.
- **Pending state is per item:** each `TaskItem` has its own mutation instance, so only the clicked item shows "Deleting…" and a disabled button. The disabled state also guards against double clicks.
- **Success path:** invalidate all list queries with `trpc.task.list.pathKey()` (covers every page of the infinite query, whatever the input), then call `notifySuccess("Task deleted.")`.
- **Error path:** call `notifyError(getErrorMessage(error))`. For `NOT_FOUND` this shows the server message "Task <id> not found.". For other failures, `getErrorMessage` falls back to its generic message. **Also invalidate the list on error** (use a settled callback, or invalidate in both paths), so a task that is already gone disappears and the UI matches the server again.
- **No optimistic update:** the item stays visible until the refetch completes. That's simpler and always correct, and the per-item "Deleting…" state covers the wait.
- **Accessibility:** the Delete button's accessible name includes the task title (e.g. a visually hidden suffix or `aria-label` "Delete <titulo>"). Feedback is announced by the global live region from Step 7; this step adds no new live region.
- **No new modules:** reuse `useFeedback`, `getErrorMessage` and the list's existing query. Add nothing to the router or repository; `task.delete` and its errors already exist (Step 5).

## Testing Decisions

- **Seam:** the list page in the browser, as a user experiences it. The backend half (`task.delete` returning `{ id }` and raising `NOT_FOUND` for unknown ids) is already covered at the router seam by Step 5's `createCaller` tests, so this step doesn't re-test it.
- **What makes a good check:** observable behavior (dialogs, button states, messages, list contents, network requests), not mutation internals.
- **Manual verification checklist** (dev server with seed data):
  - Click Delete and cancel the dialog: no request sent, nothing changes.
  - Click Delete and confirm: only that button shows "Deleting…" and is disabled; the task disappears; "Task deleted." appears and auto-dismisses.
  - Double-click Delete and confirm once: exactly one `task.delete` request is sent.
  - Open the list in two tabs, delete a task in tab A, then delete the same task in tab B: tab B shows "Task <id> not found." and the task disappears from tab B after the refetch.
  - Simulate offline (devtools) and delete: a generic error message appears and the button becomes usable again.
  - Screen reader or accessibility tree: the Delete button's name includes the title, and messages are announced.
  - `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` stay green.
- **Automated tests:** none added in this step, consistent with the plan's testing strategy (no component or E2E tests). Prior art: the Step 5 router tests for `task.delete`.

## Out of Scope

- Custom confirmation modals or undo ("restore deleted task").
- Optimistic removal from the cache.
- Bulk or multi-select deletion.
- Delete from the edit page.
- Changes to the backend procedures or repository.
- Infinite scroll behavior itself (Step 12). This step only guarantees that invalidation covers all loaded pages.

## Further Notes

- Invalidating with `pathKey()` (not an input-specific key) is deliberate: it refreshes the list no matter which input or how many pages are cached, which matters once Step 12 loads several pages.
- Refetching an infinite query refetches every loaded page in sequence. With keyset cursors (Step 3) this stays consistent after a deletion. Step 12's acceptance criteria re-check it.
- Native `confirm()` blocks the main thread and can't be styled. That's acceptable under "less is more", and the README (Step 13) can mention a custom dialog as a possible improvement.
