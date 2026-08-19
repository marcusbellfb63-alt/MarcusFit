
const OVR="mf-overrides";
function getOvr(){try{return JSON.parse(localStorage.getItem(OVR)||"{}")}catch{return{}}}
function setOvr(id,field,val){const o=getOvr();if(!o[id])o[id]={};o[id][field]=val;localStorage.setItem(OVR,JSON.stringify(o));}
function resetOvr(id){const o=getOvr();delete o[id];localStorage.setItem(OVR,JSON.stringify(o));}
function getF(id,field,def){const o=getOvr();return(o[id]&&o[id][field]!==undefined)?o[id][field]:def;}

// ── PHASE 9.4: AI RECOMMENDATION ENGINE ──────────────────────────────────────
//
// Recommendations are coaching guidance — short-term experiments set by AI Sync.
// They are COMPLETELY SEPARATE from exercise programming, progression, and history.
// Storage key: "mf-recommendations"
// Structure: { "gym:dayIndex": { updatedAt, source, strategy, experimentTag,
//                                expiresAfterSessions, items: [...] } }
//
// Recommendations DO NOT:
//   - modify exercise IDs, progression, history, lifecycle state, or reorder state
//   - block the app if missing, malformed, or expired
//   - auto-apply — they are display-only coaching notes

const RECS_KEY = "mf-recommendations";

// Get the full recommendations store (safe, never throws)
function getRecs(){
  try { return JSON.parse(localStorage.getItem(RECS_KEY)||"{}"); }
  catch { return {}; }
}

// Save the full recommendations store
function saveRecs(recs){
  try { localStorage.setItem(RECS_KEY, JSON.stringify(recs)); }
  catch(e) { console.warn("[MarcusFit] Could not save recommendations:", e.message); }
}

// Get recommendations for a specific gym+day key (e.g. "partial:1")
// Returns the rec object or null if none.
function getRecsForDay(gymKey, dayIdx){
  const all = getRecs();
  return all[gymKey+":"+dayIdx] || null;
}

// Set recommendations for a specific gym+day key — called by AI Sync
function setRecsForDay(gymKey, dayIdx, recObj){
  const all = getRecs();
  all[gymKey+":"+dayIdx] = recObj;
  saveRecs(all);
}

// Migrate: if RECS_KEY doesn't exist, initialize empty (auto-migration for existing users)
function recsInitMigrate(){
  if(localStorage.getItem(RECS_KEY) === null){
    saveRecs({});
    console.log(`[MarcusFit] ${APP_VERSION}: Recommendation store initialized.`);
  }
}
// ── END PHASE 9.4 STORAGE ────────────────────────────────────────────────────

// ── PHASE 9B: EXERCISE LIFECYCLE STATE ───────────────────────────────────────
//
// Architecture:
//   mf-exercise-state (localStorage) stores the lifecycle layer:
//   {
//     schemaVersion: 1,
//     customExercises: { "gym-dN-eN": { id, name, sets, reps, load, rir, blurb, gymKey, dayIdx, addedAt } },
//     inactiveIds: { "ex-id": { inactivatedAt, replacedBy } },   // archived exercises
//     replacements: { "old-id": "new-id" },                      // forward link old→new
//     lifecycleVersion: "9.1.0"
//   }
//
// Core principles:
//   - Base P array is NEVER mutated (factory default stays clean)
//   - getResolvedProgram() merges base P + customExercises at runtime
//   - History lookups use stable IDs; inactive IDs are kept but excluded from active program
//   - AI sync saves new exercises to customExercises, not to P
//   - Tweaks (load/reps/rir/blurb/name) stay in OVR under the same ID
//   - Replacing an exercise = archive old ID + assign new ID

const LIFECYCLE_KEY = "mf-exercise-state";
const LIFECYCLE_SCHEMA = 1;

function getLifecycle(){
  try {
    const raw = localStorage.getItem(LIFECYCLE_KEY);
    if(!raw) return exLifecycleDefault();
    const parsed = JSON.parse(raw);
    // Migrate if needed
    if(!parsed.schemaVersion) return exLifecycleDefault();
    return parsed;
  } catch { return exLifecycleDefault(); }
}

function exLifecycleDefault(){
  return {
    schemaVersion: LIFECYCLE_SCHEMA,
    lifecycleVersion: LIFECYCLE_VERSION,
    customExercises: {},   // id → exercise object (AI-added exercises not in base P)
    inactiveIds: {},       // id → { inactivatedAt, replacedBy|null }
    replacements: {},      // oldId → { newId, replacedAt, reason }  (legacy string also supported)
    orderOverrides: {},    // "gym:dayIdx" → [ exerciseId, ... ]  (AI reorder engine, 9.3.0)
    dayOverrides: {},      // gymKey → { dayIdx → { name?, subtitle?, focus?, note?, tag?, meta?, updatedAt?, reason? } }  (9.4.6)
    dayAdditions: {},      // gymKey → { dayIdx → { name, subtitle?, focus?, note?, tag?, source?, createdAt?, updatedAt?, reason?, meta? } }  (9.4.8.1)
    disabledDays: {}       // gymKey → { dayIdx → { disabledAt, source, proposalId, reason } }  (9.5.4C — proposal-driven "remove" day action; base day/history untouched, just hidden from active surfaces)
  };
}

function saveLifecycle(lc){
  localStorage.setItem(LIFECYCLE_KEY, JSON.stringify(lc));
}

// ── Helpers exposed for future AI editing ────────────────────────────────────

// Determine whether a proposed name change is a tweak vs a replacement.
// Returns "tweak" if the name is a minor variation (rename), "replace" if it looks
// like a fundamentally different exercise.
// Heuristic: if >= 50% of words overlap (ignoring common modifiers), treat as tweak.
function exClassifyChange(existingName, proposedName){
  if(!existingName || !proposedName) return "replace";
  const stopWords = new Set(["the","a","an","of","with","on","to","in","for","and","or","at","per","side","low","high","seated","standing","flat","incline","decline","single","double","db","dumbbell","barbell","cable","machine","ez","bar","bench","arm","arms","leg","legs"]);
  const tokenize = s => s.toLowerCase().replace(/[^a-z0-9\s]/g,"").split(/\s+/).filter(w=>w&&!stopWords.has(w));
  const a = new Set(tokenize(existingName));
  const b = new Set(tokenize(proposedName));
  if(!a.size||!b.size) return "replace";
  const intersection = [...a].filter(w=>b.has(w)).length;
  const union = new Set([...a,...b]).size;
  const overlap = intersection / union;
  return overlap >= 0.4 ? "tweak" : "replace";
}

// Generate a safe new exercise ID that does not collide with any existing ID
// (base program, custom exercises, or inactive IDs).
function exGenNewId(gymKey, dayIdx){
  const lc = getLifecycle();
  const allIds = new Set();
  // Collect base P IDs
  if(typeof P !== "undefined"){
    Object.values(P).forEach(days => days.forEach(d => (d.exercises||[]).forEach(ex => allIds.add(ex.id))));
  }
  // Collect custom + inactive IDs
  Object.keys(lc.customExercises).forEach(id => allIds.add(id));
  Object.keys(lc.inactiveIds).forEach(id => allIds.add(id));
  // Find next safe index for this gym+day
  let n = 0;
  while(allIds.has(`${gymKey}-d${dayIdx}-e${n}`)) n++;
  return `${gymKey}-d${dayIdx}-e${n}`;
}

// Archive/inactivate an exercise ID (keeps history, removes from active program)
function exArchiveId(oldId, replacedBy, reason){
  const lc = getLifecycle();
  lc.inactiveIds[oldId] = { inactivatedAt: new Date().toISOString(), replacedBy: replacedBy || null };
  if(replacedBy){
    lc.replacements[oldId] = { newId: replacedBy, replacedAt: new Date().toISOString(), reason: reason || "AI Sync" };
  }
  saveLifecycle(lc);
  console.log(`[MarcusFit] Archived exercise ID: ${oldId}${replacedBy?" → "+replacedBy:""}`);
}

// Remove all replacement links where exId is the source key OR the target.
// Handles both legacy string format and current object format.
// Called during reactivation to prevent stale link warnings.
function exCleanupReplacementLinksForId(exId){
  const lc = getLifecycle();
  Object.keys(lc.replacements).forEach(oldId => {
    // Remove if exId is the source key
    if(oldId === exId){ delete lc.replacements[oldId]; return; }
    // Remove if exId is the target/newId
    const rep = lc.replacements[oldId];
    const newId = (rep && typeof rep === "object") ? rep.newId : rep;
    if(newId === exId) delete lc.replacements[oldId];
  });
  saveLifecycle(lc);
}

// Reactivate an archived exercise (when returning to a previously used lift)
function exReactivateId(exId){
  const lc = getLifecycle();
  if(!lc.inactiveIds[exId]){ console.warn("[MarcusFit] Cannot reactivate: ID not archived:", exId); return false; }
  delete lc.inactiveIds[exId];
  saveLifecycle(lc);
  // Clean up all replacement links referencing this ID (source or target)
  exCleanupReplacementLinksForId(exId);
  console.log(`[MarcusFit] Reactivated exercise ID: ${exId}`);
  return true;
}

// Check if an ID is currently inactive/archived
function exIsInactive(exId){
  const lc = getLifecycle();
  return !!lc.inactiveIds[exId];
}

// Find an archived ID by exact name match (for reactivation when returning to old lift)
function exFindArchivedByName(name){
  if(!name) return null;
  const lc = getLifecycle();
  const norm = s => s.trim().toLowerCase();
  for(const [id, info] of Object.entries(lc.inactiveIds)){
    // Check base P for original name
    let baseName = null;
    if(typeof P !== "undefined"){
      for(const days of Object.values(P)){
        for(const d of days){
          const ex = (d.exercises||[]).find(e=>e.id===id);
          if(ex){ baseName = ex.name; break; }
        }
        if(baseName) break;
      }
    }
    // Check custom exercises
    const customName = lc.customExercises[id]?.name;
    // Check OVR for overridden name
    const ovrName = getF(id,"name",null);
    const candidateName = ovrName || baseName || customName;
    if(candidateName && norm(candidateName) === norm(name)) return id;
  }
  return null;
}

// Normalize an exercise name for duplicate comparison.
// Lowercase, trim, collapse whitespace, strip punctuation.
function exNormName(s){
  if(!s) return "";
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g,"").replace(/\s+/g," ");
}

