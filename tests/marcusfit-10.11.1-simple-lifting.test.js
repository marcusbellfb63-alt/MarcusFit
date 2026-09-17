const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const profileSource = fs.readFileSync(path.join(root, "assets/js/state/04-runtime-state-profile-preferences.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const workoutSource = fs.readFileSync(path.join(root, "assets/js/features/10-workout-logging.js"), "utf8");
const dailySource = fs.readFileSync(path.join(root, "assets/js/features/08-program-daily.js"), "utf8");
const historySource = fs.readFileSync(path.join(root, "assets/js/features/14-history.js"), "utf8");
const progressionSource = fs.readFileSync(path.join(root, "assets/js/features/18-progression-corrections.js"), "utf8");
const statsSource = fs.readFileSync(path.join(root, "assets/js/features/15-stats.js"), "utf8");
const exportSource = fs.readFileSync(path.join(root, "assets/js/sync/11-ai-export.js"), "utf8");

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

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  let writes = 0;
  return {
    api: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { writes++; values.set(key, String(value)); },
      removeItem(key) { writes++; values.delete(key); },
      key(index) { return [...values.keys()][index] || null; },
      get length() { return values.size; }
    },
    get writes() { return writes; },
    reset() { writes = 0; }
  };
}

function profileEnvironment(initial = {}) {
  const local = storage(initial);
  const context = { APP_VERSION: "10.11.1", console, localStorage: local.api, document: { documentElement: { setAttribute() {} }, getElementById() { return null; }, querySelectorAll() { return []; } } };
  context.window = context;
  vm.createContext(context);
  const start = profileSource.indexOf('const USER_PROFILE_KEY = "mf-user-profile"');
  const end = profileSource.indexOf("// ── END PHASE 9.5.0", start);
  assert(start >= 0 && end > start);
  vm.runInContext(profileSource.slice(start, end), context);
  return { context, local };
}

let env = profileEnvironment();
assert.strictEqual(env.context.p950GetTrackingPreferences().liftingDetail, "full");
assert.strictEqual(env.local.writes, 0, "missing tracking preference must remain a virtual Detailed read");
assert.strictEqual(env.context.p950NormalizeTrackingPreferences({ liftingDetail: "full" }).liftingDetail, "full");
assert.strictEqual(env.context.p950NormalizeTrackingPreferences({ liftingDetail: "simple" }).liftingDetail, "simple");
assert.strictEqual(env.context.p950NormalizeTrackingPreferences({ liftingDetail: "unknown" }).liftingDetail, "full");

const fullSimple = env.context.p950BuildTrackingPreset("full_coaching", { liftingDetail: "simple" });
const strengthSimple = env.context.p950BuildTrackingPreset("strength_tracking", fullSimple);
const customSimple = env.context.p950BuildTrackingPreset("custom", strengthSimple);
assert.strictEqual(fullSimple.preset, "full_coaching");
assert.strictEqual(strengthSimple.preset, "strength_tracking");
assert.strictEqual(customSimple.preset, "custom");
assert.strictEqual(fullSimple.liftingDetail, "simple");
assert.strictEqual(strengthSimple.liftingDetail, "simple");
assert.strictEqual(customSimple.liftingDetail, "simple");
assert.strictEqual(env.context.p950DetectTrackingPreset(fullSimple), "full_coaching", "lifting detail must be orthogonal to named presets");
assert.strictEqual(env.context.p950DetectTrackingPreset(strengthSimple), "strength_tracking", "Simple must not force Strength Tracking to Custom");

assert(env.context.p950SaveTrackingPreferences(fullSimple, "2026-09-15").ok);
assert(env.context.p950SaveTrackingPreferences(strengthSimple, "2026-09-15").ok);
assert.strictEqual(env.context.p950GetTrackingPreferences().timeline.length, 1, "same-date save did not replace");
assert.strictEqual(env.context.p950GetTrackingSnapshotForDate("2026-09-14").liftingDetail, "full", "pre-timeline dates must resolve Detailed");
assert.strictEqual(env.context.p950GetTrackingSnapshotForDate("2026-09-15").liftingDetail, "simple");
const fullDetailed = env.context.p950BuildTrackingPreset("full_coaching", { liftingDetail: "full" });
assert(env.context.p950SaveTrackingPreferences(fullDetailed, "2026-09-16").ok);
assert.deepStrictEqual(Array.from(env.context.p950GetTrackingPreferences().timeline, entry => entry.effectiveDate), ["2026-09-15", "2026-09-16"]);

