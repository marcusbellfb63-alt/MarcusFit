const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const profileSource = fs.readFileSync(path.join(root, "assets/js/state/04-runtime-state-profile-preferences.js"), "utf8");
const constantsSource = fs.readFileSync(path.join(root, "assets/js/core/01-app-constants.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets/css/marcusfit.css"), "utf8");
const dailySource = fs.readFileSync(path.join(root, "assets/js/features/08-program-daily.js"), "utf8");
const workoutSource = fs.readFileSync(path.join(root, "assets/js/features/10-workout-logging.js"), "utf8");
const habitsSource = fs.readFileSync(path.join(root, "assets/js/features/20-habits.js"), "utf8");
const recurringSource = fs.readFileSync(path.join(root, "assets/js/features/19-recurring-adherence.js"), "utf8");
const basketballSource = fs.readFileSync(path.join(root, "assets/js/features/22-basketball.js"), "utf8");
const exportSource = fs.readFileSync(path.join(root, "assets/js/sync/11-ai-export.js"), "utf8");
const coreSyncSource = fs.readFileSync(path.join(root, "assets/js/sync/12-ai-sync.js"), "utf8");
const backupSource = fs.readFileSync(path.join(root, "assets/js/system/16-backup-restore-debug.js"), "utf8");
const onboardingSource = fs.readFileSync(path.join(root, "assets/js/features/05-onboarding.js"), "utf8");

function extractBalanced(source, token) {
  const at = source.indexOf(token); assert(at >= 0, `missing ${token}`);
  const brace = source.indexOf("{", at); let depth = 0, quote = null, escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) { if (escaped) escaped = false; else if (ch === "\\") escaped = true; else if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    if (ch === "}" && --depth === 0) return source.slice(at, i + 1);
  }
  throw new Error(`unbalanced ${token}`);
}

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
      get length() { return memory.size; }
    },
    get writes() { return writes; },
    resetWrites() { writes = 0; }
  };
}

function createProfileContext(initial = {}) {
  const storage = makeStorage(initial);
  const elements = new Map();
  const selectors = new Map();
  const document = {
    documentElement: { setAttribute() {} },
    getElementById(id) { return elements.get(id) || null; },
    querySelectorAll(selector) { return selectors.get(selector) || []; }
  };
  const context = { APP_VERSION: "10.11.0", console, localStorage: storage.api, document, window: null };
  context.window = context;
  vm.createContext(context);
  const start = profileSource.indexOf('const USER_PROFILE_KEY = "mf-user-profile"');
  const end = profileSource.indexOf("// ── END PHASE 9.5.0", start);
  assert(start >= 0 && end > start, "profile source boundary missing");
  vm.runInContext(profileSource.slice(start, end), context, { filename: "04-runtime-state-profile-preferences.js" });
  return { context, storage, elements, selectors };
}

assert(constantsSource.includes('const APP_VERSION = "10.11.1"'), "APP_VERSION was not advanced");

// Missing tracking is a virtual Full Coaching read and never persists.
let env = createProfileContext();
let tracking = env.context.p950GetTrackingPreferences();
assert.strictEqual(tracking.preset, "full_coaching");
assert.strictEqual(tracking.liftingDetail, "full");
assert(Object.values(tracking.modules).every(Boolean));
assert(Object.values(tracking.dailyMetrics).every(Boolean));
assert.strictEqual(env.storage.writes, 0, "virtual tracking default wrote storage");

// Exact named bundles and Custom retention.
const full = env.context.p950BuildTrackingPreset("full_coaching");
const strength = env.context.p950BuildTrackingPreset("strength_tracking");
assert.strictEqual(full.modules.coachingInsights, true, "Full Coaching must enable coaching insights");
assert.strictEqual(env.context.p950DetectTrackingPreset(full), "full_coaching", "exact Full bundle was not detected as Full Coaching");
const fullWithoutCoaching = JSON.parse(JSON.stringify(full));
fullWithoutCoaching.modules.coachingInsights = false;
assert.strictEqual(env.context.p950DetectTrackingPreset(fullWithoutCoaching), "custom", "Full minus Coaching Insights was not detected as Custom");
fullWithoutCoaching.modules.coachingInsights = true;
assert.strictEqual(env.context.p950DetectTrackingPreset(fullWithoutCoaching), "full_coaching", "restored exact Full bundle did not return to Full Coaching");
assert.deepStrictEqual(JSON.parse(JSON.stringify(strength.modules)), {
  habits: false, basketball: false, recurringAdherence: false, activeCalories: false,
  dailyNotes: false, sessionNotes: true, coachingInsights: true
});
assert.deepStrictEqual(JSON.parse(JSON.stringify(strength.dailyMetrics)), {
  weight: true, sleep: true, protein: false, water: false,
  energy: true, hunger: false, bowelMovement: false
});
const retained = env.context.p950BuildTrackingPreset("custom", strength);
assert.strictEqual(retained.preset, "custom");
assert.deepStrictEqual(JSON.parse(JSON.stringify(retained.modules)), JSON.parse(JSON.stringify(strength.modules)));

