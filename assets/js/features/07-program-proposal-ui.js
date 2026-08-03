// ── FUTURE MODULE: src/proposal-ui.js ────────────────────────────────────────
// ── Sync-tab UI ──────────────────────────────────────────────────────────────
// All rendering uses textContent / safe DOM creation only — never innerHTML
// with onboarding-, profile-, or program-derived strings (day names, goal
// text, equipment notes, etc. are all user-entered).
let p954SummaryVisible = false;

// ── 9.5.4B: detailed review overlay state (UI-layer only — never persisted) ──
let p954ReviewOpenFlag = false;      // true while the review overlay is open
let p954ReviewInvalid = false;       // true when the stored proposal failed validation at open-time
let p954ReviewInvalidErrors = [];    // validation error strings for the error state
let p954RLastRenderedGymGroups = 0;  // debug: gym groups rendered in the last built review
let p954RLastRenderedDayCount = 0;   // debug: day cards rendered in the last built review
let p954RLastRenderedExerciseCount = 0; // debug: exercise rows rendered in the last built review

// ── 9.5.4C: apply-preview UI state (UI-layer only — never persisted) ────────
let p954ApplyPreviewOpenFlag = false;   // true while the apply preview/confirm panel is open
let p954ApplyFingerprint = null;        // proposal fingerprint captured when the preview opened
let p954RLastRenderedAppliedSummary = null; // debug: last-rendered applied-state summary object
let p954UndoPreviewOpenFlag = false;    // 9.5.4E: true while the undo preview is open

function p954ShowResult(msg, type){
  const el = document.getElementById("p954Result");
  if(!el) return;
  el.style.display = "block";
  el.style.color = type === "ok" ? "var(--green)" : type === "err" ? "var(--red)" : type === "warn" ? "var(--yellow)" : "var(--text)";
  el.style.whiteSpace = "pre-wrap";
  el.textContent = msg;
}

// `dayPlans` is the executable review model. Stored summary counts are useful
// for older records, but can be absent or stale (especially in developer QA
// fixtures), so display/debug counts are always derived from normalized plans.
function p955GetDerivedProposalActionCounts(proposal){
  const counts={keep:0,modify:0,reorder:0,replace:0,add:0,remove:0,optional_add:0,reactivate:0};
  const byType={};
  (Array.isArray(proposal&&proposal.dayPlans)?proposal.dayPlans:[]).forEach(function(dp){
    const dayAction=PROGRAM_PROPOSAL_DAY_ACTIONS.indexOf(dp&&dp.action)!==-1?dp.action:"keep";
    counts[dayAction]++;
    byType["day:"+dayAction]=(byType["day:"+dayAction]||0)+1;
    if(Array.isArray(dp&&dp.proposedExerciseOrder)){
      counts.reorder++;
      byType["exercise:reorder"]=(byType["exercise:reorder"]||0)+1;
    }
    (Array.isArray(dp&&dp.exerciseActions)?dp.exerciseActions:[]).forEach(function(ea){
      const action=PROGRAM_PROPOSAL_EXERCISE_ACTIONS.indexOf(ea&&ea.action)!==-1?ea.action:"keep";
      if(Object.prototype.hasOwnProperty.call(counts,action)) counts[action]++;
      byType["exercise:"+action]=(byType["exercise:"+action]||0)+1;
    });
  });
  return {counts:counts,byType:byType};
}

function p955FormatProposalActionCounts(counts){
  const c=counts||{};
  return "keep "+(c.keep||0)+" · modify "+(c.modify||0)+" · reorder "+(c.reorder||0)+" · replace "+(c.replace||0)+" · add "+(c.add||0)+" · optional add "+(c.optional_add||0)+" · remove "+(c.remove||0)+" · reactivate "+(c.reactivate||0);
}

function p955VisibleSummaryTextSafety(proposal){
  const metrics=p955GetProposalQualityMetrics(proposal);
  const sample=[proposal&&proposal.status,proposal&&proposal.sourceType,proposal&&proposal.generatedAt,p955FormatProposalActionCounts(metrics.actionCounts),metrics.safeApplyCount,metrics.deferredCount,metrics.conflictCount].map(function(v){return String(v===null||v===undefined?"":v);}).join(" | ");
  const unsafeTokens=["undefined","null","[object Object]"].filter(function(token){return sample.indexOf(token)!==-1;});
  return {safe:unsafeTokens.length===0,unsafeTokens:unsafeTokens,sample:sample};
}

function p955GetProposalQualityMetrics(proposal){
  const plan = proposal ? p954BuildApplicationPlan(proposal) : null;
  const ops = plan && Array.isArray(plan.ops) ? plan.ops : [];
  const safeApplyCount = ops.filter(function(op){
    return op.type === "dayOverride"
      || (op.type === "orderOverride" && !op.conflict && op.writeNeeded)
      || (op.type === "exerciseOverride" && !op.conflict && op.writeNeeded);
  }).length;
  const deferredCount = plan ? ((plan.counts.deferredDayLifecycleCount||0) + (plan.counts.skippedExerciseActionCount||0)) : 0;
  const conflictCount = ops.filter(function(op){ return op.conflict; }).length + (plan ? plan.errors.length : 0);
  const ss = proposal && proposal.sourceSummary ? proposal.sourceSummary : {};
  const derivedActions=p955GetDerivedProposalActionCounts(proposal);
  const coverageFields = ["profileUsed","onboardingUsed","coachingPrefsUsed","currentProgramUsed","lifecycleUsed","recentLogsUsed"];
  return {
    safeApplyCount: safeApplyCount,
    deferredCount: deferredCount,
    conflictCount: conflictCount,
    actionCounts: derivedActions.counts,
    actionCountsByType: derivedActions.byType,
    warningCount: ((proposal && proposal.warnings) || []).length + ((ss && ss.sourceWarnings) || []).length,
    sourceCoverageCount: coverageFields.filter(function(f){ return ss[f] === true; }).length,
    sourceCoverageTotal: coverageFields.length,
    sourceCoverage: coverageFields.reduce(function(acc, f){ acc[f] = ss[f] === true; return acc; }, {}),
    plan: plan
  };
}

function p955BuildProposalStatusCard(proposal){
  const card = document.createElement("div");
  card.style.cssText = "background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:11px 13px;margin-bottom:10px;font-size:12px;line-height:1.55;";
  const metrics = p955GetProposalQualityMetrics(proposal);
  const sourceLabel = proposal.sourceType === "fixture" ? "Developer fixture / test"
    : proposal.sourceType === "local_generated" ? "Generated from current app data"
    : "Legacy / source details missing";
  [
    ["Status", proposal.status],
    ["Source", sourceLabel],
    ["Generated", proposal.generatedAt ? new Date(proposal.generatedAt).toLocaleString() : "Not recorded"],
    ["Coverage", metrics.sourceCoverageCount + "/" + metrics.sourceCoverageTotal + " source groups used"],
    ["Action counts", p955FormatProposalActionCounts(metrics.actionCounts)],
    ["Actions", metrics.safeApplyCount + " supported · " + metrics.deferredCount + " deferred"],
    ["Warnings", (metrics.warningCount + metrics.conflictCount) + " warning/conflict item(s)"]
  ].forEach(function(pair){
    const row=document.createElement("div"),label=document.createElement("span"),value=document.createElement("span");
    label.style.cssText="font-weight:700;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.4px;";
    label.textContent=pair[0]+": "; value.textContent=String(pair[1]); row.appendChild(label); row.appendChild(value); card.appendChild(row);
  });
  if(proposal.status === "applied"){
    const undo = p954BuildUndoPlan(proposal), line=document.createElement("div");
    line.style.cssText="margin-top:4px;color:"+(undo.canUndo?"var(--green)":"var(--yellow)")+";";
    line.textContent=undo.canUndo?"Undo available for supported applied changes.":"Undo unavailable: "+(undo.conflicts[0]||undo.errors[0]||"saved snapshot is not eligible.");
    card.appendChild(line);
  } else if(proposal.status === "undone"){
    const line=document.createElement("div");line.style.cssText="margin-top:4px;color:var(--muted);";line.textContent="This proposal was undone. Repeating undo is a no-write no-op.";card.appendChild(line);
  } else if(metrics.conflictCount){
    const line=document.createElement("div");line.style.cssText="margin-top:4px;color:var(--yellow);";line.textContent="Supported changes cannot be applied until conflicts are resolved.";card.appendChild(line);
  } else if(metrics.safeApplyCount===0){
    const line=document.createElement("div");line.style.cssText="margin-top:4px;color:var(--muted);";line.textContent="Review only — there are no supported changes to apply.";card.appendChild(line);
  }
  return card;
}

