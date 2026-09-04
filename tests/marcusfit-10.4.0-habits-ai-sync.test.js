const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets/css/marcusfit.css"), "utf8");
const scripts = [...index.matchAll(/<script src="([^"]+)" defer><\/script>/g)].map(match => match[1]);
const sha = value => crypto.createHash("sha256").update(Buffer.from(value.toString("utf8").replace(/\r\n/g, "\n"))).digest("hex");

assert(index.includes("<title>MarcusFit 10.7.0</title>"));
assert(fs.readFileSync(path.join(root, "assets/js/core/01-app-constants.js"), "utf8").includes('APP_VERSION = "10.7.0"'), "10.4 Habit Sync contract must survive the 10.7 version increment");
assert.strictEqual(sha(fs.readFileSync(path.join(root, "Releases/MarcusFit9_6_0.html"))), "f710c497cc6af212f6827f36461c000e655c66cba151392082ffffe55f14a160");
assert.strictEqual(sha(fs.readFileSync(path.join(root, "assets/js/sync/12-ai-sync.js"))), "14245321c8f47de5c152d011a08877ef4821e353c15bc3ed72c0490aa767c598");
assert.deepStrictEqual(scripts, JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/runtime-script-order.json"), "utf8")));
assert.strictEqual(scripts.length, 22);
assert(!fs.existsSync(path.join(root, "package.json")) && !fs.existsSync(path.join(root, "node_modules")));
const inventory = JSON.parse(execFileSync(process.execPath, [path.join(root, "tools/architecture/inventory-runtime.js")], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }));
assert.strictEqual(inventory.protectedInvariants.programSha256, "652a04c37928f232490d37ce7e709dc16a25a8c5f408d679bce046b2f6a2d7d4");
assert.strictEqual(inventory.protectedInvariants.exerciseIdCount, 63);
assert.strictEqual(inventory.protectedInvariants.exerciseIdSha256, "7c333a9b7fb4639cafd0900a96f1d4ba58b8d6b8fb5ecc23f335e7ee041d0e2b");
assert(css.includes(".mf-habit-proposal-overlay{overflow:hidden;}") && css.includes("-webkit-overflow-scrolling:touch") && css.includes("body.mf-habit-proposal-open"));
assert(index.includes('name="viewport"') && !/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(index));

function createStorage(initial = {}) {
  const memory = new Map(Object.entries(initial));
  const writes = [];
  const api = {
    getItem(key) { return memory.has(String(key)) ? memory.get(String(key)) : null; },
    setItem(key, value) { memory.set(String(key), String(value)); writes.push({ op: "set", key: String(key) }); },
    removeItem(key) { memory.delete(String(key)); writes.push({ op: "remove", key: String(key) }); },
    key(index) { return [...memory.keys()][index] || null; }, clear() { memory.clear(); writes.push({ op: "clear" }); },
    get length() { return memory.size; }, get writes() { return writes.slice(); }, resetWrites() { writes.length = 0; }
  };
  return new Proxy(api, { ownKeys() { return [...memory.keys()]; }, getOwnPropertyDescriptor(target, property) { return memory.has(property) ? { enumerable: true, configurable: true } : Object.getOwnPropertyDescriptor(target, property); } });
}
function element() {
  const classes = new Set();
  return { value: "", textContent: "", innerHTML: "", className: "", id: "", disabled: false, hidden: false, children: [], dataset: {}, style: { position: "", top: "", left: "", right: "", width: "", overflow: "", setProperty(name, value) { this[name] = value; }, removeProperty(name) { this[name] = ""; } },
    classList: { add(...names) { names.forEach(name => classes.add(name)); }, remove(...names) { names.forEach(name => classes.delete(name)); }, contains(name) { return classes.has(name); }, toggle(name) { classes.has(name) ? classes.delete(name) : classes.add(name); } },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {}, append(...children) { this.children.push(...children); }, appendChild(child) { this.children.push(child); return child; }, replaceChildren(...children) { this.children = children; }, querySelector() { return null; }, querySelectorAll() { return []; }, focus() { this.focused = true; }, scrollIntoView() {}, insertAdjacentHTML(position, value) { this.innerHTML += value; }
  };
}
function context(initial) {
  const localStorage = createStorage(initial), elements = new Map();
  const getElementById = id => { if (!elements.has(id)) { const node = element(); node.id = id; elements.set(id, node); } return elements.get(id); };
  const c = { console: { log() {}, warn() {}, error() {} }, localStorage, process, document: { getElementById, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, removeEventListener() {}, createElement: element, createTextNode: String, body: element(), head: element(), activeElement: null }, navigator: { clipboard: { writeText() { return Promise.resolve(); } } }, location: { reload() {} }, URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} }, Blob: global.Blob, alert() {}, confirm() { throw new Error("native confirm called"); }, getComputedStyle() { return {}; }, scrollX: 0, scrollY: 0, pageXOffset: 0, pageYOffset: 0, scrollTo(x, y) { this.scrollX = this.pageXOffset = x; this.scrollY = this.pageYOffset = y; }, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, setInterval, clearInterval, window: null };
  c.window = c; vm.createContext(c); scripts.forEach(file => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), c, { filename: file })); return { c, localStorage, getElementById };
}

