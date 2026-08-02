

let gym="home",logGym="home",tDate=new Date(),toggleStates={bm:null,wo:null,zep:null};
// 9.5.8.4: In-memory only. Program content must remain neutral until profile,
// onboarding, lifecycle, and starter eligibility initialization has completed.
let starterProgramStateReady=false;
tDate.setHours(0,0,0,0);
let habitState = initHabitState();

// ── PHASE 2: DRAFT SYSTEM ─────────────────────────────────────────────────────
const DRAFT_KEY = "mf-current-draft";

function todayStr(){return new Date().toISOString().slice(0,10);}

function getDraft(){try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||"null")}catch{return null;}}
function saveDraft(d){localStorage.setItem(DRAFT_KEY,JSON.stringify(d));}
function clearDraft(){localStorage.removeItem(DRAFT_KEY);}

// ── PHASE 9.4.8.8: PERSISTENT AI COACHING PREFERENCES ────────────────────────
// Storage key: "mf-ai-coaching-preferences" — plain text, stored raw (no JSON
// wrapping needed). Read by genExport() and included in the PHASE 8 backup/
// restore path automatically via p8IsMarcusFitKey(). Does not touch workout
// logs, progression, lifecycle, or day override/addition data.
const AI_PREFS_KEY = "mf-ai-coaching-preferences";

const AI_PREFS_STARTER_TEMPLATE =
"CURRENT AI COACHING PREFERENCES\n\n"+
"Primary Goal:\n"+
"- Aesthetics during aggressive fat loss.\n"+
"- Build an athletic, muscular physique that looks impressive when lean.\n\n"+
"Current Physique Priorities:\n"+
"1. Lateral delts\n"+
"2. Upper chest\n"+
"3. Lat width\n"+
"4. Rear delts\n"+
"5. Long-head triceps\n"+
"6. Upper back thickness\n"+
"7. Biceps\n"+
"8. Core stability\n\n"+
"Programming Philosophy:\n"+
"- Treat AI Sync like personal bodybuilding coaching, not just number progression.\n"+
"- Be proactive but controlled.\n"+
"- Recommend exercise swaps, reorders, added exercises, removals, and optional days when logs/goals justify them.\n"+
"- Prioritize biomechanics, stimulus, and physique outcomes over tradition.\n"+
"- Use machines/cables when they provide better stimulus.\n"+
"- Keep enough consistency to measure progression, but do not let the program become stale.\n"+
"- Maintain legs with minimum effective volume while biasing recovery and volume toward upper-body aesthetics.\n\n"+
"Coaching Style:\n"+
"- Optimization-forward.\n"+
"- Evidence-based from logs, recovery, weight trend, notes, and physique goals.\n"+
"- Push hard when recovery supports it.\n"+
"- Recommend reductions, deloads, or swaps when recovery/joint health/progress indicates.\n\n"+
"Current Short-Term Focus:\n"+
"- More proactive exercise rotation and lift recommendations.\n"+
"- Prioritize shoulder width, upper chest, and V-taper.";

function p9GetCoachPrefs(){
  const v = localStorage.getItem(AI_PREFS_KEY);
  return v===null?"":v;
}
function p9SetCoachPrefs(v){
  localStorage.setItem(AI_PREFS_KEY, v===null||v===undefined?"":v);
}
// Sync the textarea (if present on the current screen) with saved state.
function p9RenderCoachPrefs(){
  const ta=document.getElementById("coachPrefsTa");
  if(!ta)return;
  ta.value=p9GetCoachPrefs();
}
function p9ShowCoachPrefsResult(msg,type){
  const el=document.getElementById("coachPrefsResult");
  if(!el)return;
  el.style.display="block";
  el.style.color=type==="ok"?"var(--green)":type==="err"?"var(--red)":"var(--text)";
  el.style.whiteSpace="pre-wrap";
  el.textContent=msg;
}
function p9SaveCoachPrefs(){
  const ta=document.getElementById("coachPrefsTa");
  if(!ta)return;
  p9SetCoachPrefs(ta.value);
  p9ShowCoachPrefsResult("✅ Preferences saved.","ok");
}
function p9ResetCoachPrefsTemplate(){
  const ta=document.getElementById("coachPrefsTa");
  if(!ta)return;
  ta.value=AI_PREFS_STARTER_TEMPLATE;
  p9SetCoachPrefs(AI_PREFS_STARTER_TEMPLATE);
  p9ShowCoachPrefsResult("✅ Reset to starter template.","ok");
}
function p9ClearCoachPrefs(){
  if(!confirm("Clear your saved AI coaching preferences? This cannot be undone."))return;
  const ta=document.getElementById("coachPrefsTa");
  if(!ta)return;
  ta.value="";
  p9SetCoachPrefs("");
  p9ShowCoachPrefsResult("✅ Cleared.","ok");
}
// ── END PHASE 9.4.8.8 ─────────────────────────────────────────────────────────

// ── PHASE 9.5.0: USER PROFILE & APP PREFERENCES FOUNDATION ───────────────────
// Storage key: "mf-user-profile" — structured, schema-versioned JSON object.
// General identity/goals/units/gym-label foundation for future shared-app
// support. Read by genExport() (concise block) and included in the PHASE 8
// backup/restore path automatically via p8IsMarcusFitKey(). Does NOT store
// live/current body weight (owned by daily logs) and does NOT store detailed
// bodybuilding philosophy (remains in AI_PREFS_KEY / AI Coaching Preferences).
// Does not control any workout/program/progression behavior in this release.
const USER_PROFILE_KEY = "mf-user-profile";
const USER_PROFILE_SCHEMA = 1;

// Returns a fresh, independent default profile object (Marcus's defaults).
// Never returns a shared mutable reference — safe to call repeatedly.
function p950GetDefaultUserProfile(){
  const now = new Date().toISOString();
  return {
    schemaVersion: USER_PROFILE_SCHEMA,
    profileVersion: APP_VERSION,
    identity: { displayName: "Marcus" },
    body: { heightInches: 72 },
    goals: {
      primaryGoal: "Aesthetics during aggressive fat loss",
      physiqueOutcome: "Athletic muscular physique when lean"
    },
    preferences: { weightUnit: "lb", distanceUnit: "mi", firstDayOfWeek: "sunday" },
    app: { homeGymLabel: "Home", partialGymLabel: "Transition" },
    createdAt: now,
    updatedAt: now
  };
}

// Format a total-inches height value as "X ft Y in". Never converts based on
// weight/distance unit — height is stored and displayed in inches only.
function p950FormatHeight(totalInches){
  const n = Number(totalInches);
  if(!isFinite(n) || n <= 0) return "unknown";
  const ft = Math.floor(n / 12);
  const inch = Math.round(n % 12);
  return ft + " ft " + inch + " in";
}

// Fills missing/malformed fields from defaults, preserves valid existing
// values, and preserves unknown top-level/nested fields where practical for
// forward compatibility. Does not replace the whole object for one bad field.
// Does NOT bump updatedAt — callers decide when a save is a "real" change.
function p950NormalizeUserProfile(profile){
  const def = p950GetDefaultUserProfile();
  const src = (profile && typeof profile === "object") ? profile : {};

  function str(v, fallback){
    return (typeof v === "string" && v.trim()) ? v : fallback;
  }
  function safeHeight(v, fallback){
    const n = Number(v);
    if(typeof v !== "number" && typeof v !== "string") return fallback;
    if(isNaN(n) || !isFinite(n)) return fallback;
    if(n < 20 || n > 108) return fallback; // sanity bounds: ~1'8" to 9'0"
    return n;
  }

  const out = Object.assign({}, src); // preserve unknown top-level fields

  out.schemaVersion = USER_PROFILE_SCHEMA;
  out.profileVersion = APP_VERSION; // profileVersion always reflects the app version that normalized/created this profile

  const srcIdentity = (src.identity && typeof src.identity === "object") ? src.identity : {};
  out.identity = Object.assign({}, srcIdentity, {
    displayName: str(srcIdentity.displayName, def.identity.displayName)
  });

  const srcBody = (src.body && typeof src.body === "object") ? src.body : {};
  out.body = Object.assign({}, srcBody, {
    heightInches: safeHeight(srcBody.heightInches, def.body.heightInches)
  });

  const srcGoals = (src.goals && typeof src.goals === "object") ? src.goals : {};
  out.goals = Object.assign({}, srcGoals, {
    primaryGoal: str(srcGoals.primaryGoal, def.goals.primaryGoal),
    physiqueOutcome: str(srcGoals.physiqueOutcome, def.goals.physiqueOutcome)
  });

  const srcPrefs = (src.preferences && typeof src.preferences === "object") ? src.preferences : {};
  out.preferences = Object.assign({}, srcPrefs, {
    weightUnit: srcPrefs.weightUnit === "kg" ? "kg" : "lb",
    distanceUnit: srcPrefs.distanceUnit === "km" ? "km" : "mi",
    firstDayOfWeek: srcPrefs.firstDayOfWeek === "monday" ? "monday" : "sunday"
  });

  const srcApp = (src.app && typeof src.app === "object") ? src.app : {};
  out.app = Object.assign({}, srcApp, {
    homeGymLabel: str(srcApp.homeGymLabel, def.app.homeGymLabel),
    partialGymLabel: str(srcApp.partialGymLabel, def.app.partialGymLabel)
  });

  const createdAtValid = typeof src.createdAt === "string" && !isNaN(Date.parse(src.createdAt));
  out.createdAt = createdAtValid ? src.createdAt : def.createdAt;

  const updatedAtValid = typeof src.updatedAt === "string" && !isNaN(Date.parse(src.updatedAt));
  out.updatedAt = updatedAtValid ? src.updatedAt : out.createdAt;

  return out;
}

// Safely reads + parses mf-user-profile. Never throws. Returns a normalized
// valid profile even if storage is empty/malformed. Does not write storage.
function p950GetUserProfile(){
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if(raw === null) return p950GetDefaultUserProfile();
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch(e){
      console.warn("[MarcusFit] mf-user-profile is malformed JSON — using safe defaults for this read.");
      return p950GetDefaultUserProfile();
    }
    return p950NormalizeUserProfile(parsed);
  } catch(e){
    console.warn("[MarcusFit] p950GetUserProfile failed, using safe defaults:", e && e.message);
    return p950GetDefaultUserProfile();
  }
}

// Normalizes, preserves createdAt, sets updatedAt (a real edit/migration is
// being persisted), and safely writes to localStorage.
function p950SaveUserProfile(profile){
  try {
    const normalized = p950NormalizeUserProfile(profile);
    normalized.updatedAt = new Date().toISOString();
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(normalized));
    return { ok: true, profile: normalized };
  } catch(e){
    console.warn("[MarcusFit] p950SaveUserProfile failed:", e && e.message);
    return { ok: false, error: (e && e.message) || "Unknown error" };
  }
}

// Idempotent page-load initializer. Creates Marcus's default profile once if
// missing, safely migrates/fills malformed or older data, and recovers to
// defaults on corrupt JSON without crashing. Only writes storage when the
// stored data actually needed to change — refreshing repeatedly must not
// overwrite edits or keep bumping updatedAt.
function p950InitUserProfile(){
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if(raw === null){
      const def = p950GetDefaultUserProfile();
      localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(def));
      console.log("[MarcusFit] Initialized default user profile (mf-user-profile).");
      return;
    }
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch(e){
      console.warn("[MarcusFit] mf-user-profile was malformed JSON — recovering to Marcus defaults.");
      localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(p950GetDefaultUserProfile()));
      return;
    }
    const normalized = p950NormalizeUserProfile(parsed);
    if(JSON.stringify(normalized) !== JSON.stringify(parsed)){
      localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(normalized));
      console.log("[MarcusFit] Migrated/normalized existing user profile.");
    }
  } catch(e){
    console.warn("[MarcusFit] p950InitUserProfile failed:", e && e.message);
  }
}

// Populate the Sync-tab profile card inputs from stored state. Safe no-op if
// the profile card is not present in the current DOM.
function p950RenderUserProfile(){
  const nameEl = document.getElementById("p950DisplayName");
  if(!nameEl) return;
  const profile = p950GetUserProfile();
  nameEl.value = profile.identity.displayName;
  const totalIn = profile.body.heightInches;
  document.getElementById("p950HeightFeet").value = Math.floor(totalIn / 12);
  document.getElementById("p950HeightInches").value = totalIn % 12;
  document.getElementById("p950PrimaryGoal").value = profile.goals.primaryGoal;
  document.getElementById("p950PhysiqueOutcome").value = profile.goals.physiqueOutcome;
  document.getElementById("p950WeightUnit").value = profile.preferences.weightUnit;
  document.getElementById("p950DistanceUnit").value = profile.preferences.distanceUnit;
  document.getElementById("p950FirstDayOfWeek").value = profile.preferences.firstDayOfWeek;
  document.getElementById("p950HomeGymLabel").value = profile.app.homeGymLabel;
  document.getElementById("p950PartialGymLabel").value = profile.app.partialGymLabel;
}

function p950ShowProfileResult(msg, type){
  const el = document.getElementById("p950Result");
  if(!el) return;
  el.style.display = "block";
  el.style.color = type === "ok" ? "var(--green)" : type === "err" ? "var(--red)" : type === "warn" ? "var(--yellow)" : "var(--text)";
  el.style.whiteSpace = "pre-wrap";
  el.textContent = msg;
}

// Reads Sync-tab inputs, validates, and saves. Preserves the previous saved
// profile if validation fails — never partially overwrites on bad input.
// Renders values via .value/textContent only — never innerHTML with
// user-entered profile strings.
function p950SaveUserProfileFromUI(){
  const nameEl = document.getElementById("p950DisplayName");
  if(!nameEl) return;

  const displayName = nameEl.value.trim();
  if(!displayName){
    p950ShowProfileResult("❌ Display name cannot be empty. Your previous profile was not changed.", "err");
    return;
  }

  let feet = parseInt(document.getElementById("p950HeightFeet").value, 10);
  let inches = parseInt(document.getElementById("p950HeightInches").value, 10);
  if(isNaN(feet) || feet < 0) feet = 0;
  if(isNaN(inches) || inches < 0) inches = 0;
  if(inches > 11) inches = 11;
  const totalInches = (feet * 12) + inches;
  if(totalInches < 20 || totalInches > 108){
    p950ShowProfileResult("❌ Height looks invalid. Your previous profile was not changed.", "err");
    return;
  }

  const weightUnit = document.getElementById("p950WeightUnit").value === "kg" ? "kg" : "lb";
  const distanceUnit = document.getElementById("p950DistanceUnit").value === "km" ? "km" : "mi";
  const firstDayOfWeek = document.getElementById("p950FirstDayOfWeek").value === "monday" ? "monday" : "sunday";
  const primaryGoal = document.getElementById("p950PrimaryGoal").value.trim();
  const physiqueOutcome = document.getElementById("p950PhysiqueOutcome").value.trim();
  const homeGymLabel = document.getElementById("p950HomeGymLabel").value.trim();
  const partialGymLabel = document.getElementById("p950PartialGymLabel").value.trim();

  const current = p950GetUserProfile();
  const updated = Object.assign({}, current, {
    identity: Object.assign({}, current.identity, { displayName: displayName }),
    body: Object.assign({}, current.body, { heightInches: totalInches }),
    goals: Object.assign({}, current.goals, {
      primaryGoal: primaryGoal || current.goals.primaryGoal,
      physiqueOutcome: physiqueOutcome || current.goals.physiqueOutcome
    }),
    preferences: Object.assign({}, current.preferences, {
      weightUnit: weightUnit,
      distanceUnit: distanceUnit,
      firstDayOfWeek: firstDayOfWeek
    }),
    app: Object.assign({}, current.app, {
      homeGymLabel: homeGymLabel || current.app.homeGymLabel,
      partialGymLabel: partialGymLabel || current.app.partialGymLabel
    })
  });

  const result = p950SaveUserProfile(updated);
  if(result.ok){
    p950RenderUserProfile();
    p950ShowProfileResult("✅ Profile saved.", "ok");
  } else {
    p950ShowProfileResult("❌ Failed to save profile: " + result.error, "err");
  }
}

// Two-step in-app confirmation (same pattern as Restore/Clear App Data —
// avoids native confirm(), which iOS home-screen PWA mode silently blocks).
// Resets ONLY mf-user-profile. Does not touch logs, AI coaching preferences,
// lifecycle data, the program, or workouts, and does not reload the page.
function p950ResetUserProfileDefaults(){
  const panel = document.getElementById("p950ResetConfirmPanel");
  if(panel){
    panel.style.display = "block";
    panel.scrollIntoView({behavior:"smooth", block:"nearest"});
  }
  p950ShowProfileResult("⚠ This will reset your profile to Marcus defaults. Confirm below to proceed.", "warn");
}
function p950ConfirmResetProfile(){
  const panel = document.getElementById("p950ResetConfirmPanel");
  if(panel) panel.style.display = "none";
  const def = p950GetDefaultUserProfile();
  const result = p950SaveUserProfile(def);
  if(result.ok){
    p950RenderUserProfile();
    p950ShowProfileResult("✅ Profile reset to Marcus defaults.", "ok");
  } else {
    p950ShowProfileResult("❌ Reset failed: " + result.error, "err");
  }
}
function p950CancelResetProfile(){
  const panel = document.getElementById("p950ResetConfirmPanel");
  if(panel) panel.style.display = "none";
  p950ShowProfileResult("Reset cancelled. No changes made.", "ok");
}

// Concise, human-readable profile block for AI exports. No raw JSON dump.
// Gracefully falls back if profile storage is absent/malformed.
function p950BuildUserProfileExport(){
  try {
    const profile = p950GetUserProfile();
    const lines = ["--- USER PROFILE ---", ""];
    lines.push("Display Name: " + (profile.identity.displayName || "Marcus"));
    lines.push("Height: " + p950FormatHeight(profile.body.heightInches));
    if(profile.goals.primaryGoal) lines.push("Primary Goal: " + profile.goals.primaryGoal);
    if(profile.goals.physiqueOutcome) lines.push("Physique Outcome: " + profile.goals.physiqueOutcome);
    lines.push("Units: " + profile.preferences.weightUnit + " / " + profile.preferences.distanceUnit);
    lines.push("First Day of Week: " + (profile.preferences.firstDayOfWeek === "monday" ? "Monday" : "Sunday"));
    lines.push("Program Labels: " + profile.app.homeGymLabel + " / " + profile.app.partialGymLabel);
    lines.push("", "");
    return lines.join("\n");
  } catch(e){
    return "--- USER PROFILE ---\n\n(Profile unavailable: " + ((e && e.message) || "unknown error") + ")\n\n";
  }
}
// ── END PHASE 9.5.0 ────────────────────────────────────────────────────────────

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

// ── FUTURE MODULE: src/proposal-engine.js ───────────────────────────────────
// ── PHASE 9.5.4: PERSONALIZED PROGRAM PROPOSAL FOUNDATION ───────────────────
// Read-only-with-respect-to-the-program foundation. Adds a new, independent
// localStorage key (mf-onboarding-program-proposal) that stores a
// schema-versioned, deterministic SUMMARY of what a program change based on
// onboarding answers + profile + current resolved program *could* look like.
//
// Hard rule for this entire phase: a proposal DESCRIBES suggested changes
// (kept/modified days, tweaks, reorders, replacements, additions, removals,
// optional added days). It never APPLIES any of them. Nothing in this phase
// writes to P, mf-overrides, mf-exercise-state, mf-recommendations, workout
// logs/history, or mf-onboarding-state's draft/answers. The only localStorage
// key this phase ever writes to is mf-onboarding-program-proposal itself.
//
// Generation is deterministic: given the same onboarding draft, profile, and
// resolved program, p954BuildProgramProposal() always returns the same
// summary/dayPlans/warnings (aside from the generatedAt timestamp, which is
// set by the caller, not the builder).
const PROGRAM_PROPOSAL_KEY = "mf-onboarding-program-proposal";
const PROGRAM_PROPOSAL_SCHEMA = 1;
const PROGRAM_PROPOSAL_STATUSES = ["draft", "applied", "dismissed", "undone"];
const PROGRAM_PROPOSAL_DAY_ACTIONS = ["keep", "modify", "reorder", "replace", "add", "remove", "optional_add"];
// 9.5.4.2: recognized day-plan roles produced by p954ClassifyProposalDay().
// "optional" doubles as the safe fallback for older proposals saved before
// this field existed.
const PROGRAM_PROPOSAL_DAY_ROLES = ["lifting", "cardio", "recovery", "optional"];
// 9.5.4D: structured, schema-safe exercise instructions. Prose is never executable.
const PROGRAM_PROPOSAL_EXERCISE_ACTIONS = ["keep", "modify", "replace", "add", "remove", "reactivate"];
const PROGRAM_PROPOSAL_EXERCISE_MODIFY_FIELDS = ["name", "sets", "reps", "load", "rir", "blurb"];
const PROGRAM_PROPOSAL_SOURCE_TYPES = ["local_generated", "fixture", "legacy"];
const PROGRAM_PROPOSAL_SAFETY_TAGS = ["safe_apply", "review_only", "deferred_lifecycle", "low_confidence", "source_missing", "unchanged", "conflict"];
const PROGRAM_PROPOSAL_ENGINE_VERSION = "9.5.5-local-rules-1";

// Recognized gym modes for proposal purposes. Falls back to the known
// "home"/"partial" pair if P isn't available for any reason — never throws.
function p954GetRecognizedProposalGymKeys(){
  try {
    const keys = Object.keys(P);
    return keys.length ? keys : ["home","partial"];
  } catch(e){
    return ["home","partial"];
  }
}

// Returns a fresh, independent default proposal object. Never returns a
// shared mutable reference — safe to call repeatedly. status defaults to
// "draft" since the default shape only exists as a normalization base /
// in-memory scaffold — "no proposal at all" is represented by p954GetProposal()
// returning null, not by this default object being persisted.
function p954GetDefaultProposal(){
  return {
    schemaVersion: PROGRAM_PROPOSAL_SCHEMA,
    proposalVersion: APP_VERSION,
    status: "draft",
    source: "onboarding",
    sourceType: "local_generated",
    sourceSummary: {
      generatedAt: null,
      appVersion: APP_VERSION,
      proposalEngineVersion: PROGRAM_PROPOSAL_ENGINE_VERSION,
      profileUsed: false,
      onboardingUsed: false,
      coachingPrefsUsed: false,
      currentProgramUsed: false,
      lifecycleUsed: false,
      recentLogsUsed: false,
      sourceWarnings: []
    },
    generatedAt: null,
    appliedAt: null,
    undoneAt: null,
    dismissedAt: null,
    onboardingUpdatedAt: null,
    profileUpdatedAt: null,
    // 9.5.4C: application foundation — all null/absent for legacy proposals
    // and for any proposal that hasn't been applied yet.
    applicationId: null,
    applicationSummary: null,
    preApplySnapshot: null,
    undoSummary: null,
    summary: {
      recommendedFrequency: null,
      gymModes: [],
      estimatedSessionDurationMinutes: null,
      rationale: [],
      affectedDayCount: 0,
      actionCounts: { keep:0, modify:0, reorder:0, replace:0, add:0, remove:0, optional_add:0 },
      // 9.5.4.2: preserve these through normalization so they survive save/load.
      requestedLiftingFrequency: null,
      currentLiftingDayCounts: {}
    },
    dayPlans: [],
    warnings: []
  };
}

