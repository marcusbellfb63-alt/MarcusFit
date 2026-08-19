// ── DAILY HABITS DATA ──────────────────────────────────────────────────────
const HABITS = [
  {id:"habit-jaw-posture",name:"Jawline / Posture Habit",icon:"🦷",target:"Ongoing awareness throughout the day",instructions:["Tongue gently on roof of mouth","Lips closed, breathing through nose","Neck tall — chin slightly tucked","Do not clench jaw hard, just resting contact"]},
  {id:"habit-desk-posture",name:"Desk Posture Reset",icon:"🪑",target:"Every 60–90 min at work",instructions:["Sit tall — lumbar supported, not slumped","Shoulders back and down, not rounded forward","Screen at eye level if possible","Stand up and walk 2 min between resets"]},
  {id:"habit-box-breathing",name:"Box Breathing",icon:"🌬️",target:"1–2 rounds daily (4+ cycles each)",instructions:["Inhale through nose: 4 seconds","Hold: 4 seconds","Exhale through mouth: 4 seconds","Hold empty: 4 seconds","Repeat 4–8 cycles — great before bed or meetings"]},
  {id:"habit-kegel",name:"Kegel Holds",icon:"💪",target:"3 × 10 holds",instructions:["Contract pelvic floor — like stopping urine mid-flow","Hold 5–10 seconds, then release fully","3 sets of 10 reps — seated at desk is fine","Do not hold your breath during holds"]},
  {id:"habit-water",name:"Water Intake",icon:"💧",target:"100+ oz — log exact amount in Vitals",instructions:["Front-load water — 20 oz first thing in the morning","Sip consistently; avoid chugging large amounts","Add 8 oz for every 30 min of exercise","Track oz in the Vitals section above"]},
  {id:"habit-bm",name:"BM Tracking",icon:"🚽",target:"Log daily in BM card above",instructions:["Note Yes / No in the BM card above","Consistency on GLP-1 matters — track if skipping days","Healthy BM = Type 3–4 on Bristol Stool Scale","Fiber, water, and movement are your levers"]},
  {id:"habit-steps",name:"Steps / Movement",icon:"👟",target:"7,500–10,000 steps daily",instructions:["Walk on lunch break — even 10 min counts","Take stairs over elevator at the warehouse","Evening walk with the girls = bonus Zone 2","On non-workout days: movement IS your workout"]}
];

