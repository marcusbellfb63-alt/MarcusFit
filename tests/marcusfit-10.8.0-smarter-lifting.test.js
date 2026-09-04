const assert=require("assert"),fs=require("fs"),path=require("path"),vm=require("vm");
const root=path.resolve(__dirname,".."),source=fs.readFileSync(path.join(root,"assets/js/features/18-progression-corrections.js"),"utf8");

function storageFixture(){
  const values={},writes=[];
  const api={};
  Object.defineProperties(api,{
    getItem:{value:key=>Object.prototype.hasOwnProperty.call(values,key)?values[key]:null},
    setItem:{value:(key,value)=>{values[key]=String(value);api[key]=String(value);writes.push(["set",key]);}},
    removeItem:{value:key=>{delete values[key];delete api[key];writes.push(["remove",key]);}},
    clearWrites:{value:()=>{writes.length=0;}},writes:{get:()=>writes}
  });
  return api;
}
function parseRange(value){const nums=String(value||"").match(/\d+(?:\.\d+)?/g);if(!nums)return null;const lo=Number(nums[0]),hi=Number(nums[1]||nums[0]);return{lo,hi,mid:(lo+hi)/2};}
function parseRir(value){if(!value||/^(—|-|n\/a)$/i.test(value))return null;const nums=String(value).match(/\d+(?:\.\d+)?/g);return nums?nums.reduce((sum,n)=>sum+Number(n),0)/nums.length:null;}
function loadRange(value){const nums=String(value||"").match(/\d+(?:\.\d+)?/g);if(!nums)return null;return{low:Number(nums[0]),high:Number(nums[1]||nums[0]),suffix:/kg/i.test(value)?" kg":" lb"};}
function dayKey(date){return"day-"+date.toISOString().slice(0,10);}
function sets(load,reps,rir="2",count=3){return Array.from({length:count},()=>({wt:load,reps:String(reps),rir:rir}));}

const localStorage=storageFixture(),exercises={},contexts={},lifecycle={customExercises:{},inactiveIds:{}};
const context={
  console,localStorage,window:null,APP_VERSION:"10.8.0",P:{home:[],partial:[]},tDate:new Date("2026-09-04T12:00:00"),
  document:{getElementById(){return null;},querySelectorAll(){return[];}},
  dKey:dayKey,getLifecycle(){return lifecycle;},
  getResolvedDays(gym){return Object.values(exercises).filter(ex=>contexts[ex.id]&&contexts[ex.id].gymKey===gym).map(ex=>({_dayIdx:contexts[ex.id].dayIdx,exercises:[ex]}));},
  getResolvedProgram(){return{home:[],partial:[]};},getF(id,field,fallback){return exercises[id]&&exercises[id][field]!==undefined?exercises[id][field]:fallback;},
  p5ParseRepRange:parseRange,p5ParseRir:parseRir,p9IsCardio(load,rir){return /\b(min|sec|bpm|hr)\b/i.test(load||"")||rir==="—";},
  p9GetTargetLoadRangeForExercise(id){return exercises[id]?loadRange(exercises[id].load):null;},
  p9GetExerciseHistory(){return[];},p9ParseLoad(){},p9GetTopActualLoad(){},p5FormatLastSets(){},p9GetBestExercisePerformance(){},p9BuildSuggestion(){},p9GetProgressionStatus(){},p9BadgeHTML(){},p9BuildProgressionExport(){},p5GetLastEntry(){},p9ComputePrefill(){},p5Toggle(){},
  renderWoExercises(){},p949BuildWorkoutReview(){return null;},p9489GetRecentExerciseSignals(){return{hasData:false};},p9489AnalyzeExerciseRotation(){return{candidates:[],candidatesTotal:0};},p945RenderDiag(){},genExport(){return"";},getSafeDayForLog(){return null;}
};
context.window=context;vm.createContext(context);vm.runInContext(source,context,{filename:"18-progression-corrections.js"});

