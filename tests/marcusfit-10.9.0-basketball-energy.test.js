const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const basketballSource = read("assets/js/features/22-basketball.js");
const workoutSource = read("assets/js/features/10-workout-logging.js");
const historySource = read("assets/js/features/14-history.js");
const html = read("index.html");
const css = read("assets/css/marcusfit.css");
const canonicalTextSha = text => crypto.createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
const canonicalSha = relative => canonicalTextSha(read(relative));

function createStorage(initial = {}) {
  const storage = {};
  Object.entries(initial).forEach(([key, value]) => { storage[key] = String(value); });
  Object.defineProperties(storage, {
    getItem: { enumerable: false, value(key) { return Object.prototype.hasOwnProperty.call(this, key) ? this[key] : null; } },
    setItem: { enumerable: false, value(key, value) { this[key] = String(value); } },
    removeItem: { enumerable: false, value(key) { delete this[key]; } },
    snapshot: { enumerable: false, value() { return Object.fromEntries(Object.keys(this).sort().map(key => [key, this[key]])); } }
  });
  return storage;
}

function createContext(initial = {}) {
  const localStorage = createStorage(initial), elements = new Map();
  const descendants = node => (node.children || []).flatMap(child => child && typeof child === "object" ? [child, ...descendants(child)] : []);
  const selectAll = (node, selector) => descendants(node).filter(child => {
    if (selector === ".mf-basketball-drill-card") return String(child.className || "").split(/\s+/).includes("mf-basketball-drill-card");
    const field = selector.match(/^\[data-field='([^']+)'\]$/); return field ? child.dataset && child.dataset.field === field[1] : false;
  });
  const element = id => {
    if (!elements.has(id)) elements.set(id, { id, value: "", textContent: "", hidden: false, disabled: false, open: false, style: {}, dataset: {}, children: [], className: "", classList: { add() {}, remove() {}, contains() { return false; } }, addEventListener() {}, append(...items) { this.children.push(...items); }, appendChild(item) { this.children.push(item); return item; }, replaceChildren(...items) { this.children = items; }, setAttribute() {}, focus() {}, blur() {}, scrollIntoView() {}, querySelector(selector) { return selectAll(this, selector)[0] || null; }, querySelectorAll(selector) { return selectAll(this, selector); } });
    return elements.get(id);
  };
  const context = { console, localStorage, APP_VERSION: "10.9.0", tDate: new Date(2026, 8, 11, 12), process: { versions: { node: "test" } }, crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000109" },
    document: { activeElement: null, getElementById: element, createElement() { return element(`generated-${elements.size}`); }, createTextNode(value) { return String(value); }, querySelectorAll() { return []; }, body: { style: {}, classList: { add() {}, remove() {} } }, documentElement: {}, addEventListener() {} },
    p8IsMarcusFitKey(key) { return key.startsWith("day-"); }, p8492SummarizeBackup() { return { warnings: [], unknownKeyCount: 0 }; }, p8492FormatSummaryLines() { return ["Approx size: 1 KB"]; }, p8ValidateBackup(raw) { return JSON.parse(raw); }, p7ApplyFilters() {}, p7RenderAnalytics() {}, p7CalcAnalytics() { return { range: { start: null, end: null }, trainingLoad: {} }; }, showScreen() {}, genExport() {}, updateTrackerDate() {}, getExportDkeys() { return []; }, setTimeout(fn) { fn(); }, clearTimeout() {}, window: null };
  context.window = context; vm.createContext(context); vm.runInContext(basketballSource, context); Object.assign(context, context.__mfBasketballTest); return { c: context, storage: localStorage };
}

const { c, storage } = createContext();
const workoutInput = { value: "", validationMessage: "", reported: false, setCustomValidity(value) { this.validationMessage = value; }, reportValidity() { this.reported = true; } };
const workoutTestContext = { document: { getElementById(id) { return id === "mfWorkoutActiveCalories" ? workoutInput : null; } } };
const workoutReadMatch = workoutSource.match(/(function mfWorkoutReadActiveCalories[\s\S]*?\r?\n})\r?\n\r?\nfunction renderWoExercises/);
assert(workoutReadMatch, "lifting calorie validator was not found");
vm.createContext(workoutTestContext); vm.runInContext(`${workoutReadMatch[1]};this.readActiveCalories=mfWorkoutReadActiveCalories;`, workoutTestContext);
for (const [raw, ok, value] of [["", true, null], ["0", true, 0], ["375", true, 375], ["-1", false, null], ["100.5", false, null], ["1e3", false, null], ["NaN", false, null], ["5001", false, null]]) {
  workoutInput.value = raw; workoutInput.reported = false; const result = workoutTestContext.readActiveCalories(true); assert.strictEqual(result.ok, ok, `lifting calories validation mismatch for ${raw}`); assert.strictEqual(result.value, value); if (!ok) assert(workoutInput.reported);
}
const baseDrills = c.mfBasketballPrograms.flatMap(program => program.sessions.flatMap(session => session.drills));
const ids = baseDrills.map(drill => drill.id);
assert.strictEqual(ids.length, 38);
assert.strictEqual(new Set(ids).size, 38);
assert(Object.isFrozen(c.mfBasketballPrograms) && Object.isFrozen(c.mfBasketballPrograms[0].sessions[0].drills[0]));
assert.strictEqual(JSON.stringify(Object.keys(c.mfBasketballPrescriptions).sort()), JSON.stringify(Array.from(ids).sort()));