// Normalization preserves unknown profile/preference/tracking fields and safely
// fills malformed known tracking values.
const malformedProfile = env.context.p950GetDefaultUserProfile();
malformedProfile.futureTop = { keep: true };
malformedProfile.preferences.futurePreference = 42;
malformedProfile.preferences.tracking = {
  preset: "unsafe", liftingDetail: "minimal", futureTracking: { keep: true },
  modules: { habits: "yes", futureModule: "keep" }, dailyMetrics: null,
  timeline: [{ effectiveDate: "bad-date" }]
};
const normalized = env.context.p950NormalizeUserProfile(malformedProfile);
assert.deepStrictEqual(JSON.parse(JSON.stringify(normalized.futureTop)), { keep: true });
assert.strictEqual(normalized.preferences.futurePreference, 42);
assert.deepStrictEqual(JSON.parse(JSON.stringify(normalized.preferences.tracking.futureTracking)), { keep: true });
assert.strictEqual(normalized.preferences.tracking.liftingDetail, "full");
assert.strictEqual(normalized.preferences.tracking.modules.habits, true);
assert.strictEqual(normalized.preferences.tracking.modules.futureModule, "keep");
assert.strictEqual(normalized.preferences.tracking.timeline.length, 0);

// Saves use complete local-date snapshots, replace a same-day entry, append a
// future day, and resolve dates before the first entry to virtual Full.
env = createProfileContext();
env.context.p950SaveTrackingPreferences(full, "2026-09-13");
env.context.p950SaveTrackingPreferences(strength, "2026-09-13");
let saved = JSON.parse(env.storage.api.getItem("mf-user-profile"));
assert.strictEqual(saved.preferences.tracking.timeline.length, 1);
assert.strictEqual(saved.preferences.tracking.timeline[0].preset, "strength_tracking");
env.context.p950SaveTrackingPreferences(full, "2026-09-15");
saved = JSON.parse(env.storage.api.getItem("mf-user-profile"));
assert.deepStrictEqual(saved.preferences.tracking.timeline.map(entry => entry.effectiveDate), ["2026-09-13", "2026-09-15"]);
assert.strictEqual(env.context.p950GetTrackingSnapshotForDate("2026-09-12").virtualDefault, true);
assert.strictEqual(env.context.p950GetTrackingSnapshotForDate("2026-09-14").preset, "strength_tracking");
assert.strictEqual(env.context.p950GetTrackingSnapshotForDate("2026-09-15").preset, "full_coaching");
const localDate = new Date(2026, 8, 13, 23, 30, 0);
assert.strictEqual(env.context.p950LocalDateKey(localDate), "2026-09-13", "effective dates are not local calendar dates");

// Preference changes never mutate the recurring definition or occurrence
// stores; they only change whether those records are collected/interpreted.
const recurringItemsRaw = '{"schemaVersion":1,"items":{"zepbound":{"enabled":true,"schedule":{"type":"weekly","interval":1,"weekdays":[0],"anchorDate":"2026-09-13"}}}}';
const recurringEventsRaw = '{"schemaVersion":1,"events":{"zepbound|2026-09-13":{"status":"completed"}}}';
const recurringAuthority = createProfileContext({ "mf-recurring-items": recurringItemsRaw, "mf-recurring-events": recurringEventsRaw });
recurringAuthority.context.p950SaveTrackingPreferences(strength, "2026-09-13");
assert.strictEqual(recurringAuthority.storage.api.getItem("mf-recurring-items"), recurringItemsRaw);
assert.strictEqual(recurringAuthority.storage.api.getItem("mf-recurring-events"), recurringEventsRaw);

// Reset Profile preserves tracking. Reset Tracking appends/replaces today's
// Full snapshot without deleting prior intent.
env.elements.set("p950ResetConfirmPanel", { style: {}, scrollIntoView() {} });
env.elements.set("p950TrackingResetConfirmPanel", { style: {}, scrollIntoView() {} });
env.context.p950RenderUserProfile = function() {};
env.context.p950ApplyTextSize = function() {};
env.context.p950ShowProfileResult = function() {};
env.context.p950ShowTrackingResult = function() {};
env.context.p950RenderTrackingPreferences = function() {};
env.context.p950ApplyTrackingPreferencesToUi = function() {};
const beforeResetTimeline = JSON.parse(env.storage.api.getItem("mf-user-profile")).preferences.tracking.timeline;
assert(env.context.p950ConfirmResetProfile().ok);
saved = JSON.parse(env.storage.api.getItem("mf-user-profile"));
assert.deepStrictEqual(saved.preferences.tracking.timeline, beforeResetTimeline);
assert(env.context.p950ConfirmResetTrackingPreferences().ok);
saved = JSON.parse(env.storage.api.getItem("mf-user-profile"));
assert(saved.preferences.tracking.timeline.some(entry => entry.preset === "full_coaching"));
assert(saved.preferences.tracking.timeline.some(entry => entry.effectiveDate === "2026-09-13"), "prior timeline was erased");

