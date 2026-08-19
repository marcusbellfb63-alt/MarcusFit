const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

function createStorage(initial = {}) {
  const memory = new Map(Object.entries(initial));
  let writes = 0;
  const api = {
    getItem(key) { return memory.has(key) ? memory.get(key) : null; },
    setItem(key, value) { writes++; memory.set(key, String(value)); },
    removeItem(key) { writes++; memory.delete(key); },
    key(index) { return [...memory.keys()][index] || null; },
    get length() { return memory.size; },
    get writes() { return writes; }
  };
  return new Proxy(api, {
    ownKeys() { return [...memory.keys()]; },
    getOwnPropertyDescriptor(target, prop) {
      if (memory.has(prop)) return { enumerable: true, configurable: true };
      return Object.getOwnPropertyDescriptor(target, prop);
    }
  });
}

function element() {
  return {
    value: "", textContent: "", innerHTML: "", style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, querySelectorAll() { return []; }, scrollIntoView() {}
  };
}

function createContext(initial) {
  const localStorage = createStorage(initial);
  const elements = new Map();
  const getElementById = id => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const context = {
    console, localStorage, process: { versions: { node: "test" } },
    document: {
      getElementById, querySelectorAll() { return []; },
      addEventListener() {}, createElement: element
    },
    window: null, HABITS: [], habitState: {},
    renderProgram() {}, renderWoExercises() {}, renderWoRecs() {}, populateWoDaySelect() {},
    renderHabits() {}, p9510HistoryOutcome() { return ""; }
  };
  context.window = context;
  vm.createContext(context);
  [
    "assets/js/core/01-app-constants.js",
    "assets/js/data/02-program-data.js",
    "assets/js/program/03-lifecycle-resolved.js",
    "assets/js/sync/12-ai-sync.js",
    "assets/js/features/14-history.js"
  ].forEach(file => vm.runInContext(read(file), context, { filename: file }));
  return { context, localStorage, getElementById };
}

const legacyLifecycle = {
  schemaVersion: 1,
  lifecycleVersion: "10.1.0",
  customExercises: {
    "partial-d7-e0": { id: "partial-d7-e0", name: "Legacy Cable Raise", sets: 3, reps: "12", load: "20 lb", rir: "2", gymKey: "partial", dayIdx: 7, addedAt: "2025-01-01T00:00:00.000Z" },
    "partial-d7-e1": { id: "partial-d7-e1", name: "Legacy Curl", sets: 3, reps: "10", load: "25 lb", rir: "2", gymKey: "partial", dayIdx: 7, addedAt: "2025-01-02T00:00:00.000Z" },
    "home-d8-e0": { id: "home-d8-e0", name: "Archived Debris", gymKey: "home", dayIdx: 8 },
    malformed: { id: "malformed", name: "Malformed", gymKey: "partial", dayIdx: "bad" }
  },
  inactiveIds: { "home-d8-e0": { inactivatedAt: "2025-02-01T00:00:00.000Z", replacedBy: null } },
  replacements: { "old-id": { newId: "partial-d7-e0", replacedAt: null, reason: "legacy" } },
  orderOverrides: { "partial:7": ["partial-d7-e1", "partial-d7-e0"] },
  dayOverrides: {},
  dayAdditions: { partial: { "6": { name: "Existing Valid Day", source: "manual", meta: { keep: true } } } },
  disabledDays: {}
};
const workoutRaw = JSON.stringify({
  gym: "partial", dayIdx: "7", dayName: "Arms - Strength & Pump",
  exercises: { "partial-d7-e0": { sets: [{ wt: "20", reps: "12", rir: "2" }] } }
});
const dailyRaw = JSON.stringify({ date: "2025-03-01", logGym: "partial", woDayIdx: "7", workout: "yes" });
const recsRaw = JSON.stringify({ "partial:7": { items: ["Keep form strict"], strategy: "legacy", experimentTag: "repair", expiresAfterSessions: 2 } });
const initial = {
  "mf-exercise-state": JSON.stringify(legacyLifecycle),
  "mf-recommendations": recsRaw,
  "day-2025-03-01": dailyRaw,
  "day-2025-03-01-wo": workoutRaw
};

const { context: c, localStorage, getElementById } = createContext(initial);
const beforeP = JSON.stringify(c.P);
const beforeWorkout = localStorage.getItem("day-2025-03-01-wo");
const beforeDaily = localStorage.getItem("day-2025-03-01");
const beforeRecs = localStorage.getItem("mf-recommendations");
const existingAddition = JSON.stringify(legacyLifecycle.dayAdditions.partial["6"]);

