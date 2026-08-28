// MarcusFit 10.2.0: Basketball Programs & Progression
// Basketball remains an isolated, final-load feature boundary. Core AI Sync is
// intentionally not captured, wrapped, or extended here.

(function(){
"use strict";

const MF_BASKETBALL_STORAGE_KEY = "mf-basketball-sessions";
const MF_BASKETBALL_SCHEMA_VERSION = 1;
const MF_BASKETBALL_PROGRAM_STATE_KEY = "mf-basketball-program-state";
const MF_BASKETBALL_PROGRAM_STATE_SCHEMA_VERSION = 1;
const MF_BASKETBALL_TRACKING_MODES = Object.freeze(["confidence","duration","makes_target","benchmark_shooting","count","completion"]);
const MF_BASKETBALL_TYPES = Object.freeze({
  skills_practice: "Skills Practice",
  shooting: "Shooting",
  pickup_game: "Pickup / Game",
  basketball_workout: "Basketball Workout",
  casual_play: "Casual Play",
  other: "Other"
});
const MF_BASKETBALL_LIMITS = Object.freeze({ minutes: 1440, count: 10000, notes: 2000 });

function mfBasketballDeepFreeze(value){
  if(!value||typeof value!=="object"||Object.isFrozen(value))return value;
  Object.keys(value).forEach(function(key){mfBasketballDeepFreeze(value[key]);});
  return Object.freeze(value);
}

const MF_BASKETBALL_PROGRAMS = mfBasketballDeepFreeze([
  {
    id:"basketball_fundamentals_3_session",version:1,name:"Basketball Fundamentals — 3 Session",
    description:"Balanced ball handling, finishing, shooting, and basketball conditioning.",
    sessions:[
      {id:"fundamentals_a_handle_weak_hand",name:"Session A — Handle + Weak Hand",focus:"Control the ball comfortably and finish with the weak hand.",drills:[
        {id:"fundamentals_weak_hand_stationary",name:"Weak-Hand Pound Dribble",trackingMode:"duration",confidence:true,target:{durationMinutes:5},progression:{drillId:"fundamentals_weak_hand_movement",name:"Moving Weak-Hand Control"}},
        {id:"fundamentals_crossover_control",name:"Crossover Control",trackingMode:"confidence",target:{durationMinutes:6},progression:{drillId:"fundamentals_crossover_movement",name:"Moving Crossovers"}},
        {id:"fundamentals_behind_back_foundation",name:"Behind-the-Back Foundation",trackingMode:"confidence",target:{durationMinutes:6},progression:{drillId:"fundamentals_behind_back_moving",name:"Moving Behind-the-Back"}},
        {id:"fundamentals_weak_hand_finishing",name:"Weak-Hand Finishing",trackingMode:"makes_target",confidence:true,target:{makes:15}},
        {id:"fundamentals_ft_benchmark",name:"Free Throws — Benchmark",trackingMode:"benchmark_shooting",target:{attempts:20,minAttempts:10}}
      ]},
      {id:"fundamentals_b_shooting",name:"Session B — Shooting",focus:"Build repeatable mechanics before adding game speed.",drills:[
        {id:"fundamentals_form_shooting",name:"Form Shooting",trackingMode:"makes_target",confidence:true,target:{makes:20}},
        {id:"fundamentals_midrange_spots",name:"Midrange Spot Shooting",trackingMode:"makes_target",confidence:true,target:{makes:25},progression:{drillId:"fundamentals_midrange_movement",name:"Midrange Off Movement"}},
        {id:"fundamentals_catch_shoot",name:"Catch-and-Shoot",trackingMode:"makes_target",confidence:true,target:{makes:20}},
        {id:"fundamentals_game_speed_makes",name:"Game-Speed Makes",trackingMode:"makes_target",confidence:true,target:{makes:15}},
        {id:"fundamentals_ft_finish",name:"Free Throw Finish",trackingMode:"makes_target",target:{makes:10}}
      ]},
      {id:"fundamentals_c_mixed_conditioning",name:"Session C — Mixed Skills + Conditioning",focus:"Blend movement skills and shooting while managing fatigue.",drills:[
        {id:"fundamentals_movement_handling",name:"Movement Handling",trackingMode:"duration",confidence:true,target:{durationMinutes:8}},
        {id:"fundamentals_finishing_challenge",name:"Finishing Challenge",trackingMode:"count",confidence:true,target:{count:20}},
        {id:"fundamentals_fatigue_shooting",name:"Shooting Under Fatigue",trackingMode:"makes_target",confidence:true,target:{makes:20}},
        {id:"fundamentals_conditioning_block",name:"Basketball Conditioning",trackingMode:"completion"},
        {id:"fundamentals_mixed_benchmark",name:"Mixed Shooting Benchmark",trackingMode:"benchmark_shooting",target:{attempts:25,minAttempts:15}}
      ]}
    ]
  },
  {
    id:"guard_skills_3_session",version:1,name:"Guard Skills — 3 Session",
    description:"Advanced handling, change of pace, finishing, and shot creation.",
    sessions:[
      {id:"guard_a_handle_weak_hand",name:"Session A — Handle + Weak Hand",focus:"Strengthen weak-hand control and foundational change-of-direction moves.",drills:[
        {id:"guard_weak_hand_control",name:"Weak-Hand Control",trackingMode:"duration",confidence:true,target:{durationMinutes:6},progression:{drillId:"guard_weak_hand_movement",name:"Moving Weak-Hand Control"}},
        {id:"guard_crossover_change_direction",name:"Crossover Change of Direction",trackingMode:"confidence",target:{durationMinutes:8},progression:{drillId:"guard_crossover_combo",name:"Crossover Combo"}},
        {id:"guard_behind_back_foundation",name:"Behind-the-Back",trackingMode:"confidence",target:{durationMinutes:8},progression:{drillId:"guard_behind_back_moving",name:"Moving Behind-the-Back"}},
        {id:"guard_weak_hand_finishing",name:"Weak-Hand Finishing",trackingMode:"makes_target",confidence:true,target:{makes:20}},
        {id:"guard_ft_benchmark",name:"Free Throws — Benchmark",trackingMode:"benchmark_shooting",target:{attempts:20,minAttempts:10}}
      ]},
      {id:"guard_b_change_of_pace",name:"Session B — Change of Pace",focus:"Create space with rhythm, hesitation, and linked moves.",drills:[
        {id:"guard_between_legs",name:"Between-the-Legs",trackingMode:"confidence",target:{durationMinutes:8},progression:{drillId:"guard_between_legs_moving",name:"Moving Between-the-Legs"}},
        {id:"guard_hesitation",name:"Hesitation + Change of Pace",trackingMode:"confidence",target:{durationMinutes:8},progression:{drillId:"guard_hesitation_attack",name:"Hesitation to Attack"}},
        {id:"guard_combo_moves",name:"Combo Moves",trackingMode:"count",confidence:true,target:{count:12}},
        {id:"guard_finish_contact",name:"Finishing Through Contact",trackingMode:"makes_target",confidence:true,target:{makes:20}},
        {id:"guard_pullup_makes",name:"Pull-Up Makes",trackingMode:"makes_target",confidence:true,target:{makes:20}}
      ]},
      {id:"guard_c_creation",name:"Session C — Shot Creation",focus:"Connect movement handling to game-speed shooting.",drills:[
        {id:"guard_movement_handle",name:"Movement Handle",trackingMode:"duration",confidence:true,target:{durationMinutes:10}},
        {id:"guard_change_direction_combo",name:"Change-of-Direction Combo",trackingMode:"confidence",target:{durationMinutes:8}},
        {id:"guard_movement_shooting",name:"Shooting Off Movement",trackingMode:"makes_target",confidence:true,target:{makes:25}},
        {id:"guard_pressure_makes",name:"Pressure Makes",trackingMode:"makes_target",confidence:true,target:{makes:10}},
        {id:"guard_three_benchmark",name:"3PT Benchmark",trackingMode:"benchmark_shooting",target:{attempts:25,minAttempts:15}}
      ]}
    ]
  },
  {
    id:"shooting_focus_2_session",version:1,name:"Shooting Focus — 2 Session",
    description:"Higher shooting volume with selective objective benchmarks.",
    sessions:[
      {id:"shooting_a_mechanics_volume",name:"Session A — Mechanics + Volume",focus:"Groove mechanics and accumulate quality makes from set spots.",drills:[
        {id:"shooting_form_makes",name:"Form Shooting",trackingMode:"makes_target",confidence:true,target:{makes:25}},
        {id:"shooting_midrange_makes",name:"Midrange Makes",trackingMode:"makes_target",confidence:true,target:{makes:30}},
        {id:"shooting_spot_threes",name:"Spot Threes",trackingMode:"makes_target",confidence:true,target:{makes:25}},
        {id:"shooting_ft_target",name:"Free Throw Makes",trackingMode:"makes_target",target:{makes:15}}
      ]},
      {id:"shooting_b_game_speed",name:"Session B — Game Speed + Pressure",focus:"Shoot off movement and finish with a measured benchmark.",drills:[
        {id:"shooting_game_speed",name:"Game-Speed Shooting",trackingMode:"makes_target",confidence:true,target:{makes:30}},
        {id:"shooting_movement",name:"Movement Shooting",trackingMode:"makes_target",confidence:true,target:{makes:25}},
        {id:"shooting_pressure",name:"Pressure Makes",trackingMode:"makes_target",confidence:true,target:{makes:10}},
        {id:"shooting_ft_benchmark",name:"Free Throws — Benchmark",trackingMode:"benchmark_shooting",target:{attempts:25,minAttempts:15}}
      ]}
    ]
  }
]);

function mfBasketballGetProgram(programId,version){
  return MF_BASKETBALL_PROGRAMS.find(function(program){return program.id===programId&&(version==null||program.version===Number(version));})||null;
}

function mfBasketballDefaultProgramState(){
  return {schemaVersion:MF_BASKETBALL_PROGRAM_STATE_SCHEMA_VERSION,activeProgramId:null,activeProgramVersion:null,nextSessionIndex:0,selectedAt:null,updatedAt:null};
}

function mfBasketballNormalizeProgramState(input,options){
  options=options||{};
  const errors=[],value=input&&typeof input==="object"&&!Array.isArray(input)?input:null;
  if(!value)return {ok:false,errors:["Basketball program state must be an object."],state:mfBasketballDefaultProgramState()};
  if(Number(value.schemaVersion)!==MF_BASKETBALL_PROGRAM_STATE_SCHEMA_VERSION)errors.push("Basketball program state schema is unsupported.");
  const activeProgramId=value.activeProgramId==null?null:String(value.activeProgramId);
  const activeProgramVersion=value.activeProgramVersion==null?null:Number(value.activeProgramVersion);
  const program=activeProgramId?mfBasketballGetProgram(activeProgramId,activeProgramVersion):null;
  if(activeProgramId&&!program)errors.push("Basketball program identity is unsupported.");
  if(!activeProgramId&&value.activeProgramVersion!=null)errors.push("Basketball program version requires an active program.");
  const nextSessionIndex=Number(value.nextSessionIndex);
  if(!Number.isInteger(nextSessionIndex)||nextSessionIndex<0||(program&&nextSessionIndex>=program.sessions.length))errors.push("Basketball next-session position is invalid.");
  ["selectedAt","updatedAt"].forEach(function(key){if(value[key]!=null&&!mfBasketballIsIsoTimestamp(value[key]))errors.push("Basketball program "+key+" is malformed.");});
  if(errors.length)return {ok:false,errors:errors,state:mfBasketballDefaultProgramState()};
  return {ok:true,errors:[],state:{schemaVersion:MF_BASKETBALL_PROGRAM_STATE_SCHEMA_VERSION,activeProgramId:activeProgramId,activeProgramVersion:activeProgramVersion,nextSessionIndex:nextSessionIndex,selectedAt:value.selectedAt==null?null:new Date(value.selectedAt).toISOString(),updatedAt:value.updatedAt==null?null:new Date(value.updatedAt).toISOString()}};
}

function mfBasketballParseProgramStateValue(raw){
  if(raw==null||raw==="")return {parseOk:true,keyExists:false,error:null,state:mfBasketballDefaultProgramState()};
  let parsed;try{parsed=typeof raw==="string"?JSON.parse(raw):raw;}catch(e){return {parseOk:false,keyExists:true,error:"Basketball program state is not valid JSON.",state:mfBasketballDefaultProgramState()};}
  const normalized=mfBasketballNormalizeProgramState(parsed,{stored:true});
  return {parseOk:normalized.ok,keyExists:true,error:normalized.ok?null:normalized.errors.join(" "),state:normalized.state};
}

function mfBasketballReadProgramState(){
  try{return mfBasketballParseProgramStateValue(localStorage.getItem(MF_BASKETBALL_PROGRAM_STATE_KEY));}
  catch(e){return {parseOk:false,keyExists:false,error:"Basketball program state could not be read.",state:mfBasketballDefaultProgramState()};}
}

function mfBasketballWriteProgramState(state){
  const normalized=mfBasketballNormalizeProgramState(state,{stored:true});
  if(!normalized.ok)throw new Error(normalized.errors.join(" "));
  localStorage.setItem(MF_BASKETBALL_PROGRAM_STATE_KEY,JSON.stringify(normalized.state));
  return normalized.state;
}

function mfBasketballSelectProgram(programId,nowValue){
  const program=mfBasketballGetProgram(String(programId||""));if(!program)return {ok:false,error:"Choose a valid basketball program.",state:mfBasketballDefaultProgramState()};
  const now=new Date(nowValue||new Date()).toISOString();
  const state={schemaVersion:MF_BASKETBALL_PROGRAM_STATE_SCHEMA_VERSION,activeProgramId:program.id,activeProgramVersion:program.version,nextSessionIndex:0,selectedAt:now,updatedAt:now};
  try{return {ok:true,error:null,state:mfBasketballWriteProgramState(state)};}catch(e){return {ok:false,error:"Basketball program selection could not be saved.",state:mfBasketballDefaultProgramState()};}
}

function mfBasketballAdvanceProgramState(nowValue){
  const current=mfBasketballReadProgramState();if(!current.parseOk||!current.state.activeProgramId)return {ok:false,error:current.error||"No basketball program is active.",state:current.state};
  const program=mfBasketballGetProgram(current.state.activeProgramId,current.state.activeProgramVersion);if(!program)return {ok:false,error:"The active basketball program is unavailable.",state:current.state};
  const state=Object.assign({},current.state,{nextSessionIndex:(current.state.nextSessionIndex+1)%program.sessions.length,updatedAt:new Date(nowValue||new Date()).toISOString()});
  try{return {ok:true,error:null,state:mfBasketballWriteProgramState(state)};}catch(e){return {ok:false,error:"Basketball program progress could not be saved.",state:current.state};}
}

function mfBasketballRestartProgram(nowValue){
  const current=mfBasketballReadProgramState();if(!current.parseOk||!current.state.activeProgramId)return {ok:false,error:current.error||"No basketball program is active.",state:current.state};
  const state=Object.assign({},current.state,{nextSessionIndex:0,updatedAt:new Date(nowValue||new Date()).toISOString()});
  try{return {ok:true,error:null,state:mfBasketballWriteProgramState(state)};}catch(e){return {ok:false,error:"Basketball program could not be restarted.",state:current.state};}
}

let mfBasketballEditingId = null;
let mfBasketballPendingDeleteId = null;
let mfBasketballSaving = false;
let mfBasketballPendingProgramAction = null;
let mfBasketballStructuredContext = null;

function mfBasketballDateKey(value){
  if(value instanceof Date && !isNaN(value.getTime())){
    const y=value.getFullYear(),m=String(value.getMonth()+1).padStart(2,"0"),d=String(value.getDate()).padStart(2,"0");
    return y+"-"+m+"-"+d;
  }
  return String(value||"").trim();
}

function mfBasketballIsValidDate(value){
  const text=String(value||"");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return false;
  const parts=text.split("-").map(Number),date=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]));
  return date.getUTCFullYear()===parts[0]&&date.getUTCMonth()===parts[1]-1&&date.getUTCDate()===parts[2];
}

