# MarcusFit runtime architecture

MarcusFit 10.1.2 reorganized the accepted runtime into 22 coherent, ordered
classic scripts. The 10.2.0 implementation candidate keeps those boundaries
and expands only the final basketball feature file. GitHub Pages still loads
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

The 10.2.0 candidate runtime has 15,097 physical lines. The largest file remains
1,808 lines. Numeric prefixes are globally ordered and match `index.html`.

## Guide

- `runtime-system-map.md` records ownership and direct dependencies.
- `global-and-inline-handler-map.md` records the compatibility surface.
- `storage-and-backup-map.md` records all 16 owned keys/patterns.
- `initialization-and-load-order-map.md` records the exact execution order.
- `dependency-risk-register.md` records mitigated and remaining risks.
- `proposed-module-plan.md` records implementation decisions and deviations.
- `../../tests/marcusfit-10.1.2-modularization-equivalence.md` records evidence.

Run `node tools/architecture/inventory-runtime.js` with the bundled Node
runtime to reproduce counts and protected hashes. Static scanner candidates are
supporting evidence; tests and browser behavior remain authoritative.
