const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const scriptOrder = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "runtime-script-order.json"), "utf8"));
const basketballSource = fs.readFileSync(path.join(root, "assets", "js", "features", "22-basketball.js"), "utf8");
const coreSyncBytes = fs.readFileSync(path.join(root, "assets", "js", "sync", "12-ai-sync.js"));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "css", "marcusfit.css"), "utf8");

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
    get writes() { return writes.slice(); },
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
  const style = { position: "", top: "", left: "", right: "", width: "", overflow: "", setProperty(name, value) { this[name] = value; }, removeProperty(name) { this[name] = ""; } };
  return {
    value: "", textContent: "", innerHTML: "", className: "", id: "", checked: false,
    disabled: false, hidden: false, selectedIndex: 0, children: [], options: [], dataset: {},
    style, isConnected: true,
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      toggle(name) { if (classes.has(name)) classes.delete(name); else classes.add(name); },
      contains(name) { return classes.has(name); }
    },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {},
    insertAdjacentHTML(position, value) { this.innerHTML += value; },
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...children) { this.children = children; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, focus() { this.focused = true; }, click() {}, remove() {}, scrollIntoView() {}
  };
}

function createContext(initial = {}) {
  const localStorage = createStorage(Object.assign({
    "mf-onboarding-state": JSON.stringify({ schemaVersion: 1, status: "completed" }),
    "mf-user-profile": JSON.stringify({ schemaVersion: 1, firstName: "Marcus" })
  }, initial));
  const elements = new Map();
  const getElementById = id => {
    if (!elements.has(id)) { const element = createElement(); element.id = id; elements.set(id, element); }
    return elements.get(id);
  };
  const context = {
    console: { log() {}, warn() {}, error() {} }, localStorage, process,
    document: {
      getElementById, querySelector() { return null; }, querySelectorAll() { return []; },
      addEventListener() {}, removeEventListener() {}, createElement,
      createTextNode(value) { return String(value); }, body: createElement(), head: createElement()
    },
    navigator: { clipboard: { writeText() { return Promise.resolve(); } } },
    location: { reload() {} }, URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
    Blob: global.Blob, getComputedStyle() { return {}; }, alert() {}, confirm() { throw new Error("native confirm called"); },
    pageXOffset: 0, pageYOffset: 0, scrollX: 0, scrollY: 0,
    scrollTo(x, y) { this.pageXOffset = this.scrollX = Number(x); this.pageYOffset = this.scrollY = Number(y); this.lastScrollTo = [Number(x), Number(y)]; },
    addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, setInterval, clearInterval,
    window: null
  };
  context.document.activeElement = null;
  context.window = context;
  vm.createContext(context);
  scriptOrder.forEach(file => vm.runInContext(fs.readFileSync(path.join(root, ...file.split("/")), "utf8"), context, { filename: file }));
  Object.assign(context, context.__mfBasketballTest);
  return { context, localStorage, getElementById };
}

const env = createContext();
const c = env.context;
const storage = env.localStorage;
const basePrograms = c.mfBasketballPrograms;
const baseBytes = JSON.stringify(basePrograms);
const guard = basePrograms.find(program => program.id === "guard_skills_3_session");
const guardA = guard.sessions.find(session => session.id === "guard_a_handle_weak_hand");
const behind = guardA.drills.find(drill => drill.id === "guard_behind_back_foundation");

function clearProposalState() {
  ["mf-basketball-program-overrides", "mf-basketball-proposal", "mf-habit-proposal"].forEach(key => storage.removeItem(key));
}

function proposal(id, changes) {
  return {
    schemaVersion: 1, proposalVersion: 1, proposalId: id,
    summary: "Basketball personalization test", rationale: "Deterministic evidence-based test proposal.", changes
  };
}

function modify(id = "bball-proposal-modify-1", minutes = 10) {
  return proposal(id, [{
    action: "modify_drill", programId: guard.id, programVersion: guard.version,
    sessionId: guardA.id, drillId: behind.id, fields: { target: { durationMinutes: minutes } }
  }]);
}

function validateImport(candidate) {
  return c.mfBasketballValidateProposal(candidate, { captureExpectedState: true });
}

function runSync(payload) {
  env.getElementById("syncInput").value = "MARCUSFIT_UPDATE_START\n" + JSON.stringify(payload) + "\nMARCUSFIT_UPDATE_END";
  c.applySync();
  return env.getElementById("syncResult").textContent;
}

