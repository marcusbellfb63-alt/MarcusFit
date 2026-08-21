# MarcusFit 10.1.3 manual QA

Use `http://127.0.0.1:8000/`, never `file://`. Back up production data before
copying it into localhost storage. Keep the pull request draft until every
real-data check below is complete.

1. Restore the pre-10.1.3 backup that exhibited missing virtual-day parents.
   Refresh and confirm startup has no console errors, exercises are unchanged,
   stable IDs remain present, and no day is duplicated or renumbered.
2. Run `mfProgramDayIntegrityDebug()` and `mfLifecycleDebug()`. Record active,
   valid, migrated, active-unresolved, archived-only-ignored, and invalid-orphan
   counts. Remaining warnings must describe genuine unsupported state.
3. Inspect both affected virtual days in Program and Daily Log. Confirm current
   names, original day indexes, custom exercise IDs/order, recommendations, and
   historical workout sets.
4. For each affected virtual day, apply a minor direct field update, reorder,
   recommendations update, safe remove, and reactivation. Confirm reactivation
   restores the exact archived ID and creates no duplicate.
   Explicitly repeat direct update/remove/reactivate for legacy persisted IDs
   `partial-d6-e0`, `partial-d6-e2`, and `partial-d6-e4`; none should be routed
   through the new-ID “expected next exercise index” check. Confirm a fabricated
   nonexistent ID is still rejected.
   Also archive persisted virtual-day ID `partial-d7-e0` and confirm it remains
   in `customExercises` and `inactiveIds` while absent from the resolved day's
   active exercises. A normal field update must report “exercise is archived —
   reactivate it before updating”, must not report an allocator error, and must
   not change storage. Reactivate it through Sync, confirm the exact stable ID
   returns without a duplicate, then confirm the normal field update succeeds.
   Verify `partial-d7-e99` still reaches new-ID validation and is rejected.
5. Export the program. Confirm each virtual day appears exactly once, exported
   IDs are the same IDs Sync accepted, and renamed days are not duplicated as
   old/current identities.
6. Open History for renamed base and virtual days. Confirm the current canonical
   name is primary and a differing saved snapshot appears only as “Previously
   logged as”. Search by both current and historical names. Confirm sets reopen
   and workout/daily storage strings remain unchanged.
7. Create a post-migration backup. Change lifecycle/recommendation state, restore
   the backup, and refresh. Confirm virtual metadata, IDs, archived state,
   replacements, recommendations, overrides, logs, and diagnostics round-trip.
8. Restore the same legacy backup again. Confirm the repair is deterministic and
   a second boot performs no additional lifecycle write or duplicate creation.
9. Smoke Today, Program, Daily Log, History, Stats, Sync, Habits, Adherence,
   Basketball, normal base-day Sync, proposal review, and progression. Confirm
   there are no release-attributable console warnings/errors.
10. Confirm the displayed/export/backup version is 10.1.3, `P` and all 63 base
    exercise IDs are unchanged, accepted `Releases/` files are unchanged, and
    no mobile/settings/Habits redesign is present.
