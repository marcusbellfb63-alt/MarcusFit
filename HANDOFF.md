# MarcusFit Project Handoff

## Current implementation candidate

MarcusFit 10.7.0 Navigation, Sync IA, and Analytics Maturation starts from the exact accepted 10.6.0 merge commit `d172ed429a2addb259a0dce622d9c2d94429816e`. The accepted 10.6 QA-approved implementation head is `cef5d39b3adf939ba7d9c59d6d6e250bcce7cbcd`.

10.7.0 is the new implementation candidate and is not accepted. Primary and Sync tablists use standard horizontal keyboard navigation; every successful destination opens at the top while later intentional History/Basketball target scrolling remains authoritative. Stats All-history Habit eligibility is bounded by activation/first legacy evidence and archive dates, and dynamic workout rows add mobile keypad hints without changing their text-backed save contract. Navigation and analytics remain read-only. Automated and localhost responsive-browser validation pass; ChatGPT review and Marcus's real-iPhone/manual QA remain pending.

Progression comparisons require matching program ID/version, planned session ID, stable drill ID, and tracking mode. Skips remain neutral. Stored historical names, targets, modes, results, and snapshots remain authoritative. See `docs/architecture/basketball-10.6-audit.md` and `tests/marcusfit-10.6.0-manual-qa.md`.

## Previous accepted state

MarcusFit 10.6.0 Basketball UX and progression maturation is accepted and merged at `d172ed429a2addb259a0dce622d9c2d94429816e`; its QA-approved implementation head is `cef5d39b3adf939ba7d9c59d6d6e250bcce7cbcd`. It adds a readable next-session surface, resolved program inspection, one-drill courtside execution, an explicit review gate, post-save metric-specific summary, historical comparison context, and deterministic Basketball progression. It adds no storage key or schema field, retains the accepted 22-script order, and does not change core `assets/js/sync/12-ai-sync.js`.

Progression comparisons require matching program ID/version, planned session ID, stable drill ID, and tracking mode. Skips remain neutral. Stored historical names, targets, modes, results, and snapshots remain authoritative. See `docs/architecture/basketball-10.6-audit.md` and `tests/marcusfit-10.6.0-manual-qa.md`.

MarcusFit 10.5.0 cross-domain coaching and AI Export/Sync information architecture is accepted and merged at `60934a151f95c34d5a659cd131c91abca43bfa91`; its QA-approved implementation head is `73faa06e2b5476a8ab7549c76c3cfdbe84277911`. It adds a derived cross-domain coaching summary, deterministic high-level-to-contract export ordering, one mixed response contract, explicit mutable/proposal/advisory boundaries, and strict mixed-envelope leakage refusal without adding storage or changing core Sync.

The deterministic 14-day representative fixture measures 32,711 characters / 602 lines at the accepted 10.4 baseline and 21,494 characters / 336 lines for accepted 10.5.

MarcusFit 10.4.0 Habit AI Sync safety is accepted and merged. Its exact merge commit is `7e0059780f47e545b91ee02ad27291e836ace3af`; its QA-approved implementation head is `a9aa210ec5c7ffa52a93ce0109bcfa5eb541b579`.

MarcusFit 10.3.0 basketball-specific AI Sync is accepted after full automated and real-device manual QA.

Exact accepted 10.3.0 merge commit / 10.4.0 starting baseline:
`adb0d081707d85c4e0e8f61c2453be16ec387cf7`

QA-approved implementation head:
`74402eeb3f3c2c76cb54fd6a3b0d5bde828e878d`

Acceptance documentation follows that implementation head only; no runtime changes are permitted after the QA-approved head before merge.

10.3.0 adds sparse future-program basketball overrides plus review-first basketball proposals while preserving accepted core Sync and historical basketball records. Supported proposal actions are bounded drill modification, stable-ID addition, future disable, within-session reorder, and switching among built-in basketball programs. Proposals import pending, require explicit review and two-stage apply, preserve immutable import-time expected state for stale-conflict detection, and support one-level safe undo without overwriting later user changes.

