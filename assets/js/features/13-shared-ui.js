// ── MARCUSFIT 10.1.4: SYNC / SETTINGS DISCLOSURES ───────────────────────────
function mfGetSettingsSection(key){
  return document.querySelector('[data-mf-settings-section="'+key+'"]');
}

function mfSettingsHasVisibleCriticalPanel(section){
  if(!section) return false;
  return Array.from(section.querySelectorAll("[data-mf-critical-panel]")).some(function(panel){
    return panel.style.display !== "none";
  });
}

function mfSetSettingsSectionOpen(key, open){
  const section=mfGetSettingsSection(key);
  if(!section)return false;
  if(!open&&mfSettingsHasVisibleCriticalPanel(section)){
    section.classList.add("open");
    const active=Array.from(section.querySelectorAll("[data-mf-critical-panel]")).find(function(panel){return panel.style.display!=="none";});
    if(active)active.scrollIntoView({behavior:"smooth",block:"nearest"});
    return false;
  }
  section.classList.toggle("open",!!open);
  const toggle=section.querySelector("[data-mf-settings-toggle]");
  if(toggle)toggle.setAttribute("aria-expanded",open?"true":"false");
  return true;
}

function mfToggleSettingsSection(key){
  const section=mfGetSettingsSection(key);
  return section?mfSetSettingsSectionOpen(key,!section.classList.contains("open")):false;
}

const MF_SYNC_PAGES=["ai","personalize","profile","data"];
const MF_SYNC_SECTION_PAGES={coaching:"personalize",program:"personalize",habits:"personalize",profile:"profile",backup:"data",diagnostics:"data"};
let mfActiveSyncPage="ai",mfSyncOpened=false;

function mfSyncVisibleCriticalPanel(){
  const page=document.querySelector('.mf-sync-page.active');if(!page)return null;
  return Array.from(page.querySelectorAll("[data-mf-critical-panel]")).find(function(panel){return panel.style.display!=="none";})||null;
}
function mfSelectSyncPage(page,options){
  if(MF_SYNC_PAGES.indexOf(page)<0)return false;
  const critical=mfSyncVisibleCriticalPanel();if(critical&&page!==mfActiveSyncPage&&!(options&&options.force)){critical.tabIndex=-1;if(typeof critical.focus==="function")critical.focus({preventScroll:true});critical.scrollIntoView({behavior:"smooth",block:"nearest"});return false;}
  document.querySelectorAll("[data-mf-sync-page]").forEach(function(section){const selected=section.dataset.mfSyncPage===page;section.hidden=!selected;section.classList.toggle("active",selected);});
  document.querySelectorAll(".mf-sync-nav-btn").forEach(function(button){const selected=button.id==="mfSyncTab"+(page==="ai"?"Ai":page.charAt(0).toUpperCase()+page.slice(1));button.classList.toggle("active",selected);button.setAttribute("aria-selected",selected?"true":"false");button.tabIndex=selected?0:-1;});
  mfActiveSyncPage=page;return true;
}
function mfOnPrimarySyncOpen(){if(!mfSyncOpened){mfSyncOpened=true;mfSelectSyncPage("ai",{force:true});}mfUpdateSyncPendingStatus();}
function mfOpenSettingsSection(key){const page=MF_SYNC_SECTION_PAGES[key];if(page&&!mfSelectSyncPage(page))return false;return mfSetSettingsSectionOpen(key,true);}

function mfUpdateSyncPendingStatus(){
  const program=typeof p954GetProposal==="function"?p954GetProposal():null,habit=typeof p960GetHabitProposal==="function"?p960GetHabitProposal():null,basketball=typeof mfBasketballGetProposal==="function"?mfBasketballGetProposal():null,pending=!!((program&&program.status==="draft")||(habit&&habit.status==="pending")||(basketball&&basketball.status==="pending")),badge=document.getElementById("mfSyncPersonalizePending"),tab=document.getElementById("mfSyncTabPersonalize");if(badge)badge.hidden=!pending;if(tab)tab.classList.toggle("has-pending",pending);return pending;
}

