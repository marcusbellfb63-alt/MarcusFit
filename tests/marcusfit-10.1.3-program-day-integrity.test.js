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

function storageSnapshot(storage) {
  const snapshot = {};
  Object.keys(storage).sort().forEach(key => { snapshot[key] = storage.getItem(key); });
  return snapshot;
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
  context.__testP=vm.runInContext("P",context);
  return { context, localStorage, getElementById };
}

const legacyLifecycle = {
  schemaVersion: 1,
  lifecycleVersion: "10.1.0",
  customExercises: {
    "partial-d7-e0": { id: "partial-d7-e0", name: "Legacy Cable Raise", sets: 3, reps: "12", load: "20 lb", rir: "2", gymKey: "partial", dayIdx: 7, addedAt: "2025-01-01T00:00:00.000Z" },
    "partial-d7-e1": { id: "partial-d7-e1", name: "Legacy Curl", sets: 3, reps: "10", load: "25 lb", rir: "2", gymKey: "partial", dayIdx: 7, addedAt: "2025-01-02T00:00:00.000Z" },
    "partial-d7-e2": { id: "partial-d7-e2", name: "Legacy Press", sets: 3, reps: "10", load: "30 lb", rir: "2", gymKey: "partial", dayIdx: 7, addedAt: "2025-01-03T00:00:00.000Z" },
    "partial-d7-e3": { id: "partial-d7-e3", name: "Legacy Row", sets: 3, reps: "12", load: "35 lb", rir: "2", gymKey: "partial", dayIdx: 7, addedAt: "2025-01-04T00:00:00.000Z" },
    "partial-d7-e4": { id: "partial-d7-e4", name: "Legacy Extension", sets: 3, reps: "12", load: "15 lb", rir: "2", gymKey: "partial", dayIdx: 7, addedAt: "2025-01-05T00:00:00.000Z" },
    "home-d7-e0": { id: "home-d7-e0", name: "Legacy Home Press", sets: 3, reps: "10", load: "30 lb", rir: "2", gymKey: "home", dayIdx: 7, addedAt: "2025-01-03T00:00:00.000Z" },
    "home-d7-e1": { id: "home-d7-e1", name: "Legacy Home Row", sets: 3, reps: "12", load: "35 lb", rir: "2", gymKey: "home", dayIdx: 7, addedAt: "2025-01-04T00:00:00.000Z" },
    "home-d7-e2": { id: "home-d7-e2", name: "Legacy Home Raise", sets: 3, reps: "15", load: "15 lb", rir: "2", gymKey: "home", dayIdx: 7, addedAt: "2025-01-05T00:00:00.000Z" },
    "home-d7-e3": { id: "home-d7-e3", name: "Legacy Home Curl", sets: 3, reps: "12", load: "20 lb", rir: "2", gymKey: "home", dayIdx: 7, addedAt: "2025-01-06T00:00:00.000Z" },
    "home-d7-e4": { id: "home-d7-e4", name: "Legacy Home Extension", sets: 3, reps: "12", load: "20 lb", rir: "2", gymKey: "home", dayIdx: 7, addedAt: "2025-01-07T00:00:00.000Z" },
    "partial-d6-e0": { id: "partial-d6-e0", name: "Legacy Day 6 Press", sets: 3, reps: "10", load: "25 lb", rir: "2", gymKey: "partial", dayIdx: 6, addedAt: "2025-01-08T00:00:00.000Z" },
    "partial-d6-e1": { id: "partial-d6-e1", name: "Legacy Day 6 Row", sets: 3, reps: "10", load: "30 lb", rir: "2", gymKey: "partial", dayIdx: 6, addedAt: "2025-01-09T00:00:00.000Z" },
    "partial-d6-e2": { id: "partial-d6-e2", name: "Legacy Day 6 Raise", sets: 3, reps: "12", load: "15 lb", rir: "2", gymKey: "partial", dayIdx: 6, addedAt: "2025-01-10T00:00:00.000Z" },
    "partial-d6-e3": { id: "partial-d6-e3", name: "Legacy Day 6 Curl", sets: 3, reps: "12", load: "20 lb", rir: "2", gymKey: "partial", dayIdx: 6, addedAt: "2025-01-11T00:00:00.000Z" },
    "partial-d6-e4": { id: "partial-d6-e4", name: "Legacy Day 6 Extension", sets: 3, reps: "12", load: "20 lb", rir: "2", gymKey: "partial", dayIdx: 6, addedAt: "2025-01-12T00:00:00.000Z" },
    "partial-d6-e5": { id: "partial-d6-e5", name: "Legacy Day 6 Core", sets: 3, reps: "15", load: "Bodyweight", rir: "2", gymKey: "partial", dayIdx: 6, addedAt: "2025-01-13T00:00:00.000Z" },
    "home-d8-e0": { id: "home-d8-e0", name: "Archived Debris", gymKey: "home", dayIdx: 8 },
    malformed: { id: "malformed", name: "Malformed", gymKey: "partial", dayIdx: "bad" }
  },
  inactiveIds: { "home-d8-e0": { inactivatedAt: "2025-02-01T00:00:00.000Z", replacedBy: null } },
  replacements: { "old-id": { newId: "partial-d7-e0", replacedAt: null, reason: "legacy" } },
  orderOverrides: {
    "partial:6": ["partial-d6-e5", "partial-d6-e4", "partial-d6-e3", "partial-d6-e2", "partial-d6-e1", "partial-d6-e0"],
    "partial:7": ["partial-d7-e4", "partial-d7-e3", "partial-d7-e2", "partial-d7-e1", "partial-d7-e0"],
    "home:7": ["home-d7-e4", "home-d7-e3", "home-d7-e2", "home-d7-e1", "home-d7-e0"]
  },
  dayOverrides: { home: { "0": { name: "Home A - Taper & Core" } }, partial: { "7": { name: "Partial Taper & Core" } } },
  dayAdditions: { partial: { "9": { name: "Existing Valid Day", source: "manual", meta: { keep: true } } } },
  disabledDays: {}
};
const workoutRaw = JSON.stringify({
  gym: "partial", dayIdx: "7", dayName: "Arms - Strength & Pump",
  exercises: { "partial-d7-e0": { sets: [{ wt: "20", reps: "12", rir: "2" }] } }
});
const dailyRaw = JSON.stringify({ date: "2025-03-01", logGym: "partial", woDayIdx: "7", workout: "yes" });
const recsRaw = JSON.stringify({
  "partial:6": { items: ["Preserve legacy identity"], strategy: "legacy", experimentTag: "legacy-id", expiresAfterSessions: 2 },
  "partial:7": { items: ["Keep form strict"], strategy: "legacy", experimentTag: "repair", expiresAfterSessions: 2 }
});
const homeWorkoutRaw = JSON.stringify({
  gym: "home", dayIdx: "7", dayName: "Home B - Full Body & Mobility",
  exercises: { "home-d7-e0": { sets: [{ wt: "30", reps: "10", rir: "2" }] } }
});
const renamedBaseWorkoutRaw = JSON.stringify({
  gym: "home", dayIdx: "0", dayName: "Arms - Strength & Pump",
  exercises: {}
});
const legacyIdWorkoutRaw = JSON.stringify({
  gym: "partial", dayIdx: "6", dayName: "Legacy Partial Day 7",
  exercises: {
    "partial-d6-e0": { sets: [{ wt: "25", reps: "10", rir: "2" }] },
    "partial-d6-e2": { sets: [{ wt: "15", reps: "12", rir: "2" }] },
    "partial-d6-e4": { sets: [{ wt: "20", reps: "12", rir: "2" }] }
  }
});
const initial = {
  "mf-exercise-state": JSON.stringify(legacyLifecycle),
  "mf-recommendations": recsRaw,
  "day-2025-03-01": dailyRaw,
  "day-2025-03-01-wo": workoutRaw,
  "day-2025-03-02": JSON.stringify({ date: "2025-03-02", logGym: "home", woDayIdx: "7", workout: "yes" }),
  "day-2025-03-02-wo": homeWorkoutRaw,
  "day-2025-02-01": JSON.stringify({ date: "2025-02-01", logGym: "home", woDayIdx: "0", workout: "yes" }),
  "day-2025-02-01-wo": renamedBaseWorkoutRaw,
  "day-2025-03-03": JSON.stringify({ date: "2025-03-03", logGym: "partial", woDayIdx: "6", workout: "yes" }),
  "day-2025-03-03-wo": legacyIdWorkoutRaw
};