// Resolution: empty overlays are identical; sparse fragments resolve without mutating base.
assert.deepStrictEqual(JSON.parse(JSON.stringify(c.mfBasketballGetResolvedProgram(guard.id, 1))), JSON.parse(JSON.stringify(guard)));
const addId = "bball-ai-stationary-control-v1";
const disabledId = guardA.drills[guardA.drills.length - 1].id;
const order = [guardA.drills[0].id, addId, ...guardA.drills.slice(1, -1).map(drill => drill.id)];
const overrideStore = {
  schemaVersion: 1, updatedAt: "2026-08-28T12:00:00.000Z", programs: {
    [guard.id]: { baseVersion: 1, sessions: { [guardA.id]: {
      modified: { [behind.id]: { target: { durationMinutes: 10 }, source: "ai_proposal", proposalId: "test" } },
      added: { [addId]: { id: addId, name: "Stationary Control", trackingMode: "confidence", confidence: true, target: { durationMinutes: 5 }, source: "ai_proposal", addedByProposalId: "test" } },
      disabled: { [disabledId]: true }, order
    } } }
  }
};
let parsedOverrides = c.mfBasketballParseOverridesValue(JSON.stringify(overrideStore));
assert.strictEqual(parsedOverrides.parseOk, true);
let resolved = c.mfBasketballGetResolvedProgram(guard.id, 1, parsedOverrides);
assert.strictEqual(resolved.sessions[0].drills.find(drill => drill.id === behind.id).target.durationMinutes, 10);
assert.strictEqual(resolved.sessions[0].drills[1].id, addId);
assert(!resolved.sessions[0].drills.some(drill => drill.id === disabledId));
assert.deepStrictEqual([...resolved.sessions[0].drills.map(drill => drill.id)], order);
assert.strictEqual(JSON.stringify(basePrograms), baseBytes, "built-in programs mutated during resolution");
assert.strictEqual(Object.isFrozen(basePrograms), true);
assert.strictEqual(c.mfBasketballParseOverridesValue("{bad").parseOk, false);
storage.setItem("mf-basketball-program-overrides", "{bad");
assert.deepStrictEqual(JSON.parse(JSON.stringify(c.mfBasketballGetResolvedProgram(guard.id, 1))), JSON.parse(JSON.stringify(guard)), "malformed override did not fail safely to base");
storage.removeItem("mf-basketball-program-overrides");

// Proposal validation is strict, mode-specific, bounded, and rejects prohibited domains.
assert.strictEqual(validateImport(modify()).valid, true);
let bad = modify("bball-proposal-bad-program"); bad.changes[0].programId = "unknown";
assert.strictEqual(validateImport(bad).valid, false);
bad = modify("bball-proposal-bad-version"); bad.changes[0].programVersion = 2;
assert.strictEqual(validateImport(bad).valid, false);
bad = modify("bball-proposal-bad-session"); bad.changes[0].sessionId = "unknown";
assert.strictEqual(validateImport(bad).valid, false);
bad = modify("bball-proposal-bad-drill"); bad.changes[0].drillId = "unknown";
assert.strictEqual(validateImport(bad).valid, false);
bad = modify("bball-proposal-track-mode"); bad.changes[0].fields = { trackingMode: "duration" };
assert.strictEqual(validateImport(bad).valid, false);
bad = modify("bball-proposal-large-warning", 13);
assert.strictEqual(validateImport(bad).warnings.length > 0, true);
bad = modify("bball-proposal-too-extreme", 120);
assert.strictEqual(validateImport(bad).valid, false);
bad = modify("bball-proposal-history"); bad.changes[0].historicalResults = [];
assert.strictEqual(validateImport(bad).valid, false);
const invalidAdd = proposal("bball-proposal-invalid-add", [{ action: "add_drill", programId: guard.id, programVersion: 1, sessionId: guardA.id, drillId: "bad-id", position: 0, drill: { id: "bad-id", name: "Bad", trackingMode: "confidence", target: { durationMinutes: 5 } } }]);
assert.strictEqual(validateImport(invalidAdd).valid, false);
const invalidMode = proposal("bball-proposal-invalid-mode", [{ action: "add_drill", programId: guard.id, programVersion: 1, sessionId: guardA.id, drillId: "bball-ai-invalid-mode-v1", position: 0, drill: { id: "bball-ai-invalid-mode-v1", name: "Bad", trackingMode: "percentage", target: {} } }]);
assert.strictEqual(validateImport(invalidMode).valid, false);

// Import is pending-only and writes neither overrides, queue state, nor history.
clearProposalState();
storage.setItem("mf-basketball-sessions", JSON.stringify({ schemaVersion: 1, sessions: [] }));
const historyBefore = storage.getItem("mf-basketball-sessions");
const stateBefore = storage.getItem("mf-basketball-program-state");
const overridesBefore = storage.getItem("mf-basketball-program-overrides");
assert.strictEqual(c.mfBasketballImportProposal(modify("bball-proposal-import-1"), "2026-08-28T12:00:00.000Z").valid, true);
assert.strictEqual(c.mfBasketballGetProposal().status, "pending");
assert.strictEqual(storage.getItem("mf-basketball-program-overrides"), overridesBefore);
assert.strictEqual(storage.getItem("mf-basketball-program-state"), stateBefore);
assert.strictEqual(storage.getItem("mf-basketball-sessions"), historyBefore);
assert.strictEqual(c.mfBasketballApplyProposal(false).requiresConfirmation, true);
assert.strictEqual(storage.getItem("mf-basketball-program-overrides"), null);
assert.strictEqual(c.mfBasketballImportProposal(modify("bball-proposal-replacement")).valid, false, "pending proposal was overwritten");

