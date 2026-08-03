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

