# Spec: Task list page with SSR

Status: ready-for-agent
Plan step: 8 of 13 (see `docs/implementation-plan.md`, Step 8)
Depends on: Step 6 (client and server tRPC wiring), Step 7 (app shell and feedback system)
Blocks: Step 9 (delete from the list), Step 12 (infinite scroll)

## Problem Statement

The backend can create, list, update and delete tasks, but users have nothing to look at. The case requires a task list page that is **pre-loaded with Server-Side Rendering**: the first HTML response must already contain the tasks, with no spinner on first load. The layout should be simple.

The page must also hand its data to the client, so later steps can add deleting (Step 9) and incremental loading (Step 12) on the same cache without fetching the first page twice.

## Solution

The home route becomes the task list. It is a dynamic server component: on every request it fetches the first page of tasks (10, newest first) directly through the server-side tRPC proxy, with no HTTP round-trip, and **waits** for it, so the HTML contains the tasks. It then hydrates that data into a client `TaskList` component, which reads the same query from the TanStack Query cache and renders one `TaskItem` per task.

Each item shows the title, the description (when present), a readable creation date, an "Edit" link and a "Delete" control. The control is only wired up in Step 9. When there are no tasks, the page shows "No tasks yet" with a link to create one.

## User Stories

1. As a user, I want to see my tasks as soon as the page opens, so that I don't wait for a loading spinner.
2. As a user, I want the newest tasks shown first, so that what I just added is easy to find.
3. As a user, I want to see each task's title, so that I can identify it at a glance.
4. As a user, I want to see a task's description when it has one, so that I get the details without opening it.
5. As a user, I don't want an empty gap where a description is missing, so that the list stays tidy.
6. As a user, I want the creation date in a readable local format, so that I can tell when each task was created.
7. As a user, I want an "Edit" link on each task, so that I can go straight to changing it.
8. As a user, I want a "Delete" control on each task, so that I can remove it from the list (behavior delivered in Step 9).
9. As a user with no tasks, I want a clear "No tasks yet" message, so that I know the empty list isn't an error.
10. As a user with no tasks, I want a link to create my first task from the empty state, so that I know what to do next.
11. As a user, I want the list to reflect the server's current state on every visit or refresh, so that I never see a stale list frozen at build time.
12. As a user, I want long titles and descriptions to wrap rather than overflow, so that the layout stays readable on small screens.
13. As a keyboard or screen-reader user, I want the list marked up as a real list with headings and links, so that I can navigate it with assistive technology.
14. As a user, if loading the list fails on the server, I want to see the route's error screen with a "Try again" option (from Step 7), so that I'm not left with a blank page.
15. As a reviewer, I want to see the tasks in the page source, so that I can verify the SSR requirement is really met.
16. As a reviewer, I want no client-side list request on first load, so that I can see the server data was reused, not fetched twice.
17. As a developer working on Step 9, I want the list to come from a TanStack Query cache entry that I can invalidate, so that deletions show up without a page reload.
18. As a developer working on Step 12, I want the list built on an infinite query that already exposes the next cursor, so that infinite scroll only adds a trigger, not a rewrite.
19. As a developer, I want `TaskItem` to receive a fully typed `Task`, so that the UI can't drift from the schema.

## Implementation Decisions

