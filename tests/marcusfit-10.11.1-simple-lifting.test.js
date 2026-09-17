const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const profileSource = fs.readFileSync(path.join(root, "assets/js/state/04-runtime-state-profile-preferences.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  let writes = 0;
  return {
    api: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { writes++; values.set(key, String(value)); },
      removeItem(key) { writes++; values.delete(key); },
      key(index) { return [...values.keys()][index] || null; },
      get length() { return values.size; }
    },
    get writes() { return writes; },
    reset() { writes = 0; }
  };
}

function profileEnvironment(initial = {}) {
  const local = storage(initial);
  const context = { APP_VERSION: "10.11.1", console, localStorage: local.api, document: { documentElement: { setAttribute() {} }, getElementById() { return null; }, querySelectorAll() { return []; } } };
  context.window = context;
  vm.createContext(context);
  const start = profileSource.indexOf('const USER_PROFILE_KEY = "mf-user-profile"');
  const end = profileSource.indexOf("// ── END PHASE 9.5.0", start);
  assert(start >= 0 && end > start);
  vm.runInContext(profileSource.slice(start, end), context);
  return { context, local };
}

let env = profileEnvironment();
assert.strictEqual(env.context.p950GetTrackingPreferences().liftingDetail, "full");
assert.strictEqual(env.local.writes, 0, "missing tracking preference must remain a virtual Detailed read");
assert.strictEqual(env.context.p950NormalizeTrackingPreferences({ liftingDetail: "full" }).liftingDetail, "full");
assert.strictEqual(env.context.p950NormalizeTrackingPreferences({ liftingDetail: "simple" }).liftingDetail, "simple");
assert.strictEqual(env.context.p950NormalizeTrackingPreferences({ liftingDetail: "unknown" }).liftingDetail, "full");

const fullSimple = env.context.p950BuildTrackingPreset("full_coaching", { liftingDetail: "simple" });
const strengthSimple = env.context.p950BuildTrackingPreset("strength_tracking", fullSimple);
const customSimple = env.context.p950BuildTrackingPreset("custom", strengthSimple);
assert.strictEqual(fullSimple.preset, "full_coaching");
assert.strictEqual(strengthSimple.preset, "strength_tracking");
assert.strictEqual(customSimple.preset, "custom");
assert.strictEqual(fullSimple.liftingDetail, "simple");
assert.strictEqual(strengthSimple.liftingDetail, "simple");
assert.strictEqual(customSimple.liftingDetail, "simple");
assert.strictEqual(env.context.p950DetectTrackingPreset(fullSimple), "full_coaching", "lifting detail must be orthogonal to named presets");
assert.strictEqual(env.context.p950DetectTrackingPreset(strengthSimple), "strength_tracking", "Simple must not force Strength Tracking to Custom");

assert(env.context.p950SaveTrackingPreferences(fullSimple, "2026-09-15").ok);
assert(env.context.p950SaveTrackingPreferences(strengthSimple, "2026-09-15").ok);
assert.strictEqual(env.context.p950GetTrackingPreferences().timeline.length, 1, "same-date save did not replace");
assert.strictEqual(env.context.p950GetTrackingSnapshotForDate("2026-09-14").liftingDetail, "full", "pre-timeline dates must resolve Detailed");
assert.strictEqual(env.context.p950GetTrackingSnapshotForDate("2026-09-15").liftingDetail, "simple");
const fullDetailed = env.context.p950BuildTrackingPreset("full_coaching", { liftingDetail: "full" });
assert(env.context.p950SaveTrackingPreferences(fullDetailed, "2026-09-16").ok);
assert.deepStrictEqual(Array.from(env.context.p950GetTrackingPreferences().timeline, entry => entry.effectiveDate), ["2026-09-15", "2026-09-16"]);

const oldProfile = env.context.p950GetDefaultUserProfile();
oldProfile.preferences.tracking = env.context.p950BuildTrackingPreset("full_coaching");
delete oldProfile.preferences.tracking.liftingDetail;
oldProfile.preferences.tracking.timeline = [{ ...env.context.p950BuildTrackingPreset("full_coaching"), effectiveDate: "2026-09-01" }];
delete oldProfile.preferences.tracking.timeline[0].liftingDetail;
delete oldProfile.preferences.tracking.timeline[0].timeline;
env = profileEnvironment({ "mf-user-profile": JSON.stringify(oldProfile) });
env.local.reset();
env.context.p950InitUserProfile();
assert.strictEqual(env.local.writes, 0, "virtual Detailed normalization eagerly migrated an old profile");
assert.strictEqual(env.context.p950GetTrackingSnapshotForDate("2026-09-02").liftingDetail, "full");

assert(html.includes('data-mf-lifting-detail="full"') && html.includes('data-mf-lifting-detail="simple"'));
assert(html.includes("Per Set — Detailed") && html.includes("Per Lift — Simple"));
assert(html.includes("lowest-rep work set") && html.includes("hardest (lowest) RIR"));
assert(profileSource.includes("Lifting-detail periods in selected range"));
assert(profileSource.includes("Full Coaching + Per Set — Detailed"));

console.log("MarcusFit 10.11.1 simple lifting: preference foundation PASS");
