import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as taskRepository from "./task.repository";
import type { Cursor, Task } from "./task.schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const START = new Date("2026-01-01T00:00:00.000Z").getTime();

/** Creates `count` tasks one second apart, so their order is known. */
function createTasks(count: number): Task[] {
  return Array.from({ length: count }, (_, index) => {
    vi.setSystemTime(START + index * 1000);
    return taskRepository.create({ titulo: `Task ${index + 1}` });
  });
}

/** Walks every page with the given limit and returns them. */
function collectPages(limit: number): Task[][] {
  const pages: Task[][] = [];
  let cursor: Cursor | null = null;
  do {
    const page = taskRepository.list({ limit, cursor });
    pages.push(page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return pages;
}

beforeEach(() => {
  vi.useFakeTimers();
  taskRepository.reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("create", () => {
  it("generates a UUID id and an ISO creation date", () => {
    vi.setSystemTime(START);
    const task = taskRepository.create({ titulo: "Write tests", descricao: "Repository" });

    expect(task.id).toMatch(UUID);
    expect(task.dataCriacao).toBe(new Date(START).toISOString());
    expect(task).toMatchObject({ titulo: "Write tests", descricao: "Repository" });
  });

  it("generates a different id for each task", () => {
    const first = taskRepository.create({ titulo: "One" });
    const second = taskRepository.create({ titulo: "Two" });

    expect(first.id).not.toBe(second.id);
  });

  it("keeps an absent description absent", () => {
    const task = taskRepository.create({ titulo: "No description" });

    expect(task).not.toHaveProperty("descricao");
  });
});

describe("getById", () => {
  it("returns the created task", () => {
    const task = taskRepository.create({ titulo: "Find me" });

    expect(taskRepository.getById(task.id)).toEqual(task);
  });

  it("returns null for an unknown id", () => {
    expect(taskRepository.getById(crypto.randomUUID())).toBeNull();
  });
});

describe("update", () => {
  it("replaces titulo and descricao, keeping id and dataCriacao", () => {
    vi.setSystemTime(START);
    const task = taskRepository.create({ titulo: "Old title", descricao: "Old" });
    vi.setSystemTime(START + 60_000);

    const updated = taskRepository.update({ id: task.id, titulo: "New title", descricao: "New" });

    expect(updated).toEqual({
      id: task.id,
      titulo: "New title",
      descricao: "New",
      dataCriacao: task.dataCriacao,
    });
    expect(taskRepository.getById(task.id)).toEqual(updated);
  });

  it("clears the description when it is omitted", () => {
    const task = taskRepository.create({ titulo: "Task", descricao: "Details" });

    const updated = taskRepository.update({ id: task.id, titulo: "Task" });

    expect(updated).not.toHaveProperty("descricao");
    expect(taskRepository.getById(task.id)).not.toHaveProperty("descricao");
  });

  it("returns null for an unknown id", () => {
    expect(taskRepository.update({ id: crypto.randomUUID(), titulo: "Ghost" })).toBeNull();
  });
});

describe("remove", () => {
  it("removes the task and returns true", () => {
    const task = taskRepository.create({ titulo: "Delete me" });

    expect(taskRepository.remove(task.id)).toBe(true);
    expect(taskRepository.getById(task.id)).toBeNull();
    expect(taskRepository.list({ limit: 10 }).items).toEqual([]);
  });

  it("returns false for an unknown id", () => {
    expect(taskRepository.remove(crypto.randomUUID())).toBe(false);
  });
});

describe("copies", () => {
  it("does not let callers mutate stored tasks", () => {
    const created = taskRepository.create({ titulo: "Original" });
    created.titulo = "Mutated";

    const fetched = taskRepository.getById(created.id)!;
    fetched.titulo = "Mutated again";
    taskRepository.list({ limit: 10 }).items[0]!.titulo = "Mutated in list";

    expect(taskRepository.getById(created.id)?.titulo).toBe("Original");
  });
});

describe("list", () => {
  it("returns an empty page for an empty store", () => {
    expect(taskRepository.list({ limit: 10 })).toEqual({ items: [], nextCursor: null });
  });

  it("orders tasks newest first", () => {
    const [first, second, third] = createTasks(3);

    const ids = taskRepository.list({ limit: 10 }).items.map((task) => task.id);

    expect(ids).toEqual([third!.id, second!.id, first!.id]);
  });

  it("orders tasks with the same creation date by id descending", () => {
    vi.setSystemTime(START);
    const tasks = Array.from({ length: 5 }, (_, index) =>
      taskRepository.create({ titulo: `Tie ${index}` }),
    );

    const ids = taskRepository.list({ limit: 10 }).items.map((task) => task.id);

    expect(ids).toEqual(tasks.map((task) => task.id).sort().reverse());
  });

  it("paginates 25 tasks into pages of 10, 10 and 5 without gaps or duplicates", () => {
    const tasks = createTasks(25);

    const pages = collectPages(10);

    expect(pages.map((page) => page.length)).toEqual([10, 10, 5]);
    const ids = pages.flat().map((task) => task.id);
    expect(new Set(ids).size).toBe(25);
    expect(ids).toEqual(tasks.map((task) => task.id).reverse());
  });

  it("returns a null nextCursor on the last page", () => {
    createTasks(10);

    expect(taskRepository.list({ limit: 10 }).nextCursor).toBeNull();
  });

  it("stays correct after deleting the cursor task and an earlier task", () => {
    const tasks = createTasks(25);
    const expected = tasks.map((task) => task.id).reverse();

    const firstPage = taskRepository.list({ limit: 10 });
    const cursorTask = firstPage.items.at(-1)!;
    const earlierTask = firstPage.items[0]!;
    taskRepository.remove(cursorTask.id);
    taskRepository.remove(earlierTask.id);

    const secondPage = taskRepository.list({ limit: 10, cursor: firstPage.nextCursor });

    // The next page starts right after the deleted cursor task: nothing skipped or repeated.
    expect(secondPage.items.map((task) => task.id)).toEqual(expected.slice(10, 20));
  });
});

describe("seed", () => {
  it("inserts the fictitious tasks, listed newest first", () => {
    taskRepository.seed();

    const { items, nextCursor } = taskRepository.list({ limit: 50 });

    expect(items).toHaveLength(25);
    expect(nextCursor).toBeNull();
    const dates = items.map((task) => task.dataCriacao);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
