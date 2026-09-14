# MarcusFit 10.10.0 manual QA

Status: implementation candidate. Do not mark accepted until independent
review and Marcus real-iPhone Safari QA are complete.

## Automated browser evidence

Local Chromium QA passed on 2026-09-13 at 320, 390, 480, and 1024 px across
Compact, Standard, Large, and Extra Large text on Program, Daily Log, History,
Stats, and Tools. The four Tools sub-tabs and the expanded Basketball surface
also passed the 320 px Extra Large check. The run found no horizontal overflow,
rendered runtime-owned emoji, unresolved or zero-size visible SVG icons, or
console warnings/errors. This evidence does not replace real-iPhone Safari and
Home Screen QA.

## Setup

1. Create a production backup before using localhost restore.
2. Serve the repository over local HTTP; never use `file://`.
3. Open DevTools and preserve console output while moving through the app.
4. Test widths 320, about 390, 480, and desktop. Repeat each at Compact,
   Standard, Large, and Extra Large text size.

## Fast visual matrix

At every width/text-size combination verify:

- no page, card, dialog, or input row creates horizontal overflow
- MARCUS is near-white and FIT is lightning lime
- inactive primary navigation is neutral and the active route is clearly lime
- icons are crisp, aligned, unclipped, and never render as platform emoji
- text and icons do not collide; 44 px touch targets remain usable
- keyboard focus is visibly lime and not clipped
- sticky navigation, Save Day, and Basketball finish controls remain reachable
- warning/error/success states remain distinguishable without color alone
- the console has no new errors, warnings, or missing SVG references

## Screen pass

### Program

- Switch Home/Transition and open several workout-category day cards.
- Confirm category color remains distinct from brand lime.
- Edit, reset, cancel, and save an exercise; open Add Exercise on a virtual day.
- Check tags, inputs, recommendation disclosure, and chevrons at all text sizes.

### Daily Log

- Open every section: Daily Metrics, Habits, Workout, Basketball, and Notes.
- Exercise date navigation, future-date warning/confirmation, draft/resume, all
  metric controls, medication tracking, gym/day selectors, and Save Day.
- Confirm recommendation rows and default Habits use local monochrome icons.
- Save and reopen a workout, including wearable calories, without identity or
  value changes.

### Basketball

- Review program overview, next session, full program, and How to do it.
- Run one-drill courtside navigation, each tracking control, confidence buttons,
  skip, completion review, Finish & Advance, and Finish & Repeat.
- Check dialogs, free-form logging, structured edit, history, stats, and calorie
  field. Confirm no Basketball logic or queue behavior changed.

### History and Stats

- Exercise all filters, clear action, expandable lifting records, Basketball
  history, status pills, notes, calories, range control, charts, training load,
  Habit data, and Basketball Stats.
- Confirm stored user text remains readable while UI-owned icons are SVG.

### Tools / Sync

- Keyboard through AI Sync, Personalize, Profile, and Data tabs with Arrow keys,
  Home, and End.
- Generate/copy an export; paste valid and invalid Sync examples without applying
  production data. Confirm result text has no platform emoji.
- Open profile, coaching preferences, lifting/Habit/Basketball proposals, Habit
  Manager, backup/restore, diagnostics, and all critical confirmations.
- Verify destructive actions are red, warnings are amber, and primary actions
  are lime; cancel without performing destructive changes.

## Real-iPhone focus

Prioritize Safari and Home Screen/PWA-like use at the device's normal width:

- safe-area spacing around sticky header/save/courtside/footer controls
- keyboard-open states for workout loads, notes, profile, and Basketball inputs
- modal scrolling/background lock and restored page position
- Extra Large text in Program editors, courtside tracking, Tools tabs, and
  critical confirmations
- tap clarity of active lime states versus semantic success/warning/error
- absence of emoji fallback in every primary tab and proposal/dialog surface

Record device/iOS version, width, text size, failures, and console evidence.
