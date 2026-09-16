

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
  p9ShowCoachPrefsResult("Preferences saved.","ok");
}
function p9ResetCoachPrefsTemplate(){
  const ta=document.getElementById("coachPrefsTa");
  if(!ta)return;
  ta.value=AI_PREFS_STARTER_TEMPLATE;
  p9SetCoachPrefs(AI_PREFS_STARTER_TEMPLATE);
  p9ShowCoachPrefsResult("Reset to starter template.","ok");
}
function p9ClearCoachPrefs(){
  if(!confirm("Clear your saved AI coaching preferences? This cannot be undone."))return;
  const ta=document.getElementById("coachPrefsTa");
  if(!ta)return;
  ta.value="";
  p9SetCoachPrefs("");
  p9ShowCoachPrefsResult("Cleared.","ok");
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
const USER_PROFILE_TEXT_SIZES = ["compact", "standard", "large", "extra-large"];
const P950_TRACKING_MODEL_VERSION = 1;
const P950_TRACKING_PRESETS = ["full_coaching", "strength_tracking", "custom"];
const P950_TRACKING_MODULE_KEYS = ["habits", "basketball", "recurringAdherence", "activeCalories", "dailyNotes", "sessionNotes", "coachingInsights"];
const P950_TRACKING_METRIC_KEYS = ["weight", "sleep", "protein", "water", "energy", "hunger", "bowelMovement"];

function p950TrackingClone(value){
  return JSON.parse(JSON.stringify(value));
}

function p950LocalDateKey(value){
  if(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)){
    const parts = value.split("-").map(Number);
    const parsed = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
    if(parsed.getFullYear() === parts[0] && parsed.getMonth() === parts[1] - 1 && parsed.getDate() === parts[2]) return value;
  }
  const date = value && typeof value.getFullYear === "function" ? value : new Date();
  return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
}

function p950GetDefaultTrackingPreferences(){
  return {
    modelVersion: P950_TRACKING_MODEL_VERSION,
    preset: "full_coaching",
    liftingDetail: "full",
    modules: {
      habits: true,
      basketball: true,
      recurringAdherence: true,
      activeCalories: true,
      dailyNotes: true,
      sessionNotes: true,
      coachingInsights: true
    },
    dailyMetrics: {
      weight: true,
      sleep: true,
      protein: true,
      water: true,
      energy: true,
      hunger: true,
      bowelMovement: true
    },
    changedAt: null,
    timeline: []
  };
}

function p950BuildTrackingPreset(presetId, currentValue){
  const id = P950_TRACKING_PRESETS.includes(presetId) ? presetId : "full_coaching";
  const base = currentValue && typeof currentValue === "object" ? p950NormalizeTrackingPreferences(currentValue) : p950GetDefaultTrackingPreferences();
  if(id === "custom"){
    base.preset = "custom";
    return base;
  }
  const preset = p950GetDefaultTrackingPreferences();
  preset.preset = id;
  if(id === "strength_tracking"){
    preset.modules = {
      habits: false,
      basketball: false,
      recurringAdherence: false,
      activeCalories: false,
      dailyNotes: false,
      sessionNotes: true,
      coachingInsights: true
    };
    preset.dailyMetrics = {
      weight: true,
      sleep: true,
      protein: false,
      water: false,
      energy: true,
      hunger: false,
      bowelMovement: false
    };
  }
  return preset;
}

function p950TrackingSelectionMatches(a, b){
  if(!a || !b || a.liftingDetail !== "full" || b.liftingDetail !== "full") return false;
  return P950_TRACKING_MODULE_KEYS.every(function(key){ return a.modules[key] === b.modules[key]; }) &&
    P950_TRACKING_METRIC_KEYS.every(function(key){ return a.dailyMetrics[key] === b.dailyMetrics[key]; });
}

function p950DetectTrackingPreset(value){
  if(p950TrackingSelectionMatches(value, p950BuildTrackingPreset("full_coaching"))) return "full_coaching";
  if(p950TrackingSelectionMatches(value, p950BuildTrackingPreset("strength_tracking"))) return "strength_tracking";
  return "custom";
}

