
// ── PHASE 9.5.1: ONBOARDING STATE & FRESH-INSTALL DETECTION FOUNDATION ───────
// Storage key: "mf-onboarding-state" — structured, schema-versioned JSON
// object. Tracks onboarding progress/status only — never merged into or
// stored inside mf-user-profile, and never added to AI exports. Included in
// the existing PHASE 8 backup/restore path automatically via
// p8IsMarcusFitKey(). This release adds NO visible onboarding UI: it only
// lays the storage + conservative fresh-install detection foundation a future
// release will build the actual onboarding flow on top of. Does not read or
// write P, workout logs, progression, lifecycle, recommendations, exports,
// or mf-user-profile except to safely inspect them for fresh-install
// evidence (read-only).
const ONBOARDING_KEY = "mf-onboarding-state";
const ONBOARDING_SCHEMA = 1;
const ONBOARDING_STATUSES = ["not_started", "in_progress", "completed", "skipped"];

// Returns a fresh, independent default onboarding-state object. Never returns
// a shared mutable reference — safe to call repeatedly.
function p951GetDefaultOnboardingState(){
  const now = new Date().toISOString();
  return {
    schemaVersion: ONBOARDING_SCHEMA,
    onboardingVersion: APP_VERSION,
    status: "not_started",
    currentStep: 0,
    startedAt: null,
    completedAt: null,
    skippedAt: null,
    updatedAt: now,
    draft: {}
  };
}

// Fills missing/malformed fields from defaults, preserves valid existing
// values, and preserves unknown top-level fields where practical for forward
// compatibility. Does NOT bump updatedAt — callers decide when a save is a
// "real" change. Never throws.
function p951NormalizeOnboardingState(state){
  const def = p951GetDefaultOnboardingState();
  const src = (state && typeof state === "object" && !Array.isArray(state)) ? state : {};
  const out = Object.assign({}, src); // preserve unknown top-level fields

  out.schemaVersion = ONBOARDING_SCHEMA;
  out.onboardingVersion = (typeof src.onboardingVersion === "string" && src.onboardingVersion.trim()) ? src.onboardingVersion : def.onboardingVersion;
  out.status = ONBOARDING_STATUSES.indexOf(src.status) !== -1 ? src.status : def.status;

  const step = Number(src.currentStep);
  out.currentStep = (isFinite(step) && step >= 0) ? Math.floor(step) : def.currentStep;

  function isoOrNull(v){
    if(v === null || v === undefined) return null;
    return (typeof v === "string" && !isNaN(Date.parse(v))) ? v : null;
  }
  out.startedAt = isoOrNull(src.startedAt);
  out.completedAt = isoOrNull(src.completedAt);
  out.skippedAt = isoOrNull(src.skippedAt);

  const updatedAtValid = typeof src.updatedAt === "string" && !isNaN(Date.parse(src.updatedAt));
  out.updatedAt = updatedAtValid ? src.updatedAt : def.updatedAt;

  out.draft = (src.draft && typeof src.draft === "object" && !Array.isArray(src.draft)) ? src.draft : {};

  return out;
}

// Safely reads + parses mf-onboarding-state. Never throws. Returns a
// normalized valid state even if storage is empty/malformed. Does not write.
function p951GetOnboardingState(){
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if(raw === null) return p951GetDefaultOnboardingState();
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch(e){
      console.warn("[MarcusFit] mf-onboarding-state is malformed JSON — using safe defaults for this read.");
      return p951GetDefaultOnboardingState();
    }
    return p951NormalizeOnboardingState(parsed);
  } catch(e){
    console.warn("[MarcusFit] p951GetOnboardingState failed, using safe defaults:", e && e.message);
    return p951GetDefaultOnboardingState();
  }
}

// Normalizes, sets updatedAt (a real edit/migration is being persisted), and
// safely writes to localStorage.
function p951SaveOnboardingState(state){
  try {
    const normalized = p951NormalizeOnboardingState(state);
    normalized.updatedAt = new Date().toISOString();
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(normalized));
    return { ok: true, state: normalized };
  } catch(e){
    console.warn("[MarcusFit] p951SaveOnboardingState failed:", e && e.message);
    return { ok: false, error: (e && e.message) || "Unknown error" };
  }
}

// ── Conservative fresh-install detection ────────────────────────────────────
// The mere existence of a key must never classify an install as established —
// several keys are auto-created with empty/default contents during normal
// startup (e.g. exLifecycleDefault(), recsInitMigrate(), default profile).
// Only genuine, non-default, user-entered data counts as evidence of an
// established installation. Any uncertainty leans established, never fresh.

// True if a lifecycle-style nested store (gymKey → dayIdx/entry → {...}) has
// at least one populated inner object. Safe on missing/malformed input.
function p951AnyNestedEntries(obj){
  if(!obj || typeof obj !== "object") return false;
  return Object.keys(obj).some(function(gymKey){
    const inner = obj[gymKey];
    return inner && typeof inner === "object" && Object.keys(inner).length > 0;
  });
}

// Whether the in-progress daily-log draft (mf-current-draft) contains
// meaningful user-entered data, as opposed to an empty/never-touched draft.
// Slider defaults (mood/hunger = 5) alone are NOT meaningful.
function p951DraftHasMeaningfulData(draft){
  if(!draft || typeof draft !== "object") return false;
  const textFields = ["weight", "sleep", "protein", "water", "bmNotes", "notes"];
  const hasText = textFields.some(function(f){
    return typeof draft[f] === "string" && draft[f].trim() !== "";
  });
  if(hasText) return true;
  if(draft.bm !== null && draft.bm !== undefined) return true;
  if(draft.workout !== null && draft.workout !== undefined) return true;
  if(draft.zep !== null && draft.zep !== undefined) return true;
  if(draft.woData && typeof draft.woData === "object" && Object.keys(draft.woData).length > 0) return true;
  if(p951HabitsHaveMeaningfulData(draft.habits)) return true;
  return false;
}

// Structural check for habit entries: a default/untouched habit entry has the
// shape { completed: false, notes: "" } and is an object, so a plain
// truthy-object test would wrongly count every initialized habit as
// meaningful. A habit only counts as meaningful if completed === true, or
// notes is a non-empty (trimmed) string. Never throws on malformed input.
function p951HabitsHaveMeaningfulData(habits){
  if(!habits || typeof habits !== "object") return false;
  try {
    return Object.keys(habits).some(function(k){
      const entry = habits[k];
      if(!entry || typeof entry !== "object") return false;
      if(entry.completed === true) return true;
      if(typeof entry.notes === "string" && entry.notes.trim() !== "") return true;
      return false;
    });
  } catch(e){ return false; }
}

// ── System-seeded 9.4.7 specialization baseline recognition ────────────────
// mfApplyDay6Specialization() auto-seeds a known, app-supplied Day 6
// Shoulders & Arms specialization into the lifecycle + recommendations
// stores on every install (see PHASE 9.4.7 below). That baseline must NOT
// count as evidence of an established install — it's app-supplied data, not
// user/AI-created customization. These helpers require a coherent match of
// the full known seed shape (not merely the absence of unrelated data — a
// lone custom exercise that happens to sit on the recognized gym/day must
// NOT slip through just because every other check is vacuously satisfied on
// empty collections). Anything short of the complete, coherent seed is
// treated as meaningful. Never requires brittle exact JSON/timestamp
// equality — checks structure/metadata/cross-references instead. Any
// evaluation failure conservatively returns false (i.e. NOT recognized as
// the safe baseline → meaningful).
const P951_SPEC_GYMS = ["home", "partial"];
const P951_SPEC_DAY_IDX = 5;
const P951_SPEC_KEYS = ["home:5", "partial:5"];
const P951_SPEC_VERSION = "9.4.7";
const P951_SPEC_TAG = "shoulders_arms";
const P951_SPEC_STRATEGY = "shoulders_arms_specialization";
const P951_SPEC_EXPERIMENT_TAGS = { home: "day6_shoulder_cap_build", partial: "day6_shoulder_cap_build_cable" };

// Returns the set of base-P exercise IDs for a gym's recognized Day 6
// (index 5), or an empty array if P/that day is unavailable for any reason.
function p951GetBaseDay6Ids(gymKey){
  try {
    if(typeof P === "undefined") return [];
    const days = P[gymKey];
    if(!Array.isArray(days) || !days[P951_SPEC_DAY_IDX]) return [];
    const exercises = days[P951_SPEC_DAY_IDX].exercises;
    if(!Array.isArray(exercises)) return [];
    return exercises.map(function(ex){ return ex && ex.id; }).filter(Boolean);
  } catch(e){ return []; }
}

// Validates one gym's day override entry carries the known 9.4.7 metadata.
function p951DayOverrideMatchesSpec(entry){
  if(!entry || typeof entry !== "object") return false;
  const meta = entry.meta || {};
  const metaOk = meta.appliedVersion === P951_SPEC_VERSION && meta.specialization === P951_SPEC_TAG;
  const reasonOk = typeof entry.reason === "string" &&
    entry.reason.indexOf(P951_SPEC_VERSION) !== -1 &&
    /shoulders\s*&?\s*arms/i.test(entry.reason);
  return metaOk && reasonOk;
}

