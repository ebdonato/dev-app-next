import type { Metadata } from "next";
import { CreateTaskForm } from "@/features/tasks/components/create-task-form";

export const metadata: Metadata = {
  title: "New task | Task Manager",
};

export default function NewTaskPage() {
  return (
    <>
      <h1>New task</h1>
      <CreateTaskForm />
    </>
  );
}
