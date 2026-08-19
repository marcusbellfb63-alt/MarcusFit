

// ── 9.5.8 FRESH USER STARTER PROGRAM PACKS ────────────────────────────────
// Immutable templates live in code. The only durable selection is the optional
// userProfile.programBasis field; no storage key or lifecycle record is added.
const P958_BASIS_SCHEMA=1;
const P958_LEGACY_ID="marcus_advanced_aesthetic_6d";
const P958_MARCUS_SNAPSHOT=JSON.stringify(P);
let p958DraftTemplateId=null;

function p958Clone(v){return JSON.parse(JSON.stringify(v));}
function p958Freeze(v){
  if(!v||typeof v!=="object"||Object.isFrozen(v))return v;
  Object.getOwnPropertyNames(v).forEach(function(k){p958Freeze(v[k]);});
  return Object.freeze(v);
}
function p958Day(id,label,tag,focus,note,rows){
  return {id:id,day:label,name:label.replace(/^Day \d+\s*[—-]\s*/,""),tag:tag,
    color:tag==="CARDIO"?"var(--cardio)":tag==="LOWER"?"var(--lower)":"var(--accent)",
    focus:focus,note:note,exercises:rows.map(function(r){return{id:r[0],name:r[1],
      sets:r[2],reps:r[3],load:r[4],rir:r[5],blurb:r[6]};})};
}
function p958Template(id,label,description,audience,equipment,tags,days){
  return {templateId:id,templateVersion:1,label:label,description:description,
    intendedAudience:audience,dayCount:days.length,equipmentSummary:equipment,
    goalTags:tags.slice(),days:p958Freeze(days)};
}
const P958_TEMPLATES=p958Freeze([
  p958Template("general_health_3d","General Health — 3 Day",
    "Two approachable full-body strength days plus cardio and mobility.",
    "General users building a sustainable movement habit","Bodyweight, kettlebell or dumbbells, basic cardio",["general-health","adherence","strength","cardio"],[
    p958Day("tpl-gh3-day-1","Day 1 — FULL BODY A","FULL BODY","Squat · Push · Pull · Carry","Move smoothly and finish each strength set with 2–3 reps in reserve.",[
      ["tpl-gh3-goblet-squat","Goblet Squat",3,"8–12","Comfortable kettlebell","2–3","Use a controlled, comfortable range."],
      ["tpl-gh3-incline-pushup","Incline Push-Up",3,"8–15","Bodyweight","2–3","Choose an incline that keeps reps crisp."],
      ["tpl-gh3-cable-row","Seated Cable or Band Row",3,"10–15","Light-moderate resistance","2–3","Pause with shoulder blades gently back."],
      ["tpl-gh3-suitcase-carry","Suitcase Carry",3,"30–45 sec/side","Comfortable kettlebell","2–3","Walk tall without leaning."]]),
    p958Day("tpl-gh3-day-2","Day 2 — CARDIO & MOBILITY","CARDIO","Aerobic base · Mobility","Use a conversational pace; mobility should feel restorative.",[
      ["tpl-gh3-cardio","Walk, Bike, or Elliptical",1,"25–35 min","Conversational pace","—","Steady, comfortable effort."],
      ["tpl-gh3-cat-cow","Cat-Cow",2,"6–10","Bodyweight","—","Move slowly with the breath."],
      ["tpl-gh3-hip-mobility","Supported Hip Mobility",2,"6–8/side","Bodyweight","—","Stay in a comfortable range."],
      ["tpl-gh3-dead-bug","Dead Bug",3,"6–10/side","Bodyweight","3","Keep the trunk quiet."]]),
    p958Day("tpl-gh3-day-3","Day 3 — FULL BODY B","FULL BODY","Hinge · Press · Pull · Core","Build consistency before adding load or volume.",[
      ["tpl-gh3-kb-deadlift","Kettlebell Deadlift",3,"8–12","Comfortable kettlebell","2–3","Hinge with a long spine."],
      ["tpl-gh3-db-press","Dumbbell Floor Press",3,"8–12","Light-moderate dumbbells","2–3","Control the lowering phase."],
      ["tpl-gh3-pulldown","Lat Pulldown",3,"10–15","Machine setting allowing RIR 2–3","2–3","Pull elbows toward ribs."],
      ["tpl-gh3-bird-dog","Bird Dog",3,"6–10/side","Bodyweight","3","Reach long without rotating."]])
  ]),
  p958Template("beginner_fat_loss_strength_3d","Beginner Fat Loss / Strength — 3 Day",
    "Simple full-body strength practice with optional short cardio finishers.",
    "Beginners seeking strength, manageable volume, and fat-loss support","Dumbbells, machines, cable, optional cardio",["fat-loss","beginner","strength","adherence"],[
    p958Day("tpl-bfs3-day-1","Day 1 — FULL BODY A","FULL BODY","Squat · Horizontal push/pull","Add reps before load; the finisher is optional.",[
      ["tpl-bfs3-box-squat","Box Squat or Leg Press",3,"8–12","Discover a controlled working load","2–3","Use a repeatable depth."],
      ["tpl-bfs3-db-bench","Dumbbell Bench Press",3,"8–12","Light-moderate dumbbells","2–3","Keep feet planted."],
      ["tpl-bfs3-row","Cable Row",3,"10–12","Machine setting allowing RIR 2–3","2–3","Pause briefly at the body."],
      ["tpl-bfs3-walk","Optional Incline Walk",1,"8–12 min","Easy-moderate pace","—","Finish feeling capable of more."]]),
    p958Day("tpl-bfs3-day-2","Day 2 — FULL BODY B","FULL BODY","Hinge · Vertical push/pull","Keep technique consistent across all sets.",[
      ["tpl-bfs3-db-rdl","Dumbbell Romanian Deadlift",3,"8–12","Light-moderate dumbbells","2–3","Stop at a comfortable hamstring stretch."],
      ["tpl-bfs3-machine-press","Machine Shoulder Press",3,"8–12","Machine setting allowing RIR 2–3","2–3","Use a controlled range."],
      ["tpl-bfs3-pulldown","Lat Pulldown",3,"10–12","Machine setting allowing RIR 2–3","2–3","Avoid swinging."],
      ["tpl-bfs3-bike","Optional Easy Bike",1,"8–12 min","Conversational pace","—","Smooth cadence."]]),
    p958Day("tpl-bfs3-day-3","Day 3 — FULL BODY C","FULL BODY","Single-leg pattern · Push · Pull · Core","Choose stable variations and leave reps in reserve.",[
      ["tpl-bfs3-stepup","Low Step-Up",3,"8–10/side","Bodyweight or light dumbbells","2–3","Use a stable, comfortable step height."],
      ["tpl-bfs3-incline-press","Incline Dumbbell Press",3,"8–12","Light-moderate dumbbells","2–3","Control each rep."],
      ["tpl-bfs3-supported-row","Chest-Supported Dumbbell Row",3,"10–12","Light-moderate dumbbells","2–3","Keep chest supported."],
      ["tpl-bfs3-plank","Elevated Plank",3,"20–40 sec","Bodyweight","3","Maintain easy breathing."]])
  ]),
  p958Template("low_impact_knee_friendly_3d","Low-Impact / Knee-Friendly — 3 Day",
    "Conservative low-impact strength, cardio, core, and recovery using pain-free ranges.",
    "Users preferring lower-impact training or accommodating knee limitations","Machines, cables, dumbbells, bike or elliptical",["low-impact","knee-friendly","strength","cardio"],[
    p958Day("tpl-lik3-day-1","Day 1 — CONTROLLED FULL BODY","FULL BODY","Pain-free lower body · Push · Pull","Follow clinician restrictions. Stop or change any movement that causes pain.",[
      ["tpl-lik3-leg-press","Controlled Leg Press",3,"10–15","Discover a pain-free working load","3","Use a pain-free range; do not force depth."],
      ["tpl-lik3-chest-press","Machine Chest Press",3,"10–15","Machine setting allowing RIR 2–3","2–3","Use a comfortable grip."],
      ["tpl-lik3-cable-row","Seated Cable Row",3,"10–15","Light-moderate resistance","2–3","Stay tall and controlled."],
      ["tpl-lik3-pallof","Pallof Press",3,"8–12/side","Light cable resistance","3","Resist rotation."]]),
    p958Day("tpl-lik3-day-2","Day 2 — LOW-IMPACT CARDIO","CARDIO","Aerobic work · Mobility · Stability","This is general fitness guidance, not medical treatment.",[
      ["tpl-lik3-bike","Recumbent Bike or Elliptical",1,"20–30 min","Comfortable conversational pace","—","Choose the pain-free machine and resistance."],
      ["tpl-lik3-calf-raise","Supported Calf Raise",3,"10–15","Bodyweight","3","Hold support and move slowly."],
      ["tpl-lik3-dead-bug","Dead Bug",3,"6–10/side","Bodyweight","3","Keep low back comfortable."],
      ["tpl-lik3-mobility","Gentle Hip and Ankle Mobility",2,"5 min","Controlled range of motion","—","Never force a painful range."]]),
    p958Day("tpl-lik3-day-3","Day 3 — HINGE & UPPER BODY","FULL BODY","Hip hinge · Upper push/pull · Core","Use stable positions and a pain-free range throughout.",[
      ["tpl-lik3-rdl","Dumbbell Romanian Deadlift",3,"8–12","Light-moderate dumbbells","3","Soft knees; hinge from hips."],
      ["tpl-lik3-pulldown","Neutral-Grip Lat Pulldown",3,"10–15","Machine setting allowing RIR 2–3","2–3","Pull without leaning back."],
      ["tpl-lik3-floor-press","Dumbbell Floor Press",3,"8–12","Light-moderate dumbbells","2–3","Controlled touch to the floor."],
      ["tpl-lik3-bird-dog","Bird Dog",3,"6–10/side","Bodyweight","3","Keep hips level."]])
  ]),
  p958Template("general_gym_full_body_3d","General Gym — 3 Day Full Body",
    "Balanced full-body training built around common machines, cables, and dumbbells.",
    "Beginner and intermediate gym users","Commercial gym machines, cables, dumbbells",["general-gym","full-body","strength"],[
    p958Day("tpl-gg3-day-1","Day 1 — FULL BODY A","FULL BODY","Quads · Chest · Back","Use repeatable technique and moderate effort.",[
      ["tpl-gg3-leg-press","Leg Press",3,"8–12","Machine setting allowing RIR 2–3","2–3","Controlled range of motion."],
      ["tpl-gg3-chest-press","Machine Chest Press",3,"8–12","Machine setting allowing RIR 2–3","2–3","Keep shoulders comfortable."],
      ["tpl-gg3-cable-row","Cable Row",3,"10–12","Light-moderate resistance","2–3","Pause at the torso."],
      ["tpl-gg3-calf-raise","Calf Raise",3,"10–15","Controlled working load","2–3","Full comfortable range."]]),
    p958Day("tpl-gg3-day-2","Day 2 — FULL BODY B","FULL BODY","Hinge · Shoulders · Lats","Prioritize clean reps over load.",[
      ["tpl-gg3-db-rdl","Dumbbell Romanian Deadlift",3,"8–12","Light-moderate dumbbells","2–3","Hinge under control."],
      ["tpl-gg3-db-press","Seated Dumbbell Press",3,"8–12","Light-moderate dumbbells","2–3","Avoid forced range."],
      ["tpl-gg3-pulldown","Lat Pulldown",3,"8–12","Machine setting allowing RIR 2–3","2–3","Lead with elbows."],
      ["tpl-gg3-cable-core","Cable Anti-Rotation Press",3,"8–12/side","Light cable resistance","3","Stay square."]]),
    p958Day("tpl-gg3-day-3","Day 3 — FULL BODY C","FULL BODY","Legs · Upper chest · Back · Arms","Finish the week with balanced, manageable volume.",[
      ["tpl-gg3-hack-squat","Hack Squat or Goblet Squat",3,"8–12","Controlled working load","2–3","Choose the more comfortable option."],
      ["tpl-gg3-incline-db","Incline Dumbbell Press",3,"8–12","Light-moderate dumbbells","2–3","Control the bottom position."],
      ["tpl-gg3-supported-row","Chest-Supported Row",3,"10–12","Machine setting allowing RIR 2–3","2–3","Squeeze without shrugging."],
      ["tpl-gg3-curl-pushdown","Cable Curl + Pushdown",2,"10–15 each","Light-moderate resistance","2–3","Simple optional arm pairing."]])
  ]),
  p958Template("hypertrophy_aesthetic_4d","Hypertrophy / Aesthetic — 4 Day",
    "General-purpose upper/lower hypertrophy with moderate shoulder, upper-chest, and back emphasis.",
    "Intermediate users wanting a balanced aesthetic program","Commercial gym, cables, machines, dumbbells",["hypertrophy","aesthetic","four-day"],[
    p958Day("tpl-ha4-upper-1","Day 1 — UPPER A","UPPER","Upper chest · Back · Delts","Use controlled reps and consistent 1–3 RIR effort.",[
      ["tpl-ha4-incline-press","Incline Dumbbell Press",4,"6–10","Moderate dumbbells","2","Upper-chest emphasis."],
      ["tpl-ha4-cable-row","Seated Cable Row",4,"8–12","Controlled working load","2","Pause at peak contraction."],
      ["tpl-ha4-lateral-raise","Cable or Dumbbell Lateral Raise",3,"12–20","Light-moderate load","2–3","Lead with elbows."],
      ["tpl-ha4-pulldown","Lat Pulldown",3,"8–12","Controlled working load","2","Use a full comfortable stretch."],
      ["tpl-ha4-arm-pair-a","Cable Curl + Triceps Pushdown",3,"10–15 each","Light-moderate resistance","2","Smooth, strict reps."]]),
    p958Day("tpl-ha4-lower-1","Day 2 — LOWER A","LOWER","Quads · Hamstrings · Calves","Keep lower-body volume productive, not exhaustive.",[
      ["tpl-ha4-squat","Hack Squat or Leg Press",4,"6–10","Controlled working load","2","Choose a stable pain-free range."],
      ["tpl-ha4-rdl","Romanian Deadlift",3,"8–12","Moderate dumbbells or barbell","2","Controlled eccentric."],
      ["tpl-ha4-leg-curl","Leg Curl",3,"10–15","Machine setting allowing RIR 2","2","Squeeze without lifting hips."],
      ["tpl-ha4-calf","Calf Raise",4,"8–15","Controlled working load","2","Pause at stretch and top."]]),
    p958Day("tpl-ha4-upper-2","Day 3 — UPPER B","UPPER","Back width · Shoulders · Chest","Back and delt priority with balanced pressing.",[
      ["tpl-ha4-pullup","Assisted Pull-Up or Pulldown",4,"6–10","Assistance/load allowing RIR 2","2","Drive elbows down."],
      ["tpl-ha4-machine-press","Machine Chest Press",3,"8–12","Machine setting allowing RIR 2","2","Stable pressing path."],
      ["tpl-ha4-supported-row","Chest-Supported Row",3,"8–12","Controlled working load","2","No torso momentum."],
      ["tpl-ha4-rear-delt","Reverse Pec Deck",3,"12–20","Light-moderate load","2–3","Sweep arms wide."],
      ["tpl-ha4-arm-pair-b","Incline Curl + Overhead Cable Extension",3,"10–15 each","Light-moderate resistance","2","Control the stretched position."]]),
    p958Day("tpl-ha4-lower-2","Day 4 — LOWER & FULL BODY","LOWER","Glutes · Quads · Delts · Core","Moderate full-body finish without extreme specialization.",[
      ["tpl-ha4-hip-thrust","Hip Thrust",3,"8–12","Controlled working load","2","Pause at full hip extension."],
      ["tpl-ha4-split-squat","Supported Split Squat",3,"8–12/side","Bodyweight or light dumbbells","2–3","Use support and comfortable depth."],
      ["tpl-ha4-leg-extension","Leg Extension",3,"10–15","Machine setting allowing RIR 2–3","2–3","Smooth reps."],
      ["tpl-ha4-lateral-raise-2","Machine Lateral Raise",3,"12–20","Light-moderate load","2","Keep traps relaxed."],
      ["tpl-ha4-cable-crunch","Cable Crunch",3,"10–15","Controlled resistance","2–3","Flex through the trunk."]])
  ])
]);
const P958_MARCUS_TEMPLATE=Object.freeze({templateId:P958_LEGACY_ID,templateVersion:1,
  label:"Marcus Advanced Aesthetic — 6 Day",description:"Existing Marcus advanced aesthetic program.",
  intendedAudience:"Marcus's established advanced program",dayCount:6,
  equipmentSummary:"Home and transition-gym variants",goalTags:Object.freeze(["advanced","aesthetic","legacy"]),
  daysByGym:P});
