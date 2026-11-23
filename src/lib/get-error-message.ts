import { TRPCClientError } from "@trpc/client";
import type { AppRouter } from "@/trpc/router";

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";
export const NETWORK_ERROR_MESSAGE =
  "Could not reach the server. Check your connection and try again.";

/**
 * Turns any error into a sentence that is safe to show to users.
 *
 * In tRPC v11 the raw message of an input-validation error is a serialized
 * issue list, so the Zod messages (exposed as `zodError` by our error
 * formatter) are preferred. Messages from non-tRPC errors are never shown:
 * they may be technical.
 */
export function getErrorMessage(error: unknown): string {
  if (!(error instanceof TRPCClientError)) return GENERIC_ERROR_MESSAGE;

  const { data } = error as TRPCClientError<AppRouter>;
  // No error payload means the server never answered (e.g. "Failed to fetch"):
  // the raw message is a browser network error, not something for users.
  if (!data) return NETWORK_ERROR_MESSAGE;

  const zodError = data.zodError;
  if (zodError) {
    const fieldMessages: (string[] | undefined)[] = Object.values(zodError.fieldErrors);
    const firstFieldMessage = fieldMessages.flat().find(Boolean);
    return firstFieldMessage ?? zodError.formErrors[0] ?? GENERIC_ERROR_MESSAGE;
  }

  return error.message.trim() || GENERIC_ERROR_MESSAGE;
}