// True only when the lifecycle store contains nothing (returns true), or
// contains the complete, coherent, known built-in 9.4.7 Day 6 specialization
// for BOTH gyms — not merely data that happens to avoid the disallowed
// shapes. Every recognized piece (day override, order override, custom
// exercises, inactive base IDs) must be present, cross-consistent, and
// present for both home and partial, or the whole store is meaningful.
function p951IsSystemSeededLifecycleBaseline(lifecycle){
  try {
    const lc = lifecycle || {};
    const customExercises = lc.customExercises || {};
    const inactiveIds = lc.inactiveIds || {};
    const replacements = lc.replacements || {};
    const orderOverrides = lc.orderOverrides || {};
    const dayOverrides = lc.dayOverrides || {};
    const dayAdditions = lc.dayAdditions || {};

    const hasAnyData = !!(
      Object.keys(customExercises).length > 0 ||
      Object.keys(inactiveIds).length > 0 ||
      Object.keys(replacements).length > 0 ||
      p951AnyNestedEntries(orderOverrides) ||
      p951AnyNestedEntries(dayOverrides) ||
      p951AnyNestedEntries(dayAdditions)
    );
    if(!hasAnyData) return true; // completely empty/default store

    // The 9.4.7 seed never creates replacement links or day additions.
    if(Object.keys(replacements).length > 0) return false;
    if(p951AnyNestedEntries(dayAdditions)) return false;

    // No unrelated day-override gyms/days: exactly home+partial, day "5" only.
    const populatedGymKeys = Object.keys(dayOverrides).filter(function(gk){
      return dayOverrides[gk] && Object.keys(dayOverrides[gk]).length > 0;
    });
    if(populatedGymKeys.length !== P951_SPEC_GYMS.length) return false;
    if(!P951_SPEC_GYMS.every(function(gk){ return populatedGymKeys.indexOf(gk) !== -1; })) return false;
    const dayOverridesOk = P951_SPEC_GYMS.every(function(gk){
      const dayKeys = Object.keys(dayOverrides[gk] || {});
      if(dayKeys.length !== 1 || dayKeys[0] !== String(P951_SPEC_DAY_IDX)) return false;
      return p951DayOverrideMatchesSpec(dayOverrides[gk][String(P951_SPEC_DAY_IDX)]);
    });
    if(!dayOverridesOk) return false;

    // No unrelated order-override keys: exactly home:5 + partial:5, both
    // present as non-empty arrays (required, not merely permitted).
    const populatedOrderKeys = Object.keys(orderOverrides).filter(function(k){
      return Array.isArray(orderOverrides[k]) && orderOverrides[k].length > 0;
    });
    if(populatedOrderKeys.length !== P951_SPEC_KEYS.length) return false;
    if(!P951_SPEC_KEYS.every(function(k){ return populatedOrderKeys.indexOf(k) !== -1; })) return false;

    // Custom exercises required for BOTH gyms (not merely confined to them).
    const customIdsByGym = { home: [], partial: [] };
    const customExOk = Object.keys(customExercises).every(function(id){
      const ex = customExercises[id];
      if(!ex) return false;
      if(P951_SPEC_GYMS.indexOf(ex.gymKey) === -1) return false;
      if(Number(ex.dayIdx) !== P951_SPEC_DAY_IDX) return false;
      if(ex.id !== id) return false;
      if(!new RegExp("^" + ex.gymKey + "-d" + P951_SPEC_DAY_IDX + "-e\\d+$").test(id)) return false;
      customIdsByGym[ex.gymKey].push(id);
      return true;
    });
    if(!customExOk) return false;
    if(customIdsByGym.home.length === 0 || customIdsByGym.partial.length === 0) return false;

    // Every custom exercise ID must be represented in its gym's order
    // override (no Day 6 custom exercise may hide outside the seeded order),
    // and every order-override ID must resolve to a real custom exercise in
    // that same gym/day (no dangling/unknown references).
    const orderExOk = P951_SPEC_GYMS.every(function(gk){
      const orderIds = orderOverrides[gk + ":" + P951_SPEC_DAY_IDX];
      const customSet = new Set(customIdsByGym[gk]);
      const orderSet = new Set(orderIds);
      const allCustomInOrder = customIdsByGym[gk].every(function(id){ return orderSet.has(id); });
      const allOrderAreCustom = orderIds.every(function(id){ return customSet.has(id); });
      return allCustomInOrder && allOrderAreCustom;
    });
    if(!orderExOk) return false;

    // Inactive IDs required for BOTH gyms, and each one must correspond to
    // an actual base Day 6 exercise ID for that gym (via the real P data,
    // not merely an arbitrary id matching a naming pattern), with no
    // replacedBy link (the seed only archives).
    const baseDay6Ids = { home: p951GetBaseDay6Ids("home"), partial: p951GetBaseDay6Ids("partial") };
    if(baseDay6Ids.home.length === 0 || baseDay6Ids.partial.length === 0) return false;
    const baseDay6Sets = { home: new Set(baseDay6Ids.home), partial: new Set(baseDay6Ids.partial) };
    const inactiveByGym = { home: [], partial: [] };
    const inactiveOk = Object.keys(inactiveIds).every(function(id){
      const info = inactiveIds[id];
      if(!info || !(info.replacedBy === null || info.replacedBy === undefined)) return false;
      const gk = P951_SPEC_GYMS.find(function(g){ return baseDay6Sets[g].has(id); });
      if(!gk) return false;
      inactiveByGym[gk].push(id);
      return true;
    });
    if(!inactiveOk) return false;
    if(inactiveByGym.home.length === 0 || inactiveByGym.partial.length === 0) return false;

    return true;
  } catch(e){
    return false;
  }
}

// True only when the recommendations store is empty, or contains exactly
// the two known built-in 9.4.7 Day 6 specialization coaching-note entries
// (home:5 and partial:5) — no missing key, extra key, or malformed entry.
function p951AreSystemSeededRecommendationsBaseline(recommendations){
  try {
    const recs = recommendations || {};
    const keys = Object.keys(recs);
    if(keys.length === 0) return true; // completely empty store

    if(keys.length !== P951_SPEC_KEYS.length) return false;
    if(!P951_SPEC_KEYS.every(function(k){ return keys.indexOf(k) !== -1; })) return false;

    return P951_SPEC_KEYS.every(function(k){
      const gymKey = k.split(":")[0];
      const entry = recs[k];
      const expectedTag = P951_SPEC_EXPERIMENT_TAGS[gymKey];
      const itemsOk = Array.isArray(entry && entry.items) && entry.items.length > 0 &&
        entry.items.every(function(item){ return typeof item === "string" && item.trim() !== ""; });
      return !!(entry && typeof entry === "object" &&
        entry.source === "ai" &&
        entry.strategy === P951_SPEC_STRATEGY &&
        entry.experimentTag === expectedTag &&
        itemsOk);
    });
  } catch(e){
    return false;
  }
}
// ── END system-seeded 9.4.7 specialization baseline recognition ────────────

// Gathers meaningful-existing-data evidence across every relevant storage
// area. Pure read-only — never writes localStorage. Each sub-check is
// independently guarded so one bad key cannot break the others, but a failed
// check is recorded in evaluationErrors rather than silently treated as
// "empty" evidence — a failure must never quietly look like a fresh install.
function p951GetMeaningfulDataEvidence(){
  const evidence = {
    dailyLogs: 0,
    workoutLogs: 0,
    overrides: false,
    lifecycleCustomizations: false,
    recommendations: false,
    aiPreferences: false,
    meaningfulDraft: false,
    onboardingAlreadyFinished: false,
    systemSeededLifecycleBaseline: true,
    systemSeededRecommendationsBaseline: true,
    evaluationErrors: []
  };

  try {
    const keys = Object.keys(localStorage);
    evidence.dailyLogs = keys.filter(function(k){ return k.startsWith("day-") && !k.endsWith("-wo"); }).length;
    evidence.workoutLogs = keys.filter(function(k){ return k.startsWith("day-") && k.endsWith("-wo"); }).length;
  } catch(e){
    evidence.evaluationErrors.push("keyEnumeration: " + ((e && e.message) || "unknown error"));
  }

  try {
    const ovr = getOvr();
    evidence.overrides = !!(ovr && Object.keys(ovr).length > 0);
  } catch(e){
    evidence.evaluationErrors.push("overrides: " + ((e && e.message) || "unknown error"));
  }

  try {
    const lc = getLifecycle();
    const hasAnyLifecycleData = !!(
      (lc.customExercises && Object.keys(lc.customExercises).length > 0) ||
      (lc.inactiveIds && Object.keys(lc.inactiveIds).length > 0) ||
      (lc.replacements && Object.keys(lc.replacements).length > 0) ||
      p951AnyNestedEntries(lc.orderOverrides) ||
      p951AnyNestedEntries(lc.dayOverrides) ||
      p951AnyNestedEntries(lc.dayAdditions)
    );
    // Only the exact known 9.4.7 system-seeded baseline (or no data at all)
    // counts as non-meaningful — anything else is genuine customization.
    evidence.systemSeededLifecycleBaseline = hasAnyLifecycleData ? p951IsSystemSeededLifecycleBaseline(lc) : true;
    evidence.lifecycleCustomizations = hasAnyLifecycleData && !evidence.systemSeededLifecycleBaseline;
  } catch(e){
    evidence.evaluationErrors.push("lifecycleState: " + ((e && e.message) || "unknown error"));
  }

  try {
    const recs = getRecs();
    const hasAnyRecs = !!(recs && Object.keys(recs).length > 0);
    evidence.systemSeededRecommendationsBaseline = hasAnyRecs ? p951AreSystemSeededRecommendationsBaseline(recs) : true;
    evidence.recommendations = hasAnyRecs && !evidence.systemSeededRecommendationsBaseline;
  } catch(e){
    evidence.evaluationErrors.push("recommendations: " + ((e && e.message) || "unknown error"));
  }

  try {
    evidence.aiPreferences = p9GetCoachPrefs().trim() !== "";
  } catch(e){
    evidence.evaluationErrors.push("aiPreferences: " + ((e && e.message) || "unknown error"));
  }

  try {
    evidence.meaningfulDraft = p951DraftHasMeaningfulData(getDraft());
  } catch(e){
    evidence.evaluationErrors.push("dailyDraft: " + ((e && e.message) || "unknown error"));
  }

  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if(raw !== null){
      const parsed = JSON.parse(raw);
      evidence.onboardingAlreadyFinished = !!(parsed && (parsed.status === "completed" || parsed.status === "skipped"));
    }
  } catch(e){
    evidence.evaluationErrors.push("existingOnboardingState: " + ((e && e.message) || "unknown error"));
  }

  return evidence;
}

// Boolean convenience wrapper: true if the installation is established (i.e.
// NOT fresh), based on the same evidence as p951IsFreshInstall().
function p951HasMeaningfulExistingData(){
  return !p951IsFreshInstall().isFresh;
}

// Conservative fresh-install classifier. Returns { isFresh, evidence }.
// isFresh is true ONLY when every evidence signal is empty/default AND no
// evidence check failed (evaluationErrors.length === 0). Any evaluation
// failure — malformed relevant JSON, a throwing storage read, etc. — forces
// isFresh: false, since uncertainty must never be treated as fresh. If
// evidence-gathering itself fails outright, this also classifies as
// established.
function p951IsFreshInstall(){
  let evidence;
  try {
    evidence = p951GetMeaningfulDataEvidence();
  } catch(e){
    return {
      isFresh: false,
      evidence: {
        dailyLogs: 0, workoutLogs: 0, overrides: false, lifecycleCustomizations: false,
        recommendations: false, aiPreferences: false, meaningfulDraft: false,
        onboardingAlreadyFinished: false,
        systemSeededLifecycleBaseline: false, systemSeededRecommendationsBaseline: false,
        evaluationErrors: ["evidenceGathering: " + ((e && e.message) || "unknown error")]
      }
    };
  }

  const hasEvaluationErrors = !!(evidence.evaluationErrors && evidence.evaluationErrors.length > 0);

  const isFresh = (
    !hasEvaluationErrors &&
    evidence.dailyLogs === 0 &&
    evidence.workoutLogs === 0 &&
    !evidence.overrides &&
    !evidence.lifecycleCustomizations &&
    !evidence.recommendations &&
    !evidence.aiPreferences &&
    !evidence.meaningfulDraft &&
    !evidence.onboardingAlreadyFinished
  );

  return { isFresh: isFresh, evidence: evidence };
}

