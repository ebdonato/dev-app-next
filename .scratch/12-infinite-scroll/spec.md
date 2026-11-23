# Spec: Infinite scroll (bonus)

Status: ready-for-agent
Plan step: 12 of 13 (see `docs/implementation-plan.md`, Step 12)
Depends on: Steps 8 (task list page with SSR) and 9 (delete from the list, with feedback)
Blocks: Step 13 (documentation, final QA and delivery)

## Problem Statement

The list page shows only the first page of tasks (10 by default), rendered on the server. Users with more tasks than that have no way to see the rest. The case lists incremental loading on scroll as a bonus. Without it, the list either looks truncated or would need to load everything at once, which doesn't scale and wastes the cursor-based pagination already built into `task.list`.

## Solution

As the user scrolls toward the end of the list, the next page of tasks loads automatically and is appended below the existing ones, until there are no more. Every state is visible and recoverable:

- "Loading more…" while a page is being fetched.
- An inline error with a "Retry" button if a page fails.
- An end message once everything has loaded.
- A keyboard-accessible "Load more" button as a fallback for users who don't scroll or where automatic loading doesn't trigger.

## User Stories

1. As a user, I want more tasks to load automatically when I reach the end of the list, so that I can browse everything without clicking through pages.
2. As a user, I want new tasks appended below the ones I already see, so that I don't lose my place.
3. As a user, I want to see "Loading more…" while the next page loads, so that I know more content is coming.
4. As a user, I want a clear end message when there are no more tasks, so that I know I've seen everything.
5. As a user, I want an inline error with a "Retry" button when a page fails to load, so that I can recover without reloading the whole page.
6. As a user, I want the tasks already loaded to stay visible when loading the next page fails, so that a network hiccup doesn't wipe my list.
7. As a user, I want no task to appear twice and none to be skipped while scrolling, so that the list is trustworthy.
8. As a user, I want deleting a task mid-scroll to leave the rest of the list correct, so that I can manage tasks while browsing.
9. As a user, I want the first page to still be rendered on the server, so that the initial load stays fast and complete.
10. As a keyboard user, I want a focusable "Load more" button, so that I can load more tasks without a mouse or scroll gestures.
11. As a screen-reader user, I want loading, error and end states announced politely, so that I know what's happening without seeing it.
12. As a user on a large screen where the first page doesn't fill the viewport, I want more tasks to load without having to scroll, so that the page doesn't look incomplete.
13. As a user who scrolls quickly, I want only one page request in flight at a time, so that the app doesn't send duplicate requests or load pages out of order.
14. As a user, I want the list to stay scrollable and responsive while a page loads, so that the UI never feels frozen.
15. As a developer, I want the viewport-detection logic in a small reusable hook, so that the list component stays focused on rendering.
16. As a developer, I want the hook to disconnect its observer on unmount, so that there are no leaks or callbacks into unmounted components.
17. As a developer, I want pagination to rely entirely on the server's `nextCursor`, so that the client never computes offsets.
18. As a reviewer, I want the bonus done with the existing stack (TanStack Query infinite queries plus a native browser API), so that it shows good judgment without new dependencies.
19. As a reviewer, I want the dev seed to have enough tasks to show several pages, so that I can see infinite scroll working right after `npm run dev`.

## Implementation Decisions

