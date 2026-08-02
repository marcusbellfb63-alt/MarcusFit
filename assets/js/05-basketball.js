// MarcusFit 10.1.0: Basketball Session Logging
// Isolated feature boundary loaded after the accepted four-file runtime.

(function(){
"use strict";

const MF_BASKETBALL_STORAGE_KEY = "mf-basketball-sessions";
const MF_BASKETBALL_SCHEMA_VERSION = 1;
const MF_BASKETBALL_TYPES = Object.freeze({
  skills_practice: "Skills Practice",
  shooting: "Shooting",
  pickup_game: "Pickup / Game",
  basketball_workout: "Basketball Workout",
  casual_play: "Casual Play",
  other: "Other"
});
const MF_BASKETBALL_LIMITS = Object.freeze({ minutes: 1440, count: 10000, notes: 2000 });

let mfBasketballEditingId = null;
let mfBasketballPendingDeleteId = null;
let mfBasketballSaving = false;

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

function mfBasketballDeleteSession(id){
  const store=mfBasketballReadStore();
  if(!store.parseOk)return false;
  const next=store.sessions.filter(function(session){return session.id!==id;});
  if(next.length===store.sessions.length)return false;
  try{mfBasketballWriteStore(next);return true;}catch(e){return false;}
}

function mfBasketballAggregate(sessions){
  const list=Array.isArray(sessions)?sessions:[];
  const totals={totalSessions:list.length,totalMinutes:0,averageMinutes:0,shooting:{made:0,attempted:0,percentage:null},freeThrows:{made:0,attempted:0,percentage:null}};
  list.forEach(function(session){
    totals.totalMinutes+=Number(session.minutes)||0;
    if(session.shooting){totals.shooting.made+=session.shooting.made;totals.shooting.attempted+=session.shooting.attempted;}
    if(session.freeThrows){totals.freeThrows.made+=session.freeThrows.made;totals.freeThrows.attempted+=session.freeThrows.attempted;}
  });
  totals.averageMinutes=totals.totalSessions?totals.totalMinutes/totals.totalSessions:0;
  if(totals.shooting.attempted>0)totals.shooting.percentage=totals.shooting.made/totals.shooting.attempted*100;
  if(totals.freeThrows.attempted>0)totals.freeThrows.percentage=totals.freeThrows.made/totals.freeThrows.attempted*100;
  return totals;
}

function mfBasketballTypeLabel(type){return MF_BASKETBALL_TYPES[type]||"Basketball";}
function mfBasketballPercent(pair){return pair&&pair.attempted>0?Math.round(pair.made/pair.attempted*1000)/10:null;}
function mfBasketballFormatDate(date){return new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"});}

function mfBasketballFormValue(id){const el=document.getElementById(id);return el?el.value:"";}
function mfBasketballSetFormValue(id,value){const el=document.getElementById(id);if(el)el.value=value==null?"":String(value);}
function mfBasketballSelectedAppDate(){return typeof tDate!=="undefined"?mfBasketballDateKey(tDate):mfBasketballDateKey(new Date());}

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
    if(search){const haystack=(mfBasketballTypeLabel(session.type)+" "+(session.notes||"")+" basketball").toLowerCase();if(haystack.indexOf(search)===-1)return false;}
    return true;
  });
}

function mfBasketballMetricNode(text){const span=document.createElement("span");span.className="mf-basketball-metric";span.textContent=text;return span;}

