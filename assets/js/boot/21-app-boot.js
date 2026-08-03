function showScreen(n){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
  document.getElementById("screen-"+n).classList.add("active");document.getElementById("tab-"+n).classList.add("active");
  document.getElementById("gymRow").classList.toggle("visible",n==="program");
  if(n==="program"){renderProgram();}
  if(n==="history"){p7ApplyFilters();}
  if(n==="analytics"){p7RenderAnalytics();}
  if(n==="export"){updateExportMeta();mfRenderLifecycleHealth();p9RenderCoachPrefs();p950RenderUserProfile();p954RenderProgramPersonalization();const ds=document.getElementById("p945DiagSection");if(ds&&ds.classList.contains("open"))p945RenderDiag();}
}
// 9.4.8.8: populate the coaching preferences textarea at load in case the
// export screen becomes active without a showScreen() transition.
p9RenderCoachPrefs();
// 9.5.0: initialize/migrate the user profile early in the load sequence, then
// populate the Sync-tab profile card in case the export screen becomes
// active without a showScreen() transition.
p950InitUserProfile();
p950RenderUserProfile();
// 9.5.1: initialize/migrate onboarding state early in the load sequence.
// Storage-only — never opens any UI, never touches mf-user-profile.
p951InitOnboardingState();
// 9.5.2: after existing app render/init above has run, show the onboarding
// overlay only if the persisted state (source of truth) is "not_started" or
// "in_progress". Existing installs ("completed"/"skipped") never see it, and
// the overlay stays hidden by default (CSS) until this check runs, so there
// is no flash.
p952InitAutoShow();
// 9.5.4: populate the Sync-tab Program Personalization card in case the
// export screen becomes active without a showScreen() transition. Read-only
// render — never generates or clears a proposal on its own.
p954RenderProgramPersonalization();
// 9.5.8.4: This is the existing synchronous initialization completion point.
// Release the transient Program guard only after all starter inputs are ready,
// then render once through the same guarded path used by gym switching.
starterProgramStateReady=true;
renderProgram();
p9510RenderZepbound();
