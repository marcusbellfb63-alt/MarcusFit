# Global and inline-handler map

The production scripts are classic scripts, not ES modules. Top-level
`function`/`var` declarations are global-object properties; top-level
`const`/`let` declarations are shared global lexical bindings. Both forms can be
required by later scripts even when no `window.*` assignment exists.

The read-only scanner found 83 inline attributes in `index.html`, 61 distinct
called functions, 58 distinct explicit `window.*` names (87 assignment sites),
and 175 top-level names referenced from another script. Their union is 257
compatibility-visible names. Static use detection is supporting evidence: tests
and source review remain authoritative.

## Inline handler inventory

Every handler below can technically become an event listener. During 10.1.2 all
should be preserved as written: combining extraction with handler migration
would change both initialization and global-surface contracts. “Later” means a
separate, focused phase after equivalent listener-order and interaction tests.

| HTML line(s) / purpose | Attribute and expression | Referenced function(s) | Current definition | Listener migration |
|---|---|---|---|---|
| 14–15 onboarding close/skip | `onclick=p952CloseOnboarding()`; `p952ShowSkipConfirm()` | same | `02:1595,1556` | Later; overlay stateful |
| 27–28 skip confirmation | `onclick=p952ConfirmSkip()`; `p952CancelSkip()` | same | `02:1564,1560` | Later |
| 38,42 proposal review close | `onclick=p954RCloseReview()` (two buttons) | `p954RCloseReview` | `02:4913` | Later; duplicate controls |
| 43–44 proposal actions | `p954RShowApplyPreview()`; `p954RShowKeepConfirm()` | same | `02:5026,4921` | Later |
| 53–54 keep confirmation | `p954RConfirmKeepCurrentProgram()`; `p954RCancelKeepConfirm()` | same | `02:4945,4930` | Later |
| 64–65 apply confirmation | `p954RConfirmApplyPreview()`; `p954RCancelApplyPreview()` | same | `02:5083,5071` | Later |
| 75–76 undo confirmation | `p954RConfirmUndoPreview()`; `p954RCancelUndoPreview()` | same | `02:5149,5147` | Later |
| 88–92 tabs | five `showScreen('<name>')` calls | `showScreen` | base `04:2191`, wrapped `05:388` | Later; wrapper hook critical |
| 97–98 program gym | `setGym('home'|'partial')` | `setGym` | `03:100` | Later |
| 117–118 draft banner | `resumeDraft()`; `dismissDraft()` | same | `03:73,91` | Later |
| 124,126 date navigation | `shiftDay(-1|1)` | `shiftDay` | `03:1989` | Later; `tDate`/basketball wrapper |
| 131 metrics collapse | `p6Toggle('metrics')` | `p6Toggle` | `03:4071` | Later |
| 143 weight live update | DOM text assignment then `p6UpdateMetricsBadge()` | `p6UpdateMetricsBadge` | `03:4077` | Later; preserve statement order |
| 144–146 metrics inputs | `p6UpdateMetricsBadge()` (three inputs) | same | `03:4077` | Later |
| 149 adherence setup | `p9510OpenSetup()` | same | `04:1899` | Later |
| 159 adherence setup buttons | `p9510SaveSetup()`; `p9510CancelSetup()`; `p9510DisableTracking()` | same | `04:1905,1904,1914` | Later |
| 165 mood slider | DOM text assignment then `p6UpdateMetricsBadge()` | `p6UpdateMetricsBadge` | `03:4077` | Later |
| 171 hunger slider | DOM text assignment then `p6UpdateMetricsBadge()` | `p6UpdateMetricsBadge` | `03:4077` | Later |
| 178–179 BM toggles | `setTog('bm','yes'|'no')` | `setTog` | base `03:447`, wrapped `04:1973` | Later; wrapper target |
| 188 habits collapse | `p6Toggle('habits')` | `p6Toggle` | `03:4071` | Later |
| 199,417 habit manager | `p960OpenHabitManager()` (two buttons) | same | `04:2096` | Later; dynamic overlay |
| 206 workout collapse | `p6Toggle('workout')` | `p6Toggle` | `03:4071` | Later |
| 218–220 workout state | `setWO('yes'|'no'|'rest')` | `setWO` | `03:453` | Later |
| 223–224 log gym | `setLogGym('home'|'partial')` | `setLogGym` | `03:457` | Later |
| 228 workout day select | `renderWoExercises();autoSaveDraft();p6UpdateWorkoutBadge();p949HideReview();` | four named functions | `03` base; `renderWoExercises` wrapped `04:1531` | Later; exact order critical |
| 246 basketball collapse | `p6Toggle('basketball')` | `p6Toggle` | `03:4071` | Later |
| 310 notes collapse | `p6Toggle('notes')` | `p6Toggle` | `03:4071` | Later |
| 321 notes input | `p6UpdateNotesBadge()` | same | `03:4119` | Later |
| 330–331 future-save panel | `p85ConfirmFutureSave()`; `p85CancelFutureSave()` | same | `03:2246,2251` | Later |
| 336,351 save buttons | `saveDay()` (two buttons) | `saveDay` | `03:2235`; `window` hook `03:4197` | Later; save hook critical |
| 342 workout review | `p949HideReview()` | same | `03:2214` | Later |
| 385–387 History toggles | three `p7FToggle(key,this)` calls | `p7FToggle` | `03:4235` | Later |
| 391 clear History filters | `p7ClearFilters()` | same | `03:4243` | Later |
| 418 habit proposal review | `p960OpenHabitProposalReview()` | same | `04:2160` | Later |
| 422 export range | `updateExportMeta()` | same | `03:2349` | Later |
| 433–434 export/copy | `genExport()`; `doCopy()` | same | base `03:2847,3258`, export wrapped through `05` | Later; critical wrapper chain |
| 441 AI Sync | `applySync()` | `applySync` | base `03:3261`, wrapped `04:2164` | Later; critical parser entry |
| 496–497 profile save/reset | `p950SaveUserProfileFromUI()`; `p950ResetUserProfileDefaults()` | same | `02:300,361` | Later |
| 506–507 profile reset confirm | `p950ConfirmResetProfile()`; `p950CancelResetProfile()` | same | `02:376,384` | Later |
| 520–522 coaching preferences | save/reset/clear `p9*CoachPrefs()` | three functions | `02:73,82,91` | Later |
| 541–544 backup actions | create/copy/restore/clear `p8*` | four functions | `04:172,183,238,324` | Later; public recovery surface |
| 546 backup textarea | `p8HideRestoreConfirm()` | same | `04:269` | Later |
| 554–555 restore confirmation | `p8ConfirmRestore()`; `p8CancelRestore()` | same | `04:281,275` | Later |
| 564–565 clear confirmation | `p8ConfirmClearData()`; `p8CancelClearData()` | same | `04:335,343` | Later |
| 601,610 diagnostics | `p945ToggleDiag()`; `p945RenderDiag()` | same | `03:1878,1844`; render wrapped `04:1669` | Later |

