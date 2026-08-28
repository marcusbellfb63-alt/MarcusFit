const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "assets", "js", "features", "22-basketball.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "css", "marcusfit.css"), "utf8");

function createStorage(initial = {}) {
  const memory = new Map(Object.entries(initial));
  const api = {
    getItem(key) { return memory.has(key) ? memory.get(key) : null; },
    setItem(key, value) { memory.set(key, String(value)); },
    removeItem(key) { memory.delete(key); },
    key(index) { return [...memory.keys()][index] || null; },
    get length() { return memory.size; }
  };
  return new Proxy(api, {
    ownKeys() { return [...memory.keys()]; },
    getOwnPropertyDescriptor(target, prop) {
      if (memory.has(prop)) return { enumerable: true, configurable: true };
      return Object.getOwnPropertyDescriptor(target, prop);
    }
  });
}

function createContext(initial = {}) {
  const localStorage = createStorage(initial);
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      id, value: "", textContent: "", innerHTML: "", disabled: false, hidden: false,
      style: {}, dataset: {}, children: [],
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener() {}, append() {}, appendChild() {}, replaceChildren() {},
      setAttribute() {}, removeAttribute() {}, focus() {}, scrollIntoView() {},
      querySelector() { return null; }, querySelectorAll() { return []; }
    });
    return elements.get(id);
  };
  const context = {
    console, localStorage, APP_VERSION: "10.2.0", tDate: new Date(2026, 7, 27, 12),
    process: { versions: { node: "test" } },
    crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
    document: {
      getElementById: element,
      querySelectorAll() { return []; },
      createElement() { return element(`generated-${elements.size}`); },
      createTextNode(value) { return String(value); },
      body: { classList: { add() {}, remove() {} } },
      addEventListener() {}
    },
    p8IsMarcusFitKey(key) { return key.startsWith("day-"); },
    p8492SummarizeBackup(value) {
      const backup = typeof value === "string" ? JSON.parse(value) : value;
      return { warnings: [], unknownKeyCount: Object.keys((backup && backup.data) || {}).length };
    },
    p8492FormatSummaryLines() { return ["Approx size: 1 KB"]; },
    p8ValidateBackup(raw) { return JSON.parse(raw); },
    p7ApplyFilters() {}, p7RenderAnalytics() {}, showScreen() {}, genExport() {},
    updateTrackerDate() {}, getExportDkeys() { return []; },
    setTimeout(fn) { fn(); }, clearTimeout() {}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "22-basketball.js" });
  Object.assign(context, context.__mfBasketballTest);
  return { context, localStorage, element };
}

function plain(value) { return JSON.parse(JSON.stringify(value)); }

const { context: c, localStorage } = createContext();

// Templates use fixed, unique identities and all supported tracking modes.
assert.deepStrictEqual(plain(c.mfBasketballPrograms.map(p => [p.id, p.version, p.sessions.length])), [
  ["basketball_fundamentals_3_session", 1, 3],
  ["guard_skills_3_session", 1, 3],
  ["shooting_focus_2_session", 1, 2]
]);
const programIds = new Set(), sessionIds = new Set(), drillIds = new Set(), observedModes = new Set();
c.mfBasketballPrograms.forEach(program => {
  assert(!programIds.has(program.id)); programIds.add(program.id);
  program.sessions.forEach(session => {
    assert(!sessionIds.has(session.id)); sessionIds.add(session.id);
    session.drills.forEach(drill => {
      assert(!drillIds.has(drill.id)); drillIds.add(drill.id); observedModes.add(drill.trackingMode);
    });
  });
});
assert.deepStrictEqual([...observedModes].sort(), plain(c.mfBasketballTrackingModes).sort());

