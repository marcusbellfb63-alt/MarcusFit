# MarcusFit 10.0.0 extraction baseline

Source of truth: `Releases/MarcusFit9_6_0.html` at commit
`8937e640f8e35b1d8f3a2d72e00ac5ca9b73f6e3`.

- Accepted SHA-256: `69a3a66541d14290a6a7b73bf313365176169fd0d659e6effb29edcaf7a4e34b`
- Accepted size: 970,644 bytes
- One inline `<style>` block: 59,362 characters, beginning at byte/character offset 208
- One inline classic `<script>` block: 855,101 characters, beginning at offset 96,696
- No `DOMContentLoaded` handler
- Three `window.load` listeners
- Final boot is synchronous at the bottom of the script
- Inline event attributes: `onclick`, `onchange`, and `oninput`

## Source-order dependency map

The runtime repeatedly wraps or replaces earlier functions. Source order is part
of behavior and must not be reordered:

1. Version, static habit/program data, recommendation storage, lifecycle,
   overrides, resolved-program helpers, and lifecycle validation.
2. Runtime state, drafts, coaching preferences, profile, onboarding, proposal
   generation/apply/undo, and proposal UI.
3. Daily/workout rendering and saving, progression, export, ordered AI Sync
   preprocessing, sticky controls, history, and analytics.
4. Backup/restore, debug maps, starter templates and program-basis wrappers,
   9.5.9 metric wrappers, 9.5.10 recurring adherence wrappers, 9.6.0 habit
   wrappers, `showScreen`, and final synchronous boot.

Safe conservative split points are the existing top-level boundaries immediately
before:

- `let gym=...`
- `let _draftToastTimer=...`
- `// PHASE 8: BACKUP / RESTORE / RECOVERY`

Classic deferred scripts must retain this exact order. Top-level lexical
declarations remain shared across classic scripts, while function declarations
and explicit `window.*` assignments retain inline-handler and console access.

## Initialization order

The accepted script initializes/migrates several stores during evaluation. Its
three `window.load` listeners are registered in original source order. The final
synchronous sequence renders coaching preferences; initializes/renders the user
profile; initializes onboarding; conditionally opens onboarding; renders program
personalization; releases the starter-program guard; renders the program; and
renders recurring medication/adherence.

No arbitrary delay may be introduced. External scripts must use ordered classic
`defer` loading so evaluation happens after parsing and before `DOMContentLoaded`.

## Storage ownership

`p8IsMarcusFitKey()` is the authoritative manual allowlist:

- `day-*`
- `mf-overrides`
- `mf-current-draft`
- `mf-exercise-state`
- `mf-recommendations`
- `mf-ai-coaching-preferences`
- `mf-user-profile`
- `mf-onboarding-state`
- `mf-program-proposal`
- `mf-recurring-items`
- `mf-recurring-events`
- `mf-habit-definitions`
- `mf-habit-proposal`

No key may be added during extraction. Restore ordering remains
`p8ValidateBackup` → `p8MigrateBackup` → `p8492SummarizeBackup` →
`p8ExecuteRestore` → `mfRunPostRestoreValidation` → reload.

## Public/global surface

The executable baseline test inventories every inline-handler function and every
explicit `window.*` assignment from the immutable release. This includes the
navigation, daily/workout save, draft, export/Sync, backup/restore, onboarding,
proposal, profile, recurring-adherence, habit-management, progression, lifecycle,
program-basis, starter-program, and architecture/debug helpers. Extraction must
keep those identifiers callable without module imports or namespace changes.

Run:

```text
node tests/marcusfit-10-compat.test.js --inventory
```

The inventory and accepted-release hash check are derived directly from the
immutable release, avoiding a second hand-maintained source of truth.
