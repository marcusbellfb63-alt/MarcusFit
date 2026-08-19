# Storage and backup map

The effective `p8IsMarcusFitKey()` predicate still owns 15 exact keys or key
patterns. No key, schema, default, migration, or replacement behavior changed.

| Key/pattern | Owner |
|---|---|
| `day-YYYY-MM-DD` | daily tracking, adherence bridge, habits |
| `day-YYYY-MM-DD-wo` | workout logging |
| `mf-overrides` | lifecycle/resolved program |
| `mf-current-draft` | runtime state/drafts |
| `mf-exercise-state` | lifecycle/resolved program |
| `mf-recommendations` | lifecycle/resolved program |
| `mf-ai-coaching-preferences` | profile/preferences |
| `mf-user-profile` | profile/preferences and starter basis |
| `mf-onboarding-state` | onboarding |
| `mf-onboarding-program-proposal` | proposal engine |
| `mf-recurring-items` | recurring adherence |
| `mf-recurring-events` | recurring adherence |
| `mf-habit-definitions` | habits |
| `mf-habit-proposal` | habits/Sync proposal bridge |
| `mf-basketball-sessions` | basketball |

## Backup/restore contract

1. Discovery enumerates `localStorage` and applies the final predicate.
2. Creation copies exact raw strings into schema-1 `data` with 10.1.0 metadata.
3. Preview summarizes without writing; known preview quirks remain unchanged.
4. Validation accepts current/older optional-key absence and rejects malformed
   envelopes or malformed basketball data when that optional key is present.
5. Restore captures a safety backup, deletes all currently owned keys, restores
   only accepted incoming keys as raw strings, validates, then reloads.

Restore remains replacement, not merge. An optional key absent from an older
full backup is deleted. Shared daily-record unknown fields, lifecycle raw
snapshots, profile/proposal unknown fields, and old workout IDs remain governed
by their accepted feature normalizers and writers.
