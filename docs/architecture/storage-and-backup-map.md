# Storage and backup map

Baseline: accepted MarcusFit 10.1.0 at `d66fe5cc53bca31db59ae288429bb95c16d1585c`.
`p8IsMarcusFitKey()` at `04:7-9`, as wrapped by `05:352-355`, is the
authoritative backup/clear ownership predicate.

There are 15 owned exact keys or key patterns. The exact proposal key in source
is `mf-onboarding-program-proposal`; the older shorthand
`mf-program-proposal` in `tests/marcusfit-10-dependency-map.md` is not a runtime
key and must not be introduced during extraction.

## Owned storage inventory

| Key/pattern | Owner and schema | Read locations | Write locations | Delete/clear | Backup / preview / restore | Compatibility and modularization risk |
|---|---|---|---|---|---|---|
| `day-YYYY-MM-DD` | Daily tracking. Object fields: `date`, string vitals (`weight`,`sleep`,`protein`,`water`), `bm`,`bmNotes`,`mood`,`hunger`,`workout`,`zep`,`logGym`,`woDayIdx`,`notes`, `habits:{id:{completed,notes,value?}}`; unknown fields may exist. | `03:54,475-489,631-647,2023-2027,2322-2327,2365-2413,2899-2900,4257-4385`; adherence/habits `04:1810,1852,1892,1897,2049,2066,2135`; debug/tests | Base save `03:2279`; adherence bridge `04:1852,1892`; habit-preserving wrapper `04:2135` | Only via backup clear/restore allowlist; no ordinary per-day delete | Included by `key.startsWith("day-")`; summarized as daily unless suffix `-wo`; restored raw | Highest schema risk: multiple owners share one record. Habit wrapper preserves unknown fields; adherence bridge dual-writes legacy `zep`. |
| `day-YYYY-MM-DD-wo` | Workout logging. `{dayIdx,gym,exercises:{exerciseId:{sets:[{wt,reps,rir}],note?}}}`. | Workout load/history/progression/export in `03:475-489,630-755,1963,2023-2167,2326,2390,4293,4358`; `04` metric tests | `03:2258` | Backup clear/restore | Included by broad `day-*`; preview counts suffix `-wo` as workout | Stable exercise IDs connect records to resolved program. Missing/orphaned IDs must remain readable. |
| `mf-overrides` | Exercise field overrides. `{exerciseId:{field:value}}`. | `01:242-245`; proposal transaction `02:3394-3741`; Sync/render/export/debug | `01:243-244`; proposal/Sync/undo | Proposal rollback/undo can remove if absent; backup replacement clear | Explicit allowlist through `OVR`; preview flag; raw restore | Preserve unknown override fields and exact raw rollback bytes. |
| `mf-current-draft` | Daily draft. Current form snapshot including date, daily fields, workout status/form state and habits. | `02:15`; `03` resume/banner; debug/freshness checks | `02:16`, via `autoSaveDraft` in `03`; removed `02:17` | Cleared after today save, stale/banner dismissal, backup clear/restore | Explicit allowlist; preview `hasDraft`; raw restore | Ephemeral but intentionally backed up. Listener timing and `tDate` affect ownership. |
| `mf-exercise-state` | Exercise lifecycle schema 1: `lifecycleVersion`, `customExercises`, `inactiveIds`, `replacements` (legacy string or object), `orderOverrides`, `dayOverrides`, `dayAdditions`, `disabledDays`; unknown data may survive. | `01:320-343`; proposal/Sync/debug throughout `02`–`04` | `01:345-347`; proposal apply/undo and AI Sync | Proposal rollback may remove; backup replacement clear | Explicit allowlist; preview lifecycle flag; post-restore validation | Critical. Base `P` stays immutable; stable IDs, legacy replacement representations, and raw transactional snapshots must survive. |
| `mf-recommendations` | Coaching recommendations keyed `gym:dayIndex`, entries include timestamps/source/strategy/experiment/items. | `01:263-289`; proposal safety/context; workout rec UI/export | `01:269-292`; AI Sync | Backup replacement clear | Explicit allowlist; preview flag; raw restore | Separate from programming/progression. Empty object is auto-created on load. |
| `mf-ai-coaching-preferences` | Plain-text coaching preferences (not JSON). | `02:57-99`; onboarding/proposal/export/debug | `02:62`, save/reset/clear paths | Clear handler; backup replacement clear | Explicit allowlist; preview flag; raw restore | Do not parse/reformat; exact text affects AI export. |
| `mf-user-profile` | Schema 1 normalized object: `profileVersion`, `identity`, `body`, `goals`, `preferences`, `app`, plus optional `programBasis` and preserved unknown fields. | `02:206-270`; onboarding/proposal/export; starter `04:975-1136`; debug | `02:225-263`; starter confirmation `04:1130` | Starter rollback may remove; backup replacement clear | Explicit allowlist; preview parses normalized display name/schema; raw restore | Boot may create/migrate defaults. Live body weight is not owned here. Program basis must remain backward optional. |
| `mf-onboarding-state` | Schema 1: `onboardingVersion`, status, step/timestamps, `draft`; normalization preserves unknown top-level fields. | `02:474-998` and later UI/application; proposal/first-sync/boot | `02:493-929` and onboarding UI | Debug fixtures can restore/remove; backup replacement clear | Explicit allowlist; preview parses status/step; raw restore | Missing/malformed reads default safely; boot may persist defaults based on conservative freshness detection. |
| `mf-onboarding-program-proposal` | Schema 1 proposal with status/source/sourceSummary/summary/dayPlans, application/undo raw snapshots, warnings and forward-compatible fields. | `02:2387-3939`; UI/export/debug | `02:2406-2427,3172-3764`; fixture/debug paths | `p954ClearProposal`; rollback/undo; backup replacement clear | Explicit allowlist through `PROGRAM_PROPOSAL_KEY`; summary does not have a dedicated flag and counts it as unknown | Apply/undo touches proposal + lifecycle + overrides transactionally. Preview’s unknown-key count is a known summary limitation, not failed ownership. |
| `mf-recurring-items` | Schema 1 `{items:{id:{id,name,category,enabled,paused,graceDays,schedule:{type,interval,weekdays,anchorDate},...}}}`. | `04:1780-1971` | `p9510SaveRecurringItems`, setup/actions | Backup replacement clear | Explicit allowlist; preview parses schema presence; raw restore; post-restore debug | Missing is optional; read normalization does not write. Item/event references can become orphaned. |
| `mf-recurring-events` | Schema 1 `{events:{occurrenceId:{id,itemId,scheduledDate,actualDate,replacementDate,status,source,...}}}`. | `04:1774-1971` | `p9510SaveRecurringEvents` / upsert | Backup replacement clear | Explicit allowlist; preview parses schema presence; raw restore; post-restore debug | Structured event evidence outranks legacy `D.zep`; occurrence IDs prevent duplicates. |
| `mf-habit-definitions` | Schema 1 `{definitionVersion,habits:{stableId:definition},order,createdAt,updatedAt}`; definitions include target/schedule/source/AI metadata. | `04:2044-2186`; daily render/History/Stats/export/Sync | init/save/manager/proposal `04:2058-2158` | Habit proposal undo may restore/remove; backup replacement clear | Explicit allowlist but base preview has no dedicated flag, so it increments unknown count | Boot creates either seven legacy-ID defaults or an empty store. Preserve unknown definition fields and stable IDs. |
| `mf-habit-proposal` | Schema 1 pending/applied/undone habit changes with validation and exact definition undo snapshot. | `04:2151-2186` | import/apply/undo/dismiss | Backup replacement clear | Explicit allowlist; no dedicated preview flag; raw restore | AI Sync wrapper imports but never silently applies. Undo refuses after conflicting edits. |
| `mf-basketball-sessions` | Schema 1 `{schemaVersion:1,sessions:[{id:bball-*,schemaVersion,date,type,minutes,createdAt,updatedAt,dribblingMinutes?,shooting?,freeThrows?,notes?}]}`. Reader also accepts a legacy top-level array in memory. | `05:117-140` and all basketball renders/export/debug | `05:142-174` | Record delete rewrites store; backup replacement clear | Added to allowlist by late wrapper; summary/format/validation wrappers recognize/count/validate it; raw restore | Older backups may omit key. Invalid/duplicate records make backup validation fail; malformed live records are skipped in read model and reported. |