function install(ex,gymKey="home",dayIdx=0){exercises[ex.id]=ex;contexts[ex.id]={gymKey,dayIdx};return ex;}
function save(date,ex,rows,gym="home",dayIdx=0,legacy=false){const workout={exercises:{[ex.id]:{sets:rows}}};if(!legacy){workout.gym=gym;workout.dayIdx=String(dayIdx);}localStorage.setItem("day-"+date+"-wo",JSON.stringify(workout));}
function recommend(ex,rows){return context.p9BuildSuggestion(ex.id,rows,ex.reps,ex.rir);}

const weighted=install({id:"weighted",name:"Dumbbell Press",sets:3,reps:"8–12",load:"20–100 lb",rir:"1–2"});
assert.strictEqual(recommend(weighted,null).outcome,"insufficient_evidence");
assert.strictEqual(recommend(weighted,sets("50 lb",12)).outcome,"progress_load");
assert.match(recommend(weighted,sets("50 lb",12)).reason,/All 3 prescribed sets/);
assert.strictEqual(recommend(weighted,sets("50 lb",10)).outcome,"progress_reps");
assert.strictEqual(recommend(weighted,sets("50 lb",12,"2",1)).outcome,"repeat_target");
assert.match(recommend(weighted,sets("50 lb",12,"2",1)).reason,/Only 1 of 3/);
assert.strictEqual(recommend(weighted,sets("50 lb",12,"—")).outcome,"repeat_target");
assert.match(recommend(weighted,sets("50 lb",12,"—")).reason,/RIR is missing or N\/A/);
assert.strictEqual(recommend(weighted,sets("50 lb",7,"2")).outcome,"repeat_target");
assert.strictEqual(recommend(weighted,sets("50 lb",5,"0")).outcome,"reduce_reset");
const reset=install({id:"reset",name:"Reset Fixture",sets:3,reps:"8–12",load:"20–40 lb",rir:"2"},"home",5);
save("2026-06-10",reset,sets("50 lb",12),"home",5);assert.strictEqual(recommend(reset,sets("30 lb",10)).status,"target_reset");

const duration=install({id:"duration",name:"Plank",sets:3,reps:"30–60 sec",load:"Bodyweight",rir:"—"},"home",1);
assert.strictEqual(recommend(duration,sets("Bodyweight",45,"—")).outcome,"progress_reps");
assert.strictEqual(recommend(duration,sets("Bodyweight",60,"—")).outcome,"maintain");
assert.strictEqual(recommend(duration,sets("Bodyweight",60,"—",1)).outcome,"repeat_target");

const bodyweight=install({id:"bodyweight",name:"Push-Up",sets:3,reps:"8–12",load:"Bodyweight",rir:"2"},"home",2);
assert.strictEqual(recommend(bodyweight,sets("Bodyweight",12)).outcome,"progress_reps");
assert.match(recommend(bodyweight,sets("Bodyweight",12)).reason,/does not support a numeric load increase/);

const assisted=install({id:"assisted",name:"Assisted Pull-Up",sets:3,reps:"8–10",load:"80–120 lb assistance",rir:"1–2"},"partial",0);
const assistRec=recommend(assisted,sets("110 lb assistance",10));
assert.strictEqual(assistRec.outcome,"progress_load");assert.match(assistRec.action,/Try 105 lb assistance/);

const text=install({id:"text",name:"Band Row",sets:3,reps:"10–15",load:"Band",rir:"2"},"home",3);
const textRec=recommend(text,sets("Bodyweight + red band",15));
assert.strictEqual(textRec.outcome,"progress_reps");assert.match(textRec.reason,/Load is text-based/);
assert.strictEqual(recommend(text,sets("25–30 lb",15)).outcome,"progress_reps");
assert.strictEqual(recommend(weighted,[{wt:"50 lb",reps:"12",rir:"2"},{wt:"full stack",reps:"12",rir:"2"},{wt:"50 lb",reps:"12",rir:"2"}]).outcome,"progress_reps");
assert.strictEqual(recommend(weighted,[{wt:"45 lb",reps:"12",rir:"2"},{wt:"50 lb",reps:"12",rir:"2"},{wt:"50 lb",reps:"12",rir:"2"}]).outcome,"repeat_target");

