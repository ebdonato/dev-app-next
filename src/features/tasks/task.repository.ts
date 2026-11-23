import type {
  CreateTaskInput,
  Cursor,
  ListTasksInput,
  Task,
  UpdateTaskInput,
} from "./task.schema";

/**
 * In-memory task storage and business rules (ids, timestamps, ordering,
 * pagination). Framework-agnostic on purpose: the tRPC router is a thin layer
 * on top, and this module could be swapped for a database without touching
 * the API or the UI. Inputs are already validated by the Step 2 schemas.
 */

type TaskStore = Map<string, Task>;

// Next.js dev hot reloads re-evaluate modules, which would reset a plain
// module-level Map. Keeping the store on globalThis gives one store per
// server process.
const globalForTasks = globalThis as typeof globalThis & {
  __taskStore?: TaskStore;
};

function getStore(): TaskStore {
  if (!globalForTasks.__taskStore) {
    const store: TaskStore = new Map();
    // Seeding is tied to store creation, so hot reloads never seed twice.
    // Tests (NODE_ENV=test) and production always start empty.
    if (process.env.NODE_ENV === "development") insertSeed(store);
    globalForTasks.__taskStore = store;
  }
  return globalForTasks.__taskStore;
}

function buildTask(
  id: string,
  dataCriacao: string,
  { titulo, descricao }: CreateTaskInput,
): Task {
  // Store descricao only when present, so "absent" stays absent.
  return { id, titulo, ...(descricao !== undefined && { descricao }), dataCriacao };
}

const copy = (task: Task): Task => ({ ...task });

// Newest first; id breaks ties so the order is stable. ISO 8601 strings from
// toISOString() share one format, so they compare correctly as plain strings.
function compareNewestFirst(a: Task, b: Task): number {
  if (a.dataCriacao !== b.dataCriacao) return a.dataCriacao < b.dataCriacao ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}

// Keyset comparison: the cursor task itself may have been deleted already.
function isAfterCursor(task: Task, cursor: Cursor): boolean {
  return (
    task.dataCriacao < cursor.dataCriacao ||
    (task.dataCriacao === cursor.dataCriacao && task.id < cursor.id)
  );
}

export function create(input: CreateTaskInput): Task {
  const task = buildTask(crypto.randomUUID(), new Date().toISOString(), input);
  getStore().set(task.id, task);
  return copy(task);
}

export function list({ limit, cursor }: ListTasksInput): {
  items: Task[];
  nextCursor: Cursor | null;
} {
  const sorted = [...getStore().values()].sort(compareNewestFirst);
  const remaining = cursor ? sorted.filter((task) => isAfterCursor(task, cursor)) : sorted;

  // Fetch one extra item to know whether another page exists.
  const page = remaining.slice(0, limit + 1);
  const hasMore = page.length > limit;
  const items = page.slice(0, limit);
  const last = items.at(-1);

  return {
    items: items.map(copy),
    nextCursor: hasMore && last ? { dataCriacao: last.dataCriacao, id: last.id } : null,
  };
}

export function getById(id: string): Task | null {
  const task = getStore().get(id);
  return task ? copy(task) : null;
}

export function update({ id, ...fields }: UpdateTaskInput): Task | null {
  const store = getStore();
  const existing = store.get(id);
  if (!existing) return null;

  // Full replace of the editable fields; id and dataCriacao are preserved.
  const task = buildTask(id, existing.dataCriacao, fields);
  store.set(id, task);
  return copy(task);
}

export function remove(id: string): boolean {
  return getStore().delete(id);
}

/** Empties the store. Intended for test isolation. */
export function reset(): void {
  getStore().clear();
}

/** Inserts the fictitious demo tasks. */
export function seed(): void {
  insertSeed(getStore());
}

const SEED_TASKS: CreateTaskInput[] = [
  { titulo: "Review sprint backlog", descricao: "Check priorities with the team before planning." },
  { titulo: "Write release notes" },
  { titulo: "Update project README", descricao: "Add setup steps and architecture overview." },
  { titulo: "Plan team retrospective" },
  { titulo: "Fix flaky login test", descricao: "Happens intermittently on CI." },
  { titulo: "Prepare demo for stakeholders" },
  { titulo: "Refactor settings page", descricao: "Split into smaller components." },
  { titulo: "Upgrade dependencies" },
  { titulo: "Document API endpoints", descricao: "Include error codes for each procedure." },
  { titulo: "Review pull requests" },
  { titulo: "Organize design review" },
  { titulo: "Clean up feature flags", descricao: "Remove flags that are fully rolled out." },
  { titulo: "Set up error monitoring" },
  { titulo: "Write onboarding checklist", descricao: "For new engineers joining the squad." },
  { titulo: "Benchmark list rendering" },
  { titulo: "Draft Q3 roadmap" },
  { titulo: "Archive old tickets", descricao: "Anything untouched for six months." },
  { titulo: "Improve form accessibility" },
  { titulo: "Schedule 1:1 meetings" },
  { titulo: "Add loading states", descricao: "Lists and forms should show progress." },
  { titulo: "Review cloud costs" },
  { titulo: "Pair on caching strategy" },
  { titulo: "Write unit tests for utils", descricao: "Cover date formatting helpers." },
  { titulo: "Update team wiki" },
  { titulo: "Book conference room for workshop" },
];

function insertSeed(store: TaskStore): void {
  const ONE_MINUTE = 60_000;
  const now = Date.now();
  // Staggered timestamps keep the order deterministic: the last entry above
  // is the newest task.
  SEED_TASKS.forEach((input, index) => {
    const dataCriacao = new Date(now - (SEED_TASKS.length - 1 - index) * ONE_MINUTE).toISOString();
    const task = buildTask(crypto.randomUUID(), dataCriacao, input);
    store.set(task.id, task);
  });
}