// Idempotent page-load initializer.
//  - If mf-onboarding-state already exists, its status is preserved as-is —
//    only shape/field normalization is applied (via p951InitOnboardingState's
//    JSON.stringify comparison so a no-op read never triggers a write).
//  - If it does not exist yet: a genuinely fresh install gets "not_started";
//    an established install is safely migrated straight to "completed" (an
//    existing user must never be shown onboarding they don't need), with
//    completedAt/updatedAt set once.
// Never opens any UI. Never touches mf-user-profile. Repeated refreshes are
// idempotent — no repeated writes, no repeatedly-changing timestamps.
function p951InitOnboardingState(){
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);

    if(raw === null){
      const fresh = p951IsFreshInstall();
      const def = p951GetDefaultOnboardingState();
      if(fresh.isFresh){
        def.status = "not_started";
        localStorage.setItem(ONBOARDING_KEY, JSON.stringify(def));
        console.log("[MarcusFit] Initialized onboarding state (fresh install → not_started).");
      } else {
        const now = new Date().toISOString();
        def.status = "completed";
        def.completedAt = now;
        def.updatedAt = now;
        localStorage.setItem(ONBOARDING_KEY, JSON.stringify(def));
        console.log("[MarcusFit] Initialized onboarding state (established install migrated → completed).");
      }
      return;
    }

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch(e){
      // Malformed state must NOT be blindly reset to not_started — re-run the
      // same conservative evaluation used for the missing-key case above.
      console.warn("[MarcusFit] mf-onboarding-state was malformed JSON — recovering conservatively.");
      const fresh = p951IsFreshInstall();
      const def = p951GetDefaultOnboardingState();
      if(fresh.isFresh){
        def.status = "not_started";
      } else {
        const now = new Date().toISOString();
        def.status = "completed";
        def.completedAt = now;
        def.updatedAt = now;
      }
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(def));
      return;
    }

    // Existing, parseable state: preserve status, normalize shape/fields only,
    // and only write back if normalization actually changed something.
    const normalized = p951NormalizeOnboardingState(parsed);
    if(JSON.stringify(normalized) !== JSON.stringify(parsed)){
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(normalized));
      console.log("[MarcusFit] Migrated/normalized existing onboarding state.");
    }
  } catch(e){
    console.warn("[MarcusFit] p951InitOnboardingState failed:", e && e.message);
  }
}

// ── PHASE 9.5.1: ONBOARDING DEBUG (read-only) ────────────────────────────────
// Console diagnostic helper for mf-onboarding-state. Reports existence/parse
// status, normalized field values, the current fresh-install evaluation,
// meaningful-data evidence, and backup coverage. Never writes localStorage,
// never "repairs" stored data — purely read/normalize-in-memory only.
window.mfOnboardingDebug = function(){
  const result = {
    key: ONBOARDING_KEY,
    exists: false,
    parses: false,
    schemaVersion: null,
    onboardingVersion: null,
    status: null,
    currentStep: null,
    startedAt: null,
    completedAt: null,
    skippedAt: null,
    updatedAt: null,
    hasDraft: false,
    freshInstallEvaluation: null,
    meaningfulDataEvidence: null,
    backupIncluded: false,
    warnings: []
  };
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    result.exists = raw !== null;
    if(!result.exists){
      result.warnings.push("mf-onboarding-state does not exist yet — p951InitOnboardingState() should create it on next page load.");
    } else {
      let parsed = null;
      try { parsed = JSON.parse(raw); result.parses = true; }
      catch(e){ result.warnings.push("mf-onboarding-state exists but is not valid JSON."); }
      const state = p951NormalizeOnboardingState(parsed || {});
      result.schemaVersion = state.schemaVersion;
      result.onboardingVersion = state.onboardingVersion;
      result.status = state.status;
      result.currentStep = state.currentStep;
      result.startedAt = state.startedAt;
      result.completedAt = state.completedAt;
      result.skippedAt = state.skippedAt;
      result.updatedAt = state.updatedAt;
      result.hasDraft = !!(state.draft && Object.keys(state.draft).length > 0);
    }
    result.backupIncluded = p8IsMarcusFitKey(ONBOARDING_KEY);
    if(!result.backupIncluded){
      result.warnings.push("mf-onboarding-state is NOT currently recognized by p8IsMarcusFitKey() — it would be excluded from backups.");
    }
    try { result.freshInstallEvaluation = p951IsFreshInstall(); }
    catch(e){ result.warnings.push("Failed to compute fresh-install evaluation: " + (e && e.message)); }
    try { result.meaningfulDataEvidence = p951GetMeaningfulDataEvidence(); }
    catch(e){ result.warnings.push("Failed to compute meaningful-data evidence: " + (e && e.message)); }
    if(result.meaningfulDataEvidence && Array.isArray(result.meaningfulDataEvidence.evaluationErrors) && result.meaningfulDataEvidence.evaluationErrors.length > 0){
      result.warnings.push("Meaningful-data evidence had " + result.meaningfulDataEvidence.evaluationErrors.length + " evaluation error(s), so fresh-install detection conservatively treated this install as established: " + result.meaningfulDataEvidence.evaluationErrors.join("; "));
    }
  } catch(e){
    result.warnings.push("mfOnboardingDebug failed: " + (e && e.message));
  }
  console.log("[MarcusFit] mfOnboardingDebug():", result);
  return result;
};
var mfOnboardingDebug = window.mfOnboardingDebug;
// ── END PHASE 9.5.1 ONBOARDING DEBUG ─────────────────────────────────────────
// ── END PHASE 9.5.1 ────────────────────────────────────────────────────────────

// ── PHASE 9.5.2: VISIBLE ONBOARDING UI & STEP NAVIGATION ────────────────────
// UI/navigation foundation only. Reads mf-onboarding-state (via p951 helpers)
// and writes ONLY to mf-onboarding-state (via p951SaveOnboardingState). May
// read defaults from p950GetUserProfile() (read-only) for convenience
// prefills. Never writes mf-user-profile, mf-ai-coaching-preferences,
// mf-overrides, mf-exercise-state, mf-recommendations, daily/workout logs, or
// P. Never marks onboarding "completed" in this release. No new localStorage
// keys are created.

// Tracks which step is currently rendered in the overlay, for debug purposes
// only (mfOnboardingDebug()). Not persisted — persisted currentStep lives in
// mf-onboarding-state via p951 helpers.
let p952RenderedStep = null;

// ── Preview-mode isolation (added 9.5.2) ─────────────────────────────────────
// When true, all onboarding navigation/field-persistence/Save-Draft/Skip
// actions read and write ONLY the in-memory p952PreviewState object below,
// never localStorage. Never persisted itself — always starts false on load.
let p952PreviewMode = false;
// In-memory clone of onboarding state used only while p952PreviewMode is
// true. Never written to localStorage. Discarded when preview closes.
let p952PreviewState = null;

// Single read path for all p952 navigation/render code. Returns the real
// persisted state in normal mode, or the in-memory preview state while a
// preview is active — never both, never mixed.
function p952GetActiveState(){
  if(p952PreviewMode) return p952PreviewState || p951GetDefaultOnboardingState();
  return p951GetOnboardingState();
}

// Single write path for all p952 navigation/field-persistence/Save-Draft/Skip
// code. In normal mode this delegates to p951SaveOnboardingState (real
// localStorage write). In preview mode it only updates the in-memory
// p952PreviewState object and never touches localStorage, never calls
// p951SaveOnboardingState. Mirrors p951SaveOnboardingState's return shape
// ({ ok, state }) so callers don't need to branch on mode.
function p952SaveActiveState(state){
  if(p952PreviewMode){
    const normalized = p951NormalizeOnboardingState(state);
    normalized.updatedAt = new Date().toISOString();
    p952PreviewState = normalized;
    return { ok: true, state: normalized };
  }
  return p951SaveOnboardingState(state);
}

// True only when the persisted onboarding state (source of truth) is
// "not_started" or "in_progress". Never re-runs fresh-install detection.
// Always reads the real persisted state directly (never the preview state)
// so genuine automatic onboarding is unaffected by any preview session.
function p952ShouldAutoShow(){
  const status = p951GetOnboardingState().status;
  return status === "not_started" || status === "in_progress";
}

// ── Segmented-control helpers (shared by steps 2 and 3) ─────────────────────
function p952SetActiveSeg(containerId, value){
  const wrap = document.getElementById(containerId);
  if(!wrap) return;
  const val = String(value);
  Array.prototype.forEach.call(wrap.querySelectorAll(".p952-seg-btn"), function(btn){
    btn.classList.toggle("active", btn.getAttribute("data-value") === val);
  });
}
function p952GetActiveSeg(containerId){
  const wrap = document.getElementById(containerId);
  if(!wrap) return null;
  const active = wrap.querySelector(".p952-seg-btn.active");
  return active ? active.getAttribute("data-value") : null;
}
function p952SegClick(containerId, value){
  p952SetActiveSeg(containerId, value);
}
function p952LabelFor(value, map){
  if(!value) return "";
  return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : value;
}

// ── Progress indicator ───────────────────────────────────────────────────────
// Step numbering shown to the user excludes the Welcome screen (Step 1 of 4
// through Step 4 of 4 correspond to internal currentStep 1..4).
function p952RenderProgress(stepIndex){
  const label = document.getElementById("p952ProgressLabel");
  const wrap = document.getElementById("p952ProgressWrap");
  if(!label || !wrap) return;
  if(stepIndex <= 0){
    label.style.display = "none";
    wrap.style.display = "none";
    return;
  }
  label.style.display = "block";
  wrap.style.display = "flex";
  label.textContent = "STEP " + stepIndex + " OF 4";
  wrap.innerHTML = "";
  for(let i = 1; i <= 4; i++){
    const seg = document.createElement("div");
    seg.className = "p952-progress-seg" + (i <= stepIndex ? " done" : "");
    wrap.appendChild(seg);
  }
}