function mfBasketballRenderHistory(){
  const container=document.getElementById("mfBasketballHistory");if(!container)return;
  container.replaceChildren();container.className="mf-basketball-history-section";
  const heading=document.createElement("div");heading.className="mf-basketball-history-heading";heading.textContent="🏀 Basketball Sessions";container.appendChild(heading);
  const state=mfBasketballReadStore(),sessions=mfBasketballHistoryFilters(state.sessions);
  if(!sessions.length){const empty=document.createElement("div");empty.className="mf-basketball-history-empty";empty.textContent=state.parseOk?"No basketball sessions match the current History filters.":"Basketball storage is unavailable; other History entries are unaffected.";container.appendChild(empty);return;}
  sessions.forEach(function(session){
    const details=document.createElement("details");details.className="mf-basketball-entry";details.dataset.sessionId=session.id;
    const summary=document.createElement("summary"),title=document.createElement("div"),meta=document.createElement("div");title.className="mf-basketball-entry-title";meta.className="mf-basketball-entry-meta";
    title.textContent="🏀 "+mfBasketballTypeLabel(session.type);meta.textContent=session.minutes+" min · "+mfBasketballFormatDate(session.date);summary.append(title,meta);details.appendChild(summary);
    const body=document.createElement("div");body.className="mf-basketball-entry-detail";const metrics=document.createElement("div");metrics.className="mf-basketball-metrics";metrics.appendChild(mfBasketballMetricNode(session.minutes+" total minutes"));
    if(session.dribblingMinutes!=null)metrics.appendChild(mfBasketballMetricNode(session.dribblingMinutes+" dribbling minutes"));
    if(session.shooting){const pct=mfBasketballPercent(session.shooting);metrics.appendChild(mfBasketballMetricNode("Shooting "+session.shooting.made+" / "+session.shooting.attempted+(pct==null?"":" ("+pct+"%)")));}
    if(session.freeThrows){const pct=mfBasketballPercent(session.freeThrows);metrics.appendChild(mfBasketballMetricNode("Free throws "+session.freeThrows.made+" / "+session.freeThrows.attempted+(pct==null?"":" ("+pct+"%)")));}
    body.appendChild(metrics);
    if(session.notes){const notes=document.createElement("div");notes.className="mf-basketball-notes";notes.textContent=session.notes;body.appendChild(notes);}
    const actions=document.createElement("div");actions.className="mf-basketball-card-actions";const edit=document.createElement("button"),remove=document.createElement("button");edit.type="button";remove.type="button";edit.className="mf-basketball-edit";remove.className="mf-basketball-delete";edit.textContent="EDIT";remove.textContent="DELETE";edit.addEventListener("click",function(event){event.preventDefault();mfBasketballStartEdit(session.id);});remove.addEventListener("click",function(event){event.preventDefault();mfBasketballOpenDelete(session.id);});actions.append(edit,remove);body.appendChild(actions);details.appendChild(body);container.appendChild(details);
  });
}

