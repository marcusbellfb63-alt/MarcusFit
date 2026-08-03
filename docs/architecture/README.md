# MarcusFit runtime architecture inventory

This directory records the accepted MarcusFit 10.1.0 runtime at starting commit
`d66fe5cc53bca31db59ae288429bb95c16d1585c`. MarcusFit 10.0.0 was the
first-stage extraction from one HTML file into HTML, CSS, and four ordered
classic scripts; it was deliberately not the final module architecture. Version
10.1.0 added isolated basketball tracking as a fifth ordered script.

Roadmap phase 10.1.1 is analysis and documentation only. It does not change the
runtime version, behavior, storage, UI, tests, or accepted releases. Phase
10.1.2 should use this evidence to perform controlled, behavior-preserving,
feature-oriented extraction.

## Current runtime tree

```text
index.html
assets/css/marcusfit.css
assets/js/
|-- 01-core-data.js             (1,732 lines)
|-- 02-state-personalization.js (5,224 lines)
|-- 03-interactions-sync.js     (4,663 lines)
|-- 04-backup-boot.js           (2,226 lines)
`-- 05-basketball.js              (430 lines)
```

All five scripts are classic `defer` scripts. Numeric/source order is part of
the compatibility contract.

## Guide

- `runtime-system-map.md` answers what systems exist, where they live, and what
  they own or call.
- `global-and-inline-handler-map.md` identifies the global names that extraction
  must preserve and every inline handler in `index.html`.
- `storage-and-backup-map.md` defines storage ownership, schemas, backup
  discovery, preview, validation, and replacement restore behavior.
- `initialization-and-load-order-map.md` records evaluation side effects,
  wrappers, listeners, boot timing, and order-sensitive edges.
- `dependency-risk-register.md` prioritizes evidence-based modularization risks.
- `proposed-module-plan.md` recommends the conservative 10.1.2 target tree and
  rollback sequence.
- `../../tools/architecture/README.md` documents the reproducible, read-only
  inventory scanner and its limitations.

Future agents should begin here, confirm that their branch baseline still
matches this inventory, then consult the maps for every system they intend to
move. Treat tests and source as authoritative if later accepted work changes the
runtime. Line numbers in these documents are snapshots and will shift after
future edits; named functions, stable IDs, storage keys, wrapper order, and
ownership boundaries are the primary references.

