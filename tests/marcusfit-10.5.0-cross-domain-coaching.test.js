const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const constants = fs.readFileSync(path.join(root, "assets/js/core/01-app-constants.js"), "utf8");
const exportSource = fs.readFileSync(path.join(root, "assets/js/sync/11-ai-export.js"), "utf8");
const habitSource = fs.readFileSync(path.join(root, "assets/js/features/20-habits.js"), "utf8");
const basketballSource = fs.readFileSync(path.join(root, "assets/js/features/22-basketball.js"), "utf8");
const scriptOrder = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/runtime-script-order.json"), "utf8"));
const sizeFixture = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/ai-export-10.5-size.json"), "utf8"));
const sha = value => crypto.createHash("sha256").update(value).digest("hex");

assert(constants.includes('const APP_VERSION = "10.5.0";'));
assert(constants.includes("const LIFECYCLE_VERSION = APP_VERSION;"));
assert(html.includes("<title>MarcusFit 10.5.0</title>"));
assert.strictEqual([...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)].length, 22);
assert.deepStrictEqual([...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)].map(x => x[1]), scriptOrder);
assert.strictEqual(sha(fs.readFileSync(path.join(root, "Releases/MarcusFit9_6_0.html"))), "69a3a66541d14290a6a7b73bf313365176169fd0d659e6effb29edcaf7a4e34b");
assert.strictEqual(sha(fs.readFileSync(path.join(root, "assets/js/sync/12-ai-sync.js"))), "25aaf52986493af7d5796b57f81746f8f279f506b2550a61ca7b011c9572c51e");

// Reuse the full accepted runtime harness. Requiring this file also executes
// the realistic core/Habit/Basketball matrix, stale checks, backup validation,
// advisory-prose parsing, and zero-write malformed-envelope assertions.
const { createContext } = require("./marcusfit-10.3.0-basketball-ai-sync.test.js");
const env = createContext();
const c = env.context;
const storage = env.localStorage;
env.getElementById("exportRangeSelect").value = "14";

const habitStore = c.p960BuildDefaultDefinitions("2026-08-01T12:00:00.000Z");
c.p960SaveHabitStore(habitStore);
const habitId = c.p960GetActiveHabits()[0].id;
const day = (date, weight, completed) => JSON.stringify({
  date, weight, sleep: 7, protein: 150, water: 96, mood: 7, hunger: 4,
  habits: { [habitId]: { completed, notes: completed ? "steady" : "simplify cue" } },
  workout: completed ? "done" : "rest", notes: "Representative 10.5 fixture"
});
storage.setItem("day-2026-08-20", day("2026-08-20", 220, true));
storage.setItem("day-2026-08-24", day("2026-08-24", 218, false));
storage.setItem("day-2026-08-28", day("2026-08-28", 217, true));
const lowerId = vm.runInContext("P.partial[1].exercises[0].id", c);
storage.setItem("day-2026-08-20-wo", JSON.stringify({ gym: "partial", dayIdx: 1, exercises: { [lowerId]: { sets: [{ wt: "80", reps: "10", rir: "2" }] } } }));
storage.setItem("day-2026-08-28-wo", JSON.stringify({ gym: "partial", dayIdx: 1, exercises: { [lowerId]: { sets: [{ wt: "85", reps: "10", rir: "2" }] } } }));
c.setRecsForDay("partial", 1, { strategy: "fatigue_check", experimentTag: "lower_body_tempo", expiresAfterSessions: 2, items: ["Hold RIR 2 while Basketball volume is elevated."] });
c.mfBasketballSelectProgram("guard_skills_3_session");
c.mfBasketballSaveSession({ date: "2026-08-22", type: "skills_practice", minutes: 35 }, { id: "bball-fixture-1", now: "2026-08-22T18:00:00.000Z" });
c.mfBasketballSaveSession({ date: "2026-08-26", type: "pickup_game", minutes: 50 }, { id: "bball-fixture-2", now: "2026-08-26T18:00:00.000Z" });
storage.setItem("mf-habit-proposal", JSON.stringify({ schemaVersion: 1, proposalVersion: "10.5.0", proposalId: "habit-proposal-fixture", status: "pending", summary: "Simplify morning cue", rationale: "Fixture", changes: [{ action: "keep", habitId }] }));
storage.setItem("mf-basketball-proposal", JSON.stringify({ schemaVersion: 1, proposalVersion: 1, proposalId: "bball-proposal-fixture", status: "pending", summary: "Keep drill target modest", rationale: "Fixture", changes: [] }));

