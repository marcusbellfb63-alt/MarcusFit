const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const constantsSource = read("assets/js/core/01-app-constants.js");
const profileSource = read("assets/js/state/04-runtime-state-profile-preferences.js");
const onboardingSource = read("assets/js/features/05-onboarding.js");
const workoutSource = read("assets/js/features/10-workout-logging.js");
const historySource = read("assets/js/features/14-history.js");
const statsSource = read("assets/js/features/15-stats.js");
const exportSource = read("assets/js/sync/11-ai-export.js");
const coreSyncSource = read("assets/js/sync/12-ai-sync.js");
const backupSource = read("assets/js/system/16-backup-restore-debug.js");
const basketballSource = read("assets/js/features/22-basketball.js");
const html = read("index.html");
const css = read("assets/css/marcusfit.css");

function extractBalanced(source, token) {
  const at = source.indexOf(token);
  assert(at >= 0, `missing ${token}`);
  const brace = source.indexOf("{", at);
  let depth = 0, quote = null, escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    if (ch === "}" && --depth === 0) return source.slice(at, i + 1);
  }
  throw new Error(`unbalanced ${token}`);
}

function makeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  let writes = 0;
  return {
    values,
    api: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { writes++; values.set(key, String(value)); },
      removeItem(key) { writes++; values.delete(key); },
      key(index) { return [...values.keys()][index] || null; },
      get length() { return values.size; }
    },
    get writes() { return writes; },
    resetWrites() { writes = 0; }
  };
}

function createProfileContext(initial = {}) {
  const storage = makeStorage(initial);
  const elements = new Map();
  const selectors = new Map();
  const document = {
    documentElement: { setAttribute() {} },
    getElementById(id) { return elements.get(id) || null; },
    querySelectorAll(selector) { return selectors.get(selector) || []; }
  };
  const context = { APP_VERSION: "10.12.0", console, localStorage: storage.api, document };
  context.window = context;
  vm.createContext(context);
  const start = profileSource.indexOf('const USER_PROFILE_KEY = "mf-user-profile"');
  const end = profileSource.indexOf("// ── END PHASE 9.5.0", start);
  assert(start >= 0 && end > start, "profile source boundary missing");
  vm.runInContext(profileSource.slice(start, end), context);
  return { context, storage, elements, selectors };
}

function plain(value) { return JSON.parse(JSON.stringify(value)); }
function draft(context) { return JSON.parse(vm.runInContext("JSON.stringify(p950TrackingUiDraft)", context)); }

assert(constantsSource.includes('const APP_VERSION = "10.12.1"'));

// Presets reuse exactly the accepted collection fields. The pure builder keeps
// lifting detail orthogonal; explicit UI actions apply the preset defaults.
let env = createProfileContext();
const defaultTracking = env.context.p950GetDefaultTrackingPreferences();
const full = env.context.p950BuildTrackingPreset("full_coaching");
const strength = env.context.p950BuildTrackingPreset("strength_tracking");
const simple = env.context.p950BuildTrackingPreset("simple_fitness_log");
assert.deepStrictEqual(Object.keys(simple).sort(), Object.keys(defaultTracking).sort());
assert.deepStrictEqual(Object.keys(simple.modules).sort(), ["activeCalories", "basketball", "coachingInsights", "dailyNotes", "habits", "recurringAdherence", "sessionNotes"]);
assert.deepStrictEqual(Object.keys(simple.dailyMetrics).sort(), ["bowelMovement", "energy", "hunger", "protein", "sleep", "water", "weight"]);
assert(Object.values(full.modules).every(Boolean) && Object.values(full.dailyMetrics).every(Boolean));
assert.deepStrictEqual(plain(strength.modules), {
  habits: false, basketball: false, recurringAdherence: false, activeCalories: false,
  dailyNotes: false, sessionNotes: true, coachingInsights: true
});
assert.deepStrictEqual(plain(strength.dailyMetrics), {
  weight: true, sleep: true, protein: false, water: false,
  energy: true, hunger: false, bowelMovement: false
});
assert.deepStrictEqual(plain(simple.modules), {
  habits: false, basketball: false, recurringAdherence: false, activeCalories: false,
  dailyNotes: false, sessionNotes: true, coachingInsights: true
});
assert(Object.values(simple.dailyMetrics).every(value => value === false));