function p954BuildSummaryCard(proposal){
  const card = document.createElement("div");
  card.style.cssText = "background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-top:10px;font-size:12px;line-height:1.6;";
  const s = proposal.summary || {};

  function addRow(label, value){
    if(value === null || value === undefined || value === "") return;
    const row = document.createElement("div");
    row.style.marginBottom = "6px";
    const l = document.createElement("span");
    l.style.cssText = "font-weight:700;color:var(--muted);text-transform:uppercase;font-size:10px;letter-spacing:0.5px;";
    l.textContent = label + ": ";
    const v = document.createElement("span");
    v.style.color = "var(--text)";
    v.textContent = String(value);
    row.appendChild(l);
    row.appendChild(v);
    card.appendChild(row);
  }

  addRow("Recommended Frequency", s.recommendedFrequency ? (s.recommendedFrequency + "/week") : "No specific answer on file");
  addRow("Gym Mode(s)", (s.gymModes && s.gymModes.length) ? s.gymModes.join(", ") : "—");
  addRow("Est. Session Duration", s.estimatedSessionDurationMinutes ? (s.estimatedSessionDurationMinutes + " min") : "—");
  addRow("Affected Day Count", s.affectedDayCount);
  const ac = p955GetDerivedProposalActionCounts(proposal).counts;
  addRow("Action Counts", p955FormatProposalActionCounts(ac));

  if((s.rationale || []).length){
    const rl = document.createElement("div");
    rl.style.marginTop = "8px";
    const rlabel = document.createElement("div");
    rlabel.style.cssText = "font-weight:700;color:var(--muted);text-transform:uppercase;font-size:10px;letter-spacing:0.5px;margin-bottom:4px;";
    rlabel.textContent = "Rationale";
    rl.appendChild(rlabel);
    s.rationale.forEach(function(r){
      const p = document.createElement("div");
      p.style.cssText = "margin-bottom:3px;";
      p.textContent = "• " + r;
      rl.appendChild(p);
    });
    card.appendChild(rl);
  }

  if((proposal.warnings || []).length){
    const wl = document.createElement("div");
    wl.style.marginTop = "8px";
    const wlabel = document.createElement("div");
    wlabel.style.cssText = "font-weight:700;color:var(--red);text-transform:uppercase;font-size:10px;letter-spacing:0.5px;margin-bottom:4px;";
    wlabel.textContent = "Warnings";
    wl.appendChild(wlabel);
    proposal.warnings.forEach(function(w){
      const p = document.createElement("div");
      p.style.cssText = "margin-bottom:3px;color:var(--red);";
      p.textContent = "⚠ " + w;
      wl.appendChild(p);
    });
    card.appendChild(wl);
  }

  const meta = document.createElement("div");
  meta.style.cssText = "margin-top:8px;font-size:10px;color:var(--muted);";
  meta.textContent = "Generated: " + (proposal.generatedAt ? new Date(proposal.generatedAt).toLocaleString() : "—") + " · Status: " + proposal.status + (proposal.status==="draft"||proposal.status==="dismissed"?" · No changes applied to your program.":"");
  card.appendChild(meta);

  return card;
}

// Compact, non-toggling summary shown under the dismissed state. Deliberately
// smaller than p954BuildSummaryCard (no rationale/warnings list) — the full
// detail is only ever a VIEW DISMISSED PROPOSAL tap away, and that view stays
// read-only. Uses textContent only.
function p954BuildDismissedSummary(proposal){
  const card = document.createElement("div");
  card.style.cssText = "background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-top:10px;font-size:12px;line-height:1.6;";
  const s = proposal.summary || {};

  const line1 = document.createElement("div");
  line1.style.cssText = "font-weight:700;color:var(--green);margin-bottom:6px;";
  line1.textContent = "✓ Current program kept";
  card.appendChild(line1);

  const line2 = document.createElement("div");
  line2.style.cssText = "color:var(--muted);margin-bottom:6px;";
  line2.textContent = "Proposal generated: " + (proposal.generatedAt ? new Date(proposal.generatedAt).toLocaleString() : "—")
    + (proposal.dismissedAt ? (" · Dismissed: " + new Date(proposal.dismissedAt).toLocaleString()) : "");
  card.appendChild(line2);

  const ac = p955GetDerivedProposalActionCounts(proposal).counts;
  const line3 = document.createElement("div");
  line3.style.color = "var(--text)";
  line3.textContent = (s.recommendedFrequency ? (s.recommendedFrequency + "/week lifting requested · ") : "")
    + "affected days: " + (s.affectedDayCount || 0)
    + " · " + p955FormatProposalActionCounts(ac);
  card.appendChild(line3);

  return card;
}

// Applied-state summary card: shown when a proposal's supported day-level
// changes have been applied. Read-only reflection of applicationSummary —
// never triggers any write itself. Uses textContent only.
function p954BuildAppliedSummaryCard(proposal){
  const card = document.createElement("div");
  card.style.cssText = "background:var(--surface2);border:1px solid var(--accent);border-radius:10px;padding:12px 14px;margin-top:10px;font-size:12px;line-height:1.6;";
  const s = proposal.applicationSummary || {};

  const line1 = document.createElement("div");
  line1.style.cssText = "font-weight:700;color:var(--accent);margin-bottom:6px;";
  line1.textContent = "✅ Proposal applied";
  card.appendChild(line1);

  const line2 = document.createElement("div");
  line2.style.cssText = "color:var(--muted);margin-bottom:6px;";
  line2.textContent = "Applied: " + (proposal.appliedAt ? new Date(proposal.appliedAt).toLocaleString() : "—");
  card.appendChild(line2);

  const line3 = document.createElement("div");
  line3.style.cssText = "color:var(--text);margin-bottom:6px;";
  line3.textContent = "Modified " + (s.modifyCount||0) + " · Disabled " + (s.disabledCount||0)
    + " · Added " + (s.addedCount||0) + " · Kept " + (s.keepCount||0)
    + " · Skipped (exercise-level, unsupported) " + (s.skippedExerciseActionCount||0);
  card.appendChild(line3);

  const line4 = document.createElement("div");
  line4.style.cssText = "color:var(--muted);font-size:11px;";
  line4.textContent = "Disabled days are hidden, not deleted — history for those days remains fully intact.";
  card.appendChild(line4);

  return card;
}

function p954BuildUndoneSummaryCard(proposal){
  const card=document.createElement("div"),summary=proposal.undoSummary||{};card.style.cssText="background:var(--surface2);border:1px solid var(--green);border-radius:10px;padding:12px 14px;margin-top:10px;font-size:12px;line-height:1.6;";
  const heading=document.createElement("div");heading.style.cssText="font-weight:700;color:var(--green);margin-bottom:6px;";heading.textContent="↩ Proposal changes undone";card.appendChild(heading);
  const applied=document.createElement("div");applied.style.cssText="color:var(--muted);margin-bottom:6px;";applied.textContent="Applied: "+(proposal.appliedAt?new Date(proposal.appliedAt).toLocaleString():"—");card.appendChild(applied);
  const line=document.createElement("div");line.style.cssText="color:var(--muted);";
  const restored=(summary.storageResults||[]).map(function(r){return r.key+" ("+r.action+")";});
  line.textContent="Undone: "+(proposal.undoneAt?new Date(proposal.undoneAt).toLocaleString():"—")+(restored.length?" · "+restored.join(" · "):"");
  card.appendChild(line);
  const history=document.createElement("div");history.style.cssText="color:var(--muted);font-size:11px;margin-top:5px;";history.textContent="Workout logs and history were not deleted or rewritten. This saved record retains the original application audit.";card.appendChild(history);
  return card;
}


