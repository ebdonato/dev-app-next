# Spec: Shared task form component

Status: ready-for-agent
Plan step: 10 of 13 (see `docs/implementation-plan.md`, Step 10)
Depends on: Step 2 (task domain schemas), Step 7 (app shell and feedback system)
Blocks: Step 11 (create and edit pages)

## Problem Statement

Users need a form to enter a new task and to change an existing one. The case requires that this form:
- is built with **functional components and hooks** to manage its state
- **validates input before submitting**, for example blocking submission when the title is empty
- shows appropriate error messages coming from **both the frontend and the backend**

Building two separate forms for create and edit would duplicate fields, validation and error handling, and they would drift apart. Putting the API calls inside the form would couple a presentational component to tRPC, making it harder to reuse and to reason about.

## Solution

A single client component, `TaskForm`, renders the title and description fields and is reused by both the create and the edit page (Step 11). It keeps field values and errors in React `useState`.

On submit, it validates with the same Zod schema the backend uses (`createTaskInput`). If the input is invalid, it shows the messages next to the fields and doesn't submit. If it's valid, it calls the `onSubmit` callback received from its parent.

The form knows nothing about tRPC. The parent page performs the mutation and passes back the submitting state and any server errors (a general message plus per-field messages), which the form displays.

## User Stories

1. As a user, I want one familiar form for creating and editing tasks, so that I don't have to learn two interfaces.
2. As a user, I want a required "Title" field, so that every task has a name.
3. As a user, I want an optional "Description" field, so that I can add details when needed.
4. As a user, I want a multi-line description field, so that I can write more than one line.
5. As a user editing a task, I want the form pre-filled with the current title and description, so that I only change what I need.
6. As a user, if I submit with an empty or whitespace-only title, I want to see "Title is required." and have nothing sent, so that I don't create invalid tasks.
7. As a user, if my title or description is too long, I want a clear message about the limit, so that I know how to fix it.
8. As a user, I want the error shown right next to the field it concerns, so that I know what to fix.
9. As a user, I want a field's error to clear as I correct it, so that the form reacts to my fixes.
10. As a user, after a failed validation I want focus moved to the first invalid field, so that I can fix it immediately.
11. As a user, I want the submit button to show "Saving…" and be disabled while saving, so that I know it's working and don't submit twice.
12. As a user, I want the submit button to say what it does ("Create task" or "Save changes"), so that the action is clear.
13. As a user, I want a "Cancel" link back to the list, so that I can leave without saving.
14. As a user, if the server rejects my input, I want its message shown on the relevant field, so that server-side rules are explained the same way as client-side ones.
15. As a user, if saving fails for another reason (e.g. the task no longer exists, or the network is down), I want a general error message in the form, so that I understand what happened.
16. As a user, if saving fails, I want my typed values kept, so that I don't lose my work.
17. As a screen-reader user, I want every field to have a visible, associated label, so that I know what each field is for.
18. As a screen-reader user, I want invalid fields marked invalid and linked to their error text, so that the errors are announced.
19. As a keyboard user, I want to fill in and submit the whole form with the keyboard, so that I don't need a mouse.
20. As a developer working on Step 11, I want the form to take an `onSubmit` callback rather than calling the API, so that the create and edit pages decide which mutation to run.
21. As a reviewer, I want validation rules defined once (Zod) and shared by the form and the backend, so that I can see a single source of truth.
22. As a reviewer, I want the form state managed with plain hooks, so that the case's "functional components and hooks" requirement is clearly met without a form library.

## Implementation Decisions

- **Component:** `TaskForm`, a client component in the tasks feature, with no tRPC, router or query-client imports. It is purely presentational and stateful.
- **Props (contract):**

  ```ts
  type TaskFormProps = {
    initialValues?: { titulo: string; descricao?: string };
    submitLabel: string;
    onSubmit: (values: CreateTaskInput) => Promise<void>;
    isSubmitting: boolean;
    serverError?: {
      message?: string;
      fieldErrors?: Partial<Record<"titulo" | "descricao", string[]>>;
    };
  };
  ```

  `serverError` is how the parent passes back what the backend said. `message` is a general error (usually from `getErrorMessage(error)`). `fieldErrors` comes from the `zodError` field errors in `error.data` on a `BAD_REQUEST`. The parent (Step 11) maps tRPC errors into this shape, so the form stays unaware of tRPC.
