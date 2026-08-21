# MarcusFit Project Handoff

## Current accepted state

MarcusFit 10.1.3 is accepted and merged on `main` through PR #11. The feature
head was `d9482211ca85a3a694a5be90e7e8ea08ff3ef837`; the merge commit is
`2653566f6a06ad99b184e8fa0bc26dc0c24a2dfe`.

MarcusFit 10.1.4 is implemented on
`codex/10-1-4-mobile-ux-accessibility` and is awaiting Marcus's manual QA. It
enables pinch zoom and safe-area-aware mobile layout, adds a profile-backed
text-size preference, reorganizes Sync/settings into accessible disclosures,
and redesigns the Habit Manager while preserving its save-only draft model.

## Implemented 10.1.2 architecture

MarcusFit remains a dependency-free static HTML/CSS/classic-JavaScript app for
GitHub Pages. `index.html` explicitly loads 22 globally numbered `defer`
scripts under `assets/js/{core,data,program,state,features,sync,system,boot}`.
The old five coarse runtime files are removed. The largest runtime file is
1,808 lines, down from 5,224; total runtime content remains 14,275 lines.

See `docs/architecture/README.md` for the exact tree, ownership, storage map,
load order, risks, implementation deviations, and equivalence evidence.

## Protected invariants

- Never modify accepted files in `Releases/`.
- Never mutate base program `P` or change its 63 stable exercise IDs.
- Preserve all 15 owned storage keys/patterns, schemas, raw backup strings, and
  replacement restore behavior.
- Preserve public globals, 83 inline attributes, 61 handler functions, debug
  names/result shapes, and classic-script scope/order.
- Preserve AI export text/order and AI Sync valid/invalid/rollback behavior.
- Preserve synchronous boot, the three load listeners, and basketball-last
  wrapper capture/initialization.
- Do not introduce modules, npm, TypeScript, bundlers, frameworks, services,
  analytics, service workers, or runtime dependencies.

## Accepted baseline validation

Automated tests and the architecture scanner pass. HTTP browser smoke testing
confirmed startup, all screens, save/reload persistence, export generation,
backup creation, invalid Sync rejection, responsive phone/desktop widths, and
no console warnings/errors. Marcus completed full representative real-data QA
before PR #10 was merged.

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
10.1.4 — Mobile accessibility, Sync/settings organization, Habits UI — Implemented; awaiting manual QA
10.2.0 — Basketball programs and progression
10.3.0 — Basketball-specific AI Sync
10.4.0 — Habits-specific AI Sync
10.5.0 — Full cross-domain coaching review
```

The 10.1.4 implementation keeps the primary Export/Sync workflow exposed and
uses deterministic disclosure defaults: Profile & Display open, secondary
sections collapsed unless a pending proposal needs attention. `mf-user-profile`
now owns `preferences.textSize`; no storage key or schema version was added.
Habit Manager presentation CSS moved from runtime injection into
`assets/css/marcusfit.css`. See `tests/marcusfit-10.1.4-manual-qa.md` for the
required real-device acceptance checklist.
