
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
  if(!found){
    try{const custom=(getLifecycle().customExercises||{})[exId];if(custom)found=custom;}catch(e){}
  }
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
  let weightUnit=/\bkg\b/.test(load)?"kg":/\blb(?:s)?\b/.test(load)?"lb":null;
  if(!weightUnit&&typeof p950GetUserProfile==="function"){
    try{const userProfile=p950GetUserProfile();weightUnit=userProfile&&userProfile.preferences&&userProfile.preferences.weightUnit==="kg"?"kg":"lb";}catch(e){}
  }
  weightUnit=weightUnit||"lb";
  const minutes=/\b(min|mins|minute|minutes)\b/.test(reps);
  const seconds=/\b(sec|secs|second|seconds)\b/.test(reps);
  if(minutes||seconds){
    return {type:"duration",metric:minutes?"duration_minutes":"duration_seconds",
      valueLabel:minutes?"MIN":"SEC",unit:minutes?"min":"sec",usesLoad:false,
      usesRir:false,lowerIsBetter:false,isCardio:minutes||p9IsCardio(load,rir)};
  }
  if(assistance){
    return {type:"assistance_reps",metric:"assistance_reps",valueLabel:"REPS",
      loadLabel:"ASSIST",unit:weightUnit,usesLoad:true,
      usesRir:true,lowerIsBetter:true,isCardio:false};
  }
  if(/\b(bodyweight|bw)\b/.test(load)){
    return {type:"bodyweight_reps",metric:"bodyweight_reps",valueLabel:"REPS",
      loadLabel:"LOAD",unit:"reps",usesLoad:false,usesRir:!/^(\u2014|-|n\/a)$/.test(rir),
      lowerIsBetter:false,isCardio:false};
  }
  return {type:"load_reps",metric:"load_reps",valueLabel:"REPS",loadLabel:"WEIGHT",
    unit:weightUnit,usesLoad:true,usesRir:!/^(\u2014|-|n\/a)$/.test(rir),
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
  else if(/\blb(?:s)?\b/.test(s))out.unit="lb";
  else if(metricProfile&&(metricProfile.unit==="kg"||metricProfile.unit==="lb"))out.unit=metricProfile.unit;
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
    const reps=parseFloat(s.reps),load=p1080ExactLoad(s.wt,profile);
    const rir=p5ParseRir(s.rir||"");
    return reps>=target.hi&&load.safe&&load.unit===profile.unit&&Math.abs(load.numeric-tlr.high)<=2&&
      (targetRir===null||(rir!==null&&rir>=targetRir-0.5));
  });
}