// Renders the Program Personalization section in the Sync tab based on
// current proposal state. Never generates a proposal itself — purely reads
// p954GetProposal() and reflects what's there.
function p954RenderProgramPersonalization(){
  const container = document.getElementById("p954Container");
  if(!container) return;
  container.innerHTML = ""; // clears app-authored placeholder only, not user data
  const firstSyncStatus=p957GetSharedUserFirstSyncStatus();
  if(firstSyncStatus.isLikelyFirstSync){
    const note=document.createElement("div");
    note.className="info-box";
    note.style.cssText="font-size:11px;margin-bottom:10px;color:var(--muted);";
    note.textContent="New/shared user detected: use the AI export for a first-time program personalization pass before assuming the default program fits.";
    container.appendChild(note);
  }

  // REQUIREMENT 4 (9.5.4B.1): inspect the RAW stored proposal read-only on
  // every render — including page load, before the user ever taps REVIEW —
  // so a malformed or genuinely invalid stored proposal is never presented
  // as a normal draft/no-proposal record. Never writes storage.
  const inspection = p954InspectStoredProposal();

  if(!inspection.exists){
    p954ReviewInvalid = false;
    p954ReviewInvalidErrors = [];
    const btn = document.createElement("button");
    btn.className = "big-btn btn-sync";
    btn.style.marginBottom = "0";
    btn.textContent = "🧭 GENERATE PROGRAM PROPOSAL";
    btn.onclick = p954HandleGenerateClick;
    container.appendChild(btn);
    const resultEl = document.createElement("div");
    resultEl.className = "sync-result";
    resultEl.id = "p954Result";
    container.appendChild(resultEl);
    return;
  }

  if(!inspection.parses || !inspection.validation.valid){
    p954ReviewInvalid = true;
    p954ReviewInvalidErrors = inspection.validation.errors;
  } else {
    p954ReviewInvalid = false;
    p954ReviewInvalidErrors = [];
  }

  // REQUIREMENT 6: a stored proposal that failed validation gets a dedicated
  // error state instead of draft/dismissed controls — the proposal stays
  // stored untouched (for debugging/regeneration), only regenerate/clear are
  // offered. Do NOT auto-repair or overwrite invalid storage.
  if(p954ReviewInvalid){
    const errBox = document.createElement("div");
    errBox.className = "p954r-error-box";
    const title = document.createElement("div");
    title.style.cssText = "font-weight:700;margin-bottom:6px;";
    title.textContent = "⚠ This stored proposal failed validation and can't be reviewed safely.";
    errBox.appendChild(title);
    (p954ReviewInvalidErrors || []).forEach(function(e){
      const line = document.createElement("div");
      line.textContent = "• " + e;
      errBox.appendChild(line);
    });
    container.appendChild(errBox);

    const errBtnRow = document.createElement("div");
    errBtnRow.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-top:10px;";
    const regenBtn2 = document.createElement("button");
    regenBtn2.className = "big-btn";
    regenBtn2.style.cssText = "background:transparent;color:var(--accent);border:1px solid var(--accent);margin-bottom:0;";
    regenBtn2.textContent = "🔄 REGENERATE PROPOSAL";
    regenBtn2.onclick = p954HandleGenerateClick;
    errBtnRow.appendChild(regenBtn2);
    const clearBtn2 = document.createElement("button");
    clearBtn2.className = "big-btn";
    clearBtn2.style.cssText = "background:transparent;color:var(--red);border:1px solid var(--red);margin-bottom:0;";
    clearBtn2.textContent = "🗑 CLEAR PROPOSAL";
    clearBtn2.onclick = p954HandleClearClick;
    errBtnRow.appendChild(clearBtn2);
    container.appendChild(errBtnRow);

    const errResultEl = document.createElement("div");
    errResultEl.className = "sync-result";
    errResultEl.id = "p954Result";
    container.appendChild(errResultEl);
    return;
  }

  const proposal = inspection.normalized;
  container.appendChild(p955BuildProposalStatusCard(proposal));

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;flex-direction:column;gap:8px;";

  if(proposal.status === "dismissed"){
    // REQUIREMENT 4: dismissed state controls.
    const viewBtn = document.createElement("button");
    viewBtn.className = "big-btn btn-sync";
    viewBtn.style.marginBottom = "0";
    viewBtn.textContent = "👁 VIEW DISMISSED PROPOSAL";
    viewBtn.onclick = p954ROpenReview;
    btnRow.appendChild(viewBtn);

    const genNewBtn = document.createElement("button");
    genNewBtn.className = "big-btn";
    genNewBtn.style.cssText = "background:transparent;color:var(--accent);border:1px solid var(--accent);margin-bottom:0;";
    genNewBtn.textContent = "🧭 GENERATE NEW PROPOSAL";
    genNewBtn.onclick = p954HandleGenerateClick;
    btnRow.appendChild(genNewBtn);

    const clearBtn = document.createElement("button");
    clearBtn.className = "big-btn";
    clearBtn.style.cssText = "background:transparent;color:var(--red);border:1px solid var(--red);margin-bottom:0;";
    clearBtn.textContent = "🗑 CLEAR PROPOSAL";
    clearBtn.onclick = p954HandleClearClick;
    btnRow.appendChild(clearBtn);

    container.appendChild(btnRow);
    container.appendChild(p954BuildDismissedSummary(proposal));
  } else if(proposal.status === "undone"){
    const viewBtn=document.createElement("button");viewBtn.className="big-btn btn-sync";viewBtn.style.marginBottom="0";viewBtn.textContent="👁 VIEW UNDONE PROPOSAL";viewBtn.onclick=p954ROpenReview;btnRow.appendChild(viewBtn);
    const genNewBtn=document.createElement("button");genNewBtn.className="big-btn";genNewBtn.style.cssText="background:transparent;color:var(--accent);border:1px solid var(--accent);margin-bottom:0;";genNewBtn.textContent="🧭 GENERATE NEW PROPOSAL";genNewBtn.onclick=p954HandleGenerateClick;btnRow.appendChild(genNewBtn);
    container.appendChild(btnRow);container.appendChild(p954BuildUndoneSummaryCard(proposal));p954RLastRenderedAppliedSummary=proposal.applicationSummary||null;
  } else if(proposal.status === "applied"){
    // 9.5.4C: applied state controls. No KEEP/APPLY controls here — those
    // only make sense for a draft. Creating a new proposal or clearing this
    // record never undoes the lifecycle changes already applied.
    const viewBtn = document.createElement("button");
    viewBtn.className = "big-btn btn-sync";
    viewBtn.style.marginBottom = "0";
    viewBtn.textContent = "👁 VIEW APPLIED PROPOSAL";
    viewBtn.onclick = p954ROpenReview;
    btnRow.appendChild(viewBtn);

    const undoPlan=p954BuildUndoPlan(proposal);
    const undoBtn=document.createElement("button");
    undoBtn.className="big-btn";
    undoBtn.style.cssText="background:transparent;color:var(--yellow);border:1px solid var(--yellow);margin-bottom:0;";
    undoBtn.textContent="↩ UNDO APPLIED CHANGES";
    undoBtn.disabled=!undoPlan.canUndo;
    undoBtn.onclick=p954RShowUndoPreview;
    btnRow.appendChild(undoBtn);

    const createNewBtn = document.createElement("button");
    createNewBtn.className = "big-btn";
    createNewBtn.style.cssText = "background:transparent;color:var(--accent);border:1px solid var(--accent);margin-bottom:0;";
    createNewBtn.textContent = "🧭 CREATE NEW PROPOSAL";
    createNewBtn.onclick = p954HandleGenerateClick;
    btnRow.appendChild(createNewBtn);

    const clearBtn = document.createElement("button");
    clearBtn.className = "big-btn";
    clearBtn.style.cssText = "background:transparent;color:var(--red);border:1px solid var(--red);margin-bottom:0;";
    clearBtn.textContent = "🗑 CLEAR PROPOSAL";
    clearBtn.onclick = p954HandleClearClick;
    btnRow.appendChild(clearBtn);

    container.appendChild(btnRow);
    container.appendChild(p954BuildAppliedSummaryCard(proposal));
    p954RLastRenderedAppliedSummary = proposal.applicationSummary || null;

    const note = document.createElement("div");
    note.style.cssText = "margin-top:8px;font-size:11px;color:var(--muted);line-height:1.5;";
    note.textContent = undoPlan.canUndo
      ? "Undo restores the exact lifecycle and exercise-override state saved immediately before this proposal was applied. It does not delete or rewrite workout history. This is one saved-proposal reversal, not a general history stack."
      : "Automatic undo is unavailable: " + undoPlan.errors.concat(undoPlan.conflicts).join(" ") + " Workout history remains untouched.";
    container.appendChild(note);
  } else {
    // REQUIREMENT 5: draft (default) state controls. Any legacy/unrecognized
    // status is normalized to "draft" by p954NormalizeProposal before this
    // ever runs, so this branch is the safe default.
    const reviewBtn = document.createElement("button");
    reviewBtn.className = "big-btn btn-sync";
    reviewBtn.style.marginBottom = "0";
    reviewBtn.textContent = "🔍 REVIEW FULL PROPOSAL";
    reviewBtn.onclick = p954ROpenReview;
    btnRow.appendChild(reviewBtn);

    const viewBtn = document.createElement("button");
    viewBtn.className = "big-btn";
    viewBtn.style.cssText = "background:transparent;color:var(--accent);border:1px solid var(--accent);margin-bottom:0;";
    viewBtn.textContent = p954SummaryVisible ? "🙈 HIDE PROPOSAL SUMMARY" : "👁 VIEW PROPOSAL SUMMARY";
    viewBtn.onclick = p954ToggleSummary;
    btnRow.appendChild(viewBtn);

    const regenBtn = document.createElement("button");
    regenBtn.className = "big-btn";
    regenBtn.style.cssText = "background:transparent;color:var(--accent);border:1px solid var(--accent);margin-bottom:0;";
    regenBtn.textContent = "🔄 REGENERATE PROPOSAL";
    regenBtn.onclick = p954HandleGenerateClick;
    btnRow.appendChild(regenBtn);

    const clearBtn = document.createElement("button");
    clearBtn.className = "big-btn";
    clearBtn.style.cssText = "background:transparent;color:var(--red);border:1px solid var(--red);margin-bottom:0;";
    clearBtn.textContent = "🗑 CLEAR PROPOSAL";
    clearBtn.onclick = p954HandleClearClick;
    btnRow.appendChild(clearBtn);

    container.appendChild(btnRow);

    if(p954SummaryVisible){
      container.appendChild(p954BuildSummaryCard(proposal));
    }
  }

  const resultEl = document.createElement("div");
  resultEl.className = "sync-result";
  resultEl.id = "p954Result";
  container.appendChild(resultEl);
}

function p954ToggleSummary(){
  p954SummaryVisible = !p954SummaryVisible;
  p954RenderProgramPersonalization();
}

function p954HandleGenerateClick(){
  p954ReviewInvalid = false;
  p954ReviewInvalidErrors = [];
  if(p954ReviewOpenFlag) p954RCloseReview();
  const result = p954GenerateAndSaveProposal();
  p954SummaryVisible = true;
  p954RenderProgramPersonalization();
  if(result.ok) p954ShowResult("✅ Proposal generated. Nothing has been applied to your program.", "ok");
  else p954ShowResult("❌ Could not generate proposal: " + (result.error || "Unknown error"), "err");
}

function p954HandleClearClick(){
  p954ReviewInvalid = false;
  p954ReviewInvalidErrors = [];
  if(p954ReviewOpenFlag) p954RCloseReview();
  const result = p954ClearProposal();
  p954SummaryVisible = false;
  p954RenderProgramPersonalization();
  if(result.ok) p954ShowResult("Proposal cleared.", "ok");
  else p954ShowResult("❌ Could not clear proposal: " + (result.error || "Unknown error"), "err");
}

// ── PHASE 9.5.4B: DETAILED REVIEW OVERLAY ────────────────────────────────────
// Everything below is strictly read-only with respect to the active workout
// program. The ONLY write path in this whole block is
// p954RConfirmKeepCurrentProgram(), and the only fields it ever changes are
// proposal.status ("dismissed") and proposal.dismissedAt — never P,
// mf-overrides, mf-exercise-state, mf-recommendations, logs, history, day
// overrides/additions, custom exercises, inactive IDs, or replacements.

