# Spec: App shell and feedback system

Status: ready-for-agent
Plan step: 7 of 13 (see `docs/implementation-plan.md`, Step 7)
Depends on: Step 6 (client and server tRPC wiring)
Blocks: Steps 8 (task list page with SSR), 10 (shared task form component) and 11 (create and edit pages), and through them 9 and 12

## Problem Statement

The case asks for visual feedback on success and error, for appropriate error messages from both the backend and the frontend, and for attention to loading, success and failure states. Without a shared approach, each page would invent its own messages, its own error parsing and its own loading UI. That's inconsistent for users and duplicated code for reviewers. Some feedback also has to survive navigation: after creating a task, the user is sent to the list and should still see "Task created.". Finally, the app has no shared layout yet, so there's no consistent way to move between the list and the create page.

## Solution

A minimal **app shell** (root layout with a header, navigation and main container, plus a small global stylesheet) and one reusable **feedback system**:

- a `FeedbackProvider` that holds the current message
- a `useFeedback()` hook that exposes `notifySuccess(text)` and `notifyError(text)`
- a `FeedbackRegion` that shows the message accessibly, rendered once in the root layout so messages survive client-side navigation
- a `getErrorMessage(error)` helper that turns any error (tRPC or otherwise) into a user-friendly sentence

Route-level loading, error and not-found UIs cover the states pages can't handle themselves.

## User Stories

1. As a user, I want a header with the app name on every page, so that I always know where I am.
2. As a user, I want a link back to the task list from any page, so that I never get stuck.
3. As a user, I want a visible "New task" button in the header, so that creating a task is always one click away.
4. As a user, I want a clear success message after I create, update or delete a task, so that I know the action worked.
5. As a user, I want a clear error message when an action fails, so that I know it didn't work and roughly why.
6. As a user, I want the success message to still show after I'm redirected to another page, so that I see the confirmation after saving a form.
7. As a user, I want success messages to disappear on their own after a few seconds, so that they don't clutter the screen.
8. As a user, I want error messages to stay until I dismiss them, so that I have time to read them.
9. As a user, I want a close button on every message, so that I can dismiss it whenever I like.
10. As a user, I want a new message to replace the previous one, so that I only ever see the latest outcome.
11. As a screen-reader user, I want messages announced automatically, so that I get the same feedback as sighted users.
12. As a user, I want readable error messages rather than raw technical output, so that I'm not confronted with JSON or stack traces.
13. As a user, I want a loading indicator while a page loads its data, so that I know something is happening.
14. As a user, I want a friendly error page with a "Try again" button when a page fails to render, so that I can recover without reloading the whole site.
15. As a user, I want a clear "not found" page with a link back to the list when I open a missing task or wrong URL, so that I can carry on.
16. As the frontend developer, I want one `useFeedback()` hook for all success/error messages, so that every page reports outcomes the same way.
17. As the frontend developer, I want one `getErrorMessage(error)` helper, so that error parsing isn't duplicated across components.
18. As the frontend developer, I want standard message texts ("Task created.", "Task updated.", "Task deleted."), so that wording stays consistent.
19. As a reviewer, I want feedback handled by one small, focused module, so that I can see a deliberate design decision instead of ad-hoc state in every page.
20. As a reviewer, I want minimal, readable styling with no framework, so that the focus stays on functionality, as the case asks.
21. As an AI agent working on later steps, I want the feedback API and message texts fixed in this spec, so that Steps 8–12 can use them without guessing.

## Implementation Decisions

- **Root layout:** inside `TRPCReactProvider` (Step 6) it renders `FeedbackProvider`, which contains:
  - a header with the app name "Task Manager" linking to the list, and a "New task" link to the create route
  - the `FeedbackRegion`
  - a `main` container holding the page

  The document has `lang="en"` and the metadata title "Task Manager".
