
// -- 9.5.9 EXERCISE METRICS + PROGRESSION CORRECTNESS -----------------------
// Metric interpretation is derived at read time. Nothing in this phase writes
// classifications to storage or changes the compatible {wt,reps,rir} set shape.
function p959FindExercise(exId){
  let found=null;
  try{
    ["home","partial"].some(function(g){
      return getResolvedDays(g).some(function(day){
        const ex=(day.exercises||[]).find(function(x){return x.id===exId;});
        if(ex){found=ex;return true;}return false;
      });
    });
  }catch(e){}
  if(!found&&typeof window.mfFindKnownExerciseById==="function"){
    try{const known=window.mfFindKnownExerciseById(exId);found=known&&known.exercise;}catch(e){}
  }
  return found;
}

function p959GetExerciseMetricProfile(exId,exercise){
  const ex=exercise||p959FindExercise(exId)||{};
  const name=String(getF(exId,"name",ex.name||"")||"").toLowerCase();
  const reps=String(getF(exId,"reps",ex.reps||"")||"").toLowerCase();
  const load=String(getF(exId,"load",ex.load||"")||"").toLowerCase();
  const rir=String(getF(exId,"rir",ex.rir||"")||"").toLowerCase();
  const assistance=/\b(assisted|assistance|assist)\b/.test(name+" "+load);
  const minutes=/\b(min|mins|minute|minutes)\b/.test(reps);
  const seconds=/\b(sec|secs|second|seconds)\b/.test(reps);
  if(minutes||seconds){
    return {type:"duration",metric:minutes?"duration_minutes":"duration_seconds",
      valueLabel:minutes?"MIN":"SEC",unit:minutes?"min":"sec",usesLoad:false,
      usesRir:false,lowerIsBetter:false,isCardio:minutes||p9IsCardio(load,rir)};
  }
  if(assistance){
    return {type:"assistance_reps",metric:"assistance_reps",valueLabel:"REPS",
      loadLabel:"ASSIST",unit:/\bkg\b/.test(load)?"kg":"lb",usesLoad:true,
      usesRir:true,lowerIsBetter:true,isCardio:false};
  }
  if(/\b(bodyweight|bw)\b/.test(load)){
    return {type:"bodyweight_reps",metric:"bodyweight_reps",valueLabel:"REPS",
      loadLabel:"LOAD",unit:"reps",usesLoad:false,usesRir:!/^(\u2014|-|n\/a)$/.test(rir),
      lowerIsBetter:false,isCardio:false};
  }
  return {type:"load_reps",metric:"load_reps",valueLabel:"REPS",loadLabel:"WEIGHT",
    unit:/\bkg\b/.test(load)?"kg":"lb",usesLoad:true,usesRir:!/^(\u2014|-|n\/a)$/.test(rir),
    lowerIsBetter:false,isCardio:false};
}

function p959NormalizeLoggedLoad(raw,metricProfile){
  const original=raw===undefined||raw===null?"":String(raw);
  const s=original.trim().toLowerCase();
  const out={raw:original,numeric:null,unit:null,equipment:null,perSide:false,
    assistance:false,nonLoadType:null};
  if(!s)return out;
  if(/^(bodyweight|bw)\b/.test(s)){
    out.equipment="bodyweight";out.nonLoadType="bodyweight";return out;
  }
  const heart=s.match(/(?:\bhr\s*|\b)(\d+(?:\.\d+)?)\s*(?:bpm\b)?/);
  if(/\b(bpm|heart\s*rate)\b/.test(s)||/^\s*hr\s*\d/.test(s)){
    out.numeric=heart?parseFloat(heart[1]):null;out.unit="bpm";
    out.nonLoadType="heart_rate";return out;
  }
  const range=s.match(/^(\d+(?:\.\d+)?)\s*[-\u2013]\s*(\d+(?:\.\d+)?)/);
  const one=s.match(/^(\d+(?:\.\d+)?)/);
  if(range)out.numeric=parseFloat(range[2]);
  else if(one)out.numeric=parseFloat(one[1]);
  if(out.numeric===null)return out;
  if(/\bkg\b/.test(s))out.unit="kg";
  else if(/\blb(?:s)?\b/.test(s)||one)out.unit="lb";
  out.perSide=/\/\s*side\b|\bper\s+side\b/.test(s);
  if(/\b(db|dbs|dumbbell|dumbbells)\b/.test(s))out.equipment="dumbbell";
  else if(/\b(barbell|bb)\b/.test(s))out.equipment="barbell";
  out.assistance=/\b(assist|assisted|assistance)\b/.test(s)||
    !!(metricProfile&&metricProfile.type==="assistance_reps");
  if(out.assistance)out.equipment="assisted_machine";
  return out;
}

