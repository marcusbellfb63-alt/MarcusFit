# MarcusFit 10.3.0 basketball AI Sync manual QA

MarcusFit 10.3.0 is an implementation candidate awaiting manual QA. Do not
merge or call it accepted until this checklist is completed and explicitly
approved.

## Safety setup

1. Run the branch through a local HTTP server or the draft deployment; never use
   `file://`.
2. In production, create and copy a full MarcusFit backup before testing.
3. Use disposable localhost data or a disposable browser profile for proposal,
   restore, and conflict tests.
4. Record the current outputs of `mfBasketballDebug()`,
   `mfBasketballOverridesDebug()`, and `mfBasketballProposalDebug()`.
5. Confirm pinch zoom remains enabled and no native browser confirmation dialog
   appears anywhere in this checklist.

## AI Export

1. Select Guard Skills — 3 Session and leave Session A next.
2. Generate Program Only and Program + Last 14 Days exports.
3. Confirm the basketball section includes:
   - stable program, session, and drill IDs;
   - current resolved targets and tracking modes;
   - `base` or `personalized` source context;
   - applied override counts and pending-proposal status;
   - recent confidence, benchmark, skipped-drill, and progression context when present;
   - the supported `basketballProposal` schema and an example;
   - explicit immutable-history, skipped-neutral, and session-driven rules.
4. Confirm the export does not dump full redundant program JSON or suggest
   automatic completion/advancement.

## Valid modify proposal

With Guard Skills Session A active, paste this disposable block:

```text
MARCUSFIT_UPDATE_START
{
  "updates": [],
  "basketballProposal": {
    "schemaVersion": 1,
    "proposalVersion": 1,
    "proposalId": "bball-proposal-manual-modify-1",
    "summary": "Increase Behind-the-Back duration modestly",
    "rationale": "Repeated low confidence supports more foundational practice.",
    "changes": [{
      "action": "modify_drill",
      "programId": "guard_skills_3_session",
      "programVersion": 1,
      "sessionId": "guard_a_handle_weak_hand",
      "drillId": "guard_behind_back_foundation",
      "fields": { "target": { "durationMinutes": 10 } }
    }]
  }
}
MARCUSFIT_UPDATE_END
```

Verify:

- Sync says the proposal is pending and does not imply it was applied.
- The next-session target remains 8 minutes before review/apply.
- Close / Review Later leaves a visible Pending basketball proposal card.
- Reopen review; it shows the human-readable drill name and 8 → 10 minutes.
- First Apply Supported Changes reveals Confirm Apply and writes nothing.
- Confirm Apply changes the resolved next-session target to 10 minutes.
- `mf-basketball-sessions` is byte-identical before and after.
- The built-in drill returned from the test/debug base template remains 8 minutes.

## Add drill proposal

Dismiss/undo the previous disposable proposal, then import:

```text
MARCUSFIT_UPDATE_START
{
  "updates": [],
  "basketballProposal": {
    "schemaVersion": 1,
    "proposalVersion": 1,
    "proposalId": "bball-proposal-manual-add-1",
    "summary": "Add stationary behind-the-back control",
    "rationale": "Use an easier control block before the existing foundation.",
    "changes": [{
      "action": "add_drill",
      "programId": "guard_skills_3_session",
      "programVersion": 1,
      "sessionId": "guard_a_handle_weak_hand",
      "drillId": "bball-ai-behind-back-stationary-control-v1",
      "position": 2,
      "drill": {
        "id": "bball-ai-behind-back-stationary-control-v1",
        "name": "Behind-the-Back Stationary Control",
        "trackingMode": "confidence",
        "confidence": true,
        "target": { "durationMinutes": 5 }
      }
    }]
  }
}
MARCUSFIT_UPDATE_END
```

After two-stage apply, verify exact position 3 (zero-based payload position 2),
the 5-minute plan, Confidence 1–10 controls, stable ID in export, and inclusion
in a newly saved structured-session snapshot. Old History must remain unchanged.

## Remove / disable drill

Import a proposal using `remove_drill` for
`guard_behind_back_foundation`. Review must say “Remove from future planned
sessions” and must not imply historical deletion. After apply, verify it is
absent from the future Session A logger while historical sessions containing it
remain visible with their old name, target, results, and progression evidence.

## Reorder

Import `reorder_drills` for one planned session with every currently resolved
drill ID exactly once. Verify review shows human-readable order and apply changes
only the future card/logger order. Confirm historical drill order is unchanged.
Then try a duplicate, missing, or unknown ID and verify import is rejected.

## Reject

Import a valid proposal and select Keep Current Basketball Program. Verify the
proposal status becomes rejected, the pending card disappears, and overrides,
queue state, sessions, workouts, habits, and profile do not change.

## Conflict

1. Import a valid modify proposal but do not apply it.
2. Change the relevant basketball program/override state after import (a
   disposable console edit is acceptable on localhost).
3. Attempt two-stage apply.
4. Verify: “Basketball program changed after this proposal was created. Review
   a fresh proposal.”
