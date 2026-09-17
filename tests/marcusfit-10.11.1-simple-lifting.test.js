const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const profileSource = fs.readFileSync(path.join(root, "assets/js/state/04-runtime-state-profile-preferences.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const workoutSource = fs.readFileSync(path.join(root, "assets/js/features/10-workout-logging.js"), "utf8");
const dailySource = fs.readFileSync(path.join(root, "assets/js/features/08-program-daily.js"), "utf8");
const historySource = fs.readFileSync(path.join(root, "assets/js/features/14-history.js"), "utf8");

function extractBalanced(source, token) {
  const at = source.indexOf(token); assert(at >= 0, `missing ${token}`);
  const brace = source.indexOf("{", at); let depth = 0, quote = null, escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) { if (escaped) escaped = false; else if (ch === "\\") escaped = true; else if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    if (ch === "}" && --depth === 0) return source.slice(at, i + 1);
  }
  throw new Error(`unbalanced ${token}`);
}

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

// The rendered workout owns save mode. Saved evidence wins over current
// preference, while a new blank workout uses the date-effective preference.
const modeStore = storage();
const modeContext = { localStorage: modeStore.api, tDate: new Date("2026-09-15T12:00:00"), dKey() { return "day-2026-09-15"; }, p950LocalDateKey() { return "2026-09-15"; }, p950GetTrackingSnapshotForDate() { return { liftingDetail: "simple" }; } };
vm.createContext(modeContext);
vm.runInContext(extractBalanced(workoutSource, "function mfWorkoutEvidenceMode")+"\n"+extractBalanced(workoutSource, "function mfWorkoutResolveLiftingDetail"), modeContext);
assert.strictEqual(modeContext.mfWorkoutResolveLiftingDetail(), "simple");
modeStore.api.setItem("day-2026-09-15-wo", JSON.stringify({ exercises: {} }));
assert.strictEqual(modeContext.mfWorkoutResolveLiftingDetail(), "full", "legacy Detailed history did not override Simple preference");
modeStore.api.setItem("day-2026-09-15-wo", JSON.stringify({ liftingDetail: "simple", exercises: {} }));
modeContext.p950GetTrackingSnapshotForDate = () => ({ liftingDetail: "full" });
assert.strictEqual(modeContext.mfWorkoutResolveLiftingDetail(), "simple", "saved Simple history did not override Detailed preference");
assert.strictEqual(modeContext.mfWorkoutResolveLiftingDetail({ exercises: {} }), "full", "Detailed draft ownership was not preserved");
assert.strictEqual(modeContext.mfWorkoutResolveLiftingDetail({ liftingDetail: "simple", exercises: {} }), "simple", "Simple draft ownership was not preserved");

// Simple collection writes one authoritative summary with an empty set array.
// A blank exercise (including its prescribed-count placeholder) stays absent.
const fields = new Map([
  ["woDaySelect", { value: "0" }], ["woExerciseLog", { dataset: { liftingDetail: "simple" } }],
  ["mfWorkoutActiveCalories", { value: "321", setCustomValidity() {} }]
]);
const values = {
  "lift|summarySetCount": "3", "lift|summaryReps": "8", "lift|summaryLoad": "100 lb", "lift|summaryRir": "1–2", "lift|exnote": "clean",
  "blank|summarySetCount": "", "blank|summaryReps": "", "blank|summaryLoad": "", "blank|summaryRir": "", "blank|exnote": ""
};
const collectContext = {
  document: {
    getElementById(id) { return fields.get(id) || null; },
    querySelector(selector) { const id=(selector.match(/data-exid="([^"]+)"/)||[])[1],field=(selector.match(/data-field="([^"]+)"/)||[])[1];return id&&field?{ value: values[`${id}|${field}`] || "" }:null; }
  },
  logGym: "home", tDate: new Date("2026-09-15T12:00:00"),
  getResolvedDays() { return [{ _dayIdx: 0, name: "Day", exercises: [{ id: "lift", sets: "3" }, { id: "blank", sets: "4" }] }]; },
  getF(id,key,fallback) { return fallback; }, p950LocalDateKey() { return "2026-09-15"; }, p950IsTrackingEnabled() { return true; }
};
vm.createContext(collectContext);
vm.runInContext(extractBalanced(workoutSource, "function mfWorkoutReadActiveCalories")+"\n"+extractBalanced(workoutSource, "function collectWoData")+"\n"+extractBalanced(workoutSource, "function p85PreserveDormantWorkoutFields"), collectContext);
const simpleWorkout = JSON.parse(JSON.stringify(collectContext.collectWoData("2026-09-15")));
assert.deepStrictEqual(simpleWorkout, { gym: "home", dayIdx: "0", dayName: "Day", liftingDetail: "simple", exercises: { lift: { sets: [], summary: { version: 1, setCount: 3, repsFloor: "8", load: "100 lb", rirFloor: "1–2" }, note: "clean" } }, activeCalories: 321 });
assert.strictEqual(simpleWorkout.exercises.lift.sets.length, 0);
assert(!simpleWorkout.exercises.blank, "blank Simple exercise was stored from its placeholder");
collectContext.p950IsTrackingEnabled = path => path !== "modules.sessionNotes";
const dormant = JSON.parse(JSON.stringify(collectContext.p85PreserveDormantWorkoutFields({ liftingDetail: "simple", exercises: {} }, { liftingDetail: "simple", exercises: { lift: { sets: [], summary: simpleWorkout.exercises.lift.summary, note: "keep" } } }, "2026-09-15")));
assert.deepStrictEqual(dormant.exercises.lift.summary, simpleWorkout.exercises.lift.summary);
assert.strictEqual(dormant.exercises.lift.note, "keep");
assert.deepStrictEqual(dormant.exercises.lift.sets, []);

// Draft resume renders from woData mode before restoring summary values, and
// all summary controls participate in autosave.
assert(dailySource.includes("renderWoExercises(d.woData||null)"));
assert(dailySource.includes("summarySetCount") && dailySource.includes("summaryReps") && dailySource.includes("summaryLoad") && dailySource.includes("summaryRir"));
assert(dailySource.includes(".wo-summary-sets") && dailySource.includes(".wo-summary-rir"));

// History shows one explicit summary and never fabricates numbered sets.
const historyStore = storage({ "day-2026-09-15-wo": JSON.stringify(simpleWorkout) });
const historyNode = { innerHTML: "", insertAdjacentHTML() {} };
const historyContext = { localStorage: historyStore.api, document: { getElementById() { return historyNode; } }, HABITS: [], p9510HistoryOutcome() { return null; }, p7HistoryIcon() { return ""; }, getSafeDayForLog() { return { exercises: [{ id: "lift", name: "Lift" }] }; }, getHistoricalDayIdentity() { return { currentName: "Day", historicalName: "Day", showHistoricalName: false }; }, getF(id,key,fallback) { return fallback; } };
vm.createContext(historyContext); vm.runInContext(extractBalanced(historySource, "function renderHistoryFromEntries"), historyContext);
historyContext.renderHistoryFromEntries([{ key: "day-2026-09-15", data: { date: "2026-09-15", workout: "yes", logGym: "home" } }]);
assert(historyNode.innerHTML.includes("Per-Lift summary") && historyNode.innerHTML.includes("lowest-set reps 8"));
assert(!historyNode.innerHTML.includes("Set 1:"), "Simple history fabricated a numbered set row");

console.log("MarcusFit 10.11.1 simple lifting: preference + storage/draft/history PASS");