// Apply changes only expected stores, preserves history/base, and exact undo succeeds.
let applied = c.mfBasketballApplyProposal(true, "2026-08-28T12:01:00.000Z");
assert.strictEqual(applied.applied, true);
assert.deepStrictEqual([...applied.expectedWrites].sort(), ["mf-basketball-program-overrides", "mf-basketball-proposal"].sort());
assert.strictEqual(c.mfBasketballGetResolvedProgram(guard.id, 1).sessions[0].drills.find(drill => drill.id === behind.id).target.durationMinutes, 10);
assert.strictEqual(storage.getItem("mf-basketball-sessions"), historyBefore);
assert.strictEqual(JSON.stringify(basePrograms), baseBytes);
assert.strictEqual(c.mfBasketballUndoProposal(true, "2026-08-28T12:02:00.000Z").undone, true);
assert.strictEqual(storage.getItem("mf-basketball-program-overrides"), null);

// Drift after import refuses apply; drift after apply refuses undo.
clearProposalState();
assert(c.mfBasketballImportProposal(modify("bball-proposal-conflict-1")).valid);
const driftStore = JSON.parse(JSON.stringify(overrideStore));
driftStore.programs[guard.id].sessions[guardA.id].added = {};
driftStore.programs[guard.id].sessions[guardA.id].disabled = {};
driftStore.programs[guard.id].sessions[guardA.id].order = guardA.drills.map(drill => drill.id);
driftStore.programs[guard.id].sessions[guardA.id].modified[behind.id].target.durationMinutes = 9;
storage.setItem("mf-basketball-program-overrides", JSON.stringify(driftStore));
let conflict = c.mfBasketballApplyProposal(true);
assert.strictEqual(conflict.applied, false);
assert.strictEqual(conflict.conflicts.includes(behind.id), true);
clearProposalState();
assert(c.mfBasketballImportProposal(modify("bball-proposal-undo-conflict")).valid);
assert(c.mfBasketballApplyProposal(true, "2026-08-28T12:03:00.000Z").applied);
const afterApply = JSON.parse(storage.getItem("mf-basketball-program-overrides")); afterApply.updatedAt = "2026-08-28T12:04:00.000Z";
storage.setItem("mf-basketball-program-overrides", JSON.stringify(afterApply));
assert.strictEqual(c.mfBasketballUndoProposal(true).conflict, true);

// Every drill/session action keeps immutable import-time fingerprints after drift.
function assertStaleAction(candidate,expectedKeys,expectedConflicts){
  clearProposalState();storage.removeItem("mf-basketball-program-overrides");assert(c.mfBasketballImportProposal(candidate).valid);const persisted=JSON.parse(storage.getItem("mf-basketball-proposal"));expectedKeys.forEach(key=>assert(Object.prototype.hasOwnProperty.call(persisted.changes[0],key),candidate.proposalId+" missing "+key));assert.strictEqual(c.mfBasketballValidateProposal(JSON.parse(JSON.stringify(persisted))).valid,true);const missingExpected=JSON.parse(JSON.stringify(persisted));expectedKeys.forEach(key=>delete missingExpected.changes[0][key]);const missingValidation=c.mfBasketballValidateProposal(missingExpected);assert.strictEqual(missingValidation.valid,false);expectedConflicts.forEach(id=>assert(missingValidation.conflicts.includes(id)));
  storage.setItem("mf-basketball-program-overrides",JSON.stringify(overrideStore));const driftRaw=storage.getItem("mf-basketball-program-overrides"),pendingActionRaw=storage.getItem("mf-basketball-proposal"),historyRaw=storage.getItem("mf-basketball-sessions"),programRaw=storage.getItem("mf-basketball-program-state");
  [c.mfBasketballValidateProposal(c.mfBasketballGetProposal()),c.mfBasketballApplyProposal(false),c.mfBasketballApplyProposal(true)].forEach(result=>{assert.strictEqual(result.valid===true||result.applied===true,false);expectedConflicts.forEach(id=>assert(result.conflicts.includes(id),candidate.proposalId+" missed conflict "+id));assert((result.errors||[]).includes("Basketball program changed after this proposal was created. Review a fresh proposal."));});
  assert.strictEqual(storage.getItem("mf-basketball-program-overrides"),driftRaw);assert.strictEqual(storage.getItem("mf-basketball-sessions"),historyRaw);assert.strictEqual(storage.getItem("mf-basketball-program-state"),programRaw);assert.strictEqual(storage.getItem("mf-basketball-proposal"),pendingActionRaw);assert.strictEqual(c.mfBasketballGetProposal().status,"pending");
}
const staleAddId="bball-ai-stale-fingerprint-v1",baseOrder=guardA.drills.map(drill=>drill.id);
assertStaleAction(modify("bball-proposal-stale-modify",9),["expectedDrillFingerprint"],[behind.id]);
assertStaleAction(proposal("bball-proposal-stale-add",[{action:"add_drill",programId:guard.id,programVersion:1,sessionId:guardA.id,drillId:staleAddId,position:1,drill:{id:staleAddId,name:"Stale Fingerprint Add",trackingMode:"confidence",confidence:true,target:{durationMinutes:5}}}]),["expectedSessionFingerprint"],[guardA.id]);
assertStaleAction(proposal("bball-proposal-stale-remove",[{action:"remove_drill",programId:guard.id,programVersion:1,sessionId:guardA.id,drillId:behind.id}]),["expectedDrillFingerprint","expectedSessionFingerprint"],[behind.id,guardA.id]);
assertStaleAction(proposal("bball-proposal-stale-reorder",[{action:"reorder_drills",programId:guard.id,programVersion:1,sessionId:guardA.id,order:baseOrder.slice().reverse()}]),["expectedSessionFingerprint"],[guardA.id]);

