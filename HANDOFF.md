# MarcusFit Project Handoff

## Current accepted state

MarcusFit 10.0.0 is accepted, merged into `main`, and live through GitHub Pages. Manual real-data QA passed, and the original 10.0.0A–E multi-file extraction roadmap is finished.

- Documentation branch starting point (fetched `origin/main`): `c1b6d2fee6cf7a9f439c5f7eb978b4e7da28ddb4`
- Accepted 10.0.0 feature head: `a99865e76c11b7068de0c2b2d16c3a605f23e706`
- Original PR #4 merge commit: `f36b91b175c896d0c0749b817bfda0f57d41b5c2`

PRs #5 and #6 synchronized `main` and the completed multi-file feature branch. They added merge-history entries but no file differences, so they require no corrective action or history cleanup.

## Current architecture

MarcusFit is a static, dependency-free vanilla HTML, CSS, and JavaScript application hosted by GitHub Pages. It has no build step or package manager. The production entry point is `index.html`; browser persistence uses `localStorage`.

The main stylesheet is `assets/css/marcusfit.css`. Four classic deferred JavaScript files form the runtime and must load in numeric/source order:

1. `assets/js/01-core-data.js`
2. `assets/js/02-state-personalization.js`
3. `assets/js/03-interactions-sync.js`
4. `assets/js/04-backup-boot.js`

MarcusFit 10.0.0 completed the first-stage extraction from a single HTML file. It separated HTML, CSS, and JavaScript and divided the runtime into four ordered files while preserving compatibility. It was not intended as the final modular architecture: the runtime files remain comparatively large. Finer-grained, feature-oriented modularization is a near-term priority for maintainability, focused agent context, smaller diffs, and better token efficiency.

Browser testing must use a local HTTP server. Never test production behavior through `file://`.

## Current repository layout

```text
MarcusFit/
├── index.html
├── assets/
│   ├── css/
│   │   └── marcusfit.css
│   └── js/
│       ├── 01-core-data.js
│       ├── 02-state-personalization.js
│       ├── 03-interactions-sync.js
│       └── 04-backup-boot.js
├── Releases/
├── tests/
├── HANDOFF.md
└── AGENTS.md
```

## Protected invariants

These requirements are mandatory:

- Never modify `Releases/MarcusFit9_6_0.html` or any earlier accepted release.
- Base program `P` must remain immutable.
- Preserve stable exercise IDs and existing workout and history compatibility.
- Preserve existing `localStorage` schemas unless a scoped feature explicitly requires a backward-compatible addition.
- Preserve backup and restore compatibility.
- Preserve public globals, functions referenced by inline HTML handlers, and debug helpers.
- Preserve current AI export and AI Sync behavior unless a specifically approved feature changes it.
- Preserve classic-script execution order.
- Avoid unrelated refactoring during feature implementation.

Do not introduce frameworks, npm, TypeScript, bundlers, build systems, backend services, analytics, service workers, unnecessary dependencies, or unnecessary architectural layers.

## Development workflow

- ChatGPT handles roadmap planning, implementation review, and manual-QA guidance.
- Codex handles larger implementation phases.
- Claude Code handles batches of smaller updates.
- Use one dedicated Git branch and one draft pull request per feature or phase.
- Start every branch from freshly fetched `origin/main`; never work directly on `main`.
- Substantial implementation phases should contain multiple meaningful rollback commits.
- Keep pull requests draft until manual QA passes. Never merge until Marcus explicitly accepts the work.
- After a merge, fetch/pull updated `main` before starting another phase. Do not continue new work from an old feature branch.
- A merged feature branch may be safely deleted because its merged commits remain in `main`.

## Local QA and data safety

The home PC is the primary local QA machine; GitHub Desktop and a Python local HTTP server are working there. The work PC may be used for planning, PR review, and cloud Codex tasks, but do not assume it is configured for local QA.

Back up the live MarcusFit app before loading production data into a development build. GitHub Pages and localhost are separate browser origins with separate `localStorage`; restoring production data into localhost must be deliberate.

Always run the local app through HTTP, for example:

```bash
python -m http.server 8000
```

Never use `file://`. When applicable, manual QA should cover:

- Initial load and console errors
- Refresh persistence
- Daily log save and workout save
- History reopening and stats
- AI export
- Invalid AI Sync rejection and valid AI Sync compatibility
- Backup creation, backup preview, restore, and post-restore refresh
- Desktop and phone layouts

## Completed and planned roadmap

Completed phases:

```text
9.5.9  — Progression and exercise-metric correctness — Complete
9.5.10 — Schedule-aware recurring adherence — Complete
9.6.0  — Custom habits and modular Sync foundations — Complete
10.0.0 — Lean multi-file conversion / first-stage extraction — Complete
```

Upcoming roadmap:

```text
10.0.1 — Project handoff and agent documentation
10.1.0 — Basketball session logging
10.1.1 — Runtime architecture inventory and dependency map
10.1.2 — Feature-oriented JavaScript modularization
10.1.3 — Optional CSS organization and architecture stabilization, only if justified
10.2.0 — Basketball programs and progression
10.3.0 — Basketball-specific AI Sync
10.4.0 — Habits-specific AI Sync
10.5.0 — Full cross-domain coaching review
```

Documentation-only repository work may use `10.0.1` as an organizational roadmap label. It must not change the displayed `APP_VERSION` or runtime version.

## 10.1.0 Basketball session logging

This phase is planned but not started. Its scope is to log basketball sessions with required/basic fields for session type and minutes, plus optional dribbling details, shooting details, free-throw results, and notes. Sessions should appear in History, Stats, backups, and AI exports.

Isolation rules:

- Do not automatically alter the lifting program, lifting progression, or habits.
- Do not change AI Sync behavior.
- Do not introduce basketball programs or basketball progression yet.
- Do not introduce basketball-specific AI Sync yet.

`mf-basketball-sessions` is a proposed key, not a final decision. The implementation phase must first inspect existing storage and backup patterns and determine whether a separate key is appropriate.

## Near-term modularization plan

The four large JavaScript files still require broad context for small changes. Feature-oriented files should reduce unrelated code inspection, improve reviewability and token efficiency, and let feature changes touch a narrow, predictable set of files. The goal is not the maximum number of files; it is clear responsibilities, safe dependency order, compatibility, and smaller change surfaces.

### 10.1.1 — Architecture inventory

This phase is documentation and analysis only. It will map:

- Major runtime systems and function ownership
- Shared globals and inline-handler dependencies
- Initialization order
- Storage keys and schemas
- Backup and restore participation
- AI export participation
- Rendering and cross-file dependencies
- Candidate feature boundaries

It makes no runtime behavior changes.

### 10.1.2 — Feature-oriented JavaScript modularization

Perform controlled, behavior-preserving extraction based on the inventory. Potential categories include core constants and utilities, storage, program data, daily tracking, workout logging, History, Stats, habits, basketball, proposals, AI export, AI Sync, backup and restore, debug helpers, and boot and initialization.

These are potential categories, not a fixed prescribed file tree. The actual module plan must come from analysis of the existing runtime.

### 10.1.3 — Optional CSS organization

Proceed only if the architecture inventory and real feature work show that splitting the stylesheet provides a meaningful benefit. Do not split CSS merely to increase file count.