// ── Inline validation error rendering ────────────────────────────────────────
function p952ClearStepErrors(){
  const container = document.getElementById("p952StepContainer");
  if(!container) return;
  Array.prototype.forEach.call(container.querySelectorAll(".p952-error"), function(el){
    el.style.display = "none";
    el.textContent = "";
  });
}
function p952ShowStepErrors(errors){
  p952ClearStepErrors();
  Object.keys(errors).forEach(function(key){
    const el = document.getElementById("p952Error_" + key);
    if(el){
      el.textContent = errors[key];
      el.style.display = "block";
    }
  });
}

// ── Step templates (static markup only — no user-entered data is ever
// interpolated into innerHTML; values are populated afterward via
// .value/textContent) ────────────────────────────────────────────────────────
function p952NavFooter(step){
  const backBtn = step > 0 ? '<button type="button" class="p952-btn p952-btn-secondary" onclick="p952Back()">BACK</button>' : "";
  return '<div class="p952-footer">' + backBtn + '<button type="button" class="p952-btn p952-btn-primary" onclick="p952Next()">NEXT</button></div>';
}

function p952Step0Template(){
  return ''
    + '<div class="p952-logo"><span>MARCUS</span><span>FIT</span></div>'
    + '<div class="p952-title" style="text-align:center;">WELCOME</div>'
    + '<div class="p952-body-text" style="text-align:center;">MarcusFit gives you:</div>'
    + '<ul class="p952-feature-list">'
    +   '<li>💪 Personalized training</li>'
    +   '<li>📅 Daily logging</li>'
    +   '<li>🤖 AI-assisted progression</li>'
    +   '<li>⚙️ Program customization</li>'
    + '</ul>'
    + '<div class="p952-note" style="text-align:center;">Setup takes about a few minutes. You can skip it and finish later.</div>'
    + '<div class="p952-footer" style="flex-direction:column;">'
    +   '<button type="button" class="p952-btn p952-btn-primary" onclick="p952Next()">GET STARTED</button>'
    + '</div>'
    + '<button type="button" class="p952-skip-link" onclick="p952ShowSkipConfirm()">SKIP SETUP</button>';
}

function p952Step1Template(){
  return ''
    + '<div class="p952-title">ABOUT YOU</div>'
    + '<div class="p952-card">'
    +   '<div class="p952-field">'
    +     '<label class="p952-label" for="p952DisplayName">Display Name</label>'
    +     '<input type="text" id="p952DisplayName" class="p952-input" placeholder="Your name" autocomplete="off">'
    +     '<div class="p952-error" id="p952Error_displayName" style="display:none;"></div>'
    +   '</div>'
    +   '<div class="p952-field">'
    +     '<label class="p952-label">Height</label>'
    +     '<div class="p952-row">'
    +       '<input type="number" inputmode="numeric" id="p952HeightFeet" class="p952-input" placeholder="Feet" min="0" max="8" aria-label="Height feet">'
    +       '<input type="number" inputmode="numeric" id="p952HeightInches" class="p952-input" placeholder="Inches" min="0" max="11" aria-label="Height inches">'
    +     '</div>'
    +     '<div class="p952-error" id="p952Error_height" style="display:none;"></div>'
    +   '</div>'
    +   '<div class="p952-row">'
    +     '<div class="p952-field">'
    +       '<label class="p952-label" for="p952WeightUnit">Weight Unit</label>'
    +       '<select id="p952WeightUnit" class="p952-select"><option value="lb">lb</option><option value="kg">kg</option></select>'
    +     '</div>'
    +     '<div class="p952-field">'
    +       '<label class="p952-label" for="p952DistanceUnit">Distance Unit</label>'
    +       '<select id="p952DistanceUnit" class="p952-select"><option value="mi">mi</option><option value="km">km</option></select>'
    +     '</div>'
    +   '</div>'
    +   '<div class="p952-field">'
    +     '<label class="p952-label" for="p952FirstDayOfWeek">First Day of Week</label>'
    +     '<select id="p952FirstDayOfWeek" class="p952-select"><option value="sunday">Sunday</option><option value="monday">Monday</option></select>'
    +   '</div>'
    + '</div>'
    + p952NavFooter(1)
    + '<button type="button" class="p952-skip-link" onclick="p952ShowSkipConfirm()">SKIP SETUP</button>';
}

function p952Step2Template(){
  return ''
    + '<div class="p952-title">YOUR GOAL</div>'
    + '<div class="p952-card">'
    +   '<div class="p952-field">'
    +     '<label class="p952-label" for="p952PrimaryGoal">Primary Goal</label>'
    +     '<input type="text" id="p952PrimaryGoal" class="p952-input" placeholder="e.g. Aesthetics during fat loss">'
    +     '<div class="p952-error" id="p952Error_primaryGoal" style="display:none;"></div>'
    +   '</div>'
    +   '<div class="p952-field">'
    +     '<label class="p952-label" for="p952PhysiqueOutcome">Physique Outcome</label>'
    +     '<input type="text" id="p952PhysiqueOutcome" class="p952-input" placeholder="e.g. Athletic, muscular physique">'
    +     '<div class="p952-error" id="p952Error_physiqueOutcome" style="display:none;"></div>'
    +   '</div>'
    +   '<div class="p952-field">'
    +     '<label class="p952-label" for="p952TrainingExperience">Training Experience</label>'
    +     '<select id="p952TrainingExperience" class="p952-select"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select>'
    +   '</div>'
    +   '<div class="p952-field">'
    +     '<label class="p952-label">Current Focus</label>'
    +     '<div class="p952-seg-row" id="p952FocusSeg">'
    +       '<button type="button" class="p952-seg-btn" data-value="fat_loss" onclick="p952SegClick(\'p952FocusSeg\',\'fat_loss\')">Fat Loss</button>'
    +       '<button type="button" class="p952-seg-btn" data-value="muscle_gain" onclick="p952SegClick(\'p952FocusSeg\',\'muscle_gain\')">Muscle Gain</button>'
    +       '<button type="button" class="p952-seg-btn" data-value="recomposition" onclick="p952SegClick(\'p952FocusSeg\',\'recomposition\')">Recomposition</button>'
    +       '<button type="button" class="p952-seg-btn" data-value="general_fitness" onclick="p952SegClick(\'p952FocusSeg\',\'general_fitness\')">General Fitness</button>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + p952NavFooter(2)
    + '<button type="button" class="p952-skip-link" onclick="p952ShowSkipConfirm()">SKIP SETUP</button>';
}

function p952Step3Template(){
  const dayBtns = [2,3,4,5,6].map(function(n){
    return '<button type="button" class="p952-seg-btn" data-value="' + n + '" onclick="p952SegClick(\'p952LiftingDaysSeg\',\'' + n + '\')">' + n + '</button>';
  }).join("");
  return ''
    + '<div class="p952-title">TRAINING SETUP</div>'
    + '<div class="p952-card">'
    +   '<div class="p952-field">'
    +     '<label class="p952-label">Available Training Locations</label>'
    +     '<div class="p952-seg-row" id="p952LocationsSeg">'
    +       '<button type="button" class="p952-seg-btn" data-value="home" onclick="p952SegClick(\'p952LocationsSeg\',\'home\')">Home</button>'
    +       '<button type="button" class="p952-seg-btn" data-value="gym" onclick="p952SegClick(\'p952LocationsSeg\',\'gym\')">Gym</button>'
    +       '<button type="button" class="p952-seg-btn" data-value="both" onclick="p952SegClick(\'p952LocationsSeg\',\'both\')">Both</button>'
    +     '</div>'
    +   '</div>'
    +   '<div class="p952-field">'
    +     '<label class="p952-label">Desired Lifting Days Per Week</label>'
    +     '<div class="p952-seg-row" id="p952LiftingDaysSeg">' + dayBtns + '</div>'
    +   '</div>'
    +   '<div class="p952-field">'
    +     '<label class="p952-label">Cardio Preference</label>'
    +     '<div class="p952-seg-row" id="p952CardioSeg">'
    +       '<button type="button" class="p952-seg-btn" data-value="none" onclick="p952SegClick(\'p952CardioSeg\',\'none\')">None</button>'
    +       '<button type="button" class="p952-seg-btn" data-value="walking" onclick="p952SegClick(\'p952CardioSeg\',\'walking\')">Walking</button>'
    +       '<button type="button" class="p952-seg-btn" data-value="machines" onclick="p952SegClick(\'p952CardioSeg\',\'machines\')">Machines</button>'
    +       '<button type="button" class="p952-seg-btn" data-value="mixed" onclick="p952SegClick(\'p952CardioSeg\',\'mixed\')">Mixed</button>'
    +     '</div>'
    +   '</div>'
    +   '<div class="p952-field">'
    +     '<label class="p952-label" for="p952EquipmentNotes">Equipment Notes (optional)</label>'
    +     '<textarea id="p952EquipmentNotes" class="p952-textarea" placeholder="e.g. Dumbbells up to 50lb, pull-up bar..."></textarea>'
    +   '</div>'
    +   '<div class="p952-field">'
    +     '<label class="p952-label" for="p952Limitations">Exercise Limitations / Avoidances (optional)</label>'
    +     '<textarea id="p952Limitations" class="p952-textarea" placeholder="e.g. Avoid overhead pressing, bad left knee..."></textarea>'
    +   '</div>'
    + '</div>'
    + p952NavFooter(3)
    + '<button type="button" class="p952-skip-link" onclick="p952ShowSkipConfirm()">SKIP SETUP</button>';
}

function p952Step4Template(){
  return ''
    + '<div class="p952-title">REVIEW</div>'
    + '<div class="p952-card" id="p952ReviewCard"></div>'
    + '<div class="p952-note">Finishing setup applies these answers to your saved profile and AI coaching context. It does not add, remove, or change any exercises, days, or your workout program &mdash; that stays manual or AI-Sync driven.</div>'
    + '<div class="p952-success" id="p952SaveDraftSuccess" style="display:none;"></div>'
    + '<div class="p952-success" id="p952FinishSetupResult" style="display:none;"></div>'
    + '<div class="p952-footer">'
    +   '<button type="button" class="p952-btn p952-btn-secondary" onclick="p952Back()">BACK</button>'
    +   '<button type="button" class="p952-btn p952-btn-secondary" onclick="p952SaveDraft()">SAVE DRAFT</button>'
    + '</div>'
    + '<button type="button" class="p952-btn p952-btn-primary" style="width:100%;margin-top:10px;" onclick="p953FinishSetup()">FINISH SETUP</button>'
    + '<button type="button" class="p952-skip-link" onclick="p952ShowSkipConfirm()">SKIP FOR NOW</button>';
}

