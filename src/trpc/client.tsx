"use client";

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import { makeQueryClient } from "./query-client";
// Type-only import: no server code reaches the client bundle.
import type { AppRouter } from "./router";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  // Server rendering: always a fresh client, so requests never share a cache.
  if (typeof window === "undefined") return makeQueryClient();
  // Browser: reuse one client, so the hydrated cache survives React suspending
  // and re-creating components during the first render.
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

function getUrl() {
  // Relative in the browser. During server rendering a fetch needs an absolute
  // URL; pages prefetch on the server, so this is only a safety net.
  const base =
    typeof window === "undefined" ? `http://localhost:${process.env.PORT ?? 3000}` : "";
  return `${base}/api/trpc`;
}

export function TRPCReactProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  // Not in useState: React would discard it if the first render suspends
  // without a boundary above it.
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: getUrl() })],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