5. Confirm the newer state and all history remain unchanged.

## Safe undo

1. Apply a valid disposable proposal.
2. Open Review / Undo Last Apply, tap Undo, then Confirm Undo.
3. Verify the exact prior override/program-state raw strings are restored and
   history is unchanged.
4. Apply another proposal, then change an affected basketball setting afterward.
5. Attempt undo and verify: “Basketball settings changed after this proposal was
   applied; unsafe undo refused.”

## Mixed core + habit + basketball Sync

Use disposable IDs and a harmless existing exercise update:

```text
MARCUSFIT_UPDATE_START
{
  "updates": [{ "id": "home-d0-e0", "blurb": "Disposable mixed Sync QA" }],
  "habitProposal": {
    "proposalId": "habit-mixed-manual-1",
    "summary": "Disposable habit proposal",
    "changes": [{
      "action": "add",
      "habitId": "habit-mixed-manual-1",
      "definition": {
        "id": "habit-mixed-manual-1",
        "name": "Disposable Mixed Habit",
        "target": { "type": "checkbox" },
        "schedule": { "type": "daily" },
        "instructions": []
      }
    }]
  },
  "basketballProposal": {
    "schemaVersion": 1,
    "proposalVersion": 1,
    "proposalId": "bball-proposal-mixed-manual-1",
    "summary": "Disposable mixed basketball proposal",
    "rationale": "Validate extension composition.",
    "changes": [{
      "action": "modify_drill",
      "programId": "guard_skills_3_session",
      "programVersion": 1,
      "sessionId": "guard_a_handle_weak_hand",
      "drillId": "guard_behind_back_foundation",
      "fields": { "target": { "durationMinutes": 10 } }
    }]
  }
}
MARCUSFIT_UPDATE_END
```

Verify the core update processes once, both proposals are pending, neither
proposal applies, and messaging names all three outcomes. Reject/undo the
disposable changes and restore the backup afterward. Also test malformed
basketball data in a mixed block: no core or proposal import should run.

## Program switch proposal

With Guard Skills active and Session B or C next, import:

```text
MARCUSFIT_UPDATE_START
{
  "updates": [],
  "basketballProposal": {
    "schemaVersion": 1,
    "proposalVersion": 1,
    "proposalId": "bball-proposal-manual-switch-1",
    "summary": "Switch to shooting focus",
    "rationale": "Shooting evidence is the current priority.",
    "changes": [{
      "action": "switch_program",
      "targetProgramId": "shooting_focus_2_session",
      "targetProgramVersion": 1
    }]
  }
}
MARCUSFIT_UPDATE_END
```

Verify review names both programs, says Session 1 will be next, and promises
history preservation. Confirm apply requires two taps, selects Shooting Focus,
sets position to Session 1, and leaves session history byte-identical. Undo must
restore the exact prior program and queue position when no later edit exists.

## Backup / restore

1. Apply one disposable basketball override and import a second pending proposal.
2. Create a backup; preview must list basketball personalization counts and the
   pending proposal status.
3. Copy the exact raw values of `mf-basketball-program-overrides` and
   `mf-basketball-proposal`.
4. Restore the backup in disposable localhost data.
5. Verify both raw values round-trip exactly and resolved future programming is
   correct.
6. Restore a valid 10.2.0 backup without either new key; it must remain valid and
   restore with clean default personalization/proposal state.
7. On localhost only, try malformed JSON/schema for either key and verify restore
   validation refuses it before replacement.

## Mobile and accessibility matrix

Test proposal status and review at widths 320, 375, 393, 430, and 480px in each
text-size preference: Compact, Standard, Large, and Extra Large.

At every combination verify:

- no horizontal overflow;
- long drill/program names and target changes wrap;
- action cards, warnings, and expected-write copy remain readable;
- Keep, Apply/Confirm, Undo/Confirm, and Close remain reachable;
- the footer wraps instead of clipping;
- the sheet respects top/bottom safe areas and browser chrome;
- panel scrolling works while background scrolling is locked;
- Escape closes review where a hardware keyboard is available;
- focus lands on Close / Review Later;
- pinch zoom remains enabled;
- no native `alert()` or `confirm()` appears.

## Regression

- Free-form basketball add/edit/delete.
- Structured basketball save/edit with all six tracking modes.
- Partial session with explicit skipped drills; skipped drills remain neutral.
- Finish & Advance and Finish & Repeat queue behavior.
- Lifting workout logging, review, save, History, and progression.
- Mixed History and Stats; historical snapshots retain recorded targets/names.
- Habits manager, habit proposal review/apply/undo, and adherence stats.
- Valid core Sync, invalid core Sync, and core rollback behavior.
- Backup create/preview/restore/clear confirmation flows.
- AI Export at every range.
- `mfBasketballProposalSelfTest()` passes and restores all affected keys byte-for-byte.
- No console errors.

Record devices/browsers, widths, text sizes, findings, and final manual approval
in the draft PR. Do not merge until Marcus explicitly accepts the candidate.
