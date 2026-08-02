# MarcusFit Agent Rules

## Before changing anything

- Read `HANDOFF.md`.
- Fetch `origin`, confirm the working tree is clean, and start from current `origin/main`.
- Never work directly on `main`; create a dedicated branch and use a draft pull request.

## Protected behavior

- Never modify accepted files in `Releases/`.
- Never mutate base program `P`.
- Preserve stable exercise IDs and storage compatibility.
- Preserve backup and restore compatibility.
- Preserve public globals, inline-handler functions, and debug helpers.
- Preserve existing AI behavior unless it is explicitly in scope.
- Preserve classic-script load order.

## Architecture limits

Do not add frameworks, npm, TypeScript, bundlers, build steps, backend services, analytics, service workers, or unnecessary dependencies.

## Implementation conduct

- Inspect existing patterns before adding storage keys, schemas, globals, modules, or initialization hooks.
- Keep changes tightly scoped to the requested phase; do not mix feature development with unrelated cleanup.
- Use meaningful rollback commits for substantial work.
- Run existing tests and `git diff --check`.
- Use a local HTTP server for browser testing; never test through `file://`.
- Confirm accepted release files remain unchanged.
- Confirm the branch diff contains only intended changes.

## Authority and completion

- Coding agents may implement, validate, commit, push, and open or update a draft PR.
- Coding agents must not merge or declare a feature accepted.
- Marcus performs manual QA and gives explicit acceptance before merge.

## Modularization guidance

- 10.0.0 is the first-stage extraction, not the final module architecture.
- Future feature-oriented modularization must be inventory-driven and behavior-preserving.
- Do not arbitrarily split files during unrelated feature work.
- Prefer narrow feature boundaries when adding new code, provided compatibility is preserved.