function mfBasketballRenderStats(){
  const container=document.getElementById("mfBasketballStats");if(!container)return;
  const state=mfBasketballReadStore(),stats=mfBasketballAggregate(state.sessions),shootingPct=stats.shooting.percentage==null?"—":stats.shooting.percentage.toFixed(1)+"%",freeThrowPct=stats.freeThrows.percentage==null?"—":stats.freeThrows.percentage.toFixed(1)+"%";
  const recent=state.sessions.slice(0,5).map(function(session){return '<div class="mf-basketball-recent-row"><span>'+mfBasketballTypeLabel(session.type)+'</span><span>'+session.minutes+' min · '+session.date+'</span></div>';}).join("");
  container.className="p7-section mf-basketball-stats";
  container.innerHTML='<div class="p7-section-header">🏀 Basketball Activity</div><div class="p7-stat-grid cols3">'
    +'<div class="p7-stat-card accent"><div class="p7-stat-label">Sessions</div><div class="p7-stat-val accent">'+stats.totalSessions+'</div><div class="p7-stat-sub">all time</div></div>'
    +'<div class="p7-stat-card orange"><div class="p7-stat-label">Minutes</div><div class="p7-stat-val orange">'+stats.totalMinutes+'</div><div class="p7-stat-sub">basketball only</div></div>'
    +'<div class="p7-stat-card"><div class="p7-stat-label">Average</div><div class="p7-stat-val sm">'+(stats.totalSessions?stats.averageMinutes.toFixed(1):"—")+'</div><div class="p7-stat-sub">minutes / session</div></div></div>'
    +'<div class="p7-stat-grid"><div class="p7-stat-card"><div class="p7-stat-label">Shooting</div><div class="p7-stat-val sm">'+stats.shooting.made+' / '+stats.shooting.attempted+'</div><div class="p7-stat-sub">'+shootingPct+'</div></div>'
    +'<div class="p7-stat-card"><div class="p7-stat-label">Free Throws</div><div class="p7-stat-val sm">'+stats.freeThrows.made+' / '+stats.freeThrows.attempted+'</div><div class="p7-stat-sub">'+freeThrowPct+'</div></div></div>'
    +(recent?'<div class="p7-wide-card"><div class="p7-wide-card-title">Recent Basketball Sessions</div><div class="mf-basketball-recent">'+recent+'</div></div>':'<div class="mf-basketball-history-empty">No basketball sessions logged yet.</div>');
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

function mfBasketballBuildExport(range,sessions){
  const selected=mfBasketballSessionsForRange(String(range||""),Array.isArray(sessions)?sessions:[]);if(!selected.length)return "";
  const stats=mfBasketballAggregate(selected);let output="--- BASKETBALL ACTIVITY ---\n";
  output+="Sessions: "+stats.totalSessions+" | Total minutes: "+stats.totalMinutes+" | Average minutes: "+stats.averageMinutes.toFixed(1)+"\n";
  if(stats.shooting.attempted>0)output+="Shooting: "+stats.shooting.made+" / "+stats.shooting.attempted+" ("+stats.shooting.percentage.toFixed(1)+"%)\n";
  if(stats.freeThrows.attempted>0)output+="Free throws: "+stats.freeThrows.made+" / "+stats.freeThrows.attempted+" ("+stats.freeThrows.percentage.toFixed(1)+"%)\n";
  selected.forEach(function(session){let line="- "+session.date+" | "+mfBasketballTypeLabel(session.type)+" | "+session.minutes+" min";if(session.dribblingMinutes!=null)line+=" | dribbling "+session.dribblingMinutes+" min";if(session.shooting)line+=" | shooting "+session.shooting.made+"/"+session.shooting.attempted;if(session.freeThrows)line+=" | FT "+session.freeThrows.made+"/"+session.freeThrows.attempted;if(session.notes)line+=" | notes: "+session.notes.replace(/\s+/g," ");output+=line+"\n";});
  return output+"\n";
}

function mfBasketballValidateBackupStore(value){
  const parsed=mfBasketballParseStoreValue(value);
  if(!parsed.parseOk)throw new Error("Basketball backup data is malformed: "+parsed.error);
  if(parsed.invalidRecordCount)throw new Error("Basketball backup data contains "+parsed.invalidRecordCount+" invalid or duplicate record(s).");
  return parsed;
}

// Backup ownership and preview integration. Existing backups without this key remain valid.
if(typeof p8IsMarcusFitKey==="function"){
  const mfBasketballLegacyIsMarcusFitKey=p8IsMarcusFitKey;
  p8IsMarcusFitKey=function(key){return key===MF_BASKETBALL_STORAGE_KEY||mfBasketballLegacyIsMarcusFitKey(key);};
}
if(typeof p8492SummarizeBackup==="function"){
  const mfBasketballLegacySummarizeBackup=p8492SummarizeBackup;
  p8492SummarizeBackup=function(rawOrObj){
    const summary=mfBasketballLegacySummarizeBackup(rawOrObj),backup=typeof rawOrObj==="string"?function(){try{return JSON.parse(rawOrObj);}catch(e){return null;}}():rawOrObj;
    summary.hasBasketballSessions=false;summary.basketballSessionCount=0;
    if(backup&&backup.data&&Object.prototype.hasOwnProperty.call(backup.data,MF_BASKETBALL_STORAGE_KEY)){
      summary.hasBasketballSessions=true;
      try{const parsed=mfBasketballValidateBackupStore(backup.data[MF_BASKETBALL_STORAGE_KEY]);summary.basketballSessionCount=parsed.sessions.length;if(summary.unknownKeyCount>0)summary.unknownKeyCount--;summary.warnings=(summary.warnings||[]).filter(function(w){return !/key\(s\).*not recognized/i.test(w);});if(summary.unknownKeyCount>0)summary.warnings.push(summary.unknownKeyCount+" key(s) in this backup are not recognized by the current app version.");}catch(e){summary.warnings=(summary.warnings||[]).concat([e.message]);}
    }
    return summary;
  };
}
if(typeof p8492FormatSummaryLines==="function"){
  const mfBasketballLegacyFormatSummaryLines=p8492FormatSummaryLines;
  p8492FormatSummaryLines=function(summary){const lines=mfBasketballLegacyFormatSummaryLines(summary);const index=Math.max(0,lines.findIndex(function(line){return /^Approx size:/.test(line);}));lines.splice(index,0,"Basketball sessions: "+(summary.hasBasketballSessions?summary.basketballSessionCount:"not included"));return lines;};
}
if(typeof p8ValidateBackup==="function"){
  const mfBasketballLegacyValidateBackup=p8ValidateBackup;
  p8ValidateBackup=function(raw){const backup=mfBasketballLegacyValidateBackup(raw);if(backup&&backup.data&&Object.prototype.hasOwnProperty.call(backup.data,MF_BASKETBALL_STORAGE_KEY))mfBasketballValidateBackupStore(backup.data[MF_BASKETBALL_STORAGE_KEY]);return backup;};
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
    const result=mfBasketballLegacyGenExport(),rangeEl=document.getElementById("exportRangeSelect"),section=mfBasketballBuildExport(rangeEl?rangeEl.value:"",mfBasketballReadStore().sessions);
    if(section&&typeof window._exp==="string"){
      const marker="=== AI SYNC FORMAT INSTRUCTIONS ===";window._exp=window._exp.indexOf(marker)>=0?window._exp.replace(marker,section+marker):window._exp+"\n"+section;
      const output=document.getElementById("exportOut");if(output)output.textContent=window._exp;
    }
    return result;
  };
}

