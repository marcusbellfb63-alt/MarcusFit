const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, ...relative.split("/")), "utf8");
const html = read("index.html");
const css = read("assets/css/marcusfit.css");
const profileSource = read("assets/js/state/04-runtime-state-profile-preferences.js");
const sharedUiSource = read("assets/js/features/13-shared-ui.js");
const habitsSource = read("assets/js/features/20-habits.js");
const scriptOrder = JSON.parse(read("tests/fixtures/runtime-script-order.json"));

// Viewport and structural accessibility.
const viewport = html.match(/<meta name="viewport" content="([^"]+)">/i);
assert(viewport, "Viewport meta is missing");
assert(viewport[1].includes("width=device-width"));
assert(viewport[1].includes("initial-scale=1"));
assert(viewport[1].includes("viewport-fit=cover"));
assert(!/maximum-scale|user-scalable\s*=\s*no/i.test(viewport[1]), "Viewport still disables zoom");
assert(!/100vw/i.test(html + "\n" + css), "Unsafe 100vw layout dependency was introduced");
assert(css.includes("env(safe-area-inset-top)"));
assert(css.includes("env(safe-area-inset-bottom)"));
assert(css.includes("100dvh"));

// The rendered controls share one shrinkable grid; this is a structural guard,
// not a substitute for the real-device width/text-size QA checklist.
const workoutCorrection = css.slice(css.indexOf("MarcusFit 10.1.4 correction: keep every workout set control inside its card."));
assert(workoutCorrection.includes("grid-template-columns:38px minmax(0,1fr) 64px 70px"));
assert(workoutCorrection.includes("grid-template-columns:28px minmax(0,1fr) 50px 64px"));
assert(workoutCorrection.includes(".wo-set-wt,.wo-set-reps,.wo-set-rir{width:100%;min-width:0;}"));
assert(workoutCorrection.includes(".wo-set-labels::before{content:\"\";}"));
const workoutTrackBudget = width => {
  const narrow = width <= 350;
  const nestedHorizontalPaddingAndBorders = narrow ? 88 : 100; // screen + section body + exercise card
  const fixedTracksAndGaps = narrow ? 154 : 190;
  return width - nestedHorizontalPaddingAndBorders - fixedTracksAndGaps;
};
[320, 375, 393, 430].forEach(width => {
  assert(workoutTrackBudget(width) >= 78, `${width}px leaves too little room for the shrinkable weight track`);
});

// Script order and authoritative Sync ownership remain unchanged.
const currentScripts = [...html.matchAll(/<script\s+src="([^"]+)"\s+defer><\/script>/g)].map(match => match[1]);
assert.deepStrictEqual(currentScripts, scriptOrder);
assert.strictEqual(currentScripts.length, 22);
assert(!habitsSource.includes('createElement("style")'), "Habit Manager still injects primary CSS from JS");
assert(!habitsSource.includes("style.textContent=`"), "Habit Manager CSS injection remains");
assert(css.includes("Habit Manager presentation extracted from 20-habits.js"));

// Major settings disclosures exist, use semantic buttons, and keep core Sync exposed.
const expectedSections = ["profile", "coaching", "program", "habits", "backup", "diagnostics"];
expectedSections.forEach(key => {
  assert(html.includes(`data-mf-settings-section="${key}"`), `Missing ${key} settings section`);
  const toggle = new RegExp(`<button[^>]+data-mf-settings-toggle="${key}"[^>]+aria-expanded="(true|false)"[^>]+aria-controls="[^"]+"`, "i");
  assert(toggle.test(html), `Missing accessible ${key} disclosure button`);
});
assert(html.includes('class="mf-settings-section open" id="mfSettingsProfile"'), "Profile & Display should default open");
expectedSections.slice(1).forEach(key => {
  const sectionTag = html.match(new RegExp(`<section[^>]+data-mf-settings-section="${key}"[^>]*>`, "i"));
  assert(sectionTag && !/\bopen\b/.test(sectionTag[0]), `${key} should default collapsed`);
});
const coreEnd = html.indexOf('data-mf-settings-section="profile"');
assert(html.indexOf('id="syncInput"') > 0 && html.indexOf('id="syncInput"') < coreEnd);
assert(html.indexOf('onclick="applySync()"') > 0 && html.indexOf('onclick="applySync()"') < coreEnd);
assert(html.indexOf('id="syncResult"') > 0 && html.indexOf('id="syncResult"') < coreEnd);
assert(sharedUiSource.includes("aria-expanded"));
assert(sharedUiSource.includes("data-mf-critical-panel"));

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
      get length() { return memory.size; },
      get writes() { return writes; }
    }
  };
}