// ── Populate fields from draft (+ read-only profile defaults) after render ──
// Uses .value/textContent only — never innerHTML with draft/profile strings.
function p952PopulateStep1(draft){
  const profile = p950GetUserProfile();
  const d = (draft && draft.profile) || {};
  const nameEl = document.getElementById("p952DisplayName");
  if(nameEl) nameEl.value = (typeof d.displayName === "string" && d.displayName) ? d.displayName : (profile.identity.displayName || "");

  const feetEl = document.getElementById("p952HeightFeet");
  const inchesEl = document.getElementById("p952HeightInches");
  let feetVal, inchVal;
  if(isFinite(d.heightFeet) && isFinite(d.heightInches)){
    feetVal = d.heightFeet; inchVal = d.heightInches;
  } else {
    const totalIn = profile.body.heightInches;
    feetVal = Math.floor(totalIn / 12); inchVal = totalIn % 12;
  }
  if(feetEl) feetEl.value = feetVal;
  if(inchesEl) inchesEl.value = inchVal;

  const wuEl = document.getElementById("p952WeightUnit");
  if(wuEl) wuEl.value = (d.weightUnit === "kg") ? "kg" : (d.weightUnit === "lb" ? "lb" : profile.preferences.weightUnit);
  const duEl = document.getElementById("p952DistanceUnit");
  if(duEl) duEl.value = (d.distanceUnit === "km") ? "km" : (d.distanceUnit === "mi" ? "mi" : profile.preferences.distanceUnit);
  const fdEl = document.getElementById("p952FirstDayOfWeek");
  if(fdEl) fdEl.value = (d.firstDayOfWeek === "monday") ? "monday" : (d.firstDayOfWeek === "sunday" ? "sunday" : profile.preferences.firstDayOfWeek);
}

function p952PopulateStep2(draft){
  const profile = p950GetUserProfile();
  const d = (draft && draft.goals) || {};
  const pgEl = document.getElementById("p952PrimaryGoal");
  if(pgEl) pgEl.value = (typeof d.primaryGoal === "string" && d.primaryGoal) ? d.primaryGoal : (profile.goals.primaryGoal || "");
  const poEl = document.getElementById("p952PhysiqueOutcome");
  if(poEl) poEl.value = (typeof d.physiqueOutcome === "string" && d.physiqueOutcome) ? d.physiqueOutcome : (profile.goals.physiqueOutcome || "");
  const teEl = document.getElementById("p952TrainingExperience");
  if(teEl) teEl.value = ["beginner","intermediate","advanced"].indexOf(d.trainingExperience) !== -1 ? d.trainingExperience : "intermediate";
  const focus = ["fat_loss","muscle_gain","recomposition","general_fitness"].indexOf(d.currentFocus) !== -1 ? d.currentFocus : "fat_loss";
  p952SetActiveSeg("p952FocusSeg", focus);
}

function p952PopulateStep3(draft){
  const d = (draft && draft.training) || {};
  p952SetActiveSeg("p952LocationsSeg", ["home","gym","both"].indexOf(d.locations) !== -1 ? d.locations : "both");
  const days = (isFinite(d.liftingDays) && d.liftingDays >= 2 && d.liftingDays <= 6) ? d.liftingDays : 4;
  p952SetActiveSeg("p952LiftingDaysSeg", days);
  p952SetActiveSeg("p952CardioSeg", ["none","walking","machines","mixed"].indexOf(d.cardioPreference) !== -1 ? d.cardioPreference : "mixed");
  const enEl = document.getElementById("p952EquipmentNotes");
  if(enEl) enEl.value = (typeof d.equipmentNotes === "string") ? d.equipmentNotes : "";
  const limEl = document.getElementById("p952Limitations");
  if(limEl) limEl.value = (typeof d.limitations === "string") ? d.limitations : "";
}

// Builds the review summary with DOM nodes + textContent only (never
// innerHTML) since these values are user-entered.
function p952PopulateStep4(draft){
  const card = document.getElementById("p952ReviewCard");
  if(!card) return;
  card.innerHTML = ""; // clears app-authored placeholder only, not user data
  const profile = (draft && draft.profile) || {};
  const goals = (draft && draft.goals) || {};
  const training = (draft && draft.training) || {};

  function addRow(label, value){
    if(value === null || value === undefined || value === "") return;
    const row = document.createElement("div");
    row.className = "p952-review-row";
    const l = document.createElement("div");
    l.className = "p952-review-label";
    l.textContent = label;
    const v = document.createElement("div");
    v.className = "p952-review-value";
    v.textContent = String(value);
    row.appendChild(l);
    row.appendChild(v);
    card.appendChild(row);
  }

  const feet = isFinite(profile.heightFeet) ? profile.heightFeet : null;
  const inches = isFinite(profile.heightInches) ? profile.heightInches : null;
  const heightStr = (feet !== null && inches !== null) ? (feet + "' " + inches + '"') : "";

  addRow("Name", profile.displayName || "");
  addRow("Height", heightStr);
  addRow("Primary Goal", goals.primaryGoal || "");
  addRow("Physique Outcome", goals.physiqueOutcome || "");
  addRow("Experience", p952LabelFor(goals.trainingExperience, {beginner:"Beginner",intermediate:"Intermediate",advanced:"Advanced"}));
  addRow("Focus", p952LabelFor(goals.currentFocus, {fat_loss:"Fat Loss",muscle_gain:"Muscle Gain",recomposition:"Recomposition",general_fitness:"General Fitness"}));
  addRow("Training Locations", p952LabelFor(training.locations, {home:"Home",gym:"Gym",both:"Both"}));
  addRow("Lifting Days / Week", training.liftingDays || "");
  addRow("Cardio Preference", p952LabelFor(training.cardioPreference, {none:"None",walking:"Walking",machines:"Machines",mixed:"Mixed"}));
  addRow("Equipment Notes", training.equipmentNotes || "");
  addRow("Limitations", training.limitations || "");

  if(!card.children.length){
    const empty = document.createElement("div");
    empty.style.cssText = "font-size:13px;color:var(--muted);text-align:center;padding:10px 0;";
    empty.textContent = "No answers entered yet.";
    card.appendChild(empty);
  }
}

// ── Render current step ──────────────────────────────────────────────────────
function p952RenderStep(stepIndex){
  stepIndex = Math.max(0, Math.min(4, Math.floor(isFinite(stepIndex) ? stepIndex : 0)));
  p952RenderedStep = stepIndex;
  p952CancelSkip(); // ensure any leftover confirm modal is closed on step change

  const container = document.getElementById("p952StepContainer");
  if(!container) return;

  p952RenderProgress(stepIndex);

  const topSkip = document.getElementById("p952TopSkip");
  if(topSkip) topSkip.style.display = (stepIndex === 0 || stepIndex === 4) ? "none" : "inline-block";

  const closePreviewBtn = document.getElementById("p952ClosePreviewBtn");
  if(closePreviewBtn) closePreviewBtn.style.display = p952PreviewMode ? "inline-block" : "none";

  const state = p952GetActiveState();
  const draft = state.draft || {};

  if(stepIndex === 0) container.innerHTML = p952Step0Template();
  else if(stepIndex === 1) container.innerHTML = p952Step1Template();
  else if(stepIndex === 2) container.innerHTML = p952Step2Template();
  else if(stepIndex === 3) container.innerHTML = p952Step3Template();
  else container.innerHTML = p952Step4Template();

  if(stepIndex === 1) p952PopulateStep1(draft);
  else if(stepIndex === 2) p952PopulateStep2(draft);
  else if(stepIndex === 3) p952PopulateStep3(draft);
  else if(stepIndex === 4) p952PopulateStep4(draft);

  container.scrollTop = 0;
  const inner = document.querySelector("#p952Overlay .p952-inner");
  if(inner) inner.scrollTop = 0;
  const overlayEl = document.getElementById("p952Overlay");
  if(overlayEl) overlayEl.scrollTop = 0;
}

// ── Collect + validate current step's field values ──────────────────────────
function p952CollectStepValues(step){
  if(step === 1){
    const feetEl = document.getElementById("p952HeightFeet");
    const inchesEl = document.getElementById("p952HeightInches");
    return { profile: {
      displayName: (document.getElementById("p952DisplayName") || {}).value || "",
      heightFeet: feetEl && feetEl.value !== "" ? parseInt(feetEl.value, 10) : NaN,
      heightInches: inchesEl && inchesEl.value !== "" ? parseInt(inchesEl.value, 10) : NaN,
      weightUnit: (document.getElementById("p952WeightUnit") || {}).value || "lb",
      distanceUnit: (document.getElementById("p952DistanceUnit") || {}).value || "mi",
      firstDayOfWeek: (document.getElementById("p952FirstDayOfWeek") || {}).value || "sunday"
    }};
  }
  if(step === 2){
    return { goals: {
      primaryGoal: (document.getElementById("p952PrimaryGoal") || {}).value || "",
      physiqueOutcome: (document.getElementById("p952PhysiqueOutcome") || {}).value || "",
      trainingExperience: (document.getElementById("p952TrainingExperience") || {}).value || "intermediate",
      currentFocus: p952GetActiveSeg("p952FocusSeg") || "fat_loss"
    }};
  }
  if(step === 3){
    const daysRaw = p952GetActiveSeg("p952LiftingDaysSeg");
    return { training: {
      locations: p952GetActiveSeg("p952LocationsSeg") || "both",
      liftingDays: daysRaw !== null ? parseInt(daysRaw, 10) : NaN,
      cardioPreference: p952GetActiveSeg("p952CardioSeg") || "mixed",
      equipmentNotes: (document.getElementById("p952EquipmentNotes") || {}).value || "",
      limitations: (document.getElementById("p952Limitations") || {}).value || ""
    }};
  }
  return {};
}

