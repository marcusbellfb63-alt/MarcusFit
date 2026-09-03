# MarcusFit

Personal mobile-first fitness tracker for workout logging, daily metrics, progression recommendations, AI sync updates, local backups, and exercise lifecycle management.

## Current Version

MarcusFit 10.7.0 — Navigation, Sync IA, and analytics implementation candidate

## Architecture

- Static multi-file HTML/CSS/JavaScript app with `index.html` as the entry point
- Twenty-two feature-oriented classic deferred scripts in explicit numeric order; see `docs/architecture/README.md`
- Hosted with GitHub Pages
- Vanilla JavaScript — no build step, no frameworks
- localStorage persistence — no backend, no server
- Mobile-first layout (max-width 480px)
- Safe-area-aware mobile layout with user zoom enabled
- Compact, Standard, Large, and Extra Large text-size preferences stored in the user profile
- Designed to be saved to iPhone home screen as a PWA

## Core Systems

### Program Data
- Base workout program lives in `P` (read-only object, never mutated at runtime)
- User exercise overrides (custom name, load, reps, blurb) live in lifecycle storage
- Resolved program (base + overrides applied) is assembled at render time via `getResolvedProgram()`

### Exercise Lifecycle (`mf-exercise-state`)
- Primary lifecycle key: `mf-exercise-state`
- Tracks: active/inactive exercises, custom exercises, replacement links, order overrides
- Schema version tracked in `lc.schemaVersion`; lifecycle version in `lc.lifecycleVersion`
- `LIFECYCLE_VERSION` constant keeps this in sync with `APP_VERSION`

### Progression Engine (Phase 9A)
- `p9BuildSuggestion()` computes suggestion text + status class (`up`, `hold`, `safer-hold`, `reduce`, `new`, `neutral`)
- `p9GetProgressionStatus()` returns status string for badge + prefill routing
- `p9ComputePrefill()` returns aligned prefill values per set based on status
- `p9BadgeHTML()` renders the progression badge
- Status definitions:
  - `up` — at top of rep range with RIR to spare; bump load
  - `hold` — maintain current load and work on reps
  - `safer-hold` — RIR was tight last session; keep load, raise RIR floor to 2–3
  - `reduce` — reserved for true weight reduction (future engine v2)
  - `new` — no prior data; start conservative
  - `neutral` — cardio or non-trackable sessions

### AI Recommendations (`mf-recommendations`)
- Key: `mf-recommendations`
- Stores per-day coaching items injected via AI sync (`_action: "recommendations"`)
- Rendered safely via DOM textContent (no innerHTML for AI-provided strings)

### AI Sync (MARCUSFIT_UPDATE blocks)
- One ordered AI Export presents program/user basis, coaching context, a derived cross-domain summary, domain evidence, current experiments, and one response contract
- Core lifting uses the accepted update array/actions; Habit and Basketball changes use review-first `habitProposal` / `basketballProposal` objects
- Cardio/activity, vitals, recurring adherence, and history are explicitly advisory/read-only
- Mixed payload envelopes reject unsupported top-level fields before core or proposal processing

### Daily Logs
- Daily metrics (weight, sleep, mood, habits): key `day-YYYY-MM-DD`
- Workout sets log: key `day-YYYY-MM-DD-wo`
- Draft in-progress session: key `mf-current-draft`

### Basketball Sessions (`mf-basketball-sessions`)
- Versioned, independent session store supporting multiple sessions per date
- Required date, stable session type, and positive minutes
- Optional dribbling, shooting, free throws, and notes
- Additive structured records snapshot stable program/session/drill identity and user-facing names
- Included in History, Stats, backups, and AI exports without affecting lifting progression, habits, or AI Sync

### Basketball Programs (`mf-basketball-program-state`)
- Session-driven, cyclical queue with no weekly schedule or missed-session penalties
- Built-in Fundamentals, Guard Skills, and Shooting Focus templates use stable versioned identities
- Drill tracking is basketball-specific: confidence, duration, makes target, shooting benchmark, count, or completion
- Finish & Advance moves the queue only after a successful structured save; Finish & Repeat leaves the same session next
- Courtside mode shows one drill at a time with tracking-specific inputs, neutral skip, explicit review, and a post-save summary
- Partial sessions preserve skipped drills without counting them as progression exposures
- Deterministic local guidance compares only matching program/version/session/drill/mode identity and never mutates a program automatically

### Basketball AI Sync (`mf-basketball-program-overrides`, `mf-basketball-proposal`)
- Built-in basketball templates remain deeply frozen; sparse schema-1 overrides resolve only future planned sessions
- AI may propose bounded drill modification, stable-ID addition, future disable, within-session reorder, or a switch among built-in programs
- Proposals import as pending and require review plus a second explicit confirmation before applying
- Expected-state fingerprints refuse stale apply, and one-level undo refuses to overwrite later user changes
- Basketball session history and stored drill snapshots are never rewritten by proposal apply or undo

### Habit AI Sync (`mf-habit-definitions`, `mf-habit-proposal`)
- Existing schema-1 Habit definitions remain the mutable source of truth; no override store is introduced
- Proposal import alone captures granular per-Habit, scoped-order, or add-ID absence evidence
- Reopen, preview, apply, diagnostics, and backup validation are comparison-only and never refresh missing evidence
- Apply and one-level exact-snapshot Undo require two explicit clicks and never rewrite `day-YYYY-MM-DD` adherence

