
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

// ── 10.5.0: COHERENT CROSS-DOMAIN EXPORT INFORMATION ARCHITECTURE ───────────
// The accepted domain wrappers fill the explicit section slots below. This
// keeps their load order and ownership intact while producing one deterministic
// high-level -> evidence -> mutation-contract export instead of stacked prompts.
function mf105SafeDayEntries(keys){return (keys||[]).map(function(k){try{return JSON.parse(localStorage.getItem(k)||"null");}catch(e){return null;}}).filter(Boolean);}
function mf105Average(entries,field){const values=entries.map(function(d){return Number(d[field]);}).filter(function(n){return Number.isFinite(n)&&n>0;});return values.length?(values.reduce(function(a,b){return a+b;},0)/values.length).toFixed(1):"n/a";}
function mf105WorkoutSignals(dkeys){
  const out={liftingSessions:0,lowerBodySessions:0,dedicatedCardioSessions:0};
  (dkeys||[]).forEach(function(k){let wo=null;try{wo=JSON.parse(localStorage.getItem(k+"-wo")||"null");}catch(e){}if(!wo||!wo.exercises||!Object.keys(wo.exercises).length)return;const day=getSafeDayForLog(wo.gym||"home",wo.dayIdx),type=day?p9489ClassifyDayType(day):"other";if(type==="cardio")out.dedicatedCardioSessions++;else{out.liftingSessions++;if(type==="lower")out.lowerBodySessions++;}});
  return out;
}
function mf105BuildVitalsExport(entries,wTrend,wTrendAll){
  const count=function(field){return entries.filter(function(d){return d[field]!==null&&d[field]!==undefined&&d[field]!=="";}).length;};
  return "--- VITALS / BODYWEIGHT / RELEVANT TRACKING ---\nWeight trend (selected range): "+wTrend+".\n"+(wTrendAll?wTrendAll+".\n":"")+"Recorded-day averages: sleep "+mf105Average(entries,"sleep")+" hr ("+count("sleep")+" days); energy "+mf105Average(entries,"mood")+"/10 ("+count("mood")+" days); hunger "+mf105Average(entries,"hunger")+"/10 ("+count("hunger")+" days); water "+mf105Average(entries,"water")+" oz ("+count("water")+" days); protein "+mf105Average(entries,"protein")+" g ("+count("protein")+" days).\nThese are recorded observations, not readiness scores. Do not infer injury, calories, or untracked recovery data.\n\n";
}
function mf105BuildRecommendationsExport(){
  const recs=typeof getRecs==="function"?getRecs():{},keys=Object.keys(recs).sort();let out="--- CURRENT RECOMMENDATIONS / EXPERIMENTS ---\n";
  if(!keys.length)return out+"No active day-scoped coaching recommendations.\n\n";
  keys.forEach(function(key){const r=recs[key]||{},items=Array.isArray(r.items)?r.items:[];out+="- "+key+": strategy "+(r.strategy||"unspecified")+"; experimentTag "+(r.experimentTag||"none")+"; expires after "+(r.expiresAfterSessions||"unspecified")+" session(s); "+items.join(" | ")+"\n";});
  return out+"Do not pile new experiments on top blindly; prefer resolving, simplifying, or intentionally retaining these.\n\n";
}
function mf105BuildResponseContract(){
  return "=== AI RESPONSE / MUTATION CONTRACT ===\n\nFirst provide concise prose using these headings: COACHING ASSESSMENT, CHANGES, and WHAT I INTENTIONALLY LEFT ALONE. Review cross-domain conflicts, redundancies, synergies, adherence, and existing experiments. Do not manufacture changes; no change is acceptable. MarcusFit parses only the marked JSON block.\n\n"
    +"MUTATION PERMISSIONS\n- Lifting/core program: directly mutable through the accepted updates array and supported _action entries below. Base program P and history are never mutation targets.\n- Habits: proposal/review mutable only through habitProposal. Import creates a pending proposal; explicit two-stage review/apply is required.\n- Basketball: proposal/review mutable only through basketballProposal. Import creates a pending proposal; explicit review/apply is required.\n- Cardio/activity, vitals/bodyweight, recurring medication adherence, and all historical evidence: advisory/read-only.\n- Pending proposals must not be replaced. Use stable IDs exactly. MarcusFit captures expected-state evidence at import; never send or fabricate expected fingerprints or internal audit/apply/undo fields.\n\n"
    +"ONE TOP-LEVEL JSON CONTRACT\n- Core-only response: the content between markers is the legacy JSON array of lifting updates/actions.\n- Any response containing Habit or Basketball changes: use one object with only the needed keys: {\"updates\":[...],\"habitProposal\":{...},\"basketballProposal\":{...}}. Omit unchanged domains; updates may be omitted or empty.\n- No changes in any domain: use an empty legacy array []. Do not return an object containing only updates.\n- The JSON must contain configuration changes only. Historical records, results, completion state, profiles, medication schedules, backup data, and unsupported cross-domain fields are forbidden.\n\nMARCUSFIT_UPDATE_START\n[]\nMARCUSFIT_UPDATE_END\n\n"
    +"CORE LIFTING\n- Plain update: {\"id\":\"exact-existing-id\",\"load\":\"...\",\"rir\":\"1-2\",\"sets\":\"4\",\"reps\":\"8-12\",\"blurb\":\"under 100 chars\"}. Minor same-exercise rename may include name.\n- Supported _action values: replace, reactivate, remove, reorder, day_override, day_override_clear, day_addition, day_addition_clear, custom_exercise, recommendations.\n- replace uses id plus _newExercise {name, sets, reps, load, rir, blurb}; reorder uses gym, dayIndex, and complete exerciseOrder; day_override uses gym/dayIdx plus supported metadata; day_addition uses gym/dayIdx/name; custom_exercise uses gym/dayIdx/name and lets MarcusFit generate the ID; recommendations uses gym/dayIndex/strategy/experimentTag/expiresAfterSessions/items.\n- Prefer recommendations for bounded cues, reorder for sequencing, replace for a different movement, and custom_exercise only for a genuine addition. Preserve IDs/history and choose the smallest effective change.\n\n"
    +"HABIT PROPOSAL\n{\"habitProposal\":{\"schemaVersion\":1,\"proposalVersion\":\"10.5.0\",\"proposalId\":\"habit-proposal-example\",\"summary\":\"Small sustainable adjustment\",\"rationale\":\"Adherence evidence supports simplification.\",\"changes\":[{\"action\":\"modify\",\"habitId\":\"exact-habit-id\",\"fields\":{\"schedule\":{\"type\":\"daily\"}},\"rationale\":\"Reason\"}]}}\nActions: keep, add, modify, archive, reactivate, reorder. New IDs begin habit-. Modify only name, icon, description, target, schedule, instructions, emphasis. Add requires habitId plus definition with id, name, target, and schedule. Reorder uses a complete order array. Do not convert medication schedules into Habits.\n\n"
    +"BASKETBALL PROPOSAL\n{\"basketballProposal\":{\"schemaVersion\":1,\"proposalVersion\":1,\"proposalId\":\"bball-proposal-example\",\"summary\":\"Small target adjustment\",\"rationale\":\"Session evidence supports it.\",\"changes\":[{\"action\":\"modify_drill\",\"programId\":\"exact-program-id\",\"programVersion\":1,\"sessionId\":\"exact-session-id\",\"drillId\":\"exact-drill-id\",\"fields\":{\"target\":{\"durationMinutes\":10}}}]}}\nActions: modify_drill (name, target, confidence only; never trackingMode), add_drill (new stable bball-ai-...-vN drillId, supported trackingMode/target, zero-based position), remove_drill (future disable), reorder_drills (complete resolved drill order), switch_program (existing built-in only; Session 1 becomes next). Never edit session history, results, snapshots, or queue position.\n\nFormatting: markers on their own lines; valid JSON with straight quotes and no trailing commas; prose may appear before or after the block; markdown fences are tolerated but unnecessary.\n\n=== END EXPORT ===";
}
function mf105ExtractLegacySection(text,start,next){const i=text.indexOf(start);if(i<0)return "";const j=next?text.indexOf(next,i+start.length):-1;return text.slice(i,j>=0?j:text.length).trim()+"\n\n";}
const mf105LegacyGenExport=genExport;
genExport=function(){
  mf105LegacyGenExport();
  const legacy=String(window._exp||""),val=document.getElementById("exportRangeSelect").value,allDkeys=Object.keys(localStorage).filter(function(k){return k.startsWith("day-")&&!k.endsWith("-wo");}).sort(),dkeys=getExportDkeys(),entries=mf105SafeDayEntries(dkeys),signals=mf105WorkoutSignals(dkeys),rangeDesc=val==="program"?"Program templates only":val==="full"?"Full history ("+allDkeys.length+" days)":"Program + last "+val+" days ("+dkeys.length+" of "+allDkeys.length+" total logged days)",today=new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  const weights=entries.filter(function(d){return d.weight;}).map(function(d){return{date:d.date,w:Number(d.weight)};}),allEntries=mf105SafeDayEntries(allDkeys),allWeights=allEntries.filter(function(d){return d.weight;}).map(function(d){return{date:d.date,w:Number(d.weight)};}),first=weights[0],last=weights[weights.length-1],firstAll=allWeights[0],lastAll=allWeights[allWeights.length-1],wTrend=first&&last&&first.date!==last.date?first.w+" lbs ("+first.date+") -> "+last.w+" lbs ("+last.date+") = "+(last.w-first.w).toFixed(1)+" lbs change":"Insufficient data in selected range",wTrendAll=firstAll&&lastAll&&firstAll.date!==lastAll.date?"All-time: "+firstAll.w+" lbs ("+firstAll.date+") -> "+lastAll.w+" lbs ("+lastAll.date+") = "+(lastAll.w-firstAll.w).toFixed(1)+" lbs total change":"";
  let habitAdherence="n/a";try{const a=p960GetHabitAnalytics(dkeys.length?dkeys[0].slice(4):null,dkeys.length?dkeys[dkeys.length-1].slice(4):null);habitAdherence=a.overallPercentage==null?"n/a":a.overallPercentage+"% across "+a.eligibleOpportunities+" eligible opportunities";}catch(e){}
  window.mf105ExportContext={range:val,dkeys:dkeys.slice(),baseSummary:{rangeLabel:rangeDesc,loggedDays:entries.length,liftingSessions:signals.liftingSessions,lowerBodySessions:signals.lowerBodySessions,dedicatedCardioSessions:signals.dedicatedCardioSessions,habitAdherence:habitAdherence,activeRecommendationCount:typeof getRecs==="function"?Object.keys(getRecs()).length:0}};
  const profile=p950BuildUserProfileExport(),firstSync=p957BuildFirstSyncExport(p957GetSharedUserFirstSyncStatus()),prefs="--- PERSISTENT AI COACHING PREFERENCES ---\n"+(p9GetCoachPrefs().trim()||"No user-specific AI coaching preferences saved.")+"\n\n",proposal=p955BuildProposalExport(),lifting=mf105ExtractLegacySection(legacy,"--- CURRENT PROGRAM TEMPLATES ---",legacy.includes("--- DAILY LOG:")?"--- DAILY LOG:":"=== AI SYNC FORMAT INSTRUCTIONS ==="),history=buildLogSection(dkeys,allDkeys),swap=p957GetSharedUserFirstSyncStatus().isLikelyFirstSync?"":p9489BuildSwapCandidateExport();
  let out="=== MARCUSFIT EXPORT ===\nVersion: "+APP_VERSION+"\nGenerated: "+today+"\nExport Range: "+rangeDesc+"\nTotal logged days (all time): "+allDkeys.length+"\n\n--- PROGRAM / USER BASIS ---\n\n"+profile+firstSync+"[[MF105_PROGRAM_BASIS]]\n--- CURRENT COACHING CONTEXT ---\n\n"+prefs+proposal+"[[MF105_CROSS_DOMAIN]]\n--- LIFTING ---\n\n[[MF105_PROGRESSION_GUIDE]]\n"+lifting.replace("--- CURRENT PROGRAM TEMPLATES ---\n\n","")+swap+"[[MF105_BASKETBALL]]\n[[MF105_HABITS]]\n--- CARDIO / ACTIVITY ---\nDedicated cardio sessions in selected range: "+signals.dedicatedCardioSessions+".\nBasketball conditioning is summarized separately and must be counted when judging total cardio load.\nOther walks/activity are advisory only when explicitly recorded; MarcusFit has no general step or activity tracker.\n\n"+mf105BuildVitalsExport(entries,wTrend,wTrendAll)+"[[MF105_RECURRING]]\n--- RECENT HISTORY / PERFORMANCE EVIDENCE ---\n\n"+(history||"No daily or workout history included for this export range.\n\n")+mf105BuildRecommendationsExport()+mf105BuildResponseContract();
  if(p957GetSharedUserFirstSyncStatus().isLikelyFirstSync)out=out.replace("First provide concise prose using these headings:","For this new/shared user, let the selected starter basis and onboarding context control the review. First provide concise prose using these headings:");
  window._exp=out;const target=document.getElementById("exportOut");if(target){target.style.display="block";target.textContent=out;}document.getElementById("copyBtn").style.display="block";return out;
};
// ── END 10.5.0 EXPORT IA ────────────────────────────────────────────────────


function doCopy(){if(!window._exp)return;const btn=document.getElementById("copyBtn");navigator.clipboard.writeText(window._exp).then(()=>{btn.textContent="&#9989; COPIED!";setTimeout(()=>btn.textContent="&#128203; COPY TO CLIPBOARD",2000);}).catch(()=>{const ta=document.createElement("textarea");ta.value=window._exp;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);btn.textContent="&#9989; COPIED!";setTimeout(()=>btn.textContent="&#128203; COPY TO CLIPBOARD",2000);});}
