
// ── PHASE 4: AI SYNC PARSER ───────────────────────────────────────────────────
function applySync(){
  // Later features may intercept their own payload shape, but this function
  // remains the single authoritative Sync entry point and core implementation.
  if(typeof p960HandleSyncExtension==="function"&&p960HandleSyncExtension(applySync))return;
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
  const knownExIds=new Set();
  Object.keys(P).forEach(g=>{
    getResolvedDays(g).forEach(day=>{
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
    if(!P[gymKey]){
      skipped.push("_action reorder: gym '"+gymKey+"' does not exist");
      return false;
    }
    const dayIdx = parseInt(dayIndex, 10);
    const resolvedDay = getProgramDay(gymKey,dayIdx);
    if(isNaN(dayIdx) || dayIdx < 0 || !resolvedDay){
      skipped.push("_action reorder ("+gymKey+"): dayIndex "+dayIndex+" is out of range");
      return false;
    }
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
    const dayIdx_c = parseInt(dayIdx, 10);
    const day_c=getProgramDay(gymKey,dayIdx_c);
    if(isNaN(dayIdx_c) || dayIdx_c < 0 || !day_c){
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
    const dayName_c = day_c.day || ("Day "+dayIdx_c);
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
    const dayIdx_d = parseInt(dayIdx, 10);
    const day_d=getProgramDay(gymKey,dayIdx_d);
    if(isNaN(dayIdx_d) || dayIdx_d < 0 || !day_d){
      skipped.push("_action day_override ("+gymKey+"): dayIdx "+dayIdx+" is out of range");
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
    const dayName_d = day_d.day || ("Day "+dayIdx_d);
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
        // Custom records remain in lifecycle while inactive so exact stable-ID
        // reactivation can restore the same virtual-day child and its history.
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

    // Archived IDs are existing lifecycle identities, even though they are
    // intentionally absent from the active resolved program. Do not let a
    // normal update fall through to the new-custom-ID allocator.
    if(knownExIds.has(id) && lc.inactiveIds[id]){
      skipped.push(id+": exercise is archived — reactivate it before updating");
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