No `onsubmit` or `onkeydown` attribute exists in `index.html`. Basketball
registers a `keydown` listener programmatically. `01:64` contains three inline
attributes in the legacy habit-card HTML template (`toggleHabitOpen`,
`toggleHabitDone`, `updateHabitNote`), but active 9.6.0 rendering reassigns
`renderHabits` in `04:2074` and creates listeners/properties programmatically.
Those legacy names must still remain until that dormant template is deliberately
removed under a separately tested compatibility change.

## Compatibility categories and strategy

| Category | Meaning | Required 10.1.2 strategy |
|---|---|---|
| True public API | Deliberate `window` API or console/manual-QA helper | Re-export same name and behavior; preserve read-only/self-test semantics. |
| Inline-handler requirement | Called by an HTML event attribute | Keep callable in the global environment before user interaction. |
| Cross-file internal global | Top-level binding consumed by a later script | Preserve binding/name during extraction or change every consumer in one tested rollback step. |
| Debug-only global | `mf*Debug`, audit, fixture, or self-test API | Preserve until test/manual-QA replacement is approved. |
| Legacy compatibility global | Retained wrapper/base name or dormant handler | Preserve while accepted compatibility test and old behavior depend on it. |
| Test-only exposure | `window.__mfBasketballTest` only when Node is detected | Keep conditional and absent from normal browser surface. |

