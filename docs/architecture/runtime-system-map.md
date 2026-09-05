# Runtime system map

Implemented on `codex/10-1-2-feature-modularization` from accepted 10.1.0
baseline `8308e7c57135e1bbb2ab8756c571805aa2819c78`.

| File | Ownership | Direct dependencies / consumers |
|---|---|---|
| `core/01-app-constants.js` | `APP_VERSION`, lifecycle version | Every later feature |
| `data/02-program-data.js` | Legacy habit seed/UI helpers, workout recommendations, immutable `P` | lifecycle, daily/workout, starter, export |
| `program/03-lifecycle-resolved.js` | overrides, recommendations, lifecycle, virtual/disabled days, canonical day identity, legacy virtual-day repair, resolved program, lifecycle diagnostics | proposals, daily/workout, progression, Sync, History, restore |
| `state/04-runtime-state-profile-preferences.js` | live `gym`, `logGym`, `tDate`, draft state, coaching preferences, profile | onboarding, proposals, daily, export, starter, basketball |
| `features/05-onboarding.js` | freshness evidence, onboarding state, UI, completion/debug | profile, lifecycle, proposal generation, boot |
| `features/06-program-proposals.js` | proposal schema, build, apply/undo transaction, conflicts/debug | lifecycle, profile/onboarding, logs, proposal UI |
| `features/07-program-proposal-ui.js` | personalization card and review/apply/keep/undo overlays | proposal engine, starter extension, DOM |
| `features/08-program-daily.js` | draft resume, gym/program render, daily form state and toggles | state, resolved program, DOM/storage |
| `features/09-progression-base.js` | accepted base lookup, progression, diagnostics, specialization helpers | resolved program, workout logs; corrected by file 18 |
| `features/10-workout-logging.js` | workout render/collect/save/load and review/save flow | daily state, progression, resolved program |
| `sync/11-ai-export.js` | base range/log/program/profile/proposal export and `_exp` | all read models; extended by 17–20 and 22 |
| `sync/12-ai-sync.js` | accepted authoritative parse/validate/plan/apply/rollback flow | lifecycle, proposals; late extension hook composed by habits in 20 and basketball in 22 |
| `features/13-shared-ui.js` | collapse/badge/sticky behavior and three `window.load` listeners | daily/workout and final wrapped bindings |
| `features/14-history.js` | discovery, filters, search, rendering/reopen | daily/workout; extended by habits and basketball |
| `features/15-stats.js` | base analytics calculation/rendering | daily/workout; extended by habits/adherence/basketball |
| `system/16-backup-restore-debug.js` | backup discovery/raw serialization/preview/validation/replacement restore plus compatibility diagnostics | every storage owner; basketball wraps final backup APIs |
| `features/17-starter-programs.js` | immutable templates, program basis, chooser, export/personalization hooks | `P`, profile, proposal UI, renderProgram |
| `features/18-progression-corrections.js` | final lifting metric/progression owner; context-comparable 10.8 outcomes, explanations, display-only targets, diagnostics, and self-test | progression base and workout/review/export functions |
| `features/19-recurring-adherence.js` | recurring schemas/date math/events/UI/Stats/export/debug wrappers | shared daily records, Stats/export |
| `features/20-habits.js` | definitions/manager/proposals/daily/History/Stats/export/Sync hook/debug | onboarding/profile, daily, History/Stats/export and canonical applySync |
| `boot/21-app-boot.js` | early lifecycle/day-integrity migration, navigation, and synchronous profile/onboarding/program/adherence initialization | every preceding runtime boundary |
| `features/22-basketball.js` | immutable basketball templates, sparse resolved-program overlays, review-first AI proposals, queue state, free-form/structured sessions, deterministic drill progression, UI, History/Stats/export/backup wrappers, final Sync-extension dispatcher, immediate initialization | final pre-basketball functions, habit Sync hook, and live `tDate`; never replaces or captures a stale core Sync implementation |

## Dependency direction

```text
constants + P -> lifecycle/resolved program -> state/profile/onboarding/proposals
              -> daily/workout/progression -> History/Stats/export/Sync
backup base -> starter/progression/adherence/habits -> boot -> basketball wrappers
```

The two progression files are an intentional compatibility boundary. The
accepted correction block captures workout/review/export functions that must
already exist, so it remains later in source order instead of being reordered
during a behavior-preserving phase.