const oldProfile = env.context.p950GetDefaultUserProfile();
oldProfile.preferences.tracking = env.context.p950BuildTrackingPreset("full_coaching");
delete oldProfile.preferences.tracking.liftingDetail;
oldProfile.preferences.tracking.timeline = [{ ...env.context.p950BuildTrackingPreset("full_coaching"), effectiveDate: "2026-09-01" }];
delete oldProfile.preferences.tracking.timeline[0].liftingDetail;
delete oldProfile.preferences.tracking.timeline[0].timeline;
env = profileEnvironment({ "mf-user-profile": JSON.stringify(oldProfile) });
env.local.reset();
env.context.p950InitUserProfile();
assert.strictEqual(env.local.writes, 0, "virtual Detailed normalization eagerly migrated an old profile");
assert.strictEqual(env.context.p950GetTrackingSnapshotForDate("2026-09-02").liftingDetail, "full");

assert(html.includes('data-mf-lifting-detail="full"') && html.includes('data-mf-lifting-detail="simple"'));
assert(html.includes("Per Set — Detailed") && html.includes("Per Lift — Simple"));
assert(html.includes("lowest-rep work set") && html.includes("hardest (lowest) RIR"));
assert(profileSource.includes("Lifting-detail periods in selected range"));
assert(profileSource.includes("Full Coaching + Per Set — Detailed"));

// The rendered workout owns save mode. Saved evidence wins over current
// preference, while a new blank workout uses the date-effective preference.
const modeStore = storage();
const modeContext = { localStorage: modeStore.api, tDate: new Date("2026-09-15T12:00:00"), dKey() { return "day-2026-09-15"; }, p950LocalDateKey() { return "2026-09-15"; }, p950GetTrackingSnapshotForDate() { return { liftingDetail: "simple" }; } };
vm.createContext(modeContext);
vm.runInContext(extractBalanced(workoutSource, "function mfWorkoutEvidenceMode")+"\n"+extractBalanced(workoutSource, "function mfWorkoutResolveLiftingDetail"), modeContext);
assert.strictEqual(modeContext.mfWorkoutResolveLiftingDetail(), "simple");
modeStore.api.setItem("day-2026-09-15-wo", JSON.stringify({ exercises: {} }));
assert.strictEqual(modeContext.mfWorkoutResolveLiftingDetail(), "full", "legacy Detailed history did not override Simple preference");
modeStore.api.setItem("day-2026-09-15-wo", JSON.stringify({ liftingDetail: "simple", exercises: {} }));
modeContext.p950GetTrackingSnapshotForDate = () => ({ liftingDetail: "full" });
assert.strictEqual(modeContext.mfWorkoutResolveLiftingDetail(), "simple", "saved Simple history did not override Detailed preference");
assert.strictEqual(modeContext.mfWorkoutResolveLiftingDetail({ exercises: {} }), "full", "Detailed draft ownership was not preserved");
assert.strictEqual(modeContext.mfWorkoutResolveLiftingDetail({ liftingDetail: "simple", exercises: {} }), "simple", "Simple draft ownership was not preserved");