// Maps a proposal-day-plan action to its visual badge label. Falls back to
// "keep" for any unrecognized value so a badge always renders safely.
function p954RMakeBadge(action){
  const span = document.createElement("span");
  const safeAction = (typeof action === "string" && PROGRAM_PROPOSAL_DAY_ACTIONS.indexOf(action) !== -1) ? action : "keep";
  span.className = "p954r-badge p954r-badge-" + safeAction;
  const labels = { keep:"KEEP", modify:"TWEAK", reorder:"REORDER", replace:"REPLACE", add:"ADD", remove:"REMOVE", optional_add:"OPTIONAL ADD" };
  span.textContent = labels[safeAction] || safeAction.toUpperCase();
  return span;
}

function p955RMakeSafetyBadge(tag, confidence){
  const span=document.createElement("span");
  const safeTag=PROGRAM_PROPOSAL_SAFETY_TAGS.indexOf(tag)!==-1?tag:"source_missing";
  span.className="p954r-badge";
  span.style.cssText="background:var(--surface2);color:var(--muted);border:1px solid var(--border);margin-left:4px;";
  span.textContent=safeTag.replace(/_/g," ").toUpperCase()+(confidence?" · "+String(confidence).toUpperCase():"");
  return span;
}

// Best-effort, read-only extraction of a single free-text rationale line
// (e.g. "Primary goal on file: ...") out of proposal.summary.rationale. The
// builder only stores rationale as prose strings today, so this is a display
// convenience only — it never writes anything back and simply returns null
// if no matching line exists.
function p954RExtractRationaleField(rationale, prefixes){
  if(!Array.isArray(rationale)) return null;
  for(let i = 0; i < rationale.length; i++){
    const r = rationale[i];
    if(typeof r !== "string") continue;
    for(let j = 0; j < prefixes.length; j++){
      const prefix = prefixes[j];
      if(r.indexOf(prefix) === 0){
        let rest = r.slice(prefix.length).trim();
        rest = rest.replace(/\.$/, "");
        rest = rest.replace(/^"(.*)"$/, "$1");
        return rest || null;
      }
    }
  }
  return null;
}

// Read-only lookup of the CURRENT resolved day for a day plan, so the review
// can show real current exercise data next to the proposal's description.
// Virtual/optional_add day plans have no current day to resolve — returns
// null for those, never throws.
function p954RGetCurrentDayForPlan(dp){
  try {
    if(!dp || dp.isVirtual) return null;
    const days = getResolvedDays(dp.gymKey);
    const match = days.find(function(d){ return d._dayIdx === dp.dayIdx; });
    return match || null;
  } catch(e){
    return null;
  }
}

// The builder currently records duplicate-exercise findings as a prose tweak
// string ("Remove duplicate active exercise \"X\" (keep the first
// occurrence)."), not as structured per-exercise proposal data. This helper
// extracts just the exercise name(s) so the exercise-level rows below can
// render a real REMOVE badge on the later occurrence — read-only, never
// mutates the day plan or tweaks array.
function p954RExtractDuplicateNamesFromTweaks(tweaks){
  const set = new Set();
  if(!Array.isArray(tweaks)) return set;
  const re = /Remove duplicate active exercise "([^"]+)"/;
  tweaks.forEach(function(t){
    if(typeof t !== "string") return;
    const m = re.exec(t);
    if(m && m[1]) set.add(m[1]);
  });
  return set;
}

// Renders one current exercise row. `seenDupeNames` tracks which duplicate
// names have already been shown once (KEEP) within this day, so only the
// later occurrence(s) get the REMOVE badge — matching the builder's own
// "keep the first occurrence" language. All text uses textContent.
function p954RBuildExerciseRow(ex, dupeNames, seenDupeNames){
  const row = document.createElement("div");
  row.className = "p954r-ex-row";

  const name = ex && typeof ex.name === "string" ? ex.name : "";
  let action = "keep";
  if(name && dupeNames && dupeNames.has(name)){
    if(seenDupeNames[name]) action = "remove";
    else seenDupeNames[name] = true;
  }

  const nameLine = document.createElement("div");
  nameLine.className = "p954r-ex-name";
  nameLine.appendChild(p954RMakeBadge(action));
  const nameText = document.createElement("span");
  nameText.textContent = name || "(unnamed exercise)";
  nameLine.appendChild(nameText);
  row.appendChild(nameLine);

  const metaLine = document.createElement("div");
  metaLine.className = "p954r-ex-meta";
  const parts = [];
  if(ex && ex.sets !== undefined && ex.sets !== null && ex.sets !== "") parts.push("Sets: " + ex.sets);
  if(ex && ex.reps !== undefined && ex.reps !== null && ex.reps !== "") parts.push("Reps: " + ex.reps);
  if(ex && ex.load !== undefined && ex.load !== null && ex.load !== "") parts.push("Load: " + ex.load);
  if(ex && ex.rir !== undefined && ex.rir !== null && ex.rir !== "") parts.push("RIR: " + ex.rir);
  metaLine.textContent = parts.length ? parts.join(" · ") : "—";
  row.appendChild(metaLine);

  if(action === "remove"){
    const rationale = document.createElement("div");
    rationale.className = "p954r-ex-rationale";
    rationale.textContent = "Duplicate active exercise on this day — proposal suggests removing this later occurrence and keeping the first.";
    row.appendChild(rationale);
  }

  return row;
}

// Builds one day card: gym-agnostic (gym grouping happens one level up),
// current vs proposed day name, role/focus meta, day-level rationale
// (notes), and every current exercise on that day (or a clear empty note for
// not-yet-created optional/virtual days). Returns {el, exerciseCount} so the
// caller can accumulate debug counts without a second DOM walk.
function p954RBuildDayCard(dp, appliedOpType, exerciseStatuses){
  const card = document.createElement("div");
  card.className = "p954r-day-card";

  const currentDay = p954RGetCurrentDayForPlan(dp);
  const currentName = currentDay ? (currentDay.name || currentDay.day || "") : null;

  const head = document.createElement("div");
  head.className = "p954r-day-head";
  const nameWrap = document.createElement("div");
  const nameEl = document.createElement("div");
  nameEl.className = "p954r-day-name";
  nameEl.textContent = "Day " + (dp.dayIdx + 1) + (currentName ? (": " + currentName) : (": " + dp.dayName));
  nameWrap.appendChild(nameEl);
  if(currentName && dp.dayName && currentName !== dp.dayName){
    const propNameEl = document.createElement("div");
    propNameEl.className = "p954r-day-name-proposed";
    propNameEl.textContent = "Proposed name: " + dp.dayName;
    nameWrap.appendChild(propNameEl);
  }
  head.appendChild(nameWrap);
  head.appendChild(p954RMakeBadge(dp.action));
  head.appendChild(p955RMakeSafetyBadge(dp.safetyTag, dp.confidence));
  // 9.5.4D: show day-write state alongside structured exercise results;
  // replace/add/remove/reactivate remain deferred.
  if(appliedOpType){
    const tag = document.createElement("span");
    const wasWritten = (appliedOpType === "dayOverride" || appliedOpType === "disable" || appliedOpType === "dayAddition");
    tag.className = "p954r-applied-tag " + (wasWritten ? "yes" : "no");
    tag.textContent = wasWritten ? "✓ APPLIED" : "NOT APPLIED — DEFERRED";
    head.appendChild(tag);
  }
  card.appendChild(head);

  const meta = document.createElement("div");
  meta.className = "p954r-day-meta";
  const roleLabel = (typeof dp.role === "string" && dp.role) ? (dp.role.charAt(0).toUpperCase() + dp.role.slice(1)) : "Optional";
  const focusText = (currentDay && typeof currentDay.focus === "string") ? currentDay.focus : "";
  meta.textContent = "Role: " + roleLabel
    + (focusText ? (" · Focus: " + focusText) : "")
    + (dp.isVirtual ? " · Not created yet — describes a possibility only" : "");
  card.appendChild(meta);

  if(dp.notes){
    const note = document.createElement("div");
    note.className = "p954r-note";
    note.textContent = dp.notes;
    card.appendChild(note);
  }
  if(dp.rationale && dp.rationale !== dp.notes){
    const reason = document.createElement("div");
    reason.className = "p954r-note";
    reason.textContent = "Why: " + dp.rationale;
    card.appendChild(reason);
  }

  let exerciseCount = 0;
  const dupeNames = p954RExtractDuplicateNamesFromTweaks(dp.tweaks);
  if(currentDay && Array.isArray(currentDay.exercises) && currentDay.exercises.length){
    const seenDupeNames = {};
    currentDay.exercises.forEach(function(ex){
      exerciseCount++;
      card.appendChild(p954RBuildExerciseRow(ex, dupeNames, seenDupeNames));
    });
  } else if(dp.isVirtual){
    const empty = document.createElement("div");
    empty.className = "p954r-empty-note";
    empty.textContent = "This day doesn't exist yet — no exercises to preview.";
    card.appendChild(empty);
  } else if(Array.isArray(dp.tweaks) && dp.tweaks.length){
    dp.tweaks.forEach(function(t){
      const item = document.createElement("div");
      item.className = "p954r-list-item";
      item.textContent = t;
      card.appendChild(item);
    });
  } else {
    const empty = document.createElement("div");
    empty.className = "p954r-empty-note";
    empty.textContent = "No exercises found for this day.";
    card.appendChild(empty);
  }

  const exactExerciseById = {};
  if(currentDay && Array.isArray(currentDay.exercises)) currentDay.exercises.forEach(function(ex){ exactExerciseById[ex.id] = ex; });
  if(Array.isArray(dp.proposedExerciseOrder)){
    const order=document.createElement("div"); order.className="p954r-list-item";
    const orderStatus=exerciseStatuses&&exerciseStatuses.order;
    const resolvedOrder=dp.proposedExerciseOrder.map(function(id){
      const ex=exactExerciseById[id];
      return (ex ? getF(id,"name",ex.name) : "Unresolved") + " [" + id + "]";
    });
    order.textContent="Proposed exercise order: "+resolvedOrder.join(" → ")+(orderStatus?" · Status: "+orderStatus:""); card.appendChild(order);
  }
  (dp.exerciseActions||[]).forEach(function(ea){
    const row=document.createElement("div"); row.className="p954r-list-item";
    const resolved=ea.exerciseId ? exactExerciseById[ea.exerciseId] : null;
    let status="Skipped / Deferred";
    if(ea.action==="keep") status="Unchanged";
    else if(ea.action==="modify") status=(exerciseStatuses&&exerciseStatuses.actions&&exerciseStatuses.actions[ea.exerciseId])||"Pending validation";
    function detail(label,value){
      const line=document.createElement("div"); line.className="p954r-ex-meta";
      line.textContent=label+": "+String(value); row.appendChild(line);
    }
    detail("Exercise",resolved ? getF(ea.exerciseId,"name",resolved.name) : (ea.exerciseId ? "Unresolved" : "New exercise proposal"));
    detail("Stable ID",ea.exerciseId||"None (deferred add)");
    detail("Action",ea.action||"keep");
    detail("Safety",String(ea.safetyTag||"source_missing").replace(/_/g," ") + (ea.confidence ? " · " + ea.confidence : ""));
    Object.keys(ea.fields||{}).forEach(function(field){ detail("Proposed "+field,p954Value(ea.fields[field])); });
    detail("Rationale",ea.rationale||"None provided");
    detail("Status",status);
    card.appendChild(row);
  });
  return { el: card, exerciseCount: exerciseCount };
}

