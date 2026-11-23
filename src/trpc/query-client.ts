import { defaultShouldDehydrateQuery, QueryClient } from "@tanstack/react-query";

/**
 * One factory for both the server (one client per request) and the browser
 * (one client per session). No serialize/deserialize hooks: all payloads are
 * JSON-safe (dates travel as ISO strings).
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, a staleTime above 0 avoids refetching right after hydration.
        staleTime: 30 * 1000,
      },
      dehydrate: {
        // Also send queries that are still pending, so a prefetch that isn't
        // awaited can stream to the client instead of being dropped.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
        // Keep Next.js error digests intact so dynamic-rendering errors are
        // still recognised during the build (recommended by the tRPC docs).
        shouldRedactErrors: () => false,
      },
    },
  });
}
