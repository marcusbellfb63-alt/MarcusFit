# MarcusFit 9.6.0 Manual Browser QA

Use a disposable browser profile or export a backup first. Run against
`Releases/MarcusFit9_6_0.html`. Do not run destructive fixture steps against
the only copy of real data.

## Baseline console helpers

1. Version check

   ```js
   ({ app: APP_VERSION, lifecycle: LIFECYCLE_VERSION, title: document.title })
   ```

   Expected: `{app: "9.6.0", lifecycle: "9.6.0", title: "MarcusFit 9.6.0"}`.

2. Definition-store debug

   ```js
   mfHabitDefinitionsDebug()
   ```

   Expected: `readOnly: true`, `schemaVersion: 1`, both counts consistent with
   `totalDefinitions`, no duplicate IDs, and `backupCoverage: true`.

3. One accepted default

   ```js
   mfHabitDebug("habit-water", new Date().toISOString().slice(0, 10))
   ```

   Expected for an established Marcus store: the stable ID is `habit-water`,
   the name is `Water Intake`, source is `default`, and `readOnly` is `true`.

4. Safe self-test and exact restoration

   ```js
   const qa960Before = JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]));
   const qa960Result = mf960RunHabitSelfTest();
   const qa960After = JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]));
   ({ result: qa960Result, exact: qa960Before === qa960After })
   ```

   Expected: `result.pass`, `result.storageExactlyRestored`, and `exact` are all
   `true`; `failures` is empty.

## Manage Habits

5. Open/cancel without writes

   ```js
   const qa960ManageBefore = localStorage.getItem("mf-habit-definitions");
   p960OpenHabitManager();
   p960CancelHabitManager();
   qa960ManageBefore === localStorage.getItem("mf-habit-definitions");
   ```

   Expected: `true`.

6. Add a custom habit

   Open **Daily Log → Manage Habits → Add Habit**. Enter:

   - Name: `Read`
   - Icon: `📖`
   - Target type: `count`
   - Numeric target: `10`
   - Unit: `pages`
   - Schedule: `daily`

   Choose **Add to Draft**, then **Save Changes**.

   ```js
   p960GetActiveHabits().find(h => h.name === "Read")
   ```

   Expected: one definition with a stable `habit-read...` ID and source `user`.

7. Edit the custom habit

   Change the name to `Read Fiction`, save, then run:

   ```js
   const qa960Read = p960GetActiveHabits().find(h => h.name === "Read Fiction");
   ({ id: qa960Read.id, source: qa960Read.source })
   ```

   Expected: the same stable ID as step 6 and source `user`.

8. Daily schedule rendering

   Navigate backward and forward one date.

   ```js
   p960IsHabitDueOnDate(qa960Read, new Date().toISOString().slice(0, 10))
   ```

   Expected: `true`; the card renders each day.

9. Selected-weekday rendering

   Edit the habit to **selected weekdays** and choose Monday, Wednesday, Friday.

   ```js
   ["2026-07-06","2026-07-07","2026-07-08"].map(d => [d, p960IsHabitDueOnDate(p960GetHabitById(qa960Read.id), d)])
   ```

   Expected: `true`, `false`, `true`. On Tuesday the card is absent and the
   blank date does not count as a miss.

10. Weekly-count progress

    Edit the schedule to weekly count `3`, mark it complete on two dates in the
    same week, save each day, then run:

    ```js
    p960GetWeeklyHabitProgress(p960GetHabitById(qa960Read.id), new Date().toISOString().slice(0, 10))
    ```

    Expected: the card remains visible all week and reports `2 / 3 this week`
    (or the actual number recorded); a partial current week is not failed.

11. Archive

    Archive `Read Fiction`, save, and run:

    ```js
    ({ active: p960GetHabitById(qa960Read.id).active, visible: p960GetActiveHabits().some(h => h.id === qa960Read.id) })
    ```

    Expected: both values are `false`.

12. Historical archived visibility

    Open History on a date where the habit had a completion/value/note.

    Expected: a safe text row shows the archived habit name, completion,
    recorded value/unit, and note.

13. Reactivate

    Reactivate and save.

    ```js
    p960GetHabitById(qa960Read.id).active
    ```

    Expected: `true`; it returns safely to active rendering.

14. Reorder

    Move the custom habit up, save, and run:

    ```js
    p960GetHabitStore().order
    ```

    Expected: its stable ID appears at the chosen position with no duplicates.

15. Daily-save preservation

    On a disposable date:

    ```js
    localStorage.setItem("day-2026-01-02", JSON.stringify({
      date: "2026-01-02",
      futureDailyField: "keep",
      habits: {
        "habit-archived-fixture": { completed: true, notes: "keep", future: 9 },
        "habit-unknown-fixture": { completed: false, notes: "keep too" }
      }
    }));
    ```

    Navigate to 2026-01-02, change a visible field, and choose **Save Day**.

    ```js
    JSON.parse(localStorage.getItem("day-2026-01-02"))
    ```

    Expected: both fixture habit IDs, both notes, `future: 9`, and
    `futureDailyField` remain. Remove this fixture afterward.

