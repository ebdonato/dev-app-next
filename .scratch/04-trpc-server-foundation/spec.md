# Spec: tRPC server foundation

Status: ready-for-agent
Plan step: 4 of 13 (see `docs/implementation-plan.md`, Step 4)
Depends on: Step 1 (project scaffold and tooling)
Blocks: Step 5 (task router)

## Problem Statement

The case requires the backend to be exposed via tRPC and consumed by the Next.js frontend (R2). Before any task procedure exists, the app needs the generic tRPC infrastructure:
- an initialized tRPC instance
- a request context
- the building blocks procedures are made from
- a root router whose type the client can import
- an HTTP endpoint inside the Next.js app

Validation errors also need to reach the client in a structured, per-field form. Without that, the form (Step 10) could only show one generic error string instead of a message next to the field that failed (R12).

## Solution

A small tRPC infrastructure module initializes tRPC with an empty context and an error formatter that attaches flattened Zod errors to every validation failure. It exports the building blocks (`router`, `publicProcedure`, `createCallerFactory`). A root router module defines `appRouter` and exports its `AppRouter` type. A Next.js App Router route handler serves the router over HTTP at `/api/trpc` using tRPC's fetch adapter. A temporary `health` query proves the whole chain works end to end, until the task router arrives in Step 5.

## User Stories

1. As a user, I want my requests to reach the backend through a single, consistent API endpoint, so that every feature behaves the same way.
2. As a user, I want validation problems reported per field, so that the form can show the message right next to the field I need to fix.
3. As a user, I want unexpected server errors reported as a clear error rather than a broken page, so that the UI can tell me something went wrong.
4. As the candidate, I want one place where tRPC is initialized, so that every procedure shares the same configuration and error format.
5. As the candidate, I want `router` and `publicProcedure` exported as building blocks, so that feature routers (Step 5) don't import tRPC internals directly.
6. As the candidate, I want `createCallerFactory` exported, so that router tests (Step 5) and the server-side proxy (Step 6) can call procedures without HTTP.
7. As the candidate, I want an `AppRouter` type exported from the root router, so that the client gets end-to-end type safety without code generation.
8. As the candidate, I want the context to be an empty object for now, so that there's no speculative auth or session plumbing, while the extension point still exists.
9. As the candidate, I want `zodError` added to the error data only for validation failures, so that other errors keep a clean, predictable shape.
10. As the candidate, I want the HTTP endpoint to accept both GET (queries) and POST (mutations), so that the batched HTTP link used by the client in Step 6 works.
11. As the candidate, I want unexpected errors logged on the server in development, so that I can debug quickly without leaking details in production logs.
12. As the candidate, I want no data transformer configured, so that the setup stays minimal (dates travel as ISO strings, per the Step 2 decision).
13. As the candidate, I want a `health` query, so that I can verify the endpoint works before any task code exists.
14. As the candidate, I want the server-only tRPC modules never imported by client code, so that server logic doesn't end up in the browser bundle. Only the `AppRouter` **type** crosses that boundary.
15. As a reviewer, I want the tRPC setup to follow the official v11 patterns, so that it's easy to recognize and evaluate.
16. As a reviewer, I want the error formatter to have a short comment explaining why it exists, so that its purpose is obvious.
17. As an AI agent implementing Step 5, I want to mount a feature router under a key of `appRouter`, so that adding the task procedures is a one-line change at the root.
18. As an AI agent implementing Step 6, I want a stable endpoint path (`/api/trpc`) and router type, so that the client link and server proxy can be configured against them.

## Implementation Decisions

- **tRPC infrastructure module** (the "init" module):
  - Calls `initTRPC` with the context type from `createTRPCContext`.
  - `createTRPCContext` is async, receives the incoming request's headers (the conventional signature, so the HTTP handler and the server proxy can call it the same way) and **returns an empty object**. No auth, session or user lookup.
  - Exports: `router`, `publicProcedure`, `createCallerFactory` and `createTRPCContext`.
  - **No transformer** (no `superjson`). All payloads are JSON-safe by design: `dataCriacao` is an ISO string.