// Fills missing/malformed fields from defaults, preserves valid existing
// values, and preserves unknown top-level fields where practical for forward
// compatibility. Never throws.
function p954NormalizeProposal(proposal){
  const def = p954GetDefaultProposal();
  const src = (proposal && typeof proposal === "object" && !Array.isArray(proposal)) ? proposal : {};
  const out = Object.assign({}, src); // preserve unknown top-level fields

  out.schemaVersion = PROGRAM_PROPOSAL_SCHEMA;
  out.proposalVersion = (typeof src.proposalVersion === "string" && src.proposalVersion.trim()) ? src.proposalVersion : def.proposalVersion;
  out.status = PROGRAM_PROPOSAL_STATUSES.indexOf(src.status) !== -1 ? src.status : def.status;
  out.source = (typeof src.source === "string" && src.source.trim()) ? src.source : def.source;
  const hasStructuredSource = src.sourceSummary && typeof src.sourceSummary === "object" && !Array.isArray(src.sourceSummary);
  out.sourceType = PROGRAM_PROPOSAL_SOURCE_TYPES.indexOf(src.sourceType) !== -1
    ? src.sourceType
    : (hasStructuredSource ? "local_generated" : "legacy");

  function isoOrNull(v){
    if(v === null || v === undefined) return null;
    return (typeof v === "string" && !isNaN(Date.parse(v))) ? v : null;
  }
  out.generatedAt = isoOrNull(src.generatedAt);
  out.appliedAt = isoOrNull(src.appliedAt);
  out.undoneAt = isoOrNull(src.undoneAt);
  out.dismissedAt = isoOrNull(src.dismissedAt);
  out.onboardingUpdatedAt = isoOrNull(src.onboardingUpdatedAt);
  out.profileUpdatedAt = isoOrNull(src.profileUpdatedAt);
  const ss = hasStructuredSource ? src.sourceSummary : {};
  out.sourceSummary = {
    generatedAt: isoOrNull(ss.generatedAt) || out.generatedAt,
    appVersion: (typeof ss.appVersion === "string" && ss.appVersion.trim()) ? ss.appVersion : (hasStructuredSource ? out.proposalVersion : null),
    proposalEngineVersion: (typeof ss.proposalEngineVersion === "string" && ss.proposalEngineVersion.trim()) ? ss.proposalEngineVersion : null,
    profileUsed: hasStructuredSource ? ss.profileUsed === true : false,
    onboardingUsed: hasStructuredSource ? ss.onboardingUsed === true : false,
    coachingPrefsUsed: hasStructuredSource ? ss.coachingPrefsUsed === true : false,
    currentProgramUsed: hasStructuredSource ? ss.currentProgramUsed === true : false,
    lifecycleUsed: hasStructuredSource ? ss.lifecycleUsed === true : false,
    recentLogsUsed: hasStructuredSource ? ss.recentLogsUsed === true : false,
    profileFields: Array.isArray(ss.profileFields) ? ss.profileFields.filter(function(v){ return typeof v === "string"; }) : [],
    onboardingSections: Array.isArray(ss.onboardingSections) ? ss.onboardingSections.filter(function(v){ return typeof v === "string"; }) : [],
    lifecycleSignals: Array.isArray(ss.lifecycleSignals) ? ss.lifecycleSignals.filter(function(v){ return typeof v === "string"; }) : [],
    sourceWarnings: Array.isArray(ss.sourceWarnings) ? ss.sourceWarnings.filter(function(w){ return typeof w === "string" && w.trim(); }) : (hasStructuredSource ? [] : ["Legacy proposal: detailed source coverage was not recorded."])
  };

  // 9.5.4C: application foundation fields — all optional; legacy proposals
  // missing them normalize safely to null (draft/dismissed never require them).
  out.applicationId = (typeof src.applicationId === "string" && src.applicationId.trim()) ? src.applicationId : null;
  out.applicationSummary = (src.applicationSummary && typeof src.applicationSummary === "object" && !Array.isArray(src.applicationSummary)) ? Object.assign({}, src.applicationSummary) : null;
  if(out.applicationSummary){
    // 9.5.4D additive fields default only in the normalized read model. Raw
    // validation below still rejects explicitly-present malformed values,
    // while accepted 9.5.4C applied records remain readable without a write.
    ["reorderedDayCount","modifiedExerciseCount","skippedReplaceCount","skippedAddCount","skippedRemoveCount","skippedReactivateCount"].forEach(function(f){
      if(out.applicationSummary[f] === undefined) out.applicationSummary[f] = 0;
    });
  }
  out.preApplySnapshot = (src.preApplySnapshot && typeof src.preApplySnapshot === "object" && !Array.isArray(src.preApplySnapshot)) ? Object.assign({}, src.preApplySnapshot) : null;
  if(out.preApplySnapshot){
    if(out.preApplySnapshot.orderOverrides === undefined) out.preApplySnapshot.orderOverrides = {};
    if(out.preApplySnapshot.overrides === undefined) out.preApplySnapshot.overrides = {};
  }
  out.undoSummary = (src.undoSummary && typeof src.undoSummary === "object" && !Array.isArray(src.undoSummary)) ? Object.assign({}, src.undoSummary) : null;

  const srcSummary = (src.summary && typeof src.summary === "object" && !Array.isArray(src.summary)) ? src.summary : {};
  const srcActionCounts = (srcSummary.actionCounts && typeof srcSummary.actionCounts === "object") ? srcSummary.actionCounts : {};
  const actionCounts = {};
  PROGRAM_PROPOSAL_DAY_ACTIONS.forEach(function(a){
    const n = Number(srcActionCounts[a]);
    actionCounts[a] = (isFinite(n) && n >= 0) ? Math.floor(n) : 0;
  });
  const freq = Number(srcSummary.recommendedFrequency);
  const dur = Number(srcSummary.estimatedSessionDurationMinutes);
  const affected = Number(srcSummary.affectedDayCount);

  // 9.5.4.2: requestedLiftingFrequency — integer 2–6 or null.
  const reqLiftFreq = Number(srcSummary.requestedLiftingFrequency);
  const requestedLiftingFrequency = (isFinite(reqLiftFreq) && reqLiftFreq >= 2 && reqLiftFreq <= 6) ? Math.floor(reqLiftFreq) : null;

  // 9.5.4.2: currentLiftingDayCounts — object keyed only by recognized gym
  // modes, each value a non-negative integer. Unrecognized keys are dropped.
  const recognizedGymKeys = p954GetRecognizedProposalGymKeys();
  const srcLiftingCounts = (srcSummary.currentLiftingDayCounts && typeof srcSummary.currentLiftingDayCounts === "object" && !Array.isArray(srcSummary.currentLiftingDayCounts)) ? srcSummary.currentLiftingDayCounts : {};
  const currentLiftingDayCounts = {};
  recognizedGymKeys.forEach(function(g){
    const n = Number(srcLiftingCounts[g]);
    if(isFinite(n) && n >= 0) currentLiftingDayCounts[g] = Math.floor(n);
  });

  out.summary = {
    recommendedFrequency: (isFinite(freq) && freq > 0) ? freq : null,
    gymModes: Array.isArray(srcSummary.gymModes) ? srcSummary.gymModes.filter(function(g){ return typeof g === "string"; }) : [],
    estimatedSessionDurationMinutes: (isFinite(dur) && dur > 0) ? dur : null,
    rationale: Array.isArray(srcSummary.rationale) ? srcSummary.rationale.filter(function(r){ return typeof r === "string"; }) : [],
    affectedDayCount: (isFinite(affected) && affected >= 0) ? Math.floor(affected) : 0,
    actionCounts: actionCounts,
    requestedLiftingFrequency: requestedLiftingFrequency,
    currentLiftingDayCounts: currentLiftingDayCounts
  };

  out.dayPlans = Array.isArray(src.dayPlans) ? src.dayPlans.filter(function(dp){
    return dp && typeof dp === "object" && typeof dp.gymKey === "string" && isFinite(Number(dp.dayIdx));
  }).map(function(dp){
    return {
      gymKey: dp.gymKey,
      dayIdx: Math.floor(Number(dp.dayIdx)),
      dayName: (typeof dp.dayName === "string") ? dp.dayName : ("Day " + (Math.floor(Number(dp.dayIdx)) + 1)),
      isVirtual: !!dp.isVirtual,
      // 9.5.4.2: role — one of PROGRAM_PROPOSAL_DAY_ROLES, falling back to
      // "optional" (the safe default) for older proposals saved before this
      // field existed or for any unrecognized value.
      role: PROGRAM_PROPOSAL_DAY_ROLES.indexOf(dp.role) !== -1 ? dp.role : "optional",
      action: PROGRAM_PROPOSAL_DAY_ACTIONS.indexOf(dp.action) !== -1 ? dp.action : "keep",
      tweaks: Array.isArray(dp.tweaks) ? dp.tweaks.filter(function(t){ return typeof t === "string"; }) : [],
      notes: (typeof dp.notes === "string") ? dp.notes : "",
      rationale: (typeof dp.rationale === "string") ? dp.rationale : ((typeof dp.notes === "string") ? dp.notes : ""),
      safetyTag: PROGRAM_PROPOSAL_SAFETY_TAGS.indexOf(dp.safetyTag) !== -1 ? dp.safetyTag : (dp.action === "keep" ? "unchanged" : (["replace","add","remove","optional_add"].indexOf(dp.action) !== -1 ? "deferred_lifecycle" : "safe_apply")),
      confidence: (typeof dp.confidence === "string" && dp.confidence.trim()) ? dp.confidence : (hasStructuredSource ? "medium" : "low"),
      // 9.5.4C: optional day-level metadata fields — supported by the
      // application engine for "modify"/"optional_add" actions. Absent on
      // every proposal produced by today's deterministic builder (which only
      // ever varies dayName), but preserved through normalization so a
      // hand-authored or future AI-authored proposal carrying them applies
      // correctly. Each is a string when present, otherwise omitted entirely
      // (not written as null) so "field not provided" and "field explicitly
      // cleared" stay distinguishable to callers that check `!== undefined`.
      proposedName: (typeof dp.proposedName === "string") ? dp.proposedName : undefined,
      focus: (typeof dp.focus === "string") ? dp.focus : undefined,
      note: (typeof dp.note === "string") ? dp.note : undefined,
      tag: (typeof dp.tag === "string") ? dp.tag : undefined,
      subtitle: (typeof dp.subtitle === "string") ? dp.subtitle : undefined,
      // Legacy proposals default to no structured exercise operations.
      proposedExerciseOrder: dp.proposedExerciseOrder === null ? null : (Array.isArray(dp.proposedExerciseOrder) ? dp.proposedExerciseOrder.slice() : null),
      exerciseActions: Array.isArray(dp.exerciseActions) ? dp.exerciseActions.map(function(ea){
        const fields = (ea && ea.fields && typeof ea.fields === "object" && !Array.isArray(ea.fields)) ? Object.keys(ea.fields).reduce(function(acc, key){ acc[key] = ea.fields[key]; return acc; }, {}) : {};
        return {
          exerciseId: ea && (typeof ea.exerciseId === "string" || ea.exerciseId === null) ? ea.exerciseId : null,
          action: ea && PROGRAM_PROPOSAL_EXERCISE_ACTIONS.indexOf(ea.action) !== -1 ? ea.action : "keep",
          fields: fields,
          rationale: ea && typeof ea.rationale === "string" ? ea.rationale : "",
          safetyTag: ea && PROGRAM_PROPOSAL_SAFETY_TAGS.indexOf(ea.safetyTag) !== -1 ? ea.safetyTag : (ea && ea.action === "modify" ? "safe_apply" : (ea && ea.action === "keep" ? "unchanged" : "deferred_lifecycle")),
          confidence: ea && typeof ea.confidence === "string" && ea.confidence.trim() ? ea.confidence : (hasStructuredSource ? "medium" : "low")
        };
      }) : []
    };
  }) : [];

  out.warnings = Array.isArray(src.warnings) ? src.warnings.filter(function(w){ return typeof w === "string"; }) : [];

  // Materialize the same dayPlans-derived view used by card/review/debug/export.
  // This repairs stale legacy/fixture summaries in memory without writing.
  out.summary.actionCounts = p955GetDerivedProposalActionCounts(out).counts;
  out.summary.affectedDayCount = out.dayPlans.length;

  return out;
}

// Safely reads + parses mf-onboarding-program-proposal. Never throws. Returns
// null if the key is absent or malformed (i.e. "no proposal exists"), or a
// normalized proposal object otherwise. Does not write storage.
function p954GetProposal(){
  try {
    const raw = localStorage.getItem(PROGRAM_PROPOSAL_KEY);
    if(raw === null) return null;
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch(e){
      console.warn("[MarcusFit] mf-onboarding-program-proposal is malformed JSON — treating as no proposal for this read.");
      return null;
    }
    return p954NormalizeProposal(parsed);
  } catch(e){
    console.warn("[MarcusFit] p954GetProposal failed, treating as no proposal:", e && e.message);
    return null;
  }
}

// Normalizes and safely writes the proposal to localStorage. proposalVersion
// always reflects the current APP_VERSION at save time.
function p954SaveProposal(proposal){
  try {
    const normalized = p954NormalizeProposal(proposal);
    normalized.proposalVersion = APP_VERSION;
    localStorage.setItem(PROGRAM_PROPOSAL_KEY, JSON.stringify(normalized));
    return { ok: true, proposal: normalized };
  } catch(e){
    console.warn("[MarcusFit] p954SaveProposal failed:", e && e.message);
    return { ok: false, error: (e && e.message) || "Unknown error" };
  }
}

// Removes the proposal entirely, returning to a "no proposal" state. Does
// not touch any other key.
function p954ClearProposal(){
  try {
    localStorage.removeItem(PROGRAM_PROPOSAL_KEY);
    return { ok: true };
  } catch(e){
    console.warn("[MarcusFit] p954ClearProposal failed:", e && e.message);
    return { ok: false, error: (e && e.message) || "Unknown error" };
  }
}

// Structural validation, independent of normalization (normalization always
// "succeeds" by coercing to safe defaults — this checks whether the proposal
// is actually coherent). Never throws.
function p954ValidateProgramProposal(proposal){
  const errors = [];
  const validationWarnings = [];
  try {
    if(!proposal || typeof proposal !== "object"){
      errors.push("Proposal is not an object.");
      return { valid: false, errors: errors };
    }
    if(proposal.schemaVersion !== PROGRAM_PROPOSAL_SCHEMA) errors.push("Unexpected schemaVersion: " + proposal.schemaVersion);
    if(PROGRAM_PROPOSAL_STATUSES.indexOf(proposal.status) === -1) errors.push("Invalid status: " + proposal.status);
    if(!proposal.summary || typeof proposal.summary !== "object") errors.push("Missing summary object.");
    if(proposal.sourceType !== undefined && PROGRAM_PROPOSAL_SOURCE_TYPES.indexOf(proposal.sourceType) === -1) errors.push("Invalid sourceType: " + proposal.sourceType);
    if(proposal.sourceSummary !== undefined){
      if(!proposal.sourceSummary || typeof proposal.sourceSummary !== "object" || Array.isArray(proposal.sourceSummary)){
        errors.push("sourceSummary is present but is not an object.");
      } else {
        ["profileUsed","onboardingUsed","coachingPrefsUsed","currentProgramUsed","lifecycleUsed","recentLogsUsed"].forEach(function(f){
          if(proposal.sourceSummary[f] !== undefined && typeof proposal.sourceSummary[f] !== "boolean") validationWarnings.push("sourceSummary."+f+" should be boolean; normalized read treats it as false.");
        });
        if(proposal.sourceSummary.generatedAt !== undefined && proposal.sourceSummary.generatedAt !== null && (typeof proposal.sourceSummary.generatedAt !== "string" || isNaN(Date.parse(proposal.sourceSummary.generatedAt)))) validationWarnings.push("sourceSummary.generatedAt is malformed; normalized read uses proposal.generatedAt.");
        if(proposal.sourceSummary.sourceWarnings !== undefined && !Array.isArray(proposal.sourceSummary.sourceWarnings)) validationWarnings.push("sourceSummary.sourceWarnings should be an array; normalized read uses an empty list.");
      }
    } else {
      validationWarnings.push("Legacy proposal has no structured sourceSummary.");
    }
    if(!Array.isArray(proposal.dayPlans)) errors.push("dayPlans is not an array.");
    else {
      const recognizedGymKeys = p954GetRecognizedProposalGymKeys();
      const seenGymDayKeys = {};
      proposal.dayPlans.forEach(function(dp, i){
        if(!dp || typeof dp !== "object"){ errors.push("dayPlans[" + i + "] is not an object."); return; }
        if(recognizedGymKeys.indexOf(dp.gymKey) === -1) errors.push("dayPlans[" + i + "] has unrecognized gymKey: " + dp.gymKey);
        // 9.5.4B.2: dayIdx must be an actual integer number — not a numeric
        // string ("2"), not a fractional value (1.5), and not anything else
        // merely coercible via Number(...). isFinite(dp.dayIdx) alone would
        // accept all of those, since isFinite() coerces its argument.
        const dayIdxValid = (typeof dp.dayIdx === "number") && Number.isInteger(dp.dayIdx) && dp.dayIdx >= 0;
        if(!dayIdxValid) errors.push("dayPlans[" + i + "] has invalid dayIdx: " + JSON.stringify(dp.dayIdx));
        if(PROGRAM_PROPOSAL_DAY_ACTIONS.indexOf(dp.action) === -1) errors.push("dayPlans[" + i + "] has invalid action: " + dp.action);
        // 9.5.4.2 / 9.5.4B.1: role must be one of the recognized day-plan
        // roles. This function is now also used to validate the RAW stored
        // structure before normalization (see p954InspectStoredProposal), so
        // a missing role (undefined) — expected from proposals saved before
        // 9.5.4.2 — is treated as a legacy omission, not corruption; it will
        // safely normalize to "optional". An explicit-but-unrecognized role
        // is still reported as a genuine error either way.
        if(dp.role !== undefined && PROGRAM_PROPOSAL_DAY_ROLES.indexOf(dp.role) === -1) errors.push("dayPlans[" + i + "] has invalid role: " + dp.role);
        if(dp.safetyTag !== undefined && PROGRAM_PROPOSAL_SAFETY_TAGS.indexOf(dp.safetyTag) === -1) validationWarnings.push("dayPlans[" + i + "] has an unrecognized safetyTag; normalized read derives a safe label.");

        // 9.5.4D raw structured-exercise validation. Existence/day membership is live-state validation.
        const location = "Gym " + String(dp.gymKey) + ", day " + String(dp.dayIdx);
        if(dp.proposedExerciseOrder !== undefined && dp.proposedExerciseOrder !== null){
          if(!Array.isArray(dp.proposedExerciseOrder)) errors.push(location + ": proposedExerciseOrder must be null or an array.");
          else {
            const orderSeen = {};
            dp.proposedExerciseOrder.forEach(function(id, oi){
              if(typeof id !== "string" || !id.trim()) errors.push(location + ": proposedExerciseOrder[" + oi + "] must be a non-empty exercise ID string.");
              else if(orderSeen[id]) errors.push(location + ": proposedExerciseOrder contains duplicate exercise ID " + id + ".");
              else orderSeen[id] = true;
            });
          }
        }
        if(dp.exerciseActions !== undefined && !Array.isArray(dp.exerciseActions)) errors.push(location + ": exerciseActions must be an array.");
        if(Array.isArray(dp.exerciseActions)){
          const targeted = {};
          dp.exerciseActions.forEach(function(ea, ai){
            const prefix = location + ", exercise action " + ai;
            if(!ea || typeof ea !== "object" || Array.isArray(ea) || Object.getPrototypeOf(ea) !== Object.prototype){ errors.push(prefix + ": action must be a plain object."); return; }
            if(PROGRAM_PROPOSAL_EXERCISE_ACTIONS.indexOf(ea.action) === -1) errors.push(prefix + ": unrecognized action " + JSON.stringify(ea.action) + ".");
            if(ea.safetyTag !== undefined && PROGRAM_PROPOSAL_SAFETY_TAGS.indexOf(ea.safetyTag) === -1) validationWarnings.push(prefix + ": unrecognized safetyTag; normalized read derives a safe label.");
            const requiresId = ["keep","modify","replace","remove","reactivate"].indexOf(ea.action) !== -1;
            if(requiresId && (typeof ea.exerciseId !== "string" || !ea.exerciseId.trim())) errors.push(prefix + ": exerciseId is required.");
            if(ea.action === "add" && ea.exerciseId !== undefined && ea.exerciseId !== null && (typeof ea.exerciseId !== "string" || !ea.exerciseId.trim())) errors.push(prefix + ": add exerciseId must be null, omitted, or a non-empty string.");
            const id = typeof ea.exerciseId === "string" ? ea.exerciseId : null;
            if(id && targeted[id]) errors.push(prefix + ", exercise " + id + ": conflicts with another action targeting this exercise.");
            if(id) targeted[id] = ea.action;
            if(ea.action === "modify"){
              const f = ea.fields;
              if(!f || typeof f !== "object" || Array.isArray(f) || Object.getPrototypeOf(f) !== Object.prototype || !Object.keys(f).length){ errors.push(prefix + (id ? ", exercise " + id : "") + ": modify fields must be a non-empty plain object."); return; }
              Object.keys(f).forEach(function(field){
                const fp = prefix + (id ? ", exercise " + id : "") + ", field " + field;
                if(PROGRAM_PROPOSAL_EXERCISE_MODIFY_FIELDS.indexOf(field) === -1){ errors.push(fp + ": field is not allowed."); return; }
                const v = f[field];
                if(field === "name" && (typeof v !== "string" || !v.trim())) errors.push(fp + ": name must be a non-empty string.");
                else if(field === "sets" && (!Number.isInteger(v) || v <= 0)) errors.push(fp + ": sets must be a positive integer.");
                else if(field === "reps" && !((typeof v === "string" && v.trim()) || (typeof v === "number" && isFinite(v) && v > 0))) errors.push(fp + ": reps must be a non-empty string or positive finite number.");
                else if((field === "load" || field === "rir") && !((typeof v === "string" && v.trim()) || (typeof v === "number" && isFinite(v)))) errors.push(fp + ": value must be a non-empty string or finite number.");
                else if(field === "blurb" && typeof v !== "string") errors.push(fp + ": blurb must be a string.");
              });
            }
          });
        }
        // 9.5.4.2: reject duplicate gymKey/dayIdx combinations — this catches
        // accidental collisions between an existing day and a proposed
        // optional_add (or any other duplicate day-plan entry). Only build
        // the key from a dayIdx that actually passed strict validation above
        // — an invalid dayIdx is already reported by the check above and
        // must not also be silently coerced into a duplicate-key comparison.
        if(typeof dp.gymKey === "string" && dayIdxValid){
          const key = dp.gymKey + "|" + dp.dayIdx;
          if(seenGymDayKeys[key]) errors.push("dayPlans[" + i + "] duplicates gymKey/dayIdx already used at another entry: " + key);
          else seenGymDayKeys[key] = true;
        }
      });
    }
    if(!Array.isArray(proposal.warnings)) errors.push("warnings is not an array.");

    // 9.5.4C: explicit application-field validation. Legacy proposals that
    // simply omit these fields are NOT penalized — draft/dismissed proposals
    // never require them. Only status "applied" requires them, since that's
    // the only state where they carry real meaning.
    if(proposal.appliedAt !== undefined && proposal.appliedAt !== null){
      if(typeof proposal.appliedAt !== "string" || isNaN(Date.parse(proposal.appliedAt))) errors.push("appliedAt is present but not a valid ISO-like string: " + JSON.stringify(proposal.appliedAt));
    }
    if(proposal.applicationId !== undefined && proposal.applicationId !== null){
      if(typeof proposal.applicationId !== "string" || !proposal.applicationId.trim()) errors.push("applicationId is present but not a non-empty string.");
    }
    if(proposal.applicationSummary !== undefined && proposal.applicationSummary !== null){
      if(typeof proposal.applicationSummary !== "object" || Array.isArray(proposal.applicationSummary)) errors.push("applicationSummary is present but not an object.");
    }
    if(proposal.preApplySnapshot !== undefined && proposal.preApplySnapshot !== null){
      if(typeof proposal.preApplySnapshot !== "object" || Array.isArray(proposal.preApplySnapshot)) errors.push("preApplySnapshot is present but not an object.");
    }
    if(proposal.undoneAt !== undefined && proposal.undoneAt !== null){
      if(typeof proposal.undoneAt !== "string" || isNaN(Date.parse(proposal.undoneAt))) errors.push("undoneAt is present but not a valid ISO-like string: " + JSON.stringify(proposal.undoneAt));
    }
    if(proposal.undoSummary !== undefined && proposal.undoSummary !== null){
      if(typeof proposal.undoSummary !== "object" || Array.isArray(proposal.undoSummary)) errors.push("undoSummary is present but not an object.");
    }
    if(proposal.status === "applied" || proposal.status === "undone"){
      if(!proposal.appliedAt || typeof proposal.appliedAt !== "string" || isNaN(Date.parse(proposal.appliedAt))) errors.push("status is 'applied' but appliedAt is missing/invalid.");
      if(!proposal.applicationId || typeof proposal.applicationId !== "string" || !proposal.applicationId.trim()) errors.push("status is 'applied' but applicationId is missing/invalid.");
      if(!proposal.applicationSummary || typeof proposal.applicationSummary !== "object" || Array.isArray(proposal.applicationSummary)) errors.push("status is 'applied' but applicationSummary is missing/invalid.");
      else {
        // Missing D-only counters are valid for accepted 9.5.4C applied
        // proposals. If present, each remains strictly validated.
        ["reorderedDayCount","modifiedExerciseCount","skippedReplaceCount","skippedAddCount","skippedRemoveCount","skippedReactivateCount"].forEach(function(f){
          if(proposal.applicationSummary[f] !== undefined && (!Number.isInteger(proposal.applicationSummary[f]) || proposal.applicationSummary[f] < 0)) errors.push("status is 'applied' but applicationSummary."+f+" is invalid.");
        });
      }
      if(!proposal.preApplySnapshot || typeof proposal.preApplySnapshot !== "object" || Array.isArray(proposal.preApplySnapshot)) errors.push("status is 'applied' but preApplySnapshot is missing/invalid.");
      else {
        // Original C snapshot members remain required. D-only snapshot
        // members may be absent on legacy records, but malformed present
        // values are rejected rather than normalized into valid operations.
        ["dayOverrides","dayAdditions","disabledDays","proposal"].forEach(function(f){ if(!Object.prototype.hasOwnProperty.call(proposal.preApplySnapshot,f)) errors.push("status is 'applied' but preApplySnapshot."+f+" is missing."); });
        ["orderOverrides","overrides"].forEach(function(f){
          if(proposal.preApplySnapshot[f] !== undefined && (!proposal.preApplySnapshot[f] || typeof proposal.preApplySnapshot[f] !== "object" || Array.isArray(proposal.preApplySnapshot[f]))) errors.push("status is 'applied' but preApplySnapshot."+f+" is invalid.");
        });
      }
    }
    if(proposal.status === "undone"){
      if(!proposal.undoneAt || typeof proposal.undoneAt !== "string" || isNaN(Date.parse(proposal.undoneAt))) errors.push("status is 'undone' but undoneAt is missing/invalid.");
      if(!proposal.undoSummary || typeof proposal.undoSummary !== "object" || Array.isArray(proposal.undoSummary)) errors.push("status is 'undone' but undoSummary is missing/invalid.");
      else {
        if(proposal.undoSummary.status !== "success") errors.push("status is 'undone' but undoSummary.status is not 'success'.");
        if(proposal.undoSummary.applicationId !== proposal.applicationId) errors.push("status is 'undone' but undoSummary.applicationId does not match applicationId.");
        if(proposal.undoSummary.exactRawRestorationVerified !== true) errors.push("status is 'undone' but exact raw restoration is not verified.");
        if(!Array.isArray(proposal.undoSummary.storageResults)) errors.push("status is 'undone' but undoSummary.storageResults is invalid.");
        if(!proposal.undoSummary.validationFacts || typeof proposal.undoSummary.validationFacts !== "object" || Array.isArray(proposal.undoSummary.validationFacts)) errors.push("status is 'undone' but undoSummary.validationFacts is invalid.");
        if(proposal.undoSummary.exactAffectedStateRestorationVerified !== undefined && typeof proposal.undoSummary.exactAffectedStateRestorationVerified !== "boolean") errors.push("status is 'undone' but affected-path verification is invalid.");
        if(proposal.undoSummary.unrelatedStatePreserved !== undefined && typeof proposal.undoSummary.unrelatedStatePreserved !== "boolean") errors.push("status is 'undone' but unrelated-state preservation is invalid.");
        if(!proposal.undoSummary.deferredActionCounts || typeof proposal.undoSummary.deferredActionCounts !== "object" || Array.isArray(proposal.undoSummary.deferredActionCounts)) errors.push("status is 'undone' but undoSummary.deferredActionCounts is invalid.");
      }
    }
  } catch(e){
    errors.push("Validation failed safely: " + (e && e.message));
  }
  return { valid: errors.length === 0, errors: errors, warnings: validationWarnings };
}

// ── 9.5.4B.1: read-only raw storage inspection ───────────────────────────────
// Unlike p954GetProposal() (which normalizes before returning, silently
// repairing invalid stored fields), this reads mf-onboarding-program-proposal
// as-is and validates the ORIGINAL parsed structure before any repair, so a
// genuinely invalid or malformed stored proposal can be reliably identified.
// Never writes/modifies localStorage. Never throws.
//
// Returns:
//   {
//     exists: boolean,            // key present in localStorage
//     parses: boolean,            // stored text is valid JSON (false if absent too)
//     rawText: string|null,       // exact stored text, or null if absent
//     parsed: object|null,        // JSON.parse() of rawText, or null if absent/malformed
//     normalized: object|null,    // p954NormalizeProposal(parsed) read model, or null if absent/malformed
//     validation: {valid, errors},// p954ValidateProgramProposal() run on the RAW parsed object
//     storageError: string|null   // set only if localStorage itself could not be read
//   }
function p954InspectStoredProposal(){
  const result = {
    exists: false,
    parses: false,
    rawText: null,
    parsed: null,
    normalized: null,
    validation: { valid: false, errors: [] },
    storageError: null
  };
  try {
    let raw;
    try {
      raw = localStorage.getItem(PROGRAM_PROPOSAL_KEY);
    } catch(e){
      result.storageError = (e && e.message) || "Unknown storage error";
      result.validation = { valid: false, errors: ["Unable to read stored proposal: " + result.storageError] };
      return result;
    }

    if(raw === null){
      // Absent key: exists/parses false, parsed/normalized null — matches
      // p954GetProposal()'s "no proposal" case exactly.
      result.validation = { valid: false, errors: ["No proposal saved."] };
      return result;
    }

    result.exists = true;
    result.rawText = raw;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch(e){
      // Malformed JSON: exists true, parses false, rawText preserved,
      // parsed/normalized stay null. A clear validation error is returned
      // rather than silently treating this as "no proposal".
      result.parses = false;
      result.validation = { valid: false, errors: ["Stored proposal is not valid JSON: " + ((e && e.message) || "parse error")] };
      return result;
    }

    result.parses = true;
    result.parsed = parsed;

    // Validate the ORIGINAL parsed structure before normalization — this is
    // what actually catches explicit invalid status/action/role values,
    // invalid/negative dayIdx, invalid gymKey, duplicate gymKey/dayIdx, and
    // non-array dayPlans, none of which normalization would preserve.
    result.validation = p954ValidateProgramProposal(parsed);

    // Also produce the normalized read model separately, purely for display
    // purposes when the raw proposal is valid — this never affects the
    // validation verdict above and never writes storage.
    try {
      result.normalized = p954NormalizeProposal(parsed);
    } catch(e){
      result.normalized = null;
    }

    return result;
  } catch(e){
    result.storageError = (e && e.message) || "Unknown error";
    result.validation = { valid: false, errors: ["Inspection failed safely: " + result.storageError] };
    return result;
  }
}

// ── Deterministic in-memory builder ──────────────────────────────────────────
// Pure function: reads nothing from localStorage itself — everything it needs
// comes in as arguments. Same inputs always produce the same output (aside
// from timestamps, which callers set separately). Never mutates its inputs.
//
//   onboardingState — result of p951GetOnboardingState()
//   profile         — result of p950GetUserProfile()
//   currentProgram  — { home: getResolvedDays("home"), partial: getResolvedDays("partial") }
//                      i.e. already fully resolved (overrides, custom
//                      exercises, archived-exclusion, order overrides, and
//                      virtual/additive days all baked in by getResolvedDays()).
//
// Kept intentionally conservative: it only proposes an "optional_add" day
// when the requested weekly frequency exceeds the current base day count,
// only flags existing base days as "remove" candidates (descriptive only —
// nothing is ever actually removed) when there are clearly more base days
// than requested, and only flags a day as "modify" when it detects a real
// same-day duplicate active exercise name. Everything else is "keep".
// ── 9.5.4.1: day-role classifier ─────────────────────────────────────────────
// Conservative, deterministic classifier used ONLY by the proposal builder to
// separate actual lifting days from cardio/recovery/optional days so weekly
// lifting-frequency answers are compared against the right denominator.
// Reads only trusted current day metadata (name/tag/focus/exercises/virtual
// status) — never mutates the day, never touches storage.
//   Returns one of: "lifting", "cardio", "recovery", "optional".
function p954ClassifyProposalDay(day){
  try {
    if(!day || typeof day !== "object") return "optional";
    const tag = ((day.tag) || "").toUpperCase();
    const nm = ((day.name || day.day || "") + "").toLowerCase();
    const focus = ((day.focus) || "").toLowerCase();
    const haystack = nm + " " + focus + " " + tag.toLowerCase();

    // Cardio/recovery/mobility signals always win — these never count as lifting.
    const cardioKeywordRe = /\bcardio\b|\bzone\s*2\b|\bwalk\b|\brun\b|\bbike\b|\bcycl(e|ing)\b/;
    const recoveryOnlyRe = /\brecovery\b|\bmobility\b/;
    if(tag === "CARDIO" || cardioKeywordRe.test(haystack)) return "cardio";
    if(recoveryOnlyRe.test(haystack)) return "recovery";

    // Known lifting tags/keywords.
    const liftingTagSet = { PUSH:1, PULL:1, LOWER:1, ARMS:1, PUMP:1 };
    const liftingKeywordRe = /\bpush\b|\bpull\b|\blower\b|\blegs?\b|\bchest\b|\bback\b|\bshoulders?\b|\barms?\b|\bpump\b|full\s*body|\bstrength\b|hypertrophy|resistance/;

    if(liftingTagSet[tag] || liftingKeywordRe.test(haystack)){
      // Guard: if every exercise on an otherwise lifting-looking day is a
      // cardio-duration entry (reps expressed as minutes, no working sets),
      // do not count it as lifting.
      const exercises = Array.isArray(day.exercises) ? day.exercises : [];
      if(exercises.length){
        const durationRe = /\bmin(ute)?s?\b/i;
        const allDurationBased = exercises.every(function(ex){
          const reps = (ex && ex.reps != null) ? String(ex.reps) : "";
          return durationRe.test(reps);
        });
        if(allDurationBased) return "cardio";
      }
      return "lifting";
    }

    // No clear lifting/cardio/recovery signal. Existing virtual/added days
    // default to "optional" unless their exercises are clearly lifting-style
    // (working sets/reps rather than a duration).
    const exercises2 = Array.isArray(day.exercises) ? day.exercises : [];
    if(exercises2.length){
      const durationRe2 = /\bmin(ute)?s?\b/i;
      const hasWorkingSet = exercises2.some(function(ex){
        const reps = (ex && ex.reps != null) ? String(ex.reps) : "";
        return !!reps && !durationRe2.test(reps);
      });
      if(hasWorkingSet) return "lifting";
    }
    return "optional";
  } catch(e){
    return "optional";
  }
}

