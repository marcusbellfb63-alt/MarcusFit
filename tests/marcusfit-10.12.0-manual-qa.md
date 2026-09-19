# MarcusFit 10.12.0 manual QA

Status: candidate. Localhost browser checks are recorded below. Real-iPhone
Safari and Home Screen/PWA QA is deliberately pending until independent review
clears an exact implementation head.

## Localhost browser matrix

Repeat the setup/preferences checks at approximately 320, 390, and 480 CSS px
with Standard and Extra Large MarcusFit text sizes.

- [x] A blank profile opens Tracking Preferences with virtual Full Coaching and
  no explicit tracking object written merely by rendering the surface.
- [x] Four preset choices render with readable outcome copy, native-button
  keyboard behavior, `aria-pressed`, visible non-color selection, and no
  clipping or horizontal overflow.
- [x] Simple Fitness Log sets every Daily metric off; Habits, Basketball,
  recurring adherence, Active Calories, and Daily Notes off; Session Notes and
  Coaching Insights on; and Per Lift — Simple selected.
- [x] Changing only Workout logging detail to Detailed retains the Simple
  Fitness Log label. Changing one collection control changes the label to
  Custom.
- [x] Full Coaching and Strength Tracking explicit actions default to Detailed.
  Selecting Custom does not overwrite the current fields.
- [x] Save uses the accepted same-local-date replacement/later-date append
  timeline behavior. Reset clearly returns to Full Coaching + Detailed without
  deleting prior timeline entries or history.
- [x] Saved Simple and Detailed workouts retain their stored evidence modes
  after preference changes. An in-progress draft retains its mode; after the
  draft is discarded, a new blank workout follows the effective preference.
- [x] Under Simple Fitness Log, disabled new-collection surfaces are hidden,
  Session Notes remain available, and existing Daily/Workout/Basketball history
  and factual Stats remain visible and unchanged.
- [x] AI Export names Simple Fitness Log, explains intentional missing domains
  neutrally, remains compact, and creates no individual set rows from Simple
  summaries.
- [x] AI Sync rejects preset, lifting-detail, profile, and module mutation with
  zero writes.
- [ ] Backup preview/restore preserves the raw Simple Fitness Log timeline and
  an accepted 10.11.x profile remains readable without migration.
- [x] AI Tools and Simple workout fields show no adjacent layout regression.
  Save/Reset stays reachable and browser console has no implementation error.

Localhost evidence: the exact mapping, selection semantics, save result, reset
confirmation copy, hidden Daily surfaces, Session Notes controls, export, Sync
rejection, and a Simple draft surviving a saved Full Coaching preference change
were exercised in the in-app browser. After reload, the next blank workout used
Detailed. Disposable Detailed and Simple saved workouts each retained their
stored evidence mode after the inverse preset was saved; expanded History showed
one factual Set 1 row and one factual Per-Lift summary, and Stats remained
available. At 320/390/480 px in Standard and Extra Large, document width stayed
within the viewport, card content did not overflow, controls retained at least
44 px height, and the console contained no warning/error. Saved-workout inverse
authority, factual History/Stats, and raw backup round-trip also remain covered
by the automated suites; backup restore was not re-run in this disposable
browser origin.

## Real-device acceptance matrix

Run only after independent review identifies the exact head to test.

- [ ] Safari: complete critical setup, save/reset, workout authority, History,
  Stats, export, Sync rejection, and backup flows at Standard and Extra Large.
- [ ] Home Screen/PWA: repeat the critical flows and confirm safe-area behavior,
  scroll reachability, focus, rotation, and no horizontal overflow.
- [ ] Where practical, cover narrow (~320), common (~390), and wide (~480) CSS
  widths and one portrait/landscape rotation.
- [ ] Record any warning/error with exact reproduction steps.
- [ ] Marcus explicitly accepts the exact implementation HEAD before merge.

Do not mark this document accepted or the draft PR ready before those checks and
explicit acceptance are complete.