// The Profile UI exposes the approved presets/toggles without adding a fifth
// Tools tab or changing primary navigation, and collection gating is write-free.
function uiNode(dataset = {}) {
  const classes = new Set();
  return { dataset, attributes: {}, style: {}, classList: { toggle(name, on) { on ? classes.add(name) : classes.delete(name); }, contains(name) { return classes.has(name); } }, setAttribute(name, value) { this.attributes[name] = value; }, addEventListener() {} };
}
const recurringRaw = JSON.stringify({ schemaVersion: 1, items: { zepbound: { enabled: true, paused: true } } });
const uiEnv = createProfileContext({ "mf-recurring-items": recurringRaw });
const customOff = uiEnv.context.p950BuildTrackingPreset("full_coaching");
Object.keys(customOff.modules).forEach(key => { customOff.modules[key] = false; });
Object.keys(customOff.dailyMetrics).forEach(key => { customOff.dailyMetrics[key] = false; });
customOff.preset = "custom";
assert(uiEnv.context.p950SaveTrackingPreferences(customOff, uiEnv.context.p950LocalDateKey(new Date())).ok);
const sections = ["metrics", "habits", "basketball", "recurring", "notes"].map(id => [id, uiNode()]);
sections.forEach(([id, node]) => uiEnv.elements.set(`p6sec-${id}`, node));
const metricNodes = ["weight", "sleep", "energy"].map(key => uiNode({ mfCollectionMetric: key }));
const moduleNodes = ["activeCalories", "sessionNotes"].map(key => uiNode({ mfCollectionModule: key }));
const noteNodes = [uiNode()], coachingNodes = [uiNode()];
uiEnv.selectors.set("[data-mf-collection-metric]", metricNodes);
uiEnv.selectors.set("[data-mf-collection-module]", moduleNodes);
uiEnv.selectors.set(".wo-note-input,.mf-basketball-drill-notes", noteNodes);
uiEnv.selectors.set(".wo-ex-coach,.p5-hist-wrap,#woRecsSection,#p949ReviewCard,.p7-action-summary,.mf-basketball-last-trend,.mf-basketball-guidance", coachingNodes);
uiEnv.storage.resetWrites();
uiEnv.context.p950ApplyTrackingPreferencesToUi();
assert(metricNodes.every(node => node.classList.contains("mf-tracking-hidden")), "disabled Daily metrics remained visible");
assert(sections.every(([, node]) => node.classList.contains("mf-tracking-hidden")), "disabled collection section remained visible");
assert(moduleNodes.concat(noteNodes, coachingNodes).every(node => node.classList.contains("mf-tracking-hidden")), "disabled note/calorie/coaching control remained visible");
assert.strictEqual(uiEnv.storage.writes, 0, "rendering collection preferences wrote storage");
assert.strictEqual(uiEnv.storage.api.getItem("mf-recurring-items"), recurringRaw, "master recurring preference mutated domain configuration");
assert.strictEqual((html.match(/class="tab-btn/g) || []).length, 5, "primary navigation changed");
assert.strictEqual((html.match(/class="mf-sync-nav-btn/g) || []).length, 4, "a fifth Tools tab was added");
assert(html.includes('data-mf-settings-section="tracking"') && html.includes("Full Coaching") && html.includes("Strength Tracking") && html.includes("Custom"));
assert(html.includes('id="screen-program"') && html.includes('id="screen-history"') && html.includes('id="screen-analytics"'));
assert(css.includes(".mf-tracking-hidden{display:none!important;}") && css.includes("@media(max-width:420px)"));
assert(css.includes(".mf-tracking-group{min-width:0;margin:18px 0 0;padding:0;border:0;}"), "Tracking preference groups still render an outer fieldset border");
assert(css.includes("grid-template-columns:minmax(0,1fr)") && css.includes("min-inline-size:0;max-inline-size:100%"), "Basketball form controls lack mobile intrinsic-width containment");
assert(css.includes("align-items:center;justify-content:center") && css.includes("text-align:center;overflow-wrap:anywhere"), "Tracking preset card content is not centered with safe wrapping");
assert(css.includes(".mf-tracking-preset{min-height:68px;}"), "Stacked mobile tracking preset cards do not retain a consistent minimum height");
assert(css.includes(".export-range-row{margin-bottom:9px;}"), "AI Sync range and included-data controls lack deliberate separation");

// Collection UI is resolved from the selected record date. Navigating between
// dates must not reuse the wall-clock/current snapshot in either direction.
function buildDateUi(initialPreset, laterPreset) {
  const dated = createProfileContext();
  dated.context.p950SaveTrackingPreferences(dated.context.p950BuildTrackingPreset(initialPreset), "2026-09-10");
  dated.context.p950SaveTrackingPreferences(dated.context.p950BuildTrackingPreset(laterPreset), "2026-09-15");
  const metrics = ["weight", "protein", "energy"].map(key => uiNode({ mfCollectionMetric: key }));
  const modules = ["activeCalories", "sessionNotes"].map(key => uiNode({ mfCollectionModule: key }));
  ["metrics", "habits", "basketball", "recurring", "notes"].forEach(id => dated.elements.set(`p6sec-${id}`, uiNode()));
  dated.selectors.set("[data-mf-collection-metric]", metrics); dated.selectors.set("[data-mf-collection-module]", modules);
  dated.selectors.set(".wo-note-input,.mf-basketball-drill-notes", []); dated.selectors.set(".wo-ex-coach,.p5-hist-wrap,#woRecsSection,#p949ReviewCard,.p7-action-summary,.mf-basketball-last-trend,.mf-basketball-guidance", []);
  return { dated, metrics, modules };
}
let datedUi = buildDateUi("strength_tracking", "full_coaching");
datedUi.dated.context.p950ApplyTrackingPreferencesToUi("2026-09-10");
assert(datedUi.metrics[1].classList.contains("mf-tracking-hidden") && datedUi.modules[0].classList.contains("mf-tracking-hidden"), "historical Strength date used current Full controls");
datedUi.dated.context.p950ApplyTrackingPreferencesToUi("2026-09-15");
assert(!datedUi.metrics[1].classList.contains("mf-tracking-hidden") && !datedUi.modules[0].classList.contains("mf-tracking-hidden"), "current Full date stayed hidden after navigation");
datedUi = buildDateUi("full_coaching", "strength_tracking");
datedUi.dated.context.p950ApplyTrackingPreferencesToUi("2026-09-10");
assert(!datedUi.metrics[1].classList.contains("mf-tracking-hidden") && !datedUi.modules[0].classList.contains("mf-tracking-hidden"), "historical Full date used current Strength controls");
datedUi.dated.context.p950ApplyTrackingPreferencesToUi("2026-09-15");
assert(datedUi.metrics[1].classList.contains("mf-tracking-hidden") && datedUi.modules[0].classList.contains("mf-tracking-hidden"), "current Strength date stayed visible after navigation");

// Exercise the real Daily save function with disabled fields. New records omit
// neutral slider defaults; existing records retain every disabled known field.
const preserveWorkoutFn = extractBalanced(workoutSource, "function p85PreserveDormantWorkoutFields");
const executeSaveFn = extractBalanced(workoutSource, "function p85ExecuteSave");
function runDailySave(initialDaily, initialWorkout, options = {}) {
  const selectedDate = options.selectedDate || "2026-09-10", dayKey = `day-${selectedDate}`, resolvedDates = [], workoutDates = [];
  const storage = makeStorage({
    ...(initialDaily ? { [dayKey]: JSON.stringify(initialDaily) } : {}),
    ...(initialWorkout ? { [`${dayKey}-wo`]: JSON.stringify(initialWorkout) } : {})
  });
  const values = Object.assign({ woDaySelect: "0", weightIn: "", sleepIn: "", proteinIn: "", waterIn: "", bmNotes: "", moodSlider: "5", hungerSlider: "5", dayNotes: "", saveBtn: "" }, options.values || {});
  const elements = new Map(Object.entries(values).map(([id, value]) => [id, { id, value, style: { display: "none" }, textContent: "", scrollIntoView() {} }]));
  elements.set("p949ReviewCard", { style: { display: "none" }, scrollIntoView() {} });
  const snapshotForDate = options.snapshotForDate || (() => ({ modules: { habits: false, recurringAdherence: false, dailyNotes: false, activeCalories: false, sessionNotes: false }, dailyMetrics: { weight: false, sleep: false, protein: false, water: false, bowelMovement: false, energy: false, hunger: false } }));
  const parts = selectedDate.split("-").map(Number), selectedLocalDate = new Date(parts[0], parts[1] - 1, parts[2], 12);
  const context = { console, localStorage: storage.api, document: { getElementById(id) { return elements.get(id) || { value: "", style: {} }; } }, tDate: selectedLocalDate, toggleStates: { bm: "yes", wo: "yes", zep: "taken" }, habitState: { "habit-new": { completed: false } }, logGym: "home",
    dKey() { return dayKey; }, p950GetTrackingSnapshotForDate(date) { resolvedDates.push(date); return snapshotForDate(date); }, p950IsTrackingEnabled(path, date) { resolvedDates.push(date); const snap = snapshotForDate(date), bits = path.split("."); return !!(snap[bits[0]] && snap[bits[0]][bits[1]]); }, p950LocalDateKey(value) { if(typeof value === "string") return value; return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`; }, mfWorkoutReadActiveCalories() { return { ok: true, value: null }; }, collectWoData(date) { workoutDates.push(date); return options.workoutCollected || { gym: "home", dayIdx: "0", dayName: "Day", exercises: { lift: { sets: [{ wt: "40", reps: "8", rir: "2" }] } } }; }, isTodaySelected() { return false; }, clearDraft() {}, todayHasSavedEntry() { return true; }, mfSetIconLabel() {}, updateSaveBtn() {}, renderHistory() {}, p949BuildWorkoutReview() { return {}; }, p949RenderReview() {}, p949HideReview() {}, setTimeout(fn) { fn(); } };
  vm.createContext(context); vm.runInContext(`${preserveWorkoutFn}\n${executeSaveFn}`, context); context.p85ExecuteSave();
  return { daily: JSON.parse(storage.api.getItem(dayKey)), workout: JSON.parse(storage.api.getItem(`${dayKey}-wo`)), resolvedDates, workoutDates };
}
const strengthSnapshot = { modules: { habits: false, recurringAdherence: false, dailyNotes: false, activeCalories: false, sessionNotes: true }, dailyMetrics: { weight: true, sleep: true, protein: false, water: false, bowelMovement: false, energy: true, hunger: false } };
const fullSnapshot = { modules: { habits: true, recurringAdherence: true, dailyNotes: true, activeCalories: true, sessionNotes: true }, dailyMetrics: { weight: true, sleep: true, protein: true, water: true, bowelMovement: true, energy: true, hunger: true } };
const allOffSnapshot = { modules: { habits: false, recurringAdherence: false, dailyNotes: false, activeCalories: false, sessionNotes: false }, dailyMetrics: { weight: false, sleep: false, protein: false, water: false, bowelMovement: false, energy: false, hunger: false } };
let preserved = runDailySave({ date: "2026-09-10", weight: "210", mood: "8", hunger: "3", notes: "keep daily", habits: { "habit-old": { completed: true } }, zep: "taken" }, { gym: "home", dayIdx: "0", exercises: { lift: { sets: [{ wt: "35", reps: "8", rir: "2" }], note: "keep lift note" } }, activeCalories: 300 }, { values: { weightIn: "211", moodSlider: "9" }, snapshotForDate: date => date === "2026-09-10" ? strengthSnapshot : fullSnapshot, workoutCollected: { gym: "home", dayIdx: "0", dayName: "Day", exercises: { lift: { sets: [], note: "edited lift note" } } } });
assert.strictEqual(preserved.daily.mood, "9"); assert.strictEqual(preserved.daily.hunger, "3"); assert.strictEqual(preserved.daily.notes, "keep daily"); assert.strictEqual(preserved.daily.weight, "211");
assert.deepStrictEqual(preserved.daily.habits, { "habit-old": { completed: true } });
assert.strictEqual(preserved.workout.activeCalories, 300); assert.strictEqual(preserved.workout.exercises.lift.note, "edited lift note");
assert(preserved.resolvedDates.every(date => date === "2026-09-10") && preserved.workoutDates.every(date => date === "2026-09-10"), "historical Daily save consulted wall-clock preferences");
const fresh = runDailySave(null, null, { snapshotForDate: date => date === "2026-09-10" ? strengthSnapshot : fullSnapshot });
assert(!Object.prototype.hasOwnProperty.call(fresh.daily, "hunger"), "historical Strength save synthesized disabled Hunger");
assert(!Object.prototype.hasOwnProperty.call(fresh.daily, "notes") && !Object.prototype.hasOwnProperty.call(fresh.daily, "habits"));
const freshAllOff = runDailySave(null, null, { snapshotForDate: () => allOffSnapshot });
assert(!Object.prototype.hasOwnProperty.call(freshAllOff.daily, "mood") && !Object.prototype.hasOwnProperty.call(freshAllOff.daily, "hunger"), "disabled neutral 5 values were synthesized");
const inverseDaily = runDailySave(null, null, { values: { moodSlider: "7", hungerSlider: "4", dayNotes: "historical Full edit" }, snapshotForDate: date => date === "2026-09-10" ? fullSnapshot : strengthSnapshot, workoutCollected: { gym: "home", dayIdx: "0", dayName: "Day", exercises: { lift: { sets: [], note: "editable Full note" } }, activeCalories: 444 } });
assert.strictEqual(inverseDaily.daily.mood, "7"); assert.strictEqual(inverseDaily.daily.hunger, "4"); assert.strictEqual(inverseDaily.daily.notes, "historical Full edit");
assert.strictEqual(inverseDaily.workout.activeCalories, 444); assert.strictEqual(inverseDaily.workout.exercises.lift.note, "editable Full note");
assert(inverseDaily.resolvedDates.every(date => date === "2026-09-10") && inverseDaily.workoutDates.every(date => date === "2026-09-10"), "historical Full edit used today's Strength snapshot");

// The real workout collector and preservation helper receive one explicit
// record date for note/calorie inclusion in both directions.
const workoutFields = { woDaySelect: { value: "0" }, mfWorkoutActiveCalories: { value: "555", setCustomValidity() {} } };
const workoutContext = { document: { getElementById(id) { return workoutFields[id] || null; }, querySelector(selector) { if(selector.includes('data-field="wt"'))return { value: "40" };if(selector.includes('data-field="reps"'))return { value: "8" };if(selector.includes('data-field="rir"'))return { value: "2" };if(selector.includes('data-field="exnote"'))return { value: "dated note" };return null; } }, logGym: "home", tDate: new Date(2026,8,15,12), getResolvedDays() { return [{ _dayIdx: 0, name: "Day", exercises: [{ id: "lift", sets: "1" }] }]; }, getF(id,key,fallback) { return fallback; }, p950LocalDateKey() { return "2026-09-15"; }, p950IsTrackingEnabled(path,date) { return date === "2026-09-10"; } };
vm.createContext(workoutContext); vm.runInContext(`${extractBalanced(workoutSource,"function mfWorkoutReadActiveCalories")}\n${extractBalanced(workoutSource,"function collectWoData")}\n${preserveWorkoutFn}`, workoutContext);
const workoutOff = workoutContext.collectWoData("2026-09-15");
assert(!Object.prototype.hasOwnProperty.call(workoutOff,"activeCalories") && !Object.prototype.hasOwnProperty.call(workoutOff.exercises.lift,"note"));
const workoutOffPreserved = workoutContext.p85PreserveDormantWorkoutFields(workoutOff,{activeCalories:333,exercises:{lift:{sets:[],note:"stored note"}}},"2026-09-15");
assert.strictEqual(workoutOffPreserved.activeCalories,333); assert.strictEqual(workoutOffPreserved.exercises.lift.note,"stored note");
const workoutOn = workoutContext.collectWoData("2026-09-10");
assert.strictEqual(workoutOn.activeCalories,555); assert.strictEqual(workoutOn.exercises.lift.note,"dated note");

// Basketball edits use the same preservation rule for session/drill notes and
// structured active calories while allowing new disabled records to stay sparse.
const basketballPreferenceDates = [];
const basketballPreserveContext = { mfBasketballClone: value => JSON.parse(JSON.stringify(value)), mfBasketballDateKey: value => typeof value === "string" ? value : "2026-09-15", p950IsTrackingEnabled(path,date) { basketballPreferenceDates.push(date); return date === "2026-09-10"; } };
vm.createContext(basketballPreserveContext); vm.runInContext(extractBalanced(basketballSource, "function mfBasketballPreserveDormantFields"), basketballPreserveContext);
const oldBasketball = { date: "2026-09-15", activeCalories: 425, notes: "keep session", drills: [{ drillId: "d1", notes: "keep drill" }] };
const keptBasketball = basketballPreserveContext.mfBasketballPreserveDormantFields({ date: "2026-09-15", activeCalories: 999, notes: "hidden edit", drills: [{ drillId: "d1", notes: "hidden drill edit" }] }, oldBasketball, "2026-09-15");
assert.strictEqual(keptBasketball.activeCalories, 425); assert.strictEqual(keptBasketball.notes, "keep session"); assert.strictEqual(keptBasketball.drills[0].notes, "keep drill");
const sparseBasketball = basketballPreserveContext.mfBasketballPreserveDormantFields({ date: "2026-09-15", activeCalories: 500, notes: "omit", drills: [{ drillId: "d1", notes: "omit drill" }] }, null, "2026-09-15");
assert(!Object.prototype.hasOwnProperty.call(sparseBasketball,"activeCalories") && !Object.prototype.hasOwnProperty.call(sparseBasketball,"notes") && !Object.prototype.hasOwnProperty.call(sparseBasketball.drills[0],"notes"));
const editableBasketball = basketballPreserveContext.mfBasketballPreserveDormantFields({ date: "2026-09-10", activeCalories: 500, notes: "updated session", drills: [{ drillId: "d1", notes: "updated drill" }] }, oldBasketball, "2026-09-10");
assert.strictEqual(editableBasketball.activeCalories,500); assert.strictEqual(editableBasketball.notes,"updated session"); assert.strictEqual(editableBasketball.drills[0].notes,"updated drill");
assert(basketballPreferenceDates.includes("2026-09-15") && basketballPreferenceDates.includes("2026-09-10"), "Basketball preservation ignored the session date");

// Habit denominators exclude disabled dates and conservatively exclude a full
// weekly-count target whenever any day in that week is preference-off.
const habitMemory = new Map([["day-2026-09-08", JSON.stringify({ habits: { daily: { completed: true }, weekly: { completed: true } } })]]);
const habitContext = { Date, localStorage: { getItem(key) { return habitMemory.get(key) || null; } }, p950IsTrackingEnabled(path, date) { return !(date >= "2026-09-10" && date <= "2026-09-12"); } };
habitContext.window = habitContext; vm.createContext(habitContext);
const habitTokens = ["function p960Clone", "function p960DateKey", "function p960ParseDate", "function p960AddDays", "function p960NormalizeSchedule", "function p960GetHabitWeekRange", "function p960IsWithinActiveRange", "function p960IsHabitDueOnDate", "function p960ReadDay", "function p960GetWeeklyHabitProgress", "function p960EarliestHistoricalDate", "function p960HabitEligibilityStart", "function p960AnalyzeHabit"];
vm.runInContext('const P960_SCHEDULE_TYPES=["daily","weekdays","weekly_count"];\n'+habitTokens.map(token => extractBalanced(habitsSource, token)).join("\n"), habitContext);
const dailyAnalysis = habitContext.p960AnalyzeHabit({ id: "daily", name: "Daily", icon: "check", active: true, schedule: { type: "daily" }, createdAt: "2026-09-08T12:00:00.000Z", archivedAt: null, legacyEligibilityInferred: false }, "2026-09-08", "2026-09-14");
assert.strictEqual(dailyAnalysis.eligible, 4); assert.strictEqual(dailyAnalysis.preferenceExcluded, 3); assert.strictEqual(dailyAnalysis.completed, 1);
const weeklyAnalysis = habitContext.p960AnalyzeHabit({ id: "weekly", name: "Weekly", icon: "check", active: true, schedule: { type: "weekly_count", targetCount: 1, weekStartsOn: 2 }, createdAt: "2026-09-08T12:00:00.000Z", archivedAt: null, legacyEligibilityInferred: false }, "2026-09-08", "2026-09-16");
assert.strictEqual(weeklyAnalysis.eligible, 0); assert.strictEqual(weeklyAnalysis.preferenceExcluded, 1);

// Recurring due dates inside preference-off intervals are excluded rather than
// becoming unresolved misses; pause/disable remains a separate domain state.
const recurringContext = { p9510GetItem() { return { enabled: true, graceDays: 1, schedule: { interval: 1 } }; }, p9510DateKey() { return "2026-09-16"; }, p9510ScheduleBase() { return "2026-09-10"; }, p9510AddDays(key, days) { const p=key.split("-").map(Number),d=new Date(p[0],p[1]-1,p[2],12);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }, p9510GetNextDueDate() { return "2026-09-10"; }, p9510WasPaused() { return false; }, p9510ResolveOccurrence() { return { status: "unresolved" }; }, p9510DayDiff(a,b) { return Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/86400000); }, p950IsTrackingEnabled(path,date) { return date !== "2026-09-10"; } };
vm.createContext(recurringContext); vm.runInContext(extractBalanced(recurringSource, "function p9510GetAdherenceRange"), recurringContext);
const recurringSummary = recurringContext.p9510GetAdherenceRange("zepbound", { start: "2026-09-09", end: "2026-09-16" });
assert.strictEqual(recurringSummary.preferenceExcluded, 1); assert.strictEqual(recurringSummary.scheduledOccurrences, 0); assert.strictEqual(recurringSummary.unresolvedLate, 0); assert.strictEqual(recurringSummary.adherencePercent, null);

// Export is compact, deterministic, and reports off intervals without dumping
// raw timeline JSON or treating intentional absence as failure.
const exportEnv = createProfileContext();
const exportOff = exportEnv.context.p950BuildTrackingPreset("strength_tracking");
exportEnv.context.p950SaveTrackingPreferences(exportOff, "2026-09-10"); exportEnv.context.p950SaveTrackingPreferences(full, "2026-09-13");
const trackingExport = exportEnv.context.p950BuildTrackingPreferencesExport("2026-09-10", "2026-09-15");
assert(trackingExport.includes("--- TRACKING PREFERENCES ---") && trackingExport.includes("2026-09-10 through 2026-09-12"));
assert(trackingExport.includes("Blank values during preference-off periods are neutral") && !trackingExport.includes('"timeline"'));
assert(exportSource.includes("p950BuildTrackingPreferencesExport") && basketballSource.includes("no negative adherence inference"));

// Sync rejects profile/tracking mutation and new proposals for disabled domains
// before writes, without deleting existing pending proposal state.
const syncStorage = makeStorage({ "mf-habit-proposal": "existing-habit", "mf-basketball-proposal": "existing-basketball" });
const syncInput = { value: "" }, syncResult = { style: {}, textContent: "" };
const syncContext = { document: { getElementById(id) { return id === "syncInput" ? syncInput : syncResult; } }, localStorage: syncStorage.api, p950IsTrackingEnabled() { return false; }, mfBasketballLegacySyncExtension: null };
vm.createContext(syncContext); vm.runInContext(extractBalanced(basketballSource, "function mfBasketballHandleSyncExtension"), syncContext);
const rejectionMessages=[];
for (const payload of [{ trackingPreferences: { preset: "full_coaching" } }, { habitProposal: {} }, { basketballProposal: {} }]) {
  syncInput.value = `MARCUSFIT_UPDATE_START\n${JSON.stringify(payload)}\nMARCUSFIT_UPDATE_END`; syncStorage.resetWrites();
  assert.strictEqual(syncContext.mfBasketballHandleSyncExtension(() => { throw new Error("core Sync ran"); }), true); assert.strictEqual(syncStorage.writes, 0);
  rejectionMessages.push(syncResult.textContent);
}
assert.strictEqual(syncStorage.api.getItem("mf-habit-proposal"), "existing-habit"); assert.strictEqual(syncStorage.api.getItem("mf-basketball-proposal"), "existing-basketball");
assert(/user-controlled/i.test(rejectionMessages[0]) && /Habit tracking is intentionally off/i.test(rejectionMessages[1]) && /Basketball tracking is intentionally off/i.test(rejectionMessages[2]));
assert(!profileSource.includes("p960ProposalReview") && !profileSource.includes("mfBasketballProposalReview"), "collection gating captured proposal review UI");
assert(html.includes('id="mfBasketballToolsProposalStatus"') && basketballSource.includes('document.getElementById("mfBasketballToolsProposalStatus")'), "Basketball proposal review is not available from Tools while collection is hidden");

// Profile-backed backup remains schema 1 and carries the raw tracking timeline
// byte-for-byte. An old profile remains virtual Full with no fabricated entry.
const backupProfile = JSON.stringify({ schemaVersion: 1, preferences: { tracking: exportEnv.context.p950GetTrackingPreferences() } });
const backupStorage = { "mf-user-profile": backupProfile };
Object.defineProperties(backupStorage, { getItem: { enumerable: false, value(key) { return Object.prototype.hasOwnProperty.call(this,key)?this[key]:null; } } });
const backupContext = { APP_VERSION: "10.11.0", localStorage: backupStorage };
vm.createContext(backupContext);
vm.runInContext('const SCHEMA_VERSION=1,OVR="mf-overrides",DRAFT_KEY="mf-current-draft",LIFECYCLE_KEY="mf-exercise-state",RECS_KEY="mf-recommendations",AI_PREFS_KEY="mf-ai-coaching-preferences",USER_PROFILE_KEY="mf-user-profile",ONBOARDING_KEY="mf-onboarding",PROGRAM_PROPOSAL_KEY="mf-program-proposal";\n'+extractBalanced(backupSource,"function p8IsMarcusFitKey")+"\n"+extractBalanced(backupSource,"function p8GetMarcusFitKeys")+"\n"+extractBalanced(backupSource,"function p8BuildBackup"), backupContext);
const backup = backupContext.p8BuildBackup(); assert.strictEqual(backup.schemaVersion, 1); assert.strictEqual(backup.data["mf-user-profile"], backupProfile);
assert(backupSource.includes("userProfileTrackingPreset") && backupSource.includes("userProfileTrackingTimelineEntries"));
assert(!/p950SaveTrackingPreferences\s*\(/.test(extractBalanced(backupSource, "function p8ExecuteRestore")), "restore fabricates tracking timeline entries");

// Onboarding's existing nested preference merge preserves tracking verbatim.
const onboardingEnv = createProfileContext();
onboardingEnv.context.p953ValidateCompleteDraft = draft => ({ normalized: draft });
vm.runInContext(extractBalanced(onboardingSource, "function p953BuildUserProfileFromOnboarding"), onboardingEnv.context);
const existingProfile = onboardingEnv.context.p950GetDefaultUserProfile(); existingProfile.preferences.tracking = exportEnv.context.p950GetTrackingPreferences();
const onboardingMerged = onboardingEnv.context.p953BuildUserProfileFromOnboarding({ profile: { displayName: "M", heightFeet: 6, heightInches: 0, weightUnit: "lb", distanceUnit: "mi", firstDayOfWeek: "sunday" }, goals: {} }, existingProfile);
assert.deepStrictEqual(JSON.parse(JSON.stringify(onboardingMerged.preferences.tracking)), JSON.parse(JSON.stringify(existingProfile.preferences.tracking)));

// Protected core and architecture invariants directly relevant to this phase.
const canonicalCoreHash = crypto.createHash("sha256").update(coreSyncSource.replace(/\r\n/g,"\n")).digest("hex");
assert.strictEqual(canonicalCoreHash, "14245321c8f47de5c152d011a08877ef4821e353c15bc3ed72c0490aa767c598");
assert.strictEqual((html.match(/<script\s+src="[^"]+"\s+defer><\/script>/g) || []).length, 22);
assert(!/trackingLevel|evidenceKind|summary records|Simple Fitness Log|Minimal lifting/i.test(profileSource+workoutSource));
assert(dailySource.includes("collectWoData(recordDate)") && dailySource.includes("p950ApplyTrackingPreferencesToUi(p950LocalDateKey(tDate))"), "Daily draft/form gating is not selected-date effective");
assert(workoutSource.includes('p950IsTrackingEnabled("modules.sessionNotes",trackingDate)') && workoutSource.includes('p950IsTrackingEnabled("modules.activeCalories",trackingDate)') && workoutSource.includes("p950GetTrackingSnapshotForDate(recordDate)"), "Workout collection/save is not record-date effective");
assert(basketballSource.includes("mfBasketballPreserveDormantFields(input,existing,recordDate)") && basketballSource.includes("mfBasketballApplyRecordTrackingToForm(session.date,true)"), "Basketball edit/preservation is not session-date effective");

console.log("MarcusFit 10.11.0 tracking preferences: PASS");
