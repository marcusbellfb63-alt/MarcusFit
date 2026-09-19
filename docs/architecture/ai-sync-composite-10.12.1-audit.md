# MarcusFit 10.12.1 AI Sync Composite Contract Audit

## Baseline and scope

10.12.1 starts from accepted production merge
`ff966fe7ca42ad3f4ee8d6b3420a0f9d9b7578e1`, tree
`15d0cb0f164e88b39d4f05175bded8dec5e2a252`. The hotfix changes only the
late composite Sync dispatcher, focused tests, and patch-version documentation.
Accepted `Releases/` artifacts and `assets/js/sync/12-ai-sync.js` remain
byte-identical.

## Import path and root cause

The Apply Update button calls the authoritative `applySync()` in
`assets/js/sync/12-ai-sync.js`. That function first offers the marked input to
the late `p960HandleSyncExtension` hook, then performs marker extraction,
normalization, JSON parsing, and the legacy array-only core import when no
extension handles the payload.

Before 10.12.1, Habit and Basketball each parsed the marked block and handled
only the object shape owned by that extension. Object parsing and envelope
validation were duplicated. Straight-quote happy-path composites were covered
by older tests, but any object path not conclusively handled by the late chain
fell through to the core parser. One reproducible route was a composite needing
the core parser's existing smart-quote normalization: both extensions attempted
raw `JSON.parse`, declined the payload, then core normalized and parsed it as an
object. `applySync()` line 52 rejected that object because core intentionally
accepts only the legacy top-level array. The same fallback was possible for
other unclaimed object/error paths. The export contract had already advanced to
the intentional composite object contract, while dispatch remained conditional
and distributed across the two extensions.

## Fix boundary

The final-load Basketball composition boundary now owns top-level type dispatch
for every parsed object. Arrays and unsupported non-object types continue to
the accepted legacy path. Objects are accepted only when they contain at least
one of `habitProposal` or `basketballProposal`; their only optional companion is
an `updates` array. Unknown keys, `{}`, and object-only `updates` fail before
writes.

The dispatcher delegates nested validation and import to the existing Habit,
Basketball, and core authorities. It does not introduce a competing proposal
schema or replace `applySync`. The 22-script order and public binding remain
unchanged.

## Atomicity

The complete envelope, tracking-preference gates, both proposal schemas, and
both existing-pending guards are checked before core or proposal writes. The
dispatcher snapshots synchronous browser storage immediately before execution.
If a post-preflight core/import exception or unexpected import refusal occurs,
the snapshot is restored so the composite package cannot leave core or one
proposal domain committed by itself.

Core updates retain legacy per-entry validation and skip/report semantics. A
reported invalid or protected core target gains no authority and does not
modify its protected target. Proposal imports remain pending only; expected
state and fingerprints are captured by the existing domain validators.

## Contract and authority audit

The existing AI Export text already states:

- core-only changes use the legacy top-level array;
- Habit/Basketball changes use the composite object;
- only `updates`, `habitProposal`, and `basketballProposal` are supported;
- Habit and Basketball proposals require explicit review/apply.

No export change was necessary. AI Sync still cannot mutate historical workout
evidence, Habit completion history, Basketball results/history or queue
position, medication schedules, profile/tracking authority, backup data, base
program `P`, or stable IDs.

## Array-only assumption audit

The intentional array check in `assets/js/sync/12-ai-sync.js` remains the
authoritative legacy core boundary. The obsolete assumption was allowing a
parsed composite object to reach that boundary. No other runtime array-only
assumption participates in the final composite path after this dispatcher
change.