// Profile normalization, persistence, and root application.
const profileStart = profileSource.indexOf('const USER_PROFILE_KEY = "mf-user-profile"');
const profileEnd = profileSource.indexOf("// ── END PHASE 9.5.0", profileStart);
assert(profileStart >= 0 && profileEnd > profileStart);
const profileStorage = makeStorage();
const rootAttributes = {};
const textSelect = {
  value: "standard", selectedIndex: 1,
  options: [{ text: "Compact" }, { text: "Standard" }, { text: "Large" }, { text: "Extra Large" }]
};
const profileElements = new Map([["p950TextSize", textSelect], ["p950Result", { style: {}, textContent: "" }]]);
const profileContext = {
  APP_VERSION: "10.1.4", console, localStorage: profileStorage.api,
  document: {
    documentElement: { setAttribute(name, value) { rootAttributes[name] = value; } },
    getElementById(id) { return profileElements.get(id) || null; }
  }
};
vm.createContext(profileContext);
vm.runInContext(profileSource.slice(profileStart, profileEnd), profileContext);

assert.strictEqual(profileContext.p950GetDefaultUserProfile().preferences.textSize, "standard");
assert.strictEqual(vm.runInContext("USER_PROFILE_SCHEMA", profileContext), 1, "Profile schema version changed");
["compact", "standard", "large", "extra-large"].forEach(value => {
  assert.strictEqual(profileContext.p950NormalizeTextSize(value), value);
});
const legacy = {
  schemaVersion: 1, profileVersion: "10.1.3",
  identity: { displayName: "Marcus", futureIdentity: "keep" },
  body: { heightInches: 72 }, goals: { primaryGoal: "Goal", physiqueOutcome: "Outcome" },
  preferences: { weightUnit: "kg", distanceUnit: "km", firstDayOfWeek: "monday", futurePreference: 42 },
  app: { homeGymLabel: "Home", partialGymLabel: "Partial", futureUi: { keep: true } },
  unknownTopLevel: { preserved: true }, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z"
};
let normalized = profileContext.p950NormalizeUserProfile(legacy);
assert.strictEqual(normalized.preferences.textSize, "standard");
assert.strictEqual(normalized.preferences.futurePreference, 42);
assert.deepStrictEqual(normalized.unknownTopLevel, { preserved: true });
legacy.preferences.textSize = "invalid";
assert.strictEqual(profileContext.p950NormalizeUserProfile(legacy).preferences.textSize, "standard");
legacy.preferences.textSize = "extra-large";
assert.strictEqual(profileContext.p950NormalizeUserProfile(legacy).preferences.textSize, "extra-large");

profileStorage.api.setItem("mf-user-profile", JSON.stringify(normalized));
textSelect.value = "large";
textSelect.selectedIndex = 2;
assert.strictEqual(profileContext.p950SetTextSizeFromUI(), true);
let savedProfile = JSON.parse(profileStorage.api.getItem("mf-user-profile"));
assert.strictEqual(savedProfile.preferences.textSize, "large");
assert.strictEqual(savedProfile.preferences.futurePreference, 42);
assert.deepStrictEqual(savedProfile.app.futureUi, { keep: true });
assert.strictEqual(rootAttributes["data-text-size"], "large");
rootAttributes["data-text-size"] = "standard";
assert.strictEqual(profileContext.p950ApplyTextSize(), "large");
assert.strictEqual(rootAttributes["data-text-size"], "large");

