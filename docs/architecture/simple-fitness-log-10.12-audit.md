# MarcusFit 10.12.0 Simple Fitness Log audit

Status: implementation candidate. It starts from accepted implementation head
`e4bed8cda5d48aef993ec6a108e885c21b7a9be9`, accepted production merge
`9c854176d1ffb75b5c2247c0add88e6ce6a59768`, and accepted production tree
`da27cb6402ae7c327e73568f2e7502b1aef42319`.

## Product and storage boundary

Simple Fitness Log is one named Tracking Preferences preset inside the existing
`mf-user-profile.preferences.tracking` model. It is not an app mode, workout
mode, navigation mode, onboarding profile, storage key, schema, or migration.
Lifting remains available implicitly. The exact collection mapping is:

```text
modules.habits              false
modules.basketball          false
modules.recurringAdherence  false
modules.activeCalories      false
modules.dailyNotes          false
modules.sessionNotes        true
modules.coachingInsights    true

dailyMetrics.weight         false
dailyMetrics.sleep          false
dailyMetrics.protein        false
dailyMetrics.water          false
dailyMetrics.energy         false
dailyMetrics.hunger         false
dailyMetrics.bowelMovement  false
```

No accepted key or field is renamed. Disabled collection surfaces stop new
collection and preserve dormant values. History, Stats, saved workouts, Daily
records, Basketball records, and progression evidence remain factual.

## Preset and lifting-detail orthogonality

Preset detection compares only the seven module booleans and seven Daily metric
booleans. `liftingDetail` is intentionally excluded. Simple Fitness Log remains
the detected preset with either `simple` or `full` lifting detail; the same rule
continues for Full Coaching and Strength Tracking. Any collection-value change
that no longer exactly matches a named bundle detects as Custom.

The pure preset builder keeps the current lifting detail, preserving the
accepted programmatic contract. Explicit user actions apply these defaults in
the UI draft before the user saves:

- Full Coaching -> Per Set — Detailed (`full`)
- Strength Tracking -> Per Set — Detailed (`full`)
- Simple Fitness Log -> Per Lift — Simple (`simple`)
- Custom -> no collection or lifting-detail overwrite

Changing lifting detail afterward does not change the named preset.

## Streamlined setup and first-run compatibility

The existing Tracking Preferences surface is the setup entry point; no forced
wizard or repeated prompt is added. It presents four outcome-focused preset
buttons, then the separate Workout logging detail choice, existing fine-tuning
controls, and Save/Reset. Native buttons expose `aria-pressed`, keyboard focus,
and a visible `Selected` marker so selection is not color-only.

A profile without explicit tracking continues to resolve virtually to Full
Coaching + Detailed. Opening or rendering setup performs no tracking write.
Only Save records a complete date-effective snapshot. The existing onboarding
profile mapper continues merging `preferences`, so an existing tracking value is
preserved and no parallel onboarding state or duplicate timeline entry exists.

## Timeline and workout authority

The accepted local-date timeline is unchanged. A save replaces an entry on the
same date, a later save appends, dates between entries use the most recent prior
complete snapshot, and dates before the first entry use virtual Full Coaching.
A preset action never deletes or rewrites domain records or earlier intent.

Workout form authority remains:

1. Existing saved workout record.
2. Explicit resumable draft.
3. Date-effective Tracking Preference for a blank workout.
4. Detailed fallback for malformed/unknown state.

Simple evidence remains the accepted schema-1 summary with `sets:[]`; no fake
sets, conversion, cache, or new progression path is introduced.

## Export, Sync, and backup

Tracking Preferences export names Simple Fitness Log and explains that missing
wellness, Habit, Basketball, and Active Calories data is intentional and
neutral. It retains the compact period summary and does not dump raw preference
JSON or fabricate individual sets.

Core `assets/js/sync/12-ai-sync.js` is unchanged. The accepted late Sync
preflight still rejects top-level profile/tracking payloads before writes, so AI
cannot select a preset, change lifting detail, or enable a module.

Backup remains schema 1 and copies the raw `mf-user-profile` string. Simple
Fitness Log snapshots round-trip as ordinary existing preference fields. Old
10.11.x profiles and backups remain readable through normalization and virtual
defaults without migration.

## Protected baseline

- Base program canonical SHA-256: `652a04c37928f232490d37ce7e709dc16a25a8c5f408d679bce046b2f6a2d7d4`
- Stable exercises: 63 unique IDs; canonical SHA-256 `7c333a9b7fb4639cafd0900a96f1d4ba58b8d6b8fb5ecc23f335e7ee041d0e2b`
- Program-data Git blob: `4c96cd3e3ce0cbbf2ecaa6b0b0dede3c2faf1b72`
- Core Sync Git blob: `893556c24c035e7b0fcc1c717fcfba4b5f6f9308`
- Core Sync canonical-LF SHA-256: `14245321c8f47de5c152d011a08877ef4821e353c15bc3ed72c0490aa767c598`
- Accepted Releases tree: `d1c1e8512257c380aa4ef35840c86a796171390e`
- Runtime: exactly 22 classic deferred scripts in accepted order

Real-iPhone Safari and Home Screen/PWA QA remains pending after independent
review. This document does not declare the candidate accepted.
