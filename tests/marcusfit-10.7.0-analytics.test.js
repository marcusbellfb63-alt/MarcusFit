const assert=require("assert"),fs=require("fs"),path=require("path"),vm=require("vm");
const root=path.resolve(__dirname,".."),source=fs.readFileSync(path.join(root,"assets/js/features/15-stats.js"),"utf8"),basketball=fs.readFileSync(path.join(root,"assets/js/features/22-basketball.js"),"utf8"),habits=fs.readFileSync(path.join(root,"assets/js/features/20-habits.js"),"utf8"),recurring=fs.readFileSync(path.join(root,"assets/js/features/19-recurring-adherence.js"),"utf8"),html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const storage=new Map(),context={console,Date,localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,setItem(){throw new Error("analytics wrote storage");},removeItem(){throw new Error("analytics wrote storage");},key(){return null;},get length(){return storage.size;}},document:{getElementById(){return null;}},p7GetAllEntries(){return [];},getResolvedDays(){return [];},getSafeDayForLog(){return null;},p9489ClassifyDayType(){return "other";},mfBasketballReadStore(){return {sessions:[]};}};context.window=context;vm.createContext(context);vm.runInContext(source,context);
context.p7SetStatsRange("7");let range=context.p7GetStatsRange(new Date(2026,7,31,12));assert.deepStrictEqual(JSON.parse(JSON.stringify(range)),{value:"7",days:7,start:"2026-08-25",end:"2026-08-31",priorStart:"2026-08-18",priorEnd:"2026-08-24",label:"Last 7 calendar days"});
assert(context.p7DateInRange("2026-08-25",range,false));assert(!context.p7DateInRange("2026-08-24",range,false));assert(context.p7DateInRange("2026-08-24",range,true));
context.p7SetStatsRange("30");const before=[...storage.entries()];const empty=context.p7CalcAnalytics();assert.strictEqual(empty.range.days,30);assert.strictEqual(empty.trainingLoad.liftingSessions,0);assert.deepStrictEqual([...storage.entries()],before);
assert.strictEqual(context.p7RecoveryComparison({value:7.5,count:3,prior:{value:7,count:2}}," hr"),"+0.5 hr vs prior 2-day sample.");
assert.strictEqual(context.p7RecoveryComparison({value:7.5,count:1,prior:{value:7,count:2}}," hr"),"Insufficient prior-window evidence.");
assert.strictEqual(context.p7HabitComparison({overall:75,eligible:8,priorOverall:50,priorEligible:6}),"Up 25 points vs the prior equivalent range (6 eligible opportunities).");
assert(html.includes('id="p7StatsRange"')&&html.includes('<option value="30" selected>30 days</option>'));
assert(source.includes('^day-\\d{4}-\\d{2}-\\d{2}-wo$')&&source.includes('parseInt(set.reps,10)>0'),"stable-ID selected-range lifting evidence missing");
assert(habits.includes('p960GetHabitStatsAnalytics(range)')&&habits.includes('p960GetHabitAnalytics(range.priorStart,range.priorEnd)'));
assert(recurring.includes('p9510GetAdherenceRange("zepbound",range)')&&recurring.includes('eligibleResolved=out.completedOnTime+out.completedLate+out.skipped+out.unresolvedLate'));
assert(basketball.includes('session.programId,session.programVersion,session.plannedSessionId,drill.drillId,drill.trackingMode')&&basketball.includes('item.values.length>=2'));
assert(basketball.includes('const mfBasketballLegacyCalcAnalytics=p7CalcAnalytics')&&basketball.includes('result.trainingLoad.basketballSessions=sessions.length'),"Basketball-last Training Load enrichment missing");
assert(!/tonnage|readiness score|fatigue score|calorie balance/i.test(source));

function extractBalanced(text,startToken){const at=text.indexOf(startToken);assert(at>=0,"missing "+startToken);const brace=text.indexOf("{",at);let depth=0,quote=null,escaped=false;for(let i=brace;i<text.length;i++){const ch=text[i];if(quote){if(escaped)escaped=false;else if(ch==="\\")escaped=true;else if(ch===quote)quote=null;continue;}if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}if(ch==="{")depth++;if(ch==="}"&&--depth===0)return text.slice(at,i+1);}throw new Error("unbalanced "+startToken);}

