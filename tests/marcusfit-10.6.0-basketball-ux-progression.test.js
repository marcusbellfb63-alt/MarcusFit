const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const source = read("assets/js/features/22-basketball.js");
const html = read("index.html");
const css = read("assets/css/marcusfit.css");
const constants = read("assets/js/core/01-app-constants.js");
const sha = value => crypto.createHash("sha256").update(Buffer.from(value.toString("utf8").replace(/\r\n/g, "\n"))).digest("hex");

assert(constants.includes('const APP_VERSION = "10.8.0";'));
const scripts = [...html.matchAll(/<script\s+src="([^"]+)"\s+defer><\/script>/g)].map(match => match[1]);
assert.strictEqual(scripts.length, 22);
assert.deepStrictEqual(scripts, JSON.parse(read("tests/fixtures/runtime-script-order.json")));
assert.strictEqual(sha(fs.readFileSync(path.join(root, "Releases/MarcusFit9_6_0.html"))), "f710c497cc6af212f6827f36461c000e655c66cba151392082ffffe55f14a160");
assert.strictEqual(sha(fs.readFileSync(path.join(root, "assets/js/sync/12-ai-sync.js"))), "14245321c8f47de5c152d011a08877ef4821e353c15bc3ed72c0490aa767c598");
const inventory = JSON.parse(execFileSync(process.execPath, [path.join(root, "tools/architecture/inventory-runtime.js")], { encoding: "utf8" }));
assert.strictEqual(inventory.protectedInvariants.programSha256, "652a04c37928f232490d37ce7e709dc16a25a8c5f408d679bce046b2f6a2d7d4");
assert.strictEqual(inventory.protectedInvariants.exerciseIdCount, 63);
assert.strictEqual(inventory.protectedInvariants.exerciseIdSha256, "7c333a9b7fb4639cafd0900a96f1d4ba58b8d6b8fb5ecc23f335e7ee041d0e2b");

function createStorage(initial = {}) {
  const memory = new Map(Object.entries(initial));
  return { getItem(key) { return memory.has(key) ? memory.get(key) : null; }, setItem(key, value) { memory.set(key, String(value)); }, removeItem(key) { memory.delete(key); }, snapshot() { return Object.fromEntries(memory); } };
}

function createContext() {
  const localStorage = createStorage(), elements = new Map();
  const descendants = node => (node.children || []).flatMap(child => child && typeof child === "object" ? [child, ...descendants(child)] : []);
  const selectAll = (node, selector) => descendants(node).filter(child => {
    if (selector === ".mf-basketball-drill-card") return String(child.className || "").split(/\s+/).includes("mf-basketball-drill-card");
    const field = selector.match(/^\[data-field='([^']+)'\]$/); return field ? child.dataset && child.dataset.field === field[1] : false;
  });
  const element = id => {
    if (!elements.has(id)) elements.set(id, { id, value: "", textContent: "", hidden: false, disabled: false, style: {}, dataset: {}, children: [], className: "", classList: { add() {}, remove() {}, contains() { return false; } }, addEventListener() {}, append(...items) { this.children.push(...items); }, appendChild(item) { this.children.push(item); return item; }, replaceChildren(...items) { this.children = items; }, setAttribute() {}, focus() {}, blur() {}, scrollIntoView() {}, querySelector(selector) { return selectAll(this, selector)[0] || null; }, querySelectorAll(selector) { return selectAll(this, selector); } });
    return elements.get(id);
  };
  const context = { console, localStorage, APP_VERSION: "10.6.0", tDate: new Date(2026, 7, 31, 12), process: { versions: { node: "test" } }, crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
    document: { activeElement: null, getElementById: element, createElement() { return element(`generated-${elements.size}`); }, createTextNode(value) { return String(value); }, querySelectorAll() { return []; }, body: { classList: { add() {}, remove() {} } }, addEventListener() {} },
    p8IsMarcusFitKey(key) { return key.startsWith("day-"); }, p8492SummarizeBackup(value) { const backup = typeof value === "string" ? JSON.parse(value) : value; return { warnings: [], unknownKeyCount: Object.keys((backup && backup.data) || {}).length }; }, p8492FormatSummaryLines() { return ["Approx size: 1 KB"]; }, p8ValidateBackup(raw) { return JSON.parse(raw); }, p7ApplyFilters() {}, p7RenderAnalytics() {}, showScreen() {}, genExport() {}, updateTrackerDate() {}, getExportDkeys() { return []; }, setTimeout(fn) { fn(); }, clearTimeout() {} };
  const instrumentedSource = source.replace("function mfBasketballInit(){", "window.__mfBasketballSummaryTest={mfBasketballOpenStructuredLogger:mfBasketballOpenStructuredLogger,mfBasketballUpdateStructuredSummary:mfBasketballUpdateStructuredSummary};\nfunction mfBasketballInit(){");
  context.window = context; vm.createContext(context); vm.runInContext(instrumentedSource, context); Object.assign(context, context.__mfBasketballTest, context.__mfBasketballSummaryTest); return { c: context, storage: localStorage };
}

