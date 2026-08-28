# Initialization and load-order map

`index.html` loads 22 classic `defer` scripts in this exact order:

```text
01 app constants -> 02 program data -> 03 lifecycle/resolved
-> 04 runtime state/profile/preferences -> 05 onboarding
-> 06 proposal engine -> 07 proposal UI -> 08 program/daily
-> 09 progression base -> 10 workout logging -> 11 AI export
-> 12 AI Sync -> 13 shared UI -> 14 History -> 15 Stats
-> 16 backup/restore/debug -> 17 starter programs
-> 18 progression corrections -> 19 recurring adherence -> 20 habits
-> 21 app boot -> 22 basketball
```

Evaluation occurs after HTML parsing, in source order, before
`DOMContentLoaded`. There is no MarcusFit `DOMContentLoaded` handler.

## Observable boot timeline

1. Constants/data/lifecycle/state and feature declarations evaluate.
2. Shared UI registers delegated input/change handlers and three `window.load`
   listeners in their accepted order.
3. Backup, starter, progression, and adherence wrapper captures install; Habits
   declares its Sync interception hook without replacing `applySync`.
4. Habit definitions initialize and habits render.
5. `21-app-boot.js` initializes lifecycle state and runs the idempotent 10.1.3
   virtual-day repair before synchronously rendering preferences/profile,
   onboarding, personalization, the program, and adherence.
6. `22-basketball.js` defines immutable program templates and local progression,
   captures the final backup/History/Stats/export/navigation functions, registers
   its listeners, resets its forms, and renders the current session queue.
7. The three previously registered `window.load` listeners run: remaining
   recommendation/specialization migrations and initial daily wiring; delayed
   badges; MutationObserver/save-hook installation.

Boot intentionally remains before basketball because that is the accepted
10.1.0 order. Moving basketball before boot or moving boot last would change
which implementations are captured and when initialization is observable.