function mfBasketballIsIsoTimestamp(value){
  return typeof value==="string"&&value.trim()!==""&&!isNaN(Date.parse(value));
}

function mfBasketballCreateId(nowValue,randomValue){
  const now=Number(nowValue==null?Date.now():nowValue);
  let random=randomValue;
  if(random==null){
    if(typeof crypto!=="undefined"&&crypto&&typeof crypto.randomUUID==="function")random=crypto.randomUUID().replace(/-/g,"").slice(0,12);
    else random=Math.random().toString(36).slice(2,14);
  }
  return "bball-"+Math.max(0,Math.floor(now)).toString(36)+"-"+String(random).replace(/[^a-zA-Z0-9]/g,"").toLowerCase().slice(0,24);
}

function mfBasketballOptionalNumber(value,label,max,integer,errors){
  if(value==null||String(value).trim()==="")return null;
  const number=Number(value);
  if(!Number.isFinite(number)||number<0||number>max||(integer&&!Number.isInteger(number))){
    errors.push(label+" must be "+(integer?"a whole number":"a number")+" from 0 to "+max+".");
    return null;
  }
  return number;
}

function mfBasketballNormalizePair(input,madeKey,attemptedKey,label,errors){
  const nested=input&&input[label==="Shooting"?"shooting":"freeThrows"];
  const rawMade=input&&input[madeKey]!=null?input[madeKey]:nested&&nested.made;
  const rawAttempted=input&&input[attemptedKey]!=null?input[attemptedKey]:nested&&nested.attempted;
  const made=mfBasketballOptionalNumber(rawMade,label+" makes",MF_BASKETBALL_LIMITS.count,true,errors);
  const attempted=mfBasketballOptionalNumber(rawAttempted,label+" attempts",MF_BASKETBALL_LIMITS.count,true,errors);
  const hasMade=rawMade!=null&&String(rawMade).trim()!=="",hasAttempted=rawAttempted!=null&&String(rawAttempted).trim()!=="";
  if(hasMade!==hasAttempted)errors.push(label+" makes and attempts must both be supplied.");
  if(made!==null&&attempted!==null&&made>attempted){
    errors.push(label==="Shooting"?"Shooting makes cannot exceed attempts.":"Free throws made cannot exceed free throws attempted.");
  }
  return made!==null&&attempted!==null?{made:made,attempted:attempted}:null;
}

function mfBasketballSnapshotText(value,label,max,errors){
  const text=String(value||"").trim();
  if(!text||text.length>max)errors.push(label+" is missing or too long.");
  return text;
}

function mfBasketballNormalizePlannedTarget(value,mode,errors){
  if(value==null)return null;
  if(typeof value!=="object"||Array.isArray(value)){errors.push("Drill planned target is malformed.");return null;}
  const target={};
  function add(key,max,allowZero){
    if(value[key]==null)return;
    const number=Number(value[key]);
    if(!Number.isFinite(number)||number<0||(!allowZero&&number===0)||number>max){errors.push("Drill planned "+key+" is invalid.");return;}
    target[key]=number;
  }
  add("durationMinutes",MF_BASKETBALL_LIMITS.minutes,false);add("makes",MF_BASKETBALL_LIMITS.count,true);add("attempts",MF_BASKETBALL_LIMITS.count,false);add("minAttempts",MF_BASKETBALL_LIMITS.count,false);add("count",MF_BASKETBALL_LIMITS.count,true);
  if(mode==="makes_target"&&target.makes==null)errors.push("Makes-target drill is missing its planned makes snapshot.");
  if(mode==="benchmark_shooting"&&target.attempts==null)errors.push("Benchmark drill is missing its planned attempts snapshot.");
  return Object.keys(target).length?target:null;
}

function mfBasketballNormalizeDrillResult(input,options,errors){
  options=options||{};input=input&&typeof input==="object"&&!Array.isArray(input)?input:{};
  const drillId=String(input.drillId||"").trim(),trackingMode=String(input.trackingMode||"").trim();
  if(!/^[a-z0-9][a-z0-9_]{2,79}$/.test(drillId))errors.push("Drill ID is missing or malformed.");
  if(MF_BASKETBALL_TRACKING_MODES.indexOf(trackingMode)===-1)errors.push("Drill tracking mode is unsupported.");
  const nameSnapshot=mfBasketballSnapshotText(input.nameSnapshot,"Drill name snapshot",160,errors);
  const plannedTargetSnapshot=mfBasketballNormalizePlannedTarget(input.plannedTargetSnapshot,trackingMode,errors);
  const notes=String(input.notes||"").trim();if(notes.length>MF_BASKETBALL_LIMITS.notes)errors.push("Drill notes must be 2000 characters or fewer.");
  let confidence=null;
  if(input.confidence!=null&&String(input.confidence).trim()!==""){
    confidence=Number(input.confidence);if(!Number.isInteger(confidence)||confidence<1||confidence>10){errors.push("Confidence must be a whole number from 1 to 10.");confidence=null;}
  }
  const source=input.actualResult&&typeof input.actualResult==="object"&&!Array.isArray(input.actualResult)?input.actualResult:{};
  let actualResult=null;
  if(trackingMode==="confidence"){
    if(confidence==null)errors.push("Confidence is required for confidence drills.");
    actualResult={};
    if(source.durationMinutes!=null&&String(source.durationMinutes).trim()!==""){
      const duration=Number(source.durationMinutes);if(!Number.isFinite(duration)||duration<0||duration>MF_BASKETBALL_LIMITS.minutes)errors.push("Actual drill duration is invalid.");else actualResult.durationMinutes=duration;
    }
  }else if(trackingMode==="duration"){
    const duration=Number(source.durationMinutes);if(!Number.isFinite(duration)||duration<0||duration>MF_BASKETBALL_LIMITS.minutes)errors.push("Actual drill duration is required and must be valid.");else actualResult={durationMinutes:duration};
  }else if(trackingMode==="makes_target"){
    const makes=Number(source.makes);if(!Number.isInteger(makes)||makes<0||makes>MF_BASKETBALL_LIMITS.count)errors.push("Makes completed must be a whole number from 0 to 10000.");else actualResult={makes:makes,targetAchieved:!!(plannedTargetSnapshot&&makes>=plannedTargetSnapshot.makes)};
  }else if(trackingMode==="benchmark_shooting"){
    const made=Number(source.made),attempted=Number(source.attempted);
    if(!Number.isInteger(attempted)||attempted<=0||attempted>MF_BASKETBALL_LIMITS.count)errors.push("Benchmark attempts must be a whole number greater than 0.");
    if(!Number.isInteger(made)||made<0||made>MF_BASKETBALL_LIMITS.count)errors.push("Benchmark makes must be a whole number from 0 to 10000.");
    if(Number.isInteger(made)&&Number.isInteger(attempted)&&made>attempted)errors.push("Benchmark makes cannot exceed attempts.");
    if(Number.isInteger(made)&&Number.isInteger(attempted)&&attempted>0&&made<=attempted)actualResult={made:made,attempted:attempted,percentage:Math.round(made/attempted*1000)/10};
  }else if(trackingMode==="count"){
    const count=Number(source.count);if(!Number.isInteger(count)||count<0||count>MF_BASKETBALL_LIMITS.count)errors.push("Actual count must be a whole number from 0 to 10000.");else actualResult={count:count};
  }else if(trackingMode==="completion"){
    if(typeof source.completed!=="boolean")errors.push("Completion drill must be marked completed or not completed.");else actualResult={completed:source.completed};
  }
  const result={drillId:drillId,nameSnapshot:nameSnapshot,trackingMode:trackingMode,actualResult:actualResult};
  if(plannedTargetSnapshot)result.plannedTargetSnapshot=plannedTargetSnapshot;
  if(confidence!=null)result.confidence=confidence;
  if(notes)result.notes=notes;
  return result;
}

function mfBasketballNormalizeStructuredFields(input,errors){
  const hasStructured=input.programId!=null||input.plannedSessionId!=null||input.drills!=null;
  if(!hasStructured)return null;
  const programId=String(input.programId||"").trim(),programVersion=Number(input.programVersion),plannedSessionId=String(input.plannedSessionId||"").trim();
  if(!/^[a-z0-9][a-z0-9_]{2,79}$/.test(programId))errors.push("Basketball program ID is missing or malformed.");
  if(!Number.isInteger(programVersion)||programVersion<1)errors.push("Basketball program version is invalid.");
  if(!/^[a-z0-9][a-z0-9_]{2,79}$/.test(plannedSessionId))errors.push("Planned basketball session ID is missing or malformed.");
  const programNameSnapshot=mfBasketballSnapshotText(input.programNameSnapshot,"Program name snapshot",160,errors);
  const plannedSessionNameSnapshot=mfBasketballSnapshotText(input.plannedSessionNameSnapshot,"Planned session name snapshot",160,errors);
  if(!Array.isArray(input.drills)||!input.drills.length||input.drills.length>30)errors.push("Structured basketball session must contain 1 to 30 drill results.");
  const seen=new Set(),drills=Array.isArray(input.drills)?input.drills.slice(0,30).map(function(drill){const normalized=mfBasketballNormalizeDrillResult(drill,{},errors);if(seen.has(normalized.drillId))errors.push("Structured basketball session contains a duplicate drill ID.");seen.add(normalized.drillId);return normalized;}):[];
  return {programId:programId,programVersion:programVersion,programNameSnapshot:programNameSnapshot,plannedSessionId:plannedSessionId,plannedSessionNameSnapshot:plannedSessionNameSnapshot,drills:drills};
}