// Find an active exercise in the resolved program by normalized name on a specific gym+day.
// Returns the exercise object or null.
function exFindActiveByName(gymKey, dayIdx, name){
  const norm = exNormName(name);
  if(!norm) return null;
  const day = getProgramDay(gymKey,dayIdx);
  if(!day) return null;
  return (day.exercises||[]).find(ex => {
    const exName = getF(ex.id,"name",ex.name)||"";
    return exNormName(exName) === norm;
  }) || null;
}

// Find the replacement exercise ID for a given source ID (the ID the source was replaced by).
// Returns the newId string or null.
function exFindReplacementForSource(sourceId){
  const lc = getLifecycle();
  const rep = lc.replacements[sourceId];
  if(!rep) return null;
  return (rep && typeof rep === "object") ? rep.newId : rep;
}

// Add a custom exercise (AI-added, not in base P) to the lifecycle state
// Returns the exercise object with its stable ID.
function exAddCustom(gymKey, dayIdx, exObj){
  const lc = getLifecycle();
  const id = exObj.id || exGenNewId(gymKey, dayIdx);
  const entry = { ...exObj, id, gymKey, dayIdx: parseInt(dayIdx), addedAt: new Date().toISOString() };
  lc.customExercises[id] = entry;
  saveLifecycle(lc);
  console.log(`[MarcusFit] Added custom exercise: ${id} (${entry.name})`);
  return entry;
}

// Get the resolved program — merges base P with lifecycle custom exercises.
// Returns the same shape as P but with custom exercises appended per day.
// Base P is NEVER mutated.
function getResolvedProgram(){
  const lc = getLifecycle();
  // Deep-clone base P
  const resolved = {};
  Object.entries(P).forEach(([gymKey, days]) => {
    resolved[gymKey] = days.map((day, dayIdx) => {
      // Filter out any exercises that are in inactiveIds (safety check — base P shouldn't have these,
      // but defensive in case of future AI operations)
      const baseExercises = (day.exercises||[]).filter(ex => !lc.inactiveIds[ex.id]);
      // Append custom exercises for this gym+day
      const customs = Object.values(lc.customExercises)
        .filter(ex => ex.gymKey === gymKey && ex.dayIdx === dayIdx && !lc.inactiveIds[ex.id])
        .sort((a,b) => (a.addedAt||"").localeCompare(b.addedAt||""));
      let exercises = [...baseExercises, ...customs];

      // ── Apply orderOverrides (9.3.0) ──────────────────────────────────────────
      // Order overrides only reorder — they never add or remove exercises.
      const overrideKey = gymKey + ":" + dayIdx;
      const override = (lc.orderOverrides||{})[overrideKey];
      if(override && Array.isArray(override) && override.length > 0){
        const activeIds = new Set(exercises.map(e => e.id));
        const exMap = {};
        exercises.forEach(e => { exMap[e.id] = e; });
        // Build ordered list: use override order, skip unknown/inactive IDs
        const ordered = override.filter(id => activeIds.has(id)).map(id => exMap[id]);
        // Append any active exercises missing from the override (in original resolved order)
        const orderedSet = new Set(override.filter(id => activeIds.has(id)));
        const appended = exercises.filter(e => !orderedSet.has(e.id));
        exercises = [...ordered, ...appended];
      }
      // ── End orderOverrides ────────────────────────────────────────────────────

      return { ...day, exercises };
    });
  });
  return resolved;
}

// Defensive safeguard: before applying a sync update that would reuse an ID for a different exercise,
// check if the proposed name is actually a different exercise.
// Returns { action: "tweak"|"replace"|"reactivate", archivedId? }
function exCheckSyncAction(exId, proposedName){
  // Is this ID currently inactive? If so, check if this name matches — that's a reactivation.
  if(exIsInactive(exId)){
    return { action: "reactivate" };
  }
  // Is this ID a known exercise? Check current name.
  let currentName = getF(exId,"name",null);
  if(!currentName && typeof P !== "undefined"){
    for(const days of Object.values(P)){
      for(const d of days){
        const ex = (d.exercises||[]).find(e=>e.id===exId);
        if(ex){ currentName = ex.name; break; }
      }
      if(currentName) break;
    }
  }
  if(!currentName) return { action: "tweak" }; // ID not known — safe to set
  if(!proposedName) return { action: "tweak" }; // No name change
  const classification = exClassifyChange(currentName, proposedName);
  if(classification === "replace"){
    // Check if we have an archived version of this name
    const archivedId = exFindArchivedByName(proposedName);
    if(archivedId) return { action: "reactivate", archivedId };
    return { action: "replace" };
  }
  return { action: "tweak" };
}

// Migration: initialize lifecycle state for users with no existing state.
// Called on load — safe to call even if state already exists.
function exInitLifecycle(){
  const existing = localStorage.getItem(LIFECYCLE_KEY);
  if(!existing){
    // First run — initialize with defaults. Log any existing OVR data — these were all tweaks
    // (name renames, load changes) so they are all safe to keep under their existing IDs.
    saveLifecycle(exLifecycleDefault());
    console.log("[MarcusFit] Phase 9B: Lifecycle state initialized for existing user.");
  } else {
    // Validate schema — if corrupt, reset gracefully
    try {
      const parsed = JSON.parse(existing);
      if(!parsed.schemaVersion){
        saveLifecycle(exLifecycleDefault());
        console.warn("[MarcusFit] Phase 9B: Corrupt lifecycle state reset to defaults.");
      } else {
        // Migrate lifecycleVersion string and replacements format if needed (9.1.x → 9.3.0)
        // 9.2.x/9.3.x state is fully compatible; only version string and new fields need updating.
        let dirty = false;
        if(parsed.lifecycleVersion !== LIFECYCLE_VERSION){
          parsed.lifecycleVersion = LIFECYCLE_VERSION;
          dirty = true;
        }
        // Migrate old replacements format: string values → object values
        if(parsed.replacements){
          Object.keys(parsed.replacements).forEach(oldId => {
            const rep = parsed.replacements[oldId];
            if(typeof rep === "string"){
              parsed.replacements[oldId] = { newId: rep, replacedAt: null, reason: "legacy" };
              dirty = true;
            }
          });
        }
        // Migrate: add orderOverrides if not present (9.3.0 — old backups won't have it)
        if(!parsed.orderOverrides){
          parsed.orderOverrides = {};
          dirty = true;
        }
        // Migrate: add dayOverrides if not present (9.4.6 — old backups won't have it)
        if(!parsed.dayOverrides){
          parsed.dayOverrides = {};
          dirty = true;
        }
        // Migrate: add dayAdditions if not present (9.4.8.1 — old backups won't have it)
        if(!parsed.dayAdditions){
          parsed.dayAdditions = {};
          dirty = true;
        }
        // Migrate: add disabledDays if not present (9.5.4C — old backups won't have it)
        if(!parsed.disabledDays){
          parsed.disabledDays = {};
          dirty = true;
        }
        if(dirty) saveLifecycle(parsed);
      }
    } catch {
      saveLifecycle(exLifecycleDefault());
      console.warn("[MarcusFit] Phase 9B: Could not parse lifecycle state — reset to defaults.");
    }
  }
}

// MarcusFit 10.1.3: collect persisted evidence for virtual-day identity without
// mutating lifecycle state or historical records. A single custom exercise is
// not sufficient proof by itself; recovery requires multiple active exercises
// or an active exercise plus another persisted reference to the same gym/day.
function mfCollectProgramDayIntegrity(lifecycle){
  const lc = lifecycle || getLifecycle();
  const groups = {};
  const invalidOrphans = [];
  const validGyms = (typeof P === "undefined") ? [] : Object.keys(P);
  function group(gymKey, dayIdx){
    const key = gymKey+":"+dayIdx;
    if(!groups[key]) groups[key] = {key,gymKey,dayIdx,activeCustomIds:[],archivedCustomIds:[],workoutKeys:[],workoutNames:[],dailyKeys:[],hasRecommendation:false,hasOrderOverride:false,hasDayOverride:false,hasDisabledDay:false};
    return groups[key];
  }
  function virtualIndex(gymKey, rawIdx){
    const idx = typeof rawIdx === "number" ? rawIdx : parseInt(rawIdx,10);
    return validGyms.includes(gymKey) && Number.isInteger(idx) && idx >= P[gymKey].length ? idx : null;
  }

  Object.values(lc.customExercises||{}).forEach(function(ex){
    if(!ex || typeof ex !== "object") { invalidOrphans.push("malformed custom exercise record"); return; }
    const idx = virtualIndex(ex.gymKey, ex.dayIdx);
    if(idx === null){
      if(!validGyms.includes(ex.gymKey) || !Number.isInteger(ex.dayIdx)) invalidOrphans.push("custom exercise '"+(ex.id||"unknown")+"' has invalid gym/day identity");
      return;
    }
    const target = group(ex.gymKey, idx);
    (lc.inactiveIds||{})[ex.id] ? target.archivedCustomIds.push(ex.id) : target.activeCustomIds.push(ex.id);
  });

  Object.keys(lc.orderOverrides||{}).forEach(function(key){
    const split = key.lastIndexOf(":");
    if(split < 1) return;
    const gymKey = key.slice(0,split), idx = virtualIndex(gymKey,key.slice(split+1));
    if(idx !== null) group(gymKey,idx).hasOrderOverride = true;
  });
  Object.entries(lc.dayOverrides||{}).forEach(function(pair){
    Object.keys(pair[1]||{}).forEach(function(rawIdx){const idx=virtualIndex(pair[0],rawIdx);if(idx!==null)group(pair[0],idx).hasDayOverride=true;});
  });
  Object.entries(lc.disabledDays||{}).forEach(function(pair){
    Object.keys(pair[1]||{}).forEach(function(rawIdx){const idx=virtualIndex(pair[0],rawIdx);if(idx!==null)group(pair[0],idx).hasDisabledDay=true;});
  });
  Object.keys(getRecs()).forEach(function(key){
    const split=key.lastIndexOf(":"),gymKey=key.slice(0,split),idx=virtualIndex(gymKey,key.slice(split+1));
    if(idx!==null)group(gymKey,idx).hasRecommendation=true;
  });
  Object.keys(localStorage).filter(function(key){return /^day-/.test(key);}).sort().forEach(function(key){
    let data;try{data=JSON.parse(localStorage.getItem(key));}catch(e){return;}
    const isWorkout=/-wo$/.test(key),gymKey=(data&&(isWorkout?data.gym:data.logGym))||"home",rawIdx=data&&(isWorkout?data.dayIdx:data.woDayIdx),idx=virtualIndex(gymKey,rawIdx);
    if(idx===null)return;
    const target=group(gymKey,idx);
    if(isWorkout){target.workoutKeys.push(key);if(typeof data.dayName==="string"&&data.dayName.trim())target.workoutNames.push({key,name:data.dayName.trim()});}
    else target.dailyKeys.push(key);
  });

  Object.values(groups).forEach(function(target){
    const hasCorroboration=target.hasRecommendation||target.hasOrderOverride||target.hasDayOverride||target.hasDisabledDay||target.workoutKeys.length>0||target.dailyKeys.length>0;
    target.recoverable=target.activeCustomIds.length>=2||(target.activeCustomIds.length>=1&&hasCorroboration);
    target.archivedOnly=target.activeCustomIds.length===0&&target.archivedCustomIds.length>0&&!target.hasRecommendation&&!target.hasOrderOverride&&!target.hasDayOverride&&!target.hasDisabledDay;
  });
  return {groups,invalidOrphans};
}

