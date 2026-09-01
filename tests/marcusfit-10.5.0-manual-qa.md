# MarcusFit 10.5.0 Manual QA

Status: implementation candidate pending Marcus review. Do not mark accepted or merge until these scenarios pass on a real browser and iPhone Safari/PWA.

## 1. Baseline, version, and console

Load through a local HTTP server. Confirm the title and Sync card show 10.5.0, the app has the same 22 scripts, normal navigation works, and the console has no errors.

## 2. Normal AI Export generation

Choose Program + Last 14 Days and generate. Confirm copy remains plain text, no `[[MF105_...]]` placeholders remain, and the order progresses from program/user basis through coaching context, cross-domain summary, evidence, recommendations, then the single response contract.

## 3. Cross-domain summary accuracy

Use a range containing known lifting, lower-body, Basketball, cardio, and Habit records. Confirm each count matches the selected range. Confirm Basketball minutes are included and the replacement/redundancy wording changes appropriately when dedicated cardio is absent/present. Confirm no sleep, injury, calorie, or readiness claim appears unless supported by recorded fields.

## 4. Core-only Sync

Use one exact exercise ID from the export:

```text
MARCUSFIT_UPDATE_START
[{"id":"REPLACE_WITH_EXACT_ID","blurb":"10.5 core-only QA"}]
MARCUSFIT_UPDATE_END
```

Confirm only the intended lifting override changes.

## 5. Habit-only Sync

Use an exact active Habit ID:

```text
MARCUSFIT_UPDATE_START
{"habitProposal":{"schemaVersion":1,"proposalVersion":"10.5.0","proposalId":"habit-proposal-manual-105","summary":"Habit QA","rationale":"Review-first test.","changes":[{"action":"keep","habitId":"REPLACE_WITH_EXACT_HABIT_ID"}]}}
MARCUSFIT_UPDATE_END
```

Confirm import creates a pending proposal, no definition/history changes occur, and review/apply remains two-stage.

## 6. Basketball-only Sync

Copy exact program/session/drill IDs from the export and use a valid bounded `modify_drill`. Confirm it imports pending, does not advance the queue or edit history, and requires review plus confirmation.

## 7. All-three mixed Sync

Combine `updates`, the Habit proposal above (with a fresh proposal ID), and a valid Basketball proposal in one object. Confirm core processing occurs once and both proposal domains remain pending review. Reject/dismiss proposals afterward rather than applying test-only changes.

## 8. No-change and advisory prose

Paste prose before and after this block:

```text
COACHING ASSESSMENT
Reviewed all domains; no change is justified.
MARCUSFIT_UPDATE_START
[]
MARCUSFIT_UPDATE_END
WHAT I INTENTIONALLY LEFT ALONE
Lifting, Basketball, and Habits are working as intended.
```

Confirm the empty array is accepted as a no-op.

## 9. Invalid leakage and zero writes

Add `"history":[]` or `"crossDomain":{"readinessScore":99}` beside a valid proposal. Confirm preflight rejects the unsupported top-level field and no core override or proposal store changes.

## 10. Pending proposal ownership

With a pending Habit proposal, regenerate export and confirm `pending - do not replace` appears. Attempt a second Habit proposal and confirm refusal. Repeat for Basketball. Confirm reopening/previewing does not refresh expected-state evidence.

## 11. Deep-audit response readability

Give the export to the external AI. Confirm its response can use COACHING ASSESSMENT, CHANGES, and WHAT I INTENTIONALLY LEFT ALONE; it does not create changes merely to fill every domain; and only JSON inside the markers is machine-applied.

## 12. Backup and restore

Create a backup containing lifting state, recommendations, Habit/Basketball proposals, Basketball history, and recurring adherence. Preview and restore it on localhost. Confirm summaries are accurate, round-trip data is unchanged, and the regenerated cross-domain export matches restored state.

## 13. iPhone export/copy/proposal sanity

On iPhone Safari/PWA, generate and copy a long 14- or 30-day export. Confirm text selection/copy works, the app remains responsive, and Habit/Basketball review overlays own scrolling while the page stays locked and restores its exact position.

## 14. Lifting and Basketball regression

Log/edit a lifting workout and a structured Basketball session. Confirm lifting progression still uses stable IDs, Basketball Finish & Repeat/Advance behavior is unchanged, stored drill snapshots remain historical, and cross-domain counts update only within the chosen range.

## 15. Habits, recurring adherence, History, and Stats regression

Complete and note a custom scheduled Habit, archive another Habit that already has a recorded value/note, and retain a test day containing an unknown historical `habit-*` ID. Generate an export and confirm `--- HABITS ---` still describes current definitions while `--- RECENT HISTORY / PERFORMANCE EVIDENCE ---` reports the actual stored-state count, resolves the custom and archived names with stable IDs, labels the archived definition, and surfaces the unknown stable ID safely. Confirm the cross-domain line says `Scheduled Habit completion: X% across Y eligible scheduled opportunities`, the day records remain byte-identical after export, medication is not converted to a Habit, History/Stats remain readable, and no console errors appear.