const prescriptionFields = ["doNow", "workRest", "success", "setup", "instructions", "easier", "harder", "why"];
function prescribedWorkloadMinutes(text) {
  let match = text.match(/^(\d+) rounds of (\d+) sec work with (\d+) sec rest, including the final reset; total block: (\d+) min\.$/);
  if (match) return { calculated: Number(match[1]) * (Number(match[2]) + Number(match[3])) / 60, declared: Number(match[4]) };
  match = text.match(/^(\d+) stations of (\d+) sec work with (\d+) sec transition, including the final reset; complete (\d+) circuits; total block: (\d+) min\.$/);
  if (match) return { calculated: Number(match[1]) * (Number(match[2]) + Number(match[3])) * Number(match[4]) / 60, declared: Number(match[5]) };
  return null;
}
c.mfBasketballPrograms.forEach(program => {
  const resolved = c.mfBasketballGetResolvedProgram(program.id, program.version);
  resolved.sessions.forEach(session => session.drills.forEach(drill => {
    assert.strictEqual(drill.id, baseDrills.find(item => item.id === drill.id).id);
    assert.strictEqual(drill.trackingMode, baseDrills.find(item => item.id === drill.id).trackingMode);
    const prescription = c.mfBasketballPrescriptionFor(drill);
    prescriptionFields.forEach(field => assert(prescription[field] && prescription[field].length <= 600, `${drill.id} missing ${field}`));
    assert(prescription.cues.length >= 1 && prescription.cues.length <= 2);
    const target = drill.target || {};
    if (["duration", "confidence"].includes(drill.trackingMode) && target.durationMinutes) {
      const workload = prescribedWorkloadMinutes(prescription.workRest);
      assert(workload, `${drill.id} lacks an auditable duration workload`);
      assert.strictEqual(workload.calculated, target.durationMinutes, `${drill.id} work/rest contradicts its duration target`);
      assert.strictEqual(workload.declared, target.durationMinutes, `${drill.id} declared block contradicts its duration target`);
    } else if (drill.trackingMode === "makes_target") assert(new RegExp(`\\b${target.makes}\\b`).test(prescription.doNow), `${drill.id} makes prescription contradicts its target`);
    else if (drill.trackingMode === "count") assert(new RegExp(`\\b${target.count}\\b`).test(prescription.doNow), `${drill.id} count prescription contradicts its target`);
    else if (drill.trackingMode === "benchmark_shooting") assert(new RegExp(`\\b${target.attempts}\\b`).test(prescription.doNow), `${drill.id} benchmark prescription contradicts its target`);
  }));
});

const reconciledOverrides = { schemaVersion: 1, updatedAt: "2026-09-11T12:00:00.000Z", programs: {
  basketball_fundamentals_3_session: { baseVersion: 1, sessions: {
    fundamentals_a_handle_weak_hand: { modified: {
      fundamentals_weak_hand_finishing: { target: { makes: 20 }, source: "ai_proposal", proposalId: "test" },
      fundamentals_crossover_control: { target: { durationMinutes: 10 }, source: "ai_proposal", proposalId: "test" },
      fundamentals_ft_benchmark: { target: { attempts: 30, minAttempts: 15 }, source: "ai_proposal", proposalId: "test" }
    }, added: {}, disabled: {} },
    fundamentals_c_mixed_conditioning: { modified: {
      fundamentals_finishing_challenge: { target: { count: 24 }, source: "ai_proposal", proposalId: "test" }
    }, added: {}, disabled: {} }
  } }
} };
const reconciledProgram = c.mfBasketballGetResolvedProgram("basketball_fundamentals_3_session", 1, reconciledOverrides);
const reconciledDrills = reconciledProgram.sessions.flatMap(session => session.drills);
for (const [id, value, stale] of [["fundamentals_weak_hand_finishing", 20, 15], ["fundamentals_crossover_control", 10, 6], ["fundamentals_finishing_challenge", 24, 20], ["fundamentals_ft_benchmark", 30, 20]]) {
  const prescription = c.mfBasketballPrescriptionFor(reconciledDrills.find(drill => drill.id === id));
  assert(Object.values(prescription).flat().some(text => new RegExp(`\\b${value}\\b`).test(String(text))), `${id} omitted its effective target`);
  assert(!new RegExp(`displayed target of ${stale}\\b`).test(prescription.doNow), `${id} retained its stale target`);
}
assert.strictEqual(c.mfBasketballPrescriptionFor({ id: "bball-ai-safe-custom-v1", name: "Custom Drill", trackingMode: "count", target: { count: 12 } }), null, "custom drill invented catalog coaching");