Real-device iPhone Safari QA passed on 2026-08-30, including proposal-owned scrolling and background lock, add/remove/reorder behavior, invalid reorder rejection, normal safe undo, stale program-switch conflict protection, mixed core+habit+basketball Sync composition, backup/restore, structured and free-form basketball logging, repeat/advance behavior, lifting/habits regressions, AI Export, and console sanity.

## Previous accepted state

MarcusFit 10.2.0 was accepted after full automated and real-device manual QA and merged through PR #13. The exact 10.3.0 starting baseline is the 10.2.0 merge commit:
`28053354b0ffc1654a398456d5fc7447059340e5`.

10.2.0 added three immutable, versioned basketball program templates; a session-driven cyclical queue in `mf-basketball-program-state`; drill-specific structured logging; confidence, duration, makes-target, benchmark, count, and completion tracking; deterministic basketball progression guidance; structured History; focused Stats; AI Export context; and backup/restore coverage. Existing schema-1 free-form basketball records remain readable and editable without eager migration.

Core `assets/js/sync/12-ai-sync.js`, the accepted 22-script order, base program `P`, all 63 exercise IDs, and accepted `Releases/` files remain protected.

## Implemented architecture

MarcusFit remains a dependency-free static HTML/CSS/classic-JavaScript app for GitHub Pages. `index.html` explicitly loads 22 globally numbered `defer` scripts under `assets/js/{core,data,program,state,features,sync,system,boot}`.

See `docs/architecture/README.md` for the exact tree, ownership, storage map, load order, risks, implementation deviations, and equivalence evidence.

### Basketball-specific AI Sync ownership

- Built-in basketball templates remain immutable.
- `mf-basketball-program-overrides` schema 1 stores sparse personalization overlays for future resolved sessions.
- `mf-basketball-proposal` schema 1 owns pending review state, expected-state evidence, apply metadata, and the one-level undo snapshot.
- `assets/js/features/22-basketball.js` owns basketball proposal normalization, validation, resolution, review/apply/undo/reject behavior, and late Sync extension composition.
- `assets/js/sync/12-ai-sync.js` remains the sole authoritative core `applySync` implementation and is byte-identical to the accepted baseline.
- Historical `mf-basketball-sessions` records and stored drill snapshots are never rewritten by proposal import, apply, reject, or undo.

## Protected invariants

- Never modify accepted files in `Releases/`.
- Never mutate base program `P` or change its 63 stable exercise IDs.
- Preserve owned storage keys/patterns, schemas, raw backup strings, and replacement restore behavior unless an explicit backward-compatible migration is approved.
- Preserve public globals, inline attributes/handlers, debug names/result shapes, and classic-script scope/order.
- Preserve AI export text/order and AI Sync valid/invalid/rollback behavior.
- Preserve synchronous boot, load listeners, and basketball-last wrapper capture/initialization.
- `assets/js/sync/12-ai-sync.js` is the sole authoritative core `applySync`; later features may compose only through accepted hooks and must never capture/wrap a competing obsolete `applySync`.
- Do not introduce modules, npm, TypeScript, bundlers, frameworks, services, analytics, service workers, or runtime dependencies.

## Accepted 10.3.0 validation

All 10 automated regression test files pass, along with architecture inventory, `git diff --check`, local HTTP smoke, responsive rendered checks, protected-hash checks, and full real-device iPhone/Safari manual QA.

Manual QA specifically cleared two defects before acceptance:

1. Basketball proposal review now owns vertical scrolling on iOS while the underlying page remains locked and exact page position is restored on close.
2. Proposal expected-state evidence is captured exactly once during import and remains immutable during reopen/preview/apply. Switch-program expected state includes active program ID, version, and queue position; drill/session fingerprints likewise cannot be silently refreshed. Stale proposals now refuse with zero writes and remain pending for review or rejection.

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
- Back up production data before restoring it to localhost; origins have separate `localStorage`.
- Keep feature PRs draft until Marcus explicitly accepts manual QA.
- After explicit acceptance, only documentation commits may follow the QA-approved implementation head before merge.

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
10.3.0 — Basketball-specific AI Sync — Accepted
10.4.0 — Habits-specific AI Sync
10.5.0 — Full cross-domain coaching review
10.6.0 — Basketball UX and progression maturation — Accepted
10.7.0 — Navigation, Sync IA, and analytics maturation — Candidate
```
