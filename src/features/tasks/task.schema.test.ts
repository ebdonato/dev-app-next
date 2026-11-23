import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  createTaskInput,
  listTasksInput,
  taskIdInput,
  taskSchema,
  updateTaskInput,
} from "./task.schema";

function messagesOf(result: z.ZodSafeParseResult<unknown>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

const validId = randomUUID();
const validDate = new Date("2026-11-22T10:00:00.000Z").toISOString();

describe("createTaskInput", () => {
  it.each([
    ["missing", {}],
    ["empty", { titulo: "" }],
    ["whitespace-only", { titulo: "   " }],
  ])("rejects a %s title with 'Title is required.'", (_, input) => {
    const result = createTaskInput.safeParse(input);
    expect(result.success).toBe(false);
    expect(messagesOf(result)).toEqual(["Title is required."]);
  });

  it("trims the title", () => {
    expect(createTaskInput.parse({ titulo: "  Buy milk  " }).titulo).toBe("Buy milk");
  });

  it("accepts a 120-character title and rejects 121", () => {
    expect(createTaskInput.safeParse({ titulo: "a".repeat(120) }).success).toBe(true);
    const result = createTaskInput.safeParse({ titulo: "a".repeat(121) });
    expect(messagesOf(result)).toEqual(["Title must be at most 120 characters."]);
  });

  it.each(["", "   "])("parses description %j to undefined", (descricao) => {
    expect(createTaskInput.parse({ titulo: "Task", descricao }).descricao).toBeUndefined();
  });

  it("trims the description", () => {
    expect(createTaskInput.parse({ titulo: "Task", descricao: " Notes " }).descricao).toBe("Notes");
  });

  it("accepts a 1000-character description and rejects 1001", () => {
    expect(createTaskInput.safeParse({ titulo: "Task", descricao: "a".repeat(1000) }).success).toBe(true);
    const result = createTaskInput.safeParse({ titulo: "Task", descricao: "a".repeat(1001) });
    expect(messagesOf(result)).toEqual(["Description must be at most 1000 characters."]);
  });

  it("strips unknown fields", () => {
    const parsed = createTaskInput.parse({ titulo: "Task", id: validId, extra: true });
    expect(parsed).toEqual({ titulo: "Task" });
  });
});

describe("updateTaskInput", () => {
  it("accepts a valid update", () => {
    const parsed = updateTaskInput.parse({ id: validId, titulo: " New ", descricao: "" });
    expect(parsed).toEqual({ id: validId, titulo: "New", descricao: undefined });
  });

  it("requires a valid UUID id", () => {
    expect(updateTaskInput.safeParse({ titulo: "Task" }).success).toBe(false);
    expect(updateTaskInput.safeParse({ id: "123", titulo: "Task" }).success).toBe(false);
  });

  it("applies the same title rules as create", () => {
    const result = updateTaskInput.safeParse({ id: validId, titulo: "  " });
    expect(messagesOf(result)).toEqual(["Title is required."]);
  });

  it("applies the same description rules as create", () => {
    const result = updateTaskInput.safeParse({ id: validId, titulo: "Task", descricao: "a".repeat(1001) });
    expect(messagesOf(result)).toEqual(["Description must be at most 1000 characters."]);
  });
});

describe("taskIdInput", () => {
  it("accepts a UUID and rejects anything else", () => {
    expect(taskIdInput.safeParse({ id: validId }).success).toBe(true);
    expect(messagesOf(taskIdInput.safeParse({ id: "not-a-uuid" }))).toEqual(["Invalid task id."]);
  });
});

describe("listTasksInput", () => {
  it("defaults limit to 10 and allows an absent cursor", () => {
    expect(listTasksInput.parse({})).toEqual({ limit: 10 });
  });

  it.each([1, 50])("accepts limit %i", (limit) => {
    expect(listTasksInput.safeParse({ limit }).success).toBe(true);
  });

  it.each([0, 51, 2.5])("rejects limit %d", (limit) => {
    expect(listTasksInput.safeParse({ limit }).success).toBe(false);
  });

  it("accepts a null cursor as the first page", () => {
    expect(listTasksInput.parse({ cursor: null })).toEqual({ limit: 10, cursor: null });
  });

  it("accepts a valid keyset cursor", () => {
    const cursor = { dataCriacao: validDate, id: validId };
    expect(listTasksInput.parse({ limit: 5, cursor })).toEqual({ limit: 5, cursor });
  });

  it.each([
    ["bad date", { dataCriacao: "yesterday", id: validId }],
    ["bad id", { dataCriacao: validDate, id: "42" }],
    ["missing fields", {}],
  ])("rejects a malformed cursor (%s)", (_, cursor) => {
    expect(listTasksInput.safeParse({ cursor }).success).toBe(false);
  });
});

describe("taskSchema", () => {
  it("accepts a well-formed task", () => {
    const task = { id: validId, titulo: "Task", descricao: "Notes", dataCriacao: validDate };
    expect(taskSchema.parse(task)).toEqual(task);
  });

  it("rejects a non-ISO creation date", () => {
    const result = taskSchema.safeParse({ id: validId, titulo: "Task", dataCriacao: "22/11/2026" });
    expect(messagesOf(result)).toEqual(["Invalid creation date."]);
  });
});