// Detection depends only on collection values.
simple.liftingDetail = "simple";
assert.strictEqual(env.context.p950DetectTrackingPreset(simple), "simple_fitness_log");
simple.liftingDetail = "full";
assert.strictEqual(env.context.p950DetectTrackingPreset(simple), "simple_fitness_log");
full.liftingDetail = "simple";
strength.liftingDetail = "simple";
assert.strictEqual(env.context.p950DetectTrackingPreset(full), "full_coaching");
assert.strictEqual(env.context.p950DetectTrackingPreset(strength), "strength_tracking");
const changedSimple = plain(simple);
changedSimple.modules.habits = true;
assert.strictEqual(env.context.p950DetectTrackingPreset(changedSimple), "custom");

// Explicit preset actions establish a sensible detail default. Custom preserves
// every field, and later detail-only changes preserve the named collection preset.
env.context.p950SelectTrackingPreset("simple_fitness_log");
assert.strictEqual(draft(env.context).preset, "simple_fitness_log");
assert.strictEqual(draft(env.context).liftingDetail, "simple");
env.context.p950UpdateLiftingDetail("full");
assert.strictEqual(draft(env.context).preset, "simple_fitness_log");
env.context.p950SelectTrackingPreset("strength_tracking");
assert.strictEqual(draft(env.context).liftingDetail, "full");
env.context.p950UpdateLiftingDetail("simple");
assert.strictEqual(draft(env.context).preset, "strength_tracking");
env.context.p950SelectTrackingPreset("full_coaching");
assert.strictEqual(draft(env.context).liftingDetail, "full");
const beforeCustom = draft(env.context);
env.context.p950SelectTrackingPreset("custom");
const afterCustom = draft(env.context);
assert.strictEqual(afterCustom.preset, "custom");
assert.deepStrictEqual(afterCustom.modules, beforeCustom.modules);
assert.deepStrictEqual(afterCustom.dailyMetrics, beforeCustom.dailyMetrics);
assert.strictEqual(afterCustom.liftingDetail, beforeCustom.liftingDetail);

// Missing preferences remain a write-free virtual Full default, including when
// the setup surface is rendered. An old profile is never converted to Simple.
env = createProfileContext();
const setupStatus = { textContent: "" };
env.elements.set("p950TrackingSetupStatus", setupStatus);
env.context.p950RenderTrackingPreferences();
assert.strictEqual(env.storage.writes, 0);
assert.strictEqual(env.context.p950GetTrackingSnapshotForDate("2026-09-01").preset, "full_coaching");
assert.strictEqual(env.context.p950GetTrackingSnapshotForDate("2026-09-01").virtualDefault, true);
assert(/No tracking choice is saved yet/.test(setupStatus.textContent));

// The accepted complete-snapshot timeline replaces same-day intent, appends
// later dates, and leaves pre-first and intervening history unchanged.
env.context.p950SaveTrackingPreferences(env.context.p950BuildTrackingPreset("strength_tracking"), "2026-09-10");
env.context.p950SaveTrackingPreferences(env.context.p950BuildTrackingPreset("simple_fitness_log", { liftingDetail: "simple" }), "2026-09-10");
let saved = JSON.parse(env.storage.api.getItem("mf-user-profile"));
assert.strictEqual(saved.preferences.tracking.timeline.length, 1);
assert.strictEqual(saved.preferences.tracking.timeline[0].preset, "simple_fitness_log");
env.context.p950SaveTrackingPreferences(env.context.p950BuildTrackingPreset("full_coaching"), "2026-09-12");
saved = JSON.parse(env.storage.api.getItem("mf-user-profile"));
assert.deepStrictEqual(saved.preferences.tracking.timeline.map(entry => entry.effectiveDate), ["2026-09-10", "2026-09-12"]);
assert.strictEqual(env.context.p950GetTrackingSnapshotForDate("2026-09-09").preset, "full_coaching");
assert.strictEqual(env.context.p950GetTrackingSnapshotForDate("2026-09-11").preset, "simple_fitness_log");
assert.strictEqual(env.context.p950GetTrackingSnapshotForDate("2026-09-12").preset, "full_coaching");

