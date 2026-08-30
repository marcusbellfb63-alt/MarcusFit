# MarcusFit 10.4.0 Manual QA — Habits AI Sync Safety

Do not mark this checklist passed until it has been completed in a real browser and the mobile section has been completed on a real iPhone. Start localhost through HTTP, never `file://`. Record failures with the proposal JSON, browser/device, console output, and the step where behavior diverged.

## A. Baseline and backup

- [ ] Open the accepted production app and create/download a fresh full backup before testing localhost.
- [ ] Serve this branch through a local HTTP server and confirm the app displays `10.4.0`.
- [ ] Confirm the console is clean on initial load and after navigating every main tab.

## B. AI Export

- [ ] Generate an export and confirm active Habits include names, stable IDs, targets, schedules, emphasis, and recent eligible completion.
- [ ] Confirm archived count, data-quality warning when applicable, and pending-proposal status remain useful.
- [ ] Confirm the compact Habit proposal contract is understandable and no obvious history dump, duplicated instructions, or unrelated reordering was added.

## C. Add Habit proposal

- [ ] Import a valid `add` proposal with a new `habit-...` stable ID.
- [ ] Confirm it remains pending and the Habit does not exist before review/apply.
- [ ] Review the added definition and stable ID.
- [ ] Click `Apply Supported Changes`; verify no change yet and the button becomes `Confirm Apply`.
- [ ] Confirm apply and verify the new Habit definition appears.
- [ ] Verify representative historical daily Habit logs are byte-for-byte unchanged.

## D. Modify Habit

- [ ] Import a bounded modification covering name and target or schedule.
- [ ] Confirm the review clearly shows human-readable BEFORE → AFTER details and the stable ID.
- [ ] Complete both apply clicks and verify only the proposed supported fields changed.

## E. Archive/deactivate

- [ ] Import and apply an `archive` proposal.
- [ ] Confirm the Habit is excluded from future active UI semantics.
- [ ] Confirm its historical adherence, values, notes, and unknown fields remain present in History/storage.

## F. Reactivate

- [ ] Import and apply `reactivate` for the archived Habit.
- [ ] Confirm the exact same stable ID becomes active.
- [ ] Confirm prior adherence remains associated with that ID.

## G. Reorder

- [ ] Import and apply a valid reorder; verify the resulting order exactly.
- [ ] Import another reorder, manually reorder Habits before applying it, and verify stale apply is refused with the proposal still pending.

## H. Pending persistence

- [ ] Import a proposal, choose `Close / Review Later`, and reload.
- [ ] Reopen from Settings and confirm the same proposal, status, and expected-state evidence persist unchanged.
- [ ] Attempt to import a second Habit proposal and confirm the existing pending proposal is not replaced.

## I. Stale Habit conflict

- [ ] Import a modify proposal, then manually edit that same Habit in Manage Habits.
- [ ] Reopen and attempt both apply clicks.
- [ ] Confirm apply is refused, the review stays open, the proposal remains pending, and the newer manual edit remains intact.
- [ ] Confirm no daily history or unrelated store changed.

## J. Stale reorder conflict

- [ ] Import a reorder proposal, manually reorder Habits, then apply the old proposal.
- [ ] Confirm the old proposal is refused and the user's newer order remains intact.

## K. Add-ID conflict

- [ ] Import an add proposal and use a controlled console/test fixture to occupy that exact proposed ID before apply.
- [ ] Confirm apply is refused with zero proposal definition writes and the proposal remains pending.

## L. Safe Undo

- [ ] Apply a proposal and confirm `Undo Habit Changes` is visible in the applied review.
- [ ] Click it once and verify the button becomes `Confirm Undo` without changing storage.
- [ ] Confirm Undo and verify the exact raw pre-apply Habit definitions return.
- [ ] Confirm daily Habit history remains unchanged and proposal status becomes `undone`.

## M. Unsafe Undo

- [ ] Apply a proposal, then manually edit Habit definitions afterward.
- [ ] Attempt Undo and confirm it refuses with a clear conflict explanation.
- [ ] Confirm the manual edit survives and no restoration write occurs.

## N. Long real-device iPhone proposal

- [ ] On a real iPhone Safari/PWA, open a proposal long enough to require scrolling.
- [ ] Swipe inside the proposal and confirm the proposal scrolls independently.
- [ ] Confirm the underlying page does not drift and all controls remain reachable around safe areas.
- [ ] Close from a known page position and confirm the exact position is restored.
- [ ] Confirm focus behavior is sensible and normal browser pinch zoom remains available.
- [ ] Open/use/close Manage Habits separately and confirm its behavior is unaffected.

## O. Mixed Sync

- [ ] Test core + Habit: core processing remains accepted and Habit changes remain pending review.
- [ ] Test Habit + Basketball: both proposals persist pending and neither applies automatically.
- [ ] Test core + Habit + Basketball: core behavior remains accepted and both proposals remain review-first.
- [ ] With an existing pending Habit proposal, verify mixed Sync refuses replacement before core/proposal processing.
- [ ] Verify invalid Basketball preflight and grouped proposal rollback behavior remain accepted.

## P. Backup/restore

- [ ] Create a backup containing current Habit definitions and a pending Habit proposal.
- [ ] Restore it through the two-stage restore flow.
- [ ] Confirm the pending proposal and immutable expected evidence remain intact.
- [ ] Confirm definitions and representative history values/notes/unknown fields remain intact.
- [ ] Restore/test an older pending proposal fixture missing expectations and confirm it is stale; validation/review/debug must not regenerate evidence.

## Q. Regression

- [ ] Normal manual Habit add/edit/archive/reactivate/reorder remains correct.
- [ ] Daily Habit completion, numeric/text values, and notes save and reload correctly.
- [ ] History and Stats/adherence remain correct.
- [ ] Lifting workout save and progression behavior remain correct.
- [ ] Basketball structured/free-form save and Basketball proposal review remain correct.
- [ ] Core AI Sync and AI Export remain correct.
- [ ] Repeat console sanity after all scenarios.

## Result

- Tester/date/device/browser:
- Production backup filename/location:
- Passed: **Not yet — requires Marcus manual QA**
- Failures/notes:
