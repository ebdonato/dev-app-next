# Spec: Client and server tRPC wiring

Status: ready-for-agent
Plan step: 6 of 13 (see `docs/implementation-plan.md`, Step 6)
Depends on: Step 5 (task router)
Blocks: Steps 7 (app shell and feedback system), 8 (task list page with SSR) and 11 (create and edit pages)

## Problem Statement

The task API exists on the server (Step 5), but React components can't use it yet. Client components need typed hooks to run queries and mutations. Server components need a way to load data **during server rendering** and hand it to the client, so that the list page is pre-loaded with SSR (case requirement) and the browser doesn't fetch the same data again on first load. Wired incorrectly, this causes a leaked server module in the browser bundle, a cache shared across users, or a double fetch on load.

## Solution

Three small infrastructure modules:

1. A shared **query client factory** that both sides use, so cache and dehydration settings are defined once.
2. A **client module** that creates the tRPC React context (`TRPCProvider`, `useTRPC`) and a `TRPCReactProvider` component wrapping the app with TanStack Query and a batched HTTP tRPC client.
3. A **server-only module** exposing a request-scoped query client, a tRPC options proxy that calls the router directly (no HTTP), and a `HydrateClient` component that sends server-fetched data to client components.

The root layout is wrapped in `TRPCReactProvider`.

## User Stories

1. As a user, I want the task list already in the HTML on first load, so that I see my tasks immediately with no loading spinner.
2. As a user, I want the page not to fetch the same data twice on load, so that it feels fast and doesn't flicker.
3. As the frontend developer, I want a `useTRPC()` hook that gives typed query and mutation options for every procedure, so that I get autocompletion and compile-time checks.
4. As the frontend developer, I want to use the standard TanStack Query hooks (`useQuery`, `useSuspenseInfiniteQuery`, `useMutation`) with tRPC options, so that I rely on well-known APIs instead of tRPC-specific wrappers.
5. As the frontend developer, I want typed query keys and path keys (e.g. for `task.list`), so that I can invalidate the right queries after a mutation.
6. As the frontend developer, I want to prefetch any procedure in a server component with the same typed options, so that server and client use identical query keys and hydration just works.
7. As the frontend developer, I want server-side prefetches to call the router directly, without an HTTP round-trip to my own API, so that SSR is fast and needs no absolute URL.
8. As the frontend developer, I want a `HydrateClient` wrapper, so that any client component below it reads the prefetched data from the cache.
9. As the frontend developer, I want pages to be able to await their prefetch, so that the HTML is guaranteed to contain the data (required for SSR).
10. As a user, I want my data never to leak into another user's page, so that each request renders only its own data.
11. As the candidate, I want importing the server module from a client component to break the build, so that server-only code can't end up in the browser bundle.
12. As the candidate, I want client requests batched into a single HTTP call, so that pages making several queries stay efficient.
13. As the candidate, I want a sensible default `staleTime`, so that data hydrated from the server isn't refetched immediately on mount.
14. As the candidate, I want cache settings defined in one place, so that server and client can't drift apart.
15. As a reviewer, I want the integration to follow the official tRPC v11 + Next.js App Router pattern, so that the setup is recognizable and easy to review.
16. As a reviewer, I want only stable library APIs used, so that the project doesn't depend on features marked unstable.
17. As an AI agent working on later steps, I want fixed names (`useTRPC`, `trpc`, `getQueryClient`, `HydrateClient`, `TRPCReactProvider`), so that the page specs can reference them directly.

## Implementation Decisions

- **Query client factory (`makeQueryClient`):** creates a `QueryClient` with:
  - default query `staleTime` of 30 seconds
  - dehydration that includes **pending** queries as well as successful ones (the default rule, plus `status === 'pending'`), so a prefetch that isn't awaited can still stream to the client
  - no transformer configuration, because all data is JSON-safe (ISO date strings)
- **Client module** (marked as a client module):
  - `createTRPCContext<AppRouter>()` from `@trpc/tanstack-react-query` provides `TRPCProvider` and `useTRPC`. Only the `AppRouter` **type** is imported from the server code.
  - `TRPCReactProvider` component:
    - gets its query client through a browser singleton, or a fresh client during server rendering, so the browser never loses its cache on re-render and servers never share one across requests
    - creates the tRPC client once (state or memo) with `httpBatchLink` pointing to the relative URL `/api/trpc`
    - renders `QueryClientProvider` and then `TRPCProvider` around its children
- **Server-only module** (guarded by the `server-only` package):
  - `getQueryClient = cache(makeQueryClient)`, React `cache` scoped to a single request
  - `trpc = createTRPCOptionsProxy({ ctx, router: appRouter, queryClient: getQueryClient })`, which runs procedures in-process. `ctx` is a function that calls Step 4's `createTRPCContext` with the current request headers (from Next.js `headers()`), so the HTTP handler and the server proxy build context the same way.
  - `HydrateClient`: a server component rendering TanStack Query's stable `HydrationBoundary` with `dehydrate(getQueryClient())` as its state. The tRPC `unstable_createHydrateClient` helper is deliberately not used.
- **Prefetch convention:** a page that needs SSR data **awaits** `getQueryClient().prefetchQuery(...)` or `prefetchInfiniteQuery(...)` with options from the server `trpc` proxy (e.g. `trpc.task.list.infiniteQueryOptions(...)`), then renders its client components inside `HydrateClient`. The client component must use the **same input** so the query keys match.
- **Root layout:** wraps the whole app in `TRPCReactProvider`. Step 7 places the feedback provider and the app shell inside it.
- **Error handling:** this step adds no error handling. Query and mutation errors surface to the components (Steps 7–11).

## Testing Decisions

- **Seam:** a server-rendered page using the real stack, from server prefetch through hydration to a client hook. That's the highest seam available: the behaviors that matter (data in the HTML, no extra request, no leaks across requests) only exist end to end. They can't be meaningfully unit-tested in the Node test environment.
- **Verification** (temporary check, removed before the step is done):
  - Add a throwaway server component page that awaits the prefetch of `task.list` and renders a client component reading it through `useTRPC()` inside `HydrateClient`.
  - The page source contains the task titles.
  - The browser's network panel shows **no** `/api/trpc` request on first load.
  - A client-side mutation (e.g. creating a task from the browser console or a temporary button) goes through `/api/trpc` and succeeds.
- **Build guard:** temporarily import the server-only module from a client component, confirm `npm run build` fails, then revert.
- **Quality gate:** `lint`, `typecheck`, `test` and `build` stay green.
- **Automated tests:** none added. This step is configuration; the procedures are already covered in Step 5.
- **Prior art:** none for integration checks. Step 8 turns this verification into the real list page.

## Out of Scope

- The real list, create and edit pages (Steps 8, 11).
- The feedback system, layout and route-level loading/error UI (Step 7).
- Using request context data (auth, sessions). Headers are passed to `createTRPCContext` only to keep the signature uniform; the context stays empty.
- Data transformers (`superjson`), server actions and React Server Component streaming optimizations beyond what's needed.
- Optimistic updates.

## Further Notes

- The browser singleton matters because React can suspend and re-create components during the first render. Without it, the browser could create a new, empty `QueryClient` and drop the hydrated data.
- `createTRPCOptionsProxy` with a `router` (rather than a `client`) is the documented way to call procedures in-process from server components with tRPC v11.
- Pages using this prefetch must render per request (dynamic). Steps 8 and 11 make this explicit.