const repair = c.mfRepairLegacyVirtualDays();
assert.strictEqual(repair.repairedDayCount, 1);
assert.deepStrictEqual(JSON.parse(JSON.stringify(repair.repairedDays.map(x => [x.gymKey, x.dayIdx]))), [["partial", 7]]);
let lifecycle = c.getLifecycle();
assert.strictEqual(JSON.stringify(lifecycle.dayAdditions.partial["6"]), existingAddition, "valid day addition changed");
assert.strictEqual(lifecycle.dayAdditions.home && lifecycle.dayAdditions.home["8"], undefined, "archived-only orphan created a day");
assert.strictEqual(lifecycle.customExercises["partial-d7-e0"].id, "partial-d7-e0");
assert.strictEqual(lifecycle.replacements["old-id"].newId, "partial-d7-e0");

const repairedDay = c.getProgramDay("partial", 7);
assert(repairedDay && repairedDay._isVirtual);
assert.strictEqual(repairedDay.name, "Arms - Strength & Pump");
assert.deepStrictEqual(JSON.parse(JSON.stringify(repairedDay.exercises.map(x => x.id))), ["partial-d7-e1", "partial-d7-e0"]);
assert.strictEqual(c.isProgramDay("partial", 7), true);
assert.strictEqual(c.isProgramDay("partial", 99), false);

const writesAfterFirstRepair = localStorage.writes;
assert.strictEqual(c.mfRepairLegacyVirtualDays().repairedDayCount, 0);
assert.strictEqual(localStorage.writes, writesAfterFirstRepair, "idempotent migration wrote storage twice");

function sync(updates) {
  getElementById("syncInput").value = "MARCUSFIT_UPDATE_START\n" + JSON.stringify(updates) + "\nMARCUSFIT_UPDATE_END";
  c.applySync();
  return getElementById("syncResult").textContent;
}

let result = sync([{ id: "partial-d7-e0", load: "22.5 lb", sets: "3", reps: "10-15", rir: "1-2" }]);
assert(!result.includes("not a known exercise"), result);
assert.strictEqual(JSON.parse(localStorage.getItem("mf-overrides"))["partial-d7-e0"].load, "22.5 lb");

result = sync([{ id: "_reorder", _action: "reorder", gym: "partial", dayIndex: 7, exerciseOrder: ["partial-d7-e0", "partial-d7-e1"] }]);
assert(result.includes("Reordered"), result);

result = sync([{ _action: "recommendations", gym: "partial", dayIndex: 7, items: ["Pause at peak"], strategy: "hypertrophy", experimentTag: "virtual-day", expiresAfterSessions: 2 }]);
assert(result.includes("Recommendations set"), result);

result = sync([{ id: "partial-d7-e0", _action: "remove" }]);
assert(result.includes("archived"), result);
lifecycle = c.getLifecycle();
assert(lifecycle.inactiveIds["partial-d7-e0"]);
assert(lifecycle.customExercises["partial-d7-e0"], "remove deleted the stable custom record");

result = sync([{ id: "partial-d7-e0", _action: "reactivate" }]);
assert(result.includes("reactivated"), result);
assert.strictEqual(c.getLifecycle().inactiveIds["partial-d7-e0"], undefined);
assert(c.getProgramDay("partial", 7).exercises.some(x => x.id === "partial-d7-e0"));

result = sync([{ id: "_reorder", _action: "reorder", gym: "partial", dayIndex: 99, exerciseOrder: [] }]);
assert(result.includes("out of range"), result);

const identity = c.getHistoricalDayIdentity("partial", 7, "Old Partial Arms");
assert.strictEqual(identity.currentName, "Arms - Strength & Pump");
assert.strictEqual(identity.historicalName, "Old Partial Arms");
assert.strictEqual(identity.showHistoricalName, true);

const debug = c.mfProgramDayIntegrityDebug();
assert.strictEqual(debug.activeVirtualDayCount, 2);
assert.strictEqual(debug.validVirtualDayCount, 2);
assert.strictEqual(debug.migratedDayCount, 1);
assert.strictEqual(debug.activeUnresolvedDayCount, 0);
assert.strictEqual(debug.archivedOnlyIgnoredCount, 1);
assert(debug.invalidOrphanCount >= 1);

assert.strictEqual(localStorage.getItem("day-2025-03-01-wo"), beforeWorkout, "workout history was rewritten");
assert.strictEqual(localStorage.getItem("day-2025-03-01"), beforeDaily, "daily history was rewritten");
assert.notStrictEqual(localStorage.getItem("mf-recommendations"), beforeRecs, "recommendation action did not persist");
assert.strictEqual(JSON.stringify(c.P), beforeP, "base P changed");

console.log("MarcusFit 10.1.3 program-day integrity: PASS");