function p950NormalizeTrackingSelection(value, fallback){
  const def = fallback && typeof fallback === "object" ? fallback : p950GetDefaultTrackingPreferences();
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const out = Object.assign({}, src);
  const srcModules = src.modules && typeof src.modules === "object" && !Array.isArray(src.modules) ? src.modules : {};
  const srcMetrics = src.dailyMetrics && typeof src.dailyMetrics === "object" && !Array.isArray(src.dailyMetrics) ? src.dailyMetrics : {};
  delete out.timeline;
  out.preset = P950_TRACKING_PRESETS.includes(src.preset) ? src.preset : def.preset;
  out.liftingDetail = "full";
  out.modules = Object.assign({}, srcModules);
  P950_TRACKING_MODULE_KEYS.forEach(function(key){ out.modules[key] = typeof srcModules[key] === "boolean" ? srcModules[key] : def.modules[key]; });
  out.dailyMetrics = Object.assign({}, srcMetrics);
  P950_TRACKING_METRIC_KEYS.forEach(function(key){ out.dailyMetrics[key] = typeof srcMetrics[key] === "boolean" ? srcMetrics[key] : def.dailyMetrics[key]; });
  out.changedAt = typeof src.changedAt === "string" && !isNaN(Date.parse(src.changedAt)) ? src.changedAt : null;
  return out;
}

function p950NormalizeTrackingPreferences(value){
  const def = p950GetDefaultTrackingPreferences();
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const out = p950NormalizeTrackingSelection(src, def);
  out.modelVersion = P950_TRACKING_MODEL_VERSION;
  const byDate = {};
  (Array.isArray(src.timeline) ? src.timeline : []).forEach(function(entry){
    if(!entry || typeof entry !== "object" || Array.isArray(entry) || typeof entry.effectiveDate !== "string") return;
    const effectiveDate = p950LocalDateKey(entry.effectiveDate);
    if(effectiveDate !== entry.effectiveDate) return;
    const normalized = p950NormalizeTrackingSelection(entry, def);
    normalized.effectiveDate = effectiveDate;
    normalized.preset = P950_TRACKING_PRESETS.includes(entry.preset) ? entry.preset : p950DetectTrackingPreset(normalized);
    byDate[effectiveDate] = normalized;
  });
  out.timeline = Object.keys(byDate).sort().map(function(date){ return byDate[date]; });
  return out;
}

function p950GetTrackingPreferences(){
  const profile = p950GetUserProfile();
  const tracking = profile && profile.preferences && profile.preferences.tracking;
  return tracking && typeof tracking === "object" ? p950NormalizeTrackingPreferences(tracking) : p950GetDefaultTrackingPreferences();
}

function p950GetTrackingSnapshotForDate(value){
  const date = p950LocalDateKey(value);
  const tracking = p950GetTrackingPreferences();
  let selected = null;
  tracking.timeline.forEach(function(entry){ if(entry.effectiveDate <= date) selected = entry; });
  const snapshot = p950NormalizeTrackingSelection(selected || p950GetDefaultTrackingPreferences(), p950GetDefaultTrackingPreferences());
  snapshot.effectiveDate = selected ? selected.effectiveDate : null;
  snapshot.virtualDefault = !selected;
  return snapshot;
}