## Required-name spotlight

| Name | Type / definition | Consumers and meaning | May become internal? | Compatibility strategy |
|---|---|---|---|---|
| `P` | Protected global lexical constant, `01:123` | Resolved program, proposals, starter snapshot, rendering, export, tests | No in 10.1.2 | Move byte-identically; load before every consumer; retain name. |
| `APP_VERSION` | Global lexical constant, `01:3` | All later files, backup metadata, debug, tests | No | Keep first and unchanged. |
| `tDate` | Mutable global lexical state, `03:4` | Daily save/load, progression exclusion, adherence/habits, basketball date | Eventually behind state API | Retain live binding; never copy its initial value into modules. |
| `showScreen` | Function `04:2191`, reassigned `05:388` | Five inline tabs; program/History/Stats/export/basketball render hooks | Not while inline handlers remain | Preserve base name and basketball-last reassignment. |
| `genExport` | Function `03:2847`, wrapped five times in `04`, once in `05` | Inline export; starter/metrics/adherence/habits/basketball sections | Not before wrapper redesign | Capture/reassign in identical order or replace atomically with contract tests. |
| `applySync` | Function `03:3261`, habit wrapper `04:2164` | Inline Sync; lifecycle/override/recommendation/proposal/habit writes | No during behavior-preserving extraction | Preserve accepted invalid/valid behavior and wrapper entry name. |
| `window._exp` | Shared string buffer, first written `03:3253`, rewritten by later wrappers | copy UI and all export wrappers | Later, after export API exists | Preserve same buffer and final text; do not create detached copies. |
| `mfBasketballDebug` | True debug API, `05:401-405` | Manual QA/tests; read-only basketball/storage/backup report | Only with approved replacement | Keep sole production basketball export. |

## Explicit `window.*` surface (complete)

Repeated assignment sites are shown once. “Consumers” are console/manual QA,
tests, aliases in `04`, or the feature named by the symbol. All remain externally
meaningful or compatibility-visible for 10.1.2.

| Defining file | Names | Classification / strategy |
|---|---|---|
| `01` | `clearDayAddition`, `clearDisabledDay`, `getDayAddition`, `getDisabledDay`, `getResolvedDays`, `isDayDisabled`, `isVirtualDay`, `mfLifecycleDebug`, `setDayAddition`, `setDisabledDay` | Program/lifecycle API and debug; re-export unchanged. |
| `02` | `mfBuildExerciseProposalFixture`, `mfGenerateOnboardingProgramProposalPreview`, `mfOnboardingCompletionDebug`, `mfOnboardingDebug`, `mfOnboardingProgramProposalApplicationDebug`, `mfOnboardingProgramProposalDebug`, `mfOnboardingProgramProposalReviewDebug`, `mfOnboardingProgramProposalSourceDebug`, `mfOnboardingProgramProposalUndoDebug`, `mfOpenOnboardingPreview`, `mfSaveExerciseProposalFixture`, `p954BuildUndoPlan`, `p954GetApplicationSnapshot`, `p954UndoAppliedProposal` | Onboarding/proposal debug and transaction APIs; retain exact names. |
| `03` | `_exp`, `autoSaveDraft`, `mfApplyDay6Specialization`, `mfDayAdditionDebug`, `mfDayOverrideDebug`, `mfFirstSyncDebug`, `mfFixOrderOverrideIntegrity`, `mfProgressionAudit`, `mfProgressionDebug`, `mfWorkoutReviewDebug`, `saveDay`, `updateSaveBtn` | Export buffer, save hooks, migration/debug surface; keep global. |
| `04` | `_exp`, `getProgramTemplateById`, `getProgramTemplateRegistry`, `mf959RunProgressionSelfTest`, `mf960RunHabitSelfTest`, `mfArchitectureDebug`, `mfArchitecturePrepDebug`, `mfBackupDebug`, `mfDayAdditionDebug`, `mfDayOverrideDebug`, `mfExerciseMetricDebug`, `mfFindKnownExerciseById`, `mfFixOrderOverrideIntegrity`, `mfGenerateOnboardingProgramProposalPreview`, `mfGetActiveBaseProgram`, `mfGetActiveProgramBasis`, `mfHabitDebug`, `mfHabitDefinitionsDebug`, `mfHabitProposalDebug`, `mfLifecycleDebug`, `mfOnboardingCompletionDebug`, `mfOnboardingDebug`, `mfOnboardingProgramProposalApplicationDebug`, `mfOnboardingProgramProposalDebug`, `mfOnboardingProgramProposalReviewDebug`, `mfOnboardingProgramProposalUndoDebug`, `mfOpenOnboardingPreview`, `mfProgramBasisDebug`, `mfProgramTemplateRegistryDebug`, `mfProgressionAudit`, `mfProgressionDebug`, `mfResolvedProgramDebug`, `mfStarterProgramDebug`, `mfUserProfileDebug`, `mfWorkoutReviewDebug`, `p9489BuildSwapCandidateExport`, `p954GetApplicationSnapshot`, `p958ConfirmStarterSelection` | Final aliases, debug/self-tests, starter API, export diagnostic; preserve final effective binding. |
| `05` | `_exp`, `mfBasketballDebug` | `_exp` mutation is export integration; debug remains sole production basketball API. |

