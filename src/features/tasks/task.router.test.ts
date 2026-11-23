import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createCallerFactory } from "@/trpc/init";
import { appRouter } from "@/trpc/router";
import { reset } from "./task.repository";

const createCaller = createCallerFactory(appRouter);
const caller = createCaller({});

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

async function expectTrpcError(promise: Promise<unknown>, code: TRPCError["code"]) {
  const error = await promise.then(
    () => {
      throw new Error("Expected the call to fail");
    },
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(TRPCError);
  expect((error as TRPCError).code).toBe(code);
  return error as TRPCError;
}

beforeEach(() => {
  reset();
});

describe("task.create", () => {
  it.each(["", "   "])("rejects a missing title (%j) with BAD_REQUEST", async (titulo) => {
    const error = await expectTrpcError(caller.task.create({ titulo }), "BAD_REQUEST");
    // The cause is what the error formatter flattens into `zodError` over HTTP.
    expect(error.cause).toBeInstanceOf(z.ZodError);
    expect(z.flattenError(error.cause as z.ZodError).fieldErrors).toMatchObject({
      titulo: ["Title is required."],
    });
  });

  it("creates a task that appears first in the list", async () => {
    await caller.task.create({ titulo: "Older" });
    const task = await caller.task.create({ titulo: "Newer", descricao: "Details" });

    expect(task.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(task.dataCriacao).toISOString()).toBe(task.dataCriacao);
    expect(task).toMatchObject({ titulo: "Newer", descricao: "Details" });

    const { items } = await caller.task.list({});
    expect(items[0]).toEqual(task);
  });
});

describe("task.list", () => {
  it("chains pages with nextCursor, without duplicates, ending with null", async () => {
    for (let i = 1; i <= 5; i++) await caller.task.create({ titulo: `Task ${i}` });

    const first = await caller.task.list({ limit: 2 });
    const second = await caller.task.list({ limit: 2, cursor: first.nextCursor });
    const third = await caller.task.list({ limit: 2, cursor: second.nextCursor });

    const ids = [...first.items, ...second.items, ...third.items].map((t) => t.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(first.nextCursor).not.toBeNull();
    expect(third.nextCursor).toBeNull();
  });

  it("rejects an invalid limit with BAD_REQUEST", async () => {
    await expectTrpcError(caller.task.list({ limit: 0 }), "BAD_REQUEST");
  });
});

describe("task.byId", () => {
  it("returns an existing task", async () => {
    const task = await caller.task.create({ titulo: "Find me" });
    expect(await caller.task.byId({ id: task.id })).toEqual(task);
  });

  it("responds NOT_FOUND for an unknown id", async () => {
    const error = await expectTrpcError(caller.task.byId({ id: UNKNOWN_ID }), "NOT_FOUND");
    expect(error.message).toBe(`Task ${UNKNOWN_ID} not found.`);
  });
});

describe("task.update", () => {
  it("replaces the editable fields and keeps id and dataCriacao", async () => {
    const task = await caller.task.create({ titulo: "Draft", descricao: "Old" });

    const updated = await caller.task.update({ id: task.id, titulo: "Final" });

    expect(updated).toEqual({ id: task.id, titulo: "Final", dataCriacao: task.dataCriacao });
    expect(await caller.task.byId({ id: task.id })).toEqual(updated);
  });

  it("responds NOT_FOUND for an unknown id", async () => {
    const error = await expectTrpcError(
      caller.task.update({ id: UNKNOWN_ID, titulo: "Nope" }),
      "NOT_FOUND",
    );
    expect(error.message).toBe(`Task ${UNKNOWN_ID} not found.`);
  });
});

describe("task.delete", () => {
  it("removes the task and returns its id", async () => {
    const task = await caller.task.create({ titulo: "Delete me" });

    expect(await caller.task.delete({ id: task.id })).toEqual({ id: task.id });
    expect((await caller.task.list({})).items).toHaveLength(0);
    await expectTrpcError(caller.task.byId({ id: task.id }), "NOT_FOUND");
  });

  it("responds NOT_FOUND for an unknown id", async () => {
    const error = await expectTrpcError(caller.task.delete({ id: UNKNOWN_ID }), "NOT_FOUND");
    expect(error.message).toBe(`Task ${UNKNOWN_ID} not found.`);
  });
});