- **Route:** the home route (`/`) is the task list. It is a **server component** that renders **dynamically** (per request), never statically prerendered. Use Next.js 15's explicit opt-in to dynamic rendering, so `npm run build` reports the route as dynamic (ƒ).
- **SSR prefetch:** the page gets the request-scoped query client (`getQueryClient`) and **awaits** an infinite-query prefetch of `task.list` with input `{ limit: 10 }`, built with the server `trpc` proxy's `infiniteQueryOptions`. Because it awaits rather than fire-and-forget, the server render already has the data and the HTML contains the tasks.
- **Hydration:** the page wraps the client list in `HydrateClient` (stable `HydrationBoundary` + `dehydrate`), so the prefetched cache entry moves to the browser.
- **Shared query options:** server prefetch and client query must use **identical** input (`{ limit: 10 }`) and the same `getNextPageParam` (`lastPage => lastPage.nextCursor`), so their query keys match and the client reuses the hydrated entry. Keep the page size as one named constant shared by both sides, not two literals.
- **Client list:** `TaskList` is a client component. It gets `useTRPC()` and reads `trpc.task.list.infiniteQueryOptions({ limit: 10 }, { getNextPageParam })` through TanStack Query's suspense infinite-query hook, so data is always defined after hydration. It flattens `pages[].items` into one array and renders one `TaskItem` per task, keyed by `id`.
- **Item:** `TaskItem` is a client component taking a `Task` prop. It renders:
  - `titulo` as the item heading
  - `descricao` only when defined
  - `dataCriacao` formatted with `Intl.DateTimeFormat` (date and short time)
  - an "Edit" link to the task's edit route (built in Step 11)
  - a "Delete" button, present but inert in this step (Step 9 wires it)
  The ISO string is only ever formatted for display; it is not reparsed for logic.
- **Date formatting consistency:** server and client render the same `Intl.DateTimeFormat` output, so hydration doesn't mismatch. Use an explicit locale and options, not the runtime default. Document the chosen locale in a short comment.
- **Empty state:** when the first page has no items, render "No tasks yet" with a link to the create route ("Create your first task").
- **Markup and styling:** a semantic list (`ul`/`li`, or `ol`) with CSS Modules and minimal styles (spacing, wrapping, subtle separators). No design system.
- **Out-of-step behavior:** the list must already expose `hasNextPage`/`fetchNextPage` from the infinite query, but this step renders no trigger for loading more. Step 12 adds it.
- **Contract reminder:** the list result is `{ items, nextCursor | null }`, newest first. When a page has no next cursor, `getNextPageParam` returns `null`/`undefined`, so `hasNextPage` is false.

## Testing Decisions

- **Seam:** the rendered route as a user or reviewer sees it (page HTML on first load plus the browser behavior). That's the highest seam for this step. The data rules behind it (order, pagination, schema) are already covered by Vitest at the router seam (Steps 2, 3, 5), so they aren't re-tested here.
- **What makes a good check:** observe external behavior (what the HTML contains, which network requests fire, what the user sees), not component internals.
- **Manual verification checklist** (dev server with the development seed of ~25 fictitious tasks):
  - View the page source: the first 10 task titles are in the HTML.
  - Network tab on a hard reload: no client-side `task.list` request on initial load.
  - Order: newest first. Dates readable and identical between server HTML and hydrated UI (no hydration warning in the console).
  - A task without a description shows no empty description element.
  - Each item has a working "Edit" link target and a "Delete" button.
  - With an empty store (seed off or all tasks deleted), "No tasks yet" and the create link appear.
  - Create a task in another tab, then refresh: it appears first (proves dynamic rendering, not a build-time snapshot).
  - `npm run build` lists `/` as dynamic (ƒ). `npm run lint`, `npm run typecheck` and `npm test` stay green.
- **Automated tests:** none added in this step. Component and browser tests are out of scope for the project (see the plan's testing strategy). Prior art: the router integration tests from Step 5 already cover `task.list`.

## Out of Scope

- Deleting tasks and its feedback (Step 9). The button is rendered but inert.
- Infinite scroll or a "Load more" trigger (Step 12).
- Create and edit pages (Steps 10 and 11). The links point to routes those steps create.
- Sorting, filtering or searching tasks.
- Elaborate styling, animations, skeleton loaders beyond the route-level `loading.tsx` from Step 7.
- Optimistic updates.

## Further Notes

- The awaited prefetch is the core of the SSR requirement. Add a comment explaining why the prefetch is awaited here, unlike the fire-and-forget pattern in some tRPC examples, so a reviewer doesn't "optimize" it away.
- tRPC passes the cursor to the procedure as `null` (not omitted) on the first page of an infinite query. `listTasksInput` must therefore accept a **nullish** cursor. Step 2's spec confirms this: `listTasksInput` treats `null` and an absent cursor alike as the first page.
- If the "Edit" link targets a route that doesn't exist until Step 11, it will hit the not-found page in between. That's acceptable.
