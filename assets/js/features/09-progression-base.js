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