16. Stats accuracy

    ```js
    p960GetHabitAnalytics()
    ```

    Expected: denominators use due opportunities only; weekly-count habits use
    completed full weeks once; current partial week is separate; pre-creation,
    post-archive, non-due, future dates are excluded.

17. Export habits section

    Generate an AI export and search for `--- HABITS ---`.

    Expected: active definitions, source, target, schedule, emphasis, eligible
    rate, weekly progress where applicable, archived count, legacy quality
    note, proposal summary when pending, and medication-domain guidance. No raw
    habit JSON appears.

## AI habit proposal

18. Import a valid proposal

   Paste:

   ```text
   MARCUSFIT_UPDATE_START
   {
     "updates": [],
     "habitProposal": {
       "schemaVersion": 1,
       "proposalId": "manual-qa-960",
       "summary": "Make hydration wording clearer",
       "rationale": "Keep the change small and sustainable.",
       "changes": [
         {
           "action": "modify",
           "habitId": "habit-water",
           "fields": {"description": "Hydrate consistently across the day."},
           "rationale": "Clarifies the current habit without changing history."
         }
       ]
     }
   }
   MARCUSFIT_UPDATE_END
   ```

   Before import:

   ```js
   const qa960DefinitionBeforeProposal = localStorage.getItem("mf-habit-definitions");
   ```

   Expected: import says changes await review and definitions remain byte-equal.

19. Review proposal

   ```js
   mfHabitProposalDebug()
   ```

   Expected: `status: "pending"`, one `modify` action, no conflict, expected
   writes limited to both habit keys. The overlay uses text nodes for proposal
   text and offers Close, Apply Supported Changes, and Keep Current Habits.

20. Apply proposal

   Choose **Apply Supported Changes**, then **Confirm Apply**.

   ```js
   ({
     description: p960GetHabitById("habit-water").description,
     proposal: mfHabitProposalDebug()
   })
   ```

   Expected: description changed, proposal status is `applied`, undo is
   available, and only both habit stores changed.

21. Conflict detection

   Import another modify proposal, then edit the same habit through Manage
   Habits before applying.

   ```js
   p960ApplyHabitProposal(true)
   ```

   Expected: `applied: false`, `conflicts` contains the stable habit ID, and
   the later user edit remains authoritative.

22. Undo proposal

   Re-import/apply a clean proposal, then run the preview:

   ```js
   p960UndoHabitProposal(false)
   ```

   Expected: `requiresConfirmation: true`. Complete undo through:

   ```js
   p960UndoHabitProposal(true)
   ```

   Expected: `undone: true` and the exact prior definition snapshot is restored.
   If definitions were edited after apply, expected result is `conflict: true`.

## Storage, regressions, and layout

23. Backup summary

   ```js
   const qa960Backup = p8BuildBackup();
   ({
     definitions: qa960Backup.data["mf-habit-definitions"] === localStorage.getItem("mf-habit-definitions"),
     proposal: qa960Backup.data["mf-habit-proposal"] === localStorage.getItem("mf-habit-proposal"),
     debug: mfBackupDebug()
   })
   ```

   Expected: both booleans are `true`; neither key is reported excluded.

24. Reload persistence

   Reload, then:

   ```js
   ({ habits: p960GetHabitStore(), proposal: p960GetHabitProposal() })
   ```

   Expected: saved definitions/order/archive state and proposal state persist.

25. Fresh Roger regression

   In a new disposable browser profile, complete starter/shared setup as Roger.

   ```js
   mfHabitDefinitionsDebug()
   ```

   Expected: Roger does not inherit the full seven Marcus habits, Zepbound, any
   Marcus completions, or medication events. Zero active habits is usable.
   General-gym starter remains 3 days and 12 exercises.

26. Established Marcus regression

   Restore a 9.5.10 backup that contains old daily habit state but no new keys.

   ```js
   mfHabitDefinitionsDebug()
   ```

   Expected: seven accepted stable IDs initialize once; old completion objects
   and notes remain byte-identical; History resolves accepted labels.

27. Zepbound independence

   ```js
   ({
     recurring: mfRecurringStorageDebug(),
     habitNamedZepbound: Object.values(p960GetHabitDefinitions()).some(h => /zepbound/i.test(h.name))
   })
   ```

   Expected: recurring debug remains healthy; `habitNamedZepbound` is `false`.
   `mf9510RunScheduledAdherenceSelfTest().pass` remains `true`.

28. Mobile layout

   Test responsive widths near 360 px and 480 px.

   Expected: cards and value controls do not overflow; weekly progress wraps;
   manager and proposal overlays scroll; Save/Cancel remain reachable; no
   horizontal overflow; sticky Daily Save, Zepbound, and workout layout remain
   usable and unchanged.

29. Clean-load console check

   Reload with DevTools open.

   ```js
   ({
     habitSelfTest: mf960RunHabitSelfTest().pass,
     progression: mf959RunProgressionSelfTest().pass,
     recurring: mf9510RunScheduledAdherenceSelfTest().pass
   })
   ```

   Expected: all three values are `true`, with no uncaught console exceptions,
   storage parse errors, CSP errors, or missing-element errors.