function mfRepairLegacyVirtualDays(){
  const lc=getLifecycle(),integrity=mfCollectProgramDayIntegrity(lc),repairedDays=[];
  Object.values(integrity.groups).sort(function(a,b){return a.gymKey.localeCompare(b.gymKey)||a.dayIdx-b.dayIdx;}).forEach(function(target){
    if(!target.recoverable||(((lc.dayAdditions||{})[target.gymKey]||{})[String(target.dayIdx)]))return;
    const dayOverride=(((lc.dayOverrides||{})[target.gymKey]||{})[String(target.dayIdx)])||{};
    const historical=target.workoutNames.slice().sort(function(a,b){return b.key.localeCompare(a.key);})[0];
    const name=(typeof dayOverride.name==="string"&&dayOverride.name.trim())?dayOverride.name.trim():(historical?historical.name:"Recovered Day "+(target.dayIdx+1));
    lc.dayAdditions=lc.dayAdditions||{};lc.dayAdditions[target.gymKey]=lc.dayAdditions[target.gymKey]||{};
    const evidence=[];
    if(target.activeCustomIds.length)evidence.push("active_custom_exercises");
    if(target.workoutKeys.length)evidence.push("workout_history");
    if(target.dailyKeys.length)evidence.push("daily_history");
    if(target.hasRecommendation)evidence.push("recommendations");
    if(target.hasOrderOverride)evidence.push("order_override");
    if(target.hasDayOverride)evidence.push("day_override");
    if(target.hasDisabledDay)evidence.push("disabled_day_reference");
    const addition={name:name,source:"system",reason:"Recovered legacy virtual day metadata",meta:{migrationVersion:"10.1.3",evidence:evidence}};
    ["subtitle","focus","note","tag"].forEach(function(field){if(dayOverride[field]!==undefined)addition[field]=dayOverride[field];});
    lc.dayAdditions[target.gymKey][String(target.dayIdx)]=addition;
    repairedDays.push({gymKey:target.gymKey,dayIdx:target.dayIdx,name:name,evidence:evidence.slice(),activeExerciseCount:target.activeCustomIds.length});
  });
  if(repairedDays.length){saveLifecycle(lc);console.log("[MarcusFit] 10.1.3 repaired "+repairedDays.length+" legacy virtual day(s).",repairedDays);}
  return {repairedDayCount:repairedDays.length,repairedDays:repairedDays,invalidOrphanCount:integrity.invalidOrphans.length};
}

window.mfRepairLegacyVirtualDays=mfRepairLegacyVirtualDays;

// ── END PHASE 9B LIFECYCLE HELPERS ───────────────────────────────────────────

// ── PHASE 9.4.6: DAY STRUCTURE OVERRIDE ENGINE ───────────────────────────────
//
// Allows AI Sync to modify workout day-level metadata (name, subtitle, focus,
// note, tag, meta) without mutating base P. Overrides are stored inside the
// existing lifecycle object under the `dayOverrides` key.
//
// Structure:
//   lc.dayOverrides = {
//     [gymKey]: {
//       [dayIdx]: {
//         name?, subtitle?, focus?, note?, tag?, meta?, updatedAt?, reason?
//       }
//     }
//   }
//
// Base P is NEVER mutated. If no override exists, rendering is identical to v9.4.5.3.

// Allowed day-level override fields (safe list — unknown fields are rejected)
const DAY_OVERRIDE_FIELDS = ["name", "subtitle", "focus", "note", "tag", "meta"];

// Read the raw override object for a specific gym+day (or null if none)
function getDayOverride(gymKey, dayIdx){
  const lc = getLifecycle();
  const gymOverrides = (lc.dayOverrides || {})[gymKey];
  if(!gymOverrides) return null;
  return gymOverrides[String(dayIdx)] || null;
}

// Set (merge) day override fields for a specific gym+day.
// Only known safe fields from DAY_OVERRIDE_FIELDS are written.
// Unknown fields are silently dropped (use meta:{} for custom data).
// Preserves any existing override fields not included in the update.
function setDayOverride(gymKey, dayIdx, fields, reason){
  const lc = getLifecycle();
  if(!lc.dayOverrides) lc.dayOverrides = {};
  if(!lc.dayOverrides[gymKey]) lc.dayOverrides[gymKey] = {};
  const key = String(dayIdx);
  const existing = lc.dayOverrides[gymKey][key] || {};
  const updated = { ...existing };
  DAY_OVERRIDE_FIELDS.forEach(f => {
    if(fields[f] !== undefined) updated[f] = fields[f];
  });
  updated.updatedAt = new Date().toISOString();
  if(reason) updated.reason = reason;
  lc.dayOverrides[gymKey][key] = updated;
  saveLifecycle(lc);
  console.log(`[MarcusFit] dayOverride set: ${gymKey} d${dayIdx}`, updated);
}

// Clear (delete) the override for a specific gym+day.
// If gymKey+dayIdx is omitted, clears ALL overrides for that gym (dayIdx null)
// or clears everything (both null). Use with care.
function clearDayOverride(gymKey, dayIdx){
  const lc = getLifecycle();
  if(!lc.dayOverrides) return;
  if(!gymKey){
    // Clear everything
    lc.dayOverrides = {};
    saveLifecycle(lc);
    console.log("[MarcusFit] dayOverride: ALL overrides cleared");
    return;
  }
  if(dayIdx === undefined || dayIdx === null){
    // Clear all overrides for this gym
    delete lc.dayOverrides[gymKey];
    saveLifecycle(lc);
    console.log(`[MarcusFit] dayOverride: all overrides cleared for gym '${gymKey}'`);
    return;
  }
  if(!lc.dayOverrides[gymKey]) return;
  delete lc.dayOverrides[gymKey][String(dayIdx)];
  // Clean up empty gym entry
  if(!Object.keys(lc.dayOverrides[gymKey]).length) delete lc.dayOverrides[gymKey];
  saveLifecycle(lc);
  console.log(`[MarcusFit] dayOverride: cleared for ${gymKey} d${dayIdx}`);
}

// Compute effective day metadata by merging base day + override.
// Returns a new object — does NOT mutate base day or override.
// If no override exists, returns the base day unchanged (same reference — safe for callers).
// 9.4.8.2 note: renamed to _getEffectiveDayMetaBase; getEffectiveDayMeta (virtual-aware) is defined in 9.4.8.2 block below.
function _getEffectiveDayMetaBase(gymKey, dayIdx, baseDay){
  const ovr = getDayOverride(gymKey, dayIdx);
  if(!ovr) return baseDay; // fast path — identical to v9.4.5.3 when no override
  // Merge: override fields win; base day is fallback for missing fields
  return {
    ...baseDay,
    name:     ovr.name     !== undefined ? ovr.name     : baseDay.name,
    focus:    ovr.focus    !== undefined ? ovr.focus    : baseDay.focus,
    note:     ovr.note     !== undefined ? ovr.note     : baseDay.note,
    tag:      ovr.tag      !== undefined ? ovr.tag      : baseDay.tag,
    // subtitle is not in base P but is supported as an override extension
    subtitle: ovr.subtitle !== undefined ? ovr.subtitle : (baseDay.subtitle || null),
    // meta is purely additive
    _dayOverrideMeta: ovr.meta || null
  };
}

// ── END PHASE 9.4.6 DAY OVERRIDE ENGINE ──────────────────────────────────────


// ── PHASE 9.4.8.1: VIRTUAL/ADDITIVE DAY ENGINE FOUNDATION ────────────────────
//
// Stores metadata for workout days that do not exist in base P.
// Virtual days use dayIdx values >= P[gymKey].length.
// Base P is NEVER mutated.
// All data lives inside the existing lifecycle key (LIFECYCLE_KEY).
//
// Structure:
//   lc.dayAdditions = {
//     [gymKey]: {
//       [dayIdx]: {
//         name: string,
//         subtitle?: string,
//         focus?: string,
//         note?: string,
//         tag?: string,
//         source?: "ai_sync" | "manual" | "system",
//         createdAt?: ISO timestamp,
//         updatedAt?: ISO timestamp,
//         reason?: string,
//         meta?: object
//       }
//     }
//   }

// Safe fields for day additions (unknown top-level fields are rejected)
const DAY_ADDITION_FIELDS = ["name", "subtitle", "focus", "note", "tag", "source", "meta"];

// Valid source values
const DAY_ADDITION_SOURCES = ["ai_sync", "manual", "system"];

// Get the raw addition object for a specific gym+day (or null if none)
function getDayAddition(gymKey, dayIdx){
  const lc = getLifecycle();
  const gymAdditions = (lc.dayAdditions || {})[gymKey];
  if(!gymAdditions) return null;
  return gymAdditions[String(dayIdx)] || null;
}