// Saved evidence beats a draft and preferences; a draft beats preferences; a
// blank workout follows the newly effective preference.
const modeStorage = makeStorage();
const modeContext = {
  localStorage: modeStorage.api,
  tDate: new Date("2026-09-15T12:00:00"),
  dKey() { return "day-2026-09-15"; },
  p950LocalDateKey() { return "2026-09-15"; },
  p950GetTrackingSnapshotForDate() { return { liftingDetail: "simple" }; }
};
vm.createContext(modeContext);
vm.runInContext(extractBalanced(workoutSource, "function mfWorkoutEvidenceMode") + "\n" + extractBalanced(workoutSource, "function mfWorkoutResolveLiftingDetail"), modeContext);
modeStorage.api.setItem("day-2026-09-15-wo", JSON.stringify({ exercises: {} }));
assert.strictEqual(modeContext.mfWorkoutResolveLiftingDetail({ liftingDetail: "simple" }), "full");
modeStorage.api.setItem("day-2026-09-15-wo", JSON.stringify({ liftingDetail: "simple", exercises: {} }));
modeContext.p950GetTrackingSnapshotForDate = () => ({ liftingDetail: "full" });
assert.strictEqual(modeContext.mfWorkoutResolveLiftingDetail({ exercises: {} }), "simple");
modeStorage.api.removeItem("day-2026-09-15-wo");
assert.strictEqual(modeContext.mfWorkoutResolveLiftingDetail({ liftingDetail: "simple" }), "simple");
modeContext.p950GetTrackingSnapshotForDate = () => ({ liftingDetail: "simple" });
assert.strictEqual(modeContext.mfWorkoutResolveLiftingDetail({ exercises: {} }), "full");
assert.strictEqual(modeContext.mfWorkoutResolveLiftingDetail(), "simple");

// Saving collection intent does not delete dormant daily/workout/Basketball
// history. The lightweight bundle retains session notes and coaching only.
const oldDaily = '{"weight":"190","mood":7,"notes":"keep"}';
const oldWorkout = '{"liftingDetail":"simple","exercises":{"lift":{"sets":[],"summary":{"version":1,"setCount":3,"repsFloor":"8","load":"100","rirFloor":"2"},"note":"keep"}}}';
const oldBasketball = '{"schemaVersion":1,"sessions":[{"id":"old"}]}';
env = createProfileContext({ "day-2026-09-01": oldDaily, "day-2026-09-01-wo": oldWorkout, "mf-basketball-sessions": oldBasketball });
env.context.p950SaveTrackingPreferences(simple, "2026-09-15");
assert.strictEqual(env.storage.api.getItem("day-2026-09-01"), oldDaily);
assert.strictEqual(env.storage.api.getItem("day-2026-09-01-wo"), oldWorkout);
assert.strictEqual(env.storage.api.getItem("mf-basketball-sessions"), oldBasketball);
assert.strictEqual(env.context.p950IsTrackingEnabled("modules.sessionNotes", "2026-09-15"), true);
for (const pathName of ["modules.activeCalories", "modules.basketball", "modules.habits", "dailyMetrics.weight", "dailyMetrics.sleep", "dailyMetrics.energy"])
  assert.strictEqual(env.context.p950IsTrackingEnabled(pathName, "2026-09-15"), false, `${pathName} unexpectedly enabled`);
assert(historySource.includes("Per-Lift summary") && statsSource.includes("liftingDetail"));

// Export identifies intentional lightweight tracking without raw JSON or fake
// individual-set evidence and remains compact.
const today = env.context.p950LocalDateKey(new Date());
env.context.p950SaveTrackingPreferences(simple, today);
const trackingExport = env.context.p950BuildTrackingPreferencesExport(today, today);
assert(trackingExport.includes("Preset: Simple Fitness Log"));
assert(trackingExport.includes("intentionally prioritizes workout evidence, history, and progression"));
assert(trackingExport.includes("expected and neutral"));
assert(!trackingExport.includes('"dailyMetrics"') && !trackingExport.includes("Set 1:"));
assert(trackingExport.length < 2500, `tracking export unexpectedly large: ${trackingExport.length}`);
assert(exportSource.includes("p950BuildTrackingPreferencesExport"));

