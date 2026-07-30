let _draftToastTimer=null;
function showDraftToast(){
  const el=document.getElementById("draftToast");
  if(!el)return;
  const t=new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
  el.textContent=`\u{1F4BE} Draft saved ${t}`;
  el.classList.add("show");
  clearTimeout(_draftToastTimer);
  _draftToastTimer=setTimeout(()=>el.classList.remove("show"),2200);
}

// Collect ALL current form state into a draft object
function collectDraftState(){
  const dayIdx=document.getElementById("woDaySelect").value;
  const woData=collectWoData();
  return {
    date: tDate.toISOString().slice(0,10),
    weight: document.getElementById("weightIn").value,
    sleep: document.getElementById("sleepIn").value,
    protein: document.getElementById("proteinIn").value,
    water: document.getElementById("waterIn").value,
    bm: toggleStates.bm,
    bmNotes: document.getElementById("bmNotes").value,
    mood: document.getElementById("moodSlider").value,
    hunger: document.getElementById("hungerSlider").value,
    workout: toggleStates.wo,
    zep: toggleStates.zep,
    logGym,
    woDayIdx: dayIdx,
    notes: document.getElementById("dayNotes").value,
    habits: JSON.parse(JSON.stringify(habitState)),
    woData: woData || null
  };
}

// Auto-save draft (only for today's date — don't draft past/future days)
let _autoSaveTimer=null;
function autoSaveDraft(){
  if(!isTodaySelected()) return; // only draft current day
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer=setTimeout(()=>{
    const draft=collectDraftState();
    saveDraft(draft);
    showDraftToast();
  }, 600); // 600ms debounce — responsive but not hammering storage
}

function isTodaySelected(){
  return tDate.toISOString().slice(0,10)===todayStr();
}

// Check if today already has a saved history entry
function todayHasSavedEntry(){
  return !!localStorage.getItem(dKey(tDate));
}

// Update save button label based on whether entry exists
function updateSaveBtn(){
  const btn=document.getElementById("saveBtn");
  if(!btn)return;
  if(todayHasSavedEntry()){
    btn.textContent="\u270F\uFE0F UPDATE DAY";
    btn.style.background="var(--accent2)";
  } else {
    btn.textContent="\u2705 SAVE DAY";
    btn.style.background="var(--green)";
  }
}

// Apply a draft or saved-day object to the form
function applyStateToForm(d){
  if(!d) return;
  // v9.4.4 Bug 4: always clear workout log before applying any new state
  const logEl=document.getElementById("woExerciseLog");
  if(logEl) logEl.innerHTML="";
  document.getElementById("weightIn").value=d.weight||"";
  document.getElementById("weightHero").textContent=d.weight||"\u2014";
  document.getElementById("sleepIn").value=d.sleep||"";
  document.getElementById("proteinIn").value=d.protein||"";
  document.getElementById("waterIn").value=d.water||"";
  document.getElementById("bmNotes").value=d.bmNotes||"";
  document.getElementById("moodSlider").value=d.mood||5;
  document.getElementById("moodNum").textContent=d.mood||5;
  document.getElementById("hungerSlider").value=d.hunger||5;
  document.getElementById("hungerNum").textContent=d.hunger||5;
  document.getElementById("dayNotes").value=d.notes||"";
  toggleStates={bm:d.bm||null,wo:d.workout||null,zep:d.zep||null};
  ["bm-yes","bm-no","zep-yes","zep-no","wo-yes","wo-no","wo-rest"].forEach(id=>{const el=document.getElementById(id);if(el)el.className="tog-btn";});
  if(d.bm)setTog("bm",d.bm);
  if(d.zep)setTog("zep",d.zep);
  if(d.workout)setWO(d.workout);
  habitState=d.habits?JSON.parse(JSON.stringify(d.habits)):initHabitState();
  renderHabits();
  if(d.logGym){
    logGym=d.logGym;
    document.querySelectorAll(".log-gym-btn").forEach(b=>b.classList.remove("active"));
    const lgbtn=document.getElementById("lgbtn-"+logGym);if(lgbtn)lgbtn.classList.add("active");
    populateWoDaySelect();
  }
  if(d.woDayIdx!==undefined&&d.woDayIdx!==""){
    document.getElementById("woDaySelect").value=d.woDayIdx;
    renderWoExercises();
    // Restore workout set data from draft's woData (overrides -wo localStorage)
    if(d.woData&&d.woData.exercises){
      restoreWoDataToForm(d.woData);
    }
  } else {
    // v9.4.4 Bug 4: no saved day selection — reset selector and show blank state
    const sel=document.getElementById("woDaySelect");
    if(sel) sel.value="";
    const noteEl=document.getElementById("woDayNoteOut");
    if(noteEl) noteEl.textContent="";
    if(logEl) logEl.innerHTML='<div class="no-workout-msg">Select the day you trained above to log your sets.</div>';
  }
}

// After renderWoExercises, re-apply saved set values from a woData object
function restoreWoDataToForm(woData){
  if(!woData||!woData.exercises)return;
  Object.entries(woData.exercises).forEach(([exId,exLog])=>{
    (exLog.sets||[]).forEach((s,i)=>{
      const wt=document.querySelector(`input[data-exid="${exId}"][data-set="${i}"][data-field="wt"]`);
      const reps=document.querySelector(`input[data-exid="${exId}"][data-set="${i}"][data-field="reps"]`);
      const rir=document.querySelector(`select[data-exid="${exId}"][data-set="${i}"][data-field="rir"]`);
      if(wt&&s.wt)wt.value=s.wt;
      if(reps&&s.reps)reps.value=s.reps;
      if(rir&&s.rir)rir.value=s.rir;
    });
    const noteEl=document.querySelector(`input[data-exid="${exId}"][data-field="exnote"]`);
    if(noteEl&&exLog.note)noteEl.value=exLog.note;
  });
}

// Wire auto-save to all inputs in the log screen
function wireAutoSave(){
  const log=document.getElementById("screen-log");
  if(!log)return;
  log.addEventListener("input",e=>{
    if(e.target.matches(".t-input,.notes-ta,.wo-set-wt,.wo-set-reps,.wo-note-input,.habit-note-input"))autoSaveDraft();
  });
  log.addEventListener("change",e=>{
    if(e.target.matches(".wo-set-rir,.wo-day-select,.mood-slider"))autoSaveDraft();
  });
}

// Resume banner — shown when a draft exists for today and today has no saved entry
function checkResumeBanner(){
  const banner=document.getElementById("resumeBanner");
  if(!banner)return;
  const draft=getDraft();
  if(!draft)return;
  if(draft.date!==todayStr()){clearDraft();return;} // stale draft from another day
  if(todayHasSavedEntry()){
    // Already saved today — silently discard the draft (no need to resume)
    clearDraft();
    return;
  }
  // There's a draft for today and no saved entry — show resume banner
  banner.classList.add("visible");
}

function resumeDraft(){
  const draft=getDraft();
  document.getElementById("resumeBanner").classList.remove("visible");
  if(draft){applyStateToForm(draft);}
  updateSaveBtn();
}

function dismissDraft(){
  clearDraft();
  document.getElementById("resumeBanner").classList.remove("visible");
  // Clear all fields to blank state
  applyStateToForm({});
  updateSaveBtn();
}
// ── END DRAFT SYSTEM ────────────────────────────────────────────────────────

window.addEventListener("load",()=>{
  document.getElementById("headerDate").textContent=new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  // Phase 9B: Initialize exercise lifecycle state (safe for existing users)
  exInitLifecycle();
  // Phase 9.4: Initialize recommendation store (safe for existing users — no-op if already present)
  recsInitMigrate();
  // Phase 9.4.7: Apply Day 6 Shoulders & Arms Specialization (idempotent — safe on every load)
  mfApplyDay6Specialization();
  // Phase 9.4.8.2.1: Order Override Integrity Fix (idempotent — safe on every load)
  mfFixOrderOverrideIntegrity();
  // Feature 4: Auto-correct extreme future dates
  if(p85DaysFromToday(tDate) > 30){
    tDate = new Date();
    console.log("[MarcusFit] Future date reset to today");
    // Show a brief message in the future date warning div
    const warn=document.getElementById("futureDateWarning");
    if(warn){warn.style.display="block";warn.textContent="📅 Future date reset to today.";}
  }
  renderProgram();
  updateTrackerDate();
  populateWoDaySelect();
  wireAutoSave();
  checkResumeBanner();
  updateExportMeta();
  p7WireFilters();
});

function setGym(g){gym=g;document.querySelectorAll(".gym-btn").forEach(b=>b.classList.remove("active"));document.getElementById("gbtn-"+g).classList.add("active");renderProgram();}
function setLogGym(g){logGym=g;document.querySelectorAll(".log-gym-btn").forEach(b=>b.classList.remove("active"));document.getElementById("lgbtn-"+g).classList.add("active");populateWoDaySelect();autoSaveDraft();p949HideReview();}