- **Data source:** the existing infinite query over `task.list` (set up in Step 8 with `trpc.task.list.infiniteQueryOptions(...)` and `getNextPageParam: (lastPage) => lastPage.nextCursor`). This step adds no new procedure and no change to `listTasksInput`.
- **Pagination contract (unchanged):** input `{ limit (default 10, max 50), cursor?: Cursor | null }` (`Cursor` = `{ dataCriacao, id }` from Step 2) → `{ items, nextCursor | null }`, newest first. The keyset cursor guarantees no duplicates and no gaps, even after deletions (covered by Step 3's tests). The client uses the default limit of 10.
- **`useInView` hook:** a small generic hook built on the browser's `IntersectionObserver`.
  - It returns a ref to attach to an element and a boolean `inView`.
  - Options: an optional root margin, so that loading starts slightly before the sentinel is fully visible.
  - It disconnects the observer on unmount and whenever the observed element changes.
  - It knows nothing about tasks or tRPC.
- **Sentinel:** an empty element rendered after the last task. When the sentinel is in view, the list calls `fetchNextPage()`, but **only if `hasNextPage` is true and `isFetchingNextPage` is false**. That makes it one request at a time, triggered on entry into the viewport, not on every render.
- **Short first page:** if the first page doesn't fill the viewport, the sentinel is already in view. The fetch must still happen, and it should run again after each page is appended while the sentinel stays visible and `hasNextPage` is true, so the page fills up.
- **States rendered below the list:**
  - Fetching the next page: "Loading more…".
  - Next-page error: an inline message from `getErrorMessage(error)` and a "Retry" button that calls `fetchNextPage()` again. Already loaded tasks stay visible. This error is shown inline only, not through the global feedback.
  - `hasNextPage` false and at least one task loaded: the end message, "You've reached the end.".
  - Otherwise: the "Load more" button. It's a real button, so it's focusable and works with Enter or Space, uses the same guard and is disabled while fetching.
  - These states sit in a polite live region, so screen readers announce changes.
- **Empty list:** when there are no tasks at all, Step 8's empty state shows, and there's no sentinel, end message or "Load more" button.
- **Deletion interaction (Step 9):** after a delete, Step 9 invalidates the list with `trpc.task.list.pathKey()`. TanStack Query then refetches every loaded page in sequence from the first cursor, so the list stays consistent. Infinite scroll adds no special handling.
- **No dependencies added.** There's no virtualization and no scroll-position restoration library.

## Testing Decisions

- **Seam:** the list page in the browser. That's the highest seam available: it covers the hook, the sentinel, the guards and the UI states together. Cursor correctness itself (no duplicates or gaps, including after deletions) is already covered at the repository and router seams (Steps 3 and 5) and isn't retested here.
- **What makes a good test here:** what the user observes (tasks appearing, messages shown, the requests in the browser's network panel), not hook internals.
- **Manual verification checklist** (with the dev seed of ~25 fictitious tasks and a page size of 10, so 3 pages):
  - Initial load shows 10 tasks in the server-rendered HTML, with no client request for `task.list`.
  - Scrolling down loads page 2 (20 tasks), then page 3 (25 tasks), then shows "You've reached the end.".
  - Each scroll-triggered load shows "Loading more…", and the network panel never shows two `task.list` requests in flight at once.
  - Across all pages, no task appears twice and the order stays newest first.
  - Delete a task on page 2 after loading all pages → the list refetches, the task is gone, and the others are intact with no duplicates.
  - In the devtools, set the network to offline, scroll to trigger a load → the inline error and "Retry" appear and loaded tasks remain. Go back online and click "Retry" → the page loads.
  - With a very tall window (the first page doesn't fill it), more pages load without scrolling.
  - Keyboard only: tab to "Load more" and press Enter → the next page loads.
  - Navigate away and back → no errors in the console, which means the observer cleaned up.
- **Automated tests:** none added in this step. There's no DOM test tooling by design.
- **Prior art:** Step 8 defines the infinite query and the list rendering, and Step 9 the invalidation after delete. This step only extends the list component.

## Out of Scope

- List virtualization or windowing.
- Restoring the scroll position when coming back from the edit page.
- Changing the page size from the UI.
- Filtering, sorting or search.
- Any change to `task.list`, `listTasksInput` or the repository's pagination.
- Automated UI or end-to-end tests.

## Further Notes

- Keeping the "Load more" button alongside automatic loading is an accessibility choice, not a fallback for old browsers. `IntersectionObserver` is available in all modern browsers.
- The guard (`hasNextPage && !isFetchingNextPage`) is the key detail. Without it, an observer that fires repeatedly while the sentinel stays visible would send duplicate requests.
- Mention in the README (Step 13) that the dev seed exists so the bonus can be demoed straight away.