No separate settings/metadata key exists. Backup metadata (`app`,
`schemaVersion`, `appVersion`, `exportedAt`) exists only in the exported JSON.
Starter-program state is the optional `userProfile.programBasis`, not a key.

## Backup flow, end to end

1. **Discovery:** `p8GetMarcusFitKeys()` enumerates `Object.keys(localStorage)` and
   filters through the effective `p8IsMarcusFitKey`. Basketball wraps that
   predicate after `04` evaluates. The broad `day-*` rule accepts daily and
   workout keys—and any unknown key with that prefix.
2. **Serialization:** `p8BuildBackup()` copies each value as its exact raw
   string into `data`; it does not parse/re-stringify. It adds backup schema 1,
   current app version, and an ISO timestamp.
3. **Summary:** `p8492SummarizeBackup()` parses the backup envelope, counts daily
   and workout keys, recognizes selected stores, and emits warnings. The
   basketball wrapper adds its count and adjusts unknown-key warnings; the
   format wrapper inserts a human-readable basketball line.
4. **Validation/migration:** `p8ValidateBackup(raw)` requires valid JSON,
   `app === "MarcusFit"`, `exportedAt`, and `data`. Basketball’s wrapper validates
   its optional store when present. `p8MigrateBackup()` accepts schema 1 only;
   no migration currently transforms data.
