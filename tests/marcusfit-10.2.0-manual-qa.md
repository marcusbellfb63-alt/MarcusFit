# MarcusFit 10.2.0 Manual QA

Status: implementation candidate awaiting Marcus's explicit approval. Use
disposable localhost data and create a backup before restore testing. Serve the
repository through local HTTP; do not use `file://`.

## Program setup

- Open Daily Log > Basketball and verify free-form logging is still available
  without selecting a program.
- Choose **Guard Skills — 3 Session** and press **Use Program**.
- Verify **Session A — Handle + Weak Hand** is next and its five drills appear
  in deterministic order.
- Reload. Verify the program and Session A queue position persist.
- Select a different program. Verify the in-app confirmation appears, Cancel
  changes nothing, and Confirm starts the new program at Session 1 without
  deleting History.
- Use **Restart From Session 1** after advancing and verify only the active queue
  position resets.

## Structured session and advance

- Restore/select Guard Skills, start Session A, and verify the logger shows only
  relevant inputs for each drill.
- Record Weak-Hand Control actual duration and a confidence score.
- Record Behind-the-Back at **3 / 10** and add an optional drill note.
- Complete Weak-Hand Finishing by recording makes only; verify no attempts field
  or inferred shooting percentage is shown.
- Record Free Throws Benchmark as **16 made / 20 attempted** and verify **80%**.
- Enter total session minutes and inspect the live session summary.
- Choose **Finish & Advance**. Verify the structured record appears in History
  and **Session B — Change of Pace** becomes next.
- Reload and verify Session B remains next.

## Repeat and incomplete flows

- Start Session B, enter a valid result for only one drill, leave the remaining
  drills untouched, and choose **Finish & Repeat Session**. Verify the partial
  record saves, untouched drills read **Skipped**, and Session B remains next.
- Repeat the partial flow with **Finish & Advance**. Verify the partial record
  saves and the queue advances exactly once.
- Try to finish a structured session with total minutes but no drill result.
  Verify it is rejected as empty and nothing saves or advances.
- For a completion drill, verify **Skipped / no result**, **Completed**, and
  **Not completed** remain distinct after save and reopen.
- Start a planned session, change some fields, then Close without finishing.
  Verify no session was saved and the queue did not advance.
- Trigger a validation error (for example, benchmark makes above attempts).
  Verify nothing saves or advances and the error is readable.

## Confidence progression

- Using disposable structured sessions for the same stable drill, record a
  sequence such as **3, 3, 4**. Verify guidance holds at the foundation.
- Clear/rebuild disposable data with **7, 8, 8** for that drill. Verify guidance
  becomes **Ready to Progress** and names the defined harder variation where one
  exists.
- Verify one isolated score of 9 or 10 does not immediately produce Ready to
  Progress.

## Makes-target and benchmark progression

- For one makes-target drill with a goal of 20, record **14, 17, 16** across
  sessions. Verify the current target is held.
- Record three target completions with confidence around **7, 8, 8**. Verify a
  modest target/difficulty progression is suggested.
- Verify makes-target history/export never invents attempts or percentage.
- Create at least three valid benchmark samples and verify the percentages and
  recent trend order. Verify a sample below the stated minimum does not drive a
  trend.

## Free-form isolation

- Note the next planned session, then log a Pickup / Game free-form session.
- Verify the free-form session appears in History and Stats.
- Verify it does not contain program/drill metadata and does not move the queue.
- Edit and delete a free-form session and verify existing 10.1.0 behavior.

## History and Stats

- Open a structured History entry and verify stored program/session snapshots,
  each drill result, confidence, benchmark percentage, notes, and guidance.
- Verify skipped drills are labeled **Skipped**, contain no fabricated zero or
  confidence value, and do not count in most-practiced or progression evidence.
- Edit a structured entry. Verify its stable `bball-*` session ID is preserved
  and editing does not move the active queue.
- Verify a free-form entry remains visually distinct and fully readable.
- In Analytics, verify all-time basketball sessions/minutes, structured count,
  most-practiced drills, confidence trends, benchmarks, and recent sessions.

## AI Export and Sync isolation

- Generate **Program Only** export with an active basketball program and no
  recent basketball activity. Verify active program, next session, position, and
  planned drills appear.
- Generate a recent/full export after structured sessions. Verify drill results,
  confidence, benchmarks, and deterministic guidance appear.
- Verify an empty/no-program basketball state adds no confusing empty section.
- Apply one known-valid lifting `MARCUSFIT_UPDATE`, then one invalid block. Verify
  accepted valid/invalid/rollback behavior and confirm there are no basketball
  Sync actions or mutations.

## Backup and restore

- Create a backup after advancing a program. Confirm it includes both
  `mf-basketball-sessions` and `mf-basketball-program-state`.
- Change the queue and add disposable sessions, then restore the backup through
  the two-step in-app confirmation. Verify sessions, active program, and exact
  next-session position return.
- Restore a valid legacy backup without `mf-basketball-program-state`. Verify it
  succeeds with no active program and preserves legacy basketball sessions.
- Paste a backup with malformed program-state JSON. Verify validation rejects it
  before replacement restore.

## Responsive and accessibility matrix

Test widths **320, 375, 393, 430, 480, 768, and 1280px** in each text mode:
Compact, Standard, Large, and Extra Large.

- Check program picker, next-session card, drill list, confidence buttons,
  makes-target and benchmark inputs, summary, both Finish buttons, structured
  History, and basketball Stats.
- Inspect structured **Session Date** and **Total Minutes** at 320, 375, 393,
  430, and 480px in every text mode. Verify both stay fully inside the metadata
  grid, including the native iOS date value and picker affordance.
- Verify no page or component has horizontal overflow.
- Verify interactive targets are approximately 44px or larger and form controls
  do not trigger unwanted iOS zoom.
- Verify all 1–10 confidence buttons work by touch and keyboard, expose their
  selected state, and remain usable one-handed.
- Verify Extra Large text does not clip drill names, values, guidance, or actions.
- Verify sticky Finish actions do not cover the last field, remain reachable
  with the software keyboard open, and do not create a keyboard trap.
- Verify program-switch, restart, and delete dialogs close with Cancel, backdrop,
  and Escape where supported.

## Full regression

- Log and reopen a lifting workout; verify set values and progression.
- Verify Daily Log, History filters/search, Analytics, Habits, profile/text-size
  settings, AI Export, valid/invalid AI Sync, and backup clear/restore flows.
- Verify all four 10.1.4 text modes and the prior workout-row/habit-rename fixes.
- Finish with no unexpected console errors or horizontal overflow.