// Backward-compatible public numeric parser.
p9ParseLoad=function(raw){
  const n=p959NormalizeLoggedLoad(raw);
  return n.nonLoadType?n.numeric!==null&&n.nonLoadType==="heart_rate"?null:null:n.numeric;
};

function p959GetTargetRange(exId,exercise){
  const ex=exercise||p959FindExercise(exId)||{};
  return p5ParseRepRange(getF(exId,"reps",ex.reps||""));
}

function p959GetRequiredSets(exId,exercise){
  const ex=exercise||p959FindExercise(exId)||{};
  return Math.max(1,parseInt(getF(exId,"sets",ex.sets||"1"),10)||1);
}

function p959GetDirectionalLoad(validSets,profile){
  if(!validSets||!validSets.length)return null;
  const values=validSets.map(function(s){
    return {normalized:p959NormalizeLoggedLoad(s.wt,profile),raw:String(s.wt||"").trim()};
  }).filter(function(x){return x.normalized.numeric!==null&&!x.normalized.nonLoadType;});
  if(!values.length)return null;
  values.sort(function(a,b){
    return profile&&profile.lowerIsBetter?a.normalized.numeric-b.normalized.numeric:
      b.normalized.numeric-a.normalized.numeric;
  });
  return {numeric:values[0].normalized.numeric,raw:values[0].raw,
    normalized:values[0].normalized};
}

p9GetTopActualLoad=function(validSets,exId){
  return p959GetDirectionalLoad(validSets,p959GetExerciseMetricProfile(exId));
};

function p959FormatValue(n,profile){
  return String(n)+" "+(profile.unit||"");
}

p5FormatLastSets=function(validSets,exId){
  const profile=p959GetExerciseMetricProfile(exId);
  if(profile.type==="duration"){
    return validSets.map(function(s){return p959FormatValue(parseFloat(s.reps),profile);}).join(", ");
  }
  const byWt={},order=[];
  validSets.forEach(function(s){
    const wt=String(s.wt||"").trim()||"\u2014";
    if(!byWt[wt]){byWt[wt]=[];order.push(wt);}byWt[wt].push(String(s.reps||"\u2014").trim());
  });
  const parts=order.map(function(wt){
    const values=byWt[wt].join(", ");
    if(profile.type==="assistance_reps"){
      const n=p959NormalizeLoggedLoad(wt,profile);
      const label=n.numeric===null?wt:(n.numeric+" "+(n.unit||profile.unit)+" assistance");
      return label+" \u00d7 "+values;
    }
    return wt==="\u2014"?"\u00d7 "+values+" reps":wt+" \u00d7 "+values;
  });
  const rirs=validSets.map(function(s){return String(s.rir||"").trim();})
    .filter(function(r){return r&&r!=="\u2014";});
  return parts.join(" \u00b7 ")+(profile.usesRir&&rirs.length?
    " @ RIR "+Array.from(new Set(rirs)).join("/"):"");
};