### Backup / Restore
- Full backup serializes all MarcusFit-owned localStorage keys to a JSON blob with an `appVersion` field
- Restore validates schema before applying
- Always create a backup before major AI sync updates or restoring old data

## localStorage Keys (frozen — do not rename)

| Key | Purpose |
|-----|---------|
| `mf-exercise-state` | Exercise lifecycle (overrides, custom, replacements, order) |
| `mf-recommendations` | AI day recommendations |
| `mf-current-draft` | Current workout draft session |
| `mf-basketball-sessions` | Versioned basketball session records |
| `mf-basketball-program-state` | Active basketball program and next-session queue position |
| `mf-basketball-program-overrides` | Sparse future-program basketball personalization overlays |
| `mf-basketball-proposal` | Basketball proposal review, apply metadata, and safe undo snapshot |
| `mf-user-profile` | Identity, units, gym labels, and display preferences including text size |
| `day-YYYY-MM-DD` | Daily body metrics + habits |
| `day-YYYY-MM-DD-wo` | Workout sets for that day |

## Development Rules

1. **Do not mutate base program `P`** — all user changes go through the lifecycle/override system
2. **Inspect storage ownership first** — add a key only when the feature needs an independent backward-compatible schema
3. **Preserve backup compatibility** — all new fields must degrade gracefully on restore
4. **Preserve old logs** — never wipe `day-*` keys during migrations
5. **Preserve archived exercise IDs** — archived IDs must remain stable for history lookup
6. **No native browser dialogs** — `confirm()` and `alert()` are blocked in iOS PWA; use inline modal patterns
7. **Surgical edits only** — prefer targeted fixes over rewrites; document what changed per version
8. **AI sync changes idempotent** — applying the same update block twice should not corrupt state
9. **Centralized version** — use `APP_VERSION` / `LIFECYCLE_VERSION` constants; never hardcode version strings elsewhere

## Backup Warning

**Always create a MarcusFit backup before:**
- Applying major AI sync update blocks
- Restoring from an older backup
- Any change to the lifecycle migration path

## Version Constants

```js
const APP_VERSION      = "10.6.0";
const LIFECYCLE_VERSION = APP_VERSION;
```

Both are declared in `assets/js/core/01-app-constants.js`. Backup `appVersion`, lifecycle default `lifecycleVersion`, migration targets, and export strings reference these constants.

## Candidate record

- 10.7.0 starts from accepted 10.6.0 merge commit `d172ed429a2addb259a0dce622d9c2d94429816e`
- Accepted 10.6.0 QA-approved implementation head: `cef5d39b3adf939ba7d9c59d6d6e250bcce7cbcd`
- 10.7.0 is not accepted; automated review and Marcus manual browser/iPhone QA are required

## Acceptance Record

- 10.6.0 is accepted and merged at `d172ed429a2addb259a0dce622d9c2d94429816e`; QA-approved implementation head `cef5d39b3adf939ba7d9c59d6d6e250bcce7cbcd`
- 10.5.0 is accepted and merged at `60934a151f95c34d5a659cd131c91abca43bfa91`; QA-approved implementation head `73faa06e2b5476a8ab7549c76c3cfdbe84277911`
- The representative 14-day export fixture changed from 32,711 characters / 602 lines to 21,494 characters / 336 lines while adding cross-domain load, adherence, pending-proposal, and conditioning-interaction signals
- Core `assets/js/sync/12-ai-sync.js` remains unchanged with SHA-256 `25aaf52986493af7d5796b57f81746f8f279f506b2550a61ca7b011c9572c51e`
- 10.4.0 accepted starting baseline: `7e0059780f47e545b91ee02ad27291e836ace3af`
- 10.3.0 exact accepted starting baseline: `28053354b0ffc1654a398456d5fc7447059340e5`
- 10.3.0 QA-approved implementation head: `74402eeb3f3c2c76cb54fd6a3b0d5bde828e878d`
- Manual QA accepted: 2026-08-30
- Real-device iPhone Safari QA passed, including proposal scrolling, add/remove/reorder, safe undo, stale conflict protection, mixed Sync, backup/restore, and regression sanity
- Core Sync remained byte-identical with SHA-256 `25aaf52986493af7d5796b57f81746f8f279f506b2550a61ca7b011c9572c51e`

## Near-Term Roadmap

- **v10.1.0** — Basketball session logging (accepted runtime)
- **v10.1.1** — Runtime architecture inventory and dependency map (complete)
- **v10.1.2** — Feature-oriented 22-script runtime (accepted)
- **v10.1.3** — Program-day integrity and historical identity repair (accepted)
- **v10.1.4** — Mobile accessibility, Sync/settings organization, and Habits UI (accepted)
- **v10.2.0** — Basketball programs and progression (accepted)
- **v10.3.0** — Basketball-specific AI Sync (accepted)
- **v10.4.0** — Habits-specific AI Sync (accepted)
- **v10.5.0** — Cross-domain coaching and AI Export/Sync IA (accepted)
- **v10.6.0** — Basketball courtside UX and progression maturation (accepted)
- **v10.7.0** — Navigation, Sync IA, and analytics maturation (implementation candidate)
