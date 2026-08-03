# Initialization and load-order map

`index.html:626-630` loads five classic scripts with `defer`:

```text
01-core-data.js
  -> 02-state-personalization.js
  -> 03-interactions-sync.js
  -> 04-backup-boot.js
  -> 05-basketball.js
```

Because they are ordered classic deferred scripts, evaluation occurs after HTML
parsing, in source order, before `DOMContentLoaded`. Top-level lexical bindings
share one global environment. There is no `DOMContentLoaded` listener. The
three `window.load` listeners run later, after all five scripts and the final
synchronous boot have evaluated.

## Per-script evaluation contract

| Script | Top-level declarations and inputs | Immediate effects / listeners / initialization | Public globals | Failure if reordered |
|---|---|---|---|---|
| `01-core-data.js` | Defines version, legacy habit/program datasets, `P`, overrides, recommendation storage, lifecycle/resolved-program/day helpers and validation. Some function bodies refer forward to `habitState`, `autoSaveDraft`, `gym`, `logGym`. | No listener and no tail boot. Functions can reference later declarations because calls occur after all scripts load. Storage is read/written only when helpers are called. | Ten explicit lifecycle/day APIs/debug names; many global lexical/function bindings. | Later files lose `APP_VERSION`, `P`, storage constants, lifecycle/resolved helpers. Calling its UI functions before `02/03` would hit missing forward state. |
| `02-state-personalization.js` | Defines `gym`, `logGym`, `tDate`, draft state; preferences/profile/onboarding/proposal engines and UI. Requires `P`, lifecycle/override/recommendation helpers from `01`. | Declaration-only during evaluation; no listeners or tail calls. DOM is touched by functions later. | Onboarding/proposal fixture/debug/transaction exports. | Proposal/profile/onboarding code cannot resolve `P`, lifecycle or storage constants. Moving it after `04` breaks starter and final boot inputs. |
| `03-interactions-sync.js` | Defines daily/workout UI, progression, export, Sync, shared UI, History/Stats. Requires state from `02` and program/lifecycle from `01`. | Registers delegated `change` and `input` listeners at evaluation. Registers three `window.load` listeners: main migration/render boot (`178-203`), delayed badges (`4168-4175`), and MutationObserver/save-hook installation (`4189-4224`). No immediate render. | Debug APIs, `_exp`, and load-time `window.saveDay/autoSaveDraft/updateSaveBtn` hooks. | Without `01/02`, declarations may parse but load-time calls fail. After `04`, final synchronous boot would call missing render/profile/export functions. |
| `04-backup-boot.js` | Defines backup/restore/debug, starter templates, metric corrections, adherence, personalized habits, navigation. Captures and reassigns many `03` functions. Requires all earlier systems. | During evaluation it creates/initializes the habit definition store (`2187`), renders habits (`2188`), then synchronously renders prefs/profile, initializes onboarding, may open onboarding, renders personalization, releases starter guard, renders program, and renders adherence (`2202-2226`). It defines/reassigns wrappers before those calls. | Final debug/self-test/template APIs and final pre-basketball effective wrapper bindings. | Before `03`, all capture assignments and boot calls fail. Moving any wrapped base definition after it silently discards corrections/integrations. |
| `05-basketball.js` | IIFE defines private basketball system; requires `APP_VERSION`, `tDate` and final backup/History/Stats/navigation/export functions. | Immediately captures/reassigns backup and render/export/navigation functions; registers form/dialog/document listeners; resets form and renders basketball History/Stats in `mfBasketballInit()` at line 429. | `mfBasketballDebug`; Node-only `__mfBasketballTest`; modifies `_exp` during export. | Earlier placement misses or gets overwritten by later wrappers. Missing DOM is mostly guarded, but absent dependency functions removes integrations. |

## Actual system-level edges

```text
01 version/P/lifecycle/resolved program
  -> 02 state/profile/onboarding/proposals
  -> 03 program + daily/workout + progression + export/Sync + History/Stats
  -> 04 backup + starter + corrected metrics + adherence + habits + navigation + boot
  -> 05 basketball late integrations

03 base genExport
  -> 04 starter -> metrics -> adherence -> habits
  -> 05 basketball

03 base p7CalcAnalytics -> 04 habits calculation
03 base p7RenderAnalytics -> 04 adherence render -> 05 basketball render
03 base renderHistoryFromEntries -> 04 habit append
03 base p7ApplyFilters -> 05 basketball History render

04 base backup predicate/summary/format/validation -> 05 basketball wrappers
04 base showScreen -> 05 basketball wrapper
03 base updateTrackerDate -> 05 basketball wrapper
```

