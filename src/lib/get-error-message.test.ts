import { createTRPCClient, httpLink } from "@trpc/client";
import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/trpc/[trpc]/route";
import { reset } from "@/features/tasks/task.repository";
import type { AppRouter } from "@/trpc/router";
import {
  GENERIC_ERROR_MESSAGE,
  getErrorMessage,
  NETWORK_ERROR_MESSAGE,
} from "./get-error-message";

// A real tRPC client whose fetch is served in-process by the route handler,
// so the errors below are exactly what the browser receives.
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

describe("getErrorMessage", () => {
  it("returns the first field message of a validation error", async () => {
    const error = await errorFrom(client.task.create.mutate({ titulo: "   " }));

    expect(getErrorMessage(error)).toBe("Title is required.");
  });

  it("returns the server message of a NOT_FOUND error", async () => {
    const id = "6f1d2b9a-3c4e-4f5a-8b7c-9d0e1f2a3b4c";
    const error = await errorFrom(client.task.delete.mutate({ id }));

    expect(getErrorMessage(error)).toBe(`Task ${id} not found.`);
  });

  it("falls back to the generic message for a tRPC error without a message", async () => {
    const error = await errorFrom(client.task.byId.query({ id: crypto.randomUUID() }));
    (error as Error).message = "";

    expect(getErrorMessage(error)).toBe(GENERIC_ERROR_MESSAGE);
  });

  it("returns the network message when the server can't be reached", async () => {
    const offlineClient = createTRPCClient<AppRouter>({
      links: [
        httpLink({
          url: "http://localhost/api/trpc",
          fetch: () => Promise.reject(new TypeError("Failed to fetch")),
        }),
      ],
    });
    const error = await errorFrom(offlineClient.task.list.query({}));

    expect(getErrorMessage(error)).toBe(NETWORK_ERROR_MESSAGE);
  });

  it.each([
    ["a plain Error", new Error("ECONNRESET at socket.js:42")],
    ["a string", "boom"],
    ["undefined", undefined],
  ])("falls back to the generic message for %s", (_label, error) => {
    expect(getErrorMessage(error)).toBe(GENERIC_ERROR_MESSAGE);
  });
});
