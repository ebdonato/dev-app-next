import { initTRPC } from "@trpc/server";
import { z } from "zod";

/**
 * Request context shared by the HTTP handler and (Step 6) the server-side
 * proxy. It receives the request headers to keep one conventional signature,
 * but the app has no auth, so the context is empty.
 */
export async function createTRPCContext(opts: { headers: Headers }) {
  void opts;
  return {};
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  // Expose flattened Zod field errors so the form can show a message per field
  // (e.g. `fieldErrors.titulo`). No transformer: all payloads are JSON-safe.
  errorFormatter({ shape, error }) {
    const zodError =
      error.code === "BAD_REQUEST" && error.cause instanceof z.ZodError
        ? z.flattenError(error.cause)
        : null;
    return { ...shape, data: { ...shape.data, zodError } };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