function p952ValidateStep(step, collected){
  const errors = {};
  if(step === 1){
    const p = collected.profile;
    if(!p.displayName || !p.displayName.trim()) errors.displayName = "Please enter a display name.";
    const feetOk = isFinite(p.heightFeet) && p.heightFeet >= 0 && p.heightFeet <= 8;
    const inchesOk = isFinite(p.heightInches) && p.heightInches >= 0 && p.heightInches <= 11;
    if(!feetOk || !inchesOk){
      errors.height = "Please enter a valid height (feet 0\u20138, inches 0\u201311).";
    } else {
      const total = (p.heightFeet * 12) + p.heightInches;
      if(total < 20 || total > 108) errors.height = "That height looks out of range.";
    }
    if(["lb","kg"].indexOf(p.weightUnit) === -1) errors.height = errors.height || "Invalid weight unit.";
    if(["mi","km"].indexOf(p.distanceUnit) === -1) errors.height = errors.height || "Invalid distance unit.";
    if(["sunday","monday"].indexOf(p.firstDayOfWeek) === -1) errors.height = errors.height || "Invalid first day of week.";
  } else if(step === 2){
    const g = collected.goals;
    if(!g.primaryGoal || !g.primaryGoal.trim()) errors.primaryGoal = "Primary goal is required.";
    if(!g.physiqueOutcome || !g.physiqueOutcome.trim()) errors.physiqueOutcome = "Physique outcome is required.";
    if(["beginner","intermediate","advanced"].indexOf(g.trainingExperience) === -1) errors.primaryGoal = errors.primaryGoal || "Invalid training experience.";
    if(["fat_loss","muscle_gain","recomposition","general_fitness"].indexOf(g.currentFocus) === -1) errors.physiqueOutcome = errors.physiqueOutcome || "Invalid current focus.";
  } else if(step === 3){
    const t = collected.training;
    if(["home","gym","both"].indexOf(t.locations) === -1) errors.trainingSetup = "Invalid training location.";
    if(!isFinite(t.liftingDays) || t.liftingDays < 2 || t.liftingDays > 6) errors.trainingSetup = errors.trainingSetup || "Please choose 2\u20136 lifting days per week.";
    if(["none","walking","machines","mixed"].indexOf(t.cardioPreference) === -1) errors.trainingSetup = errors.trainingSetup || "Invalid cardio preference.";
  }
  return { valid: Object.keys(errors).length === 0, errors: errors };
}

function p952MergeDraft(draft, step, collected){
  const out = Object.assign({}, draft || {}); // preserve unknown draft fields
  if(step === 1) out.profile = Object.assign({}, draft && draft.profile, collected.profile);
  if(step === 2) out.goals = Object.assign({}, draft && draft.goals, collected.goals);
  if(step === 3) out.training = Object.assign({}, draft && draft.training, collected.training);
  return out;
}

// ── Navigation ────────────────────────────────────────────────────────────────
function p952Next(){
  const state = p952GetActiveState();
  let step = state.currentStep;
  if(!isFinite(step) || step < 0) step = 0;
  if(step > 4) step = 4;

  if(step === 0){
    const updated = Object.assign({}, state);
    if(updated.status === "not_started") updated.status = "in_progress";
    if(!updated.startedAt) updated.startedAt = new Date().toISOString();
    updated.currentStep = 1;
    p952SaveActiveState(updated);
    p952RenderStep(1);
    return;
  }

  if(step === 4) return; // no Next on the review step

  const collected = p952CollectStepValues(step);
  const validation = p952ValidateStep(step, collected);
  if(!validation.valid){
    p952ShowStepErrors(validation.errors);
    return;
  }

  const newDraft = p952MergeDraft(state.draft, step, collected);
  const updated = Object.assign({}, state, { draft: newDraft });
  if(updated.status === "not_started") updated.status = "in_progress";
  if(!updated.startedAt) updated.startedAt = new Date().toISOString();
  updated.currentStep = step + 1;
  p952SaveActiveState(updated);
  p952RenderStep(updated.currentStep);
}

function p952Back(){
  const state = p952GetActiveState();
  let step = state.currentStep;
  if(!isFinite(step) || step <= 0) return;
  if(step > 4) step = 4;

  // Persist whatever is currently in the fields first — Back never validates
  // and never discards answers, even partial/invalid ones.
  const collected = p952CollectStepValues(step);
  const newDraft = p952MergeDraft(state.draft, step, collected);
  const updated = Object.assign({}, state, { draft: newDraft });
  updated.currentStep = Math.max(0, step - 1);
  p952SaveActiveState(updated);
  p952RenderStep(updated.currentStep);
}

// ── Save Draft (Step 4) ──────────────────────────────────────────────────────
// Persists current state as-is, keeps status "in_progress" and
// currentStep 4, shows a success message, and leaves the overlay open.
function p952SaveDraft(){
  const state = p952GetActiveState();
  const updated = Object.assign({}, state);
  if(updated.status === "not_started") updated.status = "in_progress";
  updated.currentStep = 4;
  const result = p952SaveActiveState(updated);
  const successEl = document.getElementById("p952SaveDraftSuccess");
  if(successEl){
    successEl.textContent = result.ok ? "✅ Draft saved. You can come back and finish anytime." : "❌ Could not save draft — please try again.";
    successEl.style.display = "block";
  }
}

// ── Skip flow (in-app confirm modal — never native confirm()) ──────────────
function p952ShowSkipConfirm(){
  const backdrop = document.getElementById("p952SkipBackdrop");
  if(backdrop) backdrop.classList.add("open");
}
function p952CancelSkip(){
  const backdrop = document.getElementById("p952SkipBackdrop");
  if(backdrop) backdrop.classList.remove("open");
}
function p952ConfirmSkip(){
  p952SkipOnboarding();
}

// Reusable skip helper. Sets status "skipped", sets skippedAt only if null,
// preserves startedAt, clears completedAt, preserves the draft untouched,
// persists, and closes the overlay.
function p952SkipOnboarding(){
  const state = p952GetActiveState();
  const updated = Object.assign({}, state);
  updated.status = "skipped";
  if(!updated.skippedAt) updated.skippedAt = new Date().toISOString();
  updated.completedAt = null;
  p952SaveActiveState(updated);
  p952CancelSkip();
  p952CloseOnboarding();
}

// ── Open / close overlay ─────────────────────────────────────────────────────
function p952OpenOnboarding(){
  const overlay = document.getElementById("p952Overlay");
  if(!overlay) return;
  const state = p951GetOnboardingState();
  let step = state.currentStep;
  if(!isFinite(step) || step < 0) step = 0; // clamp invalid currentStep for rendering only
  if(step > 4) step = 4;
  overlay.classList.add("open");
  document.documentElement.style.overflow = "hidden";
  p952RenderStep(step);
}

function p952CloseOnboarding(){
  const overlay = document.getElementById("p952Overlay");
  if(overlay) overlay.classList.remove("open");
  document.documentElement.style.overflow = "";
  p952RenderedStep = null;
  // Only clears in-memory preview state — genuine onboarding state (in
  // localStorage, via p951 helpers) is never touched here.
  if(p952PreviewMode){
    p952PreviewMode = false;
    p952PreviewState = null;
  }
}

// Auto-show check run once at startup, after existing app init. The
// persisted onboarding state (not a fresh re-run of fresh-install detection)
// is the sole source of truth for whether to show the overlay.
function p952InitAutoShow(){
  try {
    if(p952ShouldAutoShow()) p952OpenOnboarding();
  } catch(e){
    console.warn("[MarcusFit] p952InitAutoShow failed:", e && e.message);
  }
}

// Debug/preview helper — opens the overlay for visual testing on any
// install (including an established one) WITHOUT resetting or overwriting
// onboarding state. Reads the real state once (to seed a realistic preview)
// but every subsequent preview interaction (Next/Back/Save Draft/Skip) reads
// and writes ONLY the in-memory p952PreviewState via p952GetActiveState()/
// p952SaveActiveState() — p951SaveOnboardingState() is never called while
// p952PreviewMode is true, so mf-onboarding-state cannot be modified until
// the preview is closed via CLOSE PREVIEW.
window.mfOpenOnboardingPreview = function(){
  const real = p951GetOnboardingState(); // read-only snapshot, never written back
  p952PreviewState = p951NormalizeOnboardingState(Object.assign({}, real));
  // The preview always renders Step 0 for visual testing, so the preview
  // state's currentStep must start in sync with that — otherwise Next/Back
  // would operate against a stale currentStep (e.g. 4, from a completed
  // install) while the visible step is 0. Real storage's currentStep is
  // untouched since this only edits the in-memory clone.
  p952PreviewState.currentStep = 0;
  p952PreviewMode = true;

  const overlay = document.getElementById("p952Overlay");
  if(!overlay){
    p952PreviewMode = false;
    p952PreviewState = null;
    console.warn("[MarcusFit] mfOpenOnboardingPreview failed: #p952Overlay not found.");
    return;
  }
  overlay.classList.add("open");
  document.documentElement.style.overflow = "hidden";
  p952RenderStep(0); // preview always opens at Step 0 for visual testing, regardless of real currentStep
  console.log("[MarcusFit] Onboarding overlay opened in PREVIEW mode — mf-onboarding-state was read once as a starting point but will not be written to until preview is closed. Use the CLOSE PREVIEW button to exit safely.");
};

// Extend the read-only mfOnboardingDebug() (defined in PHASE 9.5.1 above)
// with UI-layer fields: whether the overlay is currently visible and which
// step is currently rendered. Purely additive — does not change any existing
// field or write any storage.
(function p952ExtendOnboardingDebug(){
  const base = window.mfOnboardingDebug;
  if(typeof base !== "function") return;
  window.mfOnboardingDebug = function(){
    const result = base();
    try {
      const overlay = document.getElementById("p952Overlay");
      result.overlayVisible = !!(overlay && overlay.classList.contains("open"));
      result.renderedStep = p952RenderedStep;
      result.previewMode = p952PreviewMode;
    } catch(e){
      result.warnings = result.warnings || [];
      result.warnings.push("p952ExtendOnboardingDebug failed: " + (e && e.message));
    }
    console.log("[MarcusFit] mfOnboardingDebug() (9.5.2-extended):", result);
    return result;
  };
  window.mfOnboardingDebug.__p952Extended = true;
  var mfOnboardingDebug = window.mfOnboardingDebug;
})();
// ── END PHASE 9.5.2 ──────────────────────────────────────────────────────────

// ── PHASE 9.5.3: ONBOARDING ANSWER APPLICATION & SETUP COMPLETION ───────────
// Adds safe application of onboarding answers when the user presses FINISH
// SETUP on Step 4. Writes (in real, non-preview mode only) to:
//   - mf-user-profile            (via p950SaveUserProfile)
//   - mf-ai-coaching-preferences (via p9SetCoachPrefs)
//   - mf-onboarding-state        (via p951SaveOnboardingState, status →
//     "completed")
// Never touches P, exercises, days, progression, or recommendations. In
// preview mode (p952PreviewMode), completion is simulated entirely in the
// in-memory p952PreviewState and none of the three real keys above are
// written.

