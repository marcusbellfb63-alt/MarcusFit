const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createContext } = require("./marcusfit-10.3.0-basketball-ai-sync.test.js");
const root = path.resolve(__dirname,"..");
const clone = value => JSON.parse(JSON.stringify(value));
// Lightweight DOM follows the accepted mobile/accessibility test harness.
class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.className = "";
    this.id = "";
    this.hidden = false;
    this.checked = false;
    this.value = "";
    this.type = "";
    this._text = "";
    this._listeners = {};
    this.classList = {
      add: (...names) => { const set = new Set(this.className.split(/\s+/).filter(Boolean)); names.forEach(name => set.add(name)); this.className = [...set].join(" "); },
      remove: (...names) => { const remove = new Set(names); this.className = this.className.split(/\s+/).filter(name => name && !remove.has(name)).join(" "); },
      toggle: (name, force) => { const present = this.classList.contains(name), next = force === undefined ? !present : !!force; next ? this.classList.add(name) : this.classList.remove(name); return next; },
      contains: name => this.className.split(/\s+/).includes(name)
    };
  }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(""); }
  set textContent(value) { this._text = String(value == null ? "" : value); this.children = []; }
  set innerHTML(value) { this._html = value; this._text = ""; this.children = []; }
  get innerHTML() { return this._html || ""; }
  append(...children) { children.forEach(child => this.appendChild(typeof child === "string" ? this.ownerDocument.createTextNode(child) : child)); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
  addEventListener(type, handler) { (this._listeners[type] ||= []).push(handler); }
  focus() { this.ownerDocument.activeElement = this; }
  scrollIntoView() {}
  click() { if (typeof this.onclick === "function") return this.onclick({ target: this, currentTarget: this }); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const separator = selector.indexOf(" ");
    if (separator >= 0) return this.querySelectorAll(selector.slice(0, separator)).flatMap(node => node.querySelectorAll(selector.slice(separator + 1)));
    const found = [];
    const visit = node => {
      node.children.forEach(child => {
        if (matchesFakeSelector(child, selector)) found.push(child);
        visit(child);
      });
    };
    visit(this);
    return found;
  }
}