- **Styling:** a minimal global stylesheet (reset, system font stack, readable max width, basic spacing, form and button defaults, success/error colors with sufficient contrast). Component-specific styles use CSS Modules. There's no CSS framework.
- **Feedback state:** at most one message at a time, shaped as below. A new message replaces the current one.

  ```ts
  type Feedback = { type: 'success' | 'error'; text: string } | null;
  ```

- **`useFeedback()` contract:** returns `{ notifySuccess(text: string), notifyError(text: string) }`. Both functions keep a stable identity, so they're safe in effect and mutation callbacks. Using the hook outside the provider throws a clear developer error.
- **`FeedbackRegion`:**
  - always present in the DOM (an empty live region) so screen readers pick up changes
  - `role="status"` and `aria-live="polite"`
  - success messages auto-dismiss after about 4 seconds; error messages stay until closed
  - every message has a close button with an accessible label ("Dismiss message")
  - the auto-dismiss timer is cleared when the message changes or the component unmounts
- **Survives navigation:** because the provider lives in the root layout, which isn't re-mounted on client navigation, a message triggered just before `router.push` stays visible on the destination page.
- **`getErrorMessage(error)` (pure function):**
  1. if the error is a tRPC client error carrying `zodError` field errors, return the first field error message (e.g. "Title is required.")
  2. otherwise, if it's a tRPC client error with a non-empty message (e.g. "Task <id> not found."), return that message
  3. otherwise, return the generic fallback "Something went wrong. Please try again."

  Raw `Error` messages from non-tRPC errors are not shown, since they may be technical.
- **Standard messages** are exported as constants and reused by later steps: "Task created.", "Task updated.", "Task deleted.".
- **Route-level UI (App Router conventions at the app root):**
  - **loading:** a simple "Loading…" indicator, announced via `role="status"`
  - **error:** a client boundary with the text "Something went wrong." and a "Try again" button that calls the boundary's `reset`. Error details are not shown to the user.
  - **not-found:** "Page not found" (or "Task not found" wording that still reads correctly for unknown URLs), with a link back to the task list

## Testing Decisions

- **Seams:**
  1. `getErrorMessage` as a pure function: it holds the only real logic in this step, and it runs in the Node test environment.
  2. The running app in the browser for the visual and interactive behavior, which needs a DOM the test setup deliberately doesn't include (no jsdom, per Step 1).
- **What makes a good test:** feed `getErrorMessage` realistic error values and assert on the returned text only.
- **Unit tests for `getErrorMessage`:**
  - a tRPC error with `zodError` field errors → the first field message ("Title is required.")
  - a tRPC `NOT_FOUND` error → its message ("Task <id> not found.")
  - a tRPC error with an empty message → the generic fallback
  - a plain `Error`, a string, `undefined` → the generic fallback

  Realistic tRPC errors can be produced through the Step 5 caller, or built as client-error-shaped objects.
- **Manual verification:**
  - Trigger a success message (temporary button or Step 8+ actions), navigate client-side, and check it's still visible, then gone after ~4 s.
  - An error message stays until closed, and the close button works.
  - With a screen reader or the accessibility tree, the region has `role="status"` and announces changes.
  - Throw in a test page: the error UI renders, and "Try again" recovers once the cause is removed.
  - An unknown URL renders the not-found UI with a working link to the list.
  - `lint`, `typecheck`, `test` and `build` stay green.
- **Prior art:** schema and router tests from Steps 2–5 (Vitest, co-located `*.test.ts`).

## Out of Scope

- A toast library or a stack of multiple simultaneous messages.
- Page content: the task list, delete, form and create/edit pages (Steps 8–11).
- A global error boundary for errors inside the root layout itself (rare at this size; noted below).
- Theming, dark mode, animations, responsive navigation menus.
- Internationalization. UI text is in English.

## Further Notes

- The app-root error boundary catches errors in pages and nested layouts, but not in the root layout itself. The root layout only renders providers and static markup, so a dedicated global error boundary isn't worth the extra file for this case.
- `getErrorMessage` prefers `zodError` because in tRPC v11 the raw message of an input-validation error is a serialized issue list, not user-friendly text. This matches the note in Step 5.