function mfUpdateProgramSettingsStatus(){
  const status=document.getElementById("mfSettingsProgramStatus");
  if(!status||typeof p954GetProposal!=="function")return;
  const proposal=p954GetProposal();
  status.textContent=proposal?("Proposal status: "+proposal.status):"Review lifting program proposals";
  if(proposal&&proposal.status==="draft")mfSetSettingsSectionOpen("program",true);
  mfUpdateSyncPendingStatus();
}

function mfInitSettingsDisclosures(){
  document.querySelectorAll("[data-mf-sync-page-target]").forEach(function(button){button.addEventListener("click",function(){mfSelectSyncPage(button.dataset.mfSyncPageTarget);});});
  document.querySelectorAll("[data-mf-settings-toggle]").forEach(function(toggle){
    toggle.addEventListener("click",function(){mfToggleSettingsSection(toggle.dataset.mfSettingsToggle);});
  });
  const textSize=document.querySelector("[data-mf-text-size-select]");
  if(textSize)textSize.addEventListener("change",p950SetTextSizeFromUI);
  mfUpdateProgramSettingsStatus();
  const proposalContainer=document.getElementById("p954Container");
  if(proposalContainer&&typeof MutationObserver==="function"){
    const observer=new MutationObserver(mfUpdateProgramSettingsStatus);
    observer.observe(proposalContainer,{childList:true,subtree:true,characterData:true});
  }
  ["p960SettingsStatus","mfBasketballProposalStatus"].forEach(function(id){const node=document.getElementById(id);if(node&&typeof MutationObserver==="function")new MutationObserver(mfUpdateSyncPendingStatus).observe(node,{childList:true,subtree:true,characterData:true,attributes:true});});
  mfSelectSyncPage("ai",{force:true});
}

mfInitSettingsDisclosures();

// ── PHASE 6: COLLAPSIBLE SECTIONS ───────────────────────────────────────────

function p6Toggle(key){
  const sec=document.getElementById("p6sec-"+key);
  if(sec)sec.classList.toggle("open");
}

// Metrics badge: weight, sleep, hunger, energy
function p6UpdateMetricsBadge(){
  const weight=document.getElementById("weightIn").value;
  const sleep=document.getElementById("sleepIn").value;
  const mood=document.getElementById("moodSlider").value;
  const hunger=document.getElementById("hungerSlider").value;
  const fields=[weight,sleep,mood,hunger];
  const filled=fields.filter(v=>v&&v!=="").length;
  const badge=document.getElementById("p6badge-metrics");
  if(!badge)return;
  badge.textContent=filled+" / 4";
  badge.className="p6-section-badge"+(filled===4?" done":filled>0?" partial":"");
}

// Workout badge: how many exercises have at least one set entered
function p6UpdateWorkoutBadge(){
  const badge=document.getElementById("p6badge-workout");
  if(!badge)return;
  const dayIdx=document.getElementById("woDaySelect").value;
  if(dayIdx===""){badge.textContent="No day selected";badge.className="p6-section-badge";return;}
  // 9.4.8.3: resolve via getResolvedDays — handles base + virtual days safely
  const resolvedDays = getResolvedDays(logGym);
  const day = resolvedDays.find(d => d._dayIdx === parseInt(dayIdx));
  if(!day){badge.textContent="Day selected";badge.className="p6-section-badge";return;}
  const exercises = day.exercises || [];
  const total=exercises.length;
  const started=exercises.filter(ex=>{
    const wt=document.querySelector(`input[data-exid="${ex.id}"][data-set="0"][data-field="wt"]`);
    const reps=document.querySelector(`input[data-exid="${ex.id}"][data-set="0"][data-field="reps"]`);
    return (wt&&wt.value)||(reps&&reps.value);
  }).length;
  badge.textContent=started+"/"+total+" exercises";
  badge.className="p6-section-badge"+(started===total?" done":started>0?" partial":"");
  // Highlight blocks that have data
  exercises.forEach(ex=>{
    const wts=[...document.querySelectorAll(`input[data-exid="${ex.id}"][data-field="wt"]`)];
    if(!wts.length)return;
    const parent=wts[0].closest(".wo-ex-block");
    if(!parent)return;
    parent.classList.toggle("has-data",wts.some(i=>i.value));
  });
}