function renderProgram(){
  // 9.5.8.4: An implicit program basis resolves to Marcus's legacy program.
  // Never allow that fallback to render while starter eligibility is unknown.
  if(!starterProgramStateReady){
    const title=document.getElementById("program-title");
    const container=document.getElementById("program-days");
    if(title)title.textContent="PROGRAM";
    if(container)container.innerHTML="";
    return;
  }
  // 9.5.8.3: Guard fresh users before any gym-specific title or program data
  // is read. The setup renderer owns and neutralizes the complete Program UI.
  if(typeof p958ShouldShowProgramSetupState==="function"&&p958ShouldShowProgramSetupState()){
    p958RenderProgramSetupState();
    return;
  }
  const labels={home:"HOME PROGRAM",partial:"TRANSITION GYM PROGRAM"};
  document.getElementById("program-title").textContent=labels[gym];
  const c=document.getElementById("program-days");c.innerHTML="";
  // 9.5.4C: proposal-disabled days are hidden from the normal active-program
  // list (not deleted — see disabledDays lifecycle structure). Filtering
  // does not renumber: each remaining day keeps its original _dayIdx.
  const resolvedDays = getResolvedDays(gym).filter(day => !isDayDisabled(gym, day._dayIdx));
  resolvedDays.forEach((day, listIdx)=>{
    const di = day._dayIdx !== undefined ? day._dayIdx : listIdx;
    const isVirtual = !!day._isVirtual;
    const eday=getEffectiveDayMeta(gym,di,day);
    const cardColor = day.color || "var(--accent)";
    const card=document.createElement("div");card.className="day-card";card.id="dc-"+di;card.style.setProperty("--card-color",cardColor);

    let exHTML;
    if(isVirtual){
      // Virtual day: render custom exercises if any exist; show empty state if none
      if(day.exercises && day.exercises.length > 0){
        exHTML = day.exercises.map(ex=>{
          const nm=getF(ex.id,"name",ex.name),ld=getF(ex.id,"load",ex.load||""),ri=getF(ex.id,"rir",ex.rir||""),st=getF(ex.id,"sets",ex.sets||"3"),rp=getF(ex.id,"reps",ex.reps||""),bl=getF(ex.id,"blurb",ex.blurb||"");
          const isEd=getOvr()[ex.id];
          return `<div class="ex-item" id="exitem-${ex.id}">
            <div class="ex-header"><div class="ex-name" id="exname-${ex.id}">${nm}</div><button class="edit-btn${isEd?" active":""}" id="editbtn-${ex.id}" onclick="toggleEditor('${ex.id}')">&#9998; Edit</button></div>
            <div class="ex-tags"><span class="ex-tag" id="extag-sets-${ex.id}">${st}×${rp}</span>${ld?`<span class="ex-tag load" id="extag-load-${ex.id}">&#127919; ${ld}</span>`:""}${ri?`<span class="ex-tag rir-tag" id="extag-rir-${ex.id}">RIR ${ri}</span>`:""}</div>
            ${bl?`<div class="ex-blurb" id="exblurb-${ex.id}">→ ${bl}</div>`:""}
            <div class="ex-editor" id="editor-${ex.id}"><div class="editor-title">&#9998; Edit Exercise</div><div class="editor-row"><span class="editor-label">Name</span><input class="editor-input full" id="ed-name-${ex.id}" type="text" value="${nm}"></div><div class="editor-row"><span class="editor-label">Load</span><input class="editor-input" id="ed-load-${ex.id}" type="text" value="${ld}"></div><div class="editor-row"><span class="editor-label">Sets</span><input class="editor-input" id="ed-sets-${ex.id}" type="text" value="${st}" style="width:60px;"><span class="editor-label" style="text-align:center;">Reps</span><input class="editor-input" id="ed-reps-${ex.id}" type="text" value="${rp}"></div><div class="editor-row"><span class="editor-label">RIR</span><input class="editor-input" id="ed-rir-${ex.id}" type="text" value="${ri}" style="width:80px;"></div><div class="editor-row"><span class="editor-label">Note</span><input class="editor-input full" id="ed-blurb-${ex.id}" type="text" value="${bl}"></div><div class="editor-btn-row"><button class="editor-save" onclick="saveEdit('${ex.id}')">&#128190; SAVE</button><button class="editor-cancel" onclick="toggleEditor('${ex.id}')">Cancel</button><button class="editor-reset" onclick="resetEdit('${ex.id}')">&#8634;</button></div></div>
          </div>`;
        }).join("");
      } else {
        exHTML = `<div style="padding:12px 0;font-size:12px;color:var(--muted);font-style:italic;">No exercises added to this virtual day yet.</div>`;
      }
      // 9.4.8.7: Add Exercise action for virtual/additive days — uses the existing
      // customExercises lifecycle system via exAddCustom(). Never mutates base P.
      const addFormId = `addexform-${gym}-${di}`;
      exHTML += `<button class="add-ex-btn" id="addexbtn-${gym}-${di}" onclick="toggleAddExerciseForm('${gym}',${di})">&#10133; Add Exercise</button>
        <div class="ex-editor add-ex-editor" id="${addFormId}">
          <div class="editor-title">&#10133; Add Custom Exercise</div>
          <div class="editor-row"><span class="editor-label">Name</span><input class="editor-input full" id="addex-name-${gym}-${di}" type="text" placeholder="e.g. Cable Crunch"></div>
          <div class="editor-row"><span class="editor-label">Load</span><input class="editor-input" id="addex-load-${gym}-${di}" type="text" placeholder="e.g. moderate cable load"></div>
          <div class="editor-row"><span class="editor-label">Sets</span><input class="editor-input" id="addex-sets-${gym}-${di}" type="text" value="3" style="width:60px;"><span class="editor-label" style="text-align:center;">Reps</span><input class="editor-input" id="addex-reps-${gym}-${di}" type="text" placeholder="e.g. 10-15"></div>
          <div class="editor-row"><span class="editor-label">RIR</span><input class="editor-input" id="addex-rir-${gym}-${di}" type="text" value="2" style="width:80px;"></div>
          <div class="editor-row"><span class="editor-label">Note</span><input class="editor-input full" id="addex-blurb-${gym}-${di}" type="text" placeholder="optional coaching note"></div>
          <div class="editor-btn-row"><button class="editor-save" onclick="saveNewExercise('${gym}',${di})">&#128190; ADD</button><button class="editor-cancel" onclick="toggleAddExerciseForm('${gym}',${di})">Cancel</button></div>
        </div>`;
      // 9.5.4C_1: day-level metadata (day label, name, focus, note, tag) is
      // proposal/override/day-addition-derived and MUST be rendered safely
      // via textContent/DOM creation, never interpolated into innerHTML.
      // The "ADDED DAY" badge text itself is a fixed literal (not derived
      // from user/proposal data) so it's safe as a static child span.
      const header = document.createElement("div");
      header.className = "day-header";
      header.onclick = function(){ togDay(di); };
      const left = document.createElement("div");
      const numDiv = document.createElement("div");
      numDiv.className = "day-num";
      numDiv.appendChild(document.createTextNode(eday.day));
      const badge = document.createElement("span");
      badge.style.cssText = "font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;background:color-mix(in srgb,var(--muted) 15%,transparent);color:var(--muted);padding:2px 7px;border-radius:10px;border:1px solid var(--border);margin-left:6px;";
      badge.textContent = "ADDED DAY";
      numDiv.appendChild(badge);
      left.appendChild(numDiv);
      const nameDiv = document.createElement("div");
      nameDiv.className = "day-name";
      nameDiv.textContent = eday.name;
      left.appendChild(nameDiv);
      const focusDiv = document.createElement("div");
      focusDiv.className = "day-focus";
      focusDiv.textContent = eday.focus || "";
      left.appendChild(focusDiv);
      header.appendChild(left);
      const right = document.createElement("div");
      right.className = "day-right";
      const tagSpan = document.createElement("span");
      tagSpan.className = "day-tag";
      tagSpan.textContent = eday.tag || "added";
      right.appendChild(tagSpan);
      const chevron = document.createElement("span");
      chevron.className = "chevron";
      chevron.innerHTML = "&#9662;"; // static markup entity — not user/proposal-derived
      right.appendChild(chevron);
      header.appendChild(right);
      card.appendChild(header);

      const bodyDiv = document.createElement("div");
      bodyDiv.className = "day-body";
      if(eday.note){
        const noteDiv = document.createElement("div");
        noteDiv.className = "coach-note";
        noteDiv.textContent = eday.note;
        bodyDiv.appendChild(noteDiv);
      }
      card.appendChild(bodyDiv);
      // Exercise-level rendering is unchanged in this correction (out of
      // scope) — appended as markup after the safely-rendered day metadata.
      bodyDiv.insertAdjacentHTML("beforeend", exHTML);
    } else {
      // Base day: original render path
      exHTML=day.exercises.map(ex=>{
        const nm=getF(ex.id,"name",ex.name),ld=getF(ex.id,"load",ex.load),ri=getF(ex.id,"rir",ex.rir),st=getF(ex.id,"sets",ex.sets),rp=getF(ex.id,"reps",ex.reps),bl=getF(ex.id,"blurb",ex.blurb);
        const isEd=getOvr()[ex.id];
        return `<div class="ex-item" id="exitem-${ex.id}">
          <div class="ex-header"><div class="ex-name" id="exname-${ex.id}">${nm}</div><button class="edit-btn${isEd?" active":""}" id="editbtn-${ex.id}" onclick="toggleEditor('${ex.id}')">&#9998; Edit</button></div>
          <div class="ex-tags"><span class="ex-tag" id="extag-sets-${ex.id}">${st}×${rp}</span><span class="ex-tag load" id="extag-load-${ex.id}">&#127919; ${ld}</span><span class="ex-tag rir-tag" id="extag-rir-${ex.id}">RIR ${ri}</span></div>
          ${bl?`<div class="ex-blurb" id="exblurb-${ex.id}">→ ${bl}</div>`:""}
          <div class="ex-editor" id="editor-${ex.id}">
            <div class="editor-title">&#9998; Edit Exercise</div>
            <div class="editor-row"><span class="editor-label">Name</span><input class="editor-input full" id="ed-name-${ex.id}" type="text" value="${nm}"></div>
            <div class="editor-row"><span class="editor-label">Load</span><input class="editor-input" id="ed-load-${ex.id}" type="text" value="${ld}"></div>
            <div class="editor-row"><span class="editor-label">Sets</span><input class="editor-input" id="ed-sets-${ex.id}" type="text" value="${st}" style="width:60px;"><span class="editor-label" style="text-align:center;">Reps</span><input class="editor-input" id="ed-reps-${ex.id}" type="text" value="${rp}"></div>
            <div class="editor-row"><span class="editor-label">RIR</span><input class="editor-input" id="ed-rir-${ex.id}" type="text" value="${ri}" style="width:80px;"></div>
            <div class="editor-row"><span class="editor-label">Note</span><input class="editor-input full" id="ed-blurb-${ex.id}" type="text" value="${bl}"></div>
            <div class="editor-btn-row"><button class="editor-save" onclick="saveEdit('${ex.id}')">&#128190; SAVE</button><button class="editor-cancel" onclick="toggleEditor('${ex.id}')">Cancel</button><button class="editor-reset" onclick="resetEdit('${ex.id}')">&#8634;</button></div>
          </div>
        </div>`;
      }).join("");
      // 9.5.4C_1: render effective day metadata (name/focus/note/tag — may
      // come from a dayOverride, which is proposal-applicable) safely via
      // textContent/DOM creation instead of innerHTML interpolation.
      const header = document.createElement("div");
      header.className = "day-header";
      header.onclick = function(){ togDay(di); };
      const left = document.createElement("div");
      const numDiv = document.createElement("div");
      numDiv.className = "day-num";
      numDiv.textContent = eday.day;
      left.appendChild(numDiv);
      const nameDiv = document.createElement("div");
      nameDiv.className = "day-name";
      nameDiv.textContent = eday.name;
      left.appendChild(nameDiv);
      const focusDiv = document.createElement("div");
      focusDiv.className = "day-focus";
      focusDiv.textContent = eday.focus;
      left.appendChild(focusDiv);
      header.appendChild(left);
      const right = document.createElement("div");
      right.className = "day-right";
      const tagSpan = document.createElement("span");
      tagSpan.className = "day-tag";
      tagSpan.textContent = eday.tag;
      right.appendChild(tagSpan);
      const chevron = document.createElement("span");
      chevron.className = "chevron";
      chevron.innerHTML = "&#9662;"; // static markup entity — not user/proposal-derived
      right.appendChild(chevron);
      header.appendChild(right);
      card.appendChild(header);

      const bodyDiv = document.createElement("div");
      bodyDiv.className = "day-body";
      const noteDiv = document.createElement("div");
      noteDiv.className = "coach-note";
      noteDiv.textContent = eday.note;
      bodyDiv.appendChild(noteDiv);
      card.appendChild(bodyDiv);
      // Exercise-level rendering is unchanged in this correction (out of
      // scope) — appended as markup after the safely-rendered day metadata.
      bodyDiv.insertAdjacentHTML("beforeend", exHTML);
    }
    c.appendChild(card);
  });
}

function togDay(i){document.getElementById("dc-"+i).classList.toggle("open");}
function toggleEditor(id){const ed=document.getElementById("editor-"+id);const btn=document.getElementById("editbtn-"+id);const open=ed.classList.toggle("open");btn.classList.toggle("active",open);if(open)setTimeout(()=>ed.scrollIntoView({behavior:"smooth",block:"nearest"}),100);}
function saveEdit(id){
  const nm=document.getElementById("ed-name-"+id).value.trim(),ld=document.getElementById("ed-load-"+id).value.trim(),st=document.getElementById("ed-sets-"+id).value.trim(),rp=document.getElementById("ed-reps-"+id).value.trim(),ri=document.getElementById("ed-rir-"+id).value.trim(),bl=document.getElementById("ed-blurb-"+id).value.trim();
  if(nm)setOvr(id,"name",nm);if(ld)setOvr(id,"load",ld);if(st)setOvr(id,"sets",st);if(rp)setOvr(id,"reps",rp);if(ri)setOvr(id,"rir",ri);setOvr(id,"blurb",bl);
  document.getElementById("exname-"+id).textContent=nm;
  document.getElementById("extag-sets-"+id).textContent=`${st}×${rp}`;
  document.getElementById("extag-load-"+id).textContent=`&#127919; ${ld}`;
  document.getElementById("extag-rir-"+id).textContent=`RIR ${ri}`;
  const blurb=document.getElementById("exblurb-"+id);if(blurb)blurb.textContent=bl?`→ ${bl}`:"";
  document.getElementById("editbtn-"+id).classList.add("active");
  toggleEditor(id);renderWoExercises();
}
function resetEdit(id){if(!confirm("Reset this exercise to original values?"))return;resetOvr(id);renderProgram();document.querySelectorAll(".day-card").forEach((card,i)=>{if(card.querySelector(`#exitem-${id}`))card.classList.add("open");});}

// ── PHASE 9.4.8.7: VIRTUAL DAY EXERCISE CREATION (UI) ────────────────────────
// Lets the user add a custom exercise to an empty (or populated) virtual/
// additive day directly from the UI. Uses the existing customExercises
// lifecycle system (exAddCustom / exGenNewId) — never mutates base P, never
// creates a duplicate storage system.
function toggleAddExerciseForm(gymKey,dayIdx){
  const form=document.getElementById(`addexform-${gymKey}-${dayIdx}`);
  if(!form)return;
  const open=form.classList.toggle("open");
  if(open)setTimeout(()=>form.scrollIntoView({behavior:"smooth",block:"nearest"}),100);
}
function saveNewExercise(gymKey,dayIdx){
  const nameEl=document.getElementById(`addex-name-${gymKey}-${dayIdx}`);
  const name=(nameEl.value||"").trim();
  if(!name){nameEl.focus();return;}
  const load=document.getElementById(`addex-load-${gymKey}-${dayIdx}`).value.trim();
  const sets=document.getElementById(`addex-sets-${gymKey}-${dayIdx}`).value.trim();
  const reps=document.getElementById(`addex-reps-${gymKey}-${dayIdx}`).value.trim();
  const rir=document.getElementById(`addex-rir-${gymKey}-${dayIdx}`).value.trim();
  const blurb=document.getElementById(`addex-blurb-${gymKey}-${dayIdx}`).value.trim();
  if(typeof isVirtualDay==="function" && !isVirtualDay(gymKey,dayIdx)){
    console.warn("[MarcusFit] saveNewExercise: dayIdx "+dayIdx+" is not a recognized virtual day for "+gymKey);
    return;
  }
  const newId=exGenNewId(gymKey,dayIdx);
  exAddCustom(gymKey,dayIdx,{
    id:newId,
    name,
    sets:sets||3,
    reps:reps||"10",
    load:load||"TBD",
    rir:rir||"2",
    blurb:blurb||""
  });
  renderProgram();
  populateWoDaySelect();
  // Re-open the day card and scroll the new exercise into view
  const card=document.getElementById("dc-"+dayIdx);
  if(card){
    card.classList.add("open");
    setTimeout(()=>{const item=document.getElementById("exitem-"+newId);if(item)item.scrollIntoView({behavior:"smooth",block:"nearest"});},100);
  }
}
// ── END PHASE 9.4.8.7 VIRTUAL DAY EXERCISE CREATION (UI) ─────────────────────

function setTog(key,val){
  toggleStates[key]=val;
  if(key==="bm"){document.getElementById("bm-yes").className="tog-btn"+(val==="yes"?" yes":"");document.getElementById("bm-no").className="tog-btn"+(val==="no"?" no":"");}
  else if(key==="zep"){document.getElementById("zep-yes").className="tog-btn"+(val==="yes"?" yes":"");document.getElementById("zep-no").className="tog-btn"+(val==="no"?" no":"");}
  autoSaveDraft();
}
function setWO(v){toggleStates.wo=v;["yes","no","rest"].forEach(id=>{const b=document.getElementById("wo-"+id);b.className="tog-btn";if(id===v)b.classList.add(v==="rest"?"rest":v==="yes"?"yes":"no");});autoSaveDraft();}

function populateWoDaySelect(){
  const sel=document.getElementById("woDaySelect");
  // 9.5.4C: proposal-disabled days are omitted from the loggable day list
  // (not deleted); original dayIdx values are preserved for any day still shown.
  const resolvedDays = getResolvedDays(logGym).filter(day => !isDayDisabled(logGym, day._dayIdx));
  sel.innerHTML='<option value="">\u2014 Select Day \u2014</option>';
  resolvedDays.forEach((day)=>{
    const di = day._dayIdx !== undefined ? day._dayIdx : resolvedDays.indexOf(day);
    const ed=getEffectiveDayMeta(logGym,di,day); // apply override if set
    const opt=document.createElement("option");opt.value=di;
    opt.textContent=`${ed.day}: ${ed.name}${day._isVirtual?" ✦":""}`;
    sel.appendChild(opt);
  });
  renderWoExercises();
}

// ── PHASE 5: LAST TIME LOOKUP & SUGGESTION ENGINE ────────────────────────────

// Find the most recent SAVED workout entry (not today's draft) that contains exId
function p5GetLastEntry(exId){
  const todayKey = dKey(new Date()); // today's key to skip
  const keys = Object.keys(localStorage)
    .filter(k => k.startsWith("day-") && k.endsWith("-wo") && !k.replace("-wo","").includes("draft"))
    .sort()
    .reverse(); // newest first
  for(const k of keys){
    // Skip today's live key to avoid unfinished draft contaminating "last time"
    if(k.replace("-wo","") === todayKey) continue;
    try{
      const wo = JSON.parse(localStorage.getItem(k)||"{}");
      if(wo.exercises && wo.exercises[exId]){
        const exLog = wo.exercises[exId];
        // v9.4.4 Bug 1: reps must be parseable; weight-only sets are not progression-valid
        const validSets = (exLog.sets||[]).filter(s => !isNaN(parseInt(s.reps)) && parseInt(s.reps) > 0);
        if(validSets.length) return {dateKey:k.replace("-wo",""), exLog, validSets};
        // Check if there were weight-only sets (to show sentinel message)
        const weightOnlySets = (exLog.sets||[]).filter(s => (s.wt||"").trim() && !parseInt(s.reps));
        if(weightOnlySets.length) return {dateKey:k.replace("-wo",""), exLog, validSets:[], weightOnly:true};
      }
    }catch{}
  }
  return null;
}

// Format last-time sets into a readable string
function p5FormatLastSets(validSets){
  // Group by weight — show "70 lb DBs x 10, 10, 9"
  const byWt = {};
  const order = [];
  validSets.forEach(s=>{
    const wt = (s.wt||"").trim()||"—";
    if(!byWt[wt]){byWt[wt]=[];order.push(wt);}
    byWt[wt].push((s.reps||"—").trim());
  });
  const parts = order.map(wt=>{
    const repsStr = byWt[wt].join(", ");
    return wt==="—" ? `× ${repsStr} reps` : `${wt} × ${repsStr}`;
  });
  // RIR: show most common (or range)
  const rirs = validSets.map(s=>(s.rir||"").trim()).filter(r=>r&&r!=="—");
  const rirStr = rirs.length ? ` @ RIR ${[...new Set(rirs)].join("/")}` : "";
  return parts.join(" · ") + rirStr;
}

// Parse a RIR string like "1-2", "2", "3+" into a numeric mid value
function p5ParseRir(str){
  if(!str||str==="—"||str==="N/A") return null;
  str = str.trim();
  if(str.endsWith("+")) return parseFloat(str)+0.5;
  const parts = str.split(/[-–]/);
  if(parts.length===2) return (parseFloat(parts[0])+parseFloat(parts[1]))/2;
  const v = parseFloat(str);
  return isNaN(v)?null:v;
}

// Parse a reps string like "10-12", "12", "10–15" into {lo, hi}
function p5ParseRepRange(str){
  if(!str) return null;
  str = str.trim();
  const parts = str.split(/[-–]/);
  if(parts.length===2){const lo=parseInt(parts[0]),hi=parseInt(parts[1]);if(!isNaN(lo)&&!isNaN(hi))return{lo,hi,mid:(lo+hi)/2};}
  const v=parseInt(str);
  return isNaN(v)?null:{lo:v,hi:v,mid:v};
}

// Generate a suggestion string given last entry + current target
function p5Suggest(validSets, targetRepsStr, targetRirStr){
  // Get last session's actual reps and RIR
  const lastReps = validSets.map(s=>parseInt(s.reps)).filter(n=>!isNaN(n));
  const lastRirs = validSets.map(s=>p5ParseRir(s.rir||"")).filter(n=>n!==null);
  if(!lastReps.length) return {text:"No rep data. Start conservative and find your target RIR.", cls:"neutral"};

  const avgLastReps = lastReps.reduce((a,b)=>a+b,0)/lastReps.length;
  const avgLastRir  = lastRirs.length ? lastRirs.reduce((a,b)=>a+b,0)/lastRirs.length : null;
  const targetReps  = p5ParseRepRange(targetRepsStr);
  const targetRir   = p5ParseRir(targetRirStr);

  // Get last load (most common or first)
  const loadCounts = {};
  validSets.forEach(s=>{const wt=(s.wt||"").trim();if(wt)loadCounts[wt]=(loadCounts[wt]||0)+1;});
  const lastLoad = Object.keys(loadCounts).sort((a,b)=>loadCounts[b]-loadCounts[a])[0]||null;

  // Decision logic
  const atTopOfRange   = targetReps && avgLastReps >= targetReps.hi;
  const aboveRirTarget = targetRir  !== null && avgLastRir !== null && avgLastRir >= targetRir - 0.5;
  const belowRepTarget = targetReps && avgLastReps < targetReps.lo - 1;
  const lowRir         = targetRir  !== null && avgLastRir !== null && avgLastRir < targetRir - 1;

  if(atTopOfRange && aboveRirTarget){
    return {text:`✅ You hit the top of range last time — try bumping load slightly${lastLoad?` up from ${lastLoad}`:""}. If warmups feel off, hold and beat reps.`, cls:"go"};
  } else if(belowRepTarget || lowRir){
    return {text:`⏸ Last session was below target${lowRir?" or RIR was low":""} — hold load${lastLoad?` at ${lastLoad}`:""}. Focus on reps and controlled tempo.`, cls:"hold"};
  } else {
    return {text:`🔁 Solid last session. Match or beat those reps${lastLoad?` at ${lastLoad}`:""}. Progress when top of range hits at target RIR.`, cls:"neutral"};
  }
}

// Build the full p5 HTML block for one exercise
function p5Block(exId, targetRepsStr, targetRirStr){
  const last = p5GetLastEntry(exId);
  // v9.4.4 Bug 1: sentinel — entry exists but only had weight-only sets (no reps)
  if(last && last.weightOnly){
    return `<div class="p9-badge new">NEW</div><div class="p5-hist-wrap" id="p5-${exId}">
      <div class="p5-hist-toggle" onclick="p5Toggle('${exId}')">
        <div class="p5-hist-dot"></div><span class="p5-hist-label">Last Time</span><span class="p5-chevron">▼</span>
      </div>
      <div class="p5-hist-body">
        <div class="p5-last-line">Last entry had weight but no reps — ignored for progression.</div>
        <div class="p9-suggest-line neutral">🆕 Start conservative and find your target RIR.</div>
      </div>
    </div>`;
  }
  // Build Phase 9A badge + enhanced block
  const p9status = p9GetProgressionStatus(exId, last ? last.validSets : null, targetRepsStr, targetRirStr);
  const p9badge  = p9BadgeHTML(p9status);
  if(!last){
    return `${p9badge}<div class="p5-hist-wrap" id="p5-${exId}">
      <div class="p5-hist-toggle" onclick="p5Toggle('${exId}')">
        <div class="p5-hist-dot"></div><span class="p5-hist-label">Last Time</span><span class="p5-chevron">▼</span>
      </div>
      <div class="p5-hist-body">
        <div class="p5-last-line">No previous data for this exercise.</div>
        <div class="p9-suggest-line neutral">🆕 Start conservative and find your target RIR.</div>
      </div>
    </div>`;
  }
  const formattedSets = p5FormatLastSets(last.validSets, exId);
  const suggestion    = p9BuildSuggestion(exId, last.validSets, targetRepsStr, targetRirStr);
  const best          = p9GetBestExercisePerformance(exId);
  const bestLine      = best ? `<div class="p9-best-line">⭐ Best: ${best}</div>` : "";
  // Format date label
  const dateStr = last.dateKey.replace("day-","");
  const dateLabel = new Date(dateStr+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
  return `${p9badge}<div class="p5-hist-wrap" id="p5-${exId}">
    <div class="p5-hist-toggle" onclick="p5Toggle('${exId}')">
      <div class="p5-hist-dot"></div><span class="p5-hist-label">Last Time</span><span class="p5-chevron">▼</span>
    </div>
    <div class="p5-hist-body">
      <div class="p5-last-line"><strong>${dateLabel}:</strong> ${formattedSets}</div>
      ${bestLine}
      <div class="p9-suggest-line ${suggestion.cls}">💬 ${suggestion.text}</div>
    </div>
  </div>`;
}

function p5Toggle(exId){
  const wrap = document.getElementById("p5-"+exId);
  if(wrap) wrap.classList.toggle("open");
}
// ── END PHASE 5 ──────────────────────────────────────────────────────────────

// ── PHASE 9A: PROGRESSION ENGINE ─────────────────────────────────────────────

// Get all saved workout entries containing a given exercise ID (sorted newest first)
// SAFE: read-only, never mutates localStorage
function p9GetExerciseHistory(exId){
  const today = dKey(new Date());
  return Object.keys(localStorage)
    .filter(k => k.startsWith("day-") && k.endsWith("-wo"))
    .sort().reverse()
    .reduce((arr, k) => {
      if(k.replace("-wo","") === today) return arr; // skip today's live entry
      try{
        const wo = JSON.parse(localStorage.getItem(k)||"{}");
        if(wo.exercises && wo.exercises[exId]){
          // v9.4.4 Bug 1: reps must be parseable; weight-only sets are not progression-valid
          const validSets = (wo.exercises[exId].sets||[]).filter(s => !isNaN(parseInt(s.reps)) && parseInt(s.reps) > 0);
          if(validSets.length) arr.push({dateKey: k.replace("-wo",""), validSets});
        }
      }catch{}
      return arr;
    }, []);
}

// Returns the most recent valid saved entry's validSets (or null)
function p9GetLastExercisePerformance(exId){
  const hist = p9GetExerciseHistory(exId);
  return hist.length ? hist[0] : null;
}

// Parse a numeric load from varied formats. Returns null for non-numeric/cardio.
// NOTE: For actual logged loads (single values). For target range strings use p9ParseLoadRange.
function p9ParseLoad(str){
  if(!str) return null;
  str = String(str).trim().toLowerCase();
  // Bodyweight / HR-based / non-numeric
  if(/^(bodyweight|bw|hr|bpm|max|heavy|moderate|light)/.test(str)) return null;
  if(/^\d+\s*(bpm|hr)/.test(str)) return null;
  // Range strings like "270–340 lb" or "70-80 lb DBs" — return the HIGH end for single-number needs
  const rangeMatch = str.match(/^([\d.]+)\s*[-–]\s*([\d.]+)/);
  if(rangeMatch) return parseFloat(rangeMatch[2]);
  // per-side / DB formats: "30 lb/side", "30/side", "30 lb dbs"
  const sideMatch = str.match(/^([\d.]+)\s*(?:lb)?\s*(?:\/side|db|dbs|per side)?/);
  if(sideMatch) return parseFloat(sideMatch[1]);
  const plain = parseFloat(str);
  return isNaN(plain) ? null : plain;
}

// Parse a target load string into {low, high, suffix} for range-aware logic.
// Examples:
//   "270–340 lb"     → {low:270, high:340, suffix:" lb"}
//   "70–80 lb DBs"   → {low:70,  high:80,  suffix:" lb DBs"}
//   "100 lb"         → {low:100, high:100, suffix:" lb"}
//   "30/side"        → {low:30,  high:30,  suffix:"/side"}
//   "120bpm"         → null  (cardio)
//   "Bodyweight"     → null  (non-load)
function p9ParseLoadRange(str){
  if(!str) return null;
  const s = String(str).trim();
  // Non-numeric / cardio
  if(/^(bodyweight|bw|hr |bpm|max|heavy|moderate|light)/i.test(s)) return null;
  if(/^\d+\s*(bpm|hr)/i.test(s)) return null;
  // Range: "270–340 lb" or "70-80 lb DBs"
  const rangeMatch = s.match(/^([\d.]+)\s*[-–]\s*([\d.]+)(.*)/);
  if(rangeMatch){
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    const suffix = rangeMatch[3].trim() || "";
    return {low, high, suffix: suffix ? " " + suffix : ""};
  }
  // Single: "100 lb", "30/side"
  const singleMatch = s.match(/^([\d.]+)(.*)/);
  if(singleMatch){
    const val = parseFloat(singleMatch[1]);
    const suffix = singleMatch[2].trim() || "";
    if(!isNaN(val)) return {low:val, high:val, suffix: suffix ? " " + suffix : ""};
  }
  return null;
}

// Get the highest numeric load from a set of validSets (the actual top working load).
function p9GetTopActualLoad(validSets){
  if(!validSets || !validSets.length) return null;
  let topLoad = null;
  let topRaw  = null;
  validSets.forEach(s => {
    const n = p9ParseLoad((s.wt||"").trim());
    if(n !== null && (topLoad === null || n > topLoad)){
      topLoad = n;
      topRaw  = (s.wt||"").trim();
    }
  });
  return topLoad !== null ? {numeric: topLoad, raw: topRaw} : null;
}

// Returns a "Best: load × reps" string or null
function p9GetBestExercisePerformance(exId){
  const hist = p9GetExerciseHistory(exId);
  if(!hist.length) return null;
  let bestLoad = null, bestRepsAtBestLoad = null, bestRepsOnly = null;
  hist.forEach(entry => {
    entry.validSets.forEach(s => {
      const load = p9ParseLoad(s.wt);
      const reps = parseInt(s.reps);
      if(load !== null && !isNaN(reps)){
        if(bestLoad === null || load > bestLoad || (load === bestLoad && reps > bestRepsAtBestLoad)){
          bestLoad = load;
          bestRepsAtBestLoad = reps;
        }
      }
      if(!isNaN(reps)){
        if(bestRepsOnly === null || reps > bestRepsOnly) bestRepsOnly = reps;
      }
    });
  });
  if(bestLoad !== null && bestRepsAtBestLoad !== null){
    // Try to reconstruct the load label from the first matching set
    const rawLoad = hist.flatMap(e=>e.validSets).find(s=>{
      const l = p9ParseLoad(s.wt); return l === bestLoad;
    });
    const loadLabel = rawLoad ? rawLoad.wt : bestLoad + " lb";
    return `${loadLabel} × ${bestRepsAtBestLoad}`;
  }
  if(bestRepsOnly !== null) return `${bestRepsOnly} reps (BW)`;
  return null;
}

// Is this a cardio/non-weight exercise?
// v9.4.5.3: Tightened — numeric loads like "110-120 lb", "130 lb" must NOT match.
// Only matches explicit cardio keywords/units or a clearly non-lifting RIR (— / n/a).
function p9IsCardio(loadStr, rirStr){
  if(!loadStr) return false;
  const s = String(loadStr).toLowerCase().trim();
  // Explicit cardio keyword or unit present in the load string
  if(/bpm|heart\s*rate|\bhr\b|\bhr\s*\d|\btreadmill\b|\bbike\b|\bstair\b|\bcardio\b|\bwalk\b|\bjog\b|\bduration\b|\bmin\b/.test(s)) return true;
  // RIR clearly indicates non-lifting (dash or n/a), AND load is not a plain numeric weight string
  const isNumericLoad = /^\d/.test(s) && /lb|kg|\/side|x\d/.test(s);
  if(isNumericLoad) return false; // numeric weight loads are never cardio regardless of RIR
  if(rirStr === "—" || rirStr === "n/a") return true;
  return false;
}

// Build a Suggested Today object {text, cls, status}
// v9.4.4: Extended with target_reset, build_reps, safer_hold, top_range_hold, progress_load, capped_hold
function p9BuildSuggestion(exId, validSets, targetRepsStr, targetRirStr){
  if(!validSets || !validSets.length){
    return {text:"No rep data. Start conservative.", cls:"neutral", status:"new"};
  }
  const lastReps = validSets.map(s=>parseInt(s.reps)).filter(n=>!isNaN(n));
  const lastRirs = validSets.map(s=>p5ParseRir(s.rir||"")).filter(n=>n!==null);
  if(!lastReps.length) return {text:"No rep data. Start conservative.", cls:"neutral", status:"new"};

  const avgLastReps = lastReps.reduce((a,b)=>a+b,0)/lastReps.length;
  const avgLastRir  = lastRirs.length ? lastRirs.reduce((a,b)=>a+b,0)/lastRirs.length : null;
  const targetReps  = p5ParseRepRange(targetRepsStr);
  const targetRir   = p5ParseRir(targetRirStr);

  // ── Get actual last load ─────────────────────────────────────────────────────
  const lastTopObj = p9GetTopActualLoad(validSets);
  let baseLoad   = null;
  let baseRaw    = null;

  if(lastTopObj !== null){
    baseLoad = lastTopObj.numeric;
    baseRaw  = lastTopObj.raw;
  } else {
    // No numeric load in last session — try best historical
    const hist = p9GetExerciseHistory(exId);
    let bestLoad = null, bestRaw = null;
    hist.forEach(entry => {
      entry.validSets.forEach(s => {
        const n = p9ParseLoad((s.wt||"").trim());
        if(n !== null && (bestLoad === null || n > bestLoad)){
          bestLoad = n;
          bestRaw  = (s.wt||"").trim();
        }
      });
    });
    if(bestLoad !== null){ baseLoad = bestLoad; baseRaw = bestRaw; }
  }

  // ── Get best historical load ─────────────────────────────────────────────────
  let bestHistLoad = null;
  const hist = p9GetExerciseHistory(exId);
  hist.forEach(entry => {
    entry.validSets.forEach(s => {
      const n = p9ParseLoad((s.wt||"").trim());
      if(n !== null && (bestHistLoad === null || n > bestHistLoad)) bestHistLoad = n;
    });
  });
  const topHistLoad = Math.max(baseLoad || 0, bestHistLoad || 0) || null;

  // ── Get target load range from program ──────────────────────────────────────
  const tlr = p9GetTargetLoadRangeForExercise(exId);
  // tlr = {low, high, suffix} | null

  // Helper: build suffix from raw label (strip leading number)
  function loadSuffix(raw){
    if(!raw) return " lb";
    const s = raw.replace(/^[\d.]+\s*/,"").trim();
    return s ? " " + s : " lb";
  }
  const sfx = loadSuffix(baseRaw);

  // Format rep suggestion cleanly — avoid "10–10 reps"
  function repSuggestion(tr){
    if(!tr) return "a few reps";
    if(tr.lo === tr.hi) return `${tr.lo} reps`;
    return `${tr.lo}\u2013${tr.hi} reps`;
  }

  // ── BUG 2: target_reset — current target is BELOW last/best historical load ─
  // Tolerance: if last/best numeric load exceeds target HIGH by more than 2 lb
  const TARGET_RESET_TOLERANCE = 2;
  if(tlr && topHistLoad !== null && topHistLoad > tlr.high + TARGET_RESET_TOLERANCE){
    const targetLow  = tlr.low;
    const targetHigh = tlr.high;
    const targetSuffix = tlr.suffix || sfx;
    const repsHint = targetReps ? `, ${repSuggestion(targetReps)}` : "";
    const rirHint  = targetRirStr && targetRirStr !== "—" ? `, RIR ${targetRirStr}` : "";
    return {
      text: `Target is reduced from prior ${topHistLoad}${sfx}. Use ${targetLow}–${targetHigh}${targetSuffix} today${repsHint}${rirHint}. Smooth reps only — rebuild from here.`,
      cls: "reduce",
      status: "target_reset"
    };
  }

  // ── Cardio detection — AFTER target_reset so reset always wins for lifting exercises ──
  // v9.4.5.3: use the programmed target load string (or fall back to first logged load)
  //           so numeric weights like "110-120 lb" are never misclassified as cardio.
  const _targetLoadRaw = (getF(exId, "load", "") || (validSets[0]||{}).wt || "");
  if(p9IsCardio(_targetLoadRaw, targetRirStr)){
    return {text:"Cardio session — match or beat duration/HR zone.", cls:"neutral", status:"hold"};
  }

  // ── Decision variables ───────────────────────────────────────────────────────
  const atTopOfRange   = targetReps && avgLastReps >= targetReps.hi;
  const belowRepTarget = targetReps && avgLastReps < targetReps.lo - 1;
  const lowRir         = targetRir !== null && avgLastRir !== null && avgLastRir < targetRir - 1;
  // RIR too tight = user was working harder than the target floor requires
  const rirTooTight    = targetRir !== null && avgLastRir !== null && avgLastRir < targetRir - 0.5;

  // ── safer_hold — reps below target OR RIR too tight ─────────────────────────
  if(belowRepTarget || lowRir || rirTooTight){
    const loadLabel = baseRaw ? ` ${baseRaw}` : "";
    return {
      text: `Keep${loadLabel} — RIR was tight last session. Hold load, stop with more reps in reserve (aim for RIR ${targetRirStr||"2–3"}).`,
      cls: "safer-hold",
      status: "safer_hold"
    };
  }

  // ── BUG 3: at top of rep range handling ─────────────────────────────────────
  if(atTopOfRange){
    // capped_hold — already at or above the programmed target load ceiling
    if(tlr && baseLoad !== null && baseLoad >= tlr.high - TARGET_RESET_TOLERANCE){
      return {
        text: `You're at the programmed load cap (${tlr.high}${tlr.suffix||sfx}). Repeat with clean form and RIR ${targetRirStr||"1–2"}, or ask for a target update.`,
        cls: "hold",
        status: "capped_hold"
      };
    }

    // progress_load — room to increase and RIR was good enough
    const aboveRirTarget = targetRir !== null && avgLastRir !== null && avgLastRir >= targetRir - 0.5;
    if(baseLoad !== null && aboveRirTarget){
      const bump      = baseLoad < 30 ? 2.5 : 5;
      const suggested = baseLoad + bump;
      const sfxNext   = loadSuffix(baseRaw);

      // If bump exceeds cap, show capped_hold
      if(tlr && suggested > tlr.high && baseLoad >= tlr.high - TARGET_RESET_TOLERANCE){
        return {
          text: `You're at the programmed load cap. Repeat ${baseLoad}${sfx} with strict form and RIR ${targetRirStr||"1–2"}, or ask for a target update.`,
          cls: "hold",
          status: "capped_hold"
        };
      }
      // Cap at target range ceiling if exceeded
      if(tlr && suggested > tlr.high){
        return {
          text: `Try ${tlr.high}${tlr.suffix||sfxNext} for ${repSuggestion(targetReps)} — bumping to target ceiling.`,
          cls: "up",
          status: "progress_load"
        };
      }
      return {
        text: `Try ${suggested}${sfxNext} for ${repSuggestion(targetReps)}.`,
        cls: "up",
        status: "progress_load"
      };
    }

    // top_range_hold — hit top of range but RIR wasn't ideal, or no load data
    {
      const loadLabel = baseRaw ? ` ${baseLoad}${sfx}` : "";
      return {
        text: `You hit${loadLabel} × ${targetReps ? targetReps.hi : avgLastReps}. Repeat once with clean form and RIR ${targetRirStr||"1–2"}, then progress load.`,
        cls: "hold",
        status: "top_range_hold"
      };
    }
  }

  // ── build_reps — same load, reps below top of target range ──────────────────
  {
    const loadLabel = baseRaw ? ` ${baseRaw}` : "";
    const repsHint = targetReps ? ` toward ${targetReps.hi} reps` : "";
    return {
      text: `Hold${loadLabel} and build${repsHint}. Progress when top of range hits at target RIR.`,
      cls: "hold",
      status: "build_reps"
    };
  }
}

// Look up the program target load range for an exercise by ID.
// Returns {low, high, suffix} or null. Safe — read-only.
function p9GetTargetLoadRangeForExercise(exId){
  const RP = getResolvedProgram();
  for(const days of Object.values(RP)){
    for(const day of days){
      if(!day.exercises) continue;
      for(const ex of day.exercises){
        if(ex.id === exId){
          const loadStr = getF(exId, "load", ex.load||"");
          return p9ParseLoadRange(loadStr);
        }
      }
    }
  }
  return null;
}

// Get progression status string: one of the v9.4.4 extended statuses
function p9GetProgressionStatus(exId, validSets, targetRepsStr, targetRirStr){
  if(!validSets || !validSets.length) return "new";
  const sug = p9BuildSuggestion(exId, validSets, targetRepsStr, targetRirStr);
  // Return the granular status when available, otherwise fall back to cls-based
  if(sug.status) return sug.status;
  if(sug.cls === "up") return "progress_load";
  if(sug.cls === "safer-hold") return "safer_hold";
  if(sug.cls === "reduce") return "target_reset";
  return "build_reps";
}

// Build badge HTML
function p9BadgeHTML(status){
  const MAP = {
    new:          {label:"NEW",            cls:"new"},
    build_reps:   {label:"→ BUILD REPS",   cls:"hold"},
    safer_hold:   {label:"⚠ SAFER HOLD",   cls:"safer-hold"},
    top_range_hold:{label:"→ TOP RANGE",   cls:"hold"},
    progress_load:{label:"↑ PROGRESS",     cls:"up"},
    capped_hold:  {label:"→ CAPPED HOLD",  cls:"hold"},
    target_reset: {label:"⚠ RESET HOLD",   cls:"reduce"},
    // legacy fallbacks
    up:           {label:"↑ Progress",     cls:"up"},
    hold:         {label:"→ Hold",         cls:"hold"},
    "safer-hold": {label:"⚠ Safer Hold",   cls:"safer-hold"},
    reduce:       {label:"↓ Reduce",       cls:"reduce"},
    neutral:      {label:"→ Hold",         cls:"hold"},
  };
  const entry = MAP[status] || {label:"→ Hold", cls:"hold"};
  return `<div class="p9-badge ${entry.cls}">${entry.label}</div>`;
}

// Build a progression context string for AI export (v9.4.5 — enhanced with Context line)
function p9BuildProgressionExport(ex){
  const hist = p9GetExerciseHistory(ex.id);
  if(!hist.length) return "";
  const last = hist[0];
  const targetReps = getF(ex.id,"reps",ex.reps);
  const targetRir  = getF(ex.id,"rir",ex.rir);
  const sug        = p9BuildSuggestion(ex.id, last.validSets, targetReps, targetRir);
  const status     = p9GetProgressionStatus(ex.id, last.validSets, targetReps, targetRir);
  const best       = p9GetBestExercisePerformance(ex.id);
  const lastFmt    = p5FormatLastSets(last.validSets);
  const dateStr    = last.dateKey.replace("day-","");
  const dateLabel  = new Date(dateStr+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});

  // Status badge label
  const statusLabel =
    status==="progress_load"||status==="up" ? "↑ PROGRESS" :
    status==="target_reset"||status==="reduce" ? "⚠ RESET HOLD" :
    status==="safer_hold"||status==="safer-hold" ? "⚠ SAFER HOLD" :
    status==="top_range_hold" ? "→ TOP RANGE HOLD" :
    status==="capped_hold" ? "→ CAPPED HOLD" :
    status==="build_reps" ? "→ BUILD REPS" :
    status==="new" ? "NEW" : "→ HOLD";

  // Context line explaining the decision in plain English
  const contextLine =
    status==="target_reset" ? "Current target is below historical best; target resets progression — use programmed load, not prior load." :
    status==="safer_hold" ? "RIR was too tight last session — hold load and increase reps-in-reserve before progressing." :
    status==="top_range_hold" ? "Top of rep range was reached; do NOT say beat reps — confirm clean form and RIR first." :
    status==="progress_load" ? "Top of rep range with adequate RIR — clear to bump load next session." :
    status==="capped_hold" ? "At or above programmed load ceiling — hold and confirm clean form or request target update." :
    status==="build_reps" ? "Below top of rep range at this load — continue building reps toward range ceiling." :
    status==="new" ? "No prior progression data — start conservative and find target RIR." : "";

  let out = `  Progression:\n`;
  out += `    Last (${dateLabel}): ${lastFmt}\n`;
  if(best) out += `    Best: ${best}\n`;
  out += `    Status: ${statusLabel}\n`;
  out += `    Suggested: ${sug.text}\n`;
  if(contextLine) out += `    Context: ${contextLine}\n`;
  return out;
}

// ── END PHASE 9A ──────────────────────────────────────────────────────────────

// ── PHASE 9A PREFILL ALIGNMENT (v9.4.4) ─────────────────────────────────────
// Computes aligned prefill values for a single set, given progression status.
// Returns {wt, reps, rir, hint} where values are shown in the input fields.
// SAFE: read-only. Never touches localStorage or history.
function p9ComputePrefill(exId, setIdx, savedSets, status, targetRepsStr, targetRirStr){
  const sd = savedSets[setIdx] || {};

  // ── RIR safe floors ────────────────────────────────────────────────────────
  const RIR_ORDER = ["0","1","1\u20132","2","2\u20133","3","3+","\u2014"];
  function rirIndex(v){ const i = RIR_ORDER.indexOf(v); return i === -1 ? 0 : i; }

  // ── TARGET_RESET — prefill from current target load, not historical load ───
  // v9.4.4 Bug 2: when target is below last/best, use target range low as weight,
  // target reps (lo), and target RIR (or safer floor).
  if(status === "target_reset"){
    const tlr = p9GetTargetLoadRangeForExercise(exId);
    const targetLow = tlr ? String(tlr.low) + (tlr.suffix||"") : "";
    const targetRepsObj = p5ParseRepRange(targetRepsStr);
    const prefillReps = targetRepsObj ? String(targetRepsObj.lo) : "";
    const RESET_FLOOR = "2\u20133";
    const prefillRir = (sd.rir && rirIndex(sd.rir) >= rirIndex(RESET_FLOOR)) ? sd.rir : RESET_FLOOR;
    // Only prefill if there's no saved draft for today
    const prefillWt = sd.wt || targetLow;
    return {wt: prefillWt, reps: sd.reps || prefillReps, rir: prefillRir, hint: "target_reset"};
  }

  // ── SAFER HOLD ─────────────────────────────────────────────────────────────
  if(status === "safer_hold" || status === "safer-hold"){
    const prefillWt   = sd.wt   || "";
    const prefillReps = sd.reps || "";
    const SAFER_HOLD_FLOOR = "2\u20133";
    const savedRirSafe = sd.rir && rirIndex(sd.rir) >= rirIndex(SAFER_HOLD_FLOOR) ? sd.rir : SAFER_HOLD_FLOOR;
    return {wt: prefillWt, reps: prefillReps, rir: savedRirSafe, hint: "safer-hold"};
  }

  // ── REDUCE (legacy) ────────────────────────────────────────────────────────
  if(status === "reduce"){
    const prefillWt = sd.wt || "";
    const prefillReps = sd.reps || "";
    const REDUCE_FLOOR = "2\u20133";
    const savedRirSafe = sd.rir && rirIndex(sd.rir) >= rirIndex(REDUCE_FLOOR) ? sd.rir : REDUCE_FLOOR;
    return {wt: prefillWt, reps: prefillReps, rir: savedRirSafe, hint: "reduce-load"};
  }

  // ── HOLD / BUILD_REPS / CAPPED_HOLD / TOP_RANGE_HOLD ─────────────────────
  if(status === "hold" || status === "build_reps" || status === "capped_hold" || status === "top_range_hold"){
    const prefillWt = sd.wt || "";
    const prefillReps = sd.reps || "";
    const targetRirNum = p5ParseRir(targetRirStr);
    let prefillRir = sd.rir || "";
    if(prefillRir === "0" && targetRirNum !== null && targetRirNum >= 1){
      prefillRir = "1";
    }
    return {wt: prefillWt, reps: prefillReps, rir: prefillRir, hint: "hold"};
  }

  // ── PROGRESS_LOAD / NEW / NEUTRAL ─────────────────────────────────────────
  return {wt: sd.wt || "", reps: sd.reps || "", rir: sd.rir || "", hint: "normal"};
}
// ── END v9.4.4 PREFILL ────────────────────────────────────────────────────────

// ── v9.4.5: PROGRESSION DEBUG HELPERS ────────────────────────────────────────

// Feature 1: window.mfProgressionDebug(exId)
// Read-only. Returns a plain object describing exactly why the engine chose a status.
window.mfProgressionDebug = function(exId){
  try {
    if(!exId || typeof exId !== "string"){
      return {error:"exId must be a non-empty string", usage:"mfProgressionDebug('home-d0-e1')"};
    }
    const RP = getResolvedProgram();
    // Find exercise in program
    let foundEx = null, foundGym = null, foundDayIdx = null, foundDayName = null;
    for(const [gym, days] of Object.entries(RP)){
      for(let di = 0; di < days.length; di++){
        const day = days[di];
        const ex = (day.exercises||[]).find(e => e.id === exId);
        if(ex){ foundEx=ex; foundGym=gym; foundDayIdx=di; foundDayName=day.name; break; }
      }
      if(foundEx) break;
    }
    if(!foundEx){
      return {error:"Exercise ID not found in resolved program: " + exId, tip:"Check spelling. Use mfProgressionAudit() to list all known IDs."};
    }

    const targetRepsStr = getF(exId,"reps",foundEx.reps);
    const targetRirStr  = getF(exId,"rir",foundEx.rir);
    const targetSetsStr = getF(exId,"sets",foundEx.sets);
    const targetLoad    = getF(exId,"load",foundEx.load);
    const name          = getF(exId,"name",foundEx.name);
    const tlr           = p9ParseLoadRange(targetLoad);
    const targetRepsObj = p5ParseRepRange(targetRepsStr);
    const targetRirNum  = p5ParseRir(targetRirStr);

    // Get history
    const last     = p5GetLastEntry(exId);
    const hist     = p9GetExerciseHistory(exId);
    const best     = p9GetBestExercisePerformance(exId);

    const validSets  = (last && !last.weightOnly) ? last.validSets : null;
    const weightOnly = last ? !!last.weightOnly : false;
    const lastDateKey = last ? last.dateKey : null;
    const lastFmt    = validSets ? p5FormatLastSets(validSets) : (weightOnly ? "weight-only (ignored for progression)" : null);
    const lastTopObj = validSets ? p9GetTopActualLoad(validSets) : null;

    // Compute best historical load across all history
    let bestHistLoad = null;
    hist.forEach(entry => {
      entry.validSets.forEach(s => {
        const n = p9ParseLoad((s.wt||"").trim());
        if(n !== null && (bestHistLoad === null || n > bestHistLoad)) bestHistLoad = n;
      });
    });

    // Compute status + suggestion
    const status = p9GetProgressionStatus(exId, validSets, targetRepsStr, targetRirStr);
    const sug    = p9BuildSuggestion(exId, validSets, targetRepsStr, targetRirStr);

    // Badge label
    const badgeMap = {
      new:"NEW", build_reps:"→ BUILD REPS", safer_hold:"⚠ SAFER HOLD",
      top_range_hold:"→ TOP RANGE HOLD", progress_load:"↑ PROGRESS",
      capped_hold:"→ CAPPED HOLD", target_reset:"⚠ RESET HOLD"
    };
    const badge = badgeMap[status] || "→ HOLD";

    // Decision flags
    const avgLastReps = validSets ? validSets.map(s=>parseInt(s.reps)).filter(n=>!isNaN(n)).reduce((a,b,_,arr)=>a+b/arr.length,0) : null;
    const avgLastRir  = validSets ? validSets.map(s=>p5ParseRir(s.rir||"")).filter(n=>n!==null).reduce((a,b,_,arr)=>a+b/arr.length,0) : null;
    const topHistLoad = Math.max(lastTopObj ? lastTopObj.numeric : 0, bestHistLoad || 0) || null;
    const TARGET_RESET_TOLERANCE = 2;

    const flags = {
      isNew           : !validSets || !validSets.length,
      isTargetReset   : !!(tlr && topHistLoad !== null && topHistLoad > tlr.high + TARGET_RESET_TOLERANCE),
      isSaferHold     : status === "safer_hold",
      isTopRange      : status === "top_range_hold",
      isCapped        : status === "capped_hold",
      isProgressLoad  : status === "progress_load",
      isBuildReps     : status === "build_reps",
      wasWeightOnlyIgnored: weightOnly
    };

    // Prefill preview
    const st = parseInt(targetSetsStr)||3;
    const savedEx = (getTodayWoData().exercises||{})[exId]||{sets:[]};
    const prefillPreview = [];
    for(let s=0; s<st; s++){
      const pf = p9ComputePrefill(exId, s, savedEx.sets||[], status, targetRepsStr, targetRirStr);
      prefillPreview.push({set: s+1, weight: pf.wt||"(empty)", reps: pf.reps||"(empty)", rir: pf.rir||"(empty)", source: pf.hint});
    }

    // Human-readable reason summary
    let reason = "Unknown status.";
    if(flags.isNew)                reason = "No valid reps logged — treating as new exercise. Start conservative.";
    else if(flags.isTargetReset)   reason = "Historical load (" + topHistLoad + ") exceeds current target ceiling (" + (tlr?tlr.high:"?") + "). Current target overrides progression history.";
    else if(flags.isSaferHold)     reason = "RIR was tighter than target last session (avg RIR " + (avgLastRir!==null?avgLastRir.toFixed(1):"?") + " vs target " + targetRirStr + "). Hold load, increase reps-in-reserve.";
    else if(flags.isTopRange)      reason = "Hit top of rep range (avg " + (avgLastReps!==null?avgLastReps.toFixed(1):"?") + " reps, ceiling " + (targetRepsObj?targetRepsObj.hi:"?") + ") but RIR or load not yet confirmed clean. Repeat before bumping.";
    else if(flags.isProgressLoad)  reason = "Top of rep range met with sufficient RIR. Clear to bump load by " + (lastTopObj && lastTopObj.numeric < 30 ? "2.5" : "5") + " lb.";
    else if(flags.isCapped)        reason = "At or above programmed load ceiling (" + (tlr?tlr.high:"?") + "). Hold and confirm quality, or request target update.";
    else if(flags.isBuildReps)     reason = "Below top of rep range at current load. Keep building reps toward " + (targetRepsObj?targetRepsObj.hi:"target") + ".";

    return {
      exId,
      name,
      gym: foundGym,
      dayIndex: foundDayIdx,
      dayName: foundDayName,
      targetSets: targetSetsStr,
      targetReps: targetRepsStr,
      targetRepsParsed: targetRepsObj,
      targetLoad,
      targetLoadRange: tlr,
      targetRir: targetRirStr,
      targetRirParsed: targetRirNum,
      lastEntryDate: lastDateKey,
      lastValidSets: validSets ? validSets.length : 0,
      lastFormatted: lastFmt,
      bestPerformance: best,
      lastTopActualLoad: lastTopObj,
      bestNumericLoad: topHistLoad,
      status,
      badge,
      suggestion: sug.text,
      suggestionClass: sug.cls,
      prefillPreview,
      flags,
      reason
    };
  } catch(e) {
    return {error:"mfProgressionDebug threw an exception: " + e.message, stack: e.stack};
  }
};

// Feature 2: window.mfProgressionAudit()
// Read-only. Scans entire resolved program and returns progression status summary.
window.mfProgressionAudit = function(){
  try {
    const RP = getResolvedProgram();
    const exercises = [];
    const warnings  = [];

    for(const [gym, days] of Object.entries(RP)){
      for(let di=0; di<days.length; di++){
        const day = days[di];
        for(const ex of (day.exercises||[])){
          try {
            const targetReps = getF(ex.id,"reps",ex.reps);
            const targetRir  = getF(ex.id,"rir",ex.rir);
            const targetLoad = getF(ex.id,"load",ex.load);
            const name       = getF(ex.id,"name",ex.name);
            const last       = p5GetLastEntry(ex.id);
            const validSets  = (last && !last.weightOnly) ? last.validSets : null;

            // Weight-only detection
            if(last && last.weightOnly){
              warnings.push("weight-only history ignored for " + ex.id + " (" + name + ")");
            }

            const status = p9GetProgressionStatus(ex.id, validSets, targetReps, targetRir);
            const sug    = p9BuildSuggestion(ex.id, validSets, targetReps, targetRir);
            const best   = p9GetBestExercisePerformance(ex.id);
            const lastFmt = validSets ? p5FormatLastSets(validSets) : (last && last.weightOnly ? "weight-only" : null);

            if(status === "target_reset"){
              warnings.push("target_reset detected: " + ex.id + " (" + name + ") — historical load exceeds current target");
            }
            if(status === "unknown"){
              warnings.push("unknown status for " + ex.id + " (" + name + "): " + status);
            }
            // Warn if load target is missing where expected for non-cardio
            const tlr = p9GetTargetLoadRangeForExercise(ex.id);
            if(!tlr && targetLoad && !/bodyweight|bw|cardio/i.test(targetLoad) && !/bpm|hr/i.test(targetLoad)){
              warnings.push("could not parse target load for " + ex.id + " (" + name + "): '" + targetLoad + "'");
            }

            const badgeMap = {
              new:"NEW", build_reps:"→ BUILD REPS", safer_hold:"⚠ SAFER HOLD",
              top_range_hold:"→ TOP RANGE HOLD", progress_load:"↑ PROGRESS",
              capped_hold:"→ CAPPED HOLD", target_reset:"⚠ RESET HOLD"
            };

            exercises.push({
              gym,
              dayIndex: di,
              dayName: day.name,
              exId: ex.id,
              name,
              target: getF(ex.id,"sets",ex.sets) + "×" + targetReps + " @ " + targetLoad + " / RIR " + targetRir,
              status,
              badge: badgeMap[status]||"→ HOLD",
              suggestion: sug.text,
              last: lastFmt,
              best: best||null
            });
          } catch(exErr) {
            warnings.push("error processing " + ex.id + ": " + exErr.message);
          }
        }
      }
    }

    // Derive statusCounts from exercises so it always matches what .exercises reports.
    // Known statuses get their own key; anything unrecognised lands in unknown — and
    // will appear in exercises[] with that same status string so the caller can inspect it.
    const knownStatuses = ["new","target_reset","safer_hold","top_range_hold","progress_load","capped_hold","build_reps"];
    const statusCounts = Object.fromEntries([...knownStatuses,"unknown"].map(k=>[k,0]));
    for(const ex of exercises){
      if(knownStatuses.includes(ex.status)) statusCounts[ex.status]++;
      else statusCounts.unknown++;
    }

    return {
      appVersion: APP_VERSION,
      generatedAt: new Date().toISOString(),
      totalExercises: exercises.length,
      statusCounts,
      exercises,
      warnings
    };
  } catch(e) {
    return {error:"mfProgressionAudit threw an exception: " + e.message};
  }
};

// Aliases: allow both window.mfProgressionDebug() and bare mfProgressionDebug() in DevTools
var mfProgressionDebug = window.mfProgressionDebug;
var mfProgressionAudit = window.mfProgressionAudit;

// ── 9.4.6: DAY OVERRIDE DEBUG HELPER ─────────────────────────────────────────
// Focused diagnostic for day override state. Returns structure + warnings.
window.mfDayOverrideDebug = function(){
  const lc = getLifecycle();
  const dayOverrides = lc.dayOverrides || {};
  const validGyms = Object.keys(P); // base program gym keys
  const RP = getResolvedProgram();

  let overriddenCount = 0;
  const effectiveSummary = {};
  const warnings = [];

  validGyms.forEach(gymKey => {
    const gymOverrides = dayOverrides[gymKey] || {};
    effectiveSummary[gymKey] = [];
    const days = RP[gymKey] || [];
    days.forEach((baseDay, di) => {
      const ovr = gymOverrides[String(di)];
      const eday = getEffectiveDayMeta(gymKey, di, baseDay);
      const entry = {
        dayIdx: di,
        baseName: baseDay.name,
        effectiveName: eday.name,
        hasOverride: !!ovr,
        override: ovr || null
      };
      if(ovr) overriddenCount++;
      effectiveSummary[gymKey].push(entry);
    });
    // Check for overrides referencing out-of-range dayIdx
    Object.keys(gymOverrides).forEach(key => {
      const idx = parseInt(key, 10);
      if(isNaN(idx) || idx < 0 || idx >= days.length){
        warnings.push("gym '"+gymKey+"': dayOverride key '"+key+"' is out of range (program has "+days.length+" days)");
      }
    });
  });

  // Check for overrides referencing unknown gyms
  Object.keys(dayOverrides).forEach(gymKey => {
    if(!validGyms.includes(gymKey)){
      warnings.push("gymKey '"+gymKey+"' in dayOverrides is not a valid gym (expected: "+validGyms.join(", ")+")");
    }
  });

  const summary = {
    lifecycleVersion: lc.lifecycleVersion,
    overriddenDaysCount: overriddenCount,
    dayOverrides,
    effectiveDaySummary: effectiveSummary,
    warnings,
    warningCount: warnings.length
  };

  console.log("[MarcusFit] mfDayOverrideDebug():", summary);
  if(warnings.length) console.warn("[MarcusFit] Day override warnings:", warnings);
  return summary;
};
var mfDayOverrideDebug = window.mfDayOverrideDebug;
// ── END 9.4.6 DAY OVERRIDE DEBUG ─────────────────────────────────────────────

// ── 9.4.8.1: DAY ADDITION DEBUG HELPER ───────────────────────────────────────
// Focused diagnostic for day addition state. Returns structure + warnings.
window.mfDayAdditionDebug = function(){
  const lc = getLifecycle();
  const dayAdditions = lc.dayAdditions || {};
  const validGyms = Object.keys(P);
  const warnings = [];
  let totalCount = 0;
  const summary = {};
  const resolvedDayCounts = {};
  const baseDayCounts = {};
  const virtualDayIndices = {};

  validGyms.forEach(gymKey => {
    const gymAdditions = dayAdditions[gymKey] || {};
    const baseLen = P[gymKey].length;
    baseDayCounts[gymKey] = baseLen;
    summary[gymKey] = [];
    virtualDayIndices[gymKey] = [];

    let resolvedLen = baseLen;
    try { resolvedLen = getResolvedDays(gymKey).length; } catch(e){ /* leave as baseLen */ }
    resolvedDayCounts[gymKey] = resolvedLen;

    Object.entries(gymAdditions).forEach(([key, entry]) => {
      const idx = parseInt(key, 10);
      totalCount++;
      const warn = isNaN(idx) || idx < baseLen;
      if(warn) warnings.push("gym '"+gymKey+"': dayAddition key '"+key+"' is invalid or collides with base P (baseLen="+baseLen+")");
      if(!isNaN(idx)) virtualDayIndices[gymKey].push(idx);

      // 9.4.8.5: deeper per-day diagnostics — does this virtual day have
      // custom exercises, an orderOverride, or day-scoped recommendations?
      const hasCustomExercises = Object.values(lc.customExercises||{})
        .some(ex => ex && ex.gymKey === gymKey && ex.dayIdx === idx);
      const hasOrderOverride = !!(lc.orderOverrides||{})[gymKey+":"+idx];
      let hasRecommendations = false;
      try {
        const recs = getRecs();
        hasRecommendations = !!recs[gymKey+":"+idx];
      } catch(e){ /* recommendations not safely detectable — leave false */ }

      summary[gymKey].push({
        dayIdx: idx,
        name: entry.name || "—",
        source: entry.source || "—",
        createdAt: entry.createdAt || "—",
        hasCustomExercises,
        hasOrderOverride,
        hasRecommendations,
        entry
      });
    });
  });
  Object.keys(dayAdditions).forEach(gymKey => {
    if(!validGyms.includes(gymKey)) warnings.push("gymKey '"+gymKey+"' in dayAdditions is not a valid gym");
  });

  const result = {
    lifecycleVersion: lc.lifecycleVersion,
    totalDayAdditions: totalCount,
    dayAdditions,
    summary,
    warnings,
    warningCount: warnings.length,
    resolvedDayCounts,
    baseDayCounts,
    virtualDayIndices
  };
  console.log("[MarcusFit] mfDayAdditionDebug():", result);
  if(warnings.length) console.warn("[MarcusFit] Day addition warnings:", warnings);
  return result;
};
var mfDayAdditionDebug = window.mfDayAdditionDebug;
// ── END 9.4.8.1 DAY ADDITION DEBUG ───────────────────────────────────────────

// ── PHASE 9.4.7: DAY 6 SHOULDERS & ARMS SPECIALIZATION ───────────────────────
//
// Redesigns HOME Day 6 and PARTIAL Day 6 into true Shoulders & Arms days.
// Uses the v9.4.6 Day Structure Override Engine for day metadata.
// Uses the existing exercise lifecycle system (exArchiveId, exAddCustom) for
// exercise structure — same path as AI Sync _action:replace.
//
// IDEMPOTENCY: Checks for a meta flag { appliedVersion: "9.4.7" } in the
// day override before applying, so repeated calls (e.g. page reloads) are no-ops.
//
// BASE P IS NOT MUTATED. No new localStorage keys are created.
// All changes live in mf-exercise-state (lifecycle) under existing keys:
//   lc.dayOverrides        — day metadata (name/focus/note/tag/meta)
//   lc.customExercises     — new exercises added for the specialization
//   lc.inactiveIds         — archived base Day 6 exercises
//   lc.replacements        — replacement links
// And in mf-recommendations for coaching notes.

function mfApplyDay6Specialization(){
  const SPEC_VERSION = "9.4.7";
  const DAY_IDX = 5; // Day 6 = index 5

  // ── IDEMPOTENCY CHECK ─────────────────────────────────────────────────────
  // If both home and partial already have the 9.4.7 meta flag, skip entirely.
  const existingHome    = getDayOverride("home",    DAY_IDX);
  const existingPartial = getDayOverride("partial", DAY_IDX);
  const alreadyHome     = existingHome    && (existingHome.meta    || {}).appliedVersion === SPEC_VERSION;
  const alreadyPartial  = existingPartial && (existingPartial.meta || {}).appliedVersion === SPEC_VERSION;
  if(alreadyHome && alreadyPartial){
    console.log("[MarcusFit] 9.4.7: Day 6 Specialization already applied — skipping (idempotent).");
    return;
  }

  console.log("[MarcusFit] 9.4.7: Applying Day 6 Shoulders & Arms Specialization...");

  // ── STEP 1: ARCHIVE BASE DAY 6 EXERCISES ─────────────────────────────────
  // Home Day 6 base exercises: home-d5-e0 through home-d5-e6
  // Partial Day 6 base exercises: partial-d5-e0 through partial-d5-e7
  // We archive them all and replace with the new specialization set.
  // If already archived (e.g. partial re-run), skip gracefully.
  const homeBaseIds    = ["home-d5-e0","home-d5-e1","home-d5-e2","home-d5-e3","home-d5-e4","home-d5-e5","home-d5-e6"];
  const partialBaseIds = ["partial-d5-e0","partial-d5-e1","partial-d5-e2","partial-d5-e3","partial-d5-e4","partial-d5-e5","partial-d5-e6","partial-d5-e7"];

  function archiveIfActive(id){
    const lc = getLifecycle();
    if(!lc.inactiveIds[id]){
      exArchiveId(id, null, "9.4.7 Day 6 Specialization — replaced by Shoulders & Arms program");
    }
  }

  if(!alreadyHome){
    homeBaseIds.forEach(id => archiveIfActive(id));
  }
  if(!alreadyPartial){
    partialBaseIds.forEach(id => archiveIfActive(id));
  }

  // ── STEP 2: ADD NEW HOME DAY 6 EXERCISES ─────────────────────────────────
  // Priority: Delts first (press → side delt → rear delt → pump), arms second
  // Home-compatible: DB/bodyweight only
  // IDs: home-d5-e7 through home-d5-e13 (safe — base is 0–6, now all archived)
  if(!alreadyHome){
    const homeNewExercises = [
      {
        id: "home-d5-e7",
        name: "Seated DB Shoulder Press",
        sets: 3, reps: "8-12", load: "Moderate DBs", rir: "2",
        blurb: "Delts first. Controlled tempo. Drive up, lower slow. Core braced."
      },
      {
        id: "home-d5-e8",
        name: "DB Lateral Raise",
        sets: 4, reps: "12-20", load: "Lightest available", rir: "1-2",
        blurb: "THE money movement. Lead with elbow, pinky high. Volume beats load here."
      },
      {
        id: "home-d5-e9",
        name: "DB Rear Delt Fly (Bent Over)",
        sets: 4, reps: "15-20", load: "Light DB", rir: "1-2",
        blurb: "Torso parallel. Rear delts = shoulder cap. Arms slightly bent, arc wide."
      },
      {
        id: "home-d5-e10",
        name: "Lean-Away Lateral Raise",
        sets: 3, reps: "15-20", load: "Light DB", rir: "1-2",
        blurb: "Grab something stable, lean away. Puts side delt under constant stretch tension."
      },
      {
        id: "home-d5-e11",
        name: "DB Curl",
        sets: 3, reps: "10-15", load: "Moderate DB", rir: "2",
        blurb: "Arms are secondary today. Full ROM. Slow 2-sec negative."
      },
      {
        id: "home-d5-e12",
        name: "DB Skull Crusher",
        sets: 3, reps: "10-15", load: "Light-moderate DB", rir: "2",
        blurb: "Long head tricep. Keep elbows pointed up. Slow eccentric."
      },
      {
        id: "home-d5-e13",
        name: "Close-Grip Push-Up",
        sets: 2, reps: "Max (leave 1-2)", load: "Bodyweight", rir: "1-2",
        blurb: "FINISHER. Tricep pump. Elbows tucked. Stop before form breaks."
      }
    ];
    homeNewExercises.forEach(ex => {
      // Only add if not already in custom exercises (idempotency within a partial run)
      const lc = getLifecycle();
      if(!lc.customExercises[ex.id]){
        exAddCustom("home", DAY_IDX, ex);
      }
    });

    // Set order override so new exercises render in the correct specialization order
    const lc = getLifecycle();
    if(!lc.orderOverrides) lc.orderOverrides = {};
    lc.orderOverrides["home:5"] = [
      "home-d5-e7","home-d5-e8","home-d5-e9","home-d5-e10",
      "home-d5-e11","home-d5-e12","home-d5-e13"
    ];
    saveLifecycle(lc);
  }

  // ── STEP 3: ADD NEW PARTIAL DAY 6 EXERCISES ──────────────────────────────
  // Primary optimized version. Uses cables + DBs for superior delt development.
  // IDs: partial-d5-e8 through partial-d5-e15 (base was 0–7, all archived)
  if(!alreadyPartial){
    const partialNewExercises = [
      {
        id: "partial-d5-e8",
        name: "Seated DB Shoulder Press",
        sets: 3, reps: "8-12", load: "45-50 lb DBs", rir: "2",
        blurb: "Main compound. Press strong, control the negative. Elbows slightly forward."
      },
      {
        id: "partial-d5-e9",
        name: "DB Lateral Raise",
        sets: 4, reps: "12-20", load: "20 lb", rir: "1-2",
        blurb: "Drop set on last set: 20 → 12 lb × max. This is the money movement. PRIORITY."
      },
      {
        id: "partial-d5-e10",
        name: "Cable Rear Delt Fly",
        sets: 4, reps: "15-20", load: "17 lb/side", rir: "1-2",
        blurb: "Double cable, one arm each side. Rear delts = shoulder cap and posture. Arc wide."
      },
      {
        id: "partial-d5-e11",
        name: "Cable Lateral Raise",
        sets: 3, reps: "12-15", load: "10 lb/side", rir: "1-2",
        blurb: "Constant tension. Slow and deliberate. Lead with elbow, not wrist."
      },
      {
        id: "partial-d5-e12",
        name: "EZ Bar or DB Curl",
        sets: 3, reps: "10-15", load: "60-70 lb", rir: "2",
        blurb: "Arms are secondary today. Full ROM. No swing. Slow negative."
      },
      {
        id: "partial-d5-e13",
        name: "Overhead Cable Tricep Extension",
        sets: 3, reps: "10-15", load: "45-50 lb", rir: "2",
        blurb: "Long head stretch. Arms behind head, elbows forward. Slow eccentric."
      },
      {
        id: "partial-d5-e14",
        name: "Cable Curl",
        sets: 2, reps: "15-20", load: "35-40 lb", rir: "1-2",
        blurb: "FINISHER pump. Constant cable tension. Squeeze at top."
      }
    ];
    partialNewExercises.forEach(ex => {
      const lc = getLifecycle();
      if(!lc.customExercises[ex.id]){
        exAddCustom("partial", DAY_IDX, ex);
      }
    });

    // Set order override for partial Day 6
    const lc = getLifecycle();
    if(!lc.orderOverrides) lc.orderOverrides = {};
    lc.orderOverrides["partial:5"] = [
      "partial-d5-e8","partial-d5-e9","partial-d5-e10","partial-d5-e11",
      "partial-d5-e12","partial-d5-e13","partial-d5-e14"
    ];
    saveLifecycle(lc);
  }

  // ── STEP 4: SET DAY METADATA OVERRIDES ───────────────────────────────────
  if(!alreadyHome){
    setDayOverride("home", DAY_IDX, {
      name: "SHOULDERS & ARMS",
      tag: "SPECIALIZATION",
      focus: "Delts · Side Delts · Rear Delts · Biceps · Triceps — DB/Bodyweight",
      note: "Delts first, arms second. Lateral raises are the money movement — volume beats load. Build those bowling balls.",
      meta: {
        appliedVersion: SPEC_VERSION,
        appliedAt: new Date().toISOString(),
        specialization: "shoulders_arms",
        priority: "side_delts_rear_delts_arms"
      }
    }, "9.4.7 — Day 6 Shoulders & Arms Specialization (home)");
  }

  if(!alreadyPartial){
    setDayOverride("partial", DAY_IDX, {
      name: "SHOULDERS & ARMS",
      tag: "SPECIALIZATION",
      focus: "Delts · Side Delts · Rear Delts · Biceps · Triceps — Cable/DB",
      note: "Delts first, arms second. Drop set on lateral raises. Cable rear delts = posture + shoulder cap. Build those bowling balls.",
      meta: {
        appliedVersion: SPEC_VERSION,
        appliedAt: new Date().toISOString(),
        specialization: "shoulders_arms",
        priority: "side_delts_rear_delts_arms"
      }
    }, "9.4.7 — Day 6 Shoulders & Arms Specialization (partial/transitional gym)");
  }

  // ── STEP 5: SET COACHING RECOMMENDATIONS ─────────────────────────────────
  if(!alreadyHome){
    setRecsForDay("home", DAY_IDX, {
      updatedAt: new Date().toISOString(),
      source: "ai",
      strategy: "shoulders_arms_specialization",
      experimentTag: "day6_shoulder_cap_build",
      expiresAfterSessions: 999, // persistent — this is a program redesign, not a short experiment
      items: [
        "Lateral raises are your PRIMARY movement today. Volume and consistency beat heavy load — don't go heavier than you can control with your elbow leading.",
        "Rear delt work builds the shoulder cap that's visible from the back. Prioritize full arc, not speed. Torso parallel to floor.",
        "Seated DB Shoulder Press goes first to pre-exhaust the shoulder cap before isolation. Keep reps clean at RIR 2.",
        "Arms are SECONDARY. Stop bicep and tricep sets at RIR 2 — don't drain recovery for the movements that matter most today.",
        "Progress reps before adding weight on all isolation movements. When you consistently hit the top of the rep range with 2+ RIR, then increase load.",
        "Lean-Away Lateral Raise: grab a rack or machine for support, lean away to load the side delt at stretch. Even a light DB creates serious stimulus.",
        "This day supports shoulder cap development — the look of 'bowling balls under the skin' comes from consistent lateral and rear delt volume over weeks."
      ]
    });
  }

  if(!alreadyPartial){
    setRecsForDay("partial", DAY_IDX, {
      updatedAt: new Date().toISOString(),
      source: "ai",
      strategy: "shoulders_arms_specialization",
      experimentTag: "day6_shoulder_cap_build_cable",
      expiresAfterSessions: 999, // persistent
      items: [
        "DB Lateral Raise drop set on the LAST set only: go to near-failure at 20 lb, immediately drop to 12 lb for max reps. This is the money technique for side delt caps.",
        "Cable Rear Delt Fly: double cable, one arm each side. Use a wide arc — rear delts respond to range, not load. This is the posture and shoulder cap builder.",
        "Cable Lateral Raise comes AFTER the DB version for constant-tension volume. Slower is better here — 2 seconds up, 2 down.",
        "Arms are secondary today. EZ Bar Curl and Cable Extension at RIR 2. Don't push to failure on arm movements — save recovery for the next push session.",
        "Cable Curl finisher: keep the reps moderate, squeeze at the top, no swinging. Last 2 sets for pump, not strength.",
        "Progress reps before adding weight on lateral raises and rear delts. When you consistently hit the top of the rep range with 2+ RIR, then increase load by the smallest plate available.",
        "This day is the primary optimized version of the shoulder specialization. More cable volume means more constant tension — great for delt detail."
      ]
    });
  }

  console.log("[MarcusFit] 9.4.7: Day 6 Shoulders & Arms Specialization applied successfully.");
  console.log("[MarcusFit] 9.4.7: Run mfDayOverrideDebug() to verify both overrides are active.");
}

// Expose for console access
window.mfApplyDay6Specialization = mfApplyDay6Specialization;
var mfApplyDay6Specialization = window.mfApplyDay6Specialization;

// ── 9.4.8.2.1: ORDER OVERRIDE INTEGRITY FIX ──────────────────────────────────
// Tiny stabilization patch. Some orderOverrides entries can end up pointing at
// an ID that was later archived (e.g. by an AI Sync "replace" action). The
// resolved program correctly drops the stale exercise, but the order array
// still references the old ID, which mfLifecycleDebug() flags as a warn.
//
// This walks every orderOverrides entry and, for each ID that is no longer
// active in the resolved program:
//   1. Follows the archive/replacement chain (inactiveIds[id].replacedBy,
//      falling back to lc.replacements[id]) to find the current active ID.
//   2. If an active replacement is found and isn't already in the array,
//      swaps it in at the same position (preserves intended order — Option A/C).
//   3. If no active replacement can be found, drops only the stale ID from
//      the array (Option D) — the rest of the order is left untouched.
//
// Does not touch base P, does not create a new localStorage key (reuses the
// existing lifecycle key), does not clear any other lifecycle state, and is
// idempotent — safe to run on every load.
function exResolveActiveReplacement(staleId, lc){
  const visited = new Set();
  let current = staleId;
  while(lc.inactiveIds[current]){
    if(visited.has(current)) return null; // guard against circular chains
    visited.add(current);
    const info = lc.inactiveIds[current] || {};
    let next = info.replacedBy || null;
    if(!next){
      const rep = lc.replacements[current];
      next = rep ? (typeof rep === "object" ? rep.newId : rep) : null;
    }
    if(!next) return null;
    current = next;
  }
  return current;
}

function mfFixOrderOverrideIntegrity(){
  const lc = getLifecycle();
  const overrides = lc.orderOverrides || {};
  const overrideKeys = Object.keys(overrides);
  if(!overrideKeys.length) return;

  const validGymKeys = (typeof P !== "undefined") ? Object.keys(P) : [];

  let touched = false;
  const changeLog = [];

  overrideKeys.forEach(key => {
    const parts = key.split(":");
    const gymKey = parts[0];
    const dayIdx = parseInt(parts[1], 10);
    if(!validGymKeys.includes(gymKey) || isNaN(dayIdx) || dayIdx < 0) return; // invalid keys handled by other checks

    // 9.4.8.5: resolve via getResolvedDays() so virtual/additive day overrides
    // (dayIdx >= base P length, with a matching dayAddition) are repaired the
    // same as base-day overrides instead of being silently skipped.
    let resolvedDays;
    try { resolvedDays = getResolvedDays(gymKey); } catch(e){
      console.warn("[MarcusFit] 9.4.8.2.1: could not resolve days for order-override fix:", e.message);
      return;
    }
    const dayObj = resolvedDays.find(d => d._dayIdx === dayIdx);
    if(!dayObj) return; // no base day and no matching virtual day — out-of-range, handled by other checks

    const order = overrides[key] || [];
    const activeIds = new Set((dayObj.exercises || []).map(e => e.id));
    const seenInNewOrder = new Set();
    const newOrder = [];
    let keyChanged = false;

    order.forEach(id => {
      if(activeIds.has(id)){
        if(!seenInNewOrder.has(id)){ newOrder.push(id); seenInNewOrder.add(id); }
        else keyChanged = true; // drop accidental duplicate
        return;
      }
      // ID is stale/unknown — try to resolve it to its active replacement
      keyChanged = true;
      const replacementId = exResolveActiveReplacement(id, lc);
      if(replacementId && activeIds.has(replacementId) && !seenInNewOrder.has(replacementId)){
        newOrder.push(replacementId);
        seenInNewOrder.add(replacementId);
        changeLog.push(`${key}: ${id} → ${replacementId} (resolved active replacement)`);
      } else {
        changeLog.push(`${key}: ${id} removed (no active replacement found)`);
      }
    });

    if(keyChanged){
      lc.orderOverrides[key] = newOrder;
      touched = true;
    }
  });

  if(touched){
    saveLifecycle(lc);
    console.log("[MarcusFit] 9.4.8.2.1: Order Override Integrity Fix applied.");
    changeLog.forEach(line => console.log("[MarcusFit] 9.4.8.2.1: " + line));
  } else {
    console.log("[MarcusFit] 9.4.8.2.1: Order Override Integrity Fix — nothing to do, all overrides already valid.");
  }
}
window.mfFixOrderOverrideIntegrity = mfFixOrderOverrideIntegrity;
// ── END 9.4.8.2.1 ORDER OVERRIDE INTEGRITY FIX ───────────────────────────────

// ── END PHASE 9.4.7 ──────────────────────────────────────────────────────────

// Smoke test: confirm registration on load
console.log("[MarcusFit] Progression diagnostics ready:", {
  mfProgressionDebug: typeof window.mfProgressionDebug,
  mfProgressionAudit: typeof window.mfProgressionAudit
});

// Feature 4: Render progression diagnostics into the Export tab UI section
function p945RenderDiag(){
  const grid = document.getElementById("p945CountGrid");
  const warnEl = document.getElementById("p945Warnings");
  if(!grid || !warnEl) return;

  let audit;
  try { audit = window.mfProgressionAudit(); }
  catch(e){ grid.innerHTML='<div style="font-size:11px;color:var(--red);">Error: '+e.message+'</div>'; return; }

  if(audit.error){ grid.innerHTML='<div style="font-size:11px;color:var(--red);">'+audit.error+'</div>'; return; }

  const sc = audit.statusCounts;
  const colorMap = {
    progress_load:"green", target_reset:"red", safer_hold:"yellow",
    top_range_hold:"yellow", capped_hold:"yellow", build_reps:"accent", new:"", unknown:"red"
  };
  const labelMap = {
    progress_load:"↑ Progress", target_reset:"⚠ Reset Hold", safer_hold:"⚠ Safer Hold",
    top_range_hold:"→ Top Range", capped_hold:"→ Capped", build_reps:"→ Build Reps", new:"New", unknown:"Unknown"
  };
  const order = ["progress_load","build_reps","top_range_hold","capped_hold","safer_hold","target_reset","new","unknown"];
  grid.innerHTML = order.filter(k=>sc[k]>0||k==="target_reset"||k==="progress_load").map(k=>{
    const c = colorMap[k]||"";
    return `<div class="p945-count-card"><div class="p945-count-label">${labelMap[k]}</div><div class="p945-count-val${c?" "+c:""}">${sc[k]||0}</div></div>`;
  }).join("");

  if(audit.warnings && audit.warnings.length){
    warnEl.innerHTML = `<div class="p945-warn-title">⚠ ${audit.warnings.length} Warning${audit.warnings.length!==1?"s":""}</div>` +
      audit.warnings.map(w=>`<div class="p945-warn-item">${w}</div>`).join("");
  } else {
    warnEl.innerHTML = `<div class="p945-no-warn">✅ No warnings — all ${audit.totalExercises} exercises processed cleanly.</div>`;
  }
}

function p945ToggleDiag(){
  const sec = document.getElementById("p945DiagSection");
  if(!sec) return;
  sec.classList.toggle("open");
  if(sec.classList.contains("open")) p945RenderDiag();
}

// ── END v9.4.5 PROGRESSION DEBUG HELPERS ─────────────────────────────────────

function renderWoExercises(){
  const dayIdx=document.getElementById("woDaySelect").value;
  const noteEl=document.getElementById("woDayNoteOut"),logEl=document.getElementById("woExerciseLog");
  // v9.4.4 Bug 4: always clear exercise log DOM before building new state
  logEl.innerHTML="";
  if(dayIdx===""){noteEl.textContent="";logEl.innerHTML='<div class="no-workout-msg">Select the day you trained above to log your sets.</div>';renderWoRecs();return;}
  const dayIdxInt = parseInt(dayIdx);

  // 9.4.8.2: resolve day from getResolvedDays (handles base + virtual)
  const resolvedDays = getResolvedDays(logGym);
  const day = resolvedDays.find(d => d._dayIdx === dayIdxInt) || null;

  if(!day){
    noteEl.textContent="";
    logEl.innerHTML='<div class="no-workout-msg">Day not found.</div>';
    renderWoRecs();
    return;
  }

  const eday=getEffectiveDayMeta(logGym,dayIdxInt,day);
  noteEl.textContent=eday.note||"";

  // 9.4.8.2: Virtual day with no exercises — show safe empty state
  if(day._isVirtual && (!day.exercises || day.exercises.length === 0)){
    logEl.innerHTML='<div class="no-workout-msg">No exercises added to this virtual day yet.</div>';
    renderWoRecs();
    return;
  }

  // v9.4.4 Bug 4: only load saved data for the exact selected date; never bleed across dates
  const saved=getTodayWoData();
  day.exercises.forEach(ex=>{
    const nm=getF(ex.id,"name",ex.name),ld=getF(ex.id,"load",ex.load||""),ri=getF(ex.id,"rir",ex.rir||""),st=parseInt(getF(ex.id,"sets",ex.sets||"3"))||3;
    const block=document.createElement("div");block.className="wo-ex-block";
    // v9.4.4 Bug 4: only use savedEx if it actually came from today's exact key (getTodayWoData handles this)
    const savedEx=(saved.exercises&&saved.exercises[ex.id])||{sets:[]};
    // v9.4.4: compute progression status once per exercise so prefill can align with badge
    const p942last = p5GetLastEntry(ex.id);
    const p942status = p9GetProgressionStatus(ex.id, p942last && p942last.validSets.length ? p942last.validSets : null, getF(ex.id,"reps",ex.reps||""), ri);
    // Label helpers: RIR* marks a safer-hold floor
    const wtColLabel  = "Weight";
    const isSaferHold = p942status === "safer_hold" || p942status === "safer-hold";
    const rirColLabel = isSaferHold ? "RIR*" : "RIR";
    const saferHoldNote = isSaferHold ? `<div class="p9-safer-hold-note">*RIR floor raised — keep load, stop with more in reserve</div>` : "";
    let setRowsHTML=`<div class="wo-set-labels"><span class="wo-set-label wt">${wtColLabel}</span><span class="wo-set-label rp">Reps</span><span class="wo-set-label ri">${rirColLabel}</span></div><div class="wo-set-rows">`;
    for(let s=0;s<st;s++){
      // v9.4.4: use aligned prefill; savedEx only has data when today's key has been saved
      const pf = p9ComputePrefill(ex.id, s, savedEx.sets, p942status, getF(ex.id,"reps",ex.reps||""), ri);
      const rirOptsS=["0","1","1\u20132","2","2\u20133","3","3+","\u2014"].map(v=>`<option value="${v}"${pf.rir===v?" selected":""}>${v==="\u2014"?"N/A":"RIR "+v}</option>`).join("");
      setRowsHTML+=`<div class="wo-set-row"><div class="wo-set-num"><span class="wo-set-num-n">S${s+1}</span></div><input class="wo-set-wt" type="text" placeholder="${ld}" value="${pf.wt}" data-exid="${ex.id}" data-set="${s}" data-field="wt"><input class="wo-set-reps" type="text" placeholder="reps" value="${pf.reps}" data-exid="${ex.id}" data-set="${s}" data-field="reps"><select class="wo-set-rir" data-exid="${ex.id}" data-set="${s}" data-field="rir">${rirOptsS}</select></div>`;
    }
    setRowsHTML+='</div>';
    const p5Html = p5Block(ex.id, getF(ex.id,"reps",ex.reps||""), ri);
    const bl=getF(ex.id,"blurb",ex.blurb||"");
    // v9.4.4 Bug 5: suppress coach text that contains a specific load conflicting with target_reset
    let blurbHtml="";
    if(bl){
      const blurbLoadMatch = bl.match(/\b(\d+(?:\.\d+)?)\s*(?:lb|lbs|\/side)?\b/);
      if(p942status === "target_reset" && blurbLoadMatch){
        const tlr = p9GetTargetLoadRangeForExercise(ex.id);
        const blurbLoad = parseFloat(blurbLoadMatch[1]);
        if(tlr && blurbLoad > tlr.high + 2){
          blurbHtml=`<div class="wo-ex-coach">Coach: Follow the target and progression note below.</div>`;
        } else {
          blurbHtml=`<div class="wo-ex-coach">Coach: ${bl}</div>`;
        }
      } else {
        blurbHtml=`<div class="wo-ex-coach">Coach: ${bl}</div>`;
      }
    }
    block.innerHTML=`<div class="wo-ex-name">${nm}</div><div class="wo-ex-target">Target: <span>${st} sets × ${getF(ex.id,"reps",ex.reps||"")} @ ${ld}</span> · RIR ${ri}</div>${blurbHtml}${p5Html}${setRowsHTML}${saferHoldNote}<input class="wo-note-input" type="text" placeholder="Notes for this exercise..." value="${(savedEx.note||"").replace(/"/g,'&quot;')}" data-exid="${ex.id}" data-field="exnote">`;
    logEl.appendChild(block);
  });
  renderWoRecs();
}

function getTodayWoData(){try{return JSON.parse(localStorage.getItem(dKey(tDate)+"-wo")||"{}")}catch{return{}}}

function collectWoData(){
  const dayIdx=document.getElementById("woDaySelect").value;
  if(dayIdx==="")return null;
  const dayIdxInt = parseInt(dayIdx);
  // 9.4.8.2: resolve day from getResolvedDays (handles base + virtual)
  const resolvedDays = getResolvedDays(logGym);
  const day = resolvedDays.find(d => d._dayIdx === dayIdxInt) || null;
  if(!day) return null;
  const exData={};
  (day.exercises||[]).forEach(ex=>{
    const st=parseInt(getF(ex.id,"sets",ex.sets||"3"))||3;const sets=[];
    for(let s=0;s<st;s++){
      const wt=document.querySelector(`input[data-exid="${ex.id}"][data-set="${s}"][data-field="wt"]`);
      const reps=document.querySelector(`input[data-exid="${ex.id}"][data-set="${s}"][data-field="reps"]`);
      const rir=document.querySelector(`select[data-exid="${ex.id}"][data-set="${s}"][data-field="rir"]`);
      sets.push({wt:wt?wt.value:"",reps:reps?reps.value:"",rir:rir?rir.value:""});
    }
    const noteEl=document.querySelector(`input[data-exid="${ex.id}"][data-field="exnote"]`);
    if(sets.some(s=>s.wt||s.reps)||(noteEl&&noteEl.value)){exData[ex.id]={sets,note:noteEl?noteEl.value:""};}
  });
  return{gym:logGym,dayIdx,dayName:day.name,exercises:exData};
}

function updateTrackerDate(){document.getElementById("trackerDateLabel").textContent=tDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});p85CheckFutureDate();loadDay();p949HideReview();}
function shiftDay(d){tDate.setDate(tDate.getDate()+d);updateTrackerDate();}
function dKey(d){return"day-"+d.toISOString().slice(0,10);}

// ── PHASE 8.5: FUTURE DATE HELPERS ───────────────────────────────────────────
function p85DaysFromToday(d){
  const today=new Date();today.setHours(0,0,0,0);
  const cmp=new Date(d);cmp.setHours(0,0,0,0);
  return Math.round((cmp-today)/(1000*60*60*24));
}

function p85CheckFutureDate(){
  const warn=document.getElementById("futureDateWarning");
  if(!warn)return;
  const diff=p85DaysFromToday(tDate);
  if(diff>7){
    warn.style.display="block";
    console.log("[MarcusFit] Future date warning triggered: "+diff+" days ahead");
  } else {
    warn.style.display="none";
  }
}
// ── END PHASE 8.5 FUTURE DATE HELPERS ────────────────────────────────────────

// ── PHASE 9.4.9: WORKOUT REVIEW AFTER SAVE ───────────────────────────────────
// Deterministic, local-only review of the workout that was just saved.
// Reuses existing history/progression helpers (p9GetExerciseHistory,
// p9GetProgressionStatus, p9GetTopActualLoad, p5ParseRir, getF, getResolvedDays).
// No new localStorage keys — this is generated fresh from woData + existing logs
// every time and is not persisted.

// History for one exercise, excluding the entry that was just saved for tDate.
// p9GetExerciseHistory() already excludes literal "today" (dKey(new Date())),
// which covers the common case. This wrapper also excludes dKey(tDate) so
// back-dated/future-dated logs never get compared against themselves.
function p949GetPriorHistory(exId){
  const excludeKey = dKey(tDate);
  return p9GetExerciseHistory(exId).filter(h => h.dateKey !== excludeKey);
}

// Build a review object from the woData just saved (see collectWoData()).
// Returns null if there's nothing to review (no day selected).
function p949BuildWorkoutReview(woData){
  if(!woData || !woData.exercises) return null;

  const dayIdxInt = parseInt(woData.dayIdx);
  const resolvedDays = getResolvedDays(woData.gym);
  const day = resolvedDays.find(d => d._dayIdx === dayIdxInt) || null;

  const gymLabel = woData.gym === "home" ? "Home" : woData.gym === "partial" ? "Partial" : (woData.gym || "");
  const dayName = woData.dayName || (day && (day.name || day.day)) || "Workout";

  const loggedIds = Object.keys(woData.exercises);
  let exercisesLogged = 0, setsLogged = 0;
  loggedIds.forEach(id => {
    const entry = woData.exercises[id] || {};
    const validRows = (entry.sets || []).filter(s => (s.wt && String(s.wt).trim()) || (s.reps && String(s.reps).trim()));
    if(validRows.length){ exercisesLogged++; setsLogged += validRows.length; }
  });

  if(exercisesLogged === 0){
    return { insufficient:true, gymLabel, dayName, exercisesLogged:0, setsLogged:0, wins:[], watch:[], next:[], coachNote:null };
  }

  const wins = [], watch = [], next = [];
  let anyHistory = false;
  const plannedExercises = (day && day.exercises) ? day.exercises : [];

  plannedExercises.forEach(ex => {
    let nm;
    try{ nm = getF(ex.id,"name",ex.name); }catch{ nm = ex.name || "Exercise"; }
    if(!nm) nm = "Exercise";

    const logged = woData.exercises[ex.id];
    const loggedRows = logged ? (logged.sets || []).filter(s => (s.wt && String(s.wt).trim()) || (s.reps && String(s.reps).trim())) : [];

    if(!loggedRows.length){
      watch.push(`Missed exercise: ${nm} was planned but not logged.`);
      return;
    }

    const validSets = loggedRows.filter(s => !isNaN(parseInt(s.reps)) && parseInt(s.reps) > 0);
    if(!validSets.length) return; // no numeric rep data (e.g. cardio/duration) — skip deeper analysis, still counted as logged

    let targetReps, targetRir;
    try{
      targetReps = getF(ex.id,"reps",ex.reps||"");
      targetRir  = getF(ex.id,"rir",ex.rir||"");
    }catch{ targetReps = ex.reps||""; targetRir = ex.rir||""; }

    let status = "build_reps";
    try{ status = p9GetProgressionStatus(ex.id, validSets, targetReps, targetRir) || "build_reps"; }catch{}

    let priorHist = [];
    try{ priorHist = p949GetPriorHistory(ex.id); }catch{}
    const prior = priorHist.length ? priorHist[0] : null;
    if(prior) anyHistory = true;

    let currTop = null, priorTop = null;
    try{ currTop = p9GetTopActualLoad(validSets); }catch{}
    try{ priorTop = prior ? p9GetTopActualLoad(prior.validSets) : null; }catch{}

    const currRirs = validSets.map(s => { try{ return p5ParseRir(s.rir||""); }catch{ return null; } }).filter(n => n !== null);
    const minCurrRir = currRirs.length ? Math.min(...currRirs) : null;
    let targetRirMid = null;
    try{ targetRirMid = p5ParseRir(targetRir); }catch{}

    let flaggedWin = false, flaggedWatch = false;

    // Wins: higher load, or same load with more total reps, than the previous comparable session
    if(currTop && priorTop && currTop.numeric > priorTop.numeric){
      wins.push(`${nm}: ${currTop.raw} beats previous top of ${priorTop.raw} — nice jump.`);
      flaggedWin = true;
    } else if(currTop && priorTop && currTop.numeric === priorTop.numeric && prior){
      const currTotalReps = validSets.reduce((a,s) => a + (parseInt(s.reps)||0), 0);
      const priorTotalReps = (prior.validSets||[]).reduce((a,s) => a + (parseInt(s.reps)||0), 0);
      if(currTotalReps > priorTotalReps){
        wins.push(`${nm}: matched load with more total reps than last time — building capacity.`);
        flaggedWin = true;
      }
    }
    if(!flaggedWin && (status === "progress_load" || status === "top_range_hold") && (minCurrRir === null || targetRirMid === null || minCurrRir >= targetRirMid)){
      wins.push(status === "progress_load"
        ? `${nm}: hit target with room to spare — ready to progress.`
        : `${nm}: reached top of rep range with room — progress candidate.`);
      flaggedWin = true;
    }

    // Watch list: tight RIR, failure, or hold/reset statuses
    if(minCurrRir !== null && targetRirMid !== null && minCurrRir < targetRirMid - 0.5){
      watch.push(`${nm}: RIR ran tighter than target — form/fatigue check next session.`);
      flaggedWatch = true;
    }
    if(!flaggedWatch && currRirs.length && currRirs.some(r => r <= 0)){
      watch.push(`${nm}: hit failure/near-failure RIR — keep an eye on recovery.`);
      flaggedWatch = true;
    }
    if(!flaggedWatch && (status === "safer_hold" || status === "target_reset")){
      watch.push(status === "target_reset"
        ? `${nm}: target reset — programmed load is below recent best, rebuild clean reps.`
        : `${nm}: RIR was tight last time — hold load until reps-in-reserve improves.`);
      flaggedWatch = true;
    }

    // Next-time guidance, keyed off progression status
    if(status === "progress_load") next.push(`${nm}: clear to bump load next session.`);
    else if(status === "build_reps") next.push(`${nm}: hold load, build reps toward top of range.`);
    else if(status === "safer_hold") next.push(`${nm}: hold load, prioritize RIR before adding weight.`);
    else if(status === "target_reset") next.push(`${nm}: reset to programmed target and rebuild clean reps.`);
    else if(status === "top_range_hold") next.push(`${nm}: confirm clean form and RIR before calling it progress.`);
    else if(status === "capped_hold") next.push(`${nm}: at load ceiling — hold clean, or ask AI Sync for a swap if it's been stale a while.`);
  });

  // Bodybuilding/physique coach note, day-type aware where possible
  let coachNote = "Solid session overall. Don't overreact to one off day if sleep or energy was low.";
  if(day){
    try{
      const dayType = (typeof p9489ClassifyDayType === "function") ? p9489ClassifyDayType(day) : "other";
      const NOTES = {
        push: "Good push-day bias. Keep lateral delt and upper chest work clean before chasing load.",
        pull: "Lat width is the priority on pull days — control the stretch before adding weight.",
        shoulders: "Shoulder-focused day — lateral delt volume is intentional here, not redundant.",
        pump_taper: "Pump/taper day — control and stimulus matter more than load here.",
        lower: "Legs are maintenance during the current phase — steady effort is enough.",
        core: "Core work — control and tension over speed or load.",
        arms: "Arms day — long-head triceps emphasis is the priority for growth.",
        cardio: "Cardio session — no load-progression logic applies here."
      };
      coachNote = NOTES[dayType] || coachNote;
    }catch{}
  }

  return {
    insufficient:false,
    noHistoryYet: !anyHistory,
    gymLabel, dayName, exercisesLogged, setsLogged,
    wins, watch, next, coachNote
  };
}

// Render the review object into the review card and show it.
function p949RenderReview(review){
  const card = document.getElementById("p949ReviewCard");
  const body = document.getElementById("p949ReviewBody");
  if(!card || !body) return;
  if(!review){ card.style.display = "none"; return; }

  let html = `<div class="p949-section"><div class="p949-line summary-line">${review.gymLabel} · ${review.dayName}</div>`;
  if(!review.insufficient){
    html += `<div class="p949-line summary-line">${review.exercisesLogged} exercise${review.exercisesLogged===1?"":"s"} · ${review.setsLogged} set${review.setsLogged===1?"":"s"} logged</div>`;
  }
  html += `</div>`;

  if(review.insufficient){
    html += `<div class="p949-section"><div class="p949-empty-note">Workout saved. More useful comparisons will appear after another logged session.</div></div>`;
    body.innerHTML = html;
    card.style.display = "block";
    return;
  }

  if(review.wins.length){
    html += `<div class="p949-section"><div class="p949-section-label wins">Wins</div>`;
    review.wins.forEach(w => html += `<div class="p949-line">${w}</div>`);
    html += `</div>`;
  }
  if(review.watch.length){
    html += `<div class="p949-section"><div class="p949-section-label watch">Watch</div>`;
    review.watch.forEach(w => html += `<div class="p949-line">${w}</div>`);
    html += `</div>`;
  }
  if(review.next.length){
    html += `<div class="p949-section"><div class="p949-section-label next">Next time</div>`;
    review.next.forEach(n => html += `<div class="p949-line">${n}</div>`);
    html += `</div>`;
  }
  if(!review.wins.length && !review.watch.length && !review.next.length){
    html += `<div class="p949-section"><div class="p949-empty-note">${review.noHistoryYet ? "First logged session for this day — more useful comparisons will appear after another logged session." : "Logged clean — nothing notable to flag this time."}</div></div>`;
  }
  if(review.coachNote){
    html += `<div class="p949-section"><div class="p949-section-label coach">Coach note</div><div class="p949-line">${review.coachNote}</div></div>`;
  }

  body.innerHTML = html;
  card.style.display = "block";
}

function p949HideReview(){
  const card = document.getElementById("p949ReviewCard");
  if(card) card.style.display = "none";
}

// Console-testable global: mfWorkoutReviewDebug() rebuilds a review from
// whatever is currently in the log form (does not require re-saving).
window.mfWorkoutReviewDebug = function(){
  try{
    const woData = collectWoData();
    const review = p949BuildWorkoutReview(woData);
    console.log("[MarcusFit] mfWorkoutReviewDebug():", review);
    return review;
  }catch(e){
    console.warn("[MarcusFit] mfWorkoutReviewDebug() failed safely:", e && e.message);
    return {error: e && e.message};
  }
};
var mfWorkoutReviewDebug = window.mfWorkoutReviewDebug;
// ── END PHASE 9.4.9 ──────────────────────────────────────────────────────────

function saveDay(){
  // Feature 3: Show inline confirmation for extreme future dates (native confirm() blocked in iOS PWA)
  const futureDiff = p85DaysFromToday(tDate);
  if(futureDiff > 30){
    document.getElementById("futureSaveConfirm").style.display = "block";
    document.getElementById("futureSaveConfirm").scrollIntoView({behavior:"smooth",block:"nearest"});
    return; // halt — wait for user to confirm or cancel
  }
  p85ExecuteSave();
}

function p85ConfirmFutureSave(){
  document.getElementById("futureSaveConfirm").style.display = "none";
  p85ExecuteSave();
}

function p85CancelFutureSave(){
  document.getElementById("futureSaveConfirm").style.display = "none";
}

function p85ExecuteSave(){
  // Save workout data
  const woData=collectWoData();
  if(woData)localStorage.setItem(dKey(tDate)+"-wo",JSON.stringify(woData));

  const data={
    date:tDate.toISOString().slice(0,10),
    weight:document.getElementById("weightIn").value,
    sleep:document.getElementById("sleepIn").value,
    protein:document.getElementById("proteinIn").value,
    water:document.getElementById("waterIn").value,
    bm:toggleStates.bm,
    bmNotes:document.getElementById("bmNotes").value,
    mood:document.getElementById("moodSlider").value,
    hunger:document.getElementById("hungerSlider").value,
    workout:toggleStates.wo,
    zep:toggleStates.zep,
    logGym,
    woDayIdx:document.getElementById("woDaySelect").value,
    notes:document.getElementById("dayNotes").value,
    habits:habitState
  };

  // Overwrite same-day entry cleanly (no duplicates — keyed by date)
  localStorage.setItem(dKey(tDate),JSON.stringify(data));

  // Clear draft once officially saved
  if(isTodaySelected()) clearDraft();

  const btn=document.getElementById("saveBtn");
  const wasUpdate=todayHasSavedEntry(); // check AFTER saving to confirm
  btn.textContent=wasUpdate?"\u270F\uFE0F UPDATED!":"\u2705 SAVED!";
  setTimeout(()=>updateSaveBtn(),1800);
  renderHistory();

  // PHASE 9.4.9: Workout Review After Save — only when a day/workout was actually logged
  try{
    if(woData){
      const review=p949BuildWorkoutReview(woData);
      p949RenderReview(review);
      const card=document.getElementById("p949ReviewCard");
      if(card&&card.style.display!=="none") card.scrollIntoView({behavior:"smooth",block:"nearest"});
    } else {
      p949HideReview();
    }
  }catch(e){
    console.warn("[MarcusFit] 9.4.9: workout review failed safely:",e&&e.message);
    p949HideReview();
  }
}

function loadDay(){
  // For today: check if there's a live draft first (only show banner, don't auto-apply)
  // For past/future dates: load from history directly
  if(isTodaySelected()){
    const draft=getDraft();
    if(draft&&draft.date===todayStr()&&!todayHasSavedEntry()){
      // Don't auto-apply — banner handles this. Just clear fields.
      applyStateToForm({});
      document.getElementById("resumeBanner").classList.add("visible");
      updateSaveBtn();
      return;
    }
  }

  // Load from saved history (past days or today already saved)
  document.getElementById("resumeBanner").classList.remove("visible");
  const raw=localStorage.getItem(dKey(tDate)),d=raw?JSON.parse(raw):{};
  applyStateToForm(d);
  // For past days, also restore workout set data from -wo key
  if(d.woDayIdx!==undefined&&d.woDayIdx!==""){
    const woRaw=localStorage.getItem(dKey(tDate)+"-wo");
    if(woRaw){try{restoreWoDataToForm(JSON.parse(woRaw));}catch{}}
  }
  updateSaveBtn();
}

function renderHistory(){
  // Delegate to P7 filter-aware renderer
  p7ApplyFilters();
}

// ── PHASE 3: EXPORT RANGE HELPERS ────────────────────────────────────────────
function getExportDkeys(){
  const val=document.getElementById("exportRangeSelect").value;
  const allKeys=Object.keys(localStorage).filter(k=>k.startsWith("day-")&&!k.endsWith("-wo")).sort();
  if(val==="program")return[];
  if(val==="full")return allKeys;
  const days=parseInt(val);
  const cutoff=new Date();cutoff.setDate(cutoff.getDate()-days);cutoff.setHours(0,0,0,0);
  const cutoffStr=cutoff.toISOString().slice(0,10);
  return allKeys.filter(k=>k.replace("day-","")>=cutoffStr);
}

function updateExportMeta(){
  const val=document.getElementById("exportRangeSelect").value;
  const meta=document.getElementById("exportMeta");
  const allKeys=Object.keys(localStorage).filter(k=>k.startsWith("day-")&&!k.endsWith("-wo")).sort();
  if(val==="program"){
    meta.innerHTML="\uD83D\uDCCB <span>Program templates only</span> \u2014 no daily logs included";
  } else {
    const dkeys=getExportDkeys();
    const label=val==="full"?"all <span>"+allKeys.length+"</span>":"<span>"+dkeys.length+"</span>";
    const rangeLabel=val==="full"?"full history":"last "+val+" days";
    meta.innerHTML="\uD83D\uDCC5 Including "+label+" log day"+(dkeys.length!==1?"s":"")+" ("+rangeLabel+") out of <span>"+allKeys.length+"</span> total";
  }
  document.getElementById("exportOut").style.display="none";
  document.getElementById("copyBtn").style.display="none";
}

function buildLogSection(dkeys,allDkeys){
  if(!dkeys.length)return"";
  const val=document.getElementById("exportRangeSelect").value;
  const rangeLabel=val==="full"?"FULL HISTORY":"LAST "+val+" DAYS ("+dkeys.length+" of "+allDkeys.length+" total logged days)";
  let logSection="--- DAILY LOG: "+rangeLabel+" ---\n\n";
  dkeys.forEach(function(k){
    const d=JSON.parse(localStorage.getItem(k));
    const dt=new Date(d.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"});
    logSection+="\uD83D\uDCC5 "+dt+"\n";
    if(d.weight)logSection+="  Weight:  "+d.weight+" lbs\n";
    if(d.sleep)logSection+="  Sleep:   "+d.sleep+" hrs\n";
    if(d.protein)logSection+="  Protein: "+d.protein+"g\n";
    if(d.water)logSection+="  Water:   "+d.water+" oz\n";
    if(d.hunger)logSection+="  Hunger:  "+d.hunger+"/10\n";
    if(d.mood)logSection+="  Energy:  "+d.mood+"/10\n";
    if(d.bm)logSection+="  BM:      "+d.bm+(d.bmNotes?" \u2014 "+d.bmNotes:"")+"\n";
    if(d.zep)logSection+="  Zepbound: "+d.zep+"\n";
    if(d.workout)logSection+="  Workout: "+d.workout+"\n";
    if(d.habits){
      const habitsDone=HABITS.filter(function(h){return d.habits[h.id]&&d.habits[h.id].completed;});
      logSection+="  Habits:  "+habitsDone.length+"/"+HABITS.length+" completed";
      if(habitsDone.length)logSection+=" ("+habitsDone.map(function(h){return h.name;}).join(", ")+")";
      logSection+="\n";
      HABITS.forEach(function(h){const hs=d.habits[h.id];if(hs&&hs.notes)logSection+="    "+h.name+" note: "+hs.notes+"\n";});
    }
    const woRaw=localStorage.getItem(k+"-wo");
    if(woRaw){
      const wo=JSON.parse(woRaw);
      if(wo.exercises&&Object.keys(wo.exercises).length){
        const RP=getResolvedProgram();
        // 9.4.8.3: use getSafeDayForLog — handles base + virtual days safely
        const gymKey = wo.gym||"home";
        const dayData = getSafeDayForLog(gymKey, wo.dayIdx);
        const dayName = getSafeDayDisplayName(gymKey, wo.dayIdx);
        if(dayData || dayName){
          logSection+="  Gym: "+gymKey+" | Day: "+dayName+"\n";
          (dayData ? dayData.exercises||[] : []).forEach(function(ex){
            const exLog=wo.exercises[ex.id];if(!exLog)return;
            const nm=getF(ex.id,"name",ex.name),ld=getF(ex.id,"load",ex.load),ri=getF(ex.id,"rir",ex.rir);
            const validSets=exLog.sets.filter(function(s){return s.wt||s.reps;});if(!validSets.length)return;
            logSection+="  ["+ex.id+"] "+nm+" (target: "+ld+" / RIR "+ri+")\n";
            validSets.forEach(function(s,i){logSection+="    Set "+(i+1)+": "+(s.wt||"\u2014")+" \xd7 "+(s.reps||"\u2014")+" reps @ RIR "+(s.rir||"\u2014")+"\n";});
            if(exLog.note)logSection+="    Note: "+exLog.note+"\n";
          });
        }
      }
    }
    if(d.notes)logSection+="  Notes:   "+d.notes+"\n";
    logSection+="\n";
  });
  return logSection;
}

// ── PHASE 9.4.8.9/10: EXERCISE ROTATION / SWAP CANDIDATE EXPORT INTELLIGENCE ─
// Export-intelligence only. Read-only diagnostics for the AI export — does NOT
// modify the program, exercises, order, lifecycle state, or logging behavior.
// Reuses existing resolved-program (getResolvedDays), progression
// (p9GetExerciseHistory / p9GetProgressionStatus), and field-override (getF)
// systems rather than duplicating them. Wrapped defensively so sparse/missing
// data degrades to "insufficient data" text instead of throwing.

// Lightweight name-based muscle/pattern classifier. Best-effort heuristic —
// not a scoring engine. Checked in priority order (most specific first).
function p9489ClassifyExercise(name){
  const n = (name||"").toLowerCase();
  const rules = [
    ["lateral_delt", /lateral raise|side raise|leaning.*raise/],
    ["rear_delt", /rear delt|reverse (pec )?deck|rear fly|face pull/],
    ["upper_chest", /incline (bench|press|fly|cable fly|machine press)|low-to-high cable fly|reverse-grip press/],
    ["long_head_tricep", /overhead.*extension|pjr pullover|skull crusher|cross-body.*extension|french press/],
    ["lat_width", /pulldown|pull-?up|chin-?up|straight-arm pulldown|machine pullover|assisted pull/],
    ["upper_back", /\brow\b|high row|chest-supported row/],
    ["biceps", /curl/],
    ["triceps_other", /pushdown|kickback|dip|extension/],
    ["core", /crunch|plank|\bab(s)?\b|\bcore\b/],
    ["legs", /squat|leg press|lunge|leg extension|leg curl|calf|deadlift|hip thrust|\brdl\b/],
    ["chest_press", /bench press|chest press|push-?up|\bpress\b/],
  ];
  for(const [cat, re] of rules){ if(re.test(n)) return cat; }
  return "other";
}

// Day-type classifier (9.4.8.10). Tag first (reliable on base days), then
// name-keyword fallback for virtual/added/override days like "CORE & ABS"
// or "SHOULDERS & ARMS" that don't carry a matching tag. Drives which
// Priority 1 muscles are relevant to a day and which categories are
// expected specialization clusters rather than redundancy.
function p9489ClassifyDayType(day){
  const tag = ((day.tag)||"").toUpperCase();
  const nm = ((day.name || day.day || "")+"").toLowerCase();
  if(tag==="LOWER" || /\blower\b/.test(nm)) return "lower";
  if(tag==="CARDIO" || /cardio/.test(nm)) return "cardio";
  if(/core|\babs?\b/.test(nm)) return "core";
  if(tag==="ARMS" && !/shoulder/.test(nm)) return "arms";
  if(/shoulder|delt.?cap/.test(nm)) return "shoulders";
  if(tag==="PUMP" || /taper|pump/.test(nm)) return "pump_taper";
  if(tag==="PUSH") return "push";
  if(tag==="PULL") return "pull";
  return "other";
}

// Which Priority 1 muscles (lateral delt, upper chest, lat width) are
// coaching-relevant to check for on a given day type. Lower/core/cardio/
// arms/specialization days aren't the place to expect these.
const P9489_RELEVANT_P1_BY_DAYTYPE = {
  lower: [], core: [], cardio: [], arms: [], shoulders: [], pump_taper: [],
  push: ["upper_chest","lateral_delt"],
  pull: ["lat_width"],
  other: ["lateral_delt","upper_chest","lat_width"]
};

// Categories that are the intentional signature of a given day type — 3+
// occurrences here is a specialization cluster, not redundancy.
const P9489_EXPECTED_CLUSTER_BY_DAYTYPE = {
  core: ["core"],
  shoulders: ["lateral_delt"],
  pump_taper: ["lateral_delt"],
  arms: ["biceps","triceps_other","long_head_tricep"]
};

// Pull recent progression signal for one exercise using the existing history
// + progression-status helpers. Returns {hasData:false} if no valid logged
// sessions exist yet — callers must treat that as "insufficient data", not
// as a stale/capped signal.
function p9489GetRecentExerciseSignals(ex){
  const hist = p9GetExerciseHistory(ex.id); // already sorted newest-first
  if(!hist.length) return {hasData:false};
  const targetReps = getF(ex.id,"reps",ex.reps);
  const targetRir  = getF(ex.id,"rir",ex.rir);
  const recent = hist.slice(0,5);
  const statuses = recent.map(h => p9GetProgressionStatus(ex.id, h.validSets, targetReps, targetRir));
  return {
    hasData: true,
    sessionCount: hist.length,
    recentCount: recent.length,
    statuses,
    progressCount: statuses.filter(s => s==="progress_load").length,
    cappedCount: statuses.filter(s => s==="capped_hold" || s==="top_range_hold").length
  };
}

// Analyze the resolved program (both gyms, base + virtual/additive days) and
// return candidate rotation/swap signals plus weak-point/order notes.
// Read-only — uses getResolvedDays() so overrides, custom exercises, and
// virtual days are all reflected without re-deriving that logic here.
function p9489AnalyzeExerciseRotation(){
  const candidates = [];
  const weakPointNotes = [];
  let daysAnalyzed = 0;
  let exercisesWithData = 0;
  // Result caps — surface only the highest-value issues instead of every
  // borderline signal. Lists are severity-ranked before slicing.
  const MAX_CANDIDATES = 8;
  const MAX_WEAKPOINTS = 6;

  ["home","partial"].forEach(function(g){
    const days = getResolvedDays(g);
    days.forEach(function(day){
      const exercises = day.exercises || [];
      if(!exercises.length) return;
      daysAnalyzed++;
      const dayLabel = (day.name || day.day || "Day") + (day._isVirtual ? " [added]" : "");
      const dayType = p9489ClassifyDayType(day);
      const relevantP1 = P9489_RELEVANT_P1_BY_DAYTYPE.hasOwnProperty(dayType)
        ? P9489_RELEVANT_P1_BY_DAYTYPE[dayType] : P9489_RELEVANT_P1_BY_DAYTYPE.other;
      const expectedClusters = P9489_EXPECTED_CLUSTER_BY_DAYTYPE[dayType] || [];

      const classified = exercises.map(function(ex, idx){
        const nm = getF(ex.id,"name",ex.name);
        return {ex, idx, nm, cat: p9489ClassifyExercise(nm)};
      });

      // Stale / capped-progression signals per exercise
      classified.forEach(function(c){
        const sig = p9489GetRecentExerciseSignals(c.ex);
        if(!sig.hasData) return; // insufficient data for this exercise — skip silently
        exercisesWithData++;
        const capped = sig.recentCount>=2 && sig.cappedCount>=2;
        const stale  = !capped && sig.recentCount>=3 && sig.progressCount===0;
        if(capped){
          candidates.push({
            name:c.nm, gym:g, day:dayLabel, signal:"capped", severity:3,
            reason:"Recent sessions show repeated top-range/capped progression status with limited load movement.",
            action:"replace, or recommendation if a rep-range reset is enough",
            note:"May need a harder variation, loading change, cable/machine alternative, or rep-range reset."
          });
        } else if(stale){
          candidates.push({
            name:c.nm, gym:g, day:dayLabel, signal:"stale", severity:2,
            reason:"Repeated recent exposure ("+sig.recentCount+" of last sessions logged) with no clear progression signal.",
            action:"replace, reorder, or recommendation",
            note:"Consider a swap, rep-range change, intensity technique, or order change if this matches Marcus's experience."
          });
        }
      });

      // Literal duplicate-exercise bloat — the SAME exercise (by normalized
      // name) appearing 2+ times on one day. This is real bloat regardless
      // of day type/category, so it's checked independent of the
      // specialization-cluster exemption below.
      const nameCounts = {};
      classified.forEach(function(c){
        const key = c.nm.trim().toLowerCase();
        (nameCounts[key] = nameCounts[key]||[]).push(c.nm);
      });
      Object.keys(nameCounts).forEach(function(key){
        if(nameCounts[key].length>=2){
          candidates.push({
            name: nameCounts[key][0], gym:g, day:dayLabel, signal:"duplicate", severity:4,
            reason: nameCounts[key].length+" instances of the same exercise appear on this day.",
            action:"remove duplicate, or replace one instance with a complementary movement",
            note:"This is likely a real duplication rather than intentional specialization — worth a direct look."
          });
        }
      });

      // Redundant pattern signal — 3+ exercises in the same day sharing a
      // pattern/muscle category (excluding legs and uncategorized "other").
      // Day types with an expected specialization cluster for this category
      // (e.g. lateral delt on a SHOULDERS/TAPER PUMP day, core on a CORE
      // day, biceps/triceps on an ARMS day) are exempt — that's the day
      // working as designed, not redundancy.
      const catCounts = {};
      classified.forEach(function(c){ catCounts[c.cat] = (catCounts[c.cat]||0)+1; });
      Object.keys(catCounts).forEach(function(cat){
        if(catCounts[cat]>=3 && cat!=="other" && cat!=="legs" && expectedClusters.indexOf(cat)===-1){
          candidates.push({
            name: classified.filter(function(c){return c.cat===cat;}).map(function(c){return c.nm;}).join(", "),
            gym:g, day:dayLabel, signal:"redundant", severity:1,
            reason: catCounts[cat]+" exercises on this day emphasize a similar pattern ("+cat.replace("_"," ")+").",
            action:"review, reorder, or replace",
            note:"Consider trimming the overlap in favor of an underemphasized priority muscle."
          });
        }
      });

      // Weak-point gap — a Priority 1 muscle that's actually relevant to
      // THIS day type is entirely missing from a substantive day (3+
      // exercises). Lower/core/cardio/arms/specialization days have an
      // empty relevantP1 list, so they're naturally skipped rather than
      // flagged for upper-body muscles that were never the point.
      const presentCats = new Set(classified.map(function(c){return c.cat;}));
      const missingP1 = relevantP1.filter(function(p){return !presentCats.has(p);});
      if(missingP1.length && exercises.length>=3){
        weakPointNotes.push({
          day:dayLabel, gym:g, severity:3,
          reason:"Missing priority muscle emphasis: "+missingP1.map(function(m){return m.replace("_"," ");}).join(", ")+".",
          action:"recommendation, custom_exercise, or day_override"
        });
      }

      // Arms-day secondary check — arms days should mostly care about
      // biceps/triceps, especially long-head triceps (the biggest driver
      // of arm size). Flag only if that specific emphasis is missing.
      if(dayType==="arms" && exercises.length>=3 && !presentCats.has("long_head_tricep")){
        weakPointNotes.push({
          day:dayLabel, gym:g, severity:2,
          reason:"Arms day has biceps/triceps volume but no long-head triceps emphasis (e.g., overhead extension, PJR pullover, incline skull crusher) — long-head triceps drives arm size the most.",
          action:"recommendation, custom_exercise, or reorder"
        });
      }

      // Order gap — a relevant-for-this-day-type Priority 1 exercise sitting
      // in the back half of a longer day (4+ exercises). Restricted to
      // relevantP1 so this doesn't fire on lower/core/arms/specialization
      // days where those categories were never the day's point.
      classified.forEach(function(c){
        if(relevantP1.indexOf(c.cat)!==-1 && exercises.length>=4 && c.idx >= Math.ceil(exercises.length/2)){
          weakPointNotes.push({
            day:dayLabel, gym:g, severity:1,
            reason:c.nm+" ("+c.cat.replace("_"," ")+") is positioned late in the day (slot "+(c.idx+1)+" of "+exercises.length+").",
            action:"reorder"
          });
        }
      });
    });
  });

  // Rank by severity (highest-value issues first) and cap so the export
  // stays focused instead of noisy.
  candidates.sort(function(a,b){ return (b.severity||0)-(a.severity||0); });
  weakPointNotes.sort(function(a,b){ return (b.severity||0)-(a.severity||0); });
  const candidatesTotal = candidates.length;
  const weakPointTotal = weakPointNotes.length;

  return {
    candidates: candidates.slice(0,MAX_CANDIDATES),
    weakPointNotes: weakPointNotes.slice(0,MAX_WEAKPOINTS),
    candidatesTotal, weakPointTotal,
    daysAnalyzed, exercisesWithData
  };
}

// Format the full export section text. Never throws — falls back to an
// "insufficient data" message on any unexpected error so a sparse-data
// state can never break export generation.
function p9489FormatSwapCandidateSection(){
  const analysis = p9489AnalyzeExerciseRotation();
  const loggedDayCount = Object.keys(localStorage).filter(function(k){return k.startsWith("day-")&&k.endsWith("-wo");}).length;

  let out = "--- EXERCISE ROTATION / SWAP CANDIDATE INTELLIGENCE ---\n\n";
  out += "Purpose:\nThis section highlights possible stale movements, capped progressions, redundant patterns, weak-point gaps, and order opportunities. These are not automatic changes. Use them to decide whether AI Sync should recommend, reorder, replace, add custom exercises, override day metadata, or add optional days.\n\n";
  out += "Persistent Priority Bias:\n- Lateral delts, upper chest, and lat width should receive first-pass attention, but ONLY on days where they're actually relevant (push/pull/general upper days) — lower, core, arms, and shoulder/taper specialization days are evaluated against their own focus instead.\n- Rear delts, long-head triceps, and upper back thickness are secondary; long-head triceps is the primary secondary focus on arms days specifically.\n- Legs should generally be maintained with minimum effective volume unless logs suggest otherwise.\n\n";
  out += "Recent Data Status:\n- Recent logs available: "+(loggedDayCount>0?"yes":"no")+"\n- Number of recent logged workouts analyzed: "+loggedDayCount+"\n- Number of program days analyzed: "+analysis.daysAnalyzed+"\n\n";

  out += "Potential Swap / Rotation Candidates";
  out += (analysis.candidatesTotal>analysis.candidates.length ? " (top "+analysis.candidates.length+" of "+analysis.candidatesTotal+", ranked by severity)" : "")+":\n";
  if(analysis.candidates.length){
    analysis.candidates.forEach(function(c, i){
      out += (i+1)+". "+c.name+" ("+c.gym+" / "+c.day+") \u2014 "+c.reason+"\n";
      out += "   - Signal: "+c.signal+"\n";
      out += "   - Suggested AI action: "+c.action+"\n";
      out += "   - Coaching note: "+c.note+"\n";
    });
  } else if(analysis.exercisesWithData===0){
    out += "Insufficient recent data \u2014 no logged sessions yet to evaluate stale/capped movement candidates. Still review Priority 1 muscles for proactive bodybuilding improvements.\n";
  } else {
    out += "No strong swap candidates detected from available data. Still review Priority 1 muscles for proactive bodybuilding improvements.\n";
  }
  out += "\n";

  out += "Weak-Point / Order Opportunities";
  out += (analysis.weakPointTotal>analysis.weakPointNotes.length ? " (top "+analysis.weakPointNotes.length+" of "+analysis.weakPointTotal+", ranked by severity)" : "")+":\n";
  if(analysis.weakPointNotes.length){
    analysis.weakPointNotes.forEach(function(w, i){
      out += (i+1)+". "+w.day+" ("+w.gym+") \u2014 "+w.reason+"\n";
      out += "   - Suggested AI action: "+w.action+"\n";
    });
  } else {
    out += "No obvious weak-point or ordering gaps detected from available program structure.\n";
  }
  out += "\n";

  out += "Bodybuilding Swap Ideas To Consider:\n";
  out += "- Lateral delt: cable lateral raise, machine lateral raise, leaning lateral raise, lengthened partials\n";
  out += "- Upper chest: incline press, low-to-high cable fly, incline machine press\n";
  out += "- Lat width: assisted pull-up, neutral pulldown, one-arm cable pulldown, straight-arm pulldown\n";
  out += "- Long-head triceps: overhead cable extension, PJR pullover, incline skull crusher\n";
  out += "- Rear delt / upper back: reverse pec deck, cable rear delt fly, chest-supported row, high row\n\n";

  return out;
}

function p9489BuildSwapCandidateExport(){
  try{
    return p9489FormatSwapCandidateSection();
  }catch(e){
    console.warn("[MarcusFit] 9.4.8.10: swap candidate export failed safely:", e && e.message);
    return "--- EXERCISE ROTATION / SWAP CANDIDATE INTELLIGENCE ---\n\nInsufficient data to analyze rotation/swap candidates this export.\n\n";
  }
}
// ── END PHASE 9.4.8.10 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

// ── PHASE 9.5.7: SHARED-USER FIRST SYNC (read-only bridge) ──────────────
// FUTURE MODULES: src/export-sync.js (detection/export), src/onboarding.js
// (answer summary), and src/debug.js (console inspection). No storage key is
// introduced and this phase deliberately does not alter proposal application.
function p957GetSharedUserFirstSyncStatus(){
  const reasons=[],warnings=[];
  const signals={dailyLogCount:0,workoutLogCount:0,onboardingStatus:"unavailable",onboardingCompletedRecently:false,onboardingGeneratedCoachingContext:false,freshInstallEvidence:false,nonMarcusProfile:false,materiallyDifferentProfile:false,userSpecificIntake:false,minimalCoachingPreferences:true,inheritedBaselineCustomization:false,proposalOnlyCustomization:false,userEstablishedCustomization:false,meaningfulLifecycleCustomizations:false,meaningfulOverrides:false,proposalSourceCoverage:null};
  let onboarding=null,profile=null,proposal=null,score=0;
  try{
    const keys=Array.from({length:localStorage.length},function(_,i){return localStorage.key(i)||"";});
    signals.workoutLogCount=keys.filter(function(k){return /^day-.*-wo$/.test(k);}).length;
    signals.dailyLogCount=keys.filter(function(k){return /^day-/.test(k)&&!/-wo$/.test(k);}).length;
    onboarding=p951GetOnboardingState();
    signals.onboardingStatus=onboarding.status;
    if(onboarding.status==="completed"&&onboarding.completedAt){
      const age=Date.now()-Date.parse(onboarding.completedAt);
      signals.onboardingCompletedRecently=isFinite(age)&&age>=0&&age<=45*86400000;
    }
    try{signals.freshInstallEvidence=!!p951IsFreshInstall().isFresh;}catch(e){}
    profile=p950GetUserProfile();
    const defaults=p950GetDefaultUserProfile(),name=((profile.identity&&profile.identity.displayName)||"").trim().toLowerCase();
    signals.nonMarcusProfile=!!name&&name!=="marcus";
    signals.materiallyDifferentProfile=!!(profile.goals&&(profile.goals.primaryGoal!==defaults.goals.primaryGoal||profile.goals.physiqueOutcome!==defaults.goals.physiqueOutcome));
    const draft=(onboarding.draft&&typeof onboarding.draft==="object")?onboarding.draft:{};
    signals.userSpecificIntake=signals.nonMarcusProfile||signals.materiallyDifferentProfile||["profile","goals","training"].some(function(section){const value=draft[section];return value&&typeof value==="object"&&Object.keys(value).some(function(k){return value[k]!==null&&value[k]!==undefined&&String(value[k]).trim()!=="";});});
    const prefs=(p9GetCoachPrefs()||"").trim();
    signals.onboardingGeneratedCoachingContext=prefs.indexOf(P953_GEN_START)!==-1&&prefs.indexOf(P953_GEN_END)!==-1;
    signals.minimalCoachingPreferences=prefs.length<80||prefs===AI_PREFS_STARTER_TEMPLATE.trim();

    const lc=getLifecycle(),ov=getOvr(),hasNested=function(v){return v&&typeof v==="object"&&Object.keys(v).some(function(k){const n=v[k];return n&&typeof n==="object"?Object.keys(n).length>0:true;});};
    signals.meaningfulOverrides=Object.keys(ov||{}).length>0;
    const lifecycleFields=["inactiveIds","replacements","orderOverrides","dayOverrides","dayAdditions","customExercises","disabledDays"];
    signals.meaningfulLifecycleCustomizations=lifecycleFields.some(function(field){return hasNested(lc&&lc[field]);});
    let systemBaseline=false;
    try{systemBaseline=p951IsSystemSeededLifecycleBaseline(lc);}catch(e){}
    proposal=p954GetProposal();
    if(proposal){const metrics=p955GetProposalQualityMetrics(proposal);signals.proposalSourceCoverage=metrics.sourceCoverageCount+"/"+metrics.sourceCoverageTotal;}
    const proposalGenerated=!!(proposal&&proposal.sourceType==="local_generated");
    const onlyBaselineLikeLifecycle=!hasNested(lc&&lc.customExercises)&&!hasNested(lc&&lc.replacements)&&!hasNested(lc&&lc.orderOverrides)&&!hasNested(lc&&lc.dayAdditions);
    signals.inheritedBaselineCustomization=!!(signals.meaningfulLifecycleCustomizations&&systemBaseline);
    signals.proposalOnlyCustomization=!!(signals.meaningfulLifecycleCustomizations&&!signals.meaningfulOverrides&&onlyBaselineLikeLifecycle&&(proposalGenerated||signals.onboardingCompletedRecently||signals.onboardingGeneratedCoachingContext));
    signals.userEstablishedCustomization=!!(signals.meaningfulOverrides||(signals.meaningfulLifecycleCustomizations&&!signals.inheritedBaselineCustomization&&!signals.proposalOnlyCustomization));
  }catch(e){warnings.push("Some first-sync evidence was unavailable: "+((e&&e.message)||"unknown error"));}

  const lowLogs=signals.dailyLogCount<=2&&signals.workoutLogCount<=1;
  const establishedLogs=signals.dailyLogCount>=7||signals.workoutLogCount>=3;
  const recentIntake=signals.onboardingCompletedRecently||signals.onboardingGeneratedCoachingContext;
  const distinctUser=signals.nonMarcusProfile||signals.materiallyDifferentProfile;
  if(signals.onboardingCompletedRecently){score+=3;reasons.push("Onboarding was completed recently.");}
  else if(signals.onboardingGeneratedCoachingContext){score+=2;reasons.push("Onboarding-generated coaching context is present.");}
  if(signals.freshInstallEvidence){score+=2;reasons.push("Existing fresh-install checks found no established data.");}
  if(signals.nonMarcusProfile){score+=2;reasons.push("The saved display name is not Marcus.");}
  else if(signals.materiallyDifferentProfile){score+=2;reasons.push("The saved goal/outcome differs materially from Marcus defaults.");}
  if(signals.userSpecificIntake){score+=2;reasons.push("User-specific onboarding/profile intake details are present.");}
  if(lowLogs){score+=2;reasons.push("There are few or no daily/workout logs.");}
  if(signals.inheritedBaselineCustomization)reasons.push("Only recognized system-seeded baseline customization is present.");
  if(signals.proposalOnlyCustomization)reasons.push("Customization appears inherited or proposal-generated, not established user editing.");
  if(signals.userEstablishedCustomization){score-=3;reasons.push("Clearly user-established program customization weighs against first-sync detection.");}
  if(signals.minimalCoachingPreferences&&!signals.onboardingGeneratedCoachingContext){score+=1;reasons.push("Coaching preferences are empty or minimal.");}
  if(signals.proposalSourceCoverage&&parseInt(signals.proposalSourceCoverage,10)<=3){score+=1;reasons.push("Proposal source coverage is low or moderate.");}
  if(establishedLogs){score-=5;reasons.push("Established log history weighs against first-sync detection.");}
  const isLikelyFirstSync=recentIntake&&distinctUser&&signals.userSpecificIntake&&lowLogs&&score>=6&&!establishedLogs;
  return {isLikelyFirstSync:isLikelyFirstSync,confidence:isLikelyFirstSync?(score>=9?"high":"medium"):(score<=1?"high":"low"),reasons:reasons,signals:signals,recommendedExportMode:isLikelyFirstSync?"first_time_personalization":"standard_sync",warnings:warnings};
}
function p957CompactValue(v){return (v===null||v===undefined||v==="")?"Not provided":String(v).replace(/\s+/g," ").trim();}
function p957MakeSharedSafeExport(out){
  const sharedSafeInstructions="=== SHARED-USER AI SYNC GUIDANCE ===\n\n"
    +"Treat the onboarding/profile above as controlling context. Do not assume Zepbound/GLP-1 use, aggressive fat loss, high LDL, bodybuilding aesthetics, lateral-delt/upper-chest/lat-width priorities, Marcus's schedule, or Marcus's training philosophy unless this user explicitly entered them.\n"
    +"For this first-time personalization pass, recommend the best-fit starter program even if it requires major day/order/exercise changes. Do not limit the plan to conservative tweaks. The app's automatic apply path remains conservative, so major structural changes should be described clearly as manual/deferred review items unless they fit a supported safe action.\n\n"
    +"=== ANALYSIS REQUEST ===\n\n1. Summarize this user's goals, constraints, and missing context.\n2. Recommend the full best-fit starter weekly structure and exercise approach, including major day/order/exercise changes if appropriate.\n3. Prioritize safety and adherence; flag limitations that merit professional guidance.\n4. Clearly separate major/manual/deferred recommendations from app-supported sync actions.\n5. Return only safe app-supported changes in MARCUSFIT_UPDATE.\n\n=== END EXPORT ===";
  return String(out||"").replace(/=== AI SYNC PHILOSOPHY \(READ BEFORE GENERATING A SYNC BLOCK\) ===[\s\S]*=== END EXPORT ===/,sharedSafeInstructions);
}
function p957BuildFirstSyncExport(status){
  status=status||p957GetSharedUserFirstSyncStatus();
  if(!status.isLikelyFirstSync)return "";
  const profile=p950GetUserProfile(),state=p951GetOnboardingState(),draft=state.draft||{},goals=draft.goals||{},training=draft.training||{},prefs=(p9GetCoachPrefs()||"").trim(),proposal=p954GetProposal();
  const metrics=proposal?p955GetProposalQualityMetrics(proposal):null;
  const limitations=training.limitations||((profile.body&&profile.body.limitations)||"");
  const onboardingSummary=[];
  if(goals.trainingExperience)onboardingSummary.push("experience="+goals.trainingExperience);
  if(goals.currentFocus)onboardingSummary.push("focus="+goals.currentFocus);
  if(training.cardioPreference)onboardingSummary.push("cardio="+training.cardioPreference);
  return "--- FIRST-TIME PROGRAM PERSONALIZATION REQUEST ---\n\n"
    +"This appears to be a new/shared user. Do not assume Marcus's personal program is appropriate for this user.\n"
    +"For this first-time personalization pass, use this user's onboarding, profile, goals, preferences, equipment, and limitations to recommend the best-fit starter program even if it requires major day/order/exercise changes. Do not limit the plan to conservative tweaks. The app's automatic apply path remains conservative, so major structural changes should be described clearly as manual/deferred review items unless they fit a supported safe action. Prioritize safety, simplicity, adherence, and the user's stated goal over Marcus's aesthetic/bodybuilding priorities.\n\n"
    +"Display name: "+p957CompactValue(profile.identity&&profile.identity.displayName)+"\n"
    +"Goal: "+p957CompactValue(profile.goals&&profile.goals.primaryGoal)+"\n"
    +"Physique/health outcome: "+p957CompactValue(profile.goals&&profile.goals.physiqueOutcome)+"\n"
    +"Training frequency: "+p957CompactValue(training.liftingDays?training.liftingDays+" days/week":null)+"\n"
    +"Training access: "+p957CompactValue(training.locations)+"; equipment: "+p957CompactValue(training.equipmentNotes)+"\n"
    +"Program labels/current basis: "+p957CompactValue(profile.app&&profile.app.homeGymLabel)+" / "+p957CompactValue(profile.app&&profile.app.partialGymLabel)+"; current resolved templates follow below.\n"
    +"Coaching preferences: "+p957CompactValue(prefs||null)+"\n"
    +"Onboarding answers: "+p957CompactValue(onboardingSummary.length?onboardingSummary.join(", "):null)+"\n"
    +"Known limitations/injuries: "+p957CompactValue(limitations||null)+"\n"
    +"Proposal source coverage: "+(metrics?metrics.sourceCoverageCount+"/"+metrics.sourceCoverageTotal:"No saved proposal")+"\n"
    +"Missing-context warnings: "+p957CompactValue(status.reasons.filter(function(r){return /few|empty|minimal|coverage/i.test(r);}).join(" ")||null)+"\n"
    +"App limitation: safe apply supports only conservative changes; major program changes may be manual or deferred.\n\n";
}

window.mfFirstSyncDebug=function(){
  const detection=p957GetSharedUserFirstSyncStatus(),s=detection.signals;
  const result={appVersion:APP_VERSION,detection:detection,reasons:detection.reasons.slice(),signals:Object.assign({},s),used:{onboarding:s.onboardingStatus!=="unavailable",profile:true,coachingPreferences:true,proposal:s.proposalSourceCoverage!==null,sourceCoverage:s.proposalSourceCoverage!==null},warnings:(detection.warnings||[]).slice(),readOnly:true};
  console.log("[MarcusFit] mfFirstSyncDebug():",result);return result;
};
var mfFirstSyncDebug=window.mfFirstSyncDebug;
// ── END PHASE 9.5.7 ────────────────────────────────────────────────────────

// ── FUTURE MODULE: src/export-sync.js (proposal debug/export integration) ───
function p955BuildProposalExport(){
  try {
    const proposal=p954GetProposal();
    if(!proposal) return "--- PROGRAM PERSONALIZATION PROPOSAL ---\nNo saved proposal.\n\n";
    const metrics=p955GetProposalQualityMetrics(proposal),ss=proposal.sourceSummary||{},undo=p954BuildUndoPlan(proposal);
    const sourceLabel=proposal.sourceType==="fixture"?"fixture/test":proposal.sourceType==="local_generated"?"locally generated from current app data":"legacy/source missing";
    const appliedState=proposal.status==="applied"?"Supported changes applied":proposal.status==="undone"?"Supported changes applied, then undone":"No supported changes applied";
    return "--- PROGRAM PERSONALIZATION PROPOSAL ---\n"
      +"Status: "+proposal.status+" ("+appliedState+")\n"
      +"Source: "+sourceLabel+"\n"
      +"Generated: "+(proposal.generatedAt||"not recorded")+"\n"
      +"Source coverage: "+metrics.sourceCoverageCount+"/"+metrics.sourceCoverageTotal
        +" (profile "+(ss.profileUsed?"yes":"no")+", onboarding "+(ss.onboardingUsed?"yes":"no")+", coaching prefs "+(ss.coachingPrefsUsed?"yes":"no")+", resolved program "+(ss.currentProgramUsed?"yes":"no")+", lifecycle/overrides "+(ss.lifecycleUsed?"yes":"no")+", recent logs "+(ss.recentLogsUsed?"yes":"no")+")\n"
      +"Action counts: "+p955FormatProposalActionCounts(metrics.actionCounts)+"\n"
      +"Apply readiness: "+metrics.safeApplyCount+" supported, "+metrics.deferredCount+" deferred, "+metrics.conflictCount+" conflict(s)\n"
      +"Application state: "+appliedState+"; undo "+(undo.canUndo?"available":proposal.status==="undone"?"already completed (repeat is a no-op)":"unavailable")+"\n\n";
  } catch(e){
    return "--- PROGRAM PERSONALIZATION PROPOSAL ---\nProposal summary unavailable.\n\n";
  }
}

function genExport(){
  // 9C: Run lifecycle validation and show export warning if needed
  mfUpdateExportWarningBanner();
  const val=document.getElementById("exportRangeSelect").value;
  const allDkeys=Object.keys(localStorage).filter(function(k){return k.startsWith("day-")&&!k.endsWith("-wo");}).sort();
  const dkeys=getExportDkeys();
  const today=new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"});

  let progSnap="--- CURRENT PROGRAM TEMPLATES ---\n\n";
  ["home","partial"].forEach(function(g){
    const RP=getResolvedProgram();
    progSnap+="GYM: "+g.toUpperCase()+"\n";
    RP[g].forEach(function(day,di){
      // 9.4.6: show effective day metadata; flag overridden fields
      const eday=getEffectiveDayMeta(g,di,day);
      const ovr=getDayOverride(g,di);
      const ovrFlag=ovr?" [DAY OVERRIDE ACTIVE]":"";
      progSnap+="  "+eday.day+" \u2014 "+eday.name+(ovr&&ovr.name?" (base: "+day.name+")":"")+ovrFlag+"\n";
      if(eday.focus)progSnap+="    Focus: "+eday.focus+(ovr&&ovr.focus?" (overridden)":"")+"\n";
      if(eday.note)progSnap+="    Coach Note: "+eday.note+(ovr&&ovr.note?" (overridden)":"")+"\n";
      day.exercises.forEach(function(ex){
        const nm=getF(ex.id,"name",ex.name),ld=getF(ex.id,"load",ex.load),ri=getF(ex.id,"rir",ex.rir),st=getF(ex.id,"sets",ex.sets),rp=getF(ex.id,"reps",ex.reps);
        progSnap+="    ["+ex.id+"] "+nm+" | "+st+"\xd7"+rp+" @ "+ld+" | RIR "+ri+"\n";
        const p9exp = p9BuildProgressionExport(ex);
        if(p9exp) progSnap += p9exp;
      });
    });
    // 9.4.8.5: include virtual/additive days in the export snapshot, clearly
    // marked, so AI Sync sessions have full visibility into added days.
    // Read-only — getResolvedDays() does not mutate P or lifecycle state.
    const resolvedDays_g = getResolvedDays(g);
    const virtualDays_g = resolvedDays_g.filter(d => d._isVirtual);
    virtualDays_g.forEach(function(vday){
      progSnap+="  "+vday.day+" \u2014 "+vday.name+" [VIRTUAL/ADDED DAY]\n";
      if(vday.focus)progSnap+="    Focus: "+vday.focus+"\n";
      if(vday.note)progSnap+="    Coach Note: "+vday.note+"\n";
      if(!vday.exercises || !vday.exercises.length){
        progSnap+="    (no exercises added to this day yet)\n";
      } else {
        vday.exercises.forEach(function(ex){
          const nm=getF(ex.id,"name",ex.name),ld=getF(ex.id,"load",ex.load),ri=getF(ex.id,"rir",ex.rir),st=getF(ex.id,"sets",ex.sets),rp=getF(ex.id,"reps",ex.reps);
          progSnap+="    ["+ex.id+"] "+nm+" | "+st+"\xd7"+rp+" @ "+ld+" | RIR "+ri+"\n";
          const p9exp = p9BuildProgressionExport(ex);
          if(p9exp) progSnap += p9exp;
        });
      }
    });
    progSnap+="\n";
  });

  const logSection=buildLogSection(dkeys,allDkeys);

  const wEs=dkeys.map(function(k){return JSON.parse(localStorage.getItem(k));}).filter(function(d){return d.weight;}).map(function(d){return{date:d.date,w:parseFloat(d.weight)};});
  const allWEs=allDkeys.map(function(k){return JSON.parse(localStorage.getItem(k));}).filter(function(d){return d.weight;}).map(function(d){return{date:d.date,w:parseFloat(d.weight)};});
  const fW=wEs[0],lW=wEs[wEs.length-1];
  const wTrend=fW&&lW&&fW.date!==lW.date?(fW.w+" lbs ("+fW.date+") \u2192 "+lW.w+" lbs ("+lW.date+") = "+(lW.w-fW.w).toFixed(1)+" lbs change in selected range"):"Insufficient data in selected range";
  const fWAll=allWEs[0],lWAll=allWEs[allWEs.length-1];
  const wTrendAll=fWAll&&lWAll&&fWAll.date!==lWAll.date?("All-time: "+fWAll.w+" lbs ("+fWAll.date+") \u2192 "+lWAll.w+" lbs ("+lWAll.date+") = "+(lWAll.w-fWAll.w).toFixed(1)+" lbs total change"):"";

  const rangeDesc=val==="program"?"Program templates only":val==="full"?"Full history ("+allDkeys.length+" days)":"Program + last "+val+" days ("+dkeys.length+" of "+allDkeys.length+" total logged days)";

  // 9.5.0: User Profile — concise, human-readable identity/goals/units/gym-
  // label block, surfaced near the top of every export just after the
  // header. Built by p950BuildUserProfileExport(); safe fallback if profile
  // storage is absent or malformed. Does not duplicate AI Coaching Prefs.
  const userProfileBlock=p950BuildUserProfileExport();

  // 9.4.8.8: Persistent AI Coaching Preferences — surfaced near the top of
  // every export so AI Sync sessions always see current intent/priorities.
  const firstSyncStatus=p957GetSharedUserFirstSyncStatus();
  const coachPrefsRaw=p9GetCoachPrefs().trim();
  let sharedCoachPrefs=coachPrefsRaw;
  if(firstSyncStatus.isLikelyFirstSync){
    if(coachPrefsRaw.indexOf(P953_GEN_START)!==-1&&coachPrefsRaw.indexOf(P953_GEN_END)!==-1)sharedCoachPrefs=coachPrefsRaw.slice(coachPrefsRaw.indexOf(P953_GEN_START),coachPrefsRaw.indexOf(P953_GEN_END)+P953_GEN_END.length);
    else if(coachPrefsRaw===AI_PREFS_STARTER_TEMPLATE.trim())sharedCoachPrefs="";
  }
  const coachPrefsBlock="--- PERSISTENT AI COACHING PREFERENCES ---\n"
    +(sharedCoachPrefs?sharedCoachPrefs+"\n\n":"No user-specific AI coaching preferences saved.\n\n");
  const proposalSourceBlock=p955BuildProposalExport();
  const firstSyncBlock=p957BuildFirstSyncExport(firstSyncStatus);

  // 9.4.8.9/10: Exercise Rotation / Swap Candidate Export Intelligence — surfaced
  // after coaching preferences and before the program template snapshot so
  // AI Sync sees rotation/swap signals before reading the raw program.
  const swapCandidateBlock=firstSyncStatus.isLikelyFirstSync?"":p9489BuildSwapCandidateExport();

  let out="=== MARCUSFIT EXPORT ===\n"
    +"Version: "+APP_VERSION+"\n"
    +"Generated: "+today+"\n"
    +"Export Range: "+rangeDesc+"\n"
    +"Total logged days (all time): "+allDkeys.length+"\n"
    +"Weight trend (selected range): "+wTrend+"\n"
    +(wTrendAll?wTrendAll+"\n":"")+"\n"
    +userProfileBlock
    +firstSyncBlock
    +coachPrefsBlock
    +proposalSourceBlock
    +swapCandidateBlock
    +progSnap+"\n"
    +logSection+"\n"
    +"=== AI SYNC FORMAT INSTRUCTIONS ===\n\n"
    +"Return updates using EXACTLY this format:\n\n"
    +"MARCUSFIT_UPDATE_START\n"
    +"[\n"
    +"  {\n"
    +"    \"id\": \"existing-exercise-id\",\n"
    +"    \"name\": \"Exercise Name\",\n"
    +"    \"load\": \"Suggested load\",\n"
    +"    \"rir\": \"1-2\",\n"
    +"    \"sets\": \"4\",\n"
    +"    \"reps\": \"8-12\",\n"
    +"    \"blurb\": \"Short coaching note under 100 characters\"\n"
    +"  }\n"
    +"]\n"
    +"MARCUSFIT_UPDATE_END\n\n"
    +"FORMATTING RULES:\n"
    +"- Block MUST start with MARCUSFIT_UPDATE_START on its own line\n"
    +"- Block MUST end with MARCUSFIT_UPDATE_END on its own line\n"
    +"- Content between them MUST be valid JSON (no trailing commas)\n"
    +"- Use standard hyphens ( - ) not unicode dashes\n"
    +"- Use straight double quotes not smart/curly quotes\n"
    +"- Keep all blurb values under 100 characters\n"
    +"- Use the exact exercise IDs shown in [brackets] in the program above\n"
    +"- Include \"name\" field only when renaming an exercise (minor tweak)\n"
    +"- Only include exercises that actually need changes\n"
    +"- Do NOT wrap the block in markdown code fences unless explicitly asked\n"
    +"- Even if no changes needed, include the block with an empty array []\n\n"
    +"LIFECYCLE ACTIONS (for exercise replacement/reactivation/removal):\n"
    +"Use the \"_action\" field to perform safe lifecycle operations:\n\n"
    +"  REPLACE an exercise (archives old, creates new with new ID):\n"
    +"  {\n"
    +"    \"id\": \"home-d0-e1\",\n"
    +"    \"_action\": \"replace\",\n"
    +"    \"_newExercise\": {\n"
    +"      \"name\": \"Goblet Squat\",\n"
    +"      \"sets\": 4, \"reps\": \"10-12\", \"load\": \"50 lb DB\", \"rir\": \"2\",\n"
    +"      \"blurb\": \"Squat deep, elbows inside knees.\"\n"
    +"    }\n"
    +"  }\n\n"
    +"  REACTIVATE a previously archived exercise:\n"
    +"  {\n"
    +"    \"id\": \"home-d0-e1\",\n"
    +"    \"_action\": \"reactivate\",\n"
    +"    \"name\": \"Bulgarian Split Squat\"\n"
    +"  }\n\n"
    +"  REMOVE an exercise (archives it, preserves history):\n"
    +"  {\n"
    +"    \"id\": \"home-d0-e1\",\n"
    +"    \"_action\": \"remove\"\n"
    +"  }\n\n"
    +"  REORDER exercises on a workout day (non-destructive — IDs and history preserved):\n"
    +"  {\n"
    +"    \"id\": \"_reorder\",\n"
    +"    \"_action\": \"reorder\",\n"
    +"    \"gym\": \"partial\",\n"
    +"    \"dayIndex\": 1,\n"
    +"    \"exerciseOrder\": [\"partial-d1-e0\", \"partial-d1-e2\", \"partial-d1-e1\", \"partial-d1-e3\"],\n"
    +"    \"reason\": \"Move compound lifts first\"\n"
    +"  }\n\n"
    +"  OVERRIDE day-level metadata (name/focus/note/tag) without touching exercises:\n"
    +"  {\n"
    +"    \"_action\": \"day_override\",\n"
    +"    \"gym\": \"home\",\n"
    +"    \"dayIdx\": 5,\n"
    +"    \"name\": \"SHOULDERS & ARMS\",\n"
    +"    \"focus\": \"Shoulders, arms, upper-body detail\",\n"
    +"    \"note\": \"Delts first, arms second. Designed for shoulder cap development.\",\n"
    +"    \"tag\": \"SPECIALIZATION\",\n"
    +"    \"reason\": \"User requested more shoulder emphasis\"\n"
    +"  }\n\n"
    +"  Supported fields for day_override: name, subtitle, focus, note, tag, meta (object).\n"
    +"  Only include fields you want to change — unspecified fields preserve their current value.\n"
    +"  CLEAR a day override (restore base program metadata):\n"
    +"  {\n"
    +"    \"_action\": \"day_override_clear\",\n"
    +"    \"gym\": \"home\",\n"
    +"    \"dayIdx\": 5,\n"
    +"    \"reason\": \"Reverting to original day structure\"\n"
    +"  }\n\n"
    +"  CREATE/UPDATE a virtual (additive) day — metadata only, never touches base program:\n"
    +"  {\n"
    +"    \"_action\": \"day_addition\",\n"
    +"    \"gym\": \"partial\",\n"
    +"    \"dayIdx\": 6,\n"
    +"    \"name\": \"CORE & ABS\",\n"
    +"    \"subtitle\": \"Optional trunk work\",\n"
    +"    \"focus\": \"Abs, bracing, trunk strength\",\n"
    +"    \"note\": \"Optional add-on day for core strength and trunk control.\",\n"
    +"    \"tag\": \"core\",\n"
    +"    \"reason\": \"User requested an optional add-on day\"\n"
    +"  }\n\n"
    +"  Supported fields for day_addition: name (required), subtitle, focus, note, tag, source, meta (object).\n"
    +"  dayIdx must be >= the base program's day count for that gym (cannot collide with a real day).\n"
    +"  source defaults to \"ai_sync\" if omitted. day_addition creates virtual/additive day metadata\n"
    +"  only — exercises are created separately using _action:custom_exercise (below) at a dayIdx that\n"
    +"  matches the virtual day. Base P is never mutated.\n"
    +"  CLEAR a virtual day (removes the metadata only — not logs/exercises tied to it):\n"
    +"  {\n"
    +"    \"_action\": \"day_addition_clear\",\n"
    +"    \"gym\": \"partial\",\n"
    +"    \"dayIdx\": 6,\n"
    +"    \"reason\": \"Removing optional added day\"\n"
    +"  }\n\n"
    +"  CREATE a custom exercise (works on a base day OR a virtual/additive day):\n"
    +"  {\n"
    +"    \"_action\": \"custom_exercise\",\n"
    +"    \"gym\": \"partial\",\n"
    +"    \"dayIdx\": 6,\n"
    +"    \"name\": \"Cable Crunch\",\n"
    +"    \"sets\": 4, \"reps\": \"10-15\", \"load\": \"moderate cable load\", \"rir\": \"1-2\",\n"
    +"    \"blurb\": \"Curl ribs toward hips. Do not hinge.\",\n"
    +"    \"reason\": \"Populating the new optional core day\"\n"
    +"  }\n\n"
    +"  Required for custom_exercise: gym, dayIdx, name. Optional: sets, reps, load, rir, blurb, reason.\n"
    +"  dayIdx may target a virtual/additive day ONLY if a day_addition already exists there (create it\n"
    +"  first in the same sync block if needed, or in a prior one). A stable ID is generated automatically\n"
    +"  (same generator used everywhere else) — never invent or guess an exercise ID for this action.\n"
    +"  Creates inside the existing customExercises lifecycle system; never writes into base P; existing\n"
    +"  custom exercises and logs are preserved. Duplicate names already active on that day are skipped.\n\n"
    +"  SET COACHING RECOMMENDATIONS for a workout day (display-only — does NOT modify exercises):\n"
    +"  {\n"
    +"    \"id\": \"_recommendations\",\n"
    +"    \"_action\": \"recommendations\",\n"
    +"    \"gym\": \"partial\",\n"
    +"    \"dayIndex\": 1,\n"
    +"    \"strategy\": \"progression_challenge\",\n"
    +"    \"experimentTag\": \"leg_press_rom_focus\",\n"
    +"    \"expiresAfterSessions\": 2,\n"
    +"    \"items\": [\n"
    +"      \"Try controlled 3-second negatives on Leg Press for your first 2 working sets.\",\n"
    +"      \"Keep RIR 2. Do not add load unless reps stay clean.\",\n"
    +"      \"Note whether knee/back comfort feels better, worse, or unchanged.\"\n"
    +"    ],\n"
    +"    \"reason\": \"User notes indicate knee discomfort.\"\n"
    +"  }\n\n"
    +"  dayIndex may target a virtual/additive day if a day_addition already exists there (same rule as\n"
    +"  custom_exercise's dayIdx) — it does not have to be a base program day.\n\n"
    +"RECOMMENDATIONS COACHING GUIDANCE:\n"
    +"- Recommendations are PREFERRED over exercise changes for:\n"
    +"  * Technique adjustments and tempo work\n"
    +"  * Recovery-focused guidance and fatigue management\n"
    +"  * Cardio add-ons and warm-up focus\n"
    +"  * Short-term progression experiments\n"
    +"  * ROM focus and movement quality cues\n"
    +"- Do NOT use _action:replace when a recommendation is sufficient\n"
    +"- Recommendations evolve with performance, soreness, and recovery data\n"
    +"- Keep items actionable, specific, and measurable — avoid generic praise\n\n"
    +"LIFECYCLE RULES:\n"
    +"- NEVER change an exercise name to a completely different exercise using just the \"name\" field — use _action:replace\n"
    +"- Minor renames (e.g. 'Cable Fly' → 'Low-to-High Cable Fly') are fine with just the name field\n"
    +"- History is always preserved — archived exercises are never deleted\n"
    +"- If an exercise was previously replaced, _action:reactivate brings back its original ID and history\n"
    +"- To reorder exercises on a day, use _action:reorder — do NOT use remove + re-add\n"
    +"- To add a NEW exercise (base or virtual/added day), use _action:custom_exercise — do NOT invent an\n"
    +"  exercise ID yourself; the app generates a stable one\n"
    +"- FIELD NAMING — do not mix these up: day_addition and custom_exercise use \"dayIdx\"; reorder and\n"
    +"  recommendations use \"dayIndex\". Both refer to the same day-position concept (base or virtual/\n"
    +"  additive); only the field name differs by action.\n\n"
    // 9.4.8.6: AI Export + Sync Intelligence Polish — documentation-only addition.
    // Explains decision hierarchy, structural-change rules, coaching blurb quality rules,
    // experiment limits, optional day guidance, and real-life constraints so future AI
    // Sync reviews are smarter and safer. Does not alter any sync-block parsing/behavior.
    +"=== AI SYNC PHILOSOPHY (READ BEFORE GENERATING A SYNC BLOCK) ===\n\n"
    +"AGGRESSIVENESS:\n"
    +"- Marcus's sync style is optimization-forward, but controlled — between Balanced and Aggressive.\n"
    +"- Actively look for real opportunities (logs, performance, fatigue, weak points, goals, roadmap).\n"
    +"- Do not go rogue: every change should trace back to a stated reason in the data or goals.\n"
    +"- This is NOT a 'when in doubt, do nothing' policy — the goal is the smallest EFFECTIVE change,\n"
    +"  not no change. Controlled, justified experiments are welcome.\n\n"
    // 9.4.8.9/10: Exercise Rotation / Swap Candidate Export Intelligence — tells
    // future AI reviews to actually use the new section instead of only
    // updating numbers. Documentation-only; does not change sync parsing.
    +"EXERCISE ROTATION REVIEW (READ THE SWAP-CANDIDATE SECTION):\n"
    +"- Do not treat a sync review as number-updating only — this export includes an EXERCISE ROTATION /\n"
    +"  SWAP CANDIDATE INTELLIGENCE section above. Review it every time.\n"
    +"- Recommend new lifts or exercise swaps when the swap-candidate section (or your own read of the\n"
    +"  logs/program) justifies it — stale, redundant, capped, or poorly-ordered movements are real signals,\n"
    +"  not noise to ignore.\n"
    +"- Be proactive on Priority 1 muscles (lateral delts, upper chest, lat width) specifically — these are\n"
    +"  the first things to fix when the swap-candidate section flags a gap.\n"
    +"- Prefer controlled, meaningful changes over random churn — keep enough consistency to measure\n"
    +"  progression while not letting the program go stale.\n"
    +"- Use the standard AI Sync action hierarchy for any change this section motivates: 1) recommendation,\n"
    +"  2) reorder, 3) replace, 4) custom_exercise, 5) day_override, 6) day_addition, 7) code release only\n"
    +"  if the app's behavior/model itself must change. Never mutate the base program (P) through sync.\n\n"
    +"SUPPORTED AI SYNC ACTIONS — WHEN TO USE EACH:\n"
    +"1. recommendations — coaching notes only. Use when the day/exercise is structurally fine and the\n"
    +"   user just needs a cue, target, experiment, or safety note. No replacement needed.\n"
    +"2. replace — swap one exercise via the lifecycle system. Use for poor fit, equipment changes,\n"
    +"   pain/irritation, or a clearly better movement for the same goal.\n"
    +"3. Minor field tweak via plain \"name\"/\"load\"/\"sets\"/\"reps\"/\"rir\"/\"blurb\" — only for small,\n"
    +"   same-exercise adjustments. If the change is ambiguous or swaps the movement, use replace instead.\n"
    +"4. reorder — change exercise sequence within a day. Use when priority should shift, weak-point\n"
    +"   work should move earlier, or fatigue management needs a better order — exercises themselves stay.\n"
    +"5. day_override — change metadata (name/focus/note/tag) on an EXISTING base day. Use when an\n"
    +"   existing day is being re-themed or specialized without changing P.\n"
    +"6. day_override_clear — restore a day's base metadata.\n"
    +"7. day_addition — add metadata for a truly OPTIONAL extra day beyond the base program (e.g. Core &\n"
    +"   Abs, Mobility, Conditioning, Recovery, weak-point day). dayIdx must be >= the base day count.\n"
    +"   Exercises for it go through the normal custom-exercise/reorder systems at that dayIdx — never\n"
    +"   stored directly inside dayAddition metadata. Explain the reasoning before adding a major one.\n"
    +"8. day_addition_clear — remove an optional added day's metadata. Does not delete logs/custom\n"
    +"   exercises tied to it.\n"
    +"9. custom_exercise — create a new exercise on a base day or an existing virtual/additive day,\n"
    +"   using the existing customExercises lifecycle system (stable auto-generated ID). Use this any\n"
    +"   time a day_addition needs exercises, or a base day needs an additional movement (not a swap —\n"
    +"   use replace for swaps).\n\n"
    +"DECISION HIERARCHY (use the first one that fits):\n"
    +"1. Coaching only needed → recommendations.\n"
    +"2. Sequence is the issue, exercises are fine → reorder.\n"
    +"3. One movement is the issue → replace, or a minor field tweak if it's a small same-exercise edit.\n"
    +"4. An existing day needs a new theme/focus → day_override, plus replace/reorder/custom exercises\n"
    +"   as needed.\n"
    +"5. The program needs a genuinely optional extra day → day_addition, plus custom_exercise/\n"
    +"   reorder/recommendations at that dayIdx.\n"
    +"6. If the change should become a permanent app default/behavior → say so and recommend a code\n"
    +"   release instead of an AI Sync block.\n"
    +"7. Never mutate the base program (P) through AI Sync.\n\n"
    +"STRUCTURAL CHANGES:\n"
    +"- Big structural changes (re-theming a day, adding an optional day, multi-exercise overhauls) must\n"
    +"  be explained in your written analysis BEFORE the sync block, including which logs/goals/patterns\n"
    +"  justify it.\n"
    +"- Small recommendations or minor tweaks can go straight into the sync block without a preamble.\n"
    +"- Always prefer the smallest effective change — don't redesign a whole day when a recommendation,\n"
    +"  reorder, or single replacement solves the actual problem.\n"
    +"- Justifying factors: stated goals, workout logs, progression stalls, fatigue patterns, weak\n"
    +"  points, recovery issues, equipment constraints, schedule constraints, roadmap/context.\n\n"
    +"EXPERIMENTS:\n"
    +"- Experiments are welcome and expected — limit to 1-2 active experiments at a time.\n"
    +"- Every experiment needs a clear purpose and an expiration/review point (use experimentTag and\n"
    +"  expiresAfterSessions on a recommendations block, or note a review point in the blurb/reason).\n\n"
    +"COACHING BLURB / RECOMMENDATION QUALITY RULES:\n"
    +"- Be direct and practical. Avoid generic hype — no \"destroy this workout\" / \"beast mode\" / \"always\n"
    +"  add weight\" / \"max out every set\" language.\n"
    +"- Don't repeat the same line week after week. Explain the reason behind a cue when it helps.\n"
    +"- Don't contradict progression status — match the note to the actual signal: push/progress, hold,\n"
    +"  reduce, experiment, or safety/recovery.\n"
    +"- For isolation work, favor reps/control before chasing load.\n"
    +"- Physique-focused language is good for weak-point work, especially shoulders, arms, core, taper,\n"
    +"  delts, and visible abs (e.g. \"Lateral raises are the money movement for shoulder caps.\") — use it\n"
    +"  there, but don't sprinkle it into every note.\n"
    +"- Keep blurbs concise enough to display well in-app.\n"
    +"- Suggested expiresAfterSessions defaults where applicable: form cue 2-4, experiment 2-4,\n"
    +"  weak-point focus 4-8, safety/recovery note 1-3, long-term goal reminder 6-12, structural change\n"
    +"  review 4-8. Treat these as advisory guidance, not enforced runtime behavior.\n\n"
    +"OPTIONAL ADDED DAYS:\n"
    +"- Only use day_addition for a truly optional extra day beyond the base program — never to silently\n"
    +"  expand the required program.\n"
    +"- Explain the reasoning before proposing a major optional day.\n\n"
    +"DO-NOT-OVER-CHANGE RULE:\n"
    +"- Default to the smallest effective change for the problem at hand — but this is not a license for\n"
    +"  timidity. Controlled, well-justified experiments and structural changes are part of normal use.\n\n"
    +"REAL-LIFE CONSTRAINTS TO WEIGH WHEN RELEVANT:\n"
    +"- Marcus usually has 30 minutes to 1.5 hours of gym time daily.\n"
    +"- Primary usage is the PARTIAL/transitional gym program; HOME is the fallback.\n"
    +"- Zone 2 walks with kids after work are realistic most days when applicable.\n"
    +"- Marcus is a young dad balancing family/time constraints, currently in a fat-loss/physique phase.\n"
    +"- Recovery matters, but Marcus likes pushing progress — don't let every suggestion revolve around\n"
    +"  constraints, but factor them in where they're actually relevant (volume, day length, frequency).\n\n"
    +"SYNC BLOCK SAFETY:\n"
    +"- Preserve all user data — never clear lifecycle state or logs globally, never create a new\n"
    +"  localStorage key, never mutate the base program (P).\n"
    +"- Don't duplicate existing exercises or systems — prefer the existing lifecycle actions above.\n"
    +"- Use stable, existing exercise IDs; don't invent arbitrary day indices.\n"
    +"- For a virtual/added day's exercise IDs, only use a dayIdx where a day_addition already exists\n"
    +"  (or is being created in the same sync block) — and create exercises with _action:custom_exercise,\n"
    +"  not a hand-built ID.\n"
    +"- Keep sync blocks focused and reviewable — explain major changes in your analysis first.\n\n"
    +"=== ANALYSIS REQUEST ===\n\n"
    +"You are an AI fitness coach. Analyze the data above and provide:\n\n"
    +"1. WORKOUT PROGRESSION\n"
    +"   - Review per-set weight, reps, and RIR for each logged exercise\n"
    +"   - Where logged RIR is consistently >= target: suggest a load increase\n"
    +"   - Where RIR is below target or sets are failing: suggest reduction\n\n"
    +"2. LOAD TRENDS\n"
    +"   - Identify exercises showing consistent progress vs plateaus\n"
    +"   - Flag exercises where load has not changed across multiple sessions\n\n"
    +"3. HEALTH TRENDS\n"
    +"   - Energy (mood) and sleep patterns\n"
    +"   - Hunger levels (flag if consistently high on GLP-1)\n"
    +"   - BM consistency -- correlate with water/fiber intake\n"
    +"   - Water intake -- flag if consistently under 100 oz target\n"
    +"   - Zepbound adherence -- note any missed doses\n\n"
    +"4. DAILY HABITS CONSISTENCY\n"
    +"   - Review habit completion rates across logged days\n"
    +"   - Flag habits with low completion streaks\n"
    +"   - Note any habit notes left by Marcus\n\n"
    +"5. PROGRAMMING SUGGESTIONS\n"
    +"   - Recommend exercise swaps, rep range changes, or volume adjustments\n"
    +"   - If swapping to a fundamentally different exercise, use _action:replace in the sync block\n"
    +"   - If energy/sleep is low, suggest reduced volume\n"
    +"   - Flag safety concerns (RIR too low on heavy movements)\n\n"
    +"CONTEXT:\n"
    +"- Marcus is on Zepbound (GLP-1), down 60+ lbs, goal: fat loss + muscle retention\n"
    +"- High LDL -- cardio and dietary quality matter\n"
    +"- Two gym setups: Home (bodyweight/DB) and Transition (partial cable gym)\n"
    +"- Priority movements: DB Lateral Raise, Rear Delt Fly, progressive compound lifts\n\n"
    +"START your response with the MARCUSFIT_UPDATE_START block above.\n"
    +"Then write your full analysis after.\n\n"
    +"=== END EXPORT ===";

  if(firstSyncStatus.isLikelyFirstSync)out=p957MakeSharedSafeExport(out);

  document.getElementById("exportOut").style.display="block";
  document.getElementById("exportOut").textContent=out;
  document.getElementById("copyBtn").style.display="block";
  window._exp=out;
}
// ── END PHASE 3 EXPORT ────────────────────────────────────────────────────────


function doCopy(){if(!window._exp)return;const btn=document.getElementById("copyBtn");navigator.clipboard.writeText(window._exp).then(()=>{btn.textContent="&#9989; COPIED!";setTimeout(()=>btn.textContent="&#128203; COPY TO CLIPBOARD",2000);}).catch(()=>{const ta=document.createElement("textarea");ta.value=window._exp;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);btn.textContent="&#9989; COPIED!";setTimeout(()=>btn.textContent="&#128203; COPY TO CLIPBOARD",2000);});}

// ── PHASE 4: AI SYNC PARSER ───────────────────────────────────────────────────
function applySync(){
  const raw=document.getElementById("syncInput").value;
  const res=document.getElementById("syncResult");
  res.style.display="block";
  res.style.color="var(--text)";
  res.textContent="";

  // ── Step 1: Check for markers ──────────────────────────────────────────────
  const hasStart=raw.includes("MARCUSFIT_UPDATE_START");
  const hasEnd=raw.includes("MARCUSFIT_UPDATE_END");
  if(!hasStart&&!hasEnd){
    res.style.color="var(--red)";
    res.textContent="❌ No MARCUSFIT_UPDATE block found.\n\nMake sure you copied the full AI response — the block must contain MARCUSFIT_UPDATE_START and MARCUSFIT_UPDATE_END.";
    return;
  }
  if(!hasStart){res.style.color="var(--red)";res.textContent="❌ Found MARCUSFIT_UPDATE_END but missing MARCUSFIT_UPDATE_START.\n\nCopy the full block from the top.";return;}
  if(!hasEnd){res.style.color="var(--red)";res.textContent="❌ Found MARCUSFIT_UPDATE_START but missing MARCUSFIT_UPDATE_END.\n\nThe block appears to be cut off. Copy the full response.";return;}

  // ── Step 2: Extract content between markers ────────────────────────────────
  const match=raw.match(/MARCUSFIT_UPDATE_START([\s\S]*?)MARCUSFIT_UPDATE_END/);
  if(!match){res.style.color="var(--red)";res.textContent="❌ Could not extract content between markers.\n\nEnsure MARCUSFIT_UPDATE_START and MARCUSFIT_UPDATE_END each appear exactly once.";return;}

  // ── Step 3: Strip markdown code fences if present ─────────────────────────
  let inner=match[1].trim();
  inner=inner.replace(/^```[a-zA-Z]*\n?/,"").replace(/\n?```$/,"").trim();

  // ── Step 4: Normalize common issues ───────────────────────────────────────
  // Replace unicode dashes/hyphens with standard hyphens
  inner=inner.replace(/[\u2013\u2014\u2012\u2010]/g,"-");
  // Replace smart/curly quotes with straight quotes
  inner=inner.replace(/[\u201C\u201D]/g,'"').replace(/[\u2018\u2019]/g,"'");

  // ── Step 5: Parse JSON ─────────────────────────────────────────────────────
  let updates;
  try{
    updates=JSON.parse(inner);
  }catch(e){
    // Try to give a useful hint
    let hint="";
    if(/,\s*[\]\}]/.test(inner))hint="\n\nHint: There may be a trailing comma before ] or } — JSON does not allow trailing commas.";
    else if(!inner.startsWith("["))hint="\n\nHint: The content between markers should be a JSON array starting with [.";
    res.style.color="var(--red)";
    res.textContent="❌ JSON parse error: "+e.message+hint+"\n\nRaw content detected:\n"+inner.slice(0,200)+(inner.length>200?"…":"");
    return;
  }

  if(!Array.isArray(updates)){res.style.color="var(--red)";res.textContent="❌ Expected a JSON array [ ... ] between the markers, got "+typeof updates+".";return;}

  if(updates.length===0){
    res.style.color="var(--accent)";
    res.textContent="ℹ️ Sync block contained an empty array — no changes to apply.\n\nThis is valid; the AI found nothing to update.";
    return;
  }

  // ── Step 6: Build valid ID registry ───────────────────────────────────────
  // All known exercise IDs from the RESOLVED program (includes custom exercises)
  const RP=getResolvedProgram();
  const knownExIds=new Set();
  ["home","partial"].forEach(g=>{
    (RP[g]||[]).forEach(day=>{
      (day.exercises||[]).forEach(ex=>knownExIds.add(ex.id));
    });
  });
  // Also include inactive IDs as "known" so they can't be silently reused
  const lc=getLifecycle();
  Object.keys(lc.inactiveIds).forEach(id=>knownExIds.add(id));
  // All known habit IDs
  const knownHabitIds=new Set(HABITS.map(h=>h.id));

  // Pattern for "new" exercise IDs: {gym}-d{N}-e{N}
  const newExPattern=/^(home|partial)-d(\d+)-e(\d+)$/;

  // ── Step 6: Declare all result counters and log arrays before any pre-pass ──
  // (Must be hoisted here so _action:recommendations, reorder, lifecycle, and
  //  normal sync processing can all reference skipped/lifecycleLog without a
  //  "Cannot access before initialization" ReferenceError.)
  const skipped=[];
  const lifecycleLog=[];
  let exUpdated=0,exAdded=0,habitsUpdated=0;

  // ── Step 6b: Pre-pass — handle top-level _action:reorder entries ─────────────
  // These are not per-exercise entries; they carry gym/dayIndex/exerciseOrder fields.
  // Processed before the per-exercise forEach to keep the main loop clean.
  let reorderCount = 0;
  const reorderLog = [];

  // ── Step 6a: Pre-pass — handle _action:recommendations entries ──────────────
  // Recommendations are coaching guidance ONLY. They do NOT touch exercises,
  // progression, history, lifecycle state, or reorder state.
  let recsApplied = 0;
  const recsLog = [];
  updates = updates.filter(u => {
    if(!u._action) return true;
    const action = (u._action+"").trim().toLowerCase();
    if(action !== "recommendations") return true; // keep others for next passes

    const gymKey = (u.gym||"").trim();
    const dayIndex = u.dayIndex;
    const items = u.items;
    const strategy = (u.strategy||"").trim();
    const experimentTag = (u.experimentTag||"").trim();
    const expiresAfterSessions = u.expiresAfterSessions;
    const reason = u.reason || "";

    // ── Validate: gym exists ──────────────────────────────────────────────────
    const validGyms = Object.keys(getResolvedProgram());
    if(!gymKey || !validGyms.includes(gymKey)){
      skipped.push("_action recommendations: gym '"+gymKey+"' is not valid. Expected: "+validGyms.join(", "));
      return false;
    }
    // ── Validate: dayIndex valid ──────────────────────────────────────────────
    // 9.4.8.7.1: use getResolvedDays() so recommendations can target virtual/
    // additive days too, instead of only validating against base P[gym].length
    // (which previously rejected any dayIndex created via day_addition).
    const dayIdx_r = parseInt(dayIndex, 10);
    const resolvedDays_rec = (isNaN(dayIdx_r) || dayIdx_r < 0) ? [] : getResolvedDays(gymKey);
    const dayObj_rec = resolvedDays_rec.find(d => d._dayIdx === dayIdx_r);
    if(isNaN(dayIdx_r) || dayIdx_r < 0 || !dayObj_rec){
      skipped.push("_action recommendations ("+gymKey+"): dayIndex "+dayIndex+" is out of range");
      return false;
    }
    // ── Validate: items ───────────────────────────────────────────────────────
    if(!items || !Array.isArray(items)){
      skipped.push("_action recommendations ("+gymKey+" d"+dayIdx_r+"): 'items' must be an array");
      return false;
    }
    const validItems = items.filter(i => typeof i === "string" && i.trim().length > 0);
    if(validItems.length === 0){
      skipped.push("_action recommendations ("+gymKey+" d"+dayIdx_r+"): 'items' array is empty or contains no valid strings");
      return false;
    }
    if(validItems.length < items.length){
      recsLog.push("⚠ recommendations ("+gymKey+" d"+dayIdx_r+"): "+( items.length - validItems.length)+" non-string/empty item(s) ignored");
    }
    // ── Validate: strategy and experimentTag ──────────────────────────────────
    if(!strategy){
      skipped.push("_action recommendations ("+gymKey+" d"+dayIdx_r+"): 'strategy' is required");
      return false;
    }
    if(!experimentTag){
      skipped.push("_action recommendations ("+gymKey+" d"+dayIdx_r+"): 'experimentTag' is required");
      return false;
    }
    // ── Validate: expiresAfterSessions ────────────────────────────────────────
    const expires = parseInt(expiresAfterSessions, 10);
    if(isNaN(expires) || expires < 1){
      skipped.push("_action recommendations ("+gymKey+" d"+dayIdx_r+"): 'expiresAfterSessions' must be a positive integer");
      return false;
    }

    // ── Apply: store recommendation ───────────────────────────────────────────
    const recObj = {
      updatedAt: new Date().toISOString(),
      source: "ai",
      strategy,
      experimentTag,
      expiresAfterSessions: expires,
      items: validItems
    };
    setRecsForDay(gymKey, dayIdx_r, recObj);
    recsApplied++;
    const dayName = (dayObj_rec||{}).day || (dayObj_rec||{}).name || ("Day "+dayIdx_r);
    recsLog.push("✓ Recommendations set for "+gymKey+" "+dayName+" ("+validItems.length+" item"+(validItems.length!==1?"s":"")+")"+(reason?" — "+reason:""));
    return false; // consumed — remove from per-exercise loop
  });
  // ── End recommendations pre-pass ──────────────────────────────────────────────

  updates = updates.filter(u => {
    if(!u._action) return true; // not an action entry — keep for per-exercise loop
    const action = (u._action+"").trim().toLowerCase();
    if(action !== "reorder") return true; // keep non-reorder actions for per-exercise loop

    // ── _action: reorder ──
    const gymKey = (u.gym||"").trim();
    const dayIndex = u.dayIndex;
    const exerciseOrder = u.exerciseOrder;
    const reason = u.reason || "";

    if(!gymKey || dayIndex === undefined || dayIndex === null){
      skipped.push("_action reorder: missing required fields gym or dayIndex");
      return false;
    }
    if(!Array.isArray(exerciseOrder)){
      skipped.push("_action reorder ("+gymKey+" d"+dayIndex+"): exerciseOrder must be an array");
      return false;
    }

    // Validate gym exists
    const RP_r = getResolvedProgram();
    if(!RP_r[gymKey]){
      skipped.push("_action reorder: gym '"+gymKey+"' does not exist");
      return false;
    }
    const dayIdx = parseInt(dayIndex, 10);
    if(isNaN(dayIdx) || dayIdx < 0 || dayIdx >= RP_r[gymKey].length){
      skipped.push("_action reorder ("+gymKey+"): dayIndex "+dayIndex+" is out of range");
      return false;
    }

    const resolvedDay = RP_r[gymKey][dayIdx];
    const activeIds = new Set((resolvedDay.exercises||[]).map(e => e.id));

    // Validate: no duplicate IDs in the order array
    const seen = new Set();
    const dupes = [];
    exerciseOrder.forEach(id => {
      if(seen.has(id)) dupes.push(id); else seen.add(id);
    });
    if(dupes.length > 0){
      skipped.push("_action reorder ("+gymKey+" d"+dayIdx+"): duplicate IDs in exerciseOrder: "+dupes.join(", "));
      return false;
    }

    // Validate: warn on unknown IDs (IDs not in active resolved day) — do not fail
    const unknownIds = exerciseOrder.filter(id => !activeIds.has(id));
    if(unknownIds.length > 0){
      reorderLog.push("⚠ reorder ("+gymKey+" d"+dayIdx+"): "+unknownIds.length+" unknown/inactive ID(s) ignored: "+unknownIds.join(", "));
    }

    // Only keep IDs that are actually active on this day
    const validOrder = exerciseOrder.filter(id => activeIds.has(id));

    // Idempotency: if override already matches, skip
    const lc_r = getLifecycle();
    const overrideKey = gymKey + ":" + dayIdx;
    const existing = (lc_r.orderOverrides||{})[overrideKey];
    if(existing && JSON.stringify(existing) === JSON.stringify(validOrder)){
      reorderLog.push("ℹ️ reorder ("+gymKey+" d"+dayIdx+"): order unchanged — skipped (idempotent)");
      return false;
    }

    // Apply override
    if(!lc_r.orderOverrides) lc_r.orderOverrides = {};
    lc_r.orderOverrides[overrideKey] = validOrder;
    saveLifecycle(lc_r);
    reorderCount++;
    const dayName = resolvedDay.day || ("Day "+dayIdx);
    reorderLog.push("✓ Reordered "+gymKey+" "+dayName+": "+validOrder.length+" exercise(s)"+(reason?" ("+reason+")":""));
    return false; // consumed — remove from per-exercise loop
  });
  // ── End reorder pre-pass ──────────────────────────────────────────────────────

  // ── Step 6c: Pre-pass — handle _action:day_override_clear entries ─────────────
  // Clears a previously set day override. Does NOT touch exercises.
  let dayOverrideClearCount = 0;
  const dayOverrideClearLog = [];
  updates = updates.filter(u => {
    if(!u._action) return true;
    const action = (u._action+"").trim().toLowerCase();
    if(action !== "day_override_clear") return true;

    const gymKey = (u.gym||"").trim();
    const dayIdx = u.dayIdx;

    // Validate gym
    const validGyms_c = Object.keys(getResolvedProgram());
    if(!gymKey || !validGyms_c.includes(gymKey)){
      skipped.push("_action day_override_clear: gym '"+gymKey+"' is not valid. Expected: "+validGyms_c.join(", "));
      return false;
    }
    // Validate dayIdx
    const RP_c = getResolvedProgram();
    const dayIdx_c = parseInt(dayIdx, 10);
    if(isNaN(dayIdx_c) || dayIdx_c < 0 || dayIdx_c >= RP_c[gymKey].length){
      skipped.push("_action day_override_clear ("+gymKey+"): dayIdx "+dayIdx+" is out of range");
      return false;
    }
    // Check if there is anything to clear
    const existing_c = getDayOverride(gymKey, dayIdx_c);
    if(!existing_c){
      dayOverrideClearLog.push("ℹ️ day_override_clear ("+gymKey+" d"+dayIdx_c+"): no override set — nothing to clear (idempotent)");
      return false;
    }
    // Apply clear
    clearDayOverride(gymKey, dayIdx_c);
    dayOverrideClearCount++;
    const dayName_c = (RP_c[gymKey][dayIdx_c]||{}).day || ("Day "+dayIdx_c);
    dayOverrideClearLog.push("✓ Day override cleared: "+gymKey+" "+dayName_c+(u.reason?" ("+u.reason+")":""));
    return false; // consumed
  });

  // ── Step 6d: Pre-pass — handle _action:day_override entries ──────────────────
  // Sets or merges day-level metadata overrides. Does NOT touch exercises or P.
  let dayOverrideCount = 0;
  const dayOverrideLog = [];
  updates = updates.filter(u => {
    if(!u._action) return true;
    const action = (u._action+"").trim().toLowerCase();
    if(action !== "day_override") return true;

    const gymKey = (u.gym||"").trim();
    const dayIdx = u.dayIdx;
    const reason = (u.reason||"").trim();

    // Validate gym
    const validGyms_d = Object.keys(getResolvedProgram());
    if(!gymKey || !validGyms_d.includes(gymKey)){
      skipped.push("_action day_override: gym '"+gymKey+"' is not valid. Expected: "+validGyms_d.join(", "));
      return false;
    }
    // Validate dayIdx
    const RP_d = getResolvedProgram();
    const dayIdx_d = parseInt(dayIdx, 10);
    if(isNaN(dayIdx_d) || dayIdx_d < 0 || dayIdx_d >= RP_d[gymKey].length){
      skipped.push("_action day_override ("+gymKey+"): dayIdx "+dayIdx+" is out of range (0–"+(RP_d[gymKey].length-1)+")");
      return false;
    }
    // Extract only allowed fields (silently drop unknown fields unless placed in meta)
    const allowed = {};
    DAY_OVERRIDE_FIELDS.forEach(f => {
      if(u[f] !== undefined) allowed[f] = u[f];
    });
    // Validate: at least one field must be provided
    if(!Object.keys(allowed).length){
      skipped.push("_action day_override ("+gymKey+" d"+dayIdx_d+"): no recognized fields provided. Allowed: "+DAY_OVERRIDE_FIELDS.join(", "));
      return false;
    }
    // Validate string fields
    const stringFields = ["name","subtitle","focus","note","tag"];
    let fieldErrors = [];
    stringFields.forEach(f => {
      if(allowed[f] !== undefined && typeof allowed[f] !== "string"){
        fieldErrors.push("'"+f+"' must be a string");
      }
    });
    if(allowed.meta !== undefined && (typeof allowed.meta !== "object" || Array.isArray(allowed.meta) || allowed.meta === null)){
      fieldErrors.push("'meta' must be an object");
    }
    if(fieldErrors.length){
      skipped.push("_action day_override ("+gymKey+" d"+dayIdx_d+"): "+fieldErrors.join("; "));
      return false;
    }
    // Apply override (merge with existing)
    setDayOverride(gymKey, dayIdx_d, allowed, reason);
    dayOverrideCount++;
    const dayName_d = (RP_d[gymKey][dayIdx_d]||{}).day || ("Day "+dayIdx_d);
    const fieldList = Object.keys(allowed).join(", ");
    dayOverrideLog.push("✓ Day override set: "+gymKey+" "+dayName_d+" ["+fieldList+"]"+(reason?" — "+reason:""));
    return false; // consumed
  });
  // ── End day_override pre-passes ────────────────────────────────────────────────

  // ── Step 6e: Pre-pass — handle _action:day_addition_clear entries ─────────────
  // Clears virtual/additive day metadata only. Does NOT touch logs, custom
  // exercises, orderOverrides, or recommendations tied to that virtual day.
  // Safe no-op if the virtual day does not exist. Mirrors clearDayAddition().
  let dayAdditionClearCount = 0;
  const dayAdditionClearLog = [];
  updates = updates.filter(u => {
    if(!u._action) return true;
    const action = (u._action+"").trim().toLowerCase();
    if(action !== "day_addition_clear") return true;

    const gymKey = (u.gym||"").trim();
    const validGyms_ac = (typeof P !== "undefined") ? Object.keys(P) : [];
    if(!gymKey || !validGyms_ac.includes(gymKey)){
      skipped.push("_action day_addition_clear: gym '"+gymKey+"' is not valid. Expected: "+validGyms_ac.join(", "));
      return false;
    }
    const dayIdx_ac = parseInt(u.dayIdx, 10);
    if(isNaN(dayIdx_ac) || !Number.isInteger(dayIdx_ac) || dayIdx_ac < 0){
      skipped.push("_action day_addition_clear ("+gymKey+"): dayIdx must be a non-negative integer");
      return false;
    }
    // Check if there is anything to clear
    const existing_ac = getDayAddition(gymKey, dayIdx_ac);
    if(!existing_ac){
      dayAdditionClearLog.push("ℹ️ day_addition_clear ("+gymKey+" d"+dayIdx_ac+"): no virtual day set — nothing to clear (idempotent)");
      return false;
    }
    clearDayAddition(gymKey, dayIdx_ac);
    dayAdditionClearCount++;
    dayAdditionClearLog.push("✓ Virtual day cleared: "+gymKey+" d"+dayIdx_ac+(u.reason?" ("+u.reason+")":""));
    return false; // consumed
  });
  // ── End day_addition_clear pre-pass ────────────────────────────────────────────

  // ── Step 6f: Pre-pass — handle _action:day_addition entries ───────────────────
  // Creates or updates virtual/additive day metadata only (via setDayAddition()).
  // Never mutates base P, never adds exercises directly. dayIdx must be >= the
  // base program's day count for that gym (no collision with real days).
  let dayAdditionCount = 0;
  const dayAdditionLog = [];
  updates = updates.filter(u => {
    if(!u._action) return true;
    const action = (u._action+"").trim().toLowerCase();
    if(action !== "day_addition") return true;

    const gymKey = (u.gym||"").trim();
    const validGyms_a = (typeof P !== "undefined") ? Object.keys(P) : [];
    if(!gymKey || !validGyms_a.includes(gymKey)){
      skipped.push("_action day_addition: gym '"+gymKey+"' is not valid. Expected: "+validGyms_a.join(", "));
      return false;
    }
    const dayIdx_a = parseInt(u.dayIdx, 10);
    if(isNaN(dayIdx_a) || !Number.isInteger(dayIdx_a) || dayIdx_a < 0){
      skipped.push("_action day_addition ("+gymKey+"): dayIdx must be a non-negative integer");
      return false;
    }
    // Extract only allowed fields (setDayAddition() also re-validates these)
    const allowed_a = {};
    DAY_ADDITION_FIELDS.forEach(f => {
      if(u[f] !== undefined) allowed_a[f] = u[f];
    });
    if(!allowed_a.name){
      skipped.push("_action day_addition ("+gymKey+" d"+dayIdx_a+"): 'name' is required");
      return false;
    }
    // Default source to ai_sync if omitted
    if(allowed_a.source === undefined) allowed_a.source = "ai_sync";
    const reason_a = (u.reason||"").trim();

    const result_a = setDayAddition(gymKey, dayIdx_a, allowed_a, reason_a);
    if(!result_a.ok){
      skipped.push("_action day_addition ("+gymKey+" d"+dayIdx_a+"): "+result_a.reason);
      return false;
    }
    dayAdditionCount++;
    dayAdditionLog.push("✓ Virtual day "+(result_a.created?"created":"updated")+": "+gymKey+" d"+dayIdx_a+" \""+allowed_a.name+"\""+(reason_a?" — "+reason_a:""));
    return false; // consumed
  });
  // ── End day_addition pre-pass ──────────────────────────────────────────────────

  // ── Step 6g: Pre-pass — handle _action:custom_exercise entries ────────────────
  // Official, parser-supported way to create a new exercise inside the existing
  // customExercises lifecycle system (exAddCustom / exGenNewId). Works for base
  // days AND virtual/additive days. Never mutates base P. dayIdx may target a
  // virtual/additive day only if a matching day_addition already exists (created
  // earlier in this same sync block, or previously).
  let customExerciseCount = 0;
  const customExerciseLog = [];
  updates = updates.filter(u => {
    if(!u._action) return true;
    const action = (u._action+"").trim().toLowerCase();
    if(action !== "custom_exercise") return true;

    const gymKey = (u.gym||"").trim();
    const validGyms_ce = (typeof P !== "undefined") ? Object.keys(P) : [];
    if(!gymKey || !validGyms_ce.includes(gymKey)){
      skipped.push("_action custom_exercise: gym '"+gymKey+"' is not valid. Expected: "+validGyms_ce.join(", "));
      return false;
    }
    const dayIdx_ce = parseInt(u.dayIdx, 10);
    if(isNaN(dayIdx_ce) || !Number.isInteger(dayIdx_ce) || dayIdx_ce < 0){
      skipped.push("_action custom_exercise ("+gymKey+"): dayIdx must be a non-negative integer");
      return false;
    }
    const name_ce = (u.name||"").trim();
    if(!name_ce){
      skipped.push("_action custom_exercise ("+gymKey+" d"+dayIdx_ce+"): 'name' is required");
      return false;
    }
    const baseLen_ce = (P[gymKey] || []).length;
    if(dayIdx_ce >= baseLen_ce && !isVirtualDay(gymKey, dayIdx_ce)){
      skipped.push("_action custom_exercise ("+gymKey+" d"+dayIdx_ce+"): no day_addition exists at this dayIdx. Create the virtual day first with _action:day_addition.");
      return false;
    }
    // Duplicate guard: skip if an active exercise with this name already exists on this day
    // (works for base AND virtual days — getResolvedDays() merges both).
    const dayObj_ce = getResolvedDays(gymKey).find(d => d._dayIdx === dayIdx_ce);
    const normName_ce = exNormName(name_ce);
    const dupExisting_ce = dayObj_ce && (dayObj_ce.exercises||[]).find(ex => exNormName(getF(ex.id,"name",ex.name)) === normName_ce);
    if(dupExisting_ce){
      customExerciseLog.push("ℹ️ "+name_ce+" already active on "+gymKey+" d"+dayIdx_ce+". Skipped duplicate.");
      return false;
    }
    const newId_ce = exGenNewId(gymKey, dayIdx_ce);
    const newExObj_ce = {
      id: newId_ce,
      name: name_ce,
      sets: u.sets || 3,
      reps: u.reps || "10",
      load: u.load || "TBD",
      rir: u.rir || "2",
      blurb: u.blurb || ""
    };
    exAddCustom(gymKey, dayIdx_ce, newExObj_ce);
    knownExIds.add(newId_ce);
    customExerciseCount++;
    exAdded++;
    customExerciseLog.push("✓ "+name_ce+" added to "+gymKey+" d"+dayIdx_ce+" (ID: "+newId_ce+")"+(u.reason?" — "+u.reason:""));
    return false; // consumed
  });
  // ── End custom_exercise pre-pass ───────────────────────────────────────────────

  // ── Step 7: Process each update entry ─────────────────────────────────────
  const exerciseFields=["name","load","rir","sets","reps","blurb"];
  const habitFields=["name","target","completed"];

  // (exUpdated, exAdded, habitsUpdated, skipped, lifecycleLog declared above before pre-passes)

  updates.forEach((u,idx)=>{
    if(!u.id){skipped.push("Entry #"+(idx+1)+": missing \"id\" field");return;}
    const id=u.id.trim();

    // ── Lifecycle action (_action field) ──────────────────────────────────────
    // Handled BEFORE the normal exercise update path.
    if(u._action){
      const action=(u._action+"").trim().toLowerCase();

      // ── _action: replace ──
      // Replace an existing exercise with a new one.
      // Required: id (old exercise), _newExercise object with name/sets/reps/load/rir/blurb
      if(action==="replace"){
        // Validate new exercise data provided first (needed for duplicate messages)
        const newEx=u._newExercise;
        if(!newEx||!newEx.name){skipped.push(id+": _action replace — _newExercise.name is required");return;}

        // ── Duplicate Replace Guard (9.2.2) ─────────────────────────────────────
        // Case 1: Source already archived AND an active replacement already exists.
        // This handles the repeated-paste scenario — be informative, not an error.
        if(lc.inactiveIds[id]){
          const existingRepId = exFindReplacementForSource(id);
          if(existingRepId && !lc.inactiveIds[existingRepId]){
            // Replacement is still active — this is a true duplicate call, skip gracefully.
            let repName = newEx.name;
            const lc_dup=getLifecycle();
            const repCustom = lc_dup.customExercises[existingRepId];
            if(repCustom) repName = repCustom.name;
            else if(typeof P!=="undefined"){
              for(const days of Object.values(P)){
                const ex=(days.flatMap(d=>d.exercises||[])).find(e=>e.id===existingRepId);
                if(ex){repName=ex.name;break;}
              }
            }
            const srcName_dup=getF(id,"name",null)||(()=>{if(typeof P!=="undefined"){for(const days of Object.values(P)){const ex=(days.flatMap(d=>d.exercises||[])).find(e=>e.id===id);if(ex)return ex.name;}}return id;})();
            lifecycleLog.push("ℹ️ "+repName+" already exists as replacement for "+srcName_dup+". Skipped duplicate replace.");
            return;
          }
          // Source archived but no active replacement — fall through to normal error below
        }
        // ── End Duplicate Replace Guard Case 1 ───────────────────────────────────

        // Validate old exercise exists and is active
        if(!knownExIds.has(id)||lc.inactiveIds[id]){
          skipped.push(id+": _action replace — exercise not found or already archived");return;
        }

        // Determine gym+day location of the old exercise (check base P and custom exercises)
        let gymKey=null,dayIdx=null;
        if(typeof P!=="undefined"){
          outer: for(const [g,days] of Object.entries(P)){
            for(let di=0;di<days.length;di++){
              if((days[di].exercises||[]).find(e=>e.id===id)){gymKey=g;dayIdx=di;break outer;}
            }
          }
        }
        if(gymKey===null){
          // Check custom exercises
          const ce=lc.customExercises[id];
          if(ce){gymKey=ce.gymKey;dayIdx=ce.dayIdx;}
        }
        if(gymKey===null){skipped.push(id+": _action replace — could not determine gym/day location");return;}

        // ── Duplicate Replace Guard Case 2 (9.2.2) ───────────────────────────────
        // Same replacement name already active on this day (from any source, first run or otherwise).
        const alreadyActive = exFindActiveByName(gymKey, dayIdx, newEx.name);
        if(alreadyActive){
          lifecycleLog.push("ℹ️ "+newEx.name+" already active on this day. Skipped duplicate.");
          return;
        }
        // ── End Duplicate Replace Guard Case 2 ───────────────────────────────────

        // Check if an archived exercise with this new name exists (reactivation instead)
        const archivedMatch=exFindArchivedByName(newEx.name);
        if(archivedMatch){
          // Reactivate the archived one, archive the current one
          const oldName=getF(id,"name",null)||(()=>{for(const days of Object.values(P)){const ex=(days.flatMap(d=>d.exercises||[])).find(e=>e.id===id);if(ex)return ex.name;}return id;})();
          exArchiveId(id,archivedMatch,"AI Sync replace→reactivate");
          // Remove from custom exercises if it was custom
          if(lc.customExercises[id]){const lc2=getLifecycle();delete lc2.customExercises[id];saveLifecycle(lc2);}
          exReactivateId(archivedMatch);
          // If reactivated ex was custom, re-place it in same gym/day
          const lc2=getLifecycle();
          if(lc2.customExercises[archivedMatch]){
            lc2.customExercises[archivedMatch].gymKey=gymKey;
            lc2.customExercises[archivedMatch].dayIdx=dayIdx;
            saveLifecycle(lc2);
          }
          knownExIds.delete(id);
          knownExIds.add(archivedMatch);
          lifecycleLog.push("✓ "+oldName+" archived");
          lifecycleLog.push("✓ Archived "+newEx.name+" reactivated (original history preserved)");
          exUpdated++;
          return;
        }

        // Create new exercise with fresh ID
        const newId=exGenNewId(gymKey,dayIdx);
        const newExObj={
          id:newId,
          name:newEx.name,
          sets:newEx.sets||3,
          reps:newEx.reps||"10",
          load:newEx.load||"TBD",
          rir:newEx.rir||"2",
          blurb:newEx.blurb||""
        };
        const oldName=getF(id,"name",null)||(()=>{if(typeof P!=="undefined"){for(const days of Object.values(P)){const ex=(days.flatMap(d=>d.exercises||[])).find(e=>e.id===id);if(ex)return ex.name;}}return id;})();
        // Archive old
        exArchiveId(id,newId,"AI Sync");
        // Remove from custom exercises if it was custom
        const lc3=getLifecycle();
        if(lc3.customExercises[id]){delete lc3.customExercises[id];saveLifecycle(lc3);}
        // Add new custom exercise in same location
        exAddCustom(gymKey,dayIdx,newExObj);
        knownExIds.delete(id);
        knownExIds.add(newId);
        lifecycleLog.push("✓ "+oldName+" archived");
        lifecycleLog.push("✓ "+newEx.name+" created (ID: "+newId+")");
        lifecycleLog.push("✓ Replacement link created");
        exUpdated++;
        return;
      }

      // ── _action: reactivate ──
      // Bring back an archived exercise by name or ID.
      if(action==="reactivate"){
        // Try by ID first, then by name
        let targetId=null;
        if(lc.inactiveIds[id]){targetId=id;}
        else{
          // Search by name field
          const searchName=u.name||u._name||"";
          if(searchName)targetId=exFindArchivedByName(searchName);
          if(!targetId)targetId=exFindArchivedByName(id); // treat id field as name fallback
        }
        if(!targetId){
          lifecycleLog.push("⚠ Archived exercise not found: "+(u.name||id));
          skipped.push(id+": _action reactivate — no archived exercise found with that ID or name");
          return;
        }
        // Find location: check if it was a custom exercise (stored gymKey/dayIdx)
        const lc4=getLifecycle();
        const ce=lc4.customExercises[targetId];
        const wasCustom=!!ce;
        const targetName=getF(targetId,"name",null)||(ce&&ce.name)||(()=>{if(typeof P!=="undefined"){for(const days of Object.values(P)){const ex=(days.flatMap(d=>d.exercises||[])).find(e=>e.id===targetId);if(ex)return ex.name;}}return targetId;})();
        exReactivateId(targetId);
        knownExIds.add(targetId);
        lifecycleLog.push("✓ Archived "+targetName+" reactivated");
        exUpdated++;
        return;
      }

      // ── _action: remove ──
      // Remove (archive) an active exercise without replacement.
      if(action==="remove"){
        if(!knownExIds.has(id)||lc.inactiveIds[id]){
          skipped.push(id+": _action remove — exercise not found or already archived");return;
        }
        const oldName2=getF(id,"name",null)||(()=>{if(typeof P!=="undefined"){for(const days of Object.values(P)){const ex=(days.flatMap(d=>d.exercises||[])).find(e=>e.id===id);if(ex)return ex.name;}}return id;})();
        exArchiveId(id,null,"AI Sync remove");
        const lc5=getLifecycle();
        if(lc5.customExercises[id]){delete lc5.customExercises[id];saveLifecycle(lc5);}
        knownExIds.delete(id);
        lifecycleLog.push("✓ "+oldName2+" archived (removed from program)");
        exUpdated++;
        return;
      }

      // Unknown _action value
      skipped.push(id+": unknown _action '"+u._action+"' — valid values: replace, reactivate, remove");
      return;
    }

    // ── Habit update ──
    if(knownHabitIds.has(id)){
      let changed=false;
      habitFields.forEach(f=>{
        if(u[f]!==undefined){
          const habit=HABITS.find(h=>h.id===id);
          if(habit&&f==="name")habit.name=u[f];
          if(habit&&f==="target")habit.target=u[f];
          if(f==="completed"&&habitState[id]){habitState[id].completed=!!u[f];}
          changed=true;
        }
      });
      if(changed)habitsUpdated++;
      return;
    }

    // ── Existing exercise update ──
    if(knownExIds.has(id) && !lc.inactiveIds[id]){
      // ── Phase 9B: Defensive safeguard for name changes ──
      // If the AI is trying to rename an exercise, check if it's really a replacement.
      // If it looks like a different exercise, perform proper lifecycle replacement
      // rather than silently corrupting history.
      if(u.name){
        const action = exCheckSyncAction(id, u.name);
        if(action.action === "replace"){
          // This looks like a different exercise — do NOT reuse the ID.
          // Perform a lifecycle replacement: archive old, create new.
          skipped.push(id+": name change '"+u.name+"' looks like a different exercise. Tip: use _action:replace with _newExercise for explicit lifecycle replacement. Non-name fields applied to old ID.");
          // Apply non-name fields only to the existing exercise
          let changed=false;
          exerciseFields.filter(f=>f!=="name").forEach(f=>{
            if(u[f]!==undefined){setOvr(id,f,u[f]);changed=true;}
          });
          if(changed)exUpdated++;
          return;
        }
      }
      let changed=false;
      exerciseFields.forEach(f=>{
        if(u[f]!==undefined){
          setOvr(id,f,u[f]);
          changed=true;
        }
      });
      if(changed)exUpdated++;
      return;
    }

    // ── New exercise (matching pattern) ──
    const pm=id.match(newExPattern);
    if(pm){
      const gymKey=pm[1];
      const dayIdx=parseInt(pm[2]);
      const exIdx=parseInt(pm[3]);
      const RP2=getResolvedProgram(); // fresh copy after any mutations above
      const days=RP2[gymKey];
      let day;
      if(days && dayIdx<days.length){
        // Standard base-program day
        day=days[dayIdx];
      } else if(isVirtualDay(gymKey, dayIdx)){
        // 9.4.8.4: allow custom exercises targeting a confirmed virtual/additive day.
        // The virtual day has no base exercises of its own — only custom exercises
        // added via this same path accumulate on it. Build a synthetic day view from
        // existing custom exercises already attached to this gym+dayIdx (if any).
        const lcV=getLifecycle();
        const virtualExs=Object.values(lcV.customExercises||{})
          .filter(ex=>ex.gymKey===gymKey && ex.dayIdx===dayIdx && !lcV.inactiveIds[ex.id])
          .sort((a,b)=>(a.addedAt||"").localeCompare(b.addedAt||""));
        day={exercises:virtualExs};
      } else {
        skipped.push(id+": day index d"+dayIdx+" does not exist in "+gymKey+" program (no matching base day or virtual day)");return;
      }
      // Validate index is next in sequence (checks both base P and custom exercises)
      const maxExIdx=Math.max(-1,...day.exercises.map(e=>{const m=e.id.match(/-e(\d+)$/);return m?parseInt(m[1]):-1;}));
      if(exIdx!==maxExIdx+1){skipped.push(id+": expected next exercise index would be e"+(maxExIdx+1)+", got e"+exIdx);return;}
      // Defensive: check if this ID is already in lifecycle (active or inactive)
      const lc2=getLifecycle();
      if(lc2.customExercises[id]){skipped.push(id+": custom exercise already exists — update it instead of re-adding");return;}
      if(lc2.inactiveIds[id]){skipped.push(id+": this ID is archived/inactive — use exReactivateId() or choose a new ID");return;}
      // Persist to lifecycle state (NOT to P)
      const newEx={
        id,
        name:u.name||"New Exercise",
        sets:u.sets||3,
        reps:u.reps||"10",
        load:u.load||"TBD",
        rir:u.rir||"2",
        blurb:u.blurb||""
      };
      exAddCustom(gymKey, dayIdx, newEx);
      knownExIds.add(id);
      exAdded++;
      return;
    }

    // ── Unrecognized ID ──
    skipped.push(id+": not a known exercise ID, habit ID, or valid new-exercise pattern");
  });

  // ── Step 8: Re-render affected views ──────────────────────────────────────
  renderProgram();
  renderWoExercises();
  if(habitsUpdated>0)renderHabits();
  if(recsApplied>0)renderWoRecs(); // re-render recommendations if any were applied
  if(dayOverrideCount>0||dayOverrideClearCount>0||dayAdditionCount>0||dayAdditionClearCount>0||customExerciseCount>0)populateWoDaySelect(); // 9.4.6: refresh day selector names; 9.4.8.4: also on virtual day add/clear; 9.4.8.7: also on custom exercise add

  // ── Step 9: Build result summary ──────────────────────────────────────────
  const lines=[];
  // Recommendation messages first
  if(recsLog.length>0){lines.push(...recsLog);lines.push("");}
  // Reorder messages next
  if(reorderLog.length>0){lines.push(...reorderLog);lines.push("");}
  // Day override messages (9.4.6)
  if(dayOverrideLog.length>0){lines.push(...dayOverrideLog);lines.push("");}
  if(dayOverrideClearLog.length>0){lines.push(...dayOverrideClearLog);lines.push("");}
  // Day addition (virtual day) messages (9.4.8.4)
  if(dayAdditionLog.length>0){lines.push(...dayAdditionLog);lines.push("");}
  if(dayAdditionClearLog.length>0){lines.push(...dayAdditionClearLog);lines.push("");}
  // Custom exercise creation messages (9.4.8.7)
  if(customExerciseLog.length>0){lines.push(...customExerciseLog);lines.push("");}
  // Lifecycle action messages next
  if(lifecycleLog.length>0){lines.push(...lifecycleLog);lines.push("");}
  if(reorderCount>0)lines.push("🔀 "+reorderCount+" day"+(reorderCount!==1?"s":"")+" reordered");
  if(recsApplied>0)lines.push("💬 "+recsApplied+" recommendation set"+(recsApplied!==1?"s":"")+" applied");
  if(dayOverrideCount>0)lines.push("🏷️ "+dayOverrideCount+" day override"+(dayOverrideCount!==1?"s":"")+" applied");
  if(dayOverrideClearCount>0)lines.push("🗑️ "+dayOverrideClearCount+" day override"+(dayOverrideClearCount!==1?"s":"")+" cleared");
  if(dayAdditionCount>0)lines.push("➕📅 "+dayAdditionCount+" virtual day"+(dayAdditionCount!==1?"s":"")+" set");
  if(dayAdditionClearCount>0)lines.push("🗑️📅 "+dayAdditionClearCount+" virtual day"+(dayAdditionClearCount!==1?"s":"")+" cleared");
  if(customExerciseCount>0)lines.push("➕💪 "+customExerciseCount+" custom exercise"+(customExerciseCount!==1?"s":"")+" added");
  if(exUpdated>0)lines.push("✅ "+exUpdated+" exercise"+(exUpdated!==1?"s":"")+" updated");
  if(exAdded>0)lines.push("➕ "+exAdded+" exercise"+(exAdded!==1?"s":"")+" added");
  if(habitsUpdated>0)lines.push("🧠 "+habitsUpdated+" habit"+(habitsUpdated!==1?"s":"")+" updated");
  if(skipped.length>0){lines.push("");lines.push("⚠️ Skipped ("+skipped.length+"):");skipped.forEach(s=>lines.push("  • "+s));}
  if(exUpdated===0&&exAdded===0&&habitsUpdated===0&&reorderCount===0&&recsApplied===0&&dayOverrideCount===0&&dayOverrideClearCount===0&&dayAdditionCount===0&&dayAdditionClearCount===0&&customExerciseCount===0&&skipped.length===0&&lifecycleLog.length===0&&reorderLog.length===0&&recsLog.length===0&&dayOverrideLog.length===0&&dayOverrideClearLog.length===0&&dayAdditionLog.length===0&&dayAdditionClearLog.length===0&&customExerciseLog.length===0){
    res.style.color="var(--accent)";res.textContent="ℹ️ All entries processed — no changes were needed.";return;
  }
  res.style.color=(exUpdated>0||exAdded>0||habitsUpdated>0||reorderCount>0||recsApplied>0||dayOverrideCount>0||dayOverrideClearCount>0||dayAdditionCount>0||dayAdditionClearCount>0||customExerciseCount>0)?((skipped.length>0?"var(--yellow)":"var(--green)")):"var(--yellow)";
  res.textContent=lines.join("\n");
  document.getElementById("syncInput").value="";
}
// ── END PHASE 4 SYNC PARSER ───────────────────────────────────────────────────

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

// ── PHASE 7: HISTORY FILTERS ─────────────────────────────────────────────────

const p7FilterState = {
  from:"", to:"", gym:"", woday:"", search:"",
  hasWorkout:false, hasNotes:false, hasHabits:false
};

function p7FToggle(key, btn){
  const ks={"has-workout":"hasWorkout","has-notes":"hasNotes","has-habits":"hasHabits"};
  const k=ks[key]||key;
  const isNowActive=btn.classList.toggle("active");
  p7FilterState[k]=isNowActive;
  p7ApplyFilters();
}

function p7ClearFilters(){
  document.getElementById("hf-from").value="";
  document.getElementById("hf-to").value="";
  document.getElementById("hf-gym").value="";
  document.getElementById("hf-woday").value="";
  document.getElementById("hf-search").value="";
  ["hf-has-workout","hf-has-notes","hf-has-habits"].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.classList.remove("active");
  });
  Object.assign(p7FilterState,{from:"",to:"",gym:"",woday:"",search:"",hasWorkout:false,hasNotes:false,hasHabits:false});
  p7ApplyFilters();
}