// Create or update a virtual/additive day entry.
// - gymKey must exist in P
// - dayIdx must be numeric, integer, and >= P[gymKey].length (no collision with base days)
// - Only fields in DAY_ADDITION_FIELDS are written; unknown fields are silently dropped
// - Preserves existing fields not included in the partial update
// - Sets createdAt only when creating a new entry
// - Always updates updatedAt
// - Returns { ok: true, created: bool } on success or { ok: false, reason: string } on failure
function setDayAddition(gymKey, dayIdx, fields, reason){
  // Validate gymKey
  if(typeof P === "undefined" || !P[gymKey]){
    return { ok: false, reason: "Invalid gymKey: '" + gymKey + "'. Must be a key in P." };
  }
  // Validate dayIdx
  if(typeof dayIdx !== "number" || !Number.isInteger(dayIdx) || dayIdx < 0){
    return { ok: false, reason: "dayIdx must be a non-negative integer." };
  }
  // Reject collision with base P days
  const baseLen = P[gymKey].length;
  if(dayIdx < baseLen){
    return { ok: false, reason: "dayIdx " + dayIdx + " collides with base P (gym '" + gymKey + "' has " + baseLen + " base days, indices 0–" + (baseLen - 1) + "). Virtual days must use dayIdx >= " + baseLen + "." };
  }
  // Validate fields
  if(!fields || typeof fields !== "object"){
    return { ok: false, reason: "fields must be an object." };
  }

  const lc = getLifecycle();
  if(!lc.dayAdditions) lc.dayAdditions = {};
  if(!lc.dayAdditions[gymKey]) lc.dayAdditions[gymKey] = {};

  const key = String(dayIdx);
  const existing = lc.dayAdditions[gymKey][key] || null;
  const isNew = !existing;
  const updated = existing ? { ...existing } : {};

  // Write safe fields only
  DAY_ADDITION_FIELDS.forEach(f => {
    if(f === "source"){
      // Validate source value
      if(fields.source !== undefined){
        if(DAY_ADDITION_SOURCES.includes(fields.source)){
          updated.source = fields.source;
        }
        // else silently drop invalid source
      }
    } else if(f === "meta"){
      // meta must be an object
      if(fields.meta !== undefined && fields.meta !== null && typeof fields.meta === "object" && !Array.isArray(fields.meta)){
        updated.meta = fields.meta;
      }
    } else {
      if(fields[f] !== undefined) updated[f] = fields[f];
    }
  });

  // Timestamps
  if(isNew) updated.createdAt = new Date().toISOString();
  updated.updatedAt = new Date().toISOString();

  // Reason
  if(reason) updated.reason = reason;

  lc.dayAdditions[gymKey][key] = updated;
  saveLifecycle(lc);
  console.log(`[MarcusFit] dayAddition ${isNew?"created":"updated"}: ${gymKey} d${dayIdx}`, updated);
  return { ok: true, created: isNew };
}

// Remove one virtual/additive day entry.
// Safe no-op if the entry does not exist.
// Does NOT touch base P, exercises, orderOverrides, or recommendations.
function clearDayAddition(gymKey, dayIdx){
  // Validate gymKey
  if(typeof P === "undefined" || !P[gymKey]){
    console.warn("[MarcusFit] clearDayAddition: invalid gymKey '" + gymKey + "'");
    return;
  }
  // Validate dayIdx
  if(typeof dayIdx !== "number" || !Number.isInteger(dayIdx)){
    console.warn("[MarcusFit] clearDayAddition: dayIdx must be an integer");
    return;
  }
  const lc = getLifecycle();
  if(!lc.dayAdditions || !lc.dayAdditions[gymKey]) return; // safe no-op
  const key = String(dayIdx);
  if(!lc.dayAdditions[gymKey][key]) return; // safe no-op
  delete lc.dayAdditions[gymKey][key];
  // Clean up empty gym entry
  if(!Object.keys(lc.dayAdditions[gymKey]).length) delete lc.dayAdditions[gymKey];
  saveLifecycle(lc);
  console.log(`[MarcusFit] dayAddition cleared: ${gymKey} d${dayIdx}`);
}

// Returns true only when:
//   - gymKey exists in P
//   - dayIdx is outside base P (>= P[gymKey].length)
//   - a matching dayAddition entry exists in lifecycle
function isVirtualDay(gymKey, dayIdx){
  if(typeof P === "undefined" || !P[gymKey]) return false;
  if(typeof dayIdx !== "number" || !Number.isInteger(dayIdx)) return false;
  if(dayIdx < P[gymKey].length) return false;
  return getDayAddition(gymKey, dayIdx) !== null;
}

// Returns total count of virtual/additive days across all gyms.
// Accepts a lifecycle object (lc) — safe if dayAdditions is missing.
function getDayAdditionCount(lc){
  if(!lc || !lc.dayAdditions) return 0;
  let count = 0;
  Object.values(lc.dayAdditions).forEach(gymEntries => {
    if(gymEntries && typeof gymEntries === "object"){
      count += Object.keys(gymEntries).length;
    }
  });
  return count;
}

// Expose helpers to window (matching existing debug/helper pattern)
window.getDayAddition    = getDayAddition;
window.setDayAddition    = setDayAddition;
window.clearDayAddition  = clearDayAddition;
window.isVirtualDay      = isVirtualDay;

// ── END PHASE 9.4.8.1 VIRTUAL DAY ENGINE FOUNDATION ──────────────────────────


// ── PHASE 9.5.4C: DISABLED-DAY LIFECYCLE STRUCTURE ───────────────────────────
//
// Represents a base day that a proposal's "remove" action targets. The day
// itself, its exercises, and its history are NEVER deleted or mutated — this
// is a read-safe flag only. Disabled days are excluded from the normal
// active-program list (Program tab) and the Daily Log workout-day selector,
// but remain fully resolvable via getResolvedDays()/getSafeDayForLog() for
// history rendering and debugging.
//
// Structure:
//   lc.disabledDays = {
//     [gymKey]: {
//       [dayIdx]: { disabledAt, source, proposalId, reason }
//     }
//   }
//
// Base P is NEVER mutated. Cardio/recovery days must never be disabled
// unless a proposal explicitly targets that exact day with action:"remove".

// Read the raw disabled-day record for a specific gym+day (or null if none)
function getDisabledDay(gymKey, dayIdx){
  const lc = getLifecycle();
  const gymDisabled = (lc.disabledDays || {})[gymKey];
  if(!gymDisabled) return null;
  return gymDisabled[String(dayIdx)] || null;
}

// Convenience boolean check — safe against missing lifecycle structures.
function isDayDisabled(gymKey, dayIdx){
  return getDisabledDay(gymKey, dayIdx) !== null;
}

// Create/overwrite the disabled-day record for a specific gym+day.
// metadata: { source, proposalId, reason } — disabledAt is always stamped now.
// Does not touch base P, exercises, dayOverrides, dayAdditions, or history.
function setDisabledDay(gymKey, dayIdx, metadata){
  if(typeof P === "undefined" || !P[gymKey]){
    return { ok: false, reason: "Invalid gymKey: '" + gymKey + "'. Must be a key in P." };
  }
  if(typeof dayIdx !== "number" || !Number.isInteger(dayIdx) || dayIdx < 0){
    return { ok: false, reason: "dayIdx must be a non-negative integer." };
  }
  const meta = (metadata && typeof metadata === "object") ? metadata : {};
  const lc = getLifecycle();
  if(!lc.disabledDays) lc.disabledDays = {};
  if(!lc.disabledDays[gymKey]) lc.disabledDays[gymKey] = {};
  lc.disabledDays[gymKey][String(dayIdx)] = {
    disabledAt: new Date().toISOString(),
    source: (typeof meta.source === "string" && meta.source) ? meta.source : "onboarding_proposal",
    proposalId: (typeof meta.proposalId === "string") ? meta.proposalId : null,
    reason: (typeof meta.reason === "string") ? meta.reason : ""
  };
  saveLifecycle(lc);
  console.log(`[MarcusFit] disabledDay set: ${gymKey} d${dayIdx}`, lc.disabledDays[gymKey][String(dayIdx)]);
  return { ok: true };
}

// Clear (re-enable) a disabled day. Safe no-op if no record exists. Never
// touches base P, exercises, or history — this only removes the hide flag.
function clearDisabledDay(gymKey, dayIdx){
  const lc = getLifecycle();
  if(!lc.disabledDays || !lc.disabledDays[gymKey]) return;
  const key = String(dayIdx);
  if(!lc.disabledDays[gymKey][key]) return;
  delete lc.disabledDays[gymKey][key];
  if(!Object.keys(lc.disabledDays[gymKey]).length) delete lc.disabledDays[gymKey];
  saveLifecycle(lc);
  console.log(`[MarcusFit] disabledDay cleared: ${gymKey} d${dayIdx}`);
}

// Returns total count of disabled days across all gyms. Accepts a lifecycle
// object (lc) — safe if disabledDays is missing.
function getDisabledDayCount(lc){
  if(!lc || !lc.disabledDays) return 0;
  let count = 0;
  Object.values(lc.disabledDays).forEach(gymEntries => {
    if(gymEntries && typeof gymEntries === "object"){
      count += Object.keys(gymEntries).length;
    }
  });
  return count;
}

window.getDisabledDay   = getDisabledDay;
window.isDayDisabled    = isDayDisabled;
window.setDisabledDay   = setDisabledDay;
window.clearDisabledDay = clearDisabledDay;

// ── END PHASE 9.5.4C DISABLED-DAY LIFECYCLE STRUCTURE ────────────────────────


