# MarcusFit 10.8.0 lifting progression audit

## Accepted baseline

- Production merge: `1de89a40c810919d1edf831d1af4d69b2d4b46d7`.
- QA-approved 10.7 implementation: `2f553b756309b42494bed34e00f054891e18e78d`.
- Runtime remains 22 ordered classic deferred scripts.
- This phase must not change `P`, accepted `Releases/`, the core Sync file, or any storage schema.

## Lifecycle and ownership

| Decision or data | Authoritative owner | 10.8 treatment |
| --- | --- | --- |
| Immutable base workout program and 63 stable IDs | `assets/js/data/02-program-data.js` (`P`) | Read only. |
| Overrides, additions, archive/reactivation, and resolved days | `assets/js/program/03-lifecycle-resolved.js` | Read through existing resolvers; no lifecycle writes from progression. |
| Program proposal review/apply/undo | `assets/js/features/06-program-proposals.js` and `07-program-proposal-ui.js` | Unchanged; recommendations never create or alter proposals. |
| Workout form, exact raw set values, save, and same-date update | `assets/js/features/10-workout-logging.js` | Existing `{wt,reps,rir}` rows and date-key identity remain authoritative. |
| Saved workout history | `day-YYYY-MM-DD-wo` records | Read only for recommendations; exact stored strings remain authoritative. |
| History reopen/edit-in-place | `08-program-daily.js`, `10-workout-logging.js`, and `14-history.js` | Same date keys are overwritten in place; recommendations derive again after render/save. |
| Base progression compatibility surface | `assets/js/features/09-progression-base.js` | Preserved as the earlier compatibility layer. |
| Final lifting metric and progression decisions | `assets/js/features/18-progression-corrections.js` | Authoritative 10.8 extension point. |
| Recommendation display and safe prefills | `09-progression-base.js`, workout renderer in `10-workout-logging.js`, corrected by `18-progression-corrections.js` | Keep presentation separate from editable fields; saved/manual values win. |
| AI Export progression context | `assets/js/sync/11-ai-export.js`, using the final progression functions | Add derived action, reason, confidence, and comparable evidence only. |
| Core Sync | `assets/js/sync/12-ai-sync.js` | Byte-protected and unchanged. |
| Backup/restore | `assets/js/system/16-backup-restore-debug.js` | No new key or schema; existing raw workout values round-trip unchanged. |

## Accepted decision rules before 10.8

The 9.5.9 correction layer classifies duration, bodyweight, assisted, and ordinary load/repetition movements at read time. It uses the most recent exercise-ID match, programmed sets/reps/RIR and load range, completed numeric rep rows, a directional load (higher for ordinary loads, lower for assistance), and two qualifying sessions at a programmed ceiling. Its public statuses are `new`, `build_reps`, `build_duration`, `duration_target`, `safer_hold`, `top_range_hold`, `progress_load`, `capped_hold`, `ceiling_update`, and `target_reset`.

## Audit findings

1. Exercise ID is correctly authoritative, but workout context is not checked. `p9GetExerciseHistory()` accepts every record containing the ID even when stored `gym` or `dayIdx` conflicts with the current resolved context.
2. The history reader keeps only numeric-repetition rows. This prevents the final decision owner from distinguishing a complete prescription from one logged set, missing sets, or a legacy sparse row.
3. Missing or `N/A` RIR is filtered out. Some branches treat the absence as acceptable evidence even when the exercise has a programmed RIR target.
4. Numeric-looking ranges and mixed textual labels are normalized to a number. A label such as `25–30 lb`, a changing machine description, or mixed numeric/text history can therefore imply arithmetic precision that the saved evidence does not support.
5. The last session dominates most decisions. There is little explicit trend handling for decreasing performance or unusually large apparent jumps.
6. Prefill logic changes RIR and can insert a reset load for a blank current form. Although saved fields win, the derived target and the user-entered value are not clearly separated.
7. Recommendation action and evidence are combined in one sentence, so confidence and the reason for conservative fallback are not consistently visible.
8. Duration handling exists and assistance direction is correct, but partial prescriptions, textual resistance setups, and context separation need stronger conservative rules.
9. History save identity is safe: both daily and workout records are keyed by the selected date and overwrite that exact key. The recommendation layer must remain read-only so edits cannot create duplicate sessions.
10. Custom and reactivated exercises can safely reuse their own stable ID history. Archived base exercises require lookup against known/base data when absent from the active resolved program.

## 10.8 design boundary

10.8 will extend the final correction layer with a derived recommendation result containing a compatibility `status`, a small action outcome, a concise action, a separate evidence reason, confidence, and comparable-session counts. Comparable history requires the same stable exercise ID and, whenever stored identity is available, the same gym and planned day. Legacy records lacking the newer optional identity fields remain eligible by stable ID.

Load arithmetic is allowed only for a single exact numeric load format with compatible units/setup across the completed working sets. Ranges, bodyweight/bands, machine labels, mixed formats, or otherwise ambiguous text receive qualitative rep/setup guidance. Required-set completion and programmed RIR evidence gate load progression. Derived recommendations do not write storage and do not prefill a blank field; exact saved/manual values remain the only field values carried into history.

## Final recommendation rules

| Evidence | Outcome | Conservative fallback |
| --- | --- | --- |
| No completed comparable set or no parseable target | Insufficient evidence | Log or repeat a conservative baseline. |
| Fewer completed sets than prescribed | Repeat target | No load increase, even when the logged set reached the top. |
| Programmed RIR exists but any prescribed-set RIR is missing or `N/A` | Repeat target | Require complete RIR evidence before load progression. |
| All prescribed values are inside, but not at the top of, the rep/duration range | Progress reps/duration | Keep the current setup and build within the range. |
| Any set is below range or RIR is tighter than target | Repeat or conservative reset | Severe underperformance or a greater-than-20% same-load rep decline yields reset/reduce guidance. |
| Complete top-range result with exact, uniform, compatible numeric load and adequate RIR | Progress load | Use the smaller of the accepted default step and a plausible recent observed step, bounded by the programmed ceiling. |
| Apparent comparable load jump exceeds 20% or 10 units | Repeat target | Require one confirming session instead of compounding the jump. |
| Complete top-range result at the programmed ceiling | Confirm, then maintain/review | Two qualifying saved sessions are required before ceiling-review guidance. |
| Complete top-range assisted result | Progress load by lowering assistance | Never invert assistance direction; respect the programmed hard end. |
| Bodyweight, band, range, machine-label, mixed, or other ambiguous load | Progress reps/setup qualitatively | Never rewrite or perform arithmetic on the raw label. |
| Duration movement at the top of its range | Maintain | No lifting-load progression is inferred. |
| Comparable historical load exceeds a newly lowered current ceiling | Conservative target reset | Rebuild from the current Program target; historical strings remain unchanged. |

Confidence is `low` when evidence is absent, partial, RIR-incomplete, mixed, or requires jump confirmation; `medium` for safe repeat/reset decisions and qualitative text-load guidance; and `high` for complete within-range, duration-maintain, exact numeric progression, or confirmed ceiling decisions.
