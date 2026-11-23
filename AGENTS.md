# AGENTS.md

## Agent skills

### Issue tracker

Issues and specs are tracked as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) as `Status:` lines. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Engineering principles

This is a technical-challenge project: the implementation must be **as simple as possible** while staying clean and well designed. "Less is more."

- **Scope**: build exactly what the case asks for. No speculative features, premature abstractions or libraries beyond what the stack needs (Next.js 15, tRPC, Zod, TanStack Query).
- **Clean code**: small single-purpose modules and functions, intention-revealing names, no dead code. Comments explain *why*, not *what*.
- **Separation of concerns**: keep the tRPC router thin; task logic and the in-memory store sit behind a small repository module, so storage could be swapped without touching the API or the UI.
- **Single source of truth**: Zod schemas define the task shape and validation, shared by the backend and the form.
- **Errors**: throw typed `TRPCError`s (e.g. `NOT_FOUND`, `BAD_REQUEST`) with clear messages; the UI surfaces them along with loading, success and failure states.
- **Rendering**: Server Components by default (SSR for the task list); Client Components only where interactivity is needed.
- **Language**: code, comments and docs in English. Keep the task fields named as the case specifies (`id`, `titulo`, `descricao`, `dataCriacao`).
- **Public repo**: no secrets, tokens or personal data; any sample data is fictitious.
