// ── PHASE 7: HISTORY FILTERS ─────────────────────────────────────────────────

const p7FilterState = {
  from:"", to:"", gym:"", woday:"", search:"",
  hasWorkout:false, hasNotes:false, hasHabits:false
};

function p7FToggle(key, btn){
  const ks={"has-workout":"hasWorkout","has-notes":"hasNotes","has-habits":"hasHabits"};
  const k=ks[key]||key;
  const isNowActive=btn.classList.toggle("active");
  p7FilterState[k]=isNowActive;
  p7ApplyFilters();
}

function p7ClearFilters(){
  document.getElementById("hf-from").value="";
  document.getElementById("hf-to").value="";
  document.getElementById("hf-gym").value="";
  document.getElementById("hf-woday").value="";
  document.getElementById("hf-search").value="";
  ["hf-has-workout","hf-has-notes","hf-has-habits"].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.classList.remove("active");
  });
  Object.assign(p7FilterState,{from:"",to:"",gym:"",woday:"",search:"",hasWorkout:false,hasNotes:false,hasHabits:false});
  p7ApplyFilters();
}

function p7GetAllEntries(){
  return Object.keys(localStorage)
    .filter(k=>k.startsWith("day-")&&!k.endsWith("-wo"))
    .sort().reverse()
    .map(k=>{try{return{key:k,data:JSON.parse(localStorage.getItem(k))};}catch{return null;}})
    .filter(Boolean);
}

function p7ApplyFilters(){
  const from=document.getElementById("hf-from").value;
  const to=document.getElementById("hf-to").value;
  const gym=document.getElementById("hf-gym").value;
  const woday=document.getElementById("hf-woday").value;
  const search=document.getElementById("hf-search").value.trim().toLowerCase();

  let entries=p7GetAllEntries();
  const total=entries.length;

  if(from) entries=entries.filter(e=>e.data.date>=from);
  if(to)   entries=entries.filter(e=>e.data.date<=to);
  if(gym)  entries=entries.filter(e=>(e.data.logGym||"home")===gym);

  if(woday){
    entries=entries.filter(e=>{
      if(!e.data.woDayIdx&&e.data.woDayIdx!==0)return false;
      // 9.4.8.3: use getSafeDayDisplayName — handles base + virtual days
      const gymKey = e.data.logGym||"home";
      const name = getSafeDayDisplayName(gymKey, e.data.woDayIdx);
      return name.toLowerCase().includes(woday.toLowerCase());
    });
  }

  if(search){
    entries=entries.filter(e=>{
      const d=e.data;
      if(d.notes&&d.notes.toLowerCase().includes(search))return true;
      const woRaw=localStorage.getItem(e.key+"-wo");
      if(woRaw){
        try{
          const wo=JSON.parse(woRaw);
          // 9.4.8.3: use safe resolvers — handles base + virtual days
          const gymKey = wo.gym||"home";
          const dayData = getSafeDayForLog(gymKey, wo.dayIdx);
          const dayName = getSafeDayDisplayName(gymKey, wo.dayIdx);
          if(dayName.toLowerCase().includes(search))return true;
          if(dayData&&(dayData.exercises||[]).some(ex=>getF(ex.id,"name",ex.name).toLowerCase().includes(search)))return true;
        }catch{}
      }
      return false;
    });
  }

  if(p7FilterState.hasWorkout) entries=entries.filter(e=>e.data.workout==="yes");
  if(p7FilterState.hasNotes)   entries=entries.filter(e=>e.data.notes&&e.data.notes.trim());
  if(p7FilterState.hasHabits){
    entries=entries.filter(e=>{
      if(!e.data.habits)return false;
      return HABITS.some(h=>e.data.habits[h.id]&&e.data.habits[h.id].completed);
    });
  }

  // Stats for filtered set
  const statsEl=document.getElementById("hf-stats");
  if(entries.length===total&&!from&&!to&&!gym&&!woday&&!search&&!p7FilterState.hasWorkout&&!p7FilterState.hasNotes&&!p7FilterState.hasHabits){
    statsEl.innerHTML=`<span>${total}</span> total entries`;
  } else {
    const avgWt=entries.filter(e=>e.data.weight).map(e=>parseFloat(e.data.weight));
    const avgWtStr=avgWt.length?(avgWt.reduce((a,b)=>a+b,0)/avgWt.length).toFixed(1)+" lbs":"—";
    const wos=entries.filter(e=>e.data.workout==="yes").length;
    const habitPct=entries.length?Math.round(entries.reduce((a,e)=>{
      if(!e.data.habits)return a;
      const done=HABITS.filter(h=>e.data.habits[h.id]&&e.data.habits[h.id].completed).length;
      return a+(done/HABITS.length);
    },0)/entries.length*100):0;
    statsEl.innerHTML=`<span>${entries.length}</span> of ${total} · Avg <span>${avgWtStr}</span> · <span>${wos}</span> workouts · Habits <span>${habitPct}%</span>`;
  }

  // Render filtered history
  renderHistoryFromEntries(entries);
}

