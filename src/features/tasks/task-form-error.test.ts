import { createTRPCClient, httpLink } from "@trpc/client";
import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/trpc/[trpc]/route";
import { GENERIC_ERROR_MESSAGE } from "@/lib/get-error-message";
import type { AppRouter } from "@/trpc/router";
import { reset } from "./task.repository";
import { toTaskFormServerError } from "./task-form-error";

// A real tRPC client served in-process by the route handler, so the errors
// below have exactly the shape the browser receives.
const client = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: "http://localhost/api/trpc",
      fetch: (url, init) => {
        const request = new Request(url, init);
        return request.method === "POST" ? POST(request) : GET(request);
      },
    }),
  ],
});

async function errorFrom(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the call to fail.");
}

beforeEach(() => {
  reset();
});

describe("toTaskFormServerError", () => {
  it("maps validation errors to per-field messages", async () => {
    const error = await errorFrom(client.task.create.mutate({ titulo: "   " }));

    expect(toTaskFormServerError(error)).toEqual({
      fieldErrors: { titulo: ["Title is required."], descricao: undefined },
    });
  });

  it("maps a NOT_FOUND update to a general message", async () => {
    const id = crypto.randomUUID();
    const error = await errorFrom(client.task.update.mutate({ id, titulo: "Renamed" }));

    expect(toTaskFormServerError(error)).toEqual({ message: `Task ${id} not found.` });
  });

  it("falls back to a generic message for non-tRPC errors", () => {
    expect(toTaskFormServerError(new Error("socket hang up"))).toEqual({
      message: GENERIC_ERROR_MESSAGE,
    });
  });
});
