import { publicProcedure, router } from "./init";

export const appRouter = router({
  // Temporary smoke endpoint until the task router is mounted (Step 5).
  health: publicProcedure.query(() => ({ status: "ok" as const })),
});

export type AppRouter = typeof appRouter;