function p7GetAllEntries(){
  return Object.keys(localStorage)
    .filter(k=>k.startsWith("day-")&&!k.endsWith("-wo"))
    .sort().reverse()
    .map(k=>{try{return{key:k,data:JSON.parse(localStorage.getItem(k))};}catch{return null;}})
    .filter(Boolean);
}

function p7ApplyFilters(){
  const from=document.getElementById("hf-from").value;
  const to=document.getElementById("hf-to").value;
  const gym=document.getElementById("hf-gym").value;
  const woday=document.getElementById("hf-woday").value;
  const search=document.getElementById("hf-search").value.trim().toLowerCase();

  let entries=p7GetAllEntries();
  const total=entries.length;

  if(from) entries=entries.filter(e=>e.data.date>=from);
  if(to)   entries=entries.filter(e=>e.data.date<=to);
  if(gym)  entries=entries.filter(e=>(e.data.logGym||"home")===gym);

  if(woday){
    entries=entries.filter(e=>{
      if(!e.data.woDayIdx&&e.data.woDayIdx!==0)return false;
      // 9.4.8.3: use getSafeDayDisplayName — handles base + virtual days
      const gymKey = e.data.logGym||"home";
      const name = getSafeDayDisplayName(gymKey, e.data.woDayIdx);
      return name.toLowerCase().includes(woday.toLowerCase());
    });
  }

  if(search){
    entries=entries.filter(e=>{
      const d=e.data;
      if(d.notes&&d.notes.toLowerCase().includes(search))return true;
      const woRaw=localStorage.getItem(e.key+"-wo");
      if(woRaw){
        try{
          const wo=JSON.parse(woRaw);
          // 9.4.8.3: use safe resolvers — handles base + virtual days
          const gymKey = wo.gym||"home";
          const dayData = getSafeDayForLog(gymKey, wo.dayIdx);
          const dayName = getSafeDayDisplayName(gymKey, wo.dayIdx);
          if(dayName.toLowerCase().includes(search))return true;
          if(dayData&&(dayData.exercises||[]).some(ex=>getF(ex.id,"name",ex.name).toLowerCase().includes(search)))return true;
        }catch{}
      }
      return false;
    });
  }

  if(p7FilterState.hasWorkout) entries=entries.filter(e=>e.data.workout==="yes");
  if(p7FilterState.hasNotes)   entries=entries.filter(e=>e.data.notes&&e.data.notes.trim());
  if(p7FilterState.hasHabits){
    entries=entries.filter(e=>{
      if(!e.data.habits)return false;
      return HABITS.some(h=>e.data.habits[h.id]&&e.data.habits[h.id].completed);
    });
  }

  // Stats for filtered set
  const statsEl=document.getElementById("hf-stats");
  if(entries.length===total&&!from&&!to&&!gym&&!woday&&!search&&!p7FilterState.hasWorkout&&!p7FilterState.hasNotes&&!p7FilterState.hasHabits){
    statsEl.innerHTML=`<span>${total}</span> total entries`;
  } else {
    const avgWt=entries.filter(e=>e.data.weight).map(e=>parseFloat(e.data.weight));
    const avgWtStr=avgWt.length?(avgWt.reduce((a,b)=>a+b,0)/avgWt.length).toFixed(1)+" lbs":"—";
    const wos=entries.filter(e=>e.data.workout==="yes").length;
    const habitPct=entries.length?Math.round(entries.reduce((a,e)=>{
      if(!e.data.habits)return a;
      const done=HABITS.filter(h=>e.data.habits[h.id]&&e.data.habits[h.id].completed).length;
      return a+(done/HABITS.length);
    },0)/entries.length*100):0;
    statsEl.innerHTML=`<span>${entries.length}</span> of ${total} · Avg <span>${avgWtStr}</span> · <span>${wos}</span> workouts · Habits <span>${habitPct}%</span>`;
  }

  // Render filtered history
  renderHistoryFromEntries(entries);
}

