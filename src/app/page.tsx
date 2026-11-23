import { TaskList } from "@/features/tasks/components/task-list";
import { getNextTaskPage, taskListInput } from "@/features/tasks/task-list-query";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

// Tasks live in server memory and change at runtime: render on every request
// instead of freezing a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Awaited on purpose (unlike fire-and-forget prefetch examples): the server
  // render must already have the first page, so the HTML contains the tasks.
  await getQueryClient().prefetchInfiniteQuery(
    trpc.task.list.infiniteQueryOptions(taskListInput, {
      getNextPageParam: getNextTaskPage,
    }),
  );

  return (
    <>
      <h1>Tasks</h1>
      <HydrateClient>
        <TaskList />
      </HydrateClient>
    </>
  );
}