5. **Preview:** `p8RestoreBackup()` validates, migrates, saves the parsed object
   only in `p8PendingRestoreBackup`, summarizes it, and displays the confirmation
   panel. Editing the textarea clears the pending object.
6. **Replacement restore:** `p8ExecuteRestore()` first captures a safety backup,
   deletes every *currently discoverable* MarcusFit key, then restores only
   incoming entries accepted by the effective allowlist, still as raw strings.
   This is replacement, not merge: optional current keys absent from an old
   backup remain deleted.
7. **Post-restore:** it runs `mfRunPostRestoreValidation()` and
   `mfRecurringStorageDebug()`, logs warnings, and reloads after 1.8 seconds. On
   an exception, it places the safety backup in the textarea rather than
   automatically rolling storage back.

## Old-data and migration behavior

- Missing optional keys are supported; normalizers/defaults rebuild read models
  and some boot initializers may recreate stores after reload.
- Backup schema migration is a framework only: schema 1 is returned unchanged,
  any other schema is rejected.
- Lifecycle replacements accept legacy strings as well as structured links.
- Daily `zep` values remain legacy adherence evidence and are not bulk-migrated.
- Basketball accepts a legacy array on ordinary read, while saved output is the
  schema-1 envelope.
- Profile, onboarding, proposal, lifecycle, habit, and recurring normalizers
  supply missing fields; several deliberately preserve unknown fields.
- There are no alternate key aliases. Do not “correct” old documentation by
  adding `mf-program-proposal` to storage.

## Highest storage risks

- **Unknown-key handling:** backup ownership is a manual allowlist plus a broad
  prefix. A newly extracted owner can be silently omitted unless the predicate,
  summary, validation, tests, and documentation move together.
- **Wrapper order:** basketball must wrap the final base predicate, summary,
  formatter, and validator. Replacing those functions after `05` would drop its
  integration.
- **Replacement semantics:** restoring an older backup intentionally deletes
  current optional stores. Changing to merge semantics would be behavioral.
- **Malformed records:** most stores normalize/default; basketball backup
  validation rejects any invalid/duplicate session. Do not accidentally apply
  live-read leniency to restore validation.
- **Multiple wrappers:** export has many wrappers; backup currently has the
  basketball wrapper. Any future wrapper chain needs an explicit composition
  contract rather than implicit last-writer behavior.
