# MarcusFit 10.8.0 manual QA

Status: implementation candidate only. Do not merge or mark the PR ready until Marcus completes real-iPhone QA and explicitly accepts the candidate.

Automated and localhost browser-control pass: initial matrix complete on 2026-09-04; focused same-day/unit correction pass complete on 2026-09-05. The responsive matrix and representative recommendation scenarios below passed in the desktop browser controller. Items explicitly reserved for a physical iPhone remain unchecked and are required before acceptance.

## Setup and protection

- Create and retain a production backup before testing restored data on localhost.
- Serve the repository through localhost; do not use `file://`.
- Confirm the page title and visible release line say `MarcusFit 10.8.0 — Smarter Lifting`.
- Confirm startup has no console errors or unexpected warnings.
- Confirm current Program customization, workout history, Habits, Basketball, profile, recommendations, and proposals are present and unchanged.

## Responsive browser matrix

Repeat the lifting checks at 320 px, approximately 390 px, 480 px, and desktop width. At each mobile width, test Compact, Standard, Large, and Extra Large text.

- No horizontal page or workout-card overflow.
- Action, evidence reason, and confidence remain readable and visually distinct from editable set fields.
- The Next session disclosure can be opened by touch, Enter, and Space; `aria-expanded` changes correctly.
- Focus indicators remain visible and no recommendation surface covers an active field or Save Day.
- Primary horizontal swipe navigation ignores workout controls and open recommendation controls.

## Fresh and sparse evidence

- Fresh startup/no history: select a HOME and PARTIAL workout. Each new exercise reports insufficient evidence without filling blank set fields.
- Log only one of several prescribed sets. Confirm the recommendation says to repeat and explains the completed/prescribed set count.
- Leave RIR missing or choose N/A on a lift with programmed RIR. Confirm no load increase is recommended and the reason names missing/N/A RIR.
- Log a legacy-shaped workout that lacks newer optional fields. Confirm history and a conservative recommendation still render without errors or writes.

## Numeric lifting decisions

- Complete all prescribed sets within the rep range but below its top. Confirm Progress reps and a reason tied to the range.
- Complete every prescribed set at the top with qualifying RIR and one exact uniform numeric load. Confirm Progress load, a modest bounded target, and a complete-set reason.
- Use different numeric loads across working sets. Confirm no precise load increase is suggested.
- Reproduce an unusually large apparent jump versus the previous comparable session. Confirm the system requests a confirming repeat rather than another increase.
- Record a greater-than-20% same-load rep decline. Confirm maintain/reduce conservatively guidance.
- Reach the Program load ceiling once, then twice, with complete qualifying sets/RIR. Confirm the first result requests confirmation and the second requests maintain/ceiling review.
- Lower the current Program target below prior comparable load. Confirm target-reset guidance without any historical rewrite.
- On a kg-based exercise, log the exact raw value `30`. Confirm the saved field remains `30` and the recommendation is expressed in kg with no automatic 5 kg jump.
- Compare unitless kg, explicit `30 kg`, and explicit `70 lb` evidence. Confirm the first two are kg-compatible, while pounds and mixed units fall back to qualitative guidance with no conversion.
- Repeat the assisted-load direction check in both pounds and kilograms; both must progress by reducing assistance with conservative unit-aware steps.

## Flexible and non-load values

- Enter and save each raw load exactly: `Bodyweight`, `Bodyweight + red band`, `110 lb assistance`, `20 lb/side`, `25–30 lb`, `full stack`, and a machine-pin description.
- Reopen each saved day and confirm every load string is byte-for-byte unchanged.
- Confirm exact single assisted load progresses by reducing assistance, never increasing it.
- Confirm bodyweight, bands, ranges, full-stack, machine-pin, and mixed numeric/text history receive qualitative rep/setup guidance, not invented arithmetic.
- Confirm `20 lb/side` keeps the `/side` qualifier in any safe numeric suggestion.
- Confirm duration movements use minutes/seconds language and never lifting-load language.
- Confirm rep-range and duration inputs retain the correct numeric/decimal keyboard hints.

## Save, edit, and recalculation

- Save a new workout, note the post-save next recommendation, then navigate away and back.
- Open an existing historical day, edit the workout in place, and save. Confirm the same date/session remains one history entry rather than creating a duplicate.
- Confirm the post-save recommendation changes from the edited evidence and no other date changes.
- With one qualifying ceiling session yesterday, fill but do not save today's second session. Confirm normal Next session guidance still sees one stored ceiling session. Save today and confirm the post-save review immediately changes to maintain/ceiling review with exactly two qualifying sessions.
- Re-save and edit today's session. Confirm the date-key record is replaced, the qualifying count is recalculated, and the current record is never counted twice.
- Edit a backdated workout with both earlier and later comparable history. Confirm the result excludes the edited record itself and compares only with the proper preceding session.
- Generate AI Export and `mfProgressionDebug()` after saving today. Confirm both name today's saved record as latest evidence and report the same ceiling count as the post-save review.
- Clear or delete data only through an existing supported workflow, then confirm the affected recommendation falls back safely.
- Change selected workout day and switch HOME/PARTIAL. Confirm history and recommendations follow the selected stable exercise/day context without cross-contamination.
- Archive and reactivate an exercise with its same stable ID. Confirm its comparable history returns. Confirm a custom exercise addition uses only its own stable ID history.
- Apply and undo a supported Program proposal. Confirm recommendations recalculate from the resolved target while proposal state and history remain unchanged except for the explicit Program operation.

## Accepted-regression checks

- Daily Log sections still start collapsed; Save Day appears only on Daily Log and stays visible on mobile.
- Weight/load fields default to the decimal keyboard. Toggle `ABC` then `123`; confirm the raw value and focus survive both changes.
- Primary Tools and internal Sync keyboard navigation still support ArrowLeft, ArrowRight, Home, and End.
- History, Stats, AI Export, backup/restore, and all Sync combinations still work.
- Program, Habit, and Basketball proposals remain review-first; preview/reject/undo do not alter unrelated data.
- Basketball historical snapshots and progression remain unchanged.
- Verify no unexpected console warning, uncaught error, overflow, focus loss, or hidden Save Day control.

## Real-iPhone-only checklist

Desktop controllers cannot genuinely validate the following. Marcus must test these in installed/standalone iPhone Safari and, where useful, a normal Safari tab:

- Decimal keyboard opens by default for load; `ABC`/`123` switches keyboards while preserving the exact raw string, caret/focus, and scroll position.
- Next session disclosures activate reliably by touch and do not trigger primary swipe navigation.
- Horizontal swipes beginning on load, reps, RIR, keyboard-toggle, notes, workout selector, or recommendation disclosure do not change primary tabs.
- Compact through Extra Large text produces no clipped set controls, horizontal overflow, or inaccessible recommendation text at the device width.
- The software keyboard does not cover the active input or mobile Save Day bar; dismissing it does not jump to another section.
- Saving and editing in place retain one exact historical date identity after backgrounding/reopening the PWA.
- Navigating away and back preserves accepted 10.7 top/reset behavior and recomputes the appropriate recommendation.
- HOME/PARTIAL switching, bodyweight/band/assistance/raw-text entry, duration entry, and post-save review behave the same after a cold launch.
- Daily Log collapsed state, Tools IA, proposal modals/scroll locks, Basketball courtside screens, and safe-area spacing remain correct.
- No console error can be observed through connected Safari Web Inspector during the full pass.

Record iPhone model, iOS version, Safari versus installed PWA mode, text-size setting, and pass/fail notes for every real-device-only item before acceptance.
