"use client";

import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTRPC } from "@/trpc/client";
import { getNextTaskPage, taskListInput } from "../task-list-query";
import { TaskItem } from "./task-item";
import styles from "./task-list.module.css";

export function TaskList() {
  const trpc = useTRPC();
  // Same options as the server prefetch, so this reads the hydrated cache.
  // `hasNextPage`/`fetchNextPage` are available for infinite scroll (Step 12).
  const { data } = useSuspenseInfiniteQuery(
    trpc.task.list.infiniteQueryOptions(taskListInput, {
      getNextPageParam: getNextTaskPage,
    }),
  );

  const tasks = data.pages.flatMap((page) => page.items);

  if (tasks.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No tasks yet</p>
        <Link href="/tasks/new">Create your first task</Link>
      </div>
    );
  }

  return (
    <ul className={styles.list}>
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </ul>
  );
}