const { c, storage } = createContext();
const identity = { programId: "basketball_fundamentals_3_session", programVersion: 1, plannedSessionId: "fundamentals_a_handle_weak_hand" };
function session(id, date, drill, overrides = {}) { return { id, schemaVersion: 1, date, type: "basketball_workout", minutes: 30, createdAt: `${date}T12:00:00.000Z`, updatedAt: `${date}T12:00:00.000Z`, programId: identity.programId, programVersion: 1, programNameSnapshot: "Basketball Fundamentals — 3 Session", plannedSessionId: identity.plannedSessionId, plannedSessionNameSnapshot: "Session A — Handle + Weak Hand", drills: [drill], ...overrides }; }
function drill(id, mode, target, actual, confidence) { const value = { drillId: id, nameSnapshot: "Comparable Drill", trackingMode: mode, plannedTargetSnapshot: target, actualResult: actual }; if (confidence != null) value.confidence = confidence; return value; }

let result = c.mfBasketballProgressionForDrill("duration_drill", [session("bball-a01", "2026-08-01", drill("duration_drill", "duration", { durationMinutes: 5 }, { durationMinutes: 5 }))], { trackingMode: "duration" }, { ...identity, trackingMode: "duration" });
assert.strictEqual(result.status, "target_met");
result = c.mfBasketballProgressionForDrill("duration_drill", [session("bball-a01", "2026-08-01", drill("duration_drill", "duration", { durationMinutes: 5 }, { durationMinutes: 4 })), session("bball-a02", "2026-08-02", drill("duration_drill", "duration", { durationMinutes: 5 }, { durationMinutes: 6 }))], { trackingMode: "duration" }, { ...identity, trackingMode: "duration" });
assert.strictEqual(result.status, "improving");

result = c.mfBasketballProgressionForDrill("confidence_drill", [6, 7, 8].map((value, index) => session(`bball-c0${index + 1}`, `2026-08-0${index + 1}`, drill("confidence_drill", "confidence", { durationMinutes: 6 }, { durationMinutes: 6 }, value))), { trackingMode: "confidence" }, { ...identity, trackingMode: "confidence" });
assert.strictEqual(result.status, "confidence_improved");

result = c.mfBasketballProgressionForDrill("makes_drill", [12, 15, 15].map((value, index) => session(`bball-m0${index + 1}`, `2026-08-0${index + 1}`, drill("makes_drill", "makes_target", { makes: 15 }, { makes: value }))), { trackingMode: "makes_target" }, { ...identity, trackingMode: "makes_target" });
assert.strictEqual(result.status, "improving"); assert.strictEqual(result.ready, false, "not all three results met the target");
result = c.mfBasketballProgressionForDrill("makes_drill", [15, 15, 15].map((value, index) => session(`bball-t0${index + 1}`, `2026-08-0${index + 1}`, drill("makes_drill", "makes_target", { makes: 15 }, { makes: value }))), { trackingMode: "makes_target" }, { ...identity, trackingMode: "makes_target" });
assert.strictEqual(result.status, "target_met"); assert.strictEqual(result.ready, true);