p9GetBestExercisePerformance=function(exId){
  const profile=p959GetExerciseMetricProfile(exId),hist=p9GetExerciseHistory(exId);
  if(!hist.length)return null;
  const sets=[].concat.apply([],hist.map(function(h){return h.validSets;}));
  if(profile.type==="duration"){
    const best=Math.max.apply(null,sets.map(function(s){return parseFloat(s.reps)||0;}));
    return best?p959FormatValue(best,profile):null;
  }
  const target=p959GetTargetRange(exId),ex=p959FindExercise(exId);
  const targetRir=p5ParseRir(ex&&getF(exId,"rir",ex.rir));
  const qualifyingAssistanceSets=profile.type==="assistance_reps"?sets.filter(function(s){
    const reps=parseInt(s.reps,10),rir=p5ParseRir(s.rir||"");
    return (!target||reps>=target.lo)&&(targetRir===null||rir===null||rir>=targetRir-0.5);
  }):sets;
  const comparableSets=qualifyingAssistanceSets.length?qualifyingAssistanceSets:sets;
  let best=null;
  comparableSets.forEach(function(s){
    const reps=parseInt(s.reps,10),n=p959NormalizeLoggedLoad(s.wt,profile);
    if(!reps)return;
    if(n.numeric!==null){
      if(!best||(profile.lowerIsBetter?n.numeric<best.load:n.numeric>best.load)||
        (n.numeric===best.load&&reps>best.reps))best={load:n.numeric,reps:reps,n:n};
    }else if(!best&&(!best||reps>best.reps))best={load:null,reps:reps,n:n};
  });
  if(!best)return null;
  if(best.load!==null){
    return profile.type==="assistance_reps"?
      best.load+" "+(best.n.unit||profile.unit)+" assistance \u00d7 "+best.reps:
      best.load+" "+(best.n.unit||profile.unit)+" \u00d7 "+best.reps;
  }
  return best.reps+" reps (BW)";
};

function p959SessionQualifiesAtCeiling(exId,validSets,targetRepsStr,targetRirStr){
  const ex=p959FindExercise(exId),profile=p959GetExerciseMetricProfile(exId,ex);
  const target=p5ParseRepRange(targetRepsStr),targetRir=p5ParseRir(targetRirStr);
  const tlr=p9GetTargetLoadRangeForExercise(exId),required=p959GetRequiredSets(exId,ex);
  if(profile.type!=="load_reps"||!target||!tlr||!validSets||validSets.length<required)return false;
  return validSets.slice(0,required).every(function(s){
    const reps=parseFloat(s.reps),load=p959NormalizeLoggedLoad(s.wt,profile).numeric;
    const rir=p5ParseRir(s.rir||"");
    return reps>=target.hi&&load!==null&&Math.abs(load-tlr.high)<=2&&
      (targetRir===null||(rir!==null&&rir>=targetRir-0.5));
  });
}

function p959CeilingEvidence(exId,targetRepsStr,targetRirStr){
  const hist=p9GetExerciseHistory(exId);
  const qualifying=hist.filter(function(h){
    return p959SessionQualifiesAtCeiling(exId,h.validSets,targetRepsStr,targetRirStr);
  });
  return {qualifyingSessionCount:qualifying.length,confirmationRequirement:2,
    latestQualifies:!!(hist[0]&&p959SessionQualifiesAtCeiling(
      exId,hist[0].validSets,targetRepsStr,targetRirStr)),
    qualifyingDates:qualifying.map(function(h){return h.dateKey;})};
}

function p959AssistanceStep(base,hist){
  const values=[];
  hist.slice(0,5).forEach(function(h){h.validSets.forEach(function(s){
    const n=p959NormalizeLoggedLoad(s.wt,{type:"assistance_reps"}).numeric;
    if(n!==null)values.push(n);
  });});
  const diffs=[];
  values.forEach(function(a){values.forEach(function(b){const d=Math.abs(a-b);if(d>=2.5)diffs.push(d);});});
  // Five pounds is conservative on common selectorized assistance stacks;
  // a smaller observed step wins when the user's own history provides one.
  return diffs.length?Math.min.apply(null,diffs):Math.min(5,Math.max(2.5,base*0.05));
}