// Simple collection writes one authoritative summary with an empty set array.
// A blank exercise (including its prescribed-count placeholder) stays absent.
const fields = new Map([
  ["woDaySelect", { value: "0" }], ["woExerciseLog", { dataset: { liftingDetail: "simple" } }],
  ["mfWorkoutActiveCalories", { value: "321", setCustomValidity() {} }]
]);
const values = {
  "lift|summarySetCount": "3", "lift|summaryReps": "8", "lift|summaryLoad": "100 lb", "lift|summaryRir": "1–2", "lift|exnote": "clean",
  "blank|summarySetCount": "", "blank|summaryReps": "", "blank|summaryLoad": "", "blank|summaryRir": "", "blank|exnote": ""
};
const collectContext = {
  document: {
    getElementById(id) { return fields.get(id) || null; },
    querySelector(selector) { const id=(selector.match(/data-exid="([^"]+)"/)||[])[1],field=(selector.match(/data-field="([^"]+)"/)||[])[1];return id&&field?{ value: values[`${id}|${field}`] || "" }:null; }
  },
  logGym: "home", tDate: new Date("2026-09-15T12:00:00"),
  getResolvedDays() { return [{ _dayIdx: 0, name: "Day", exercises: [{ id: "lift", sets: "3" }, { id: "blank", sets: "4" }] }]; },
  getF(id,key,fallback) { return fallback; }, p950LocalDateKey() { return "2026-09-15"; }, p950IsTrackingEnabled() { return true; }
};
vm.createContext(collectContext);
vm.runInContext(extractBalanced(workoutSource, "function mfWorkoutReadActiveCalories")+"\n"+extractBalanced(workoutSource, "function collectWoData")+"\n"+extractBalanced(workoutSource, "function p85PreserveDormantWorkoutFields"), collectContext);
const simpleWorkout = JSON.parse(JSON.stringify(collectContext.collectWoData("2026-09-15")));
assert.deepStrictEqual(simpleWorkout, { gym: "home", dayIdx: "0", dayName: "Day", liftingDetail: "simple", exercises: { lift: { sets: [], summary: { version: 1, setCount: 3, repsFloor: "8", load: "100 lb", rirFloor: "1–2" }, note: "clean" } }, activeCalories: 321 });
assert.strictEqual(simpleWorkout.exercises.lift.sets.length, 0);
assert(!simpleWorkout.exercises.blank, "blank Simple exercise was stored from its placeholder");
collectContext.p950IsTrackingEnabled = path => path !== "modules.sessionNotes";
const dormant = JSON.parse(JSON.stringify(collectContext.p85PreserveDormantWorkoutFields({ liftingDetail: "simple", exercises: {} }, { liftingDetail: "simple", exercises: { lift: { sets: [], summary: simpleWorkout.exercises.lift.summary, note: "keep" } } }, "2026-09-15")));
assert.deepStrictEqual(dormant.exercises.lift.summary, simpleWorkout.exercises.lift.summary);
assert.strictEqual(dormant.exercises.lift.note, "keep");
assert.deepStrictEqual(dormant.exercises.lift.sets, []);

// Draft resume renders from woData mode before restoring summary values, and
// all summary controls participate in autosave.
assert(dailySource.includes("renderWoExercises(d.woData||null)"));
assert(dailySource.includes("summarySetCount") && dailySource.includes("summaryReps") && dailySource.includes("summaryLoad") && dailySource.includes("summaryRir"));
assert(dailySource.includes(".wo-summary-sets") && dailySource.includes(".wo-summary-rir"));

// History shows one explicit summary and never fabricates numbered sets.
const historyStore = storage({ "day-2026-09-15-wo": JSON.stringify(simpleWorkout) });
const historyNode = { innerHTML: "", insertAdjacentHTML() {} };
const historyContext = { localStorage: historyStore.api, document: { getElementById() { return historyNode; } }, HABITS: [], p9510HistoryOutcome() { return null; }, p7HistoryIcon() { return ""; }, getSafeDayForLog() { return { exercises: [{ id: "lift", name: "Lift" }] }; }, getHistoricalDayIdentity() { return { currentName: "Day", historicalName: "Day", showHistoricalName: false }; }, getF(id,key,fallback) { return fallback; } };
vm.createContext(historyContext); vm.runInContext(extractBalanced(historySource, "function renderHistoryFromEntries"), historyContext);
historyContext.renderHistoryFromEntries([{ key: "day-2026-09-15", data: { date: "2026-09-15", workout: "yes", logGym: "home" } }]);
assert(historyNode.innerHTML.includes("Per-Lift summary") && historyNode.innerHTML.includes("lowest-set reps 8"));
assert(!historyNode.innerHTML.includes("Set 1:"), "Simple history fabricated a numbered set row");