result = c.mfBasketballProgressionForDrill("benchmark_drill", [session("bball-b01", "2026-08-01", drill("benchmark_drill", "benchmark_shooting", { attempts: 20, minAttempts: 10 }, { made: 9, attempted: 20, percentage: 45 })), session("bball-b02", "2026-08-02", drill("benchmark_drill", "benchmark_shooting", { attempts: 20, minAttempts: 10 }, { made: 12, attempted: 20, percentage: 60 }))], { trackingMode: "benchmark_shooting" }, { ...identity, trackingMode: "benchmark_shooting" });
assert.strictEqual(result.label, "BENCHMARK IMPROVED"); assert(result.guidance.includes("same attempts"));

result = c.mfBasketballProgressionForDrill("benchmark_drill", [session("bball-b03", "2026-08-03", drill("benchmark_drill", "benchmark_shooting", { attempts: 20, minAttempts: 10 }, { made: 1, attempted: 2, percentage: 50 }))], { trackingMode: "benchmark_shooting" }, { ...identity, trackingMode: "benchmark_shooting" });
assert.strictEqual(result.status, "small_sample");

const incompatible = [session("bball-i01", "2026-08-01", drill("shared_drill", "duration", { durationMinutes: 5 }, { durationMinutes: 5 })), session("bball-i02", "2026-08-02", drill("shared_drill", "makes_target", { makes: 15 }, { makes: 15 }))];
result = c.mfBasketballProgressionForDrill("shared_drill", incompatible, { trackingMode: "duration" }, { ...identity, trackingMode: "duration" });
assert.strictEqual(result.exposures.length, 1, "incompatible metric was compared");
const wrongSession = session("bball-i03", "2026-08-03", drill("shared_drill", "duration", { durationMinutes: 5 }, { durationMinutes: 8 }), { plannedSessionId: "fundamentals_b_shooting" });
result = c.mfBasketballProgressionForDrill("shared_drill", [...incompatible, wrongSession], { trackingMode: "duration" }, { ...identity, trackingMode: "duration" });
assert.strictEqual(result.exposures.length, 1, "different planned-session identity was compared");

assert.deepStrictEqual(JSON.parse(JSON.stringify(c.mfBasketballSessionPlannedMinutes({ drills: [{ target: { durationMinutes: 5 } }, { target: { makes: 10 } }] }))), { minutes: 5, label: "5+ planned min", partial: true });
assert.strictEqual(c.mfBasketballTrackingLabel("benchmark_shooting"), "Shooting benchmark");

const summaryProgram = { id: identity.programId, version: 1, name: "Summary Test" };
const summaryPlanned = { id: identity.plannedSessionId, name: "Summary Test Session", drills: [{ id: "summary_duration", name: "Timed Handle", trackingMode: "duration", target: { durationMinutes: 5 } }] };
c.mfBasketballOpenStructuredLogger(summaryProgram, summaryPlanned, null);
c.document.getElementById("mfBasketballDrillLogger").querySelector("[data-field='durationMinutes']").value = "5";
assert.doesNotThrow(() => c.mfBasketballUpdateStructuredSummary(), "attempted drill summary threw");
assert(c.document.getElementById("mfBasketballSessionSummary").children.some(child => child.textContent === "Timed Handle: 5 min"));

assert(c.mfBasketballSelectProgram(identity.programId, "2026-08-20T10:00:00.000Z").ok); const queue0 = storage.getItem("mf-basketball-program-state");
c.mfBasketballRenderProgramSurface(); c.mfBasketballRenderHistory(); assert.strictEqual(storage.getItem("mf-basketball-program-state"), queue0, "view/history advanced queue");
const planned = c.mfBasketballPrograms[0].sessions[0], payload = { id: "bball-finish-once", programId: identity.programId, programVersion: 1, plannedSessionId: planned.id, date: "2026-08-20", minutes: 30, drills: [{ drillId: planned.drills[0].id, actualResult: { durationMinutes: 5 }, confidence: 7 }] };
assert.strictEqual(c.mfBasketballFinishStructuredSession(payload, "advance").advanced, true); const queue1 = storage.getItem("mf-basketball-program-state");
assert.strictEqual(c.mfBasketballFinishStructuredSession(payload, "advance").ok, false); assert.strictEqual(storage.getItem("mf-basketball-program-state"), queue1, "reload/retry double-advanced queue");