function p950SaveTrackingPreferences(value, effectiveDate){
  const profile = p950GetUserProfile();
  const stored = profile.preferences && profile.preferences.tracking ? p950NormalizeTrackingPreferences(profile.preferences.tracking) : p950GetDefaultTrackingPreferences();
  const incoming = p950NormalizeTrackingPreferences(value);
  const date = p950LocalDateKey(effectiveDate);
  const now = new Date().toISOString();
  incoming.preset = p950DetectTrackingPreset(incoming);
  incoming.changedAt = now;
  incoming.timeline = stored.timeline.filter(function(entry){ return entry.effectiveDate !== date; });
  const snapshot = p950NormalizeTrackingSelection(incoming, p950GetDefaultTrackingPreferences());
  snapshot.effectiveDate = date;
  snapshot.changedAt = now;
  snapshot.preset = incoming.preset;
  incoming.timeline.push(snapshot);
  incoming.timeline.sort(function(a,b){ return a.effectiveDate.localeCompare(b.effectiveDate); });
  const updated = Object.assign({}, profile, {
    preferences: Object.assign({}, profile.preferences, { tracking: incoming })
  });
  return p950SaveUserProfile(updated);
}

function p950IsTrackingEnabled(path, date){
  const snapshot = p950GetTrackingSnapshotForDate(date);
  const parts = String(path || "").split(".");
  if(parts.length === 1){
    if(Object.prototype.hasOwnProperty.call(snapshot.modules, parts[0])) return snapshot.modules[parts[0]];
    if(Object.prototype.hasOwnProperty.call(snapshot.dailyMetrics, parts[0])) return snapshot.dailyMetrics[parts[0]];
  }
  if(parts.length === 2 && (parts[0] === "modules" || parts[0] === "dailyMetrics")) return !!snapshot[parts[0]][parts[1]];
  return false;
}

function p950NormalizeTextSize(value){
  return USER_PROFILE_TEXT_SIZES.includes(value) ? value : "standard";
}

function p950ApplyTextSize(profile){
  const root = document && document.documentElement;
  if(!root) return "standard";
  const source = profile && profile.preferences ? profile : p950GetUserProfile();
  const textSize = p950NormalizeTextSize(source.preferences && source.preferences.textSize);
  root.setAttribute("data-text-size", textSize);
  return textSize;
}

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
    preferences: { weightUnit: "lb", distanceUnit: "mi", firstDayOfWeek: "sunday", textSize: "standard" },
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
    firstDayOfWeek: srcPrefs.firstDayOfWeek === "monday" ? "monday" : "sunday",
    textSize: p950NormalizeTextSize(srcPrefs.textSize)
  });
  if(Object.prototype.hasOwnProperty.call(srcPrefs, "tracking")){
    out.preferences.tracking = p950NormalizeTrackingPreferences(srcPrefs.tracking);
  }

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
  document.getElementById("p950TextSize").value = profile.preferences.textSize;
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
    p950ShowProfileResult("Display name cannot be empty. Your previous profile was not changed.", "err");
    return;
  }

  let feet = parseInt(document.getElementById("p950HeightFeet").value, 10);
  let inches = parseInt(document.getElementById("p950HeightInches").value, 10);
  if(isNaN(feet) || feet < 0) feet = 0;
  if(isNaN(inches) || inches < 0) inches = 0;
  if(inches > 11) inches = 11;
  const totalInches = (feet * 12) + inches;
  if(totalInches < 20 || totalInches > 108){
    p950ShowProfileResult("Height looks invalid. Your previous profile was not changed.", "err");
    return;
  }

  const weightUnit = document.getElementById("p950WeightUnit").value === "kg" ? "kg" : "lb";
  const distanceUnit = document.getElementById("p950DistanceUnit").value === "km" ? "km" : "mi";
  const firstDayOfWeek = document.getElementById("p950FirstDayOfWeek").value === "monday" ? "monday" : "sunday";
  const textSize = p950NormalizeTextSize(document.getElementById("p950TextSize").value);
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
      firstDayOfWeek: firstDayOfWeek,
      textSize: textSize
    }),
    app: Object.assign({}, current.app, {
      homeGymLabel: homeGymLabel || current.app.homeGymLabel,
      partialGymLabel: partialGymLabel || current.app.partialGymLabel
    })
  });

  const result = p950SaveUserProfile(updated);
  if(result.ok){
    p950ApplyTextSize(result.profile);
    p950RenderUserProfile();
    p950ShowProfileResult("Profile saved.", "ok");
  } else {
    p950ShowProfileResult("Failed to save profile: " + result.error, "err");
  }
}