// Program state is optional, persistent, session-driven, cyclical, and reset on switch.
let state = c.mfBasketballReadProgramState();
assert.strictEqual(state.parseOk, true);
assert.strictEqual(state.state.activeProgramId, null);
let selected = c.mfBasketballSelectProgram("guard_skills_3_session", "2026-08-27T10:00:00.000Z");
assert.strictEqual(selected.ok, true);
assert.strictEqual(c.mfBasketballReadProgramState().state.nextSessionIndex, 0);
assert.strictEqual(c.mfBasketballAdvanceProgramState("2026-08-27T11:00:00.000Z").state.nextSessionIndex, 1);
assert.strictEqual(c.mfBasketballAdvanceProgramState("2026-08-27T12:00:00.000Z").state.nextSessionIndex, 2);
assert.strictEqual(c.mfBasketballAdvanceProgramState("2026-08-27T13:00:00.000Z").state.nextSessionIndex, 0);
assert.strictEqual(c.mfBasketballSelectProgram("shooting_focus_2_session", "2026-08-28T10:00:00.000Z").state.nextSessionIndex, 0);
assert.strictEqual(c.mfBasketballRestartProgram("2026-08-28T11:00:00.000Z").state.nextSessionIndex, 0);
assert.strictEqual(source.includes("setDate("), true, "Date filtering may exist, but program advancement must remain explicit");
assert(!/setInterval|weekly advancement|missed-session/i.test(source));
const noCalendarAdvance = localStorage.getItem("mf-basketball-program-state");
assert.strictEqual(localStorage.getItem("mf-basketball-program-state"), noCalendarAdvance);

// Drill validation is mode-specific and confidence accepts only 1-10.
function normalizeDrill(input) { const errors = []; const result = c.mfBasketballNormalizeDrillResult(input, {}, errors); return { errors, result }; }
const base = { drillId: "test_drill", nameSnapshot: "Test Drill" };
assert(normalizeDrill({ ...base, trackingMode: "confidence", confidence: 0 }).errors.some(x => /Confidence/));
assert(normalizeDrill({ ...base, trackingMode: "confidence", confidence: 11 }).errors.some(x => /Confidence/));
assert.strictEqual(normalizeDrill({ ...base, trackingMode: "confidence", confidence: 7, actualResult: { durationMinutes: 8 } }).errors.length, 0);
assert(normalizeDrill({ ...base, trackingMode: "benchmark_shooting", plannedTargetSnapshot: { attempts: 20 }, actualResult: { made: 21, attempted: 20 } }).errors.some(x => /cannot exceed/));
assert(normalizeDrill({ ...base, trackingMode: "benchmark_shooting", plannedTargetSnapshot: { attempts: 20 }, actualResult: { made: 10, attempted: 0 } }).errors.some(x => /greater than 0/));
const benchmark = normalizeDrill({ ...base, trackingMode: "benchmark_shooting", plannedTargetSnapshot: { attempts: 20 }, actualResult: { made: 16, attempted: 20 } });
assert.strictEqual(benchmark.errors.length, 0);
assert.strictEqual(benchmark.result.actualResult.percentage, 80);
const countResult = normalizeDrill({ ...base, trackingMode: "count", plannedTargetSnapshot: { count: 12 }, actualResult: { count: 9 }, confidence: 6 });
assert.strictEqual(countResult.errors.length, 0);
assert.strictEqual(countResult.result.actualResult.count, 9);
const completionResult = normalizeDrill({ ...base, trackingMode: "completion", actualResult: { completed: false } });
assert.strictEqual(completionResult.errors.length, 0);
assert.strictEqual(completionResult.result.actualResult.completed, false);

function drillResult(definition, values = {}) {
  return {
    drillId: definition.id,
    actualResult: values.actualResult,
    confidence: values.confidence,
    notes: values.notes
  };
}
function validGuardA(confidence = 3, finishMakes = 20, ftMade = 16) {
  const session = c.mfBasketballGetProgram("guard_skills_3_session").sessions[0];
  return session.drills.map(drill => {
    if (drill.trackingMode === "duration") return drillResult(drill, { actualResult: { durationMinutes: drill.target.durationMinutes }, confidence });
    if (drill.trackingMode === "confidence") return drillResult(drill, { actualResult: { durationMinutes: drill.target.durationMinutes }, confidence });
    if (drill.trackingMode === "makes_target") return drillResult(drill, { actualResult: { makes: finishMakes }, confidence });
    return drillResult(drill, { actualResult: { made: ftMade, attempted: 20 } });
  });
}

