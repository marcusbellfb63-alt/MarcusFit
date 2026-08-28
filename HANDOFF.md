# MarcusFit Project Handoff

## Current accepted state

MarcusFit 10.2.0 is accepted after full automated and real-device manual QA.
The implementation head that passed final QA was
`8ec91be0690358bdb9e680ecb9af12af2ffc4330` on
`codex/10-2-0-basketball-programs-progression`.

The exact accepted baseline before 10.2.0 was MarcusFit 10.1.4 merged on `main`
at `35b176870fdad9aed0ed37dc5e631a327eae9b1c` through PR #12.

10.2.0 adds three immutable, versioned basketball program templates; a
session-driven cyclical queue in `mf-basketball-program-state`; drill-specific
structured logging; confidence, duration, makes-target, benchmark, count, and
completion tracking; deterministic basketball progression guidance; structured
History; focused Stats; AI Export context; and backup/restore coverage. Existing
schema-1 free-form basketball records remain readable and editable without eager
migration.

Real-device QA found and cleared two product/layout issues before acceptance:
structured sessions now support partial completion with explicit skipped drills
that do not count as progression exposures, and Session Date / Total Minutes use
stacked full-width metadata controls to avoid iPhone Safari date-input overlap.

Core `assets/js/sync/12-ai-sync.js`, the accepted 22-script order, base program
`P`, all 63 exercise IDs, and accepted `Releases/` files remain protected.
Basketball adds no Sync mutation path; basketball-specific AI Sync remains the
next roadmap phase.

## Implemented architecture

MarcusFit remains a dependency-free static HTML/CSS/classic-JavaScript app for
GitHub Pages. `index.html` explicitly loads 22 globally numbered `defer`
scripts under `assets/js/{core,data,program,state,features,sync,system,boot}`.

See `docs/architecture/README.md` for the exact tree, ownership, storage map,
load order, risks, implementation deviations, and equivalence evidence.

## Protected invariants

- Never modify accepted files in `Releases/`.
- Never mutate base program `P` or change its 63 stable exercise IDs.
- Preserve owned storage keys/patterns, schemas, raw backup strings, and
  replacement restore behavior unless an explicit backward-compatible migration
  is approved.
- Preserve public globals, inline attributes/handlers, debug names/result shapes,
  and classic-script scope/order.
- Preserve AI export text/order and AI Sync valid/invalid/rollback behavior.
- Preserve synchronous boot, load listeners, and basketball-last
  wrapper capture/initialization.
- Do not introduce modules, npm, TypeScript, bundlers, frameworks, services,
  analytics, service workers, or runtime dependencies.

## Accepted 10.2.0 validation

All nine automated regression test files pass, along with architecture inventory,
`git diff --check`, local HTTP smoke, responsive rendered checks, and protected
hash checks. Real-device iPhone/Safari QA passed after the manual-QA corrections,
including structured partial-session save/repeat/advance behavior, skipped-drill
handling, stacked metadata controls, program queue behavior, free-form isolation,
History, Stats, AI Export, backup/restore, lifting regression, Habits, valid and
invalid AI Sync, text-size modes, and console sanity.

Protected values at acceptance:

- Accepted release SHA-256: `69a3a66541d14290a6a7b73bf313365176169fd0d659e6effb29edcaf7a4e34b`
- Base `P` SHA-256: `652a04c37928f232490d37ce7e709dc16a25a8c5f408d679bce046b2f6a2d7d4`
- 63 exercise ID hash: `7c333a9b7fb4639cafd0900a96f1d4ba58b8d6b8fb5ecc23f335e7ee041d0e2b`
- Core Sync SHA-256: `25aaf52986493af7d5796b57f81746f8f279f506b2550a61ca7b011c9572c51e`

## Workflow

- Start every new phase from freshly fetched `origin/main` on a dedicated branch.
- Never work directly on `main`.
- Use multiple meaningful rollback commits for substantial work.
- Test browser behavior through a local HTTP server, never `file://`.
- Back up production data before restoring it to localhost; origins have separate
  `localStorage`.
- Keep feature PRs draft until Marcus explicitly accepts manual QA.

## Roadmap

```text
9.5.9  — Progression and exercise-metric correctness — Complete
9.5.10 — Schedule-aware recurring adherence — Complete
9.6.0  — Custom habits and modular Sync foundations — Complete
10.0.0 — Lean multi-file conversion — Complete
10.1.0 — Basketball session logging — Accepted
10.1.1 — Runtime architecture inventory — Complete
10.1.2 — Feature-oriented JavaScript modularization — Accepted and merged
10.1.3 — Program Day Integrity & Historical Identity Repair — Accepted
10.1.4 — Mobile accessibility, Sync/settings organization, Habits UI — Accepted
10.2.0 — Basketball programs and progression — Accepted
10.3.0 — Basketball-specific AI Sync
10.4.0 — Habits-specific AI Sync
10.5.0 — Full cross-domain coaching review
```