const P958_REGISTRY=Object.freeze(P958_TEMPLATES.concat([P958_MARCUS_TEMPLATE]));

function getProgramTemplateRegistry(){
  return P958_REGISTRY.map(function(t){return Object.freeze({
    templateId:t.templateId,templateVersion:t.templateVersion,label:t.label,
    description:t.description,intendedAudience:t.intendedAudience,dayCount:t.dayCount,
    equipmentSummary:t.equipmentSummary,goalTags:Object.freeze(t.goalTags.slice())
  });});
}
function p958GetTemplateById(id){return P958_REGISTRY.find(function(t){return t.templateId===id;})||null;}
function p958RawProfile(){
  try{const raw=localStorage.getItem(USER_PROFILE_KEY);return raw===null?null:JSON.parse(raw);}catch(e){return null;}
}
function p958MeaningfulSummary(){
  let evidence={};try{evidence=p951GetMeaningfulDataEvidence();}catch(e){}
  let first={};try{first=p957GetSharedUserFirstSyncStatus();}catch(e){}
  return {hasMeaningfulHistory:first.isLikelyFirstSync===false,
    isLikelyFirstSync:first.isLikelyFirstSync===true,evidence:p958Clone(evidence)};
}
function p958NormalizeBasis(basis){
  const warnings=[];
  if(basis===undefined||basis===null)return{valid:true,explicit:false,templateId:P958_LEGACY_ID,
    templateVersion:1,source:"implicit_legacy_default",selectedAt:null,fallbackUsed:false,warnings:warnings};
  if(!basis||typeof basis!=="object"){warnings.push("Stored programBasis is malformed.");}
  const id=basis&&typeof basis.templateId==="string"?basis.templateId.trim():"";
  const template=p958GetTemplateById(id);
  const version=basis&&Number.isInteger(basis.templateVersion)?basis.templateVersion:null;
  if(!id)warnings.push("Explicit programBasis has no valid templateId.");
  if(id&&!template)warnings.push("Explicit template ID is unavailable: "+id);
  if(template&&version!==template.templateVersion)warnings.push("Stored template version is unsupported.");
  if(template&&version===template.templateVersion)return{valid:true,explicit:true,templateId:id,
    templateVersion:version,source:typeof basis.selectedVia==="string"?basis.selectedVia:"profile",
    selectedAt:typeof basis.selectedAt==="string"?basis.selectedAt:null,fallbackUsed:false,warnings:warnings};
  const fresh=p958MeaningfulSummary().isLikelyFirstSync;
  warnings.push(fresh?"Fresh user must choose a valid starter template; General Health is used only as a safe in-memory preview fallback.":
    "Established user retains the implicit Marcus legacy program as the in-memory fallback.");
  return{valid:false,explicit:true,templateId:fresh?"general_health_3d":P958_LEGACY_ID,
    templateVersion:1,source:"invalid_profile_fallback",selectedAt:null,fallbackUsed:true,warnings:warnings};
}
function getActiveProgramBasis(){
  const raw=p958RawProfile();
  return p958NormalizeBasis(raw&&Object.prototype.hasOwnProperty.call(raw,"programBasis")?raw.programBasis:null);
}
function getActiveBaseProgram(){
  const basis=getActiveProgramBasis(),template=p958GetTemplateById(basis.templateId)||P958_MARCUS_TEMPLATE;
  if(template.templateId===P958_LEGACY_ID)return p958Clone(P);
  return {home:p958Clone(template.days),partial:p958Clone(template.days)};
}
function p958GetResolvedProgram(){
  const lc=getLifecycle(),base=getActiveBaseProgram(),resolved={};
  Object.entries(base).forEach(function(pair){
    const gymKey=pair[0],days=pair[1];
    resolved[gymKey]=days.map(function(day,dayIdx){
      const baseExercises=(day.exercises||[]).filter(function(ex){return !lc.inactiveIds[ex.id];});
      const customs=Object.values(lc.customExercises||{}).filter(function(ex){
        return ex.gymKey===gymKey&&ex.dayIdx===dayIdx&&!lc.inactiveIds[ex.id];
      }).sort(function(a,b){return(a.addedAt||"").localeCompare(b.addedAt||"");});
      let exercises=baseExercises.concat(customs),override=(lc.orderOverrides||{})[gymKey+":"+dayIdx];
      if(Array.isArray(override)&&override.length){
        const map={};exercises.forEach(function(e){map[e.id]=e;});
        const used=new Set();const ordered=[];
        override.forEach(function(id){if(map[id]&&!used.has(id)){ordered.push(map[id]);used.add(id);}});
        exercises.forEach(function(e){if(!used.has(e.id))ordered.push(e);});exercises=ordered;
      }
      return Object.assign({},day,{exercises:exercises.map(function(e){return Object.assign({},e);})});
    });
  });return resolved;
}
getResolvedProgram=p958GetResolvedProgram;
function p958GetResolvedDays(gymKey){
  const rp=getResolvedProgram(),lc=getLifecycle();
  const base=(rp[gymKey]||[]).map(function(d,i){return Object.assign({},d,{_dayIdx:i,_isVirtual:false});});
  const additions=(lc.dayAdditions||{})[gymKey]||{},baseLen=base.length;
  const virtual=Object.keys(additions).map(Number).filter(function(i){return Number.isInteger(i)&&i>=baseLen;})
    .sort(function(a,b){return a-b;}).map(function(i){
      const a=additions[i]||{},customs=Object.values(lc.customExercises||{}).filter(function(e){
        return e.gymKey===gymKey&&e.dayIdx===i&&!lc.inactiveIds[e.id];});
      return{day:"Day "+(i+1),id:a.id||("virtual-"+gymKey+"-"+i),name:a.name||("CUSTOM DAY "+(i+1)),
        subtitle:a.subtitle||"",focus:a.focus||"",note:a.note||"",tag:a.tag||"CUSTOM",color:"var(--accent)",
        exercises:customs,_isVirtual:true,_dayIdx:i};
    });
  return base.concat(virtual);
}
getResolvedDays=p958GetResolvedDays;

