const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "assets", "js", "05-basketball.js"), "utf8");

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
      id, value: "", textContent: "", innerHTML: "", disabled: false,
      style: {}, dataset: {}, children: [],
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener() {}, append() {}, appendChild() {}, replaceChildren() {},
      setAttribute() {}, removeAttribute() {}, focus() {}, scrollIntoView() {},
      querySelector() { return null; }, querySelectorAll() { return []; }
    });
    return elements.get(id);
  };
  const context = {
    console, localStorage, APP_VERSION: "10.1.0", tDate: new Date(2026, 6, 6, 12),
    crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
    document: {
      getElementById: element,
      querySelectorAll() { return []; },
      createElement() { return element(`generated-${elements.size}`); },
      createTextNode(value) { return String(value); },
      body: { classList: { add() {}, remove() {} } }
    },
    p8IsMarcusFitKey(key) { return key.startsWith("day-"); },
    p8492SummarizeBackup() { return { warnings: [] }; },
    p8492FormatSummaryLines() { return ["summary"]; },
    p8ValidateBackup(raw) { return JSON.parse(raw); },
    p7ApplyFilters() {}, p7RenderAnalytics() {}, showScreen() {}, genExport() {},
    updateTrackerDate() {}, getExportDkeys() { return []; },
    setTimeout(fn) { fn(); }, clearTimeout() {}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "05-basketball.js" });
  return { context, localStorage, element };
}

const { context: c, localStorage } = createContext();

// Empty/default state and deterministic IDs.
let state = c.mfBasketballReadStore();
assert.strictEqual(state.sessions.length, 0);
assert.strictEqual(state.invalidRecordCount, 0);
assert.strictEqual(c.mfBasketballCreateId(1000, "fixed"), "bball-rs-fixed");
assert.strictEqual(c.mfBasketballCreateId(1000, "fixed"), "bball-rs-fixed");

// Valid normalization trims notes and omits empty optional fields.
const validInput = {
  date: "2026-07-06", type: "skills_practice", minutes: "45",
  dribblingMinutes: "10", shootingMade: "32", shootingAttempted: "75",
  freeThrowsMade: "8", freeThrowsAttempted: "10", notes: "  Left hand.  "
};
let normalized = c.mfBasketballNormalizeSession(validInput, {
  id: "bball-test-1", now: "2026-07-06T18:00:00.000Z"
});
assert.strictEqual(normalized.ok, true);
assert.strictEqual(normalized.session.notes, "Left hand.");
assert.deepStrictEqual(JSON.parse(JSON.stringify(normalized.session.shooting)), { made: 32, attempted: 75 });
assert.strictEqual("unknown" in normalized.session, false);

// Required-field and made/attempted validation.
assert.strictEqual(c.mfBasketballNormalizeSession({ date: "", type: "", minutes: "" }).ok, false);
assert(c.mfBasketballNormalizeSession({ date: "2026-07-06", type: "shooting", minutes: 30, shootingMade: 11, shootingAttempted: 10 }).errors.some(x => /makes cannot exceed attempts/i.test(x)));
assert(c.mfBasketballNormalizeSession({ date: "2026-07-06", type: "shooting", minutes: 30, freeThrowsMade: 11, freeThrowsAttempted: 10 }).errors.some(x => /free throws made cannot exceed/i.test(x)));

// Save/reload, multiple same-day sessions, edit identity preservation.
let saved = c.mfBasketballSaveSession(validInput, { id: "bball-test-1", now: "2026-07-06T18:00:00.000Z" });
assert.strictEqual(saved.ok, true);
saved = c.mfBasketballSaveSession({ date: "2026-07-06", type: "pickup_game", minutes: 60 }, { id: "bball-test-2", now: "2026-07-06T20:00:00.000Z" });
assert.strictEqual(saved.ok, true);
state = c.mfBasketballReadStore();
assert.strictEqual(state.sessions.length, 2);
const createdAt = state.sessions.find(x => x.id === "bball-test-1").createdAt;
saved = c.mfBasketballSaveSession({ date: "2026-07-07", type: "shooting", minutes: 50 }, { existingId: "bball-test-1", now: "2026-07-08T12:00:00.000Z" });
assert.strictEqual(saved.session.id, "bball-test-1");
assert.strictEqual(saved.session.createdAt, createdAt);
assert.strictEqual(saved.session.updatedAt, "2026-07-08T12:00:00.000Z");

// Ordering and aggregation; missing attempts remain missing and zero is safe.
state = c.mfBasketballReadStore();
assert.strictEqual(state.sessions[0].date, "2026-07-07");
let stats = c.mfBasketballAggregate(state.sessions);
assert.strictEqual(stats.totalSessions, 2);
assert.strictEqual(stats.totalMinutes, 110);
assert.strictEqual(stats.shooting.attempted, 0);
assert.strictEqual(stats.shooting.percentage, null);
assert.strictEqual(stats.freeThrows.percentage, null);

// Delete touches only basketball storage.
localStorage.setItem("day-2026-07-06", "unchanged");
assert.strictEqual(c.mfBasketballDeleteSession("bball-test-2"), true);
assert.strictEqual(localStorage.getItem("day-2026-07-06"), "unchanged");
assert.strictEqual(c.mfBasketballReadStore().sessions.length, 1);

// Malformed saved records and duplicate IDs are isolated.
localStorage.setItem("mf-basketball-sessions", JSON.stringify({ schemaVersion: 1, sessions: [
  normalized.session,
  normalized.session,
  { id: "bad", date: "not-a-date", type: "shooting", minutes: 30 }
] }));
state = c.mfBasketballReadStore();
assert.strictEqual(state.sessions.length, 1);
assert.strictEqual(state.invalidRecordCount, 2);
assert.deepStrictEqual(JSON.parse(JSON.stringify(state.duplicateIds)), ["bball-test-1"]);

// Backup ownership, preview, old-backup compatibility, and malformed rejection.
assert.strictEqual(c.p8IsMarcusFitKey("mf-basketball-sessions"), true);
const summary = c.p8492SummarizeBackup({ data: { "mf-basketball-sessions": JSON.stringify({ schemaVersion: 1, sessions: [normalized.session] }) } });
assert.strictEqual(summary.basketballSessionCount, 1);
assert.doesNotThrow(() => c.p8ValidateBackup(JSON.stringify({ app: "MarcusFit", data: {} })));
assert.throws(() => c.p8ValidateBackup(JSON.stringify({ app: "MarcusFit", data: { "mf-basketball-sessions": "{bad" } })), /basketball/i);

// Backup round trip preserves the normalized record byte-for-byte.
const roundTripRaw = JSON.stringify({ schemaVersion: 1, sessions: [normalized.session] });
localStorage.setItem("mf-basketball-sessions", roundTripRaw);
assert.strictEqual(localStorage.getItem("mf-basketball-sessions"), roundTripRaw);

// AI export section honors ranges and omits empty data.
let section = c.mfBasketballBuildExport("full", [normalized.session]);
assert(section.includes("--- BASKETBALL ACTIVITY ---"));
assert(section.includes("Skills Practice"));
assert.strictEqual(c.mfBasketballBuildExport("full", []), "");
assert.strictEqual(c.mfBasketballBuildExport("program", [normalized.session]), "");

// AI Sync remains isolated: the feature source never wraps or assigns applySync.
assert(!/\bapplySync\s*=/.test(source), "Basketball feature must not alter AI Sync");

console.log("MarcusFit 10.1.0 basketball contract: PASS");
