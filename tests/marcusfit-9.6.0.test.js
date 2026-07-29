const fs = require("fs");
const vm = require("vm");
const crypto = require("crypto");
const assert = require("assert");

const acceptedPath = "Releases/MarcusFit9_5_10.html";
const releasePath = "Releases/MarcusFit9_6_0.html";
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

assert(release.includes('const APP_VERSION = "9.6.0";'));
assert(release.includes("<title>MarcusFit 9.6.0</title>"));
assert(release.includes("MarcusFit 9.6.0</strong> &mdash; Personalized Habits"));
assert(release.includes("const LIFECYCLE_VERSION = APP_VERSION;"));
assert.strictEqual(sha(extractBalanced(release, "const P =")), sha(extractBalanced(accepted, "const P =")), "Base P changed");
assert.strictEqual(
  sha(extractBalanced(release, "function mf9510RunScheduledAdherenceSelfTest()")),
  sha(extractBalanced(accepted, "function mf9510RunScheduledAdherenceSelfTest()")),
  "9.5.10 recurring adherence self-test changed"
);
const p959Start = release.indexOf("// -- 9.5.9 EXERCISE METRICS");
const p959End = release.indexOf("const p959LegacyGenExport", p959Start);
assert.strictEqual(
  sha(release.slice(p959Start, p959End)),
  sha(accepted.slice(accepted.indexOf("// -- 9.5.9 EXERCISE METRICS"), accepted.indexOf("const p959LegacyGenExport"))),
  "9.5.9 progression core changed"
);
const starterBlock = release.slice(
  release.indexOf('p958Template("general_gym_full_body_3d"'),
  release.indexOf('p958Template("hypertrophy_aesthetic_4d"')
);
assert.strictEqual((starterBlock.match(/p958Day\(/g) || []).length, 3);
assert.strictEqual((starterBlock.match(/\["tpl-gg3-/g) || []).length, 12);

const defaultsSource = release.slice(release.indexOf("const HABITS ="), release.indexOf("const WO_RECS ="));
[
  "habit-jaw-posture", "habit-desk-posture", "habit-box-breathing",
  "habit-kegel", "habit-water", "habit-bm", "habit-steps"
].forEach(id => assert(defaultsSource.includes(id), "Missing accepted ID " + id));
assert(release.includes('key === "mf-habit-definitions" || key === "mf-habit-proposal"'));
assert(release.includes("p8GetMarcusFitKeys().forEach(k => localStorage.removeItem(k))"));
assert(release.includes("data[k] = localStorage.getItem(k)"));

const memory = new Map();
let writes = 0;
const storage = {
  getItem(k) { return memory.has(k) ? memory.get(k) : null; },
  setItem(k, v) { writes++; memory.set(k, String(v)); },
  removeItem(k) { writes++; memory.delete(k); },
  key(i) { return [...memory.keys()][i] || null; },
  get length() { return memory.size; }
};
const localStorage = new Proxy(storage, {
  ownKeys() { return [...memory.keys()]; },
  getOwnPropertyDescriptor(target, prop) {
    if (memory.has(prop)) return { enumerable: true, configurable: true };
    return Object.getOwnPropertyDescriptor(target, prop);
  }
});
const nullElement = () => null;
const context = {
  console, localStorage, APP_VERSION: "9.6.0",
  HABITS: [
    { id: "habit-jaw-posture", name: "Jawline / Posture Habit", icon: "🦷", target: "Ongoing awareness throughout the day", instructions: ["Tongue gently on roof of mouth"] },
    { id: "habit-desk-posture", name: "Desk Posture Reset", icon: "🪑", target: "Every 60–90 min at work", instructions: ["Sit tall"] },
    { id: "habit-box-breathing", name: "Box Breathing", icon: "🌬️", target: "1–2 rounds daily (4+ cycles each)", instructions: ["Inhale"] },
    { id: "habit-kegel", name: "Kegel Holds", icon: "💪", target: "3 × 10 holds", instructions: ["Contract"] },
    { id: "habit-water", name: "Water Intake", icon: "💧", target: "100+ oz", instructions: ["Front-load"] },
    { id: "habit-bm", name: "BM Tracking", icon: "🚽", target: "Log daily", instructions: ["Note"] },
    { id: "habit-steps", name: "Steps / Movement", icon: "👟", target: "7,500–10,000 steps daily", instructions: ["Walk"] }
  ],
  p950GetUserProfile() { return { firstName: "Roger" }; },
  getActiveProgramBasis() { return { explicit: true, basisId: "starter" }; },
  p951GetOnboardingState() { return { status: "completed" }; },
  p951HasMeaningfulExistingData() { return false; },
  p8IsMarcusFitKey(k) { return k.startsWith("day-") || k === "mf-habit-definitions" || k === "mf-habit-proposal"; },
  p7CalcAnalytics() { return { habits: {}, weight: {}, workout: {}, streak: {}, recovery: {}, heatmap: [], totalDays: 0 }; },
  renderHistoryFromEntries() {},
  p85ExecuteSave() {},
  genExport() { return "=== MARCUSFIT EXPORT ===\n"; },
  applySync() {},
  renderHabits() {},
  autoSaveDraft() {},
  dKey(d) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return `day-${y}-${m}-${day}`;
  },
  tDate: new Date(2026, 6, 6, 12),
  habitState: {},
  document: {
    getElementById: nullElement,
    querySelectorAll() { return []; },
    createElement() {
      return {
        className: "", style: {}, dataset: {}, children: [],
        append() {}, appendChild() {}, setAttribute() {}, addEventListener() {},
        classList: { add() {}, remove() {}, contains() { return false; } },
        querySelector() { return null; }, querySelectorAll() { return []; },
        scrollIntoView() {}
      };
    },
    createTextNode(v) { return String(v); },
    head: { appendChild() {} },
    body: { appendChild() {} }
  }
};
context.window = context;
vm.createContext(context);
const start = release.indexOf("// -- PHASE 9.6.0: PERSONALIZED HABITS");
const end = release.indexOf("// -- END PHASE 9.6.0", start);
assert(start >= 0 && end > start, "Unable to isolate 9.6.0 core");
vm.runInContext(release.slice(start, end), context, { filename: "MarcusFit9_6_0-core.js" });

// Fresh/shared Roger initializes an empty store, with no Marcus history or medication.
let store = context.p960GetHabitStore();
assert.strictEqual(Object.keys(store.habits).length, 0, "Roger inherited Marcus defaults");
assert.strictEqual([...memory.keys()].some(k => k.includes("recurring") || k.includes("zepbound")), false);
assert.strictEqual([...memory.keys()].some(k => k.startsWith("day-")), false);

// Established history migrates the exact accepted seven stable definitions.
memory.clear(); writes = 0;
memory.set("day-2026-06-01", JSON.stringify({
  date: "2026-06-01",
  habits: { "habit-water": { completed: true, notes: "unchanged", custom: 7 } }
}));
const historyBefore = memory.get("day-2026-06-01");
assert.strictEqual(context.p960ShouldSeedMarcusDefaults(), true);
const migration = context.p960InitHabitStore();
assert.strictEqual(migration.seededDefaults, true);
store = context.p960GetHabitStore();
assert.strictEqual(Object.keys(store.habits).length, 7);
assert.strictEqual(memory.get("day-2026-06-01"), historyBefore, "Migration rewrote daily history");
assert.strictEqual(store.habits["habit-water"].name, "Water Intake");
assert.strictEqual(store.habits["habit-water"].target.value, 100);

// Normalization preserves unknown fields and deterministic order.
store.habits["habit-water"].futureField = { keep: true };
store.order = ["habit-water", "habit-water", "habit-steps"];
context.p960SaveHabitStore(store);
store = context.p960GetHabitStore();
assert.strictEqual(JSON.stringify(store.habits["habit-water"].futureField), '{"keep":true}');
assert.strictEqual(store.order.filter(x => x === "habit-water").length, 1);
assert.strictEqual(store.order[0], "habit-water");

const daily = context.p960NormalizeHabit({
  id: "habit-daily", name: "Daily", target: { type: "checkbox" },
  schedule: { type: "daily" }, active: true, source: "user",
  createdAt: "2026-07-01T12:00:00.000Z"
}, "habit-daily");
const weekdays = context.p960NormalizeHabit({
  id: "habit-weekdays", name: "MWF", target: { type: "count", value: 1 },
  schedule: { type: "weekdays", weekdays: [1, 3, 5] }, active: true, source: "user",
  createdAt: "2026-07-01T12:00:00.000Z"
}, "habit-weekdays");
const weekly = context.p960NormalizeHabit({
  id: "habit-weekly", name: "Three weekly", target: { type: "checkbox" },
  schedule: { type: "weekly_count", targetCount: 3, weekStartsOn: 0 },
  active: true, source: "user", createdAt: "2026-06-01T12:00:00.000Z"
}, "habit-weekly");
assert(context.p960IsHabitDueOnDate(daily, "2026-07-07"));
assert(!context.p960IsHabitDueOnDate(daily, "2026-06-30"), "Pre-creation date eligible");
assert(context.p960IsHabitDueOnDate(weekdays, "2026-07-06"));
assert(!context.p960IsHabitDueOnDate(weekdays, "2026-07-07"));
weekdays.archivedAt = "2026-07-10T12:00:00.000Z";
assert(!context.p960IsHabitDueOnDate(weekdays, "2026-07-13"), "Post-archive date eligible");

memory.set("day-2026-07-06", JSON.stringify({ habits: { "habit-weekly": { completed: true } } }));
memory.set("day-2026-07-08", JSON.stringify({ habits: { "habit-weekly": { completed: true } } }));
memory.set("day-2026-07-10", JSON.stringify({ habits: { "habit-weekly": { completed: true } } }));
assert.strictEqual(context.p960GetWeeklyHabitProgress(weekly, "2026-07-08").completed, 3);
assert.strictEqual(context.p960GetWeeklyHabitProgress(weekly, "2026-07-08").met, true);
assert.strictEqual(context.p960AnalyzeHabit(weekdays, "2026-07-05", "2026-07-11").eligible, 3);
assert.strictEqual(context.p960AnalyzeHabit(weekly, "2026-07-05", "2026-07-11").eligible, 0, "Current partial week failed");
assert.strictEqual(context.p960AnalyzeHabit(weekly, "2026-06-28", "2026-07-12").eligible, 2, "Weekly denominator is not one per full week");

// User editing primitives preserve IDs, unknown fields, history, and visibility.
assert.strictEqual(context.p960SafeId("Read Book"), "habit-read-book");
const custom = context.p960NormalizeHabit({
  id: "habit-custom", name: "Custom", customField: 42, target: { type: "text" },
  schedule: { type: "daily" }, active: true, source: "user"
}, "habit-custom");
assert.strictEqual(custom.id, "habit-custom");
assert.strictEqual(custom.customField, 42);
custom.active = false; custom.archivedAt = "2026-07-11T12:00:00.000Z";
assert.strictEqual(memory.get("day-2026-06-01"), historyBefore);
custom.active = true; custom.archivedAt = null;

// Proposal validation rejects cross-domain edits and stable-ID mutation.
let result = context.p960ValidateHabitProposal({
  summary: "Bad", changes: [{ action: "modify", habitId: "habit-water", fields: { stableId: "changed" } }]
});
assert.strictEqual(result.valid, false);
result = context.p960ValidateHabitProposal({
  summary: "Bad", changes: [{ action: "modify", habitId: "habit-water", fields: { zepbound: { weekday: 2 } } }]
});
assert.strictEqual(result.valid, false);
result = context.p960ValidateHabitProposal({
  summary: "Bad", changes: [{ action: "modify", habitId: "habit-water", fields: { history: [] } }]
});
assert.strictEqual(result.valid, false);

// Import is pending/read-only for definitions; apply is explicit and isolated.
const proposal = {
  proposalId: "test-proposal", summary: "Small sustainable changes",
  changes: [
    { action: "modify", habitId: "habit-water", fields: { name: "Hydration" } },
    { action: "add", habitId: "habit-reading", definition: {
      id: "habit-reading", name: "Read", target: { type: "count", value: 10, unit: "pages" },
      schedule: { type: "daily" }, instructions: ["Keep it small"]
    }}
  ]
};
const definitionsBeforeImport = memory.get("mf-habit-definitions");
result = context.p960ImportHabitProposal(proposal);
assert.strictEqual(result.valid, true);
assert.strictEqual(memory.get("mf-habit-definitions"), definitionsBeforeImport);
assert.strictEqual(context.p960GetHabitProposal().status, "pending");
const dayBytes = memory.get("day-2026-06-01");
memory.set("mf-recurring-items", '{"keep":"exact"}');
memory.set("mf-program-proposal", '{"keep":"exact"}');
const recurringBytes = memory.get("mf-recurring-items");
const programBytes = memory.get("mf-program-proposal");
const beforePreview = memory.get("mf-habit-definitions");
assert.strictEqual(context.p960ApplyHabitProposal(false).requiresConfirmation, true);
assert.strictEqual(memory.get("mf-habit-definitions"), beforePreview);
result = context.p960ApplyHabitProposal(true);
assert.strictEqual(result.applied, true);
assert.strictEqual(context.p960GetHabitById("habit-water").name, "Hydration");
assert.strictEqual(context.p960GetHabitById("habit-reading").source, "ai");
assert.strictEqual(memory.get("day-2026-06-01"), dayBytes);
assert.strictEqual(memory.get("mf-recurring-items"), recurringBytes);
assert.strictEqual(memory.get("mf-program-proposal"), programBytes);
assert.strictEqual(context.p960UndoHabitProposal(false).requiresConfirmation, true);
assert.strictEqual(context.p960UndoHabitProposal(true).undone, true);
assert.strictEqual(memory.get("mf-habit-definitions"), definitionsBeforeImport);

// A later user edit blocks unsafe undo and proposal conflicts block apply.
context.p960ImportHabitProposal(proposal);
context.p960ApplyHabitProposal(true);
store = context.p960GetHabitStore();
store.habits["habit-water"].name = "User Authoritative";
context.p960SaveHabitStore(store);
assert.strictEqual(context.p960UndoHabitProposal(true).conflict, true);
context.p960ImportHabitProposal({
  proposalId: "conflict-proposal", summary: "Conflict check",
  changes: [{ action: "modify", habitId: "habit-water", fields: { name: "AI Later Name" } }]
});
store = context.p960GetHabitStore();
store.habits["habit-water"].description = "edited after proposal";
context.p960SaveHabitStore(store);
assert(context.p960ApplyHabitProposal(true).conflicts.includes("habit-water"));
assert.strictEqual(context.p960GetHabitById("habit-water").name, "User Authoritative");

// Debug/export/analytics are read-only and backup-covered.
const readOnlyBefore = JSON.stringify([...memory.entries()]);
assert.strictEqual(context.mfHabitDefinitionsDebug().readOnly, true);
assert.strictEqual(context.mfHabitDebug("habit-water", "2026-07-06").readOnly, true);
assert.strictEqual(context.mfHabitProposalDebug().readOnly, true);
context.p960GetHabitAnalytics("2026-07-01", "2026-07-12");
const exported = context.p960BuildHabitExport();
assert(exported.includes("--- HABITS ---"));
assert(exported.includes("non-due blanks are neutral"));
assert.strictEqual(JSON.stringify([...memory.entries()]), readOnlyBefore, "Read-only habit path wrote storage");
assert.strictEqual(context.mfHabitDefinitionsDebug().backupCoverage, true);
assert.strictEqual(context.mfHabitProposalDebug().backupCoverage, true);

const selfTestBefore = JSON.stringify([...memory.entries()]);
const selfTest = context.mf960RunHabitSelfTest();
assert.strictEqual(selfTest.pass, true, JSON.stringify(selfTest.failures));
assert.strictEqual(selfTest.storageExactlyRestored, true);
assert.strictEqual(JSON.stringify([...memory.entries()]), selfTestBefore);

console.log("MarcusFit 9.6.0 personalized habit tests: PASS");