// Hook filter inputs to p7ApplyFilters with debounce on search
let _p7SearchTimer=null;
function p7WireFilters(){
  ["hf-from","hf-to","hf-gym","hf-woday"].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.addEventListener("change",p7ApplyFilters);
  });
  const s=document.getElementById("hf-search");
  if(s)s.addEventListener("input",()=>{clearTimeout(_p7SearchTimer);_p7SearchTimer=setTimeout(p7ApplyFilters,280);});
}

// Refactored renderHistory now delegates to renderHistoryFromEntries
function renderHistoryFromEntries(entries){
  const c=document.getElementById("histList");
  if(!c)return;
  if(!entries.length){c.innerHTML='<div class="empty">No matching entries.<br>Try adjusting your filters.</div>';return;}
  c.innerHTML=entries.slice(0,60).map(({key,data:d})=>{
    const dt=new Date(d.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
    const recurringOutcome=p9510HistoryOutcome(d.date||key.slice(4));
    const pills=[d.weight?`&#9878; ${d.weight}`:null,d.sleep?`&#128564; ${d.sleep}h`:null,d.protein?`&#129385; ${d.protein}g`:null,d.water?`&#128167; ${d.water}oz`:null,d.bm?`&#128701; ${d.bm}`:null,d.mood?`&#9889; ${d.mood}/10`:null,d.hunger?`&#127860; ${d.hunger}/10`:null,recurringOutcome||d.zep?recurringOutcome||`&#128138; ${d.zep}`:null,d.workout?`&#127947; ${d.workout}`:null].filter(Boolean);
    const woRaw=localStorage.getItem(key+"-wo");const wo=woRaw?JSON.parse(woRaw):null;
    let woDetail="";
    if(wo&&wo.exercises&&Object.keys(wo.exercises).length){
      // 9.4.8.3: use getSafeDayForLog — handles base + virtual days safely
      const gymKey = wo.gym||"home";
      const dayData = getSafeDayForLog(gymKey, wo.dayIdx);
      const dayName = getSafeDayDisplayName(gymKey, wo.dayIdx);
      woDetail='<div class="hist-wo-detail">';
      woDetail+=`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${gymKey.toUpperCase()} \u2014 ${dayName}</div>`;
      if(dayData){
        (dayData.exercises||[]).forEach(ex=>{
          const exLog=wo.exercises[ex.id];if(!exLog)return;
          const nm=getF(ex.id,"name",ex.name);
          const validSets=exLog.sets.filter(s=>s.wt||s.reps);if(!validSets.length)return;
          woDetail+=`<div class="hist-wo-ex"><div class="hist-wo-ex-name">${nm}</div>`;
          validSets.forEach((s,i)=>{woDetail+=`<div class="hist-wo-set">Set ${i+1}: ${s.wt||"\u2014"} \xd7 ${s.reps||"\u2014"} reps @ RIR ${s.rir||"\u2014"}</div>`;});
          if(exLog.note)woDetail+=`<div class="hist-wo-set" style="font-style:italic;">"${exLog.note}"</div>`;
          woDetail+='</div>';
        });
      }
      woDetail+='</div>';
    }
    const hasWo=woDetail!="";
    const habitsDone=d.habits?HABITS.filter(h=>d.habits[h.id]&&d.habits[h.id].completed).length:null;
    const habitBadge=habitsDone!==null?`<span class="hist-pill">🧠 ${habitsDone}/${HABITS.length}</span>`:"";
    return `<div class="hist-entry${hasWo?" expandable":""}" onclick="${hasWo?"this.classList.toggle('open')":""}" ><div class="hist-date"><span>${dt} \xb7 ${(d.logGym||"home").toUpperCase()}</span>${hasWo?'<span style="color:var(--muted);font-size:10px;">tap for sets &#9662;</span>':""}</div><div class="hist-pills">${pills.map(p=>`<span class="hist-pill">${p}</span>`).join("")}${habitBadge}</div>${d.notes?`<div class="hist-notes">"${d.notes}"</div>`:""} ${woDetail}</div>`;
  }).join("");
}