// Add, disable, reorder, and program-switch actions affect future resolution only.
clearProposalState();
const addProposal = proposal("bball-proposal-add-1", [{ action: "add_drill", programId: guard.id, programVersion: 1, sessionId: guardA.id, drillId: addId, position: 1, drill: { id: addId, name: "Behind-the-Back Stationary Control", trackingMode: "confidence", confidence: true, target: { durationMinutes: 5 } } }]);
assert(c.mfBasketballImportProposal(addProposal).valid);const addApplied = c.mfBasketballApplyProposal(true);assert(addApplied.applied, JSON.stringify(addApplied));
resolved = c.mfBasketballGetResolvedProgram(guard.id, 1);
assert.strictEqual(resolved.sessions[0].drills[1].id, addId);
assert.strictEqual(resolved.sessions[0].drills[1].trackingMode, "confidence");
assert.strictEqual(resolved.sessions[0].drills[1].target.durationMinutes, 5);
const built = c.mfBasketballBuildStructuredInput({ programId: guard.id, programVersion: 1, plannedSessionId: guardA.id, date: "2026-08-28", minutes: 30, drills: [{ drillId: addId, confidence: 5, actualResult: { durationMinutes: 5 } }] });
assert.strictEqual(built.ok, true, JSON.stringify(built.errors));assert(built.input.drills.some(drill => drill.drillId === addId && drill.nameSnapshot === "Behind-the-Back Stationary Control"));
assert.strictEqual(storage.getItem("mf-basketball-sessions"), historyBefore);

