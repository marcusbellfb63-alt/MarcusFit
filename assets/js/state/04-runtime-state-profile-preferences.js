

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
const USER_PROFILE_TEXT_SIZES = ["compact", "standard", "large", "extra-large"];

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
    p950ShowProfileResult("✅ Profile saved.", "ok");
  } else {
    p950ShowProfileResult("❌ Failed to save profile: " + result.error, "err");
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
    p950ShowProfileResult("❌ Failed to save text size: " + result.error, "err");
    return false;
  }
  p950ApplyTextSize(result.profile);
  p950ShowProfileResult("✅ Text size set to " + select.options[select.selectedIndex].text + ".", "ok");
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
  p950ShowProfileResult("⚠ This will reset your profile to Marcus defaults. Confirm below to proceed.", "warn");
}
function p950ConfirmResetProfile(){
  const panel = document.getElementById("p950ResetConfirmPanel");
  if(panel) panel.style.display = "none";
  const def = p950GetDefaultUserProfile();
  const result = p950SaveUserProfile(def);
  if(result.ok){
    p950ApplyTextSize(result.profile);
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
