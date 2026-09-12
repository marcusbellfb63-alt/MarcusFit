# MarcusFit 10.9.0 Basketball coaching and session-energy audit

## Accepted ownership

MarcusFit 10.9.0 starts from accepted merge `3eea77df29382182ac639845946419e477cf6da8`.
The app remains a dependency-free classic-script application with 22 deferred runtime
files in the accepted order. `assets/js/features/22-basketball.js` is the final-load
Basketball owner; `assets/js/features/10-workout-logging.js` owns lifting form
collection and same-date `day-YYYY-MM-DD-wo` replacement; files 14 and 15 own base
History and range-aware Stats; file 11 owns the base AI Export; file 16 owns raw
backup discovery, validation, and replacement restore. File 22 composes Basketball
History, Stats, Export, backup validation, and Sync last. Core
`assets/js/sync/12-ai-sync.js` remains the sole authoritative `applySync` owner.

The three immutable built-in Basketball templates contain eight planned sessions and
twenty-eight stable drills. Program ID/version, planned-session ID, drill ID, and
tracking mode are the comparable progression identity. Sparse schema-1 overrides
resolve only future program definitions. Structured history owns its stored program,
session, drill-name, target, mode, result, status, and optional new prescription
snapshot. Schema-1 free-form records remain independent and editable.

## Approved optional fields

- Lifting workout record: `activeCalories` is an optional integer from 0 through
  5000 on the existing `day-YYYY-MM-DD-wo` value.
- Structured Basketball session record: `activeCalories` uses the same optional
  integer contract on the existing schema-1 session object.
- Structured Basketball drill result: `prescriptionSnapshot` optionally stores the
  resolved prescription actually presented for that drill. It contains bounded
  strings for `doNow`, `workRest`, `setup`, `instructions`, `easier`, `harder`, and
  `why`, one or two bounded `cues`, and the bounded `success` target.

Blank calories are omitted. Zero is retained when explicitly entered. Decimals,
negative values, non-finite values, non-numeric text, and values above 5000 are
rejected rather than coerced. Clearing a previously saved value during an explicit
edit omits only `activeCalories`. No new storage key or eager migration is added.

## Read and write paths

Lifting reads and writes through `getTodayWoData()`, `collectWoData()`,
`renderWoExercises()`, `restoreWoDataToForm()`, and the existing `p85ExecuteSave()`
same-date replacement. Habit wrappers continue to carry the returned workout object
without reconstructing its fields.

Basketball reads and writes through `mfBasketballParseStoreValue()`,
`mfBasketballNormalizeSession()`, `mfBasketballBuildStructuredInput()`, and
`mfBasketballSaveSession()`. New structured sessions snapshot the resolved
prescription. Historical edit reconstructs the logger from stored snapshots and
retains the original record ID, date choice, creation timestamp, targets, tracking
modes, and prescriptions. Old structured snapshots without prescriptions and all
free-form records remain readable without borrowing or persisting current template
text.

Backup discovery already owns both storage locations. Raw serialization and
replacement restore therefore round-trip the optional fields automatically;
Basketball's final strict validator accepts valid optional fields and rejects invalid
ones. Old backups that omit them remain valid.

## Prescription resolution and presentation

Every built-in drill ID resolves a predeclared standard prescription. The catalog is
immutable and contains a concise immediate action, primary target/work structure,
one or two cues, success measure, setup/full instructions, easier option, harder
option, and reason. The next-session surface shows the action, target, standard
variation, and reason before entry. Courtside shows the immediate prescription,
target/work structure, and cues above the existing result controls; a native
disclosure contains setup, full instructions, easier/harder variations, and reason.

The accepted deterministic progression remains advisory and unchanged. 10.9 does not
silently select a harder/easier prescription because current progression outcomes do
not consistently encode comparable quality for count and completion modes. The
standard predeclared prescription is therefore the conservative selection for sparse
and sufficient evidence alike; the existing progression label remains visible and
explainable. This avoids a second progression owner while leaving the bounded
variations available to the user.

## Analytics and export

Analytics are derived at render time and never written. A calorie-recorded session is
one valid lifting workout record or one valid structured Basketball session with an
own `activeCalories` field. The selected Stats range is applied before calculation.
Totals are sums of recorded estimates only; average is total divided by the count of
calorie-recorded sessions; coverage is recorded sessions divided by all supported
lifting plus structured Basketball sessions. Domain totals are reported separately.
Missing values are excluded, never converted to zero, and no session is counted in
both domains.

History labels each value as an estimated active-calorie value. AI Export adds a
read-only wearable/user-entered estimate section with the total, domain totals,
average, and coverage for the selected export range. It does not modify targets,
recommend food intake, infer a deficit, make medical claims, or mutate training.
Core AI Sync and every proposal validator/apply/undo path have no write path to
historical workout or Basketball records, so they cannot invent, overwrite, or
delete this evidence.

## Known limitations and protected boundaries

- Energy values are user-entered wearable estimates, not precise expenditure.
- Free-form Basketball records are intentionally outside the 10.9 calorie contract.
- The accepted app has no distinct third structured cardio record; cardio-shaped
  lifting days remain in their existing workout record and are not split out.
- Old structured history without a prescription snapshot displays its stored name,
  target, mode, and result only; it is not retroactively enriched from current data.
- Base `P`, all 63 exercise IDs, accepted `Releases/`, storage keys, public globals,
  inline handlers, 22-script load order, proposal safety, core Sync, and accepted
  lifting recommendations remain protected.
