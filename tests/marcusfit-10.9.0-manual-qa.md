# MarcusFit 10.9.0 manual QA

Status: implementation candidate only. Do not merge or mark the PR ready until independent review is complete and Marcus finishes real-iPhone QA and explicitly accepts the candidate.

Automated and localhost browser-control pass completed on 2026-09-11. The checks marked complete below ran against the 10.9.0 candidate through `http://127.0.0.1:8765/` using the localhost origin only. Physical-device checks remain pending and are required before acceptance.

## Completed localhost checks

- [x] At 320, 390, 480, and 1024 px, Compact, Standard, Large, and Extra Large text produced no page or card horizontal overflow and kept finish controls reachable.
- [x] Next Session showed a concrete immediate action, target, conservative Standard variation, scheduling reason, and prior-result context.
- [x] Courtside mode showed one drill at a time with Do This Now, work/rest, cues, success target, setup, instructions, easier/harder options, and reason.
- [x] The How to do it disclosure opened by click, Space, and Enter and kept `aria-expanded` synchronized with its native details state.
- [x] Structured Basketball accepted an integer wearable estimate, displayed it during review and completion, stored the performed prescription snapshot, restored it during edit, and replaced the same session ID without duplication.
- [x] Lifting accepted an integer wearable estimate, restored it with the same selected workout, replaced the same date-key record, and displayed it in History.
- [x] Stats reported total, average, lifting, Basketball, and supported-session coverage from recorded estimates only; missing estimates were excluded.
- [x] AI Export labeled the values as optional user-entered watch/wearable estimates and matched Stats without changing storage.
- [x] The representative combined fixture reported 600 total, 300 average, 325 lifting, 275 Basketball, and 2-of-3 coverage.
- [x] No page console errors or warnings were observed during the localhost pass.

## Post-validator-boundary focused recheck

After limiting active-calorie validation to structured Basketball records so legacy free-form records continue ignoring unknown optional fields, the affected flows were rechecked through localhost on 2026-09-11:

- [x] A new 12-minute free-form Skills Practice record saved, opened in History, and restored its type and minutes for edit.
- [x] A new structured session saved a 190 kcal wearable estimate and its performed prescription, then restored and updated to 215 kcal with exactly one matching 18-minute History identity.
- [x] The existing lifting record restored 325 kcal from the same HOME Day 1 selection, updated to 335 kcal, rendered in History, and restored as 335 on reopening that selection.
- [x] Last-30-days Stats reported 825 total, 275 average, 335 lifting, 490 Basketball, and 3-of-4 supported-session coverage. The missing structured session was excluded from the average.
- [x] The 14-day AI Export reported the same 825 total and 275 average with 3-of-3 in-range coverage; the additional missing estimate was outside that export range. The export retained the user-entered watch/wearable and not-precise-expenditure caveat.
- [x] The focused pass ended with no browser console errors or warnings.

## Prescription/target correction recheck

The focused correction pass ran through localhost on 2026-09-11 after reconciling
effective targets with prescription copy and making the Core Sync invariant
line-ending independent:

- [x] A makes-target proposal changed Weak-Hand Finishing from 15 to 20; pending and rejected states left the base prescription unchanged, apply updated Next Session and courtside copy, and two-stage undo restored the prior future target.
- [x] A duration proposal changed Crossover Control from 6 to 10 minutes; planned duration, immediate action, work structure, and success text all used 10 with no stale 6-minute instruction.
- [x] A structured session saved the 20-make/10-minute performed snapshots. A later 25-make future override did not alter History; History continued showing 20 while Next Session showed 25. Undo restored future 20 and left the historical snapshots unchanged.
- [x] Old structured history without prescription snapshots showed stored result fields without borrowing current text, and a legacy 12-minute free-form record remained readable.
- [x] AI Export included bounded `Planned/resolved prescription` and `Historical performed prescription` summaries with Do now, work/rest, cues, and success fields.
- [x] A structured Basketball active-calorie estimate edited from 220 to 225 in place, appeared as 225 in History, and increased the Basketball Stats total without duplicating the session identity.
- [x] At both 390 and 320 px, Compact, Standard, Large, and Extra Large text showed the 20-make and 10-minute prescriptions with document width equal to scroll width.
- [x] The focused pass ended with only expected MarcusFit diagnostic logs and no browser console warnings or errors.

## Real-iPhone-only checklist — pending

Desktop browser control cannot validate these items. Record the iPhone model, iOS version, Safari versus installed/home-screen mode, MarcusFit text size, and pass/fail notes for each item.

- [ ] Confirm both active-calorie inputs open the intended numeric keyboard, accept blank and whole numbers including zero, and visibly reject negative, decimal, scientific-notation, non-numeric, and greater-than-5000 values.
- [ ] Run a full Basketball session courtside by touch. Confirm all prescribed content stays readable, controls meet the expected touch target, and finish/review controls remain reachable.
- [ ] Open and close How to do it repeatedly by touch. Confirm the disclosure does not accidentally trigger primary-tab swipe navigation and horizontal swipes that begin within it remain owned by the disclosure/card.
- [ ] Check safe-area spacing in portrait and landscape, including the courtside header, bottom controls, and mobile Save Day bar.
- [ ] With the software keyboard open, confirm the active calorie field and save controls are not covered; dismissing the keyboard must not jump tabs, lose the value, or change scroll unexpectedly.
- [ ] Repeat the flow in an installed/home-screen launch and in a normal Safari tab.
- [ ] Cold-launch, background, and resume after entering and after saving calories. Confirm drafts follow existing behavior and saved values/prescription snapshots reopen correctly.
- [ ] At MarcusFit Extra Large text, inspect the longest prescriptions for clipping, overlap, awkward truncation, or inaccessible content.
- [ ] Save and edit the same lifting day and Basketball session on device. Confirm each retains one historical identity and clearing only the calorie value preserves all other data.
- [ ] Confirm old structured Basketball history without prescriptions/calories and schema-1 free-form history remain readable and editable without migration.
- [ ] Confirm lifting, Habits, History, Stats, backup/restore, AI Export, Sync review/apply/undo, Basketball program selection, and progression remain functional.
- [ ] Complete the pass with connected Safari Web Inspector and confirm no console errors or unexpected warnings.

Acceptance remains pending independent ChatGPT review and Marcus's explicit real-device QA approval.
