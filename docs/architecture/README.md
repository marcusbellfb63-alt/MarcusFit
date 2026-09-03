# MarcusFit runtime architecture

MarcusFit 10.1.2 reorganized the accepted runtime into 22 coherent, ordered
classic scripts. The 10.6.0 implementation candidate keeps those boundaries
and composes export sections through the existing ordered classic-script wrappers. GitHub Pages still loads
static `defer` scripts, and there is no build step or runtime dependency.

## Implemented runtime tree

```text
assets/js/
|-- core/01-app-constants.js
|-- data/02-program-data.js
|-- program/03-lifecycle-resolved.js
|-- state/04-runtime-state-profile-preferences.js
|-- features/05-onboarding.js
|-- features/06-program-proposals.js
|-- features/07-program-proposal-ui.js
|-- features/08-program-daily.js
|-- features/09-progression-base.js
|-- features/10-workout-logging.js
|-- sync/11-ai-export.js
|-- sync/12-ai-sync.js
|-- features/13-shared-ui.js
|-- features/14-history.js
|-- features/15-stats.js
|-- system/16-backup-restore-debug.js
|-- features/17-starter-programs.js
|-- features/18-progression-corrections.js
|-- features/19-recurring-adherence.js
|-- features/20-habits.js
|-- boot/21-app-boot.js
`-- features/22-basketball.js
```

The 10.6.0 candidate retains 22 runtime files in the accepted numeric order.
Reproducible physical-line and largest-file counts come from the architecture
inventory. Numeric prefixes remain globally ordered and match `index.html`.

## 10.5 export and Sync composition

- `sync/11-ai-export.js` owns the deterministic high-level export skeleton and the single mixed response contract.
- `features/17-starter-programs.js`, `18-progression-corrections.js`, `19-recurring-adherence.js`, and `20-habits.js` fill owned section slots without prepending competing prompts.
- `features/22-basketball.js` fills Basketball evidence last and derives the cross-domain summary after every domain is available.
- The cross-domain summary is read-only and derived from existing logs/stores; 10.5 adds no storage key or schema.
- `sync/12-ai-sync.js` remains the sole authoritative core apply implementation and is unchanged. Habit/Basketball extension hooks preflight their exact mixed envelope before any processing.

## 10.6 Basketball boundary

- `features/22-basketball.js` continues to own all four existing Basketball keys and adds no schema.
- Landing, program inspection, one-drill courtside execution, completion review, historical comparison, and concise export context are derived from existing state.
- Progression comparability requires program, version, planned session, stable drill, and tracking mode identity; historical views remain bound to stored snapshots.
- See `basketball-10.6-audit.md` for the flow inventory, audit findings, exact rules, and retained risks.

## Guide

- `runtime-system-map.md` records ownership and direct dependencies.
- `global-and-inline-handler-map.md` records the compatibility surface.
- `storage-and-backup-map.md` records all 18 owned keys/patterns.
- `initialization-and-load-order-map.md` records the exact execution order.
- `dependency-risk-register.md` records mitigated and remaining risks.
- `proposed-module-plan.md` records implementation decisions and deviations.
- `basketball-10.6-audit.md` records the Basketball storage/flow audit and progression rules.
- `../../tests/marcusfit-10.1.2-modularization-equivalence.md` records evidence.

Run `node tools/architecture/inventory-runtime.js` with the bundled Node
runtime to reproduce counts and protected hashes. Static scanner candidates are
supporting evidence; tests and browser behavior remain authoritative.
