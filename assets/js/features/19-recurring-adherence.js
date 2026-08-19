
// ── PHASE 9.5.10: SCHEDULE-AWARE RECURRING ADHERENCE ─────────────────────
// Calendar weekday convention: JavaScript local time, Sunday=0 through Saturday=6.
// Recurring definitions and explicit outcomes are optional, schema-versioned stores.
// Rendering, navigation, setup preview, history, analytics, export, and debug never write.
const P9510_RECURRING_ITEMS_KEY="mf-recurring-items";
const P9510_RECURRING_EVENTS_KEY="mf-recurring-events";
const P9510_RECURRING_SCHEMA=1;

function p9510IsDateKey(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||""))&&!isNaN(p9510ParseDate(value).getTime());}
function p9510ParseDate(value){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||""));
  return m?new Date(+m[1],+m[2]-1,+m[3],12,0,0,0):new Date(NaN);
}
function p9510DateKey(value){
  const d=value instanceof Date?value:p9510ParseDate(value);
  if(isNaN(d.getTime()))return "";
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function p9510AddDays(value,days){const d=p9510ParseDate(p9510DateKey(value));d.setDate(d.getDate()+Number(days||0));return p9510DateKey(d);}
function p9510DayDiff(a,b){return Math.round((p9510ParseDate(b)-p9510ParseDate(a))/86400000);}
function p9510FormatDate(value,withYear){
  const d=p9510ParseDate(value);return isNaN(d)?String(value||""):d.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric",year:withYear?"numeric":undefined});
}
function p9510NormalizeRecurringStore(input){
  const src=input&&typeof input==="object"?input:{},out=Object.assign({},src);
  out.schemaVersion=Number.isInteger(src.schemaVersion)?src.schemaVersion:P9510_RECURRING_SCHEMA;
  out.items={};
  const items=src.items&&typeof src.items==="object"?src.items:{};
  Object.keys(items).forEach(function(id){
    const item=items[id]&&typeof items[id]==="object"?items[id]:{},schedule=item.schedule&&typeof item.schedule==="object"?item.schedule:{};
    const normalized=Object.assign({},item);
    normalized.id=String(item.id||id);normalized.name=String(item.name||id);normalized.category=String(item.category||"habit");
    normalized.enabled=item.enabled!==false;normalized.paused=!!item.paused;normalized.graceDays=Math.max(0,Math.min(7,parseInt(item.graceDays,10)||0));
    normalized.schedule=Object.assign({},schedule,{type:String(schedule.type||"weekly"),interval:Math.max(1,parseInt(schedule.interval,10)||1),weekdays:Array.isArray(schedule.weekdays)?schedule.weekdays.map(Number).filter(function(n){return n>=0&&n<=6;}):[],anchorDate:p9510IsDateKey(schedule.anchorDate)?schedule.anchorDate:""});
    out.items[normalized.id]=normalized;
  });
  return out;
}
function p9510NormalizeEventStore(input){
  const src=input&&typeof input==="object"?input:{},out=Object.assign({},src);out.schemaVersion=Number.isInteger(src.schemaVersion)?src.schemaVersion:P9510_RECURRING_SCHEMA;out.events={};
  const events=src.events&&typeof src.events==="object"?src.events:{};
  Object.keys(events).forEach(function(id){const e=events[id];if(!e||typeof e!=="object")return;const n=Object.assign({},e);n.id=String(e.id||id);n.itemId=String(e.itemId||"");n.scheduledDate=p9510IsDateKey(e.scheduledDate)?e.scheduledDate:"";n.actualDate=p9510IsDateKey(e.actualDate)?e.actualDate:"";n.replacementDate=p9510IsDateKey(e.replacementDate)?e.replacementDate:"";n.status=["completed","skipped","rescheduled","paused"].includes(e.status)?e.status:"";out.events[n.id]=n;});
  return out;
}
function p9510ReadStore(key,normalizer){const raw=localStorage.getItem(key);if(!raw)return normalizer(null);try{return normalizer(JSON.parse(raw));}catch(e){return normalizer(null);}}
function p9510GetRecurringItems(){return p9510ReadStore(P9510_RECURRING_ITEMS_KEY,p9510NormalizeRecurringStore);}
function p9510GetRecurringEvents(){return p9510ReadStore(P9510_RECURRING_EVENTS_KEY,p9510NormalizeEventStore);}
function p9510SaveRecurringItems(store){localStorage.setItem(P9510_RECURRING_ITEMS_KEY,JSON.stringify(p9510NormalizeRecurringStore(store)));}
function p9510SaveRecurringEvents(store){localStorage.setItem(P9510_RECURRING_EVENTS_KEY,JSON.stringify(p9510NormalizeEventStore(store)));}
function p9510GetItem(id){return p9510GetRecurringItems().items[id||"zepbound"]||null;}
function p9510OccurrenceId(itemId,scheduledDate){return String(itemId)+"__"+String(scheduledDate);}
function p9510ScheduleBase(item){
  if(!item||!item.schedule||item.schedule.type!=="weekly"||!p9510IsDateKey(item.schedule.anchorDate)||!item.schedule.weekdays.length)return "";
  let d=item.schedule.anchorDate,guard=0,w=item.schedule.weekdays[0];
  while(p9510ParseDate(d).getDay()!==w&&guard++<7)d=p9510AddDays(d,1);
  return d;
}
function p9510GetPreviousDueDate(item,date){
  const base=p9510ScheduleBase(item);if(!base||!p9510IsDateKey(date)||date<base)return null;
  const period=7*Math.max(1,item.schedule.interval||1),steps=Math.floor(p9510DayDiff(base,date)/period);return p9510AddDays(base,steps*period);
}
function p9510GetNextDueDate(item,date){
  const base=p9510ScheduleBase(item);if(!base||!p9510IsDateKey(date))return null;if(date<base)return base;
  const period=7*Math.max(1,item.schedule.interval||1),steps=Math.floor(p9510DayDiff(base,date)/period)+1;return p9510AddDays(base,steps*period);
}
function p9510FindEventForOccurrence(itemId,scheduledDate){
  const events=p9510GetRecurringEvents().events,id=p9510OccurrenceId(itemId,scheduledDate);
  return events[id]||Object.values(events).find(function(e){return e.itemId===itemId&&e.scheduledDate===scheduledDate;})||null;
}
function p9510LegacyEvidence(item,scheduledDate){
  if(!item||!scheduledDate)return {source:"none",status:null,actualDate:null};
  // Stop before the next weekly occurrence so a later dose is never attributed
  // to two occurrences. Structured events are required for longer/ambiguous gaps.
  for(let i=0;i<7*Math.max(1,item.schedule.interval||1);i++){
    const actual=p9510AddDays(scheduledDate,i),raw=localStorage.getItem("day-"+actual);if(!raw)continue;
    try{const d=JSON.parse(raw);if(d&&d.zep==="yes")return {source:"legacy_daily_log",status:"completed",actualDate:actual,legacyValue:"yes"};}catch(e){}
  }
  return {source:"none",status:null,actualDate:null};
}
function p9510ResolveOccurrence(item,scheduledDate){
  const event=p9510FindEventForOccurrence(item.id,scheduledDate);
  if(event)return {source:"structured_event",status:event.status,actualDate:event.actualDate||null,replacementDate:event.replacementDate||((event.status==="rescheduled"&&event.actualDate)||null),event:event};
  return p9510LegacyEvidence(item,scheduledDate);
}
function p9510WasPaused(item,scheduledDate){
  if(!item)return false;if(item.paused)return true;
  if(Array.isArray(item.pauseIntervals)&&item.pauseIntervals.some(function(interval){
    return interval&&p9510IsDateKey(interval.startDate)&&scheduledDate>=interval.startDate&&(!p9510IsDateKey(interval.endDate)||scheduledDate<=interval.endDate);
  }))return true;
  return !!(p9510IsDateKey(item.pausedAt)&&p9510IsDateKey(item.resumedAt)&&scheduledDate>=item.pausedAt&&scheduledDate<=item.resumedAt);
}
function p9510GetOccurrenceForDate(item,date){
  if(!item||!item.enabled)return {state:"disabled",date:date,scheduledDate:null};
  if(!p9510ScheduleBase(item))return {state:"schedule_unconfigured",date:date,scheduledDate:null};
  if(item.paused)return {state:"paused",date:date,scheduledDate:null};
  const events=Object.values(p9510GetRecurringEvents().events);
  const replacement=events.find(function(e){return e.itemId===item.id&&e.status==="rescheduled"&&(e.replacementDate||e.actualDate)===date;});
  const scheduledDate=replacement?replacement.scheduledDate:p9510GetPreviousDueDate(item,date);
  if(!scheduledDate)return {state:"upcoming",date:date,scheduledDate:null,nextDueDate:p9510GetNextDueDate(item,date)};
  if(p9510WasPaused(item,scheduledDate))return {state:"paused",date:date,scheduledDate:scheduledDate};
  const resolution=p9510ResolveOccurrence(item,scheduledDate),targetDate=(resolution.status==="rescheduled"&&(resolution.replacementDate||resolution.actualDate))||scheduledDate;
  if(resolution.status==="completed")return {state:"completed",timing:resolution.actualDate<=targetDate?"on_time":"late",date:date,scheduledDate:scheduledDate,targetDate:targetDate,resolution:resolution,nextDueDate:p9510GetNextDueDate(item,scheduledDate)};
  if(resolution.status==="skipped")return {state:"skipped",date:date,scheduledDate:scheduledDate,resolution:resolution,nextDueDate:p9510GetNextDueDate(item,scheduledDate)};
  if(resolution.status==="paused")return {state:"paused",date:date,scheduledDate:scheduledDate,resolution:resolution};
  const delta=p9510DayDiff(targetDate,date);
  if(delta<0)return {state:"upcoming",date:date,scheduledDate:scheduledDate,targetDate:targetDate,nextDueDate:targetDate,resolution:resolution};
  if(delta===0)return {state:"due_today",date:date,scheduledDate:scheduledDate,targetDate:targetDate,resolution:resolution};
  if(delta<=item.graceDays)return {state:"due",date:date,scheduledDate:scheduledDate,targetDate:targetDate,daysLate:delta,resolution:resolution};
  return {state:"late",date:date,scheduledDate:scheduledDate,targetDate:targetDate,daysLate:delta,resolution:resolution};
}
function p9510GetScheduleStatus(itemId,date){return p9510GetOccurrenceForDate(p9510GetItem(itemId),date||p9510DateKey(new Date()));}
function p9510UpsertEvent(event){
  const store=p9510GetRecurringEvents(),id=p9510OccurrenceId(event.itemId,event.scheduledDate),old=store.events[id]||{},now=new Date().toISOString();
  store.events[id]=Object.assign({},old,event,{id:id,createdAt:old.createdAt||now,updatedAt:now});p9510SaveRecurringEvents(store);return store.events[id];
}
function p9510WriteDailyBridge(date,value){
  const key="day-"+date,raw=localStorage.getItem(key);let d={date:date};if(raw){try{d=JSON.parse(raw)||d;}catch(e){d={date:date};}}d.zep=value;localStorage.setItem(key,JSON.stringify(d));
}
function p9510CurrentOccurrence(){
  const item=p9510GetItem("zepbound"),date=p9510DateKey(tDate),evaluated=p9510GetOccurrenceForDate(item,date);
  if(evaluated.scheduledDate)return {item:item,date:date,evaluated:evaluated,scheduledDate:evaluated.scheduledDate};
  if(evaluated.nextDueDate)return {item:item,date:date,evaluated:evaluated,scheduledDate:evaluated.nextDueDate};
  return null;
}
function p9510RecordTaken(){
  p9510BeginAction("completed");
}
function p9510RecordSkip(){
  const ctx=p9510CurrentOccurrence();if(!ctx)return;
  p9510UpsertEvent({itemId:"zepbound",scheduledDate:ctx.scheduledDate,actualDate:ctx.date,status:"skipped",source:"daily_log",note:""});
  p9510WriteDailyBridge(ctx.date,"no");toggleStates.zep="no";p9510RenderZepbound();
}
function p9510RecordReschedule(){
  p9510BeginAction("rescheduled");
}
function p9510BeginAction(type){
  const ctx=p9510CurrentOccurrence(),actions=document.getElementById("p9510ZepActions");if(!ctx||!actions)return;
  actions.innerHTML="";
  const field=document.createElement("label");field.className="p9510-field";field.textContent=type==="completed"?"Actual date taken":"New intended date";
  const input=document.createElement("input");input.type="date";input.id="p9510ActionDate";input.value=type==="completed"?ctx.date:p9510AddDays(ctx.date,1);field.appendChild(input);actions.appendChild(field);
  const save=document.createElement("button");save.type="button";save.className="primary";save.textContent=type==="completed"?"Record taken":"Save reschedule";save.onclick=function(){p9510CommitAction(type,ctx.scheduledDate);};actions.appendChild(save);
  const cancel=document.createElement("button");cancel.type="button";cancel.textContent="Cancel";cancel.onclick=p9510RenderZepbound;actions.appendChild(cancel);
}
function p9510CommitAction(type,scheduledDate){
  const input=document.getElementById("p9510ActionDate"),date=input&&input.value;if(!p9510IsDateKey(date))return;
  if(type==="completed"){
    const prior=p9510FindEventForOccurrence("zepbound",scheduledDate);
    p9510UpsertEvent({itemId:"zepbound",scheduledDate:scheduledDate,actualDate:date,replacementDate:prior&&prior.status==="rescheduled"?(prior.replacementDate||prior.actualDate||""):(prior&&prior.replacementDate)||"",status:"completed",source:"daily_log",note:""});
    p9510WriteDailyBridge(date,"yes");if(date===p9510DateKey(tDate))toggleStates.zep="yes";
  }else{
    p9510UpsertEvent({itemId:"zepbound",scheduledDate:scheduledDate,actualDate:date,replacementDate:date,status:"rescheduled",source:"daily_log",note:""});
  }
  p9510RenderZepbound();
}
function p9510ClearOccurrence(){
  const ctx=p9510CurrentOccurrence();if(!ctx)return;const store=p9510GetRecurringEvents(),id=p9510OccurrenceId("zepbound",ctx.scheduledDate),event=store.events[id];if(!event)return;
  if(event.source==="daily_log"&&event.actualDate){const key="day-"+event.actualDate,raw=localStorage.getItem(key);if(raw){try{const d=JSON.parse(raw);if((event.status==="completed"&&d.zep==="yes")||(event.status==="skipped"&&d.zep==="no")){delete d.zep;localStorage.setItem(key,JSON.stringify(d));}}catch(e){}}}
  if(event.actualDate===p9510DateKey(tDate))toggleStates.zep=null;
  delete store.events[id];p9510SaveRecurringEvents(store);p9510RenderZepbound();
}
function p9510LatestLegacyTaken(){
  return Object.keys(localStorage).filter(function(k){return /^day-\d{4}-\d{2}-\d{2}$/.test(k);}).sort().reverse().find(function(k){try{return JSON.parse(localStorage.getItem(k)).zep==="yes";}catch(e){return false;}})?.slice(4)||"";
}
function p9510OpenSetup(){
  const item=p9510GetItem("zepbound"),proposal=p9510LatestLegacyTaken(),anchor=item&&item.schedule.anchorDate||proposal||"";
  document.getElementById("p9510Anchor").value=anchor;document.getElementById("p9510Weekday").value=String(item&&item.schedule.weekdays[0]!=null?item.schedule.weekdays[0]:(anchor?p9510ParseDate(anchor).getDay():0));
  document.getElementById("p9510Grace").value=String(item?item.graceDays:1);document.getElementById("p9510Enabled").checked=item?item.enabled:true;document.getElementById("p9510Paused").checked=item?item.paused:false;document.getElementById("p9510Setup").classList.add("open");
}
function p9510CancelSetup(){document.getElementById("p9510Setup").classList.remove("open");}
function p9510SaveSetup(){
  const anchor=document.getElementById("p9510Anchor").value,weekday=+document.getElementById("p9510Weekday").value,grace=+document.getElementById("p9510Grace").value;if(!p9510IsDateKey(anchor)||weekday<0||weekday>6||grace<0||grace>7)return;
  const store=p9510GetRecurringItems(),old=store.items.zepbound||{},wasPaused=!!old.paused,paused=!!document.getElementById("p9510Paused").checked,nowDate=p9510DateKey(new Date()),now=new Date().toISOString();
  const item=Object.assign({},old,{id:"zepbound",name:"Zepbound",category:"medication",enabled:!!document.getElementById("p9510Enabled").checked,paused:paused,graceDays:Math.floor(grace),schedule:Object.assign({},old.schedule||{},{type:"weekly",interval:1,weekdays:[weekday],anchorDate:anchor}),createdAt:old.createdAt||now,updatedAt:now});
  item.pauseIntervals=Array.isArray(old.pauseIntervals)?old.pauseIntervals.map(function(x){return Object.assign({},x);}):[];
  if(!wasPaused&&paused){item.pausedAt=nowDate;item.pauseIntervals.push({startDate:nowDate,endDate:null});}
  if(wasPaused&&!paused){item.resumedAt=nowDate;for(let i=item.pauseIntervals.length-1;i>=0;i--){if(!item.pauseIntervals[i].endDate){item.pauseIntervals[i].endDate=nowDate;break;}}}
  store.items.zepbound=item;p9510SaveRecurringItems(store);p9510CancelSetup();p9510RenderZepbound();
}
function p9510DisableTracking(){const store=p9510GetRecurringItems(),item=store.items.zepbound;if(item){item.enabled=false;item.updatedAt=new Date().toISOString();p9510SaveRecurringItems(store);}p9510CancelSetup();p9510RenderZepbound();}
function p9510RenderZepbound(){
  const status=document.getElementById("p9510ZepStatus"),actions=document.getElementById("p9510ZepActions");if(!status||!actions)return;
  const item=p9510GetItem("zepbound"),date=p9510DateKey(tDate);actions.innerHTML="";
  if(!item){status.textContent=p9510LatestLegacyTaken()?"Schedule not configured · last taken date available for setup":"Schedule not configured";return;}
  if(!item.enabled){status.textContent="Tracking disabled";return;}const ev=p9510GetOccurrenceForDate(item,date),buttons=[];
  if(ev.state==="schedule_unconfigured"){status.textContent="Schedule not configured";return;}
  if(ev.state==="paused"){status.textContent="Tracking paused";return;}
  if(ev.state==="upcoming"){status.textContent="Next due: "+p9510FormatDate(ev.nextDueDate);buttons.push(["Record early / other date","p9510RecordTaken()",""]);if(ev.resolution&&ev.resolution.status==="rescheduled")buttons.push(["Clear / correct","p9510ClearOccurrence()",""]);}
  if(ev.state==="due_today"){status.textContent=(ev.targetDate!==ev.scheduledDate?"Rescheduled · due today":"Due today");buttons.push(["Taken","p9510RecordTaken()","primary"],["Skip","p9510RecordSkip()",""],["Reschedule","p9510RecordReschedule()",""]);if(ev.resolution&&ev.resolution.status==="rescheduled")buttons.push(["Clear / correct","p9510ClearOccurrence()",""]);}
  if(ev.state==="due"||ev.state==="late"){status.textContent="Due "+p9510FormatDate(ev.targetDate||ev.scheduledDate).split(",")[0]+" · "+ev.daysLate+" day"+(ev.daysLate===1?"":"s")+" "+(ev.state==="late"?"late":"within grace");buttons.push(["Taken today","p9510RecordTaken()","primary"],["Skip","p9510RecordSkip()",""],["Reschedule","p9510RecordReschedule()",""]);if(ev.resolution&&ev.resolution.status==="rescheduled")buttons.push(["Clear / correct","p9510ClearOccurrence()",""]);}
  if(ev.state==="completed"){status.textContent=ev.timing==="on_time"?"Taken "+(ev.resolution.actualDate===date?"today":p9510FormatDate(ev.resolution.actualDate)):"Taken "+p9510FormatDate(ev.resolution.actualDate)+" for "+p9510FormatDate(ev.scheduledDate)+" dose";buttons.push(["Clear / correct","p9510ClearOccurrence()",""]);}
  if(ev.state==="skipped"){status.textContent="Skipped for "+p9510FormatDate(ev.scheduledDate);buttons.push(["Clear / correct","p9510ClearOccurrence()",""]);}
  buttons.forEach(function(b){const el=document.createElement("button");el.type="button";el.textContent=b[0];el.className=b[2];el.setAttribute("onclick",b[1]);actions.appendChild(el);});
}
function p9510OccurrenceDates(item,endDate,weeks){
  const end=endDate||p9510DateKey(new Date()),start=p9510AddDays(end,-7*(weeks||8)),dates=[];let due=p9510GetNextDueDate(item,p9510AddDays(start,-1));while(due&&due<=end&&dates.length<100){dates.push(due);due=p9510AddDays(due,7*Math.max(1,item.schedule.interval||1));}return dates;
}
function p9510GetAdherenceSummary(itemId,weeks,endDate){
  const item=p9510GetItem(itemId||"zepbound"),out={scheduledOccurrences:0,completedOnTime:0,completedLate:0,skipped:0,unresolvedLate:0,pausedExcluded:0,eligibleResolved:0,adherencePercent:null,weeks:weeks||8};
  if(!item||!item.enabled||!p9510ScheduleBase(item))return out;
  p9510OccurrenceDates(item,endDate,weeks).forEach(function(date){if(p9510WasPaused(item,date)){out.pausedExcluded++;return;}const state=p9510GetOccurrenceForDate(item,endDate||p9510DateKey(new Date())),r=p9510ResolveOccurrence(item,date),target=r.replacementDate||date;out.scheduledOccurrences++;if(r.status==="completed"){if(r.actualDate<=target)out.completedOnTime++;else out.completedLate++;}else if(r.status==="skipped")out.skipped++;else if(r.status==="paused")out.pausedExcluded++;else if(p9510DayDiff(target,endDate||p9510DateKey(new Date()))>item.graceDays)out.unresolvedLate++;});
  out.eligibleResolved=out.completedOnTime+out.completedLate+out.skipped+out.unresolvedLate;out.adherencePercent=out.eligibleResolved?Math.round(100*(out.completedOnTime+out.completedLate)/out.eligibleResolved):null;return out;
}
function p9510RenderStats(){
  const el=document.getElementById("p9510StatsSummary");if(!el)return;const item=p9510GetItem("zepbound");if(!item||!item.enabled){el.style.display="none";return;}const s=p9510GetAdherenceSummary("zepbound",8);el.style.display="block";el.innerHTML="<strong>Zepbound · recent 8 weeks</strong><br>Scheduled "+s.scheduledOccurrences+" · On time "+s.completedOnTime+" · Late "+s.completedLate+" · Skipped "+s.skipped+" · Unresolved late "+s.unresolvedLate+"<br>Adherence "+(s.adherencePercent==null?"—":s.adherencePercent+"%")+" (completed ÷ completed, skipped, and unresolved late occurrences; paused/upcoming excluded)";
}
function p9510BuildAdherenceExport(){
  const item=p9510GetItem("zepbound"),today=p9510DateKey(new Date());if(!item)return "--- SCHEDULED ADHERENCE ---\nZepbound tracking: disabled / schedule unconfigured\nBlank non-due days are not misses.\n\n";
  const s=p9510GetAdherenceSummary("zepbound",8,today),prev=p9510GetPreviousDueDate(item,today),resolved=prev?p9510ResolveOccurrence(item,prev):{source:"none"},next=p9510GetNextDueDate(item,today),weekday=item.schedule.weekdays[0];
  return "--- SCHEDULED ADHERENCE ---\nZepbound tracking: "+(item.enabled?(item.paused?"paused":"enabled"):"disabled")+"\nSchedule: "+(p9510ScheduleBase(item)?["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][weekday]+" weekly; grace "+item.graceDays+" day(s)":"unconfigured")+"\nLast occurrence: "+(prev||"none")+" · "+(resolved.status||"unresolved")+" · source "+resolved.source+"\nNext due: "+(next||"unconfigured")+"\nRecent 8 weeks: scheduled "+s.scheduledOccurrences+", on-time "+s.completedOnTime+", late "+s.completedLate+", skipped "+s.skipped+", unresolved late "+s.unresolvedLate+", adherence "+(s.adherencePercent==null?"n/a":s.adherencePercent+"%")+".\nGuidance: Blank non-due days are not misses. Only scheduled occurrences belong in adherence calculations. Completed late, skipped, rescheduled, paused, and unresolved are distinct. Discuss patterns neutrally; do not provide medication dosing/timing instructions or automatically change this schedule.\n\n";
}
function p9510HistoryOutcome(date){
  const events=Object.values(p9510GetRecurringEvents().events).filter(function(e){return e.itemId==="zepbound"&&(e.actualDate===date||e.scheduledDate===date||e.replacementDate===date);});if(!events.length)return "";
  const e=events[0];if(e.status==="completed"){const late=p9510DayDiff(e.replacementDate||e.scheduledDate,e.actualDate);return "💊 Zepbound "+(late>0?"completed "+late+" day"+(late===1?"":"s")+" late":"taken");}if(e.status==="skipped")return "💊 Zepbound skipped";if(e.status==="rescheduled")return "💊 Zepbound rescheduled to "+p9510FormatDate(e.replacementDate||e.actualDate);return "";
}
function mfRecurringAdherenceDebug(itemId,date){
  const id=itemId||"zepbound",item=p9510GetItem(id),when=date||p9510DateKey(new Date()),evaluated=item?p9510GetOccurrenceForDate(item,when):null,scheduled=evaluated&&evaluated.scheduledDate,resolution=item&&scheduled?p9510ResolveOccurrence(item,scheduled):{source:"none"};
  return {appVersion:APP_VERSION,itemExists:!!item,definition:item,enabled:!!(item&&item.enabled),paused:!!(item&&item.paused),anchorDate:item&&item.schedule.anchorDate||null,weekday:item&&item.schedule.weekdays[0],graceDays:item&&item.graceDays,previousDueDate:item?p9510GetPreviousDueDate(item,when):null,nextDueDate:item?p9510GetNextDueDate(item,when):null,evaluatedOccurrence:evaluated,resolvedStatus:resolution.status||null,evidenceSource:resolution.source,matchingStructuredEvent:resolution.event||null,matchingLegacyEvidence:resolution.source==="legacy_daily_log"?resolution:null,recentAdherenceSummary:p9510GetAdherenceSummary(id,8,when),warnings:[],storageKeysCoveredByBackup:[P9510_RECURRING_ITEMS_KEY,P9510_RECURRING_EVENTS_KEY].filter(p8IsMarcusFitKey),readOnly:true};
}
function mfRecurringStorageDebug(){
  const warnings=[],rawItems=localStorage.getItem(P9510_RECURRING_ITEMS_KEY),rawEvents=localStorage.getItem(P9510_RECURRING_EVENTS_KEY),items=p9510GetRecurringItems(),events=p9510GetRecurringEvents(),ids=Object.keys(items.items),occ={},orphans=[];
  Object.values(events.events).forEach(function(e){if(!ids.includes(e.itemId))orphans.push(e.id);const k=e.itemId+"|"+e.scheduledDate;occ[k]=(occ[k]||0)+1;});
  if(rawItems){try{JSON.parse(rawItems);}catch(e){warnings.push("Recurring item store does not parse.");}}if(rawEvents){try{JSON.parse(rawEvents);}catch(e){warnings.push("Recurring event store does not parse.");}}
  return {keys:{items:{exists:rawItems!==null,parses:!rawItems||!warnings.some(function(w){return w.includes("item store");}),schemaVersion:items.schemaVersion},events:{exists:rawEvents!==null,parses:!rawEvents||!warnings.some(function(w){return w.includes("event store");}),schemaVersion:events.schemaVersion}},itemCount:ids.length,eventCount:Object.keys(events.events).length,orphanedEventReferences:orphans,duplicateOccurrenceIds:Object.keys(occ).filter(function(k){return occ[k]>1;}),backupCoverage:{items:p8IsMarcusFitKey(P9510_RECURRING_ITEMS_KEY),events:p8IsMarcusFitKey(P9510_RECURRING_EVENTS_KEY)},warnings:warnings,readOnly:true};
}
function mf9510RunScheduledAdherenceSelfTest(){
  const keys=[P9510_RECURRING_ITEMS_KEY,P9510_RECURRING_EVENTS_KEY,"day-2026-07-27"],before={};keys.forEach(function(k){before[k]=localStorage.getItem(k);});const assertions=[],failures=[];function check(name,pass,actual){assertions.push({name:name,pass:!!pass,actual:actual});if(!pass)failures.push(name);}
  let result;
  try{
    localStorage.setItem(P9510_RECURRING_ITEMS_KEY,JSON.stringify({schemaVersion:1,items:{zepbound:{id:"zepbound",name:"Zepbound",enabled:true,paused:false,graceDays:1,schedule:{type:"weekly",interval:1,weekdays:[0],anchorDate:"2026-07-26"}}}}));localStorage.removeItem(P9510_RECURRING_EVENTS_KEY);localStorage.removeItem("day-2026-07-27");
    const item=p9510GetItem("zepbound");check("Saturday is upcoming",p9510GetOccurrenceForDate(item,"2026-07-25").state==="upcoming");check("Sunday is due today",p9510GetOccurrenceForDate(item,"2026-07-26").state==="due_today");localStorage.setItem("day-2026-07-27",JSON.stringify({date:"2026-07-27",zep:"yes",keep:"same"}));check("Monday legacy completion",p9510GetOccurrenceForDate(item,"2026-07-27").state==="completed");check("legacy source",p9510ResolveOccurrence(item,"2026-07-26").source==="legacy_daily_log");check("next Sunday",p9510GetNextDueDate(item,"2026-07-26")==="2026-08-02");check("backup coverage",p8IsMarcusFitKey(P9510_RECURRING_ITEMS_KEY)&&p8IsMarcusFitKey(P9510_RECURRING_EVENTS_KEY));check("DST-safe date add",p9510AddDays("2026-03-08",1)==="2026-03-09");
    p9510UpsertEvent({itemId:"zepbound",scheduledDate:"2026-07-26",actualDate:"2026-07-27",status:"completed",source:"self_test"});check("structured precedence",p9510ResolveOccurrence(item,"2026-07-26").source==="structured_event");check("single occurrence id",Object.keys(p9510GetRecurringEvents().events).length===1);
  }catch(e){failures.push("Unexpected error: "+(e&&e.message));}
  finally{keys.forEach(function(k){before[k]===null?localStorage.removeItem(k):localStorage.setItem(k,before[k]);});}
  const restored=keys.every(function(k){return localStorage.getItem(k)===before[k];});result={pass:failures.length===0&&restored,assertions:assertions,failures:failures,storageExactlyRestored:restored};return result;
}
// Compatibility wrappers: daily zep values remain readable, but the scheduled card owns new actions.
const p9510LegacySetTog=setTog;
setTog=function(key,val){if(key==="zep"){toggleStates.zep=val;return;}return p9510LegacySetTog(key,val);};
const p9510LegacyApplyStateToForm=applyStateToForm;
applyStateToForm=function(d){const z=d&&d.zep;if(d&&Object.prototype.hasOwnProperty.call(d,"zep"))d=Object.assign({},d,{zep:null});p9510LegacyApplyStateToForm(d);toggleStates.zep=z||null;p9510RenderZepbound();};
const p9510LegacyLoadDay=loadDay;loadDay=function(){const r=p9510LegacyLoadDay();p9510RenderZepbound();return r;};
const p9510LegacyAnalytics=p7RenderAnalytics;p7RenderAnalytics=function(){const r=p9510LegacyAnalytics();p9510RenderStats();return r;};
const p9510LegacyExport=genExport;genExport=function(){const out=p9510LegacyExport(),section=p9510BuildAdherenceExport(),updated=String(out||window._exp||"").replace(/(=== MARCUSFIT EXPORT ===\n)/,"$1"+section);window._exp=updated;const el=document.getElementById("exportOut");if(el)el.textContent=updated;return updated;};
// ── END PHASE 9.5.10 ──────────────────────────────────────────────────────