function p958RecommendStarter(){
  let profile=p950GetUserProfile(),state={};try{state=p951GetOnboardingState();}catch(e){}
  const hay=JSON.stringify({profile:profile,onboarding:state}).toLowerCase(),reasons=[];
  let id="general_health_3d";
  if(/knee|surgery|low.?impact|limitation|injury/.test(hay)){id="low_impact_knee_friendly_3d";reasons.push("Saved limitations suggest a conservative, low-impact starting point.");}
  else if(/fat.?loss|lose weight|weight loss/.test(hay)){id="beginner_fat_loss_strength_3d";reasons.push("The saved primary goal emphasizes fat loss with progressive strength.");}
  else if(/hypertrophy|aesthetic|muscle/.test(hay)&&/4|four/.test(hay)){id="hypertrophy_aesthetic_4d";reasons.push("The saved goal and four-day availability align with hypertrophy training.");}
  else if(/gym|machine|cable/.test(hay)){id="general_gym_full_body_3d";reasons.push("Saved equipment access favors a balanced commercial-gym plan.");}
  else reasons.push("A simple three-day strength, cardio, and mobility plan is the broadest fit.");
  if(/3|three/.test(hay))reasons.push("Three training days match the saved availability.");
  return{valid:!!p958GetTemplateById(id),recommendedTemplateId:id,reasons:reasons,readOnly:true};
}
function p958SelectionPreflight(id){
  const errors=[],basis=getActiveProgramBasis(),template=p958GetTemplateById(id),meaning=p958MeaningfulSummary();
  if(!template||id===P958_LEGACY_ID)errors.push("Choose a valid starter template.");
  if(!meaning.isLikelyFirstSync)errors.push("Starter installation is restricted to eligible fresh/shared users.");
  if(basis.explicit&&basis.valid)errors.push("An explicit program basis is already installed.");
  return{valid:errors.length===0,errors:errors,warnings:[]};
}
function p958ShouldShowProgramSetupState(){
  const basis=getActiveProgramBasis(),meaning=p958MeaningfulSummary();
  return meaning.isLikelyFirstSync===true&&meaning.hasMeaningfulHistory!==true&&basis.explicit!==true;
}
function p958OpenStarterChooserFromProgram(){
  try{showScreen("export");}catch(e){}
  try{p958RenderStarterChooser();}catch(e){}
  const host=document.getElementById("p958StarterChooser");
  if(host){
    host.style.display="block";
    host.style.scrollMarginTop="92px";
    requestAnimationFrame(function(){host.scrollIntoView({behavior:"smooth",block:"start"});});
  }
}
function p958RenderProgramSetupState(){
  const container=document.getElementById("program-days");
  const programTitle=document.getElementById("program-title");
  if(programTitle)programTitle.textContent="PROGRAM SETUP";
  if(!container)return;
  container.innerHTML="";
  const rec=p958RecommendStarter(),recommended=rec.valid?p958GetTemplateById(rec.recommendedTemplateId):null;
  const hasTemplates=P958_TEMPLATES.some(function(t){return t&&t.templateId;});
  const card=document.createElement("div");
  card.className="p958-program-setup";
  card.style.cssText="padding:14px;border:1px solid var(--accent);border-radius:8px;background:var(--surface2);";
  const title=document.createElement("div");
  title.className="day-name";
  title.textContent="Choose Your Starter Program";
  card.appendChild(title);
  const body=document.createElement("div");
  body.style.cssText="font-size:12px;color:var(--muted);line-height:1.45;margin-top:6px;";
  body.textContent="Your program is not set yet. Choose a clean starting plan based on your goals, schedule, equipment, and limitations.";
  card.appendChild(body);
  const line=document.createElement("div");
  line.style.cssText="font-size:12px;font-weight:800;margin-top:10px;color:var(--text);";
  line.textContent=recommended?"Recommended: "+recommended.label:"Choose a starter template to set your program.";
  card.appendChild(line);
  const reasons=(rec.reasons||[]).filter(function(r){return typeof r==="string"&&r.trim();});
  if(reasons.length){
    const reason=document.createElement("div");
    reason.style.cssText="font-size:11px;color:var(--muted);line-height:1.4;margin-top:5px;";
    reason.textContent=reasons.join(" ");
    card.appendChild(reason);
  }
  const btn=document.createElement("button");
  btn.className="big-btn btn-sync";
  btn.style.marginTop="12px";
  btn.textContent="CHOOSE STARTER PROGRAM";
  btn.disabled=!hasTemplates;
  btn.onclick=p958OpenStarterChooserFromProgram;
  card.appendChild(btn);
  container.appendChild(card);
}
function p958ConfirmStarterSelection(){
  const pre=p958SelectionPreflight(p958DraftTemplateId);if(!pre.valid){p958RenderStarterChooser();return pre;}
  const previous=localStorage.getItem(USER_PROFILE_KEY);
  try{
    const parsed=previous===null?p950GetDefaultUserProfile():JSON.parse(previous);
    const now=new Date().toISOString(),next=Object.assign({},parsed,{programBasis:{
      schemaVersion:P958_BASIS_SCHEMA,templateId:p958DraftTemplateId,templateVersion:1,
      selectedAt:now,selectedVia:"onboarding"},updatedAt:now,profileVersion:APP_VERSION});
    localStorage.setItem(USER_PROFILE_KEY,JSON.stringify(next));
    const post=getActiveProgramBasis();
    if(!post.valid||!post.explicit||post.templateId!==p958DraftTemplateId)throw new Error("Post-write basis validation failed.");
    p958DraftTemplateId=null;p958RenderStarterChooser();renderProgram();populateWoDaySelect();
    return{ok:true,basis:post};
  }catch(e){
    try{previous===null?localStorage.removeItem(USER_PROFILE_KEY):localStorage.setItem(USER_PROFILE_KEY,previous);}catch(_){}
    return{ok:false,error:e.message,rolledBack:true};
  }
}
function p958RenderStarterChooser(){
  let host=document.getElementById("p958StarterChooser");
  if(!host){host=document.createElement("div");host.id="p958StarterChooser";host.style.cssText="margin:10px 0;padding:12px;border:1px solid var(--accent);border-radius:10px;background:var(--surface2);";const c=document.getElementById("p954Container");if(c)c.insertBefore(host,c.firstChild);}
  const basis=getActiveProgramBasis(),meaning=p958MeaningfulSummary(),eligible=meaning.isLikelyFirstSync&&!basis.explicit;
  if(!eligible){host.style.display="none";host.innerHTML="";return;}host.style.display="block";
  const rec=p958RecommendStarter(),recommended=rec.valid?p958GetTemplateById(rec.recommendedTemplateId):null;
  if(!p958DraftTemplateId)p958DraftTemplateId=recommended?recommended.templateId:(P958_TEMPLATES[0]&&P958_TEMPLATES[0].templateId);
  const options=P958_TEMPLATES.map(function(t){return'<option value="'+t.templateId+'"'+(t.templateId===p958DraftTemplateId?' selected':'')+'>'+t.label+(t.templateId===rec.recommendedTemplateId?' — Recommended':'')+'</option>';}).join("");
  const t=p958GetTemplateById(p958DraftTemplateId),pre=p958SelectionPreflight(p958DraftTemplateId);
  host.innerHTML='<div style="font-weight:800;margin-bottom:5px;">Choose your starter program</div>'+
    '<div style="font-size:11px;color:var(--muted);margin-bottom:8px;">'+(recommended?'Recommended: '+recommended.label+' — '+rec.reasons.join(" "):'Choose a starter template to set your program.')+'</div>'+
    '<select id="p958TemplateSelect" style="width:100%;min-height:44px;margin-bottom:8px;"></select>'+
    '<details style="font-size:11px;margin-bottom:10px;"><summary>Preview '+(t?t.label:"starter template")+'</summary><div id="p958Preview" style="padding:7px 0;"></div></details>'+
    '<button id="p958Confirm" class="big-btn btn-sync">CONFIRM STARTER PROGRAM</button> '+
    '<button id="p958Cancel" class="big-btn" style="background:transparent;color:var(--muted);">CANCEL</button>';
  const select=host.querySelector("#p958TemplateSelect");select.innerHTML=options;
  select.onchange=function(){p958DraftTemplateId=this.value;p958RenderStarterChooser();};
  const preview=host.querySelector("#p958Preview");preview.textContent=t?t.days.map(function(d){return d.day+": "+d.exercises.map(function(e){return e.name;}).join(", ");}).join(" • "):"No preview is available for this recommendation.";
  const confirm=host.querySelector("#p958Confirm");confirm.disabled=!pre.valid;confirm.onclick=p958ConfirmStarterSelection;
  host.querySelector("#p958Cancel").onclick=function(){p958DraftTemplateId=null;host.style.display="none";try{showScreen("program");}catch(e){}};
}