// ── 9.5.4.1: conservative removal-priority ranking for lifting days ─────────
// Lower number = safer/more preferred removal candidate. Returns null when
// the day is not a lifting day at all (cardio/recovery/optional days are
// never proposed for removal to satisfy a lifting-frequency reduction).
//   0 = optional/virtual lifting day
//   1 = specialization/pump day
//   2 = dedicated arms day
//   3 = other accessory-focused lifting day
//   4 = foundational push/pull/lower/legs day (avoid unless nothing else)
function p954GetProposalDayRemovalPriority(day, role){
  if(role !== "lifting") return null;
  if(!day) return 3;
  const tag = ((day.tag) || "").toUpperCase();
  const nm = ((day.name || day.day || "") + "").toLowerCase();
  if(day._isVirtual) return 0;
  // Check explicit tags before falling back to name-text keywords, so a day
  // like "ARMS — STRENGTH & PUMP" (tag ARMS) isn't mis-ranked as a pump day
  // just because the word "pump" also appears in its display name.
  if(tag === "PUMP") return 1;
  if(tag === "ARMS") return 2;
  if(/\bpump\b|\btaper\b/.test(nm)) return 1;
  if(/\barms?\b/.test(nm)) return 2;
  const foundationalRe = /\bpush\b|\bpull\b|\blower\b|\blegs?\b/;
  if(["PUSH","PULL","LOWER"].indexOf(tag) !== -1 || foundationalRe.test(nm)) return 4;
  return 3;
}

function p955BuildProposalSourceContext(onboardingState, profile, currentProgram){
  const draft = onboardingState && onboardingState.draft && typeof onboardingState.draft === "object" ? onboardingState.draft : {};
  const prefs = (function(){ try { return p9GetCoachPrefs().trim(); } catch(e){ return ""; } })();
  const sourceWarnings = [];
  const profileStored = (function(){ try { return localStorage.getItem(USER_PROFILE_KEY) !== null; } catch(e){ return false; } })();
  const onboardingStored = (function(){ try { return localStorage.getItem(ONBOARDING_KEY) !== null; } catch(e){ return false; } })();
  const profileFields = [];
  if(profileStored && profile){
    if(profile.identity && profile.identity.displayName) profileFields.push("displayName");
    if(profile.goals && profile.goals.primaryGoal) profileFields.push("primaryGoal");
    if(profile.goals && profile.goals.physiqueOutcome) profileFields.push("physiqueOutcome");
    if(profile.app && profile.app.homeGymLabel) profileFields.push("homeGymLabel");
    if(profile.app && profile.app.partialGymLabel) profileFields.push("partialGymLabel");
  }
  const onboardingSections = ["profile","goals","training"].filter(function(k){ return draft[k] && typeof draft[k] === "object" && Object.keys(draft[k]).length; });
  const programUsed = Object.keys(currentProgram || {}).some(function(g){ return Array.isArray(currentProgram[g]) && currentProgram[g].length; });
  const lifecycleSignals = [];
  try {
    const lc = getLifecycle(), ov = getOvr();
    if(Object.keys(lc.orderOverrides || {}).length) lifecycleSignals.push("orderOverrides");
    if(Object.keys(lc.dayOverrides || {}).some(function(g){ return Object.keys(lc.dayOverrides[g] || {}).length; })) lifecycleSignals.push("dayOverrides");
    if(Object.keys(lc.dayAdditions || {}).some(function(g){ return Object.keys(lc.dayAdditions[g] || {}).length; })) lifecycleSignals.push("dayAdditions");
    if(Object.keys(lc.disabledDays || {}).some(function(g){ return Object.keys(lc.disabledDays[g] || {}).length; })) lifecycleSignals.push("disabledDays");
    if(Object.keys(lc.inactiveIds || {}).length) lifecycleSignals.push("inactiveExercises");
    if(Object.keys(lc.customExercises || {}).length) lifecycleSignals.push("customExercises");
    if(Object.keys(ov || {}).length) lifecycleSignals.push("exerciseOverrides");
  } catch(e){
    sourceWarnings.push("Lifecycle and exercise override state was unavailable.");
  }
  if(!profileFields.length) sourceWarnings.push("Saved user profile was unavailable or empty.");
  if(!onboardingStored || !onboardingSections.length) sourceWarnings.push("Saved onboarding answers were unavailable or empty.");
  if(!prefs) sourceWarnings.push("Persistent AI coaching preferences were unavailable or empty.");
  if(!programUsed) sourceWarnings.push("Current resolved program was unavailable or empty.");
  if(!lifecycleSignals.length) sourceWarnings.push("No lifecycle/order/exercise override customizations were present.");
  sourceWarnings.push("Recent workout logs were intentionally not used by this deterministic rule set.");
  return {
    coachingPrefs: prefs,
    sourceSummary: {
      generatedAt: null,
      appVersion: APP_VERSION,
      proposalEngineVersion: PROGRAM_PROPOSAL_ENGINE_VERSION,
      profileUsed: profileFields.length > 0,
      onboardingUsed: onboardingStored && onboardingSections.length > 0,
      coachingPrefsUsed: !!prefs,
      currentProgramUsed: programUsed,
      lifecycleUsed: lifecycleSignals.length > 0,
      recentLogsUsed: false,
      profileFields: profileFields,
      onboardingSections: onboardingSections,
      lifecycleSignals: lifecycleSignals,
      sourceWarnings: sourceWarnings
    }
  };
}

function p954BuildProgramProposal(onboardingState, profile, currentProgram, sourceContext){
  const draft = (onboardingState && onboardingState.draft && typeof onboardingState.draft === "object") ? onboardingState.draft : {};
  const goals = (draft.goals && typeof draft.goals === "object") ? draft.goals : {};
  const training = (draft.training && typeof draft.training === "object") ? draft.training : {};
  const hasOnboardingAnswers = !!(draft.goals || draft.training || draft.profile);

  const warnings = [];
  const rationale = [];
  const context = sourceContext || p955BuildProposalSourceContext(onboardingState, profile, currentProgram);
  const coachingPrefs = typeof context.coachingPrefs === "string" ? context.coachingPrefs : "";
  const sourceSummary = context.sourceSummary || p955BuildProposalSourceContext(onboardingState, profile, currentProgram).sourceSummary;
  const profileName = profile && profile.identity && profile.identity.displayName ? profile.identity.displayName : "";
  const profileGoal = goals.primaryGoal || (profile && profile.goals && profile.goals.primaryGoal) || "";
  const physiqueOutcome = goals.physiqueOutcome || (profile && profile.goals && profile.goals.physiqueOutcome) || "";
  const gymLabels = profile && profile.app ? { home:profile.app.homeGymLabel, partial:profile.app.partialGymLabel } : {};

  // ── Determine target gym mode(s) ────────────────────────────────────────
  const availableGyms = Object.keys(currentProgram || {}).filter(function(g){ return Array.isArray(currentProgram[g]); });
  let gymModes;
  if(training.locations === "home") gymModes = ["home"];
  else if(training.locations === "gym") gymModes = ["partial"];
  else if(training.locations === "both") gymModes = ["home","partial"];
  else gymModes = availableGyms.slice(); // no usable answer — describe against every resolvable gym mode
  gymModes = gymModes.filter(function(g){ return availableGyms.indexOf(g) !== -1 });
  if(!gymModes.length){
    warnings.push("No resolved program data available for any gym mode — proposal has no day plans.");
  }

  // ── Determine recommended weekly frequency ──────────────────────────────
  let recommendedFrequency = null;
  if(isFinite(training.liftingDays) && training.liftingDays >= 2 && training.liftingDays <= 6){
    recommendedFrequency = Math.floor(training.liftingDays);
  }

  // ── Determine experience label (affects duration estimate + rationale) ──
  const experience = ["beginner","intermediate","advanced"].indexOf(goals.trainingExperience) !== -1 ? goals.trainingExperience : null;

  if(!hasOnboardingAnswers){
    warnings.push("No completed onboarding answers found — proposal derived from saved profile and current program only.");
  }
  if(profileName) rationale.push("Built for " + profileName + " from the saved MarcusFit profile.");
  if(goals.primaryGoal) rationale.push("Primary goal on file: \"" + goals.primaryGoal + "\".");
  else if(profileGoal) rationale.push("Primary goal on file (from profile): \"" + profileGoal + "\".");
  if(physiqueOutcome) rationale.push("Physique outcome on file: \"" + physiqueOutcome + "\".");
  if(coachingPrefs) rationale.push("Persistent AI coaching preferences informed local priority and metadata rules; no external AI or API was called.");
  if(experience) rationale.push("Training experience: " + experience + ".");
  if(goals.currentFocus) rationale.push("Current focus: " + String(goals.currentFocus).replace(/_/g," ") + ".");
  if(training.cardioPreference) rationale.push("Cardio preference: " + String(training.cardioPreference).replace(/_/g," ") + ".");
  if(training.equipmentNotes) rationale.push("Equipment notes on file — not applied to individual exercises in this foundation release.");
  if(training.limitations){
    rationale.push("Limitations/constraints on file — reviewed conservatively, not auto-applied to any exercise.");
    warnings.push("User-noted limitations/constraints exist — review the full onboarding answers before making any real program change.");
  }
  if(recommendedFrequency){
    rationale.push("Requested lifting frequency: " + recommendedFrequency + " day(s) per week.");
  } else {
    rationale.push("No specific lifting-frequency answer on file — using each gym mode's current lifting-day count as the target.");
  }

  // ── Build per-gym day plans ──────────────────────────────────────────────
  // 9.5.4.1: liftingDays requested by onboarding is a count of actual lifting
  // days — it must be compared against the current LIFTING-day count for each
  // gym mode, not the total displayed day count (which also includes cardio/
  // recovery/optional days). Cardio/recovery days are always preserved.
  const dayPlans = [];
  const actionCounts = { keep:0, modify:0, reorder:0, replace:0, add:0, remove:0, optional_add:0 };
  const currentLiftingDayCounts = {}; // REQUIREMENT 7: read-only debug visibility, by gym mode

  gymModes.forEach(function(gymKey){
    const days = currentProgram[gymKey] || [];
    const baseLen = (typeof P !== "undefined" && Array.isArray(P[gymKey])) ? P[gymKey].length : days.filter(function(d){ return !d._isVirtual; }).length;

    // Classify every day up front so the same classification is used both for
    // rendering the day plan and for the target-frequency math below.
    const classifiedDays = days.map(function(d){ return { day: d, role: p954ClassifyProposalDay(d) }; });
    const currentLiftingCount = classifiedDays.filter(function(cd){ return cd.role === "lifting"; }).length;
    const cardioRecoveryCount = classifiedDays.filter(function(cd){ return cd.role === "cardio" || cd.role === "recovery"; }).length;
    currentLiftingDayCounts[gymKey] = currentLiftingCount;

    // Target is the requested lifting frequency when available; otherwise the
    // gym mode's own current lifting-day count (never the raw total day count).
    const targetFreq = recommendedFrequency || currentLiftingCount || baseLen;

    rationale.push(
      (gymLabels[gymKey] || gymKey) + ": " + currentLiftingCount + " current lifting day(s), target " + targetFreq + "/week lifting"
      + (cardioRecoveryCount ? ("; " + cardioRecoveryCount + " cardio/recovery day(s) preserved outside that count.") : ".")
    );

    classifiedDays.forEach(function(cd){
      const day = cd.day;
      const exercises = Array.isArray(day.exercises) ? day.exercises : [];
      const seen = {};
      const dupeNames = [];
      exercises.forEach(function(ex){
        const key = (ex && typeof ex.name === "string") ? ex.name.trim().toLowerCase() : "";
        if(!key) return;
        if(seen[key]) { if(dupeNames.indexOf(ex.name) === -1) dupeNames.push(ex.name); }
        else seen[key] = true;
      });

      const dayIdx = isFinite(day._dayIdx) ? day._dayIdx : dayPlans.length;
      const roleNote = (cd.role === "cardio") ? "Cardio day — preserved outside the requested lifting frequency."
        : (cd.role === "recovery") ? "Recovery/mobility day — preserved outside the requested lifting frequency."
        : "";
      const plan = {
        gymKey: gymKey,
        dayIdx: dayIdx,
        dayName: day.name || day.day || ("Day " + (dayIdx + 1)),
        isVirtual: !!day._isVirtual,
        role: cd.role,
        action: dupeNames.length ? "modify" : "keep",
        tweaks: dupeNames.map(function(n){ return "Remove duplicate active exercise \"" + n + "\" (keep the first occurrence)."; }),
        notes: dupeNames.length ? "Duplicate active exercise name(s) detected on this day." : roleNote,
        rationale: dupeNames.length
          ? "Metadata-only cleanup keeps the first stable exercise ID and avoids rewriting history."
          : (roleNote || "Current resolved day is retained because no source-backed safe change was identified."),
        safetyTag: dupeNames.length ? "safe_apply" : "unchanged",
        confidence: dupeNames.length ? "high" : "medium",
        proposedExerciseOrder: null,
        exerciseActions: []
      };
      const priorityText = (physiqueOutcome + " " + coachingPrefs).toLowerCase();
      const priorityTerms = [
        { re:/shoulder|delt/, ex:/shoulder|lateral|delt/ },
        { re:/\bchest\b|pec/, ex:/chest|bench|fly|push-up/ },
        { re:/\bback\b|lat/, ex:/row|pulldown|pull-up|lat/ },
        { re:/\barms?\b|biceps?|triceps?/, ex:/curl|tricep|extension|skull/ },
        { re:/glute|legs?|quad|hamstring/, ex:/squat|lunge|deadlift|leg|hip|glute|hamstring/ }
      ];
      const priority = priorityTerms.find(function(x){ return x.re.test(priorityText); });
      if(cd.role === "lifting" && priority && exercises.length > 1){
        const matchIdx = exercises.findIndex(function(ex){ return priority.ex.test(String(ex && ex.name || "").toLowerCase()); });
        if(matchIdx > 0){
          const ids = exercises.map(function(ex){ return ex.id; });
          const moved = ids.splice(matchIdx, 1)[0];
          ids.unshift(moved);
          plan.proposedExerciseOrder = ids;
          plan.rationale = "Moves source-matched weak-point work earlier while preserving every stable exercise ID and same-day membership.";
          plan.safetyTag = "safe_apply";
          plan.confidence = "medium";
        }
      }
      if(cd.role === "lifting" && physiqueOutcome && !(day.focus && String(day.focus).trim())){
        plan.action = "modify";
        plan.focus = "Supports " + String(physiqueOutcome).slice(0, 120);
        plan.rationale = "Adds day-level focus metadata aligned with the saved physique outcome; the base day, exercises, stable IDs, and history remain unchanged.";
        plan.safetyTag = "safe_apply";
        plan.confidence = "medium";
      }
      if(cd.role === "lifting" && /\brir\b|reps?\s+in\s+reserve/i.test(coachingPrefs)){
        const missingRir = exercises.find(function(ex){ return ex && ex.id && (ex.rir === undefined || ex.rir === null || ex.rir === ""); });
        if(missingRir){
          plan.exerciseActions.push({
            exerciseId: missingRir.id,
            action: "modify",
            fields: { rir: "2" },
            rationale: "Adds a conservative RIR target because saved coaching preferences explicitly reference RIR; stable ID and exercise history are preserved.",
            safetyTag: "safe_apply",
            confidence: "medium"
          });
        }
      }
      if(dupeNames.length){
        warnings.push(gymKey + " " + plan.dayName + ": duplicate active exercise name(s) detected — " + dupeNames.join(", ") + ".");
      }
      dayPlans.push(plan);
    });

    const delta = targetFreq - currentLiftingCount;
    if(delta > 0){
      // REQUIREMENT 4: only add the number of optional LIFTING day proposals
      // needed to reach the requested lifting frequency — never based on the
      // raw total day count.
      // 9.5.4.2: guard against dayIdx collisions. A customized program can
      // already have virtual days at or above baseLen, so "baseLen + i" can
      // land on an index that's already in use. Gather every dayIdx already
      // present for this gym mode and walk forward from baseLen to find the
      // next truly unused integer for each optional_add, reserving it
      // immediately so multiple additions in the same gym mode never collide
      // with each other either. Purely descriptive — no day is ever created.
      const usedDayIdx = {};
      days.forEach(function(d){
        const n = Number(d && d._dayIdx);
        if(isFinite(n)) usedDayIdx[n] = true;
      });
      let nextIdx = baseLen;
      for(let i = 0; i < delta; i++){
        while(usedDayIdx[nextIdx]) nextIdx++;
        const newIdx = nextIdx;
        usedDayIdx[newIdx] = true;
        nextIdx++;
        dayPlans.push({
          gymKey: gymKey,
          dayIdx: newIdx,
          dayName: "Optional Lifting Day " + (newIdx + 1),
          isVirtual: true,
          role: "lifting",
          action: "optional_add",
          tweaks: [],
          notes: "Suggested optional additional lifting day for " + gymKey + " to reach a requested lifting frequency of " + targetFreq + "/week (currently " + currentLiftingCount + "). Not created — describes a possibility only.",
          rationale: "Matches the saved onboarding frequency, but adding a lifecycle day remains review-only to preserve the base program and history safety.",
          safetyTag: "deferred_lifecycle",
          confidence: recommendedFrequency ? "high" : "low",
          proposedExerciseOrder: null,
          exerciseActions: []
        });
      }
    } else if(delta < 0){
      // REQUIREMENT 3: current lifting days exceed requested — choose removal
      // candidates by day ROLE, not by highest day index, and never touch
      // cardio/recovery days. Preference order: optional virtual lifting days,
      // then specialization/pump days, then dedicated arms days, then other
      // accessory lifting days — avoiding foundational push/pull/lower days
      // whenever a more optional lifting day exists.
      const excess = Math.abs(delta);
      const removalCandidates = classifiedDays
        .filter(function(cd){ return cd.role === "lifting"; })
        .map(function(cd){
          return { dayIdx: cd.day._dayIdx, priority: p954GetProposalDayRemovalPriority(cd.day, cd.role) };
        })
        .sort(function(a,b){
          if(a.priority !== b.priority) return a.priority - b.priority;
          return b.dayIdx - a.dayIdx; // tie-break: prefer removing the later day
        });

      removalCandidates.slice(0, excess).forEach(function(c){
        const existing = dayPlans.find(function(p){ return p.gymKey === gymKey && p.dayIdx === c.dayIdx; });
        if(existing){
          existing.action = "remove";
          existing.notes = ("Current lifting-day count (" + currentLiftingCount + ") for " + gymKey + " exceeds the requested lifting frequency of " + targetFreq + "/week — consider removing or merging this day. Cardio/recovery days are preserved regardless. Describes a possibility only.");
          existing.rationale = "Frequency exceeds the saved onboarding target; removal remains review-only so base P and workout history stay untouched.";
          existing.safetyTag = "deferred_lifecycle";
          existing.confidence = "medium";
        }
      });
      if(excess > removalCandidates.length){
        warnings.push(gymKey + ": requested lifting-frequency reduction exceeds the number of available lifting-day removal candidates — review manually.");
      }
    }
  });

  dayPlans.forEach(function(p){
    if(actionCounts.hasOwnProperty(p.action)) actionCounts[p.action]++;
  });
  const affectedDayCount = dayPlans.filter(function(p){ return p.action !== "keep"; }).length;

  // ── Estimated session duration (deterministic, coarse) ───────────────────
  // 9.5.4.1: average exercise count over LIFTING days where practical, so a
  // cardio-only day (one exercise, 30-40 min) no longer drags the estimated
  // lifting-session duration down.
  let estimatedSessionDurationMinutes = null;
  const nonOptionalLiftingDayPlans = dayPlans.filter(function(p){ return p.action !== "optional_add" && p.role === "lifting"; });
  const nonOptionalDays = dayPlans.filter(function(p){ return p.action !== "optional_add"; });
  if(nonOptionalLiftingDayPlans.length || nonOptionalDays.length){
    const useLiftingOnly = nonOptionalLiftingDayPlans.length > 0;
    const totalExercises = gymModes.reduce(function(sum, gymKey){
      return sum + (currentProgram[gymKey] || []).reduce(function(s, d){
        if(useLiftingOnly && p954ClassifyProposalDay(d) !== "lifting") return s;
        return s + ((d.exercises||[]).length);
      }, 0);
    }, 0);
    const dayCountForAvg = gymModes.reduce(function(sum, gymKey){
      const gymDays = currentProgram[gymKey] || [];
      return sum + (useLiftingOnly ? gymDays.filter(function(d){ return p954ClassifyProposalDay(d) === "lifting"; }).length : gymDays.length);
    }, 0) || 1;
    const avgExercisesPerDay = totalExercises / dayCountForAvg;
    let est = Math.round(10 + (avgExercisesPerDay * 7));
    if(experience === "beginner") est -= 5;
    if(experience === "advanced") est += 5;
    estimatedSessionDurationMinutes = Math.max(30, Math.min(90, est));
  }

  return {
    schemaVersion: PROGRAM_PROPOSAL_SCHEMA,
    proposalVersion: APP_VERSION,
    status: "draft",
    source: "onboarding",
    sourceType: "local_generated",
    sourceSummary: sourceSummary,
    generatedAt: null, // set by the caller at save time
    appliedAt: null,
    dismissedAt: null,
    onboardingUpdatedAt: (onboardingState && typeof onboardingState.updatedAt === "string") ? onboardingState.updatedAt : null,
    profileUpdatedAt: (profile && typeof profile.updatedAt === "string") ? profile.updatedAt : null,
    summary: {
      recommendedFrequency: recommendedFrequency,
      gymModes: gymModes,
      estimatedSessionDurationMinutes: estimatedSessionDurationMinutes,
      rationale: rationale,
      affectedDayCount: affectedDayCount,
      actionCounts: actionCounts,
      // REQUIREMENT 7: read-only debug visibility.
      requestedLiftingFrequency: recommendedFrequency,
      currentLiftingDayCounts: currentLiftingDayCounts
    },
    dayPlans: dayPlans,
    warnings: warnings
  };
}

// Builds the { home: [...], partial: [...] } input shape p954BuildProgramProposal
// expects, using getResolvedDays() per gym so overrides, custom exercises,
// archived-exclusion, order overrides, and virtual/additive days are all
// already baked in. Read-only — never mutates P or lifecycle state.
function p954GetCurrentResolvedProgramForProposal(){
  const out = {};
  try {
    Object.keys(P).forEach(function(gymKey){
      // 9.5.4C: proposal-disabled days are treated as inactive for proposal
      // building purposes — excluded from lifting-day counts and dayPlans,
      // same as they're excluded from the Program tab / Daily Log selector.
      // Never mutates P or lifecycle state; base day/history are untouched.
      out[gymKey] = getResolvedDays(gymKey).filter(function(d){ return !isDayDisabled(gymKey, d._dayIdx); });
    });
  } catch(e){
    console.warn("[MarcusFit] p954GetCurrentResolvedProgramForProposal failed:", e && e.message);
  }
  return out;
}

// Generates a fresh proposal from current onboarding/profile/program state
// and saves it (status "draft", generatedAt = now). This is the only function
// in this phase that writes PROGRAM_PROPOSAL_KEY as a "real" (non-preview)
// action. Safe to call repeatedly — always overwrites any existing draft.
function p954GenerateAndSaveProposal(){
  try {
    const onboardingState = p951GetOnboardingState();
    const profile = p950GetUserProfile();
    const currentProgram = p954GetCurrentResolvedProgramForProposal();
    const sourceContext = p955BuildProposalSourceContext(onboardingState, profile, currentProgram);
    const built = p954BuildProgramProposal(onboardingState, profile, currentProgram, sourceContext);
    built.generatedAt = new Date().toISOString();
    built.sourceSummary.generatedAt = built.generatedAt;
    return p954SaveProposal(built);
  } catch(e){
    console.warn("[MarcusFit] p954GenerateAndSaveProposal failed:", e && e.message);
    return { ok: false, error: (e && e.message) || "Unknown error" };
  }
}

// REQUIREMENT 10: generates and returns a proposal in memory WITHOUT saving.
// Safe to call at any time (completed users, preview mode, testing) — never
// touches PROGRAM_PROPOSAL_KEY or any other storage key.
window.mfGenerateOnboardingProgramProposalPreview = function(){
  try {
    const onboardingState = p951GetOnboardingState();
    const profile = p950GetUserProfile();
    const currentProgram = p954GetCurrentResolvedProgramForProposal();
    const sourceContext = p955BuildProposalSourceContext(onboardingState, profile, currentProgram);
    const built = p954BuildProgramProposal(onboardingState, profile, currentProgram, sourceContext);
    built.generatedAt = new Date().toISOString();
    built.sourceSummary.generatedAt = built.generatedAt;
    return built;
  } catch(e){
    console.warn("[MarcusFit] mfGenerateOnboardingProgramProposalPreview failed:", e && e.message);
    return null;
  }
};

// Read-only compatibility check between a saved proposal and the CURRENT
// onboarding/profile/program state. Never mutates the proposal or anything
// else — purely informational (surfaced in the debug helper and could back a
// future "this proposal may be stale" banner).
function p954CheckProgramCompatibility(proposal){
  const reasons = [];
  try {
    if(!proposal) return { stale: false, reasons: ["No proposal to check."] };
    const onboardingState = p951GetOnboardingState();
    const profile = p950GetUserProfile();
    if(proposal.onboardingUpdatedAt && onboardingState.updatedAt && proposal.onboardingUpdatedAt !== onboardingState.updatedAt){
      reasons.push("Onboarding answers have changed since this proposal was generated.");
    }
    if(proposal.profileUpdatedAt && profile.updatedAt && proposal.profileUpdatedAt !== profile.updatedAt){
      reasons.push("Profile has changed since this proposal was generated.");
    }
    (proposal.dayPlans || []).forEach(function(dp){
      try {
        const days = getResolvedDays(dp.gymKey);
        const match = days.find(function(d){ return d._dayIdx === dp.dayIdx; });
        if(!match && dp.action !== "optional_add" && dp.action !== "add"){
          reasons.push("Referenced day no longer resolves: " + dp.gymKey + " " + dp.dayName + ".");
        }
      } catch(e){ /* skip this dayPlan's check safely */ }
    });
  } catch(e){
    reasons.push("Compatibility check failed safely: " + (e && e.message));
  }
  return { stale: reasons.length > 0, reasons: reasons };
}

// ── PHASE 9.5.4D: DAY + SAFE EXERCISE PROPOSAL APPLICATION ENGINE ────────────
//
// Extends accepted day-level keep/modify/remove/optional_add with two safe
// structured exercise operations: full-ID same-day reorder in
// lifecycle.orderOverrides and metadata-only modify in mf-overrides.
// Replace/add/remove/reactivate are counted and deferred. The transaction may
// write only lifecycle day structures/orderOverrides, mf-overrides, and the
// proposal record; base P, stable IDs, customExercises, inactiveIds,
// replacements, recommendations, and workout logs/history stay protected.

// Deterministic application-id generator. Same proposal content (generatedAt
// + dayPlans) always yields the same id, so a retried/failed apply attempt
// against the same still-draft proposal reuses the same id — this is what
// lets in-progress writes be recognized as "already satisfied by this same
// application" rather than a conflicting collision. Not cryptographic; only
// needs to be stable and collision-resistant enough for this local, 1-device
// use case.
function p954GenerateApplicationId(proposal){
  try {
    const basis = (proposal && proposal.generatedAt ? proposal.generatedAt : "") + "|" + JSON.stringify((proposal && proposal.dayPlans) || []);
    let h = 0;
    for(let i = 0; i < basis.length; i++){ h = ((h << 5) - h + basis.charCodeAt(i)) | 0; }
    const ts = (proposal && proposal.generatedAt && !isNaN(Date.parse(proposal.generatedAt))) ? new Date(proposal.generatedAt).getTime() : Date.now();
    return "papp-" + Math.abs(h).toString(36) + "-" + ts.toString(36);
  } catch(e){
    return "papp-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e6).toString(36);
  }
}

