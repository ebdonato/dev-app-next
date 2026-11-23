"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { TASK_CREATED_MESSAGE } from "@/components/feedback/messages";
import { useTRPC } from "@/trpc/client";
import type { CreateTaskInput } from "../task.schema";
import { toTaskFormServerError } from "../task-form-error";
import { TaskForm } from "./task-form";

/** Create flow: owns the mutation and what happens after it; TaskForm owns the fields. */
export function CreateTaskForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { notifySuccess } = useFeedback();

  const createTask = useMutation(
    trpc.task.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.task.list.pathKey() });
        // The feedback region lives in the root layout, so the message survives
        // the navigation below.
        notifySuccess(TASK_CREATED_MESSAGE);
        router.push("/");
      },
    }),
  );

  async function handleSubmit(values: CreateTaskInput) {
    if (createTask.isPending) return;
    await createTask.mutateAsync(values);
  }

  return (
    <TaskForm
      submitLabel="Create task"
      onSubmit={handleSubmit}
      isSubmitting={createTask.isPending}
      serverError={createTask.error ? toTaskFormServerError(createTask.error) : undefined}
    />
  );
}