const p958LegacyGenExport=genExport;
genExport=function(){
  const basis=getActiveProgramBasis(),t=p958GetTemplateById(basis.templateId)||P958_MARCUS_TEMPLATE;
  const days=getResolvedDays("partial");
  const block="\nPROGRAM BASIS (9.5.8)\n======================\n"+
    "Active template: "+t.label+"\nTemplate ID: "+t.templateId+"\nTemplate version: "+t.templateVersion+
    "\nBasis: "+(basis.explicit?"explicit":"implicit")+"\nSelection source: "+basis.source+
    "\nTemplate summary: "+t.description+"\nResolved days: "+days.length+
    "\nAI: Personalize from this selected starter basis; do not substitute Marcus's legacy six-day program.\n\n";
  p958LegacyGenExport();
  const out=block+(window._exp||"");
  const target=document.getElementById("exportOut");if(target)target.textContent=out;
  window._exp=out;
  return out;
};

function p958AllTemplateIds(){
  const dayIds=[],exerciseIds=[];P958_TEMPLATES.forEach(function(t){t.days.forEach(function(d){
    dayIds.push(d.id);d.exercises.forEach(function(e){exerciseIds.push(e.id);});});});
  Object.values(P).forEach(function(days){days.forEach(function(d){(d.exercises||[]).forEach(function(e){exerciseIds.push(e.id);});});});
  return{dayIds:dayIds,exerciseIds:exerciseIds};
}
function p958Dupes(a){return Array.from(new Set(a.filter(function(v,i){return a.indexOf(v)!==i;}))).sort();}
window.mfProgramTemplateRegistryDebug=function(){
  const ids=p958AllTemplateIds(),templateIds=P958_REGISTRY.map(function(t){return t.templateId;}),invalid=[];
  P958_REGISTRY.forEach(function(t){if(!t.templateId||!Number.isInteger(t.templateVersion)||t.templateVersion<1||t.dayCount<1)invalid.push(t.templateId||"(missing)");});
  const out={valid:false,templateCount:P958_REGISTRY.length,templateSummaries:getProgramTemplateRegistry(),
    duplicateTemplateIds:p958Dupes(templateIds),duplicateDayIds:p958Dupes(ids.dayIds),
    duplicateExerciseIds:p958Dupes(ids.exerciseIds),invalidTemplates:invalid,
    marcusBaseMutationDetected:JSON.stringify(P)!==P958_MARCUS_SNAPSHOT};
  out.valid=!out.duplicateTemplateIds.length&&!out.duplicateDayIds.length&&!out.duplicateExerciseIds.length&&!invalid.length&&!out.marcusBaseMutationDetected;
  return p958Clone(out);
};
window.mfProgramBasisDebug=function(){const b=getActiveProgramBasis(),m=p958MeaningfulSummary();
  return p958Clone(Object.assign({},b,{"meaningful-history":m,activeResolvedDayCount:getResolvedDays("partial").length}));};
