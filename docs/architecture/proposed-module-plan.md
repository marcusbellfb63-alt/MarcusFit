# Proposed 10.1.2 module plan

This is a conservative target for behavior-preserving extraction from accepted
10.1.0. It is not authorization to change runtime behavior. The target keeps
classic scripts and explicit source order; “module” means a coherent file, not
an ES module.

## Design principles

- Dependency-free vanilla JavaScript; no npm, package manager, framework,
  TypeScript, bundler, build step, backend, or new runtime dependency.
- Preserve direct GitHub Pages deployment and ordered classic `defer` scripts.
- Keep the public/global surface and all inline handlers during 10.1.2.
- Preserve storage keys, schemas, default/migration timing, raw backup strings,
  replacement restore, AI export text, and AI Sync behavior.
- Move code before redesigning it. Each stage has a meaningful rollback commit
  and focused automated/browser validation.
- Prefer coherent feature ownership over phase-number/history ownership.
- Reduce maximum file size and unrelated context without creating dozens of
  tiny files. A target of 18–22 runtime files is appropriate; 21 are proposed.
- Keep `P` and other large immutable datasets intact rather than splitting by
  day/exercise.
- Make load order readable in `index.html` and repeat it in architecture docs.

## Proposed target tree

```text
assets/js/
|-- core/
|   `-- 01-app-constants.js
|-- data/
|   `-- 02-program-data.js
|-- program/
|   `-- 03-lifecycle-resolved.js
|-- state/
|   `-- 04-runtime-state-drafts.js
|-- features/
|   |-- 05-profile-preferences.js
|   |-- 06-onboarding.js
|   |-- 07-program-proposals.js
|   |-- 08-program-proposal-ui.js
|   |-- 09-starter-programs.js
|   |-- 10-program-daily-workout.js
|   |-- 11-progression.js
|   |-- 12-history.js
|   |-- 13-stats.js
|   |-- 14-recurring-adherence.js
|   |-- 15-habits.js
|   `-- 20-basketball.js
|-- sync/
|   |-- 16-ai-export.js
|   `-- 17-ai-sync.js
|-- system/
|   |-- 18-backup-restore.js
|   `-- 19-debug.js
`-- boot/
    `-- 21-app-boot.js
