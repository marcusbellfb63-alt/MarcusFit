# MarcusFit 10.1.4 Manual QA

Status: implementation candidate; not accepted until Marcus completes this checklist and explicitly approves it.

Before testing, create a MarcusFit backup. Use a local HTTP server or the deployed draft; never use `file://`.

## iPhone 15 / Safari

- Launch the app and confirm there are no console errors.
- Pinch zoom in and out; confirm zoom is not blocked.
- Rotate portrait/landscape; confirm no unexpected horizontal page scrolling and safe areas are respected.
- Confirm the sticky header, navigation labels, and current date remain readable and tappable.
- Open Program, Daily Log, History, Stats, and Sync; confirm cards and long labels wrap without clipping.
- Enter Daily Log metrics and workout sets; confirm inputs do not trigger unwanted Safari focus zoom.
- Open the keyboard on notes, set inputs, profile fields, and Sync textareas; confirm Save/action controls remain reachable.
- Confirm the workout Save bar remains reachable above the bottom safe area.
- In Sync > Profile & Display, select Compact, Standard, Large, and Extra Large; confirm each applies immediately.
- Reload after each size change; confirm the selected size persists.
- At Large and Extra Large, confirm navigation, forms, primary actions, History, Stats, proposal review, and basketball controls remain reachable and wrap instead of clipping.

## Sync and settings

- Open Sync and confirm Generate Export, Copy, Sync input, Apply Update, and Sync result are immediately visible without expanding a disclosure.
- Confirm Profile & Display starts open; AI Coaching Preferences, Program Personalization, Habits, Backup & Restore, and Diagnostics & Lifecycle start collapsed when they have no pending status.
- Expand/collapse every section by touch and keyboard; confirm focus is visible and `aria-expanded` changes.
- Trigger an invalid Sync block; confirm the error remains visible in the always-open primary area.
- Save profile edits, units, gym labels, and text size; reload and confirm all persist.
- Save AI coaching preferences and confirm export still includes them.
- Create a backup and copy it.
- Paste a disposable backup and open restore preview; confirm the active confirmation cannot be hidden by collapsing Backup & Restore.
- Cancel restore. Do not clear or replace real data unless using a disposable backup/test state.
- If a program or Habit proposal is pending, confirm its section opens or its header clearly surfaces the pending status.

## Habit Manager

- With real existing habit definitions, open Sync > Habits > Manage Habits.
- On iPhone, confirm the manager fills the screen, isolates the background, and prevents background scrolling.
- Confirm the header and footer actions stay reachable while the habit list/form body scrolls.
- Confirm active rows are easy to scan and initially show icon/name, description or target, schedule, and one Details affordance.
- Expand Details; confirm Edit, Move Up, Move Down, and Archive remain available with touch-friendly targets.
- Edit a habit without saving, then Cancel the manager; reopen and confirm the edit did not persist.
- Reorder a habit, archive a habit, and choose Save Changes.
- Confirm Daily Habits reflects the saved order/archive state.
- Reopen the manager; confirm Archived Habits (N) is separate and collapsed by default.
- Expand Archived Habits, reactivate the habit, save, and confirm it returns to Daily Habits with the same stable identity/history.
- Repeat manager scrolling, edit, archive/reactivate, and save/cancel checks with Extra Large text.
- Open Review Habit Proposal; confirm pending changes still require explicit review and daily History/Stats/export behavior continues to use the same definitions.

## Regression

- Confirm Program renders for Home and Transition/Partial gyms.
- Open a workout, log sets, save it, and reopen it from History.
- Confirm Stats loads and reflects saved data.
- Log, edit, and delete a disposable basketball session; confirm basketball History/Stats still work.
- Generate an AI export and confirm workout, profile, habits, and basketball sections are present as expected.
- Apply one known-valid Sync fixture and one invalid fixture; confirm valid behavior and rollback/error behavior are unchanged.
- Confirm backup creation and restore preview still work.
- Finish with no browser console errors or warnings attributable to 10.1.4.