// Manager actions mutate only the draft until Save Changes, and stable IDs survive.
const habitCoreEnd = habitsSource.indexOf("function p960EarliestHistoricalDate");
assert(habitCoreEnd > 0);
const habitStore = {
  schemaVersion: 1, definitionVersion: "10.1.3", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  habits: {
    "habit-a": { id: "habit-a", name: "Alpha", icon: "A", description: "", target: { type: "checkbox", display: "Do it" }, schedule: { type: "daily" }, instructions: [], emphasis: "normal", active: true, source: "user" },
    "habit-b": { id: "habit-b", name: "Beta", icon: "B", description: "", target: { type: "checkbox", display: "Do it" }, schedule: { type: "daily" }, instructions: [], emphasis: "normal", active: true, source: "user" },
    "habit-old": { id: "habit-old", name: "Old", icon: "O", description: "", target: { type: "checkbox", display: "Do it" }, schedule: { type: "daily" }, instructions: [], emphasis: "normal", active: false, archivedAt: "2026-01-02T00:00:00.000Z", source: "user" }
  },
  order: ["habit-a", "habit-b", "habit-old"]
};
const habitStorage = makeStorage({ "mf-habit-definitions": JSON.stringify(habitStore) });
const fakeClassList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
const managerElement = { classList: fakeClassList, setAttribute() {}, querySelector() { return null; } };
const habitContext = {
  APP_VERSION: "10.1.4", console, localStorage: habitStorage.api,
  HABITS: [], habitState: {}, tDate: new Date(2026, 0, 1),
  initHabitState() { return {}; }, renderHabits() {}, autoSaveDraft() {}, dKey() { return "day-2026-01-01"; },
  document: {
    activeElement: null, head: { appendChild() {} }, body: { appendChild() {}, classList: fakeClassList },
    getElementById(id) { return id === "p960HabitManager" ? managerElement : null; },
    querySelectorAll() { return []; }, createTextNode(value) { return String(value); },
    createElement() { return { style: {}, dataset: {}, classList: fakeClassList, append() {}, appendChild() {}, setAttribute() {}, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, scrollIntoView() {}, focus() {} }; }
  }
};
habitContext.window = habitContext;
vm.createContext(habitContext);
vm.runInContext(habitsSource.slice(0, habitCoreEnd), habitContext);
vm.runInContext("p960RenderHabitManager=function(){};renderHabits=function(){};p960UpdateSettingsStatus=function(){};p960HabitManagerDraft=p960Clone(p960GetHabitStore());", habitContext);
const storedBeforeDraft = habitStorage.api.getItem("mf-habit-definitions");
habitContext.p960MoveHabit("habit-b", -1);
habitContext.p960ToggleHabitActive("habit-a");
vm.runInContext('p960HabitManagerDraft.habits["habit-b"].name="Beta Draft";', habitContext);
assert.strictEqual(habitStorage.api.getItem("mf-habit-definitions"), storedBeforeDraft, "Draft action wrote storage");
let draft = JSON.parse(vm.runInContext("JSON.stringify(p960HabitManagerDraft)", habitContext));
assert.deepStrictEqual(draft.order.slice(0, 2), ["habit-b", "habit-a"]);
assert.strictEqual(draft.habits["habit-a"].active, false);
habitContext.p960CancelHabitManager();
assert.strictEqual(habitStorage.api.getItem("mf-habit-definitions"), storedBeforeDraft, "Cancel persisted draft");