const base = { schemaVersion: 1, definitionVersion: "10.3.0", habits: {
  "habit-a": { id: "habit-a", name: "Water", icon: "💧", description: "", target: { type: "number", value: 64, unit: "oz", display: "64 oz" }, schedule: { type: "daily" }, instructions: [], emphasis: "normal", active: true, archivedAt: null, source: "user", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z", futureField: { kept: true } },
  "habit-b": { id: "habit-b", name: "Walk", icon: "🚶", description: "", target: { type: "count", value: 1, unit: "walk", display: "1 walk" }, schedule: { type: "weekdays", weekdays: [1, 3, 5] }, instructions: ["Outside"], emphasis: "low", active: false, archivedAt: "2026-08-10T00:00:00.000Z", source: "user", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z" },
  "habit-c": { id: "habit-c", name: "Read", icon: "📖", description: "", target: { type: "duration", value: 10, unit: "min", display: "10 min" }, schedule: { type: "daily" }, instructions: [], emphasis: "normal", active: true, archivedAt: null, source: "user", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" }
}, order: ["habit-a", "habit-b", "habit-c"], createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z" };
const history = JSON.stringify({ habits: { "habit-a": { completed: true, value: 72, notes: "keep", future: { exact: true } } }, unknown: "preserve" });
const env = context({ "mf-habit-definitions": JSON.stringify(base), "day-2026-08-20": history, "mf-onboarding-state": JSON.stringify({ schemaVersion: 1, status: "completed" }), "mf-user-profile": JSON.stringify({ schemaVersion: 1, firstName: "Marcus" }) });
const c = env.c, storage = env.localStorage;
let n = 0;
const proposal = changes => ({ schemaVersion: 1, proposalVersion: "10.4.0", proposalId: `habit-proposal-test-${++n}`, source: "ai_sync", summary: "Safe Habit update", rationale: "Bounded coaching evidence.", changes });
const clear = () => storage.removeItem("mf-habit-proposal");
const findByText = (node, text) => !node ? null : node.textContent === text ? node : (node.children || []).map(child => findByText(child, text)).find(Boolean) || null;

// Personalize proposal affordance is live for every stored status, and the
// pending review requires a clear two-stage dismissal before recording rejected.
const reviewButton=env.getElementById("p960ProposalReviewButton"),pendingBadge=env.getElementById("mfSyncPersonalizePending");
clear();c.p960UpdateSettingsStatus();assert(reviewButton.disabled&&reviewButton.textContent==="No Pending Habit Proposal");assert.strictEqual(pendingBadge.hidden,true);
assert(c.p960ImportHabitProposal(proposal([{ action:"keep",habitId:"habit-a" }])).valid);assert(!reviewButton.disabled&&reviewButton.textContent==="Review Pending Habit Proposal");assert.strictEqual(pendingBadge.hidden,false);
storage.resetWrites();assert(c.p960OpenHabitProposalReview());const dismiss=findByText(env.getElementById("p960ProposalReview"),"Dismiss Proposal");assert(dismiss,"explicit Dismiss Proposal action was not rendered");dismiss.onclick();assert.strictEqual(c.p960GetHabitProposal().status,"pending","first dismissal click changed proposal status");assert.strictEqual(storage.writes.length,0,"dismissal confirmation preview wrote storage");assert.strictEqual(dismiss.textContent,"Confirm Dismissal");dismiss.onclick();assert.strictEqual(c.p960GetHabitProposal().status,"rejected");assert(reviewButton.disabled&&reviewButton.textContent==="No Pending Habit Proposal");assert.strictEqual(pendingBadge.hidden,true,"Personalize Review badge remained after dismissal");
let statusFixture=c.p960GetHabitProposal();statusFixture.status="applied";statusFixture.undoSnapshot={definitionRaw:null,appliedRaw:"{}",appliedFingerprint:"fixture"};storage.setItem("mf-habit-proposal",JSON.stringify(statusFixture));c.p960UpdateSettingsStatus();assert(!reviewButton.disabled&&reviewButton.textContent==="Review / Undo Habit Changes");assert.strictEqual(c.p960OpenHabitProposalReview(),true,"applied-with-Undo review action was dead");c.p960CloseHabitProposalReview();
statusFixture.status="undone";statusFixture.undoSnapshot=null;storage.setItem("mf-habit-proposal",JSON.stringify(statusFixture));c.p960UpdateSettingsStatus();assert(reviewButton.disabled&&reviewButton.textContent==="No Pending Habit Proposal");assert.strictEqual(pendingBadge.hidden,true);
clear();c.p960UpdateSettingsStatus();assert(reviewButton.disabled&&reviewButton.textContent==="No Pending Habit Proposal");

// Valid actions and import-only immutable expectations.
let imported = c.p960ImportHabitProposal(proposal([{ action: "modify", habitId: "habit-a", fields: { name: "Water Plus", target: { type: "number", value: 72, unit: "oz", display: "72 oz" } } }]));
assert(imported.valid); let stored = JSON.parse(storage.getItem("mf-habit-proposal")); const expected = stored.changes[0].expectedHabitFingerprint; assert(expected);
const pendingRaw = storage.getItem("mf-habit-proposal"); assert(c.p960ValidateHabitProposal(c.p960GetHabitProposal()).valid); assert.strictEqual(storage.getItem("mf-habit-proposal"), pendingRaw); c.p960ApplyHabitProposal(false); c.mfHabitProposalDebug(); assert.strictEqual(JSON.parse(storage.getItem("mf-habit-proposal")).changes[0].expectedHabitFingerprint, expected);
assert(c.p960ApplyHabitProposal(false).requiresConfirmation); const beforeApply = storage.getItem("mf-habit-definitions"); storage.resetWrites(); assert(c.p960ApplyHabitProposal(true).applied); assert.deepStrictEqual([...new Set(storage.writes.map(x => x.key))].sort(), ["mf-habit-definitions", "mf-habit-proposal"]); assert.strictEqual(storage.getItem("day-2026-08-20"), history); assert.strictEqual(c.p960GetHabitById("habit-a").futureField.kept, true); assert(c.p960UndoHabitProposal(false).requiresConfirmation); assert(c.p960UndoHabitProposal(true).undone); assert.strictEqual(storage.getItem("mf-habit-definitions"), beforeApply); assert.strictEqual(storage.getItem("day-2026-08-20"), history);

clear(); imported = c.p960ImportHabitProposal(proposal([{ action: "add", habitId: "habit-new", definition: { id: "habit-new", name: "Stretch", icon: "🧘", description: "", target: { type: "duration", value: 10, unit: "min", display: "10 min" }, schedule: { type: "daily" }, instructions: ["Easy pace"], emphasis: "normal" } }])); assert(imported.valid && imported.proposal.changes[0].expectedAbsent === true); let changed = c.p960GetHabitStore(); changed.habits["habit-unrelated"] = c.p960NormalizeHabit({ id: "habit-unrelated", name: "Other", target: { type: "checkbox" }, schedule: { type: "daily" }, instructions: [] }, "habit-unrelated"); changed.order.push("habit-unrelated"); c.p960SaveHabitStore(changed); assert(c.p960ApplyHabitProposal(false).requiresConfirmation); changed = c.p960GetHabitStore(); changed.habits["habit-new"] = c.p960NormalizeHabit({ id: "habit-new", name: "Occupied", target: { type: "checkbox" }, schedule: { type: "daily" }, instructions: [] }, "habit-new"); changed.order.push("habit-new"); c.p960SaveHabitStore(changed); const addRaw = storage.getItem("mf-habit-proposal"), defsRaw = storage.getItem("mf-habit-definitions"); let conflict = c.p960ApplyHabitProposal(true); assert(!conflict.applied && conflict.conflicts.length); assert.strictEqual(storage.getItem("mf-habit-proposal"), addRaw); assert.strictEqual(storage.getItem("mf-habit-definitions"), defsRaw);

// Archive/reactivate/reorder and stale drift.
clear(); assert(c.p960ImportHabitProposal(proposal([{ action: "archive", habitId: "habit-a" }])).valid); changed = c.p960GetHabitStore(); changed.habits["habit-a"].active = false; c.p960SaveHabitStore(changed); assert(c.p960ApplyHabitProposal(true).conflicts.length); assert.strictEqual(c.p960GetHabitProposal().status, "pending");
clear(); assert(c.p960ImportHabitProposal(proposal([{ action: "reactivate", habitId: "habit-b" }])).valid);
clear(); imported = c.p960ImportHabitProposal(proposal([{ action: "reorder", order: ["habit-b", "habit-a"] }])); assert(imported.valid && imported.proposal.changes[0].expectedOrderFingerprint); const reorderExpected = imported.proposal.changes[0].expectedOrderFingerprint; c.p960ValidateHabitProposal(c.p960GetHabitProposal()); assert.strictEqual(c.p960GetHabitProposal().changes[0].expectedOrderFingerprint, reorderExpected); changed = c.p960GetHabitStore(); changed.order = ["habit-b", "habit-a"].concat(changed.order.filter(id => !["habit-a", "habit-b"].includes(id))); c.p960SaveHabitStore(changed); assert(c.p960ApplyHabitProposal(true).conflicts.some(x => x.action === "reorder"));

// Full-order evidence catches an external Habit moving around the proposed subset.
storage.setItem("mf-habit-definitions", JSON.stringify(base)); clear(); imported = c.p960ImportHabitProposal(proposal([{ action: "reorder", order: ["habit-b", "habit-a"] }])); assert(imported.valid); const fullOrderExpected = imported.proposal.changes[0].expectedOrderFingerprint; assert.strictEqual(fullOrderExpected, c.p960Fingerprint(["habit-a", "habit-b", "habit-c"])); changed = c.p960GetHabitStore(); changed.order = ["habit-c", "habit-a", "habit-b"]; c.p960SaveHabitStore(changed); const manualOrderRaw = storage.getItem("mf-habit-definitions"), staleReorderRaw = storage.getItem("mf-habit-proposal"), staleHistoryRaw = storage.getItem("day-2026-08-20"); storage.resetWrites(); const externalOrderConflict = c.p960ApplyHabitProposal(true); assert(!externalOrderConflict.applied && externalOrderConflict.conflicts.some(x => x.action === "reorder")); assert.strictEqual(storage.writes.length, 0); assert.strictEqual(storage.getItem("mf-habit-definitions"), manualOrderRaw); assert.deepStrictEqual([...c.p960GetHabitStore().order], ["habit-c", "habit-a", "habit-b"]); assert.strictEqual(storage.getItem("mf-habit-proposal"), staleReorderRaw); assert.strictEqual(c.p960GetHabitProposal().status, "pending"); assert.strictEqual(storage.getItem("day-2026-08-20"), staleHistoryRaw);

// Missing legacy evidence and same-Habit edits conflict without writes.
clear(); assert(c.p960ImportHabitProposal(proposal([{ action: "modify", habitId: "habit-a", fields: { description: "Fresh" } }])).valid); stored = JSON.parse(storage.getItem("mf-habit-proposal")); delete stored.changes[0].expectedHabitFingerprint; storage.setItem("mf-habit-proposal", JSON.stringify(stored)); const legacyRaw = storage.getItem("mf-habit-proposal"); assert(!c.p960ValidateHabitProposal(c.p960GetHabitProposal()).valid); c.mfHabitProposalDebug(); assert.strictEqual(storage.getItem("mf-habit-proposal"), legacyRaw);
clear(); assert(c.p960ImportHabitProposal(proposal([{ action: "modify", habitId: "habit-a", fields: { description: "Fresh" } }])).valid); changed = c.p960GetHabitStore(); changed.habits["habit-a"].description = "User edit"; c.p960SaveHabitStore(changed); storage.resetWrites(); conflict = c.p960ApplyHabitProposal(true); assert(!conflict.applied && conflict.conflicts.length && storage.writes.length === 0); assert.strictEqual(storage.getItem("day-2026-08-20"), history);

// Strict AI boundary.
function invalid(change, extra = {}) { clear(); return c.p960ImportHabitProposal(Object.assign(proposal([change]), extra)); }
assert(!invalid({ action: "modify", habitId: "habit-a", fields: { id: "habit-mutated" } }).valid);
assert(!invalid({ action: "modify", habitId: "habit-a", fields: { workout: true } }).valid);
assert(!invalid({ action: "modify", habitId: "habit-a", fields: { target: { type: "number", value: "72" } } }).valid);
assert(!invalid({ action: "modify", habitId: "habit-a", fields: { schedule: { type: "weekly_count", targetCount: 0, weekStartsOn: 0 } } }).valid);
assert(!invalid({ action: "modify", habitId: "habit-a", fields: { name: "x".repeat(101) } }).valid);
assert(!invalid({ action: "modify", habitId: "habit-a", fields: { icon: { unsafe: true } } }).valid);
assert(!invalid({ action: "archive", habitId: "habit-a", history: [] }).valid);
assert(!invalid({ action: "keep", habitId: "habit-a" }, { workouts: [] }).valid);
assert(!invalid({ action: "keep", habitId: "habit-a" }, { summary: { unsafe: true } }).valid);
assert(!invalid({ action: "add", habitId: "habit-a", definition: { id: "habit-a", name: "Duplicate", target: { type: "checkbox" }, schedule: { type: "daily" }, instructions: [] } }).valid);

// Pending ownership, rejection, apply audit, and unsafe Undo refusal.
clear(); assert(c.p960ImportHabitProposal(proposal([{ action: "keep", habitId: "habit-a" }])).valid); const owned = storage.getItem("mf-habit-proposal"); assert(!c.p960ImportHabitProposal(proposal([{ action: "keep", habitId: "habit-b" }])).valid); assert.strictEqual(storage.getItem("mf-habit-proposal"), owned); assert(c.p960DismissHabitProposal()); assert(c.p960ImportHabitProposal(proposal([{ action: "modify", habitId: "habit-a", fields: { name: "Applied" } }])).valid); assert(c.p960ApplyHabitProposal(true).applied); assert.strictEqual(c.p960GetHabitProposal().status, "applied"); const validUndoSnapshot = c.p960Clone(c.p960GetHabitProposal().undoSnapshot); changed = c.p960GetHabitStore(); changed.habits["habit-a"].name = "Later user edit"; c.p960SaveHabitStore(changed); storage.resetWrites(); const refused = c.p960UndoHabitProposal(true); assert(refused.conflict && storage.writes.length === 0);

// Undo mutation ownership requires applied status even when a snapshot is present.
["rejected", "pending"].forEach(status => { const guarded = c.p960GetHabitProposal(); guarded.status = status; guarded.undoSnapshot = c.p960Clone(validUndoSnapshot); storage.setItem("mf-habit-proposal", JSON.stringify(guarded)); storage.resetWrites(); const result = c.p960UndoHabitProposal(true); assert(!result.undone && /Only an applied/.test(result.errors[0])); assert.strictEqual(storage.writes.length, 0); }); const guardedUndone = c.p960GetHabitProposal(); guardedUndone.status = "undone"; guardedUndone.undoSnapshot = {}; storage.setItem("mf-habit-proposal", JSON.stringify(guardedUndone)); storage.resetWrites(); const undoneGuard = c.p960UndoHabitProposal(true); assert(!undoneGuard.undone && /Only an applied/.test(undoneGuard.errors[0])); assert.strictEqual(storage.writes.length, 0); guardedUndone.status = "rejected"; guardedUndone.undoSnapshot = null; storage.setItem("mf-habit-proposal", JSON.stringify(guardedUndone));

// Proposal overlay owns scrolling and restores body styles/page position.
c.scrollY = c.pageYOffset = 427; c.document.body.style.position = "relative"; c.document.body.style.top = "3px"; c.document.body.style.left = "4px"; c.document.body.style.right = "5px"; c.document.body.style.width = "95%"; c.document.body.style.overflow = "visible"; assert(c.p960OpenHabitProposalReview()); assert(c.document.body.classList.contains("mf-habit-proposal-open")); assert.strictEqual(c.document.body.style.top, "-427px"); c.p960CloseHabitProposalReview(); assert(!c.document.body.classList.contains("mf-habit-proposal-open")); assert.deepStrictEqual({ position: c.document.body.style.position, top: c.document.body.style.top, left: c.document.body.style.left, right: c.document.body.style.right, width: c.document.body.style.width, overflow: c.document.body.style.overflow }, { position: "relative", top: "3px", left: "4px", right: "5px", width: "95%", overflow: "visible" }); assert.strictEqual(c.scrollY, 427);

// Backup coverage and strict validation; missing optional keys remain valid.
assert(c.p8IsMarcusFitKey("mf-habit-definitions") && c.p8IsMarcusFitKey("mf-habit-proposal")); const backup = c.p8BuildBackup(); assert(c.p8ValidateBackup(JSON.stringify(backup))); const oldBackup = JSON.parse(JSON.stringify(backup)); delete oldBackup.data["mf-habit-definitions"]; delete oldBackup.data["mf-habit-proposal"]; assert(c.p8ValidateBackup(JSON.stringify(oldBackup)));
const malformedDefs = JSON.parse(JSON.stringify(backup)); malformedDefs.data["mf-habit-definitions"] = JSON.stringify({ schemaVersion: 1, habits: { "habit-x": { id: "wrong" } }, order: ["habit-x"] }); assert.throws(() => c.p8ValidateBackup(JSON.stringify(malformedDefs)), /Habit definition/);
const malformedProposal = JSON.parse(JSON.stringify(backup)); malformedProposal.data["mf-habit-proposal"] = JSON.stringify({ schemaVersion: 1, status: "pending", proposalId: "habit-proposal-bad", summary: "Bad", changes: [{ action: "modify", habitId: "habit-a", fields: { history: [] }, expectedHabitFingerprint: 42 }] }); assert.throws(() => c.p8ValidateBackup(JSON.stringify(malformedProposal)), /fingerprint|malformed/i);

// Direct self-test restores every touched storage byte-for-byte.
const snapshot = JSON.stringify([...Object.keys(storage)].sort().map(key => [key, storage.getItem(key)])); const self = c.mf960RunHabitSelfTest(); assert(self.pass && self.storageExactlyRestored); assert.strictEqual(JSON.stringify([...Object.keys(storage)].sort().map(key => [key, storage.getItem(key)])), snapshot);

// The accepted Basketball regression owns the seven mixed-Sync combinations,
// preflight rejection, grouped proposal rollback, and sole core applySync authority.
const mixedRegression = execFileSync(process.execPath, [path.join(root, "tests/marcusfit-10.3.0-basketball-ai-sync.test.js")], { encoding: "utf8" });
assert(mixedRegression.includes("MarcusFit 10.3.0 basketball AI Sync: PASS"));

console.log("MarcusFit 10.4.0 Habit AI Sync safety: PASS");
