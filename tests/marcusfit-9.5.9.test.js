const fs = require("fs");
const vm = require("vm");
const crypto = require("crypto");
const assert = require("assert");

const acceptedPath = "Releases/MarcusFit9_5_8_5.html";
const releasePath = "Releases/MarcusFit9_5_9.html";
const accepted = fs.readFileSync(acceptedPath, "utf8");
const release = fs.readFileSync(releasePath, "utf8");

function extractBalanced(source, startToken) {
  const start = source.indexOf(startToken);
  assert(start >= 0, "Missing token: " + startToken);
  const brace = source.indexOf("{", start);
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
    if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error("Unbalanced token: " + startToken);
}

function sha(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// Base P and proposal application stay byte-identical to the accepted release.
assert.strictEqual(
  sha(extractBalanced(release, "const P =")),
  sha(extractBalanced(accepted, "const P =")),
  "Base P changed"
);
[
  "function applySync()",
  "function p954ApplyProposal(",
  "function p954BuildApplyPlan(",
  "function p8BuildBackup()",
  "function p8ValidateBackup(",
  "function buildLogSection("
].forEach(token => {
  if (accepted.includes(token)) {
    assert.strictEqual(
      sha(extractBalanced(release, token)),
      sha(extractBalanced(accepted, token)),
      token + " changed"
    );
  }
});

assert(release.includes('const APP_VERSION = "9.5.9";'));
assert(release.includes("const LIFECYCLE_VERSION = APP_VERSION;"));
assert(release.includes("P958_MARCUS_SNAPSHOT=JSON.stringify(P)"));
const generalGymBlock = release.slice(
  release.indexOf('p958Template("general_gym_full_body_3d"'),
  release.indexOf('p958Template("hypertrophy_aesthetic_4d"')
);
assert.strictEqual((generalGymBlock.match(/p958Day\(/g) || []).length, 3, "General gym starter must retain 3 days");
assert.strictEqual((generalGymBlock.match(/\[\"tpl-gg3-/g) || []).length, 12, "General gym starter must retain 12 exercises");

const start = release.indexOf("// -- 9.5.9 EXERCISE METRICS");
const end = release.indexOf("const p959LegacyRenderWoExercises", start);
assert(start >= 0 && end > start, "Unable to isolate 9.5.9 core");
const core = release.slice(start, end);

const exercises = {};
let history = {};
let storageWrites = 0;
const context = {
  console,
  window: {},
  localStorage: {
    setItem() { storageWrites++; },
    removeItem() { storageWrites++; }
  },
  getResolvedDays() { return [{ exercises: Object.values(exercises) }]; },
  getF(id, field, fallback) {
    return exercises[id] && exercises[id][field] !== undefined ? exercises[id][field] : fallback;
  },
  p9IsCardio(load, rir) {
    return /\b(min|bike|walk|jog|treadmill|bpm|hr)\b/i.test(load || "") || rir === "\u2014";
  },
  p5ParseRepRange(value) {
    const nums = String(value || "").match(/\d+(?:\.\d+)?/g);
    if (!nums) return null;
    const lo = Number(nums[0]), hi = Number(nums[1] || nums[0]);
    return { lo, hi, mid: (lo + hi) / 2 };
  },
  p5ParseRir(value) {
    if (!value || /^(\u2014|-|n\/a)$/i.test(value)) return null;
    const nums = String(value).match(/\d+(?:\.\d+)?/g);
    if (!nums) return null;
    return nums.reduce((a, n) => a + Number(n), 0) / nums.length;
  },
  p9ParseLoad() {},
  p9GetTopActualLoad() {},
  p5FormatLastSets() {},
  p9GetBestExercisePerformance() {},
  p9BuildSuggestion() {},
  p9GetProgressionStatus() {},
  p9BadgeHTML() {},
  p9BuildProgressionExport() {},
  p9GetExerciseHistory(id) { return history[id] || []; },
  p9GetTargetLoadRangeForExercise(id) {
    const ex = exercises[id];
    if (!ex) return null;
    const nums = String(ex.load || "").match(/\d+(?:\.\d+)?/g);
    if (!nums) return null;
    return { low: Number(nums[0]), high: Number(nums[1] || nums[0]), suffix: " lb" };
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(core, context, { filename: "MarcusFit9_5_9-core.js" });

function sets(load, reps, rir = "2", count = 3) {
  return Array.from({ length: count }, () => ({ wt: load, reps: String(reps), rir }));
}
function install(ex) { exercises[ex.id] = ex; return ex; }
function status(ex, validSets) {
  return context.p9GetProgressionStatus(ex.id, validSets, ex.reps, ex.rir);
}

const weighted = install({ id: "weighted", name: "Dumbbell Press", sets: 3, reps: "8-12", load: "50-100 lb", rir: "1-2" });
assert.strictEqual(status(weighted, sets("60 lb", 10)), "build_reps");
assert.strictEqual(status(weighted, sets("60 lb", 8, "0")), "safer_hold");
assert.strictEqual(status(weighted, sets("60 lb", 12)), "progress_load");

const ceiling = install({ id: "ceiling", name: "DB Lateral Raise", sets: 4, reps: "15-20", load: "10-20 lb", rir: "1-2" });
history.ceiling = [{ dateKey: "day-2026-01-01", validSets: sets("20 lb", 20, "2", 4) }];
assert.strictEqual(status(ceiling, sets("20 lb", 20, "2", 4)), "capped_hold");
history.ceiling.unshift({ dateKey: "day-2026-01-02", validSets: sets("20 lb", 20, "2", 4) });
assert.strictEqual(status(ceiling, sets("20 lb", 20, "2", 4)), "ceiling_update");
assert.strictEqual(
  context.p959SessionQualifiesAtCeiling("ceiling", [...sets("20 lb", 20, "2", 3), ...sets("20 lb", 14, "2", 1)], "15-20", "1-2"),
  false
);
assert.strictEqual(context.p959SessionQualifiesAtCeiling("ceiling", sets("20 lb", 20, "0", 4), "15-20", "1-2"), false);

const assisted = install({ id: "assisted", name: "Assisted Pull-Up", sets: 3, reps: "8-10", load: "100-120 lb assistance", rir: "1-2" });
history.assisted = [
  { dateKey: "day-2026-01-02", validSets: sets("110 lb assist", 10, "2") },
  { dateKey: "day-2026-01-01", validSets: sets("120 lb assist", 10, "2") }
];
const assistedProfile = context.p959GetExerciseMetricProfile("assisted", assisted);
assert.strictEqual(assistedProfile.lowerIsBetter, true);
assert.strictEqual(context.p959GetDirectionalLoad(history.assisted[0].validSets, assistedProfile).numeric, 110);
assert.strictEqual(context.p9GetBestExercisePerformance("assisted"), "110 lb assistance \u00d7 10");
assert.strictEqual(status(assisted, sets("110 lb assist", 10, "2")), "progress_load");
assert.match(context.p9BuildSuggestion("assisted", sets("110 lb assist", 10, "2"), assisted.reps, assisted.rir).text, /Reduce assistance/);
const regressedAssistance = context.p959GetDirectionalLoad(sets("120 lb assist", 10, "2"), assistedProfile);
const priorAssistance = context.p959GetDirectionalLoad(sets("110 lb assist", 10, "2"), assistedProfile);
assert.strictEqual(regressedAssistance.numeric < priorAssistance.numeric, false, "110 to 120 must not count as progression");

const cardio = install({ id: "cardio", name: "Brisk Walk / Light Jog", sets: 1, reps: "30-40 min", load: "HR 130", rir: "\u2014" });
history.cardio = [{ dateKey: "day-2026-01-01", validSets: sets("HR 130", 35, "\u2014", 1) }];
assert.strictEqual(context.p959GetExerciseMetricProfile("cardio", cardio).metric, "duration_minutes");
assert.strictEqual(status(cardio, history.cardio[0].validSets), "build_duration");
assert.strictEqual(context.p5FormatLastSets(history.cardio[0].validSets, "cardio"), "35 min");
assert.notStrictEqual(status(cardio, history.cardio[0].validSets), "progress_load");

const hold = install({ id: "hold", name: "Plank", sets: 3, reps: "30-60 sec", load: "Bodyweight", rir: "\u2014" });
history.hold = [{ dateKey: "day-2026-01-01", validSets: sets("bodyweight", 45, "\u2014") }];
assert.strictEqual(status(hold, history.hold[0].validSets), "build_duration");
assert.strictEqual(context.p9GetBestExercisePerformance("hold"), "45 sec");
assert.strictEqual(status(hold, sets("bodyweight", 60, "\u2014")), "duration_target");
assert(!context.p9GetBestExercisePerformance("hold").includes("reps"));

const normalization = [
  ["40lb db", { numeric: 40, equipment: "dumbbell" }],
  ["40 lb dumbbells", { numeric: 40, equipment: "dumbbell" }],
  ["40 lb/side", { numeric: 40, perSide: true }],
  ["110 lb assist", { numeric: 110, assistance: true }],
  ["HR 130", { numeric: 130, nonLoadType: "heart_rate", unit: "bpm" }],
  ["130 bpm", { numeric: 130, nonLoadType: "heart_rate", unit: "bpm" }],
  ["bodyweight", { nonLoadType: "bodyweight" }]
];
normalization.forEach(([raw, expected]) => {
  const actual = context.p959NormalizeLoggedLoad(raw);
  Object.keys(expected).forEach(key => assert.strictEqual(actual[key], expected[key], raw + " " + key));
  assert.strictEqual(actual.raw, raw);
});

assert.strictEqual(storageWrites, 0, "Core rendering/debug helpers wrote localStorage");
console.log("MarcusFit 9.5.9 focused tests: PASS");
