# MarcusFit runtime architecture

MarcusFit 10.1.2 reorganized the accepted runtime into 22 coherent, ordered
classic scripts. The accepted 10.11.2 production runtime keeps those boundaries
and composes export sections through the existing ordered classic-script wrappers. GitHub Pages still loads
static `defer` scripts, and there is no build step or runtime dependency.

## Implemented runtime tree

```text
assets/js/
|-- core/01-app-constants.js
|-- data/02-program-data.js
|-- program/03-lifecycle-resolved.js
|-- state/04-runtime-state-profile-preferences.js
|-- features/05-onboarding.js
|-- features/06-program-proposals.js
|-- features/07-program-proposal-ui.js
|-- features/08-program-daily.js
|-- features/09-progression-base.js
|-- features/10-workout-logging.js
|-- sync/11-ai-export.js
|-- sync/12-ai-sync.js
|-- features/13-shared-ui.js
|-- features/14-history.js
|-- features/15-stats.js
|-- system/16-backup-restore-debug.js
|-- features/17-starter-programs.js
|-- features/18-progression-corrections.js
|-- features/19-recurring-adherence.js
|-- features/20-habits.js
|-- boot/21-app-boot.js
`-- features/22-basketball.js
```

The accepted 10.11.2 runtime retains 22 runtime files in the accepted numeric order.
Reproducible physical-line and largest-file counts come from the architecture
inventory. Numeric prefixes remain globally ordered and match `index.html`.

## 10.5 export and Sync composition

- `sync/11-ai-export.js` owns the deterministic high-level export skeleton and the single mixed response contract.
- `features/17-starter-programs.js`, `18-progression-corrections.js`, `19-recurring-adherence.js`, and `20-habits.js` fill owned section slots without prepending competing prompts.
- `features/22-basketball.js` fills Basketball evidence last and derives the cross-domain summary after every domain is available.
- The cross-domain summary is read-only and derived from existing logs/stores; 10.5 adds no storage key or schema.
- `sync/12-ai-sync.js` remains the sole authoritative core apply implementation and is unchanged. Habit/Basketball extension hooks preflight their exact mixed envelope before any processing.

## 10.6 Basketball boundary

- `features/22-basketball.js` continues to own all four existing Basketball keys and adds no schema.
- Landing, program inspection, one-drill courtside execution, completion review, historical comparison, and concise export context are derived from existing state.
- Progression comparability requires program, version, planned session, stable drill, and tracking mode identity; historical views remain bound to stored snapshots.
- See `basketball-10.6-audit.md` for the flow inventory, audit findings, exact rules, and retained risks.

## 10.7 navigation, Sync, and analytics boundary

- `boot/21-app-boot.js` owns primary-tab selection (including the user-facing Tools label on the unchanged `export` route), Daily Log-only mobile Save Day visibility, the deterministic top reset, and conservative swipe routing through the live `showScreen()` path; it retains no per-tab scroll or disclosure state.
- `features/13-shared-ui.js` owns memory-only Sync internal-page selection, critical-confirmation blocking, section routing, and pending review indication.
- `features/15-stats.js` owns the shared calendar range and read-only action/training/progression/weight/recovery derivations; Habits, recurring adherence, and Basketball retain their domain semantics through accepted wrappers.
- No storage key/schema, script, module, backend, export contract, or core Sync change is introduced.
- See `navigation-sync-analytics-10.7.md` for exact behavior and evidence rules.

## 10.8 lifting progression boundary

- `features/18-progression-corrections.js` remains the final progression owner and extends the accepted Phase 9A compatibility surface; no competing engine or 23rd script is introduced.
- Workout evidence is matched by stable exercise ID plus stored gym/day context when available. Legacy records without those optional identity fields remain readable.
- Complete prescribed sets and required RIR evidence gate load increases. Exact compatible numeric loads may receive bounded arithmetic; textual, ranged, bodyweight, mixed, or ambiguous setups remain qualitative.
- Recommendation action, reason, confidence, and comparable-session count are derived at render/export time. Saved/manual values are the only values carried into editable fields.
- See `lifting-10.8-audit.md` for the lifecycle trace, audit findings, decision rules, and fallbacks.

## 10.9 Basketball coaching and session-energy boundary

- `features/22-basketball.js` owns an immutable prescription catalog keyed by all 38 accepted built-in drill IDs. Prescriptions resolve at presentation/snapshot time so the accepted base and sparse resolved-program shapes remain compatible.
- New structured Basketball drill results optionally snapshot the performed prescription. Historical views and edits use that snapshot and never borrow later catalog text; old structured and free-form records remain readable.
- Existing workout and structured Basketball records may carry optional whole-number `activeCalories` values from 0–5000. No key, eager migration, or schema-version churn is introduced.
- History labels values as estimates. Stats and AI Export derive range-aware totals, recorded-session averages, domain breakdown, and coverage without writing or counting missing values as zero.
- Core Sync and proposal apply/undo paths remain unable to target historical prescriptions or calories. See `basketball-session-energy-10.9-audit.md` for the full contract.

## 10.10 visual-system boundary

- `index.html` owns one local SVG symbol sprite; `features/13-shared-ui.js` owns the dependency-free `currentColor` icon helpers and the exact-pattern core-Sync status presentation adapter.
- The final CSS cascade owns charcoal foundation/text surfaces, lightning-lime brand aliases, dedicated semantic colors, three reusable radii, two elevation levels, and standardized icon sizes.
- The accepted CSS remains an unchanged prefix, while all 22 runtime scripts retain their existing order and ownership.
- Protected program data and core Sync remain content-identical. Their legacy icon strings are not displayed as platform glyphs and no stored user content is rewritten.
- See `visual-system-10.10-audit.md` for the color/geometry/emoji/selector inventory and `../../tests/marcusfit-10.10.0-manual-qa.md` for the device matrix.

## 10.11 Tracking Preferences boundary

- `state/04-runtime-state-profile-preferences.js` owns normalized Tracking Preferences inside the existing `mf-user-profile` record, exact preset bundles, complete local-date timeline snapshots, virtual Full fallback, UI binding, and collection gating.
- `features/08-program-daily.js` and `10-workout-logging.js` preserve dormant values during drafts/saves and omit new disabled fields; lifting evidence, workout identity, and progression stay unchanged.
- `features/19-recurring-adherence.js` and `20-habits.js` exclude preference-off due dates/opportunities from adherence denominators without mutating schedules, definitions, or history.
- `sync/11-ai-export.js` and later domain wrappers report compact collection intent and neutral absence semantics. `sync/12-ai-sync.js` remains byte-identical; late extension preflight rejects preference mutation and disabled-domain proposals before writes.
- Backup/restore continues to carry the raw `mf-user-profile` string under schema 1. Profile reset preserves tracking, while the dedicated Tracking reset records Full Coaching for today and retains earlier timeline entries.
- See `tracking-preferences-10.11-audit.md` for the full contract and `../../tests/marcusfit-10.11.0-manual-qa.md` for the required browser/device matrix.

## 10.11.1 Simple lifting boundary

- `state/04-runtime-state-profile-preferences.js` activates `liftingDetail` as a date-effective `full` / `simple` selection without migrating missing values. Collection preset detection deliberately ignores lifting detail.
- `features/10-workout-logging.js` resolves mode from saved workout, resumable draft, then preference. Simple exercises retain `sets:[]` and store only the versioned summary; `features/08-program-daily.js` restores that mode before draft values.
- `features/18-progression-corrections.js` remains the effective progression authority. Its dedicated Simple evaluator consumes summary facts directly, emits medium-confidence qualifying results, and shares only pure load/metric/chronology/ceiling helpers with Detailed evaluation.
- History, Stats, review, and AI Export are evidence-aware. Deterministic rotation considers only Detailed sessions; Simple records remain available for normal direct progression and explicitly labeled coaching context.
- Backup/restore remains raw schema-1 replacement with no new key. See `simple-lifting-10.11.1-audit.md` and `../../tests/marcusfit-10.11.1-manual-qa.md`.

## 10.12 Simple Fitness Log boundary

- `state/04-runtime-state-profile-preferences.js` adds `simple_fitness_log` as an exact bundle of the existing collection fields. Lifting remains implicit/always available; Session Notes and Coaching Insights are on, while every Daily metric and the other optional collection modules are off.
- Named preset detection still compares collection fields only. Lifting Detail remains independent: an explicit Simple Fitness Log action defaults to Simple, Full Coaching and Strength Tracking default to Detailed, and later detail-only changes preserve the named preset.
- The existing Tracking Preferences page is the streamlined, non-forced setup surface. Missing tracking still renders as virtual Full Coaching and opening the surface writes nothing; existing onboarding continues preserving nested preferences.
- Saves retain the complete local-date timeline contract and never rewrite workouts, daily data, Basketball records, or earlier entries. Saved workout, resumable draft, then date-effective preference remain the workout-mode authority.
- AI Export labels lightweight intent and neutral missing domains. AI Sync remains unable to target profile/tracking state, and raw schema-1 backup/restore naturally carries the unchanged profile key.
- See `simple-fitness-log-10.12-audit.md` and `../../tests/marcusfit-10.12.0-manual-qa.md`.

## Guide

- `runtime-system-map.md` records ownership and direct dependencies.
- `global-and-inline-handler-map.md` records the compatibility surface.
- `storage-and-backup-map.md` records all 18 owned keys/patterns.
- `initialization-and-load-order-map.md` records the exact execution order.
- `dependency-risk-register.md` records mitigated and remaining risks.
- `proposed-module-plan.md` records implementation decisions and deviations.
- `basketball-10.6-audit.md` records the Basketball storage/flow audit and progression rules.
- `lifting-10.8-audit.md` records lifting ownership, decision evidence, and conservative fallbacks.
- `basketball-session-energy-10.9-audit.md` records Basketball prescription, snapshot, active-calorie, analytics, and Sync boundaries.
- `visual-system-10.10-audit.md` records the visual-token, geometry, icon, emoji, and selector-risk audit.
- `tracking-preferences-10.11-audit.md` records preference authority, timeline, preservation, adherence, export/Sync, reset, and backup contracts.
- `simple-fitness-log-10.12-audit.md` records the lightweight preset, explicit action defaults, first-run compatibility, mode authority, export, Sync, and backup boundaries.
- `../../tests/marcusfit-10.1.2-modularization-equivalence.md` records evidence.

Run `node tools/architecture/inventory-runtime.js` with the bundled Node
runtime to reproduce counts and protected hashes. Static scanner candidates are
supporting evidence; tests and browser behavior remain authoritative.