// Deterministic fingerprint of the parts of a proposal that the application
// plan is actually built from (status + dayPlans). Used to detect "the
// proposal changed since the preview was opened" without a full deep-equal.
function p954ComputeProposalFingerprint(proposal){
  try {
    return JSON.stringify({ status: proposal && proposal.status, dayPlans: (proposal && proposal.dayPlans) || [] });
  } catch(e){
    return "unfingerprintable:" + (e && e.message);
  }
}

// Best-effort single-line rationale for a day-level write, reusing whatever
// free-text the builder already attached (dp.notes, else first tweak).
function p954ExtractDayPlanReason(dp){
  if(!dp) return "";
  if(typeof dp.rationale === "string" && dp.rationale) return dp.rationale;
  if(typeof dp.notes === "string" && dp.notes) return dp.notes;
  if(Array.isArray(dp.tweaks) && dp.tweaks.length && typeof dp.tweaks[0] === "string") return dp.tweaks[0];
  return "";
}

// Pure planner: reads only the proposal argument (plus P/current lifecycle
// for read-only day-resolution lookups used in the "modify" name-change
// check) and never writes anything. Returns the day-level write plan plus
// counts, including the exercise-level actions this phase must skip.
let p954LastLiveValidationErrors = [];
let p954LastPostApplyValidationErrors = [];
let p954LastSafetyFacts = {before:null,after:null,idsUnchanged:null};
// ── FUTURE MODULE: src/proposal-apply-undo.js ────────────────────────────────
function p954BuildApplicationPlan(proposal){
  const ops = [], errors = [], deferred = { replace:[], add:[], remove:[], reactivate:[] };
  const counts = { keep:0, modify:0, remove:0, optional_add:0, deferredDayLifecycleCount:0, skippedExerciseActionCount:0, plannedReorderCount:0, plannedExerciseModifyCount:0, skippedReplaceCount:0, skippedAddCount:0, skippedRemoveCount:0, skippedReactivateCount:0 };
  const affected = {}, gyms = p954GetRecognizedProposalGymKeys(), seen = {};
  (Array.isArray(proposal && proposal.dayPlans) ? proposal.dayPlans : []).forEach(function(dp, i){
    const gymKey=dp && dp.gymKey, dayIdx=dp && dp.dayIdx;
    if(!dp || typeof dp!=="object" || gyms.indexOf(gymKey)<0 || !Number.isInteger(dayIdx) || dayIdx<0){ errors.push("dayPlans["+i+"] has an invalid gym/day target."); return; }
    const k=gymKey+"|"+dayIdx;
    if(seen[k]){ errors.push("Duplicate planned day target: "+k); return; } seen[k]=true;
    const reason=p954ExtractDayPlanReason(dp);
    if(dp.action==="keep") { counts.keep++; ops.push({type:"keep",gymKey,dayIdx,dp}); }
    else if(dp.action==="modify"){
      counts.modify++; affected[gymKey]=true; const fields={}; let day=null;
      try{ day=getResolvedDays(gymKey).find(function(d){return d._dayIdx===dayIdx;}); }catch(e){}
      if(typeof dp.proposedName==="string"&&dp.proposedName.trim()) fields.name=dp.proposedName;
      else if(typeof dp.dayName==="string"&&dp.dayName.trim()&&day&&dp.dayName!==(day.name||day.day)) fields.name=dp.dayName;
      ["focus","note","tag","subtitle"].forEach(function(f){if(typeof dp[f]==="string") fields[f]=dp[f];});
      ops.push(Object.keys(fields).length?{type:"dayOverride",gymKey,dayIdx,fields,reason,dp}:{type:"keep",gymKey,dayIdx,dp,note:"No day metadata write."});
    } else if(dp.action==="remove"){ counts.remove++; counts.deferredDayLifecycleCount++; ops.push({type:"skip_deferred_lifecycle",gymKey,dayIdx,reason,dp}); }
    else if(dp.action==="optional_add"){
      counts.optional_add++; counts.deferredDayLifecycleCount++; ops.push({type:"skip_deferred_lifecycle",gymKey,dayIdx,reason,dp});
    } else if(["reorder","replace","add"].indexOf(dp.action)>=0){ counts.skippedExerciseActionCount++; ops.push({type:"skip_exercise_level",gymKey,dayIdx,dp}); }
    else errors.push("dayPlans["+i+"] has unsupported action: "+dp.action);

    if(Array.isArray(dp.proposedExerciseOrder)) ops.push({type:"orderOverride",gymKey,dayIdx,order:dp.proposedExerciseOrder.slice(),dayPlan:dp});
    (dp.exerciseActions||[]).forEach(function(ea){
      if(ea.action==="modify") ops.push({type:"exerciseOverride",gymKey,dayIdx,exerciseId:ea.exerciseId,fields:Object.assign({},ea.fields),rationale:ea.rationale||"",dayPlan:dp,exerciseAction:ea});
      else if(["replace","add","remove","reactivate"].indexOf(ea.action)>=0){ deferred[ea.action].push({gymKey,dayIdx,exerciseAction:ea,dayPlan:dp}); counts["skipped"+ea.action.charAt(0).toUpperCase()+ea.action.slice(1)+"Count"]++; counts.skippedExerciseActionCount++; }
    });
  });
  // Classify exact live matches read-only; final authority remains live validation.
  const lc=getLifecycle(), ov=getOvr();
  ops.forEach(function(op){
    if(op.type==="orderOverride"){
      const day=getResolvedDays(op.gymKey).find(function(d){return d._dayIdx===op.dayIdx;}); const current=day?(day.exercises||[]).map(function(e){return e.id;}):[];
      const stored=(lc.orderOverrides||{})[op.gymKey+":"+op.dayIdx];
      op.currentOrder=current;
      op.conflict=Array.isArray(stored)&&!p954StrictArrayEqual(stored,op.order);
      op.writeNeeded=!Array.isArray(stored)&&!p954StrictArrayEqual(current,op.order);
      op.unchanged=!op.conflict&&!op.writeNeeded;
      if(op.writeNeeded) counts.plannedReorderCount++;
    } else if(op.type==="exerciseOverride"){
      const existing=ov[op.exerciseId]||{}, day=getResolvedDays(op.gymKey).find(function(d){return d._dayIdx===op.dayIdx;}), ex=day&&(day.exercises||[]).find(function(e){return e.id===op.exerciseId;});
      op.fieldStates={}; let any=false, anyConflict=false;
      Object.keys(op.fields).forEach(function(f){
        const cur=getF(op.exerciseId,f,ex?ex[f]:undefined), has=Object.prototype.hasOwnProperty.call(existing,f);
        const conflict=has&&existing[f]!==op.fields[f];
        const write=!has&&cur!==op.fields[f];
        op.fieldStates[f]={current:cur,proposed:op.fields[f],conflict:conflict,writeNeeded:write,unchanged:!conflict&&!write};
        if(conflict) anyConflict=true;
        if(write) any=true;
      });
      op.conflict=anyConflict; op.writeNeeded=any; op.unchanged=!anyConflict&&!any; if(any) counts.plannedExerciseModifyCount++;
    }
  });
  return {valid:!errors.length,errors,ops,counts,deferred,affectedGymModes:Object.keys(affected)};
}
function p954StrictArrayEqual(a,b){ return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every(function(v,i){return v===b[i];}); }
function p954Value(v){ try{return JSON.stringify(v);}catch(e){return String(v);} }
function p954ValidatePlanAgainstLiveState(plan, applicationId){
  const errors=[], lc=getLifecycle(), ov=getOvr();
  (plan.ops||[]).forEach(function(op){
    if(op.type==="keep"||op.type==="skip_exercise_level"||op.type==="skip_deferred_lifecycle") return;
    if(!P[op.gymKey]){errors.push("Gym "+op.gymKey+" no longer exists.");return;}
    const label=op.gymKey+" day "+(op.dayIdx+1);
    if(op.type==="disable"){
      const day=getResolvedDays(op.gymKey).find(function(d){return d._dayIdx===op.dayIdx;}); if(!day) errors.push("Cannot disable "+label+": day does not resolve.");
      const old=((lc.disabledDays||{})[op.gymKey]||{})[String(op.dayIdx)]; if(old&&old.proposalId!==applicationId) errors.push(label+" has a conflicting disabled-day record.");
    } else if(op.type==="dayAddition"){
      if(op.dayIdx<P[op.gymKey].length) errors.push(label+" optional addition collides with a base day.");
      const old=((lc.dayAdditions||{})[op.gymKey]||{})[String(op.dayIdx)]; if(old){ const same=["name","focus","note","tag","subtitle"].every(function(f){return (old[f]||"")===(op.fields[f]||"");}); if(!same) errors.push(label+" has a conflicting day addition."); }
    } else if(op.type==="dayOverride"){
      const old=((lc.dayOverrides||{})[op.gymKey]||{})[String(op.dayIdx)]||{}; Object.keys(op.fields).forEach(function(f){if(Object.prototype.hasOwnProperty.call(old,f)&&old[f]!==op.fields[f]) errors.push(label+" field "+f+" conflict: existing "+p954Value(old[f])+", proposed "+p954Value(op.fields[f])+".");});
    } else if(op.type==="orderOverride"||op.type==="exerciseOverride"){
      if(((lc.disabledDays||{})[op.gymKey]||{})[String(op.dayIdx)]){errors.push(label+": exercise writes are blocked on a disabled day.");return;}
      const day=getResolvedDays(op.gymKey).find(function(d){return d._dayIdx===op.dayIdx;}); if(!day){errors.push(label+": exact resolved day not found.");return;}
      const exercises=day.exercises||[], ids=exercises.map(function(e){return e.id;});
      if(op.type==="orderOverride"){
        if(op.order.length!==ids.length||new Set(op.order).size!==op.order.length||op.order.some(function(id){return typeof id!=="string"||!id||ids.indexOf(id)<0||!!(lc.inactiveIds||{})[id];})||ids.some(function(id){return op.order.indexOf(id)<0;})) errors.push(label+": proposed order must contain exactly every active exercise ID once.");
        const old=(lc.orderOverrides||{})[op.gymKey+":"+op.dayIdx]; if(old&&!p954StrictArrayEqual(old,op.order)) errors.push(label+" order conflict: existing "+old.join(" → ")+", proposed "+op.order.join(" → ")+".");
      } else {
        const ex=exercises.find(function(e){return e.id===op.exerciseId;}); if(!ex) errors.push(label+", exercise "+op.exerciseId+": ID is unknown, inactive, or belongs to another day.");
        if((lc.inactiveIds||{})[op.exerciseId]) errors.push(label+", exercise "+op.exerciseId+": inactive IDs cannot be modified.");
        Object.keys(op.fields).forEach(function(f){
          if(PROGRAM_PROPOSAL_EXERCISE_MODIFY_FIELDS.indexOf(f)<0) errors.push(label+", exercise "+op.exerciseId+", field "+f+": unsupported field.");
          const old=(ov[op.exerciseId]||{}); if(Object.prototype.hasOwnProperty.call(old,f)&&old[f]!==op.fields[f]) errors.push(label+", exercise "+op.exerciseId+", field "+f+" conflict: existing "+p954Value(old[f])+", proposed "+p954Value(op.fields[f])+".");
          const current=ex?getF(op.exerciseId,f,ex[f]):undefined; if(f==="name"&&current!==op.fields[f]&&exClassifyChange(current,op.fields[f])!=="tweak") errors.push(label+", exercise "+op.exerciseId+", field name: proposed name is replacement-classified and cannot be applied.");
        });
      }
    }
  });
  return {valid:!errors.length,errors};
}
function p954BuildApplicationSummary(plan){
  const keys=[], modified={}; let reordered=0;
  plan.ops.forEach(function(op){if(["dayOverride","disable","dayAddition"].indexOf(op.type)>=0)keys.push(op.gymKey+":"+op.dayIdx);if(op.type==="orderOverride"&&op.writeNeeded)reordered++;if(op.type==="exerciseOverride"&&op.writeNeeded)modified[op.exerciseId]=true;});
  return {keepCount:plan.counts.keep,modifyCount:plan.counts.modify,disabledCount:0,addedCount:0,deferredDayLifecycleCount:plan.counts.deferredDayLifecycleCount||0,skippedExerciseActionCount:plan.counts.skippedExerciseActionCount,reorderedDayCount:reordered,modifiedExerciseCount:Object.keys(modified).length,skippedReplaceCount:plan.counts.skippedReplaceCount,skippedAddCount:plan.counts.skippedAddCount,skippedRemoveCount:plan.counts.skippedRemoveCount,skippedReactivateCount:plan.counts.skippedReactivateCount,reorderResults:plan.ops.filter(function(op){return op.type==="orderOverride";}).map(function(op){return{gymKey:op.gymKey,dayIdx:op.dayIdx,status:op.writeNeeded?"Applied":"Unchanged"};}),exerciseActionResults:plan.ops.filter(function(op){return op.type==="exerciseOverride";}).map(function(op){return{gymKey:op.gymKey,dayIdx:op.dayIdx,exerciseId:op.exerciseId,status:op.writeNeeded?"Applied":"Unchanged"};}),affectedGymModes:plan.affectedGymModes.slice(),appliedDayKeys:keys,warnings:(plan.errors||[]).slice()};
}
function p954RawState(key){const raw=localStorage.getItem(key);return{existed:raw!==null,rawText:raw};}
function p954CaptureRollbackSnapshot(){return{lifecycle:p954RawState(LIFECYCLE_KEY),overrides:p954RawState(OVR),proposal:p954RawState(PROGRAM_PROPOSAL_KEY)};}
function p954RestoreFromRollbackSnapshot(s){try{[[LIFECYCLE_KEY,s.lifecycle],[OVR,s.overrides],[PROGRAM_PROPOSAL_KEY,s.proposal]].forEach(function(x){x[1].existed?localStorage.setItem(x[0],x[1].rawText):localStorage.removeItem(x[0]);});return true;}catch(e){console.warn("[MarcusFit] exact rollback failed",e);return false;}}
function p954CloneUndoValue(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));}
function p954OwnUndoState(obj,key){const existed=!!obj&&Object.prototype.hasOwnProperty.call(obj,key);return{existed:existed,value:existed?p954CloneUndoValue(obj[key]):undefined};}
function p954UndoRecord(lc,section,gymKey,dayIdx){const byGym=(lc[section]||{})[gymKey];return byGym&&Object.prototype.hasOwnProperty.call(byGym,String(dayIdx))?byGym[String(dayIdx)]:undefined;}
function p954UndoDeepEqual(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function p954BuildScopedUndoSnapshot(plan,beforeLc,beforeOv,afterLc,afterOv){
  const scoped={version:1,lifecycle:{dayOverrideFields:[],dayAdditions:[],disabledDays:[],orderOverrides:[]},overrides:{fields:[]}};
  function dayField(gymKey,dayIdx,field){
    const beforeRecord=p954UndoRecord(beforeLc,"dayOverrides",gymKey,dayIdx),afterRecord=p954UndoRecord(afterLc,"dayOverrides",gymKey,dayIdx);
    scoped.lifecycle.dayOverrideFields.push({gymKey:gymKey,dayIdx:dayIdx,field:field,before:p954OwnUndoState(beforeRecord,field),after:p954OwnUndoState(afterRecord,field),recordBeforeExisted:beforeRecord!==undefined,gymBeforeExisted:Object.prototype.hasOwnProperty.call(beforeLc.dayOverrides||{},gymKey)});
  }
  function fullRecord(kind,section,gymKey,dayIdx){
    const before=p954UndoRecord(beforeLc,section,gymKey,dayIdx),after=p954UndoRecord(afterLc,section,gymKey,dayIdx);
    if(!p954UndoDeepEqual(before,after))scoped.lifecycle[kind].push({gymKey:gymKey,dayIdx:dayIdx,before:{existed:before!==undefined,value:p954CloneUndoValue(before)},after:{existed:after!==undefined,value:p954CloneUndoValue(after)},gymBeforeExisted:Object.prototype.hasOwnProperty.call(beforeLc[section]||{},gymKey)});
  }
  (plan.ops||[]).forEach(function(op){
    if(op.type==="dayOverride"){
      const seen={};Object.keys(op.fields||{}).concat(["updatedAt","reason"]).forEach(function(field){if(!seen[field]){seen[field]=true;dayField(op.gymKey,op.dayIdx,field);}});
    }else if(op.type==="disable")fullRecord("disabledDays","disabledDays",op.gymKey,op.dayIdx);
    else if(op.type==="dayAddition")fullRecord("dayAdditions","dayAdditions",op.gymKey,op.dayIdx);
    else if(op.type==="orderOverride"&&op.writeNeeded){const key=op.gymKey+":"+op.dayIdx;scoped.lifecycle.orderOverrides.push({key:key,gymKey:op.gymKey,dayIdx:op.dayIdx,before:p954OwnUndoState(beforeLc.orderOverrides||{},key),after:p954OwnUndoState(afterLc.orderOverrides||{},key)});}
    else if(op.type==="exerciseOverride"&&op.writeNeeded){const beforeRecord=(beforeOv||{})[op.exerciseId],afterRecord=(afterOv||{})[op.exerciseId];Object.keys(op.fields||{}).forEach(function(field){if(op.fieldStates[field]&&op.fieldStates[field].writeNeeded)scoped.overrides.fields.push({exerciseId:op.exerciseId,field:field,before:p954OwnUndoState(beforeRecord,field),after:p954OwnUndoState(afterRecord,field),recordBeforeExisted:beforeRecord!==undefined});});}
  });
  return scoped;
}
function p954BuildPersistedPreApplySnapshot(proposal,rollback,appliedRaw,applicationId,plan,afterLc,afterOv){
  const lc=JSON.parse(rollback.lifecycle.rawText||JSON.stringify(exLifecycleDefault())),ov=JSON.parse(rollback.overrides.rawText||"{}");
  return{
    dayOverrides:JSON.parse(JSON.stringify(lc.dayOverrides||{})),
    dayAdditions:JSON.parse(JSON.stringify(lc.dayAdditions||{})),
    disabledDays:JSON.parse(JSON.stringify(lc.disabledDays||{})),
    orderOverrides:JSON.parse(JSON.stringify(lc.orderOverrides||{})),
    overrides:JSON.parse(JSON.stringify(ov||{})),
    proposal:JSON.parse(JSON.stringify(proposal)),
    // 9.5.4E: exact byte-for-byte states required for guarded undo. These are
    // additive; accepted C/D snapshots without them remain readable but are
    // intentionally not auto-undoable because exact raw history cannot be invented.
    rawStorage:{
      lifecycle:{existed:rollback.lifecycle.existed,rawText:rollback.lifecycle.rawText},
      overrides:{existed:rollback.overrides.existed,rawText:rollback.overrides.rawText}
    },
    expectedAppliedRaw:{lifecycle:appliedRaw.lifecycle,overrides:appliedRaw.overrides},
    applicationId:applicationId,
    // 9.5.4E correction: operation-scoped before/after values permit undo to
    // preserve unrelated lifecycle and override changes made after apply.
    scopedUndo:p954BuildScopedUndoSnapshot(plan,lc,ov,afterLc,afterOv)
  };
}
function p954SafetyFacts(lc){const ids=[];p954GetRecognizedProposalGymKeys().forEach(function(g){getResolvedDays(g).forEach(function(d){(d.exercises||[]).forEach(function(e){ids.push(g+":"+d._dayIdx+":"+e.id);});});});return{activeExerciseCount:ids.length,exerciseIds:ids.sort(),inactiveIds:JSON.stringify(lc.inactiveIds||{}),customExercises:JSON.stringify(lc.customExercises||{}),replacements:JSON.stringify(lc.replacements||{}),recommendations:localStorage.getItem(RECS_KEY),otherStorage:Array.from({length:localStorage.length},function(_,i){return localStorage.key(i);}).filter(function(k){return k!==LIFECYCLE_KEY&&k!==OVR&&k!==PROGRAM_PROPOSAL_KEY&&k!==RECS_KEY;}).sort().map(function(k){return[k,localStorage.getItem(k)];})};}
function p954VerifyPlanApplied(plan,applicationId,before,beforeOvr){
  const errors=[],lc=getLifecycle(),ov=getOvr(); plan.ops.forEach(function(op){
    if(op.type==="dayOverride"){const r=((lc.dayOverrides||{})[op.gymKey]||{})[String(op.dayIdx)]||{};Object.keys(op.fields).forEach(function(f){if(r[f]!==op.fields[f])errors.push("Day override verification failed: "+f);});}
    else if(op.type==="disable"&&!(((lc.disabledDays||{})[op.gymKey]||{})[String(op.dayIdx)]))errors.push("Disabled day verification failed.");
    else if(op.type==="dayAddition"&&!(((lc.dayAdditions||{})[op.gymKey]||{})[String(op.dayIdx)]))errors.push("Day addition verification failed.");
    else if(op.type==="orderOverride"&&!p954StrictArrayEqual((lc.orderOverrides||{})[op.gymKey+":"+op.dayIdx]||op.currentOrder,op.order))errors.push("Order verification failed at "+op.gymKey+" day "+(op.dayIdx+1)+".");
    else if(op.type==="exerciseOverride")Object.keys(op.fields).forEach(function(f){if((ov[op.exerciseId]||{})[f]!==op.fields[f]&&op.fieldStates[f].writeNeeded)errors.push("Exercise override verification failed for "+op.exerciseId+" "+f+".");});
  });
  Object.keys(beforeOvr).forEach(function(id){Object.keys(beforeOvr[id]||{}).forEach(function(f){const planned=plan.ops.some(function(op){return op.type==="exerciseOverride"&&op.exerciseId===id&&Object.prototype.hasOwnProperty.call(op.fields,f);});if(!planned&&(ov[id]||{})[f]!==beforeOvr[id][f])errors.push("Unrelated override changed: "+id+" "+f);});});
  const after=p954SafetyFacts(lc); if(before.activeExerciseCount!==after.activeExerciseCount)errors.push("Active exercise count changed.");if(!p954StrictArrayEqual(before.exerciseIds,after.exerciseIds))errors.push("Active exercise IDs changed.");["inactiveIds","customExercises","replacements","recommendations","otherStorage"].forEach(function(f){if(JSON.stringify(before[f])!==JSON.stringify(after[f]))errors.push("Protected state changed: "+f);});
  return{valid:!errors.length,errors,after};
}
function p954ApplyProposal(expectedFingerprint){
  let rollback=null; try{
    const ins=p954InspectStoredProposal();if(!ins.exists||!ins.parses||!ins.validation.valid)return{ok:false,error:"Stored proposal is missing, corrupted, or invalid."};const proposal=ins.normalized;
    if(proposal.status==="applied")return{ok:true,alreadyApplied:true,applicationId:proposal.applicationId,summary:proposal.applicationSummary};if(proposal.status!=="draft")return{ok:false,error:"Only a draft proposal can be applied."};
    if(typeof expectedFingerprint==="string"&&expectedFingerprint!==p954ComputeProposalFingerprint(proposal))return{ok:false,error:"The proposal changed since preview. Reopen preview."};
    const plan=p954BuildApplicationPlan(proposal);if(!plan.valid)return{ok:false,error:"Application plan is invalid: "+plan.errors.join(" ")};if(p955GetProposalQualityMetrics(proposal).safeApplyCount===0)return{ok:false,noSupportedChanges:true,error:"This proposal has no supported changes to apply."};const applicationId=p954GenerateApplicationId(proposal),live=p954ValidatePlanAgainstLiveState(plan,applicationId);p954LastLiveValidationErrors=live.errors.slice();if(!live.valid)return{ok:false,error:"Cannot apply safely: "+live.errors.join(" ")};
    rollback=p954CaptureRollbackSnapshot();const lc=JSON.parse(rollback.lifecycle.rawText||JSON.stringify(exLifecycleDefault())),ov=JSON.parse(rollback.overrides.rawText||"{}"),beforeOvr=JSON.parse(JSON.stringify(ov)),before=p954SafetyFacts(lc),now=new Date().toISOString(),tag="proposal:"+applicationId;
    lc.dayOverrides=lc.dayOverrides||{};lc.dayAdditions=lc.dayAdditions||{};lc.disabledDays=lc.disabledDays||{};lc.orderOverrides=lc.orderOverrides||{};
    plan.ops.forEach(function(op){const key=String(op.dayIdx);
      if(op.type==="dayOverride"){lc.dayOverrides[op.gymKey]=lc.dayOverrides[op.gymKey]||{};lc.dayOverrides[op.gymKey][key]=Object.assign({},lc.dayOverrides[op.gymKey][key]||{},op.fields,{updatedAt:now,reason:tag+(op.reason?" — "+op.reason:"")});}
      else if(op.type==="disable"){lc.disabledDays[op.gymKey]=lc.disabledDays[op.gymKey]||{};if(!lc.disabledDays[op.gymKey][key])lc.disabledDays[op.gymKey][key]={disabledAt:now,source:"onboarding_proposal",proposalId:applicationId,reason:op.reason||""};}
      else if(op.type==="dayAddition"){lc.dayAdditions[op.gymKey]=lc.dayAdditions[op.gymKey]||{};if(!lc.dayAdditions[op.gymKey][key])lc.dayAdditions[op.gymKey][key]=Object.assign({},op.fields,{createdAt:now,updatedAt:now,reason:tag+(op.reason?" — "+op.reason:"")});}
      else if(op.type==="orderOverride"&&op.writeNeeded)lc.orderOverrides[op.gymKey+":"+op.dayIdx]=op.order.slice();
      else if(op.type==="exerciseOverride"&&op.writeNeeded){ov[op.exerciseId]=ov[op.exerciseId]||{};Object.keys(op.fields).forEach(function(f){if(op.fieldStates[f].writeNeeded)ov[op.exerciseId][f]=op.fields[f];});}
    });
    const lifecycleRaw=JSON.stringify(lc),overridesRaw=JSON.stringify(ov),summary=p954BuildApplicationSummary(plan),snapshot=p954BuildPersistedPreApplySnapshot(proposal,rollback,{lifecycle:lifecycleRaw,overrides:overridesRaw},applicationId,plan,lc,ov),applied=Object.assign({},proposal,{status:"applied",appliedAt:now,applicationId,applicationSummary:summary,preApplySnapshot:snapshot,undoneAt:null,undoSummary:null});
    localStorage.setItem(LIFECYCLE_KEY,lifecycleRaw);localStorage.setItem(OVR,overridesRaw);localStorage.setItem(PROGRAM_PROPOSAL_KEY,JSON.stringify(p954NormalizeProposal(applied)));
    const verify=p954VerifyPlanApplied(plan,applicationId,before,beforeOvr);p954LastPostApplyValidationErrors=verify.errors.slice();const post=p954InspectStoredProposal();if(!verify.valid||!post.validation.valid||post.normalized.status!=="applied"||!post.normalized.appliedAt||!post.normalized.applicationId||!post.normalized.applicationSummary||!post.normalized.preApplySnapshot)throw new Error((verify.errors.join(" ")||"Applied proposal verification failed."));
    p954LastSafetyFacts={before:before.activeExerciseCount,after:verify.after.activeExerciseCount,idsUnchanged:p954StrictArrayEqual(before.exerciseIds,verify.after.exerciseIds)};return{ok:true,applicationId,summary};
  }catch(e){if(rollback)p954RestoreFromRollbackSnapshot(rollback);return{ok:false,error:"Application failed and all three keys were restored exactly: "+((e&&e.message)||"Unknown error")};}
}



// Console QA: mfBuildExerciseProposalFixture() is read-only;
// mfSaveExerciseProposalFixture() saves a draft only; neither helper applies it.
window.mfBuildExerciseProposalFixture = function(){
  const gymKey=p954GetRecognizedProposalGymKeys()[0],day=getResolvedDays(gymKey).find(function(d){return !isDayDisabled(gymKey,d._dayIdx)&&(d.exercises||[]).length>=4;});
  if(!day) throw new Error("Fixture needs an active day with at least four exercises.");
  const ex=day.exercises,proposal=p954GetDefaultProposal(); proposal.generatedAt=new Date().toISOString();proposal.sourceType="fixture";proposal.source="developer_fixture";proposal.sourceSummary={generatedAt:proposal.generatedAt,appVersion:APP_VERSION,proposalEngineVersion:PROGRAM_PROPOSAL_ENGINE_VERSION,profileUsed:false,onboardingUsed:false,coachingPrefsUsed:false,currentProgramUsed:true,lifecycleUsed:true,recentLogsUsed:false,profileFields:[],onboardingSections:[],lifecycleSignals:["fixture_live_day_lookup"],sourceWarnings:["Developer QA fixture: not a recommendation generated from user context.","Recent workout logs were not used."]};proposal.summary.gymModes=[gymKey];proposal.summary.affectedDayCount=1;
  proposal.dayPlans=[{gymKey:gymKey,dayIdx:day._dayIdx,dayName:day.name||day.day||("Day "+(day._dayIdx+1)),role:"lifting",action:"keep",tweaks:[],notes:"Deterministic 9.5.5 exercise application QA fixture.",rationale:"Exercises are intentionally reversed to verify same-day reorder safety while preserving IDs.",safetyTag:"safe_apply",confidence:"test_only",proposedExerciseOrder:ex.map(function(e){return e.id;}).reverse(),exerciseActions:[
    {exerciseId:ex[0].id,action:"modify",fields:{sets:(Number.isInteger(ex[0].sets)&&ex[0].sets>0)?ex[0].sets:3},rationale:"Metadata-only idempotency baseline; stable ID and history remain unchanged.",safetyTag:"safe_apply",confidence:"test_only"},
    {exerciseId:ex[1].id,action:"replace",fields:{},rationale:"Replacement is shown only to exercise review UI and validator coverage; risky lifecycle application remains deferred.",safetyTag:"deferred_lifecycle",confidence:"test_only"},
    {exerciseId:null,action:"add",fields:{name:"Deferred fixture exercise"},rationale:"Addition remains review-only because creating lifecycle records is outside this safe-apply phase.",safetyTag:"deferred_lifecycle",confidence:"test_only"},
    {exerciseId:ex[2].id,action:"remove",fields:{},rationale:"Removal remains review-only so the stable exercise ID and workout history cannot be disrupted.",safetyTag:"deferred_lifecycle",confidence:"test_only"},
    {exerciseId:ex[3].id,action:"reactivate",fields:{},rationale:"Reactivation remains review-only until lifecycle conflict handling is explicitly implemented.",safetyTag:"deferred_lifecycle",confidence:"test_only"}
  ]}]; return p954NormalizeProposal(proposal);
};
window.mfSaveExerciseProposalFixture = function(){return p954SaveProposal(window.mfBuildExerciseProposalFixture());};
var mfBuildExerciseProposalFixture=window.mfBuildExerciseProposalFixture;
var mfSaveExerciseProposalFixture=window.mfSaveExerciseProposalFixture;

// Read-only, concise application-focused debug helper (separate from the
// broader mfOnboardingProgramProposalDebug below, which also gets extended).
window.mfOnboardingProgramProposalApplicationDebug = function(){
  try {
    const proposal = p954GetProposal();
    const lc = getLifecycle();
    const undoPlan = p954BuildUndoPlan(proposal === null ? undefined : proposal);
    const result = {
      status: proposal ? proposal.status : null,
      applicationId: proposal ? proposal.applicationId : null,
      appliedAt: proposal ? proposal.appliedAt : null,
      undoneAt: proposal ? proposal.undoneAt : null,
      planCounts: proposal ? p954BuildApplicationPlan(proposal).counts : null,
      plannedReorderCount: proposal ? p954BuildApplicationPlan(proposal).counts.plannedReorderCount : 0,
      plannedExerciseModifyCount: proposal ? p954BuildApplicationPlan(proposal).counts.plannedExerciseModifyCount : 0,
      liveValidationErrors: p954LastLiveValidationErrors.slice(),
      postApplyValidationErrors: p954LastPostApplyValidationErrors.slice(),
      activeExerciseCountBefore: p954LastSafetyFacts.before,
      activeExerciseCountAfter: p954LastSafetyFacts.after,
      exerciseIdsUnchanged: p954LastSafetyFacts.idsUnchanged,
      disabledDaySummary: { total: getDisabledDayCount(lc), byGym: Object.keys(lc.disabledDays || {}).reduce(function(acc, g){ acc[g] = Object.keys(lc.disabledDays[g] || {}).length; return acc; }, {}) },
      proposalCreatedDayAdditions: Object.keys(lc.dayAdditions || {}).reduce(function(acc, g){
        acc[g] = Object.keys(lc.dayAdditions[g] || {}).filter(function(k){ return typeof lc.dayAdditions[g][k].reason === "string" && lc.dayAdditions[g][k].reason.indexOf("proposal:") === 0; }).length;
        return acc;
      }, {}),
      proposalCreatedDayOverrides: Object.keys(lc.dayOverrides || {}).reduce(function(acc, g){
        acc[g] = Object.keys(lc.dayOverrides[g] || {}).filter(function(k){ return typeof lc.dayOverrides[g][k].reason === "string" && lc.dayOverrides[g][k].reason.indexOf("proposal:") === 0; }).length;
        return acc;
      }, {}),
      snapshotAvailable: !!(proposal && proposal.preApplySnapshot),
      snapshotValidForUndo: proposal ? p954ValidateUndoSnapshot(proposal).valid : false,
      canUndo: undoPlan.canUndo,
      undoConflicts: undoPlan.conflicts,
      undoWarnings: undoPlan.warnings,
      lastUndoValidationErrors: p954LastUndoValidationErrors.slice(),
      lastPostUndoValidationErrors: p954LastPostUndoValidationErrors.slice(),
      exactRawRestorationVerified: p954LastUndoVerification.exactRawRestorationVerified,
      idempotencyStatus: undoPlan.alreadyUndone ? "already-undone/no-op" : p954LastUndoVerification.idempotencyStatus,
      validationErrors: proposal ? p954ValidateProgramProposal(proposal).errors : []
    };
    console.log("[MarcusFit] mfOnboardingProgramProposalApplicationDebug():", result);
    return result;
  } catch(e){
    const result = { error: (e && e.message) || "Unknown error" };
    console.warn("[MarcusFit] mfOnboardingProgramProposalApplicationDebug failed:", e && e.message);
    return result;
  }
};

// Read-only, safe-clone accessor for an applied proposal's pre-apply
// snapshot. Read-only accessor; 9.5.4E's guarded undo path validates and uses
// the snapshot separately and never mutates through this helper.
function p954GetApplicationSnapshot(){
  try {
    const proposal = p954GetProposal();
    if(!proposal || !proposal.preApplySnapshot) return null;
    return JSON.parse(JSON.stringify(proposal.preApplySnapshot));
  } catch(e){
    return null;
  }
}
window.p954GetApplicationSnapshot = p954GetApplicationSnapshot;

// ── PHASE 9.5.4E: USER-FACING APPLIED PROPOSAL UNDO ─────────────────────────
// One guarded reversal of the currently saved applied proposal. This is not
// an undo stack: only the exact raw lifecycle/override state captured by the
// application above can be restored, and the proposal remains as audit data.
let p954LastUndoValidationErrors = [];
let p954LastPostUndoValidationErrors = [];
let p954LastUndoVerification = {exactRawRestorationVerified:null,unrelatedStatePreserved:null,idempotencyStatus:null};

function p954ValidateUndoSnapshot(proposal){
  const result={available:false,valid:false,scopedAvailable:false,scopedValid:false,errors:[],warnings:[]},snap=proposal&&proposal.preApplySnapshot;
  if(!snap||typeof snap!=="object"||Array.isArray(snap)){result.errors.push("No pre-apply snapshot is available.");return result;}
  result.available=true;
  function validRawState(label,state){
    if(!state||typeof state!=="object"||Array.isArray(state)){result.errors.push(label+" raw snapshot is missing or malformed.");return;}
    if(typeof state.existed!=="boolean")result.errors.push(label+" raw snapshot has an invalid existed flag.");
    if(state.existed&&typeof state.rawText!=="string")result.errors.push(label+" raw snapshot is missing its original raw string.");
    if(!state.existed&&state.rawText!==null)result.errors.push(label+" raw snapshot must use null when the key was originally absent.");
    if(state.existed&&typeof state.rawText==="string"){try{const parsed=JSON.parse(state.rawText);if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("not an object");}catch(e){result.errors.push(label+" original raw value is not a valid JSON object.");}}
  }
  if(!snap.rawStorage||typeof snap.rawStorage!=="object"||Array.isArray(snap.rawStorage))result.errors.push("Exact pre-apply raw storage is unavailable (legacy snapshot).");
  else {validRawState("Exercise lifecycle",snap.rawStorage.lifecycle);validRawState("Exercise overrides",snap.rawStorage.overrides);}
  if(!snap.expectedAppliedRaw||typeof snap.expectedAppliedRaw!=="object"||Array.isArray(snap.expectedAppliedRaw))result.errors.push("Expected applied raw storage is unavailable (legacy snapshot).");
  else ["lifecycle","overrides"].forEach(function(f){
    const raw=snap.expectedAppliedRaw[f];
    if(typeof raw!=="string")result.errors.push("Expected applied "+f+" raw value is missing.");
    else try{const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("not an object");}catch(e){result.errors.push("Expected applied "+f+" raw value is malformed.");}
  });
  if(typeof snap.applicationId!=="string"||!snap.applicationId||snap.applicationId!==(proposal&&proposal.applicationId))result.errors.push("Snapshot application identity does not match this proposal.");
  if(!snap.proposal||typeof snap.proposal!=="object"||Array.isArray(snap.proposal))result.errors.push("Snapshot proposal identity is missing.");
  else if(proposal&&p954GenerateApplicationId(snap.proposal)!==proposal.applicationId)result.errors.push("Original proposal fingerprint no longer matches the application ID.");
  if(snap.scopedUndo===undefined){
    result.warnings.push("Scoped undo data is unavailable (legacy snapshot); only an exact whole-state fallback may be safe.");
  }else{
    const scoped=snap.scopedUndo;
    result.scopedAvailable=true;
    function validState(state,label){if(!state||typeof state!=="object"||typeof state.existed!=="boolean")result.errors.push("Scoped undo "+label+" state is malformed.");}
    if(!scoped||typeof scoped!=="object"||Array.isArray(scoped)||scoped.version!==1||!scoped.lifecycle||!scoped.overrides)result.errors.push("Scoped undo data is malformed.");
    else {
      const lifecycle=scoped.lifecycle,overrides=scoped.overrides;
      ["dayOverrideFields","dayAdditions","disabledDays","orderOverrides"].forEach(function(k){if(!Array.isArray(lifecycle[k]))result.errors.push("Scoped lifecycle "+k+" is invalid.");});
      if(!Array.isArray(overrides.fields))result.errors.push("Scoped exercise overrides are invalid.");
      (lifecycle.dayOverrideFields||[]).forEach(function(x,i){if(!x||typeof x.gymKey!=="string"||!Number.isInteger(x.dayIdx)||typeof x.field!=="string")result.errors.push("Scoped day override entry "+i+" is invalid.");else{validState(x.before,"day override before");validState(x.after,"day override after");}});
      ["dayAdditions","disabledDays","orderOverrides"].forEach(function(k){(lifecycle[k]||[]).forEach(function(x,i){if(!x||typeof x!=="object")result.errors.push("Scoped "+k+" entry "+i+" is invalid.");else{validState(x.before,k+" before");validState(x.after,k+" after");}});});
      (overrides.fields||[]).forEach(function(x,i){if(!x||typeof x.exerciseId!=="string"||typeof x.field!=="string")result.errors.push("Scoped override entry "+i+" is invalid.");else{validState(x.before,"override before");validState(x.after,"override after");}});
      result.scopedValid=result.errors.length===0;
    }
  }
  result.valid=result.errors.length===0;
  return result;
}

function p954UndoRawMatches(rawState,currentRaw){return rawState.existed?currentRaw===rawState.rawText:currentRaw===null;}
function p954UndoStateEqual(a,b){return !!a&&!!b&&a.existed===b.existed&&(!a.existed||p954UndoDeepEqual(a.value,b.value));}
function p954ParseUndoLiveState(){try{return{ok:true,lc:JSON.parse(localStorage.getItem(LIFECYCLE_KEY)||JSON.stringify(exLifecycleDefault())),ov:JSON.parse(localStorage.getItem(OVR)||"{}")};}catch(e){return{ok:false,error:"Current lifecycle or override storage is malformed."};}}
function p954FormatScopedUndoDayLabel(entry){const raw=entry&&typeof entry.gymLabel==="string"&&entry.gymLabel.trim()?entry.gymLabel.trim():(entry&&typeof entry.gymKey==="string"&&entry.gymKey?entry.gymKey:"Gym"),gym=raw.charAt(0).toUpperCase()+raw.slice(1),day=entry&&Number.isInteger(entry.dayIdx)?entry.dayIdx+1:null;return day===null?gym:gym+" Day "+day;}
function p954GetScopedUndoEntries(scoped){
  const l=scoped.lifecycle,o=scoped.overrides,entries=[];
  (l.dayOverrideFields||[]).forEach(function(x){entries.push({kind:"dayOverrideField",entry:x,before:x.before,after:x.after,label:"Day override "+x.gymKey+" day "+(x.dayIdx+1)+" · "+x.field,storage:"lifecycle"});});
  (l.dayAdditions||[]).forEach(function(x){entries.push({kind:"dayAddition",entry:x,before:x.before,after:x.after,label:"Day addition "+x.gymKey+" day "+(x.dayIdx+1),storage:"lifecycle"});});
  (l.disabledDays||[]).forEach(function(x){entries.push({kind:"disabledDay",entry:x,before:x.before,after:x.after,label:"Disabled day "+x.gymKey+" day "+(x.dayIdx+1),storage:"lifecycle"});});
  (l.orderOverrides||[]).forEach(function(x){entries.push({kind:"orderOverride",entry:x,before:x.before,after:x.after,label:"Exercise order — "+p954FormatScopedUndoDayLabel(x),storage:"lifecycle"});});
  (o.fields||[]).forEach(function(x){entries.push({kind:"overrideField",entry:x,before:x.before,after:x.after,label:"Exercise override "+x.exerciseId+" · "+x.field,storage:"overrides"});});
  return entries;
}
function p954GetScopedUndoCurrent(lc,ov,op){const x=op.entry;if(op.kind==="dayOverrideField")return p954OwnUndoState(p954UndoRecord(lc,"dayOverrides",x.gymKey,x.dayIdx),x.field);if(op.kind==="dayAddition")return p954OwnUndoState((lc.dayAdditions||{})[x.gymKey],String(x.dayIdx));if(op.kind==="disabledDay")return p954OwnUndoState((lc.disabledDays||{})[x.gymKey],String(x.dayIdx));if(op.kind==="orderOverride")return p954OwnUndoState(lc.orderOverrides||{},x.key);return p954OwnUndoState((ov||{})[x.exerciseId],x.field);}
function p954PruneUndoEmpty(obj){if(!obj||typeof obj!=="object"||Array.isArray(obj))return obj;Object.keys(obj).forEach(function(k){p954PruneUndoEmpty(obj[k]);if(obj[k]&&typeof obj[k]==="object"&&!Array.isArray(obj[k])&&!Object.keys(obj[k]).length)delete obj[k];});return obj;}
function p954ProjectUndoUnrelated(lc,ov,scoped){const a=p954CloneUndoValue(lc),b=p954CloneUndoValue(ov);p954GetScopedUndoEntries(scoped).forEach(function(op){const x=op.entry;if(op.kind==="dayOverrideField"){const r=p954UndoRecord(a,"dayOverrides",x.gymKey,x.dayIdx);if(r)delete r[x.field];}else if(op.kind==="dayAddition"&&a.dayAdditions&&a.dayAdditions[x.gymKey])delete a.dayAdditions[x.gymKey][String(x.dayIdx)];else if(op.kind==="disabledDay"&&a.disabledDays&&a.disabledDays[x.gymKey])delete a.disabledDays[x.gymKey][String(x.dayIdx)];else if(op.kind==="orderOverride"&&a.orderOverrides)delete a.orderOverrides[x.key];else if(op.kind==="overrideField"&&b[x.exerciseId])delete b[x.exerciseId][x.field];});return{lifecycle:p954PruneUndoEmpty(a),overrides:p954PruneUndoEmpty(b)};}
function p954RestoreScopedUndoOperation(lc,ov,op){const x=op.entry,b=op.before;if(op.kind==="dayOverrideField"){lc.dayOverrides=lc.dayOverrides||{};lc.dayOverrides[x.gymKey]=lc.dayOverrides[x.gymKey]||{};const key=String(x.dayIdx),r=lc.dayOverrides[x.gymKey][key]=lc.dayOverrides[x.gymKey][key]||{};if(b.existed)r[x.field]=p954CloneUndoValue(b.value);else delete r[x.field];if(!x.recordBeforeExisted&&!Object.keys(r).length){delete lc.dayOverrides[x.gymKey][key];if(!x.gymBeforeExisted&&!Object.keys(lc.dayOverrides[x.gymKey]).length)delete lc.dayOverrides[x.gymKey];}}
  else if(op.kind==="dayAddition"||op.kind==="disabledDay"){const section=op.kind==="dayAddition"?"dayAdditions":"disabledDays",map=lc[section]=lc[section]||{},gym=map[x.gymKey]=map[x.gymKey]||{},key=String(x.dayIdx);if(b.existed)gym[key]=p954CloneUndoValue(b.value);else delete gym[key];if(!x.gymBeforeExisted&&!Object.keys(gym).length)delete map[x.gymKey];}
  else if(op.kind==="orderOverride"){lc.orderOverrides=lc.orderOverrides||{};if(b.existed)lc.orderOverrides[x.key]=p954CloneUndoValue(b.value);else delete lc.orderOverrides[x.key];}
  else {const r=ov[x.exerciseId]=ov[x.exerciseId]||{};if(b.existed)r[x.field]=p954CloneUndoValue(b.value);else delete r[x.field];if(!x.recordBeforeExisted&&!Object.keys(r).length)delete ov[x.exerciseId];}}

// Authoritative read-only eligibility/planning function. It inspects only the
// proposal and the two storage keys that undo may restore. Unrelated keys do
// not affect eligibility.
function p954BuildUndoPlan(proposalArg){
  const result={canUndo:false,alreadyUndone:false,status:"unavailable",proposalStatus:null,applicationId:null,snapshotAvailable:false,snapshotValid:false,scopedUndoAvailable:false,operations:[],conflicts:[],errors:[],warnings:[],facts:{}};
  let proposal=proposalArg;
  if(proposal===undefined){
    const inspection=p954InspectStoredProposal();
    if(!inspection.exists){result.status="no_proposal";result.errors.push("No saved proposal exists.");return result;}
    if(!inspection.parses||!inspection.validation.valid||!inspection.normalized){result.status="invalid_proposal";result.errors=result.errors.concat(inspection.validation.errors.length?inspection.validation.errors:["The saved proposal is malformed."]);return result;}
    proposal=inspection.normalized;
  }
  result.proposalStatus=proposal&&proposal.status||null;
  result.applicationId=proposal&&proposal.applicationId||null;
  const snapshotValidation=p954ValidateUndoSnapshot(proposal);
  result.snapshotAvailable=snapshotValidation.available;
  result.snapshotValid=snapshotValidation.valid;
  result.scopedUndoAvailable=snapshotValidation.scopedAvailable&&snapshotValidation.scopedValid;
  result.warnings=result.warnings.concat(snapshotValidation.warnings);
  if(proposal&&proposal.status==="undone"){
    result.status="already_undone";result.alreadyUndone=true;result.facts.idempotencyStatus="already-undone/no-op";
    if(!snapshotValidation.valid)result.warnings=result.warnings.concat(snapshotValidation.errors);
    return result;
  }
  if(!proposal||proposal.status!=="applied"){
    result.status="wrong_status";result.errors.push("Only an applied proposal can be undone.");return result;
  }
  if(!snapshotValidation.valid){
    result.status=snapshotValidation.available?"malformed_snapshot":"no_snapshot";
    result.errors=result.errors.concat(snapshotValidation.errors);return result;
  }
  const snap=proposal.preApplySnapshot;
  if(result.scopedUndoAvailable){
    const live=p954ParseUndoLiveState();if(!live.ok){result.status="malformed_current_storage";result.errors.push(live.error);return result;}
    p954GetScopedUndoEntries(snap.scopedUndo).forEach(function(op){const current=p954GetScopedUndoCurrent(live.lc,live.ov,op),isApplied=p954UndoStateEqual(current,op.after),isRestored=p954UndoStateEqual(current,op.before);op.action=isRestored?"already-restored":"restore";op.currentState=isApplied?"expected-applied":isRestored?"already-restored":"conflict";result.operations.push(op);if(!isApplied&&!isRestored)result.conflicts.push(op.label+" changed after this proposal was applied. Automatic undo is blocked to avoid overwriting newer work.");});
    result.facts={applicationIdentityVerified:true,restorationScope:"proposal-affected-paths",affectedPathCount:result.operations.length,deferredActionCounts:{replace:(proposal.applicationSummary&&proposal.applicationSummary.skippedReplaceCount)||0,add:(proposal.applicationSummary&&proposal.applicationSummary.skippedAddCount)||0,remove:(proposal.applicationSummary&&proposal.applicationSummary.skippedRemoveCount)||0,reactivate:(proposal.applicationSummary&&proposal.applicationSummary.skippedReactivateCount)||0}};
  }else{
    [{key:LIFECYCLE_KEY,label:"Exercise lifecycle",pre:snap.rawStorage.lifecycle,expected:snap.expectedAppliedRaw.lifecycle},{key:OVR,label:"Exercise overrides",pre:snap.rawStorage.overrides,expected:snap.expectedAppliedRaw.overrides}].forEach(function(t){const current=localStorage.getItem(t.key),isApplied=current===t.expected,isRestored=p954UndoRawMatches(t.pre,current);result.operations.push({key:t.key,label:t.label,action:isRestored?"already-restored":(t.pre.existed?"restore":"remove"),currentState:isApplied?"expected-applied":isRestored?"already-restored":"conflict",legacy:true,pre:t.pre});if(!isApplied&&!isRestored)result.conflicts.push(t.label+" changed after this proposal was applied. Automatic undo is blocked to avoid overwriting newer work.");});
    result.facts={applicationIdentityVerified:true,restorationScope:"legacy-whole-storage",deferredActionCounts:{replace:(proposal.applicationSummary&&proposal.applicationSummary.skippedReplaceCount)||0,add:(proposal.applicationSummary&&proposal.applicationSummary.skippedAddCount)||0,remove:(proposal.applicationSummary&&proposal.applicationSummary.skippedRemoveCount)||0,reactivate:(proposal.applicationSummary&&proposal.applicationSummary.skippedReactivateCount)||0}};
  }
  const deferredTotal=Object.keys(result.facts.deferredActionCounts).reduce(function(n,k){return n+result.facts.deferredActionCounts[k];},0);
  if(deferredTotal)result.warnings.push(deferredTotal+" replace/add/remove/reactivate action(s) were deferred during application and require no restoration.");
  result.status=result.conflicts.length?"conflict":"ready";
  result.canUndo=!result.errors.length&&!result.conflicts.length;
  return result;
}
window.p954BuildUndoPlan=p954BuildUndoPlan;

function p954CaptureUntouchedStorage(){
  return Array.from({length:localStorage.length},function(_,i){return localStorage.key(i);}).filter(function(k){return k!==LIFECYCLE_KEY&&k!==OVR&&k!==PROGRAM_PROPOSAL_KEY;}).sort().map(function(k){return[k,localStorage.getItem(k)];});
}

function p954BuildUndoneProposal(proposal,plan,undoneAt){
  return Object.assign({},proposal,{status:"undone",undoneAt:undoneAt,undoSummary:{
    status:"success",
    applicationId:proposal.applicationId,
    storageResults:plan.operations.map(function(op){return{key:op.key||op.label,action:op.action==="already-restored"?"verified-already-restored":op.action};}),
    exactRawRestorationVerified:true,
    exactAffectedStateRestorationVerified:true,
    unrelatedStatePreserved:true,
    validationFacts:{applicationIdentityVerified:true,restorationScope:plan.facts.restorationScope,affectedPathCount:plan.facts.affectedPathCount||0,exactAffectedStateRestorationVerified:true,unrelatedStatePreserved:true,idempotencyAfterUndo:"already-undone/no-op"},
    deferredActionCounts:Object.assign({},plan.facts.deferredActionCounts)
  }});
}

function p954VerifyUndoPostState(proposalBefore,untouchedBefore,pBefore,unrelatedBefore,plan){
  const errors=[],snap=proposalBefore.preApplySnapshot,live=p954ParseUndoLiveState();
  if(!live.ok)errors.push(live.error);
  else if(plan.facts.restorationScope==="proposal-affected-paths"){
    plan.operations.forEach(function(op){if(!p954UndoStateEqual(p954GetScopedUndoCurrent(live.lc,live.ov,op),op.before))errors.push(op.label+" was not restored to its exact pre-apply value.");});
    const unrelatedAfter=p954ProjectUndoUnrelated(live.lc,live.ov,snap.scopedUndo);if(!p954UndoDeepEqual(unrelatedBefore,unrelatedAfter))errors.push("Unrelated lifecycle or override state changed during undo.");
  }else {if(!p954UndoRawMatches(snap.rawStorage.lifecycle,localStorage.getItem(LIFECYCLE_KEY)))errors.push("Exercise lifecycle exact raw restoration failed.");if(!p954UndoRawMatches(snap.rawStorage.overrides,localStorage.getItem(OVR)))errors.push("Exercise overrides exact raw restoration failed.");}
  const inspection=p954InspectStoredProposal(),post=inspection.normalized;
  if(!inspection.exists||!inspection.parses||!inspection.validation.valid||!post)errors.push("Undone proposal record failed validation.");
  else {
    if(post.status!=="undone")errors.push("Proposal status is not undone.");
    if(post.applicationId!==proposalBefore.applicationId||post.appliedAt!==proposalBefore.appliedAt||!post.applicationSummary||!post.preApplySnapshot)errors.push("Original application audit information was not preserved.");
    if(!post.undoneAt||!post.undoSummary||post.undoSummary.exactRawRestorationVerified!==true||post.undoSummary.exactAffectedStateRestorationVerified!==true||post.undoSummary.unrelatedStatePreserved!==true)errors.push("Undo audit metadata is missing or invalid.");
    const idempotent=p954BuildUndoPlan(post);if(!idempotent.alreadyUndone||idempotent.canUndo)errors.push("Undo is not idempotent after completion.");
  }
  if(JSON.stringify(P)!==pBefore)errors.push("Base program P changed during undo.");
  if(JSON.stringify(p954CaptureUntouchedStorage())!==JSON.stringify(untouchedBefore))errors.push("An unrelated storage key changed during undo.");
  return{valid:!errors.length,errors:errors};
}

// Final mutation path with an immediate direct-call preflight and byte-exact
// rollback of every touched key on any error.
function p954UndoAppliedProposal(){
  let rollback=null;
  try{
    const inspection=p954InspectStoredProposal();
    if(!inspection.exists||!inspection.parses||!inspection.validation.valid||!inspection.normalized)return{ok:false,error:"The saved proposal is missing, corrupted, or invalid."};
    const proposal=inspection.normalized;
    if(proposal.status==="undone"){p954LastUndoVerification.idempotencyStatus="already-undone/no-op";return{ok:true,alreadyUndone:true,noOp:true,applicationId:proposal.applicationId};}
    const plan=p954BuildUndoPlan(proposal);p954LastUndoValidationErrors=plan.errors.concat(plan.conflicts);
    if(!plan.canUndo)return{ok:false,error:"Cannot undo safely: "+p954LastUndoValidationErrors.join(" "),plan:plan};
    rollback=p954CaptureRollbackSnapshot();
    const untouchedBefore=p954CaptureUntouchedStorage(),pBefore=JSON.stringify(P),snap=proposal.preApplySnapshot,live=p954ParseUndoLiveState();
    if(!live.ok)throw new Error(live.error);
    const unrelatedBefore=plan.facts.restorationScope==="proposal-affected-paths"?p954ProjectUndoUnrelated(live.lc,live.ov,snap.scopedUndo):null;
    if(plan.facts.restorationScope==="proposal-affected-paths"){
      const needLifecycle=plan.operations.some(function(op){return op.storage==="lifecycle"&&op.action==="restore"}),needOverrides=plan.operations.some(function(op){return op.storage==="overrides"&&op.action==="restore"});
      plan.operations.forEach(function(op){if(op.action==="restore")p954RestoreScopedUndoOperation(live.lc,live.ov,op);});
      if(needLifecycle)localStorage.setItem(LIFECYCLE_KEY,JSON.stringify(live.lc));
      if(needOverrides)localStorage.setItem(OVR,JSON.stringify(live.ov));
    }else plan.operations.forEach(function(op){if(op.action!=="already-restored")op.pre.existed?localStorage.setItem(op.key,op.pre.rawText):localStorage.removeItem(op.key);});
    const undone=p954NormalizeProposal(p954BuildUndoneProposal(proposal,plan,new Date().toISOString()));
    localStorage.setItem(PROGRAM_PROPOSAL_KEY,JSON.stringify(undone));
    const verify=p954VerifyUndoPostState(proposal,untouchedBefore,pBefore,unrelatedBefore,plan);p954LastPostUndoValidationErrors=verify.errors.slice();
    if(!verify.valid)throw new Error(verify.errors.join(" "));
    p954LastUndoVerification={exactRawRestorationVerified:true,unrelatedStatePreserved:true,idempotencyStatus:"already-undone/no-op"};
    return{ok:true,applicationId:proposal.applicationId,summary:undone.undoSummary};
  }catch(e){
    const restored=rollback?p954RestoreFromRollbackSnapshot(rollback):true;
    p954LastPostUndoValidationErrors=[(e&&e.message)||"Unknown error"];
    p954LastUndoVerification={exactRawRestorationVerified:false,unrelatedStatePreserved:false,idempotencyStatus:null};
    return{ok:false,error:"Undo failed; "+(restored?"all touched keys were restored exactly":"exact failure rollback could not be completed")+": "+((e&&e.message)||"Unknown error")};
  }
}
window.p954UndoAppliedProposal=p954UndoAppliedProposal;

window.mfOnboardingProgramProposalUndoDebug=function(){
  try{
    const inspection=p954InspectStoredProposal(),proposal=inspection.normalized,plan=p954BuildUndoPlan(),snapshotValidation=p954ValidateUndoSnapshot(proposal);
    const result={readOnly:true,proposalStatus:proposal?proposal.status:null,applicationId:proposal?proposal.applicationId:null,appliedAt:proposal?proposal.appliedAt:null,undoneAt:proposal?proposal.undoneAt:null,snapshotAvailable:snapshotValidation.available,snapshotValid:snapshotValidation.valid,scopedUndoAvailable:snapshotValidation.scopedAvailable,scopedUndoValid:snapshotValidation.scopedValid,undoScopeMode:plan.facts.restorationScope||null,canUndo:plan.canUndo,undoStatus:plan.status,undoPlanOperations:plan.operations,undoConflicts:plan.conflicts,undoErrors:plan.errors,undoWarnings:plan.warnings,lastUndoValidationErrors:p954LastUndoValidationErrors.slice(),lastPostUndoValidationErrors:p954LastPostUndoValidationErrors.slice(),exactRawRestorationVerification:p954LastUndoVerification.exactRawRestorationVerified,unrelatedStatePreserved:p954LastUndoVerification.unrelatedStatePreserved,idempotencyStatus:plan.alreadyUndone?"already-undone/no-op":p954LastUndoVerification.idempotencyStatus};
    console.log("[MarcusFit] mfOnboardingProgramProposalUndoDebug():",result);return result;
  }catch(e){const result={readOnly:true,error:(e&&e.message)||"Unknown error"};console.warn("[MarcusFit] mfOnboardingProgramProposalUndoDebug failed:",e&&e.message);return result;}
};
var mfOnboardingProgramProposalUndoDebug=window.mfOnboardingProgramProposalUndoDebug;

// ── END PHASE 9.5.4E PROPOSAL APPLICATION + UNDO ENGINE ──────────────────────

// REQUIREMENT 10: read-only debug/inspection helper. Never writes storage.
window.mfOnboardingProgramProposalDebug = function(){
  try {
    const proposal = p954GetProposal();
    // 9.5.4B.1: raw-storage inspection drives validity/reviewability now —
    // p954ValidateProgramProposal() on the already-normalized proposal would
    // always look valid, since normalization repairs invalid fields first.
    const inspection = p954InspectStoredProposal();
    const validation = inspection.validation;
    // 9.5.4B.2: storedProposalNormalizedValid must reflect actual structural
    // validation of the normalized read model, not merely that normalization
    // returned an object (normalization always "succeeds" by coercing to
    // safe defaults, so !!inspection.normalized was true even for corrupted
    // structures where normalization also failed for unrelated reasons).
    const normalizedValidation = inspection.normalized ? p954ValidateProgramProposal(inspection.normalized) : { valid: false, errors: [] };
    const compatibility = proposal ? p954CheckProgramCompatibility(proposal) : null;
    // 9.5.4B: review-layer fields — UI-state only, never persisted.
    const canReview = !!proposal && validation.valid;
    const canDismiss = !!proposal && (proposal.status === "draft" || proposal.status === "dismissed");
    // 9.5.4C: application-engine fields. Plan is computed read-only purely
    // for debug visibility — never triggers a write.
    const appPlan = (proposal && validation.valid) ? p954BuildApplicationPlan(proposal) : null;
    const canApply = !!proposal && validation.valid && proposal.status === "draft";
    const undoPlan = p954BuildUndoPlan(proposal === null ? undefined : proposal);
    const lcForDebug = getLifecycle();
    let appliedDayOverrideCount = 0, appliedDayAdditionCount = 0;
    if(proposal && proposal.applicationId){
      const tag = "proposal:" + proposal.applicationId;
      Object.keys(lcForDebug.dayOverrides || {}).forEach(function(g){
        Object.keys(lcForDebug.dayOverrides[g] || {}).forEach(function(k){
          const rec = lcForDebug.dayOverrides[g][k];
          if(rec && typeof rec.reason === "string" && rec.reason.indexOf(tag) === 0) appliedDayOverrideCount++;
        });
      });
      Object.keys(lcForDebug.dayAdditions || {}).forEach(function(g){
        Object.keys(lcForDebug.dayAdditions[g] || {}).forEach(function(k){
          const rec = lcForDebug.dayAdditions[g][k];
          if(rec && typeof rec.reason === "string" && rec.reason.indexOf(tag) === 0) appliedDayAdditionCount++;
        });
      });
    }
    const result = {
      proposalExists: !!proposal,
      proposalStatus: proposal ? proposal.status : null,
      proposalVersion: proposal ? proposal.proposalVersion : null,
      sourceType: proposal ? proposal.sourceType : null,
      sourceSummary: proposal ? proposal.sourceSummary : null,
      sourceQuality: proposal ? p955GetProposalQualityMetrics(proposal) : null,
      validation: validation,
      summary: proposal ? proposal.summary : null,
      affectedDayCount: proposal ? proposal.summary.affectedDayCount : 0,
      actionCounts: proposal ? proposal.summary.actionCounts : null,
      currentProgramCompatibility: compatibility,
      warnings: proposal ? proposal.warnings : [],
      backupIncluded: p8IsMarcusFitKey(PROGRAM_PROPOSAL_KEY),
      reviewOpen: p954ReviewOpenFlag,
      canReview: canReview,
      canDismiss: canDismiss,
      dismissedAt: proposal ? proposal.dismissedAt : null,
      renderedGymGroups: p954RLastRenderedGymGroups,
      renderedDayCount: p954RLastRenderedDayCount,
      // 9.5.4B.1: concise raw-storage inspection fields only — no raw text,
      // no full parsed/normalized object dumps.
      storedProposalExists: inspection.exists,
      storedProposalParses: inspection.parses,
      storedProposalRawValid: inspection.validation.valid,
      storedProposalNormalizedValid: normalizedValidation.valid,
      storedProposalErrors: inspection.validation.errors,
      // 9.5.4C: application-engine debug fields.
      status: proposal ? proposal.status : null,
      appliedAt: proposal ? proposal.appliedAt : null,
      undoneAt: proposal ? proposal.undoneAt : null,
      applicationId: proposal ? proposal.applicationId : null,
      canApply: canApply,
      canUndo: undoPlan.canUndo,
      undoPlanOperations: undoPlan.operations,
      undoConflicts: undoPlan.conflicts,
      undoWarnings: undoPlan.warnings,
      undoSnapshotAvailable: undoPlan.snapshotAvailable,
      undoSnapshotValid: undoPlan.snapshotValid,
      lastUndoValidationErrors: p954LastUndoValidationErrors.slice(),
      lastPostUndoValidationErrors: p954LastPostUndoValidationErrors.slice(),
      exactRawRestorationVerified: p954LastUndoVerification.exactRawRestorationVerified,
      undoIdempotencyStatus: undoPlan.alreadyUndone ? "already-undone/no-op" : p954LastUndoVerification.idempotencyStatus,
      plannedKeepCount: appPlan ? appPlan.counts.keep : 0,
      plannedModifyCount: appPlan ? appPlan.counts.modify : 0,
      plannedRemoveCount: appPlan ? appPlan.counts.remove : 0,
      plannedOptionalAddCount: appPlan ? appPlan.counts.optional_add : 0,
      skippedExerciseActionCount: appPlan ? appPlan.counts.skippedExerciseActionCount : 0,
      plannedReorderCount: appPlan ? appPlan.counts.plannedReorderCount : 0,
      plannedExerciseModifyCount: appPlan ? appPlan.counts.plannedExerciseModifyCount : 0,
      skippedReplaceCount: appPlan ? appPlan.counts.skippedReplaceCount : 0,
      skippedAddCount: appPlan ? appPlan.counts.skippedAddCount : 0,
      skippedRemoveCount: appPlan ? appPlan.counts.skippedRemoveCount : 0,
      skippedReactivateCount: appPlan ? appPlan.counts.skippedReactivateCount : 0,
      appliedOrderOverrideCount: proposal && proposal.applicationSummary ? (proposal.applicationSummary.reorderedDayCount||0) : 0,
      appliedExerciseOverrideCount: proposal && proposal.applicationSummary ? (proposal.applicationSummary.modifiedExerciseCount||0) : 0,
      activeExerciseCountBefore: p954LastSafetyFacts.before,
      activeExerciseCountAfter: p954LastSafetyFacts.after,
      exerciseIdsUnchanged: p954LastSafetyFacts.idsUnchanged,
      liveValidationErrors: p954LastLiveValidationErrors.slice(),
      postApplyValidationErrors: p954LastPostApplyValidationErrors.slice(),
      applicationPlanValid: appPlan ? appPlan.valid : null,
      applicationPlanErrors: appPlan ? appPlan.errors : [],
      disabledDayCount: getDisabledDayCount(lcForDebug),
      appliedDayOverrideCount: appliedDayOverrideCount,
      appliedDayAdditionCount: appliedDayAdditionCount
    };
    console.log("[MarcusFit] mfOnboardingProgramProposalDebug():", result);
    return result;
  } catch(e){
    const result = { error: (e && e.message) || "Unknown error" };
    console.warn("[MarcusFit] mfOnboardingProgramProposalDebug failed:", e && e.message);
    return result;
  }
};

// ── REQUIREMENT 8: auto-generate a draft proposal after successful REAL
// onboarding completion only (never preview). Never blocks or reopens
// onboarding — failures here are swallowed (logged, not surfaced to the
// completion UI) since proposal generation is a bonus, not a requirement of
// completing onboarding.
// ── FUTURE MODULE: src/debug.js (proposal debug/export integration) ─────────
window.mfOnboardingProgramProposalSourceDebug = function(){
  try {
    const inspection=p954InspectStoredProposal(),proposal=inspection.normalized;
    const metrics=proposal?p955GetProposalQualityMetrics(proposal):null;
    const undo=proposal?p954BuildUndoPlan(proposal):{canUndo:false,status:"no_proposal"};
    const derivedActions=p955GetDerivedProposalActionCounts(proposal);
    const actionCountsByType=derivedActions.byType;
    const result={
      readOnly:true,
      proposalExists:inspection.exists,
      proposalParses:inspection.parses,
      proposalValid:inspection.validation.valid,
      proposalValidationErrors:inspection.validation.errors,
      proposalValidationWarnings:inspection.validation.warnings||[],
      proposalId:proposal?(proposal.applicationId||((proposal.generatedAt||"draft")+"|"+proposal.proposalVersion)):null,
      status:proposal?proposal.status:null,
      sourceType:proposal?proposal.sourceType:null,
      appearsFixture:!!(proposal&&proposal.sourceType==="fixture"),
      appearsLocallyGenerated:!!(proposal&&proposal.sourceType==="local_generated"),
      appearsLegacy:!!(proposal&&proposal.sourceType==="legacy"),
      sourceCoverage:metrics?metrics.sourceCoverage:null,
      sourceDetails:proposal?proposal.sourceSummary:null,
      sourceWarnings:proposal&&proposal.sourceSummary?proposal.sourceSummary.sourceWarnings:[],
      actionCountsByType:actionCountsByType,
      actionCounts:derivedActions.counts,
      flatDerivedCountSummary:p955FormatProposalActionCounts(derivedActions.counts),
      safeApplyCount:metrics?metrics.safeApplyCount:0,
      deferredCount:metrics?metrics.deferredCount:0,
      conflictCount:metrics?metrics.conflictCount:0,
      warningCount:metrics?metrics.warningCount:0,
      undoEligibility:{status:undo.status,canUndo:undo.canUndo,alreadyUndone:undo.alreadyUndone||false,snapshotAvailable:undo.snapshotAvailable||false,snapshotValid:undo.snapshotValid||false,conflictCount:(undo.conflicts||[]).length},
      visibleSummaryTextSafety:p955VisibleSummaryTextSafety(proposal)
    };
    console.log("[MarcusFit] mfOnboardingProgramProposalSourceDebug():",result);
    return result;
  } catch(e){
    const result={readOnly:true,error:(e&&e.message)||"Unknown error"};
    console.warn("[MarcusFit] mfOnboardingProgramProposalSourceDebug failed:",e&&e.message);
    return result;
  }
};
var mfOnboardingProgramProposalSourceDebug=window.mfOnboardingProgramProposalSourceDebug;

function p954MaybeGenerateProposalAfterRealCompletion(){
  try {
    p954GenerateAndSaveProposal();
  } catch(e){
    console.warn("[MarcusFit] p954MaybeGenerateProposalAfterRealCompletion failed safely:", e && e.message);
  }
}

// ── FUTURE MODULE: src/proposal-ui.js ────────────────────────────────────────
// ── Sync-tab UI ──────────────────────────────────────────────────────────────
// All rendering uses textContent / safe DOM creation only — never innerHTML
// with onboarding-, profile-, or program-derived strings (day names, goal
// text, equipment notes, etc. are all user-entered).
let p954SummaryVisible = false;

// ── 9.5.4B: detailed review overlay state (UI-layer only — never persisted) ──
let p954ReviewOpenFlag = false;      // true while the review overlay is open
let p954ReviewInvalid = false;       // true when the stored proposal failed validation at open-time
let p954ReviewInvalidErrors = [];    // validation error strings for the error state
let p954RLastRenderedGymGroups = 0;  // debug: gym groups rendered in the last built review
let p954RLastRenderedDayCount = 0;   // debug: day cards rendered in the last built review
let p954RLastRenderedExerciseCount = 0; // debug: exercise rows rendered in the last built review

// ── 9.5.4C: apply-preview UI state (UI-layer only — never persisted) ────────
let p954ApplyPreviewOpenFlag = false;   // true while the apply preview/confirm panel is open
let p954ApplyFingerprint = null;        // proposal fingerprint captured when the preview opened
let p954RLastRenderedAppliedSummary = null; // debug: last-rendered applied-state summary object
let p954UndoPreviewOpenFlag = false;    // 9.5.4E: true while the undo preview is open

function p954ShowResult(msg, type){
  const el = document.getElementById("p954Result");
  if(!el) return;
  el.style.display = "block";
  el.style.color = type === "ok" ? "var(--green)" : type === "err" ? "var(--red)" : type === "warn" ? "var(--yellow)" : "var(--text)";
  el.style.whiteSpace = "pre-wrap";
  el.textContent = msg;
}

// `dayPlans` is the executable review model. Stored summary counts are useful
// for older records, but can be absent or stale (especially in developer QA
// fixtures), so display/debug counts are always derived from normalized plans.
function p955GetDerivedProposalActionCounts(proposal){
  const counts={keep:0,modify:0,reorder:0,replace:0,add:0,remove:0,optional_add:0,reactivate:0};
  const byType={};
  (Array.isArray(proposal&&proposal.dayPlans)?proposal.dayPlans:[]).forEach(function(dp){
    const dayAction=PROGRAM_PROPOSAL_DAY_ACTIONS.indexOf(dp&&dp.action)!==-1?dp.action:"keep";
    counts[dayAction]++;
    byType["day:"+dayAction]=(byType["day:"+dayAction]||0)+1;
    if(Array.isArray(dp&&dp.proposedExerciseOrder)){
      counts.reorder++;
      byType["exercise:reorder"]=(byType["exercise:reorder"]||0)+1;
    }
    (Array.isArray(dp&&dp.exerciseActions)?dp.exerciseActions:[]).forEach(function(ea){
      const action=PROGRAM_PROPOSAL_EXERCISE_ACTIONS.indexOf(ea&&ea.action)!==-1?ea.action:"keep";
      if(Object.prototype.hasOwnProperty.call(counts,action)) counts[action]++;
      byType["exercise:"+action]=(byType["exercise:"+action]||0)+1;
    });
  });
  return {counts:counts,byType:byType};
}

function p955FormatProposalActionCounts(counts){
  const c=counts||{};
  return "keep "+(c.keep||0)+" · modify "+(c.modify||0)+" · reorder "+(c.reorder||0)+" · replace "+(c.replace||0)+" · add "+(c.add||0)+" · optional add "+(c.optional_add||0)+" · remove "+(c.remove||0)+" · reactivate "+(c.reactivate||0);
}

function p955VisibleSummaryTextSafety(proposal){
  const metrics=p955GetProposalQualityMetrics(proposal);
  const sample=[proposal&&proposal.status,proposal&&proposal.sourceType,proposal&&proposal.generatedAt,p955FormatProposalActionCounts(metrics.actionCounts),metrics.safeApplyCount,metrics.deferredCount,metrics.conflictCount].map(function(v){return String(v===null||v===undefined?"":v);}).join(" | ");
  const unsafeTokens=["undefined","null","[object Object]"].filter(function(token){return sample.indexOf(token)!==-1;});
  return {safe:unsafeTokens.length===0,unsafeTokens:unsafeTokens,sample:sample};
}

function p955GetProposalQualityMetrics(proposal){
  const plan = proposal ? p954BuildApplicationPlan(proposal) : null;
  const ops = plan && Array.isArray(plan.ops) ? plan.ops : [];
  const safeApplyCount = ops.filter(function(op){
    return op.type === "dayOverride"
      || (op.type === "orderOverride" && !op.conflict && op.writeNeeded)
      || (op.type === "exerciseOverride" && !op.conflict && op.writeNeeded);
  }).length;
  const deferredCount = plan ? ((plan.counts.deferredDayLifecycleCount||0) + (plan.counts.skippedExerciseActionCount||0)) : 0;
  const conflictCount = ops.filter(function(op){ return op.conflict; }).length + (plan ? plan.errors.length : 0);
  const ss = proposal && proposal.sourceSummary ? proposal.sourceSummary : {};
  const derivedActions=p955GetDerivedProposalActionCounts(proposal);
  const coverageFields = ["profileUsed","onboardingUsed","coachingPrefsUsed","currentProgramUsed","lifecycleUsed","recentLogsUsed"];
  return {
    safeApplyCount: safeApplyCount,
    deferredCount: deferredCount,
    conflictCount: conflictCount,
    actionCounts: derivedActions.counts,
    actionCountsByType: derivedActions.byType,
    warningCount: ((proposal && proposal.warnings) || []).length + ((ss && ss.sourceWarnings) || []).length,
    sourceCoverageCount: coverageFields.filter(function(f){ return ss[f] === true; }).length,
    sourceCoverageTotal: coverageFields.length,
    sourceCoverage: coverageFields.reduce(function(acc, f){ acc[f] = ss[f] === true; return acc; }, {}),
    plan: plan
  };
}

function p955BuildProposalStatusCard(proposal){
  const card = document.createElement("div");
  card.style.cssText = "background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:11px 13px;margin-bottom:10px;font-size:12px;line-height:1.55;";
  const metrics = p955GetProposalQualityMetrics(proposal);
  const sourceLabel = proposal.sourceType === "fixture" ? "Developer fixture / test"
    : proposal.sourceType === "local_generated" ? "Generated from current app data"
    : "Legacy / source details missing";
  [
    ["Status", proposal.status],
    ["Source", sourceLabel],
    ["Generated", proposal.generatedAt ? new Date(proposal.generatedAt).toLocaleString() : "Not recorded"],
    ["Coverage", metrics.sourceCoverageCount + "/" + metrics.sourceCoverageTotal + " source groups used"],
    ["Action counts", p955FormatProposalActionCounts(metrics.actionCounts)],
    ["Actions", metrics.safeApplyCount + " supported · " + metrics.deferredCount + " deferred"],
    ["Warnings", (metrics.warningCount + metrics.conflictCount) + " warning/conflict item(s)"]
  ].forEach(function(pair){
    const row=document.createElement("div"),label=document.createElement("span"),value=document.createElement("span");
    label.style.cssText="font-weight:700;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.4px;";
    label.textContent=pair[0]+": "; value.textContent=String(pair[1]); row.appendChild(label); row.appendChild(value); card.appendChild(row);
  });
  if(proposal.status === "applied"){
    const undo = p954BuildUndoPlan(proposal), line=document.createElement("div");
    line.style.cssText="margin-top:4px;color:"+(undo.canUndo?"var(--green)":"var(--yellow)")+";";
    line.textContent=undo.canUndo?"Undo available for supported applied changes.":"Undo unavailable: "+(undo.conflicts[0]||undo.errors[0]||"saved snapshot is not eligible.");
    card.appendChild(line);
  } else if(proposal.status === "undone"){
    const line=document.createElement("div");line.style.cssText="margin-top:4px;color:var(--muted);";line.textContent="This proposal was undone. Repeating undo is a no-write no-op.";card.appendChild(line);
  } else if(metrics.conflictCount){
    const line=document.createElement("div");line.style.cssText="margin-top:4px;color:var(--yellow);";line.textContent="Supported changes cannot be applied until conflicts are resolved.";card.appendChild(line);
  } else if(metrics.safeApplyCount===0){
    const line=document.createElement("div");line.style.cssText="margin-top:4px;color:var(--muted);";line.textContent="Review only — there are no supported changes to apply.";card.appendChild(line);
  }
  return card;
}

function p954BuildSummaryCard(proposal){
  const card = document.createElement("div");
  card.style.cssText = "background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-top:10px;font-size:12px;line-height:1.6;";
  const s = proposal.summary || {};

  function addRow(label, value){
    if(value === null || value === undefined || value === "") return;
    const row = document.createElement("div");
    row.style.marginBottom = "6px";
    const l = document.createElement("span");
    l.style.cssText = "font-weight:700;color:var(--muted);text-transform:uppercase;font-size:10px;letter-spacing:0.5px;";
    l.textContent = label + ": ";
    const v = document.createElement("span");
    v.style.color = "var(--text)";
    v.textContent = String(value);
    row.appendChild(l);
    row.appendChild(v);
    card.appendChild(row);
  }

  addRow("Recommended Frequency", s.recommendedFrequency ? (s.recommendedFrequency + "/week") : "No specific answer on file");
  addRow("Gym Mode(s)", (s.gymModes && s.gymModes.length) ? s.gymModes.join(", ") : "—");
  addRow("Est. Session Duration", s.estimatedSessionDurationMinutes ? (s.estimatedSessionDurationMinutes + " min") : "—");
  addRow("Affected Day Count", s.affectedDayCount);
  const ac = p955GetDerivedProposalActionCounts(proposal).counts;
  addRow("Action Counts", p955FormatProposalActionCounts(ac));

  if((s.rationale || []).length){
    const rl = document.createElement("div");
    rl.style.marginTop = "8px";
    const rlabel = document.createElement("div");
    rlabel.style.cssText = "font-weight:700;color:var(--muted);text-transform:uppercase;font-size:10px;letter-spacing:0.5px;margin-bottom:4px;";
    rlabel.textContent = "Rationale";
    rl.appendChild(rlabel);
    s.rationale.forEach(function(r){
      const p = document.createElement("div");
      p.style.cssText = "margin-bottom:3px;";
      p.textContent = "• " + r;
      rl.appendChild(p);
    });
    card.appendChild(rl);
  }

  if((proposal.warnings || []).length){
    const wl = document.createElement("div");
    wl.style.marginTop = "8px";
    const wlabel = document.createElement("div");
    wlabel.style.cssText = "font-weight:700;color:var(--red);text-transform:uppercase;font-size:10px;letter-spacing:0.5px;margin-bottom:4px;";
    wlabel.textContent = "Warnings";
    wl.appendChild(wlabel);
    proposal.warnings.forEach(function(w){
      const p = document.createElement("div");
      p.style.cssText = "margin-bottom:3px;color:var(--red);";
      p.textContent = "⚠ " + w;
      wl.appendChild(p);
    });
    card.appendChild(wl);
  }

  const meta = document.createElement("div");
  meta.style.cssText = "margin-top:8px;font-size:10px;color:var(--muted);";
  meta.textContent = "Generated: " + (proposal.generatedAt ? new Date(proposal.generatedAt).toLocaleString() : "—") + " · Status: " + proposal.status + (proposal.status==="draft"||proposal.status==="dismissed"?" · No changes applied to your program.":"");
  card.appendChild(meta);

  return card;
}

// Compact, non-toggling summary shown under the dismissed state. Deliberately
// smaller than p954BuildSummaryCard (no rationale/warnings list) — the full
// detail is only ever a VIEW DISMISSED PROPOSAL tap away, and that view stays
// read-only. Uses textContent only.
function p954BuildDismissedSummary(proposal){
  const card = document.createElement("div");
  card.style.cssText = "background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-top:10px;font-size:12px;line-height:1.6;";
  const s = proposal.summary || {};

  const line1 = document.createElement("div");
  line1.style.cssText = "font-weight:700;color:var(--green);margin-bottom:6px;";
  line1.textContent = "✓ Current program kept";
  card.appendChild(line1);

  const line2 = document.createElement("div");
  line2.style.cssText = "color:var(--muted);margin-bottom:6px;";
  line2.textContent = "Proposal generated: " + (proposal.generatedAt ? new Date(proposal.generatedAt).toLocaleString() : "—")
    + (proposal.dismissedAt ? (" · Dismissed: " + new Date(proposal.dismissedAt).toLocaleString()) : "");
  card.appendChild(line2);

  const ac = p955GetDerivedProposalActionCounts(proposal).counts;
  const line3 = document.createElement("div");
  line3.style.color = "var(--text)";
  line3.textContent = (s.recommendedFrequency ? (s.recommendedFrequency + "/week lifting requested · ") : "")
    + "affected days: " + (s.affectedDayCount || 0)
    + " · " + p955FormatProposalActionCounts(ac);
  card.appendChild(line3);

  return card;
}

// Applied-state summary card: shown when a proposal's supported day-level
// changes have been applied. Read-only reflection of applicationSummary —
// never triggers any write itself. Uses textContent only.
function p954BuildAppliedSummaryCard(proposal){
  const card = document.createElement("div");
  card.style.cssText = "background:var(--surface2);border:1px solid var(--accent);border-radius:10px;padding:12px 14px;margin-top:10px;font-size:12px;line-height:1.6;";
  const s = proposal.applicationSummary || {};

  const line1 = document.createElement("div");
  line1.style.cssText = "font-weight:700;color:var(--accent);margin-bottom:6px;";
  line1.textContent = "✅ Proposal applied";
  card.appendChild(line1);

  const line2 = document.createElement("div");
  line2.style.cssText = "color:var(--muted);margin-bottom:6px;";
  line2.textContent = "Applied: " + (proposal.appliedAt ? new Date(proposal.appliedAt).toLocaleString() : "—");
  card.appendChild(line2);

  const line3 = document.createElement("div");
  line3.style.cssText = "color:var(--text);margin-bottom:6px;";
  line3.textContent = "Modified " + (s.modifyCount||0) + " · Disabled " + (s.disabledCount||0)
    + " · Added " + (s.addedCount||0) + " · Kept " + (s.keepCount||0)
    + " · Skipped (exercise-level, unsupported) " + (s.skippedExerciseActionCount||0);
  card.appendChild(line3);

  const line4 = document.createElement("div");
  line4.style.cssText = "color:var(--muted);font-size:11px;";
  line4.textContent = "Disabled days are hidden, not deleted — history for those days remains fully intact.";
  card.appendChild(line4);

  return card;
}

function p954BuildUndoneSummaryCard(proposal){
  const card=document.createElement("div"),summary=proposal.undoSummary||{};card.style.cssText="background:var(--surface2);border:1px solid var(--green);border-radius:10px;padding:12px 14px;margin-top:10px;font-size:12px;line-height:1.6;";
  const heading=document.createElement("div");heading.style.cssText="font-weight:700;color:var(--green);margin-bottom:6px;";heading.textContent="↩ Proposal changes undone";card.appendChild(heading);
  const applied=document.createElement("div");applied.style.cssText="color:var(--muted);margin-bottom:6px;";applied.textContent="Applied: "+(proposal.appliedAt?new Date(proposal.appliedAt).toLocaleString():"—");card.appendChild(applied);
  const line=document.createElement("div");line.style.cssText="color:var(--muted);";
  const restored=(summary.storageResults||[]).map(function(r){return r.key+" ("+r.action+")";});
  line.textContent="Undone: "+(proposal.undoneAt?new Date(proposal.undoneAt).toLocaleString():"—")+(restored.length?" · "+restored.join(" · "):"");
  card.appendChild(line);
  const history=document.createElement("div");history.style.cssText="color:var(--muted);font-size:11px;margin-top:5px;";history.textContent="Workout logs and history were not deleted or rewritten. This saved record retains the original application audit.";card.appendChild(history);
  return card;
}


// Renders the Program Personalization section in the Sync tab based on
// current proposal state. Never generates a proposal itself — purely reads
// p954GetProposal() and reflects what's there.
function p954RenderProgramPersonalization(){
  const container = document.getElementById("p954Container");
  if(!container) return;
  container.innerHTML = ""; // clears app-authored placeholder only, not user data
  const firstSyncStatus=p957GetSharedUserFirstSyncStatus();
  if(firstSyncStatus.isLikelyFirstSync){
    const note=document.createElement("div");
    note.className="info-box";
    note.style.cssText="font-size:11px;margin-bottom:10px;color:var(--muted);";
    note.textContent="New/shared user detected: use the AI export for a first-time program personalization pass before assuming the default program fits.";
    container.appendChild(note);
  }

  // REQUIREMENT 4 (9.5.4B.1): inspect the RAW stored proposal read-only on
  // every render — including page load, before the user ever taps REVIEW —
  // so a malformed or genuinely invalid stored proposal is never presented
  // as a normal draft/no-proposal record. Never writes storage.
  const inspection = p954InspectStoredProposal();

  if(!inspection.exists){
    p954ReviewInvalid = false;
    p954ReviewInvalidErrors = [];
    const btn = document.createElement("button");
    btn.className = "big-btn btn-sync";
    btn.style.marginBottom = "0";
    btn.textContent = "🧭 GENERATE PROGRAM PROPOSAL";
    btn.onclick = p954HandleGenerateClick;
    container.appendChild(btn);
    const resultEl = document.createElement("div");
    resultEl.className = "sync-result";
    resultEl.id = "p954Result";
    container.appendChild(resultEl);
    return;
  }

  if(!inspection.parses || !inspection.validation.valid){
    p954ReviewInvalid = true;
    p954ReviewInvalidErrors = inspection.validation.errors;
  } else {
    p954ReviewInvalid = false;
    p954ReviewInvalidErrors = [];
  }

  // REQUIREMENT 6: a stored proposal that failed validation gets a dedicated
  // error state instead of draft/dismissed controls — the proposal stays
  // stored untouched (for debugging/regeneration), only regenerate/clear are
  // offered. Do NOT auto-repair or overwrite invalid storage.
  if(p954ReviewInvalid){
    const errBox = document.createElement("div");
    errBox.className = "p954r-error-box";
    const title = document.createElement("div");
    title.style.cssText = "font-weight:700;margin-bottom:6px;";
    title.textContent = "⚠ This stored proposal failed validation and can't be reviewed safely.";
    errBox.appendChild(title);
    (p954ReviewInvalidErrors || []).forEach(function(e){
      const line = document.createElement("div");
      line.textContent = "• " + e;
      errBox.appendChild(line);
    });
    container.appendChild(errBox);

    const errBtnRow = document.createElement("div");
    errBtnRow.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-top:10px;";
    const regenBtn2 = document.createElement("button");
    regenBtn2.className = "big-btn";
    regenBtn2.style.cssText = "background:transparent;color:var(--accent);border:1px solid var(--accent);margin-bottom:0;";
    regenBtn2.textContent = "🔄 REGENERATE PROPOSAL";
    regenBtn2.onclick = p954HandleGenerateClick;
    errBtnRow.appendChild(regenBtn2);
    const clearBtn2 = document.createElement("button");
    clearBtn2.className = "big-btn";
    clearBtn2.style.cssText = "background:transparent;color:var(--red);border:1px solid var(--red);margin-bottom:0;";
    clearBtn2.textContent = "🗑 CLEAR PROPOSAL";
    clearBtn2.onclick = p954HandleClearClick;
    errBtnRow.appendChild(clearBtn2);
    container.appendChild(errBtnRow);

    const errResultEl = document.createElement("div");
    errResultEl.className = "sync-result";
    errResultEl.id = "p954Result";
    container.appendChild(errResultEl);
    return;
  }

  const proposal = inspection.normalized;
  container.appendChild(p955BuildProposalStatusCard(proposal));

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;flex-direction:column;gap:8px;";

  if(proposal.status === "dismissed"){
    // REQUIREMENT 4: dismissed state controls.
    const viewBtn = document.createElement("button");
    viewBtn.className = "big-btn btn-sync";
    viewBtn.style.marginBottom = "0";
    viewBtn.textContent = "👁 VIEW DISMISSED PROPOSAL";
    viewBtn.onclick = p954ROpenReview;
    btnRow.appendChild(viewBtn);

    const genNewBtn = document.createElement("button");
    genNewBtn.className = "big-btn";
    genNewBtn.style.cssText = "background:transparent;color:var(--accent);border:1px solid var(--accent);margin-bottom:0;";
    genNewBtn.textContent = "🧭 GENERATE NEW PROPOSAL";
    genNewBtn.onclick = p954HandleGenerateClick;
    btnRow.appendChild(genNewBtn);

    const clearBtn = document.createElement("button");
    clearBtn.className = "big-btn";
    clearBtn.style.cssText = "background:transparent;color:var(--red);border:1px solid var(--red);margin-bottom:0;";
    clearBtn.textContent = "🗑 CLEAR PROPOSAL";
    clearBtn.onclick = p954HandleClearClick;
    btnRow.appendChild(clearBtn);

    container.appendChild(btnRow);
    container.appendChild(p954BuildDismissedSummary(proposal));
  } else if(proposal.status === "undone"){
    const viewBtn=document.createElement("button");viewBtn.className="big-btn btn-sync";viewBtn.style.marginBottom="0";viewBtn.textContent="👁 VIEW UNDONE PROPOSAL";viewBtn.onclick=p954ROpenReview;btnRow.appendChild(viewBtn);
    const genNewBtn=document.createElement("button");genNewBtn.className="big-btn";genNewBtn.style.cssText="background:transparent;color:var(--accent);border:1px solid var(--accent);margin-bottom:0;";genNewBtn.textContent="🧭 GENERATE NEW PROPOSAL";genNewBtn.onclick=p954HandleGenerateClick;btnRow.appendChild(genNewBtn);
    container.appendChild(btnRow);container.appendChild(p954BuildUndoneSummaryCard(proposal));p954RLastRenderedAppliedSummary=proposal.applicationSummary||null;
  } else if(proposal.status === "applied"){
    // 9.5.4C: applied state controls. No KEEP/APPLY controls here — those
    // only make sense for a draft. Creating a new proposal or clearing this
    // record never undoes the lifecycle changes already applied.
    const viewBtn = document.createElement("button");
    viewBtn.className = "big-btn btn-sync";
    viewBtn.style.marginBottom = "0";
    viewBtn.textContent = "👁 VIEW APPLIED PROPOSAL";
    viewBtn.onclick = p954ROpenReview;
    btnRow.appendChild(viewBtn);

    const undoPlan=p954BuildUndoPlan(proposal);
    const undoBtn=document.createElement("button");
    undoBtn.className="big-btn";
    undoBtn.style.cssText="background:transparent;color:var(--yellow);border:1px solid var(--yellow);margin-bottom:0;";
    undoBtn.textContent="↩ UNDO APPLIED CHANGES";
    undoBtn.disabled=!undoPlan.canUndo;
    undoBtn.onclick=p954RShowUndoPreview;
    btnRow.appendChild(undoBtn);

    const createNewBtn = document.createElement("button");
    createNewBtn.className = "big-btn";
    createNewBtn.style.cssText = "background:transparent;color:var(--accent);border:1px solid var(--accent);margin-bottom:0;";
    createNewBtn.textContent = "🧭 CREATE NEW PROPOSAL";
    createNewBtn.onclick = p954HandleGenerateClick;
    btnRow.appendChild(createNewBtn);

    const clearBtn = document.createElement("button");
    clearBtn.className = "big-btn";
    clearBtn.style.cssText = "background:transparent;color:var(--red);border:1px solid var(--red);margin-bottom:0;";
    clearBtn.textContent = "🗑 CLEAR PROPOSAL";
    clearBtn.onclick = p954HandleClearClick;
    btnRow.appendChild(clearBtn);

    container.appendChild(btnRow);
    container.appendChild(p954BuildAppliedSummaryCard(proposal));
    p954RLastRenderedAppliedSummary = proposal.applicationSummary || null;

    const note = document.createElement("div");
    note.style.cssText = "margin-top:8px;font-size:11px;color:var(--muted);line-height:1.5;";
    note.textContent = undoPlan.canUndo
      ? "Undo restores the exact lifecycle and exercise-override state saved immediately before this proposal was applied. It does not delete or rewrite workout history. This is one saved-proposal reversal, not a general history stack."
      : "Automatic undo is unavailable: " + undoPlan.errors.concat(undoPlan.conflicts).join(" ") + " Workout history remains untouched.";
    container.appendChild(note);
  } else {
    // REQUIREMENT 5: draft (default) state controls. Any legacy/unrecognized
    // status is normalized to "draft" by p954NormalizeProposal before this
    // ever runs, so this branch is the safe default.
    const reviewBtn = document.createElement("button");
    reviewBtn.className = "big-btn btn-sync";
    reviewBtn.style.marginBottom = "0";
    reviewBtn.textContent = "🔍 REVIEW FULL PROPOSAL";
    reviewBtn.onclick = p954ROpenReview;
    btnRow.appendChild(reviewBtn);

    const viewBtn = document.createElement("button");
    viewBtn.className = "big-btn";
    viewBtn.style.cssText = "background:transparent;color:var(--accent);border:1px solid var(--accent);margin-bottom:0;";
    viewBtn.textContent = p954SummaryVisible ? "🙈 HIDE PROPOSAL SUMMARY" : "👁 VIEW PROPOSAL SUMMARY";
    viewBtn.onclick = p954ToggleSummary;
    btnRow.appendChild(viewBtn);

    const regenBtn = document.createElement("button");
    regenBtn.className = "big-btn";
    regenBtn.style.cssText = "background:transparent;color:var(--accent);border:1px solid var(--accent);margin-bottom:0;";
    regenBtn.textContent = "🔄 REGENERATE PROPOSAL";
    regenBtn.onclick = p954HandleGenerateClick;
    btnRow.appendChild(regenBtn);

    const clearBtn = document.createElement("button");
    clearBtn.className = "big-btn";
    clearBtn.style.cssText = "background:transparent;color:var(--red);border:1px solid var(--red);margin-bottom:0;";
    clearBtn.textContent = "🗑 CLEAR PROPOSAL";
    clearBtn.onclick = p954HandleClearClick;
    btnRow.appendChild(clearBtn);

    container.appendChild(btnRow);

    if(p954SummaryVisible){
      container.appendChild(p954BuildSummaryCard(proposal));
    }
  }

  const resultEl = document.createElement("div");
  resultEl.className = "sync-result";
  resultEl.id = "p954Result";
  container.appendChild(resultEl);
}

function p954ToggleSummary(){
  p954SummaryVisible = !p954SummaryVisible;
  p954RenderProgramPersonalization();
}

function p954HandleGenerateClick(){
  p954ReviewInvalid = false;
  p954ReviewInvalidErrors = [];
  if(p954ReviewOpenFlag) p954RCloseReview();
  const result = p954GenerateAndSaveProposal();
  p954SummaryVisible = true;
  p954RenderProgramPersonalization();
  if(result.ok) p954ShowResult("✅ Proposal generated. Nothing has been applied to your program.", "ok");
  else p954ShowResult("❌ Could not generate proposal: " + (result.error || "Unknown error"), "err");
}

function p954HandleClearClick(){
  p954ReviewInvalid = false;
  p954ReviewInvalidErrors = [];
  if(p954ReviewOpenFlag) p954RCloseReview();
  const result = p954ClearProposal();
  p954SummaryVisible = false;
  p954RenderProgramPersonalization();
  if(result.ok) p954ShowResult("Proposal cleared.", "ok");
  else p954ShowResult("❌ Could not clear proposal: " + (result.error || "Unknown error"), "err");
}

// ── PHASE 9.5.4B: DETAILED REVIEW OVERLAY ────────────────────────────────────
// Everything below is strictly read-only with respect to the active workout
// program. The ONLY write path in this whole block is
// p954RConfirmKeepCurrentProgram(), and the only fields it ever changes are
// proposal.status ("dismissed") and proposal.dismissedAt — never P,
// mf-overrides, mf-exercise-state, mf-recommendations, logs, history, day
// overrides/additions, custom exercises, inactive IDs, or replacements.

// Maps a proposal-day-plan action to its visual badge label. Falls back to
// "keep" for any unrecognized value so a badge always renders safely.
function p954RMakeBadge(action){
  const span = document.createElement("span");
  const safeAction = (typeof action === "string" && PROGRAM_PROPOSAL_DAY_ACTIONS.indexOf(action) !== -1) ? action : "keep";
  span.className = "p954r-badge p954r-badge-" + safeAction;
  const labels = { keep:"KEEP", modify:"TWEAK", reorder:"REORDER", replace:"REPLACE", add:"ADD", remove:"REMOVE", optional_add:"OPTIONAL ADD" };
  span.textContent = labels[safeAction] || safeAction.toUpperCase();
  return span;
}

function p955RMakeSafetyBadge(tag, confidence){
  const span=document.createElement("span");
  const safeTag=PROGRAM_PROPOSAL_SAFETY_TAGS.indexOf(tag)!==-1?tag:"source_missing";
  span.className="p954r-badge";
  span.style.cssText="background:var(--surface2);color:var(--muted);border:1px solid var(--border);margin-left:4px;";
  span.textContent=safeTag.replace(/_/g," ").toUpperCase()+(confidence?" · "+String(confidence).toUpperCase():"");
  return span;
}

// Best-effort, read-only extraction of a single free-text rationale line
// (e.g. "Primary goal on file: ...") out of proposal.summary.rationale. The
// builder only stores rationale as prose strings today, so this is a display
// convenience only — it never writes anything back and simply returns null
// if no matching line exists.
function p954RExtractRationaleField(rationale, prefixes){
  if(!Array.isArray(rationale)) return null;
  for(let i = 0; i < rationale.length; i++){
    const r = rationale[i];
    if(typeof r !== "string") continue;
    for(let j = 0; j < prefixes.length; j++){
      const prefix = prefixes[j];
      if(r.indexOf(prefix) === 0){
        let rest = r.slice(prefix.length).trim();
        rest = rest.replace(/\.$/, "");
        rest = rest.replace(/^"(.*)"$/, "$1");
        return rest || null;
      }
    }
  }
  return null;
}

// Read-only lookup of the CURRENT resolved day for a day plan, so the review
// can show real current exercise data next to the proposal's description.
// Virtual/optional_add day plans have no current day to resolve — returns
// null for those, never throws.
function p954RGetCurrentDayForPlan(dp){
  try {
    if(!dp || dp.isVirtual) return null;
    const days = getResolvedDays(dp.gymKey);
    const match = days.find(function(d){ return d._dayIdx === dp.dayIdx; });
    return match || null;
  } catch(e){
    return null;
  }
}

// The builder currently records duplicate-exercise findings as a prose tweak
// string ("Remove duplicate active exercise \"X\" (keep the first
// occurrence)."), not as structured per-exercise proposal data. This helper
// extracts just the exercise name(s) so the exercise-level rows below can
// render a real REMOVE badge on the later occurrence — read-only, never
// mutates the day plan or tweaks array.
function p954RExtractDuplicateNamesFromTweaks(tweaks){
  const set = new Set();
  if(!Array.isArray(tweaks)) return set;
  const re = /Remove duplicate active exercise "([^"]+)"/;
  tweaks.forEach(function(t){
    if(typeof t !== "string") return;
    const m = re.exec(t);
    if(m && m[1]) set.add(m[1]);
  });
  return set;
}