function matchesFakeSelector(element, selector) {
  let simple = selector.trim(), requiresChecked = false;
  if (simple.endsWith(":checked")) { requiresChecked = true; simple = simple.slice(0, -8); }
  if (requiresChecked && !element.checked) return false;
  if (simple.startsWith("#")) return element.id === simple.slice(1);
  if (simple.startsWith(".")) return simple.slice(1).split(".").every(name => element.classList.contains(name));
  const data = simple.match(/^\[data-([a-z-]+)(?:="([^"]*)")?\]$/);
  if (data) {
    const key = data[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    return Object.prototype.hasOwnProperty.call(element.dataset, key) && (data[2] === undefined || String(element.dataset[key]) === data[2]);
  }
  return element.tagName.toLowerCase() === simple.toLowerCase();
}

class FakeDocument {
  constructor() {
    this.activeElement = null;
    this.body = new FakeElement("body", this);
    this.head = new FakeElement("head", this);
  }
  createElement(tagName) { return new FakeElement(tagName, this); }
  createElementNS(namespace, tagName) { return new FakeElement(tagName, this); }
  createTextNode(value) { const node = new FakeElement("#text", this); node._text = String(value); return node; }
  getElementById(id) {
    if (this.body.id === id) return this.body;
    return this.body.querySelectorAll("#" + id)[0] || this.head.querySelectorAll("#" + id)[0] || null;
  }
  querySelector(selector) { return this.body.querySelector(selector); }
  querySelectorAll(selector) { return this.body.querySelectorAll(selector); }
}

FakeElement.prototype.remove = function () { this.parentNode.children = this.parentNode.children.filter(child => child !== this); };
FakeElement.prototype.replaceChildren = function (...children) { this.children = []; this._text = ""; this.append(...children); };
const env = createContext(), c = env.context, storage = env.localStorage;
const document = new FakeDocument();
document.documentElement = document.createElement("html");
c.document = document;
// Supply ordinary page controls; overlays must be created by the real UI code.
const findElement = document.getElementById.bind(document);
document.getElementById = id => {
  let element = findElement(id);
  if (!element && !["p960HabitManager", "p960ProposalReview"].includes(id)) {
    element = document.createElement("div"); element.id = id; document.body.appendChild(element);
  }
  return element;
};
const NativeDate = Date;
c.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : ["2026-09-14T12:00:00Z"])); }
  static now() { return new NativeDate("2026-09-14T12:00:00Z").getTime(); }
};
// Keep the test synchronous while exercising real draft collection and saving.
c.setTimeout = callback => { callback(); return 0; };
c.clearTimeout = () => {};
c.renderHistory = () => {};
c.populateWoDaySelect = () => {};
c.renderWoExercises = () => {};
const id = "habit-mobility-reset";
const baseline = c.p960EmptyHabitStore("2026-09-01T00:00:00Z");
baseline.habits[id] = c.p960NormalizeHabit({ id, name: "Mobility Reset", source: "user", createdAt: "2026-09-01T00:00:00Z", target: { type: "duration", value: 8, unit: "min", display: "8-10 minutes" }, schedule: { type: "daily" }, instructions: ["Original routine"] }, id);
baseline.order = [id]; c.p960SaveHabitStore(baseline);
const original = clone(c.p960GetHabitById(id));
const legacyRaw = JSON.stringify({ habits: { [id]: { completed: true, notes: "Original history", futureField: "keep" } }, workout: "rest" });
storage.setItem("day-2026-09-13", legacyRaw);
storage.setItem("day-2026-09-14-wo", JSON.stringify({ unrelatedLifting: true }));
storage.setItem("mf-basketball-sessions", JSON.stringify({ schemaVersion: 1, sessions: [] }));
const before = storage.snapshot();
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/hip-routine-options.json"), "utf8"));
const exampleBlock = fs.readFileSync(path.join(root, "docs/examples/hip-routine-options.sync.txt"), "utf8");
assert.deepStrictEqual(JSON.parse(exampleBlock.match(/MARCUSFIT_UPDATE_START([\s\S]*?)MARCUSFIT_UPDATE_END/)[1]), fixture);
function runSync(payload) {
  document.getElementById("syncInput").value = typeof payload === "string" ? payload : "MARCUSFIT_UPDATE_START\n" + JSON.stringify(payload) + "\nMARCUSFIT_UPDATE_END";
  c.applySync(); return document.getElementById("syncResult").textContent;
}
assert(/Habit changes are pending/.test(runSync(exampleBlock)));
assert.strictEqual(storage.getItem("mf-habit-definitions"), before["mf-habit-definitions"], "Import applied definitions before review");
assert.strictEqual(storage.getItem("day-2026-09-13"), legacyRaw);
const panel = document.getElementById("p960ProposalReview");
assert(panel.textContent.includes("Hip Control") && panel.textContent.includes("Hip Mobility"));
assert(panel.textContent.includes("Active 90/90") && panel.textContent.includes("Supported standing hip circles"));
assert(c.p960ApplyHabitProposal(false).requiresConfirmation);
assert(c.p960ApplyHabitProposal(true).applied);
let habit = c.p960GetHabitById(id);
assert.strictEqual(habit.id, original.id);
assert.deepStrictEqual(clone(habit.schedule), original.schedule);
assert.deepStrictEqual(clone(habit.target), original.target);
assert.strictEqual(c.p960GetActiveHabits().length, 1);
assert.strictEqual(c.p960GetRenderedHabits("2026-09-14").length, 1);
for (const key of Object.keys(before)) if (!["mf-habit-definitions", "mf-habit-proposal"].includes(key)) assert.strictEqual(storage.getItem(key), before[key], key);

// A legacy completion remains counted but is never attributed to either routine.
let analytics = c.p960GetHabitAnalytics("2026-09-13", "2026-09-13");
assert.strictEqual(analytics.eligibleOpportunities, 1);
assert.strictEqual(analytics.completedOpportunities, 1);
assert(c.p960HabitHistoryName(habit, { completed: true }).includes("routine unspecified"));
const challenging = habit.routineOptions[0];
assert.strictEqual(c.p960HabitRoutineProgress(habit, challenging, "2026-09-13").completed, 0);