function mfBasketballNormalizeSession(input,options){
  options=options||{};
  input=input&&typeof input==="object"&&!Array.isArray(input)?input:{};
  const errors=[];
  const date=mfBasketballDateKey(input.date);
  const type=String(input.type||"").trim();
  const minutes=Number(input.minutes);
  if(!mfBasketballIsValidDate(date))errors.push("Session date must be a valid date.");
  if(!Object.prototype.hasOwnProperty.call(MF_BASKETBALL_TYPES,type))errors.push("Session type is required.");
  if(!Number.isFinite(minutes)||minutes<=0||minutes>MF_BASKETBALL_LIMITS.minutes)errors.push("Total minutes must be greater than 0 and no more than 1440.");
  const dribblingMinutes=mfBasketballOptionalNumber(input.dribblingMinutes,"Dribbling minutes",MF_BASKETBALL_LIMITS.minutes,false,errors);
  if(dribblingMinutes!==null&&Number.isFinite(minutes)&&dribblingMinutes>minutes)errors.push("Dribbling minutes cannot exceed total minutes.");
  const shooting=mfBasketballNormalizePair(input,"shootingMade","shootingAttempted","Shooting",errors);
  const freeThrows=mfBasketballNormalizePair(input,"freeThrowsMade","freeThrowsAttempted","Free throws",errors);
  const notes=String(input.notes||"").trim();
  if(notes.length>MF_BASKETBALL_LIMITS.notes)errors.push("Notes must be 2000 characters or fewer.");
  const structured=mfBasketballNormalizeStructuredFields(input,errors);

  const stored=options.stored===true;
  const now=String(options.now||new Date().toISOString());
  let id=String(options.id||input.id||"").trim();
  if(!id&&!stored)id=mfBasketballCreateId();
  if(!/^bball-[A-Za-z0-9-]{3,80}$/.test(id))errors.push("Session ID is missing or malformed.");
  if(stored&&Number(input.schemaVersion)!==MF_BASKETBALL_SCHEMA_VERSION)errors.push("Session schemaVersion is unsupported.");
  let createdAt=String(options.createdAt||input.createdAt||now);
  let updatedAt=String(options.updatedAt||input.updatedAt||createdAt);
  if(stored&&(!mfBasketballIsIsoTimestamp(createdAt)||!mfBasketballIsIsoTimestamp(updatedAt)))errors.push("Session timestamps are missing or malformed.");
  if(!mfBasketballIsIsoTimestamp(createdAt))createdAt=now;
  if(!mfBasketballIsIsoTimestamp(updatedAt))updatedAt=now;

  if(errors.length)return {ok:false,errors:errors,session:null};
  const session={
    id:id,schemaVersion:MF_BASKETBALL_SCHEMA_VERSION,date:date,type:type,minutes:minutes,
    createdAt:new Date(createdAt).toISOString(),updatedAt:new Date(updatedAt).toISOString()
  };
  if(dribblingMinutes!==null)session.dribblingMinutes=dribblingMinutes;
  if(shooting)session.shooting=shooting;
  if(freeThrows)session.freeThrows=freeThrows;
  if(notes)session.notes=notes;
  if(structured)Object.assign(session,structured);
  return {ok:true,errors:[],session:session};
}

function mfBasketballParseStoreValue(raw){
  const result={schemaVersion:MF_BASKETBALL_SCHEMA_VERSION,sessions:[],invalidRecordCount:0,duplicateIds:[],parseOk:true,error:null,keyExists:raw!=null};
  if(raw==null||raw==="")return result;
  let parsed;
  try{parsed=typeof raw==="string"?JSON.parse(raw):raw;}catch(e){result.parseOk=false;result.error="Basketball storage is not valid JSON.";return result;}
  const records=Array.isArray(parsed)?parsed:(parsed&&Number(parsed.schemaVersion)===MF_BASKETBALL_SCHEMA_VERSION&&Array.isArray(parsed.sessions)?parsed.sessions:null);
  if(!records){result.parseOk=false;result.error="Basketball storage schema is unsupported or malformed.";return result;}
  result.schemaVersion=Array.isArray(parsed)?MF_BASKETBALL_SCHEMA_VERSION:Number(parsed.schemaVersion);
  const seen=new Set();
  records.forEach(function(record){
    const normalized=mfBasketballNormalizeSession(record,{stored:true});
    if(!normalized.ok){result.invalidRecordCount++;return;}
    if(seen.has(normalized.session.id)){result.invalidRecordCount++;result.duplicateIds.push(normalized.session.id);return;}
    seen.add(normalized.session.id);result.sessions.push(normalized.session);
  });
  result.sessions.sort(function(a,b){return b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id);});
  return result;
}

function mfBasketballReadStore(){
  let raw=null;
  try{raw=localStorage.getItem(MF_BASKETBALL_STORAGE_KEY);}catch(e){return {schemaVersion:MF_BASKETBALL_SCHEMA_VERSION,sessions:[],invalidRecordCount:0,duplicateIds:[],parseOk:false,error:"Basketball storage could not be read.",keyExists:false};}
  return mfBasketballParseStoreValue(raw);
}

function mfBasketballWriteStore(sessions){
  const store={schemaVersion:MF_BASKETBALL_SCHEMA_VERSION,sessions:sessions.slice().sort(function(a,b){return b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id);})};
  localStorage.setItem(MF_BASKETBALL_STORAGE_KEY,JSON.stringify(store));
  return store;
}

function mfBasketballSaveSession(input,options){
  options=options||{};
  const store=mfBasketballReadStore();
  if(!store.parseOk)return {ok:false,errors:[store.error||"Basketball storage is unavailable."],session:null};
  const existingId=String(options.existingId||"");
  const existing=existingId?store.sessions.find(function(session){return session.id===existingId;}):null;
  if(existingId&&!existing)return {ok:false,errors:["The basketball session being edited no longer exists."],session:null};
  const now=String(options.now||new Date().toISOString());
  const normalized=mfBasketballNormalizeSession(input,{
    id:existing?existing.id:(options.id||""),
    createdAt:existing?existing.createdAt:now,
    updatedAt:now,
    now:now
  });
  if(!normalized.ok)return normalized;
  if(!existing&&store.sessions.some(function(session){return session.id===normalized.session.id;}))return {ok:false,errors:["A session with this ID already exists."],session:null};
  const sessions=existing?store.sessions.map(function(session){return session.id===existing.id?normalized.session:session;}):store.sessions.concat([normalized.session]);
  try{mfBasketballWriteStore(sessions);}catch(e){return {ok:false,errors:["Basketball session could not be saved."],session:null};}
  return {ok:true,errors:[],session:normalized.session};
}

function mfBasketballBuildStructuredInput(payload){
  payload=payload&&typeof payload==="object"?payload:{};
  const program=mfBasketballGetProgram(String(payload.programId||""),payload.programVersion),planned=program&&program.sessions.find(function(session){return session.id===payload.plannedSessionId;});
  if(!program||!planned)return {ok:false,errors:["The planned basketball session is unavailable."],input:null};
  const supplied=Array.isArray(payload.drills)?payload.drills:[],byId={};supplied.forEach(function(result){if(result&&result.drillId)byId[result.drillId]=result;});
  const drills=planned.drills.map(function(definition){
    const result=byId[definition.id]||{};
    return {drillId:definition.id,nameSnapshot:definition.name,trackingMode:definition.trackingMode,plannedTargetSnapshot:definition.target||null,actualResult:result.actualResult||null,confidence:result.confidence,notes:result.notes};
  });
  const input={date:payload.date,type:"basketball_workout",minutes:payload.minutes,notes:payload.notes,programId:program.id,programVersion:program.version,programNameSnapshot:program.name,plannedSessionId:planned.id,plannedSessionNameSnapshot:planned.name,drills:drills};
  const normalized=mfBasketballNormalizeSession(input,{id:payload.id||"",now:payload.now||new Date().toISOString()});
  return normalized.ok?{ok:true,errors:[],input:input}:{ok:false,errors:normalized.errors,input:null};
}

function mfBasketballFinishStructuredSession(payload,action){
  payload=payload&&typeof payload==="object"?payload:{};action=String(action||"");
  if(["advance","repeat","edit"].indexOf(action)===-1)return {ok:false,errors:["Choose Finish & Advance or Finish & Repeat Session."],session:null,advanced:false};
  const built=mfBasketballBuildStructuredInput(payload);if(!built.ok)return {ok:false,errors:built.errors,session:null,advanced:false};
  const isEdit=!!payload.existingId;
  if(action==="advance"&&!isEdit){
    const current=mfBasketballReadProgramState(),program=mfBasketballGetProgram(payload.programId,payload.programVersion),next=program&&program.sessions[current.state.nextSessionIndex];
    if(!current.parseOk||!program||current.state.activeProgramId!==program.id||current.state.activeProgramVersion!==program.version||!next||next.id!==payload.plannedSessionId)return {ok:false,errors:["Program progress changed. Reopen the current planned session before advancing."],session:null,advanced:false};
  }
  let priorSessions=null,priorProgram=null;
  try{priorSessions=localStorage.getItem(MF_BASKETBALL_STORAGE_KEY);priorProgram=localStorage.getItem(MF_BASKETBALL_PROGRAM_STATE_KEY);}catch(e){}
  const saved=mfBasketballSaveSession(built.input,{existingId:payload.existingId||"",id:payload.id||"",now:payload.now});
  if(!saved.ok)return {ok:false,errors:saved.errors,session:null,advanced:false};
  if(action==="advance"&&!isEdit){
    const advanced=mfBasketballAdvanceProgramState(payload.now);
    if(!advanced.ok){
      try{if(priorSessions==null)localStorage.removeItem(MF_BASKETBALL_STORAGE_KEY);else localStorage.setItem(MF_BASKETBALL_STORAGE_KEY,priorSessions);if(priorProgram==null)localStorage.removeItem(MF_BASKETBALL_PROGRAM_STATE_KEY);else localStorage.setItem(MF_BASKETBALL_PROGRAM_STATE_KEY,priorProgram);}catch(e){}
      return {ok:false,errors:[advanced.error||"Program progress could not be saved."],session:null,advanced:false};
    }
    return {ok:true,errors:[],session:saved.session,advanced:true,programState:advanced.state};
  }
  return {ok:true,errors:[],session:saved.session,advanced:false,programState:mfBasketballReadProgramState().state};
}

function mfBasketballDeleteSession(id){
  const store=mfBasketballReadStore();
  if(!store.parseOk)return false;
  const next=store.sessions.filter(function(session){return session.id!==id;});
  if(next.length===store.sessions.length)return false;
  try{mfBasketballWriteStore(next);return true;}catch(e){return false;}
}

