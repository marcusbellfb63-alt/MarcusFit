const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const scriptOrder = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "runtime-script-order.json"), "utf8"));

function createStorage(initial = {}) {
  const memory = new Map(Object.entries(initial));
  const writes = [];
  const api = {
    getItem(key) { return memory.has(key) ? memory.get(key) : null; },
    setItem(key, value) { memory.set(key, String(value)); writes.push({ op: "set", key }); },
    removeItem(key) { memory.delete(key); writes.push({ op: "remove", key }); },
    key(index) { return [...memory.keys()][index] || null; },
    clear() { memory.clear(); writes.push({ op: "clear" }); },
    get length() { return memory.size; },
    snapshot() { return Object.fromEntries([...memory.entries()].sort()); }
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
  const classes = new Set();
  return {
    value: "", textContent: "", innerHTML: "", className: "", id: "", checked: false,
    disabled: false, hidden: false, selectedIndex: 0, children: [], options: [], dataset: {},
    style: { position: "", top: "", left: "", right: "", width: "", overflow: "", setProperty(name, value) { this[name] = value; }, removeProperty(name) { this[name] = ""; } },
    isConnected: true,
    classList: { add(...names) { names.forEach(name => classes.add(name)); }, remove(...names) { names.forEach(name => classes.delete(name)); }, toggle(name) { classes.has(name) ? classes.delete(name) : classes.add(name); }, contains(name) { return classes.has(name); } },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {},
    insertAdjacentHTML(position, value) { this.innerHTML += value; },
    append(...children) { this.children.push(...children); }, appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...children) { this.children = children; }, querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, focus() {}, click() {}, remove() {}, scrollIntoView() {}
  };
}

function createContext() {
  const localStorage = createStorage({
    "mf-onboarding-state": JSON.stringify({ schemaVersion: 1, status: "completed" }),
    "mf-user-profile": JSON.stringify({ schemaVersion: 1, firstName: "Marcus" })
  });
  const elements = new Map();
  const getElementById = id => {
    if (!elements.has(id)) { const element = createElement(); element.id = id; elements.set(id, element); }
    return elements.get(id);
  };
  const context = {
    console: { log() {}, warn() {}, error() {} }, localStorage, process,
    document: {
      getElementById, querySelector() { return null; }, querySelectorAll() { return []; },
      addEventListener() {}, removeEventListener() {}, createElement, createTextNode(value) { return String(value); },
      body: createElement(), head: createElement(), activeElement: null
    },
    navigator: { clipboard: { writeText() { return Promise.resolve(); } } },
    location: { reload() {} }, URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
    Blob: global.Blob, getComputedStyle() { return {}; }, alert() {}, confirm() { throw new Error("native confirm called"); },
    pageXOffset: 0, pageYOffset: 0, scrollX: 0, scrollY: 0,
    scrollTo() {}, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, setInterval, clearInterval,
    window: null
  };
  context.window = context;
  vm.createContext(context);
  scriptOrder.forEach(file => vm.runInContext(fs.readFileSync(path.join(root, ...file.split("/")), "utf8"), context, { filename: file }));
  Object.assign(context, context.__mfBasketballTest);
  return { context, localStorage, getElementById };
}

const env = createContext();
const c = env.context;
const storage = env.localStorage;
const coreId = vm.runInContext("P.home[0].exercises[0].id", c);
const guard = c.mfBasketballPrograms.find(program => program.id === "guard_skills_3_session");
const session = guard.sessions[0];
const drill = session.drills[0];
let sequence = 0;

function habitProposal(label = "habit") {
  sequence++;
  const id = `habit-hotfix-${label}-${sequence}`;
  return { schemaVersion: 1, proposalVersion: "10.12.1", proposalId: `habit-proposal-${label}-${sequence}`, summary: "Hotfix Habit proposal", changes: [{ action: "add", habitId: id, definition: { id, name: "Hotfix Habit", target: { type: "checkbox" }, schedule: { type: "daily" }, instructions: [] } }] };
}

function basketballProposal(label = "basketball") {
  sequence++;
  return { schemaVersion: 1, proposalVersion: 1, proposalId: `bball-proposal-${label}-${sequence}`, summary: "Hotfix Basketball proposal", changes: [{ action: "modify_drill", programId: guard.id, programVersion: guard.version, sessionId: session.id, drillId: drill.id, fields: { target: { durationMinutes: 9 } } }] };
}

function clearMutableSyncState() {
  ["mf-overrides", "mf-habit-proposal", "mf-basketball-proposal", "mf-basketball-program-overrides"].forEach(key => storage.removeItem(key));
}

function runRaw(raw) {
  env.getElementById("syncInput").value = raw;
  c.applySync();
  return env.getElementById("syncResult").textContent;
}

function runSync(payload, prose = false) {
  const block = `MARCUSFIT_UPDATE_START\n${JSON.stringify(payload)}\nMARCUSFIT_UPDATE_END`;
  return runRaw(prose ? `Analysis before the block.\n${block}\nExplanation after the block.` : block);
}

function assertRejectedWithoutWrites(payload, pattern) {
  clearMutableSyncState();
  const before = storage.snapshot();
  const message = runSync(payload);
  assert(pattern.test(message), message);
  assert.deepStrictEqual(storage.snapshot(), before);
}

// Legacy contract remains authoritative for core-only responses.
clearMutableSyncState();
assert(/empty array/i.test(runSync([])));
assert(/updated/i.test(runSync([{ id: coreId, blurb: "legacy core update" }])));
clearMutableSyncState();
assert(/updated/i.test(runSync([{ id: coreId, blurb: "legacy contract unchanged" }], true)));

