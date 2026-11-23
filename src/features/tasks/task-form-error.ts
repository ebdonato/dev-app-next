import { TRPCClientError } from "@trpc/client";
import { getErrorMessage } from "@/lib/get-error-message";
import type { AppRouter } from "@/trpc/router";
import type { TaskFormServerError } from "./components/task-form";

/**
 * Maps a failed create/update mutation to the `serverError` shape TaskForm
 * understands, so the form itself stays unaware of tRPC. Shared by the create
 * and edit wrappers.
 */
export function toTaskFormServerError(error: unknown): TaskFormServerError {
  // The formatter types field errors loosely (the cause is any ZodError);
  // these are the only fields a task form has.
  const fieldErrors =
    error instanceof TRPCClientError
      ? ((error as TRPCClientError<AppRouter>).data?.zodError?.fieldErrors as
          | TaskFormServerError["fieldErrors"]
          | undefined)
      : undefined;

  if (fieldErrors) {
    // Field messages already show next to their inputs; repeating the first
    // one as a general alert would only duplicate it.
    return { fieldErrors: { titulo: fieldErrors.titulo, descricao: fieldErrors.descricao } };
  }

  return { message: getErrorMessage(error) };
}