// Builds the full detailed review body for a validated proposal: top summary
// (REQUIREMENT 1's first list), rationale, warnings, then every day plan
// grouped by gym mode with per-exercise detail. Updates the debug counters
// (p954RLastRendered*) as a side effect — read-only otherwise.
function p954RBuildReviewContent(proposal){
  const frag = document.createDocumentFragment();
  const s = proposal.summary || {};

  function addRow(parent, label, value){
    if(value === null || value === undefined || value === "") return;
    const row = document.createElement("div");
    row.className = "p954r-row";
    const l = document.createElement("span");
    l.className = "p954r-row-label";
    l.textContent = label;
    const v = document.createElement("span");
    v.className = "p954r-row-value";
    v.textContent = String(value);
    row.appendChild(l);
    row.appendChild(v);
    parent.appendChild(row);
  }

  const sumSection = document.createElement("div");
  sumSection.className = "p954r-section";
  const sumTitle = document.createElement("div");
  sumTitle.className = "p954r-section-title";
  sumTitle.textContent = "Summary";
  sumSection.appendChild(sumTitle);

  addRow(sumSection, "Status", proposal.status);
  addRow(sumSection, "Generated", proposal.generatedAt ? new Date(proposal.generatedAt).toLocaleString() : "—");
  if(proposal.appliedAt)addRow(sumSection,"Applied",new Date(proposal.appliedAt).toLocaleString());
  if(proposal.undoneAt)addRow(sumSection,"Undone",new Date(proposal.undoneAt).toLocaleString());
  addRow(sumSection, "Recommended lifting frequency", s.recommendedFrequency ? (s.recommendedFrequency + "/week") : "No specific answer on file");
  const clc = s.currentLiftingDayCounts || {};
  const clcKeys = Object.keys(clc);
  if(clcKeys.length){
    addRow(sumSection, "Current lifting days by gym mode", clcKeys.map(function(k){ return k + ": " + clc[k]; }).join(" · "));
  }
  addRow(sumSection, "Gym mode(s) included", (s.gymModes && s.gymModes.length) ? s.gymModes.join(", ") : "—");
  addRow(sumSection, "Est. session duration", s.estimatedSessionDurationMinutes ? (s.estimatedSessionDurationMinutes + " min") : "—");
  const primaryGoal = p954RExtractRationaleField(s.rationale, ["Primary goal on file:", "Primary goal on file (from profile):"]);
  addRow(sumSection, "Primary goal", primaryGoal || "No specific answer on file");
  addRow(sumSection, "Affected day count", s.affectedDayCount);
  const ac = p955GetDerivedProposalActionCounts(proposal).counts;
  addRow(sumSection, "Action counts", p955FormatProposalActionCounts(ac));
  const reviewMetrics=p955GetProposalQualityMetrics(proposal),reviewUndo=p954BuildUndoPlan(proposal);
  addRow(sumSection,"Apply readiness",reviewMetrics.safeApplyCount+" supported · "+reviewMetrics.deferredCount+" deferred · "+reviewMetrics.conflictCount+" conflicts · "+reviewMetrics.warningCount+" warnings");
  addRow(sumSection,"Undo",proposal.status==="undone"?"Already undone; repeat is a no-write no-op":reviewUndo.canUndo?"Available":"Not available");
  frag.appendChild(sumSection);

  const sourceSection=document.createElement("div"),sourceTitle=document.createElement("div"),ss=proposal.sourceSummary||{},metrics=p955GetProposalQualityMetrics(proposal);
  sourceSection.className="p954r-section";sourceTitle.className="p954r-section-title";sourceTitle.textContent="Proposal Source";sourceSection.appendChild(sourceTitle);
  addRow(sourceSection,"Source type",proposal.sourceType==="fixture"?"Developer fixture / test":proposal.sourceType==="local_generated"?"Local generation from current app data":"Legacy / source details missing");
  addRow(sourceSection,"Engine",ss.proposalEngineVersion||"Not recorded");
  addRow(sourceSection,"Coverage",metrics.sourceCoverageCount+"/"+metrics.sourceCoverageTotal+" source groups used");
  addRow(sourceSection,"Profile",ss.profileUsed?"Used"+(ss.profileFields&&ss.profileFields.length?" ("+ss.profileFields.join(", ")+")":""):"Missing or empty");
  addRow(sourceSection,"Onboarding",ss.onboardingUsed?"Used"+(ss.onboardingSections&&ss.onboardingSections.length?" ("+ss.onboardingSections.join(", ")+")":""):"Missing or empty");
  addRow(sourceSection,"Coaching preferences",ss.coachingPrefsUsed?"Used":"Missing or empty");
  addRow(sourceSection,"Resolved program",ss.currentProgramUsed?"Used":"Missing or empty");
  addRow(sourceSection,"Lifecycle / overrides",ss.lifecycleUsed?"Used"+(ss.lifecycleSignals&&ss.lifecycleSignals.length?" ("+ss.lifecycleSignals.join(", ")+")":""):"No custom state present");
  addRow(sourceSection,"Recent logs",ss.recentLogsUsed?"Used":"Not used by this rule set");
  (ss.sourceWarnings||[]).forEach(function(w){const item=document.createElement("div");item.className="p954r-list-item warn";item.textContent="⚠ "+w;sourceSection.appendChild(item);});
  frag.appendChild(sourceSection);

  if((s.rationale || []).length){
    const rSection = document.createElement("div");
    rSection.className = "p954r-section";
    const rTitle = document.createElement("div");
    rTitle.className = "p954r-section-title";
    rTitle.textContent = "Rationale";
    rSection.appendChild(rTitle);
    s.rationale.forEach(function(r){
      const item = document.createElement("div");
      item.className = "p954r-list-item";
      item.textContent = r;
      rSection.appendChild(item);
    });
    frag.appendChild(rSection);
  }

  if((proposal.warnings || []).length){
    const wSection = document.createElement("div");
    wSection.className = "p954r-section";
    const wTitle = document.createElement("div");
    wTitle.className = "p954r-section-title";
    wTitle.textContent = "Warnings";
    wSection.appendChild(wTitle);
    proposal.warnings.forEach(function(w){
      const item = document.createElement("div");
      item.className = "p954r-list-item warn";
      item.textContent = "⚠ " + w;
      wSection.appendChild(item);
    });
    frag.appendChild(wSection);
  }

  const dayPlans = Array.isArray(proposal.dayPlans) ? proposal.dayPlans.slice() : [];
  const gymGroups = {};
  const gymOrder = [];
  dayPlans.forEach(function(dp){
    if(!gymGroups[dp.gymKey]){ gymGroups[dp.gymKey] = []; gymOrder.push(dp.gymKey); }
    gymGroups[dp.gymKey].push(dp);
  });

  // 9.5.4D: read applied day, reorder, and metadata results; unsupported
  // replace/add/remove/reactivate actions remain deferred. Read-only.
  let appliedOpsByKey = null;
  let appliedExerciseStatuses = {};
  if(proposal.status === "applied" || proposal.status === "undone"){
    appliedOpsByKey = {};
    const appSummary=proposal.applicationSummary||{};
    (appSummary.reorderResults||[]).forEach(function(r){const k=r.gymKey+"|"+r.dayIdx;appliedExerciseStatuses[k]=appliedExerciseStatuses[k]||{actions:{}};appliedExerciseStatuses[k].order=r.status;});
    (appSummary.exerciseActionResults||[]).forEach(function(r){const k=r.gymKey+"|"+r.dayIdx;appliedExerciseStatuses[k]=appliedExerciseStatuses[k]||{actions:{}};appliedExerciseStatuses[k].actions[r.exerciseId]=r.status;});
    try {
      const plan = p954BuildApplicationPlan(proposal);
      (plan.ops || []).forEach(function(op){
        appliedOpsByKey[op.gymKey + "|" + op.dayIdx] = op.type;
      });
    } catch(e){ appliedOpsByKey = {}; }
  }

  let renderedDayCount = 0;
  let renderedExerciseCount = 0;

  gymOrder.forEach(function(gymKey){
    const header = document.createElement("div");
    header.className = "p954r-gym-header";
    header.textContent = gymKey.toUpperCase() + " — day by day";
    frag.appendChild(header);

    const plans = gymGroups[gymKey].slice().sort(function(a, b){ return a.dayIdx - b.dayIdx; });
    plans.forEach(function(dp){
      renderedDayCount++;
      const appliedOpType = appliedOpsByKey ? appliedOpsByKey[dp.gymKey + "|" + dp.dayIdx] : undefined;
      const built = p954RBuildDayCard(dp, appliedOpType, appliedExerciseStatuses[dp.gymKey + "|" + dp.dayIdx]);
      renderedExerciseCount += built.exerciseCount;
      frag.appendChild(built.el);
    });
  });

  if(!gymOrder.length){
    const empty = document.createElement("div");
    empty.className = "p954r-empty-note";
    empty.textContent = "No day plans in this proposal.";
    frag.appendChild(empty);
  }

  p954RLastRenderedGymGroups = gymOrder.length;
  p954RLastRenderedDayCount = renderedDayCount;
  p954RLastRenderedExerciseCount = renderedExerciseCount;

  return frag;
}