// AI Sync rejects any top-level profile/tracking authority before all writes.
const syncStorage = makeStorage({ "mf-user-profile": env.storage.api.getItem("mf-user-profile") });
const syncInput = { value: "" }, syncResult = { style: {}, textContent: "" };
const syncContext = { document: { getElementById(id) { return id === "syncInput" ? syncInput : syncResult; } }, localStorage: syncStorage.api, mfBasketballLegacySyncExtension: null };
vm.createContext(syncContext);
vm.runInContext(extractBalanced(basketballSource, "function mfBasketballHandleSyncExtension"), syncContext);
for (const payload of [
  { trackingPreferences: { preset: "full_coaching" } },
  { profile: { preferences: { tracking: { liftingDetail: "full" } } } },
  { tracking: { modules: { habits: true } } }
]) {
  syncInput.value = `MARCUSFIT_UPDATE_START\n${JSON.stringify(payload)}\nMARCUSFIT_UPDATE_END`;
  syncStorage.resetWrites();
  assert.strictEqual(syncContext.mfBasketballHandleSyncExtension(() => { throw new Error("core Sync ran"); }), true);
  assert.strictEqual(syncStorage.writes, 0);
  assert(/user-controlled/.test(syncResult.textContent));
}

// Raw schema-1 backup naturally round-trips the existing profile key, and old
// onboarding continues merging nested preferences without duplicate writes.
const backupProfile = env.storage.api.getItem("mf-user-profile");
const enumerableStorage = { "mf-user-profile": backupProfile };
Object.defineProperty(enumerableStorage, "getItem", { value(key) { return Object.prototype.hasOwnProperty.call(this, key) ? this[key] : null; }, enumerable: false });
const backupContext = { APP_VERSION: "10.12.0", localStorage: enumerableStorage };
vm.createContext(backupContext);
vm.runInContext('const SCHEMA_VERSION=1,OVR="mf-overrides",DRAFT_KEY="mf-current-draft",LIFECYCLE_KEY="mf-exercise-state",RECS_KEY="mf-recommendations",AI_PREFS_KEY="mf-ai-coaching-preferences",USER_PROFILE_KEY="mf-user-profile",ONBOARDING_KEY="mf-onboarding",PROGRAM_PROPOSAL_KEY="mf-program-proposal";\n' + extractBalanced(backupSource, "function p8IsMarcusFitKey") + "\n" + extractBalanced(backupSource, "function p8GetMarcusFitKeys") + "\n" + extractBalanced(backupSource, "function p8BuildBackup"), backupContext);
const backup = backupContext.p8BuildBackup();
assert.strictEqual(backup.schemaVersion, 1);
assert.strictEqual(backup.data["mf-user-profile"], backupProfile);

const onboardingEnv = createProfileContext({ "mf-user-profile": backupProfile });
onboardingEnv.context.p953ValidateCompleteDraft = value => ({ normalized: value });
vm.runInContext(extractBalanced(onboardingSource, "function p953BuildUserProfileFromOnboarding"), onboardingEnv.context);
const existingProfile = onboardingEnv.context.p950GetUserProfile();
const merged = onboardingEnv.context.p953BuildUserProfileFromOnboarding({ profile: {}, goals: {} }, existingProfile);
assert.deepStrictEqual(plain(merged.preferences.tracking), plain(existingProfile.preferences.tracking));

// Mobile setup uses four semantic buttons, a visible non-color selected marker,
// independent detail controls, and the accepted one-column narrow breakpoint.
assert.strictEqual((html.match(/data-mf-tracking-preset="/g) || []).length, 4);
assert(html.includes('data-mf-tracking-preset="simple_fitness_log"') && html.includes("Simple Fitness Log"));
assert.strictEqual((html.match(/class="mf-tracking-preset"[^>]*aria-pressed="false"/g) || []).length, 4);
assert.strictEqual((html.match(/mf-tracking-preset-state/g) || []).length, 4);
assert(html.includes("Workout logging detail") && html.includes("Fine-tune tracking"));
assert(css.includes(".mf-tracking-presets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))"));
assert(css.includes("@media(max-width:420px)") && css.includes(".mf-tracking-presets{grid-template-columns:1fr;}"));
assert(css.includes('.mf-tracking-preset[aria-pressed="true"] .mf-tracking-preset-state{visibility:visible;}'));

// Protected architecture stays byte-for-byte/inventory compatible.
assert.strictEqual(crypto.createHash("sha256").update(coreSyncSource.replace(/\r\n/g, "\n")).digest("hex"), "14245321c8f47de5c152d011a08877ef4821e353c15bc3ed72c0490aa767c598");
assert.strictEqual((html.match(/<script\s+src="[^"]+"\s+defer><\/script>/g) || []).length, 22);

console.log("MarcusFit 10.12.0 Simple Fitness Log + streamlined setup: PASS");
