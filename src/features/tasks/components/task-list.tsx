"use client";

import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect } from "react";
import { useInView } from "@/hooks/use-in-view";
import { getErrorMessage } from "@/lib/get-error-message";
import { useTRPC } from "@/trpc/client";
import { getNextTaskPage, taskListInput } from "../task-list-query";
import { TaskItem } from "./task-item";
import styles from "./task-list.module.css";

export function TaskList() {
  const trpc = useTRPC();
  // Same options as the server prefetch, so the first page comes from the
  // hydrated cache; later pages are fetched with the server's nextCursor.
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useSuspenseInfiniteQuery(
    trpc.task.list.infiniteQueryOptions(taskListInput, {
      getNextPageParam: getNextTaskPage,
    }),
  );

  // Start loading a little before the sentinel actually becomes visible.
  const { ref: sentinelRef, inView } = useInView<HTMLDivElement>({ rootMargin: "200px" });

  // One request at a time: skip while any fetch runs (a next page, or the
  // refetch of all pages after a delete). Re-running when a fetch ends keeps
  // loading while the sentinel stays visible, so a short first page fills the
  // viewport. After an error, only "Retry" fetches again (no retry loop).
  const canLoadMore = hasNextPage && !isFetching && !isFetchNextPageError;
  useEffect(() => {
    if (inView && canLoadMore) void fetchNextPage();
  }, [inView, canLoadMore, fetchNextPage]);

  const tasks = data.pages.flatMap((page) => page.items);

  if (tasks.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No tasks yet</p>
        <Link href="/tasks/new">Create your first task</Link>
      </div>
    );
  }

  let status = "";
  if (isFetchNextPageError) status = getErrorMessage(error);
  else if (isFetchingNextPage) status = "Loading more…";
  else if (!hasNextPage) status = "You've reached the end.";

  return (
    <>
      <ul className={styles.list}>
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </ul>

      {hasNextPage && <div ref={sentinelRef} aria-hidden="true" />}

      <div className={styles.footer}>
        {/* Polite live region: loading, error and end states are announced. */}
        <p
          role="status"
          aria-live="polite"
          className={isFetchNextPageError ? styles.error : styles.status}
        >
          {status}
        </p>
        {isFetchNextPageError && (
          <button type="button" onClick={() => void fetchNextPage()} disabled={isFetching}>
            Retry
          </button>
        )}
        {/* Keyboard-accessible alternative to scrolling. */}
        {hasNextPage && !isFetchNextPageError && (
          <button type="button" onClick={() => void fetchNextPage()} disabled={isFetching}>
            Load more
          </button>
        )}
      </div>
    </>
  );
}