// ── PHASE 9.4.8.2: VIRTUAL/ADDITIVE DAY RENDERING + SELECTORS ────────────────
//
// getResolvedDays(gymKey) — Return the full effective day list for a gym:
//   - base P[gymKey] days first (indices 0..N-1), merged with getResolvedProgram()
//   - virtual/additive dayAdditions after base days, ordered by numeric dayIdx
//   - each returned day object is compatible with existing render paths
//   - does NOT mutate P
//
// Virtual day objects have the shape:
//   { day, name, focus, note, tag, color, exercises: [], _isVirtual: true, _dayIdx: N }
//
function getResolvedDays(gymKey){
  const RP = getResolvedProgram();
  const baseDays = (RP[gymKey] || []).map((day, i) => ({
    ...day,
    _dayIdx: i,
    _isVirtual: false
  }));

  // Collect virtual days from dayAdditions for this gym
  const lc = getLifecycle();
  const gymAdditions = (lc.dayAdditions || {})[gymKey] || {};
  const baseLen = (P[gymKey] || []).length;

  const virtualDays = Object.entries(gymAdditions)
    .map(([key, entry]) => ({ _rawKey: key, _dayIdx: parseInt(key, 10), entry }))
    .filter(({ _dayIdx }) => !isNaN(_dayIdx) && _dayIdx >= baseLen)
    .sort((a, b) => a._dayIdx - b._dayIdx)
    .map(({ _dayIdx, entry }) => {
      // Build a day object compatible with renderProgram / populateWoDaySelect / renderWoExercises
      // Pull in custom exercises that belong to this virtual day (same path as base days)
      const customs = Object.values(lc.customExercises || {})
        .filter(ex => ex.gymKey === gymKey && ex.dayIdx === _dayIdx && !lc.inactiveIds[ex.id])
        .sort((a, b) => (a.addedAt || "").localeCompare(b.addedAt || ""));

      // Apply orderOverrides if present
      const overrideKey = gymKey + ":" + _dayIdx;
      const override = (lc.orderOverrides || {})[overrideKey];
      let exercises = [...customs];
      if(override && Array.isArray(override) && override.length > 0){
        const activeIds = new Set(exercises.map(e => e.id));
        const exMap = {};
        exercises.forEach(e => { exMap[e.id] = e; });
        const ordered = override.filter(id => activeIds.has(id)).map(id => exMap[id]);
        const orderedSet = new Set(override.filter(id => activeIds.has(id)));
        const appended = exercises.filter(e => !orderedSet.has(e.id));
        exercises = [...ordered, ...appended];
      }

      const humanDay = "Day " + (_dayIdx + 1);
      return {
        // Metadata from dayAddition
        day:      humanDay,
        name:     entry.name     || humanDay,
        focus:    entry.focus    || entry.subtitle || "",
        note:     entry.note     || "",
        tag:      entry.tag      || "added",
        color:    "var(--muted)",
        subtitle: entry.subtitle || null,
        exercises,
        _isVirtual: true,
        _dayIdx,
        _dayAddition: entry
      };
    });

  return [...baseDays, ...virtualDays];
}

// Canonical program-day lookup used by rendering, export, Sync, and History.
// Stable identity is always gymKey + original dayIdx; virtual gaps never shift.
function getProgramDay(gymKey, dayIdx){
  const idx=typeof dayIdx==="number"?dayIdx:parseInt(dayIdx,10);
  if(!Number.isInteger(idx)||idx<0||typeof P==="undefined"||!P[gymKey])return null;
  return getResolvedDays(gymKey).find(function(day){return day._dayIdx===idx;})||null;
}
function isBaseProgramDay(gymKey,dayIdx){
  const idx=typeof dayIdx==="number"?dayIdx:parseInt(dayIdx,10);
  return Number.isInteger(idx)&&idx>=0&&typeof P!=="undefined"&&!!P[gymKey]&&idx<P[gymKey].length;
}
function isProgramDay(gymKey,dayIdx){return getProgramDay(gymKey,dayIdx)!==null;}

// Virtual-aware getEffectiveDayMeta — replaces the original (renamed to _getEffectiveDayMetaBase above).
// For base days: delegates to _getEffectiveDayMetaBase (unchanged behavior).
// For virtual days: metadata comes from dayAdditions; dayOverrides still applied on top.
function getEffectiveDayMeta(gymKey, dayIdx, baseDay){
  // If baseDay is provided and is not virtual, use original base path
  if(baseDay && !baseDay._isVirtual){
    return _getEffectiveDayMetaBase(gymKey, dayIdx, baseDay);
  }
  // Virtual day path — baseDay may be the virtual day object from getResolvedDays
  // or null/undefined. Build safe meta from dayAdditions.
  const addition = getDayAddition(gymKey, dayIdx);
  const humanDay = "Day " + (dayIdx + 1);
  const base = baseDay || {
    day:   humanDay,
    name:  (addition && addition.name)  || humanDay,
    focus: (addition && addition.focus) || (addition && addition.subtitle) || "",
    note:  (addition && addition.note)  || "",
    tag:   (addition && addition.tag)   || "added",
    color: "var(--muted)",
    exercises: []
  };
  // Still apply any dayOverrides on top (for future-proofing)
  const ovr = getDayOverride(gymKey, dayIdx);
  if(!ovr) return base;
  return {
    ...base,
    name:     ovr.name     !== undefined ? ovr.name     : base.name,
    focus:    ovr.focus    !== undefined ? ovr.focus    : base.focus,
    note:     ovr.note     !== undefined ? ovr.note     : base.note,
    tag:      ovr.tag      !== undefined ? ovr.tag      : base.tag,
    subtitle: ovr.subtitle !== undefined ? ovr.subtitle : (base.subtitle || null),
    _dayOverrideMeta: ovr.meta || null
  };
}

// Expose to window
window.getResolvedDays = getResolvedDays;
window.getProgramDay = getProgramDay;
window.isBaseProgramDay = isBaseProgramDay;
window.isProgramDay = isProgramDay;

// ── END PHASE 9.4.8.2 ────────────────────────────────────────────────────────

// ── PHASE 9.4.8.3: VIRTUAL DAY LOGGING + HISTORY SAFETY ──────────────────────
//
// getSafeDayDisplayName(gymKey, dayIdx)
//   Safely resolves a day name for logging, history, export, and badge surfaces.
//   Works for base days, virtual/additive days, and cleared/missing virtual days.
//   Does NOT mutate P or lifecycle state.
//   Returns a safe string fallback instead of undefined/null.
//
function getSafeDayDisplayName(gymKey, dayIdx){
  try{
    const idx = parseInt(dayIdx);
    if(isNaN(idx)) return "Day " + dayIdx;
    const resolvedDays = getResolvedDays(gymKey);
    const day = resolvedDays.find(d => d._dayIdx === idx);
    if(day && day.name) return day.name;
    // Virtual day whose addition was cleared — safe fallback
    const baseLen = (P[gymKey] || []).length;
    if(idx >= baseLen){
      return "Added Day " + (idx + 1);
    }
    return "Day " + (idx + 1);
  }catch(e){
    return "Day " + (parseInt(dayIdx) + 1 || (dayIdx + 1) || "?");
  }
}

// getSafeDayForLog(gymKey, dayIdx)
//   Returns the resolved day object (from getResolvedDays) for a given gym/dayIdx.
//   Suitable for iterating exercises in log/history renderers.
//   Returns null gracefully if the day cannot be resolved.
//
function getSafeDayForLog(gymKey, dayIdx){
  try{
    const idx = parseInt(dayIdx);
    if(isNaN(idx)) return null;
    const resolvedDays = getResolvedDays(gymKey);
    return resolvedDays.find(d => d._dayIdx === idx) || null;
  }catch(e){
    return null;
  }
}

// History keeps the saved label as an immutable snapshot while presenting the
// current canonical name when the same stable gym/day identity still exists.
function getHistoricalDayIdentity(gymKey,dayIdx,savedDayName){
  const day=getProgramDay(gymKey,dayIdx);
  const historicalName=typeof savedDayName==="string"&&savedDayName.trim()?savedDayName.trim():null;
  if(!day){
    return {gymKey:gymKey,dayIdx:parseInt(dayIdx,10),resolved:false,currentName:historicalName||getSafeDayDisplayName(gymKey,dayIdx),historicalName:historicalName,showHistoricalName:false};
  }
  const effective=getEffectiveDayMeta(gymKey,day._dayIdx,day),currentName=(effective&&effective.name)||day.name||day.day||getSafeDayDisplayName(gymKey,dayIdx);
  return {gymKey:gymKey,dayIdx:day._dayIdx,resolved:true,currentName:currentName,historicalName:historicalName,showHistoricalName:!!historicalName&&historicalName.toLowerCase()!==String(currentName).trim().toLowerCase()};
}
window.getHistoricalDayIdentity=getHistoricalDayIdentity;

// ── END PHASE 9.4.8.3 ────────────────────────────────────────────────────────


// ── PHASE 9C: LIFECYCLE HEALTH CHECK ─────────────────────────────────────────
//
// Runs 6 integrity checks against lifecycle state and historical logs.
// Returns an array of { id, label, status ("pass"|"warn"|"error"), detail } objects.
// Safe to call at any time — read-only, no mutations.

function mfProgramDayIntegrityDebug(){
  const lc=getLifecycle(),evidence=mfCollectProgramDayIntegrity(lc),validGyms=typeof P==="undefined"?[]:Object.keys(P),validKeys={},metadataIssues=[];
  let migratedDayCount=0;
  Object.entries(lc.dayAdditions||{}).forEach(function(pair){
    const gymKey=pair[0],entries=pair[1];
    if(!validGyms.includes(gymKey)){metadataIssues.push("invalid dayAddition gym '"+gymKey+"'");return;}
    Object.entries(entries||{}).forEach(function(item){
      const rawIdx=item[0],entry=item[1],idx=parseInt(rawIdx,10),valid=String(idx)===rawIdx&&idx>=P[gymKey].length&&entry&&typeof entry.name==="string"&&entry.name.trim();
      if(!valid){metadataIssues.push(gymKey+" '"+rawIdx+"': invalid or conflicting dayAddition metadata");return;}
      validKeys[gymKey+":"+idx]=true;
      if(entry.meta&&entry.meta.migrationVersion==="10.1.3")migratedDayCount++;
    });
  });
  const groups=Object.values(evidence.groups),activeEvidenceGroups=groups.filter(function(g){return g.activeCustomIds.length>0||g.hasRecommendation||g.hasOrderOverride||g.hasDayOverride||g.hasDisabledDay;});
  const activeUnresolved=activeEvidenceGroups.filter(function(g){return !validKeys[g.key];});
  const archivedOnly=groups.filter(function(g){return g.archivedOnly&&!validKeys[g.key];});
  const recommendationMissing=groups.filter(function(g){return g.hasRecommendation&&!validKeys[g.key];});
  const activeKeys={};Object.keys(validKeys).forEach(function(k){activeKeys[k]=true;});activeEvidenceGroups.forEach(function(g){activeKeys[g.key]=true;});
  return {
    activeVirtualDayCount:Object.keys(activeKeys).length,
    validVirtualDayCount:Object.keys(validKeys).length,
    migratedDayCount:migratedDayCount,
    activeUnresolvedDayCount:activeUnresolved.length,
    archivedOnlyIgnoredCount:archivedOnly.length,
    invalidOrphanCount:evidence.invalidOrphans.length,
    recommendationMissingDayCount:recommendationMissing.length,
    duplicateOrConflictCount:metadataIssues.length,
    activeUnresolvedDays:activeUnresolved.map(function(g){return{gymKey:g.gymKey,dayIdx:g.dayIdx,activeExerciseCount:g.activeCustomIds.length};}),
    readOnly:true
  };
}
window.mfProgramDayIntegrityDebug=mfProgramDayIntegrityDebug;

