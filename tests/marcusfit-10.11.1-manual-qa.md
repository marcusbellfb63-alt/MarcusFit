# MarcusFit 10.11.1 real-iPhone manual QA

Status: pending Marcus. Run against the exact candidate HEAD through HTTPS or a
localhost-equivalent deployment; never use `file://`. Record device, iOS/Safari
version, display zoom, text size, installation mode, candidate SHA, and result.

## Required matrix

Repeat critical flows in Safari and Home Screen/PWA at Standard and Extra Large
MarcusFit text sizes. Include a narrow-device check where available and rotate
portrait/landscape once to expose overflow or stale layout.

- [ ] Detailed regression: existing per-set rows, load `ABC`/`123` keyboard,
  reps keypad, RIR selectors, prefill, Last Time, progression badge, notes,
  active calories, save/reopen, review, and same-date update remain unchanged.
- [ ] Select Per Lift — Simple. Verify compact Sets/Reps/Weight/RIR controls,
  44 px targets, clear lowest-reps/hardest-RIR helper copy, practical numeric
  and text load keyboard switching, and no horizontal overflow.
- [ ] Leave every Simple field blank and save another daily value. Confirm no
  exercise evidence is created merely from the displayed prescribed-set hint.
- [ ] Log a Simple exercise, save, reopen, and inspect History: one Per-Lift
  summary appears with no fabricated Set 1/2/3 lines.
- [ ] Confirm workout review counts the exercise and exact reported set count,
  uses hardest-RIR warnings, and shows the Simple next action.
- [ ] Confirm Stats Training Load adds the exact reported work-set count and
  Lifting Progress places a qualifying Simple result in Ready to Progress.
- [ ] Start and autosave a Simple draft, switch Tracking Preferences to
  Detailed, reload/resume, and confirm the draft remains Simple with all values.
- [ ] Discard that draft and start a new blank workout; confirm it uses the
  current Detailed preference.
- [ ] While current preference is Simple, open an old Detailed workout and
  confirm it remains Detailed after edit/save. Repeat inversely for a saved
  Simple workout while current preference is Detailed.
- [ ] Switch Full Coaching + Simple and Strength Tracking + Simple; confirm both
  retain their named preset labels. Confirm Custom + Simple and reset copy/result
  returning to Full Coaching + Per Set — Detailed.
- [ ] Exercise progression cases on-device: incomplete sets, below-range reps,
  in-range reps, missing RIR, tight RIR, strict top-range numeric load,
  bodyweight, duration, assistance, text/ranged load, and unit mismatch.
- [ ] Exercise mixed chronological Detailed/Simple history, a backdated edit,
  same-date edit identity, and the two-session programmed-ceiling confirmation.
- [ ] Generate mixed AI Export. Confirm Detailed stays per-set; Simple states
  that individual sets were not recorded, includes lowest reps/hardest RIR,
  progression mode/confidence, and contains no fabricated set lines.
- [ ] Create and preview a backup containing Detailed, Simple, mixed history,
  draft, and Simple Tracking Preferences. Restore it and confirm exact values and
  modes; also restore an accepted 10.11 backup and confirm virtual Detailed.
- [ ] Check History and Stats with mixed records, session notes disabled during
  an unrelated edit, and active-calorie values present.
- [ ] At approximately 320, 390, and 480 CSS px where practical, verify no
  horizontal scrolling, clipped labels, overlapping keyboard toggle, or save-bar
  obstruction at Standard and Extra Large text.
- [ ] Check browser console/runtime diagnostics where practicable. Record any
  warning/error attributable to 10.11.1 and the exact reproduction steps.

## Acceptance record

Do not check this section on behalf of Marcus.

- [ ] Marcus reports Safari matrix passed.
- [ ] Marcus reports Home Screen/PWA matrix passed.
- [ ] Marcus explicitly accepts the exact implementation HEAD: `____________`.
- [ ] Draft PR remains unmerged and not marked ready until that acceptance.
