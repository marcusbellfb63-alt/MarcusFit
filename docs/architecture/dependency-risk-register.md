# Dependency risk register

| Risk | Status after 10.1.2 | Evidence / remaining mitigation |
|---|---|---|
| Base `P` and stable IDs | Mitigated | `P` SHA-256 and 63-ID hash unchanged; no duplicates |
| Inline/global compatibility | Mitigated | 83 attributes, 61 handlers, 58 explicit names, accepted 257-name surface |
| Classic load order/live state | Mitigated | explicit 22-file fixture, combined syntax, browser navigation/save/reload |
| AI export wrappers | Mitigated structurally | recomposed source unchanged; browser export generated accepted ordering |
| AI Sync transaction | Mitigated | canonical binding survives all 22 scripts; full-order archived/reactivate/update, fabricated-ID, and Habits-hook fixtures pass |
| Backup/replacement restore | Mitigated structurally | raw source unchanged and backup UI fixture passes; destructive round-trip remains manual QA |
| Progression correction captures | Open/documented | retained as files 09 and 18 to avoid unsafe reordering |
| Shared daily schema | Mitigated structurally | wrapper order unchanged; note save/reload browser check passed |
| History/Stats extension order | Mitigated structurally | source and wrapper order unchanged; tabs render without console output |
| Boot timing | Mitigated | boot remains synchronous before basketball; three load listeners unchanged |
| Scanner cross-file inflation | Open/documented | raw candidates rise 257 -> 313 because boundaries changed; no new API intended |
| Manual real-data equivalence | Open | Marcus must run the PR checklist before acceptance/merge |

No source-level blocker remains. The primary residual risk is browser behavior
that requires representative historical/production data: proposal apply/undo,
old-backup replacement restore, valid Sync storage deltas, mixed History/Stats,
and progression review. The draft PR must remain unmerged until Marcus completes
that QA.