clearProposalState();
const historicalDrill = { id: "bball-history-1", schemaVersion: 1, date: "2026-08-01", type: "basketball_workout", minutes: 20, createdAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-01T12:00:00.000Z", programId: guard.id, programVersion: 1, programNameSnapshot: guard.name, plannedSessionId: guardA.id, plannedSessionNameSnapshot: guardA.name, drills: [{ drillId: behind.id, nameSnapshot: behind.name, trackingMode: behind.trackingMode, plannedTargetSnapshot: behind.target, actualResult: { durationMinutes: 8 }, confidence: 5 }] };
storage.setItem("mf-basketball-sessions", JSON.stringify({ schemaVersion: 1, sessions: [historicalDrill] }));
const structuredHistoryBefore = storage.getItem("mf-basketball-sessions");
const removeProposal = proposal("bball-proposal-remove-1", [{ action: "remove_drill", programId: guard.id, programVersion: 1, sessionId: guardA.id, drillId: behind.id }]);
assert(c.mfBasketballImportProposal(removeProposal).valid);assert(c.mfBasketballApplyProposal(true).applied);
assert(!c.mfBasketballGetResolvedProgram(guard.id, 1).sessions[0].drills.some(drill => drill.id === behind.id));
assert.strictEqual(storage.getItem("mf-basketball-sessions"), structuredHistoryBefore);
assert.strictEqual(c.mfBasketballDrillHistory(behind.id, c.mfBasketballReadStore().sessions).length, 1);

clearProposalState();
const reverseOrder = guardA.drills.map(drill => drill.id).reverse();
const reorderProposal = proposal("bball-proposal-reorder-1", [{ action: "reorder_drills", programId: guard.id, programVersion: 1, sessionId: guardA.id, order: reverseOrder }]);
assert(c.mfBasketballImportProposal(reorderProposal).valid);assert(c.mfBasketballApplyProposal(true).applied);
assert.deepStrictEqual([...c.mfBasketballGetResolvedProgram(guard.id, 1).sessions[0].drills.map(drill => drill.id)], [...reverseOrder]);
assert.strictEqual(storage.getItem("mf-basketball-sessions"), structuredHistoryBefore);

clearProposalState();storage.removeItem("mf-basketball-program-overrides");
assert(c.mfBasketballSelectProgram(guard.id, "2026-08-28T13:00:00.000Z").ok);assert(c.mfBasketballAdvanceProgramState("2026-08-28T13:01:00.000Z").ok);
const switchProposal = proposal("bball-proposal-switch-1", [{ action: "switch_program", targetProgramId: "shooting_focus_2_session", targetProgramVersion: 1 }]);
assert(c.mfBasketballImportProposal(switchProposal).valid);const switchPreview = c.mfBasketballApplyProposal(false);assert(switchPreview.expectedWrites.includes("mf-basketball-program-state"));assert(c.mfBasketballApplyProposal(true).applied);
assert.strictEqual(c.mfBasketballReadProgramState().state.activeProgramId, "shooting_focus_2_session");
assert.strictEqual(c.mfBasketballReadProgramState().state.nextSessionIndex, 0);
assert.strictEqual(storage.getItem("mf-basketball-sessions"), structuredHistoryBefore);

// A pending program switch keeps import-time active-program evidence across reload/review.
clearProposalState();storage.removeItem("mf-basketball-program-overrides");
assert(c.mfBasketballSelectProgram(guard.id,"2026-08-28T13:10:00.000Z").ok);assert(c.mfBasketballAdvanceProgramState("2026-08-28T13:11:00.000Z").ok);
const staleSwitchProposal=proposal("bball-proposal-switch-stale-1",[{action:"switch_program",targetProgramId:"shooting_focus_2_session",targetProgramVersion:1}]);
assert(runSync({updates:[],basketballProposal:staleSwitchProposal}).includes("Basketball proposal imported."));c.mfBasketballCloseProposalReview();
const persistedSwitch=JSON.parse(storage.getItem("mf-basketball-proposal"));assert.deepStrictEqual({...persistedSwitch.changes[0].expectedActiveProgram},{activeProgramId:guard.id,activeProgramVersion:1,nextSessionIndex:1});
const roundTrippedSwitch=JSON.parse(JSON.stringify(persistedSwitch));assert.strictEqual(c.mfBasketballValidateProposal(roundTrippedSwitch).valid,true);
const fundamentals=basePrograms.find(program=>program.id==="basketball_fundamentals_3_session");assert(c.mfBasketballSelectProgram(fundamentals.id,"2026-08-28T13:13:00.000Z").ok);assert(c.mfBasketballAdvanceProgramState("2026-08-28T13:14:00.000Z").ok);
const changedProgramRaw=storage.getItem("mf-basketball-program-state"),staleOverridesRaw=storage.getItem("mf-basketball-program-overrides"),staleHistoryRaw=storage.getItem("mf-basketball-sessions"),stalePendingRaw=storage.getItem("mf-basketball-proposal");
assert.strictEqual(c.mfBasketballOpenProposalReview(),true);assert.strictEqual(storage.getItem("mf-basketball-proposal"),stalePendingRaw);c.mfBasketballCloseProposalReview();const staleValidation=c.mfBasketballValidateProposal(c.mfBasketballGetProposal());assert.strictEqual(staleValidation.valid,false);assert(staleValidation.conflicts.includes("active_program"));assert(staleValidation.errors.includes("Basketball program changed after this proposal was created. Review a fresh proposal."));
const stalePreview=c.mfBasketballApplyProposal(false);assert.strictEqual(stalePreview.applied,false);assert(stalePreview.conflicts.includes("active_program"));const staleApply=c.mfBasketballApplyProposal(true);assert.strictEqual(staleApply.applied,false);assert(staleApply.conflicts.includes("active_program"));
assert.strictEqual(storage.getItem("mf-basketball-program-state"),changedProgramRaw);assert.strictEqual(storage.getItem("mf-basketball-program-overrides"),staleOverridesRaw);assert.strictEqual(storage.getItem("mf-basketball-sessions"),staleHistoryRaw);assert.strictEqual(storage.getItem("mf-basketball-proposal"),stalePendingRaw);assert.strictEqual(c.mfBasketballGetProposal().status,"pending");

// Queue drift is part of switch-program context and target/current identity cannot bypass stale evidence.
clearProposalState();assert(c.mfBasketballSelectProgram(guard.id,"2026-08-28T13:20:00.000Z").ok);assert(c.mfBasketballImportProposal(proposal("bball-proposal-switch-queue-stale",[{action:"switch_program",targetProgramId:"shooting_focus_2_session",targetProgramVersion:1}])).valid);assert(c.mfBasketballAdvanceProgramState("2026-08-28T13:21:00.000Z").ok);
let switchConflict=c.mfBasketballApplyProposal(true);assert.strictEqual(switchConflict.applied,false);assert(switchConflict.conflicts.includes("active_program"));assert.strictEqual(c.mfBasketballReadProgramState().state.activeProgramId,guard.id);assert.strictEqual(c.mfBasketballReadProgramState().state.nextSessionIndex,1);assert.strictEqual(c.mfBasketballGetProposal().status,"pending");
clearProposalState();assert(c.mfBasketballSelectProgram(guard.id,"2026-08-28T13:22:00.000Z").ok);assert(c.mfBasketballImportProposal(proposal("bball-proposal-switch-target-stale",[{action:"switch_program",targetProgramId:"shooting_focus_2_session",targetProgramVersion:1}])).valid);assert(c.mfBasketballSelectProgram("shooting_focus_2_session","2026-08-28T13:23:00.000Z").ok);
switchConflict=c.mfBasketballApplyProposal(true);assert.strictEqual(switchConflict.applied,false);assert(switchConflict.conflicts.includes("active_program"));assert.strictEqual(c.mfBasketballReadProgramState().state.activeProgramId,"shooting_focus_2_session");assert.strictEqual(c.mfBasketballGetProposal().status,"pending");

// Program-version drift and missing persisted evidence are conflicts, never refresh opportunities.
clearProposalState();assert(c.mfBasketballSelectProgram(guard.id,"2026-08-28T13:24:00.000Z").ok);assert(c.mfBasketballImportProposal(proposal("bball-proposal-switch-version-stale",[{action:"switch_program",targetProgramId:"shooting_focus_2_session",targetProgramVersion:1}])).valid);const invalidVersionState=JSON.parse(storage.getItem("mf-basketball-program-state"));invalidVersionState.activeProgramVersion=2;storage.setItem("mf-basketball-program-state",JSON.stringify(invalidVersionState));const invalidVersionRaw=storage.getItem("mf-basketball-program-state");
switchConflict=c.mfBasketballApplyProposal(true);assert.strictEqual(switchConflict.applied,false);assert(switchConflict.conflicts.includes("active_program"));assert.strictEqual(storage.getItem("mf-basketball-program-state"),invalidVersionRaw);assert.strictEqual(c.mfBasketballGetProposal().status,"pending");
clearProposalState();assert(c.mfBasketballSelectProgram(guard.id,"2026-08-28T13:25:00.000Z").ok);assert(c.mfBasketballImportProposal(proposal("bball-proposal-switch-missing-evidence",[{action:"switch_program",targetProgramId:"shooting_focus_2_session",targetProgramVersion:1}])).valid);const missingEvidenceProposal=JSON.parse(storage.getItem("mf-basketball-proposal"));delete missingEvidenceProposal.changes[0].expectedActiveProgram;storage.setItem("mf-basketball-proposal",JSON.stringify(missingEvidenceProposal));assert(c.mfBasketballSelectProgram(fundamentals.id,"2026-08-28T13:26:00.000Z").ok);const missingEvidenceRaw=storage.getItem("mf-basketball-proposal");
switchConflict=c.mfBasketballValidateProposal(c.mfBasketballGetProposal());assert.strictEqual(switchConflict.valid,false);assert(switchConflict.conflicts.includes("active_program"));assert.strictEqual(storage.getItem("mf-basketball-proposal"),missingEvidenceRaw);assert.strictEqual(c.mfBasketballApplyProposal(true).applied,false);assert.strictEqual(storage.getItem("mf-basketball-proposal"),missingEvidenceRaw);

// Reject is auditable and makes no personalization change.
clearProposalState();const rejectedOverrides = storage.getItem("mf-basketball-program-overrides");
assert(c.mfBasketballImportProposal(modify("bball-proposal-reject-1")).valid);assert.strictEqual(c.mfBasketballRejectProposal(), true);assert.strictEqual(c.mfBasketballGetProposal().status, "rejected");assert.strictEqual(storage.getItem("mf-basketball-program-overrides"), rejectedOverrides);

// Mixed Sync: all seven combinations preserve authoritative core behavior and stage proposals only.
const coreId = vm.runInContext("P.home[0].exercises[0].id", c);
let sequence = 0;
function habitProposal() { sequence++; return { proposalId: `habit-mixed-${sequence}`, summary: "Mixed habit", changes: [{ action: "add", habitId: `habit-mixed-${sequence}`, definition: { id: `habit-mixed-${sequence}`, name: "Mixed Habit", target: { type: "checkbox" }, schedule: { type: "daily" }, instructions: [] } }] }; }
function basketballProposal() { sequence++; return modify(`bball-proposal-mixed-${sequence}`); }
function resetMixed() { storage.removeItem("mf-habit-proposal"); storage.removeItem("mf-basketball-proposal"); }
resetMixed();assert(runSync([{ id: coreId, blurb: "core only" }]).includes("updated"));
resetMixed();assert(runSync({ updates: [], habitProposal: habitProposal() }).includes("Habit changes are pending explicit review."));assert.strictEqual(c.p960GetHabitProposal().status, "pending");
resetMixed();assert(runSync({ updates: [], basketballProposal: basketballProposal() }).includes("Basketball proposal imported."));assert.strictEqual(c.mfBasketballGetProposal().status, "pending");
resetMixed();assert(runSync({ updates: [{ id: coreId, blurb: "core habit" }], habitProposal: habitProposal() }).includes("Program sync processed."));
resetMixed();assert(runSync({ updates: [{ id: coreId, blurb: "core basketball" }], basketballProposal: basketballProposal() }).includes("Basketball changes are pending explicit review."));
resetMixed();assert(runSync({ updates: [], habitProposal: habitProposal(), basketballProposal: basketballProposal() }).includes("Habit changes are pending explicit review."));
resetMixed();let message = runSync({ updates: [{ id: coreId, blurb: "all three" }], habitProposal: habitProposal(), basketballProposal: basketballProposal() });assert(message.includes("Program sync processed."));assert(message.includes("Habit changes are pending explicit review."));assert(message.includes("Basketball changes are pending explicit review."));assert.strictEqual(c.p960GetHabitById(c.p960GetHabitProposal().changes[0].habitId), null);assert.strictEqual(storage.getItem("mf-basketball-program-overrides"), rejectedOverrides);

// Dispatcher validates before core execution and invokes a supplied core exactly once.
resetMixed();env.getElementById("syncInput").value = "MARCUSFIT_UPDATE_START\n" + JSON.stringify({ updates: [{ id: coreId, blurb: "count" }], basketballProposal: basketballProposal() }) + "\nMARCUSFIT_UPDATE_END";
let coreCalls = 0;assert.strictEqual(c.mfBasketballHandleSyncExtension(() => { coreCalls++; }), true);assert.strictEqual(coreCalls, 1);
resetMixed();const coreOverrideBeforeInvalid = storage.getItem("mf-overrides");bad = modify("bball-proposal-invalid-mixed", 121);message = runSync({ updates: [{ id: coreId, blurb: "must not run" }], basketballProposal: bad });assert(message.includes("rejected before any proposal or core processing"));assert.strictEqual(storage.getItem("mf-overrides"), coreOverrideBeforeInvalid);

// Final binding and core rollback/rejection remain authoritative.
assert(c.applySync.toString().includes("exercise is archived"));
assert.strictEqual((basketballSource.match(/function\s+applySync\s*\(/g) || []).length, 0);
assert(!/\bapplySync\s*=/.test(basketballSource));
assert.strictEqual(crypto.createHash("sha256").update(coreSyncBytes).digest("hex"), "25aaf52986493af7d5796b57f81746f8f279f506b2550a61ca7b011c9572c51e");
const beforeInvalidCore = storage.snapshot();message = runSync([{ id: "home-d0-e999", name: "Invalid" }]);assert(/expected next exercise index|skipped/i.test(message));assert.deepStrictEqual(storage.snapshot(), beforeInvalidCore);

// Backup owns both stores, accepts legacy absence, round-trips raw state, and rejects malformed data.
assert.strictEqual(c.p8IsMarcusFitKey("mf-basketball-program-overrides"), true);
assert.strictEqual(c.p8IsMarcusFitKey("mf-basketball-proposal"), true);
const legacyEnvelope = data => ({ app: "MarcusFit", schemaVersion: 1, appVersion: "10.2.0", exportedAt: "2026-08-28T12:00:00.000Z", data });
assert.doesNotThrow(() => c.p8ValidateBackup(JSON.stringify(legacyEnvelope({}))));
storage.removeItem("mf-basketball-program-overrides");storage.removeItem("mf-basketball-proposal");assert(c.mfBasketballImportProposal(modify("bball-proposal-backup-1")).valid);
const pendingRaw = storage.getItem("mf-basketball-proposal");const validOverrideRaw = JSON.stringify(overrideStore);storage.setItem("mf-basketball-program-overrides", validOverrideRaw);
const backup = c.p8BuildBackup();assert.strictEqual(backup.data["mf-basketball-program-overrides"], validOverrideRaw);assert.strictEqual(backup.data["mf-basketball-proposal"], pendingRaw);assert.doesNotThrow(() => c.p8ValidateBackup(JSON.stringify(backup)));
const backupSummary = c.p8492SummarizeBackup(backup);assert.strictEqual(backupSummary.hasBasketballOverrides, true);assert.strictEqual(backupSummary.hasBasketballProposal, true);assert.strictEqual(backupSummary.basketballProposalStatus, "pending");
assert.throws(() => c.p8ValidateBackup(JSON.stringify(legacyEnvelope({ "mf-basketball-program-overrides": "{bad" }))), /overrides/i);
assert.throws(() => c.p8ValidateBackup(JSON.stringify(legacyEnvelope({ "mf-basketball-proposal": "{bad" }))), /proposal/i);

// Export contract includes resolved identity/context without rewriting historical snapshots.
storage.setItem("mf-basketball-program-state", JSON.stringify({ schemaVersion: 1, activeProgramId: guard.id, activeProgramVersion: 1, nextSessionIndex: 0, selectedAt: "2026-08-28T12:00:00.000Z", updatedAt: "2026-08-28T12:00:00.000Z" }));
const exported = c.mfBasketballBuildExport("program", [], c.mfBasketballReadProgramState());
["programId=guard_skills_3_session", "sessionId=guard_a_handle_weak_hand", "drillId=", "source=", "Applied personalization:", "Pending basketball proposal:", "Skipped drills are neutral", "session-driven", "bball-ai-…-vN", "modify_drill", "switch_program", "history, results, queue advancement"].forEach(token => assert(exported.includes(token), `Export missing ${token}`));

// Diagnostics are read-only and self-test restores byte-for-byte.
const debugBefore = storage.snapshot();assert.strictEqual(c.mfBasketballOverridesDebug().readOnly, true);assert.strictEqual(c.mfBasketballProposalDebug().readOnly, true);assert.deepStrictEqual(storage.snapshot(), debugBefore);const selfTest = c.mfBasketballProposalSelfTest();assert.strictEqual(selfTest.passed, true, JSON.stringify(selfTest));assert.deepStrictEqual(storage.snapshot(), debugBefore);

// Review UI is reachable, wraps on phones, uses safe areas, and avoids native dialogs.
assert(html.includes('id="mfBasketballProposalStatus"'));
assert(basketballSource.includes("Pending basketball proposal"));
assert(basketballSource.includes("Apply Supported Changes"));
assert(basketballSource.includes("Confirm Apply"));
assert(basketballSource.includes("Keep Current Basketball Program"));
assert(basketballSource.includes("Close / Review Later"));
assert(css.includes(".mf-basketball-proposal-overlay .p960-footer"));
assert(css.includes("env(safe-area-inset-bottom)"));
assert(css.includes("overflow-wrap:anywhere"));
assert(css.includes("body.mf-basketball-proposal-open{position:fixed;"));
assert(css.includes("overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain"));
assert(!/\b(?:confirm|alert)\s*\(/.test(basketballSource));
assert(html.includes('content="width=device-width, initial-scale=1, viewport-fit=cover"'));

// Basketball review owns vertical scrolling and restores exact page/body state on close.
c.mfBasketballCloseProposalReview();clearProposalState();assert(c.mfBasketballImportProposal(modify("bball-proposal-scroll-lock-1")).valid);
const proposalBeforeReview=storage.getItem("mf-basketball-proposal"),body=env.context.document.body,returnFocus=createElement();
body.style.position="relative";body.style.top="3px";body.style.left="4px";body.style.right="5px";body.style.width="95%";body.style.overflow="visible";
c.pageXOffset=c.scrollX=7;c.pageYOffset=c.scrollY=427;env.context.document.activeElement=returnFocus;
assert.strictEqual(c.mfBasketballOpenProposalReview(),true);assert.strictEqual(body.classList.contains("mf-basketball-proposal-open"),true);assert.strictEqual(body.style.position,"fixed");assert.strictEqual(body.style.top,"-427px");assert.strictEqual(body.style.left,"0");assert.strictEqual(body.style.right,"0");assert.strictEqual(body.style.width,"100%");assert.strictEqual(body.style.overflow,"hidden");assert.strictEqual(storage.getItem("mf-basketball-proposal"),proposalBeforeReview);
c.mfBasketballCloseProposalReview();assert.strictEqual(body.classList.contains("mf-basketball-proposal-open"),false);assert.deepStrictEqual({position:body.style.position,top:body.style.top,left:body.style.left,right:body.style.right,width:body.style.width,overflow:body.style.overflow},{position:"relative",top:"3px",left:"4px",right:"5px",width:"95%",overflow:"visible"});assert.deepStrictEqual(c.lastScrollTo,[7,427]);assert.strictEqual(returnFocus.focused,true);assert.strictEqual(storage.getItem("mf-basketball-proposal"),proposalBeforeReview);

console.log("MarcusFit 10.3.0 basketball AI Sync: PASS");