// Hook filter inputs to p7ApplyFilters with debounce on search
let _p7SearchTimer=null;
function p7WireFilters(){
  ["hf-from","hf-to","hf-gym","hf-woday"].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.addEventListener("change",p7ApplyFilters);
  });
  const s=document.getElementById("hf-search");
  if(s)s.addEventListener("input",()=>{clearTimeout(_p7SearchTimer);_p7SearchTimer=setTimeout(p7ApplyFilters,280);});
}

// Refactored renderHistory now delegates to renderHistoryFromEntries
function renderHistoryFromEntries(entries){
  const c=document.getElementById("histList");
  if(!c)return;
  if(!entries.length){c.innerHTML='<div class="empty">No matching entries.<br>Try adjusting your filters.</div>';return;}
  c.innerHTML=entries.slice(0,60).map(({key,data:d})=>{
    const dt=new Date(d.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
    const recurringOutcome=p9510HistoryOutcome(d.date||key.slice(4));
    const pills=[d.weight?`&#9878; ${d.weight}`:null,d.sleep?`&#128564; ${d.sleep}h`:null,d.protein?`&#129385; ${d.protein}g`:null,d.water?`&#128167; ${d.water}oz`:null,d.bm?`&#128701; ${d.bm}`:null,d.mood?`&#9889; ${d.mood}/10`:null,d.hunger?`&#127860; ${d.hunger}/10`:null,recurringOutcome||d.zep?recurringOutcome||`&#128138; ${d.zep}`:null,d.workout?`&#127947; ${d.workout}`:null].filter(Boolean);
    const woRaw=localStorage.getItem(key+"-wo");const wo=woRaw?JSON.parse(woRaw):null;
    let woDetail="";
    if(wo&&wo.exercises&&Object.keys(wo.exercises).length){
      // 9.4.8.3: use getSafeDayForLog — handles base + virtual days safely
      const gymKey = wo.gym||"home";
      const dayData = getSafeDayForLog(gymKey, wo.dayIdx);
      const dayName = getSafeDayDisplayName(gymKey, wo.dayIdx);
      woDetail='<div class="hist-wo-detail">';
      woDetail+=`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${gymKey.toUpperCase()} \u2014 ${dayName}</div>`;
      if(dayData){
        (dayData.exercises||[]).forEach(ex=>{
          const exLog=wo.exercises[ex.id];if(!exLog)return;
          const nm=getF(ex.id,"name",ex.name);
          const validSets=exLog.sets.filter(s=>s.wt||s.reps);if(!validSets.length)return;
          woDetail+=`<div class="hist-wo-ex"><div class="hist-wo-ex-name">${nm}</div>`;
          validSets.forEach((s,i)=>{woDetail+=`<div class="hist-wo-set">Set ${i+1}: ${s.wt||"\u2014"} \xd7 ${s.reps||"\u2014"} reps @ RIR ${s.rir||"\u2014"}</div>`;});
          if(exLog.note)woDetail+=`<div class="hist-wo-set" style="font-style:italic;">"${exLog.note}"</div>`;
          woDetail+='</div>';
        });
      }
      woDetail+='</div>';
    }
    const hasWo=woDetail!="";
    const habitsDone=d.habits?HABITS.filter(h=>d.habits[h.id]&&d.habits[h.id].completed).length:null;
    const habitBadge=habitsDone!==null?`<span class="hist-pill">🧠 ${habitsDone}/${HABITS.length}</span>`:"";
    return `<div class="hist-entry${hasWo?" expandable":""}" onclick="${hasWo?"this.classList.toggle('open')":""}" ><div class="hist-date"><span>${dt} \xb7 ${(d.logGym||"home").toUpperCase()}</span>${hasWo?'<span style="color:var(--muted);font-size:10px;">tap for sets &#9662;</span>':""}</div><div class="hist-pills">${pills.map(p=>`<span class="hist-pill">${p}</span>`).join("")}${habitBadge}</div>${d.notes?`<div class="hist-notes">"${d.notes}"</div>`:""} ${woDetail}</div>`;
  }).join("");
}

// ── PHASE 7: ANALYTICS ENGINE ─────────────────────────────────────────────────

function p7CalcAnalytics(){
  const entries=p7GetAllEntries().map(e=>e.data).reverse(); // oldest first
  if(!entries.length)return null;

  // ─── Weight Trends ───
  const wtEntries=entries.filter(e=>e.weight).map(e=>({date:e.date,w:parseFloat(e.weight)}));
  const wt7=wtEntries.slice(-7);
  const wt14=wtEntries.slice(-14);
  const avgW=(arr)=>arr.length?(arr.reduce((a,b)=>a+b.w,0)/arr.length).toFixed(1):null;
  const currentW=wtEntries.length?wtEntries[wtEntries.length-1].w:null;
  const oldestW=wtEntries.length?wtEntries[0].w:null;
  const totalChange=currentW&&oldestW?(currentW-oldestW).toFixed(1):null;
  // weekly trend: compare last 7 avg to prior 7
  const last7Avg=parseFloat(avgW(wt7));
  const prior7=wtEntries.slice(-14,-7);
  const prior7Avg=parseFloat(avgW(prior7));
  let weeklyTrend="—";
  if(last7Avg&&prior7Avg){
    const diff=(last7Avg-prior7Avg).toFixed(1);
    weeklyTrend=diff>0?`↑ +${diff} lbs`:(diff<0?`↓ ${diff} lbs`:"→ Stable");
  }

  // ─── Workout Consistency ───
  const now=new Date();
  const dow=now.getDay();
  const weekStart=new Date(now);weekStart.setDate(now.getDate()-dow);weekStart.setHours(0,0,0,0);
  const weekStartStr=weekStart.toISOString().slice(0,10);
  const cutoff7=new Date(now);cutoff7.setDate(now.getDate()-7);
  const cutoff30=new Date(now);cutoff30.setDate(now.getDate()-30);
  const c7=cutoff7.toISOString().slice(0,10);
  const c30=cutoff30.toISOString().slice(0,10);

  const wosThisWeek=entries.filter(e=>e.workout==="yes"&&e.date>=weekStartStr).length;
  const wosLast7=entries.filter(e=>e.workout==="yes"&&e.date>=c7).length;
  const wosLast30=entries.filter(e=>e.workout==="yes"&&e.date>=c30).length;

  // most common workout day name
  const dayNameCount={};
  entries.filter(e=>e.workout==="yes"&&e.woDayIdx!==undefined&&e.woDayIdx!=="").forEach(e=>{
    // 9.4.8.3: use getSafeDayDisplayName — handles base + virtual days safely
    const gymKey = e.logGym||"home";
    const name = getSafeDayDisplayName(gymKey, e.woDayIdx);
    if(name){dayNameCount[name]=(dayNameCount[name]||0)+1;}
  });
  const topWoDay=Object.keys(dayNameCount).sort((a,b)=>dayNameCount[b]-dayNameCount[a])[0]||"—";

  // ─── Streak ───
  const sortedDates=[...new Set(entries.map(e=>e.date))].sort().reverse();
  let streak=0;let longest=0;let cur=0;
  const today=new Date().toISOString().slice(0,10);
  const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
  const woDates=new Set(entries.filter(e=>e.workout==="yes").map(e=>e.date));
  // current streak
  let d=new Date();
  while(true){
    const ds=d.toISOString().slice(0,10);
    if(woDates.has(ds)){streak++;d.setDate(d.getDate()-1);}
    else if(ds===today){d.setDate(d.getDate()-1);continue;} // skip today if no wo yet
    else break;
  }
  // longest streak
  let run=0;
  const allWoDates=[...woDates].sort();
  for(let i=0;i<allWoDates.length;i++){
    if(i===0){run=1;}
    else{
      const prev=new Date(allWoDates[i-1]+"T12:00:00");
      const curr=new Date(allWoDates[i]+"T12:00:00");
      const diff=Math.round((curr-prev)/86400000);
      if(diff===1)run++;else run=1;
    }
    if(run>longest)longest=run;
  }

  // ─── Habit Consistency ───
  const habitCounts={};
  HABITS.forEach(h=>{habitCounts[h.id]={name:h.name,icon:h.icon,done:0,total:0};});
  entries.forEach(e=>{
    if(!e.habits)return;
    HABITS.forEach(h=>{
      habitCounts[h.id].total++;
      if(e.habits[h.id]&&e.habits[h.id].completed)habitCounts[h.id].done++;
    });
  });
  const overallHabitPct=entries.length?Math.round(
    entries.reduce((a,e)=>{
      if(!e.habits)return a;
      const done=HABITS.filter(h=>e.habits[h.id]&&e.habits[h.id].completed).length;
      return a+(done/HABITS.length);
    },0)/entries.length*100
  ):0;
  const sortedHabits=Object.values(habitCounts).filter(h=>h.total>0).sort((a,b)=>(b.done/b.total)-(a.done/a.total));
  const bestHabit=sortedHabits[0]||null;
  const worstHabit=sortedHabits[sortedHabits.length-1]||null;

  // ─── Recovery Averages ───
  const avg=(arr)=>arr.length?(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1):null;
  const sleeps=entries.filter(e=>e.sleep).map(e=>parseFloat(e.sleep));
  const hungers=entries.filter(e=>e.hunger).map(e=>parseFloat(e.hunger));
  const moods=entries.filter(e=>e.mood).map(e=>parseFloat(e.mood));

  // ─── Last 30 days activity heatmap data ───
  const heatmap=[];
  for(let i=29;i>=0;i--){
    const dd=new Date();dd.setDate(dd.getDate()-i);
    const ds=dd.toISOString().slice(0,10);
    heatmap.push({date:ds,hasWo:woDates.has(ds)});
  }

  return {
    weight:{current:currentW,avg7:avgW(wt7),avg14:avgW(wt14),totalChange,weeklyTrend,count:wtEntries.length},
    workout:{thisWeek:wosThisWeek,last7:wosLast7,last30:wosLast30,topDay:topWoDay},
    streak:{current:streak,longest},
    habits:{overall:overallHabitPct,breakdown:sortedHabits,best:bestHabit,worst:worstHabit},
    recovery:{sleep:avg(sleeps),hunger:avg(hungers),energy:avg(moods)},
    heatmap,
    totalDays:entries.length
  };
}

function p7RenderAnalytics(){
  const container=document.getElementById("p7-analytics-content");
  if(!container)return;
  const a=p7CalcAnalytics();
  if(!a){container.innerHTML='<div class="empty">No data yet.<br>Start logging to see your stats!</div>';return;}

  const trendClass=a.weight.weeklyTrend.startsWith("↓")?"down":a.weight.weeklyTrend.startsWith("↑")?"up":"neutral";
  const trendColor=a.weight.weeklyTrend.startsWith("↓")?"var(--green)":a.weight.weeklyTrend.startsWith("↑")?"var(--red)":"var(--muted)";

  // Habit bars
  const habitBars=a.habits.breakdown.slice(0,7).map(h=>{
    const pct=h.total?Math.round(h.done/h.total*100):0;
    const fillClass=pct>=80?"green":pct>=50?"orange":"red";
    return `<div class="p7-bar-row">
      <div class="p7-bar-label">${h.icon} ${h.name.split(" ")[0]}</div>
      <div class="p7-bar-track"><div class="p7-bar-fill ${fillClass}" style="width:${pct}%"></div></div>
      <div class="p7-bar-num">${pct}%</div>
    </div>`;
  }).join("");

  // Heatmap dots
  const dots=a.heatmap.map(d=>`<div class="p7-mini-dot${d.hasWo?" has-wo":""}" title="${d.date}"></div>`).join("");

  // Recovery color helpers
  const sleepColor=parseFloat(a.recovery.sleep)>=7?"var(--green)":parseFloat(a.recovery.sleep)>=6?"var(--yellow)":"var(--red)";
  const energyColor=parseFloat(a.recovery.energy)>=7?"var(--green)":parseFloat(a.recovery.energy)>=5?"var(--yellow)":"var(--red)";
  const hungerColor=parseFloat(a.recovery.hunger)<=5?"var(--green)":parseFloat(a.recovery.hunger)<=7?"var(--yellow)":"var(--red)";

  container.innerHTML=`
    <!-- Streaks -->
    <div class="p7-section">
      <div class="p7-section-header">🔥 Streaks</div>
      <div class="p7-streak-row">
        <div class="p7-streak-card">
          <div class="p7-streak-num">${a.streak.current}</div>
          <div class="p7-streak-label">Current Streak</div>
        </div>
        <div class="p7-streak-card">
          <div class="p7-streak-num" style="color:var(--accent2);">${a.streak.longest}</div>
          <div class="p7-streak-label">Longest Streak</div>
        </div>
        <div class="p7-streak-card">
          <div class="p7-streak-num" style="color:var(--muted);font-size:28px;">${a.totalDays}</div>
          <div class="p7-streak-label">Days Logged</div>
        </div>
      </div>
    </div>

    <!-- Weight -->
    <div class="p7-section">
      <div class="p7-section-header">⚖️ Weight Trends</div>
      <div class="p7-stat-grid">
        <div class="p7-stat-card accent">
          <div class="p7-stat-label">Current</div>
          <div class="p7-stat-val accent">${a.weight.current||"—"}</div>
          <div class="p7-stat-sub">lbs</div>
        </div>
        <div class="p7-stat-card">
          <div class="p7-stat-label">Total Change</div>
          <div class="p7-stat-val ${a.weight.totalChange&&parseFloat(a.weight.totalChange)<0?"green":"sm"}" style="color:${a.weight.totalChange&&parseFloat(a.weight.totalChange)<0?"var(--green)":"var(--text)"};">${a.weight.totalChange!==null?(parseFloat(a.weight.totalChange)>0?"+":"")+a.weight.totalChange+" lbs":"—"}</div>
          <div class="p7-stat-sub">since first entry</div>
        </div>
        <div class="p7-stat-card">
          <div class="p7-stat-label">7-Day Avg</div>
          <div class="p7-stat-val sm">${a.weight.avg7||"—"}</div>
          <div class="p7-stat-sub">lbs</div>
        </div>
        <div class="p7-stat-card">
          <div class="p7-stat-label">14-Day Avg</div>
          <div class="p7-stat-val sm">${a.weight.avg14||"—"}</div>
          <div class="p7-stat-sub">lbs</div>
        </div>
      </div>
      <div class="p7-wide-card" style="margin-top:0;">
        <div class="p7-wide-card-title">Weekly Trend</div>
        <span class="p7-stat-badge ${trendClass}" style="font-size:13px;padding:4px 12px;">${a.weight.weeklyTrend}</span>
        <div style="font-size:10px;color:var(--muted);margin-top:6px;">vs prior 7-day average</div>
      </div>
    </div>

    <!-- Workout -->
    <div class="p7-section">
      <div class="p7-section-header">💪 Workout Consistency</div>
      <div class="p7-stat-grid cols3">
        <div class="p7-stat-card green">
          <div class="p7-stat-label">This Week</div>
          <div class="p7-stat-val green">${a.workout.thisWeek}</div>
          <div class="p7-stat-sub">workouts</div>
        </div>
        <div class="p7-stat-card">
          <div class="p7-stat-label">Last 7 Days</div>
          <div class="p7-stat-val sm">${a.workout.last7}</div>
          <div class="p7-stat-sub">workouts</div>
        </div>
        <div class="p7-stat-card">
          <div class="p7-stat-label">Last 30 Days</div>
          <div class="p7-stat-val sm">${a.workout.last30}</div>
          <div class="p7-stat-sub">workouts</div>
        </div>
      </div>
      <div class="p7-wide-card" style="margin-top:0;">
        <div class="p7-wide-card-title">Most Trained Day</div>
        <div style="font-size:15px;font-weight:700;color:var(--text);">${a.workout.topDay}</div>
        <div class="p7-wide-card-title" style="margin-top:10px;">Last 30 Days Activity</div>
        <div class="p7-mini-dots">${dots}</div>
        <div style="font-size:9px;color:var(--muted);margin-top:4px;">🟩 = workout logged · ⬛ = no workout</div>
      </div>
    </div>

    <!-- Habits -->
    <div class="p7-section">
      <div class="p7-section-header">🧠 Habit Consistency</div>
      <div class="p7-stat-grid">
        <div class="p7-stat-card${a.habits.overall>=80?" green":""}">
          <div class="p7-stat-label">Overall %</div>
          <div class="p7-stat-val${a.habits.overall>=80?" green":""}">${a.habits.overall}%</div>
          <div class="p7-stat-sub">avg completion</div>
        </div>
        <div class="p7-stat-card">
          <div class="p7-stat-label">Best Habit</div>
          <div class="p7-stat-val sm" style="font-size:15px;line-height:1.3;padding-top:2px;">${a.habits.best?a.habits.best.icon+" "+a.habits.best.name.split(" ")[0]:"—"}</div>
          <div class="p7-stat-sub">${a.habits.best?Math.round(a.habits.best.done/a.habits.best.total*100)+"% done":""}</div>
        </div>
      </div>
      <div class="p7-wide-card" style="margin-top:0;">
        <div class="p7-wide-card-title">Habit Breakdown</div>
        <div class="p7-bar-wrap">${habitBars}</div>
      </div>
    </div>

    <!-- Recovery -->
    <div class="p7-section">
      <div class="p7-section-header">😴 Recovery Averages</div>
      <div class="p7-stat-grid cols3">
        <div class="p7-stat-card">
          <div class="p7-stat-label">Sleep</div>
          <div class="p7-stat-val sm" style="color:${sleepColor};">${a.recovery.sleep||"—"}</div>
          <div class="p7-stat-sub">avg hrs</div>
        </div>
        <div class="p7-stat-card">
          <div class="p7-stat-label">Energy</div>
          <div class="p7-stat-val sm" style="color:${energyColor};">${a.recovery.energy||"—"}</div>
          <div class="p7-stat-sub">avg /10</div>
        </div>
        <div class="p7-stat-card">
          <div class="p7-stat-label">Hunger</div>
          <div class="p7-stat-val sm" style="color:${hungerColor};">${a.recovery.hunger||"—"}</div>
          <div class="p7-stat-sub">avg /10</div>
        </div>
      </div>
    </div>
  `;
}

// ── END PHASE 7 ───────────────────────────────────────────────────────────────