save("2026-08-01",weighted,sets("50 lb",12));save("2026-08-08",weighted,sets("70 lb",12));
assert.strictEqual(recommend(weighted,sets("70 lb",12)).outcome,"repeat_target","large apparent jump must be confirmed");
save("2026-08-15",weighted,sets("50 lb",12));save("2026-08-22",weighted,sets("50 lb",8));
assert.strictEqual(recommend(weighted,sets("50 lb",8)).outcome,"reduce_reset","large same-load performance drop must be conservative");

const edited=install({id:"edited",name:"Cable Curl",sets:3,reps:"8–12",load:"20–60 lb",rir:"2"},"partial",1);
save("2026-08-20",edited,sets("30 lb",8),"partial",1);const keyCountBefore=Object.keys(localStorage).filter(k=>k.endsWith("-wo")).length;
assert.strictEqual(recommend(edited,context.p9GetExerciseHistory("edited")[0].validSets).outcome,"progress_reps");
save("2026-08-20",edited,sets("30 lb",12),"partial",1);assert.strictEqual(Object.keys(localStorage).filter(k=>k.endsWith("-wo")).length,keyCountBefore,"edit created a duplicate history identity");
assert.strictEqual(recommend(edited,context.p9GetExerciseHistory("edited")[0].validSets).outcome,"progress_load","edited history did not recalculate");

const shared={id:"shared",name:"Context Fixture",sets:1,reps:"8–10",load:"20–50 lb",rir:"2"};exercises.shared=shared;delete contexts.shared;
save("2026-07-01",shared,sets("20 lb",10,"2",1),"home",4);save("2026-07-02",shared,sets("30 lb",10,"2",1),"partial",4);
assert.strictEqual(context.p9GetExerciseHistory("shared",{context:{gymKey:"home",dayIdx:4}}).length,1);
assert.strictEqual(context.p9GetExerciseHistory("shared",{context:{gymKey:"partial",dayIdx:4}})[0].validSets[0].wt,"30 lb");

const custom={id:"home-d8-e0",name:"Custom Raise",sets:1,reps:"10–12",load:"10–30 lb",rir:"2"};exercises[custom.id]=custom;lifecycle.customExercises[custom.id]={...custom,gymKey:"home",dayIdx:8};lifecycle.inactiveIds[custom.id]={inactivatedAt:"2026-01-01"};
save("2026-06-01",custom,sets("10 lb",12,"2",1),"home",8);const customContext=context.p1080ExerciseContext(custom.id);assert.strictEqual(customContext.gymKey,"home");assert.strictEqual(customContext.dayIdx,8);assert.strictEqual(context.p9GetExerciseHistory(custom.id).length,1);
save("2026-05-01",custom,sets("Band",12,"2",1),"home",8,true);assert.strictEqual(context.p9GetExerciseHistory(custom.id).length,2,"legacy history without optional context was rejected");

const raw="Bodyweight + red band",prefill=context.p9ComputePrefill(text.id,0,[{wt:raw,reps:"15",rir:"2"}],"progress_load",text.reps,text.rir);
assert.strictEqual(prefill.wt,raw);assert.strictEqual(prefill.reps,"15");assert.strictEqual(context.p9ComputePrefill(text.id,0,[],"progress_load",text.reps,text.rir).wt,"");
assert.match(context.p9BuildProgressionExport(edited),/Outcome: progress_load[\s\S]*Reason:[\s\S]*Confidence:/);
const pBefore=JSON.stringify(context.P);localStorage.clearWrites();recommend(weighted,sets("50 lb",12));context.p9GetExerciseHistory("weighted");context.p9ComputePrefill(weighted.id,0,[],"progress_load",weighted.reps,weighted.rir);assert.strictEqual(localStorage.writes.length,0,"derived progression wrote storage");assert.strictEqual(JSON.stringify(context.P),pBefore,"derived progression mutated P");

console.log("MarcusFit 10.8.0 smarter lifting: PASS");