// Renders one current exercise row. `seenDupeNames` tracks which duplicate
// names have already been shown once (KEEP) within this day, so only the
// later occurrence(s) get the REMOVE badge — matching the builder's own
// "keep the first occurrence" language. All text uses textContent.
function p954RBuildExerciseRow(ex, dupeNames, seenDupeNames){
  const row = document.createElement("div");
  row.className = "p954r-ex-row";

  const name = ex && typeof ex.name === "string" ? ex.name : "";
  let action = "keep";
  if(name && dupeNames && dupeNames.has(name)){
    if(seenDupeNames[name]) action = "remove";
    else seenDupeNames[name] = true;
  }

  const nameLine = document.createElement("div");
  nameLine.className = "p954r-ex-name";
  nameLine.appendChild(p954RMakeBadge(action));
  const nameText = document.createElement("span");
  nameText.textContent = name || "(unnamed exercise)";
  nameLine.appendChild(nameText);
  row.appendChild(nameLine);

  const metaLine = document.createElement("div");
  metaLine.className = "p954r-ex-meta";
  const parts = [];
  if(ex && ex.sets !== undefined && ex.sets !== null && ex.sets !== "") parts.push("Sets: " + ex.sets);
  if(ex && ex.reps !== undefined && ex.reps !== null && ex.reps !== "") parts.push("Reps: " + ex.reps);
  if(ex && ex.load !== undefined && ex.load !== null && ex.load !== "") parts.push("Load: " + ex.load);
  if(ex && ex.rir !== undefined && ex.rir !== null && ex.rir !== "") parts.push("RIR: " + ex.rir);
  metaLine.textContent = parts.length ? parts.join(" · ") : "—";
  row.appendChild(metaLine);

  if(action === "remove"){
    const rationale = document.createElement("div");
    rationale.className = "p954r-ex-rationale";
    rationale.textContent = "Duplicate active exercise on this day — proposal suggests removing this later occurrence and keeping the first.";
    row.appendChild(rationale);
  }

  return row;
}

