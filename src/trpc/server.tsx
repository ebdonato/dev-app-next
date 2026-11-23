import "server-only";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { headers } from "next/headers";
import { cache } from "react";
import { createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./router";

/** One query client per request (React `cache` is request-scoped). */
export const getQueryClient = cache(makeQueryClient);

/**
 * Query options for server components. Procedures run in-process, with no HTTP
 * round-trip, and get the same context as the HTTP handler.
 */
export const trpc = createTRPCOptionsProxy({
  ctx: async () => createTRPCContext({ headers: await headers() }),
  router: appRouter,
  queryClient: getQueryClient,
});

/**
 * Hands the queries prefetched during this request to client components.
 * Uses TanStack Query's stable HydrationBoundary rather than tRPC's
 * `unstable_createHydrateClient`.
 */
export function HydrateClient({ children }: Readonly<{ children: React.ReactNode }>) {
  return <HydrationBoundary state={dehydrate(getQueryClient())}>{children}</HydrationBoundary>;
}