function mfRunLifecycleValidation(){
  const results = [];
  const lc = getLifecycle();

  // ── Check 1: Duplicate Exercise IDs ─────────────────────────────────────────
  // Verify no active exercise ID appears more than once across resolved program.
  (function(){
    try {
      const resolved = getResolvedProgram();
      const seen = {};
      const dupes = [];
      Object.entries(resolved).forEach(([gymKey, days]) => {
        days.forEach((day, di) => {
          (day.exercises||[]).forEach(ex => {
            if(seen[ex.id]) dupes.push(ex.id);
            seen[ex.id] = true;
          });
        });
      });
      if(dupes.length){
        results.push({id:"dupe-ids",label:"Duplicate Exercise IDs",status:"error",detail:`${dupes.length} duplicate ID(s) found: ${dupes.slice(0,3).join(", ")}${dupes.length>3?" …":""}`});
      } else {
        results.push({id:"dupe-ids",label:"Duplicate Exercise IDs",status:"pass",detail:"No duplicate IDs in active program."});
      }
    } catch(e) {
      results.push({id:"dupe-ids",label:"Duplicate Exercise IDs",status:"error",detail:"Check failed: "+e.message});
    }
  })();

  // ── Check 2: Custom Exercise Validity ────────────────────────────────────────
  // Verify every custom exercise has required fields: id, name, gymKey, dayIdx.
  (function(){
    try {
      const customs = Object.values(lc.customExercises||{});
      const bad = customs.filter(ex => !ex.id || !ex.name || !ex.gymKey || ex.dayIdx === undefined || ex.dayIdx === null);
      if(bad.length){
        results.push({id:"custom-validity",label:"Custom Exercise Validity",status:"error",detail:`${bad.length} custom exercise(s) missing required fields (id/name/gymKey/dayIdx).`});
      } else if(customs.length){
        results.push({id:"custom-validity",label:"Custom Exercise Validity",status:"pass",detail:`All ${customs.length} custom exercise(s) have valid structure.`});
      } else {
        results.push({id:"custom-validity",label:"Custom Exercise Validity",status:"pass",detail:"No custom exercises — nothing to validate."});
      }
    } catch(e) {
      results.push({id:"custom-validity",label:"Custom Exercise Validity",status:"error",detail:"Check failed: "+e.message});
    }
  })();

  // ── Check 3: Active Program Resolution ───────────────────────────────────────
  // Verify getResolvedProgram() runs without error and returns expected shape.
  (function(){
    try {
      const resolved = getResolvedProgram();
      const gymKeys = Object.keys(resolved);
      if(!gymKeys.length){
        results.push({id:"prog-resolve",label:"Active Program Resolution",status:"error",detail:"Resolved program returned empty — base program P may be missing."});
        return;
      }
      let totalEx = 0;
      gymKeys.forEach(k => resolved[k].forEach(d => totalEx += (d.exercises||[]).length));
      results.push({id:"prog-resolve",label:"Active Program Resolution",status:"pass",detail:`Resolved successfully: ${gymKeys.length} gym(s), ${totalEx} total exercise slot(s).`});
    } catch(e) {
      results.push({id:"prog-resolve",label:"Active Program Resolution",status:"error",detail:"getResolvedProgram() threw: "+e.message});
    }
  })();

  // ── Check 4: Lifecycle Storage ────────────────────────────────────────────────
  // Verify mf-exercise-state exists and parses correctly.
  (function(){
    const raw = localStorage.getItem(LIFECYCLE_KEY);
    if(!raw){
      results.push({id:"lc-storage",label:"Lifecycle Storage",status:"warn",detail:"No lifecycle state in storage — will be initialized on next write."});
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if(!parsed.schemaVersion){
        results.push({id:"lc-storage",label:"Lifecycle Storage",status:"warn",detail:"Lifecycle state missing schemaVersion — may have been written by an older build."});
      } else {
        results.push({id:"lc-storage",label:"Lifecycle Storage",status:"pass",detail:`Storage OK. Schema v${parsed.schemaVersion}, lifecycle version ${parsed.lifecycleVersion||"unknown"}.`});
      }
    } catch(e) {
      results.push({id:"lc-storage",label:"Lifecycle Storage",status:"error",detail:"Lifecycle state is corrupt (JSON parse failed). Will reset on next load."});
    }
  })();

  // ── Check 5: Missing Replacement References ───────────────────────────────────
  // Check for replacement links pointing to IDs that don't exist anywhere.
  (function(){
    try {
      const allIds = new Set();
      Object.values(P).forEach(days => days.forEach(d => (d.exercises||[]).forEach(ex => allIds.add(ex.id))));
      Object.keys(lc.customExercises||{}).forEach(id => allIds.add(id));
      Object.keys(lc.inactiveIds||{}).forEach(id => allIds.add(id));
      const brokenLinks = [];
      Object.entries(lc.replacements||{}).forEach(([oldId, rep]) => {
        const newId = (rep && typeof rep === "object") ? rep.newId : rep;
        if(!allIds.has(oldId)) brokenLinks.push(`${oldId} (source missing)`);
        if(newId && !allIds.has(newId)) brokenLinks.push(`${newId} (target missing)`);
      });
      if(brokenLinks.length){
        results.push({id:"missing-refs",label:"Missing Replacement References",status:"warn",detail:`${brokenLinks.length} broken reference(s): ${brokenLinks.slice(0,2).join("; ")}${brokenLinks.length>2?" …":""}`});
      } else {
        results.push({id:"missing-refs",label:"Missing Replacement References",status:"pass",detail:`All ${Object.keys(lc.replacements||{}).length} replacement link(s) point to known IDs.`});
      }
    } catch(e) {
      results.push({id:"missing-refs",label:"Missing Replacement References",status:"error",detail:"Check failed: "+e.message});
    }
  })();

  // ── Check 6: Unknown Logged Exercise IDs ─────────────────────────────────────
  // Scan historical logs for exercise IDs not in active program, custom exercises,
  // or inactive archive.
  (function(){
    try {
      const knownIds = new Set();
      Object.values(P).forEach(days => days.forEach(d => (d.exercises||[]).forEach(ex => knownIds.add(ex.id))));
      Object.keys(lc.customExercises||{}).forEach(id => knownIds.add(id));
      Object.keys(lc.inactiveIds||{}).forEach(id => knownIds.add(id));

      const unknownIds = new Set();
      Object.keys(localStorage).filter(k => k.startsWith("day-") && k.endsWith("-wo")).forEach(k => {
        try {
          const wo = JSON.parse(localStorage.getItem(k)||"{}");
          Object.keys(wo.exercises||{}).forEach(exId => {
            if(!knownIds.has(exId)) unknownIds.add(exId);
          });
        } catch {}
      });

      if(unknownIds.size){
        const list = [...unknownIds].slice(0,3).join(", ");
        results.push({id:"unknown-log-ids",label:"Unknown Logged Exercise IDs",status:"warn",detail:`${unknownIds.size} logged exercise ID(s) not in any known set: ${list}${unknownIds.size>3?" …":""}`});
      } else {
        results.push({id:"unknown-log-ids",label:"Unknown Logged Exercise IDs",status:"pass",detail:"All logged exercise IDs are recognized."});
      }
    } catch(e) {
      results.push({id:"unknown-log-ids",label:"Unknown Logged Exercise IDs",status:"error",detail:"Check failed: "+e.message});
    }
  })();

  // ── Check 7: Active / Archive Overlap ────────────────────────────────────────
  // Verify no ID is simultaneously active in the resolved program AND in inactiveIds.
  (function(){
    try {
      const resolved = getResolvedProgram();
      const activeIds = new Set();
      Object.values(resolved).forEach(days => days.forEach(d => (d.exercises||[]).forEach(ex => activeIds.add(ex.id))));
      const overlap = Object.keys(lc.inactiveIds||{}).filter(id => activeIds.has(id));
      if(overlap.length){
        results.push({id:"active-archive-overlap",label:"Active / Archive Overlap",status:"error",detail:`${overlap.length} ID(s) are both active and archived: ${overlap.slice(0,3).join(", ")}${overlap.length>3?" …":""}`});
      } else {
        results.push({id:"active-archive-overlap",label:"Active / Archive Overlap",status:"pass",detail:"No ID is simultaneously active and archived."});
      }
    } catch(e) {
      results.push({id:"active-archive-overlap",label:"Active / Archive Overlap",status:"error",detail:"Check failed: "+e.message});
    }
  })();

  // ── Check 8: Replacement Link Integrity ──────────────────────────────────────
  // Verify every replacement link: oldId must be archived, newId must be active or known.
  (function(){
    try {
      const resolved = getResolvedProgram();
      const activeIds = new Set();
      Object.values(resolved).forEach(days => days.forEach(d => (d.exercises||[]).forEach(ex => activeIds.add(ex.id))));
      const allKnownIds = new Set(activeIds);
      Object.values(P).forEach(days => days.forEach(d => (d.exercises||[]).forEach(ex => allKnownIds.add(ex.id))));
      Object.keys(lc.customExercises||{}).forEach(id => allKnownIds.add(id));
      Object.keys(lc.inactiveIds||{}).forEach(id => allKnownIds.add(id));

      const issues = [];
      Object.entries(lc.replacements||{}).forEach(([oldId, rep]) => {
        const newId = (rep && typeof rep === "object") ? rep.newId : rep;
        if(!lc.inactiveIds[oldId]) issues.push(`${oldId} (source not archived)`);
        if(newId && !allKnownIds.has(newId)) issues.push(`${newId} (target unknown)`);
      });
      const repCount = Object.keys(lc.replacements||{}).length;
      if(issues.length){
        results.push({id:"replacement-integrity",label:"Replacement Link Integrity",status:"warn",detail:`${issues.length} issue(s): ${issues.slice(0,2).join("; ")}${issues.length>2?" …":""}`});
      } else {
        results.push({id:"replacement-integrity",label:"Replacement Link Integrity",status:"pass",detail:`${repCount} replacement link(s) — all valid.`});
      }
    } catch(e) {
      results.push({id:"replacement-integrity",label:"Replacement Link Integrity",status:"error",detail:"Check failed: "+e.message});
    }
  })();

  // ── Check 9: Duplicate Active Exercise Names Per Day (9.2.2) ─────────────────
  // Detect same normalized name appearing more than once on same gym/day.
  // This is a WARN — does not block export or restore.
  (function(){
    try {
      const resolved = getResolvedProgram();
      const dupes = [];
      Object.entries(resolved).forEach(([gymKey, days]) => {
        days.forEach((day, di) => {
          const seen = {};
          (day.exercises||[]).forEach(ex => {
            const norm = exNormName(getF(ex.id,"name",ex.name)||"");
            if(!norm) return;
            seen[norm] = (seen[norm]||0) + 1;
          });
          Object.entries(seen).forEach(([norm, count]) => {
            if(count > 1){
              // Find original-cased name for display
              const ex = (day.exercises||[]).find(e => exNormName(getF(e.id,"name",e.name)||"") === norm);
              const displayName = ex ? (getF(ex.id,"name",ex.name)||norm) : norm;
              dupes.push(`${gymKey} ${day.day} has "${displayName}" ${count}×`);
            }
          });
        });
      });
      if(dupes.length){
        results.push({id:"dup-active-names",label:"Duplicate Active Exercise Names",status:"warn",detail:`Duplicate active exercise names: ${dupes.slice(0,3).join("; ")}${dupes.length>3?" …":""}`});
      } else {
        results.push({id:"dup-active-names",label:"Duplicate Active Exercise Names",status:"pass",detail:"No duplicate exercise names found on any day."});
      }
    } catch(e) {
      results.push({id:"dup-active-names",label:"Duplicate Active Exercise Names",status:"error",detail:"Check failed: "+e.message});
    }
  })();

  // ── Check 10: Order Override Validity (9.3.0) ────────────────────────────────
  // Verify each orderOverride entry: gym exists, day exists, IDs belong to that day,
  // no duplicates, no unknown IDs. All issues are WARN — do not block the app.
  (function(){
    try {
      const overrides = lc.orderOverrides || {};
      const overrideKeys = Object.keys(overrides);
      if(!overrideKeys.length){
        results.push({id:"order-override-validity",label:"Order Override Validity",status:"pass",detail:"No order overrides — nothing to validate."});
        return;
      }
      const validGymKeys = (typeof P !== "undefined") ? Object.keys(P) : [];
      const issues = [];
      overrideKeys.forEach(key => {
        const parts = key.split(":");
        const gymKey = parts[0];
        const dayIdx = parseInt(parts[1], 10);
        const order = overrides[key];
        if(!validGymKeys.includes(gymKey)){
          issues.push(key+": gym '"+gymKey+"' does not exist");
          return;
        }
        if(isNaN(dayIdx) || dayIdx < 0){
          issues.push(key+": dayIndex "+parts[1]+" is invalid");
          return;
        }
        // 9.4.8.5: use getResolvedDays() so virtual/additive day overrides are
        // validated against their own day instead of being misflagged as
        // "out of range" (getResolvedProgram only knows about base P days).
        const resolvedDays = getResolvedDays(gymKey);
        const dayObj = resolvedDays.find(d => d._dayIdx === dayIdx);
        if(!dayObj){
          // dayIdx exceeds base P AND has no matching dayAddition — truly unresolvable
          issues.push(key+": dayIndex "+parts[1]+" is out of range (no base day or virtual day found)");
          return;
        }
        const activeIds = new Set((dayObj.exercises||[]).map(e => e.id));
        // Check for duplicates
        const seen = new Set();
        const dupes = [];
        (order||[]).forEach(id => { if(seen.has(id)) dupes.push(id); else seen.add(id); });
        if(dupes.length) issues.push(key+": duplicate IDs: "+dupes.join(", "));
        // Check for unknown IDs
        const unknown = (order||[]).filter(id => !activeIds.has(id));
        if(unknown.length) issues.push(key+": "+unknown.length+" unknown/inactive ID(s): "+unknown.slice(0,3).join(", ")+(unknown.length>3?" …":""));
      });
      if(issues.length){
        results.push({id:"order-override-validity",label:"Order Override Validity",status:"warn",detail:`${issues.length} issue(s) in order overrides: ${issues.slice(0,2).join("; ")}${issues.length>2?" …":""}`});
      } else {
        results.push({id:"order-override-validity",label:"Order Override Validity",status:"pass",detail:`${overrideKeys.length} order override(s) — all valid.`});
      }
    } catch(e) {
      results.push({id:"order-override-validity",label:"Order Override Validity",status:"error",detail:"Check failed: "+e.message});
    }
  })();

  // ── Check 11: Recommendation Integrity (9.4.3) ───────────────────────────────
  // Verifies all stored recommendations have required fields and valid structure.
  // WARN level only — never hard-fail.
  (function(){
    try {
      const allRecs = getRecs();
      const keys = Object.keys(allRecs);
      if(!keys.length){
        results.push({id:"rec-integrity",label:"Recommendation Integrity",status:"pass",detail:"No recommendations stored — nothing to validate."});
        return;
      }
      const validGyms = new Set(Object.keys(getResolvedProgram()));
      const issues = [];
      keys.forEach(key => {
        const parts = key.split(":");
        const gymKey = parts[0];
        const dayIdx = parseInt(parts[1], 10);
        const rec = allRecs[key];
        if(!validGyms.has(gymKey)) issues.push(key+": gym '"+gymKey+"' is not valid");
        if(isNaN(dayIdx) || dayIdx < 0) issues.push(key+": dayIndex '"+parts[1]+"' is invalid");
        if(!rec.items || !Array.isArray(rec.items)) issues.push(key+": 'items' is missing or not an array");
        else {
          const badItems = rec.items.filter(i => typeof i !== "string" || !i.trim());
          if(badItems.length) issues.push(key+": "+badItems.length+" invalid item(s) (non-string or empty)");
        }
        if(!rec.strategy) issues.push(key+": 'strategy' field is missing");
        if(!rec.experimentTag) issues.push(key+": 'experimentTag' field is missing");
        if(!rec.expiresAfterSessions || isNaN(parseInt(rec.expiresAfterSessions,10))) issues.push(key+": 'expiresAfterSessions' is missing or invalid");
      });
      if(issues.length){
        results.push({id:"rec-integrity",label:"Recommendation Integrity",status:"warn",detail:`${issues.length} issue(s) in recommendations: ${issues.slice(0,2).join("; ")}${issues.length>2?" …":""}`});
      } else {
        results.push({id:"rec-integrity",label:"Recommendation Integrity",status:"pass",detail:`${keys.length} recommendation set(s) — all valid.`});
      }
    } catch(e) {
      results.push({id:"rec-integrity",label:"Recommendation Integrity",status:"warn",detail:"Check failed: "+e.message});
    }
  })();

  // ── Check 12: Day Addition Validity (9.4.8.5) ────────────────────────────────
  // Verify dayAdditions structural integrity: valid gym keys, no collisions with
  // base P, numeric dayIdx, names present, orderOverrides/custom exercises that
  // reference a virtual day actually have a matching dayAddition entry.
  // An empty (no-exercise) virtual day is valid and never warned on.
  (function(){
    try {
      const dayAdditions = lc.dayAdditions || {};
      const validGyms = (typeof P !== "undefined") ? Object.keys(P) : [];
      const issues = [];
      let total = 0;

      Object.entries(dayAdditions).forEach(([gymKey, gymEntries]) => {
        if(!validGyms.includes(gymKey)){
          issues.push("gymKey '"+gymKey+"' in dayAdditions is not a valid gym");
          return;
        }
        const baseLen = P[gymKey].length;
        Object.entries(gymEntries||{}).forEach(([key, entry]) => {
          total++;
          const idx = parseInt(key, 10);
          if(isNaN(idx) || String(idx) !== key){
            issues.push(gymKey+" '"+key+"': dayIdx key is non-numeric");
            return;
          }
          if(idx < baseLen){
            issues.push(gymKey+" d"+idx+": collides with base P (gym has "+baseLen+" base day(s))");
            return;
          }
          if(!entry || !entry.name){
            issues.push(gymKey+" d"+idx+": virtual day has no name");
          }
        });
      });

      // orderOverrides referencing a virtual-range dayIdx with no matching dayAddition
      Object.keys(lc.orderOverrides||{}).forEach(key => {
        const parts = key.split(":");
        const gymKey = parts[0];
        const dayIdx = parseInt(parts[1], 10);
        if(!validGyms.includes(gymKey) || isNaN(dayIdx)) return; // handled by Check 10
        const baseLen = P[gymKey].length;
        if(dayIdx >= baseLen && !getDayAddition(gymKey, dayIdx)){
          issues.push(gymKey+":"+dayIdx+": orderOverride references a virtual day with no matching dayAddition");
        }
      });

      // custom exercises targeting a virtual-range dayIdx with no matching dayAddition
      Object.values(lc.customExercises||{}).forEach(ex => {
        if(!ex || !validGyms.includes(ex.gymKey)) return;
        const baseLen = P[ex.gymKey].length;
        if(typeof ex.dayIdx === "number" && ex.dayIdx >= baseLen && !getDayAddition(ex.gymKey, ex.dayIdx)){
          issues.push(ex.gymKey+" d"+ex.dayIdx+": custom exercise '"+ex.id+"' targets a virtual day with no matching dayAddition");
        }
      });

      if(issues.length){
        results.push({id:"day-addition-validity",label:"Day Addition Validity",status:"warn",detail:`${issues.length} issue(s): ${issues.slice(0,3).join("; ")}${issues.length>3?" …":""}`});
      } else if(total){
        results.push({id:"day-addition-validity",label:"Day Addition Validity",status:"pass",detail:`${total} virtual/additive day(s) — all valid.`});
      } else {
        results.push({id:"day-addition-validity",label:"Day Addition Validity",status:"pass",detail:"No virtual/additive days — nothing to validate."});
      }
    } catch(e) {
      results.push({id:"day-addition-validity",label:"Day Addition Validity",status:"error",detail:"Check failed: "+e.message});
    }
  })();

  // 10.1.3 replaces the legacy record-by-record warning total with a concise
  // parent/child integrity summary. Archived-only debris remains visible in
  // debug output but is not an active-program warning.
  const programDayIntegrity=mfProgramDayIntegrityDebug();
  const dayCheckIndex=results.findIndex(function(check){return check.id==="day-addition-validity";});
  const unresolved=programDayIntegrity.activeUnresolvedDayCount+programDayIntegrity.invalidOrphanCount+programDayIntegrity.duplicateOrConflictCount;
  const dayCheck={
    id:"day-addition-validity",label:"Day Addition Validity",status:unresolved?"warn":"pass",
    detail:programDayIntegrity.activeVirtualDayCount+" active virtual day(s); "+programDayIntegrity.validVirtualDayCount+" valid; "+programDayIntegrity.migratedDayCount+" migrated; "+programDayIntegrity.activeUnresolvedDayCount+" active unresolved; "+programDayIntegrity.archivedOnlyIgnoredCount+" archived-only ignored; "+programDayIntegrity.invalidOrphanCount+" invalid orphan(s)."
  };
  if(dayCheckIndex>=0)results[dayCheckIndex]=dayCheck;else results.push(dayCheck);
  return results;
}