// Builds one day card: gym-agnostic (gym grouping happens one level up),
// current vs proposed day name, role/focus meta, day-level rationale
// (notes), and every current exercise on that day (or a clear empty note for
// not-yet-created optional/virtual days). Returns {el, exerciseCount} so the
// caller can accumulate debug counts without a second DOM walk.
function p954RBuildDayCard(dp, appliedOpType, exerciseStatuses){
  const card = document.createElement("div");
  card.className = "p954r-day-card";

  const currentDay = p954RGetCurrentDayForPlan(dp);
  const currentName = currentDay ? (currentDay.name || currentDay.day || "") : null;

  const head = document.createElement("div");
  head.className = "p954r-day-head";
  const nameWrap = document.createElement("div");
  const nameEl = document.createElement("div");
  nameEl.className = "p954r-day-name";
  nameEl.textContent = "Day " + (dp.dayIdx + 1) + (currentName ? (": " + currentName) : (": " + dp.dayName));
  nameWrap.appendChild(nameEl);
  if(currentName && dp.dayName && currentName !== dp.dayName){
    const propNameEl = document.createElement("div");
    propNameEl.className = "p954r-day-name-proposed";
    propNameEl.textContent = "Proposed name: " + dp.dayName;
    nameWrap.appendChild(propNameEl);
  }
  head.appendChild(nameWrap);
  head.appendChild(p954RMakeBadge(dp.action));
  head.appendChild(p955RMakeSafetyBadge(dp.safetyTag, dp.confidence));
  // 9.5.4D: show day-write state alongside structured exercise results;
  // replace/add/remove/reactivate remain deferred.
  if(appliedOpType){
    const tag = document.createElement("span");
    const wasWritten = (appliedOpType === "dayOverride" || appliedOpType === "disable" || appliedOpType === "dayAddition");
    tag.className = "p954r-applied-tag " + (wasWritten ? "yes" : "no");
    tag.textContent = wasWritten ? "✓ APPLIED" : "NOT APPLIED — DEFERRED";
    head.appendChild(tag);
  }
  card.appendChild(head);

  const meta = document.createElement("div");
  meta.className = "p954r-day-meta";
  const roleLabel = (typeof dp.role === "string" && dp.role) ? (dp.role.charAt(0).toUpperCase() + dp.role.slice(1)) : "Optional";
  const focusText = (currentDay && typeof currentDay.focus === "string") ? currentDay.focus : "";
  meta.textContent = "Role: " + roleLabel
    + (focusText ? (" · Focus: " + focusText) : "")
    + (dp.isVirtual ? " · Not created yet — describes a possibility only" : "");
  card.appendChild(meta);

  if(dp.notes){
    const note = document.createElement("div");
    note.className = "p954r-note";
    note.textContent = dp.notes;
    card.appendChild(note);
  }
  if(dp.rationale && dp.rationale !== dp.notes){
    const reason = document.createElement("div");
    reason.className = "p954r-note";
    reason.textContent = "Why: " + dp.rationale;
    card.appendChild(reason);
  }

  let exerciseCount = 0;
  const dupeNames = p954RExtractDuplicateNamesFromTweaks(dp.tweaks);
  if(currentDay && Array.isArray(currentDay.exercises) && currentDay.exercises.length){
    const seenDupeNames = {};
    currentDay.exercises.forEach(function(ex){
      exerciseCount++;
      card.appendChild(p954RBuildExerciseRow(ex, dupeNames, seenDupeNames));
    });
  } else if(dp.isVirtual){
    const empty = document.createElement("div");
    empty.className = "p954r-empty-note";
    empty.textContent = "This day doesn't exist yet — no exercises to preview.";
    card.appendChild(empty);
  } else if(Array.isArray(dp.tweaks) && dp.tweaks.length){
    dp.tweaks.forEach(function(t){
      const item = document.createElement("div");
      item.className = "p954r-list-item";
      item.textContent = t;
      card.appendChild(item);
    });
  } else {
    const empty = document.createElement("div");
    empty.className = "p954r-empty-note";
    empty.textContent = "No exercises found for this day.";
    card.appendChild(empty);
  }

  const exactExerciseById = {};
  if(currentDay && Array.isArray(currentDay.exercises)) currentDay.exercises.forEach(function(ex){ exactExerciseById[ex.id] = ex; });
  if(Array.isArray(dp.proposedExerciseOrder)){
    const order=document.createElement("div"); order.className="p954r-list-item";
    const orderStatus=exerciseStatuses&&exerciseStatuses.order;
    const resolvedOrder=dp.proposedExerciseOrder.map(function(id){
      const ex=exactExerciseById[id];
      return (ex ? getF(id,"name",ex.name) : "Unresolved") + " [" + id + "]";
    });
    order.textContent="Proposed exercise order: "+resolvedOrder.join(" → ")+(orderStatus?" · Status: "+orderStatus:""); card.appendChild(order);
  }
  (dp.exerciseActions||[]).forEach(function(ea){
    const row=document.createElement("div"); row.className="p954r-list-item";
    const resolved=ea.exerciseId ? exactExerciseById[ea.exerciseId] : null;
    let status="Skipped / Deferred";
    if(ea.action==="keep") status="Unchanged";
    else if(ea.action==="modify") status=(exerciseStatuses&&exerciseStatuses.actions&&exerciseStatuses.actions[ea.exerciseId])||"Pending validation";
    function detail(label,value){
      const line=document.createElement("div"); line.className="p954r-ex-meta";
      line.textContent=label+": "+String(value); row.appendChild(line);
    }
    detail("Exercise",resolved ? getF(ea.exerciseId,"name",resolved.name) : (ea.exerciseId ? "Unresolved" : "New exercise proposal"));
    detail("Stable ID",ea.exerciseId||"None (deferred add)");
    detail("Action",ea.action||"keep");
    detail("Safety",String(ea.safetyTag||"source_missing").replace(/_/g," ") + (ea.confidence ? " · " + ea.confidence : ""));
    Object.keys(ea.fields||{}).forEach(function(field){ detail("Proposed "+field,p954Value(ea.fields[field])); });
    detail("Rationale",ea.rationale||"None provided");
    detail("Status",status);
    card.appendChild(row);
  });
  return { el: card, exerciseCount: exerciseCount };
}