const WO_RECS = {
  home:{
    0:{label:"Push Day Prep",recs:[{icon:"🧘",title:"Chest Opener",desc:"Doorway chest stretch — 30 sec each arm, 2 rounds. Open the pecs before loading them."},{icon:"🌀",title:"Thoracic Mobility",desc:"Floor thoracic rotation — 10 reps per side. Unlocks shoulder and press range immediately."},{icon:"💪",title:"Shoulder Warm-Up",desc:"10 slow arm circles forward, 10 back. Light band pull-aparts if you have one."}]},
    1:{label:"Lower Day Prep",recs:[{icon:"🦵",title:"Hip Flexor Stretch",desc:"90/90 stretch or kneeling lunge — 45 sec each side. Key before Bulgarian split squats."},{icon:"🔁",title:"Hamstring Mobilization",desc:"Standing hamstring stretch — 30 sec × 3. Prep the hinge pattern before RDLs."},{icon:"🦶",title:"Ankle Mobility",desc:"10 slow ankle circles each direction + wall ankle stretch 30 sec each. Protects knees on lunges."}]},
    2:{label:"Cardio Day Focus",recs:[{icon:"❤️",title:"Zone 2 Target",desc:"Stay 120–140 BPM. If you can't hold a full sentence, ease off — you're above Zone 2."},{icon:"👃",title:"Nasal Breathing",desc:"Breathe only through your nose the entire session. Forces true aerobic pace."},{icon:"🌊",title:"Recovery Mobility",desc:"After cardio: 5 min hip circles, cat-cow, and forward fold to keep the body supple."}]},
    3:{label:"Pull Day Prep",recs:[{icon:"🪝",title:"Lat Activation",desc:"Dead hang 20–30 sec if you have a bar. Decompresses spine and wakes up the lats."},{icon:"🔄",title:"Shoulder ER Stretch",desc:"Towel external rotation stretch — 30 sec each arm. Keeps shoulders healthy under pull load."},{icon:"🦾",title:"Scapular Retraction",desc:"10 slow scapular retractions before your first set. Builds the mind-muscle link for rows."}]},
    4:{label:"Pump Day Focus",recs:[{icon:"🩸",title:"Blood Flow First",desc:"Start with light sets — 50% load, high rep. Goal is a full pump, not max strength today."},{icon:"⏱️",title:"Short Rests",desc:"45–60 sec max between sets. The metabolic stress is the stimulus — don't let it dissipate."},{icon:"💧",title:"Stay Hydrated",desc:"Pump sessions dehydrate fast. Sip water between every exercise."}]},
    5:{label:"Arms Day Prep",recs:[{icon:"🦾",title:"Elbow Warm-Up",desc:"Light curl + tricep extension with empty hands — 15 reps each. Gets blood into elbows."},{icon:"🔀",title:"Superset Strategy",desc:"Pair bicep + tricep exercises back-to-back. Keeps intensity high and the pump massive."},{icon:"🎯",title:"Slow the Eccentric",desc:"3 seconds down on every rep. Feel the muscle, don't just move the weight."}]}
  },
  partial:{
    0:{label:"Push Day Prep",recs:[{icon:"🧘",title:"Cable Chest Stretch",desc:"Face away from stack, arms wide — 30 sec. Deeper stretch than doorway for pec minor."},{icon:"🌀",title:"Thoracic Mobility",desc:"Foam roll thoracic spine 60 sec before bench. Improves arch and shoulder positioning immediately."},{icon:"🎯",title:"Rotator Cuff Activation",desc:"Light cable external rotation — 15 reps before any pressing. Non-negotiable shoulder health."}]},
    1:{label:"Lower Day Prep",recs:[{icon:"🦵",title:"Hip Flexor Stretch",desc:"Couch stretch or kneeling lunge — 60 sec each side. Critical before RDL and Leg Press."},{icon:"🔁",title:"Hamstring Prep",desc:"Lying single-leg stretch — 45 sec each side. Prepares the RDL hinge pattern."},{icon:"🦶",title:"Ankle Mobility",desc:"10 ankle circles + wall ankle stretch 30 sec each. Protects knees on leg press depth."}]},
    2:{label:"Cardio Day Focus",recs:[{icon:"❤️",title:"Zone 2 Target",desc:"Stay 120–140 BPM on cardio machines — manual mode at low resistance. Conversational pace only."},{icon:"👃",title:"Nasal Breathing",desc:"Nose breathe throughout. Forces you into true Zone 2 — don't cheat it."},{icon:"🌊",title:"Post-Cardio Stretch",desc:"5 min: hip circles, forward fold, cat-cow. Transition from output to recovery."}]},
    3:{label:"Pull Day Prep",recs:[{icon:"🪝",title:"Lat Activation",desc:"Straight arm pulldown with very light weight — 15 slow reps. Fires lats before loading them."},{icon:"🔄",title:"Rear Delt Activation",desc:"Face pulls light — 15 reps before rows. Activates rear delts and protects shoulder health."},{icon:"🦾",title:"Scapular Control",desc:"10 scap retractions before starting. The key to a quality lat pulldown is scap depression first."}]},
    4:{label:"Pump Day Focus",recs:[{icon:"🩸",title:"Light Load, High Volume",desc:"Drop weight 20–30% from heavy days. Today is metabolic stress and fullness, not PRs."},{icon:"⏱️",title:"60 Sec Rest Max",desc:"Keep rest short. Let the lactic acid build — it's doing its job."},{icon:"💧",title:"Hydration Check",desc:"Drink 20 oz before starting. Pump sessions burn through water fast."}]},
    5:{label:"Arms Day Prep",recs:[{icon:"🦾",title:"Elbow Warm-Up",desc:"2 light sets of cable curls and pushdowns before working sets. Elbows need blood flow first."},{icon:"🔀",title:"Antagonist Superset",desc:"Pair every bicep move with a tricep move — keeps pump even and time efficient."},{icon:"🎯",title:"Cable Advantage",desc:"Cables maintain tension through full ROM. Squeeze hard at peak contraction every rep."}]}
  }
};