const proposalEnv = createContext(), pc = proposalEnv.c, proposalStorage = proposalEnv.storage;
const proposalProgramId = "basketball_fundamentals_3_session", proposalSessionId = "fundamentals_a_handle_weak_hand", proposalDrillId = "fundamentals_weak_hand_finishing";
function targetProposal(id, makes) { return { schemaVersion: 1, proposalVersion: 1, proposalId: id, summary: `Set finishing target to ${makes}`, rationale: "Target-aware prescription regression.", changes: [{ action: "modify_drill", programId: proposalProgramId, programVersion: 1, sessionId: proposalSessionId, drillId: proposalDrillId, fields: { target: { makes } } }] }; }
function futureFinishing() { return pc.mfBasketballGetResolvedProgram(proposalProgramId, 1).sessions[0].drills.find(drill => drill.id === proposalDrillId); }
assert(pc.mfBasketballSelectProgram(proposalProgramId, "2026-09-11T11:59:00.000Z").ok);
assert(pc.mfBasketballImportProposal(targetProposal("bball-proposal-109-pending", 20), "2026-09-11T12:00:00.000Z").valid);
assert(pc.mfBasketballPrescriptionFor(futureFinishing()).doNow.includes("15"), "unfinished proposal changed future prescription");
assert(pc.mfBasketballRejectProposal("2026-09-11T12:01:00.000Z"));
assert(pc.mfBasketballPrescriptionFor(futureFinishing()).doNow.includes("15"), "rejected proposal changed future prescription");
assert(pc.mfBasketballImportProposal(targetProposal("bball-proposal-109-apply", 20), "2026-09-11T12:02:00.000Z").valid);
assert(pc.mfBasketballApplyProposal(true, "2026-09-11T12:03:00.000Z").applied);
let futurePrescription = pc.mfBasketballPrescriptionFor(futureFinishing());
assert.strictEqual(futureFinishing().target.makes, 20);
assert(futurePrescription.doNow.includes("20") && !futurePrescription.doNow.includes("15"));
pc.mfBasketballRenderProgramSurface();
function renderedText(node) { return !node || typeof node !== "object" ? String(node || "") : [node.textContent || "", ...(node.children || []).map(renderedText)].join(" "); }
const nextSessionText = renderedText(pc.document.getElementById("mfBasketballNextSession"));
assert(nextSessionText.includes("Weak-Hand Finishing") && nextSessionText.includes("Make 20") && nextSessionText.includes("Complete 20 made shots"), "next-session target and prescription disagree");
assert(pc.mfBasketballUndoProposal(true, "2026-09-11T12:05:00.000Z").undone);
assert.strictEqual(futureFinishing().target.makes, 15);
assert(pc.mfBasketballPrescriptionFor(futureFinishing()).doNow.includes("15"), "Undo did not restore future standard prescription");

