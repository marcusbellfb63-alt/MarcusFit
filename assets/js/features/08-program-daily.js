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
  // Phase 9B lifecycle initialization now runs in app boot before consumers.
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