function initHabitState(){
  return HABITS.reduce((acc,h)=>{acc[h.id]={completed:false,notes:""};return acc;},{});
}

function renderHabits(){
  const container=document.getElementById("habitCards");
  const progress=document.getElementById("habitsProgress");
  // preserve open state
  const openCards=new Set([...document.querySelectorAll(".habit-card.open")].map(el=>el.id));
  container.innerHTML="";
  let doneCount=0;
  HABITS.forEach(h=>{
    const state=habitState[h.id]||{completed:false,notes:""};
    if(state.completed)doneCount++;
    const card=document.createElement("div");
    const wasOpen=openCards.has("hcard-"+h.id);
    card.className="habit-card"+(state.completed?" completed":"")+(wasOpen?" open":"");
    card.id="hcard-"+h.id;
    card.innerHTML=`<div class="habit-card-top" onclick="toggleHabitOpen('${h.id}')"><div class="habit-check" onclick="toggleHabitDone(event,'${h.id}')">${state.completed?"✓":""}</div><div class="habit-info"><div class="habit-name">${h.icon} ${h.name}</div><div class="habit-target">${h.target}</div></div><div class="habit-expand">▼</div></div><div class="habit-body"><ul class="habit-instructions">${h.instructions.map(i=>`<li>${i}</li>`).join("")}</ul><div class="habit-note-label">Notes</div><input class="habit-note-input" type="text" placeholder="Optional note..." value="${(state.notes||"").replace(/"/g,'&quot;')}" oninput="updateHabitNote('${h.id}',this.value)"></div>`;
    container.appendChild(card);
  });
  progress.textContent=`${doneCount} / ${HABITS.length}`;
  progress.className="habits-progress"+(doneCount===HABITS.length?" done":"");
}

function toggleHabitOpen(id){
  const card=document.getElementById("hcard-"+id);
  if(card)card.classList.toggle("open");
}

function toggleHabitDone(e,id){
  e.stopPropagation();
  if(!habitState[id])habitState[id]={completed:false,notes:""};
  habitState[id].completed=!habitState[id].completed;
  renderHabits();
  autoSaveDraft();
}

function updateHabitNote(id,val){
  if(!habitState[id])habitState[id]={completed:false,notes:""};
  habitState[id].notes=val;
  autoSaveDraft();
}

function renderWoRecs(){
  const dayIdx=document.getElementById("woDaySelect").value;
  const section=document.getElementById("woRecsSection");
  const content=document.getElementById("woRecsContent");
  if(dayIdx===""){section.style.display="none";return;}

  // ── Phase 9.4: Check for AI recommendations first ──────────────────────────
  const aiRecs = getRecsForDay(logGym, parseInt(dayIdx));
  if(aiRecs && Array.isArray(aiRecs.items) && aiRecs.items.length > 0){
    // Show AI recommendations with badge
    const titleEl = section.querySelector(".wo-recs-title");
    if(titleEl) titleEl.innerHTML = '⚡ Day Recommendations <span class="recs-ai-badge">AI</span>';
    // Bugfix 9.4.3: render AI text safely via DOM nodes (no innerHTML injection of AI strings)
    content.innerHTML = "";
    aiRecs.items.forEach(item => {
      const row  = document.createElement("div"); row.className  = "wo-rec-item";
      const icon = document.createElement("div"); icon.className = "wo-rec-icon"; icon.textContent = "💬";
      const txt  = document.createElement("div"); txt.className  = "wo-rec-text"; txt.textContent  = item;
      row.appendChild(icon); row.appendChild(txt); content.appendChild(row);
    });
    section.style.display="block";
    return;
  }
  // ── Fallback: default static recommendations ────────────────────────────────
  const titleEl = section.querySelector(".wo-recs-title");
  if(titleEl) titleEl.innerHTML = '⚡ Day Recommendations';
  const recs=(WO_RECS[logGym]||{})[parseInt(dayIdx)];
  if(!recs){section.style.display="none";return;}
  content.innerHTML=recs.recs.map(r=>`<div class="wo-rec-item"><div class="wo-rec-icon">${r.icon}</div><div class="wo-rec-text"><strong>${r.title}:</strong> ${r.desc}</div></div>`).join("");
  section.style.display="block";
}
// ── END DAILY HABITS ────────────────────────────────────────────────────────

