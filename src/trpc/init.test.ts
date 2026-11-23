import { TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createTRPCContext, publicProcedure, router } from "./init";

// Test-only router: the real routes have no input yet to exercise the formatter.
const testRouter = router({
  greet: publicProcedure
    .input(z.object({ name: z.string().min(1, "Name is required.") }))
    .query(({ input }) => `Hello, ${input.name}`),
  missing: publicProcedure.query(() => {
    throw new TRPCError({ code: "NOT_FOUND", message: "Nothing here." });
  }),
});

function call(path: string, input?: unknown) {
  const query = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify(input))}`;
  const req = new Request(`http://localhost/api/trpc/${path}${query}`);
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: testRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
  });
}

describe("error formatter", () => {
  it("adds flattened Zod field errors to validation failures", async () => {
    const res = await call("greet", { name: "" });
    const { error } = await res.json();

    expect(res.status).toBe(400);
    expect(error.data.code).toBe("BAD_REQUEST");
    expect(error.data.zodError).toEqual({
      formErrors: [],
      fieldErrors: { name: ["Name is required."] },
    });
  });

  it("sets zodError to null for non-validation errors", async () => {
    const res = await call("missing");
    const { error } = await res.json();

    expect(res.status).toBe(404);
    expect(error.data.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Nothing here.");
    expect(error.data.zodError).toBeNull();
  });

  it("passes valid input through", async () => {
    const res = await call("greet", { name: "Ada" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: { data: "Hello, Ada" } });
  });
});
