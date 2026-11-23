"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { TASK_DELETED_MESSAGE } from "@/components/feedback/messages";
import { getErrorMessage } from "@/lib/get-error-message";
import { useTRPC } from "@/trpc/client";
import type { Task } from "../task.schema";
import styles from "./task-item.module.css";

// Fixed locale and time zone: the server and the browser must produce the
// same text, or React reports a hydration mismatch.
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function TaskItem({ task }: Readonly<{ task: Task }>) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { notifySuccess, notifyError } = useFeedback();

  // One mutation per item, so only the clicked task shows "Deleting…".
  // No optimistic removal: the item stays until the list refetch confirms it.
  const deleteTask = useMutation(
    trpc.task.delete.mutationOptions({
      onSuccess: () => notifySuccess(TASK_DELETED_MESSAGE),
      onError: (error) => notifyError(getErrorMessage(error)),
      // Refetch on errors too: a NOT_FOUND means the task is already gone, so
      // the list must resync with the server. pathKey() covers every page.
      // Returning the promise keeps the button pending until the refetch ends.
      onSettled: () => queryClient.invalidateQueries({ queryKey: trpc.task.list.pathKey() }),
    }),
  );

  function handleDelete() {
    if (!confirm(`Delete "${task.titulo}"?`)) return;
    deleteTask.mutate({ id: task.id });
  }

  return (
    <li className={styles.item}>
      <div className={styles.content}>
        <h2 className={styles.title}>{task.titulo}</h2>
        {task.descricao && <p className={styles.description}>{task.descricao}</p>}
        <time className={styles.date} dateTime={task.dataCriacao}>
          {dateFormatter.format(new Date(task.dataCriacao))} UTC
        </time>
      </div>
      <div className={styles.actions}>
        <Link href={`/tasks/${task.id}/edit`}>Edit</Link>
        <button
          type="button"
          onClick={handleDelete}
          // Disabled while pending, which also blocks double submissions.
          disabled={deleteTask.isPending}
          aria-label={`${deleteTask.isPending ? "Deleting" : "Delete"} ${task.titulo}`}
        >
          {deleteTask.isPending ? "Deleting…" : "Delete"}
        </button>
      </div>
    </li>
  );
}