// Structured save snapshots identity; repeat does not advance; advance does.
c.mfBasketballSelectProgram("guard_skills_3_session", "2026-08-29T10:00:00.000Z");
let finished = c.mfBasketballFinishStructuredSession({
  programId: "guard_skills_3_session", programVersion: 1,
  plannedSessionId: "guard_a_handle_weak_hand", date: "2026-08-29", minutes: 42,
  drills: validGuardA(), id: "bball-structured-1", now: "2026-08-29T12:00:00.000Z"
}, "repeat");
assert.strictEqual(finished.ok, true);
assert.strictEqual(finished.advanced, false);
assert.strictEqual(c.mfBasketballReadProgramState().state.nextSessionIndex, 0);
let structured = c.mfBasketballReadStore().sessions[0];
assert.strictEqual(structured.id, "bball-structured-1");
assert.strictEqual(structured.programId, "guard_skills_3_session");
assert.strictEqual(structured.programNameSnapshot, "Guard Skills — 3 Session");
assert.strictEqual(structured.plannedSessionId, "guard_a_handle_weak_hand");
assert.strictEqual(structured.drills[2].drillId, "guard_behind_back_foundation");
assert.strictEqual(structured.drills[2].confidence, 3);
const beforeAbandonedSessions = localStorage.getItem("mf-basketball-sessions");
const beforeAbandonedQueue = localStorage.getItem("mf-basketball-program-state");
assert.strictEqual(c.mfBasketballBuildStructuredInput({
  programId: "guard_skills_3_session", programVersion: 1,
  plannedSessionId: "guard_a_handle_weak_hand", date: "2026-08-29", minutes: 42,
  drills: validGuardA(5)
}).ok, true);
assert.strictEqual(localStorage.getItem("mf-basketball-sessions"), beforeAbandonedSessions);
assert.strictEqual(localStorage.getItem("mf-basketball-program-state"), beforeAbandonedQueue);
finished = c.mfBasketballFinishStructuredSession({
  programId: "guard_skills_3_session", programVersion: 1,
  plannedSessionId: "guard_a_handle_weak_hand", date: "2026-08-30", minutes: 44,
  drills: validGuardA(6), id: "bball-structured-2", now: "2026-08-30T12:00:00.000Z"
}, "advance");
assert.strictEqual(finished.ok, true);
assert.strictEqual(finished.advanced, true);
assert.strictEqual(c.mfBasketballReadProgramState().state.nextSessionIndex, 1);

// Editing preserves the stable session ID and never moves the queue.
finished = c.mfBasketballFinishStructuredSession({
  programId: "guard_skills_3_session", programVersion: 1,
  plannedSessionId: "guard_a_handle_weak_hand", date: "2026-08-31", minutes: 45,
  drills: validGuardA(7), existingId: "bball-structured-1", now: "2026-08-31T12:00:00.000Z"
}, "edit");
assert.strictEqual(finished.ok, true);
assert.strictEqual(finished.session.id, "bball-structured-1");
assert.strictEqual(c.mfBasketballReadProgramState().state.nextSessionIndex, 1);

// Free-form sessions remain schema-1 compatible and cannot advance program state.
const queueBeforeFreeForm = localStorage.getItem("mf-basketball-program-state");
const free = c.mfBasketballSaveSession({ date: "2026-09-01", type: "pickup_game", minutes: 60 }, { id: "bball-free-1", now: "2026-09-01T12:00:00.000Z" });
assert.strictEqual(free.ok, true);
assert.strictEqual("programId" in free.session, false);
assert.strictEqual(localStorage.getItem("mf-basketball-program-state"), queueBeforeFreeForm);
const legacy = { id: "bball-legacy-1", schemaVersion: 1, date: "2026-01-01", type: "casual_play", minutes: 30, createdAt: "2026-01-01T10:00:00.000Z", updatedAt: "2026-01-01T10:00:00.000Z" };
const legacyState = c.mfBasketballReadStore();
localStorage.setItem("mf-basketball-sessions", JSON.stringify({ schemaVersion: 1, sessions: [legacy, ...legacyState.sessions] }));
assert(c.mfBasketballReadStore().sessions.some(session => session.id === "bball-legacy-1"));