// Dedicated Simple progression operates directly on summary fields. The test
// storage is enumerable because the production history reader scans keys.
function progressionStorage() {
  const values = {}, writes = [];
  const api = {};
  Object.defineProperties(api, {
    getItem: { value: key => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null },
    setItem: { value: (key, value) => { values[key] = String(value); api[key] = String(value); writes.push(key); } },
    removeItem: { value: key => { delete values[key]; delete api[key]; writes.push(key); } },
    writes: { get: () => writes }
  });
  return api;
}
function range(value) { const nums=String(value||"").match(/\d+(?:\.\d+)?/g);if(!nums)return null;return {lo:Number(nums[0]),hi:Number(nums[1]||nums[0])}; }
function rir(value) { if(!value||/^(—|-|n\/a)$/i.test(value))return null;const nums=String(value).match(/\d+(?:\.\d+)?/g);return nums?nums.reduce((sum,n)=>sum+Number(n),0)/nums.length:null; }
function loadRange(value) { const nums=String(value||"").match(/\d+(?:\.\d+)?/g);if(!nums)return null;return {low:Number(nums[0]),high:Number(nums[1]||nums[0])}; }
class TestDate extends Date { constructor(value) { super(value===undefined?"2026-09-20T12:00:00":value); } }
const progressionLocal = progressionStorage(), progressionExercises = {}, progressionContexts = {};
const progressionContext = {
  console, localStorage: progressionLocal, window: null, APP_VERSION: "10.11.1", P: { home: [], partial: [] }, Date: TestDate, tDate: new TestDate(),
  document: { getElementById() { return null; }, querySelectorAll() { return []; } }, dKey(date) { return "day-"+date.toISOString().slice(0,10); },
  getLifecycle() { return { customExercises: {}, inactiveIds: {} }; },
  getResolvedDays(gym) { return Object.values(progressionExercises).filter(ex => progressionContexts[ex.id]&&progressionContexts[ex.id].gym===gym).map(ex => ({ _dayIdx: progressionContexts[ex.id].day, name: "Day", exercises: [ex] })); },
  getResolvedProgram() { return { home: [], partial: [] }; }, getF(id,key,fallback) { return progressionExercises[id]&&progressionExercises[id][key]!==undefined?progressionExercises[id][key]:fallback; },
  p5ParseRepRange: range, p5ParseRir: rir, p9IsCardio(load,targetRir) { return /\b(min|sec|bpm|hr)\b/i.test(load||"")||targetRir==="—"; }, p9GetTargetLoadRangeForExercise(id) { return progressionExercises[id]?loadRange(progressionExercises[id].load):null; },
  p9GetExerciseHistory() { return []; }, p9ParseLoad() {}, p9GetTopActualLoad() {}, p5FormatLastSets() {}, p9GetBestExercisePerformance() {}, p9BuildSuggestion() {}, p9GetProgressionStatus() {}, p9BadgeHTML() {}, p9BuildProgressionExport() {}, p5GetLastEntry() {}, p9ComputePrefill() {}, p5Toggle() {},
  renderWoExercises() {}, p85ExecuteSave() {}, p949BuildWorkoutReview() { return { insufficient:false,wins:[],watch:[],next:[] }; }, p9489GetRecentExerciseSignals() { return { hasData:false }; }, p9489AnalyzeExerciseRotation() { return { candidates:[] }; }, p945RenderDiag() {}, genExport() { return ""; }, getSafeDayForLog() { return null; }
};
progressionContext.window=progressionContext;vm.createContext(progressionContext);vm.runInContext(progressionSource,progressionContext);
function installProgression(ex,gym="home",day=0){progressionExercises[ex.id]=ex;progressionContexts[ex.id]={gym,day};return ex;}
function summary(setCount,repsFloor,load,rirFloor="2"){return {version:1,setCount,repsFloor:String(repsFloor),load:String(load),rirFloor};}
function saveProgression(date,ex,evidence,gym="home",day=0,mode="simple"){const workout={gym,dayIdx:String(day),exercises:{[ex.id]:mode==="simple"?{sets:[],summary:evidence}:{sets:evidence}}};if(mode==="simple")workout.liftingDetail="simple";progressionLocal.setItem(`day-${date}-wo`,JSON.stringify(workout));}
function simpleRecommendation(ex,evidence,evaluation){return progressionContext.p1111BuildSimpleSuggestion(ex.id,evidence,ex.reps,ex.rir,evaluation);}
function detailedSets(load,repsValue,rirValue="2",count=3){return Array.from({length:count},()=>({wt:load,reps:String(repsValue),rir:rirValue}));}