// Opens the detailed review. REQUIREMENT 6: validates the stored proposal
// first — on failure, switches Program Personalization into the error state
// (via p954RenderProgramPersonalization) instead of rendering a misleading
// review, and never opens the overlay. On success, clears any prior error
// state and (re)builds the review body fresh each time — body.innerHTML is
// reset first, so repeated opens never duplicate DOM (REQUIREMENT 10).
function p954ROpenReview(){
  try {
    // REQUIREMENT 3 (9.5.4B.1): inspect the RAW stored proposal — not the
    // already-normalized/repaired one — so an invalid stored record can't be
    // silently repaired before we decide whether it's safe to review.
    const inspection = p954InspectStoredProposal();
    if(!inspection.exists){
      p954ReviewInvalid = true;
      p954ReviewInvalidErrors = ["No proposal found to review."];
      p954RenderProgramPersonalization();
      return;
    }
    if(!inspection.parses || !inspection.validation.valid){
      p954ReviewInvalid = true;
      p954ReviewInvalidErrors = inspection.validation.errors;
      p954RenderProgramPersonalization();
      return;
    }
    p954ReviewInvalid = false;
    p954ReviewInvalidErrors = [];

    // Raw proposal is genuinely valid — safe to render the normalized read
    // model (fills in expected legacy omissions like role/frequency/counts).
    const proposal = inspection.normalized;

    const overlay = document.getElementById("p954ReviewOverlay");
    const body = document.getElementById("p954ReviewBody");
    if(!overlay || !body) return;
    body.innerHTML = ""; // safe: clears only app-authored review DOM, rebuilt below
    body.appendChild(p954RBuildReviewContent(proposal));

    const title = document.getElementById("p954ReviewTitle");
    if(title) title.textContent = (proposal.status === "applied") ? "Applied Proposal (read-only)" : (proposal.status === "undone") ? "Undone Proposal (read-only)" : (proposal.status === "dismissed") ? "Dismissed Proposal (read-only)" : "Proposal Review";

    // 9.5.4C: the applied review overlay is read-only — no APPLY or KEEP
    // controls. APPLY is also hidden for dismissed proposals (nothing to
    // apply); KEEP stays available for dismissed, matching prior 9.5.4B
    // behavior (idempotent no-op there).
    const applyBtn = document.getElementById("p954ApplyBtn");
    const keepBtn = document.getElementById("p954KeepBtn");
    if(applyBtn){const readiness=p955GetProposalQualityMetrics(proposal);applyBtn.style.display=(proposal.status==="draft")?"":"none";applyBtn.disabled=proposal.status!=="draft"||readiness.safeApplyCount===0||readiness.conflictCount>0;applyBtn.textContent=readiness.safeApplyCount===0?"NO SUPPORTED CHANGES TO APPLY":readiness.conflictCount>0?"APPLY BLOCKED — RESOLVE CONFLICTS":"APPLY "+readiness.safeApplyCount+" SUPPORTED CHANGE"+(readiness.safeApplyCount===1?"":"S");}
    if(keepBtn) keepBtn.style.display = (proposal.status === "applied" || proposal.status === "undone") ? "none" : "";

    overlay.classList.add("open");
    document.documentElement.style.overflow = "hidden";
    p954ReviewOpenFlag = true;
  } catch(e){
    console.warn("[MarcusFit] p954ROpenReview failed:", e && e.message);
  }
}

// CLOSE / REVIEW LATER: closes the overlay, restores page scroll, and
// performs NO writes of any kind — the proposal (and its status) is left
// exactly as it was.
function p954RCloseReview(){
  const overlay = document.getElementById("p954ReviewOverlay");
  if(overlay) overlay.classList.remove("open");
  document.documentElement.style.overflow = "";
  p954ReviewOpenFlag = false;
}

// Opens the custom (non-native) KEEP CURRENT PROGRAM confirmation panel.
function p954RShowKeepConfirm(){
  const errEl = document.getElementById("p954ConfirmError");
  if(errEl){ errEl.style.display = "none"; errEl.textContent = ""; }
  const backdrop = document.getElementById("p954ConfirmBackdrop");
  if(backdrop) backdrop.classList.add("open");
}

// Canceling leaves the proposal draft completely unchanged — this only
// closes the confirmation panel.
function p954RCancelKeepConfirm(){
  const backdrop = document.getElementById("p954ConfirmBackdrop");
  if(backdrop) backdrop.classList.remove("open");
}

// KEEP CURRENT PROGRAM, confirmed. 9.5.4B.2: re-inspects the RAW stored
// proposal (not the normalizing getter) immediately before dismissal, so
// storage that was altered or corrupted after the review opened can't be
// silently repaired and then saved as dismissed. Absent, malformed-JSON, and
// raw-invalid proposals all keep the review/confirmation open with an error
// and never write. Only once the raw proposal is confirmed genuinely valid
// does this proceed, using inspection.normalized as the working proposal.
// REQUIREMENT 10: idempotent — if already dismissed, this closes out safely
// without bumping dismissedAt again or writing anything. Never touches the
// active workout program.
function p954RConfirmKeepCurrentProgram(){
  const backdrop = document.getElementById("p954ConfirmBackdrop");
  const errEl = document.getElementById("p954ConfirmError");
  try {
    const inspection = p954InspectStoredProposal();

    if(!inspection.exists){
      if(errEl){ errEl.style.display = "block"; errEl.textContent = "No proposal found — there's nothing to dismiss."; }
      return; // keep confirm + review open, no write
    }
    if(!inspection.parses){
      if(errEl){ errEl.style.display = "block"; errEl.textContent = "The stored proposal is corrupted and can't be dismissed safely. Please regenerate or clear it."; }
      return; // keep confirm + review open, no write
    }
    if(!inspection.validation.valid){
      if(errEl){ errEl.style.display = "block"; errEl.textContent = "The stored proposal failed validation and can't be dismissed safely. Please regenerate or clear it."; }
      return; // keep confirm + review open, no write
    }

    const proposal = inspection.normalized;

    if(proposal.status !== "draft" && proposal.status !== "dismissed"){
      if(errEl){ errEl.style.display = "block"; errEl.textContent = "This proposal is not in a state that can be dismissed right now."; }
      return;
    }

    if(proposal.status === "dismissed"){
      // Already dismissed — idempotent no-op write, just close out.
      if(backdrop) backdrop.classList.remove("open");
      p954RCloseReview();
      p954RenderProgramPersonalization();
      return;
    }

    proposal.status = "dismissed";
    proposal.dismissedAt = new Date().toISOString();
    const result = p954SaveProposal(proposal);
    if(!result.ok){
      if(errEl){ errEl.style.display = "block"; errEl.textContent = "Could not save: " + (result.error || "Unknown error") + ". Nothing has changed — please try again."; }
      return; // keep confirm + review open per REQUIREMENT 6
    }

    if(backdrop) backdrop.classList.remove("open");
    p954RCloseReview();
    p954RenderProgramPersonalization();
    p954ShowResult("Current program kept. Proposal dismissed — no program changes were made.", "ok");
  } catch(e){
    console.warn("[MarcusFit] p954RConfirmKeepCurrentProgram failed:", e && e.message);
    if(errEl){ errEl.style.display = "block"; errEl.textContent = "Unexpected error — the proposal has not been changed."; }
  }
}

// ── 9.5.4D: APPLY DAY + SAFE EXERCISE CHANGES preview/confirm panel ──────────
// Everything here is read-only until CONFIRM APPLY SUPPORTED CHANGES is
// tapped — opening or cancelling the preview never writes anything.

