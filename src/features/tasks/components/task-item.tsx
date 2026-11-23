"use client";

import Link from "next/link";
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
        {/* Wired in Step 9 (delete with feedback). */}
        <button type="button">Delete</button>
      </div>
    </li>
  );
}