vm.runInContext("p960HabitManagerDraft=p960Clone(p960GetHabitStore());p960RenderHabitManager=function(){};", habitContext);
habitContext.p960ToggleHabitActive("habit-a");
vm.runInContext('p960HabitManagerDraft.habits["habit-b"].name="Beta Saved";', habitContext);
assert.strictEqual(habitContext.p960SaveHabitManager(), true);
const persisted = JSON.parse(habitStorage.api.getItem("mf-habit-definitions"));
assert.strictEqual(persisted.habits["habit-a"].id, "habit-a");
assert.strictEqual(persisted.habits["habit-a"].active, false);
assert.strictEqual(persisted.habits["habit-b"].name, "Beta Saved");
assert.strictEqual(persisted.habits["habit-old"].id, "habit-old");
assert.strictEqual(persisted.habits["habit-old"].active, false);

// Exercise the actual Habit Manager controls: Details -> Edit -> Update Draft -> Save.
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
  set innerHTML(value) { assert.strictEqual(value, "", "Fake DOM supports only clearing innerHTML"); this._text = ""; this.children = []; }
  get innerHTML() { return ""; }
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
  createTextNode(value) { const node = new FakeElement("#text", this); node._text = String(value); return node; }
  getElementById(id) {
    if (this.body.id === id) return this.body;
    return this.body.querySelectorAll("#" + id)[0] || this.head.querySelectorAll("#" + id)[0] || null;
  }
  querySelector(selector) { return this.body.querySelector(selector); }
  querySelectorAll(selector) { return this.body.querySelectorAll(selector); }
}

function buttonByText(rootElement, text) {
  const button = rootElement.querySelectorAll("button").find(candidate => candidate.textContent.trim() === text);
  assert(button, `Missing button: ${text}`);
  return button;
}

function habitRowByName(document, name) {
  const row = document.querySelectorAll(".p960-row").find(candidate => candidate.textContent.includes(name));
  assert(row, `Missing habit row: ${name}`);
  return row;
}

const uiHabitStore = {
  schemaVersion: 1, definitionVersion: "10.1.3", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  habits: {
    "habit-kegel": { id: "habit-kegel", name: "Pelvic Floor", icon: "K", description: "Original", target: { type: "checkbox", display: "Complete" }, schedule: { type: "daily" }, instructions: [], emphasis: "normal", active: true, source: "user" },
    "habit-journal": { id: "habit-journal", name: "Journal", icon: "J", description: "Unrelated", target: { type: "checkbox", display: "Write" }, schedule: { type: "daily" }, instructions: [], emphasis: "normal", active: true, source: "user" }
  },
  order: ["habit-kegel", "habit-journal"]
};
const historicalDay = JSON.stringify({ habits: { "habit-kegel": { completed: true, notes: "preserve" } }, unrelated: { keep: true } });
const uiHabitStorage = makeStorage({
  "mf-habit-definitions": JSON.stringify(uiHabitStore),
  "day-2026-01-01": historicalDay
});
const uiDocument = new FakeDocument();
const uiHabitContext = {
  APP_VERSION: "10.1.4", console, localStorage: uiHabitStorage.api,
  HABITS: [], habitState: {}, tDate: new Date(2026, 0, 1), document: uiDocument,
  autoSaveDraft() {}, dKey() { return "day-2026-01-01"; }
};
uiHabitContext.window = uiHabitContext;
vm.createContext(uiHabitContext);
vm.runInContext(habitsSource.slice(0, habitCoreEnd), uiHabitContext);
vm.runInContext("renderHabits=function(){};p960UpdateSettingsStatus=function(){};", uiHabitContext);

