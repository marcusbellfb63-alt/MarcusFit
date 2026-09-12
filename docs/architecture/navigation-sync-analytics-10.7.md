# MarcusFit 10.7 navigation, Sync IA, and analytics

Status: accepted and merged at `1de89a40c810919d1edf831d1af4d69b2d4b46d7`; QA-approved implementation head `2f553b756309b42494bed34e00f054891e18e78d`.

## Navigation and scroll contract

The five existing primary IDs and inline `showScreen()` handlers remain unchanged; only the user-facing `export` tab label is now Tools. Every successful primary selection opens its destination at document scroll position zero; no destination scroll offset is retained anywhere. Daily Log disclosures start collapsed and retain only their live DOM state after the user or a deliberate task flow opens them. The mobile Save Day bar is removed from layout, focus, and hit testing whenever Daily Log is not active. The sticky header measures its rendered height into `--mf-header-height`; safe-area padding, document scroll padding, and target scroll margins keep tabs visible and later intentional `scrollIntoView()` destinations below them. Storage and browser history are untouched, and internal History/Basketball flows still call `showScreen()` before performing their later target scroll.

Primary buttons use tablist/tab/tabpanel semantics with `aria-selected`, `aria-controls`, and roving `tabindex` state. ArrowLeft/ArrowRight wrap through adjacent tabs, Home/End select the first/last tab, and all handled keys activate only through `showScreen()` before focusing the selected tab. Native button Enter/Space behavior remains unchanged. Existing overlays retain higher z-indexes and their accepted body-scroll locks.

Swipe navigation is single-touch, finishes within 700 ms, requires at least 70 px horizontal travel and 1.25× vertical dominance, ignores the outer 24 px on each browser edge, and stops at primary boundaries. It never prevents vertical scrolling. Interactive controls, editable content, labels, details, horizontally scrollable ancestors, internal Sync navigation, dialogs, onboarding, proposal/Habit overlays, Basketball courtside, and explicit `data-mf-swipe-exempt` regions are excluded. Successful gestures route only through `showScreen()`.

## Sync internal-page map

The four memory-only pages are:

- AI Sync: release/status, range, warnings, export generation/copy/output, response input/apply/result.
- Personalize: coaching preferences, Program Personalization, and Habits management/proposal review.
- Profile: identity, goals, units, week start, text size, gym labels, save, and profile-reset confirmation.
- Data: backup/copy/restore/clear controls and confirmations, lifecycle health, and progression diagnostics.

All accepted functional IDs and inline handlers remain unique and unchanged. Known settings sections route to their owning page. The first primary Tools visit starts on AI Sync; later internal selection remains in memory. Every successful internal selection returns the Tools screen to the top. ArrowLeft/ArrowRight and Home/End activate only through `mfSelectSyncPage()` and focus a destination tab only after that selection succeeds. Program, Habit, or Basketball pending review adds a Personalize badge without changing the active page. Habit review exposes a confirmed Dismiss Proposal action that records the accepted rejected status without changing definitions or history; its static review control and Personalize badge update immediately for pending, applied-with-Undo, rejected, undone, and absent states. A visible restore, clear-data, or profile-reset confirmation refuses page navigation, does not focus the refused tab or reset the page to the top, and returns focus/scroll to that panel.

## Analytics derivation rules

Stats uses local calendar dates and one in-memory range: 7, 30 (default), 90 days, or all history. Finite ranges include today and compare with the immediately preceding equal calendar window. All-time values are explicitly separate.

- Training Load counts lifting sessions, lower-body lifting sessions, dedicated cardio, Basketball sessions/minutes, and valid logged work sets. It reuses resolved day classification and never combines heterogeneous loads into universal tonnage.
- Lifting Progress keys evidence by stable exercise ID, includes today's saved workout, excludes weight-only sets from rep progression, and lists only currently active resolved exercises. Historical/archived records remain intact and readable elsewhere.
- Weight and performance uses selected-range recorded-day averages/sample counts and descriptive overlap language only. No causal, medical, calorie, injury, or readiness claim is produced.
- Habits call the accepted schedule-aware analyzer with the selected and prior finite date bounds. The All-history Stats path instead begins each Habit at its definition activation date or, for legacy-inferred definitions, its first recorded evidence; a legacy Habit with no evidence remains neutral. Archive dates and weekly-count semantics remain owned by the Habit layer. The established no-argument recent analyzer used by export and other consumers is unchanged.
- Recovery averages sleep, energy, hunger, water, and protein only across recorded selected-range values and reports sample counts.
- Recurring medication remains separate and retains the occurrence-based completed/skipped/unresolved denominator.
- Basketball totals filter to the selected dates. Trend keys contain program ID, program version, planned session ID, stable drill ID, and tracking mode; skipped drills are neutral and a displayed trend requires at least two comparable exposures.

Action Summary returns at most three deterministic observations. Insufficient evidence is explicit. It may describe frequency, progression-review evidence, concurrent lower-body/Basketball occurrence, scheduled Habit change, or weight-window movement; it never changes a program.

Workout set rows remain text-backed and preserve the exact `{wt,reps,rir}` save contract. Every load field initially requests a decimal keypad, including fields with a nonnumeric prefill. A compact, non-persisted `ABC`/`123` control switches that field between text and decimal keyboard hints and returns focus without changing its raw value; rerendering returns to decimal mode. This keeps bodyweight, assistance, band, range, and unit-bearing text practically enterable while honoring number-pad-first entry. Rep/count fields request an integer keypad; duration values request a decimal keypad after metric resolution. RIR remains the accepted native choice control. Rendering, focusing, or changing keyboard mode does not write storage.

## Compatibility and limitations

10.7 adds no storage key or schema field and performs no analytics/navigation write. It does not change AI Export content/order or `assets/js/sync/12-ai-sync.js`. The accepted 22 classic deferred scripts, synchronous boot, Basketball-last wrappers, base `P`, 63 stable IDs, raw backup/restore semantics, historical snapshots, and review-first proposals remain protected.

Verified candidate invariants:

- Base `P` SHA-256: `652a04c37928f232490d37ce7e709dc16a25a8c5f408d679bce046b2f6a2d7d4`.
- Exercise-ID count/hash: 63 unique IDs, no duplicates; `7c333a9b7fb4639cafd0900a96f1d4ba58b8d6b8fb5ecc23f335e7ee041d0e2b`.
- Core Sync canonical-LF SHA-256 / Git blob: `14245321c8f47de5c152d011a08877ef4821e353c15bc3ed72c0490aa767c598` / `893556c24c035e7b0fcc1c717fcfba4b5f6f9308`.
- Accepted 9.6 release canonical-LF SHA-256 / Git blob: `f710c497cc6af212f6827f36461c000e655c66cba151392082ffffe55f14a160` / `c10e4a488296b7ba83311d7fc7bdd1dcd4c4b7e8`.
- Runtime: exactly 22 classic deferred scripts in the accepted order.

Desktop automation can model dimensions, touch events, edges, exclusions, focus, overflow, and console behavior, but cannot establish real iPhone Safari gesture arbitration, safe-area rendering, virtual-keyboard behavior, or home-screen PWA behavior. Marcus must complete the real-device checklist before acceptance.
