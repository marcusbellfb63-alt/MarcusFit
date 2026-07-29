# MarcusFit 9.5.10 manual browser QA

Serve the repository locally and open `Releases/MarcusFit9_5_10.html`. Use a disposable browser profile or create a backup before action tests.

## Console checks

1. Version:

   ```js
   ({APP_VERSION,LIFECYCLE_VERSION,title:document.title,release:[...document.querySelectorAll("#screen-export .info-box")].map(x=>x.innerText).find(x=>x.includes("9.5.10"))})
   ```

   Expected: both versions are `9.5.10`, title is `MarcusFit 9.5.10`, and the release text begins `MarcusFit 9.5.10 — Schedule-Aware Adherence`.

2. Storage:

   ```js
   mfRecurringStorageDebug()
   ```

   Expected: `readOnly:true`, both backup coverage values `true`, parse status `true`, and no warnings/orphans/duplicates for valid data.

3. Yesterday/today/tomorrow schedule:

   ```js
   const td=p9510DateKey(new Date()); [p9510AddDays(td,-1),td,p9510AddDays(td,1)].map(d=>mfRecurringAdherenceDebug("zepbound",d))
   ```

   Expected: three deterministic date-key results; exact states depend on the configured weekday and recorded outcomes.

4. Safe self-test and exact storage comparison:

   ```js
   const snap=()=>Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])); const before=snap(); const test=mf9510RunScheduledAdherenceSelfTest(); const after=snap(); ({test,exact:JSON.stringify(before)===JSON.stringify(after)})
   ```

   Expected: `test.pass:true`, no failures, `storageExactlyRestored:true`, and `exact:true`.

5. Setup preview/cancel:

   ```js
   const recurringRaw=()=>[localStorage.getItem("mf-recurring-items"),localStorage.getItem("mf-recurring-events")]; const beforeSetup=recurringRaw()
   ```

   Open Setup, change visible inputs, click Cancel, then run:

   ```js
   ({beforeSetup,afterSetup:recurringRaw(),exact:JSON.stringify(beforeSetup)===JSON.stringify(recurringRaw())})
   ```

   Expected: `exact:true`.

6. Saved schedule:

   ```js
   mfRecurringAdherenceDebug("zepbound",p9510DateKey(new Date()))
   ```

   After using Setup → Save, expected: `itemExists:true`, `enabled:true`, the chosen anchor/weekday/grace values, and both storage keys backup-covered.

7. No-write screens:

   ```js
   const readOnlyBefore=recurringRaw()
   ```

   Change Daily Log dates, open History and Stats, generate an export, and call both debug helpers. Then:

   ```js
   ({exact:JSON.stringify(readOnlyBefore)===JSON.stringify(recurringRaw()),after:recurringRaw()})
   ```

   Expected: `exact:true`.

8. Backup:

   ```js
   const b=p8BuildBackup(); ({items:b.data["mf-recurring-items"],events:b.data["mf-recurring-events"],summary:p8492SummarizeBackup(b),health:mfBackupDebug()})
   ```

   Expected: present keys round-trip as raw strings; summary flags recurring schedules/events when present; backup coverage has no recurring-key exclusion.

9. Export:

   ```js
   const text=genExport(); ({hasSection:text.includes("--- SCHEDULED ADHERENCE ---"),hasBlankRule:text.includes("Blank non-due days are not misses"),hasMedicationGuard:text.includes("do not provide medication dosing/timing instructions")})
   ```

   Expected: all three values `true`.

## UI flow checklist

- Fresh/shared state: no enabled Zepbound schedule, no forced medication setup, Daily Log usable, and starter General Gym remains 3 days/12 exercises.
- Established state: a legacy `zep:"yes"` may prefill setup’s anchor proposal, but opening/canceling setup creates no recurring key and rewrites no history.
- Save schedule: weekday, anchor, grace, enabled, and paused persist after reload.
- Non-due date: shows next due date and no required Taken/Skip controls; “Record early / other date” is explicit.
- Due date: shows Due today with Taken, Skip, and Reschedule.
- Within grace: shows due/within grace; after grace shows the number of days late.
- Taken: inline actual-date field appears; recording creates one structured occurrence and writes `zep:"yes"` only to the actual daily record.
- Skip: creates an explicit skipped event and writes `zep:"no"` only to that action date.
- Reschedule: inline replacement-date field appears; original is resolved, replacement date becomes due/trackable, and summary counts once.
- Correction: Clear / correct removes only the current occurrence and its matching compatibility bridge value.
- Pause/resume: paused UI accumulates no misses; resume does not backfill the paused interval.
- History: structured Zepbound text appears once; non-Zepbound history is unchanged; non-due dates never say missed.
- Stats: concise 8-week card shows scheduled/on-time/late/skipped/unresolved and the occurrence-based denominator.
- Sync: release card identifies 9.5.10; export includes Scheduled Adherence and neutral AI guidance.
- Backup/restore: a 9.5.9 backup lacking optional recurring keys restores; a 9.5.10 backup round-trips both keys exactly; malformed optional stores warn rather than crash.
- Reload: saved definition/events and displayed outcome persist.
- Established Marcus regression: run `mf9510RunScheduledAdherenceSelfTest()` and `mf959RunProgressionSelfTest()`; both must pass and restore storage.
- Mobile 360 px and 480 px: status readable, action buttons wrap without horizontal overflow, date input usable, setup collapsed by default, and sticky Save bar remains usable.
- Console: no new uncaught errors during the above flows.
