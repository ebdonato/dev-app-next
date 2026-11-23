import { taskRouter } from "@/features/tasks/task.router";
import { router } from "./init";

export const appRouter = router({
  task: taskRouter,
});

export type AppRouter = typeof appRouter;
