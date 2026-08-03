# MarcusFit

Personal mobile-first fitness tracker for workout logging, daily metrics, progression recommendations, AI sync updates, local backups, and exercise lifecycle management.

## Current Version

MarcusFit 10.1.0

## Architecture

- Static multi-file HTML/CSS/JavaScript app with `index.html` as the entry point
- Twenty-two feature-oriented classic deferred scripts in explicit numeric order; see `docs/architecture/README.md`
- Hosted with GitHub Pages
- Vanilla JavaScript — no build step, no frameworks
- localStorage persistence — no backend, no server
- Mobile-first layout (max-width 480px)
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
- Export current state → paste into Claude → receive `MARCUSFIT_UPDATE` JSON block → paste back to apply
- Supported actions: `_action: "update"` (exercise field changes), `_action: "recommendations"`, `_action: "reorder"`
- All sync changes are idempotent-safe — applying twice should not corrupt state

### Daily Logs
- Daily metrics (weight, sleep, mood, habits): key `day-YYYY-MM-DD`
- Workout sets log: key `day-YYYY-MM-DD-wo`
- Draft in-progress session: key `mf-current-draft`

### Basketball Sessions (`mf-basketball-sessions`)
- Versioned, independent session store supporting multiple sessions per date
- Required date, stable session type, and positive minutes
- Optional dribbling, shooting, free throws, and notes
- Included in History, Stats, backups, and AI exports without affecting lifting progression, habits, or AI Sync

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
const APP_VERSION      = "10.1.0";
const LIFECYCLE_VERSION = APP_VERSION;
```

Both are declared in `assets/js/core/01-app-constants.js`. Backup `appVersion`, lifecycle default `lifecycleVersion`, migration targets, and export strings reference these constants.

## Near-Term Roadmap

- **v10.1.0** — Basketball session logging (accepted runtime)
- **v10.1.1** — Runtime architecture inventory and dependency map (complete)
- **v10.1.2** — Behavior-preserving feature-oriented modularization (implemented on draft branch; awaiting QA)
- **v10.2.0** — Basketball programs and progression
