# Spec: Documentation, final QA and delivery

Status: ready-for-agent
Plan step: 13 of 13 (see `docs/implementation-plan.md`, Step 13)
Depends on: Steps 1–12
Blocks: none (this is the final step)

## Problem Statement

The application is functionally complete, but the case is judged by a reviewer who receives only a link to a public GitHub repository. Without a clear README, the reviewer can't easily run the app or understand the design choices. Without a final QA pass, a requirement could be missed or broken. Without a safety check, something sensitive or confidential could end up public, and the case explicitly warns that this is the candidate's responsibility. The repository also has no remote yet.

## Solution

Before delivery:

- Add a concise English README that lets anyone run, test and understand the app.
- Add short comments where a design decision isn't obvious from the code.
- Run a final QA pass against every requirement in the plan, plus a safety check of everything that will be public.
- Then, **with the user's explicit approval**, rename the branch to `main`, create the public GitHub repository, push, and confirm that a fresh clone works by following only the README.

## User Stories

1. As a reviewer, I want a README that explains what the app does in a few lines, so that I understand the scope immediately.
2. As a reviewer, I want exact commands to install, run, test and build the app, so that I can evaluate it without guesswork.
3. As a reviewer, I want the required Node.js version stated, so that I use a compatible runtime.
4. As a reviewer, I want an architecture overview (request flow and folder structure), so that I can navigate the code quickly.
5. As a reviewer, I want the key technical decisions and their reasons summarized, so that I can assess the candidate's judgment.
6. As a reviewer, I want an API reference of the tRPC procedures with their inputs, outputs and errors, so that I can see the backend contract at a glance.
7. As a reviewer, I want the known limitations stated openly (in-memory, single process, data lost on restart), so that I know they were deliberate trade-offs.
8. As a reviewer, I want a short list of possible next steps, so that I can see how the candidate would evolve the system.
9. As a reviewer, I want to know why Next.js 15 was pinned even though a newer major exists, so that the version choice doesn't look like an oversight.
10. As a reviewer, I want to know the dev seed exists and what it contains, so that I can demo the list and infinite scroll right away.
11. As a reviewer, I want comments in the code only where a decision isn't obvious, so that the code reads cleanly while the non-obvious choices are explained.
12. As a reviewer, I want every requirement of the case demonstrably met, so that the evaluation focuses on quality rather than gaps.
13. As the candidate, I want lint, typecheck, tests and build all green before delivery, so that nothing breaks for the reviewer.
14. As the candidate, I want a checklist that maps every case requirement to how it was verified, so that I can be confident nothing was missed.
15. As the candidate, I want to confirm the repository contains no secrets, tokens, `.env` files or personal data, so that publishing it is safe.
16. As the candidate, I want to confirm all sample data is fictitious, so that the case's explicit rule is respected.
17. As the candidate, I want to confirm the local reference PDFs are not tracked, so that local reference material stays private.
18. As the candidate, I want to review the full git history before pushing (not just the latest files), so that nothing sensitive is exposed in an old commit.
19. As the candidate, I want the default branch named `main`, so that the repository follows the current GitHub convention.
20. As the candidate, I want to approve creating the public repository and pushing before it happens, so that nothing is published without my consent.
21. As the candidate, I want to verify that a fresh clone runs by following only the README, so that the reviewer's first experience is guaranteed to work.
22. As the candidate, I want the repository link ready to paste into the Google Form, so that I can submit before the deadline.

## Implementation Decisions