const { context: c, localStorage, getElementById } = createContext(initial);
const beforeP = JSON.stringify(c.__testP);
const beforeWorkout = localStorage.getItem("day-2025-03-01-wo");
const beforeDaily = localStorage.getItem("day-2025-03-01");
const beforeRecs = localStorage.getItem("mf-recommendations");
const beforeLegacyIdWorkout = localStorage.getItem("day-2025-03-03-wo");
const originalCustomIds = Object.keys(legacyLifecycle.customExercises).sort();
const existingAddition = JSON.stringify(legacyLifecycle.dayAdditions.partial["9"]);

// Exact pre-repair failure class: active persisted children on home/partial
// virtual indexes have no parent dayAddition and would previously produce one
// Day Addition Validity finding per child (plus order-reference findings).
const preRepairMissingParentIds=Object.values(c.getLifecycle().customExercises).filter(ex=>
  Number.isInteger(ex.dayIdx)&&ex.dayIdx>=c.__testP[ex.gymKey].length&&!c.getLifecycle().inactiveIds[ex.id]&&!c.getDayAddition(ex.gymKey,ex.dayIdx)
).map(ex=>ex.id).sort();
assert.strictEqual(preRepairMissingParentIds.length,16);
["home-d7-e0","home-d7-e1","home-d7-e2","home-d7-e3","home-d7-e4","partial-d7-e0","partial-d7-e1","partial-d7-e2","partial-d7-e3","partial-d7-e4","partial-d6-e0","partial-d6-e2","partial-d6-e4"].forEach(id=>assert(preRepairMissingParentIds.includes(id),id+" missing from pre-repair regression state"));
const preRepairDebug=c.mfProgramDayIntegrityDebug();
assert.strictEqual(preRepairDebug.validVirtualDayCount,1);
assert.strictEqual(preRepairDebug.migratedDayCount,0);
assert.strictEqual(preRepairDebug.activeUnresolvedDayCount,3);
assert.strictEqual(preRepairDebug.archivedOnlyIgnoredCount,1);
const preRepairHealth=c.mfRunLifecycleValidation().find(check=>check.id==="day-addition-validity");
assert.strictEqual(preRepairHealth.status,"warn");
assert(preRepairHealth.detail.includes("3 active unresolved"),preRepairHealth.detail);