// Composite shape matrix: proposals are staged pending and never auto-applied.
clearMutableSyncState();
assert(/Habit changes are pending/.test(runSync({ habitProposal: habitProposal("only") })));
assert.strictEqual(c.p960GetHabitProposal().status, "pending");
assert.strictEqual(c.p960GetHabitById(c.p960GetHabitProposal().changes[0].habitId), null);

clearMutableSyncState();
assert(/Basketball proposal imported/.test(runSync({ basketballProposal: basketballProposal("only") })));
assert.strictEqual(c.mfBasketballGetProposal().status, "pending");
assert.strictEqual(storage.getItem("mf-basketball-program-overrides"), null);

clearMutableSyncState();
assert(/Program sync processed/.test(runSync({ updates: [{ id: coreId, blurb: "core plus habit" }], habitProposal: habitProposal("core") })));
assert.strictEqual(c.p960GetHabitProposal().status, "pending");

clearMutableSyncState();
assert(/Basketball changes are pending/.test(runSync({ updates: [{ id: coreId, blurb: "core plus basketball" }], basketballProposal: basketballProposal("core") })));
assert.strictEqual(c.mfBasketballGetProposal().status, "pending");

clearMutableSyncState();
let message = runSync({ habitProposal: habitProposal("pair"), basketballProposal: basketballProposal("pair") });
assert(/Habit changes are pending/.test(message) && /Basketball changes are pending/.test(message));

clearMutableSyncState();
message = runSync({ updates: [{ id: coreId, blurb: "all three" }], habitProposal: habitProposal("all"), basketballProposal: basketballProposal("all") });
assert(/Program sync processed/.test(message) && /Habit changes are pending/.test(message) && /Basketball changes are pending/.test(message));

// Envelope and nested-domain failures are rejected before every write.
assertRejectedWithoutWrites({ updates: [] }, /must contain a Habit or Basketball proposal/);
assertRejectedWithoutWrites({}, /must contain a Habit or Basketball proposal/);
assertRejectedWithoutWrites({ habitProposal: habitProposal("unknown"), history: [] }, /unsupported top-level field/);
assertRejectedWithoutWrites({ updates: {}, habitProposal: habitProposal("bad-updates") }, /updates must be an array/);
assertRejectedWithoutWrites({ habitProposal: { summary: "missing changes" } }, /must contain 1/);
assertRejectedWithoutWrites({ basketballProposal: { schemaVersion: 1, proposalVersion: 1, proposalId: "bball-proposal-invalid", summary: "Missing changes", changes: [] } }, /must contain 1 to 30 changes/);
assertRejectedWithoutWrites({ updates: [{ id: coreId, blurb: "must not write" }], habitProposal: { changes: [] } }, /rejected before any proposal or core processing/);
assertRejectedWithoutWrites({ updates: [{ id: coreId, blurb: "must not write" }], basketballProposal: { changes: [] } }, /rejected before any proposal or core processing/);
assertRejectedWithoutWrites({ habitProposal: habitProposal("protected"), profile: { firstName: "AI" } }, /user-controlled/);
assertRejectedWithoutWrites({ basketballProposal: basketballProposal("protected"), trackingPreferences: { preset: "full_coaching" } }, /user-controlled/);

// Existing pending proposals block the whole composite, including core updates.
clearMutableSyncState();
assert(/Habit changes are pending/.test(runSync({ habitProposal: habitProposal("pending-first") })));
const habitPendingBefore = storage.snapshot();
message = runSync({ updates: [{ id: coreId, blurb: "blocked by pending Habit" }], habitProposal: habitProposal("pending-second") });
assert(/already pending/.test(message));
assert.deepStrictEqual(storage.snapshot(), habitPendingBefore);

clearMutableSyncState();
assert(/Basketball proposal imported/.test(runSync({ basketballProposal: basketballProposal("pending-first") })));
const basketballPendingBefore = storage.snapshot();
message = runSync({ updates: [{ id: coreId, blurb: "blocked by pending Basketball" }], basketballProposal: basketballProposal("pending-second") });
assert(/already pending/.test(message));
assert.deepStrictEqual(storage.snapshot(), basketballPendingBefore);

// Prose and the same smart-quote normalization accepted by legacy core parsing work for objects.
clearMutableSyncState();
message = runSync({ habitProposal: habitProposal("prose") }, true);
assert(/Habit changes are pending/.test(message));
clearMutableSyncState();
const smartPayload = JSON.stringify({ habitProposal: habitProposal("smart-quotes") }).replaceAll('"', "“");
message = runRaw(`MARCUSFIT_UPDATE_START\n${smartPayload}\nMARCUSFIT_UPDATE_END`);
assert(/Habit changes are pending/.test(message));

// An unexpected post-core import failure restores every synchronous storage write.
clearMutableSyncState();
const atomicBefore = storage.snapshot();
const realImportHabitProposal = c.p960ImportHabitProposal;
c.p960ImportHabitProposal = function () { throw new Error("forced post-preflight failure"); };
message = runSync({ updates: [{ id: coreId, blurb: "must roll back" }], habitProposal: habitProposal("forced-failure") });
c.p960ImportHabitProposal = realImportHabitProposal;
assert(/all storage writes.*rolled back/i.test(message));
assert.deepStrictEqual(storage.snapshot(), atomicBefore);

// Unsupported top-level types and malformed JSON continue failing safely in core.
clearMutableSyncState();
assert(/Expected a JSON array/.test(runSync(null)));
assert(/Expected a JSON array/.test(runSync("unsupported")));
assert(/JSON parse error/.test(runRaw("MARCUSFIT_UPDATE_START\n{bad\nMARCUSFIT_UPDATE_END")));

console.log("MarcusFit 10.12.1 AI Sync composite contract hotfix: PASS");
