# Daily Habit routine options — manual QA

Use a localhost HTTP server and a backup/test profile. Keep production data
separate. Test iPhone Safari and Home Screen plus a desktop keyboard/browser.
This candidate remains draft until Marcus explicitly accepts manual QA.

1. Load an existing daily Mobility Reset Habit and historical completions.
   Import `docs/examples/hip-routine-options.sync.txt`. Verify import opens a
   pending review with both separate instruction lists and changes no history.
2. Confirm Apply. Verify one Habit card and one daily progress opportunity.
   Expand it and select Challenging; verify only its instructions appear.
3. Complete Challenging, then select Easy. Verify completion/value clear but
   notes remain. Complete Easy; verify daily progress counts it once.
4. Reload/resume a draft, then Save Day and reload it. Verify selection, name,
   target, notes, and completion persist. Repeat on a historical date and verify
   other days are unchanged. Previously unclassified completions remain valid
   and are labelled routine unspecified rather than a named routine.
5. Record Challenging on an adjacent date. Verify a recovery reminder appears
   without blocking selection. Verify Easy does not increment Challenging
   frequency, and the three-session goal creates no extra missed obligation.
6. Edit a routine through Habit Manager. Verify Cancel discards changes, Update
   Draft writes no definitions, Save Changes persists them, and saved history
   retains its original routine label. Test Add/Remove, invalid one-choice
   configurations, a maximum of six choices, and empty choices to remove them.
7. Export and restore a backup in an isolated profile. Verify raw historical
   completions and routine snapshots survive. Confirm malformed option targets,
   instructions, IDs, and weekly guidance are rejected.
8. Verify text size/zoom, narrow screens, keyboard selection, focus after a
   selection change, and proposal scrolling. Confirm lifting, Basketball,
   ordinary Habits, preference-off dates, and existing Sync workflows behave
   as before. Do not merge before explicit acceptance.