p9BuildSuggestion=function(exId,validSets,targetRepsStr,targetRirStr){
  if(!validSets||!validSets.length)return {text:"No performance data. Start conservative.",cls:"neutral",status:"new"};
  const ex=p959FindExercise(exId),profile=p959GetExerciseMetricProfile(exId,ex);
  const values=validSets.map(function(s){return parseFloat(s.reps);}).filter(Number.isFinite);
  if(!values.length)return {text:"No performance data. Start conservative.",cls:"neutral",status:"new"};
  const target=p5ParseRepRange(targetRepsStr),top=target&&values.every(function(v){return v>=target.hi;});
  const below=target&&values.some(function(v){return v<target.lo;});
  const targetRir=p5ParseRir(targetRirStr);
  const rirs=validSets.map(function(s){return p5ParseRir(s.rir||"");}).filter(function(v){return v!==null;});
  const rirTight=profile.usesRir&&targetRir!==null&&
    (!rirs.length||rirs.some(function(v){return v<targetRir-0.5;}));
  if(profile.type==="duration"){
    const best=Math.max.apply(null,values),unit=profile.unit;
    if(!target)return {text:"Continue the programmed duration or target zone.",cls:"neutral",status:"duration_target"};
    if(best<target.lo)return {text:"Build duration toward "+target.lo+"\u2013"+target.hi+" "+unit+".",cls:"hold",status:"build_duration"};
    if(best<target.hi)return {text:"Duration target met. Build gradually toward "+target.hi+" "+unit+".",cls:"hold",status:"build_duration"};
    return {text:profile.isCardio?"Duration target completed. Maintain the target zone or progress duration gradually.":
      "Top duration reached. Progress control or use a harder hold variation when appropriate.",
      cls:"up",status:"duration_target"};
  }
  const current=p959GetDirectionalLoad(validSets,profile);
  const tlr=p9GetTargetLoadRangeForExercise(exId),hist=p9GetExerciseHistory(exId);
  if(profile.type==="assistance_reps"){
    if(below||rirTight)return {text:"Increase assistance slightly for a safer session, then rebuild quality reps.",
      cls:"safer-hold",status:"safer_hold"};
    if(!top)return {text:"Hold "+(current?current.numeric+" "+profile.unit+" assistance":"current assistance")+
      " and build to "+(target?target.hi:"target")+" reps.",cls:"hold",status:"build_reps"};
    if(!current)return {text:"Top reps reached. Record assistance before reducing it.",cls:"hold",status:"top_range_hold"};
    const step=p959AssistanceStep(current.numeric,hist);
    let suggested=Math.max(0,current.numeric-step);
    if(tlr)suggested=Math.max(tlr.low,suggested);
    if(tlr&&current.numeric<=tlr.low+2)return {text:"Hard end of the programmed assistance range reached. Review the target or next progression method.",
      cls:"up",status:"ceiling_update"};
    return {text:"Reduce assistance to "+suggested+" "+profile.unit+".",cls:"up",status:"progress_load"};
  }
  const bestHist=hist.reduce(function(best,h){
    const x=p959GetDirectionalLoad(h.validSets,profile);return x&&(!best||x.numeric>best)?x.numeric:best;
  },null);
  if(tlr&&bestHist!==null&&bestHist>tlr.high+2)return {text:"Current target is below prior load. Reset to the programmed range and rebuild clean reps.",
    cls:"reduce",status:"target_reset"};
  if(below||rirTight)return {text:"Hold load and finish every set at the programmed reps and RIR.",cls:"safer-hold",status:"safer_hold"};
  if(top&&current&&tlr&&current.numeric>=tlr.high-2){
    const evidence=p959CeilingEvidence(exId,targetRepsStr,targetRirStr);
    if(evidence.qualifyingSessionCount>=evidence.confirmationRequirement)
      return {text:"Programmed ceiling completed. Raise the target ceiling or use the next progression method.",
        cls:"up",status:"ceiling_update"};
    return {text:"Ceiling reached once. Confirm one more complete session with qualifying reps and RIR.",
      cls:"hold",status:"capped_hold"};
  }
  if(top&&!rirTight&&current){
    const bump=current.numeric<30?2.5:5;
    const suggested=tlr?Math.min(tlr.high,current.numeric+bump):current.numeric+bump;
    return {text:"Try "+suggested+" "+(current.normalized.unit||profile.unit)+" for "+
      (target&&target.lo!==target.hi?target.lo+"\u2013"+target.hi:target?target.hi:"target")+" reps.",
      cls:"up",status:"progress_load"};
  }
  if(top)return {text:"Top of range reached. Confirm clean form and RIR before progressing.",
    cls:"hold",status:"top_range_hold"};
  return {text:"Hold current load and build toward "+(target?target.hi:"target")+" reps.",
    cls:"hold",status:"build_reps"};
};

