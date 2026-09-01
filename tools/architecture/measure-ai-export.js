const fs = require("fs");
const Module = require("module");
const path = require("path");
const vm = require("vm");

const root = path.resolve(process.argv[2] || path.join(__dirname, "..", ".."));
const harnessPath = path.join(root, "tests", "marcusfit-10.3.0-basketball-ai-sync.test.js");
const harness = new Module(harnessPath, module);
harness.filename = harnessPath;
harness.paths = Module._nodeModulePaths(path.dirname(harnessPath));
harness._compile(fs.readFileSync(harnessPath, "utf8") + "\nmodule.exports.createContext=createContext;", harnessPath);

const env = harness.exports.createContext();
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
c.genExport();
const normalized = String(c.window._exp || "").replace(/^Generated: .*$/m, "Generated: <deterministic>");
const duplicatedGuidance = {
  habitContractBlocks: (normalized.match(/Habit proposal contract:/g) || []).length,
  basketballContractBlocks: (normalized.match(/Basketball proposal contract:/g) || []).length,
  legacyFormattingBlocks: (normalized.match(/FORMATTING RULES:/g) || []).length
};
process.stdout.write(JSON.stringify({ characters: normalized.length, lines: normalized.split("\n").length, duplicatedGuidance }));
