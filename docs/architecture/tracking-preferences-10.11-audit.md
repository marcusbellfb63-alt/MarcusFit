# MarcusFit 10.11.0 Tracking Preferences

## Scope

10.11.0 adds one user-controlled Tracking Preferences authority without
creating a second application, changing lifting evidence, or rewriting stored
history. Full lifting remains the accepted 10.10 per-set model. Simple and
Minimal lifting are deferred to 10.11.1 or later.

Tracking preferences live in the existing `mf-user-profile` record at
`preferences.tracking`. The profile schema and backup schema remain version 1,
and no storage key is added.

## Default contract

An absent `preferences.tracking` field is a virtual Full Coaching selection:

- `liftingDetail` is `full`.
- Every module is enabled.
- Every Daily Metric is enabled.
- Reading the virtual default never writes storage.

This keeps accepted 10.10 users and old backups behaviorally identical until a
user explicitly saves Tracking Preferences.

## Preference authority

The optional tracking object contains:

- `modelVersion: 1`
- `preset`: `full_coaching`, `strength_tracking`, or `custom`
- `liftingDetail: full`
- complete `modules` and `dailyMetrics` maps
- `changedAt`
- a date-effective `timeline` of complete snapshots

Timeline effective dates are local calendar dates. The first explicit save
adds today's snapshot, another save on the same date replaces it, and a later
date appends. Dates before the first snapshot resolve to virtual Full Coaching.
The timeline is needed so Habit and recurring-adherence denominators can treat
intentional nontracking as neutral even after tracking is enabled again.

## Presets

### Full Coaching

All modules and Daily Metrics are enabled. Lifting remains Full.

### Strength Tracking

Enabled modules: Session Notes and Coaching Insights.

Disabled modules: Habits, Basketball, Recurring Adherence, Active Calories,
and Daily Notes.

Enabled Daily Metrics: Weight, Sleep, and Energy.

Disabled Daily Metrics: Protein, Water, Hunger, and Bowel Movement.

### Custom

Custom retains the current complete selection. Manual changes select Custom,
unless the resulting values exactly match a named preset.

## Collection versus history

Turning a preference off hides new collection prompts. It does not mutate
domain configuration and does not delete, zero, fail, or hide historical data.

New records omit disabled fields. When an existing record is edited, disabled
fields retain their stored values unless the user explicitly removes them
while their controls are enabled. This applies to daily metrics, Daily Notes,
session notes, active calories, and Habit state.

History and factual Stats remain visible. Habit and recurring-adherence
opportunities are eligible only on dates when their master preference was
enabled. A weekly-count Habit week is excluded if any date in that week falls
inside a Habit-tracking-off interval.

## AI boundaries

AI Export includes a compact current-preference interpretation and summarizes
relevant off intervals without dumping raw timeline JSON. Missing evidence for
an intentionally disabled feature is neutral.

AI Sync cannot change Tracking Preferences. The accepted core
`assets/js/sync/12-ai-sync.js` remains byte-identical, and mixed envelopes keep
their accepted top-level allowlist. New Habit or Basketball proposals are
rejected before writes while that module is disabled. Existing pending
proposals remain stored and reviewable in Tools.

Habit proposal review stays in Tools -> Personalize regardless of Habit
collection visibility. Basketball proposal status is rendered both on the
Daily Basketball surface and in a dedicated Tools -> Personalize section, so
the Daily collection gate cannot strand an existing pending or undoable
proposal.

## Backup and reset boundaries

Backup/restore continues to round-trip the raw `mf-user-profile` value under
schema 1. Preview adds the current preset and timeline-entry count, but restore
does not fabricate a preference entry for old profiles.

Reset Profile preserves `preferences.tracking` verbatim. Reset Tracking
Preferences is a separate two-step action that saves Full Coaching for the
current local date, replacing an existing same-day snapshot or appending a new
date without removing earlier timeline entries or historical records.

## Protected behavior

The implementation must preserve base `P`, all 63 exercise IDs, exact workout
and Basketball history identity, Basketball snapshots and progression, Full
lifting progression, proposal review/Undo behavior, the 22-script order, core
Sync ownership, schema-1 backup replacement semantics, accepted Releases, and
the 10.10 visual system.