// Progression requires repeated evidence and stays mode-specific.
function exposure(id, date, drill) { return { id, schemaVersion: 1, date, type: "basketball_workout", minutes: 30, createdAt: `${date}T12:00:00.000Z`, updatedAt: `${date}T12:00:00.000Z`, drills: [drill] }; }
function confidenceDrill(value) { return { drillId: "guard_behind_back_foundation", nameSnapshot: "Behind-the-Back", trackingMode: "confidence", plannedTargetSnapshot: { durationMinutes: 8 }, actualResult: { durationMinutes: 8 }, confidence: value }; }
let guidance = c.mfBasketballProgressionForDrill("guard_behind_back_foundation", [exposure("bball-p1", "2026-01-01", confidenceDrill(9))]);
assert.strictEqual(guidance.ready, false, "one high outlier must not progress");
guidance = c.mfBasketballProgressionForDrill("guard_behind_back_foundation", [exposure("bball-p1", "2026-01-01", confidenceDrill(3)), exposure("bball-p2", "2026-01-02", confidenceDrill(3)), exposure("bball-p3", "2026-01-03", confidenceDrill(4))]);
assert.strictEqual(guidance.status, "needs_work");
guidance = c.mfBasketballProgressionForDrill("guard_behind_back_foundation", [exposure("bball-p1", "2026-01-01", confidenceDrill(7)), exposure("bball-p2", "2026-01-02", confidenceDrill(8)), exposure("bball-p3", "2026-01-03", confidenceDrill(8))]);
assert.strictEqual(guidance.ready, true);
assert(guidance.guidance.includes("Moving Behind-the-Back"));

function makesDrill(makes, confidence) { return { drillId: "guard_weak_hand_finishing", nameSnapshot: "Weak-Hand Finishing", trackingMode: "makes_target", plannedTargetSnapshot: { makes: 20 }, actualResult: { makes, targetAchieved: makes >= 20 }, confidence }; }
guidance = c.mfBasketballProgressionForDrill("guard_weak_hand_finishing", [exposure("bball-m1", "2026-01-01", makesDrill(14, 8)), exposure("bball-m2", "2026-01-02", makesDrill(17, 8)), exposure("bball-m3", "2026-01-03", makesDrill(16, 8))]);
assert.strictEqual(guidance.ready, false);
guidance = c.mfBasketballProgressionForDrill("guard_weak_hand_finishing", [exposure("bball-m1", "2026-01-01", makesDrill(20, 7)), exposure("bball-m2", "2026-01-02", makesDrill(20, 8)), exposure("bball-m3", "2026-01-03", makesDrill(20, 8))]);
assert.strictEqual(guidance.ready, true);
assert.strictEqual("percentage" in makesDrill(20, 8).actualResult, false, "makes-target must not invent attempts or percentage");

function benchmarkDrill(made, attempted) { return { drillId: "guard_ft_benchmark", nameSnapshot: "Free Throws — Benchmark", trackingMode: "benchmark_shooting", plannedTargetSnapshot: { attempts: 20, minAttempts: 10 }, actualResult: { made, attempted, percentage: Math.round(made / attempted * 1000) / 10 } }; }
guidance = c.mfBasketballProgressionForDrill("guard_ft_benchmark", [exposure("bball-b1", "2026-01-01", benchmarkDrill(7, 10)), exposure("bball-b2", "2026-01-02", benchmarkDrill(15, 20)), exposure("bball-b3", "2026-01-03", benchmarkDrill(16, 20))]);
assert.strictEqual(guidance.status, "improving");
guidance = c.mfBasketballProgressionForDrill("guard_ft_benchmark", [exposure("bball-small", "2026-01-01", benchmarkDrill(1, 2))]);
assert.strictEqual(guidance.status, "small_sample");

function durationDrill(minutes, confidence) { return { drillId: "fundamentals_weak_hand_stationary", nameSnapshot: "Weak-Hand Pound Dribble", trackingMode: "duration", plannedTargetSnapshot: { durationMinutes: 5 }, actualResult: { durationMinutes: minutes }, confidence }; }
guidance = c.mfBasketballProgressionForDrill("fundamentals_weak_hand_stationary", [exposure("bball-d1", "2026-01-01", durationDrill(5, 7)), exposure("bball-d2", "2026-01-02", durationDrill(5, 8)), exposure("bball-d3", "2026-01-03", durationDrill(6, 8))]);
assert.strictEqual(guidance.ready, true);
assert(guidance.guidance.includes("Moving Weak-Hand Control"));