- **README:** in English, concise, at the repository root. Sections in this order:
  1. Title and a one-paragraph overview.
  2. Features: CRUD, SSR list, validation, feedback, infinite scroll.
  3. Tech stack with major versions, including a note on why Next.js 15 is pinned (the case requires v15).
  4. Getting started: prerequisites (Node.js 20+, npm), then `npm install`, `npm run dev`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build && npm start`.
  5. Development seed: about 25 fictitious tasks in development only, and why.
  6. Architecture: the request-flow diagram and folder overview from the plan, as text or ASCII.
  7. Key decisions: a summary of the plan's decisions table, each with a one-line reason.
  8. API reference: one row per procedure (`task.list`, `task.byId`, `task.create`, `task.update`, `task.delete`) with its input, output and error codes (`BAD_REQUEST` with field errors, and `NOT_FOUND` with "Task <id> not found.").
  9. Testing: what's covered by Vitest and what's checked manually.
  10. Known limitations: in-memory, single process, reset on restart, not shared across serverless instances.
  11. Possible next steps: persistence, auth, optimistic updates, end-to-end tests.
- The README contains no personal data (name, email, links to personal profiles).
- **Code comments:** add a short "why" comment only where the decision is not self-evident:
  - the `globalThis` store that survives dev hot reloads
  - ISO-string `dataCriacao`, so no serialization transformer is needed
  - the keyset cursor, robust to deletions
  - the awaited SSR prefetch, so the HTML contains the tasks
  - dynamic rendering of the list and edit pages
  - the `hasNextPage && !isFetchingNextPage` guard in infinite scroll

  Remove any comment that only restates the code. Comments are in English.
- **Final QA pass:** go through every row of the plan's requirements table (R1–R13, B1–B2, D1) and every earlier spec's acceptance criteria, recording pass or fail for each. Fix failures in this step only if they're small. Otherwise reopen the owning step's spec and note it.
- **Quality gate:** `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` must all pass from a clean install (`npm ci`).
- **Safety checks** (all must pass before pushing):
  - No `.env*` files are tracked, and no strings that look like tokens or keys appear in any tracked file.
  - The seed data and every example are fictitious.
  - The local reference PDFs are not tracked: `git ls-files docs` shows only the plan and agent docs, and the PDFs have never appeared in the history (`git log --all -- '*.pdf'` shows nothing).
  - The commit author identity is acceptable to the user for a public repo. Point it out and let the user decide.
  - The `.scratch/` specs are published by default (they document the process). If the user prefers to keep them private, add `.scratch/` to `.gitignore` and remove them from tracking **before** the first push.
- **Branch:** rename the local `master` branch to `main` before the first push. It's the current GitHub default and what reviewers expect. Nothing is published yet, so renaming is free.
- **Publishing requires explicit user approval.** Creating the public GitHub repository and pushing to it are outward-facing and hard to undo. The agent stops and asks before doing either, stating the repository name, visibility (public) and branch.
  - Recommended repository name: the current folder name (`dev-app-next`), unless the user chooses another.
  - Use the GitHub CLI if it's available and authenticated. Otherwise give the user the exact commands to run.
- **Post-push verification:** clone the public repository into a fresh temporary directory outside the working copy. Follow only the README (install, test, run) and confirm the app works. Delete the temporary clone afterwards.
- **Deliverable to the user:** the public repository URL, ready to submit through the case's Google Form, plus a reminder that the written answers (Part 1) are a separate PDF.

## Testing Decisions

- **Seam:** the published repository, as a reviewer experiences it: a fresh clone, the README's commands and the running app. That's the highest seam possible: it validates documentation, build, tests and features together. The per-feature acceptance criteria from earlier specs are re-checked through the running app, not through new tests.
- **What makes a good test here:** checks a reviewer could do themselves, such as commands succeeding, pages behaving as the README describes, and the absence of sensitive files. Internal implementation details are not checked.
- **Verification checklist:**
  - All four npm scripts pass on a clean install.
  - Every row of the requirements table is marked as passing, with a note on how it was verified.
  - Safety checks are all clean (see Implementation Decisions).
  - A fresh clone of the public repository runs by following only the README.
  - The GitHub page shows the README rendered correctly, with `main` as the default branch.
- **Automated tests:** none added. The existing Vitest suite (Steps 2, 3 and 5) must stay green.
- **Prior art:** Step 1's verification checklist (the npm script gate and the PDF check) is extended here.

## Out of Scope

- New features or refactors beyond small fixes found during QA.
- The Part 1 written answers (a separate PDF deliverable, not part of this repository).
- CI pipelines, deployment or hosting the app online.
- Submitting the Google Form (the user does that).
- End-to-end test tooling.

## Further Notes

- Deadline awareness: the case must be submitted by the end of the second business day from November 19, 2026. Leave time for the fresh-clone check before submitting.
- The README should be short enough to read in a few minutes. Link to `docs/implementation-plan.md` for the full reasoning instead of duplicating it.
- If the user decides against publishing the `.scratch/` specs, update `AGENTS.md`'s issue-tracker note accordingly so the documentation stays accurate.
