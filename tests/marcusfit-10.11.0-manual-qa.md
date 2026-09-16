# MarcusFit 10.11.0 Manual QA

Run through a local HTTP origin only. Do not use `file://`. Back up any
production-origin data before restore testing because localhost has separate
storage.

## Responsive and accessibility matrix

Test widths 320, 390, and 480 pixels with Standard and Extra Large text.

For Tools -> Profile -> Tracking Preferences, verify:

- Full Coaching, Strength Tracking, and Custom cards are reachable and clear.
- Every toggle has a large touch target and visible keyboard focus.
- Turning all Daily Metrics off removes the Daily Metrics section without an
  empty gap; restoring one metric restores the section.
- Selected states use the accepted lime/charcoal visual system and local SVGs.
- The explanatory preservation copy is readable without horizontal overflow.
- Reset Tracking Preferences uses an in-app two-step confirmation.

## Product scenarios

1. Full Coaching reproduces accepted 10.10 collection behavior.
2. Strength Tracking shows lifting, Weight, Sleep, Energy, Session Notes, and
   Coaching Insights only.
3. Custom with nearly everything off keeps Program, History, Stats, and Tools.
4. Custom with mixed Daily Metrics shows only the selected rows.
5. Disable a field, edit an unrelated value, re-enable it, and confirm its old
   value survived.
6. Habit history remains visible while Habit collection is off.
7. Basketball history and snapshots remain visible while collection is off.
8. Lifting and Basketball active calories survive edits while disabled.
9. A recurring due date inside an off interval is neutral in Stats/export.
10. Reset Profile preserves Tracking Preferences.
11. Reset Tracking Preferences preserves prior timeline entries and records a
    Full Coaching snapshot for today.
12. A new backup restores Tracking Preferences exactly; an old backup without
    them resolves to virtual Full Coaching.
13. A Sync payload attempting tracking/profile mutation is rejected with zero
    writes.
14. Existing pending Habit/Basketball proposals remain reviewable while their
    collection modules are off; new proposals are rejected.

## Surface and console checks

Visit Daily Log, Program, History, Stats, and every Tools sub-tab after each
representative preset. Confirm the sticky Daily Log save bar, primary swipes,
dialogs, proposal overlays, keyboard dismissal, and focus return remain usable.
There must be no console errors or warnings and no horizontal overflow.

## Local execution record — 2026-09-15

- Chromium localhost QA passed at 320, 390, and 480 px with Standard (14 px) and Extra Large (18 px) text. Tracking controls stayed within the viewport, had a measured 44 px minimum target, and produced no horizontal overflow.
- Full Coaching enabled all seven daily metrics and all seven feature toggles. Strength Tracking matched the exact approved bundle. Custom was exercised with Weight, Water, and Habits only, plus a Weight-only save case.
- Energy `8`, Hunger `3`, and Sleep `7.5` survived a Weight-only edit while disabled and returned after re-enable. A new Weight-only date stored no `mood` or `hunger` property, proving that hidden sliders did not write synthetic `5` defaults.
- Habit and Basketball collection were hidden under Strength Tracking while existing pending Habit and Basketball proposal review controls remained available in Tools -> Personalize.
- History retained four daily entries and seven Basketball records while collection was off. Stats retained factual recorded Basketball and recovery evidence with Tracking Preferences context.
- AI Export included the compact Tracking Preferences block, off interval, neutral-absence rules, and pending-proposal ownership without raw timeline JSON.
- Tracking/profile mutation, disabled Habit proposal, and disabled Basketball proposal payloads all produced the intended preflight errors; backup data before and after the three attempts was byte-equivalent at the stored-value map level.
- Backup creation and restore preview reported schema 1, the user profile, current Tracking preset, and timeline count. The destructive confirm step was intentionally not executed; automated raw-string round-trip coverage passed.
- Profile reset preserved the active Custom tracking summary. Reset Tracking Preferences replaced today's single timeline snapshot with Full Coaching and retained the dedicated preservation result message; multi-day retention is covered by the automated authority test.
- Browser console warnings/errors: none.

## Acceptance boundary

Real-iPhone Safari/Home Screen QA remains a required manual acceptance step.
Do not merge or mark the draft PR ready until Marcus explicitly accepts it.