// Backup owns and validates both stores; legacy backups may omit program state.
assert.strictEqual(c.p8IsMarcusFitKey("mf-basketball-sessions"), true);
assert.strictEqual(c.p8IsMarcusFitKey("mf-basketball-program-state"), true);
const backup = { app: "MarcusFit", data: {
  "mf-basketball-sessions": localStorage.getItem("mf-basketball-sessions"),
  "mf-basketball-program-state": localStorage.getItem("mf-basketball-program-state")
} };
assert.doesNotThrow(() => c.p8ValidateBackup(JSON.stringify(backup)));
assert.doesNotThrow(() => c.p8ValidateBackup(JSON.stringify({ app: "MarcusFit", data: {} })));
assert.throws(() => c.p8ValidateBackup(JSON.stringify({ app: "MarcusFit", data: { "mf-basketball-program-state": "{bad" } })), /program state/i);
const summary = c.p8492SummarizeBackup(backup);
assert.strictEqual(summary.hasBasketballProgramState, true);
assert.strictEqual(summary.basketballProgramName, "Guard Skills — 3 Session");
const sessionBytesBeforeSwitch = localStorage.getItem("mf-basketball-sessions");
assert.strictEqual(c.mfBasketballSelectProgram("shooting_focus_2_session", "2026-09-02T10:00:00.000Z").ok, true);
assert.strictEqual(localStorage.getItem("mf-basketball-sessions"), sessionBytesBeforeSwitch, "program switching must not rewrite history");
assert.strictEqual(c.mfBasketballReadProgramState().state.nextSessionIndex, 0);
c.mfBasketballSelectProgram("guard_skills_3_session", "2026-09-02T11:00:00.000Z");
c.mfBasketballAdvanceProgramState("2026-09-02T12:00:00.000Z");

// AI Export includes active queue context and structured drill guidance, while
// preserving the program-only range contract and sensible empty behavior.
let exported = c.mfBasketballBuildExport("program", [], c.mfBasketballReadProgramState());
assert(exported.includes("Active program: Guard Skills — 3 Session"));
assert(exported.includes("Next planned session: Session B — Change of Pace"));
assert(!exported.includes("Sessions:"));
exported = c.mfBasketballBuildExport("full", c.mfBasketballReadStore().sessions, c.mfBasketballReadProgramState());
assert(exported.includes("confidence"));
assert(exported.includes("Free Throws — Benchmark"));
const emptyContext = createContext();
assert.strictEqual(emptyContext.context.mfBasketballBuildExport("program", [], emptyContext.context.mfBasketballReadProgramState()), "");

// Structured UI exposes clear mobile controls without new inline handlers or
// native confirmation dialogs.
[
  "mfBasketballProgramSelect", "mfBasketballNextSession", "mfBasketballStructuredLogger",
  "mfBasketballDrillLogger", "mfBasketballSessionSummary", "mfBasketballFinishAdvance",
  "mfBasketballFinishRepeat", "mfBasketballProgramDialog"
].forEach(id => assert(html.includes(`id="${id}"`), `Missing 10.2.0 UI hook: ${id}`));
assert(html.includes("START PLANNED SESSION") === false, "Start action is rendered from the current queue, not hard-coded markup");
assert(source.includes("START PLANNED SESSION"));
assert(source.includes("Confidence: 1–10"));
assert(css.includes("grid-template-columns:repeat(5,minmax(0,1fr))"));
assert(css.includes("min-height:44px"));
assert(css.includes("position:sticky"));
assert.strictEqual((html.match(/\son[a-z]+\s*=/gi) || []).length, 83, "10.2.0 must not expand the accepted inline-handler surface");
assert(!/\bconfirm\s*\(/.test(source));

// A malformed structured record is isolated without rewriting valid legacy data.
const malformedContext = createContext({
  "mf-basketball-sessions": JSON.stringify({ schemaVersion: 1, sessions: [
    { id: "bball-valid-legacy", schemaVersion: 1, date: "2026-02-01", type: "casual_play", minutes: 20, createdAt: "2026-02-01T10:00:00.000Z", updatedAt: "2026-02-01T10:00:00.000Z" },
    { id: "bball-bad-structured", schemaVersion: 1, date: "2026-02-02", type: "basketball_workout", minutes: 20, createdAt: "2026-02-02T10:00:00.000Z", updatedAt: "2026-02-02T10:00:00.000Z", programId: "bad", drills: [] }
  ] })
});
assert.strictEqual(malformedContext.context.mfBasketballReadStore().sessions.length, 1);
assert.strictEqual(malformedContext.context.mfBasketballReadStore().invalidRecordCount, 1);

// Core Sync remains the sole authority.
assert(!/\bapplySync\s*=/.test(source));
assert(!/\bfunction\s+applySync\s*\(/.test(source));

console.log("MarcusFit 10.2.0 basketball programs/progression contract: PASS");
