// ── PHASE 7: ANALYTICS ENGINE ─────────────────────────────────────────────────

function p7CalcAnalytics(){
  const entries=p7GetAllEntries().map(e=>e.data).reverse(); // oldest first
  if(!entries.length)return null;

  // ─── Weight Trends ───
  const wtEntries=entries.filter(e=>e.weight).map(e=>({date:e.date,w:parseFloat(e.weight)}));
  const wt7=wtEntries.slice(-7);
  const wt14=wtEntries.slice(-14);
  const avgW=(arr)=>arr.length?(arr.reduce((a,b)=>a+b.w,0)/arr.length).toFixed(1):null;
  const currentW=wtEntries.length?wtEntries[wtEntries.length-1].w:null;
  const oldestW=wtEntries.length?wtEntries[0].w:null;
  const totalChange=currentW&&oldestW?(currentW-oldestW).toFixed(1):null;
  // weekly trend: compare last 7 avg to prior 7
  const last7Avg=parseFloat(avgW(wt7));
  const prior7=wtEntries.slice(-14,-7);
  const prior7Avg=parseFloat(avgW(prior7));
  let weeklyTrend="—";
  if(last7Avg&&prior7Avg){
    const diff=(last7Avg-prior7Avg).toFixed(1);
    weeklyTrend=diff>0?`↑ +${diff} lbs`:(diff<0?`↓ ${diff} lbs`:"→ Stable");
  }

  // ─── Workout Consistency ───
  const now=new Date();
  const dow=now.getDay();
  const weekStart=new Date(now);weekStart.setDate(now.getDate()-dow);weekStart.setHours(0,0,0,0);
  const weekStartStr=weekStart.toISOString().slice(0,10);
  const cutoff7=new Date(now);cutoff7.setDate(now.getDate()-7);
  const cutoff30=new Date(now);cutoff30.setDate(now.getDate()-30);
  const c7=cutoff7.toISOString().slice(0,10);
  const c30=cutoff30.toISOString().slice(0,10);

  const wosThisWeek=entries.filter(e=>e.workout==="yes"&&e.date>=weekStartStr).length;
  const wosLast7=entries.filter(e=>e.workout==="yes"&&e.date>=c7).length;
  const wosLast30=entries.filter(e=>e.workout==="yes"&&e.date>=c30).length;

  // most common workout day name
  const dayNameCount={};
  entries.filter(e=>e.workout==="yes"&&e.woDayIdx!==undefined&&e.woDayIdx!=="").forEach(e=>{
    // 9.4.8.3: use getSafeDayDisplayName — handles base + virtual days safely
    const gymKey = e.logGym||"home";
    const name = getSafeDayDisplayName(gymKey, e.woDayIdx);
    if(name){dayNameCount[name]=(dayNameCount[name]||0)+1;}
  });
  const topWoDay=Object.keys(dayNameCount).sort((a,b)=>dayNameCount[b]-dayNameCount[a])[0]||"—";

  // ─── Streak ───
  const sortedDates=[...new Set(entries.map(e=>e.date))].sort().reverse();
  let streak=0;let longest=0;let cur=0;
  const today=new Date().toISOString().slice(0,10);
  const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
  const woDates=new Set(entries.filter(e=>e.workout==="yes").map(e=>e.date));
  // current streak
  let d=new Date();
  while(true){
    const ds=d.toISOString().slice(0,10);
    if(woDates.has(ds)){streak++;d.setDate(d.getDate()-1);}
    else if(ds===today){d.setDate(d.getDate()-1);continue;} // skip today if no wo yet
    else break;
  }
  // longest streak
  let run=0;
  const allWoDates=[...woDates].sort();
  for(let i=0;i<allWoDates.length;i++){
    if(i===0){run=1;}
    else{
      const prev=new Date(allWoDates[i-1]+"T12:00:00");
      const curr=new Date(allWoDates[i]+"T12:00:00");
      const diff=Math.round((curr-prev)/86400000);
      if(diff===1)run++;else run=1;
    }
    if(run>longest)longest=run;
  }

  // ─── Habit Consistency ───
  const habitCounts={};
  HABITS.forEach(h=>{habitCounts[h.id]={name:h.name,icon:h.icon,done:0,total:0};});
  entries.forEach(e=>{
    if(!e.habits)return;
    HABITS.forEach(h=>{
      habitCounts[h.id].total++;
      if(e.habits[h.id]&&e.habits[h.id].completed)habitCounts[h.id].done++;
    });
  });
  const overallHabitPct=entries.length?Math.round(
    entries.reduce((a,e)=>{
      if(!e.habits)return a;
      const done=HABITS.filter(h=>e.habits[h.id]&&e.habits[h.id].completed).length;
      return a+(done/HABITS.length);
    },0)/entries.length*100
  ):0;
  const sortedHabits=Object.values(habitCounts).filter(h=>h.total>0).sort((a,b)=>(b.done/b.total)-(a.done/a.total));
  const bestHabit=sortedHabits[0]||null;
  const worstHabit=sortedHabits[sortedHabits.length-1]||null;

  // ─── Recovery Averages ───
  const avg=(arr)=>arr.length?(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1):null;
  const sleeps=entries.filter(e=>e.sleep).map(e=>parseFloat(e.sleep));
  const hungers=entries.filter(e=>e.hunger).map(e=>parseFloat(e.hunger));
  const moods=entries.filter(e=>e.mood).map(e=>parseFloat(e.mood));

  // ─── Last 30 days activity heatmap data ───
  const heatmap=[];
  for(let i=29;i>=0;i--){
    const dd=new Date();dd.setDate(dd.getDate()-i);
    const ds=dd.toISOString().slice(0,10);
    heatmap.push({date:ds,hasWo:woDates.has(ds)});
  }

  return {
    weight:{current:currentW,avg7:avgW(wt7),avg14:avgW(wt14),totalChange,weeklyTrend,count:wtEntries.length},
    workout:{thisWeek:wosThisWeek,last7:wosLast7,last30:wosLast30,topDay:topWoDay},
    streak:{current:streak,longest},
    habits:{overall:overallHabitPct,breakdown:sortedHabits,best:bestHabit,worst:worstHabit},
    recovery:{sleep:avg(sleeps),hunger:avg(hungers),energy:avg(moods)},
    heatmap,
    totalDays:entries.length
  };
}