function p959CeilingEvidence(exId,targetRepsStr,targetRirStr,evaluation,subjectSets){
  const hist=evaluation?p1080EvaluationHistory(exId,evaluation):p9GetExerciseHistory(exId);
  const qualifying=hist.filter(function(h){
    return p959SessionQualifiesAtCeiling(exId,h.validSets,targetRepsStr,targetRirStr);
  });
  const subjectQualifies=!!(evaluation&&evaluation.subjectStored&&p959SessionQualifiesAtCeiling(exId,subjectSets,targetRepsStr,targetRirStr));
  if(subjectQualifies){
    qualifying.unshift({dateKey:evaluation.dateKey,validSets:subjectSets});
  }
  const latestSets=evaluation&&evaluation.subjectStored?subjectSets:hist[0]&&hist[0].validSets;
  return {qualifyingSessionCount:qualifying.length,confirmationRequirement:2,
    latestQualifies:!!(latestSets&&p959SessionQualifiesAtCeiling(exId,latestSets,targetRepsStr,targetRirStr)),
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
      input.setAttribute("inputmode",profile.type==="duration"?"decimal":"numeric");
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
  const profile=p959GetExerciseMetricProfile(ex.id,ex),hist=p9GetExerciseHistory(ex.id,{includeToday:true});
  if(!hist.length)return {hasData:false};
  const recent=hist.slice(0,5),reps=getF(ex.id,"reps",ex.reps),rir=getF(ex.id,"rir",ex.rir);
  const statuses=recent.map(function(h){return p9GetProgressionStatus(ex.id,h.validSets,reps,rir,{dateKey:h.dateKey,subjectStored:true,source:"diagnostic"});});
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
  const hist=p9GetExerciseHistory(exId,{includeToday:true});
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
  const source=String(out||window._exp||""),updated=source.includes("[[MF105_PROGRESSION_GUIDE]]")?source.replace("[[MF105_PROGRESSION_GUIDE]]",guide):source.replace(/(=== MARCUSFIT EXPORT ===\n)/,"$1"+guide);
  window._exp=updated;const target=document.getElementById("exportOut");if(target)target.textContent=updated;
  return updated;
};

// -- 10.8.0 SMARTER LIFTING -------------------------------------------------
// The 9.5.9 correction layer remains the authoritative progression owner.
// This extension adds context-comparable evidence, conservative outcomes, and
// separate action/reason presentation without adding persistence or changing
// the accepted workout row shape.
function p1080ExerciseContext(exId,explicit){
  if(explicit&&explicit.gymKey&&Number.isInteger(parseInt(explicit.dayIdx,10))){
    return {gymKey:String(explicit.gymKey),dayIdx:parseInt(explicit.dayIdx,10)};
  }
  const matches=[];
  try{
    ["home","partial"].forEach(function(gymKey){
      getResolvedDays(gymKey).forEach(function(day){
        if((day.exercises||[]).some(function(ex){return ex.id===exId;}))matches.push({gymKey:gymKey,dayIdx:day._dayIdx});
      });
    });
  }catch(e){}
  if(!matches.length){
    try{
      Object.keys(P||{}).forEach(function(gymKey){(P[gymKey]||[]).forEach(function(day,dayIdx){
        if((day.exercises||[]).some(function(ex){return ex.id===exId;}))matches.push({gymKey:gymKey,dayIdx:dayIdx});
      });});
      const custom=(getLifecycle().customExercises||{})[exId];
      if(custom&&custom.gymKey&&Number.isInteger(parseInt(custom.dayIdx,10)))matches.push({gymKey:custom.gymKey,dayIdx:parseInt(custom.dayIdx,10)});
    }catch(e){}
  }
  const unique=matches.filter(function(match,index,list){return list.findIndex(function(x){return x.gymKey===match.gymKey&&x.dayIdx===match.dayIdx;})===index;});
  return unique.length===1?unique[0]:null;
}

function p1080WorkoutExercise(workout,exId){
  if(!workout||!workout.exercises)return null;
  if(Array.isArray(workout.exercises))return workout.exercises.find(function(ex){return ex&&ex.id===exId;})||null;
  return workout.exercises[exId]||null;
}

function p1080GetExerciseHistory(exId,options){
  const opts=options||{},context=p1080ExerciseContext(exId,opts.context),today=dKey(new Date());
  return Object.keys(localStorage).filter(function(key){return key.startsWith("day-")&&key.endsWith("-wo");}).sort().reverse().reduce(function(out,key){
    const dateKey=key.replace(/-wo$/,"");
    if(!opts.includeToday&&dateKey===today)return out;
    if(opts.excludeDateKey&&dateKey===opts.excludeDateKey)return out;
    try{
      const workout=JSON.parse(localStorage.getItem(key)||"{}");
      if(context&&workout.gym&&workout.gym!==context.gymKey)return out;
      if(context&&workout.dayIdx!==undefined&&workout.dayIdx!==null&&workout.dayIdx!==""&&parseInt(workout.dayIdx,10)!==context.dayIdx)return out;
      const exercise=p1080WorkoutExercise(workout,exId);if(!exercise)return out;
      const allSets=Array.isArray(exercise.sets)?exercise.sets:[];
      const validSets=allSets.filter(function(set){const reps=parseFloat(set&&set.reps);return Number.isFinite(reps)&&reps>0;});
      if(validSets.length||opts.includeIncomplete)out.push({dateKey:dateKey,validSets:validSets,allSets:allSets,gym:workout.gym||null,dayIdx:workout.dayIdx,legacyContext:!workout.gym||workout.dayIdx===undefined});
    }catch(e){}
    return out;
  },[]);
}

p9GetExerciseHistory=function(exId,options){return p1080GetExerciseHistory(exId,options);};
p5GetLastEntry=function(exId){
  const selected=typeof tDate!=="undefined"?dKey(tDate):null;
  const history=p1080GetExerciseHistory(exId,{includeIncomplete:true,excludeDateKey:selected});
  for(let i=0;i<history.length;i++){
    if(history[i].validSets.length)return {dateKey:history[i].dateKey,exLog:{sets:history[i].allSets},validSets:history[i].validSets,allSets:history[i].allSets};
    if(history[i].allSets.some(function(set){return String(set&&set.wt||"").trim();}))return {dateKey:history[i].dateKey,exLog:{sets:history[i].allSets},validSets:[],allSets:history[i].allSets,weightOnly:true};
  }
  return null;
};

function p1080EvaluationHistory(exId,evaluation){
  const evalContext=evaluation||{};
  if(!evalContext.dateKey)return p9GetExerciseHistory(exId);
  return p9GetExerciseHistory(exId,{includeToday:true,excludeDateKey:evalContext.dateKey}).filter(function(entry){
    return entry.dateKey<evalContext.dateKey;
  });
}

function p1080WorkoutExerciseIsSaved(woData,exId,dateKey){
  try{
    const saved=JSON.parse(localStorage.getItem(dateKey+"-wo")||"null");
    if(!saved||saved.gym!==woData.gym||parseInt(saved.dayIdx,10)!==parseInt(woData.dayIdx,10))return false;
    const savedExercise=p1080WorkoutExercise(saved,exId),currentExercise=p1080WorkoutExercise(woData,exId);
    return !!savedExercise&&!!currentExercise&&JSON.stringify(savedExercise.sets||[])===JSON.stringify(currentExercise.sets||[]);
  }catch(e){return false;}
}

function p1080ExactLoad(raw,profile){
  const original=String(raw===undefined||raw===null?"":raw).trim();
  if(!original||/[-–]\s*\d/.test(original)||/^(bodyweight|bw)\b/i.test(original))return {raw:original,safe:false,numeric:null};
  const match=original.match(/^(\d+(?:\.\d+)?)(.*)$/);if(!match)return {raw:original,safe:false,numeric:null};
  const suffix=match[2]||"";
  if(suffix&&!/^\s*(?:(?:lb|lbs|kg)\b)?(?:\s*(?:\/\s*side|per\s+side|db|dbs|dumbbell|dumbbells|barbell|bb|assist|assisted|assistance))*\s*$/i.test(suffix))return {raw:original,safe:false,numeric:null};
  const normalized=p959NormalizeLoggedLoad(original,profile);
  if(normalized.numeric===null||normalized.nonLoadType)return {raw:original,safe:false,numeric:null};
  const unit=normalized.unit||(profile&&profile.unit)||"lb";
  const shape=(unit+"|"+(normalized.perSide?"side":"")+"|"+(normalized.assistance?"assist":"")+"|"+(normalized.equipment||"")).toLowerCase();
  return {raw:original,safe:true,numeric:normalized.numeric,unit:unit,shape:shape,suffix:suffix};
}

function p1080FormatNumber(value){return Number.isInteger(value)?String(value):String(Math.round(value*10)/10);}
function p1080FormatSuggestedLoad(value,load,profile){
  if(load&&load.suffix)return p1080FormatNumber(value)+load.suffix;
  return p1080FormatNumber(value)+" "+((load&&load.unit)||(profile&&profile.unit)||"lb")+(profile&&profile.type==="assistance_reps"?" assistance":"");
}
function p1080Result(status,outcome,action,reason,confidence,evidence,extra){
  return Object.assign({status:status,outcome:outcome,action:action,text:action,reason:reason,confidence:confidence,cls:status==="progress_load"||status==="ceiling_update"||status==="duration_target"?"up":status==="safer_hold"||status==="target_reset"?"safer-hold":status==="new"?"neutral":"hold",evidence:evidence||{}},extra||{});
}
function p1080ComparablePrior(exId,validSets){
  const history=p9GetExerciseHistory(exId),signature=JSON.stringify(validSets||[]);
  if(history.length&&JSON.stringify(history[0].validSets)===signature)return history[1]||null;
  return history[0]||null;
}
function p1080ConservativeStep(current,profile,history,shape){
  const observed=[];
  history.slice(0,5).forEach(function(entry){(entry.validSets||[]).forEach(function(set){const load=p1080ExactLoad(set.wt,profile);if(load.safe&&load.shape===shape&&load.numeric!==current)observed.push(Math.abs(load.numeric-current));});});
  const plausible=observed.filter(function(step){return step>=1&&step<=Math.max(5,current*.15);});
  const defaultStep=profile&&profile.unit==="kg"?(current<20?1:2.5):(current<30?2.5:5);
  return plausible.length?Math.min(defaultStep,Math.min.apply(null,plausible)):defaultStep;
}

p9BuildSuggestion=function(exId,validSets,targetRepsStr,targetRirStr,evaluation){
  const ex=p959FindExercise(exId),profile=p959GetExerciseMetricProfile(exId,ex),required=p959GetRequiredSets(exId,ex);
  const target=p5ParseRepRange(targetRepsStr),targetRir=p5ParseRir(targetRirStr);
  const sets=(validSets||[]).filter(function(set){const value=parseFloat(set&&set.reps);return Number.isFinite(value)&&value>0;});
  const history=evaluation?p1080EvaluationHistory(exId,evaluation):p9GetExerciseHistory(exId);
  const evidence={requiredSets:required,completedSets:sets.length,comparableSessions:history.length+(evaluation&&evaluation.subjectStored?1:0),metric:profile.metric};
  if(!sets.length)return p1080Result("new","insufficient_evidence","Log a conservative baseline.","No comparable completed sets are available.","low",evidence);
  if(!target)return p1080Result("new","insufficient_evidence","Repeat the programmed target.","The stored prescription has no comparable rep or duration target.","low",evidence);
  if(sets.length<required)return p1080Result("build_reps","repeat_target","Repeat the current target.","Only "+sets.length+" of "+required+" prescribed sets were completed.","low",evidence);
  const values=sets.slice(0,required).map(function(set){return parseFloat(set.reps);});
  const atTop=values.every(function(value){return value>=target.hi;}),atMinimum=values.every(function(value){return value>=target.lo;});
  const rirs=sets.slice(0,required).map(function(set){return p5ParseRir(set.rir||"");}),knownRirs=rirs.filter(function(value){return value!==null;});
  const needsRir=profile.usesRir&&targetRir!==null,completeRir=!needsRir||knownRirs.length===required;
  const tightRir=needsRir&&knownRirs.some(function(value){return value<targetRir-.5;});
  evidence.rirSets=knownRirs.length;evidence.targetTop=target.hi;
  if(profile.type==="duration"){
    if(!atMinimum)return p1080Result("build_duration","progress_reps","Build duration toward "+target.lo+"–"+target.hi+" "+profile.unit+".","All prescribed sets were logged, but at least one remains below the duration range.","medium",evidence);
    if(!atTop)return p1080Result("build_duration","progress_reps","Build duration toward "+target.hi+" "+profile.unit+".","The duration range was reached, with room to progress inside it.","medium",evidence);
    return p1080Result("duration_target","maintain","Maintain the duration target.","All prescribed sets reached the top of the duration range.","high",evidence);
  }
  if(needsRir&&!completeRir)return p1080Result("top_range_hold","repeat_target","Repeat the current target.","RIR is missing or N/A for "+(required-knownRirs.length)+" prescribed set"+(required-knownRirs.length===1?"":"s")+", so a load increase is not supported.","low",evidence);

  const prior=evaluation?(history[0]||null):p1080ComparablePrior(exId,sets),currentLoads=sets.slice(0,required).map(function(set){return p1080ExactLoad(set.wt,profile);});
  const allExact=currentLoads.every(function(load){return load.safe;}),sameShape=allExact&&currentLoads.every(function(load){return load.shape===currentLoads[0].shape&&load.numeric===currentLoads[0].numeric;});
  const current=sameShape?currentLoads[0]:null;
  const tlr=p9GetTargetLoadRangeForExercise(exId);
  const unitCompatible=!current||!profile.usesLoad||current.unit===profile.unit;
  if(profile.type==="load_reps"&&current&&tlr&&unitCompatible){
    const comparableLoads=[];history.forEach(function(entry){(entry.validSets||[]).forEach(function(set){const load=p1080ExactLoad(set.wt,profile);if(load.safe&&load.shape===current.shape)comparableLoads.push(load.numeric);});});
    if(comparableLoads.length&&Math.max.apply(null,comparableLoads)>tlr.high+2)return p1080Result("target_reset","reduce_reset","Reset to the programmed load range.","Comparable history exceeds the current programmed ceiling, so rebuild from the current target without rewriting prior loads.","high",evidence);
  }
  if(prior&&current&&unitCompatible){
    const priorLoads=(prior.validSets||[]).slice(0,required).map(function(set){return p1080ExactLoad(set.wt,profile);});
    const priorComparable=priorLoads.length>=required&&priorLoads.every(function(load){return load.safe&&load.shape===current.shape&&load.numeric===priorLoads[0].numeric;});
    if(priorComparable){
      const priorLoad=priorLoads[0].numeric,currentTotal=values.reduce(function(sum,value){return sum+value;},0),priorTotal=prior.validSets.slice(0,required).reduce(function(sum,set){return sum+(parseFloat(set.reps)||0);},0);
      const directionalJump=profile.lowerIsBetter?priorLoad-current.numeric:current.numeric-priorLoad;
      if(directionalJump>Math.max(10,priorLoad*.2))return p1080Result("safer_hold","repeat_target","Repeat this load before progressing.","The apparent load jump is unusually large, so one confirming session is required.","low",evidence);
      if(current.numeric===priorLoad&&priorTotal>0&&currentTotal<priorTotal*.8)return p1080Result("safer_hold","reduce_reset","Maintain or reduce conservatively.","Comparable performance fell by more than 20% at the same load.","medium",evidence);
    }
  }
  if(!atMinimum||tightRir){
    const severe=!atMinimum&&values.some(function(value){return value<target.lo*.8;});
    return p1080Result("safer_hold",severe?"reduce_reset":"repeat_target",severe?"Reduce or reset conservatively.":"Repeat the current target.",!atMinimum?"At least one prescribed set finished below the rep range.":"Logged RIR was tighter than the programmed target.","medium",evidence);
  }
  if(!atTop)return p1080Result("build_reps","progress_reps","Keep the load and progress reps.","All prescribed sets reached the range; build each set toward "+target.hi+" reps.","high",evidence);

  const topReason="All "+required+" prescribed sets reached "+target.hi+" reps"+(needsRir?" at or above target RIR":"")+".";
  if(profile.type==="bodyweight_reps")return p1080Result("top_range_hold","progress_reps","Progress reps, control, or the bodyweight setup.",topReason+" Bodyweight does not support a numeric load increase.","high",evidence);
  if(!allExact)return p1080Result("top_range_hold","progress_reps","Keep this resistance setup and progress reps or setup.","Load is text-based; progress reps or resistance setup before changing the label.","medium",evidence);
  if(!sameShape)return p1080Result("top_range_hold","repeat_target","Repeat a consistent working load.","Completed sets used mixed numeric loads or equipment formats, so a precise increase is not supported.","low",evidence);
  if(!unitCompatible)return p1080Result("top_range_hold","progress_reps","Keep this resistance setup and confirm the programmed unit.","Logged "+current.unit+" does not match the programmed "+profile.unit+" unit, so numeric progression is not comparable.","low",evidence);

  if(profile.type==="assistance_reps"){
    if(tlr&&current.numeric<=tlr.low+2)return p1080Result("ceiling_update","maintain","Maintain and review the next progression method.",topReason+" The hard end of the programmed assistance range is reached.","high",evidence);
    const step=p1080ConservativeStep(current.numeric,profile,history,current.shape),suggested=tlr?Math.max(tlr.low,current.numeric-step):Math.max(0,current.numeric-step);
    if(suggested===current.numeric)return p1080Result("ceiling_update","maintain","Maintain and review the next progression method.",topReason+" The programmed assistance limit prevents a safe reduction.","high",evidence);
    return p1080Result("progress_load","progress_load","Try "+p1080FormatSuggestedLoad(suggested,current,profile)+".",topReason+" Lower assistance is the progression direction.","high",evidence,{suggestedLoad:p1080FormatSuggestedLoad(suggested,current,profile)});
  }
  if(tlr&&current.numeric>=tlr.high-2){
    const ceiling=p959CeilingEvidence(exId,targetRepsStr,targetRirStr,evaluation,sets);evidence.qualifyingCeilingSessions=ceiling.qualifyingSessionCount;
    if(ceiling.qualifyingSessionCount>=ceiling.confirmationRequirement)return p1080Result("ceiling_update","maintain","Maintain and review the programmed ceiling.",topReason+" Two qualifying ceiling sessions are recorded.","high",evidence);
    return p1080Result("capped_hold","repeat_target","Repeat the programmed ceiling once more.",topReason+" One more qualifying ceiling session is required.","medium",evidence);
  }
  const step=p1080ConservativeStep(current.numeric,profile,history,current.shape),suggested=tlr?Math.min(tlr.high,current.numeric+step):current.numeric+step;
  if(suggested<=current.numeric)return p1080Result("top_range_hold","repeat_target","Repeat the current target.",topReason+" No conservative numeric increase is available inside the programmed constraints.","medium",evidence);
  return p1080Result("progress_load","progress_load","Try "+p1080FormatSuggestedLoad(suggested,current,profile)+".",topReason,"high",evidence,{suggestedLoad:p1080FormatSuggestedLoad(suggested,current,profile)});
};

p9GetProgressionStatus=function(exId,validSets,targetRepsStr,targetRirStr,evaluation){return p9BuildSuggestion(exId,validSets,targetRepsStr,targetRirStr,evaluation).status;};
p9BadgeHTML=function(status){
  const map={new:["INSUFFICIENT EVIDENCE","new"],build_reps:["→ PROGRESS REPS","hold"],build_duration:["→ BUILD DURATION","hold"],duration_target:["→ MAINTAIN","up"],safer_hold:["⚠ CONSERVATIVE RESET","safer-hold"],top_range_hold:["→ REPEAT TARGET","hold"],progress_load:["↑ PROGRESS LOAD","up"],capped_hold:["→ CONFIRM CEILING","hold"],ceiling_update:["→ MAINTAIN / REVIEW","up"],target_reset:["⚠ RESET TARGET","reduce"]};
  const entry=map[status]||["→ MAINTAIN","hold"];return '<div class="p9-badge '+entry[1]+'">'+entry[0]+'</div>';
};

p9ComputePrefill=function(exId,setIdx,savedSets){
  const saved=(savedSets&&savedSets[setIdx])||{};
  return {wt:saved.wt||"",reps:saved.reps||"",rir:saved.rir||"",hint:savedSets&&savedSets[setIdx]?"saved":"recommendation-display-only"};
};

function p1080Escape(value){return String(value===undefined||value===null?"":value).replace(/[&<>"']/g,function(char){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char];});}
p5Block=function(exId,targetRepsStr,targetRirStr){
  const last=p5GetLastEntry(exId),recommendation=p9BuildSuggestion(exId,last&&last.validSets,targetRepsStr,targetRirStr,last?{dateKey:last.dateKey,subjectStored:true,source:"saved_history"}:null),bodyId="p1080-body-"+exId;
  let historyLine="No comparable prior session.";
  if(last&&last.weightOnly)historyLine="Last entry had load but no completed rep or duration value.";
  else if(last){const date=last.dateKey.replace("day-","");const label=new Date(date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});historyLine="<strong>"+p1080Escape(label)+":</strong> "+p1080Escape(p5FormatLastSets(last.validSets,exId));}
  const best=last?p9GetBestExercisePerformance(exId):null;
  return p9BadgeHTML(recommendation.status)+'<div class="p5-hist-wrap" id="p5-'+p1080Escape(exId)+'"><button type="button" class="p5-hist-toggle" aria-expanded="false" aria-controls="'+bodyId+'" onclick="p5Toggle(\''+p1080Escape(exId)+'\')"><span class="p5-hist-dot"></span><span class="p5-hist-label">Next session</span><span class="p5-chevron" aria-hidden="true">▼</span></button><div class="p5-hist-body" id="'+bodyId+'"><div class="p5-last-line">'+historyLine+'</div>'+(best?'<div class="p9-best-line">⭐ Best: '+p1080Escape(best)+'</div>':'')+'<div class="p1080-recommendation"><div class="p1080-action">'+p1080Escape(recommendation.action)+'</div><div class="p1080-reason">'+p1080Escape(recommendation.reason)+'</div><div class="p1080-confidence">'+p1080Escape(recommendation.confidence)+' confidence · '+recommendation.evidence.comparableSessions+' comparable session'+(recommendation.evidence.comparableSessions===1?'':'s')+'</div></div></div></div>';
};
p5Toggle=function(exId){const wrap=document.getElementById("p5-"+exId);if(!wrap)return;const open=wrap.classList.toggle("open"),button=wrap.querySelector(".p5-hist-toggle");if(button)button.setAttribute("aria-expanded",open?"true":"false");};

p9BuildProgressionExport=function(ex){
  const history=p9GetExerciseHistory(ex.id,{includeToday:true});if(!history.length)return "";
  const reps=getF(ex.id,"reps",ex.reps),rir=getF(ex.id,"rir",ex.rir),last=history[0],rec=p9BuildSuggestion(ex.id,last.validSets,reps,rir,{dateKey:last.dateKey,subjectStored:true,source:"export"});
  let out="  Progression:\n    Metric: "+p959GetExerciseMetricProfile(ex.id,ex).metric+"\n";
  if(last)out+="    Last: "+p5FormatLastSets(last.validSets,ex.id)+"\n";
  out+="    Outcome: "+rec.outcome+"\n    Recommendation: "+rec.action+"\n    Reason: "+rec.reason+"\n    Confidence: "+rec.confidence+" ("+rec.evidence.comparableSessions+" comparable session(s))\n";
  return out;
};

const p1080LegacyWorkoutReview=p949BuildWorkoutReview;
p949BuildWorkoutReview=function(woData){
  const review=p1080LegacyWorkoutReview(woData);if(!review||review.insufficient||!woData||!woData.exercises)return review;
  const day=getResolvedDays(woData.gym).find(function(item){return item._dayIdx===parseInt(woData.dayIdx,10);});
  (day&&day.exercises||[]).forEach(function(ex){
    const logged=woData.exercises[ex.id],sets=logged&&(logged.sets||[]).filter(function(set){return parseFloat(set.reps)>0;});if(!sets||!sets.length)return;
    const dateKey=dKey(tDate),subjectStored=p1080WorkoutExerciseIsSaved(woData,ex.id,dateKey);
    const name=getF(ex.id,"name",ex.name),rec=p9BuildSuggestion(ex.id,sets,getF(ex.id,"reps",ex.reps),getF(ex.id,"rir",ex.rir),{dateKey:dateKey,subjectStored:subjectStored,source:subjectStored?"post_save":"current_form"});
    review.next=review.next.filter(function(line){return line.indexOf(name+":")!==0;});review.next.push(name+": "+rec.action+" "+rec.reason);
  });
  return review;
};

window.mfProgressionDebug=function(exId){
  const ex=p959FindExercise(exId);if(!ex)return {error:"Exercise ID not found in resolved or known programs: "+exId};
  const history=p9GetExerciseHistory(exId,{includeToday:true}),last=history[0]||null,rec=p9BuildSuggestion(exId,last&&last.validSets,getF(exId,"reps",ex.reps),getF(exId,"rir",ex.rir),last?{dateKey:last.dateKey,subjectStored:true,source:"debug"}:null);
  return {exId:exId,name:getF(exId,"name",ex.name),context:p1080ExerciseContext(exId),metric:p959GetExerciseMetricProfile(exId,ex).metric,status:rec.status,outcome:rec.outcome,recommendedNextAction:rec.action,exactReason:rec.reason,confidence:rec.confidence,evidence:rec.evidence,suggestedLoad:rec.suggestedLoad||null,latestSavedDate:last&&last.dateKey,readOnly:true};
};
mfProgressionDebug=window.mfProgressionDebug;
