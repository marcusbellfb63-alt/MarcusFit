const fs = require("fs");
const vm = require("vm");
const crypto = require("crypto");
const assert = require("assert");

const acceptedPath = "Releases/MarcusFit9_5_9.html";
const releasePath = "Releases/MarcusFit9_5_10.html";
const accepted = fs.readFileSync(acceptedPath, "utf8");
const release = fs.readFileSync(releasePath, "utf8");

function extractBalanced(source, startToken) {
  const start = source.indexOf(startToken);
  assert(start >= 0, "Missing token: " + startToken);
  const brace = source.indexOf("{", start);
  let depth = 0, quote = null, escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error("Unbalanced token: " + startToken);
}
function sha(text) { return crypto.createHash("sha256").update(text).digest("hex"); }

assert(release.includes('const APP_VERSION = "9.5.10";'));
assert(release.includes("<title>MarcusFit 9.5.10</title>"));
assert(release.includes("MarcusFit 9.5.10</strong> &mdash; Schedule-Aware Adherence"));
assert(release.includes("const LIFECYCLE_VERSION = APP_VERSION;"));
assert.strictEqual(sha(extractBalanced(release, "const P =")), sha(extractBalanced(accepted, "const P =")), "Base P changed");
["function p85ExecuteSave()", "function applySync()", "function p954ApplyProposal(", "function p954BuildApplyPlan("].forEach(token => {
  if (accepted.includes(token)) {
    assert.strictEqual(sha(extractBalanced(release, token)), sha(extractBalanced(accepted, token)), token + " changed");
  }
});
const p959Start = release.indexOf("// -- 9.5.9 EXERCISE METRICS");
const p959End = release.indexOf("const p959LegacyGenExport", p959Start);
assert.strictEqual(sha(release.slice(p959Start, p959End)), sha(accepted.slice(accepted.indexOf("// -- 9.5.9 EXERCISE METRICS"), accepted.indexOf("const p959LegacyGenExport"))), "9.5.9 progression core changed");