// Exercise the actual range-aware Habit wrapper with representative persisted fixtures.
const RealDate=Date,fixedNow="2026-08-31T12:00:00.000Z";
class FixedDate extends RealDate{constructor(...args){super(...(args.length?args:[fixedNow]));}static now(){return new RealDate(fixedNow).getTime();}}
const habitMemory=new Map([
  ["day-2026-06-01",JSON.stringify({habits:{"habit-old":{completed:true}}})],
  ["day-2026-06-08",JSON.stringify({habits:{"habit-weekly":{completed:true}}})],
  ["day-2026-06-10",JSON.stringify({habits:{"habit-weekly":{completed:true}}})],
  ["day-2026-06-15",JSON.stringify({habits:{"habit-legacy":{completed:true}}})]
]);
let habitWrites=0;
const habitStorage=new Proxy({}, {ownKeys(){return [...habitMemory.keys()];},getOwnPropertyDescriptor(target,key){return habitMemory.has(key)?{enumerable:true,configurable:true}:undefined;},get(target,key){if(key==="getItem")return k=>habitMemory.has(k)?habitMemory.get(k):null;if(key==="setItem"||key==="removeItem")return ()=>{habitWrites++;throw new Error("analytics wrote storage");};if(key==="length")return habitMemory.size;if(key==="key")return i=>[...habitMemory.keys()][i]||null;}});
const definitions={
  "habit-old":{id:"habit-old",name:"Old daily",icon:"O",active:true,schedule:{type:"daily"},createdAt:"2026-06-01T12:00:00.000Z",archivedAt:null},
  "habit-activated":{id:"habit-activated",name:"Activated later",icon:"A",active:true,schedule:{type:"daily"},createdAt:"2026-07-15T12:00:00.000Z",archivedAt:null},
  "habit-archived":{id:"habit-archived",name:"Archived",icon:"X",active:false,schedule:{type:"daily"},createdAt:"2026-07-01T12:00:00.000Z",archivedAt:"2026-07-31T12:00:00.000Z"},
  "habit-weekly":{id:"habit-weekly",name:"Weekly",icon:"W",active:true,schedule:{type:"weekly_count",targetCount:2,weekStartsOn:0},createdAt:"2026-06-07T12:00:00.000Z",archivedAt:null},
  "habit-legacy":{id:"habit-legacy",name:"Legacy evidence",icon:"L",active:true,schedule:{type:"daily"},createdAt:null,archivedAt:null,legacyEligibilityInferred:true},
  "habit-legacy-empty":{id:"habit-legacy-empty",name:"Legacy neutral",icon:"N",active:true,schedule:{type:"daily"},createdAt:null,archivedAt:null,legacyEligibilityInferred:true}
};
const analyticsContainer={innerHTML:""},habitDocument={getElementById(id){return id==="p7-analytics-content"?analyticsContainer:null;}};
const habitContext={console,Date:FixedDate,localStorage:habitStorage,document:habitDocument,p7GetAllEntries(){return [];},getResolvedDays(){return [];},getSafeDayForLog(){return null;},p9489ClassifyDayType(){return "other";},p9GetProgressionStatus(){return "new";},p960GetHabitDefinitions(){return definitions;}};habitContext.window=habitContext;vm.createContext(habitContext);vm.runInContext(source,habitContext);
const habitFunctions=["function p960Clone","function p960DateKey","function p960ParseDate","function p960AddDays","function p960NormalizeSchedule","function p960GetHabitWeekRange","function p960IsWithinActiveRange","function p960IsHabitDueOnDate","function p960ReadDay","function p960GetWeeklyHabitProgress","function p960EarliestHistoricalDate","function p960HabitEligibilityStart","function p960AnalyzeHabit","function p960SummarizeHabitAnalytics","function p960GetHabitAnalytics","function p960GetHabitStatsAnalytics"].map(token=>extractBalanced(habits,token)).join("\n");
vm.runInContext('const P960_SCHEDULE_TYPES=["daily","weekdays","weekly_count"];\n'+habitFunctions,habitContext);
const wrapperStart=habits.indexOf("const p960LegacyCalcAnalytics="),wrapperEnd=habits.indexOf("const p960LegacyHistoryRenderer",wrapperStart);vm.runInContext(habits.slice(wrapperStart,wrapperEnd),habitContext);

const all=habitContext.p960GetHabitStatsAnalytics({start:null,end:"2026-08-31"}),row=id=>all.habits.find(item=>item.id===id);
assert.strictEqual(row("habit-old").eligible,92);assert.strictEqual(row("habit-old").completed,1,"old completion missing from All history");
assert.strictEqual(row("habit-activated").eligible,48,"activation date was not respected");
assert.strictEqual(row("habit-archived").eligible,31,"archive date was not respected");
assert.strictEqual(row("habit-weekly").eligible,12);assert.strictEqual(row("habit-weekly").completed,1,"weekly-count history was not summarized by complete week");
assert.strictEqual(row("habit-legacy").eligible,78);assert.strictEqual(row("habit-legacy").completed,1,"legacy eligibility did not begin at first evidence");
assert.strictEqual(row("habit-legacy-empty").eligible,0);assert.strictEqual(row("habit-legacy-empty").percentage,null,"legacy Habit without evidence acquired invented misses");
const thirty=habitContext.p960GetHabitStatsAnalytics({start:"2026-08-02",end:"2026-08-31"});assert.strictEqual(thirty.habits.find(item=>item.id==="habit-old").completed,0,"old completion leaked into 30-day range");assert.strictEqual(thirty.habits.find(item=>item.id==="habit-old").eligible,30);
assert.strictEqual(habitContext.p960GetHabitAnalytics().habits.find(item=>item.id==="habit-old").eligible,30,"no-argument recent Habit analytics changed");
habitContext.p7SetStatsRange("all");const rendered=habitContext.p7CalcAnalytics();habitContext.p7RenderAnalytics();assert.strictEqual(rendered.range.label,"All history");assert.strictEqual(rendered.habits.breakdown.find(item=>item.id==="habit-old").done,1);assert(analyticsContainer.innerHTML.includes("Training Load · All history"));assert.strictEqual(habitWrites,0,"calculating or rendering Habit analytics wrote storage");

console.log("MarcusFit 10.7.0 range-aware analytics: PASS");
