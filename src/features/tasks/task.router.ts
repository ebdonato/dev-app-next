import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "@/trpc/init";
import * as taskRepository from "./task.repository";
import {
  createTaskInput,
  listTasksInput,
  taskIdInput,
  updateTaskInput,
} from "./task.schema";

/**
 * Thin API layer over the repository: validate input (schemas), call one
 * repository function, and translate "not found" results into tRPC errors.
 * Business rules live in the repository, not here.
 */

function taskNotFound(id: string): TRPCError {
  return new TRPCError({ code: "NOT_FOUND", message: `Task ${id} not found.` });
}

export const taskRouter = router({
  list: publicProcedure
    .input(listTasksInput)
    .query(({ input }) => taskRepository.list(input)),

  byId: publicProcedure.input(taskIdInput).query(({ input }) => {
    const task = taskRepository.getById(input.id);
    if (!task) throw taskNotFound(input.id);
    return task;
  }),

  create: publicProcedure
    .input(createTaskInput)
    .mutation(({ input }) => taskRepository.create(input)),

  update: publicProcedure.input(updateTaskInput).mutation(({ input }) => {
    const task = taskRepository.update(input);
    if (!task) throw taskNotFound(input.id);
    return task;
  }),

  delete: publicProcedure.input(taskIdInput).mutation(({ input }) => {
    if (!taskRepository.remove(input.id)) throw taskNotFound(input.id);
    return { id: input.id };
  }),
});