const repair = c.mfRepairLegacyVirtualDays();
assert.strictEqual(repair.repairedDayCount, 3);
assert.deepStrictEqual(JSON.parse(JSON.stringify(repair.repairedDays.map(x => [x.gymKey, x.dayIdx]))), [["home", 7], ["partial", 6], ["partial", 7]]);
let lifecycle = c.getLifecycle();
assert.strictEqual(JSON.stringify(lifecycle.dayAdditions.partial["9"]), existingAddition, "valid day addition changed");
assert.strictEqual(lifecycle.dayAdditions.home && lifecycle.dayAdditions.home["8"], undefined, "archived-only orphan created a day");
assert.strictEqual(lifecycle.customExercises["partial-d7-e0"].id, "partial-d7-e0");
assert.strictEqual(lifecycle.replacements["old-id"].newId, "partial-d7-e0");

const repairedDay = c.getProgramDay("partial", 7);
assert(repairedDay && repairedDay._isVirtual);
assert.strictEqual(repairedDay.name, "Partial Taper & Core");
assert.deepStrictEqual(JSON.parse(JSON.stringify(repairedDay.exercises.map(x => x.id))), ["partial-d7-e4", "partial-d7-e3", "partial-d7-e2", "partial-d7-e1", "partial-d7-e0"]);
assert.strictEqual(c.isProgramDay("partial", 7), true);
assert.strictEqual(c.isProgramDay("partial", 99), false);
assert.strictEqual(c.getProgramDay("home",7).name,"Home B - Full Body & Mobility");

const writesAfterFirstRepair = localStorage.writes;
assert.strictEqual(c.mfRepairLegacyVirtualDays().repairedDayCount, 0);
assert.strictEqual(localStorage.writes, writesAfterFirstRepair, "idempotent migration wrote storage twice");

function runSync(context, elementById, updates) {
  elementById("syncInput").value = "MARCUSFIT_UPDATE_START\n" + JSON.stringify(updates) + "\nMARCUSFIT_UPDATE_END";
  context.applySync();
  return elementById("syncResult").textContent;
}

function sync(updates) {
  return runSync(c, getElementById, updates);
}