- **Error formatter:** extends the default error shape so that `data.zodError` is:
  - the **flattened** Zod error (`{ formErrors: string[], fieldErrors: Record<string, string[]> }`) when the error code is `BAD_REQUEST` **and** the cause is a `ZodError`;
  - `null` otherwise.

  Use the flatten helper idiomatic for the installed Zod major (Zod 4 prefers the top-level flatten function over the deprecated instance method). The output shape is the same either way. The added field is inferred on the client, so Step 10 can read `fieldErrors.titulo` with full typing.
- **Root router module:**
  - Defines `appRouter` from `router(...)` and exports `type AppRouter = typeof appRouter`.
  - For this step it contains only a `health` query (no input) that returns `{ status: 'ok' }`.
  - Step 5 mounts the task router under the key `task`. `health` is removed at that point if nothing uses it (see Further Notes).
- **HTTP endpoint:** a Next.js App Router route handler for the dynamic segment under `/api/trpc`.
  - Uses tRPC's **fetch adapter** (`fetchRequestHandler`) with `endpoint: '/api/trpc'`, `router: appRouter`, and a `createContext` that delegates to `createTRPCContext` with the request headers.
  - The same handler is exported as both `GET` and `POST`.
  - `onError` logs the procedure path and error message to the server console **only when `NODE_ENV === 'development'`**.
  - The route is dynamic by nature (it handles requests), so no caching configuration is needed.
- **Boundaries:** the init and root-router modules are server code. Client code may import only the `AppRouter` **type** (type-only imports are erased at build time). Adding a `server-only` guard to the server tRPC proxy belongs to Step 6.
- **No middleware or protected procedures:** the app has no authentication. A single `publicProcedure` is enough.

## Testing Decisions

- **Seam:** the HTTP boundary. Tests call the route handler's exported `GET` and `POST` functions directly with standard `Request` objects (available in Node 20) and assert on the HTTP status and JSON body. That's exactly what the browser client will hit, and it needs no running server.
- **How to test the error formatter:** the only real procedure in this step (`health`) takes no input, so the formatter test builds a tiny **test-only** router from the exported `router` and `publicProcedure`, with one procedure that requires an input (e.g. a required non-empty string). It serves that router through the same fetch adapter and asserts:
  - an invalid input responds with HTTP 400, error code `BAD_REQUEST`, and `data.zodError.fieldErrors` containing the field's message;
  - a non-validation error (e.g. a procedure throwing `NOT_FOUND`) responds with `data.zodError === null`.

  The test router lives only in the test file.
- **Other cases:**
  - `GET /api/trpc/health` responds with HTTP 200 and a result whose data is `{ status: 'ok' }`.
  - A request to an unknown procedure path responds with a `NOT_FOUND` error.
- **Modules tested:** the init module (through the formatter behavior) and the route handler, with co-located tests (Vitest, Node environment).
- **What makes a good test here:** assertions on the response contract (status code, error code, `zodError` shape), not on how the formatter is implemented.
- **Prior art:** Steps 2 and 3 unit tests (same runner and conventions). This step adds the first HTTP-level tests.

## Out of Scope

- Task procedures, input schemas and `NOT_FOUND` mapping (Step 5).
- The client provider, `httpBatchLink`, `QueryClient` and the server-side options proxy for Server Components (Step 6).
- Authentication, authorization, rate limiting, CORS (same-origin only), request logging in production.
- Data transformers (`superjson`) and response compression.
- OpenAPI/REST exposure of the procedures.

## Further Notes

- **`health` lifecycle:** this spec treats `health` as temporary scaffolding. Step 5 should remove it when the task router is mounted, together with its test (replaced by the router integration tests), unless a later step decides to keep it as a documented liveness check. Keeping or removing it should be one explicit decision, not an accident.
- The flattened error format matches what the form needs (`fieldErrors` keyed by field name: `titulo`, `descricao`). No custom error mapping is needed on the client beyond reading that object.
- In production builds, tRPC omits stack traces from error responses by default. Don't override that.