// No selection: one unmet parent opportunity, never two option misses.
vm.runInContext('tDate=new Date(2026,8,14,12);habitState=initHabitState();', c);
c.renderHabits();
assert.strictEqual(document.getElementById("habitsProgress").textContent, "0 / 1");
c.toggleHabitDone({ stopPropagation() {} }, id);
assert.strictEqual(vm.runInContext('habitState["habit-mobility-reset"].completed', c), false);
assert.strictEqual(document.getElementById("habit-routine-" + id).value, "");
assert(!document.getElementById("habitCards").textContent.includes("Active 90/90"));
assert(!document.getElementById("habitCards").textContent.includes("Supported standing hip circles"));
assert(c.p960SelectHabitRoutine(id, "challenging"));
assert(document.getElementById("habitCards").textContent.includes("Active 90/90"));
assert(!document.getElementById("habitCards").textContent.includes("Supported standing hip circles"));
c.toggleHabitDone({ stopPropagation() {} }, id);
assert.strictEqual(document.getElementById("habitsProgress").textContent, "1 / 1");
let draft = c.collectDraftState();
assert.strictEqual(draft.habits[id].routineId, "challenging");
assert.strictEqual(draft.habits[id].completed, true);
assert.strictEqual(c.getDraft().habits[id].routineId, "challenging", "Auto-save lost selection");
c.applyStateToForm(draft);
assert.strictEqual(document.getElementById("habit-routine-" + id).value, "challenging");

// Switching requires an explicit new completion, while preserving personal notes.
c.updateHabitNote(id, "Recovery-based choice");
assert(c.p960SelectHabitRoutine(id, "easy"));
draft = c.collectDraftState();
assert.strictEqual(draft.habits[id].completed, false);
assert.strictEqual(draft.habits[id].notes, "Recovery-based choice");
assert.strictEqual(draft.habits[id].value, null);
assert(!document.getElementById("habitCards").textContent.includes("Active 90/90"));
assert(document.getElementById("habitCards").textContent.includes("Supported standing hip circles"));
c.updateHabitValue(id, "9", "duration");
c.toggleHabitDone({ stopPropagation() {} }, id);
c.p85ExecuteSave();
let saved = JSON.parse(storage.getItem("day-2026-09-14"));
assert.strictEqual(saved.habits[id].routineId, "easy");
assert.strictEqual(saved.habits[id].routineName, "Hip Mobility - Easy");
assert.strictEqual(saved.habits[id].completed, true);
c.applyStateToForm(saved);
assert.strictEqual(document.getElementById("habit-routine-" + id).value, "easy");
analytics = c.p960GetHabitAnalytics("2026-09-14", "2026-09-14");
assert.strictEqual(analytics.eligibleOpportunities, 1);
assert.strictEqual(analytics.completedOpportunities, 1);
assert.strictEqual(analytics.overallPercentage, 100);
assert.strictEqual(c.p960HabitRoutineProgress(habit, challenging, "2026-09-14").completed, 0);
assert.strictEqual(storage.getItem("day-2026-09-13"), legacyRaw);
assert.strictEqual(storage.getItem("day-2026-09-14-wo"), before["day-2026-09-14-wo"]);
assert.strictEqual(storage.getItem("mf-basketball-sessions"), before["mf-basketball-sessions"]);

// Nonconsecutive recovery guidance is advisory; completed dates drive frequency.
storage.setItem("day-2026-09-12", JSON.stringify({ habits: { [id]: { completed: true, routineId: "challenging" } } }));
assert(c.p960HabitRoutineProgress(habit, challenging, "2026-09-13").adjacent);
assert(!c.p960HabitRoutineProgress(habit, habit.routineOptions[1], "2026-09-13").adjacent);
assert(c.p960SelectHabitRoutine(id, "challenging"));
c.toggleHabitDone({ stopPropagation() {} }, id);
assert.strictEqual(c.p960HabitRoutineProgress(habit, challenging, "2026-09-14", c.collectDraftState().habits[id]).completed, 1);

// Names and units in saved history survive later definition edits or removal.
const snapshot = { completed: true, routineId: "easy", routineName: "Hip Mobility - Easy", routineTarget: { unit: "min" } };
assert.strictEqual(c.p960HabitHistoryName({ name: "Renamed", routineOptions: [] }, snapshot), "Hip Mobility - Easy");
const historyEntry = document.createElement("div"); historyEntry.className = "hist-entry";
const historyList = document.getElementById("histList");
// The base history renderer uses HTML; emulate its card for the DOM-based Habit extension.
Object.defineProperty(historyList, "innerHTML", { get() { return ""; }, set() { this.children = []; this.appendChild(historyEntry); } });
c.renderHistoryFromEntries([{ date: "2026-09-14", data: saved }]);
assert(historyEntry.textContent.includes("Hip Mobility - Easy"));

