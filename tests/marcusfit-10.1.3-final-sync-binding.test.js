const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const scriptOrder = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "runtime-script-order.json"), "utf8"));

function createStorage(initial) {
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
    getOwnPropertyDescriptor(target, property) {
      if (memory.has(property)) return { enumerable: true, configurable: true };
      return Object.getOwnPropertyDescriptor(target, property);
    }
  });
}

function createElement() {
  const element = {
    value: "", textContent: "", innerHTML: "", className: "", id: "", checked: false,
    disabled: false, selectedIndex: 0, children: [], options: [], dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {},
    insertAdjacentHTML(position, html) { this.innerHTML += html; },
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...children) { this.children = children; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, focus() {}, click() {}, remove() {}, scrollIntoView() {}
  };
  return element;
}

function snapshot(storage) {
  const values = {};
  Object.keys(storage).sort().forEach(key => { values[key] = storage.getItem(key); });
  return values;
}

const customExercises = {};
for (let index = 0; index < 5; index++) {
  const id = `partial-d7-e${index}`;
  customExercises[id] = {
    id, gymKey: "partial", dayIdx: 7, name: index === 0 ? "Cable Crunch" : `Persisted ${index}`,
    sets: 3, reps: "10", load: "TBD", rir: "2", addedAt: `2025-01-0${index + 1}T00:00:00.000Z`
  };
}
const lifecycle = {
  schemaVersion: 1, lifecycleVersion: "10.1.3", customExercises,
  inactiveIds: { "partial-d7-e0": { inactivatedAt: "2025-02-15T00:00:00.000Z", replacedBy: null } },
  replacements: {}, orderOverrides: {}, dayOverrides: {},
  dayAdditions: { partial: { "7": { name: "QUICK 45 - BASKETBALL + UPPER PUMP", source: "legacy-repair" } } },
  disabledDays: {}
};
const localStorage = createStorage({
  "mf-exercise-state": JSON.stringify(lifecycle),
  "mf-onboarding-state": JSON.stringify({ schemaVersion: 1, status: "completed" }),
  "mf-user-profile": JSON.stringify({ schemaVersion: 1, firstName: "Marcus" })
});
const elements = new Map();
const getElementById = id => {
  if (!elements.has(id)) { const element = createElement(); element.id = id; elements.set(id, element); }
  return elements.get(id);
};
const context = {
  console, localStorage,
  document: {
    getElementById, querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {}, createElement, createTextNode(value) { return String(value); },
    body: createElement(), head: createElement()
  },
  navigator: { clipboard: { writeText() { return Promise.resolve(); } } },
  location: { reload() {} }, URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
  Blob: global.Blob, getComputedStyle() { return {}; }, alert() {}, confirm() { return false; },
  addEventListener() {}, removeEventListener() {},
  setTimeout, clearTimeout, setInterval, clearInterval,
  window: null
};
context.window = context;
vm.createContext(context);
scriptOrder.forEach(file => {
  vm.runInContext(fs.readFileSync(path.join(root, ...file.split("/")), "utf8"), context, { filename: file });
});

assert(context.applySync.toString().includes("exercise is archived"), "final applySync is not the canonical corrected implementation");
assert.strictEqual(vm.runInContext("typeof p960HandleSyncExtension", context), "function", "Habits Sync extension hook is missing");

const resolved = context.getProgramDay("partial", 7);
assert(resolved && resolved._isVirtual);
assert(context.getLifecycle().customExercises["partial-d7-e0"]);
assert(context.getLifecycle().inactiveIds["partial-d7-e0"]);
assert(!resolved.exercises.some(exercise => exercise.id === "partial-d7-e0"));

function runSync(payload) {
  getElementById("syncInput").value = "MARCUSFIT_UPDATE_START\n" + JSON.stringify(payload) + "\nMARCUSFIT_UPDATE_END";
  context.applySync();
  return getElementById("syncResult").textContent;
}

const beforeRejected = snapshot(localStorage);
const beforeRejectedWrites = localStorage.writes;
let result = runSync([{ id: "partial-d7-e0", blurb: "10.1.3 final-binding QA" }]);
assert(result.includes("partial-d7-e0: exercise is archived — reactivate it before updating"), result);
assert(!result.includes("expected next exercise index"), result);
assert.deepStrictEqual(snapshot(localStorage), beforeRejected, "archived update changed storage through final binding");
assert.strictEqual(localStorage.writes, beforeRejectedWrites, "archived update wrote storage through final binding");

result = runSync([{ id: "partial-d7-e0", _action: "reactivate" }]);
assert(result.includes("reactivated"), result);
assert.strictEqual(context.getLifecycle().inactiveIds["partial-d7-e0"], undefined);
assert(context.getProgramDay("partial", 7).exercises.some(exercise => exercise.id === "partial-d7-e0"));
assert.strictEqual(Object.keys(context.getLifecycle().customExercises).filter(id => id === "partial-d7-e0").length, 1);

result = runSync([{ id: "partial-d7-e0", blurb: "10.1.3 final-binding QA" }]);
assert(!result.includes("exercise is archived"), result);
assert(!result.includes("expected next exercise index"), result);
assert.strictEqual(JSON.parse(localStorage.getItem("mf-overrides"))["partial-d7-e0"].blurb, "10.1.3 final-binding QA");

result = runSync({
  updates: [{ id: "partial-d7-e1", load: "25 lb" }],
  habitProposal: {
    proposalId: "final-binding-habit", summary: "Preserve Habit Sync integration",
    changes: [{
      action: "add", habitId: "habit-final-binding",
      definition: { id: "habit-final-binding", name: "Final binding habit", target: { type: "checkbox" }, schedule: { type: "daily" }, instructions: [] }
    }]
  }
});
assert(result.includes("Program sync processed. Habit changes are pending explicit review."), result);
assert.strictEqual(JSON.parse(localStorage.getItem("mf-overrides"))["partial-d7-e1"].load, "25 lb");
assert.strictEqual(context.p960GetHabitProposal().status, "pending");
assert.strictEqual(context.p960GetHabitById("habit-final-binding"), null, "Habit proposal applied without review");

result = runSync([{ id: "partial-d7-e99", name: "Fabricated", sets: 3, reps: "10", load: "TBD", rir: "2" }]);
assert(result.includes("expected next exercise index would be e5, got e99"), result);
assert.strictEqual(context.getLifecycle().customExercises["partial-d7-e99"], undefined);

console.log("MarcusFit 10.1.3 final Sync binding: PASS");
