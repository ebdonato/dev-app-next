import { beforeEach, describe, expect, it } from "vitest";
import { reset } from "@/features/tasks/task.repository";
import { GET, POST } from "./route";

const BASE = "http://localhost/api/trpc";

beforeEach(() => {
  reset();
});

describe("tRPC route handler", () => {
  it("serves queries over GET", async () => {
    const input = encodeURIComponent(JSON.stringify({}));
    const res = await GET(new Request(`${BASE}/task.list?input=${input}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: { data: { items: [], nextCursor: null } } });
  });

  it("responds NOT_FOUND for an unknown procedure", async () => {
    const res = await GET(new Request(`${BASE}/missing`));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.data.code).toBe("NOT_FOUND");
  });

  it("serves mutations over POST", async () => {
    const res = await POST(
      new Request(`${BASE}/task.create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ titulo: "Via HTTP" }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result.data.titulo).toBe("Via HTTP");
  });
});
