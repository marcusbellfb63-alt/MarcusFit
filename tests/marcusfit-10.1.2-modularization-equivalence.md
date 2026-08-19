# MarcusFit 10.1.2 modularization equivalence

## Baseline and result

- Repository: `marcusbellfb63-alt/MarcusFit`
- Starting `origin/main`: `8308e7c57135e1bbb2ab8756c571805aa2819c78`
- Expected starting SHA: matched
- Runtime implementation commit before documentation: `3e8896b`
- Branch: `codex/10-1-2-feature-modularization`
- Runtime/display version: 10.1.0
- Intended behavior change: none

The ordered non-basketball runtime recomposes exactly to the accepted 9.6.0
runtime with only the already accepted `APP_VERSION` substitution to 10.1.0.
The basketball source remains byte-identical. This makes export, Sync, backup,
progression, storage, and boot algorithms source-equivalent for identical
browser state while allowing file boundaries to change.

## Size and structure

| Measure | Before | After |
|---|---:|---:|
| Runtime files | 5 | 22 |
| Runtime physical lines | 14,275 | 14,275 |
| Maximum file lines | 5,224 | 1,808 |
| Classic deferred scripts | 5 | 22 |
| ES module scripts | 0 | 0 |

Old files: `01-core-data.js` 1,732; `02-state-personalization.js` 5,224;
`03-interactions-sync.js` 4,663; `04-backup-boot.js` 2,226;
`05-basketball.js` 430.

New files and lines: 01 15; 02 224; 03 1,493; 04 406; 05 1,724;
06 1,808; 07 1,286; 08 469; 09 1,416; 10 450; 11 923; 12 809;
13 159; 14 159; 15 278; 16 827; 17 393; 18 514; 19 245; 20 210;
21 37; 22 430.

## Protected inventories

| Contract | Before | After |
|---|---:|---:|
| Inline attributes | 83 | 83 |
| Referenced handler functions | 61 | 61 |
| Explicit `window.*` names | 58 | 58 |
| Effective accepted compatibility names | 257 | 257 preserved |
| Raw scanner cross-file candidates | 257 | 313 (structural boundary effect) |
| Owned storage keys/patterns | 15 | 15 |
| Exercise IDs | 63 | 63; no duplicates |

Protected hashes before/after:

- `P` SHA-256: `652a04c37928f232490d37ce7e709dc16a25a8c5f408d679bce046b2f6a2d7d4`
- Exercise-ID SHA-256: `7c333a9b7fb4639cafd0900a96f1d4ba58b8d6b8fb5ecc23f335e7ee041d0e2b`
- Accepted release SHA-256: `69a3a66541d14290a6a7b73bf313365176169fd0d659e6effb29edcaf7a4e34b`
- Accepted release Git blob: `c10e4a488296b7ba83311d7fc7bdd1dcd4c4b7e8`

## Automated validation

Five dependency-free Node test files pass:

- MarcusFit 10.1.0 basketball contract
- MarcusFit 10 compatibility/modularization contract
- MarcusFit 9.5.10 scheduled adherence
- MarcusFit 9.5.9 progression
- MarcusFit 9.6.0 personalized habits

The compatibility contract checks the explicit script-order fixture, every
runtime file, classic `defer` status, no modules, per-file and combined syntax,
accepted-release hashes, recomposed runtime equality, basketball SHA, `P`,
83/61 handler counts, accepted global surface, storage tokens, and restore flow.
`git diff --check` passes. No accepted release or CSS file changed.

Because the executable runtime source and wrapper order are unchanged, golden
AI export text, raw backup creation/preview/validation/restore behavior, and AI
Sync storage deltas are equal for identical fixtures. Existing focused tests
continue to cover progression, adherence, habits, and basketball integration.

## HTTP browser validation

Validated at `http://127.0.0.1:8000/`:

- Title and visible version remained 10.1.0.
- All 22 scripts loaded in order; no modules.
- Program, Daily Log, History, Stats, and Sync screens opened.
- Daily notes saved and survived reload.
- Export generated accepted program-basis/log content and omitted empty
  basketball activity.
- Backup creation produced MarcusFit schema 1, appVersion 10.1.0, and owned raw
  keys including the saved daily record.
- Invalid Sync produced the accepted missing-block rejection.
- 390x844-class phone and 1440x900-class desktop checks had no horizontal overflow.
- Console errors/warnings: none.

## Intentional structural differences and remaining risk

The final tree uses 22 files rather than the proposed 21. State/profile/prefs
and backup/debug stay paired; shared UI/load listeners have a dedicated file;
progression base/corrections stay separated to preserve capture order; boot
remains before basketball to preserve accepted initialization. These choices
are detailed in `docs/architecture/proposed-module-plan.md`.

Manual real-data QA remains required for workout save/reopen, proposal
apply/keep/undo, mixed History/Stats, progression review, current/old backup
replacement restore, valid Sync deltas/rollback, and basketball edit/delete.
The phase must not be called accepted or merged before Marcus approves it.
