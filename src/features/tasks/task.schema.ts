import { z } from "zod";

/**
 * Single source of truth for the task shape and its validation rules.
 * Shared by the backend (tRPC inputs) and the form (client-side validation),
 * so messages here are user-facing.
 */

const TITULO_MAX = 120;
const DESCRICAO_MAX = 1000;

// Trim before validating, so a whitespace-only title counts as empty.
const titulo = z
  .string({ error: "Title is required." })
  .trim()
  .min(1, "Title is required.")
  .max(TITULO_MAX, `Title must be at most ${TITULO_MAX} characters.`);

// An empty (or whitespace-only) description is stored as "no description".
const descricao = z
  .string()
  .trim()
  .max(DESCRICAO_MAX, `Description must be at most ${DESCRICAO_MAX} characters.`)
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const id = z.uuid("Invalid task id.");

// UTC ISO 8601, as produced by Date.prototype.toISOString().
const dataCriacao = z.iso.datetime("Invalid creation date.");

export const taskSchema = z.object({ id, titulo, descricao, dataCriacao });

export const createTaskInput = z.object({ titulo, descricao });

// Full replace of the editable fields; id and dataCriacao can't be changed.
export const updateTaskInput = createTaskInput.extend({ id });

export const taskIdInput = z.object({ id });

// Keyset of the last item seen: stable even when earlier tasks are deleted.
export const cursorSchema = z.object({ dataCriacao, id });

export const listTasksInput = z.object({
  limit: z.number().int().min(1).max(50).default(10),
  // TanStack infinite queries send `null` for the first page.
  cursor: cursorSchema.nullish(),
});

export type Task = z.infer<typeof taskSchema>;
export type CreateTaskInput = z.infer<typeof createTaskInput>;
export type UpdateTaskInput = z.infer<typeof updateTaskInput>;
export type ListTasksInput = z.infer<typeof listTasksInput>;
export type Cursor = z.infer<typeof cursorSchema>;
