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

