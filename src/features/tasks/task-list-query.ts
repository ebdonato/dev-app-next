import type { Cursor } from "./task.schema";

/**
 * Shared by the server prefetch (home page) and the client list. Both sides
 * must build the infinite query from the same input and the same
 * getNextPageParam, so their query keys match and the client reuses the
 * hydrated cache instead of fetching again.
 */
export const TASK_PAGE_SIZE = 10;

export const taskListInput = { limit: TASK_PAGE_SIZE };

export const getNextTaskPage = (lastPage: { nextCursor: Cursor | null }) =>
  lastPage.nextCursor;