## Function capture/reassignment order

The effective function is the last assignment, but every wrapper calls its
captured predecessor.

| Target | Capture/reassignment sites in effective order | Required invariant |
|---|---|---|
| `genExport` | base `03:2847`; starter `04:1162`; metrics `04:1723`; adherence `04:1978`; habits `04:2138`; basketball `05:390` | Every section appears once, in accepted placement; all update the same `_exp`. |
| `p954RenderProgramPersonalization` | base `02:4214`; starter extension `04:1219` | Base card renders before starter chooser. |
| Progression functions | base `03:500-1035`; direct reassignments `04:1301-1519` | Correct metric semantics replace legacy implementations before workout/history/export use. |
| `renderWoExercises` | base `03:1887`; metric wrapper `04:1530` | Base DOM first, metric-specific adjustments second. |
| `p949BuildWorkoutReview` | base `03:2030`; metric wrapper `04:1552` | Review receives corrected metric evidence. |
| rotation signals | base `03:2489,2510`; metric wrappers `04:1579,1603` | Corrected candidates augment base analysis. |
| `setTog`, `applyStateToForm`, `loadDay` | base `03`; adherence wrappers `04:1972-1976` | Legacy `zep` UI/data is bridged to structured adherence without double handling. |
| `p7CalcAnalytics` | base `03:4389`; habit wrapper `04:2128` | Active personalized definitions replace fixed legacy habit analytics. |
| `p7RenderAnalytics` | base `03:4509`; adherence `04:1977`; basketball `05:381` | Base Stats, then adherence, then basketball. |
| `renderHistoryFromEntries` | base `03:4350`; habit wrapper `04:2131` | Habit details append to already-rendered base cards. |
| `p85ExecuteSave` | base `03:2255`; habit-preserving wrapper `04:2134` | Existing/unknown daily fields and historical habits survive same-day saves. |
| `applySync` | base `03:3261`; habit proposal wrapper `04:2163` | Habit proposal is intercepted for review; base updates still use accepted parser. |
| `p8IsMarcusFitKey`, summary, formatter, validator | base `04`; basketball `05:351-375` | Basketball remains optional for old backups but strictly validated when present. |
| `p7ApplyFilters`, `updateTrackerDate`, `showScreen` | base `03/04`; basketball `05:378-389` | Basketball views/date/badge refresh after base behavior. |

The `window.load` save hooks at `03:4195-4223` capture the *effective global
bindings at load-event time*, after `04/05` evaluation. They assign
`window.saveDay`, `window.autoSaveDraft`, and `window.updateSaveBtn`; inline
lookup therefore reaches these hooked versions. This is an implicit timing
dependency, not just textual source order.

## Boot timeline

1. HTML is fully parsed because all scripts are `defer`.
2. `01`, `02`, and `03` evaluate; `03` registers listeners.
3. `04` installs all non-basketball wrappers.
4. `04` initializes habits, then performs synchronous profile/onboarding/program
   and adherence boot. `p952InitAutoShow()` may display onboarding immediately.
5. `05` installs late wrappers, listeners, and immediately initializes
   basketball UI.
6. Deferred-script completion leads to `DOMContentLoaded` (no MarcusFit handler).
7. `window.load` runs `03` listeners in registration order:
   lifecycle/recommendation migration and render/load wiring; delayed badge
   scheduling; MutationObserver and global save/draft/update hooks.

## Reordering failure modes to preserve explicitly in 10.1.2

- `P`, version, key constants, and lifecycle helpers must precede every consumer.
- `starterProgramStateReady` must not release until profile/onboarding/starter
  inputs exist; `renderProgram` deliberately guards earlier calls.
- Wrapper targets must be defined before capture and may not be redefined later
  unless that redefinition deliberately composes the prior effective function.
- `tDate` must remain one shared mutable binding. Basketball reads it and
  `updateTrackerDate` can replace it after extreme-date correction.
- Inline handler names need not exist while parsing, but must exist before user
  interaction and remain resolvable in the global environment.
- No arbitrary timeout or `DOMContentLoaded` conversion should replace the
  synchronous `04/05` initialization. Such a change can reorder onboarding,
  program render, basketball render, and the `window.load` migrations/hooks.
- IIFE isolation in `05` should be retained; only its debug API is public.