function mfBasketballDebug(){
  const state=mfBasketballReadStore(),stats=mfBasketballAggregate(state.sessions),dates=state.sessions.map(function(session){return session.date;}).sort();
  return {appVersion:typeof APP_VERSION!=="undefined"?APP_VERSION:null,storageKey:MF_BASKETBALL_STORAGE_KEY,keyExists:state.keyExists,parseStatus:state.parseOk?"valid":"invalid",schemaVersion:state.schemaVersion,sessionCount:state.sessions.length,invalidRecordCount:state.invalidRecordCount,totalMinutes:stats.totalMinutes,dateRange:dates.length?{first:dates[0],last:dates[dates.length-1]}:null,duplicateIds:state.duplicateIds.slice(),backupCoverage:typeof p8IsMarcusFitKey==="function"?p8IsMarcusFitKey(MF_BASKETBALL_STORAGE_KEY):false,readOnly:true,error:state.error};
}
window.mfBasketballDebug=mfBasketballDebug;

// Dependency-free Node tests receive pure primitives without expanding the
// production browser's public/global surface.
if(typeof process!=="undefined"&&process&&process.versions&&process.versions.node){
  window.__mfBasketballTest={
    mfBasketballReadStore:mfBasketballReadStore,
    mfBasketballCreateId:mfBasketballCreateId,
    mfBasketballNormalizeSession:mfBasketballNormalizeSession,
    mfBasketballSaveSession:mfBasketballSaveSession,
    mfBasketballDeleteSession:mfBasketballDeleteSession,
    mfBasketballAggregate:mfBasketballAggregate,
    mfBasketballBuildExport:mfBasketballBuildExport
  };
}

function mfBasketballInit(){
  const save=document.getElementById("mfBasketballSave"),cancel=document.getElementById("mfBasketballCancel"),deleteConfirm=document.getElementById("mfBasketballDeleteConfirm"),deleteCancel=document.getElementById("mfBasketballDeleteCancel"),dialog=document.getElementById("mfBasketballDeleteDialog");
  if(save)save.addEventListener("click",mfBasketballSaveFromUI);if(cancel)cancel.addEventListener("click",function(){mfBasketballResetForm();});if(deleteConfirm)deleteConfirm.addEventListener("click",mfBasketballConfirmDelete);if(deleteCancel)deleteCancel.addEventListener("click",mfBasketballCloseDelete);
  if(dialog)dialog.addEventListener("click",function(event){if(event.target===dialog)mfBasketballCloseDelete();});
  if(document&&typeof document.addEventListener==="function")document.addEventListener("keydown",function(event){if(event.key==="Escape"&&mfBasketballPendingDeleteId)mfBasketballCloseDelete();});
  mfBasketballResetForm();mfBasketballRenderHistory();mfBasketballRenderStats();
}

mfBasketballInit();
})();
