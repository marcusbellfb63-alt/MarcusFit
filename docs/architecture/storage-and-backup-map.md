# Storage and backup map

The effective `p8IsMarcusFitKey()` predicate owns 18 exact keys or key patterns.
10.3.0 adds two independent basketball personalization/proposal keys; existing schemas and
replacement restore behavior remain compatible.

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
| `mf-basketball-program-state` | active basketball program and queue position |
| `mf-basketball-program-overrides` | sparse basketball future-program personalization |
| `mf-basketball-proposal` | basketball proposal review/apply/undo audit state |

## Backup/restore contract

1. Discovery enumerates `localStorage` and applies the final predicate.
2. Creation copies exact raw strings into schema-1 `data` with current `APP_VERSION` metadata.
3. Preview summarizes without writing; known preview quirks remain unchanged.
4. Validation accepts current/older optional-key absence and rejects malformed
   envelopes, basketball sessions, program state, overrides, or proposal state when present.
5. Restore captures a safety backup, deletes all currently owned keys, restores
   only accepted incoming keys as raw strings, repairs recoverable legacy
   virtual-day parents, validates, then reloads.

Restore remains replacement, not merge. An optional key absent from an older
full backup is deleted. Shared daily-record unknown fields, lifecycle raw
snapshots, profile/proposal unknown fields, and old workout IDs remain governed
by their accepted feature normalizers and writers.

10.2.0 keeps `mf-basketball-sessions` at schema 1 and adds optional structured
metadata to new records. Legacy free-form records are normalized without eager
rewrites. `mf-basketball-program-state` uses schema 1 and stores only active
program identity/version, next-session index, and timestamps. A legacy backup
without that optional key remains valid and restores with no active program.

10.3.0 keeps built-in templates outside storage. `mf-basketball-program-overrides`
uses schema 1 and stores only sparse modified/added/disabled/order fragments by
stable program, session, and drill ID. `mf-basketball-proposal` uses schema 1
for pending/applied/rejected/undone review state and an exact one-level undo
snapshot. Older backups may omit either key; current backups and replacement
restore preserve their exact raw strings after strict validation.