- **State:** `useState` for the field values (`titulo`, `descricao`, both strings in the inputs) and for client-side field errors. No form library, no reducer; two fields don't need one.
- **Initial values:** taken from `initialValues` on mount. If the description is missing, the field starts empty.
- **Validation:** on submit, run `createTaskInput.safeParse(values)`. It enforces:
  - `titulo`: trimmed, 1–120 characters, "Title is required."
  - `descricao`: max 1000 characters, empty → undefined

  If parsing fails, map the flattened field errors to the fields, focus the first invalid field (title before description), and **don't** call `onSubmit`. If it succeeds, call `onSubmit` with the **parsed** values (trimmed, empty description normalized), not the raw strings. `updateTaskInput` adds only `id`, which the parent supplies; that's why the form validates with `createTaskInput` in both modes.
- **Error display precedence:** per field, show the client error if there is one; otherwise show the server field error. Editing a field clears that field's client and displayed server error. Show `serverError.message` above the submit button as a general alert.
- **Submitting state:** while `isSubmitting` is true, the submit button is disabled and reads "Saving…"; fields stay editable. The parent owns `isSubmitting` (from its mutation's pending state). The form adds no request or timing logic of its own.
- **Values on failure:** the form never resets its fields after `onSubmit` rejects or a server error arrives. Navigating away on success is the parent's job (Step 11).
- **Fields and markup:**
  - a native `form` with `noValidate` (Zod is the single source of rules, so browser validation popups don't compete)
  - "Title" as a text input and "Description" as a textarea, each with a visible `label`
  - errors linked with `aria-invalid` and `aria-describedby`
  - a general error with `role="alert"`
  - a submit button with `submitLabel`, and a "Cancel" link back to the list
- **Feedback boundary:** the form does **not** call `useFeedback()`. Global success messages ("Task created." / "Task updated.") are emitted by the parent after a successful save (Step 11). Form-level errors stay inline, next to the fields, where the user is working.
- **Styling:** CSS Modules with minimal, readable styles (stacked fields, visible error color, focus outlines).

## Testing Decisions

- **Seam:** the `TaskForm` props contract, seen through its rendered behavior in the browser on the pages that use it (Step 11) or a temporary local harness page during development. The validation rules themselves are already unit-tested at the schema seam (Step 2: empty title, length limits, description normalization), so they aren't duplicated here.
- **What makes a good check:** what the user sees and whether `onSubmit` is called (and with what), not internal state variables.
- **Manual verification checklist:**
  - Empty or whitespace-only title: "Title is required." under the field, focus on the title, no `onSubmit` call (no network request once Step 11 wires it).
  - Title over 120 characters, or description over 1000: a length message on the right field.
  - Fixing the title clears its error.
  - Valid submit: `onSubmit` receives a trimmed title and an `undefined` description when the description was empty.
  - `isSubmitting` true: the button reads "Saving…" and is disabled.
  - `serverError` with field errors: the messages appear on the matching fields. With a `message`: a general alert appears. Typed values are kept.
  - Pre-filled with `initialValues` in edit mode.
  - The whole form can be completed with the keyboard. In the accessibility tree, labels are associated and invalid fields are announced with their errors.
  - `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` stay green.
- **Automated tests:** none added for the component, in line with the plan's testing strategy (no DOM or component tests; Vitest runs in a Node environment). Prior art: the Step 2 schema tests cover the shared validation logic.

## Out of Scope

- The create and edit pages, their mutations, redirects and success messages (Step 11).
- Fetching the task to edit (Step 11).
- Fields beyond `titulo` and `descricao`.
- Live validation on every keystroke or blur. Validation runs on submit, and errors clear on edit.
- Unsaved-changes warnings, autosave, character counters.
- Form libraries (React Hook Form, Formik) and component or E2E tests.

## Further Notes

- Validating with the shared Zod schema (instead of re-implementing "title not empty" in the component) is the key design decision. Add a comment noting that the same schema guards the tRPC procedure, so client and server rules can't drift.
- The submitted values come from `safeParse`'s output, so trimming and empty-description normalization happen once, in the schema, and the backend receives the same canonical shape it would produce itself.
- Mapping tRPC errors to `serverError` belongs in Step 11, ideally as one small shared helper used by both the create and the edit page, so it isn't duplicated.