// Exact real-data identity state: a persisted custom exercise is archived,
// its virtual parent is valid, and the active resolved day omits the ID.
const archivedLifecycle = JSON.parse(JSON.stringify(legacyLifecycle));
archivedLifecycle.dayAdditions.partial["7"] = {
  name: "QUICK 45 - BASKETBALL + UPPER PUMP",
  source: "legacy-repair"
};
archivedLifecycle.inactiveIds["partial-d7-e0"] = {
  inactivatedAt: "2025-02-15T00:00:00.000Z",
  replacedBy: null
};
archivedLifecycle.replacements = {
  "unrelated-old": { newId: "unrelated-new", replacedAt: null, reason: "preserve" }
};
const archivedFixture = createContext({
  ...initial,
  "mf-exercise-state": JSON.stringify(archivedLifecycle)
});
const archivedContext = archivedFixture.context;
const archivedStorage = archivedFixture.localStorage;
const archivedElementById = archivedFixture.getElementById;
const archivedId = "partial-d7-e0";
const archivedHistoryBefore = Object.fromEntries(Object.keys(archivedStorage)
  .filter(key => key.startsWith("day-"))
  .sort()
  .map(key => [key, archivedStorage.getItem(key)]));
const archivedResolvedDay = archivedContext.getProgramDay("partial", 7);
assert(archivedResolvedDay && archivedResolvedDay._isVirtual);
assert.strictEqual(archivedResolvedDay._dayIdx, 7);
assert.strictEqual(archivedResolvedDay.name, "QUICK 45 - BASKETBALL + UPPER PUMP");
assert(archivedContext.getLifecycle().customExercises[archivedId]);
assert(archivedContext.getLifecycle().inactiveIds[archivedId]);
assert(!archivedResolvedDay.exercises.some(ex => ex.id === archivedId));

const beforeArchivedUpdate = storageSnapshot(archivedStorage);
const beforeArchivedUpdateWrites = archivedStorage.writes;
const archivedCustomBefore = JSON.stringify(archivedContext.getLifecycle().customExercises[archivedId]);
let archivedResult = runSync(archivedContext, archivedElementById, [{
  id: archivedId,
  blurb: "10.1.3 QA - virtual-day Sync target verified."
}]);
assert(archivedResult.includes(archivedId + ": exercise is archived — reactivate it before updating"), archivedResult);
assert(!archivedResult.includes("expected next exercise index"), archivedResult);
assert.deepStrictEqual(storageSnapshot(archivedStorage), beforeArchivedUpdate, "rejected archived update mutated storage");
assert.strictEqual(archivedStorage.writes, beforeArchivedUpdateWrites, "rejected archived update wrote storage");

archivedResult = runSync(archivedContext, archivedElementById, [{ id: archivedId, _action: "reactivate" }]);
assert(archivedResult.includes("reactivated"), archivedResult);
assert.strictEqual(archivedContext.getLifecycle().inactiveIds[archivedId], undefined);
assert(archivedContext.getProgramDay("partial", 7).exercises.some(ex => ex.id === archivedId));
assert.strictEqual(Object.keys(archivedContext.getLifecycle().customExercises).filter(id => id === archivedId).length, 1);

archivedResult = runSync(archivedContext, archivedElementById, [{
  id: archivedId,
  blurb: "10.1.3 QA - virtual-day Sync target verified."
}]);
assert(!archivedResult.includes("expected next exercise index"), archivedResult);
assert(!archivedResult.includes("exercise is archived"), archivedResult);
assert.strictEqual(JSON.parse(archivedStorage.getItem("mf-overrides"))[archivedId].blurb, "10.1.3 QA - virtual-day Sync target verified.");
assert.strictEqual(JSON.stringify(archivedContext.getLifecycle().customExercises[archivedId]), archivedCustomBefore, "stable custom record was recreated or changed");

archivedResult = runSync(archivedContext, archivedElementById, [{
  id: "partial-d7-e99", name: "Fabricated Exercise", sets: 3, reps: "10", load: "TBD", rir: "2"
}]);
assert(archivedResult.includes("expected next exercise index would be e5, got e99"), archivedResult);
assert.strictEqual(archivedContext.getLifecycle().customExercises["partial-d7-e99"], undefined);
assert.deepStrictEqual(Object.fromEntries(Object.keys(archivedStorage)
  .filter(key => key.startsWith("day-"))
  .sort()
  .map(key => [key, archivedStorage.getItem(key)])), archivedHistoryBefore, "archived identity flow rewrote History/logs");