const simplePress=installProgression({id:"simple-press",name:"Simple Press",sets:3,reps:"8–12",load:"20–100 lb",rir:"1–2"});
assert.strictEqual(simpleRecommendation(simplePress,summary(2,12,"50 lb")).outcome,"repeat_target");
assert.strictEqual(simpleRecommendation(simplePress,summary(3,7,"50 lb")).outcome,"repeat_target");
assert.strictEqual(simpleRecommendation(simplePress,summary(3,5,"50 lb","0")).outcome,"reduce_reset");
assert.strictEqual(simpleRecommendation(simplePress,summary(3,10,"50 lb")).outcome,"progress_reps");
assert.strictEqual(simpleRecommendation(simplePress,summary(3,12,"50 lb","—")).outcome,"repeat_target");
assert.strictEqual(simpleRecommendation(simplePress,summary(3,12,"50 lb","0")).outcome,"repeat_target");
const strictSimple=simpleRecommendation(simplePress,summary(3,12,"50 lb","2"));
assert.strictEqual(strictSimple.outcome,"progress_load");assert.strictEqual(strictSimple.confidence,"medium");assert.strictEqual(strictSimple.evidence.evidenceMode,"simple");assert(!Object.prototype.hasOwnProperty.call(strictSimple.evidence,"validSets"));

const simpleBody=installProgression({id:"simple-body",name:"Push-Up",sets:3,reps:"8–12",load:"Bodyweight",rir:"2"},"home",1);
assert.strictEqual(simpleRecommendation(simpleBody,summary(3,12,"Bodyweight","2")).outcome,"progress_reps");
const simpleDuration=installProgression({id:"simple-duration",name:"Plank",sets:3,reps:"30–60 sec",load:"Bodyweight",rir:"—"},"home",2);
assert.strictEqual(simpleRecommendation(simpleDuration,summary(3,45,"Bodyweight","—")).outcome,"progress_reps");
assert.strictEqual(simpleRecommendation(simpleDuration,summary(3,60,"Bodyweight","—")).outcome,"maintain");
const simpleAssist=installProgression({id:"simple-assist",name:"Assisted Pull-Up",sets:3,reps:"8–10",load:"80–120 lb assistance",rir:"2"},"partial",0);
assert.match(simpleRecommendation(simpleAssist,summary(3,10,"110 lb assistance","2")).action,/105 lb assistance/);
const simpleKg=installProgression({id:"simple-kg",name:"KG Press",sets:3,reps:"8–12",load:"20–50 kg",rir:"2"},"partial",1);
assert.strictEqual(simpleRecommendation(simpleKg,summary(3,12,"30 kg","2")).outcome,"progress_load");
assert.strictEqual(simpleRecommendation(simpleKg,summary(3,12,"70 lb","2")).outcome,"progress_reps");
assert.strictEqual(simpleRecommendation(simplePress,summary(3,12,"45–50 lb","2")).outcome,"progress_reps");
assert.strictEqual(simpleRecommendation(simplePress,summary(3,12,"full stack","2")).outcome,"progress_reps");

const simpleReset=installProgression({id:"simple-reset",name:"Reset",sets:3,reps:"8–12",load:"20–40 lb",rir:"2"},"home",3);
saveProgression("2026-09-01",simpleReset,summary(3,12,"50 lb","2"),"home",3);
assert.strictEqual(simpleRecommendation(simpleReset,summary(3,10,"30 lb","2")).status,"target_reset");
const simpleJump=installProgression({id:"simple-jump",name:"Jump",sets:3,reps:"8–12",load:"20–100 lb",rir:"2"},"home",4);
saveProgression("2026-09-01",simpleJump,detailedSets("50 lb",12),"home",4,"full");
assert.strictEqual(simpleRecommendation(simpleJump,summary(3,12,"70 lb","2"),{dateKey:"day-2026-09-08",subjectStored:false}).outcome,"repeat_target");
saveProgression("2026-09-08",simpleJump,summary(3,12,"50 lb","2"),"home",4);
assert.strictEqual(simpleRecommendation(simpleJump,summary(3,8,"50 lb","2"),{dateKey:"day-2026-09-15",subjectStored:false}).outcome,"reduce_reset");