`window.__mfBasketballTest` is additionally assigned only under the Node-runtime
guard at `05:409-418`; it is test-only and must not leak in the browser.

## Cross-file internal globals (complete static inventory)

Each listed name is defined at top level in the named file and referenced in at
least one other production script. Constants/variables are values; names
beginning with a verb or phase prefix are functions unless noted above. Direct
consumers are later files, except that `01` also calls state/functions declared
later at user-interaction time—a legal classic-script dependency after all
deferred scripts have evaluated. These names may become internal only when all
consumers move together and a compatibility alias remains where required.

### Defined in `01-core-data.js` (54)

`APP_VERSION`, `clearDayAddition`, `clearDayOverride`, `DAY_ADDITION_FIELDS`,
`DAY_OVERRIDE_FIELDS`, `exAddCustom`, `exArchiveId`, `exCheckSyncAction`,
`exClassifyChange`, `exFindActiveByName`, `exFindArchivedByName`,
`exFindReplacementForSource`, `exGenNewId`, `exInitLifecycle`,
`exLifecycleDefault`, `exNormName`, `exReactivateId`, `getDayAddition`,
`getDayOverride`, `getDisabledDayCount`, `getEffectiveDayMeta`, `getF`,
`getLifecycle`, `getOvr`, `getRecs`, `getResolvedDays`, `getResolvedProgram`,
`getSafeDayDisplayName`, `getSafeDayForLog`, `HABITS`, `initHabitState`,
`isDayDisabled`, `isVirtualDay`, `LIFECYCLE_KEY`, `LIFECYCLE_SCHEMA`,
`LIFECYCLE_VERSION`, `mfRenderLifecycleHealth`, `mfRunPostRestoreValidation`,
`mfUpdateExportWarningBanner`, `OVR`, `P`, `RECS_KEY`, `recsInitMigrate`,
`renderHabits`, `renderWoRecs`, `resetOvr`, `saveLifecycle`, `setDayAddition`,
`setDayOverride`, `setOvr`, `setRecsForDay`, `toggleHabitDone`,
`toggleHabitOpen`, `updateHabitNote`.

### Defined in `02-state-personalization.js` (56)

