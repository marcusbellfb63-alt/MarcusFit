# MarcusFit 10.11.1 Simple lifting audit

Status: accepted production. Accepted implementation head
`15742d4bb5fb853a50d099be14c25416eb846ce2`; accepted production merge
`e5d0944aae19c077368af255e9eebbf758aaeecd`; accepted production tree
`6fec699c5625dcceb980ff11b00c064b0705f2c1`.

## Evidence model

Detailed remains the default and keeps the legacy workout shape. A new Simple
workout uses the same `day-YYYY-MM-DD-wo` key:

```js
{
  liftingDetail: "simple",
  gym: "home",
  dayIdx: "0",
  dayName: "Day name",
  exercises: {
    "stable-exercise-id": {
      sets: [],
      summary: {
        version: 1,
        setCount: 3,
        repsFloor: "8",
        load: "100 lb",
        rirFloor: "1–2"
      },
      note: "optional existing session note"
    }
  }
}
```

`setCount` is completed work sets, `repsFloor` is the lowest reps on any
counted set, `load` is the common working resistance, and `rirFloor` is the
hardest/lowest RIR. `sets:[]` is intentionally empty. Runtime, tests, History,
Stats, review, progression, and export never expand the summary into rows.
Malformed/unknown summaries remain insufficient evidence and are not rewritten.

## Mode authority

The rendered workout form resolves mode in this order:

1. Existing saved workout (`liftingDetail:"simple"`; absence means Detailed).
2. Explicit resumable draft workout (the same rule).
3. Date-effective Tracking Preferences for a blank workout.

Collection reads the rendered log container's owned mode. A later preference
change therefore cannot convert an in-progress, drafted, or historical workout.
Discarding a draft removes that owner; the next blank render uses the current
date-effective preference.

## Progression

`features/18-progression-corrections.js` remains the effective authority. The
accepted Detailed `p9BuildSuggestion` path is retained. Simple uses
`p1111BuildSimpleSuggestion`, which directly evaluates required set count,
rep/duration floor, hardest RIR, exact common load, unit/equipment shape,
assistance direction, chronology, target reset, large jump, regression, and
program ceiling. It never calls Detailed with fabricated `validSets`.

A complete top-range Simple summary may support an ordinary load change after
one session and normally reports medium confidence. Bodyweight and duration do
not invent numeric load progression. Text/ranged/unsafe or unit-incompatible
loads hold qualitatively. The existing ceiling rule still requires two
independently qualifying sessions; either session may be Detailed or Simple.

## Consumers and compatibility

- History shows one labeled Per-Lift summary, never Set 1/2/3.
- Training Load adds exactly `summary.setCount`; no observations are created.
- Workout review uses set count and hardest RIR directly and recognizes a valid
  summary as logged.
- AI Export labels Simple evidence, includes its factual fields, includes
  progression evidence mode/confidence, and explicitly forbids set inference.
- Deterministic stale/capped rotation filters out Simple sessions; direct
  progression and external coaching may still use their labeled evidence.
- Tracking preset detection ignores lifting detail. Named presets preserve the
  current lifting choice; reset intentionally returns Full Coaching + Detailed.
- Backups remain schema 1 raw-string snapshots. No storage key or migration is
  introduced, and `assets/js/sync/12-ai-sync.js` remains protected.

## Acceptance record

The complete automated suite, localhost validation, and exact-head real-iPhone
Safari and Home Screen/PWA matrix passed before Marcus explicitly accepted
`15742d4bb5fb853a50d099be14c25416eb846ce2`. PR #23 was merged to production
with true merge commit `e5d0944aae19c077368af255e9eebbf758aaeecd`.