// Text size is an immediate display preference: selecting a value updates the
// root document state and persists only the normalized profile preference.
function p950SetTextSizeFromUI(){
  const select = document.getElementById("p950TextSize");
  if(!select) return false;
  const current = p950GetUserProfile();
  const textSize = p950NormalizeTextSize(select.value);
  const updated = Object.assign({}, current, {
    preferences: Object.assign({}, current.preferences, { textSize: textSize })
  });
  const result = p950SaveUserProfile(updated);
  if(!result.ok){
    p950ShowProfileResult("Failed to save text size: " + result.error, "err");
    return false;
  }
  p950ApplyTextSize(result.profile);
  p950ShowProfileResult("Text size set to " + select.options[select.selectedIndex].text + ".", "ok");
  return true;
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
  p950ShowProfileResult("This will reset your profile to Marcus defaults. Confirm below to proceed.", "warn");
}
function p950ConfirmResetProfile(){
  const panel = document.getElementById("p950ResetConfirmPanel");
  if(panel) panel.style.display = "none";
  const current = p950GetUserProfile();
  const def = p950GetDefaultUserProfile();
  if(current.preferences && Object.prototype.hasOwnProperty.call(current.preferences, "tracking")){
    def.preferences.tracking = p950TrackingClone(current.preferences.tracking);
  }
  const result = p950SaveUserProfile(def);
  if(result.ok){
    p950ApplyTextSize(result.profile);
    p950RenderUserProfile();
    p950ShowProfileResult("Profile reset to Marcus defaults.", "ok");
  } else {
    p950ShowProfileResult("Reset failed: " + result.error, "err");
  }
  return result;
}

function p950ResetTrackingPreferences(){
  const panel = document.getElementById("p950TrackingResetConfirmPanel");
  if(panel){
    panel.style.display = "block";
    panel.scrollIntoView({behavior:"smooth", block:"nearest"});
  }
  if(typeof p950ShowTrackingResult === "function") p950ShowTrackingResult("This will restore Full Coaching for new tracking while preserving prior tracking history. Confirm below to proceed.", "warn");
}

function p950ConfirmResetTrackingPreferences(){
  const panel = document.getElementById("p950TrackingResetConfirmPanel");
  if(panel) panel.style.display = "none";
  const result = p950SaveTrackingPreferences(p950BuildTrackingPreset("full_coaching"), p950LocalDateKey(new Date()));
  if(result.ok){
    if(typeof p950RenderTrackingPreferences === "function") p950RenderTrackingPreferences();
    if(typeof p950ApplyTrackingPreferencesToUi === "function") p950ApplyTrackingPreferencesToUi();
    if(typeof p950ShowTrackingResult === "function") p950ShowTrackingResult("Tracking Preferences reset to Full Coaching. Historical preferences and data were kept.", "ok");
  }else if(typeof p950ShowTrackingResult === "function") p950ShowTrackingResult("Tracking reset failed: "+result.error, "err");
  return result;
}