function p7RenderAnalytics(){
  const container=document.getElementById("p7-analytics-content");
  if(!container)return;
  const a=p7CalcAnalytics();
  if(!a){container.innerHTML='<div class="empty">No data yet.<br>Start logging to see your stats!</div>';return;}

  const trendClass=a.weight.weeklyTrend.startsWith("↓")?"down":a.weight.weeklyTrend.startsWith("↑")?"up":"neutral";
  const trendColor=a.weight.weeklyTrend.startsWith("↓")?"var(--green)":a.weight.weeklyTrend.startsWith("↑")?"var(--red)":"var(--muted)";

  // Habit bars
  const habitBars=a.habits.breakdown.slice(0,7).map(h=>{
    const pct=h.total?Math.round(h.done/h.total*100):0;
    const fillClass=pct>=80?"green":pct>=50?"orange":"red";
    return `<div class="p7-bar-row">
      <div class="p7-bar-label">${h.icon} ${h.name.split(" ")[0]}</div>
      <div class="p7-bar-track"><div class="p7-bar-fill ${fillClass}" style="width:${pct}%"></div></div>
      <div class="p7-bar-num">${pct}%</div>
    </div>`;
  }).join("");

  // Heatmap dots
  const dots=a.heatmap.map(d=>`<div class="p7-mini-dot${d.hasWo?" has-wo":""}" title="${d.date}"></div>`).join("");

  // Recovery color helpers
  const sleepColor=parseFloat(a.recovery.sleep)>=7?"var(--green)":parseFloat(a.recovery.sleep)>=6?"var(--yellow)":"var(--red)";
  const energyColor=parseFloat(a.recovery.energy)>=7?"var(--green)":parseFloat(a.recovery.energy)>=5?"var(--yellow)":"var(--red)";
  const hungerColor=parseFloat(a.recovery.hunger)<=5?"var(--green)":parseFloat(a.recovery.hunger)<=7?"var(--yellow)":"var(--red)";

  container.innerHTML=`
    <!-- Streaks -->
    <div class="p7-section">
      <div class="p7-section-header">🔥 Streaks</div>
      <div class="p7-streak-row">
        <div class="p7-streak-card">
          <div class="p7-streak-num">${a.streak.current}</div>
          <div class="p7-streak-label">Current Streak</div>
        </div>
        <div class="p7-streak-card">
          <div class="p7-streak-num" style="color:var(--accent2);">${a.streak.longest}</div>
          <div class="p7-streak-label">Longest Streak</div>
        </div>
        <div class="p7-streak-card">
          <div class="p7-streak-num" style="color:var(--muted);font-size:28px;">${a.totalDays}</div>
          <div class="p7-streak-label">Days Logged</div>
        </div>
      </div>
    </div>

    <!-- Weight -->
    <div class="p7-section">
      <div class="p7-section-header">⚖️ Weight Trends</div>
      <div class="p7-stat-grid">
        <div class="p7-stat-card accent">
          <div class="p7-stat-label">Current</div>
          <div class="p7-stat-val accent">${a.weight.current||"—"}</div>
          <div class="p7-stat-sub">lbs</div>
        </div>
        <div class="p7-stat-card">
          <div class="p7-stat-label">Total Change</div>
          <div class="p7-stat-val ${a.weight.totalChange&&parseFloat(a.weight.totalChange)<0?"green":"sm"}" style="color:${a.weight.totalChange&&parseFloat(a.weight.totalChange)<0?"var(--green)":"var(--text)"};">${a.weight.totalChange!==null?(parseFloat(a.weight.totalChange)>0?"+":"")+a.weight.totalChange+" lbs":"—"}</div>
          <div class="p7-stat-sub">since first entry</div>
        </div>
        <div class="p7-stat-card">
          <div class="p7-stat-label">7-Day Avg</div>
          <div class="p7-stat-val sm">${a.weight.avg7||"—"}</div>
          <div class="p7-stat-sub">lbs</div>
        </div>
        <div class="p7-stat-card">
          <div class="p7-stat-label">14-Day Avg</div>
          <div class="p7-stat-val sm">${a.weight.avg14||"—"}</div>
          <div class="p7-stat-sub">lbs</div>
        </div>
      </div>
      <div class="p7-wide-card" style="margin-top:0;">
        <div class="p7-wide-card-title">Weekly Trend</div>
        <span class="p7-stat-badge ${trendClass}" style="font-size:13px;padding:4px 12px;">${a.weight.weeklyTrend}</span>
        <div style="font-size:10px;color:var(--muted);margin-top:6px;">vs prior 7-day average</div>
      </div>
    </div>

    <!-- Workout -->
    <div class="p7-section">
      <div class="p7-section-header">💪 Workout Consistency</div>
      <div class="p7-stat-grid cols3">
        <div class="p7-stat-card green">
          <div class="p7-stat-label">This Week</div>
          <div class="p7-stat-val green">${a.workout.thisWeek}</div>
          <div class="p7-stat-sub">workouts</div>
        </div>
        <div class="p7-stat-card">
          <div class="p7-stat-label">Last 7 Days</div>
          <div class="p7-stat-val sm">${a.workout.last7}</div>
          <div class="p7-stat-sub">workouts</div>
        </div>
        <div class="p7-stat-card">
          <div class="p7-stat-label">Last 30 Days</div>
          <div class="p7-stat-val sm">${a.workout.last30}</div>
          <div class="p7-stat-sub">workouts</div>
        </div>
      </div>
      <div class="p7-wide-card" style="margin-top:0;">
        <div class="p7-wide-card-title">Most Trained Day</div>
        <div style="font-size:15px;font-weight:700;color:var(--text);">${a.workout.topDay}</div>
        <div class="p7-wide-card-title" style="margin-top:10px;">Last 30 Days Activity</div>
        <div class="p7-mini-dots">${dots}</div>
        <div style="font-size:9px;color:var(--muted);margin-top:4px;">🟩 = workout logged · ⬛ = no workout</div>
      </div>
    </div>

    <!-- Habits -->
    <div class="p7-section">
      <div class="p7-section-header">🧠 Habit Consistency</div>
      <div class="p7-stat-grid">
        <div class="p7-stat-card${a.habits.overall>=80?" green":""}">
          <div class="p7-stat-label">Overall %</div>
          <div class="p7-stat-val${a.habits.overall>=80?" green":""}">${a.habits.overall}%</div>
          <div class="p7-stat-sub">avg completion</div>
        </div>
        <div class="p7-stat-card">
          <div class="p7-stat-label">Best Habit</div>
          <div class="p7-stat-val sm" style="font-size:15px;line-height:1.3;padding-top:2px;">${a.habits.best?a.habits.best.icon+" "+a.habits.best.name.split(" ")[0]:"—"}</div>
          <div class="p7-stat-sub">${a.habits.best?Math.round(a.habits.best.done/a.habits.best.total*100)+"% done":""}</div>
        </div>
      </div>
      <div class="p7-wide-card" style="margin-top:0;">
        <div class="p7-wide-card-title">Habit Breakdown</div>
        <div class="p7-bar-wrap">${habitBars}</div>
      </div>
    </div>

    <!-- Recovery -->
    <div class="p7-section">
      <div class="p7-section-header">😴 Recovery Averages</div>
      <div class="p7-stat-grid cols3">
        <div class="p7-stat-card">
          <div class="p7-stat-label">Sleep</div>
          <div class="p7-stat-val sm" style="color:${sleepColor};">${a.recovery.sleep||"—"}</div>
          <div class="p7-stat-sub">avg hrs</div>
        </div>
        <div class="p7-stat-card">
          <div class="p7-stat-label">Energy</div>
          <div class="p7-stat-val sm" style="color:${energyColor};">${a.recovery.energy||"—"}</div>
          <div class="p7-stat-sub">avg /10</div>
        </div>
        <div class="p7-stat-card">
          <div class="p7-stat-label">Hunger</div>
          <div class="p7-stat-val sm" style="color:${hungerColor};">${a.recovery.hunger||"—"}</div>
          <div class="p7-stat-sub">avg /10</div>
        </div>
      </div>
    </div>
  `;
}

// ── END PHASE 7 ───────────────────────────────────────────────────────────────