// Closing the whole manager during an edit must discard the still-rendered form.
uiHabitContext.p960OpenHabitManager();
let kegelRow = habitRowByName(uiDocument, "Pelvic Floor");
buttonByText(kegelRow, "Details").click();
kegelRow = habitRowByName(uiDocument, "Pelvic Floor");
buttonByText(kegelRow, "Edit").click();
let uiForm = uiDocument.getElementById("p960HabitForm");
assert.strictEqual(uiForm.dataset.mode, "edit");
assert.strictEqual(uiForm.dataset.editingId, "habit-kegel", "Edit form did not retain the stable ID");
uiForm.querySelector('[data-key="name"]').value = "Stale Unsaved Rename";
buttonByText(uiDocument.getElementById("p960HabitManager"), "Cancel").click();
assert.strictEqual(uiHabitStorage.api.getItem("mf-habit-definitions"), JSON.stringify(uiHabitStore));
uiHabitContext.p960OpenHabitManager();
uiForm = uiDocument.getElementById("p960HabitForm");
assert(!uiForm.classList.contains("open"), "Canceled edit form remained open after manager reopen");
assert.strictEqual(uiForm.dataset.editingId, "");
assert.strictEqual(uiForm.querySelector('[data-key="name"]'), null, "Canceled edit fields survived manager reopen");

kegelRow = habitRowByName(uiDocument, "Pelvic Floor");
buttonByText(kegelRow, "Details").click();
kegelRow = habitRowByName(uiDocument, "Pelvic Floor");
buttonByText(kegelRow, "Edit").click();
uiForm = uiDocument.getElementById("p960HabitForm");
uiForm.querySelector('[data-key="name"]').value = "Kegel Routine";
buttonByText(uiForm, "Update Draft").click();
buttonByText(uiDocument.getElementById("p960HabitManager"), "Save Changes").click();

let uiPersisted = JSON.parse(uiHabitStorage.api.getItem("mf-habit-definitions"));
assert.strictEqual(uiPersisted.habits["habit-kegel"].name, "Kegel Routine");
assert.strictEqual(uiPersisted.habits["habit-kegel"].id, "habit-kegel");
assert(!uiPersisted.habits["habit-kegel-routine"], "Rename created a duplicate slug ID");
assert.strictEqual(uiPersisted.order.filter(id => id === "habit-kegel").length, 1);
assert.strictEqual(uiPersisted.habits["habit-journal"].description, "Unrelated");
assert.strictEqual(uiHabitStorage.api.getItem("day-2026-01-01"), historicalDay, "Rename changed historical completion data");

// Cancel Edit changes neither the draft nor storage; Add Habit still generates a new ID.
uiHabitContext.p960OpenHabitManager();
kegelRow = habitRowByName(uiDocument, "Kegel Routine");
buttonByText(kegelRow, "Details").click();
kegelRow = habitRowByName(uiDocument, "Kegel Routine");
buttonByText(kegelRow, "Edit").click();
uiForm = uiDocument.getElementById("p960HabitForm");
uiForm.querySelector('[data-key="name"]').value = "Should Not Persist";
buttonByText(uiForm, "Cancel Edit").click();
assert.strictEqual(JSON.parse(vm.runInContext("JSON.stringify(p960HabitManagerDraft)", uiHabitContext)).habits["habit-kegel"].name, "Kegel Routine");
buttonByText(uiDocument.getElementById("p960HabitManager"), "+ Add Habit").click();
uiForm = uiDocument.getElementById("p960HabitForm");
assert.strictEqual(uiForm.dataset.mode, "add");
uiForm.querySelector('[data-key="name"]').value = "Read Book";
buttonByText(uiForm, "Add to Draft").click();
buttonByText(uiDocument.getElementById("p960HabitManager"), "Save Changes").click();
uiPersisted = JSON.parse(uiHabitStorage.api.getItem("mf-habit-definitions"));
assert.strictEqual(uiPersisted.habits["habit-read-book"].name, "Read Book");
assert.strictEqual(uiPersisted.habits["habit-kegel"].name, "Kegel Routine");
assert.strictEqual(uiPersisted.habits["habit-journal"].description, "Unrelated");
assert.strictEqual(uiHabitStorage.api.getItem("day-2026-01-01"), historicalDay, "Add changed historical completion data");

console.log("MarcusFit 10.1.4 mobile/accessibility contract: PASS");
