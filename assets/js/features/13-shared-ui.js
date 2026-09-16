// ── MARCUSFIT 10.10.0: LOCAL SVG ICON PRESENTATION ──────────────────────────
const MF_ICON_NAMESPACE="http://www.w3.org/2000/svg";
function mfIcon(name,className){
  if(typeof document.createElementNS!=="function"){const fallback=document.createElement("span");fallback.className="mf-icon-fallback";fallback.setAttribute("aria-hidden","true");return fallback;}
  const svg=document.createElementNS(MF_ICON_NAMESPACE,"svg"),use=document.createElementNS(MF_ICON_NAMESPACE,"use");
  svg.setAttribute("class","mf-icon"+(className?" "+className:""));svg.setAttribute("aria-hidden","true");svg.setAttribute("focusable","false");
  use.setAttribute("href","#mf-icon-"+name);svg.appendChild(use);return svg;
}
function mfIconMarkup(name,className){return '<svg class="mf-icon'+(className?' '+className:'')+'" aria-hidden="true" focusable="false"><use href="#mf-icon-'+name+'"></use></svg>';}
function mfSetIconLabel(element,name,label,className){
  if(!element)return;if(typeof element.replaceChildren!=="function"||typeof document.createElementNS!=="function"){element.textContent=label;return;}element.replaceChildren(mfIcon(name,className),document.createTextNode(label));element.classList.add("mf-icon-label");
}
function mfHabitDisplayName(rawName){
  const raw=String(rawName==null?"":rawName),display=raw.replace(/^(?:\s*(?:\p{Extended_Pictographic}(?:[\uFE0E\uFE0F]|\p{Emoji_Modifier})*(?:\u200D\p{Extended_Pictographic}(?:[\uFE0E\uFE0F]|\p{Emoji_Modifier})*)*)\s*)+/u,"");
  return display.trim()?display:"Habit";
}
const MF_HABIT_ICON_OPTIONS=Object.freeze([
  {token:"check-circle",label:"General",ariaLabel:"General / Check Habit icon"},
  {token:"bolt",label:"Energy",ariaLabel:"Performance / Energy Habit icon"},
  {token:"water",label:"Water",ariaLabel:"Water / Hydration Habit icon"},
  {token:"brain",label:"Focus",ariaLabel:"Mind / Focus Habit icon"},
  {token:"dumbbell",label:"Strength",ariaLabel:"Strength / Training Habit icon"},
  {token:"activity",label:"Activity",ariaLabel:"Activity / Movement Habit icon"},
  {token:"moon",label:"Recovery",ariaLabel:"Recovery / Sleep Habit icon"},
  {token:"target",label:"Target",ariaLabel:"Goal / Target Habit icon"},
  {token:"fire",label:"Streak",ariaLabel:"Effort / Streak Habit icon"}
]);
const MF_HABIT_ICON_TOKENS=Object.freeze(MF_HABIT_ICON_OPTIONS.map(function(option){return option.token;}));
const MF_HABIT_ID_ICONS=Object.freeze({"habit-water":"water","habit-bm":"activity","habit-steps":"activity","habit-box-breathing":"activity","habit-jaw-posture":"check-circle","habit-desk-posture":"activity","habit-kegel":"dumbbell"});
const MF_HABIT_LEGACY_ICONS=Object.freeze({"\u2713":"check-circle","\u2705":"check-circle","\ud83d\udca7":"water","\ud83e\udde0":"brain","\ud83d\udcaa":"dumbbell","\ud83d\udeb6":"activity","\ud83d\udc5f":"activity","\ud83c\udf2c":"activity","\ud83e\ude91":"activity","\ud83e\uddb7":"check-circle","\ud83d\udebd":"activity","\u26a1":"bolt","\ud83c\udf19":"moon","\ud83c\udfaf":"target","\ud83d\udd25":"fire"});
function mfHabitStoredIconToken(value){const token=String(value==null?"":value).trim();return MF_HABIT_ICON_TOKENS.includes(token)?token:null;}
function mfHabitIconName(habitOrId){
  const habit=habitOrId&&typeof habitOrId==="object"?habitOrId:null,id=String(habit?habit.id||"":habitOrId||""),stored=habit?mfHabitStoredIconToken(habit.icon):null;
  return stored||MF_HABIT_ID_ICONS[id]||"check-circle";
}
function mfHabitEditorIconName(habit){
  const stored=mfHabitStoredIconToken(habit&&habit.icon),legacy=String(habit&&habit.icon||"").trim().replace(/\uFE0F/g,"");
  return stored||MF_HABIT_LEGACY_ICONS[legacy]||mfHabitIconName(habit);
}
function mfAdaptCoreSyncOwnedStatusText(value){
  const text=String(value==null?"":value),rawMarker="\nRaw content detected:\n",rawIndex=text.indexOf(rawMarker),ownedText=rawIndex<0?text:text.slice(0,rawIndex+rawMarker.length),rawTail=rawIndex<0?"":text.slice(rawIndex+rawMarker.length);
  const rules=[
    /^\u274c (?=(?:No MARCUSFIT_UPDATE block found\.|Found MARCUSFIT_UPDATE_(?:END|START) but missing |Could not extract content between markers\.|JSON parse error: |Expected a JSON array \[ \.\.\. \] between the markers, got ))/,
    /^\u2139\ufe0f (?=(?:Sync block contained an empty array|All entries processed|reorder \(|day_override_clear \(|day_addition_clear \(|.+ already (?:active on |exists as replacement for )))/,
    /^\u26a0 (?=(?:recommendations \(|reorder \(|Archived exercise not found: ))/,
    /^\u2713 (?=(?:Recommendations set for |Reordered |Day override (?:cleared|set): |Virtual day (?:cleared|created|updated): |Archived .+ reactivated|Replacement link created$|.+ (?:added to |archived(?:$| \()|created \(ID: )))/,
    /^\ud83d\udd00 (?=\d+ days? reordered$)/,
    /^\ud83d\udcac (?=\d+ recommendation sets? applied$)/,
    /^\ud83c\udff7\ufe0f (?=\d+ day overrides? applied$)/,
    /^\ud83d\uddd1\ufe0f\ud83d\udcc5 (?=\d+ virtual days? cleared$)/,
    /^\ud83d\uddd1\ufe0f (?=\d+ day overrides? cleared$)/,
    /^\u2795\ud83d\udcc5 (?=\d+ virtual days? set$)/,
    /^\u2795\ud83d\udcaa (?=\d+ custom exercises? added$)/,
    /^\u2705 (?=\d+ exercises? updated$)/,
    /^\u2795 (?=\d+ exercises? added$)/,
    /^\ud83e\udde0 (?=\d+ habits? updated$)/,
    /^\u26a0\ufe0f (?=Skipped \(\d+\):$)/
  ];
  const adapted=ownedText.split("\n").map(function(line){for(let i=0;i<rules.length;i++){if(rules[i].test(line))return line.replace(rules[i],"");}return line;}).join("\n");
  return adapted+rawTail;
}
function mfAdaptCoreSyncResultPresentation(element){
  if(!element||typeof document.createTreeWalker!=="function")return;const walker=document.createTreeWalker(element,4);let node;
  while((node=walker.nextNode())){const adapted=mfAdaptCoreSyncOwnedStatusText(node.nodeValue);if(adapted!==node.nodeValue)node.nodeValue=adapted;}
}
function mfInitProtectedUiSanitizers(){
  const syncResult=document.getElementById("syncResult");
  if(!syncResult||typeof MutationObserver!=="function")return;
  new MutationObserver(function(){mfAdaptCoreSyncResultPresentation(syncResult);}).observe(syncResult,{childList:true,subtree:true,characterData:true});
}
const mfLegacyRenderWoRecs=renderWoRecs;
renderWoRecs=function(){
  const result=mfLegacyRenderWoRecs(),section=document.getElementById("woRecsSection");if(!section)return result;
  const title=section.querySelector(".wo-recs-title"),badge=title&&title.querySelector(".recs-ai-badge");
  if(title){title.replaceChildren(mfIcon("bolt","mf-icon-sm"),document.createTextNode("Day Recommendations"));if(badge)title.appendChild(badge);title.classList.add("mf-icon-label");}
  section.querySelectorAll(".wo-rec-icon").forEach(function(icon){icon.replaceChildren(mfIcon("activity"));});return result;
};

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
const MF_SYNC_SECTION_PAGES={coaching:"personalize",program:"personalize",habits:"personalize",profile:"profile",backup:"data",diagnostics:"data"};MF_SYNC_SECTION_PAGES.tracking="profile";MF_SYNC_SECTION_PAGES.basketball="personalize";
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
  mfActiveSyncPage=page;if(!(options&&options.skipScroll)&&typeof window.scrollTo==="function")window.scrollTo(0,0);return true;
}
function mfHandleSyncTabKeydown(event){
  const button=event&&event.currentTarget,page=button&&button.dataset&&button.dataset.mfSyncPageTarget,index=MF_SYNC_PAGES.indexOf(page);if(index<0)return false;
  let next=-1;if(event.key==="ArrowRight")next=(index+1)%MF_SYNC_PAGES.length;else if(event.key==="ArrowLeft")next=(index+MF_SYNC_PAGES.length-1)%MF_SYNC_PAGES.length;else if(event.key==="Home")next=0;else if(event.key==="End")next=MF_SYNC_PAGES.length-1;else return false;
  event.preventDefault();const target=MF_SYNC_PAGES[next];if(!mfSelectSyncPage(target))return false;const selected=document.querySelector('[data-mf-sync-page-target="'+target+'"]');if(selected&&typeof selected.focus==="function")selected.focus();return true;
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
  document.querySelectorAll("[data-mf-sync-page-target]").forEach(function(button){button.addEventListener("click",function(){mfSelectSyncPage(button.dataset.mfSyncPageTarget);});button.addEventListener("keydown",mfHandleSyncTabKeydown);});
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
  mfSelectSyncPage("ai",{force:true,skipScroll:true});
  mfInitProtectedUiSanitizers();
}

mfInitSettingsDisclosures();

// ── PHASE 6: COLLAPSIBLE SECTIONS ───────────────────────────────────────────

function p6Toggle(key){
  const sec=document.getElementById("p6sec-"+key);
  if(sec)sec.classList.toggle("open");
}
document.querySelectorAll("[data-mf-p6-toggle]").forEach(function(header){header.addEventListener("click",function(){p6Toggle(header.dataset.mfP6Toggle);});});

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
    mfSetIconLabel(btn,"edit","UPDATE");
    btn.className="p6-save-btn update-mode";
    status.textContent="Saved";
    status.className="p6-save-status saved";
  } else if(hasDraft){
    mfSetIconLabel(btn,"check","SAVE DAY");
    btn.className="p6-save-btn";
    status.textContent="Draft ●";
    status.className="p6-save-status draft";
  } else {
    mfSetIconLabel(btn,"check","SAVE DAY");
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
        mfSetIconLabel(btn,todayHasSavedEntry()?"edit":"check",todayHasSavedEntry()?"UPDATED!":"SAVED!");
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