p9GetProgressionStatus=function(exId,validSets,targetRepsStr,targetRirStr){
  return p9BuildSuggestion(exId,validSets,targetRepsStr,targetRirStr).status||"build_reps";
};

p9BadgeHTML=function(status){
  const map={
    new:["NEW","new"],build_reps:["\u2192 BUILD REPS","hold"],build_duration:["\u2192 BUILD DURATION","hold"],
    duration_target:["\u2713 DURATION TARGET","up"],safer_hold:["\u26a0 SAFER HOLD","safer-hold"],
    top_range_hold:["\u2192 TOP RANGE","hold"],progress_load:["\u2191 PROGRESS","up"],
    capped_hold:["\u2192 CONFIRM CAP","hold"],ceiling_update:["\u2713 UPDATE CEILING","up"],
    target_reset:["\u26a0 RESET HOLD","reduce"]
  };
  const x=map[status]||["\u2192 HOLD","hold"];
  return '<div class="p9-badge '+x[1]+'">'+x[0]+'</div>';
};

p9BuildProgressionExport=function(ex){
  const hist=p9GetExerciseHistory(ex.id);if(!hist.length)return "";
  const profile=p959GetExerciseMetricProfile(ex.id,ex);
  const reps=getF(ex.id,"reps",ex.reps),rir=getF(ex.id,"rir",ex.rir);
  const sug=p9BuildSuggestion(ex.id,hist[0].validSets,reps,rir);
  const direction=profile.lowerIsBetter?" (lower is better)":"";
  const evidence=sug.status==="capped_hold"||sug.status==="ceiling_update"?
    p959CeilingEvidence(ex.id,reps,rir):null;
  let out="  Progression:\n";
  out+="    Metric: "+profile.metric+direction+"\n";
  out+="    Last: "+p5FormatLastSets(hist[0].validSets,ex.id)+"\n";
  const best=p9GetBestExercisePerformance(ex.id);if(best)out+="    Best: "+best+"\n";
  out+="    Status: "+sug.status+"\n";
  out+="    Suggested: "+sug.text+"\n";
  if(evidence)out+="    Ceiling evidence: "+evidence.qualifyingSessionCount+"/"+evidence.confirmationRequirement+
    " qualifying saved sessions; latest "+(evidence.latestQualifies?"qualifies":"does not qualify")+".\n";
  return out;
};

const p959LegacyRenderWoExercises=renderWoExercises;
renderWoExercises=function(){
  p959LegacyRenderWoExercises();
  const daySelect=document.getElementById("woDaySelect");
  if(!daySelect||daySelect.value==="")return;
  const day=getResolvedDays(logGym).find(function(d){return d._dayIdx===parseInt(daySelect.value,10);});
  const blocks=document.querySelectorAll("#woExerciseLog .wo-ex-block");
  (day&&day.exercises||[]).forEach(function(ex,i){
    const block=blocks[i];if(!block)return;
    const profile=p959GetExerciseMetricProfile(ex.id,ex);
    const wtLabel=block.querySelector(".wo-set-label.wt");
    const valueLabel=block.querySelector(".wo-set-label.rp");
    if(wtLabel)wtLabel.textContent=profile.type==="assistance_reps"?"ASSIST":
      profile.type==="duration"&&profile.isCardio?"ZONE / LEVEL":"WEIGHT";
    if(valueLabel)valueLabel.textContent=profile.valueLabel;
    block.querySelectorAll(".wo-set-reps").forEach(function(input){
      input.placeholder=profile.type==="duration"?profile.unit:"reps";
      input.setAttribute("aria-label",profile.type==="duration"?"Duration in "+profile.unit:"Reps");
    });
  });
};

