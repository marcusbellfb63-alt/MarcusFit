# Basketball 10.6 architecture and UX audit

Status: implementation candidate based on accepted 10.5.0 commit `60934a151f95c34d5a659cd131c91abca43bfa91`. Nothing in this document marks 10.6 accepted.

## Ownership and storage

`assets/js/features/22-basketball.js` remains the final classic-script boundary and owns all Basketball templates, normalization, derived progression, UI rendering, History/Stats extensions, backup validation, export composition, and proposal review/apply/undo. It composes after the authoritative core Sync implementation without changing `assets/js/sync/12-ai-sync.js`.

The phase adds no storage key or schema field:

| Key | Schema | Ownership |
|---|---:|---|
| `mf-basketball-sessions` | 1 | Free-form records plus immutable structured program/session/drill/result snapshots |
| `mf-basketball-program-state` | 1 | Active built-in program/version and cyclical `nextSessionIndex` |
| `mf-basketball-program-overrides` | 1 | Sparse future-program modified/added/disabled/reordered overlays |
| `mf-basketball-proposal` | 1 | Pending ownership, expected evidence, apply state, and safe undo snapshot |

All four keys are recognized, summarized, validated, and restored through the existing raw-string backup pipeline. Old backups may omit any optional Basketball key. Structured sessions remain in the established session store; result and definition snapshots remain authoritative.

## Runtime flows

- Landing render: `mfBasketballRenderProgramSurface` reads program state, resolves sparse personalization, derives the next session, and renders without writing.
- Start: `mfBasketballStartPlannedSession` re-reads the current queue and opens the resolved planned session. Starting, viewing, closing, and drill navigation do not write or advance.
- Drill completion: courtside controls modify only live DOM inputs. Empty results normalize to `skipped:true`, which is neutral and excluded from progression evidence.
- Finish: `mfBasketballFinishStructuredSession` validates a complete structured input, saves history, and advances only for a new session whose identity still matches the current queue. A failed advance restores both prior raw stores.
- Repeat/edit: Repeat saves without advancing. Editing rebuilds controls from the saved historical snapshots and never uses current definitions as if they existed historically.
- History: `mfBasketballRenderHistory` displays saved names, targets, modes, and results. Its derived context uses only evidence at or before that historical session.
- AI Export: `mfBasketballBuildExport` emits one Basketball section. 10.6 adds concise identity-safe progression lines only where comparable evidence exists.
- Proposal review: import-time expected evidence, pending ownership, stale conflict refusal, two-stage apply, expected write domains, and safe one-level undo remain unchanged. Stable IDs appear only as secondary technical review/export context.

## UX findings and response

The accepted surface required too much scanning courtside: every drill and numeric control appeared simultaneously, session targets were visually quiet, there was no explicit drill-by-drill completion path, and the summary disappeared immediately after save. The landing card described the queue but did not explain why a session was next, estimate derivable planned minutes, or show last comparable results. Program inspection required mentally reading the next-session list, and raw IDs could dominate technical proposal text.

10.6 responds with one active drill at a time, large tracking-mode-specific controls, dominant target copy, explicit Previous / Skip — Neutral / Complete & Next actions, a review gate before finish, keyboard dismissal during navigation, sticky safe-area-aware actions, and a post-save completion review. The landing card now shows program, session position, focus, drill count, derivable planned minutes, last comparable evidence, and the deterministic queue reason. Program view distinguishes the resolved current program with Modified, Added, and Disabled indicators.

## Progression comparison boundary

Comparable evidence must match `programId`, `programVersion`, `plannedSessionId`, `drillId`, and `trackingMode`. Personalized modifications retain the stable drill identity. Added drills use their stable `bball-ai-…-vN` identity. Disabled drills disappear only from future resolved sessions; historical snapshots remain readable. Names never establish identity, and skipped results never count.

The derived layer is advisory and write-free:

- Duration: compare actual minutes only against saved duration targets. One result is first evidence; repeated met targets can be called consistent; changes over 0.5 minute may be improving; two recent misses can request target review.
- Confidence: require three comparable ratings for improvement/stability claims. Monotonic improvement of at least two points is improved; a range of one is stable; low averages remain needs-work guidance.
- Makes target: compare actual makes to each saved target. Three target completions support “Target met consistently”; three increasing values support “Improving”; two recent misses support conservative target review.
- Shooting benchmark: require each saved minimum-attempt threshold. One meaningful sample is a first benchmark. A latest change of at least three percentage points is improved/regressed; within two points is stable. Same-attempt comparisons are called out, but makes and percentage remain separate evidence.
- Count/completion: report first result or building consistency only; no universal percentage is inferred.

No readiness, fatigue, skill, athleticism, recovery, calorie, heart-rate, VO2, workload, or composite score is created.

## Risk boundaries retained

The most dangerous UX areas were queue advancement, historical re-rendering from current definitions, treating skips as failures, accidental write-on-navigation, and allowing current personalization to reinterpret old results. The implementation keeps writes in the established final save transaction, gates finish behind review, derives historical context from stored snapshots and time-bounded evidence, and adds no persisted courtside draft schema. Reload therefore cannot silently advance; unsaved courtside DOM input is not promised to survive reload because the accepted architecture had no Basketball draft store.