// Builds the full detailed review body for a validated proposal: top summary
// (REQUIREMENT 1's first list), rationale, warnings, then every day plan
// grouped by gym mode with per-exercise detail. Updates the debug counters
// (p954RLastRendered*) as a side effect — read-only otherwise.
function p954RBuildReviewContent(proposal){
  const frag = document.createDocumentFragment();
  const s = proposal.summary || {};

  function addRow(parent, label, value){
    if(value === null || value === undefined || value === "") return;
    const row = document.createElement("div");
    row.className = "p954r-row";
    const l = document.createElement("span");
    l.className = "p954r-row-label";
    l.textContent = label;
    const v = document.createElement("span");
    v.className = "p954r-row-value";
    v.textContent = String(value);
    row.appendChild(l);
    row.appendChild(v);
    parent.appendChild(row);
  }

  const sumSection = document.createElement("div");
  sumSection.className = "p954r-section";
  const sumTitle = document.createElement("div");
  sumTitle.className = "p954r-section-title";
  sumTitle.textContent = "Summary";
  sumSection.appendChild(sumTitle);

  addRow(sumSection, "Status", proposal.status);
  addRow(sumSection, "Generated", proposal.generatedAt ? new Date(proposal.generatedAt).toLocaleString() : "—");
  if(proposal.appliedAt)addRow(sumSection,"Applied",new Date(proposal.appliedAt).toLocaleString());
  if(proposal.undoneAt)addRow(sumSection,"Undone",new Date(proposal.undoneAt).toLocaleString());
  addRow(sumSection, "Recommended lifting frequency", s.recommendedFrequency ? (s.recommendedFrequency + "/week") : "No specific answer on file");
  const clc = s.currentLiftingDayCounts || {};
  const clcKeys = Object.keys(clc);
  if(clcKeys.length){
    addRow(sumSection, "Current lifting days by gym mode", clcKeys.map(function(k){ return k + ": " + clc[k]; }).join(" · "));
  }
  addRow(sumSection, "Gym mode(s) included", (s.gymModes && s.gymModes.length) ? s.gymModes.join(", ") : "—");
  addRow(sumSection, "Est. session duration", s.estimatedSessionDurationMinutes ? (s.estimatedSessionDurationMinutes + " min") : "—");
  const primaryGoal = p954RExtractRationaleField(s.rationale, ["Primary goal on file:", "Primary goal on file (from profile):"]);
  addRow(sumSection, "Primary goal", primaryGoal || "No specific answer on file");
  addRow(sumSection, "Affected day count", s.affectedDayCount);
  const ac = p955GetDerivedProposalActionCounts(proposal).counts;
  addRow(sumSection, "Action counts", p955FormatProposalActionCounts(ac));
  const reviewMetrics=p955GetProposalQualityMetrics(proposal),reviewUndo=p954BuildUndoPlan(proposal);
  addRow(sumSection,"Apply readiness",reviewMetrics.safeApplyCount+" supported · "+reviewMetrics.deferredCount+" deferred · "+reviewMetrics.conflictCount+" conflicts · "+reviewMetrics.warningCount+" warnings");
  addRow(sumSection,"Undo",proposal.status==="undone"?"Already undone; repeat is a no-write no-op":reviewUndo.canUndo?"Available":"Not available");
  frag.appendChild(sumSection);

  const sourceSection=document.createElement("div"),sourceTitle=document.createElement("div"),ss=proposal.sourceSummary||{},metrics=p955GetProposalQualityMetrics(proposal);
  sourceSection.className="p954r-section";sourceTitle.className="p954r-section-title";sourceTitle.textContent="Proposal Source";sourceSection.appendChild(sourceTitle);
  addRow(sourceSection,"Source type",proposal.sourceType==="fixture"?"Developer fixture / test":proposal.sourceType==="local_generated"?"Local generation from current app data":"Legacy / source details missing");
  addRow(sourceSection,"Engine",ss.proposalEngineVersion||"Not recorded");
  addRow(sourceSection,"Coverage",metrics.sourceCoverageCount+"/"+metrics.sourceCoverageTotal+" source groups used");
  addRow(sourceSection,"Profile",ss.profileUsed?"Used"+(ss.profileFields&&ss.profileFields.length?" ("+ss.profileFields.join(", ")+")":""):"Missing or empty");
  addRow(sourceSection,"Onboarding",ss.onboardingUsed?"Used"+(ss.onboardingSections&&ss.onboardingSections.length?" ("+ss.onboardingSections.join(", ")+")":""):"Missing or empty");
  addRow(sourceSection,"Coaching preferences",ss.coachingPrefsUsed?"Used":"Missing or empty");
  addRow(sourceSection,"Resolved program",ss.currentProgramUsed?"Used":"Missing or empty");
  addRow(sourceSection,"Lifecycle / overrides",ss.lifecycleUsed?"Used"+(ss.lifecycleSignals&&ss.lifecycleSignals.length?" ("+ss.lifecycleSignals.join(", ")+")":""):"No custom state present");
  addRow(sourceSection,"Recent logs",ss.recentLogsUsed?"Used":"Not used by this rule set");
  (ss.sourceWarnings||[]).forEach(function(w){const item=document.createElement("div");item.className="p954r-list-item warn";item.textContent="⚠ "+w;sourceSection.appendChild(item);});
  frag.appendChild(sourceSection);

  if((s.rationale || []).length){
    const rSection = document.createElement("div");
    rSection.className = "p954r-section";
    const rTitle = document.createElement("div");
    rTitle.className = "p954r-section-title";
    rTitle.textContent = "Rationale";
    rSection.appendChild(rTitle);
    s.rationale.forEach(function(r){
      const item = document.createElement("div");
      item.className = "p954r-list-item";
      item.textContent = r;
      rSection.appendChild(item);
    });
    frag.appendChild(rSection);
  }

  if((proposal.warnings || []).length){
    const wSection = document.createElement("div");
    wSection.className = "p954r-section";
    const wTitle = document.createElement("div");
    wTitle.className = "p954r-section-title";
    wTitle.textContent = "Warnings";
    wSection.appendChild(wTitle);
    proposal.warnings.forEach(function(w){
      const item = document.createElement("div");
      item.className = "p954r-list-item warn";
      item.textContent = "⚠ " + w;
      wSection.appendChild(item);
    });
    frag.appendChild(wSection);
  }

  const dayPlans = Array.isArray(proposal.dayPlans) ? proposal.dayPlans.slice() : [];
  const gymGroups = {};
  const gymOrder = [];
  dayPlans.forEach(function(dp){
    if(!gymGroups[dp.gymKey]){ gymGroups[dp.gymKey] = []; gymOrder.push(dp.gymKey); }
    gymGroups[dp.gymKey].push(dp);
  });

  // 9.5.4D: read applied day, reorder, and metadata results; unsupported
  // replace/add/remove/reactivate actions remain deferred. Read-only.
  let appliedOpsByKey = null;
  let appliedExerciseStatuses = {};
  if(proposal.status === "applied" || proposal.status === "undone"){
    appliedOpsByKey = {};
    const appSummary=proposal.applicationSummary||{};
    (appSummary.reorderResults||[]).forEach(function(r){const k=r.gymKey+"|"+r.dayIdx;appliedExerciseStatuses[k]=appliedExerciseStatuses[k]||{actions:{}};appliedExerciseStatuses[k].order=r.status;});
    (appSummary.exerciseActionResults||[]).forEach(function(r){const k=r.gymKey+"|"+r.dayIdx;appliedExerciseStatuses[k]=appliedExerciseStatuses[k]||{actions:{}};appliedExerciseStatuses[k].actions[r.exerciseId]=r.status;});
    try {
      const plan = p954BuildApplicationPlan(proposal);
      (plan.ops || []).forEach(function(op){
        appliedOpsByKey[op.gymKey + "|" + op.dayIdx] = op.type;
      });
    } catch(e){ appliedOpsByKey = {}; }
  }

  let renderedDayCount = 0;
  let renderedExerciseCount = 0;

  gymOrder.forEach(function(gymKey){
    const header = document.createElement("div");
    header.className = "p954r-gym-header";
    header.textContent = gymKey.toUpperCase() + " — day by day";
    frag.appendChild(header);

    const plans = gymGroups[gymKey].slice().sort(function(a, b){ return a.dayIdx - b.dayIdx; });
    plans.forEach(function(dp){
      renderedDayCount++;
      const appliedOpType = appliedOpsByKey ? appliedOpsByKey[dp.gymKey + "|" + dp.dayIdx] : undefined;
      const built = p954RBuildDayCard(dp, appliedOpType, appliedExerciseStatuses[dp.gymKey + "|" + dp.dayIdx]);
      renderedExerciseCount += built.exerciseCount;
      frag.appendChild(built.el);
    });
  });

  if(!gymOrder.length){
    const empty = document.createElement("div");
    empty.className = "p954r-empty-note";
    empty.textContent = "No day plans in this proposal.";
    frag.appendChild(empty);
  }

  p954RLastRenderedGymGroups = gymOrder.length;
  p954RLastRenderedDayCount = renderedDayCount;
  p954RLastRenderedExerciseCount = renderedExerciseCount;

  return frag;
}