// Render the lifecycle health check UI (summary + checks)
function mfRenderLifecycleHealth(){
  const lc = getLifecycle();

  // Summary grid
  const version = document.getElementById("lcSumVersion");
  const active = document.getElementById("lcSumActive");
  const custom = document.getElementById("lcSumCustom");
  const archived = document.getElementById("lcSumArchived");
  const replacements = document.getElementById("lcSumReplacements");
  const schema = document.getElementById("lcSumSchema");

  if(version) version.textContent = lc.lifecycleVersion || "—";
  if(schema) schema.textContent = lc.schemaVersion || "—";
  if(custom) custom.textContent = Object.keys(lc.customExercises||{}).length;
  if(archived) archived.textContent = Object.keys(lc.inactiveIds||{}).length;
  if(replacements) replacements.textContent = Object.keys(lc.replacements||{}).length;

  // Order override summary (9.3.0)
  const overrideCountEl = document.getElementById("lcSumOrderOverrides");
  const overrideDaysEl  = document.getElementById("lcSumOrderDays");
  const overrideEntries = Object.keys(lc.orderOverrides||{});
  if(overrideCountEl) overrideCountEl.textContent = overrideEntries.length;
  if(overrideDaysEl){
    if(overrideEntries.length === 0){
      overrideDaysEl.textContent = "—";
    } else {
      overrideDaysEl.textContent = overrideEntries.join(", ");
    }
  }

  // Day override summary (9.4.6)
  const dayOvrCountEl = document.getElementById("lcSumDayOverrides");
  if(dayOvrCountEl){
    let dayOvrTotal = 0;
    Object.values(lc.dayOverrides||{}).forEach(gymOvrs => { dayOvrTotal += Object.keys(gymOvrs||{}).length; });
    dayOvrCountEl.textContent = dayOvrTotal;
  }

  // Day additions summary (9.4.8.1)
  const dayAddCountEl = document.getElementById("lcSumDayAdditions");
  if(dayAddCountEl){
    dayAddCountEl.textContent = getDayAdditionCount(lc);
  }

  // Count active exercises from resolved program
  if(active){
    try {
      let count = 0;
      const resolved = getResolvedProgram();
      Object.values(resolved).forEach(days => days.forEach(d => count += (d.exercises||[]).length));
      active.textContent = count;
    } catch { active.textContent = "?"; }
  }

  // Run checks and render
  const checks = mfRunLifecycleValidation();
  const list = document.getElementById("lcCheckList");
  if(list){
    list.innerHTML = checks.map(c => {
      const badge = `<div class="lc-check-badge ${c.status}">${c.status === "pass" ? "✓ PASS" : c.status === "warn" ? "⚠ WARN" : "✕ ERROR"}</div>`;
      return `<div class="lc-check-row">${badge}<div class="lc-check-text"><strong>${c.label}</strong><br>${c.detail}</div></div>`;
    }).join("");
  }

  return checks;
}

