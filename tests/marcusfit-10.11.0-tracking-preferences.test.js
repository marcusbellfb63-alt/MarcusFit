const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const profileSource = fs.readFileSync(path.join(root, "assets/js/state/04-runtime-state-profile-preferences.js"), "utf8");
const constantsSource = fs.readFileSync(path.join(root, "assets/js/core/01-app-constants.js"), "utf8");

function makeStorage(initial = {}) {
  const memory = new Map(Object.entries(initial));
  let writes = 0;
  return {
    memory,
    api: {
      getItem(key) { return memory.has(key) ? memory.get(key) : null; },
      setItem(key, value) { writes++; memory.set(key, String(value)); },
      removeItem(key) { writes++; memory.delete(key); },
      key(index) { return [...memory.keys()][index] || null; },
      get length() { return memory.size; }
    },
    get writes() { return writes; },
    resetWrites() { writes = 0; }
  };
}

function createProfileContext(initial = {}) {
  const storage = makeStorage(initial);
  const elements = new Map();
  const document = {
    documentElement: { setAttribute() {} },
    getElementById(id) { return elements.get(id) || null; }
  };
  const context = { APP_VERSION: "10.11.0", console, localStorage: storage.api, document, window: null };
  context.window = context;
  vm.createContext(context);
  const start = profileSource.indexOf('const USER_PROFILE_KEY = "mf-user-profile"');
  const end = profileSource.indexOf("// ── END PHASE 9.5.0", start);
  assert(start >= 0 && end > start, "profile source boundary missing");
  vm.runInContext(profileSource.slice(start, end), context, { filename: "04-runtime-state-profile-preferences.js" });
  return { context, storage, elements };
}

assert(constantsSource.includes('const APP_VERSION = "10.11.0"'), "APP_VERSION was not advanced");

// Missing tracking is a virtual Full Coaching read and never persists.
let env = createProfileContext();
let tracking = env.context.p950GetTrackingPreferences();
assert.strictEqual(tracking.preset, "full_coaching");
assert.strictEqual(tracking.liftingDetail, "full");
assert(Object.values(tracking.modules).every(Boolean));
assert(Object.values(tracking.dailyMetrics).every(Boolean));
assert.strictEqual(env.storage.writes, 0, "virtual tracking default wrote storage");

// Exact named bundles and Custom retention.
const full = env.context.p950BuildTrackingPreset("full_coaching");
const strength = env.context.p950BuildTrackingPreset("strength_tracking");
assert.deepStrictEqual(JSON.parse(JSON.stringify(strength.modules)), {
  habits: false, basketball: false, recurringAdherence: false, activeCalories: false,
  dailyNotes: false, sessionNotes: true, coachingInsights: true
});
assert.deepStrictEqual(JSON.parse(JSON.stringify(strength.dailyMetrics)), {
  weight: true, sleep: true, protein: false, water: false,
  energy: true, hunger: false, bowelMovement: false
});
const retained = env.context.p950BuildTrackingPreset("custom", strength);
assert.strictEqual(retained.preset, "custom");
assert.deepStrictEqual(JSON.parse(JSON.stringify(retained.modules)), JSON.parse(JSON.stringify(strength.modules)));

// Normalization preserves unknown profile/preference/tracking fields and safely
// fills malformed known tracking values.
const malformedProfile = env.context.p950GetDefaultUserProfile();
malformedProfile.futureTop = { keep: true };
malformedProfile.preferences.futurePreference = 42;
malformedProfile.preferences.tracking = {
  preset: "unsafe", liftingDetail: "minimal", futureTracking: { keep: true },
  modules: { habits: "yes", futureModule: "keep" }, dailyMetrics: null,
  timeline: [{ effectiveDate: "bad-date" }]
};
const normalized = env.context.p950NormalizeUserProfile(malformedProfile);
assert.deepStrictEqual(JSON.parse(JSON.stringify(normalized.futureTop)), { keep: true });
assert.strictEqual(normalized.preferences.futurePreference, 42);
assert.deepStrictEqual(JSON.parse(JSON.stringify(normalized.preferences.tracking.futureTracking)), { keep: true });
assert.strictEqual(normalized.preferences.tracking.liftingDetail, "full");
assert.strictEqual(normalized.preferences.tracking.modules.habits, true);
assert.strictEqual(normalized.preferences.tracking.modules.futureModule, "keep");
assert.strictEqual(normalized.preferences.tracking.timeline.length, 0);

// Saves use complete local-date snapshots, replace a same-day entry, append a
// future day, and resolve dates before the first entry to virtual Full.
env = createProfileContext();
env.context.p950SaveTrackingPreferences(full, "2026-09-13");
env.context.p950SaveTrackingPreferences(strength, "2026-09-13");
let saved = JSON.parse(env.storage.api.getItem("mf-user-profile"));
assert.strictEqual(saved.preferences.tracking.timeline.length, 1);
assert.strictEqual(saved.preferences.tracking.timeline[0].preset, "strength_tracking");
env.context.p950SaveTrackingPreferences(full, "2026-09-15");
saved = JSON.parse(env.storage.api.getItem("mf-user-profile"));
assert.deepStrictEqual(saved.preferences.tracking.timeline.map(entry => entry.effectiveDate), ["2026-09-13", "2026-09-15"]);
assert.strictEqual(env.context.p950GetTrackingSnapshotForDate("2026-09-12").virtualDefault, true);
assert.strictEqual(env.context.p950GetTrackingSnapshotForDate("2026-09-14").preset, "strength_tracking");
assert.strictEqual(env.context.p950GetTrackingSnapshotForDate("2026-09-15").preset, "full_coaching");
const localDate = new Date(2026, 8, 13, 23, 30, 0);
assert.strictEqual(env.context.p950LocalDateKey(localDate), "2026-09-13", "effective dates are not local calendar dates");

// Reset Profile preserves tracking. Reset Tracking appends/replaces today's
// Full snapshot without deleting prior intent.
env.elements.set("p950ResetConfirmPanel", { style: {}, scrollIntoView() {} });
env.elements.set("p950TrackingResetConfirmPanel", { style: {}, scrollIntoView() {} });
env.context.p950RenderUserProfile = function() {};
env.context.p950ApplyTextSize = function() {};
env.context.p950ShowProfileResult = function() {};
env.context.p950ShowTrackingResult = function() {};
env.context.p950RenderTrackingPreferences = function() {};
env.context.p950ApplyTrackingPreferencesToUi = function() {};
const beforeResetTimeline = JSON.parse(env.storage.api.getItem("mf-user-profile")).preferences.tracking.timeline;
assert(env.context.p950ConfirmResetProfile().ok);
saved = JSON.parse(env.storage.api.getItem("mf-user-profile"));
assert.deepStrictEqual(saved.preferences.tracking.timeline, beforeResetTimeline);
assert(env.context.p950ConfirmResetTrackingPreferences().ok);
saved = JSON.parse(env.storage.api.getItem("mf-user-profile"));
assert(saved.preferences.tracking.timeline.some(entry => entry.preset === "full_coaching"));
assert(saved.preferences.tracking.timeline.some(entry => entry.effectiveDate === "2026-09-13"), "prior timeline was erased");

console.log("MarcusFit 10.11.0 tracking preference authority: PASS");