const generalGymBlock = release.slice(release.indexOf('p958Template("general_gym_full_body_3d"'), release.indexOf('p958Template("hypertrophy_aesthetic_4d"'));
assert.strictEqual((generalGymBlock.match(/p958Day\(/g) || []).length, 3);
assert.strictEqual((generalGymBlock.match(/\["tpl-gg3-/g) || []).length, 12);

const memory = new Map();
let writes = 0;
const localStorage = {
  getItem(k) { return memory.has(k) ? memory.get(k) : null; },
  setItem(k, v) { writes++; memory.set(k, String(v)); },
  removeItem(k) { writes++; memory.delete(k); },
  key(i) { return [...memory.keys()][i] || null; },
  get length() { return memory.size; }
};
const storageProxy = new Proxy(localStorage, {
  ownKeys() { return [...memory.keys()]; },
  getOwnPropertyDescriptor(target, prop) {
    if (memory.has(prop)) return { enumerable: true, configurable: true };
    return Object.getOwnPropertyDescriptor(target, prop);
  }
});
const context = {
  console, localStorage: storageProxy, APP_VERSION: "9.5.10",
  toggleStates: { zep: null },
  p8IsMarcusFitKey(k) { return k === "mf-recurring-items" || k === "mf-recurring-events" || k.startsWith("day-"); },
  tDate: new Date(2026, 6, 26, 12), prompt() { return null; },
  document: { getElementById() { return null; } }
};
context.window = context;
vm.createContext(context);
const coreStart = release.indexOf("// ── PHASE 9.5.10: SCHEDULE-AWARE");
const coreEnd = release.indexOf("// Compatibility wrappers:", coreStart);
assert(coreStart >= 0 && coreEnd > coreStart);
vm.runInContext(release.slice(coreStart, coreEnd), context, { filename: "MarcusFit9_5_10-core.js" });
assert(!release.slice(coreStart, coreEnd).includes("prompt("), "Recurring actions use unsupported native prompt");

function installItem(extra = {}) {
  const item = Object.assign({
    id: "zepbound", name: "Zepbound", category: "medication", enabled: true, paused: false, graceDays: 1,
    schedule: { type: "weekly", interval: 1, weekdays: [0], anchorDate: "2026-07-26" }
  }, extra);
  memory.set("mf-recurring-items", JSON.stringify({ schemaVersion: 1, items: { zepbound: item } }));
  memory.delete("mf-recurring-events");
  return context.p9510GetItem("zepbound");
}
function state(item, date) { return context.p9510GetOccurrenceForDate(item, date); }

let item = installItem();
assert.strictEqual(state(item, "2026-07-25").state, "upcoming");
assert.strictEqual(state(item, "2026-07-26").state, "due_today");
assert.strictEqual(state(item, "2026-07-27").state, "due");
assert.strictEqual(state(item, "2026-07-28").state, "late");
assert.strictEqual(context.p9510GetNextDueDate(item, "2026-07-26"), "2026-08-02");
assert.strictEqual(context.p9510AddDays("2026-03-08", 1), "2026-03-09", "spring DST shifted date");
assert.strictEqual(context.p9510AddDays("2026-11-01", 1), "2026-11-02", "fall DST shifted date");

context.p9510UpsertEvent({ itemId: "zepbound", scheduledDate: "2026-07-26", actualDate: "2026-07-26", status: "completed", source: "test" });
assert.strictEqual(state(item, "2026-07-26").timing, "on_time");
context.p9510UpsertEvent({ itemId: "zepbound", scheduledDate: "2026-07-26", actualDate: "2026-07-27", status: "completed", source: "test" });
assert.strictEqual(state(item, "2026-07-27").timing, "late");
assert.strictEqual(Object.keys(context.p9510GetRecurringEvents().events).length, 1, "duplicate occurrence created");
assert.strictEqual(state(item, "2026-07-25").state, "upcoming", "non-due blank counted");

item = installItem();
assert.strictEqual(state(item, "2026-07-28").state, "late", "passing date auto-skipped");
context.p9510UpsertEvent({ itemId: "zepbound", scheduledDate: "2026-07-26", actualDate: "2026-07-28", status: "skipped", source: "test" });
assert.strictEqual(state(item, "2026-07-28").state, "skipped");

item = installItem();
context.p9510UpsertEvent({ itemId: "zepbound", scheduledDate: "2026-07-26", actualDate: "2026-07-29", replacementDate: "2026-07-29", status: "rescheduled", source: "test" });
assert.strictEqual(state(item, "2026-07-28").state, "upcoming");
assert.strictEqual(state(item, "2026-07-29").state, "due_today");
let summary = context.p9510GetAdherenceSummary("zepbound", 8, "2026-07-30");
assert.strictEqual(summary.scheduledOccurrences, 1, "reschedule counted twice");
assert.strictEqual(summary.unresolvedLate, 0);

item = installItem({ paused: true, pausedAt: "2026-07-26" });
assert.strictEqual(state(item, "2026-07-28").state, "paused");
item = installItem({ paused: false, pausedAt: "2026-07-26", resumedAt: "2026-08-03" });
assert.strictEqual(state(item, "2026-08-02").state, "paused", "resume backfilled paused miss");
summary = context.p9510GetAdherenceSummary("zepbound", 8, "2026-08-09");
assert(summary.pausedExcluded >= 1);
item = installItem({ paused: false, pauseIntervals: [{ startDate: "2026-07-26", endDate: "2026-08-03" }, { startDate: "2026-08-16", endDate: "2026-08-17" }] });
assert.strictEqual(context.p9510WasPaused(item, "2026-08-02"), true, "first pause interval lost");
assert.strictEqual(context.p9510WasPaused(item, "2026-08-16"), true, "second pause interval lost");

item = installItem();
const legacyBefore = JSON.stringify({ date: "2026-07-27", zep: "yes", weight: "200" });
memory.set("day-2026-07-27", legacyBefore);
assert.strictEqual(context.p9510ResolveOccurrence(item, "2026-07-26").source, "legacy_daily_log");
assert.strictEqual(memory.get("day-2026-07-27"), legacyBefore, "legacy history rewritten");
context.p9510UpsertEvent({ itemId: "zepbound", scheduledDate: "2026-07-26", actualDate: "2026-07-26", status: "completed", source: "test" });
assert.strictEqual(context.p9510ResolveOccurrence(item, "2026-07-26").source, "structured_event");
memory.set("day-2026-08-02", JSON.stringify({ date: "2026-08-02", zep: "no" }));
assert.strictEqual(context.p9510ResolveOccurrence(item, "2026-08-02").source, "none", "legacy no became skip");
assert.strictEqual(context.p9510LegacyEvidence(item, "2026-08-09").source, "none", "missing became outcome");
context.p9510WriteDailyBridge("2026-07-27", "yes");
assert.strictEqual(JSON.parse(memory.get("day-2026-07-27")).weight, "200", "dual-write discarded daily fields");

memory.clear(); writes = 0;
assert.strictEqual(context.p9510GetItem("zepbound"), null, "fresh/shared user inherited schedule");
assert.strictEqual(context.mfRecurringAdherenceDebug("zepbound", "2026-07-26").itemExists, false);
assert.strictEqual(writes, 0, "read/debug created recurring storage");
assert(release.includes('key === "mf-recurring-items" || key === "mf-recurring-events"'));
assert(release.includes("p8GetMarcusFitKeys().forEach(k => localStorage.removeItem(k))"), "clear coverage missing");
assert(release.includes("data[k] = localStorage.getItem(k)"), "raw backup round-trip changed");
assert(release.includes("if(!raw)return normalizer(null)"), "optional 9.5.9 keys not supported");

item = installItem();
const beforeReadOnly = JSON.stringify([...memory.entries()]);
context.p9510GetScheduleStatus("zepbound", "2026-07-25");
context.p9510GetAdherenceSummary("zepbound", 8, "2026-07-26");
context.p9510BuildAdherenceExport();
context.mfRecurringAdherenceDebug("zepbound", "2026-07-26");
context.mfRecurringStorageDebug();
assert.strictEqual(JSON.stringify([...memory.entries()]), beforeReadOnly, "read-only path mutated storage");

const selfTestBefore = JSON.stringify([...memory.entries()]);
const selfTest = context.mf9510RunScheduledAdherenceSelfTest();
assert.strictEqual(selfTest.pass, true, JSON.stringify(selfTest.failures));
assert.strictEqual(selfTest.storageExactlyRestored, true);
assert.strictEqual(JSON.stringify([...memory.entries()]), selfTestBefore);

console.log("MarcusFit 9.5.10 scheduled adherence tests: PASS");