// Actual Habit Manager edits retain stable IDs, separate lists, and draft ownership.
const defsBeforeEdit = storage.getItem("mf-habit-definitions");
c.p960OpenHabitManager(); c.p960EditHabit(id);
const form = document.getElementById("p960HabitForm");
let rows = form.querySelectorAll(".p960-routine-row"); assert.strictEqual(rows.length, 2);
rows[1].querySelector('[data-routine-key="name"]').value = "Easy Recovery";
rows[1].querySelector('[data-routine-key="unit"]').value = "minutes-new";
assert(c.p960CommitHabitForm());
assert.strictEqual(storage.getItem("mf-habit-definitions"), defsBeforeEdit);
assert(c.p960SaveHabitManager());
habit = c.p960GetHabitById(id);
assert.strictEqual(habit.routineOptions[1].id, "easy");
assert.strictEqual(habit.routineOptions[1].name, "Easy Recovery");
assert.strictEqual(habit.routineOptions[1].target.unit, "minutes-new");
assert.deepStrictEqual(clone(habit.routineOptions[0].instructions), fixture.habitProposal.changes[0].fields.routineOptions[0].instructions);
const historicalExport = c.buildLogSection(["day-2026-09-14"], ["day-2026-09-14"]);
assert(historicalExport.includes("Hip Mobility - Easy [id=habit-mobility-reset]: completed; value 9 min"));
assert(!historicalExport.includes("Easy Recovery") && !historicalExport.includes("minutes-new"));

// Strict import boundaries, including mixed-domain zero-write preflight failures.
function invalidOptions(options, fields = {}) {
  storage.removeItem("mf-habit-proposal");
  const candidate = clone(fixture);
  Object.assign(candidate.habitProposal.changes[0].fields, fields, { routineOptions: options });
  const beforeInvalid = storage.snapshot();
  assert(/rejected/i.test(runSync(candidate)));
  assert.deepStrictEqual(storage.snapshot(), beforeInvalid);
}
const validOptions = clone(fixture.habitProposal.changes[0].fields.routineOptions);
for (const value of [null, {}, "text", [validOptions[0]], Array(7).fill(validOptions[0])]) invalidOptions(value);
let bad = clone(validOptions); bad[1].id = bad[0].id; invalidOptions(bad);
for (const patch of [{ name: "x".repeat(101) }, { id: "UPPERCASE" }, { instructions: "not an array" }, { instructions: ["x".repeat(401)] }, { target: "8-10 min" }, { weeklyGoal: "3" }, { weeklyGoal: 0 }, { avoidConsecutiveDays: 1 }, { completed: true }]) {
  bad = clone(validOptions); Object.assign(bad[0], patch); invalidOptions(bad);
}
invalidOptions(validOptions, { schedule: { type: "weekly_count", targetCount: 3, weekStartsOn: 0 } });
storage.removeItem("mf-habit-proposal");
assert(c.p960ImportHabitProposal({ proposalId: "clear-options", summary: "Clear choices", changes: [{ action: "modify", habitId: id, fields: { routineOptions: [] } }] }).valid);
c.p960DismissHabitProposal();

// Backup validation preserves raw history and rejects malformed routine definitions.
const backup = c.p8BuildBackup(); assert(c.p8ValidateBackup(JSON.stringify(backup)));
assert.strictEqual(backup.data["day-2026-09-13"], legacyRaw);
const malformed = clone(backup), definitions = JSON.parse(malformed.data["mf-habit-definitions"]);
definitions.habits[id].routineOptions[0].instructions = "invalid";
malformed.data["mf-habit-definitions"] = JSON.stringify(definitions);
assert.throws(() => c.p8ValidateBackup(JSON.stringify(malformed)), /instructions/);
const exportBefore = storage.snapshot(), exported = c.p960BuildHabitExport();
assert(exported.includes("choose one daily; one adherence opportunity; unselected option neutral"));
assert(exported.includes('"weeklyGoal":3') && exported.includes("Legacy completions have no inferred routine"));
assert.deepStrictEqual(storage.snapshot(), exportBefore);

// Fresh import/apply/undo restores the exact definitions without rewriting history.
storage.removeItem("mf-habit-proposal");
const beforeUndoTest = storage.getItem("mf-habit-definitions");
assert(/Habit changes are pending/.test(runSync(fixture)));
assert(c.p960ApplyHabitProposal(true).applied);
assert(c.p960UndoHabitProposal(true).undone);
assert.strictEqual(storage.getItem("mf-habit-definitions"), beforeUndoTest);
assert.strictEqual(storage.getItem("day-2026-09-13"), legacyRaw);
console.log("MarcusFit mutually exclusive daily Habit routines: PASS");