```

Numeric prefixes remain global across folders so the HTML order is obvious.
The feature numbering also preserves the essential constraint that basketball
loads after backup, History, Stats, navigation, and export definitions. The
boot file is last only after basketball integration is converted from immediate
tail initialization to an explicitly equivalent boot call in the same stage;
until then, keep basketball’s current immediate init and load it last. This is a
proposed end state, not permission to reorder it prematurely.

## File contracts

| Target file | Purpose / owned systems and primary functions | Globals exported | Dependencies | Rough scope | Risk | Token-efficiency benefit |
|---|---|---|---|---:|---|---|
| `core/01-app-constants.js` | `APP_VERSION`, lifecycle/schema constants and small truly shared pure helpers only; no feature storage keys | Existing constant names | none | 50–100 lines | Low | Opens version/shared contract without loading data/features. |
| `data/02-program-data.js` | Immutable `P`, legacy habit seed data, workout recommendations; no storage/UI logic | `P`, `HABITS`, `WO_RECS` | app constants | 250–400 | High content sensitivity, low logic risk | Program-data review no longer requires lifecycle/UI files. |
| `program/03-lifecycle-resolved.js` | Overrides, recommendations, lifecycle CRUD, day overrides/additions/disables, resolved program, safe day/name helpers and validation core | Current lifecycle/resolved API and debug-required hooks | constants, program data, `localStorage` | 1,400–1,800 | High | One coherent program-state boundary instead of searching three files. |
| `state/04-runtime-state-drafts.js` | `gym`, `logGym`, `tDate`, toggle/workout/habit state shells, draft key/read/write and date selection helpers | Existing state/draft/inline names | constants, DOM when called | 150–250 | High live-binding risk | Makes mutable state location unambiguous. |
| `features/05-profile-preferences.js` | Coaching preferences and user profile normalize/read/write/render/export block | `p9*CoachPrefs`, `p950*`, key constants | constants, state, DOM/storage | 350–500 | Medium | Profile/preference changes avoid onboarding/proposal context. |
| `features/06-onboarding.js` | Fresh-install evidence, onboarding schema/state, step UI, answer application/completion | Existing `p951*`, `p952*`, `p953*`, debug APIs/handlers | profile, lifecycle evidence, state, DOM | 1,500–1,900 | High | Removes ~1,700 lines from proposal file while retaining coherent flow. |
| `features/07-program-proposals.js` | Proposal schema/normalize/validate/source/build/apply/undo transaction; no overlay rendering | Existing `p954/p955` engine and transaction APIs | program/lifecycle, profile/onboarding, logs | 1,700–2,100 | High | Engine review excludes 1,300+ lines of overlay markup. |
| `features/08-program-proposal-ui.js` | Personalization card, detailed review, apply/keep/undo overlays and all inline `p954R*` handlers | Current inline handlers and review debug | proposal engine, starter render hook, DOM | 1,200–1,500 | Medium/High | UI changes need engine contract, not engine implementation context. |
| `features/09-starter-programs.js` | Immutable starter templates, basis normalization/selection, registry APIs, chooser and export block builder | Existing registry/basis APIs and debug hooks | `P`, profile, proposal UI/rendering | 350–500 | High `P` snapshot dependency | Starter work no longer requires backup/progression/habits. |
| `features/10-program-daily-workout.js` | Program render/gym controls, daily form/drafts, workout render/collect/save/load, recommendations, shared badges/sticky UI | Inline program/daily/workout names and save hooks | state, resolved program, profile/starter, DOM/storage | 1,500–1,900 | High | Core logging work reads one feature file plus its explicit dependencies. |
| `features/11-progression.js` | Last-time lookup, parsing/metric profiles, suggestions/status, workout review, rotation signals and diagnostics; final corrected implementations only | Existing progression/review/debug names | resolved program, workout logs, overrides | 1,400–1,700 | High | Eliminates the current split between base and correction wrappers. |
| `features/12-history.js` | Entry discovery/filtering/render, habit detail hook interface, basketball render hook interface | `renderHistory`, `p7*` filter/render names | daily/workout, resolved program, habits | 450–650 | High wrapper/DOM risk | History work avoids Stats/export/Sync files. |
| `features/13-stats.js` | Base analytics object and render, explicit extension hooks for habits/adherence/basketball | `p7CalcAnalytics`, `p7RenderAnalytics` | daily/workout, habit/adherence read models | 400–600 | High | Stats calculations become inspectable without History/UI parser context. |
| `features/14-recurring-adherence.js` | Recurring schemas, date math, item/event ownership, legacy bridge, UI, Stats/export extension builders | Existing `p9510*` handlers/debug | state/daily, Stats/export hooks, backup ownership | 250–350 | High shared-daily risk | Medication scheduling becomes a narrow domain. |
| `features/15-habits.js` | Definitions/manager/proposal, daily integration, History/Stats/export/Sync extension builders | Existing `p960*` handlers/debug/self-test; final habit render names | profile/onboarding, daily, History/Stats/export/Sync hooks | 350–500 | High | Habit changes stop requiring backup/boot and old fixed-habit implementation context. |
| `sync/16-ai-export.js` | Range/log program/profile/proposal/progression export and explicit ordered extension composition | `genExport`, `doCopy`, `window._exp`, export helpers | all read models, no feature writes | 1,100–1,400 | Critical | Export review is isolated; extensions are visible in one ordered list. |
| `sync/17-ai-sync.js` | Accepted parser, validation, ordered apply/rollback plus explicit habit-proposal extension | `applySync`, existing debug bridge | lifecycle/overrides/recommendations/proposals/habits | 800–1,000 | Critical | Sync changes do not require export/History/Stats context. |
| `system/18-backup-restore.js` | Ownership registration/predicate, raw backup build, summary/validation/migrate, preview, replacement restore and clear | Existing `p8*` handlers/functions | every storage owner’s declared key, validation callbacks | 350–500 | Critical | One auditable persistence/recovery boundary. |
| `system/19-debug.js` | Architecture/storage/profile/lifecycle/progression/onboarding/proposal/adherence/habit debug aliases and self-test exports; feature-specific logic may stay with feature and be re-exported here | Same `window.mf*` names/shapes | all feature read APIs | 650–900 | Medium | Normal feature files shed historical audit maps without losing QA surface. |
| `features/20-basketball.js` | Current IIFE normalize/store/UI/History/Stats/export/backup integration, initially moved intact | `mfBasketballDebug`; Node-only test object | state, History/Stats/export/backup hooks | ~430 | Medium | Already token-efficient and isolated; path aligns it with features. |
| `boot/21-app-boot.js` | Explicit final wrapper registration if needed, synchronous init sequence, load listeners and DOM wiring | only compatibility hook assignments already public | all systems | 150–250 | Critical | One file answers “what starts when” and makes source-order review cheap. |

Estimated sizes are goals, not arbitrary limits. Preserve coherent code even if a
file modestly exceeds its range.

## Recommended extraction sequence: 10 stages

Each stage should be one or more focused commits with a rollback point; do not
mix stages merely because a move is mechanical.

1. **Strengthen compatibility contracts.** Replace the soon-to-be-obsolete
   exact four-file concatenation check with accepted-release content hashes,
   `P`/exercise-ID invariants, the 257-name/global and 83-handler inventories,
   exact script order, wrapper-order spies, golden AI export, valid/invalid Sync,
   and backup/restore fixtures. Runtime remains unchanged.
2. **Extract constants and immutable data.** Create app constants and move `P`,
   legacy habit seeds, and recommendations byte-identically. Validate hashes and
   resolved program output.
3. **Extract shared state, preferences, profile, and onboarding.** Preserve live
   global bindings, default-write timing, inline handlers, and fresh/established
   detection. Avoid proposal changes.
4. **Extract lifecycle/resolved program and starter programs.** Move overrides,
   lifecycle and resolved helpers as a coherent layer; then move starter data and
   selection. Validate stable IDs, `P`, program basis and all rollback paths.
5. **Extract proposal engine and proposal UI.** First move engine/apply/undo,
   then UI in a separate commit. Validate raw transactions, conflicts, deferred
   actions and all review handlers.
6. **Extract program/daily/workout and progression.** Move daily/workout flow;
   consolidate corrected progression implementations so legacy wrappers are not
   accidentally retained twice. Validate old logs, future/backdated save,
   assistance/cardio/duration and review results.
7. **Extract History, Stats, adherence, and habits.** Establish explicit ordered
   extension hooks while preserving exact output/DOM. Move History and Stats in
   separate rollback commits, then adherence/habits integration.
8. **Extract backup/restore.** Register all 15 keys/patterns explicitly while
   preserving the effective predicate and basketball optional validation. Run
   old/current/malformed/unknown-key and replacement-restore fixtures.
9. **Extract AI export and AI Sync.** Compose export extensions in the accepted
   order; move Sync intact and retain habit interception. Require byte-identical
   golden exports and storage-delta equality for Sync.
10. **Consolidate debug and boot; relocate basketball last.** Preserve every
    debug shape/name, move the already-isolated basketball file mechanically,
    and extract boot only after every dependency is stable. Update architecture
    documents and perform full HTTP browser QA.

Do not proceed to the next stage while focused validation is failing. Each
substantial stage should use a dedicated rollback commit even within the single
10.1.2 draft PR.

## Code that should remain comparatively large

- `P` should remain one immutable dataset. Per-day or per-exercise files would
  add ordering overhead and make the protected whole harder to hash/review.
- Starter template data should remain with starter selection unless it grows
  enough to dominate that feature; do not split each template.
- Proposal normalization/build/application/undo is a transactional engine. It
  may be separated from UI, but internal apply/undo helpers should not be
  scattered across tiny files.
- AI Sync’s ordered parse/validate/plan/apply flow should move intact before any
  later internal cleanup.
- Progression metric semantics and workout-review consumers should stay in one
  feature boundary after the base/correction layers are consolidated.
- Basketball should remain a single ~430-line isolated feature unless future
  basketball programs/AI Sync create independently coherent subdomains.

## Explicitly deferred beyond 10.1.2

- ES modules or any loader/build-system conversion.
- Framework, TypeScript, npm, backend, analytics, service-worker, or deployment
  changes.
- Full inline-handler migration; no `index.html` behavior rewrite should be
  bundled with extraction.
- CSS splitting unless 10.1.3 demonstrates a concrete benefit.
- Feature changes, algorithm rewrites, visual redesign, schema redesign, key
  renames, migration cleanup, or new persistence.
- AI wording, export ordering, AI Sync capability, basketball AI Sync/programs,
  and automatic habit/program application changes.
- “Fixing” backup summary limitations or restore semantics during a move.

## Measurable success criteria

- Runtime/UI behavior, title, visible version and `APP_VERSION` remain 10.1.0.
- All automated tests and new compatibility contracts pass; browser load has no
  console errors through a local HTTP server.
- `Releases/` and accepted release hashes are unchanged; base `P` and stable
  exercise IDs are unchanged.
- Exact same 83 static inline attributes, 61 referenced functions, 58 explicit
  `window.*` names, and effective 257-name compatibility surface.
- Same 15 storage keys/patterns, schemas, initialization timing and missing/
  malformed/legacy behavior.
- Backup JSON data values remain raw-equivalent; preview/validation, old-backup
  acceptance, replacement restore and post-restore results are equivalent.
- AI export output is byte-identical for golden fixtures; valid AI Sync produces
  the same storage changes and invalid Sync remains rejected without writes.
- Script order is explicit and tested; synchronous boot and three load listeners
  preserve their observable order.
- Maximum runtime file size falls well below the current 5,224 lines, with a
  target under ~2,100 lines.
- A change to History, Stats, basketball, habits, profile, backup, export or Sync
  normally requires reading that feature and a small documented dependency set,
  not multiple 2,000–5,000-line files.
- Final runtime uses roughly 18–22 coherent files, not dozens of fragments, and
  architecture maps reflect the accepted end state.