window.mfStarterProgramDebug=function(){const b=getActiveProgramBasis(),m=p958MeaningfulSummary(),r=p958RecommendStarter(),p=p958SelectionPreflight(p958DraftTemplateId);
  return p958Clone({eligibleForAutomaticOffer:m.isLikelyFirstSync&&!b.explicit,hasMeaningfulHistory:m.hasMeaningfulHistory,
    explicitProgramBasis:b.explicit,recommendationValid:r.valid,recommendedTemplateId:r.recommendedTemplateId,
    recommendationReasons:r.reasons,readOnlyRecommendation:r.readOnly,currentlySelectedDraftTemplate:p958DraftTemplateId,
    confirmationReadiness:p.valid,validationErrors:p.errors,validationWarnings:p.warnings});};
window.mfResolvedProgramDebug=function(){const b=getActiveProgramBasis(),days=getResolvedDays("partial"),lc=getLifecycle(),ids=[];
  days.forEach(function(d){(d.exercises||[]).forEach(function(e){ids.push(e.id);});});
  const leaked=b.templateId!==P958_LEGACY_ID&&ids.some(function(id){return /^(home|partial)-d\d+-e\d+$/.test(id);});
  return p958Clone({activeTemplateId:b.templateId,activeTemplateVersion:b.templateVersion,resolvedDayCount:days.length,
    resolvedDays:days.map(function(d){return{id:d.id||null,label:d.day||d.name,exerciseCount:(d.exercises||[]).length};}),
    lifecycleCustomizationCounts:{customExercises:Object.keys(lc.customExercises||{}).length,inactive:Object.keys(lc.inactiveIds||{}).length,
      dayAdditions:Object.values(lc.dayAdditions||{}).reduce(function(n,x){return n+Object.keys(x||{}).length;},0)},
    orderOverrideCount:Object.keys(lc.orderOverrides||{}).length,duplicateResolvedIds:p958Dupes(ids),
    marcusSpecificBaseLeakDetected:leaked,warnings:b.warnings.slice(),errors:leaked?["Marcus base exercise IDs leaked into a non-Marcus basis."]:[]});};
window.mfFindKnownExerciseById=function(id){let found=null;P958_TEMPLATES.forEach(function(t){t.days.forEach(function(d){const e=d.exercises.find(function(x){return x.id===id;});if(e)found={templateId:t.templateId,dayId:d.id,exercise:p958Clone(e)};});});if(found)return found;
  Object.keys(P).some(function(g){return P[g].some(function(d,i){const e=(d.exercises||[]).find(function(x){return x.id===id;});if(e){found={templateId:P958_LEGACY_ID,gymKey:g,dayIndex:i,exercise:p958Clone(e)};return true;}return false;});});return found;};
window.getProgramTemplateRegistry=getProgramTemplateRegistry;
window.getProgramTemplateById=function(id){const t=p958GetTemplateById(id);return t?p958Clone(t):null;};
window.mfGetActiveProgramBasis=function(){return p958Clone(getActiveProgramBasis());};
window.mfGetActiveBaseProgram=function(){return p958Clone(getActiveBaseProgram());};
window.p958ConfirmStarterSelection=p958ConfirmStarterSelection;

const p958OriginalPersonalizationRender=p954RenderProgramPersonalization;
p954RenderProgramPersonalization=function(){p958OriginalPersonalizationRender();p958RenderStarterChooser();};
