---
inclusion: always
---

# How to work in this repo (agreements for the agent)

These rules are for me (the agent). They complement `product.md`, `tech.md` and `structure.md`.

## Language

- **Everything written in this repository is in English**: code, comments, docs, README, steering,
  specs, commit messages, PR/issue templates and workflow files. The only exception is the
  website's user-facing content (UI copy and User Group data), which stays in Spanish for its audience.

## Before changing anything

- Read the affected code; do not propose changes to code you have not seen.
- Respect the product principles: never auto-publish ambiguous events, never invent data, no
  LLMs or silent heuristics, no rankings between groups.

## When writing code

- Strict TypeScript. No `any` except in existing, bounded defensive parsing.
- Keep data out of components (use `config/` and the snapshot).
- Keep client-side JavaScript to a minimum; favor static HTML/CSS.
- Do not lower the accessibility bar: skip link, visible focus, `prefers-reduced-motion`, `:target`.
- Source parsers fail closed on incomplete data; they never repair with heuristics.
- New visual variables => first as a custom property in `src/styles/tokens.css`.

## Verification (mandatory before finishing)

- `npm test && npm run build` must pass.
- If you touch event sources, add fixtures and tests (including incomplete input).
- Clean up temporary files created for testing.

## Git and security

- Do not create commits unless explicitly asked; when asked, add files by name, not `-A`.
- Do not deploy or touch live AWS resources without explicit user confirmation.
- Do not commit secrets (`.env`, credentials). Use `.env.example` as the reference.

## Scope

- Solve what is asked; do not add unrequested features, abstractions or config.
- The yearly Community Day sites are independent: do not mix their content in here.