// Builds the preview body: action counts, the exact day-level writes that
// will occur, the exercise-level skip count, and required warnings. Pure
// read-only render — uses textContent/safe DOM only.
function p954RBuildApplyPreviewContent(proposal,plan,live){
  const frag=document.createDocumentFragment();
  function section(title,items,render){const box=document.createElement("div");box.className="p954ap-section";const h=document.createElement("div");h.className="p954ap-section-title";h.textContent=title;box.appendChild(h);if(!items.length){const n=document.createElement("div");n.className="p954r-empty-note";n.textContent="None";box.appendChild(n);}else items.forEach(function(x){const row=document.createElement("div");row.className="p954ap-write-item";row.textContent=render(x);box.appendChild(row);});frag.appendChild(box);}
  const notice=document.createElement("div");notice.className="p954ap-notice";notice.textContent="Day metadata, exercise order, and metadata-only exercise tweaks can be applied safely. Optional add/remove and exercise lifecycle changes stay deferred. Stable IDs, the base program, and workout history remain protected.";frag.appendChild(notice);
  section("Day-level writes",plan.ops.filter(function(o){return ["dayOverride","disable","dayAddition"].indexOf(o.type)>=0;}),function(o){return o.gymKey.toUpperCase()+" Day "+(o.dayIdx+1)+": "+o.type;});
  section("Deferred day lifecycle ideas",plan.ops.filter(function(o){return o.type==="skip_deferred_lifecycle";}),function(o){return o.gymKey.toUpperCase()+" Day "+(o.dayIdx+1)+" · "+o.dp.action.replace(/_/g," ")+" · Skipped / Deferred";});
  section("Exercise reorder writes",plan.ops.filter(function(o){return o.type==="orderOverride";}),function(o){const day=getResolvedDays(o.gymKey).find(function(d){return d._dayIdx===o.dayIdx;}),names={};(day&&day.exercises||[]).forEach(function(e){names[e.id]=getF(e.id,"name",e.name);});return o.gymKey.toUpperCase()+" Day "+(o.dayIdx+1)+" — "+o.order.map(function(id){return (names[id]||"Unknown")+" ["+id+"]";}).join(" → ")+" — "+(o.conflict?"Conflict":o.writeNeeded?"Will apply":"Unchanged");});
  section("Exercise metadata writes",plan.ops.filter(function(o){return o.type==="exerciseOverride";}),function(o){const day=getResolvedDays(o.gymKey).find(function(d){return d._dayIdx===o.dayIdx;}),ex=day&&(day.exercises||[]).find(function(e){return e.id===o.exerciseId;}),name=ex?getF(ex.id,"name",ex.name):"Unknown";return Object.keys(o.fields).map(function(f){const st=o.fieldStates[f];return name+" ["+o.exerciseId+"] · "+f+": "+p954Value(st.current)+" → "+p954Value(st.proposed)+" · "+(st.conflict?"Conflict":st.writeNeeded?"Will apply":"Unchanged");}).join(" | ");});
  [["Deferred replacements","replace"],["Deferred additions","add"],["Deferred removals","remove"],["Deferred reactivations","reactivate"]].forEach(function(pair){section(pair[0],plan.deferred[pair[1]],function(x){return x.gymKey.toUpperCase()+" Day "+(x.dayIdx+1)+" · "+(x.exerciseAction.exerciseId||"new exercise")+" · Skipped / Deferred";});});
  section("Conflicts and validation errors",(plan.errors||[]).concat((live&&live.errors)||[]),function(e){return "⚠ "+e;});
  return frag;
}


function p954RSetApplyConfirmDisabled(disabled){
  const button=document.getElementById("p954ApplyConfirmBtn");
  if(button) button.disabled=!!disabled;
}

// Opens the preview. Re-inspects the RAW stored proposal (never trusts the
// currently-rendered review) so a proposal that changed/corrupted after the
// review opened can't produce a misleading preview. Makes no writes.
function p954RShowApplyPreview(){
  p954RSetApplyConfirmDisabled(true);
  const errEl = document.getElementById("p954ApplyError");
  if(errEl){ errEl.style.display = "none"; errEl.textContent = ""; }
  try {
    const inspection = p954InspectStoredProposal();
    if(!inspection.exists || !inspection.parses || !inspection.validation.valid){
      if(errEl){ errEl.style.display = "block"; errEl.textContent = "This proposal can't be applied right now — it failed validation. Please regenerate or clear it."; }
      const backdrop = document.getElementById("p954ApplyPreviewBackdrop");
      if(backdrop) backdrop.classList.add("open");
      p954ApplyPreviewOpenFlag = true;
      return;
    }
    const proposal = inspection.normalized;
    if(proposal.status !== "draft"){
      if(errEl){ errEl.style.display = "block"; errEl.textContent = "This proposal is not in a state that can be applied right now (status: " + proposal.status + ")."; }
      const backdrop = document.getElementById("p954ApplyPreviewBackdrop");
      if(backdrop) backdrop.classList.add("open");
      p954ApplyPreviewOpenFlag = true;
      return;
    }

    const plan = p954BuildApplicationPlan(proposal);
    const liveValidation = p954ValidatePlanAgainstLiveState(plan, p954GenerateApplicationId(proposal));
    p954LastLiveValidationErrors = liveValidation.errors.slice();
    p954ApplyFingerprint = p954ComputeProposalFingerprint(proposal);
    const readiness=p955GetProposalQualityMetrics(proposal);
    p954RSetApplyConfirmDisabled(!plan.valid || !liveValidation.valid || readiness.safeApplyCount===0 || readiness.conflictCount>0);

    const body = document.getElementById("p954ApplyPreviewBody");
    if(body){
      body.innerHTML = "";
      body.appendChild(p954RBuildApplyPreviewContent(proposal, plan, liveValidation));
    }
    const backdrop = document.getElementById("p954ApplyPreviewBackdrop");
    if(backdrop) backdrop.classList.add("open");
    p954ApplyPreviewOpenFlag = true;
  } catch(e){
    p954RSetApplyConfirmDisabled(true);
    console.warn("[MarcusFit] p954RShowApplyPreview failed:", e && e.message);
    if(errEl){ errEl.style.display = "block"; errEl.textContent = "Unexpected error building the preview — nothing has changed."; }
  }
}

// Cancels the preview. Makes no writes of any kind.
function p954RCancelApplyPreview(){
  const backdrop = document.getElementById("p954ApplyPreviewBackdrop");
  if(backdrop) backdrop.classList.remove("open");
  p954ApplyPreviewOpenFlag = false;
  p954ApplyFingerprint = null;
}

// CONFIRM APPLY SUPPORTED CHANGES. The single atomic 9.5.4D write path —
// delegates entirely to p954ApplyProposal() (full re-validation, snapshot,
// atomic writes, rollback-on-failure). On success, closes both panels and
// re-renders the applied state; on failure, keeps the preview open with a
// clear error and leaves storage untouched.
function p954RConfirmApplyPreview(){
  const errEl = document.getElementById("p954ApplyError");
  try {
    // Defensive console/direct-call gate: never rely only on the button's
    // disabled state. Re-read, rebuild, and revalidate before calling the
    // transactional writer.
    const inspection=p954InspectStoredProposal();
    if(!inspection.exists||!inspection.parses||!inspection.validation.valid||!inspection.normalized||inspection.normalized.status!=="draft"){
      p954RSetApplyConfirmDisabled(true);
      if(errEl){errEl.style.display="block";errEl.textContent="Cannot apply: the stored proposal is missing, invalid, or not a draft.";}
      return;
    }
    const preflightPlan=p954BuildApplicationPlan(inspection.normalized);
    const preflightLive=p954ValidatePlanAgainstLiveState(preflightPlan,p954GenerateApplicationId(inspection.normalized));
    p954LastLiveValidationErrors=preflightLive.errors.slice();
    if(!preflightPlan.valid||!preflightLive.valid){
      p954RSetApplyConfirmDisabled(true);
      if(errEl){errEl.style.display="block";errEl.textContent="Cannot apply safely: "+preflightPlan.errors.concat(preflightLive.errors).join(" ");}
      return;
    }
    p954RSetApplyConfirmDisabled(false);
    const result = p954ApplyProposal(p954ApplyFingerprint);
    if(!result.ok){
      if(errEl){ errEl.style.display = "block"; errEl.textContent = result.error || "Could not apply — nothing has changed."; }
      return; // keep preview + review open, storage untouched
    }
    const backdrop = document.getElementById("p954ApplyPreviewBackdrop");
    if(backdrop) backdrop.classList.remove("open");
    p954ApplyPreviewOpenFlag = false;
    p954ApplyFingerprint = null;
    p954RCloseReview();
    p954RenderProgramPersonalization();
    // Re-render dependent surfaces immediately so disabled days disappear
    // and any new virtual day shows up without needing a manual refresh.
    try { if(typeof renderProgram === "function") renderProgram(); } catch(e){}
    try { if(typeof populateWoDaySelect === "function") populateWoDaySelect(); } catch(e){}
    p954ShowResult(result.alreadyApplied ? "This proposal was already applied — nothing changed." : "✅ Supported day metadata, exercise reorder, and metadata tweaks applied. Optional add/remove and exercise replace/add/remove/reactivate remain deferred.", "ok");
  } catch(e){
    console.warn("[MarcusFit] p954RConfirmApplyPreview failed:", e && e.message);
    if(errEl){ errEl.style.display = "block"; errEl.textContent = "Unexpected error — nothing has changed."; }
  }
}
// ── END 9.5.4D APPLY SUPPORTED CHANGES PREVIEW/CONFIRM PANEL ─────────────────

function p954RSetUndoConfirmDisabled(disabled){
  const button=document.getElementById("p954UndoConfirmBtn");if(button)button.disabled=!!disabled;
}