function p950CancelResetTrackingPreferences(){
  const panel = document.getElementById("p950TrackingResetConfirmPanel");
  if(panel) panel.style.display = "none";
  if(typeof p950ShowTrackingResult === "function") p950ShowTrackingResult("Tracking reset cancelled. No changes made.", "ok");
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

function p950GetDisabledTrackingLabels(snapshot){
  const source = snapshot || p950GetTrackingSnapshotForDate(p950LocalDateKey(new Date()));
  const moduleLabels = {habits:"Habits",basketball:"Basketball",recurringAdherence:"Medication / recurring adherence",activeCalories:"Active Calories",dailyNotes:"Daily Notes",sessionNotes:"Session Notes",coachingInsights:"Coaching Insights"};
  const metricLabels = {weight:"Weight",sleep:"Sleep",protein:"Protein",water:"Water",energy:"Energy",hunger:"Hunger",bowelMovement:"Bowel Movement"};
  return P950_TRACKING_MODULE_KEYS.filter(function(key){ return !source.modules[key]; }).map(function(key){ return moduleLabels[key]; }).concat(P950_TRACKING_METRIC_KEYS.filter(function(key){ return !source.dailyMetrics[key]; }).map(function(key){ return metricLabels[key]; }));
}

function p950GetEnabledTrackingLabels(snapshot){
  const source = snapshot || p950GetTrackingSnapshotForDate(p950LocalDateKey(new Date()));
  const moduleLabels = {habits:"Habits",basketball:"Basketball",recurringAdherence:"Medication / recurring adherence",activeCalories:"Active Calories",dailyNotes:"Daily Notes",sessionNotes:"Session Notes",coachingInsights:"Coaching Insights"};
  const metricLabels = {weight:"Weight",sleep:"Sleep",protein:"Protein",water:"Water",energy:"Energy",hunger:"Hunger",bowelMovement:"Bowel Movement"};
  return ["Lifting"].concat(P950_TRACKING_MODULE_KEYS.filter(function(key){ return source.modules[key]; }).map(function(key){ return moduleLabels[key]; }),P950_TRACKING_METRIC_KEYS.filter(function(key){ return source.dailyMetrics[key]; }).map(function(key){ return metricLabels[key]; }));
}

function p950AddLocalDays(dateKey, amount){
  const parts = String(dateKey || "").split("-").map(Number), date = new Date(parts[0], parts[1]-1, parts[2], 12, 0, 0, 0);
  date.setDate(date.getDate()+amount);
  return p950LocalDateKey(date);
}

function p950BuildTrackingPreferencesExport(startDate, endDate){
  const tracking = p950GetTrackingPreferences(), today = p950LocalDateKey(new Date()), start = /^\d{4}-\d{2}-\d{2}$/.test(String(startDate||"")) ? startDate : today, end = /^\d{4}-\d{2}-\d{2}$/.test(String(endDate||"")) ? endDate : today, current = p950GetTrackingSnapshotForDate(today), currentOff = p950GetDisabledTrackingLabels(current), boundaries = [start];
  tracking.timeline.forEach(function(entry){ if(entry.effectiveDate > start && entry.effectiveDate <= end) boundaries.push(entry.effectiveDate); });
  boundaries.sort();
  const periods=[];
  boundaries.forEach(function(boundary,index){
    const off=p950GetDisabledTrackingLabels(p950GetTrackingSnapshotForDate(boundary));if(!off.length)return;
    const through=index+1<boundaries.length?p950AddLocalDays(boundaries[index+1],-1):end;
    periods.push(boundary+(through!==boundary?" through "+through:"")+": "+off.join(", "));
  });
  return "--- TRACKING PREFERENCES ---\n"
    +"Preset: "+p950TrackingPresetLabel(current.preset)+"\n"
    +"Lifting Evidence: Full per-set (sets, reps, load, and RIR are unchanged)\n"
    +"Currently Collected: "+p950GetEnabledTrackingLabels(current).join(", ")+"\n"
    +"Intentionally Not Tracked: "+(currentOff.length?currentOff.join(", "):"none")+"\n"
    +"Preference-off periods in selected range: "+(periods.length?periods.join(" | "):"none")+"\n"
    +"Interpretation: Blank values during preference-off periods are neutral, not failures. Existing history remains factual. Habit and recurring-adherence denominators exclude preference-off dates. Tracking Preferences are user-controlled and must not be changed through AI Sync.\n\n";
}

let p950TrackingUiDraft = null;

function p950TrackingPresetLabel(id){
  return {full_coaching:"Full Coaching",strength_tracking:"Strength Tracking",custom:"Custom"}[id] || "Custom";
}

function p950ShowTrackingResult(message, type){
  const el = document.getElementById("p950TrackingResult");
  if(!el) return;
  el.style.display = "block";
  el.style.color = type === "err" ? "var(--red)" : type === "warn" ? "var(--yellow)" : "var(--accent)";
  el.textContent = message;
}

function p950RenderTrackingDraft(){
  if(!p950TrackingUiDraft) p950TrackingUiDraft = p950GetTrackingPreferences();
  const draft = p950TrackingUiDraft;
  document.querySelectorAll("[data-mf-tracking-preset]").forEach(function(button){
    const active = button.dataset.mfTrackingPreset === draft.preset;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  document.querySelectorAll("[data-mf-tracking-kind][data-mf-tracking-key]").forEach(function(input){
    const group = input.dataset.mfTrackingKind, key = input.dataset.mfTrackingKey;
    input.checked = !!(draft[group] && draft[group][key]);
  });
  const metricValues = P950_TRACKING_METRIC_KEYS.map(function(key){ return !!draft.dailyMetrics[key]; });
  const allMetrics = document.getElementById("p950TrackingAllMetrics");
  if(allMetrics){
    allMetrics.checked = metricValues.every(Boolean);
    allMetrics.indeterminate = metricValues.some(Boolean) && !metricValues.every(Boolean);
  }
  const summary = document.getElementById("p950TrackingSummary");
  if(summary) summary.textContent = p950TrackingPresetLabel(draft.preset)+" · Full lifting";
}

function p950RenderTrackingPreferences(){
  p950BindTrackingPreferenceControls();
  p950TrackingUiDraft = p950GetTrackingPreferences();
  p950RenderTrackingDraft();
}

function p950BindTrackingPreferenceControls(){
  if(!document || typeof document.querySelectorAll !== "function") return;
  document.querySelectorAll("[data-mf-tracking-preset]").forEach(function(button){if(button.dataset.mfTrackingBound)return;button.dataset.mfTrackingBound="true";button.addEventListener("click",function(){p950SelectTrackingPreset(button.dataset.mfTrackingPreset);});});
  document.querySelectorAll("[data-mf-tracking-kind][data-mf-tracking-key]").forEach(function(input){if(input.dataset.mfTrackingBound)return;input.dataset.mfTrackingBound="true";input.addEventListener("change",function(){p950UpdateTrackingToggle(input.dataset.mfTrackingKind,input.dataset.mfTrackingKey,input.checked);});});
  [["p950TrackingAllMetrics","change",function(event){p950UpdateTrackingMetricGroup(event.currentTarget.checked); }],["p950TrackingSave","click",p950SaveTrackingPreferencesFromUI],["p950TrackingReset","click",p950ResetTrackingPreferences],["p950TrackingResetConfirm","click",p950ConfirmResetTrackingPreferences],["p950TrackingResetCancel","click",p950CancelResetTrackingPreferences]].forEach(function(binding){const element=document.getElementById(binding[0]);if(!element||element.dataset.mfTrackingBound)return;element.dataset.mfTrackingBound="true";element.addEventListener(binding[1],binding[2]);});
}

function p950SelectTrackingPreset(presetId){
  if(!p950TrackingUiDraft) p950TrackingUiDraft = p950GetTrackingPreferences();
  p950TrackingUiDraft = p950BuildTrackingPreset(presetId, p950TrackingUiDraft);
  p950RenderTrackingDraft();
  p950ShowTrackingResult("Review your selection, then save Tracking Preferences.", "warn");
}

function p950UpdateTrackingToggle(group, key, enabled){
  if(!p950TrackingUiDraft) p950TrackingUiDraft = p950GetTrackingPreferences();
  if(!p950TrackingUiDraft[group] || !Object.prototype.hasOwnProperty.call(p950TrackingUiDraft[group], key)) return false;
  p950TrackingUiDraft[group][key] = !!enabled;
  p950TrackingUiDraft.preset = p950DetectTrackingPreset(p950TrackingUiDraft);
  p950RenderTrackingDraft();
  return true;
}

function p950UpdateTrackingMetricGroup(enabled){
  if(!p950TrackingUiDraft) p950TrackingUiDraft = p950GetTrackingPreferences();
  P950_TRACKING_METRIC_KEYS.forEach(function(key){ p950TrackingUiDraft.dailyMetrics[key] = !!enabled; });
  p950TrackingUiDraft.preset = p950DetectTrackingPreset(p950TrackingUiDraft);
  p950RenderTrackingDraft();
}

function p950SetCollectionHidden(element, hidden){
  if(!element) return;
  element.classList.toggle("mf-tracking-hidden", !!hidden);
  element.setAttribute("aria-hidden", hidden ? "true" : "false");
}

function p950ApplyTrackingPreferencesToUi(date){
  if(!document || typeof document.querySelectorAll !== "function") return null;
  const selectedDate = date || p950LocalDateKey(new Date());
  const snapshot = p950GetTrackingSnapshotForDate(selectedDate);
  document.querySelectorAll("[data-mf-collection-metric]").forEach(function(element){
    p950SetCollectionHidden(element, !snapshot.dailyMetrics[element.dataset.mfCollectionMetric]);
  });
  p950SetCollectionHidden(document.getElementById("p6sec-metrics"), !P950_TRACKING_METRIC_KEYS.some(function(key){ return snapshot.dailyMetrics[key]; }));
  p950SetCollectionHidden(document.getElementById("p6sec-habits"), !snapshot.modules.habits);
  p950SetCollectionHidden(document.getElementById("p6sec-basketball"), !snapshot.modules.basketball);
  p950SetCollectionHidden(document.getElementById("p6sec-recurring"), !snapshot.modules.recurringAdherence);
  p950SetCollectionHidden(document.getElementById("p6sec-notes"), !snapshot.modules.dailyNotes);
  document.querySelectorAll("[data-mf-collection-module]").forEach(function(element){
    p950SetCollectionHidden(element, !snapshot.modules[element.dataset.mfCollectionModule]);
  });
  document.querySelectorAll(".wo-note-input,.mf-basketball-drill-notes").forEach(function(element){ p950SetCollectionHidden(element, !snapshot.modules.sessionNotes); });
  document.querySelectorAll(".wo-ex-coach,.p5-hist-wrap,#woRecsSection,#p949ReviewCard,.p7-action-summary,.mf-basketball-last-trend,.mf-basketball-guidance").forEach(function(element){ p950SetCollectionHidden(element, !snapshot.modules.coachingInsights); });
  return snapshot;
}

function p950SaveTrackingPreferencesFromUI(){
  if(!p950TrackingUiDraft) p950TrackingUiDraft = p950GetTrackingPreferences();
  const result = p950SaveTrackingPreferences(p950TrackingUiDraft, p950LocalDateKey(new Date()));
  if(!result.ok){ p950ShowTrackingResult("Failed to save Tracking Preferences: "+result.error, "err"); return false; }
  p950TrackingUiDraft = p950GetTrackingPreferences();
  p950RenderTrackingDraft();
  p950ApplyTrackingPreferencesToUi();
  if(typeof p7RenderAnalytics === "function") p7RenderAnalytics();
  p950ShowTrackingResult("Tracking Preferences saved. Existing history was kept.", "ok");
  return true;
}

function mfTrackingPreferencesDebug(date){
  const profile = p950GetUserProfile(), persisted = !!(profile.preferences && profile.preferences.tracking), tracking = p950GetTrackingPreferences(), effective = p950GetTrackingSnapshotForDate(date || p950LocalDateKey(new Date()));
  return {appVersion:APP_VERSION,persisted:persisted,currentPreset:tracking.preset,liftingDetail:tracking.liftingDetail,timelineEntryCount:tracking.timeline.length,effective:effective,backupCovered:typeof p8IsMarcusFitKey === "function" ? p8IsMarcusFitKey(USER_PROFILE_KEY) : null,readOnly:true};
}
if(typeof window!=="undefined")window.mfTrackingPreferencesDebug=mfTrackingPreferencesDebug;
// ── END PHASE 9.5.0 ────────────────────────────────────────────────────────────