function mfBasketballAggregate(sessions){
  const list=Array.isArray(sessions)?sessions:[];
  const totals={totalSessions:list.length,totalMinutes:0,averageMinutes:0,structuredSessions:0,shooting:{made:0,attempted:0,percentage:null},freeThrows:{made:0,attempted:0,percentage:null},drillCounts:{},confidenceByDrill:{},benchmarksByDrill:{}};
  list.forEach(function(session){
    totals.totalMinutes+=Number(session.minutes)||0;
    if(Array.isArray(session.drills)){
      totals.structuredSessions++;
      session.drills.forEach(function(drill){
        totals.drillCounts[drill.drillId]=(totals.drillCounts[drill.drillId]||{name:drill.nameSnapshot,count:0});totals.drillCounts[drill.drillId].count++;
        if(drill.confidence!=null){if(!totals.confidenceByDrill[drill.drillId])totals.confidenceByDrill[drill.drillId]={name:drill.nameSnapshot,values:[]};totals.confidenceByDrill[drill.drillId].values.push({date:session.date,value:drill.confidence});}
        if(drill.trackingMode==="benchmark_shooting"&&drill.actualResult){if(!totals.benchmarksByDrill[drill.drillId])totals.benchmarksByDrill[drill.drillId]={name:drill.nameSnapshot,values:[]};totals.benchmarksByDrill[drill.drillId].values.push({date:session.date,made:drill.actualResult.made,attempted:drill.actualResult.attempted,percentage:drill.actualResult.percentage});}
      });
    }
    if(session.shooting){totals.shooting.made+=session.shooting.made;totals.shooting.attempted+=session.shooting.attempted;}
    if(session.freeThrows){totals.freeThrows.made+=session.freeThrows.made;totals.freeThrows.attempted+=session.freeThrows.attempted;}
  });
  totals.averageMinutes=totals.totalSessions?totals.totalMinutes/totals.totalSessions:0;
  if(totals.shooting.attempted>0)totals.shooting.percentage=totals.shooting.made/totals.shooting.attempted*100;
  if(totals.freeThrows.attempted>0)totals.freeThrows.percentage=totals.freeThrows.made/totals.freeThrows.attempted*100;
  return totals;
}

function mfBasketballFindDrillDefinition(drillId){
  for(let p=0;p<MF_BASKETBALL_PROGRAMS.length;p++)for(let s=0;s<MF_BASKETBALL_PROGRAMS[p].sessions.length;s++){
    const drill=MF_BASKETBALL_PROGRAMS[p].sessions[s].drills.find(function(item){return item.id===drillId;});if(drill)return drill;
  }
  return null;
}

function mfBasketballDrillHistory(drillId,sessions){
  const exposures=[];(Array.isArray(sessions)?sessions:[]).forEach(function(session){(session.drills||[]).forEach(function(drill){if(drill.drillId===drillId)exposures.push({date:session.date,createdAt:session.createdAt,sessionId:session.id,drill:drill});});});
  return exposures.sort(function(a,b){return b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||a.sessionId.localeCompare(b.sessionId);});
}

function mfBasketballConfidenceGuidance(recent,definition){
  const values=recent.map(function(item){return item.drill.confidence;}).filter(function(value){return Number.isInteger(value);}).slice(0,3);
  if(!values.length)return {status:"no_data",label:"NO CONFIDENCE DATA",guidance:"Record confidence to build progression guidance.",ready:false,recent:[]};
  const average=values.reduce(function(sum,value){return sum+value;},0)/values.length,last=values[0];
  if(last<=3||average<4)return {status:"needs_work",label:"NEEDS WORK",guidance:"Repeat the foundation at the current difficulty.",ready:false,recent:values};
  if(values.length<3)return {status:"building_baseline",label:"BUILDING BASELINE",guidance:"Repeat this drill before changing difficulty.",ready:false,recent:values};
  if(values.every(function(value){return value>=7;})&&average>=7.5){const next=definition&&definition.progression;return {status:"ready_to_progress",label:"READY TO PROGRESS",guidance:next?"Try "+next.name+".":"Add a small difficulty increase while keeping quality high.",ready:true,recent:values};}
  if(average>=6)return {status:"solid",label:"SOLID",guidance:"Maintain this drill; a small progression can follow repeated strong work.",ready:false,recent:values};
  return {status:"developing",label:"DEVELOPING",guidance:"Stay at the current target and build consistency.",ready:false,recent:values};
}

function mfBasketballMakesTargetGuidance(recent,definition){
  const usable=recent.filter(function(item){return item.drill.actualResult&&Number.isFinite(item.drill.actualResult.makes)&&item.drill.plannedTargetSnapshot&&Number.isFinite(item.drill.plannedTargetSnapshot.makes);}).slice(0,3);
  if(!usable.length)return {status:"no_data",label:"NO TARGET DATA",guidance:"Record completed makes to build progression guidance.",ready:false,recent:[]};
  const achieved=usable.map(function(item){return item.drill.actualResult.makes>=item.drill.plannedTargetSnapshot.makes;}),confidences=usable.map(function(item){return item.drill.confidence;}).filter(function(value){return Number.isInteger(value);});
  const confidenceReady=!confidences.length||confidences.length>=2&&confidences.reduce(function(sum,value){return sum+value;},0)/confidences.length>=7;
  if(usable.length>=3&&achieved.every(Boolean)&&confidenceReady){const target=usable[0].drill.plannedTargetSnapshot.makes,next=definition&&definition.progression;return {status:"ready_to_progress",label:"READY TO PROGRESS",guidance:next?"Try "+next.name+".":"Raise the makes target modestly to "+Math.ceil(target*1.1)+".",ready:true,recent:usable.map(function(item){return item.drill.actualResult.makes;})};}
  return {status:achieved[0]?"building_consistency":"hold",label:achieved[0]?"BUILDING CONSISTENCY":"HOLD TARGET",guidance:"Keep the current makes target until it is completed consistently.",ready:false,recent:usable.map(function(item){return item.drill.actualResult.makes;})};
}

function mfBasketballBenchmarkGuidance(recent){
  const usable=recent.filter(function(item){const result=item.drill.actualResult,target=item.drill.plannedTargetSnapshot||{};return result&&result.attempted>0&&result.attempted>=(target.minAttempts||10);}).slice(0,3);
  if(!usable.length)return {status:"small_sample",label:"BUILD BENCHMARK SAMPLE",guidance:"Use at least the planned minimum attempts before reading the trend.",ready:false,recent:[]};
  const values=usable.map(function(item){return item.drill.actualResult.percentage;});
  if(values.length<2)return {status:"baseline",label:"BENCHMARK BASELINE",guidance:"Repeat this benchmark to establish a trend.",ready:false,recent:values};
  const delta=Math.round((values[0]-values[values.length-1])*10)/10;
  return {status:delta>2?"improving":delta< -2?"declining":"steady",label:delta>2?"IMPROVING TREND":delta< -2?"TREND DOWN":"STEADY TREND",guidance:"Recent valid samples: "+values.slice().reverse().join("% → ")+"%.",ready:false,recent:values,trend:delta};
}

function mfBasketballDurationGuidance(recent,definition){
  const usable=recent.filter(function(item){return item.drill.actualResult&&Number.isFinite(item.drill.actualResult.durationMinutes)&&item.drill.plannedTargetSnapshot&&Number.isFinite(item.drill.plannedTargetSnapshot.durationMinutes);}).slice(0,3);
  if(!usable.length)return {status:"no_data",label:"NO DURATION DATA",guidance:"Record actual duration to build progression guidance.",ready:false,recent:[]};
  const achieved=usable.map(function(item){return item.drill.actualResult.durationMinutes>=item.drill.plannedTargetSnapshot.durationMinutes;}),confidences=usable.map(function(item){return item.drill.confidence;}).filter(function(value){return Number.isInteger(value);});
  const confidenceReady=!confidences.length||confidences.length>=2&&confidences.reduce(function(sum,value){return sum+value;},0)/confidences.length>=7;
  if(usable.length>=3&&achieved.every(Boolean)&&confidenceReady){const next=definition&&definition.progression,target=usable[0].drill.plannedTargetSnapshot.durationMinutes;return {status:"ready_to_progress",label:"READY TO PROGRESS",guidance:next?"Try "+next.name+".":"Add "+Math.max(1,Math.min(3,Math.ceil(target*.15)))+" minute while preserving quality.",ready:true,recent:usable.map(function(item){return item.drill.actualResult.durationMinutes;})};}
  return {status:"hold",label:"HOLD DURATION",guidance:"Repeat the current duration until it is comfortable and consistent.",ready:false,recent:usable.map(function(item){return item.drill.actualResult.durationMinutes;})};
}

function mfBasketballProgressionForDrill(drillId,sessions,definition){
  definition=definition||mfBasketballFindDrillDefinition(drillId);const recent=mfBasketballDrillHistory(drillId,sessions);
  const mode=definition&&definition.trackingMode||(recent[0]&&recent[0].drill.trackingMode);
  if(mode==="confidence")return mfBasketballConfidenceGuidance(recent,definition);
  if(mode==="makes_target")return mfBasketballMakesTargetGuidance(recent,definition);
  if(mode==="benchmark_shooting")return mfBasketballBenchmarkGuidance(recent);
  if(mode==="duration")return mfBasketballDurationGuidance(recent,definition);
  if(mode==="count"||mode==="completion")return {status:recent.length?"logged":"no_data",label:recent.length?"CONSISTENCY":"NO DATA",guidance:recent.length?"Continue building consistent exposures.":"Complete this drill to start tracking.",ready:false,recent:recent.slice(0,3)};
  return {status:"no_data",label:"NO DATA",guidance:"No progression guidance is available.",ready:false,recent:[]};
}