// Generated-section markers used to make repeated completion idempotent —
// on a repeated real completion, only the text between these markers is
// replaced; any user-authored text outside them is preserved.
const P953_GEN_START = "=== ONBOARDING-GENERATED CONTEXT ===";
const P953_GEN_END = "=== END ONBOARDING-GENERATED CONTEXT ===";

// Trims a string and caps its length. Never throws; non-strings become "".
function p953TrimBounded(v, maxLen){
  if(typeof v !== "string") return "";
  const t = v.trim();
  if(!isFinite(maxLen) || maxLen <= 0) return t;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

// ── REQUIREMENT 2: full-draft validation ─────────────────────────────────────
// Revalidates the ENTIRE onboarding draft from scratch — never trusts that a
// step was merely visited. Reuses the existing per-step validator
// (p952ValidateStep) so validation rules stay in one place. Returns
// { valid, errors: [{step, field, message}], normalized: {...} }. Never
// throws — missing/malformed nested draft objects are treated as empty
// objects (which simply fail validation) rather than crashing.
function p953ValidateCompleteDraft(draft){
  const d = (draft && typeof draft === "object" && !Array.isArray(draft)) ? draft : {};
  const errors = [];
  const normalized = {};

  const rawProfile = (d.profile && typeof d.profile === "object") ? d.profile : {};
  const v1 = p952ValidateStep(1, { profile: rawProfile });
  if(!v1.valid){
    Object.keys(v1.errors).forEach(function(k){ errors.push({ step: 1, field: k, message: v1.errors[k] }); });
  } else {
    normalized.profile = {
      displayName: p953TrimBounded(rawProfile.displayName, 80),
      heightFeet: rawProfile.heightFeet,
      heightInches: rawProfile.heightInches,
      weightUnit: rawProfile.weightUnit === "kg" ? "kg" : "lb",
      distanceUnit: rawProfile.distanceUnit === "km" ? "km" : "mi",
      firstDayOfWeek: rawProfile.firstDayOfWeek === "monday" ? "monday" : "sunday"
    };
  }

  const rawGoals = (d.goals && typeof d.goals === "object") ? d.goals : {};
  const v2 = p952ValidateStep(2, { goals: rawGoals });
  if(!v2.valid){
    Object.keys(v2.errors).forEach(function(k){ errors.push({ step: 2, field: k, message: v2.errors[k] }); });
  } else {
    normalized.goals = {
      primaryGoal: p953TrimBounded(rawGoals.primaryGoal, 200),
      physiqueOutcome: p953TrimBounded(rawGoals.physiqueOutcome, 200),
      trainingExperience: ["beginner","intermediate","advanced"].indexOf(rawGoals.trainingExperience) !== -1 ? rawGoals.trainingExperience : "intermediate",
      currentFocus: ["fat_loss","muscle_gain","recomposition","general_fitness"].indexOf(rawGoals.currentFocus) !== -1 ? rawGoals.currentFocus : "fat_loss"
    };
  }

  const rawTraining = (d.training && typeof d.training === "object") ? d.training : {};
  const v3 = p952ValidateStep(3, { training: rawTraining });
  if(!v3.valid){
    Object.keys(v3.errors).forEach(function(k){ errors.push({ step: 3, field: k, message: v3.errors[k] }); });
  } else {
    normalized.training = {
      locations: ["home","gym","both"].indexOf(rawTraining.locations) !== -1 ? rawTraining.locations : "both",
      liftingDays: rawTraining.liftingDays,
      cardioPreference: ["none","walking","machines","mixed"].indexOf(rawTraining.cardioPreference) !== -1 ? rawTraining.cardioPreference : "mixed",
      equipmentNotes: p953TrimBounded(rawTraining.equipmentNotes, 1000),
      limitations: p953TrimBounded(rawTraining.limitations, 1000)
    };
  }

  return { valid: errors.length === 0, errors: errors, normalized: normalized };
}

// Lowest step number (1-3) that has at least one validation error. Defaults
// to 1 if errors is empty/malformed, so callers always land somewhere valid.
function p953EarliestErrorStep(errors){
  if(!Array.isArray(errors) || !errors.length) return 1;
  return errors.reduce(function(min, e){
    return (e && isFinite(e.step) && e.step < min) ? e.step : min;
  }, 4);
}
// Filters the flat errors array down to a { field: message } map for a
// single step, matching the shape p952ShowStepErrors() already expects.
function p953ErrorsForStep(errors, step){
  const map = {};
  (errors || []).forEach(function(e){ if(e && e.step === step) map[e.field] = e.message; });
  return map;
}

// ── REQUIREMENT 3: profile mapping ───────────────────────────────────────────
// Maps validated onboarding answers into the existing mf-user-profile shape.
// Pure/in-memory — does NOT write localStorage and does NOT bump updatedAt;
// the caller (p953ApplyOnboardingCompletion) is responsible for the actual
// save via p950SaveUserProfile(). Reuses p950GetUserProfile()/
// p950NormalizeUserProfile() rather than duplicating profile save logic.
// Onboarding does not currently collect home/partial gym labels, so those
// app.* fields are preserved unchanged from the existing profile.
function p953BuildUserProfileFromOnboarding(draft, existingProfile){
  const existing = (existingProfile && typeof existingProfile === "object") ? existingProfile : p950GetUserProfile();
  const validation = p953ValidateCompleteDraft(draft);
  const p = validation.normalized.profile || {};
  const g = validation.normalized.goals || {};

  const heightInches = (isFinite(p.heightFeet) && isFinite(p.heightInches))
    ? (Number(p.heightFeet) * 12 + Number(p.heightInches))
    : existing.body.heightInches;

  const merged = Object.assign({}, existing, {
    identity: Object.assign({}, existing.identity, {
      displayName: p.displayName ? p.displayName : existing.identity.displayName
    }),
    body: Object.assign({}, existing.body, {
      heightInches: heightInches
    }),
    goals: Object.assign({}, existing.goals, {
      primaryGoal: g.primaryGoal ? g.primaryGoal : existing.goals.primaryGoal,
      physiqueOutcome: g.physiqueOutcome ? g.physiqueOutcome : existing.goals.physiqueOutcome
    }),
    preferences: Object.assign({}, existing.preferences, {
      weightUnit: p.weightUnit || existing.preferences.weightUnit,
      distanceUnit: p.distanceUnit || existing.preferences.distanceUnit,
      firstDayOfWeek: p.firstDayOfWeek || existing.preferences.firstDayOfWeek
    }),
    app: Object.assign({}, existing.app) // preserved — not collected by onboarding yet
  });

  // p950NormalizeUserProfile fills schemaVersion/profileVersion, sanity-bounds
  // height, etc. It does not bump updatedAt (by design — see its own
  // comment), so createdAt/updatedAt below are safe to set explicitly.
  const normalizedProfile = p950NormalizeUserProfile(merged);
  normalizedProfile.createdAt = existing.createdAt; // always preserved
  return normalizedProfile;
}

// ── REQUIREMENT 4: AI coaching preferences mapping ───────────────────────────
// Builds a plain-text coaching-context block from validated onboarding
// answers. Never invents answers the user didn't provide — every section is
// omitted entirely if it would otherwise be empty.
function p953BuildCoachingPreferencesFromOnboarding(draft){
  const validation = p953ValidateCompleteDraft(draft);
  const p = validation.normalized.profile || {};
  const g = validation.normalized.goals || {};
  const t = validation.normalized.training || {};

  const lines = [];
  lines.push("CURRENT AI COACHING PREFERENCES");
  lines.push("");

  if(g.primaryGoal){
    lines.push("Primary Goal:");
    lines.push("- " + g.primaryGoal);
    lines.push("");
  }

  if(g.physiqueOutcome){
    lines.push("Physique Priorities:");
    lines.push("- " + g.physiqueOutcome);
    lines.push("");
  }

  const trainingContext = [];
  if(p.displayName) trainingContext.push("- Name: " + p.displayName);
  if(g.trainingExperience) trainingContext.push("- Experience level: " + p952LabelFor(g.trainingExperience, {beginner:"Beginner",intermediate:"Intermediate",advanced:"Advanced"}));
  if(g.currentFocus) trainingContext.push("- Current focus: " + p952LabelFor(g.currentFocus, {fat_loss:"Fat Loss",muscle_gain:"Muscle Gain",recomposition:"Recomposition",general_fitness:"General Fitness"}));
  if(t.locations) trainingContext.push("- Training location access: " + p952LabelFor(t.locations, {home:"Home",gym:"Gym",both:"Home & Gym"}));
  if(isFinite(t.liftingDays)) trainingContext.push("- Desired lifting days per week: " + t.liftingDays);
  if(t.cardioPreference) trainingContext.push("- Cardio preference: " + p952LabelFor(t.cardioPreference, {none:"None",walking:"Walking",machines:"Machines",mixed:"Mixed"}));
  if(trainingContext.length){
    lines.push("Training Context:");
    trainingContext.forEach(function(l){ lines.push(l); });
    lines.push("");
  }

  const programmingPrefs = [];
  if(t.equipmentNotes) programmingPrefs.push("- Available equipment: " + t.equipmentNotes);
  if(programmingPrefs.length){
    lines.push("Programming Preferences:");
    programmingPrefs.forEach(function(l){ lines.push(l); });
    lines.push("");
  }

  const constraints = [];
  if(t.limitations) constraints.push("- " + t.limitations);
  if(constraints.length){
    lines.push("Constraints / Notes:");
    constraints.forEach(function(l){ lines.push(l); });
    lines.push("");
  }

  while(lines.length && lines[lines.length - 1] === "") lines.pop();

  const generatedBlock = P953_GEN_START + "\n" + lines.join("\n") + "\n" + P953_GEN_END;
  const existingText = p9GetCoachPrefs() || "";
  return p953MergeCoachingPreferencesText(existingText, generatedBlock);
}

// Idempotent merge: if existing text already contains a generated block
// (from a previous completion), only that block is replaced in place —
// anything before/after it (including a prior "PREVIOUS SAVED COACHING
// CONTEXT" section) is preserved untouched. If existing text has no
// generated block but does have meaningful user-authored content, that
// content is preserved under a clearly labeled section, once. If existing
// text is empty, the generated block becomes the entire value.
function p953MergeCoachingPreferencesText(existingText, generatedBlock){
  const text = (typeof existingText === "string") ? existingText : "";
  const startIdx = text.indexOf(P953_GEN_START);
  const endIdx = text.indexOf(P953_GEN_END);
  if(startIdx !== -1 && endIdx !== -1 && endIdx > startIdx){
    const before = text.slice(0, startIdx).replace(/\s+$/, "");
    const after = text.slice(endIdx + P953_GEN_END.length).replace(/^\s+/, "");
    const parts = [];
    if(before) parts.push(before);
    parts.push(generatedBlock);
    if(after) parts.push(after);
    return parts.join("\n\n");
  }
  const trimmed = text.trim();
  if(!trimmed) return generatedBlock;
  return "PREVIOUS SAVED COACHING CONTEXT\n\n" + trimmed + "\n\n" + generatedBlock;
}

// ── REQUIREMENT 5: transaction-like safe application (real mode only) ───────
// Revalidates the full draft, builds both proposed values in memory, then
// writes mf-user-profile → mf-ai-coaching-preferences → mf-onboarding-state
// in order. If anything throws partway through, ALL THREE keys are restored
// to their exact previous raw string values and onboarding status is never
// marked "completed". Never called while p952PreviewMode is true — the
// preview path in p953FinishSetup() never reaches this function.
function p953ApplyOnboardingCompletion(){
  const state = p951GetOnboardingState();
  const draft = state.draft || {};

  const validation = p953ValidateCompleteDraft(draft);
  if(!validation.valid){
    return { ok: false, validation: validation };
  }

  const prevProfileRaw = localStorage.getItem(USER_PROFILE_KEY);
  const prevCoachRaw = localStorage.getItem(AI_PREFS_KEY);
  const prevOnboardingRaw = localStorage.getItem(ONBOARDING_KEY);

  try {
    const existingProfile = p950GetUserProfile();
    const builtProfile = p953BuildUserProfileFromOnboarding(draft, existingProfile);
    const builtCoachingText = p953BuildCoachingPreferencesFromOnboarding(draft);

    const profileResult = p950SaveUserProfile(builtProfile);
    if(!profileResult.ok) throw new Error(profileResult.error || "Failed to save profile.");

    p9SetCoachPrefs(builtCoachingText);

    const updatedState = Object.assign({}, state);
    updatedState.status = "completed";
    updatedState.completedAt = new Date().toISOString();
    updatedState.skippedAt = null;
    updatedState.currentStep = 4;
    updatedState.onboardingVersion = APP_VERSION;
    const stateResult = p951SaveOnboardingState(updatedState);
    if(!stateResult.ok) throw new Error(stateResult.error || "Failed to save onboarding state.");

    return { ok: true, profile: profileResult.profile, onboardingState: stateResult.state };
  } catch(e){
    try {
      if(prevProfileRaw === null) localStorage.removeItem(USER_PROFILE_KEY); else localStorage.setItem(USER_PROFILE_KEY, prevProfileRaw);
      if(prevCoachRaw === null) localStorage.removeItem(AI_PREFS_KEY); else localStorage.setItem(AI_PREFS_KEY, prevCoachRaw);
      if(prevOnboardingRaw === null) localStorage.removeItem(ONBOARDING_KEY); else localStorage.setItem(ONBOARDING_KEY, prevOnboardingRaw);
    } catch(rollbackErr){
      console.warn("[MarcusFit] p953ApplyOnboardingCompletion rollback failed:", rollbackErr && rollbackErr.message);
    }
    console.warn("[MarcusFit] p953ApplyOnboardingCompletion failed — all affected keys rolled back:", e && e.message);
    return { ok: false, error: (e && e.message) || "Unknown error" };
  }
}

// ── REQUIREMENT 7: UI refresh after successful real completion ──────────────
function p953RefreshAppUiAfterOnboarding(){
  try {
    p950RenderUserProfile();
    p9RenderCoachPrefs();
  } catch(e){
    console.warn("[MarcusFit] p953RefreshAppUiAfterOnboarding failed:", e && e.message);
  }
}

function p953ShowFinishResult(success, isPreview, errorMsg){
  const el = document.getElementById("p952FinishSetupResult");
  if(!el) return;
  el.style.display = "block";
  if(success){
    el.className = "p952-success";
    el.textContent = isPreview ? "✅ Preview complete — no changes were saved." : "✅ Setup complete!";
  } else {
    el.className = "p952-error";
    el.textContent = "❌ " + (errorMsg || "Could not complete setup — please try again.");
  }
}

// ── REQUIREMENT 1: FINISH SETUP button handler ───────────────────────────────
// Always revalidates the complete draft first (never trusts earlier steps
// merely having been visited), in both real and preview mode. On failure,
// routes to the earliest step with an error, shows inline errors, and never
// touches localStorage. In preview mode, success is simulated purely via
// p952SaveActiveState() (in-memory p952PreviewState) — real storage keys are
// never written. In real mode, delegates the actual writes to
// p953ApplyOnboardingCompletion().
function p953FinishSetup(){
  const state = p952GetActiveState();
  const draft = state.draft || {};
  const validation = p953ValidateCompleteDraft(draft);

  if(!validation.valid){
    const earliestStep = p953EarliestErrorStep(validation.errors);
    p952RenderStep(earliestStep);
    p952ShowStepErrors(p953ErrorsForStep(validation.errors, earliestStep));
    return;
  }

  if(p952PreviewMode){
    const updated = Object.assign({}, state);
    updated.status = "completed";
    updated.completedAt = new Date().toISOString();
    updated.skippedAt = null;
    updated.currentStep = 4;
    updated.onboardingVersion = APP_VERSION;
    p952SaveActiveState(updated); // in-memory only — never touches localStorage
    p953ShowFinishResult(true, true);
    setTimeout(function(){ p952CloseOnboarding(); }, 700);
    return;
  }

  const result = p953ApplyOnboardingCompletion();
  if(!result.ok){
    if(result.validation){
      const earliestStep = p953EarliestErrorStep(result.validation.errors);
      p952RenderStep(earliestStep);
      p952ShowStepErrors(p953ErrorsForStep(result.validation.errors, earliestStep));
    } else {
      p953ShowFinishResult(false, false, result.error);
    }
    return;
  }

  p954MaybeGenerateProposalAfterRealCompletion();

  p953ShowFinishResult(true, false);
  setTimeout(function(){
    p952CancelSkip();
    p952CloseOnboarding();
    p953RefreshAppUiAfterOnboarding();
  }, 700);
}

// ── REQUIREMENT 10: extended debug ───────────────────────────────────────────
// Extends the existing (9.5.1/9.5.2-extended) mfOnboardingDebug() with
// read-only 9.5.3 completion fields. Purely additive — never writes storage.
(function p953ExtendOnboardingDebug(){
  const base = window.mfOnboardingDebug;
  if(typeof base !== "function") return;
  window.mfOnboardingDebug = function(){
    const result = base();
    try {
      const state = p951GetOnboardingState();
      const draft = state.draft || {};
      const validation = p953ValidateCompleteDraft(draft);
      result.canComplete = validation.valid;
      result.completionValidationErrors = validation.errors;

      let profileAppliedMatchesDraft = false;
      if(validation.valid){
        const profile = p950GetUserProfile();
        const p = validation.normalized.profile || {};
        const g = validation.normalized.goals || {};
        const expectedHeight = (isFinite(p.heightFeet) && isFinite(p.heightInches)) ? (Number(p.heightFeet) * 12 + Number(p.heightInches)) : null;
        profileAppliedMatchesDraft = !!(
          profile.identity.displayName === p.displayName &&
          (expectedHeight === null || profile.body.heightInches === expectedHeight) &&
          profile.goals.primaryGoal === g.primaryGoal &&
          profile.goals.physiqueOutcome === g.physiqueOutcome &&
          profile.preferences.weightUnit === p.weightUnit &&
          profile.preferences.distanceUnit === p.distanceUnit &&
          profile.preferences.firstDayOfWeek === p.firstDayOfWeek
        );
      }
      result.profileAppliedMatchesDraft = profileAppliedMatchesDraft;

      const coachText = p9GetCoachPrefs() || "";
      result.coachingPreferencesContainGeneratedContext = coachText.indexOf(P953_GEN_START) !== -1 && coachText.indexOf(P953_GEN_END) !== -1;

      result.completedStateConsistent = (state.status !== "completed") || !!(state.completedAt && state.currentStep === 4);
    } catch(e){
      result.warnings = result.warnings || [];
      result.warnings.push("p953ExtendOnboardingDebug failed: " + (e && e.message));
    }
    console.log("[MarcusFit] mfOnboardingDebug() (9.5.3-extended):", result);
    return result;
  };
  window.mfOnboardingDebug.__p953Extended = true;
  var mfOnboardingDebug = window.mfOnboardingDebug;
})();

// Dedicated read-only console helper for inspecting completion readiness
// without applying anything. Never mutates state.
window.mfOnboardingCompletionDebug = function(){
  const result = { readOnly: true, warnings: [] };
  try {
    const state = p951GetOnboardingState();
    const draft = state.draft || {};
    result.onboardingStateSummary = {
      status: state.status,
      currentStep: state.currentStep,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      skippedAt: state.skippedAt,
      hasDraft: !!(draft && Object.keys(draft).length > 0)
    };

    const validation = p953ValidateCompleteDraft(draft);
    result.validation = validation;

    if(validation.valid){
      const currentProfile = p950GetUserProfile();
      const previewProfile = p953BuildUserProfileFromOnboarding(draft, currentProfile);
      result.normalizedMappingPreview = validation.normalized;
      result.profileComparison = {
        current: { displayName: currentProfile.identity.displayName, heightInches: currentProfile.body.heightInches, primaryGoal: currentProfile.goals.primaryGoal, physiqueOutcome: currentProfile.goals.physiqueOutcome },
        wouldApply: { displayName: previewProfile.identity.displayName, heightInches: previewProfile.body.heightInches, primaryGoal: previewProfile.goals.primaryGoal, physiqueOutcome: previewProfile.goals.physiqueOutcome }
      };
    } else {
      result.warnings.push("Draft does not currently pass full-draft validation — see result.validation.errors.");
    }

    const coachText = p9GetCoachPrefs() || "";
    result.coachingGeneratedSectionPresent = coachText.indexOf(P953_GEN_START) !== -1 && coachText.indexOf(P953_GEN_END) !== -1;
    result.consistencyChecks = {
      previewModeActive: p952PreviewMode
    };
  } catch(e){
    result.warnings.push("mfOnboardingCompletionDebug failed: " + (e && e.message));
  }
  console.log("[MarcusFit] mfOnboardingCompletionDebug():", result);
  return result;
};
var mfOnboardingCompletionDebug = window.mfOnboardingCompletionDebug;
// ── END PHASE 9.5.3 ──────────────────────────────────────────────────────────