assert.strictEqual(archivedStorage.getItem("mf-recommendations"), recsRaw, "archived identity flow rewrote recommendations");
assert.strictEqual(archivedContext.getLifecycle().replacements["unrelated-old"].newId, "unrelated-new");

let result = sync([{ id: "partial-d7-e0", load: "22.5 lb", sets: "3", reps: "10-15", rir: "1-2" }]);
assert(!result.includes("not a known exercise"), result);
assert.strictEqual(JSON.parse(localStorage.getItem("mf-overrides"))["partial-d7-e0"].load, "22.5 lb");

const partialDay7Ids = ["partial-d7-e0", "partial-d7-e1", "partial-d7-e2", "partial-d7-e3", "partial-d7-e4"];
result = sync([{ id: "_reorder", _action: "reorder", gym: "partial", dayIndex: 7, exerciseOrder: partialDay7Ids }]);
assert(result.includes("Reordered"), result);

result = sync([{ _action: "recommendations", gym: "partial", dayIndex: 7, items: ["Pause at peak"], strategy: "hypertrophy", experimentTag: "virtual-day", expiresAfterSessions: 2 }]);
assert(result.includes("Recommendations set"), result);

partialDay7Ids.forEach(id => {
  result = sync([{ id, _action: "remove" }]);
  assert(result.includes("archived"), id+": "+result);
  lifecycle = c.getLifecycle();
  assert(lifecycle.inactiveIds[id]);
  assert(lifecycle.customExercises[id], id+": remove deleted the stable custom record");
  result = sync([{ id, _action: "reactivate" }]);
  assert(result.includes("reactivated"), id+": "+result);
  assert.strictEqual(c.getLifecycle().inactiveIds[id], undefined);
});
assert.deepStrictEqual(JSON.parse(JSON.stringify(c.getProgramDay("partial",7).exercises.map(x=>x.id).sort())),partialDay7Ids.slice().sort());

result = sync([{ id: "home-d7-e0", load: "32.5 lb", sets: "3", reps: "8-12", rir: "1-2" }]);
assert(!result.includes("not a known exercise"), result);
result = sync([{ id: "_reorder", _action: "reorder", gym: "home", dayIndex: 7, exerciseOrder: ["home-d7-e0", "home-d7-e1", "home-d7-e2", "home-d7-e3", "home-d7-e4"] }]);
assert(result.includes("Reordered"), result);
result = sync([{ _action: "recommendations", gym: "home", dayIndex: 7, items: ["Controlled eccentric"], strategy: "hypertrophy", experimentTag: "virtual-home", expiresAfterSessions: 2 }]);
assert(result.includes("Recommendations set"), result);
result = sync([{ id: "home-d7-e0", _action: "remove" }]);
assert(result.includes("archived"), result);
assert(c.getLifecycle().customExercises["home-d7-e0"]);
result = sync([{ id: "home-d7-e0", _action: "reactivate" }]);
assert(result.includes("reactivated"), result);
assert(c.getProgramDay("home",7).exercises.some(x=>x.id==="home-d7-e0"));

// Exact production legacy-ID regression: these persisted IDs are deliberately
// non-sequential relative to today's allocator, but must be treated as existing
// children before the new-ID "expected next index" rule is considered.
const reportedLegacyIds=["partial-d6-e0","partial-d6-e2","partial-d6-e4"];
result=sync(reportedLegacyIds.map((id,index)=>({id,load:(30+index*5)+" lb",sets:"3",reps:"10-15",rir:"1-2"})));
assert(!result.includes("expected next exercise index"),result);
assert(!result.includes("not a known exercise"),result);
reportedLegacyIds.forEach(id=>assert(JSON.parse(localStorage.getItem("mf-overrides"))[id],id+" direct update was not applied"));
result=sync([{id:"_reorder",_action:"reorder",gym:"partial",dayIndex:6,exerciseOrder:["partial-d6-e0","partial-d6-e1","partial-d6-e2","partial-d6-e3","partial-d6-e4","partial-d6-e5"]}]);
assert(result.includes("Reordered"),result);
result=sync([{_action:"recommendations",gym:"partial",dayIndex:6,items:["Keep legacy IDs stable"],strategy:"integrity",experimentTag:"legacy-id",expiresAfterSessions:2}]);
assert(result.includes("Recommendations set"),result);
reportedLegacyIds.forEach(id=>{
  result=sync([{id,_action:"remove"}]);
  assert(result.includes("archived"),id+": "+result);
  assert(c.getLifecycle().customExercises[id],id+" was deleted during remove");
  result=sync([{id,_action:"reactivate"}]);
  assert(result.includes("reactivated"),id+": "+result);
  assert(c.getProgramDay("partial",6).exercises.some(ex=>ex.id===id),id+" did not reactivate on its stable day");
});