`AI_PREFS_KEY`, `AI_PREFS_STARTER_TEMPLATE`, `clearDraft`, `DRAFT_KEY`,
`getDraft`, `gym`, `habitState`, `mfOnboardingCompletionDebug`,
`mfOnboardingDebug`, `mfOnboardingProgramProposalSourceDebug`,
`mfOnboardingProgramProposalUndoDebug`, `ONBOARDING_KEY`,
`p950BuildUserProfileExport`, `p950FormatHeight`, `p950GetDefaultUserProfile`,
`p950GetUserProfile`, `p950InitUserProfile`, `p950NormalizeUserProfile`,
`p950RenderUserProfile`, `p950ResetUserProfileDefaults`, `p950SaveUserProfile`,
`p950SaveUserProfileFromUI`, `p951GetDefaultOnboardingState`,
`p951GetMeaningfulDataEvidence`, `p951GetOnboardingState`,
`p951HasMeaningfulExistingData`, `p951InitOnboardingState`, `p951IsFreshInstall`,
`p951IsSystemSeededLifecycleBaseline`, `p951NormalizeOnboardingState`,
`p951SaveOnboardingState`, `p952InitAutoShow`, `P953_GEN_END`, `P953_GEN_START`,
`p954ApplyProposal`, `p954BuildApplicationPlan`, `p954BuildProgramProposal`,
`p954BuildUndoPlan`, `p954GenerateAndSaveProposal`, `p954GetApplicationSnapshot`,
`p954GetDefaultProposal`, `p954GetProposal`, `p954NormalizeProposal`,
`p954RenderProgramPersonalization`, `p954UndoAppliedProposal`,
`p954ValidateProgramProposal`, `p955BuildProposalSourceContext`,
`p955FormatProposalActionCounts`, `p955GetProposalQualityMetrics`,
`p9GetCoachPrefs`, `p9RenderCoachPrefs`, `PROGRAM_PROPOSAL_KEY`, `saveDraft`,
`starterProgramStateReady`, `todayStr`, `USER_PROFILE_KEY`.

### Defined in `03-interactions-sync.js` (55)

`applyStateToForm`, `applySync`, `autoSaveDraft`, `buildLogSection`, `dKey`,
`genExport`, `getTodayWoData`, `loadDay`, `mfApplyDay6Specialization`,
`mfDayAdditionDebug`, `mfDayOverrideDebug`, `mfFirstSyncDebug`,
`mfFixOrderOverrideIntegrity`, `mfProgressionAudit`, `mfProgressionDebug`,
`mfWorkoutReviewDebug`, `p5FormatLastSets`, `p5ParseRepRange`, `p5ParseRir`,
`p7ApplyFilters`, `p7CalcAnalytics`, `p7FilterState`, `p7RenderAnalytics`,
`p85ConfirmFutureSave`, `p85ExecuteSave`, `p945RenderDiag`,
`p9489AnalyzeExerciseRotation`, `p9489BuildSwapCandidateExport`,
`p9489FormatSwapCandidateSection`, `p9489GetRecentExerciseSignals`,
`p949BuildWorkoutReview`, `p949GetPriorHistory`, `p949HideReview`,
`p949RenderReview`, `p955BuildProposalExport`, `p957BuildFirstSyncExport`,
`p957GetSharedUserFirstSyncStatus`, `p9BadgeHTML`, `p9BuildProgressionExport`,
`p9BuildSuggestion`, `p9GetBestExercisePerformance`, `p9GetExerciseHistory`,
`p9GetProgressionStatus`, `p9GetTargetLoadRangeForExercise`,
`p9GetTopActualLoad`, `p9IsCardio`, `p9ParseLoad`, `populateWoDaySelect`,
`renderHistoryFromEntries`, `renderProgram`, `renderWoExercises`, `saveDay`,
`setTog`, `updateExportMeta`, `updateTrackerDate`.

### Defined in `04-backup-boot.js` (10)

`p8492FormatSummaryLines`, `p8492SummarizeBackup`, `p8IsMarcusFitKey`,
`p8ShowResult`, `p8ValidateBackup`, `p9510HistoryOutcome`,
`p958RenderProgramSetupState`, `p958ShouldShowProgramSetupState`,
`p960ValidateStoredHabitData`, `showScreen`.

The absence of `05` names here is intentional: basketball is enclosed in an
IIFE. Its integration is by capturing and reassigning earlier globals, not by
exporting its private helpers.