const P = {
  home:[
    {day:"Day 1",name:"UPPER PUSH",color:"var(--push)",tag:"PUSH",focus:"Chest · Shoulders · Triceps — Bodyweight/DB",
     note:"No bar, no problem. Control the eccentric on every rep. Slow 3-second negatives across the board.",
     exercises:[
      {id:"home-d0-e0",name:"Push-Up (Feet Elevated)",sets:4,reps:"10–20",load:"Bodyweight",rir:"2",blurb:"Upper chest emphasis. Slow 3-second negative."},
      {id:"home-d0-e1",name:"Pike Push-Up",sets:3,reps:"10–15",load:"Bodyweight",rir:"2",blurb:"Shoulder focus. Hips high."},
      {id:"home-d0-e2",name:"Diamond Push-Up",sets:3,reps:"10–15",load:"Bodyweight",rir:"2",blurb:"Tricep isolation. Elbows track back, not out."},
      {id:"home-d0-e3",name:"Chair Dip",sets:3,reps:"12–15",load:"Bodyweight",rir:"2",blurb:"Full dip depth. Add weight on lap if needed."},
      {id:"home-d0-e4",name:"DB Lateral Raise",sets:4,reps:"15–20",load:"Lightest available",rir:"2",blurb:"Priority movement even at home. Volume is the key."},
    ]},
    {day:"Day 2",name:"LOWER — POSTERIOR BIAS",color:"var(--lower)",tag:"LOWER",focus:"Glutes · Hamstrings · Quads — Bodyweight/DB",
     note:"Single-leg work is king at home. Go slow on every descent.",
     exercises:[
      {id:"home-d1-e0",name:"Bulgarian Split Squat",sets:4,reps:"10–12 each",load:"Bodyweight or DBs",rir:"2",blurb:"Rear foot on chair. Glute and quad. Slow descent."},
      {id:"home-d1-e1",name:"DB Romanian Deadlift",sets:4,reps:"12",load:"Heaviest DBs available",rir:"2",blurb:"Hip hinge. Slow eccentric. Feel the hamstring stretch."},
      {id:"home-d1-e2",name:"Glute Bridge (Weighted)",sets:4,reps:"15–20",load:"DB or Plate on hips",rir:"2",blurb:"Drive through heels. Full glute squeeze at top."},
      {id:"home-d1-e3",name:"Reverse Lunge",sets:3,reps:"10–12 each",load:"Bodyweight",rir:"2",blurb:"More glute than forward lunge. Step back, knee hovers, drive up."},
      {id:"home-d1-e4",name:"Single Leg Calf Raise",sets:3,reps:"15–20 each",load:"Bodyweight",rir:"2",blurb:"Stand on a step for full ROM."},
    ]},
    {day:"Day 3",name:"ZONE 2 CARDIO",color:"var(--cardio)",tag:"CARDIO",focus:"Fat Loss · Recovery",
     note:"HR 120–140 bpm. 30–40 min. Go outside if you can. Non-negotiable.",
     exercises:[
      {id:"home-d2-e0",name:"Brisk Walk / Light Jog",sets:1,reps:"30–40 min",load:"HR 120–140",rir:"—",blurb:"Steady state only. Outside is a bonus."},
    ]},
    {day:"Day 4",name:"UPPER PULL",color:"var(--pull)",tag:"PULL",focus:"Lats · Back · Biceps — Bodyweight/DB",
     note:"Pull-ups or inverted rows are your best friends today. Lat connection first.",
     exercises:[
      {id:"home-d3-e0",name:"Pull-Up or Inverted Row",sets:4,reps:"Max reps",load:"Bodyweight",rir:"2",blurb:"Inverted rows under a table if no bar. Lats first."},
      {id:"home-d3-e1",name:"DB Single-Arm Row",sets:4,reps:"10–12 each",load:"Heaviest DB available",rir:"2",blurb:"Brace on chair. Drive elbow back. 1-second squeeze."},
      {id:"home-d3-e2",name:"DB Rear Delt Fly (Bent Over)",sets:4,reps:"15",load:"Light DB",rir:"2",blurb:"Torso parallel to floor. Rear delts are priority even at home."},
      {id:"home-d3-e3",name:"DB Curl",sets:3,reps:"12–15",load:"Heaviest available",rir:"2",blurb:"Full ROM. Slow negative."},
      {id:"home-d3-e4",name:"Hammer Curl",sets:3,reps:"12",load:"Heaviest available",rir:"2",blurb:"Neutral grip. Brachialis and forearm."},
    ]},
    {day:"Day 5",name:"TAPER BIAS PUMP",color:"var(--pump)",tag:"PUMP",focus:"Full Body · High Rep",
     note:"Feel-good session. Volume and blood flow. Keep moving.",
     exercises:[
      {id:"home-d4-e0",name:"Wide + Close Push-Up Superset",sets:3,reps:"15–20 each",load:"Bodyweight",rir:"2",blurb:"No rest between variations."},
      {id:"home-d4-e1",name:"DB Lateral Raise",sets:4,reps:"15–20",load:"Lightest available",rir:"2",blurb:"Still a PRIORITY. Volume over load."},
      {id:"home-d4-e2",name:"DB Curl to Press",sets:3,reps:"12–15",load:"Light DB",rir:"2",blurb:"Curl up, press overhead, lower with control."},
      {id:"home-d4-e3",name:"DB Skull Crusher",sets:3,reps:"12–15",load:"Light DB",rir:"2",blurb:"Maintain tricep work. Slow eccentric."},
      {id:"home-d4-e4",name:"Plank / Side Plank / Hollow Hold",sets:3,reps:"30–60 sec each",load:"Bodyweight",rir:"0",blurb:"Posture and core. Stand tall."},
    ]},
    {day:"Day 6",name:"ARMS — STRENGTH & PUMP",color:"var(--arms)",tag:"ARMS",focus:"Biceps · Triceps — DB/Bodyweight",
     note:"Make it hurt. Volume is your load at home. Slow eccentrics on everything.",
     exercises:[
      {id:"home-d5-e0",name:"Diamond Push-Up",sets:4,reps:"10–15",load:"Bodyweight",rir:"1–2",blurb:"Tricep compound at home. Go slow."},
      {id:"home-d5-e1",name:"DB Curl (Heavy)",sets:4,reps:"8–10",load:"Heaviest available",rir:"1–2",blurb:"Strength block. Strict form. No swing."},
      {id:"home-d5-e2",name:"Chair Dip",sets:3,reps:"12–15",load:"Bodyweight",rir:"2",blurb:"Full dip depth. Weight on lap if you have it."},
      {id:"home-d5-e3",name:"Incline DB Curl",sets:3,reps:"10–12",load:"Moderate DB",rir:"2",blurb:"Arms hang back. Stretch-biased. No momentum."},
      {id:"home-d5-e4",name:"DB Skull Crusher",sets:3,reps:"12–15",load:"Light-moderate DB",rir:"2",blurb:"Slow eccentric. Full extension."},
      {id:"home-d5-e5",name:"Hammer Curl",sets:3,reps:"12",load:"Moderate DB",rir:"2",blurb:"Brachialis. Neutral grip."},
      {id:"home-d5-e6",name:"Push-Up Burnout",sets:2,reps:"Max",load:"Bodyweight",rir:"0",blurb:"FINISHER. All the way to failure."},
    ]},
  ],
  partial:[
    {day:"Day 1",name:"UPPER PUSH",color:"var(--push)",tag:"PUSH",focus:"Chest · Shoulders · Triceps — DB/Cable",
     note:"No barbell — DB bench is your main compound. Load up, go heavy, and make it count.",
     exercises:[
      {id:"partial-d0-e0",name:"DB Bench Press (Flat)",sets:4,reps:"8–10",load:"70–80 lb DBs",rir:"1–2",blurb:"Main compound. Progress when 4×10 @ RIR 1."},
      {id:"partial-d0-e1",name:"DB Incline Press",sets:3,reps:"8–10",load:"55–65 lb DBs",rir:"1–2",blurb:"Full stretch at bottom. Control the descent."},
      {id:"partial-d0-e2",name:"Seated DB Press",sets:3,reps:"10",load:"45 lb/side",rir:"2",blurb:"Controlled tempo."},
      {id:"partial-d0-e3",name:"DB Lateral Raise",sets:4,reps:"15",load:"20 lb",rir:"1–2",blurb:"Drop set last set → 12 lb × max. PRIORITY."},
      {id:"partial-d0-e4",name:"Cable Fly (Low to High)",sets:3,reps:"12",load:"13 lb/side",rir:"2",blurb:"Upper chest. Controlled tempo."},
      {id:"partial-d0-e5",name:"Cable Tricep Pushdown (Rope)",sets:3,reps:"12",load:"55–60 lb",rir:"1–2",blurb:"Spread rope at bottom. Squeeze."},
      {id:"partial-d0-e6",name:"Overhead DB Tricep Extension",sets:3,reps:"10–12",load:"50 lb DB",rir:"2",blurb:"Two hands on one DB. Long head stretch."},
    ]},
    {day:"Day 2",name:"LOWER — POSTERIOR BIAS",color:"var(--lower)",tag:"LOWER",focus:"Hamstrings · Glutes · Quads — Machine/DB",
     note:"Leg press is your main compound. Load heavier — no barbell RDL competing for recovery.",
     exercises:[
      {id:"partial-d1-e0",name:"Leg Press (feet high/wide)",sets:4,reps:"10",load:"270–340 lb",rir:"2",blurb:"Main compound. Load heavier to compensate."},
      {id:"partial-d1-e1",name:"DB Romanian Deadlift",sets:3,reps:"10–12",load:"70–80 lb DBs",rir:"2",blurb:"Hip hinge. Slow eccentric."},
      {id:"partial-d1-e2",name:"Leg Extension",sets:3,reps:"12–15",load:"Heavy",rir:"2",blurb:"Quad isolation. Squeeze at top every rep."},
      {id:"partial-d1-e3",name:"Leg Curl (Machine)",sets:3,reps:"12",load:"80 lb",rir:"1–2",blurb:"Hamstring isolation."},
      {id:"partial-d1-e4",name:"DB Bulgarian Split Squat",sets:3,reps:"10 each",load:"40–50 lb DBs",rir:"2",blurb:"Rear foot elevated. Slow and deliberate."},
    ]},
    {day:"Day 3",name:"ZONE 2 CARDIO",color:"var(--cardio)",tag:"CARDIO",focus:"Fat Loss · Recovery",
     note:"HR 120–140 bpm. 30–40 min. Same rule.",
     exercises:[
      {id:"partial-d2-e0",name:"Treadmill / Bike / Stair Stepper",sets:1,reps:"30–40 min",load:"HR 120–140",rir:"—",blurb:"Steady state only. No surges."},
    ]},
    {day:"Day 4",name:"UPPER PULL",color:"var(--pull)",tag:"PULL",focus:"Lats · Back · Rear Delts · Biceps — Cable/DB",
     note:"Double cable machine is your best friend today. Lat connection first.",
     exercises:[
      {id:"partial-d3-e0",name:"Straight Arm Cable Pulldown",sets:3,reps:"12",load:"40 lb",rir:"2",blurb:"GOES FIRST. Arms straight, shoulder hinge, squeeze hard."},
      {id:"partial-d3-e1",name:"Wide Grip Lat Pulldown (Cable)",sets:4,reps:"10",load:"100 lb",rir:"2",blurb:"3-second negative. Thumb off bar."},
      {id:"partial-d3-e2",name:"DB Single-Arm Row",sets:4,reps:"10 each",load:"70–80 lb DB",rir:"1–2",blurb:"Brace on bench. Drive elbow back, 1-second squeeze."},
      {id:"partial-d3-e3",name:"Cable Rear Delt Fly",sets:4,reps:"15",load:"17 lb/side",rir:"1–2",blurb:"Double cable — one arm each side."},
      {id:"partial-d3-e4",name:"EZ Bar Curl",sets:3,reps:"10",load:"80 lb",rir:"1–2",blurb:"If no EZ bar, use DBs at 35–40 lb each."},
    ]},
    {day:"Day 5",name:"TAPER BIAS PUMP",color:"var(--pump)",tag:"PUMP",focus:"Shoulders · Arms — DB/Cable",
     note:"Same session structure. Cable machine handles most of this fine.",
     exercises:[
      {id:"partial-d4-e0",name:"Cable Lat Pulldown",sets:4,reps:"10–12",load:"100 lb",rir:"2",blurb:"Block 1. Lats, not shoulders."},
      {id:"partial-d4-e1",name:"DB Lateral Raise",sets:4,reps:"15",load:"20 lb",rir:"2",blurb:"Block 1. Drop set last set. PRIORITY."},
      {id:"partial-d4-e2",name:"Cable Lateral Raise",sets:3,reps:"12–15",load:"10 lb/side",rir:"2",blurb:"Block 2. Slow and controlled."},
      {id:"partial-d4-e3",name:"Cable Rear Delt Fly",sets:3,reps:"15",load:"17 lb/side",rir:"2",blurb:"Block 2. Same rear delt priority."},
      {id:"partial-d4-e4",name:"EZ Bar or DB Curl",sets:4,reps:"8–10",load:"65–70 lb",rir:"2",blurb:"Block 3."},
      {id:"partial-d4-e5",name:"Cable Tricep Pushdown (Rope)",sets:4,reps:"10–12",load:"55 lb",rir:"2",blurb:"Block 3."},
      {id:"partial-d4-e6",name:"Incline DB Curl",sets:3,reps:"10–12",load:"30 lb/side",rir:"1–2",blurb:"Block 4. Stretch-biased."},
      {id:"partial-d4-e7",name:"DB Skull Crusher",sets:3,reps:"12",load:"30 lb/side",rir:"1–2",blurb:"Block 4. Slow eccentric."},
      {id:"partial-d4-e8",name:"DB Mechanical Lateral Raise Drop Set",sets:3,reps:"8→10→max",load:"20→12→8 lb",rir:"0",blurb:"FINISHER. No rest between drops."},
    ]},
    {day:"Day 6",name:"ARMS — STRENGTH & PUMP",color:"var(--arms)",tag:"ARMS",focus:"Biceps · Triceps — DB/Cable",
     note:"Start heavy, finish with the pump.",
     exercises:[
      {id:"partial-d5-e0",name:"DB Floor Press (Close Grip)",sets:4,reps:"8–10",load:"50–55 lb DBs",rir:"1–2",blurb:"Tricep compound substitute. Elbows tucked."},
      {id:"partial-d5-e1",name:"EZ Bar or DB Curl",sets:4,reps:"6–8",load:"70–80 lb",rir:"1–2",blurb:"Strength block. Full ROM, no swing."},
      {id:"partial-d5-e2",name:"Overhead Cable Tricep Extension",sets:3,reps:"10–12",load:"45–50 lb",rir:"2",blurb:"Long head. Arms behind head, elbows forward."},
      {id:"partial-d5-e3",name:"Incline DB Curl",sets:3,reps:"10–12",load:"30 lb/side",rir:"2",blurb:"Stretch-biased. Arms hang. No momentum."},
      {id:"partial-d5-e4",name:"Cable Tricep Pushdown (Rope)",sets:3,reps:"12–15",load:"55 lb",rir:"2",blurb:"Pump block. Spread the rope."},
      {id:"partial-d5-e5",name:"Cable Curl",sets:3,reps:"12–15",load:"40–45 lb",rir:"2",blurb:"Pump block. Constant tension."},
      {id:"partial-d5-e6",name:"DB Skull Crusher",sets:3,reps:"12",load:"30 lb/side",rir:"1–2",blurb:"Slow eccentric."},
      {id:"partial-d5-e7",name:"Hammer Curl",sets:3,reps:"12",load:"40 lb/side",rir:"2",blurb:"Brachialis. Neutral grip."},
    ]},
  ]
};
