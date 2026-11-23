import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";

const BASE = "http://localhost/api/trpc";

describe("tRPC route handler", () => {
  it("serves the health query over GET", async () => {
    const res = await GET(new Request(`${BASE}/health`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: { data: { status: "ok" } } });
  });

  it("responds NOT_FOUND for an unknown procedure", async () => {
    const res = await GET(new Request(`${BASE}/missing`));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.data.code).toBe("NOT_FOUND");
  });

  it("accepts POST requests (used by mutations)", async () => {
    const res = await POST(
      new Request(`${BASE}/health`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    const body = await res.json();

    // `health` is a query, so the POST reaches tRPC and is rejected as a method
    // mismatch rather than a 404/405 from the route handler itself.
    expect(body.error.data.path).toBe("health");
  });
});