assert(pc.mfBasketballImportProposal(targetProposal("bball-proposal-109-snapshot", 20), "2026-09-11T12:06:00.000Z").valid);
assert(pc.mfBasketballApplyProposal(true, "2026-09-11T12:07:00.000Z").applied);
let proposalProgram = pc.mfBasketballGetResolvedProgram(proposalProgramId, 1), proposalPlanned = proposalProgram.sessions[0];
let proposalBuilt = pc.mfBasketballBuildStructuredInput({ id: "bball-target-aware-snapshot", programId: proposalProgramId, programVersion: 1, plannedSessionId: proposalSessionId, date: "2026-09-11", minutes: 30, drills: [{ drillId: proposalDrillId, actualResult: { makes: 20 }, confidence: 7 }] });
assert(proposalBuilt.ok);
const finishingSnapshot = proposalBuilt.input.drills.find(drill => drill.drillId === proposalDrillId).prescriptionSnapshot;
assert(finishingSnapshot.doNow.includes("20") && !finishingSnapshot.doNow.includes("15"), "save snapshot disagrees with effective target");
assert(pc.mfBasketballSaveSession(proposalBuilt.input, { id: "bball-target-aware-snapshot", now: "2026-09-11T12:08:00.000Z" }).ok);
const historyBeforeLaterProposal = proposalStorage.getItem("mf-basketball-sessions");
assert(pc.mfBasketballImportProposal(targetProposal("bball-proposal-109-later", 25), "2026-09-11T12:09:00.000Z").valid);
assert(pc.mfBasketballApplyProposal(true, "2026-09-11T12:10:00.000Z").applied);
assert.strictEqual(futureFinishing().target.makes, 25);
assert(pc.mfBasketballPrescriptionFor(futureFinishing()).doNow.includes("25"));
assert.strictEqual(proposalStorage.getItem("mf-basketball-sessions"), historyBeforeLaterProposal, "later proposal rewrote performed snapshot");
assert(pc.mfBasketballUndoProposal(true, "2026-09-11T12:11:00.000Z").undone);
assert.strictEqual(futureFinishing().target.makes, 20);
assert(pc.mfBasketballPrescriptionFor(futureFinishing()).doNow.includes("20"));
const proposalExport = pc.mfBasketballBuildExport("full", pc.mfBasketballReadStore().sessions, pc.mfBasketballReadProgramState());
assert(proposalExport.includes("Planned/resolved prescription — Do now:"));
assert(proposalExport.includes("Historical performed prescription — Do now:"));
assert(proposalExport.includes("Work/rest:") && proposalExport.includes("Cues:") && proposalExport.includes("Success:"));

const program = c.mfBasketballGetResolvedProgram("basketball_fundamentals_3_session", 1), planned = program.sessions[0], first = planned.drills[0], firstPrescription = c.mfBasketballPrescriptionFor(first);
function payload(activeCalories) { return { id: "bball-109-session", programId: program.id, programVersion: program.version, plannedSessionId: planned.id, date: "2026-09-10", minutes: 40, activeCalories, drills: [{ drillId: first.id, actualResult: { durationMinutes: 5 }, confidence: 7 }] }; }

let built = c.mfBasketballBuildStructuredInput(payload("321"));
assert(built.ok);
assert.deepStrictEqual(JSON.parse(JSON.stringify(built.input.drills[0].prescriptionSnapshot)), JSON.parse(JSON.stringify(firstPrescription)));
let saved = c.mfBasketballSaveSession(built.input, { id: "bball-109-session", now: "2026-09-10T18:00:00.000Z" });
assert(saved.ok && saved.session.activeCalories === 321);
assert(saved.session.drills[0].prescriptionSnapshot.doNow.includes("Pound"));

const storedSnapshot = JSON.parse(storage.getItem("mf-basketball-sessions")).sessions[0].drills[0].prescriptionSnapshot.doNow;
first.name = "changed resolved copy";
assert.strictEqual(JSON.parse(storage.getItem("mf-basketball-sessions")).sessions[0].drills[0].prescriptionSnapshot.doNow, storedSnapshot, "resolved template copy rewrote history");

const oldStructured = JSON.parse(storage.getItem("mf-basketball-sessions")).sessions[0];
oldStructured.id = "bball-old-structured"; oldStructured.drills.forEach(drill => delete drill.prescriptionSnapshot); delete oldStructured.activeCalories;
assert(c.mfBasketballNormalizeSession(oldStructured, { stored: true }).ok, "old structured snapshot became unreadable");
const freeForm = { id: "bball-old-freeform", schemaVersion: 1, date: "2026-09-01", type: "shooting", minutes: 30, createdAt: "2026-09-01T12:00:00.000Z", updatedAt: "2026-09-01T12:00:00.000Z" };
assert(c.mfBasketballNormalizeSession(freeForm, { stored: true }).ok, "legacy free-form session became unreadable");
assert(c.mfBasketballNormalizeSession({ ...freeForm, activeCalories: "legacy-unknown-value" }, { stored: true }).ok, "legacy free-form unknown fields stopped being ignored");

for (const invalid of ["-1", "100.5", "1e3", "NaN", Infinity, 5001]) assert(!c.mfBasketballBuildStructuredInput(payload(invalid)).ok, `accepted invalid calories ${invalid}`);
assert(c.mfBasketballBuildStructuredInput(payload("")).ok);
assert.strictEqual(c.mfBasketballBuildStructuredInput(payload("0")).input.activeCalories, "0");

