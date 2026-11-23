import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditTaskForm } from "@/features/tasks/components/edit-task-form";
import type { Task } from "@/features/tasks/task.schema";
import { getQueryClient, trpc } from "@/trpc/server";

// The task can change at runtime: render on every request, never at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit task | Task Manager",
};

async function findTask(id: string): Promise<Task | null> {
  try {
    return await getQueryClient().fetchQuery(trpc.task.byId.queryOptions({ id }));
  } catch (error) {
    // An unknown id (NOT_FOUND) or a malformed one (BAD_REQUEST) both mean
    // there is no such task. Anything else goes to the route error boundary.
    if (error instanceof TRPCError && (error.code === "NOT_FOUND" || error.code === "BAD_REQUEST")) {
      return null;
    }
    throw error;
  }
}

export default async function EditTaskPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const task = await findTask(id);
  if (!task) notFound();

  return (
    <>
      <h1>Edit task</h1>
      <EditTaskForm
        id={task.id}
        initialValues={{ titulo: task.titulo, descricao: task.descricao }}
      />
    </>
  );
}