// Return count of issues (warn + error) from latest validation
function mfGetLifecycleIssueCount(){
  const checks = mfRunLifecycleValidation();
  return checks.filter(c => c.status !== "pass").length;
}

// Show/hide the lifecycle export warning banner
function mfUpdateExportWarningBanner(){
  const banner = document.getElementById("lcExportWarnBanner");
  if(!banner) return;
  const issueCount = mfGetLifecycleIssueCount();
  if(issueCount > 0){
    banner.textContent = `⚠ Backup created with ${issueCount} lifecycle warning${issueCount>1?"s":""}. See Lifecycle Health Check below for details.`;
    banner.classList.add("visible");
  } else {
    banner.classList.remove("visible");
    banner.textContent = "";
  }
}

// Run lifecycle validation after restore and display results in backup result area
function mfRunPostRestoreValidation(){
  // Restored legacy backups are repaired before any validator or consumer sees
  // their program-day graph. Raw workout/daily records remain untouched.
  mfRepairLegacyVirtualDays();
  const checks = mfRunLifecycleValidation();
  if(typeof p960ValidateStoredHabitData === "function"){
    p960ValidateStoredHabitData().forEach(function(issue){
      checks.push({status:issue.level === "error" ? "error" : "warn", label:"Habit storage", detail:issue.message});
    });
  }
  const issues = checks.filter(c => c.status !== "pass");
  if(!issues.length){
    p8ShowResult("✅ Backup restored successfully. Lifecycle validation passed. Reloading app...", "ok");
  } else {
    const summary = issues.map(c => `${c.status === "warn" ? "⚠" : "✕"} ${c.label}: ${c.detail}`).join("\n");
    p8ShowResult(`✅ Backup restored. ${issues.length} lifecycle warning${issues.length>1?"s":""}:\n\n${summary}\n\nReloading app...`, "ok");
  }
}

// Developer console diagnostic helper
window.mfLifecycleDebug = function(){
  const lc = getLifecycle();
  let resolved;
  try { resolved = getResolvedProgram(); } catch(e) { resolved = {error: e.message}; }
  const checks = mfRunLifecycleValidation();

  // Count active exercises
  let activeCount = 0;
  if(typeof resolved === "object" && !resolved.error){
    Object.values(resolved).forEach(days => days.forEach(d => activeCount += (d.exercises||[]).length));
  }

  // Recommendation summary (9.4.3)
  const allRecs = getRecs();
  const recKeys = Object.keys(allRecs);
  const recommendationSummary = recKeys.map(key => {
    const rec = allRecs[key];
    return {
      key,
      strategy: rec.strategy || "—",
      experimentTag: rec.experimentTag || "—",
      itemCount: Array.isArray(rec.items) ? rec.items.length : 0,
      updatedAt: rec.updatedAt || "—"
    };
  });
  const archivedCount = Object.keys(lc.inactiveIds||{}).length;
  const customCount = Object.keys(lc.customExercises||{}).length;
  const overrideEntries = Object.entries(lc.orderOverrides||{});
  const overrideCount = overrideEntries.length;
  // 9.4.6: count day overrides
  const dayOverrideEntries = Object.entries(lc.dayOverrides||{});
  let dayOverrideCount = 0;
  dayOverrideEntries.forEach(([,gymOvrs]) => { dayOverrideCount += Object.keys(gymOvrs||{}).length; });
  // 9.4.8.1: count day additions
  const dayAdditionCount = getDayAdditionCount(lc);
  const programDayIntegrity = mfProgramDayIntegrityDebug();
  // 9.4.8.5: lightweight per-gym day addition summary for lifecycle debug visibility
  const dayAdditionSummary = {};
  Object.entries(lc.dayAdditions||{}).forEach(([gymKey, gymEntries]) => {
    dayAdditionSummary[gymKey] = Object.entries(gymEntries||{}).map(([key, entry]) => ({
      dayIdx: parseInt(key, 10),
      name: (entry && entry.name) || "—",
      source: (entry && entry.source) || "—"
    }));
  });

  // Build replacement summary
  const replacementSummary = Object.entries(lc.replacements||{}).map(([oldId, rep]) => {
    const newId = (rep && typeof rep === "object") ? rep.newId : rep;
    const reason = (rep && typeof rep === "object") ? rep.reason : "legacy";
    const at = (rep && typeof rep === "object") ? rep.replacedAt : null;
    return { oldId, newId, reason, replacedAt: at };
  });

  const summary = {
    lifecycleVersion: lc.lifecycleVersion,
    schemaVersion: lc.schemaVersion,
    counts: {
      active: activeCount,
      archived: archivedCount,
      custom: customCount,
      replacementLinks: replacementSummary.length,
      inactive: archivedCount,
      orderOverrides: overrideCount,
      recommendationCount: recKeys.length,
      dayOverrides: dayOverrideCount,  // 9.4.6
      dayAdditions: dayAdditionCount,  // 9.4.8.1
      activeVirtualDays: programDayIntegrity.activeVirtualDayCount,
      migratedVirtualDays: programDayIntegrity.migratedDayCount,
      activeUnresolvedVirtualDays: programDayIntegrity.activeUnresolvedDayCount,
      archivedOnlyVirtualRecordsIgnored: programDayIntegrity.archivedOnlyIgnoredCount
    },
    orderOverrideSummary: overrideEntries.map(([key, order]) => ({ key, orderedCount: order.length, ids: order })),
    replacementSummary,
    archivedIds: Object.entries(lc.inactiveIds||{}).map(([id,info])=>({id,...info})),
    recommendationSummary,
    dayAdditionSummary,
    programDayIntegrity,
    resolvedProgramSummary: typeof resolved === "object" && !resolved.error
      ? Object.fromEntries(Object.entries(resolved).map(([k,days])=>[k, days.map(d=>({day:d.day,name:d.name,exerciseCount:(d.exercises||[]).length}))]))
      : resolved,
    validationResults: checks,
    issueCount: checks.filter(c=>c.status!=="pass").length
  };
  console.log("[MarcusFit] mfLifecycleDebug():", summary);
  return summary;
};

// ── END PHASE 9C ──────────────────────────────────────────────────────────────
