"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { TASK_UPDATED_MESSAGE } from "@/components/feedback/messages";
import { useTRPC } from "@/trpc/client";
import type { CreateTaskInput } from "../task.schema";
import { toTaskFormServerError } from "../task-form-error";
import { TaskForm } from "./task-form";

type EditTaskFormProps = {
  id: string;
  initialValues: { titulo: string; descricao?: string };
};

/** Edit flow: same form, the update mutation, and a full replace of the editable fields. */
export function EditTaskForm({ id, initialValues }: Readonly<EditTaskFormProps>) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { notifySuccess } = useFeedback();

  const updateTask = useMutation(
    trpc.task.update.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: trpc.task.list.pathKey() }),
          queryClient.invalidateQueries({ queryKey: trpc.task.byId.queryKey({ id }) }),
        ]);
        notifySuccess(TASK_UPDATED_MESSAGE);
        router.push("/");
      },
    }),
  );

  async function handleSubmit(values: CreateTaskInput) {
    if (updateTask.isPending) return;
    // dataCriacao is never sent: the repository keeps the original value.
    await updateTask.mutateAsync({ id, ...values });
  }

  return (
    <TaskForm
      initialValues={initialValues}
      submitLabel="Save changes"
      onSubmit={handleSubmit}
      isSubmitting={updateTask.isPending}
      serverError={updateTask.error ? toTaskFormServerError(updateTask.error) : undefined}
    />
  );
}
