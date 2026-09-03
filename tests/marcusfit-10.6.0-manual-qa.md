# MarcusFit 10.6.0 Basketball manual QA

Status: candidate pending ChatGPT review and Marcus manual QA. Do not merge or mark accepted.

Use a local HTTP server, preserve a production backup, and execute these one at a time at approximately 390 px and on a real iPhone.

## 1. Landing and queue explanation

Open Basketball with Fundamentals active. Confirm the program name, next readable session, Session N of 3, drill count, derivable planned minutes, focus, last comparable result lines, and Start Session are legible without horizontal scrolling. Confirm no raw IDs appear.

## 2. Program view and personalization

Open View Program. Inspect every session and target without starting. With known modified, added, disabled, and reordered personalization, confirm compact indicators describe the resolved current program while disabled future drills remain visibly historical-safe.

## 3. Start and cancel safety

Record the next session, tap Start Session, then Close. Confirm the queue did not advance, no Basketball history record was written, body scrolling is restored, and reopening begins at Drill 1.

## 4. Duration courtside drill

Enter actual duration and optional confidence. Confirm the target is visually dominant, Last/Status is compact, controls are at least 44 px, Complete & Next dismisses the keyboard, and navigating back retains unsaved DOM input.

## 5. Confidence courtside drill

Choose confidence 1–10 and optional planned duration where present. Confirm one selected value is obvious, the target/mode copy is human-readable, and no tiny horizontal control overflow occurs at 390 px.

## 6. Makes-target drill

Enter makes and optional quality confidence. Confirm target and actual use makes semantics only; no attempts or percentage are invented. Navigate back and forward without data loss.

## 7. Shooting benchmark

Enter makes and attempts. Confirm live percentage is derived, makes cannot exceed attempts at finish, minimum-attempt evidence is treated conservatively, and Last/Status compares only the same benchmark identity.

## 8. Neutral skip

Tap Skip — Neutral on one drill. Complete at least one other drill. In review and saved History, confirm the drill reads Skipped and does not appear as failure, regression, or progression evidence.

## 9. Review, finish, and exactly-once advance

Complete the final drill, confirm finish buttons appear only in Session Review, then choose Finish & Advance once. Confirm the completion review shows minutes, recorded/skipped counts, metric-specific results/statuses, and the next session. Reload and confirm the queue advanced exactly once.

## 10. Repeat and historical fidelity

Finish another session with Finish & Repeat. Confirm the same session stays next. Later modify its future drill target through a valid proposal; confirm the saved History entry still shows its original name, target, mode, and result.

## 11. History comparison context

Open an older and a newer result for the same stable drill. Confirm each detail uses evidence available at that point, program/session names come from saved snapshots, skipped drills remain neutral, and unlike modes or same-named unrelated drills are never compared.

## 12. Proposal review/apply/undo

Import a bounded Basketball proposal. Confirm readable program/session/drill names lead, stable IDs are secondary technical text, Before → After/rationale/conflicts/expected writes remain visible, apply requires two stages, queue/history do not change for drill edits, and safe Undo works. Verify a stale proposal refuses with zero writes.

## 13. Backup and AI Export

Back up and restore program, queue, personalization, history, and proposal state on localhost. Confirm raw values round-trip. Generate AI Export and confirm exactly one Basketball section, concise comparable progression context only when evidence exists, the 10.5 mixed response contract remains intact, and no synthetic score appears.

## 14. Real iPhone courtside sanity

Run a mixed Fundamentals session outdoors or in bright light. Confirm dominant targets, one-handed taps, native zoom, safe-area spacing, keyboard dismissal, no clipped bottom buttons, no horizontal scroll, proposal/modal scroll restoration, and a clean console throughout.