const simpleCeiling=installProgression({id:"simple-ceiling",name:"Ceiling",sets:3,reps:"8–10",load:"20–30 lb",rir:"2"},"home",5);
saveProgression("2026-09-01",simpleCeiling,summary(3,10,"30 lb","2"),"home",5);
assert.strictEqual(simpleRecommendation(simpleCeiling,summary(3,10,"30 lb","2"),{dateKey:"day-2026-09-08",subjectStored:false}).status,"capped_hold");
saveProgression("2026-09-08",simpleCeiling,detailedSets("30 lb",10),"home",5,"full");
const mixedCeiling=simpleRecommendation(simpleCeiling,summary(3,10,"30 lb","2"),{dateKey:"day-2026-09-08",subjectStored:true});
assert.strictEqual(mixedCeiling.status,"ceiling_update");assert.strictEqual(mixedCeiling.evidence.qualifyingCeilingSessions,2);
const ceilingHistory=progressionContext.p9GetExerciseHistory(simpleCeiling.id,{includeToday:true});
assert.strictEqual(ceilingHistory.length,2);assert.strictEqual(ceilingHistory.find(entry=>entry.evidenceMode==="simple").validSets.length,0,"Simple history fabricated validSets");
assert(ceilingHistory.some(entry=>entry.evidenceMode==="simple")&&ceilingHistory.some(entry=>entry.evidenceMode!=="simple"));

const simpleReview=progressionContext.p949BuildWorkoutReview({gym:"home",dayIdx:"0",dayName:"Day",liftingDetail:"simple",exercises:{"simple-press":{sets:[],summary:summary(3,12,"50 lb","2")}}});
assert.strictEqual(simpleReview.exercisesLogged,1);assert.strictEqual(simpleReview.setsLogged,3);assert(!simpleReview.watch.some(line=>/Missed exercise/.test(line)));assert(simpleReview.next.some(line=>/Try 55 lb/.test(line)));

// Training Load counts the factual summary count directly, never rows.
const statsContext={p7DateInRange(){return true;},p7ReadWorkout(){return null;}};vm.createContext(statsContext);vm.runInContext(extractBalanced(statsSource,"function p7WorkoutSetCount"),statsContext);
assert.strictEqual(statsContext.p7WorkoutSetCount(simpleWorkout),3);
assert.strictEqual(simpleWorkout.exercises.lift.sets.length,0);

// Latest Simple evidence participates in Stats progression with its medium
// confidence while the local deterministic rotation heuristic ignores it.
saveProgression("2026-09-19",simplePress,summary(3,12,"50 lb","2"),"home",0);
progressionContext.p7DateInRange=()=>true;
vm.runInContext(extractBalanced(statsSource,"function p7CollectLiftingProgress"),progressionContext);
const simpleStats=progressionContext.p7CollectLiftingProgress({start:null,end:null});
const readySimple=simpleStats.ready.find(item=>item.id==="simple-press");assert(readySimple&&readySimple.evidenceMode==="simple"&&readySimple.confidence==="medium");
vm.runInContext(extractBalanced(exportSource,"function p9489GetRecentExerciseSignals"),progressionContext);
assert.strictEqual(progressionContext.p9489GetRecentExerciseSignals(simplePress).hasData,false,"Simple-only history satisfied deterministic stale/capped rotation evidence");

// Export and deterministic rotation contracts are explicitly evidence-aware.
assert(exportSource.includes("Evidence: Per-Lift summary — individual sets were not recorded"));
assert(exportSource.includes("Never infer, expand, or fabricate individual set values"));
assert(exportSource.includes('filter(function(entry){return entry.evidenceMode!=="simple";})'));
assert(progressionSource.includes('Evidence mode: "+(last.evidenceMode==="simple"?"Per-Lift summary":"Per-Set Detailed")'));
assert(progressionSource.includes("p1111BuildSimpleWorkoutReview") && progressionSource.includes("setsLogged+=summary.setCount"));

console.log("MarcusFit 10.11.1 simple lifting: preference, storage, progression, review, stats, and export PASS");