function p6UpdateNotesBadge(){
  const val=document.getElementById("dayNotes").value.trim();
  const badge=document.getElementById("p6badge-notes");
  if(!badge)return;
  if(!val){badge.textContent="Empty";badge.className="p6-section-badge";}
  else{
    const words=val.split(/\s+/).filter(Boolean).length;
    badge.textContent=words+" word"+(words!==1?"s":"");
    badge.className="p6-section-badge partial";
  }
}

// ── PHASE 6: STICKY SAVE BAR ────────────────────────────────────────────────

function p6UpdateStickyBar(){
  const btn=document.getElementById("p6SaveBtn");
  const status=document.getElementById("p6SaveStatus");
  if(!btn||!status)return;
  const hasEntry=todayHasSavedEntry();
  const hasDraft=!!getDraft();
  if(hasEntry){
    btn.innerHTML="&#9998;&#65039; UPDATE";
    btn.className="p6-save-btn update-mode";
    status.textContent="Saved ✓";
    status.className="p6-save-status saved";
  } else if(hasDraft){
    btn.innerHTML="&#9989; SAVE DAY";
    btn.className="p6-save-btn";
    status.textContent="Draft ●";
    status.className="p6-save-status draft";
  } else {
    btn.innerHTML="&#9989; SAVE DAY";
    btn.className="p6-save-btn";
    status.textContent="Unsaved";
    status.className="p6-save-status";
  }
}

// Auto-expand workout section when a day is selected; update badge after render
document.addEventListener("change",e=>{
  if(e.target.id==="woDaySelect"){
    const sec=document.getElementById("p6sec-workout");
    if(sec&&e.target.value!=="")sec.classList.add("open");
    setTimeout(p6UpdateWorkoutBadge,50);
  }
  if(e.target.matches(".wo-set-rir"))p6UpdateWorkoutBadge();
});

// Initial badge updates on load
window.addEventListener("load",()=>{
  setTimeout(()=>{
    p6UpdateMetricsBadge();
    p6UpdateWorkoutBadge();
    p6UpdateNotesBadge();
    p6UpdateStickyBar();
  },150);
});

// Wire up live badge updates for set fields and metrics
document.addEventListener("input",e=>{
  if(e.target.matches(".wo-set-wt,.wo-set-reps"))p6UpdateWorkoutBadge();
  if(e.target.matches(".t-input"))p6UpdateMetricsBadge();
  if(e.target.id==="dayNotes")p6UpdateNotesBadge();
  if(e.target.matches(".mood-slider"))p6UpdateMetricsBadge();
  // Always update sticky bar status on any input
  p6UpdateStickyBar();
});

// Hook renderWoExercises to also update the workout badge after it fires
// We do this via a MutationObserver on the exercise log container
window.addEventListener("load",()=>{
  const logEl=document.getElementById("woExerciseLog");
  if(logEl){
    const obs=new MutationObserver(()=>{setTimeout(p6UpdateWorkoutBadge,30);});
    obs.observe(logEl,{childList:true,subtree:false});
  }
  // Patch saveDay saveBtn click to update sticky
  const originalSaveDay=saveDay;
  window.saveDay=function(){
    originalSaveDay();
    setTimeout(()=>{
      p6UpdateStickyBar();
      p6UpdateWorkoutBadge();
      p6UpdateMetricsBadge();
      // Refresh analytics if visible
      if(document.getElementById("screen-analytics").classList.contains("active"))p7RenderAnalytics();
      const btn=document.getElementById("p6SaveBtn");
      if(btn){
        btn.innerHTML=todayHasSavedEntry()?"&#9998;&#65039; UPDATED!":"&#9989; SAVED!";
        setTimeout(p6UpdateStickyBar,1800);
      }
    },60);
  };
  // Patch autoSaveDraft
  const originalAutoSave=autoSaveDraft;
  window.autoSaveDraft=function(){
    originalAutoSave();
    p6UpdateStickyBar();
  };
  // Patch updateSaveBtn
  const originalUpdateSave=updateSaveBtn;
  window.updateSaveBtn=function(){
    originalUpdateSave();
    p6UpdateStickyBar();
  };
});

// ── END PHASE 6 ──────────────────────────────────────────────────────────────