built = c.mfBasketballBuildStructuredInput(payload("410"));
saved = c.mfBasketballSaveSession(built.input, { existingId: "bball-109-session", now: "2026-09-11T18:00:00.000Z" });
assert(saved.ok && saved.session.id === "bball-109-session" && saved.session.createdAt === "2026-09-10T18:00:00.000Z" && saved.session.activeCalories === 410);
built = c.mfBasketballBuildStructuredInput(payload(""));
saved = c.mfBasketballSaveSession(built.input, { existingId: "bball-109-session", now: "2026-09-11T19:00:00.000Z" });
assert(saved.ok && !Object.prototype.hasOwnProperty.call(saved.session, "activeCalories"), "clearing calories did not remove only the optional value");
assert.strictEqual(JSON.parse(storage.getItem("mf-basketball-sessions")).sessions.filter(session => session.id === "bball-109-session").length, 1);

storage.setItem("day-2026-09-08-wo", JSON.stringify({ gym: "home", dayIdx: "0", exercises: { lift: { sets: [{ reps: "8" }] } }, activeCalories: 300 }));
storage.setItem("day-2026-09-09-wo", JSON.stringify({ gym: "home", dayIdx: "1", exercises: { lift: { sets: [{ reps: "8" }] } } }));
const basketballWithCalories = c.mfBasketballNormalizeSession({ ...JSON.parse(storage.getItem("mf-basketball-sessions")).sessions[0], activeCalories: 200 }, { stored: true }).session;
const beforeDerived = storage.snapshot(), totals = c.mfBasketballCollectActiveCalories({ start: "2026-09-01", end: "2026-09-30" }, [basketballWithCalories]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(totals)), { total: 500, average: 250, recorded: 2, supported: 3, liftingTotal: 300, liftingRecorded: 1, basketballTotal: 200, basketballRecorded: 1 });
assert.deepStrictEqual(storage.snapshot(), beforeDerived, "derived analytics wrote storage");
assert.strictEqual(c.mfBasketballCollectActiveCalories({ start: "2026-09-09", end: "2026-09-09" }, []).total, 0, "date range included outside calories");

const exportText = c.mfBasketballBuildExport("full", [basketballWithCalories], c.mfBasketballReadProgramState());
assert(exportText.includes("optional user-entered watch/wearable estimates"));
assert(exportText.includes("Coverage: 2 of 3 supported sessions"));
assert(exportText.includes("Lifting: 300 active kcal"));
assert(exportText.includes("Basketball: 200 active kcal"));
assert(!/eat back|precise calorie deficit|increase.*target/i.test(exportText));
assert.deepStrictEqual(storage.snapshot(), beforeDerived, "AI Export wrote historical calories");

assert(html.includes('id="mfWorkoutActiveCalories" type="number" min="0" max="5000" step="1" inputmode="numeric"'));
assert(html.includes('id="mfBasketballStructuredActiveCalories" type="number" min="0" max="5000" step="1" inputmode="numeric"'));
assert(workoutSource.includes("workout.activeCalories=energy.value"));
assert(workoutSource.includes("/^\\d+$/.test(raw)"));
assert(workoutSource.includes('localStorage.setItem(dKey(tDate)+"-wo",JSON.stringify(woData))'), "lifting save no longer replaces the same date key");
assert(historySource.includes("active kcal est."));
assert(css.includes(".mf-basketball-do-now") && css.includes(".mf-basketball-howto summary{min-height:44px"));
assert(basketballSource.includes('summary.setAttribute("aria-controls",body.id)') && basketballSource.includes('summary.setAttribute("aria-expanded","false")'));
assert.strictEqual((html.match(/<script\s+src="[^"]+"\s+defer><\/script>/g) || []).length, 22);
assert.strictEqual(canonicalSha("assets/js/sync/12-ai-sync.js"), "14245321c8f47de5c152d011a08877ef4821e353c15bc3ed72c0490aa767c598", "Core Sync canonical LF hash changed");
assert.strictEqual(canonicalTextSha(read("assets/js/sync/12-ai-sync.js").replace(/\r?\n/g, "\r\n")), canonicalSha("assets/js/sync/12-ai-sync.js"), "Core Sync invariant is line-ending dependent");
assert(!/function\s+applySync\s*\(/.test(basketballSource));
assert.strictEqual((basketballSource.match(/const MF_BASKETBALL_\w+_KEY/g) || []).length, 4);

console.log("MarcusFit 10.9.0 basketball coaching/session energy: PASS");
