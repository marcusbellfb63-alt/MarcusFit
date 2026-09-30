# MarcusFit 10.12.1 Manual QA

Use disposable localhost data. Serve the repository over HTTP; never use
`file://`. Real-iPhone Safari and Home Screen/PWA checks remain external
acceptance gates.

## Completed localhost browser checks — 2026-09-19

- [x] MarcusFit loaded from `http://127.0.0.1:8765/` as version 10.12.1.
- [x] Legacy core top-level array applied through Tools → AI Sync.
- [x] Habit-only composite imported a pending Habit proposal.
- [x] Basketball-only composite imported a pending Basketball proposal.
- [x] Core + Habit composite processed core and staged Habit review.
- [x] Core + Basketball composite processed core and staged Basketball review.
- [x] Habit + Basketball composite staged both reviews.
- [x] Full three-domain composite processed core and staged both reviews.
- [x] Object-only `updates` was rejected with the legacy-array instruction.
- [x] Unknown top-level key was rejected before domain processing.
- [x] Invalid Habit and Basketball proposal schemas were rejected before core processing.
- [x] Existing pending Habit and Basketball proposals blocked the whole composite.
- [x] Prose surrounding the marker block parsed successfully.
- [x] Imported proposals remained pending and were not auto-applied.
- [x] Browser console contained no errors or warnings.

## External acceptance checks

- [ ] Real-iPhone Safari AI Sync matrix.
- [ ] Home Screen/PWA AI Sync matrix.
- [ ] Independent review of the exact final commit.
- [ ] Explicit Marcus acceptance before merge.