const p959LegacyWorkoutReview=p949BuildWorkoutReview;
p949BuildWorkoutReview=function(woData){
  const review=p959LegacyWorkoutReview(woData);
  if(!review||review.insufficient)return review;
  const day=getResolvedDays(woData.gym).find(function(d){return d._dayIdx===parseInt(woData.dayIdx,10);});
  (day&&day.exercises||[]).forEach(function(ex){
    const logged=woData.exercises[ex.id],sets=logged&&(logged.sets||[]).filter(function(s){return parseFloat(s.reps)>0;});
    if(!sets||!sets.length)return;
    const name=getF(ex.id,"name",ex.name),profile=p959GetExerciseMetricProfile(ex.id,ex);
    review.wins=review.wins.filter(function(x){return x.indexOf(name+":")!==0;});
    review.watch=review.watch.filter(function(x){return x.indexOf(name+":")!==0;});
    review.next=review.next.filter(function(x){return x.indexOf(name+":")!==0;});
    const reps=getF(ex.id,"reps",ex.reps),rir=getF(ex.id,"rir",ex.rir);
    const sug=p9BuildSuggestion(ex.id,sets,reps,rir);
    if(profile.type==="duration"){
      const best=Math.max.apply(null,sets.map(function(s){return parseFloat(s.reps);}));
      review.wins.push(name+": logged "+best+" "+profile.unit+" using the correct duration metric.");
    }else if(profile.type==="assistance_reps"&&sug.status==="progress_load"){
      review.wins.push(name+": target met; lower assistance is the next progression.");
    }else if(sug.status==="ceiling_update"){
      review.wins.push(name+": programmed ceiling completed with repeated qualifying sessions.");
    }
    review.next.push(name+": "+sug.text);
  });
  return review;
};

const p959LegacyRecentSignals=p9489GetRecentExerciseSignals;
p9489GetRecentExerciseSignals=function(ex){
  const profile=p959GetExerciseMetricProfile(ex.id,ex),hist=p9GetExerciseHistory(ex.id);
  if(!hist.length)return {hasData:false};
  const recent=hist.slice(0,5),reps=getF(ex.id,"reps",ex.reps),rir=getF(ex.id,"rir",ex.rir);
  const statuses=recent.map(function(h){return p9GetProgressionStatus(ex.id,h.validSets,reps,rir);});
  if(profile.type==="duration")return {hasData:true,sessionCount:hist.length,recentCount:recent.length,
    statuses:statuses,progressCount:recent.length,cappedCount:0,metricExcludedFromLoadStale:true};
  let directionalProgress=0;
  if(profile.type==="assistance_reps"){
    for(let i=0;i<recent.length-1;i++){
      const newer=p959GetDirectionalLoad(recent[i].validSets,profile);
      const older=p959GetDirectionalLoad(recent[i+1].validSets,profile);
      if(newer&&older&&newer.numeric<older.numeric)directionalProgress++;
    }
  }else directionalProgress=statuses.filter(function(s){
    return s==="progress_load"||s==="ceiling_update";
  }).length;
  return {hasData:true,sessionCount:hist.length,recentCount:recent.length,statuses:statuses,
    progressCount:directionalProgress,cappedCount:statuses.filter(function(s){
      return s==="capped_hold"||s==="top_range_hold";
    }).length,ceilingUpdateCount:statuses.filter(function(s){return s==="ceiling_update";}).length};
};

const p959LegacyRotationAnalysis=p9489AnalyzeExerciseRotation;
p9489AnalyzeExerciseRotation=function(){
  const out=p959LegacyRotationAnalysis(),seen=new Set(out.candidates.map(function(c){return c.gym+"|"+c.day+"|"+c.name;}));
  ["home","partial"].forEach(function(g){getResolvedDays(g).forEach(function(day){
    (day.exercises||[]).forEach(function(ex){
      const sig=p9489GetRecentExerciseSignals(ex),name=getF(ex.id,"name",ex.name);
      const key=g+"|"+(day.name||day.day)+"|"+name;
      if(sig.hasData&&sig.ceilingUpdateCount>0&&!seen.has(key)){
        out.candidates.unshift({name:name,gym:g,day:day.name||day.day,signal:"ceiling_update",
          severity:2,reason:"The programmed ceiling has repeated qualifying completion evidence.",
          action:"target update or progression-method review",
          note:"Prefer a higher ceiling, suitable next increment, or rep-range method before considering replacement."});
      }
    });
  });});
  out.candidates=out.candidates.slice(0,8);out.candidatesTotal=Math.max(out.candidatesTotal,out.candidates.length);
  return out;
};