function mfBasketballTypeLabel(type){return MF_BASKETBALL_TYPES[type]||"Basketball";}
function mfBasketballPercent(pair){return pair&&pair.attempted>0?Math.round(pair.made/pair.attempted*1000)/10:null;}
function mfBasketballFormatDate(date){return new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"});}

function mfBasketballFormValue(id){const el=document.getElementById(id);return el?el.value:"";}
function mfBasketballSetFormValue(id,value){const el=document.getElementById(id);if(el)el.value=value==null?"":String(value);}
function mfBasketballSelectedAppDate(){return typeof tDate!=="undefined"?mfBasketballDateKey(tDate):mfBasketballDateKey(new Date());}

function mfBasketballElement(tag,className,textValue){
  const element=document.createElement(tag);if(className)element.className=className;if(textValue!=null)element.textContent=String(textValue);return element;
}

function mfBasketballDescribeTarget(drill){
  const target=drill.target||drill.plannedTargetSnapshot||{};
  if(drill.trackingMode==="confidence")return target.durationMinutes?target.durationMinutes+" planned minutes · Confidence 1–10":"Confidence 1–10";
  if(drill.trackingMode==="duration")return target.durationMinutes+" planned minutes"+(drill.confidence?" · Confidence optional":"");
  if(drill.trackingMode==="makes_target")return "Make "+target.makes+(drill.confidence?" · Quality confidence optional":"");
  if(drill.trackingMode==="benchmark_shooting")return target.attempts+" planned attempts";
  if(drill.trackingMode==="count")return "Target: "+target.count;
  return "Complete the block";
}

function mfBasketballShowStructuredMessage(message,type){
  const element=document.getElementById("mfBasketballStructuredMessage");if(!element)return;element.textContent=message||"";element.className="mf-basketball-message"+(message?" "+(type||"ok"):"");
}

function mfBasketballRenderProgramSurface(){
  const select=document.getElementById("mfBasketballProgramSelect"),status=document.getElementById("mfBasketballProgramStatus"),summary=document.getElementById("mfBasketballProgramSummary"),nextRoot=document.getElementById("mfBasketballNextSession"),actions=document.getElementById("mfBasketballProgramActions");
  if(!select||!status||!summary||!nextRoot)return;
  const prior=select.value;select.replaceChildren();const empty=mfBasketballElement("option","","Select a program");empty.value="";select.appendChild(empty);
  MF_BASKETBALL_PROGRAMS.forEach(function(program){const option=mfBasketballElement("option","",program.name);option.value=program.id;select.appendChild(option);});
  const stored=mfBasketballReadProgramState(),program=mfBasketballGetProgram(stored.state.activeProgramId,stored.state.activeProgramVersion);
  select.value=program?program.id:(prior&&mfBasketballGetProgram(prior)?prior:"");summary.replaceChildren();nextRoot.replaceChildren();
  if(!stored.parseOk){status.textContent="Program state is unavailable. Restore a valid backup or choose a program to replace it.";status.className="mf-basketball-program-status error";if(actions)actions.hidden=true;return;}
  if(!program){status.textContent="No structured program selected. Free-form logging remains available.";status.className="mf-basketball-program-status";summary.textContent="Choose a flexible session queue. Training advances only when you finish and explicitly choose Advance.";if(actions)actions.hidden=true;return;}
  const planned=program.sessions[stored.state.nextSessionIndex];status.textContent="Active: "+program.name;status.className="mf-basketball-program-status active";
  const description=mfBasketballElement("div","mf-basketball-program-description",program.description);const position=mfBasketballElement("div","mf-basketball-program-position","Session "+(stored.state.nextSessionIndex+1)+" of "+program.sessions.length+" next");summary.append(description,position);
  const kicker=mfBasketballElement("div","mf-basketball-next-kicker","NEXT PLANNED SESSION"),title=mfBasketballElement("div","mf-basketball-next-title",planned.name),focus=mfBasketballElement("div","mf-basketball-next-focus",planned.focus),list=mfBasketballElement("ol","mf-basketball-next-drills");
  planned.drills.forEach(function(drill){const item=mfBasketballElement("li","",drill.name);const target=mfBasketballElement("span","",mfBasketballDescribeTarget(drill));item.appendChild(target);list.appendChild(item);});
  const start=mfBasketballElement("button","mf-basketball-start","START PLANNED SESSION");start.type="button";start.id="mfBasketballStartPlanned";start.addEventListener("click",mfBasketballStartPlannedSession);nextRoot.append(kicker,title,focus,list,start);if(actions)actions.hidden=false;
}

function mfBasketballCreateNumberField(labelText,field,min,max,step,value){
  const label=mfBasketballElement("label","mf-basketball-field",labelText),input=mfBasketballElement("input");input.type="number";input.inputMode=step&&step!==1?"decimal":"numeric";input.min=String(min);input.max=String(max);input.step=String(step||1);input.dataset.field=field;if(value!=null)input.value=String(value);label.appendChild(input);return label;
}

function mfBasketballAddConfidenceControl(card,value){
  const group=mfBasketballElement("fieldset","mf-basketball-confidence"),legend=mfBasketballElement("legend","","Confidence: 1–10"),display=mfBasketballElement("span","mf-basketball-confidence-value",value?value+" / 10":"Not scored"),input=mfBasketballElement("input");input.type="hidden";input.dataset.field="confidence";input.value=value==null?"":String(value);group.append(legend,display,input);
  const buttons=mfBasketballElement("div","mf-basketball-confidence-buttons");
  for(let score=1;score<=10;score++){
    const button=mfBasketballElement("button","mf-basketball-confidence-button",score);button.type="button";button.dataset.score=String(score);button.setAttribute("aria-label","Confidence "+score+" out of 10");button.setAttribute("aria-pressed",String(Number(value)===score));
    button.addEventListener("click",function(){input.value=String(score);display.textContent=score+" / 10";buttons.querySelectorAll("button").forEach(function(item){item.setAttribute("aria-pressed",String(item===button));});mfBasketballUpdateStructuredSummary();});buttons.appendChild(button);
  }
  group.appendChild(buttons);card.appendChild(group);
}

function mfBasketballRenderDrillCard(definition,index,existing){
  existing=existing||{};const card=mfBasketballElement("article","mf-basketball-drill-card");card.dataset.drillId=definition.id;card.dataset.trackingMode=definition.trackingMode;
  const head=mfBasketballElement("div","mf-basketball-drill-head"),number=mfBasketballElement("span","mf-basketball-drill-number",index+1),text=mfBasketballElement("div"),name=mfBasketballElement("div","mf-basketball-drill-name",definition.name),plan=mfBasketballElement("div","mf-basketball-drill-plan",mfBasketballDescribeTarget(definition));text.append(name,plan);head.append(number,text);card.appendChild(head);
  const prior=mfBasketballProgressionForDrill(definition.id,mfBasketballReadStore().sessions,definition);if(prior.status!=="no_data"&&prior.status!=="small_sample"){const guidance=mfBasketballElement("div","mf-basketball-guidance "+prior.status,prior.label+" — "+prior.guidance);card.appendChild(guidance);}
  const result=existing.actualResult||{},target=definition.target||{};
  if(definition.trackingMode==="confidence"){
    if(target.durationMinutes!=null)card.appendChild(mfBasketballCreateNumberField("Actual minutes (optional)","durationMinutes",0,1440,.5,result.durationMinutes));
    mfBasketballAddConfidenceControl(card,existing.confidence);
  }else if(definition.trackingMode==="duration"){
    card.appendChild(mfBasketballCreateNumberField("Actual minutes","durationMinutes",0,1440,.5,result.durationMinutes==null?target.durationMinutes:result.durationMinutes));if(definition.confidence)mfBasketballAddConfidenceControl(card,existing.confidence);
  }else if(definition.trackingMode==="makes_target"){
    card.appendChild(mfBasketballCreateNumberField("Makes completed","makes",0,10000,1,result.makes));if(definition.confidence)mfBasketballAddConfidenceControl(card,existing.confidence);
  }else if(definition.trackingMode==="benchmark_shooting"){
    const grid=mfBasketballElement("div","mf-basketball-benchmark-grid");grid.append(mfBasketballCreateNumberField("Made","made",0,10000,1,result.made),mfBasketballCreateNumberField("Attempted","attempted",1,10000,1,result.attempted==null?target.attempts:result.attempted));card.appendChild(grid);const percent=mfBasketballElement("div","mf-basketball-benchmark-percent",result.attempted?"Percentage: "+(Math.round(result.made/result.attempted*1000)/10)+"%":"Percentage: —");percent.dataset.role="percentage";card.appendChild(percent);
  }else if(definition.trackingMode==="count"){
    card.appendChild(mfBasketballCreateNumberField("Completed count","count",0,10000,1,result.count));if(definition.confidence)mfBasketballAddConfidenceControl(card,existing.confidence);
  }else{
    const label=mfBasketballElement("label","mf-basketball-completion"),input=mfBasketballElement("input");input.type="checkbox";input.dataset.field="completed";input.checked=result.completed===true;label.append(input,mfBasketballElement("span","","Completed"));card.appendChild(label);
  }
  const notesDetails=mfBasketballElement("details","mf-basketball-drill-notes"),notesSummary=mfBasketballElement("summary","","Add drill note"),notes=mfBasketballElement("textarea");notes.rows=2;notes.maxLength=2000;notes.placeholder="Optional note";notes.dataset.field="notes";notes.value=existing.notes||"";notesDetails.append(notesSummary,notes);if(existing.notes)notesDetails.open=true;card.appendChild(notesDetails);
  card.addEventListener("input",mfBasketballUpdateStructuredSummary);card.addEventListener("change",mfBasketballUpdateStructuredSummary);return card;
}

function mfBasketballOpenStructuredLogger(program,planned,existing){
  const root=document.getElementById("mfBasketballStructuredLogger"),drillsRoot=document.getElementById("mfBasketballDrillLogger");if(!root||!drillsRoot)return;
  mfBasketballStructuredContext={programId:program.id,programVersion:program.version,plannedSessionId:planned.id,existingId:existing&&existing.id||"",planned:planned};
  document.getElementById("mfBasketballStructuredProgram").textContent=program.name;document.getElementById("mfBasketballStructuredTitle").textContent=planned.name;
  mfBasketballSetFormValue("mfBasketballStructuredDate",existing&&existing.date||mfBasketballSelectedAppDate());mfBasketballSetFormValue("mfBasketballStructuredMinutes",existing&&existing.minutes||"");mfBasketballSetFormValue("mfBasketballStructuredNotes",existing&&existing.notes||"");
  drillsRoot.replaceChildren();const existingById={};((existing&&existing.drills)||[]).forEach(function(drill){existingById[drill.drillId]=drill;});planned.drills.forEach(function(drill,index){drillsRoot.appendChild(mfBasketballRenderDrillCard(drill,index,existingById[drill.id]));});
  const advance=document.getElementById("mfBasketballFinishAdvance"),repeat=document.getElementById("mfBasketballFinishRepeat");if(advance)advance.hidden=!!existing;if(repeat)repeat.textContent=existing?"SAVE SESSION CHANGES":"FINISH & REPEAT SESSION";
  root.hidden=false;mfBasketballShowStructuredMessage("");mfBasketballUpdateStructuredSummary();root.scrollIntoView({behavior:"smooth",block:"start"});const first=root.querySelector("input:not([type='hidden']), button");if(first&&typeof first.focus==="function")first.focus();
}

function mfBasketballStartPlannedSession(){
  const state=mfBasketballReadProgramState(),program=mfBasketballGetProgram(state.state.activeProgramId,state.state.activeProgramVersion),planned=program&&program.sessions[state.state.nextSessionIndex];if(!state.parseOk||!program||!planned){mfBasketballShowMessage(state.error||"Choose a basketball program first.","error");return;}mfBasketballOpenStructuredLogger(program,planned,null);
}

function mfBasketballStartStructuredEdit(session){
  const program=mfBasketballGetProgram(session.programId,session.programVersion),planned=program&&program.sessions.find(function(item){return item.id===session.plannedSessionId;});if(!program||!planned){mfBasketballShowMessage("This historical program version can be viewed but is not editable in the current templates.","error");return;}if(typeof showScreen==="function")showScreen("log");const section=document.getElementById("p6sec-basketball");if(section)section.classList.add("open");mfBasketballOpenStructuredLogger(program,planned,session);
}

function mfBasketballCloseStructured(){const root=document.getElementById("mfBasketballStructuredLogger");if(root)root.hidden=true;mfBasketballStructuredContext=null;mfBasketballShowStructuredMessage("");}

function mfBasketballCollectStructuredDrills(){
  const root=document.getElementById("mfBasketballDrillLogger"),results=[];if(!root)return results;
  root.querySelectorAll(".mf-basketball-drill-card").forEach(function(card){
    const get=function(field){const input=card.querySelector("[data-field='"+field+"']");if(!input)return null;if(input.type==="checkbox")return input.checked;return input.value;};
    const mode=card.dataset.trackingMode,actual={};if(mode==="confidence"||mode==="duration")actual.durationMinutes=get("durationMinutes");if(mode==="makes_target")actual.makes=get("makes");if(mode==="benchmark_shooting"){actual.made=get("made");actual.attempted=get("attempted");}if(mode==="count")actual.count=get("count");if(mode==="completion")actual.completed=get("completed");
    results.push({drillId:card.dataset.drillId,actualResult:actual,confidence:get("confidence"),notes:get("notes")});
  });return results;
}

function mfBasketballUpdateStructuredSummary(){
  if(!mfBasketballStructuredContext)return;const root=document.getElementById("mfBasketballSessionSummary");if(!root)return;root.replaceChildren();root.appendChild(mfBasketballElement("div","mf-basketball-summary-title","SESSION SUMMARY"));
  const minutes=mfBasketballFormValue("mfBasketballStructuredMinutes");root.appendChild(mfBasketballElement("div","mf-basketball-summary-row","Duration: "+(minutes?minutes+" min":"not entered")));
  const results=mfBasketballCollectStructuredDrills(),byId={};results.forEach(function(result){byId[result.drillId]=result;});mfBasketballStructuredContext.planned.drills.forEach(function(drill){const entry=byId[drill.id]||{},actual=entry.actualResult||{};let value="not entered";if(drill.trackingMode==="confidence")value=entry.confidence?entry.confidence+"/10":"not scored";if(drill.trackingMode==="duration")value=actual.durationMinutes!==null&&actual.durationMinutes!==""?actual.durationMinutes+" min":"not entered";if(drill.trackingMode==="makes_target")value=actual.makes!==null&&actual.makes!==""?actual.makes+" / "+drill.target.makes+" makes":"not entered";if(drill.trackingMode==="benchmark_shooting"&&actual.made!==""&&actual.attempted){value=actual.made+" / "+actual.attempted+" ("+(Math.round(Number(actual.made)/Number(actual.attempted)*1000)/10)+"%)";}if(drill.trackingMode==="count")value=actual.count!==null&&actual.count!==""?actual.count+" / "+drill.target.count:"not entered";if(drill.trackingMode==="completion")value=actual.completed?"Completed":"Not completed";root.appendChild(mfBasketballElement("div","mf-basketball-summary-row",drill.name+": "+value));});
  const logger=document.getElementById("mfBasketballDrillLogger");if(logger)logger.querySelectorAll(".mf-basketball-drill-card").forEach(function(card){if(card.dataset.trackingMode!=="benchmark_shooting")return;const made=card.querySelector("[data-field='made']"),attempted=card.querySelector("[data-field='attempted']"),out=card.querySelector("[data-role='percentage']");if(out)out.textContent=made&&attempted&&Number(attempted.value)>0&&Number(made.value)<=Number(attempted.value)?"Percentage: "+(Math.round(Number(made.value)/Number(attempted.value)*1000)/10)+"%":"Percentage: —";});
}

function mfBasketballFinishFromUI(action){
  if(!mfBasketballStructuredContext||mfBasketballSaving)return;mfBasketballSaving=true;const advance=document.getElementById("mfBasketballFinishAdvance"),repeat=document.getElementById("mfBasketballFinishRepeat");if(advance)advance.disabled=true;if(repeat)repeat.disabled=true;
  try{
    const context=mfBasketballStructuredContext,result=mfBasketballFinishStructuredSession({programId:context.programId,programVersion:context.programVersion,plannedSessionId:context.plannedSessionId,date:mfBasketballFormValue("mfBasketballStructuredDate"),minutes:mfBasketballFormValue("mfBasketballStructuredMinutes"),notes:mfBasketballFormValue("mfBasketballStructuredNotes"),drills:mfBasketballCollectStructuredDrills(),existingId:context.existingId},context.existingId?"edit":action);
    if(!result.ok){mfBasketballShowStructuredMessage(result.errors.join("\n"),"error");return;}mfBasketballCloseStructured();mfBasketballRenderProgramSurface();mfBasketballRenderHistory();mfBasketballRenderStats();mfBasketballUpdateBadge();mfBasketballShowMessage(context.existingId?"Structured basketball session updated.":result.advanced?"Session saved. The program advanced to the next session.":"Session saved. This planned session remains next.","ok");
  }finally{mfBasketballSaving=false;if(advance)advance.disabled=false;if(repeat)repeat.disabled=false;}
}

function mfBasketballOpenProgramDialog(action){
  mfBasketballPendingProgramAction=action;const dialog=document.getElementById("mfBasketballProgramDialog"),title=document.getElementById("mfBasketballProgramDialogTitle"),body=document.getElementById("mfBasketballProgramDialogBody"),confirm=document.getElementById("mfBasketballProgramDialogConfirm");if(!dialog)return;
  if(action.kind==="restart"){if(title)title.textContent="Restart basketball program?";if(body)body.textContent="The active queue will return to Session 1. Basketball history will not be deleted or rewritten.";if(confirm)confirm.textContent="RESTART PROGRAM";}else{const program=mfBasketballGetProgram(action.programId);if(title)title.textContent="Change basketball program?";if(body)body.textContent="Switch to "+(program?program.name:"the selected program")+" and start from Session 1? Existing history will be preserved.";if(confirm)confirm.textContent="CHANGE PROGRAM";}
  dialog.classList.add("open");dialog.setAttribute("aria-hidden","false");if(document.body&&document.body.classList)document.body.classList.add("mf-basketball-dialog-open");const cancel=document.getElementById("mfBasketballProgramDialogCancel");if(cancel)cancel.focus();
}

function mfBasketballCloseProgramDialog(){mfBasketballPendingProgramAction=null;const dialog=document.getElementById("mfBasketballProgramDialog");if(dialog){dialog.classList.remove("open");dialog.setAttribute("aria-hidden","true");}if(document.body&&document.body.classList)document.body.classList.remove("mf-basketball-dialog-open");}

function mfBasketballConfirmProgramAction(){
  const action=mfBasketballPendingProgramAction;if(!action)return;let result;if(action.kind==="restart")result=mfBasketballRestartProgram();else result=mfBasketballSelectProgram(action.programId);mfBasketballCloseProgramDialog();if(!result.ok){mfBasketballShowMessage(result.error||"Basketball program could not be updated.","error");return;}mfBasketballCloseStructured();mfBasketballRenderProgramSurface();mfBasketballShowMessage(action.kind==="restart"?"Basketball program restarted from Session 1.":"Basketball program selected. Session 1 is next.","ok");
}

function mfBasketballChooseProgramFromUI(){
  const select=document.getElementById("mfBasketballProgramSelect"),programId=select&&select.value,current=mfBasketballReadProgramState().state.activeProgramId;if(!programId){mfBasketballShowMessage("Choose a basketball program.","error");return;}if(current===programId){mfBasketballShowMessage("That basketball program is already active.","ok");return;}if(current)mfBasketballOpenProgramDialog({kind:"select",programId:programId});else{const result=mfBasketballSelectProgram(programId);if(!result.ok)mfBasketballShowMessage(result.error,"error");else{mfBasketballRenderProgramSurface();mfBasketballShowMessage("Basketball program selected. Session 1 is next.","ok");}}
}

function mfBasketballCollectForm(){
  return {
    date:mfBasketballFormValue("mfBasketballDate"),type:mfBasketballFormValue("mfBasketballType"),minutes:mfBasketballFormValue("mfBasketballMinutes"),
    dribblingMinutes:mfBasketballFormValue("mfBasketballDribbling"),shootingMade:mfBasketballFormValue("mfBasketballShootingMade"),shootingAttempted:mfBasketballFormValue("mfBasketballShootingAttempted"),
    freeThrowsMade:mfBasketballFormValue("mfBasketballFreeThrowsMade"),freeThrowsAttempted:mfBasketballFormValue("mfBasketballFreeThrowsAttempted"),notes:mfBasketballFormValue("mfBasketballNotes")
  };
}

function mfBasketballShowMessage(message,type){
  const el=document.getElementById("mfBasketballMessage");if(!el)return;
  el.textContent=message||"";el.className="mf-basketball-message"+(message?" "+(type||"ok"):"");
}

function mfBasketballResetForm(preserveMessage){
  mfBasketballEditingId=null;
  ["mfBasketballType","mfBasketballMinutes","mfBasketballDribbling","mfBasketballShootingMade","mfBasketballShootingAttempted","mfBasketballFreeThrowsMade","mfBasketballFreeThrowsAttempted","mfBasketballNotes"].forEach(function(id){mfBasketballSetFormValue(id,"");});
  mfBasketballSetFormValue("mfBasketballDate",mfBasketballSelectedAppDate());
  const save=document.getElementById("mfBasketballSave"),cancel=document.getElementById("mfBasketballCancel");
  if(save)save.textContent="SAVE BASKETBALL SESSION";
  if(cancel)cancel.hidden=true;
  if(!preserveMessage)mfBasketballShowMessage("");
  mfBasketballUpdateBadge();
}

function mfBasketballSaveFromUI(){
  if(mfBasketballSaving)return;
  const button=document.getElementById("mfBasketballSave");mfBasketballSaving=true;if(button)button.disabled=true;
  try{
    const result=mfBasketballSaveSession(mfBasketballCollectForm(),{existingId:mfBasketballEditingId||""});
    if(!result.ok){mfBasketballShowMessage(result.errors.join("\n"),"error");return;}
    const edited=!!mfBasketballEditingId;
    mfBasketballResetForm(true);
    mfBasketballShowMessage(edited?"Basketball session updated.":"Basketball session saved.","ok");
    mfBasketballRenderHistory();mfBasketballRenderStats();
  }finally{mfBasketballSaving=false;if(button)button.disabled=false;}
}

function mfBasketballStartEdit(id){
  const session=mfBasketballReadStore().sessions.find(function(item){return item.id===id;});if(!session)return;
  if(Array.isArray(session.drills)){mfBasketballStartStructuredEdit(session);return;}
  mfBasketballEditingId=session.id;
  mfBasketballSetFormValue("mfBasketballDate",session.date);mfBasketballSetFormValue("mfBasketballType",session.type);mfBasketballSetFormValue("mfBasketballMinutes",session.minutes);
  mfBasketballSetFormValue("mfBasketballDribbling",session.dribblingMinutes);mfBasketballSetFormValue("mfBasketballShootingMade",session.shooting&&session.shooting.made);mfBasketballSetFormValue("mfBasketballShootingAttempted",session.shooting&&session.shooting.attempted);
  mfBasketballSetFormValue("mfBasketballFreeThrowsMade",session.freeThrows&&session.freeThrows.made);mfBasketballSetFormValue("mfBasketballFreeThrowsAttempted",session.freeThrows&&session.freeThrows.attempted);mfBasketballSetFormValue("mfBasketballNotes",session.notes||"");
  const save=document.getElementById("mfBasketballSave"),cancel=document.getElementById("mfBasketballCancel"),section=document.getElementById("p6sec-basketball");
  if(save)save.textContent="SAVE SESSION CHANGES";if(cancel)cancel.hidden=false;if(section)section.classList.add("open");
  mfBasketballShowMessage("Editing "+mfBasketballTypeLabel(session.type)+" from "+mfBasketballFormatDate(session.date)+".","ok");
  if(typeof showScreen==="function")showScreen("log");
  if(section&&typeof section.scrollIntoView==="function")section.scrollIntoView({behavior:"smooth",block:"start"});
  const dateInput=document.getElementById("mfBasketballDate");if(dateInput&&typeof dateInput.focus==="function")dateInput.focus();
}

function mfBasketballOpenDelete(id){
  const session=mfBasketballReadStore().sessions.find(function(item){return item.id===id;});if(!session)return;
  mfBasketballPendingDeleteId=id;
  const dialog=document.getElementById("mfBasketballDeleteDialog"),body=document.getElementById("mfBasketballDeleteBody");
  if(body)body.textContent="Delete "+mfBasketballTypeLabel(session.type)+" on "+mfBasketballFormatDate(session.date)+"? This removes only this basketball record.";
  if(dialog){dialog.classList.add("open");dialog.setAttribute("aria-hidden","false");}
  if(document.body&&document.body.classList)document.body.classList.add("mf-basketball-dialog-open");
  const cancel=document.getElementById("mfBasketballDeleteCancel");if(cancel&&typeof cancel.focus==="function")cancel.focus();
}

function mfBasketballCloseDelete(){
  mfBasketballPendingDeleteId=null;const dialog=document.getElementById("mfBasketballDeleteDialog");
  if(dialog){dialog.classList.remove("open");dialog.setAttribute("aria-hidden","true");}
  if(document.body&&document.body.classList)document.body.classList.remove("mf-basketball-dialog-open");
}

function mfBasketballConfirmDelete(){
  const id=mfBasketballPendingDeleteId;if(!id)return;
  const deleted=mfBasketballDeleteSession(id);mfBasketballCloseDelete();
  if(deleted){if(mfBasketballEditingId===id)mfBasketballResetForm();mfBasketballRenderHistory();mfBasketballRenderStats();mfBasketballUpdateBadge();}
}

function mfBasketballHistoryFilters(sessions){
  const value=function(id){const el=document.getElementById(id);return el?String(el.value||""):"";};
  const from=value("hf-from"),to=value("hf-to"),gym=value("hf-gym"),woday=value("hf-woday"),search=value("hf-search").trim().toLowerCase();
  if(gym||woday||(typeof p7FilterState!=="undefined"&&(p7FilterState.hasWorkout||p7FilterState.hasHabits)))return [];
  return sessions.filter(function(session){
    if(from&&session.date<from)return false;if(to&&session.date>to)return false;
    if(typeof p7FilterState!=="undefined"&&p7FilterState.hasNotes&&!session.notes)return false;
    if(search){const drillText=(session.drills||[]).map(function(drill){return drill.nameSnapshot+" "+(drill.notes||"");}).join(" "),haystack=(mfBasketballTypeLabel(session.type)+" "+(session.notes||"")+" "+(session.programNameSnapshot||"")+" "+(session.plannedSessionNameSnapshot||"")+" "+drillText+" basketball").toLowerCase();if(haystack.indexOf(search)===-1)return false;}
    return true;
  });
}

function mfBasketballMetricNode(text){const span=document.createElement("span");span.className="mf-basketball-metric";span.textContent=text;return span;}

function mfBasketballDrillResultText(drill){
  const result=drill.actualResult||{},target=drill.plannedTargetSnapshot||{};
  if(drill.trackingMode==="confidence")return result.durationMinutes!=null?result.durationMinutes+" min":"Skill work";
  if(drill.trackingMode==="duration")return result.durationMinutes+" / "+target.durationMinutes+" min";
  if(drill.trackingMode==="makes_target")return result.makes+" / "+target.makes+" makes";
  if(drill.trackingMode==="benchmark_shooting")return result.made+" / "+result.attempted+" ("+result.percentage+"%)";
  if(drill.trackingMode==="count")return result.count+" / "+target.count;
  return result.completed?"Completed":"Not completed";
}

function mfBasketballRenderHistory(){
  const container=document.getElementById("mfBasketballHistory");if(!container)return;
  container.replaceChildren();container.className="mf-basketball-history-section";
  const heading=document.createElement("div");heading.className="mf-basketball-history-heading";heading.textContent="🏀 Basketball Sessions";container.appendChild(heading);
  const state=mfBasketballReadStore(),sessions=mfBasketballHistoryFilters(state.sessions);
  if(!sessions.length){const empty=document.createElement("div");empty.className="mf-basketball-history-empty";empty.textContent=state.parseOk?"No basketball sessions match the current History filters.":"Basketball storage is unavailable; other History entries are unaffected.";container.appendChild(empty);return;}
  sessions.forEach(function(session){
    const details=document.createElement("details");details.className="mf-basketball-entry";details.dataset.sessionId=session.id;
    const summary=document.createElement("summary"),title=document.createElement("div"),meta=document.createElement("div");title.className="mf-basketball-entry-title";meta.className="mf-basketball-entry-meta";
    title.textContent="🏀 "+(session.plannedSessionNameSnapshot||mfBasketballTypeLabel(session.type));meta.textContent=session.minutes+" min · "+mfBasketballFormatDate(session.date);summary.append(title,meta);details.appendChild(summary);
    const body=document.createElement("div");body.className="mf-basketball-entry-detail";const metrics=document.createElement("div");metrics.className="mf-basketball-metrics";metrics.appendChild(mfBasketballMetricNode(session.minutes+" total minutes"));
    if(session.programNameSnapshot){const program=mfBasketballElement("div","mf-basketball-history-program",session.programNameSnapshot+" · "+session.plannedSessionNameSnapshot);body.appendChild(program);}
    if(session.dribblingMinutes!=null)metrics.appendChild(mfBasketballMetricNode(session.dribblingMinutes+" dribbling minutes"));
    if(session.shooting){const pct=mfBasketballPercent(session.shooting);metrics.appendChild(mfBasketballMetricNode("Shooting "+session.shooting.made+" / "+session.shooting.attempted+(pct==null?"":" ("+pct+"%)")));}
    if(session.freeThrows){const pct=mfBasketballPercent(session.freeThrows);metrics.appendChild(mfBasketballMetricNode("Free throws "+session.freeThrows.made+" / "+session.freeThrows.attempted+(pct==null?"":" ("+pct+"%)")));}
    body.appendChild(metrics);
    if(Array.isArray(session.drills)){
      const drillList=mfBasketballElement("div","mf-basketball-history-drills");session.drills.forEach(function(drill){const row=mfBasketballElement("div","mf-basketball-history-drill"),head=mfBasketballElement("div","mf-basketball-history-drill-head"),name=mfBasketballElement("strong","",drill.nameSnapshot),value=mfBasketballElement("span","",mfBasketballDrillResultText(drill));head.append(name,value);row.appendChild(head);if(drill.confidence!=null)row.appendChild(mfBasketballElement("div","mf-basketball-history-confidence","Confidence "+drill.confidence+" / 10"));const progression=mfBasketballProgressionForDrill(drill.drillId,state.sessions);if(progression.status!=="no_data")row.appendChild(mfBasketballElement("div","mf-basketball-history-guidance",progression.label+" — "+progression.guidance));if(drill.notes)row.appendChild(mfBasketballElement("div","mf-basketball-notes",drill.notes));drillList.appendChild(row);});body.appendChild(drillList);
    }
    if(session.notes){const notes=document.createElement("div");notes.className="mf-basketball-notes";notes.textContent=session.notes;body.appendChild(notes);}
    const actions=document.createElement("div");actions.className="mf-basketball-card-actions";const edit=document.createElement("button"),remove=document.createElement("button");edit.type="button";remove.type="button";edit.className="mf-basketball-edit";remove.className="mf-basketball-delete";edit.textContent="EDIT";remove.textContent="DELETE";edit.addEventListener("click",function(event){event.preventDefault();mfBasketballStartEdit(session.id);});remove.addEventListener("click",function(event){event.preventDefault();mfBasketballOpenDelete(session.id);});actions.append(edit,remove);body.appendChild(actions);details.appendChild(body);container.appendChild(details);
  });
}

function mfBasketballRenderStats(){
  const container=document.getElementById("mfBasketballStats");if(!container)return;
  const state=mfBasketballReadStore(),stats=mfBasketballAggregate(state.sessions);container.replaceChildren();container.className="p7-section mf-basketball-stats";container.appendChild(mfBasketballElement("div","p7-section-header","🏀 Basketball Activity"));
  function statCard(label,value,sub,className){const card=mfBasketballElement("div","p7-stat-card "+(className||"")),labelNode=mfBasketballElement("div","p7-stat-label",label),valueNode=mfBasketballElement("div","p7-stat-val "+(className||""),value),subNode=mfBasketballElement("div","p7-stat-sub",sub);card.append(labelNode,valueNode,subNode);return card;}
  const primary=mfBasketballElement("div","p7-stat-grid cols3");primary.append(statCard("Sessions",stats.totalSessions,"all basketball","accent"),statCard("Minutes",stats.totalMinutes,"basketball only","orange"),statCard("Structured",stats.structuredSessions,"program sessions",""));container.appendChild(primary);
  const secondary=mfBasketballElement("div","p7-stat-grid");secondary.append(statCard("Average",stats.totalSessions?stats.averageMinutes.toFixed(1):"—","minutes / session",""),statCard("Free Throws",stats.freeThrows.attempted?stats.freeThrows.made+" / "+stats.freeThrows.attempted:"—",stats.freeThrows.percentage==null?"free-form totals":stats.freeThrows.percentage.toFixed(1)+"%",""));container.appendChild(secondary);
  const practiced=Object.keys(stats.drillCounts).map(function(id){return {id:id,name:stats.drillCounts[id].name,count:stats.drillCounts[id].count};}).sort(function(a,b){return b.count-a.count||a.name.localeCompare(b.name);}).slice(0,5);
  if(practiced.length){const card=mfBasketballElement("div","p7-wide-card"),title=mfBasketballElement("div","p7-wide-card-title","Most-Practiced Drills");card.appendChild(title);practiced.forEach(function(item){const row=mfBasketballElement("div","mf-basketball-recent-row");row.append(mfBasketballElement("span","",item.name),mfBasketballElement("span","",item.count+" exposure"+(item.count===1?"":"s")));card.appendChild(row);});container.appendChild(card);}
  const confidence=Object.keys(stats.confidenceByDrill).map(function(id){return stats.confidenceByDrill[id];}).sort(function(a,b){return b.values.length-a.values.length||a.name.localeCompare(b.name);}).slice(0,4);
  if(confidence.length){const card=mfBasketballElement("div","p7-wide-card"),title=mfBasketballElement("div","p7-wide-card-title","Skill Confidence Trends");card.appendChild(title);confidence.forEach(function(item){const values=item.values.slice(0,3).reverse().map(function(point){return point.value;});const row=mfBasketballElement("div","mf-basketball-trend-row");row.append(mfBasketballElement("span","",item.name),mfBasketballElement("strong","",values.join(" → ")+" / 10"));card.appendChild(row);});container.appendChild(card);}
  const benchmarks=Object.keys(stats.benchmarksByDrill).map(function(id){return stats.benchmarksByDrill[id];}).sort(function(a,b){return b.values.length-a.values.length||a.name.localeCompare(b.name);}).slice(0,4);
  if(benchmarks.length){const card=mfBasketballElement("div","p7-wide-card"),title=mfBasketballElement("div","p7-wide-card-title","Shooting Benchmarks");card.appendChild(title);benchmarks.forEach(function(item){const values=item.values.slice(0,3).reverse().map(function(point){return point.percentage+"%";});const row=mfBasketballElement("div","mf-basketball-trend-row");row.append(mfBasketballElement("span","",item.name),mfBasketballElement("strong","",values.join(" → ")));card.appendChild(row);});container.appendChild(card);}
  if(state.sessions.length){const card=mfBasketballElement("div","p7-wide-card"),title=mfBasketballElement("div","p7-wide-card-title","Recent Basketball Sessions"),recent=mfBasketballElement("div","mf-basketball-recent");card.appendChild(title);state.sessions.slice(0,5).forEach(function(session){const row=mfBasketballElement("div","mf-basketball-recent-row");row.append(mfBasketballElement("span","",session.plannedSessionNameSnapshot||mfBasketballTypeLabel(session.type)),mfBasketballElement("span","",session.minutes+" min · "+session.date));recent.appendChild(row);});card.appendChild(recent);container.appendChild(card);}else container.appendChild(mfBasketballElement("div","mf-basketball-history-empty","No basketball sessions logged yet."));
}

function mfBasketballUpdateBadge(){
  const badge=document.getElementById("mfBasketballBadge");if(!badge)return;
  const date=mfBasketballSelectedAppDate(),count=mfBasketballReadStore().sessions.filter(function(session){return session.date===date;}).length;
  badge.textContent=count?count+" session"+(count===1?"":"s")+" this date":"No sessions";badge.className="p6-section-badge"+(count?" done":"");
}

function mfBasketballSessionsForRange(range,sessions){
  if(range==="program")return [];
  if(range==="full")return sessions.slice();
  const days=parseInt(range,10);if(!Number.isFinite(days))return [];
  const cutoff=new Date();cutoff.setHours(12,0,0,0);cutoff.setDate(cutoff.getDate()-days);
  const cutoffKey=mfBasketballDateKey(cutoff);return sessions.filter(function(session){return session.date>=cutoffKey;});
}

function mfBasketballBuildExport(range,sessions,programStateValue){
  const allSessions=Array.isArray(sessions)?sessions:[],selected=mfBasketballSessionsForRange(String(range||""),allSessions),stateResult=programStateValue&&programStateValue.state?programStateValue:programStateValue?mfBasketballParseProgramStateValue(programStateValue):mfBasketballReadProgramState(),program=stateResult.parseOk&&mfBasketballGetProgram(stateResult.state.activeProgramId,stateResult.state.activeProgramVersion),next=program&&program.sessions[stateResult.state.nextSessionIndex];if(!selected.length&&!program)return "";
  const stats=mfBasketballAggregate(selected);let output="--- BASKETBALL ACTIVITY ---\n";
  if(program){output+="Active program: "+program.name+" (v"+program.version+")\n";output+="Next planned session: "+next.name+" | Position "+(stateResult.state.nextSessionIndex+1)+" of "+program.sessions.length+"\n";output+="Next drills: "+next.drills.map(function(drill){return drill.name+" ["+mfBasketballDescribeTarget(drill)+"]";}).join("; ")+"\n";}
  if(selected.length)output+="Sessions: "+stats.totalSessions+" | Structured: "+stats.structuredSessions+" | Total minutes: "+stats.totalMinutes+" | Average minutes: "+stats.averageMinutes.toFixed(1)+"\n";
  if(stats.shooting.attempted>0)output+="Shooting: "+stats.shooting.made+" / "+stats.shooting.attempted+" ("+stats.shooting.percentage.toFixed(1)+"%)\n";
  if(stats.freeThrows.attempted>0)output+="Free throws: "+stats.freeThrows.made+" / "+stats.freeThrows.attempted+" ("+stats.freeThrows.percentage.toFixed(1)+"%)\n";
  selected.forEach(function(session){let line="- "+session.date+" | "+(session.plannedSessionNameSnapshot||mfBasketballTypeLabel(session.type))+" | "+session.minutes+" min";if(session.programNameSnapshot)line+=" | program: "+session.programNameSnapshot+" v"+session.programVersion;if(session.dribblingMinutes!=null)line+=" | dribbling "+session.dribblingMinutes+" min";if(session.shooting)line+=" | shooting "+session.shooting.made+"/"+session.shooting.attempted;if(session.freeThrows)line+=" | FT "+session.freeThrows.made+"/"+session.freeThrows.attempted;if(session.notes)line+=" | notes: "+session.notes.replace(/\s+/g," ");output+=line+"\n";(session.drills||[]).forEach(function(drill){const progression=mfBasketballProgressionForDrill(drill.drillId,allSessions);output+="  · "+drill.nameSnapshot+": "+mfBasketballDrillResultText(drill)+(drill.confidence!=null?" | confidence "+drill.confidence+"/10":"")+" | "+progression.label+" — "+progression.guidance+(drill.notes?" | note: "+drill.notes.replace(/\s+/g," "):"")+"\n";});});
  return output+"\n";
}

function mfBasketballValidateBackupStore(value){
  const parsed=mfBasketballParseStoreValue(value);
  if(!parsed.parseOk)throw new Error("Basketball backup data is malformed: "+parsed.error);
  if(parsed.invalidRecordCount)throw new Error("Basketball backup data contains "+parsed.invalidRecordCount+" invalid or duplicate record(s).");
  return parsed;
}

function mfBasketballValidateBackupProgramState(value){
  const parsed=mfBasketballParseProgramStateValue(value);
  if(!parsed.parseOk)throw new Error("Basketball program state in backup is malformed: "+parsed.error);
  return parsed.state;
}

// Backup ownership and preview integration. Existing backups without this key remain valid.
if(typeof p8IsMarcusFitKey==="function"){
  const mfBasketballLegacyIsMarcusFitKey=p8IsMarcusFitKey;
  p8IsMarcusFitKey=function(key){return key===MF_BASKETBALL_STORAGE_KEY||key===MF_BASKETBALL_PROGRAM_STATE_KEY||mfBasketballLegacyIsMarcusFitKey(key);};
}
if(typeof p8492SummarizeBackup==="function"){
  const mfBasketballLegacySummarizeBackup=p8492SummarizeBackup;
  p8492SummarizeBackup=function(rawOrObj){
    const summary=mfBasketballLegacySummarizeBackup(rawOrObj),backup=typeof rawOrObj==="string"?function(){try{return JSON.parse(rawOrObj);}catch(e){return null;}}():rawOrObj;
    summary.hasBasketballSessions=false;summary.basketballSessionCount=0;summary.hasBasketballProgramState=false;summary.basketballProgramName=null;summary.basketballNextSession=null;
    if(backup&&backup.data&&Object.prototype.hasOwnProperty.call(backup.data,MF_BASKETBALL_STORAGE_KEY)){
      summary.hasBasketballSessions=true;
      try{const parsed=mfBasketballValidateBackupStore(backup.data[MF_BASKETBALL_STORAGE_KEY]);summary.basketballSessionCount=parsed.sessions.length;if(summary.unknownKeyCount>0)summary.unknownKeyCount--;summary.warnings=(summary.warnings||[]).filter(function(w){return !/key\(s\).*not recognized/i.test(w);});if(summary.unknownKeyCount>0)summary.warnings.push(summary.unknownKeyCount+" key(s) in this backup are not recognized by the current app version.");}catch(e){summary.warnings=(summary.warnings||[]).concat([e.message]);}
    }
    if(backup&&backup.data&&Object.prototype.hasOwnProperty.call(backup.data,MF_BASKETBALL_PROGRAM_STATE_KEY)){
      summary.hasBasketballProgramState=true;
      try{const state=mfBasketballValidateBackupProgramState(backup.data[MF_BASKETBALL_PROGRAM_STATE_KEY]),program=mfBasketballGetProgram(state.activeProgramId,state.activeProgramVersion),next=program&&program.sessions[state.nextSessionIndex];summary.basketballProgramName=program&&program.name||null;summary.basketballNextSession=next&&next.name||null;if(summary.unknownKeyCount>0)summary.unknownKeyCount--;summary.warnings=(summary.warnings||[]).filter(function(w){return !/key\(s\).*not recognized/i.test(w);});if(summary.unknownKeyCount>0)summary.warnings.push(summary.unknownKeyCount+" key(s) in this backup are not recognized by the current app version.");}catch(e){summary.warnings=(summary.warnings||[]).concat([e.message]);}
    }
    return summary;
  };
}
if(typeof p8492FormatSummaryLines==="function"){
  const mfBasketballLegacyFormatSummaryLines=p8492FormatSummaryLines;
  p8492FormatSummaryLines=function(summary){const lines=mfBasketballLegacyFormatSummaryLines(summary);const index=Math.max(0,lines.findIndex(function(line){return /^Approx size:/.test(line);}));lines.splice(index,0,"Basketball sessions: "+(summary.hasBasketballSessions?summary.basketballSessionCount:"not included"),"Basketball program: "+(summary.hasBasketballProgramState?(summary.basketballProgramName||"no active program")+(summary.basketballNextSession?" · Next: "+summary.basketballNextSession:""):"not included"));return lines;};
}
if(typeof p8ValidateBackup==="function"){
  const mfBasketballLegacyValidateBackup=p8ValidateBackup;
  p8ValidateBackup=function(raw){const backup=mfBasketballLegacyValidateBackup(raw);if(backup&&backup.data&&Object.prototype.hasOwnProperty.call(backup.data,MF_BASKETBALL_STORAGE_KEY))mfBasketballValidateBackupStore(backup.data[MF_BASKETBALL_STORAGE_KEY]);if(backup&&backup.data&&Object.prototype.hasOwnProperty.call(backup.data,MF_BASKETBALL_PROGRAM_STATE_KEY))mfBasketballValidateBackupProgramState(backup.data[MF_BASKETBALL_PROGRAM_STATE_KEY]);return backup;};
}

// Late wrappers preserve all earlier History, Stats, navigation, and export behavior.
if(typeof p7ApplyFilters==="function"){
  const mfBasketballLegacyApplyFilters=p7ApplyFilters;p7ApplyFilters=function(){const result=mfBasketballLegacyApplyFilters();mfBasketballRenderHistory();return result;};
}
if(typeof p7RenderAnalytics==="function"){
  const mfBasketballLegacyRenderAnalytics=p7RenderAnalytics;p7RenderAnalytics=function(){const result=mfBasketballLegacyRenderAnalytics();mfBasketballRenderStats();return result;};
}
if(typeof updateTrackerDate==="function"){
  const mfBasketballLegacyUpdateTrackerDate=updateTrackerDate;updateTrackerDate=function(){const result=mfBasketballLegacyUpdateTrackerDate();if(!mfBasketballEditingId)mfBasketballSetFormValue("mfBasketballDate",mfBasketballSelectedAppDate());mfBasketballUpdateBadge();return result;};
}
if(typeof showScreen==="function"){
  const mfBasketballLegacyShowScreen=showScreen;showScreen=function(name){const result=mfBasketballLegacyShowScreen(name);if(name==="history")mfBasketballRenderHistory();if(name==="analytics")mfBasketballRenderStats();if(name==="log")mfBasketballUpdateBadge();return result;};
}
if(typeof genExport==="function"){
  const mfBasketballLegacyGenExport=genExport;genExport=function(){
    const result=mfBasketballLegacyGenExport(),rangeEl=document.getElementById("exportRangeSelect"),section=mfBasketballBuildExport(rangeEl?rangeEl.value:"",mfBasketballReadStore().sessions,mfBasketballReadProgramState());
    if(section&&typeof window._exp==="string"){
      const marker="=== AI SYNC FORMAT INSTRUCTIONS ===";window._exp=window._exp.indexOf(marker)>=0?window._exp.replace(marker,section+marker):window._exp+"\n"+section;
      const output=document.getElementById("exportOut");if(output)output.textContent=window._exp;
    }
    return result;
  };
}

function mfBasketballDebug(){
  const state=mfBasketballReadStore(),programState=mfBasketballReadProgramState(),program=mfBasketballGetProgram(programState.state.activeProgramId,programState.state.activeProgramVersion),stats=mfBasketballAggregate(state.sessions),dates=state.sessions.map(function(session){return session.date;}).sort();
  return {appVersion:typeof APP_VERSION!=="undefined"?APP_VERSION:null,storageKey:MF_BASKETBALL_STORAGE_KEY,programStateKey:MF_BASKETBALL_PROGRAM_STATE_KEY,keyExists:state.keyExists,parseStatus:state.parseOk?"valid":"invalid",schemaVersion:state.schemaVersion,sessionCount:state.sessions.length,structuredSessionCount:stats.structuredSessions,invalidRecordCount:state.invalidRecordCount,totalMinutes:stats.totalMinutes,dateRange:dates.length?{first:dates[0],last:dates[dates.length-1]}:null,duplicateIds:state.duplicateIds.slice(),activeProgram:program?{id:program.id,version:program.version,name:program.name,nextSessionIndex:programState.state.nextSessionIndex,nextSessionId:program.sessions[programState.state.nextSessionIndex].id}:null,programStateParseStatus:programState.parseOk?"valid":"invalid",backupCoverage:{sessions:typeof p8IsMarcusFitKey==="function"?p8IsMarcusFitKey(MF_BASKETBALL_STORAGE_KEY):false,programState:typeof p8IsMarcusFitKey==="function"?p8IsMarcusFitKey(MF_BASKETBALL_PROGRAM_STATE_KEY):false},readOnly:true,error:state.error||programState.error};
}
window.mfBasketballDebug=mfBasketballDebug;

// Dependency-free Node tests receive pure primitives without expanding the
// production browser's public/global surface.
if(typeof process!=="undefined"&&process&&process.versions&&process.versions.node){
  window["__mfBasketballTest"]={
    mfBasketballReadStore:mfBasketballReadStore,
    mfBasketballCreateId:mfBasketballCreateId,
    mfBasketballNormalizeSession:mfBasketballNormalizeSession,
    mfBasketballSaveSession:mfBasketballSaveSession,
    mfBasketballDeleteSession:mfBasketballDeleteSession,
    mfBasketballAggregate:mfBasketballAggregate,
    mfBasketballBuildExport:mfBasketballBuildExport,
    mfBasketballPrograms:MF_BASKETBALL_PROGRAMS,
    mfBasketballTrackingModes:MF_BASKETBALL_TRACKING_MODES,
    mfBasketballGetProgram:mfBasketballGetProgram,
    mfBasketballParseProgramStateValue:mfBasketballParseProgramStateValue,
    mfBasketballReadProgramState:mfBasketballReadProgramState,
    mfBasketballSelectProgram:mfBasketballSelectProgram,
    mfBasketballAdvanceProgramState:mfBasketballAdvanceProgramState,
    mfBasketballRestartProgram:mfBasketballRestartProgram,
    mfBasketballBuildStructuredInput:mfBasketballBuildStructuredInput,
    mfBasketballFinishStructuredSession:mfBasketballFinishStructuredSession,
    mfBasketballNormalizeDrillResult:mfBasketballNormalizeDrillResult,
    mfBasketballDrillHistory:mfBasketballDrillHistory,
    mfBasketballProgressionForDrill:mfBasketballProgressionForDrill,
    mfBasketballValidateBackupProgramState:mfBasketballValidateBackupProgramState
  };
}

function mfBasketballInit(){
  const save=document.getElementById("mfBasketballSave"),cancel=document.getElementById("mfBasketballCancel"),deleteConfirm=document.getElementById("mfBasketballDeleteConfirm"),deleteCancel=document.getElementById("mfBasketballDeleteCancel"),dialog=document.getElementById("mfBasketballDeleteDialog"),programSelect=document.getElementById("mfBasketballProgramSelectButton"),restart=document.getElementById("mfBasketballRestartProgram"),programConfirm=document.getElementById("mfBasketballProgramDialogConfirm"),programCancel=document.getElementById("mfBasketballProgramDialogCancel"),programDialog=document.getElementById("mfBasketballProgramDialog"),closeStructured=document.getElementById("mfBasketballCloseStructured"),finishAdvance=document.getElementById("mfBasketballFinishAdvance"),finishRepeat=document.getElementById("mfBasketballFinishRepeat");
  if(save)save.addEventListener("click",mfBasketballSaveFromUI);if(cancel)cancel.addEventListener("click",function(){mfBasketballResetForm();});if(deleteConfirm)deleteConfirm.addEventListener("click",mfBasketballConfirmDelete);if(deleteCancel)deleteCancel.addEventListener("click",mfBasketballCloseDelete);
  if(programSelect)programSelect.addEventListener("click",mfBasketballChooseProgramFromUI);if(restart)restart.addEventListener("click",function(){mfBasketballOpenProgramDialog({kind:"restart"});});if(programConfirm)programConfirm.addEventListener("click",mfBasketballConfirmProgramAction);if(programCancel)programCancel.addEventListener("click",mfBasketballCloseProgramDialog);if(closeStructured)closeStructured.addEventListener("click",mfBasketballCloseStructured);if(finishAdvance)finishAdvance.addEventListener("click",function(){mfBasketballFinishFromUI("advance");});if(finishRepeat)finishRepeat.addEventListener("click",function(){mfBasketballFinishFromUI("repeat");});
  if(dialog)dialog.addEventListener("click",function(event){if(event.target===dialog)mfBasketballCloseDelete();});
  if(programDialog)programDialog.addEventListener("click",function(event){if(event.target===programDialog)mfBasketballCloseProgramDialog();});
  if(document&&typeof document.addEventListener==="function")document.addEventListener("keydown",function(event){if(event.key!=="Escape")return;if(mfBasketballPendingDeleteId)mfBasketballCloseDelete();else if(mfBasketballPendingProgramAction)mfBasketballCloseProgramDialog();});
  mfBasketballResetForm();mfBasketballRenderProgramSurface();mfBasketballRenderHistory();mfBasketballRenderStats();
}

mfBasketballInit();
})();