// The allocator constraint remains strict for a genuinely nonexistent ID.
result=sync([{id:"partial-d6-e9",name:"Fabricated Exercise",sets:3,reps:"10",load:"TBD",rir:"2"}]);
assert(result.includes("expected next exercise index would be e6, got e9"),result);
assert.strictEqual(c.getLifecycle().customExercises["partial-d6-e9"],undefined);

result = sync([{ id: "_reorder", _action: "reorder", gym: "partial", dayIndex: 99, exerciseOrder: [] }]);
assert(result.includes("out of range"), result);

const identity = c.getHistoricalDayIdentity("partial", 7, "Old Partial Arms");
assert.strictEqual(identity.currentName, "Partial Taper & Core");
assert.strictEqual(identity.historicalName, "Old Partial Arms");
assert.strictEqual(identity.showHistoricalName, true);
const renamedBaseIdentity=c.getHistoricalDayIdentity("home",0,"Arms - Strength & Pump");
assert.strictEqual(renamedBaseIdentity.currentName,"Home A - Taper & Core");
assert.strictEqual(renamedBaseIdentity.historicalName,"Arms - Strength & Pump");
assert.strictEqual(renamedBaseIdentity.showHistoricalName,true);
c.renderHistoryFromEntries([{key:"day-2025-03-01",data:JSON.parse(dailyRaw)}]);
const historyHtml=getElementById("histList").innerHTML;
assert(historyHtml.includes("Partial Taper & Core"));
assert(historyHtml.includes("Previously logged as: Arms - Strength & Pump"));

const debug = c.mfProgramDayIntegrityDebug();
assert.strictEqual(debug.activeVirtualDayCount, 4);
assert.strictEqual(debug.validVirtualDayCount, 4);
assert.strictEqual(debug.migratedDayCount, 3);
assert.strictEqual(debug.activeUnresolvedDayCount, 0);
assert.strictEqual(debug.archivedOnlyIgnoredCount, 1);
assert(debug.invalidOrphanCount >= 1);

assert.strictEqual(localStorage.getItem("day-2025-03-01-wo"), beforeWorkout, "workout history was rewritten");
assert.strictEqual(localStorage.getItem("day-2025-03-01"), beforeDaily, "daily history was rewritten");
assert.strictEqual(localStorage.getItem("day-2025-03-03-wo"),beforeLegacyIdWorkout,"legacy-ID workout history was rewritten");
assert.notStrictEqual(localStorage.getItem("mf-recommendations"), beforeRecs, "recommendation action did not persist");
assert.strictEqual(JSON.stringify(c.__testP), beforeP, "base P changed");
assert.deepStrictEqual(Object.keys(c.getLifecycle().customExercises).sort(),originalCustomIds,"custom exercise IDs were renumbered, recreated, or deleted");

// A post-repair backup round trip reproduces resolved identity and diagnostics.
const roundTrip={};Object.keys(localStorage).forEach(function(key){roundTrip[key]=localStorage.getItem(key);});
const restored=createContext(roundTrip).context;
assert.strictEqual(restored.mfRepairLegacyVirtualDays().repairedDayCount,0);
assert.strictEqual(restored.getProgramDay("partial",7).name,"Partial Taper & Core");
assert.strictEqual(restored.getProgramDay("partial",6).name,"Legacy Partial Day 7");
assert.strictEqual(restored.getProgramDay("home",7).name,"Home B - Full Body & Mobility");
assert.deepStrictEqual(JSON.parse(JSON.stringify(restored.mfProgramDayIntegrityDebug())),JSON.parse(JSON.stringify(debug)));

console.log("MarcusFit 10.1.3 program-day integrity: PASS");