window.mfExerciseMetricDebug=function(exId,exercise){
  const ex=exercise||p959FindExercise(exId);
  const profile=p959GetExerciseMetricProfile(exId,ex);
  const hist=p9GetExerciseHistory(exId);
  return {exId:exId,resolved:!!ex,profile:profile,
    targetValueRange:p959GetTargetRange(exId,ex),
    normalizedTargetLoad:p959NormalizeLoggedLoad(ex&&getF(exId,"load",ex.load),profile),
    normalizedLoggedLoads:hist.map(function(h){return {dateKey:h.dateKey,loads:h.validSets.map(function(s){
      return p959NormalizeLoggedLoad(s.wt,profile);
    })};}),readOnly:true};
};

window.mfProgressionDebug=function(exId){
  const ex=p959FindExercise(exId);
  if(!ex)return {error:"Exercise ID not found in resolved or known programs: "+exId};
  const profile=p959GetExerciseMetricProfile(exId,ex),reps=getF(exId,"reps",ex.reps);
  const rir=getF(exId,"rir",ex.rir),hist=p9GetExerciseHistory(exId),last=hist[0]||null;
  const sug=p9BuildSuggestion(exId,last&&last.validSets,reps,rir);
  const evidence=p959CeilingEvidence(exId,reps,rir);
  return {exId:exId,name:getF(exId,"name",ex.name),metricType:profile.type,
    metric:profile.metric,valueUnit:profile.unit,lowerIsBetter:profile.lowerIsBetter,
    normalizedTargetLoad:p959NormalizeLoggedLoad(getF(exId,"load",ex.load),profile),
    normalizedLoggedLoads:last?last.validSets.map(function(s){return p959NormalizeLoggedLoad(s.wt,profile);}):[],
    targetValueRange:p5ParseRepRange(reps),qualifyingSessionCount:evidence.qualifyingSessionCount,
    ceilingConfirmationRequirement:evidence.confirmationRequirement,latestSessionQualifies:evidence.latestQualifies,
    finalStatus:sug.status,exactReason:sug.text,recommendedNextAction:sug.text,
    bestPerformance:p9GetBestExercisePerformance(exId),readOnly:true};
};
mfProgressionDebug=window.mfProgressionDebug;

window.mfProgressionAudit=function(){
  const exercises=[],known=["new","target_reset","safer_hold","top_range_hold","progress_load",
    "capped_hold","ceiling_update","build_reps","build_duration","duration_target"];
  ["home","partial"].forEach(function(g){getResolvedDays(g).forEach(function(day,di){
    (day.exercises||[]).forEach(function(ex){
      const d=window.mfProgressionDebug(ex.id);
      exercises.push({gym:g,dayIndex:di,exId:ex.id,name:d.name,metric:d.metric,
        status:d.finalStatus,suggestion:d.recommendedNextAction,best:d.bestPerformance});
    });
  });});
  const counts={};known.concat(["unknown"]).forEach(function(s){counts[s]=0;});
  exercises.forEach(function(ex){counts[known.indexOf(ex.status)>=0?ex.status:"unknown"]++;});
  return {appVersion:APP_VERSION,generatedAt:new Date().toISOString(),totalExercises:exercises.length,
    statusCounts:counts,exercises:exercises,warnings:counts.unknown?["Unknown progression statuses detected."]:[]};
};
mfProgressionAudit=window.mfProgressionAudit;