const exported = c.genExport();
const headings = [
  "--- PROGRAM / USER BASIS ---", "--- CURRENT COACHING CONTEXT ---", "--- CROSS-DOMAIN COACHING SUMMARY ---",
  "--- LIFTING ---", "--- BASKETBALL ACTIVITY ---", "--- HABITS ---", "--- CARDIO / ACTIVITY ---",
  "--- VITALS / BODYWEIGHT / RELEVANT TRACKING ---", "--- SCHEDULED ADHERENCE ---",
  "--- RECENT HISTORY / PERFORMANCE EVIDENCE ---", "--- CURRENT RECOMMENDATIONS / EXPERIMENTS ---",
  "=== AI RESPONSE / MUTATION CONTRACT ==="
];
let prior = -1;
headings.forEach(heading => { const at = exported.indexOf(heading); assert(at > prior, `Missing or out-of-order heading: ${heading}`); prior = at; });
[
  "lifting 2 session(s), including 2 lower-body", "Basketball 2 session(s) / 85 min", "dedicated cardio 0 session(s)",
  `id=${habitId}`, "programId=", "sessionId=", "drillId=", "Pending habit proposal: Simplify morning cue",
  "Pending basketball proposal: Keep drill target modest", "lower_body_tempo", "WHAT I INTENTIONALLY LEFT ALONE",
  "directly mutable", "proposal/review mutable", "advisory/read-only", "Historical records", "never send or fabricate expected fingerprints"
].forEach(token => assert(exported.includes(token), `Export missing ${token}`));
assert(exported.includes("only recorded conditioning/cardio source"));
assert(exported.includes("Concurrent-load flag"));
assert(!exported.includes("[[MF105_"));
assert(!/readinessScore|calorie target|injury status:/i.test(exported));
assert.strictEqual((exported.match(/HABIT PROPOSAL/g) || []).length, 1);
assert.strictEqual((exported.match(/BASKETBALL PROPOSAL/g) || []).length, 1);
assert.strictEqual((exported.match(/Habit proposal contract:/g) || []).length, 0);
assert.strictEqual((exported.match(/Basketball proposal contract:/g) || []).length, 0);
assert(exportSource.includes("ONE TOP-LEVEL JSON CONTRACT"));
assert(habitSource.includes("unsupported top-level field"));
assert(basketballSource.includes("unsupported top-level field"));

// Recent history is historical evidence: enumerate the states stored on that
// day, then resolve personalized/archived definitions without rewriting data.
const historyEnv = createContext();
const historyContext = historyEnv.context;
const historyStorage = historyEnv.localStorage;
historyEnv.getElementById("exportRangeSelect").value = "14";
const historicalDefinitions = historyContext.p960EmptyHabitStore("2026-08-01T12:00:00.000Z");
historicalDefinitions.habits["habit-custom-history"] = {
  id: "habit-custom-history", name: "Custom Hydration", icon: "W", description: "", target: { type: "number", value: 72, unit: "oz" },
  schedule: { type: "daily" }, instructions: [], emphasis: "normal", active: true, archivedAt: null, source: "user",
  createdAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-01T12:00:00.000Z"
};
historicalDefinitions.habits["habit-archived-history"] = {
  id: "habit-archived-history", name: "Archived Mobility", icon: "M", description: "", target: { type: "duration", value: 10, unit: "min" },
  schedule: { type: "daily" }, instructions: [], emphasis: "normal", active: false, archivedAt: "2026-08-20T12:00:00.000Z", source: "user",
  createdAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-20T12:00:00.000Z"
};
historicalDefinitions.order = ["habit-custom-history", "habit-archived-history"];
historyContext.p960SaveHabitStore(historicalDefinitions);
historyStorage.setItem("day-2026-08-29", JSON.stringify({
  date: "2026-08-29",
  habits: {
    "habit-custom-history": { completed: true, value: 72, notes: "electrolyte day" },
    "habit-archived-history": { completed: false, value: 12, notes: "kept for history" },
    "habit-unknown-history": { completed: true, value: "legacy-value", notes: "definition no longer available" }
  }
}));
const historyBefore = historyStorage.snapshot();
const historicalExport = historyContext.genExport();
const recentHistory = historicalExport.slice(historicalExport.indexOf("--- RECENT HISTORY / PERFORMANCE EVIDENCE ---"), historicalExport.indexOf("--- CURRENT RECOMMENDATIONS / EXPERIMENTS ---"));
assert(recentHistory.includes("Habits recorded: 2 completed of 3 stored states"));
assert(recentHistory.includes("Custom Hydration [id=habit-custom-history]: completed; value 72 oz; note: electrolyte day"));
assert(recentHistory.includes("Archived Mobility [id=habit-archived-history] (archived): recorded; value 12 min; note: kept for history"));
assert(recentHistory.includes("Unknown Habit [id=habit-unknown-history]: completed; value legacy-value; note: definition no longer available"));
assert(!recentHistory.includes("Habits:  2/7 completed"));
assert(historicalExport.includes("Scheduled Habit completion:"));
assert(historicalExport.includes("eligible scheduled opportunities"));
assert.deepStrictEqual(historyStorage.snapshot(), historyBefore, "Export generation wrote to storage or historical records");

const sparse = createContext();
sparse.getElementById("exportRangeSelect").value = "program";
const sparseExport = sparse.context.genExport();
assert(!sparseExport.includes("=== AI SYNC FORMAT INSTRUCTIONS ==="));
assert(!sparseExport.includes("FORMATTING RULES:"));
assert.strictEqual((sparseExport.match(/=== AI RESPONSE \/ MUTATION CONTRACT ===/g) || []).length, 1);

const normalized = exported.replace(/^Generated: .*$/m, "Generated: <deterministic>");
const metrics = { characters: normalized.length, lines: normalized.split("\n").length };
assert.deepStrictEqual(metrics, { characters: sizeFixture.after.characters, lines: sizeFixture.after.lines });
assert(sizeFixture.after.characters < sizeFixture.before.characters);
assert(sizeFixture.after.lines < sizeFixture.before.lines);
assert.deepStrictEqual(sizeFixture.after.duplicatedGuidance, { habitContractBlocks: 0, basketballContractBlocks: 0, legacyFormattingBlocks: 0 });
console.log("MarcusFit 10.5.0 representative export metrics:", JSON.stringify(metrics));
console.log("MarcusFit 10.5.0 cross-domain coaching/export IA: PASS");