const savedHistory = storage.getItem("mf-basketball-sessions"), skipped = drill("neutral_skip", "duration", { durationMinutes: 5 }, null); delete skipped.actualResult; skipped.skipped = true;
assert.strictEqual(c.mfBasketballProgressionForDrill("neutral_skip", [session("bball-s01", "2026-08-21", skipped)], { trackingMode: "duration" }, { ...identity, trackingMode: "duration" }).exposures.length, 0);
assert.strictEqual(storage.getItem("mf-basketball-sessions"), savedHistory, "derived progression rewrote history");

// Historical export progression is bounded to evidence knowable at each row.
const exportHistory = [5, 6, 8].map((value, index) => session(`bball-e0${index + 1}`, `2026-08-0${index + 1}`, drill("fundamentals_crossover_control", "confidence", { durationMinutes: 6 }, { durationMinutes: 6 }, value)));
const storageBeforeExport = storage.snapshot();
const boundedExport = c.mfBasketballBuildExport("full", exportHistory, c.mfBasketballReadProgramState());
assert.deepStrictEqual(storage.snapshot(), storageBeforeExport, "Basketball export wrote storage/history");
function historicalRow(text, date, nextDate) { const start = text.indexOf(`- ${date} |`), end = nextDate ? text.indexOf(`- ${nextDate} |`, start) : text.indexOf("Coaching guidance:", start); assert(start >= 0 && end > start); return text.slice(start, end); }
const oldestRow = historicalRow(boundedExport, "2026-08-01", "2026-08-02"), middleRow = historicalRow(boundedExport, "2026-08-02", "2026-08-03"), newestRow = historicalRow(boundedExport, "2026-08-03");
assert(oldestRow.includes("FIRST RESULT"), "oldest row did not remain first-result evidence");
assert(!oldestRow.includes("CONFIDENCE IMPROVED"), "future results changed the oldest historical label");
assert(middleRow.includes("BUILDING CONSISTENCY"), "middle row did not use its earlier evidence");
assert(newestRow.includes("CONFIDENCE IMPROVED"), "later row could not use prior evidence");
const oldestOnlyExport = c.mfBasketballBuildExport("full", exportHistory.slice(0, 1), c.mfBasketballReadProgramState());
assert(historicalRow(oldestOnlyExport, "2026-08-01").includes("FIRST RESULT"));
assert(historicalRow(boundedExport, "2026-08-01", "2026-08-02").includes("FIRST RESULT"), "adding later evidence altered the oldest exported progression label");
assert.deepStrictEqual(storage.snapshot(), storageBeforeExport, "repeated Basketball export wrote storage/history");

assert(html.includes('id="mfBasketballProgramView"')); assert(html.includes('id="mfBasketballCourtsideProgress"')); assert(html.includes('id="mfBasketballCompletionReview"'));
assert(source.includes("SKIP — NEUTRAL")); assert(source.includes("COMPLETE & NEXT")); assert(source.includes("Results save only when you finish the session"));
assert(css.includes("env(safe-area-inset-bottom)")); assert(css.includes(".mf-basketball-drill-card[hidden]"));
assert.strictEqual((source.match(/const MF_BASKETBALL_\w+_KEY/g) || []).length, 4, "10.6 added a persistent Basketball key");
const exportText = c.mfBasketballBuildExport("full", c.mfBasketballReadStore().sessions, c.mfBasketballReadProgramState());
assert.strictEqual((exportText.match(/--- BASKETBALL ACTIVITY ---/g) || []).length, 1); assert(!/readiness score|fatigue score|basketball skill score|calorie burn|VO2/i.test(exportText));

console.log("MarcusFit 10.6.0 basketball UX/progression: PASS");