function p954RBuildUndoPreviewContent(plan){
  const frag=document.createDocumentFragment();
  const notice=document.createElement("div");notice.className="p954ap-notice";notice.textContent=plan.facts.restorationScope==="proposal-affected-paths"?"MarcusFit will restore only the lifecycle and override paths written by this proposal. Unrelated edits remain. Workout logs and history are not deleted or rewritten.":"This legacy proposal has no path-level history, so undo can proceed only when the original whole storage state still matches.";frag.appendChild(notice);
  const safety=document.createElement("div");safety.className="p954ap-section";const safetyTitle=document.createElement("div");safetyTitle.className="p954ap-section-title";safetyTitle.textContent="Current safety status";safety.appendChild(safetyTitle);const safetyLine=document.createElement("div");safetyLine.className="p954ap-write-item";safetyLine.textContent=plan.canUndo?"Safe to undo — both touched storage areas still match this application.":"Blocked — automatic undo would risk overwriting newer work.";safety.appendChild(safetyLine);frag.appendChild(safety);
  const ops=document.createElement("div");ops.className="p954ap-section";const opsTitle=document.createElement("div");opsTitle.className="p954ap-section-title";opsTitle.textContent="Planned storage restoration";ops.appendChild(opsTitle);(plan.operations||[]).forEach(function(op){const row=document.createElement("div");row.className="p954ap-write-item";const prefix=op.label+(typeof op.key==="string"&&op.key?" ("+op.key+")":"");row.textContent=prefix+": "+(op.kind==="orderOverride"?(op.action==="already-restored"?"already matches the saved pre-apply order":"restore original order"):(op.action==="remove"?"remove key because it was originally absent":op.action==="already-restored"?"already matches the saved pre-apply state":"restore exact original raw value"));ops.appendChild(row);});frag.appendChild(ops);
  const audit=document.createElement("div");audit.className="p954ap-section";const auditTitle=document.createElement("div");auditTitle.className="p954ap-section-title";auditTitle.textContent="Proposal audit";audit.appendChild(auditTitle);const auditRow=document.createElement("div");auditRow.className="p954ap-write-item";auditRow.textContent="The proposal remains saved with status Undone, its original application ID and applied timestamp, an undo timestamp, exact affected-path restoration verification, and unrelated-state preservation verification.";audit.appendChild(auditRow);frag.appendChild(audit);
  const issues=(plan.errors||[]).concat(plan.conflicts||[]),issueBox=document.createElement("div");issueBox.className="p954ap-section";const issueTitle=document.createElement("div");issueTitle.className="p954ap-section-title";issueTitle.textContent="Conflicts and validation errors";issueBox.appendChild(issueTitle);if(!issues.length){const none=document.createElement("div");none.className="p954r-empty-note";none.textContent="None";issueBox.appendChild(none);}else issues.forEach(function(msg){const row=document.createElement("div");row.className="p954ap-write-item";row.textContent="⚠ "+msg;issueBox.appendChild(row);});frag.appendChild(issueBox);
  return frag;
}

function p954RShowUndoPreview(){
  p954RSetUndoConfirmDisabled(true);const errEl=document.getElementById("p954UndoError");if(errEl){errEl.style.display="none";errEl.textContent="";}
  try{const plan=p954BuildUndoPlan();p954LastUndoValidationErrors=plan.errors.concat(plan.conflicts);const body=document.getElementById("p954UndoPreviewBody");if(body){body.innerHTML="";body.appendChild(p954RBuildUndoPreviewContent(plan));}p954RSetUndoConfirmDisabled(!plan.canUndo);const backdrop=document.getElementById("p954UndoPreviewBackdrop");if(backdrop)backdrop.classList.add("open");p954UndoPreviewOpenFlag=true;}
  catch(e){p954RSetUndoConfirmDisabled(true);if(errEl){errEl.style.display="block";errEl.textContent="Unexpected error building the undo preview — nothing has changed.";}}
}

function p954RCancelUndoPreview(){const backdrop=document.getElementById("p954UndoPreviewBackdrop");if(backdrop)backdrop.classList.remove("open");p954UndoPreviewOpenFlag=false;p954RSetUndoConfirmDisabled(true);}

function p954RConfirmUndoPreview(){
  const errEl=document.getElementById("p954UndoError");
  try{
    // Direct-call defense: the mutation function independently repeats this
    // raw inspection and live plan immediately before writing.
    const inspection=p954InspectStoredProposal();
    if(!inspection.exists||!inspection.parses||!inspection.validation.valid||!inspection.normalized){p954RSetUndoConfirmDisabled(true);if(errEl){errEl.style.display="block";errEl.textContent="Cannot undo: the saved proposal is missing, corrupted, or invalid.";}return;}
    if(inspection.normalized.status==="undone"){p954RSetUndoConfirmDisabled(true);p954RCancelUndoPreview();p954RenderProgramPersonalization();return;}
    const preflight=p954BuildUndoPlan(inspection.normalized);p954LastUndoValidationErrors=preflight.errors.concat(preflight.conflicts);
    if(!preflight.canUndo){p954RSetUndoConfirmDisabled(true);if(errEl){errEl.style.display="block";errEl.textContent="Cannot undo safely: "+p954LastUndoValidationErrors.join(" ");}return;}
    const result=p954UndoAppliedProposal();if(!result.ok){p954RSetUndoConfirmDisabled(true);if(errEl){errEl.style.display="block";errEl.textContent=result.error||"Undo failed — storage was restored to its immediate pre-undo state.";}return;}
    p954RCancelUndoPreview();p954RCloseReview();p954RenderProgramPersonalization();try{if(typeof renderProgram==="function")renderProgram();}catch(e){}try{if(typeof populateWoDaySelect==="function")populateWoDaySelect();}catch(e){}p954ShowResult(result.alreadyUndone?"This proposal was already undone — nothing changed.":"↩ Applied proposal changes undone. Workout logs and history were not changed.","ok");
  }catch(e){p954RSetUndoConfirmDisabled(true);if(errEl){errEl.style.display="block";errEl.textContent="Unexpected error — nothing has changed.";}}
}

// REQUIREMENT 9: read-only review-layer debug helper. Never mutates
// anything — safe to call at any time, including while the review is closed.
window.mfOnboardingProgramProposalReviewDebug = function(){
  try {
    const overlay = document.getElementById("p954ReviewOverlay");
    const backdrop = document.getElementById("p954ConfirmBackdrop");
    const proposal = p954GetProposal();
    // 9.5.4B.1: raw-storage inspection — this is what actually determines
    // whether the stored proposal is safe to review (see p954ROpenReview).
    const inspection = p954InspectStoredProposal();
    const validation = inspection.validation;
    // 9.5.4B.2: storedProposalNormalizedValid must reflect actual structural
    // validation of the normalized read model, not merely that normalization
    // returned an object.
    const normalizedValidation = inspection.normalized ? p954ValidateProgramProposal(inspection.normalized) : { valid: false, errors: [] };
    const applyBackdrop = document.getElementById("p954ApplyPreviewBackdrop");
    const applyErrEl = document.getElementById("p954ApplyError");
    const undoBackdrop = document.getElementById("p954UndoPreviewBackdrop");
    const undoErrEl = document.getElementById("p954UndoError");
    const undoPlan = p954BuildUndoPlan(proposal === null ? undefined : proposal);
    const result = {
      overlayExists: !!overlay,
      overlayOpen: !!(overlay && overlay.classList.contains("open")),
      proposalStatus: proposal ? proposal.status : null,
      validation: validation,
      gymGroupCount: p954RLastRenderedGymGroups,
      renderedDayCount: p954RLastRenderedDayCount,
      renderedExerciseCount: p954RLastRenderedExerciseCount,
      visibleWarnings: proposal ? (proposal.warnings || []) : [],
      currentConfirmationState: !!(backdrop && backdrop.classList.contains("open")),
      // 9.5.4B.1: concise raw-storage inspection fields only — no raw text,
      // no full parsed/normalized object dumps.
      storedProposalExists: inspection.exists,
      storedProposalParses: inspection.parses,
      storedProposalRawValid: inspection.validation.valid,
      storedProposalNormalizedValid: normalizedValidation.valid,
      storedProposalErrors: inspection.validation.errors,
      // 9.5.4C: apply-preview panel debug fields.
      applyPreviewOpen: !!(p954ApplyPreviewOpenFlag && applyBackdrop && applyBackdrop.classList.contains("open")),
      applyConfirmationOpen: !!(applyBackdrop && applyBackdrop.classList.contains("open")),
      applyError: (applyErrEl && applyErrEl.style.display !== "none") ? applyErrEl.textContent : null,
      renderedAppliedSummary: p954RLastRenderedAppliedSummary,
      currentProposalFingerprint: inspection.normalized ? p954ComputeProposalFingerprint(inspection.normalized) : null,
      undoPreviewOpen: !!(p954UndoPreviewOpenFlag && undoBackdrop && undoBackdrop.classList.contains("open")),
      undoConfirmDisabled: !!(document.getElementById("p954UndoConfirmBtn") && document.getElementById("p954UndoConfirmBtn").disabled),
      undoError: (undoErrEl && undoErrEl.style.display !== "none") ? undoErrEl.textContent : null,
      canUndo: undoPlan.canUndo,
      undoConflicts: undoPlan.conflicts,
      undoWarnings: undoPlan.warnings
    };
    console.log("[MarcusFit] mfOnboardingProgramProposalReviewDebug():", result);
    return result;
  } catch(e){
    const result = { error: (e && e.message) || "Unknown error" };
    console.warn("[MarcusFit] mfOnboardingProgramProposalReviewDebug failed:", e && e.message);
    return result;
  }
};
// ── END PHASE 9.5.4 / 9.5.4B ─────────────────────────────────────────────────

// Show brief "Draft saved HH:MM" toast — debounced so it doesn't spam