p945RenderDiag=function(){
  const grid=document.getElementById("p945CountGrid"),warnEl=document.getElementById("p945Warnings");
  if(!grid||!warnEl)return;
  const audit=window.mfProgressionAudit();
  if(audit.error){grid.textContent=audit.error;return;}
  const colors={progress_load:"green",ceiling_update:"green",duration_target:"green",
    target_reset:"red",safer_hold:"yellow",top_range_hold:"yellow",capped_hold:"yellow",
    build_reps:"accent",build_duration:"accent",unknown:"red"};
  const labels={progress_load:"\u2191 Progress",ceiling_update:"\u2713 Update Ceiling",
    duration_target:"\u2713 Duration Target",target_reset:"\u26a0 Reset Hold",
    safer_hold:"\u26a0 Safer Hold",top_range_hold:"\u2192 Top Range",
    capped_hold:"\u2192 Confirm Cap",build_reps:"\u2192 Build Reps",
    build_duration:"\u2192 Build Duration",new:"New",unknown:"Unknown"};
  const order=["progress_load","ceiling_update","duration_target","build_reps","build_duration",
    "top_range_hold","capped_hold","safer_hold","target_reset","new","unknown"];
  grid.innerHTML=order.filter(function(k){return audit.statusCounts[k]>0||k==="progress_load"||k==="ceiling_update";})
    .map(function(k){const c=colors[k]||"";return '<div class="p945-count-card"><div class="p945-count-label">'+
      labels[k]+'</div><div class="p945-count-val'+(c?" "+c:"")+'">'+(audit.statusCounts[k]||0)+"</div></div>";}).join("");
  warnEl.innerHTML=audit.warnings.length?
    '<div class="p945-warn-title">\u26a0 '+audit.warnings.length+' Warning(s)</div>'+
      audit.warnings.map(function(w){return '<div class="p945-warn-item">'+w+"</div>";}).join(""):
    '<div class="p945-no-warn">\u2705 No warnings \u2014 all '+audit.totalExercises+" exercises processed cleanly.</div>";
};

// Safe browser fixture: every affected key is restored byte-for-byte in finally.
window.mf959RunProgressionSelfTest=function(){
  const ids=["partial-d0-e3"],keys=["day-2099-01-01-wo","day-2099-01-02-wo"];
  const before={};keys.forEach(function(k){before[k]=localStorage.getItem(k);});
  const assertions=[];
  function check(name,pass,actual){assertions.push({name:name,pass:!!pass,actual:actual});}
  try{
    const ex=p959FindExercise(ids[0]),sets=function(last){return [20,20,20,last].map(function(r){
      return {wt:"20 lb",reps:String(r),rir:"2"};
    });};
    const make=function(s){return JSON.stringify({exercises:{"partial-d0-e3":{sets:s}}});};
    localStorage.setItem(keys[0],make(sets(20)));
    let status=p9GetProgressionStatus(ids[0],sets(20),"15\u201320","1\u20132");
    check("first ceiling session is capped_hold",status==="capped_hold",status);
    localStorage.setItem(keys[1],make(sets(20)));
    status=p9GetProgressionStatus(ids[0],sets(20),"15\u201320","1\u20132");
    check("second ceiling session is ceiling_update",status==="ceiling_update",status);
    check("weak set fails qualification",!p959SessionQualifiesAtCeiling(ids[0],sets(14),"15\u201320","1\u20132"),null);
    const assist={id:"qa-assisted",name:"Assisted Pull-Up",sets:3,reps:"8\u201310",load:"100\u2013120 lb assistance",rir:"1\u20132"};
    check("assistance classification",p959GetExerciseMetricProfile(assist.id,assist).lowerIsBetter===true,null);
    check("duration minutes",p959GetExerciseMetricProfile("home-d2-e0").metric==="duration_minutes",null);
    check("static hold seconds",p959GetExerciseMetricProfile("home-d4-e4").metric==="duration_seconds",null);
    check("load normalization",p959NormalizeLoggedLoad("40 lb dumbbells").equipment==="dumbbell",null);
    check("heart rate normalization",p959NormalizeLoggedLoad("HR 130").nonLoadType==="heart_rate",null);
    return {pass:assertions.every(function(a){return a.pass;}),assertions:assertions,restored:true};
  }finally{
    keys.forEach(function(k){before[k]===null?localStorage.removeItem(k):localStorage.setItem(k,before[k]);});
  }
};

const p959LegacyGenExport=genExport;
genExport=function(){
  const out=p959LegacyGenExport();
  const guide="--- 9.5.9 PROGRESSION METRIC GUIDE ---\n"+
    "- Assisted-machine load is assistance: lower assistance is improvement.\n"+
    "- Cardio minutes and static-hold seconds are duration, never reps.\n"+
    "- capped_hold means one more qualifying ceiling confirmation is pending.\n"+
    "- ceiling_update means the programmed ceiling is complete; update the target or method before replacing a productive exercise.\n\n";
  const updated=String(out||window._exp||"").replace(/(=== MARCUSFIT EXPORT ===\n)/,"$1"+guide);
  window._exp=updated;const target=document.getElementById("exportOut");if(target)target.textContent=updated;
  return updated;
};
