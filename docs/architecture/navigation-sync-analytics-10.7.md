# MarcusFit 10.7 navigation, Sync IA, and analytics

Status: implementation candidate based on accepted 10.6 merge `d172ed429a2addb259a0dce622d9c2d94429816e` and QA-approved implementation head `cef5d39b3adf939ba7d9c59d6d6e250bcce7cbcd`. Nothing in this document marks 10.7 accepted.

## Navigation and scroll contract

The five existing primary IDs and inline `showScreen()` handlers remain unchanged. The sticky header measures its rendered height into `--mf-header-height`; safe-area padding, document scroll padding, and target scroll margins keep tabs visible and `scrollIntoView()` destinations below them. Each tab keeps an in-memory scroll offset. A first visit starts at zero; later visits restore the saved offset. Storage and browser history are untouched, and internal History/Basketball flows still call `showScreen()` before their target scroll.

Primary buttons use tablist/tab/tabpanel semantics with `aria-selected`, `aria-controls`, and roving `tabindex` state. Existing overlays retain higher z-indexes and their accepted body-scroll locks.

Swipe navigation is single-touch, finishes within 700 ms, requires at least 70 px horizontal travel and 1.25× vertical dominance, ignores the outer 24 px on each browser edge, and stops at primary boundaries. It never prevents vertical scrolling. Interactive controls, editable content, labels, details, horizontally scrollable ancestors, internal Sync navigation, dialogs, onboarding, proposal/Habit overlays, Basketball courtside, and explicit `data-mf-swipe-exempt` regions are excluded. Successful gestures route only through `showScreen()`.

## Sync internal-page map

The four memory-only pages are:

- AI Sync: release/status, range, warnings, export generation/copy/output, response input/apply/result.
- Personalize: coaching preferences, Program Personalization, and Habits management/proposal review.
- Profile: identity, goals, units, week start, text size, gym labels, save, and profile-reset confirmation.
- Data: backup/copy/restore/clear controls and confirmations, lifecycle health, and progression diagnostics.

All accepted functional IDs and inline handlers remain unique and unchanged. Known settings sections route to their owning page. The first primary Sync visit starts on AI Sync; later internal selection remains in memory. Program, Habit, or Basketball pending review adds a Personalize badge without changing the active page. A visible restore, clear-data, or profile-reset confirmation refuses page navigation and returns focus/scroll to that panel.

## Analytics derivation rules

Stats uses local calendar dates and one in-memory range: 7, 30 (default), 90 days, or all history. Finite ranges include today and compare with the immediately preceding equal calendar window. All-time values are explicitly separate.

- Training Load counts lifting sessions, lower-body lifting sessions, dedicated cardio, Basketball sessions/minutes, and valid logged work sets. It reuses resolved day classification and never combines heterogeneous loads into universal tonnage.
- Lifting Progress keys evidence by stable exercise ID, includes today's saved workout, excludes weight-only sets from rep progression, and lists only currently active resolved exercises. Historical/archived records remain intact and readable elsewhere.
- Weight and performance uses selected-range recorded-day averages/sample counts and descriptive overlap language only. No causal, medical, calorie, injury, or readiness claim is produced.
- Habits call the accepted schedule-aware analyzer with the selected and prior date bounds. Only eligible opportunities count; weekly-count, activation/archive, and legacy eligibility rules remain owned by the Habit layer.
- Recovery averages sleep, energy, hunger, water, and protein only across recorded selected-range values and reports sample counts.
- Recurring medication remains separate and retains the occurrence-based completed/skipped/unresolved denominator.
- Basketball totals filter to the selected dates. Trend keys contain program ID, program version, planned session ID, stable drill ID, and tracking mode; skipped drills are neutral and a displayed trend requires at least two comparable exposures.

Action Summary returns at most three deterministic observations. Insufficient evidence is explicit. It may describe frequency, progression-review evidence, concurrent lower-body/Basketball occurrence, scheduled Habit change, or weight-window movement; it never changes a program.

## Compatibility and limitations

10.7 adds no storage key or schema field and performs no analytics/navigation write. It does not change AI Export content/order or `assets/js/sync/12-ai-sync.js`. The accepted 22 classic deferred scripts, synchronous boot, Basketball-last wrappers, base `P`, 63 stable IDs, raw backup/restore semantics, historical snapshots, and review-first proposals remain protected.

Verified candidate invariants:

- Base `P` SHA-256: `652a04c37928f232490d37ce7e709dc16a25a8c5f408d679bce046b2f6a2d7d4`.
- Exercise-ID count/hash: 63 unique IDs, no duplicates; `7c333a9b7fb4639cafd0900a96f1d4ba58b8d6b8fb5ecc23f335e7ee041d0e2b`.
- Core Sync canonical-LF SHA-256 / Git blob: `14245321c8f47de5c152d011a08877ef4821e353c15bc3ed72c0490aa767c598` / `893556c24c035e7b0fcc1c717fcfba4b5f6f9308`.
- Accepted 9.6 release canonical-LF SHA-256 / Git blob: `f710c497cc6af212f6827f36461c000e655c66cba151392082ffffe55f14a160` / `c10e4a488296b7ba83311d7fc7bdd1dcd4c4b7e8`.
- Runtime: exactly 22 classic deferred scripts in the accepted order.

Desktop automation can model dimensions, touch events, edges, exclusions, focus, overflow, and console behavior, but cannot establish real iPhone Safari gesture arbitration, safe-area rendering, virtual-keyboard behavior, or home-screen PWA behavior. Marcus must complete the real-device checklist before acceptance.