// Opens the detailed review. REQUIREMENT 6: validates the stored proposal
// first — on failure, switches Program Personalization into the error state
// (via p954RenderProgramPersonalization) instead of rendering a misleading
// review, and never opens the overlay. On success, clears any prior error
// state and (re)builds the review body fresh each time — body.innerHTML is
// reset first, so repeated opens never duplicate DOM (REQUIREMENT 10).
function p954ROpenReview(){
  try {
    // REQUIREMENT 3 (9.5.4B.1): inspect the RAW stored proposal — not the
    // already-normalized/repaired one — so an invalid stored record can't be
    // silently repaired before we decide whether it's safe to review.
    const inspection = p954InspectStoredProposal();
    if(!inspection.exists){
      p954ReviewInvalid = true;
      p954ReviewInvalidErrors = ["No proposal found to review."];
      p954RenderProgramPersonalization();
      return;
    }
    if(!inspection.parses || !inspection.validation.valid){
      p954ReviewInvalid = true;
      p954ReviewInvalidErrors = inspection.validation.errors;
      p954RenderProgramPersonalization();
      return;
    }
    p954ReviewInvalid = false;
    p954ReviewInvalidErrors = [];

    // Raw proposal is genuinely valid — safe to render the normalized read
    // model (fills in expected legacy omissions like role/frequency/counts).
    const proposal = inspection.normalized;

    const overlay = document.getElementById("p954ReviewOverlay");
    const body = document.getElementById("p954ReviewBody");
    if(!overlay || !body) return;
    body.innerHTML = ""; // safe: clears only app-authored review DOM, rebuilt below
    body.appendChild(p954RBuildReviewContent(proposal));

    const title = document.getElementById("p954ReviewTitle");
    if(title) title.textContent = (proposal.status === "applied") ? "Applied Proposal (read-only)" : (proposal.status === "undone") ? "Undone Proposal (read-only)" : (proposal.status === "dismissed") ? "Dismissed Proposal (read-only)" : "Proposal Review";

    // 9.5.4C: the applied review overlay is read-only — no APPLY or KEEP
    // controls. APPLY is also hidden for dismissed proposals (nothing to
    // apply); KEEP stays available for dismissed, matching prior 9.5.4B
    // behavior (idempotent no-op there).
    const applyBtn = document.getElementById("p954ApplyBtn");
    const keepBtn = document.getElementById("p954KeepBtn");
    if(applyBtn){const readiness=p955GetProposalQualityMetrics(proposal);applyBtn.style.display=(proposal.status==="draft")?"":"none";applyBtn.disabled=proposal.status!=="draft"||readiness.safeApplyCount===0||readiness.conflictCount>0;applyBtn.textContent=readiness.safeApplyCount===0?"NO SUPPORTED CHANGES TO APPLY":readiness.conflictCount>0?"APPLY BLOCKED — RESOLVE CONFLICTS":"APPLY "+readiness.safeApplyCount+" SUPPORTED CHANGE"+(readiness.safeApplyCount===1?"":"S");}
    if(keepBtn) keepBtn.style.display = (proposal.status === "applied" || proposal.status === "undone") ? "none" : "";

    overlay.classList.add("open");
    document.documentElement.style.overflow = "hidden";
    p954ReviewOpenFlag = true;
  } catch(e){
    console.warn("[MarcusFit] p954ROpenReview failed:", e && e.message);
  }
}

// CLOSE / REVIEW LATER: closes the overlay, restores page scroll, and
// performs NO writes of any kind — the proposal (and its status) is left
// exactly as it was.
function p954RCloseReview(){
  const overlay = document.getElementById("p954ReviewOverlay");
  if(overlay) overlay.classList.remove("open");
  document.documentElement.style.overflow = "";
  p954ReviewOpenFlag = false;
}

// Opens the custom (non-native) KEEP CURRENT PROGRAM confirmation panel.
function p954RShowKeepConfirm(){
  const errEl = document.getElementById("p954ConfirmError");
  if(errEl){ errEl.style.display = "none"; errEl.textContent = ""; }
  const backdrop = document.getElementById("p954ConfirmBackdrop");
  if(backdrop) backdrop.classList.add("open");
}

// Canceling leaves the proposal draft completely unchanged — this only
// closes the confirmation panel.
function p954RCancelKeepConfirm(){
  const backdrop = document.getElementById("p954ConfirmBackdrop");
  if(backdrop) backdrop.classList.remove("open");
}

// KEEP CURRENT PROGRAM, confirmed. 9.5.4B.2: re-inspects the RAW stored
// proposal (not the normalizing getter) immediately before dismissal, so
// storage that was altered or corrupted after the review opened can't be
// silently repaired and then saved as dismissed. Absent, malformed-JSON, and
// raw-invalid proposals all keep the review/confirmation open with an error
// and never write. Only once the raw proposal is confirmed genuinely valid
// does this proceed, using inspection.normalized as the working proposal.
// REQUIREMENT 10: idempotent — if already dismissed, this closes out safely
// without bumping dismissedAt again or writing anything. Never touches the
// active workout program.
function p954RConfirmKeepCurrentProgram(){
  const backdrop = document.getElementById("p954ConfirmBackdrop");
  const errEl = document.getElementById("p954ConfirmError");
  try {
    const inspection = p954InspectStoredProposal();

    if(!inspection.exists){
      if(errEl){ errEl.style.display = "block"; errEl.textContent = "No proposal found — there's nothing to dismiss."; }
      return; // keep confirm + review open, no write
    }
    if(!inspection.parses){
      if(errEl){ errEl.style.display = "block"; errEl.textContent = "The stored proposal is corrupted and can't be dismissed safely. Please regenerate or clear it."; }
      return; // keep confirm + review open, no write
    }
    if(!inspection.validation.valid){
      if(errEl){ errEl.style.display = "block"; errEl.textContent = "The stored proposal failed validation and can't be dismissed safely. Please regenerate or clear it."; }
      return; // keep confirm + review open, no write
    }

    const proposal = inspection.normalized;

    if(proposal.status !== "draft" && proposal.status !== "dismissed"){
      if(errEl){ errEl.style.display = "block"; errEl.textContent = "This proposal is not in a state that can be dismissed right now."; }
      return;
    }

    if(proposal.status === "dismissed"){
      // Already dismissed — idempotent no-op write, just close out.
      if(backdrop) backdrop.classList.remove("open");
      p954RCloseReview();
      p954RenderProgramPersonalization();
      return;
    }

    proposal.status = "dismissed";
    proposal.dismissedAt = new Date().toISOString();
    const result = p954SaveProposal(proposal);
    if(!result.ok){
      if(errEl){ errEl.style.display = "block"; errEl.textContent = "Could not save: " + (result.error || "Unknown error") + ". Nothing has changed — please try again."; }
      return; // keep confirm + review open per REQUIREMENT 6
    }

    if(backdrop) backdrop.classList.remove("open");
    p954RCloseReview();
    p954RenderProgramPersonalization();
    p954ShowResult("Current program kept. Proposal dismissed — no program changes were made.", "ok");
  } catch(e){
    console.warn("[MarcusFit] p954RConfirmKeepCurrentProgram failed:", e && e.message);
    if(errEl){ errEl.style.display = "block"; errEl.textContent = "Unexpected error — the proposal has not been changed."; }
  }
}

// ── 9.5.4D: APPLY DAY + SAFE EXERCISE CHANGES preview/confirm panel ──────────
// Everything here is read-only until CONFIRM APPLY SUPPORTED CHANGES is
// tapped — opening or cancelling the preview never writes anything.

// Builds the preview body: action counts, the exact day-level writes that
// will occur, the exercise-level skip count, and required warnings. Pure
// read-only render — uses textContent/safe DOM only.
function p954RBuildApplyPreviewContent(proposal,plan,live){
  const frag=document.createDocumentFragment();
  function section(title,items,render){const box=document.createElement("div");box.className="p954ap-section";const h=document.createElement("div");h.className="p954ap-section-title";h.textContent=title;box.appendChild(h);if(!items.length){const n=document.createElement("div");n.className="p954r-empty-note";n.textContent="None";box.appendChild(n);}else items.forEach(function(x){const row=document.createElement("div");row.className="p954ap-write-item";row.textContent=render(x);box.appendChild(row);});frag.appendChild(box);}
  const notice=document.createElement("div");notice.className="p954ap-notice";notice.textContent="Day metadata, exercise order, and metadata-only exercise tweaks can be applied safely. Optional add/remove and exercise lifecycle changes stay deferred. Stable IDs, the base program, and workout history remain protected.";frag.appendChild(notice);
  section("Day-level writes",plan.ops.filter(function(o){return ["dayOverride","disable","dayAddition"].indexOf(o.type)>=0;}),function(o){return o.gymKey.toUpperCase()+" Day "+(o.dayIdx+1)+": "+o.type;});
  section("Deferred day lifecycle ideas",plan.ops.filter(function(o){return o.type==="skip_deferred_lifecycle";}),function(o){return o.gymKey.toUpperCase()+" Day "+(o.dayIdx+1)+" · "+o.dp.action.replace(/_/g," ")+" · Skipped / Deferred";});
  section("Exercise reorder writes",plan.ops.filter(function(o){return o.type==="orderOverride";}),function(o){const day=getResolvedDays(o.gymKey).find(function(d){return d._dayIdx===o.dayIdx;}),names={};(day&&day.exercises||[]).forEach(function(e){names[e.id]=getF(e.id,"name",e.name);});return o.gymKey.toUpperCase()+" Day "+(o.dayIdx+1)+" — "+o.order.map(function(id){return (names[id]||"Unknown")+" ["+id+"]";}).join(" → ")+" — "+(o.conflict?"Conflict":o.writeNeeded?"Will apply":"Unchanged");});
  section("Exercise metadata writes",plan.ops.filter(function(o){return o.type==="exerciseOverride";}),function(o){const day=getResolvedDays(o.gymKey).find(function(d){return d._dayIdx===o.dayIdx;}),ex=day&&(day.exercises||[]).find(function(e){return e.id===o.exerciseId;}),name=ex?getF(ex.id,"name",ex.name):"Unknown";return Object.keys(o.fields).map(function(f){const st=o.fieldStates[f];return name+" ["+o.exerciseId+"] · "+f+": "+p954Value(st.current)+" → "+p954Value(st.proposed)+" · "+(st.conflict?"Conflict":st.writeNeeded?"Will apply":"Unchanged");}).join(" | ");});
  [["Deferred replacements","replace"],["Deferred additions","add"],["Deferred removals","remove"],["Deferred reactivations","reactivate"]].forEach(function(pair){section(pair[0],plan.deferred[pair[1]],function(x){return x.gymKey.toUpperCase()+" Day "+(x.dayIdx+1)+" · "+(x.exerciseAction.exerciseId||"new exercise")+" · Skipped / Deferred";});});
  section("Conflicts and validation errors",(plan.errors||[]).concat((live&&live.errors)||[]),function(e){return "⚠ "+e;});
  return frag;
}


function p954RSetApplyConfirmDisabled(disabled){
  const button=document.getElementById("p954ApplyConfirmBtn");
  if(button) button.disabled=!!disabled;
}

// Opens the preview. Re-inspects the RAW stored proposal (never trusts the
// currently-rendered review) so a proposal that changed/corrupted after the
// review opened can't produce a misleading preview. Makes no writes.
function p954RShowApplyPreview(){
  p954RSetApplyConfirmDisabled(true);
  const errEl = document.getElementById("p954ApplyError");
  if(errEl){ errEl.style.display = "none"; errEl.textContent = ""; }
  try {
    const inspection = p954InspectStoredProposal();
    if(!inspection.exists || !inspection.parses || !inspection.validation.valid){
      if(errEl){ errEl.style.display = "block"; errEl.textContent = "This proposal can't be applied right now — it failed validation. Please regenerate or clear it."; }
      const backdrop = document.getElementById("p954ApplyPreviewBackdrop");
      if(backdrop) backdrop.classList.add("open");
      p954ApplyPreviewOpenFlag = true;
      return;
    }
    const proposal = inspection.normalized;
    if(proposal.status !== "draft"){
      if(errEl){ errEl.style.display = "block"; errEl.textContent = "This proposal is not in a state that can be applied right now (status: " + proposal.status + ")."; }
      const backdrop = document.getElementById("p954ApplyPreviewBackdrop");
      if(backdrop) backdrop.classList.add("open");
      p954ApplyPreviewOpenFlag = true;
      return;
    }

    const plan = p954BuildApplicationPlan(proposal);
    const liveValidation = p954ValidatePlanAgainstLiveState(plan, p954GenerateApplicationId(proposal));
    p954LastLiveValidationErrors = liveValidation.errors.slice();
    p954ApplyFingerprint = p954ComputeProposalFingerprint(proposal);
    const readiness=p955GetProposalQualityMetrics(proposal);
    p954RSetApplyConfirmDisabled(!plan.valid || !liveValidation.valid || readiness.safeApplyCount===0 || readiness.conflictCount>0);

    const body = document.getElementById("p954ApplyPreviewBody");
    if(body){
      body.innerHTML = "";
      body.appendChild(p954RBuildApplyPreviewContent(proposal, plan, liveValidation));
    }
    const backdrop = document.getElementById("p954ApplyPreviewBackdrop");
    if(backdrop) backdrop.classList.add("open");
    p954ApplyPreviewOpenFlag = true;
  } catch(e){
    p954RSetApplyConfirmDisabled(true);
    console.warn("[MarcusFit] p954RShowApplyPreview failed:", e && e.message);
    if(errEl){ errEl.style.display = "block"; errEl.textContent = "Unexpected error building the preview — nothing has changed."; }
  }
}

// Cancels the preview. Makes no writes of any kind.
function p954RCancelApplyPreview(){
  const backdrop = document.getElementById("p954ApplyPreviewBackdrop");
  if(backdrop) backdrop.classList.remove("open");
  p954ApplyPreviewOpenFlag = false;
  p954ApplyFingerprint = null;
}

// CONFIRM APPLY SUPPORTED CHANGES. The single atomic 9.5.4D write path —
// delegates entirely to p954ApplyProposal() (full re-validation, snapshot,
// atomic writes, rollback-on-failure). On success, closes both panels and
// re-renders the applied state; on failure, keeps the preview open with a
// clear error and leaves storage untouched.
function p954RConfirmApplyPreview(){
  const errEl = document.getElementById("p954ApplyError");
  try {
    // Defensive console/direct-call gate: never rely only on the button's
    // disabled state. Re-read, rebuild, and revalidate before calling the
    // transactional writer.
    const inspection=p954InspectStoredProposal();
    if(!inspection.exists||!inspection.parses||!inspection.validation.valid||!inspection.normalized||inspection.normalized.status!=="draft"){
      p954RSetApplyConfirmDisabled(true);
      if(errEl){errEl.style.display="block";errEl.textContent="Cannot apply: the stored proposal is missing, invalid, or not a draft.";}
      return;
    }
    const preflightPlan=p954BuildApplicationPlan(inspection.normalized);
    const preflightLive=p954ValidatePlanAgainstLiveState(preflightPlan,p954GenerateApplicationId(inspection.normalized));
    p954LastLiveValidationErrors=preflightLive.errors.slice();
    if(!preflightPlan.valid||!preflightLive.valid){
      p954RSetApplyConfirmDisabled(true);
      if(errEl){errEl.style.display="block";errEl.textContent="Cannot apply safely: "+preflightPlan.errors.concat(preflightLive.errors).join(" ");}
      return;
    }
    p954RSetApplyConfirmDisabled(false);
    const result = p954ApplyProposal(p954ApplyFingerprint);
    if(!result.ok){
      if(errEl){ errEl.style.display = "block"; errEl.textContent = result.error || "Could not apply — nothing has changed."; }
      return; // keep preview + review open, storage untouched
    }
    const backdrop = document.getElementById("p954ApplyPreviewBackdrop");
    if(backdrop) backdrop.classList.remove("open");
    p954ApplyPreviewOpenFlag = false;
    p954ApplyFingerprint = null;
    p954RCloseReview();
    p954RenderProgramPersonalization();
    // Re-render dependent surfaces immediately so disabled days disappear
    // and any new virtual day shows up without needing a manual refresh.
    try { if(typeof renderProgram === "function") renderProgram(); } catch(e){}
    try { if(typeof populateWoDaySelect === "function") populateWoDaySelect(); } catch(e){}
    p954ShowResult(result.alreadyApplied ? "This proposal was already applied — nothing changed." : "✅ Supported day metadata, exercise reorder, and metadata tweaks applied. Optional add/remove and exercise replace/add/remove/reactivate remain deferred.", "ok");
  } catch(e){
    console.warn("[MarcusFit] p954RConfirmApplyPreview failed:", e && e.message);
    if(errEl){ errEl.style.display = "block"; errEl.textContent = "Unexpected error — nothing has changed."; }
  }
}
// ── END 9.5.4D APPLY SUPPORTED CHANGES PREVIEW/CONFIRM PANEL ─────────────────

function p954RSetUndoConfirmDisabled(disabled){
  const button=document.getElementById("p954UndoConfirmBtn");if(button)button.disabled=!!disabled;
}

function p954RBuildUndoPreviewContent(plan){
  const frag=document.createDocumentFragment();
  const notice=document.createElement("div");notice.className="p954ap-notice";notice.textContent=plan.facts.restorationScope==="proposal-affected-paths"?"MarcusFit will restore only the lifecycle and override paths written by this proposal. Unrelated edits remain. Workout logs and history are not deleted or rewritten.":"This legacy proposal has no path-level history, so undo can proceed only when the original whole storage state still matches.";frag.appendChild(notice);
  const safety=document.createElement("div");safety.className="p954ap-section";const safetyTitle=document.createElement("div");safetyTitle.className="p954ap-section-title";safetyTitle.textContent="Current safety status";safety.appendChild(safetyTitle);const safetyLine=document.createElement("div");safetyLine.className="p954ap-write-item";safetyLine.textContent=plan.canUndo?"Safe to undo — both touched storage areas still match this application.":"Blocked — automatic undo would risk overwriting newer work.";safety.appendChild(safetyLine);frag.appendChild(safety);
  const ops=document.createElement("div");ops.className="p954ap-section";const opsTitle=document.createElement("div");opsTitle.className="p954ap-section-title";opsTitle.textContent="Planned storage restoration";ops.appendChild(opsTitle);(plan.operations||[]).forEach(function(op){const row=document.createElement("div");row.className="p954ap-write-item";const prefix=op.label+(typeof op.key==="string"&&op.key?" ("+op.key+")":"");row.textContent=prefix+": "+(op.kind==="orderOverride"?(op.action==="already-restored"?"already matches the saved pre-apply order":"restore original order"):(op.action==="remove"?"remove key because it was originally absent":op.action==="already-restored"?"already matches the saved pre-apply state":"restore exact original raw value"));ops.appendChild(row);});frag.appendChild(ops);
  const audit=document.createElement("div");audit.className="p954ap-section";const auditTitle=document.createElement("div");auditTitle.className="p954ap-section-title";auditTitle.textContent="Proposal audit";audit.appendChild(auditTitle);const auditRow=document.createElement("div");auditRow.className="p954ap-write-item";auditRow.textContent="The proposal remains saved with status Undone, its original application ID and applied timestamp, an undo timestamp, exact affected-path restoration verification, and unrelated-state preservation verification.";audit.appendChild(auditRow);frag.appendChild(audit);
  const issues=(plan.errors||[]).concat(plan.conflicts||[]),issueBox=document.createElement("div");issueBox.className="p954ap-section";const issueTitle=document.createElement("div");issueTitle.className="p954ap-section-title";issueTitle.textContent="Conflicts and validation errors";issueBox.appendChild(issueTitle);if(!issues.length){const none=document.createElement("div");none.className="p954r-empty-note";none.textContent="None";issueBox.appendChild(none);}else issues.forEach(function(msg){const row=document.createElement("div");row.className="p954ap-write-item";row.textContent="⚠ "+msg;issueBox.appendChild(row);});frag.appendChild(issueBox);
  return frag;
}

function p954RShowUndoPreview(){
  p954RSetUndoConfirmDisabled(true);const errEl=document.getElementById("p954UndoError");if(errEl){errEl.style.display="none";errEl.textContent="";}
  try{const plan=p954BuildUndoPlan();p954LastUndoValidationErrors=plan.errors.concat(plan.conflicts);const body=document.getElementById("p954UndoPreviewBody");if(body){body.innerHTML="";body.appendChild(p954RBuildUndoPreviewContent(plan));}p954RSetUndoConfirmDisabled(!plan.canUndo);const backdrop=document.getElementById("p954UndoPreviewBackdrop");if(backdrop)backdrop.classList.add("open");p954UndoPreviewOpenFlag=true;}
  catch(e){p954RSetUndoConfirmDisabled(true);if(errEl){errEl.style.display="block";errEl.textContent="Unexpected error building the undo preview — nothing has changed.";}}
}

function p954RCancelUndoPreview(){const backdrop=document.getElementById("p954UndoPreviewBackdrop");if(backdrop)backdrop.classList.remove("open");p954UndoPreviewOpenFlag=false;p954RSetUndoConfirmDisabled(true);}

function p954RConfirmUndoPreview(){
  const errEl=document.getElementById("p954UndoError");
  try{
    // Direct-call defense: the mutation function independently repeats this
    // raw inspection and live plan immediately before writing.
    const inspection=p954InspectStoredProposal();
    if(!inspection.exists||!inspection.parses||!inspection.validation.valid||!inspection.normalized){p954RSetUndoConfirmDisabled(true);if(errEl){errEl.style.display="block";errEl.textContent="Cannot undo: the saved proposal is missing, corrupted, or invalid.";}return;}
    if(inspection.normalized.status==="undone"){p954RSetUndoConfirmDisabled(true);p954RCancelUndoPreview();p954RenderProgramPersonalization();return;}
    const preflight=p954BuildUndoPlan(inspection.normalized);p954LastUndoValidationErrors=preflight.errors.concat(preflight.conflicts);
    if(!preflight.canUndo){p954RSetUndoConfirmDisabled(true);if(errEl){errEl.style.display="block";errEl.textContent="Cannot undo safely: "+p954LastUndoValidationErrors.join(" ");}return;}
    const result=p954UndoAppliedProposal();if(!result.ok){p954RSetUndoConfirmDisabled(true);if(errEl){errEl.style.display="block";errEl.textContent=result.error||"Undo failed — storage was restored to its immediate pre-undo state.";}return;}
    p954RCancelUndoPreview();p954RCloseReview();p954RenderProgramPersonalization();try{if(typeof renderProgram==="function")renderProgram();}catch(e){}try{if(typeof populateWoDaySelect==="function")populateWoDaySelect();}catch(e){}p954ShowResult(result.alreadyUndone?"This proposal was already undone — nothing changed.":"↩ Applied proposal changes undone. Workout logs and history were not changed.","ok");
  }catch(e){p954RSetUndoConfirmDisabled(true);if(errEl){errEl.style.display="block";errEl.textContent="Unexpected error — nothing has changed.";}}
}

// REQUIREMENT 9: read-only review-layer debug helper. Never mutates
// anything — safe to call at any time, including while the review is closed.
window.mfOnboardingProgramProposalReviewDebug = function(){
  try {
    const overlay = document.getElementById("p954ReviewOverlay");
    const backdrop = document.getElementById("p954ConfirmBackdrop");
    const proposal = p954GetProposal();
    // 9.5.4B.1: raw-storage inspection — this is what actually determines
    // whether the stored proposal is safe to review (see p954ROpenReview).
    const inspection = p954InspectStoredProposal();
    const validation = inspection.validation;
    // 9.5.4B.2: storedProposalNormalizedValid must reflect actual structural
    // validation of the normalized read model, not merely that normalization
    // returned an object.
    const normalizedValidation = inspection.normalized ? p954ValidateProgramProposal(inspection.normalized) : { valid: false, errors: [] };
    const applyBackdrop = document.getElementById("p954ApplyPreviewBackdrop");
    const applyErrEl = document.getElementById("p954ApplyError");
    const undoBackdrop = document.getElementById("p954UndoPreviewBackdrop");
    const undoErrEl = document.getElementById("p954UndoError");
    const undoPlan = p954BuildUndoPlan(proposal === null ? undefined : proposal);
    const result = {
      overlayExists: !!overlay,
      overlayOpen: !!(overlay && overlay.classList.contains("open")),
      proposalStatus: proposal ? proposal.status : null,
      validation: validation,
      gymGroupCount: p954RLastRenderedGymGroups,
      renderedDayCount: p954RLastRenderedDayCount,
      renderedExerciseCount: p954RLastRenderedExerciseCount,
      visibleWarnings: proposal ? (proposal.warnings || []) : [],
      currentConfirmationState: !!(backdrop && backdrop.classList.contains("open")),
      // 9.5.4B.1: concise raw-storage inspection fields only — no raw text,
      // no full parsed/normalized object dumps.
      storedProposalExists: inspection.exists,
      storedProposalParses: inspection.parses,
      storedProposalRawValid: inspection.validation.valid,
      storedProposalNormalizedValid: normalizedValidation.valid,
      storedProposalErrors: inspection.validation.errors,
      // 9.5.4C: apply-preview panel debug fields.
      applyPreviewOpen: !!(p954ApplyPreviewOpenFlag && applyBackdrop && applyBackdrop.classList.contains("open")),
      applyConfirmationOpen: !!(applyBackdrop && applyBackdrop.classList.contains("open")),
      applyError: (applyErrEl && applyErrEl.style.display !== "none") ? applyErrEl.textContent : null,
      renderedAppliedSummary: p954RLastRenderedAppliedSummary,
      currentProposalFingerprint: inspection.normalized ? p954ComputeProposalFingerprint(inspection.normalized) : null,
      undoPreviewOpen: !!(p954UndoPreviewOpenFlag && undoBackdrop && undoBackdrop.classList.contains("open")),
      undoConfirmDisabled: !!(document.getElementById("p954UndoConfirmBtn") && document.getElementById("p954UndoConfirmBtn").disabled),
      undoError: (undoErrEl && undoErrEl.style.display !== "none") ? undoErrEl.textContent : null,
      canUndo: undoPlan.canUndo,
      undoConflicts: undoPlan.conflicts,
      undoWarnings: undoPlan.warnings
    };
    console.log("[MarcusFit] mfOnboardingProgramProposalReviewDebug():", result);
    return result;
  } catch(e){
    const result = { error: (e && e.message) || "Unknown error" };
    console.warn("[MarcusFit] mfOnboardingProgramProposalReviewDebug failed:", e && e.message);
    return result;
  }
};
// ── END PHASE 9.5.4 / 9.5.4B ─────────────────────────────────────────────────

// Show brief "Draft saved HH:MM" toast — debounced so it doesn't spam
