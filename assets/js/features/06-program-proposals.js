// ── FUTURE MODULE: src/proposal-engine.js ───────────────────────────────────
// ── PHASE 9.5.4: PERSONALIZED PROGRAM PROPOSAL FOUNDATION ───────────────────
// Read-only-with-respect-to-the-program foundation. Adds a new, independent
// localStorage key (mf-onboarding-program-proposal) that stores a
// schema-versioned, deterministic SUMMARY of what a program change based on
// onboarding answers + profile + current resolved program *could* look like.
//
// Hard rule for this entire phase: a proposal DESCRIBES suggested changes
// (kept/modified days, tweaks, reorders, replacements, additions, removals,
// optional added days). It never APPLIES any of them. Nothing in this phase
// writes to P, mf-overrides, mf-exercise-state, mf-recommendations, workout
// logs/history, or mf-onboarding-state's draft/answers. The only localStorage
// key this phase ever writes to is mf-onboarding-program-proposal itself.
//
// Generation is deterministic: given the same onboarding draft, profile, and
// resolved program, p954BuildProgramProposal() always returns the same
// summary/dayPlans/warnings (aside from the generatedAt timestamp, which is
// set by the caller, not the builder).
const PROGRAM_PROPOSAL_KEY = "mf-onboarding-program-proposal";
const PROGRAM_PROPOSAL_SCHEMA = 1;
const PROGRAM_PROPOSAL_STATUSES = ["draft", "applied", "dismissed", "undone"];
const PROGRAM_PROPOSAL_DAY_ACTIONS = ["keep", "modify", "reorder", "replace", "add", "remove", "optional_add"];
// 9.5.4.2: recognized day-plan roles produced by p954ClassifyProposalDay().
// "optional" doubles as the safe fallback for older proposals saved before
// this field existed.
const PROGRAM_PROPOSAL_DAY_ROLES = ["lifting", "cardio", "recovery", "optional"];
// 9.5.4D: structured, schema-safe exercise instructions. Prose is never executable.
const PROGRAM_PROPOSAL_EXERCISE_ACTIONS = ["keep", "modify", "replace", "add", "remove", "reactivate"];
const PROGRAM_PROPOSAL_EXERCISE_MODIFY_FIELDS = ["name", "sets", "reps", "load", "rir", "blurb"];
const PROGRAM_PROPOSAL_SOURCE_TYPES = ["local_generated", "fixture", "legacy"];
const PROGRAM_PROPOSAL_SAFETY_TAGS = ["safe_apply", "review_only", "deferred_lifecycle", "low_confidence", "source_missing", "unchanged", "conflict"];
const PROGRAM_PROPOSAL_ENGINE_VERSION = "9.5.5-local-rules-1";

// Recognized gym modes for proposal purposes. Falls back to the known
// "home"/"partial" pair if P isn't available for any reason — never throws.
function p954GetRecognizedProposalGymKeys(){
  try {
    const keys = Object.keys(P);
    return keys.length ? keys : ["home","partial"];
  } catch(e){
    return ["home","partial"];
  }
}

// Returns a fresh, independent default proposal object. Never returns a
// shared mutable reference — safe to call repeatedly. status defaults to
// "draft" since the default shape only exists as a normalization base /
// in-memory scaffold — "no proposal at all" is represented by p954GetProposal()
// returning null, not by this default object being persisted.
function p954GetDefaultProposal(){
  return {
    schemaVersion: PROGRAM_PROPOSAL_SCHEMA,
    proposalVersion: APP_VERSION,
    status: "draft",
    source: "onboarding",
    sourceType: "local_generated",
    sourceSummary: {
      generatedAt: null,
      appVersion: APP_VERSION,
      proposalEngineVersion: PROGRAM_PROPOSAL_ENGINE_VERSION,
      profileUsed: false,
      onboardingUsed: false,
      coachingPrefsUsed: false,
      currentProgramUsed: false,
      lifecycleUsed: false,
      recentLogsUsed: false,
      sourceWarnings: []
    },
    generatedAt: null,
    appliedAt: null,
    undoneAt: null,
    dismissedAt: null,
    onboardingUpdatedAt: null,
    profileUpdatedAt: null,
    // 9.5.4C: application foundation — all null/absent for legacy proposals
    // and for any proposal that hasn't been applied yet.
    applicationId: null,
    applicationSummary: null,
    preApplySnapshot: null,
    undoSummary: null,
    summary: {
      recommendedFrequency: null,
      gymModes: [],
      estimatedSessionDurationMinutes: null,
      rationale: [],
      affectedDayCount: 0,
      actionCounts: { keep:0, modify:0, reorder:0, replace:0, add:0, remove:0, optional_add:0 },
      // 9.5.4.2: preserve these through normalization so they survive save/load.
      requestedLiftingFrequency: null,
      currentLiftingDayCounts: {}
    },
    dayPlans: [],
    warnings: []
  };
}

// Fills missing/malformed fields from defaults, preserves valid existing
// values, and preserves unknown top-level fields where practical for forward
// compatibility. Never throws.
function p954NormalizeProposal(proposal){
  const def = p954GetDefaultProposal();
  const src = (proposal && typeof proposal === "object" && !Array.isArray(proposal)) ? proposal : {};
  const out = Object.assign({}, src); // preserve unknown top-level fields

  out.schemaVersion = PROGRAM_PROPOSAL_SCHEMA;
  out.proposalVersion = (typeof src.proposalVersion === "string" && src.proposalVersion.trim()) ? src.proposalVersion : def.proposalVersion;
  out.status = PROGRAM_PROPOSAL_STATUSES.indexOf(src.status) !== -1 ? src.status : def.status;
  out.source = (typeof src.source === "string" && src.source.trim()) ? src.source : def.source;
  const hasStructuredSource = src.sourceSummary && typeof src.sourceSummary === "object" && !Array.isArray(src.sourceSummary);
  out.sourceType = PROGRAM_PROPOSAL_SOURCE_TYPES.indexOf(src.sourceType) !== -1
    ? src.sourceType
    : (hasStructuredSource ? "local_generated" : "legacy");

  function isoOrNull(v){
    if(v === null || v === undefined) return null;
    return (typeof v === "string" && !isNaN(Date.parse(v))) ? v : null;
  }
  out.generatedAt = isoOrNull(src.generatedAt);
  out.appliedAt = isoOrNull(src.appliedAt);
  out.undoneAt = isoOrNull(src.undoneAt);
  out.dismissedAt = isoOrNull(src.dismissedAt);
  out.onboardingUpdatedAt = isoOrNull(src.onboardingUpdatedAt);
  out.profileUpdatedAt = isoOrNull(src.profileUpdatedAt);
  const ss = hasStructuredSource ? src.sourceSummary : {};
  out.sourceSummary = {
    generatedAt: isoOrNull(ss.generatedAt) || out.generatedAt,
    appVersion: (typeof ss.appVersion === "string" && ss.appVersion.trim()) ? ss.appVersion : (hasStructuredSource ? out.proposalVersion : null),
    proposalEngineVersion: (typeof ss.proposalEngineVersion === "string" && ss.proposalEngineVersion.trim()) ? ss.proposalEngineVersion : null,
    profileUsed: hasStructuredSource ? ss.profileUsed === true : false,
    onboardingUsed: hasStructuredSource ? ss.onboardingUsed === true : false,
    coachingPrefsUsed: hasStructuredSource ? ss.coachingPrefsUsed === true : false,
    currentProgramUsed: hasStructuredSource ? ss.currentProgramUsed === true : false,
    lifecycleUsed: hasStructuredSource ? ss.lifecycleUsed === true : false,
    recentLogsUsed: hasStructuredSource ? ss.recentLogsUsed === true : false,
    profileFields: Array.isArray(ss.profileFields) ? ss.profileFields.filter(function(v){ return typeof v === "string"; }) : [],
    onboardingSections: Array.isArray(ss.onboardingSections) ? ss.onboardingSections.filter(function(v){ return typeof v === "string"; }) : [],
    lifecycleSignals: Array.isArray(ss.lifecycleSignals) ? ss.lifecycleSignals.filter(function(v){ return typeof v === "string"; }) : [],
    sourceWarnings: Array.isArray(ss.sourceWarnings) ? ss.sourceWarnings.filter(function(w){ return typeof w === "string" && w.trim(); }) : (hasStructuredSource ? [] : ["Legacy proposal: detailed source coverage was not recorded."])
  };

  // 9.5.4C: application foundation fields — all optional; legacy proposals
  // missing them normalize safely to null (draft/dismissed never require them).
  out.applicationId = (typeof src.applicationId === "string" && src.applicationId.trim()) ? src.applicationId : null;
  out.applicationSummary = (src.applicationSummary && typeof src.applicationSummary === "object" && !Array.isArray(src.applicationSummary)) ? Object.assign({}, src.applicationSummary) : null;
  if(out.applicationSummary){
    // 9.5.4D additive fields default only in the normalized read model. Raw
    // validation below still rejects explicitly-present malformed values,
    // while accepted 9.5.4C applied records remain readable without a write.
    ["reorderedDayCount","modifiedExerciseCount","skippedReplaceCount","skippedAddCount","skippedRemoveCount","skippedReactivateCount"].forEach(function(f){
      if(out.applicationSummary[f] === undefined) out.applicationSummary[f] = 0;
    });
  }
  out.preApplySnapshot = (src.preApplySnapshot && typeof src.preApplySnapshot === "object" && !Array.isArray(src.preApplySnapshot)) ? Object.assign({}, src.preApplySnapshot) : null;
  if(out.preApplySnapshot){
    if(out.preApplySnapshot.orderOverrides === undefined) out.preApplySnapshot.orderOverrides = {};
    if(out.preApplySnapshot.overrides === undefined) out.preApplySnapshot.overrides = {};
  }
  out.undoSummary = (src.undoSummary && typeof src.undoSummary === "object" && !Array.isArray(src.undoSummary)) ? Object.assign({}, src.undoSummary) : null;

  const srcSummary = (src.summary && typeof src.summary === "object" && !Array.isArray(src.summary)) ? src.summary : {};
  const srcActionCounts = (srcSummary.actionCounts && typeof srcSummary.actionCounts === "object") ? srcSummary.actionCounts : {};
  const actionCounts = {};
  PROGRAM_PROPOSAL_DAY_ACTIONS.forEach(function(a){
    const n = Number(srcActionCounts[a]);
    actionCounts[a] = (isFinite(n) && n >= 0) ? Math.floor(n) : 0;
  });
  const freq = Number(srcSummary.recommendedFrequency);
  const dur = Number(srcSummary.estimatedSessionDurationMinutes);
  const affected = Number(srcSummary.affectedDayCount);

  // 9.5.4.2: requestedLiftingFrequency — integer 2–6 or null.
  const reqLiftFreq = Number(srcSummary.requestedLiftingFrequency);
  const requestedLiftingFrequency = (isFinite(reqLiftFreq) && reqLiftFreq >= 2 && reqLiftFreq <= 6) ? Math.floor(reqLiftFreq) : null;

  // 9.5.4.2: currentLiftingDayCounts — object keyed only by recognized gym
  // modes, each value a non-negative integer. Unrecognized keys are dropped.
  const recognizedGymKeys = p954GetRecognizedProposalGymKeys();
  const srcLiftingCounts = (srcSummary.currentLiftingDayCounts && typeof srcSummary.currentLiftingDayCounts === "object" && !Array.isArray(srcSummary.currentLiftingDayCounts)) ? srcSummary.currentLiftingDayCounts : {};
  const currentLiftingDayCounts = {};
  recognizedGymKeys.forEach(function(g){
    const n = Number(srcLiftingCounts[g]);
    if(isFinite(n) && n >= 0) currentLiftingDayCounts[g] = Math.floor(n);
  });

  out.summary = {
    recommendedFrequency: (isFinite(freq) && freq > 0) ? freq : null,
    gymModes: Array.isArray(srcSummary.gymModes) ? srcSummary.gymModes.filter(function(g){ return typeof g === "string"; }) : [],
    estimatedSessionDurationMinutes: (isFinite(dur) && dur > 0) ? dur : null,
    rationale: Array.isArray(srcSummary.rationale) ? srcSummary.rationale.filter(function(r){ return typeof r === "string"; }) : [],
    affectedDayCount: (isFinite(affected) && affected >= 0) ? Math.floor(affected) : 0,
    actionCounts: actionCounts,
    requestedLiftingFrequency: requestedLiftingFrequency,
    currentLiftingDayCounts: currentLiftingDayCounts
  };

  out.dayPlans = Array.isArray(src.dayPlans) ? src.dayPlans.filter(function(dp){
    return dp && typeof dp === "object" && typeof dp.gymKey === "string" && isFinite(Number(dp.dayIdx));
  }).map(function(dp){
    return {
      gymKey: dp.gymKey,
      dayIdx: Math.floor(Number(dp.dayIdx)),
      dayName: (typeof dp.dayName === "string") ? dp.dayName : ("Day " + (Math.floor(Number(dp.dayIdx)) + 1)),
      isVirtual: !!dp.isVirtual,
      // 9.5.4.2: role — one of PROGRAM_PROPOSAL_DAY_ROLES, falling back to
      // "optional" (the safe default) for older proposals saved before this
      // field existed or for any unrecognized value.
      role: PROGRAM_PROPOSAL_DAY_ROLES.indexOf(dp.role) !== -1 ? dp.role : "optional",
      action: PROGRAM_PROPOSAL_DAY_ACTIONS.indexOf(dp.action) !== -1 ? dp.action : "keep",
      tweaks: Array.isArray(dp.tweaks) ? dp.tweaks.filter(function(t){ return typeof t === "string"; }) : [],
      notes: (typeof dp.notes === "string") ? dp.notes : "",
      rationale: (typeof dp.rationale === "string") ? dp.rationale : ((typeof dp.notes === "string") ? dp.notes : ""),
      safetyTag: PROGRAM_PROPOSAL_SAFETY_TAGS.indexOf(dp.safetyTag) !== -1 ? dp.safetyTag : (dp.action === "keep" ? "unchanged" : (["replace","add","remove","optional_add"].indexOf(dp.action) !== -1 ? "deferred_lifecycle" : "safe_apply")),
      confidence: (typeof dp.confidence === "string" && dp.confidence.trim()) ? dp.confidence : (hasStructuredSource ? "medium" : "low"),
      // 9.5.4C: optional day-level metadata fields — supported by the
      // application engine for "modify"/"optional_add" actions. Absent on
      // every proposal produced by today's deterministic builder (which only
      // ever varies dayName), but preserved through normalization so a
      // hand-authored or future AI-authored proposal carrying them applies
      // correctly. Each is a string when present, otherwise omitted entirely
      // (not written as null) so "field not provided" and "field explicitly
      // cleared" stay distinguishable to callers that check `!== undefined`.
      proposedName: (typeof dp.proposedName === "string") ? dp.proposedName : undefined,
      focus: (typeof dp.focus === "string") ? dp.focus : undefined,
      note: (typeof dp.note === "string") ? dp.note : undefined,
      tag: (typeof dp.tag === "string") ? dp.tag : undefined,
      subtitle: (typeof dp.subtitle === "string") ? dp.subtitle : undefined,
      // Legacy proposals default to no structured exercise operations.
      proposedExerciseOrder: dp.proposedExerciseOrder === null ? null : (Array.isArray(dp.proposedExerciseOrder) ? dp.proposedExerciseOrder.slice() : null),
      exerciseActions: Array.isArray(dp.exerciseActions) ? dp.exerciseActions.map(function(ea){
        const fields = (ea && ea.fields && typeof ea.fields === "object" && !Array.isArray(ea.fields)) ? Object.keys(ea.fields).reduce(function(acc, key){ acc[key] = ea.fields[key]; return acc; }, {}) : {};
        return {
          exerciseId: ea && (typeof ea.exerciseId === "string" || ea.exerciseId === null) ? ea.exerciseId : null,
          action: ea && PROGRAM_PROPOSAL_EXERCISE_ACTIONS.indexOf(ea.action) !== -1 ? ea.action : "keep",
          fields: fields,
          rationale: ea && typeof ea.rationale === "string" ? ea.rationale : "",
          safetyTag: ea && PROGRAM_PROPOSAL_SAFETY_TAGS.indexOf(ea.safetyTag) !== -1 ? ea.safetyTag : (ea && ea.action === "modify" ? "safe_apply" : (ea && ea.action === "keep" ? "unchanged" : "deferred_lifecycle")),
          confidence: ea && typeof ea.confidence === "string" && ea.confidence.trim() ? ea.confidence : (hasStructuredSource ? "medium" : "low")
        };
      }) : []
    };
  }) : [];

  out.warnings = Array.isArray(src.warnings) ? src.warnings.filter(function(w){ return typeof w === "string"; }) : [];

  // Materialize the same dayPlans-derived view used by card/review/debug/export.
  // This repairs stale legacy/fixture summaries in memory without writing.
  out.summary.actionCounts = p955GetDerivedProposalActionCounts(out).counts;
  out.summary.affectedDayCount = out.dayPlans.length;

  return out;
}

// Safely reads + parses mf-onboarding-program-proposal. Never throws. Returns
// null if the key is absent or malformed (i.e. "no proposal exists"), or a
// normalized proposal object otherwise. Does not write storage.
function p954GetProposal(){
  try {
    const raw = localStorage.getItem(PROGRAM_PROPOSAL_KEY);
    if(raw === null) return null;
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch(e){
      console.warn("[MarcusFit] mf-onboarding-program-proposal is malformed JSON — treating as no proposal for this read.");
      return null;
    }
    return p954NormalizeProposal(parsed);
  } catch(e){
    console.warn("[MarcusFit] p954GetProposal failed, treating as no proposal:", e && e.message);
    return null;
  }
}

// Normalizes and safely writes the proposal to localStorage. proposalVersion
// always reflects the current APP_VERSION at save time.
function p954SaveProposal(proposal){
  try {
    const normalized = p954NormalizeProposal(proposal);
    normalized.proposalVersion = APP_VERSION;
    localStorage.setItem(PROGRAM_PROPOSAL_KEY, JSON.stringify(normalized));
    return { ok: true, proposal: normalized };
  } catch(e){
    console.warn("[MarcusFit] p954SaveProposal failed:", e && e.message);
    return { ok: false, error: (e && e.message) || "Unknown error" };
  }
}

// Removes the proposal entirely, returning to a "no proposal" state. Does
// not touch any other key.
function p954ClearProposal(){
  try {
    localStorage.removeItem(PROGRAM_PROPOSAL_KEY);
    return { ok: true };
  } catch(e){
    console.warn("[MarcusFit] p954ClearProposal failed:", e && e.message);
    return { ok: false, error: (e && e.message) || "Unknown error" };
  }
}

// Structural validation, independent of normalization (normalization always
// "succeeds" by coercing to safe defaults — this checks whether the proposal
// is actually coherent). Never throws.
function p954ValidateProgramProposal(proposal){
  const errors = [];
  const validationWarnings = [];
  try {
    if(!proposal || typeof proposal !== "object"){
      errors.push("Proposal is not an object.");
      return { valid: false, errors: errors };
    }
    if(proposal.schemaVersion !== PROGRAM_PROPOSAL_SCHEMA) errors.push("Unexpected schemaVersion: " + proposal.schemaVersion);
    if(PROGRAM_PROPOSAL_STATUSES.indexOf(proposal.status) === -1) errors.push("Invalid status: " + proposal.status);
    if(!proposal.summary || typeof proposal.summary !== "object") errors.push("Missing summary object.");
    if(proposal.sourceType !== undefined && PROGRAM_PROPOSAL_SOURCE_TYPES.indexOf(proposal.sourceType) === -1) errors.push("Invalid sourceType: " + proposal.sourceType);
    if(proposal.sourceSummary !== undefined){
      if(!proposal.sourceSummary || typeof proposal.sourceSummary !== "object" || Array.isArray(proposal.sourceSummary)){
        errors.push("sourceSummary is present but is not an object.");
      } else {
        ["profileUsed","onboardingUsed","coachingPrefsUsed","currentProgramUsed","lifecycleUsed","recentLogsUsed"].forEach(function(f){
          if(proposal.sourceSummary[f] !== undefined && typeof proposal.sourceSummary[f] !== "boolean") validationWarnings.push("sourceSummary."+f+" should be boolean; normalized read treats it as false.");
        });
        if(proposal.sourceSummary.generatedAt !== undefined && proposal.sourceSummary.generatedAt !== null && (typeof proposal.sourceSummary.generatedAt !== "string" || isNaN(Date.parse(proposal.sourceSummary.generatedAt)))) validationWarnings.push("sourceSummary.generatedAt is malformed; normalized read uses proposal.generatedAt.");
        if(proposal.sourceSummary.sourceWarnings !== undefined && !Array.isArray(proposal.sourceSummary.sourceWarnings)) validationWarnings.push("sourceSummary.sourceWarnings should be an array; normalized read uses an empty list.");
      }
    } else {
      validationWarnings.push("Legacy proposal has no structured sourceSummary.");
    }
    if(!Array.isArray(proposal.dayPlans)) errors.push("dayPlans is not an array.");
    else {
      const recognizedGymKeys = p954GetRecognizedProposalGymKeys();
      const seenGymDayKeys = {};
      proposal.dayPlans.forEach(function(dp, i){
        if(!dp || typeof dp !== "object"){ errors.push("dayPlans[" + i + "] is not an object."); return; }
        if(recognizedGymKeys.indexOf(dp.gymKey) === -1) errors.push("dayPlans[" + i + "] has unrecognized gymKey: " + dp.gymKey);
        // 9.5.4B.2: dayIdx must be an actual integer number — not a numeric
        // string ("2"), not a fractional value (1.5), and not anything else
        // merely coercible via Number(...). isFinite(dp.dayIdx) alone would
        // accept all of those, since isFinite() coerces its argument.
        const dayIdxValid = (typeof dp.dayIdx === "number") && Number.isInteger(dp.dayIdx) && dp.dayIdx >= 0;
        if(!dayIdxValid) errors.push("dayPlans[" + i + "] has invalid dayIdx: " + JSON.stringify(dp.dayIdx));
        if(PROGRAM_PROPOSAL_DAY_ACTIONS.indexOf(dp.action) === -1) errors.push("dayPlans[" + i + "] has invalid action: " + dp.action);
        // 9.5.4.2 / 9.5.4B.1: role must be one of the recognized day-plan
        // roles. This function is now also used to validate the RAW stored
        // structure before normalization (see p954InspectStoredProposal), so
        // a missing role (undefined) — expected from proposals saved before
        // 9.5.4.2 — is treated as a legacy omission, not corruption; it will
        // safely normalize to "optional". An explicit-but-unrecognized role
        // is still reported as a genuine error either way.
        if(dp.role !== undefined && PROGRAM_PROPOSAL_DAY_ROLES.indexOf(dp.role) === -1) errors.push("dayPlans[" + i + "] has invalid role: " + dp.role);
        if(dp.safetyTag !== undefined && PROGRAM_PROPOSAL_SAFETY_TAGS.indexOf(dp.safetyTag) === -1) validationWarnings.push("dayPlans[" + i + "] has an unrecognized safetyTag; normalized read derives a safe label.");

        // 9.5.4D raw structured-exercise validation. Existence/day membership is live-state validation.
        const location = "Gym " + String(dp.gymKey) + ", day " + String(dp.dayIdx);
        if(dp.proposedExerciseOrder !== undefined && dp.proposedExerciseOrder !== null){
          if(!Array.isArray(dp.proposedExerciseOrder)) errors.push(location + ": proposedExerciseOrder must be null or an array.");
          else {
            const orderSeen = {};
            dp.proposedExerciseOrder.forEach(function(id, oi){
              if(typeof id !== "string" || !id.trim()) errors.push(location + ": proposedExerciseOrder[" + oi + "] must be a non-empty exercise ID string.");
              else if(orderSeen[id]) errors.push(location + ": proposedExerciseOrder contains duplicate exercise ID " + id + ".");
              else orderSeen[id] = true;
            });
          }
        }
        if(dp.exerciseActions !== undefined && !Array.isArray(dp.exerciseActions)) errors.push(location + ": exerciseActions must be an array.");
        if(Array.isArray(dp.exerciseActions)){
          const targeted = {};
          dp.exerciseActions.forEach(function(ea, ai){
            const prefix = location + ", exercise action " + ai;
            if(!ea || typeof ea !== "object" || Array.isArray(ea) || Object.getPrototypeOf(ea) !== Object.prototype){ errors.push(prefix + ": action must be a plain object."); return; }
            if(PROGRAM_PROPOSAL_EXERCISE_ACTIONS.indexOf(ea.action) === -1) errors.push(prefix + ": unrecognized action " + JSON.stringify(ea.action) + ".");
            if(ea.safetyTag !== undefined && PROGRAM_PROPOSAL_SAFETY_TAGS.indexOf(ea.safetyTag) === -1) validationWarnings.push(prefix + ": unrecognized safetyTag; normalized read derives a safe label.");
            const requiresId = ["keep","modify","replace","remove","reactivate"].indexOf(ea.action) !== -1;
            if(requiresId && (typeof ea.exerciseId !== "string" || !ea.exerciseId.trim())) errors.push(prefix + ": exerciseId is required.");
            if(ea.action === "add" && ea.exerciseId !== undefined && ea.exerciseId !== null && (typeof ea.exerciseId !== "string" || !ea.exerciseId.trim())) errors.push(prefix + ": add exerciseId must be null, omitted, or a non-empty string.");
            const id = typeof ea.exerciseId === "string" ? ea.exerciseId : null;
            if(id && targeted[id]) errors.push(prefix + ", exercise " + id + ": conflicts with another action targeting this exercise.");
            if(id) targeted[id] = ea.action;
            if(ea.action === "modify"){
              const f = ea.fields;
              if(!f || typeof f !== "object" || Array.isArray(f) || Object.getPrototypeOf(f) !== Object.prototype || !Object.keys(f).length){ errors.push(prefix + (id ? ", exercise " + id : "") + ": modify fields must be a non-empty plain object."); return; }
              Object.keys(f).forEach(function(field){
                const fp = prefix + (id ? ", exercise " + id : "") + ", field " + field;
                if(PROGRAM_PROPOSAL_EXERCISE_MODIFY_FIELDS.indexOf(field) === -1){ errors.push(fp + ": field is not allowed."); return; }
                const v = f[field];
                if(field === "name" && (typeof v !== "string" || !v.trim())) errors.push(fp + ": name must be a non-empty string.");
                else if(field === "sets" && (!Number.isInteger(v) || v <= 0)) errors.push(fp + ": sets must be a positive integer.");
                else if(field === "reps" && !((typeof v === "string" && v.trim()) || (typeof v === "number" && isFinite(v) && v > 0))) errors.push(fp + ": reps must be a non-empty string or positive finite number.");
                else if((field === "load" || field === "rir") && !((typeof v === "string" && v.trim()) || (typeof v === "number" && isFinite(v)))) errors.push(fp + ": value must be a non-empty string or finite number.");
                else if(field === "blurb" && typeof v !== "string") errors.push(fp + ": blurb must be a string.");
              });
            }
          });
        }
        // 9.5.4.2: reject duplicate gymKey/dayIdx combinations — this catches
        // accidental collisions between an existing day and a proposed
        // optional_add (or any other duplicate day-plan entry). Only build
        // the key from a dayIdx that actually passed strict validation above
        // — an invalid dayIdx is already reported by the check above and
        // must not also be silently coerced into a duplicate-key comparison.
        if(typeof dp.gymKey === "string" && dayIdxValid){
          const key = dp.gymKey + "|" + dp.dayIdx;
          if(seenGymDayKeys[key]) errors.push("dayPlans[" + i + "] duplicates gymKey/dayIdx already used at another entry: " + key);
          else seenGymDayKeys[key] = true;
        }
      });
    }
    if(!Array.isArray(proposal.warnings)) errors.push("warnings is not an array.");

    // 9.5.4C: explicit application-field validation. Legacy proposals that
    // simply omit these fields are NOT penalized — draft/dismissed proposals
    // never require them. Only status "applied" requires them, since that's
    // the only state where they carry real meaning.
    if(proposal.appliedAt !== undefined && proposal.appliedAt !== null){
      if(typeof proposal.appliedAt !== "string" || isNaN(Date.parse(proposal.appliedAt))) errors.push("appliedAt is present but not a valid ISO-like string: " + JSON.stringify(proposal.appliedAt));
    }
    if(proposal.applicationId !== undefined && proposal.applicationId !== null){
      if(typeof proposal.applicationId !== "string" || !proposal.applicationId.trim()) errors.push("applicationId is present but not a non-empty string.");
    }
    if(proposal.applicationSummary !== undefined && proposal.applicationSummary !== null){
      if(typeof proposal.applicationSummary !== "object" || Array.isArray(proposal.applicationSummary)) errors.push("applicationSummary is present but not an object.");
    }
    if(proposal.preApplySnapshot !== undefined && proposal.preApplySnapshot !== null){
      if(typeof proposal.preApplySnapshot !== "object" || Array.isArray(proposal.preApplySnapshot)) errors.push("preApplySnapshot is present but not an object.");
    }
    if(proposal.undoneAt !== undefined && proposal.undoneAt !== null){
      if(typeof proposal.undoneAt !== "string" || isNaN(Date.parse(proposal.undoneAt))) errors.push("undoneAt is present but not a valid ISO-like string: " + JSON.stringify(proposal.undoneAt));
    }
    if(proposal.undoSummary !== undefined && proposal.undoSummary !== null){
      if(typeof proposal.undoSummary !== "object" || Array.isArray(proposal.undoSummary)) errors.push("undoSummary is present but not an object.");
    }
    if(proposal.status === "applied" || proposal.status === "undone"){
      if(!proposal.appliedAt || typeof proposal.appliedAt !== "string" || isNaN(Date.parse(proposal.appliedAt))) errors.push("status is 'applied' but appliedAt is missing/invalid.");
      if(!proposal.applicationId || typeof proposal.applicationId !== "string" || !proposal.applicationId.trim()) errors.push("status is 'applied' but applicationId is missing/invalid.");
      if(!proposal.applicationSummary || typeof proposal.applicationSummary !== "object" || Array.isArray(proposal.applicationSummary)) errors.push("status is 'applied' but applicationSummary is missing/invalid.");
      else {
        // Missing D-only counters are valid for accepted 9.5.4C applied
        // proposals. If present, each remains strictly validated.
        ["reorderedDayCount","modifiedExerciseCount","skippedReplaceCount","skippedAddCount","skippedRemoveCount","skippedReactivateCount"].forEach(function(f){
          if(proposal.applicationSummary[f] !== undefined && (!Number.isInteger(proposal.applicationSummary[f]) || proposal.applicationSummary[f] < 0)) errors.push("status is 'applied' but applicationSummary."+f+" is invalid.");
        });
      }
      if(!proposal.preApplySnapshot || typeof proposal.preApplySnapshot !== "object" || Array.isArray(proposal.preApplySnapshot)) errors.push("status is 'applied' but preApplySnapshot is missing/invalid.");
      else {
        // Original C snapshot members remain required. D-only snapshot
        // members may be absent on legacy records, but malformed present
        // values are rejected rather than normalized into valid operations.
        ["dayOverrides","dayAdditions","disabledDays","proposal"].forEach(function(f){ if(!Object.prototype.hasOwnProperty.call(proposal.preApplySnapshot,f)) errors.push("status is 'applied' but preApplySnapshot."+f+" is missing."); });
        ["orderOverrides","overrides"].forEach(function(f){
          if(proposal.preApplySnapshot[f] !== undefined && (!proposal.preApplySnapshot[f] || typeof proposal.preApplySnapshot[f] !== "object" || Array.isArray(proposal.preApplySnapshot[f]))) errors.push("status is 'applied' but preApplySnapshot."+f+" is invalid.");
        });
      }
    }
    if(proposal.status === "undone"){
      if(!proposal.undoneAt || typeof proposal.undoneAt !== "string" || isNaN(Date.parse(proposal.undoneAt))) errors.push("status is 'undone' but undoneAt is missing/invalid.");
      if(!proposal.undoSummary || typeof proposal.undoSummary !== "object" || Array.isArray(proposal.undoSummary)) errors.push("status is 'undone' but undoSummary is missing/invalid.");
      else {
        if(proposal.undoSummary.status !== "success") errors.push("status is 'undone' but undoSummary.status is not 'success'.");
        if(proposal.undoSummary.applicationId !== proposal.applicationId) errors.push("status is 'undone' but undoSummary.applicationId does not match applicationId.");
        if(proposal.undoSummary.exactRawRestorationVerified !== true) errors.push("status is 'undone' but exact raw restoration is not verified.");
        if(!Array.isArray(proposal.undoSummary.storageResults)) errors.push("status is 'undone' but undoSummary.storageResults is invalid.");
        if(!proposal.undoSummary.validationFacts || typeof proposal.undoSummary.validationFacts !== "object" || Array.isArray(proposal.undoSummary.validationFacts)) errors.push("status is 'undone' but undoSummary.validationFacts is invalid.");
        if(proposal.undoSummary.exactAffectedStateRestorationVerified !== undefined && typeof proposal.undoSummary.exactAffectedStateRestorationVerified !== "boolean") errors.push("status is 'undone' but affected-path verification is invalid.");
        if(proposal.undoSummary.unrelatedStatePreserved !== undefined && typeof proposal.undoSummary.unrelatedStatePreserved !== "boolean") errors.push("status is 'undone' but unrelated-state preservation is invalid.");
        if(!proposal.undoSummary.deferredActionCounts || typeof proposal.undoSummary.deferredActionCounts !== "object" || Array.isArray(proposal.undoSummary.deferredActionCounts)) errors.push("status is 'undone' but undoSummary.deferredActionCounts is invalid.");
      }
    }
  } catch(e){
    errors.push("Validation failed safely: " + (e && e.message));
  }
  return { valid: errors.length === 0, errors: errors, warnings: validationWarnings };
}

// ── 9.5.4B.1: read-only raw storage inspection ───────────────────────────────
// Unlike p954GetProposal() (which normalizes before returning, silently
// repairing invalid stored fields), this reads mf-onboarding-program-proposal
// as-is and validates the ORIGINAL parsed structure before any repair, so a
// genuinely invalid or malformed stored proposal can be reliably identified.
// Never writes/modifies localStorage. Never throws.
//
// Returns:
//   {
//     exists: boolean,            // key present in localStorage
//     parses: boolean,            // stored text is valid JSON (false if absent too)
//     rawText: string|null,       // exact stored text, or null if absent
//     parsed: object|null,        // JSON.parse() of rawText, or null if absent/malformed
//     normalized: object|null,    // p954NormalizeProposal(parsed) read model, or null if absent/malformed
//     validation: {valid, errors},// p954ValidateProgramProposal() run on the RAW parsed object
//     storageError: string|null   // set only if localStorage itself could not be read
//   }
function p954InspectStoredProposal(){
  const result = {
    exists: false,
    parses: false,
    rawText: null,
    parsed: null,
    normalized: null,
    validation: { valid: false, errors: [] },
    storageError: null
  };
  try {
    let raw;
    try {
      raw = localStorage.getItem(PROGRAM_PROPOSAL_KEY);
    } catch(e){
      result.storageError = (e && e.message) || "Unknown storage error";
      result.validation = { valid: false, errors: ["Unable to read stored proposal: " + result.storageError] };
      return result;
    }

    if(raw === null){
      // Absent key: exists/parses false, parsed/normalized null — matches
      // p954GetProposal()'s "no proposal" case exactly.
      result.validation = { valid: false, errors: ["No proposal saved."] };
      return result;
    }

    result.exists = true;
    result.rawText = raw;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch(e){
      // Malformed JSON: exists true, parses false, rawText preserved,
      // parsed/normalized stay null. A clear validation error is returned
      // rather than silently treating this as "no proposal".
      result.parses = false;
      result.validation = { valid: false, errors: ["Stored proposal is not valid JSON: " + ((e && e.message) || "parse error")] };
      return result;
    }

    result.parses = true;
    result.parsed = parsed;

    // Validate the ORIGINAL parsed structure before normalization — this is
    // what actually catches explicit invalid status/action/role values,
    // invalid/negative dayIdx, invalid gymKey, duplicate gymKey/dayIdx, and
    // non-array dayPlans, none of which normalization would preserve.
    result.validation = p954ValidateProgramProposal(parsed);

    // Also produce the normalized read model separately, purely for display
    // purposes when the raw proposal is valid — this never affects the
    // validation verdict above and never writes storage.
    try {
      result.normalized = p954NormalizeProposal(parsed);
    } catch(e){
      result.normalized = null;
    }

    return result;
  } catch(e){
    result.storageError = (e && e.message) || "Unknown error";
    result.validation = { valid: false, errors: ["Inspection failed safely: " + result.storageError] };
    return result;
  }
}

// ── Deterministic in-memory builder ──────────────────────────────────────────
// Pure function: reads nothing from localStorage itself — everything it needs
// comes in as arguments. Same inputs always produce the same output (aside
// from timestamps, which callers set separately). Never mutates its inputs.
//
//   onboardingState — result of p951GetOnboardingState()
//   profile         — result of p950GetUserProfile()
//   currentProgram  — { home: getResolvedDays("home"), partial: getResolvedDays("partial") }
//                      i.e. already fully resolved (overrides, custom
//                      exercises, archived-exclusion, order overrides, and
//                      virtual/additive days all baked in by getResolvedDays()).
//
// Kept intentionally conservative: it only proposes an "optional_add" day
// when the requested weekly frequency exceeds the current base day count,
// only flags existing base days as "remove" candidates (descriptive only —
// nothing is ever actually removed) when there are clearly more base days
// than requested, and only flags a day as "modify" when it detects a real
// same-day duplicate active exercise name. Everything else is "keep".
// ── 9.5.4.1: day-role classifier ─────────────────────────────────────────────
// Conservative, deterministic classifier used ONLY by the proposal builder to
// separate actual lifting days from cardio/recovery/optional days so weekly
// lifting-frequency answers are compared against the right denominator.
// Reads only trusted current day metadata (name/tag/focus/exercises/virtual
// status) — never mutates the day, never touches storage.
//   Returns one of: "lifting", "cardio", "recovery", "optional".
function p954ClassifyProposalDay(day){
  try {
    if(!day || typeof day !== "object") return "optional";
    const tag = ((day.tag) || "").toUpperCase();
    const nm = ((day.name || day.day || "") + "").toLowerCase();
    const focus = ((day.focus) || "").toLowerCase();
    const haystack = nm + " " + focus + " " + tag.toLowerCase();

    // Cardio/recovery/mobility signals always win — these never count as lifting.
    const cardioKeywordRe = /\bcardio\b|\bzone\s*2\b|\bwalk\b|\brun\b|\bbike\b|\bcycl(e|ing)\b/;
    const recoveryOnlyRe = /\brecovery\b|\bmobility\b/;
    if(tag === "CARDIO" || cardioKeywordRe.test(haystack)) return "cardio";
    if(recoveryOnlyRe.test(haystack)) return "recovery";

    // Known lifting tags/keywords.
    const liftingTagSet = { PUSH:1, PULL:1, LOWER:1, ARMS:1, PUMP:1 };
    const liftingKeywordRe = /\bpush\b|\bpull\b|\blower\b|\blegs?\b|\bchest\b|\bback\b|\bshoulders?\b|\barms?\b|\bpump\b|full\s*body|\bstrength\b|hypertrophy|resistance/;

    if(liftingTagSet[tag] || liftingKeywordRe.test(haystack)){
      // Guard: if every exercise on an otherwise lifting-looking day is a
      // cardio-duration entry (reps expressed as minutes, no working sets),
      // do not count it as lifting.
      const exercises = Array.isArray(day.exercises) ? day.exercises : [];
      if(exercises.length){
        const durationRe = /\bmin(ute)?s?\b/i;
        const allDurationBased = exercises.every(function(ex){
          const reps = (ex && ex.reps != null) ? String(ex.reps) : "";
          return durationRe.test(reps);
        });
        if(allDurationBased) return "cardio";
      }
      return "lifting";
    }

    // No clear lifting/cardio/recovery signal. Existing virtual/added days
    // default to "optional" unless their exercises are clearly lifting-style
    // (working sets/reps rather than a duration).
    const exercises2 = Array.isArray(day.exercises) ? day.exercises : [];
    if(exercises2.length){
      const durationRe2 = /\bmin(ute)?s?\b/i;
      const hasWorkingSet = exercises2.some(function(ex){
        const reps = (ex && ex.reps != null) ? String(ex.reps) : "";
        return !!reps && !durationRe2.test(reps);
      });
      if(hasWorkingSet) return "lifting";
    }
    return "optional";
  } catch(e){
    return "optional";
  }
}

// ── 9.5.4.1: conservative removal-priority ranking for lifting days ─────────
// Lower number = safer/more preferred removal candidate. Returns null when
// the day is not a lifting day at all (cardio/recovery/optional days are
// never proposed for removal to satisfy a lifting-frequency reduction).
//   0 = optional/virtual lifting day
//   1 = specialization/pump day
//   2 = dedicated arms day
//   3 = other accessory-focused lifting day
//   4 = foundational push/pull/lower/legs day (avoid unless nothing else)
function p954GetProposalDayRemovalPriority(day, role){
  if(role !== "lifting") return null;
  if(!day) return 3;
  const tag = ((day.tag) || "").toUpperCase();
  const nm = ((day.name || day.day || "") + "").toLowerCase();
  if(day._isVirtual) return 0;
  // Check explicit tags before falling back to name-text keywords, so a day
  // like "ARMS — STRENGTH & PUMP" (tag ARMS) isn't mis-ranked as a pump day
  // just because the word "pump" also appears in its display name.
  if(tag === "PUMP") return 1;
  if(tag === "ARMS") return 2;
  if(/\bpump\b|\btaper\b/.test(nm)) return 1;
  if(/\barms?\b/.test(nm)) return 2;
  const foundationalRe = /\bpush\b|\bpull\b|\blower\b|\blegs?\b/;
  if(["PUSH","PULL","LOWER"].indexOf(tag) !== -1 || foundationalRe.test(nm)) return 4;
  return 3;
}

function p955BuildProposalSourceContext(onboardingState, profile, currentProgram){
  const draft = onboardingState && onboardingState.draft && typeof onboardingState.draft === "object" ? onboardingState.draft : {};
  const prefs = (function(){ try { return p9GetCoachPrefs().trim(); } catch(e){ return ""; } })();
  const sourceWarnings = [];
  const profileStored = (function(){ try { return localStorage.getItem(USER_PROFILE_KEY) !== null; } catch(e){ return false; } })();
  const onboardingStored = (function(){ try { return localStorage.getItem(ONBOARDING_KEY) !== null; } catch(e){ return false; } })();
  const profileFields = [];
  if(profileStored && profile){
    if(profile.identity && profile.identity.displayName) profileFields.push("displayName");
    if(profile.goals && profile.goals.primaryGoal) profileFields.push("primaryGoal");
    if(profile.goals && profile.goals.physiqueOutcome) profileFields.push("physiqueOutcome");
    if(profile.app && profile.app.homeGymLabel) profileFields.push("homeGymLabel");
    if(profile.app && profile.app.partialGymLabel) profileFields.push("partialGymLabel");
  }
  const onboardingSections = ["profile","goals","training"].filter(function(k){ return draft[k] && typeof draft[k] === "object" && Object.keys(draft[k]).length; });
  const programUsed = Object.keys(currentProgram || {}).some(function(g){ return Array.isArray(currentProgram[g]) && currentProgram[g].length; });
  const lifecycleSignals = [];
  try {
    const lc = getLifecycle(), ov = getOvr();
    if(Object.keys(lc.orderOverrides || {}).length) lifecycleSignals.push("orderOverrides");
    if(Object.keys(lc.dayOverrides || {}).some(function(g){ return Object.keys(lc.dayOverrides[g] || {}).length; })) lifecycleSignals.push("dayOverrides");
    if(Object.keys(lc.dayAdditions || {}).some(function(g){ return Object.keys(lc.dayAdditions[g] || {}).length; })) lifecycleSignals.push("dayAdditions");
    if(Object.keys(lc.disabledDays || {}).some(function(g){ return Object.keys(lc.disabledDays[g] || {}).length; })) lifecycleSignals.push("disabledDays");
    if(Object.keys(lc.inactiveIds || {}).length) lifecycleSignals.push("inactiveExercises");
    if(Object.keys(lc.customExercises || {}).length) lifecycleSignals.push("customExercises");
    if(Object.keys(ov || {}).length) lifecycleSignals.push("exerciseOverrides");
  } catch(e){
    sourceWarnings.push("Lifecycle and exercise override state was unavailable.");
  }
  if(!profileFields.length) sourceWarnings.push("Saved user profile was unavailable or empty.");
  if(!onboardingStored || !onboardingSections.length) sourceWarnings.push("Saved onboarding answers were unavailable or empty.");
  if(!prefs) sourceWarnings.push("Persistent AI coaching preferences were unavailable or empty.");
  if(!programUsed) sourceWarnings.push("Current resolved program was unavailable or empty.");
  if(!lifecycleSignals.length) sourceWarnings.push("No lifecycle/order/exercise override customizations were present.");
  sourceWarnings.push("Recent workout logs were intentionally not used by this deterministic rule set.");
  return {
    coachingPrefs: prefs,
    sourceSummary: {
      generatedAt: null,
      appVersion: APP_VERSION,
      proposalEngineVersion: PROGRAM_PROPOSAL_ENGINE_VERSION,
      profileUsed: profileFields.length > 0,
      onboardingUsed: onboardingStored && onboardingSections.length > 0,
      coachingPrefsUsed: !!prefs,
      currentProgramUsed: programUsed,
      lifecycleUsed: lifecycleSignals.length > 0,
      recentLogsUsed: false,
      profileFields: profileFields,
      onboardingSections: onboardingSections,
      lifecycleSignals: lifecycleSignals,
      sourceWarnings: sourceWarnings
    }
  };
}

function p954BuildProgramProposal(onboardingState, profile, currentProgram, sourceContext){
  const draft = (onboardingState && onboardingState.draft && typeof onboardingState.draft === "object") ? onboardingState.draft : {};
  const goals = (draft.goals && typeof draft.goals === "object") ? draft.goals : {};
  const training = (draft.training && typeof draft.training === "object") ? draft.training : {};
  const hasOnboardingAnswers = !!(draft.goals || draft.training || draft.profile);

  const warnings = [];
  const rationale = [];
  const context = sourceContext || p955BuildProposalSourceContext(onboardingState, profile, currentProgram);
  const coachingPrefs = typeof context.coachingPrefs === "string" ? context.coachingPrefs : "";
  const sourceSummary = context.sourceSummary || p955BuildProposalSourceContext(onboardingState, profile, currentProgram).sourceSummary;
  const profileName = profile && profile.identity && profile.identity.displayName ? profile.identity.displayName : "";
  const profileGoal = goals.primaryGoal || (profile && profile.goals && profile.goals.primaryGoal) || "";
  const physiqueOutcome = goals.physiqueOutcome || (profile && profile.goals && profile.goals.physiqueOutcome) || "";
  const gymLabels = profile && profile.app ? { home:profile.app.homeGymLabel, partial:profile.app.partialGymLabel } : {};

  // ── Determine target gym mode(s) ────────────────────────────────────────
  const availableGyms = Object.keys(currentProgram || {}).filter(function(g){ return Array.isArray(currentProgram[g]); });
  let gymModes;
  if(training.locations === "home") gymModes = ["home"];
  else if(training.locations === "gym") gymModes = ["partial"];
  else if(training.locations === "both") gymModes = ["home","partial"];
  else gymModes = availableGyms.slice(); // no usable answer — describe against every resolvable gym mode
  gymModes = gymModes.filter(function(g){ return availableGyms.indexOf(g) !== -1 });
  if(!gymModes.length){
    warnings.push("No resolved program data available for any gym mode — proposal has no day plans.");
  }

  // ── Determine recommended weekly frequency ──────────────────────────────
  let recommendedFrequency = null;
  if(isFinite(training.liftingDays) && training.liftingDays >= 2 && training.liftingDays <= 6){
    recommendedFrequency = Math.floor(training.liftingDays);
  }

  // ── Determine experience label (affects duration estimate + rationale) ──
  const experience = ["beginner","intermediate","advanced"].indexOf(goals.trainingExperience) !== -1 ? goals.trainingExperience : null;

  if(!hasOnboardingAnswers){
    warnings.push("No completed onboarding answers found — proposal derived from saved profile and current program only.");
  }
  if(profileName) rationale.push("Built for " + profileName + " from the saved MarcusFit profile.");
  if(goals.primaryGoal) rationale.push("Primary goal on file: \"" + goals.primaryGoal + "\".");
  else if(profileGoal) rationale.push("Primary goal on file (from profile): \"" + profileGoal + "\".");
  if(physiqueOutcome) rationale.push("Physique outcome on file: \"" + physiqueOutcome + "\".");
  if(coachingPrefs) rationale.push("Persistent AI coaching preferences informed local priority and metadata rules; no external AI or API was called.");
  if(experience) rationale.push("Training experience: " + experience + ".");
  if(goals.currentFocus) rationale.push("Current focus: " + String(goals.currentFocus).replace(/_/g," ") + ".");
  if(training.cardioPreference) rationale.push("Cardio preference: " + String(training.cardioPreference).replace(/_/g," ") + ".");
  if(training.equipmentNotes) rationale.push("Equipment notes on file — not applied to individual exercises in this foundation release.");
  if(training.limitations){
    rationale.push("Limitations/constraints on file — reviewed conservatively, not auto-applied to any exercise.");
    warnings.push("User-noted limitations/constraints exist — review the full onboarding answers before making any real program change.");
  }
  if(recommendedFrequency){
    rationale.push("Requested lifting frequency: " + recommendedFrequency + " day(s) per week.");
  } else {
    rationale.push("No specific lifting-frequency answer on file — using each gym mode's current lifting-day count as the target.");
  }

  // ── Build per-gym day plans ──────────────────────────────────────────────
  // 9.5.4.1: liftingDays requested by onboarding is a count of actual lifting
  // days — it must be compared against the current LIFTING-day count for each
  // gym mode, not the total displayed day count (which also includes cardio/
  // recovery/optional days). Cardio/recovery days are always preserved.
  const dayPlans = [];
  const actionCounts = { keep:0, modify:0, reorder:0, replace:0, add:0, remove:0, optional_add:0 };
  const currentLiftingDayCounts = {}; // REQUIREMENT 7: read-only debug visibility, by gym mode

  gymModes.forEach(function(gymKey){
    const days = currentProgram[gymKey] || [];
    const baseLen = (typeof P !== "undefined" && Array.isArray(P[gymKey])) ? P[gymKey].length : days.filter(function(d){ return !d._isVirtual; }).length;

    // Classify every day up front so the same classification is used both for
    // rendering the day plan and for the target-frequency math below.
    const classifiedDays = days.map(function(d){ return { day: d, role: p954ClassifyProposalDay(d) }; });
    const currentLiftingCount = classifiedDays.filter(function(cd){ return cd.role === "lifting"; }).length;
    const cardioRecoveryCount = classifiedDays.filter(function(cd){ return cd.role === "cardio" || cd.role === "recovery"; }).length;
    currentLiftingDayCounts[gymKey] = currentLiftingCount;

    // Target is the requested lifting frequency when available; otherwise the
    // gym mode's own current lifting-day count (never the raw total day count).
    const targetFreq = recommendedFrequency || currentLiftingCount || baseLen;

    rationale.push(
      (gymLabels[gymKey] || gymKey) + ": " + currentLiftingCount + " current lifting day(s), target " + targetFreq + "/week lifting"
      + (cardioRecoveryCount ? ("; " + cardioRecoveryCount + " cardio/recovery day(s) preserved outside that count.") : ".")
    );

    classifiedDays.forEach(function(cd){
      const day = cd.day;
      const exercises = Array.isArray(day.exercises) ? day.exercises : [];
      const seen = {};
      const dupeNames = [];
      exercises.forEach(function(ex){
        const key = (ex && typeof ex.name === "string") ? ex.name.trim().toLowerCase() : "";
        if(!key) return;
        if(seen[key]) { if(dupeNames.indexOf(ex.name) === -1) dupeNames.push(ex.name); }
        else seen[key] = true;
      });

      const dayIdx = isFinite(day._dayIdx) ? day._dayIdx : dayPlans.length;
      const roleNote = (cd.role === "cardio") ? "Cardio day — preserved outside the requested lifting frequency."
        : (cd.role === "recovery") ? "Recovery/mobility day — preserved outside the requested lifting frequency."
        : "";
      const plan = {
        gymKey: gymKey,
        dayIdx: dayIdx,
        dayName: day.name || day.day || ("Day " + (dayIdx + 1)),
        isVirtual: !!day._isVirtual,
        role: cd.role,
        action: dupeNames.length ? "modify" : "keep",
        tweaks: dupeNames.map(function(n){ return "Remove duplicate active exercise \"" + n + "\" (keep the first occurrence)."; }),
        notes: dupeNames.length ? "Duplicate active exercise name(s) detected on this day." : roleNote,
        rationale: dupeNames.length
          ? "Metadata-only cleanup keeps the first stable exercise ID and avoids rewriting history."
          : (roleNote || "Current resolved day is retained because no source-backed safe change was identified."),
        safetyTag: dupeNames.length ? "safe_apply" : "unchanged",
        confidence: dupeNames.length ? "high" : "medium",
        proposedExerciseOrder: null,
        exerciseActions: []
      };
      const priorityText = (physiqueOutcome + " " + coachingPrefs).toLowerCase();
      const priorityTerms = [
        { re:/shoulder|delt/, ex:/shoulder|lateral|delt/ },
        { re:/\bchest\b|pec/, ex:/chest|bench|fly|push-up/ },
        { re:/\bback\b|lat/, ex:/row|pulldown|pull-up|lat/ },
        { re:/\barms?\b|biceps?|triceps?/, ex:/curl|tricep|extension|skull/ },
        { re:/glute|legs?|quad|hamstring/, ex:/squat|lunge|deadlift|leg|hip|glute|hamstring/ }
      ];
      const priority = priorityTerms.find(function(x){ return x.re.test(priorityText); });
      if(cd.role === "lifting" && priority && exercises.length > 1){
        const matchIdx = exercises.findIndex(function(ex){ return priority.ex.test(String(ex && ex.name || "").toLowerCase()); });
        if(matchIdx > 0){
          const ids = exercises.map(function(ex){ return ex.id; });
          const moved = ids.splice(matchIdx, 1)[0];
          ids.unshift(moved);
          plan.proposedExerciseOrder = ids;
          plan.rationale = "Moves source-matched weak-point work earlier while preserving every stable exercise ID and same-day membership.";
          plan.safetyTag = "safe_apply";
          plan.confidence = "medium";
        }
      }
      if(cd.role === "lifting" && physiqueOutcome && !(day.focus && String(day.focus).trim())){
        plan.action = "modify";
        plan.focus = "Supports " + String(physiqueOutcome).slice(0, 120);
        plan.rationale = "Adds day-level focus metadata aligned with the saved physique outcome; the base day, exercises, stable IDs, and history remain unchanged.";
        plan.safetyTag = "safe_apply";
        plan.confidence = "medium";
      }
      if(cd.role === "lifting" && /\brir\b|reps?\s+in\s+reserve/i.test(coachingPrefs)){
        const missingRir = exercises.find(function(ex){ return ex && ex.id && (ex.rir === undefined || ex.rir === null || ex.rir === ""); });
        if(missingRir){
          plan.exerciseActions.push({
            exerciseId: missingRir.id,
            action: "modify",
            fields: { rir: "2" },
            rationale: "Adds a conservative RIR target because saved coaching preferences explicitly reference RIR; stable ID and exercise history are preserved.",
            safetyTag: "safe_apply",
            confidence: "medium"
          });
        }
      }
      if(dupeNames.length){
        warnings.push(gymKey + " " + plan.dayName + ": duplicate active exercise name(s) detected — " + dupeNames.join(", ") + ".");
      }
      dayPlans.push(plan);
    });

    const delta = targetFreq - currentLiftingCount;
    if(delta > 0){
      // REQUIREMENT 4: only add the number of optional LIFTING day proposals
      // needed to reach the requested lifting frequency — never based on the
      // raw total day count.
      // 9.5.4.2: guard against dayIdx collisions. A customized program can
      // already have virtual days at or above baseLen, so "baseLen + i" can
      // land on an index that's already in use. Gather every dayIdx already
      // present for this gym mode and walk forward from baseLen to find the
      // next truly unused integer for each optional_add, reserving it
      // immediately so multiple additions in the same gym mode never collide
      // with each other either. Purely descriptive — no day is ever created.
      const usedDayIdx = {};
      days.forEach(function(d){
        const n = Number(d && d._dayIdx);
        if(isFinite(n)) usedDayIdx[n] = true;
      });
      let nextIdx = baseLen;
      for(let i = 0; i < delta; i++){
        while(usedDayIdx[nextIdx]) nextIdx++;
        const newIdx = nextIdx;
        usedDayIdx[newIdx] = true;
        nextIdx++;
        dayPlans.push({
          gymKey: gymKey,
          dayIdx: newIdx,
          dayName: "Optional Lifting Day " + (newIdx + 1),
          isVirtual: true,
          role: "lifting",
          action: "optional_add",
          tweaks: [],
          notes: "Suggested optional additional lifting day for " + gymKey + " to reach a requested lifting frequency of " + targetFreq + "/week (currently " + currentLiftingCount + "). Not created — describes a possibility only.",
          rationale: "Matches the saved onboarding frequency, but adding a lifecycle day remains review-only to preserve the base program and history safety.",
          safetyTag: "deferred_lifecycle",
          confidence: recommendedFrequency ? "high" : "low",
          proposedExerciseOrder: null,
          exerciseActions: []
        });
      }
    } else if(delta < 0){
      // REQUIREMENT 3: current lifting days exceed requested — choose removal
      // candidates by day ROLE, not by highest day index, and never touch
      // cardio/recovery days. Preference order: optional virtual lifting days,
      // then specialization/pump days, then dedicated arms days, then other
      // accessory lifting days — avoiding foundational push/pull/lower days
      // whenever a more optional lifting day exists.
      const excess = Math.abs(delta);
      const removalCandidates = classifiedDays
        .filter(function(cd){ return cd.role === "lifting"; })
        .map(function(cd){
          return { dayIdx: cd.day._dayIdx, priority: p954GetProposalDayRemovalPriority(cd.day, cd.role) };
        })
        .sort(function(a,b){
          if(a.priority !== b.priority) return a.priority - b.priority;
          return b.dayIdx - a.dayIdx; // tie-break: prefer removing the later day
        });

      removalCandidates.slice(0, excess).forEach(function(c){
        const existing = dayPlans.find(function(p){ return p.gymKey === gymKey && p.dayIdx === c.dayIdx; });
        if(existing){
          existing.action = "remove";
          existing.notes = ("Current lifting-day count (" + currentLiftingCount + ") for " + gymKey + " exceeds the requested lifting frequency of " + targetFreq + "/week — consider removing or merging this day. Cardio/recovery days are preserved regardless. Describes a possibility only.");
          existing.rationale = "Frequency exceeds the saved onboarding target; removal remains review-only so base P and workout history stay untouched.";
          existing.safetyTag = "deferred_lifecycle";
          existing.confidence = "medium";
        }
      });
      if(excess > removalCandidates.length){
        warnings.push(gymKey + ": requested lifting-frequency reduction exceeds the number of available lifting-day removal candidates — review manually.");
      }
    }
  });

  dayPlans.forEach(function(p){
    if(actionCounts.hasOwnProperty(p.action)) actionCounts[p.action]++;
  });
  const affectedDayCount = dayPlans.filter(function(p){ return p.action !== "keep"; }).length;

  // ── Estimated session duration (deterministic, coarse) ───────────────────
  // 9.5.4.1: average exercise count over LIFTING days where practical, so a
  // cardio-only day (one exercise, 30-40 min) no longer drags the estimated
  // lifting-session duration down.
  let estimatedSessionDurationMinutes = null;
  const nonOptionalLiftingDayPlans = dayPlans.filter(function(p){ return p.action !== "optional_add" && p.role === "lifting"; });
  const nonOptionalDays = dayPlans.filter(function(p){ return p.action !== "optional_add"; });
  if(nonOptionalLiftingDayPlans.length || nonOptionalDays.length){
    const useLiftingOnly = nonOptionalLiftingDayPlans.length > 0;
    const totalExercises = gymModes.reduce(function(sum, gymKey){
      return sum + (currentProgram[gymKey] || []).reduce(function(s, d){
        if(useLiftingOnly && p954ClassifyProposalDay(d) !== "lifting") return s;
        return s + ((d.exercises||[]).length);
      }, 0);
    }, 0);
    const dayCountForAvg = gymModes.reduce(function(sum, gymKey){
      const gymDays = currentProgram[gymKey] || [];
      return sum + (useLiftingOnly ? gymDays.filter(function(d){ return p954ClassifyProposalDay(d) === "lifting"; }).length : gymDays.length);
    }, 0) || 1;
    const avgExercisesPerDay = totalExercises / dayCountForAvg;
    let est = Math.round(10 + (avgExercisesPerDay * 7));
    if(experience === "beginner") est -= 5;
    if(experience === "advanced") est += 5;
    estimatedSessionDurationMinutes = Math.max(30, Math.min(90, est));
  }

  return {
    schemaVersion: PROGRAM_PROPOSAL_SCHEMA,
    proposalVersion: APP_VERSION,
    status: "draft",
    source: "onboarding",
    sourceType: "local_generated",
    sourceSummary: sourceSummary,
    generatedAt: null, // set by the caller at save time
    appliedAt: null,
    dismissedAt: null,
    onboardingUpdatedAt: (onboardingState && typeof onboardingState.updatedAt === "string") ? onboardingState.updatedAt : null,
    profileUpdatedAt: (profile && typeof profile.updatedAt === "string") ? profile.updatedAt : null,
    summary: {
      recommendedFrequency: recommendedFrequency,
      gymModes: gymModes,
      estimatedSessionDurationMinutes: estimatedSessionDurationMinutes,
      rationale: rationale,
      affectedDayCount: affectedDayCount,
      actionCounts: actionCounts,
      // REQUIREMENT 7: read-only debug visibility.
      requestedLiftingFrequency: recommendedFrequency,
      currentLiftingDayCounts: currentLiftingDayCounts
    },
    dayPlans: dayPlans,
    warnings: warnings
  };
}

// Builds the { home: [...], partial: [...] } input shape p954BuildProgramProposal
// expects, using getResolvedDays() per gym so overrides, custom exercises,
// archived-exclusion, order overrides, and virtual/additive days are all
// already baked in. Read-only — never mutates P or lifecycle state.
function p954GetCurrentResolvedProgramForProposal(){
  const out = {};
  try {
    Object.keys(P).forEach(function(gymKey){
      // 9.5.4C: proposal-disabled days are treated as inactive for proposal
      // building purposes — excluded from lifting-day counts and dayPlans,
      // same as they're excluded from the Program tab / Daily Log selector.
      // Never mutates P or lifecycle state; base day/history are untouched.
      out[gymKey] = getResolvedDays(gymKey).filter(function(d){ return !isDayDisabled(gymKey, d._dayIdx); });
    });
  } catch(e){
    console.warn("[MarcusFit] p954GetCurrentResolvedProgramForProposal failed:", e && e.message);
  }
  return out;
}

// Generates a fresh proposal from current onboarding/profile/program state
// and saves it (status "draft", generatedAt = now). This is the only function
// in this phase that writes PROGRAM_PROPOSAL_KEY as a "real" (non-preview)
// action. Safe to call repeatedly — always overwrites any existing draft.
function p954GenerateAndSaveProposal(){
  try {
    const onboardingState = p951GetOnboardingState();
    const profile = p950GetUserProfile();
    const currentProgram = p954GetCurrentResolvedProgramForProposal();
    const sourceContext = p955BuildProposalSourceContext(onboardingState, profile, currentProgram);
    const built = p954BuildProgramProposal(onboardingState, profile, currentProgram, sourceContext);
    built.generatedAt = new Date().toISOString();
    built.sourceSummary.generatedAt = built.generatedAt;
    return p954SaveProposal(built);
  } catch(e){
    console.warn("[MarcusFit] p954GenerateAndSaveProposal failed:", e && e.message);
    return { ok: false, error: (e && e.message) || "Unknown error" };
  }
}

// REQUIREMENT 10: generates and returns a proposal in memory WITHOUT saving.
// Safe to call at any time (completed users, preview mode, testing) — never
// touches PROGRAM_PROPOSAL_KEY or any other storage key.
window.mfGenerateOnboardingProgramProposalPreview = function(){
  try {
    const onboardingState = p951GetOnboardingState();
    const profile = p950GetUserProfile();
    const currentProgram = p954GetCurrentResolvedProgramForProposal();
    const sourceContext = p955BuildProposalSourceContext(onboardingState, profile, currentProgram);
    const built = p954BuildProgramProposal(onboardingState, profile, currentProgram, sourceContext);
    built.generatedAt = new Date().toISOString();
    built.sourceSummary.generatedAt = built.generatedAt;
    return built;
  } catch(e){
    console.warn("[MarcusFit] mfGenerateOnboardingProgramProposalPreview failed:", e && e.message);
    return null;
  }
};

// Read-only compatibility check between a saved proposal and the CURRENT
// onboarding/profile/program state. Never mutates the proposal or anything
// else — purely informational (surfaced in the debug helper and could back a
// future "this proposal may be stale" banner).
function p954CheckProgramCompatibility(proposal){
  const reasons = [];
  try {
    if(!proposal) return { stale: false, reasons: ["No proposal to check."] };
    const onboardingState = p951GetOnboardingState();
    const profile = p950GetUserProfile();
    if(proposal.onboardingUpdatedAt && onboardingState.updatedAt && proposal.onboardingUpdatedAt !== onboardingState.updatedAt){
      reasons.push("Onboarding answers have changed since this proposal was generated.");
    }
    if(proposal.profileUpdatedAt && profile.updatedAt && proposal.profileUpdatedAt !== profile.updatedAt){
      reasons.push("Profile has changed since this proposal was generated.");
    }
    (proposal.dayPlans || []).forEach(function(dp){
      try {
        const days = getResolvedDays(dp.gymKey);
        const match = days.find(function(d){ return d._dayIdx === dp.dayIdx; });
        if(!match && dp.action !== "optional_add" && dp.action !== "add"){
          reasons.push("Referenced day no longer resolves: " + dp.gymKey + " " + dp.dayName + ".");
        }
      } catch(e){ /* skip this dayPlan's check safely */ }
    });
  } catch(e){
    reasons.push("Compatibility check failed safely: " + (e && e.message));
  }
  return { stale: reasons.length > 0, reasons: reasons };
}

// ── PHASE 9.5.4D: DAY + SAFE EXERCISE PROPOSAL APPLICATION ENGINE ────────────
//
// Extends accepted day-level keep/modify/remove/optional_add with two safe
// structured exercise operations: full-ID same-day reorder in
// lifecycle.orderOverrides and metadata-only modify in mf-overrides.
// Replace/add/remove/reactivate are counted and deferred. The transaction may
// write only lifecycle day structures/orderOverrides, mf-overrides, and the
// proposal record; base P, stable IDs, customExercises, inactiveIds,
// replacements, recommendations, and workout logs/history stay protected.

// Deterministic application-id generator. Same proposal content (generatedAt
// + dayPlans) always yields the same id, so a retried/failed apply attempt
// against the same still-draft proposal reuses the same id — this is what
// lets in-progress writes be recognized as "already satisfied by this same
// application" rather than a conflicting collision. Not cryptographic; only
// needs to be stable and collision-resistant enough for this local, 1-device
// use case.
function p954GenerateApplicationId(proposal){
  try {
    const basis = (proposal && proposal.generatedAt ? proposal.generatedAt : "") + "|" + JSON.stringify((proposal && proposal.dayPlans) || []);
    let h = 0;
    for(let i = 0; i < basis.length; i++){ h = ((h << 5) - h + basis.charCodeAt(i)) | 0; }
    const ts = (proposal && proposal.generatedAt && !isNaN(Date.parse(proposal.generatedAt))) ? new Date(proposal.generatedAt).getTime() : Date.now();
    return "papp-" + Math.abs(h).toString(36) + "-" + ts.toString(36);
  } catch(e){
    return "papp-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e6).toString(36);
  }
}

// Deterministic fingerprint of the parts of a proposal that the application
// plan is actually built from (status + dayPlans). Used to detect "the
// proposal changed since the preview was opened" without a full deep-equal.
function p954ComputeProposalFingerprint(proposal){
  try {
    return JSON.stringify({ status: proposal && proposal.status, dayPlans: (proposal && proposal.dayPlans) || [] });
  } catch(e){
    return "unfingerprintable:" + (e && e.message);
  }
}

// Best-effort single-line rationale for a day-level write, reusing whatever
// free-text the builder already attached (dp.notes, else first tweak).
function p954ExtractDayPlanReason(dp){
  if(!dp) return "";
  if(typeof dp.rationale === "string" && dp.rationale) return dp.rationale;
  if(typeof dp.notes === "string" && dp.notes) return dp.notes;
  if(Array.isArray(dp.tweaks) && dp.tweaks.length && typeof dp.tweaks[0] === "string") return dp.tweaks[0];
  return "";
}

// Pure planner: reads only the proposal argument (plus P/current lifecycle
// for read-only day-resolution lookups used in the "modify" name-change
// check) and never writes anything. Returns the day-level write plan plus
// counts, including the exercise-level actions this phase must skip.
let p954LastLiveValidationErrors = [];
let p954LastPostApplyValidationErrors = [];
let p954LastSafetyFacts = {before:null,after:null,idsUnchanged:null};
// ── FUTURE MODULE: src/proposal-apply-undo.js ────────────────────────────────
function p954BuildApplicationPlan(proposal){
  const ops = [], errors = [], deferred = { replace:[], add:[], remove:[], reactivate:[] };
  const counts = { keep:0, modify:0, remove:0, optional_add:0, deferredDayLifecycleCount:0, skippedExerciseActionCount:0, plannedReorderCount:0, plannedExerciseModifyCount:0, skippedReplaceCount:0, skippedAddCount:0, skippedRemoveCount:0, skippedReactivateCount:0 };
  const affected = {}, gyms = p954GetRecognizedProposalGymKeys(), seen = {};
  (Array.isArray(proposal && proposal.dayPlans) ? proposal.dayPlans : []).forEach(function(dp, i){
    const gymKey=dp && dp.gymKey, dayIdx=dp && dp.dayIdx;
    if(!dp || typeof dp!=="object" || gyms.indexOf(gymKey)<0 || !Number.isInteger(dayIdx) || dayIdx<0){ errors.push("dayPlans["+i+"] has an invalid gym/day target."); return; }
    const k=gymKey+"|"+dayIdx;
    if(seen[k]){ errors.push("Duplicate planned day target: "+k); return; } seen[k]=true;
    const reason=p954ExtractDayPlanReason(dp);
    if(dp.action==="keep") { counts.keep++; ops.push({type:"keep",gymKey,dayIdx,dp}); }
    else if(dp.action==="modify"){
      counts.modify++; affected[gymKey]=true; const fields={}; let day=null;
      try{ day=getResolvedDays(gymKey).find(function(d){return d._dayIdx===dayIdx;}); }catch(e){}
      if(typeof dp.proposedName==="string"&&dp.proposedName.trim()) fields.name=dp.proposedName;
      else if(typeof dp.dayName==="string"&&dp.dayName.trim()&&day&&dp.dayName!==(day.name||day.day)) fields.name=dp.dayName;
      ["focus","note","tag","subtitle"].forEach(function(f){if(typeof dp[f]==="string") fields[f]=dp[f];});
      ops.push(Object.keys(fields).length?{type:"dayOverride",gymKey,dayIdx,fields,reason,dp}:{type:"keep",gymKey,dayIdx,dp,note:"No day metadata write."});
    } else if(dp.action==="remove"){ counts.remove++; counts.deferredDayLifecycleCount++; ops.push({type:"skip_deferred_lifecycle",gymKey,dayIdx,reason,dp}); }
    else if(dp.action==="optional_add"){
      counts.optional_add++; counts.deferredDayLifecycleCount++; ops.push({type:"skip_deferred_lifecycle",gymKey,dayIdx,reason,dp});
    } else if(["reorder","replace","add"].indexOf(dp.action)>=0){ counts.skippedExerciseActionCount++; ops.push({type:"skip_exercise_level",gymKey,dayIdx,dp}); }
    else errors.push("dayPlans["+i+"] has unsupported action: "+dp.action);

    if(Array.isArray(dp.proposedExerciseOrder)) ops.push({type:"orderOverride",gymKey,dayIdx,order:dp.proposedExerciseOrder.slice(),dayPlan:dp});
    (dp.exerciseActions||[]).forEach(function(ea){
      if(ea.action==="modify") ops.push({type:"exerciseOverride",gymKey,dayIdx,exerciseId:ea.exerciseId,fields:Object.assign({},ea.fields),rationale:ea.rationale||"",dayPlan:dp,exerciseAction:ea});
      else if(["replace","add","remove","reactivate"].indexOf(ea.action)>=0){ deferred[ea.action].push({gymKey,dayIdx,exerciseAction:ea,dayPlan:dp}); counts["skipped"+ea.action.charAt(0).toUpperCase()+ea.action.slice(1)+"Count"]++; counts.skippedExerciseActionCount++; }
    });
  });
  // Classify exact live matches read-only; final authority remains live validation.
  const lc=getLifecycle(), ov=getOvr();
  ops.forEach(function(op){
    if(op.type==="orderOverride"){
      const day=getResolvedDays(op.gymKey).find(function(d){return d._dayIdx===op.dayIdx;}); const current=day?(day.exercises||[]).map(function(e){return e.id;}):[];
      const stored=(lc.orderOverrides||{})[op.gymKey+":"+op.dayIdx];
      op.currentOrder=current;
      op.conflict=Array.isArray(stored)&&!p954StrictArrayEqual(stored,op.order);
      op.writeNeeded=!Array.isArray(stored)&&!p954StrictArrayEqual(current,op.order);
      op.unchanged=!op.conflict&&!op.writeNeeded;
      if(op.writeNeeded) counts.plannedReorderCount++;
    } else if(op.type==="exerciseOverride"){
      const existing=ov[op.exerciseId]||{}, day=getResolvedDays(op.gymKey).find(function(d){return d._dayIdx===op.dayIdx;}), ex=day&&(day.exercises||[]).find(function(e){return e.id===op.exerciseId;});
      op.fieldStates={}; let any=false, anyConflict=false;
      Object.keys(op.fields).forEach(function(f){
        const cur=getF(op.exerciseId,f,ex?ex[f]:undefined), has=Object.prototype.hasOwnProperty.call(existing,f);
        const conflict=has&&existing[f]!==op.fields[f];
        const write=!has&&cur!==op.fields[f];
        op.fieldStates[f]={current:cur,proposed:op.fields[f],conflict:conflict,writeNeeded:write,unchanged:!conflict&&!write};
        if(conflict) anyConflict=true;
        if(write) any=true;
      });
      op.conflict=anyConflict; op.writeNeeded=any; op.unchanged=!anyConflict&&!any; if(any) counts.plannedExerciseModifyCount++;
    }
  });
  return {valid:!errors.length,errors,ops,counts,deferred,affectedGymModes:Object.keys(affected)};
}
function p954StrictArrayEqual(a,b){ return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every(function(v,i){return v===b[i];}); }
function p954Value(v){ try{return JSON.stringify(v);}catch(e){return String(v);} }
function p954ValidatePlanAgainstLiveState(plan, applicationId){
  const errors=[], lc=getLifecycle(), ov=getOvr();
  (plan.ops||[]).forEach(function(op){
    if(op.type==="keep"||op.type==="skip_exercise_level"||op.type==="skip_deferred_lifecycle") return;
    if(!P[op.gymKey]){errors.push("Gym "+op.gymKey+" no longer exists.");return;}
    const label=op.gymKey+" day "+(op.dayIdx+1);
    if(op.type==="disable"){
      const day=getResolvedDays(op.gymKey).find(function(d){return d._dayIdx===op.dayIdx;}); if(!day) errors.push("Cannot disable "+label+": day does not resolve.");
      const old=((lc.disabledDays||{})[op.gymKey]||{})[String(op.dayIdx)]; if(old&&old.proposalId!==applicationId) errors.push(label+" has a conflicting disabled-day record.");
    } else if(op.type==="dayAddition"){
      if(op.dayIdx<P[op.gymKey].length) errors.push(label+" optional addition collides with a base day.");
      const old=((lc.dayAdditions||{})[op.gymKey]||{})[String(op.dayIdx)]; if(old){ const same=["name","focus","note","tag","subtitle"].every(function(f){return (old[f]||"")===(op.fields[f]||"");}); if(!same) errors.push(label+" has a conflicting day addition."); }
    } else if(op.type==="dayOverride"){
      const old=((lc.dayOverrides||{})[op.gymKey]||{})[String(op.dayIdx)]||{}; Object.keys(op.fields).forEach(function(f){if(Object.prototype.hasOwnProperty.call(old,f)&&old[f]!==op.fields[f]) errors.push(label+" field "+f+" conflict: existing "+p954Value(old[f])+", proposed "+p954Value(op.fields[f])+".");});
    } else if(op.type==="orderOverride"||op.type==="exerciseOverride"){
      if(((lc.disabledDays||{})[op.gymKey]||{})[String(op.dayIdx)]){errors.push(label+": exercise writes are blocked on a disabled day.");return;}
      const day=getResolvedDays(op.gymKey).find(function(d){return d._dayIdx===op.dayIdx;}); if(!day){errors.push(label+": exact resolved day not found.");return;}
      const exercises=day.exercises||[], ids=exercises.map(function(e){return e.id;});
      if(op.type==="orderOverride"){
        if(op.order.length!==ids.length||new Set(op.order).size!==op.order.length||op.order.some(function(id){return typeof id!=="string"||!id||ids.indexOf(id)<0||!!(lc.inactiveIds||{})[id];})||ids.some(function(id){return op.order.indexOf(id)<0;})) errors.push(label+": proposed order must contain exactly every active exercise ID once.");
        const old=(lc.orderOverrides||{})[op.gymKey+":"+op.dayIdx]; if(old&&!p954StrictArrayEqual(old,op.order)) errors.push(label+" order conflict: existing "+old.join(" → ")+", proposed "+op.order.join(" → ")+".");
      } else {
        const ex=exercises.find(function(e){return e.id===op.exerciseId;}); if(!ex) errors.push(label+", exercise "+op.exerciseId+": ID is unknown, inactive, or belongs to another day.");
        if((lc.inactiveIds||{})[op.exerciseId]) errors.push(label+", exercise "+op.exerciseId+": inactive IDs cannot be modified.");
        Object.keys(op.fields).forEach(function(f){
          if(PROGRAM_PROPOSAL_EXERCISE_MODIFY_FIELDS.indexOf(f)<0) errors.push(label+", exercise "+op.exerciseId+", field "+f+": unsupported field.");
          const old=(ov[op.exerciseId]||{}); if(Object.prototype.hasOwnProperty.call(old,f)&&old[f]!==op.fields[f]) errors.push(label+", exercise "+op.exerciseId+", field "+f+" conflict: existing "+p954Value(old[f])+", proposed "+p954Value(op.fields[f])+".");
          const current=ex?getF(op.exerciseId,f,ex[f]):undefined; if(f==="name"&&current!==op.fields[f]&&exClassifyChange(current,op.fields[f])!=="tweak") errors.push(label+", exercise "+op.exerciseId+", field name: proposed name is replacement-classified and cannot be applied.");
        });
      }
    }
  });
  return {valid:!errors.length,errors};
}
function p954BuildApplicationSummary(plan){
  const keys=[], modified={}; let reordered=0;
  plan.ops.forEach(function(op){if(["dayOverride","disable","dayAddition"].indexOf(op.type)>=0)keys.push(op.gymKey+":"+op.dayIdx);if(op.type==="orderOverride"&&op.writeNeeded)reordered++;if(op.type==="exerciseOverride"&&op.writeNeeded)modified[op.exerciseId]=true;});
  return {keepCount:plan.counts.keep,modifyCount:plan.counts.modify,disabledCount:0,addedCount:0,deferredDayLifecycleCount:plan.counts.deferredDayLifecycleCount||0,skippedExerciseActionCount:plan.counts.skippedExerciseActionCount,reorderedDayCount:reordered,modifiedExerciseCount:Object.keys(modified).length,skippedReplaceCount:plan.counts.skippedReplaceCount,skippedAddCount:plan.counts.skippedAddCount,skippedRemoveCount:plan.counts.skippedRemoveCount,skippedReactivateCount:plan.counts.skippedReactivateCount,reorderResults:plan.ops.filter(function(op){return op.type==="orderOverride";}).map(function(op){return{gymKey:op.gymKey,dayIdx:op.dayIdx,status:op.writeNeeded?"Applied":"Unchanged"};}),exerciseActionResults:plan.ops.filter(function(op){return op.type==="exerciseOverride";}).map(function(op){return{gymKey:op.gymKey,dayIdx:op.dayIdx,exerciseId:op.exerciseId,status:op.writeNeeded?"Applied":"Unchanged"};}),affectedGymModes:plan.affectedGymModes.slice(),appliedDayKeys:keys,warnings:(plan.errors||[]).slice()};
}
function p954RawState(key){const raw=localStorage.getItem(key);return{existed:raw!==null,rawText:raw};}
function p954CaptureRollbackSnapshot(){return{lifecycle:p954RawState(LIFECYCLE_KEY),overrides:p954RawState(OVR),proposal:p954RawState(PROGRAM_PROPOSAL_KEY)};}
function p954RestoreFromRollbackSnapshot(s){try{[[LIFECYCLE_KEY,s.lifecycle],[OVR,s.overrides],[PROGRAM_PROPOSAL_KEY,s.proposal]].forEach(function(x){x[1].existed?localStorage.setItem(x[0],x[1].rawText):localStorage.removeItem(x[0]);});return true;}catch(e){console.warn("[MarcusFit] exact rollback failed",e);return false;}}
function p954CloneUndoValue(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));}
function p954OwnUndoState(obj,key){const existed=!!obj&&Object.prototype.hasOwnProperty.call(obj,key);return{existed:existed,value:existed?p954CloneUndoValue(obj[key]):undefined};}
function p954UndoRecord(lc,section,gymKey,dayIdx){const byGym=(lc[section]||{})[gymKey];return byGym&&Object.prototype.hasOwnProperty.call(byGym,String(dayIdx))?byGym[String(dayIdx)]:undefined;}
function p954UndoDeepEqual(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function p954BuildScopedUndoSnapshot(plan,beforeLc,beforeOv,afterLc,afterOv){
  const scoped={version:1,lifecycle:{dayOverrideFields:[],dayAdditions:[],disabledDays:[],orderOverrides:[]},overrides:{fields:[]}};
  function dayField(gymKey,dayIdx,field){
    const beforeRecord=p954UndoRecord(beforeLc,"dayOverrides",gymKey,dayIdx),afterRecord=p954UndoRecord(afterLc,"dayOverrides",gymKey,dayIdx);
    scoped.lifecycle.dayOverrideFields.push({gymKey:gymKey,dayIdx:dayIdx,field:field,before:p954OwnUndoState(beforeRecord,field),after:p954OwnUndoState(afterRecord,field),recordBeforeExisted:beforeRecord!==undefined,gymBeforeExisted:Object.prototype.hasOwnProperty.call(beforeLc.dayOverrides||{},gymKey)});
  }
  function fullRecord(kind,section,gymKey,dayIdx){
    const before=p954UndoRecord(beforeLc,section,gymKey,dayIdx),after=p954UndoRecord(afterLc,section,gymKey,dayIdx);
    if(!p954UndoDeepEqual(before,after))scoped.lifecycle[kind].push({gymKey:gymKey,dayIdx:dayIdx,before:{existed:before!==undefined,value:p954CloneUndoValue(before)},after:{existed:after!==undefined,value:p954CloneUndoValue(after)},gymBeforeExisted:Object.prototype.hasOwnProperty.call(beforeLc[section]||{},gymKey)});
  }
  (plan.ops||[]).forEach(function(op){
    if(op.type==="dayOverride"){
      const seen={};Object.keys(op.fields||{}).concat(["updatedAt","reason"]).forEach(function(field){if(!seen[field]){seen[field]=true;dayField(op.gymKey,op.dayIdx,field);}});
    }else if(op.type==="disable")fullRecord("disabledDays","disabledDays",op.gymKey,op.dayIdx);
    else if(op.type==="dayAddition")fullRecord("dayAdditions","dayAdditions",op.gymKey,op.dayIdx);
    else if(op.type==="orderOverride"&&op.writeNeeded){const key=op.gymKey+":"+op.dayIdx;scoped.lifecycle.orderOverrides.push({key:key,gymKey:op.gymKey,dayIdx:op.dayIdx,before:p954OwnUndoState(beforeLc.orderOverrides||{},key),after:p954OwnUndoState(afterLc.orderOverrides||{},key)});}
    else if(op.type==="exerciseOverride"&&op.writeNeeded){const beforeRecord=(beforeOv||{})[op.exerciseId],afterRecord=(afterOv||{})[op.exerciseId];Object.keys(op.fields||{}).forEach(function(field){if(op.fieldStates[field]&&op.fieldStates[field].writeNeeded)scoped.overrides.fields.push({exerciseId:op.exerciseId,field:field,before:p954OwnUndoState(beforeRecord,field),after:p954OwnUndoState(afterRecord,field),recordBeforeExisted:beforeRecord!==undefined});});}
  });
  return scoped;
}
function p954BuildPersistedPreApplySnapshot(proposal,rollback,appliedRaw,applicationId,plan,afterLc,afterOv){
  const lc=JSON.parse(rollback.lifecycle.rawText||JSON.stringify(exLifecycleDefault())),ov=JSON.parse(rollback.overrides.rawText||"{}");
  return{
    dayOverrides:JSON.parse(JSON.stringify(lc.dayOverrides||{})),
    dayAdditions:JSON.parse(JSON.stringify(lc.dayAdditions||{})),
    disabledDays:JSON.parse(JSON.stringify(lc.disabledDays||{})),
    orderOverrides:JSON.parse(JSON.stringify(lc.orderOverrides||{})),
    overrides:JSON.parse(JSON.stringify(ov||{})),
    proposal:JSON.parse(JSON.stringify(proposal)),
    // 9.5.4E: exact byte-for-byte states required for guarded undo. These are
    // additive; accepted C/D snapshots without them remain readable but are
    // intentionally not auto-undoable because exact raw history cannot be invented.
    rawStorage:{
      lifecycle:{existed:rollback.lifecycle.existed,rawText:rollback.lifecycle.rawText},
      overrides:{existed:rollback.overrides.existed,rawText:rollback.overrides.rawText}
    },
    expectedAppliedRaw:{lifecycle:appliedRaw.lifecycle,overrides:appliedRaw.overrides},
    applicationId:applicationId,
    // 9.5.4E correction: operation-scoped before/after values permit undo to
    // preserve unrelated lifecycle and override changes made after apply.
    scopedUndo:p954BuildScopedUndoSnapshot(plan,lc,ov,afterLc,afterOv)
  };
}
function p954SafetyFacts(lc){const ids=[];p954GetRecognizedProposalGymKeys().forEach(function(g){getResolvedDays(g).forEach(function(d){(d.exercises||[]).forEach(function(e){ids.push(g+":"+d._dayIdx+":"+e.id);});});});return{activeExerciseCount:ids.length,exerciseIds:ids.sort(),inactiveIds:JSON.stringify(lc.inactiveIds||{}),customExercises:JSON.stringify(lc.customExercises||{}),replacements:JSON.stringify(lc.replacements||{}),recommendations:localStorage.getItem(RECS_KEY),otherStorage:Array.from({length:localStorage.length},function(_,i){return localStorage.key(i);}).filter(function(k){return k!==LIFECYCLE_KEY&&k!==OVR&&k!==PROGRAM_PROPOSAL_KEY&&k!==RECS_KEY;}).sort().map(function(k){return[k,localStorage.getItem(k)];})};}
function p954VerifyPlanApplied(plan,applicationId,before,beforeOvr){
  const errors=[],lc=getLifecycle(),ov=getOvr(); plan.ops.forEach(function(op){
    if(op.type==="dayOverride"){const r=((lc.dayOverrides||{})[op.gymKey]||{})[String(op.dayIdx)]||{};Object.keys(op.fields).forEach(function(f){if(r[f]!==op.fields[f])errors.push("Day override verification failed: "+f);});}
    else if(op.type==="disable"&&!(((lc.disabledDays||{})[op.gymKey]||{})[String(op.dayIdx)]))errors.push("Disabled day verification failed.");
    else if(op.type==="dayAddition"&&!(((lc.dayAdditions||{})[op.gymKey]||{})[String(op.dayIdx)]))errors.push("Day addition verification failed.");
    else if(op.type==="orderOverride"&&!p954StrictArrayEqual((lc.orderOverrides||{})[op.gymKey+":"+op.dayIdx]||op.currentOrder,op.order))errors.push("Order verification failed at "+op.gymKey+" day "+(op.dayIdx+1)+".");
    else if(op.type==="exerciseOverride")Object.keys(op.fields).forEach(function(f){if((ov[op.exerciseId]||{})[f]!==op.fields[f]&&op.fieldStates[f].writeNeeded)errors.push("Exercise override verification failed for "+op.exerciseId+" "+f+".");});
  });
  Object.keys(beforeOvr).forEach(function(id){Object.keys(beforeOvr[id]||{}).forEach(function(f){const planned=plan.ops.some(function(op){return op.type==="exerciseOverride"&&op.exerciseId===id&&Object.prototype.hasOwnProperty.call(op.fields,f);});if(!planned&&(ov[id]||{})[f]!==beforeOvr[id][f])errors.push("Unrelated override changed: "+id+" "+f);});});
  const after=p954SafetyFacts(lc); if(before.activeExerciseCount!==after.activeExerciseCount)errors.push("Active exercise count changed.");if(!p954StrictArrayEqual(before.exerciseIds,after.exerciseIds))errors.push("Active exercise IDs changed.");["inactiveIds","customExercises","replacements","recommendations","otherStorage"].forEach(function(f){if(JSON.stringify(before[f])!==JSON.stringify(after[f]))errors.push("Protected state changed: "+f);});
  return{valid:!errors.length,errors,after};
}
function p954ApplyProposal(expectedFingerprint){
  let rollback=null; try{
    const ins=p954InspectStoredProposal();if(!ins.exists||!ins.parses||!ins.validation.valid)return{ok:false,error:"Stored proposal is missing, corrupted, or invalid."};const proposal=ins.normalized;
    if(proposal.status==="applied")return{ok:true,alreadyApplied:true,applicationId:proposal.applicationId,summary:proposal.applicationSummary};if(proposal.status!=="draft")return{ok:false,error:"Only a draft proposal can be applied."};
    if(typeof expectedFingerprint==="string"&&expectedFingerprint!==p954ComputeProposalFingerprint(proposal))return{ok:false,error:"The proposal changed since preview. Reopen preview."};
    const plan=p954BuildApplicationPlan(proposal);if(!plan.valid)return{ok:false,error:"Application plan is invalid: "+plan.errors.join(" ")};if(p955GetProposalQualityMetrics(proposal).safeApplyCount===0)return{ok:false,noSupportedChanges:true,error:"This proposal has no supported changes to apply."};const applicationId=p954GenerateApplicationId(proposal),live=p954ValidatePlanAgainstLiveState(plan,applicationId);p954LastLiveValidationErrors=live.errors.slice();if(!live.valid)return{ok:false,error:"Cannot apply safely: "+live.errors.join(" ")};
    rollback=p954CaptureRollbackSnapshot();const lc=JSON.parse(rollback.lifecycle.rawText||JSON.stringify(exLifecycleDefault())),ov=JSON.parse(rollback.overrides.rawText||"{}"),beforeOvr=JSON.parse(JSON.stringify(ov)),before=p954SafetyFacts(lc),now=new Date().toISOString(),tag="proposal:"+applicationId;
    lc.dayOverrides=lc.dayOverrides||{};lc.dayAdditions=lc.dayAdditions||{};lc.disabledDays=lc.disabledDays||{};lc.orderOverrides=lc.orderOverrides||{};
    plan.ops.forEach(function(op){const key=String(op.dayIdx);
      if(op.type==="dayOverride"){lc.dayOverrides[op.gymKey]=lc.dayOverrides[op.gymKey]||{};lc.dayOverrides[op.gymKey][key]=Object.assign({},lc.dayOverrides[op.gymKey][key]||{},op.fields,{updatedAt:now,reason:tag+(op.reason?" — "+op.reason:"")});}
      else if(op.type==="disable"){lc.disabledDays[op.gymKey]=lc.disabledDays[op.gymKey]||{};if(!lc.disabledDays[op.gymKey][key])lc.disabledDays[op.gymKey][key]={disabledAt:now,source:"onboarding_proposal",proposalId:applicationId,reason:op.reason||""};}
      else if(op.type==="dayAddition"){lc.dayAdditions[op.gymKey]=lc.dayAdditions[op.gymKey]||{};if(!lc.dayAdditions[op.gymKey][key])lc.dayAdditions[op.gymKey][key]=Object.assign({},op.fields,{createdAt:now,updatedAt:now,reason:tag+(op.reason?" — "+op.reason:"")});}
      else if(op.type==="orderOverride"&&op.writeNeeded)lc.orderOverrides[op.gymKey+":"+op.dayIdx]=op.order.slice();
      else if(op.type==="exerciseOverride"&&op.writeNeeded){ov[op.exerciseId]=ov[op.exerciseId]||{};Object.keys(op.fields).forEach(function(f){if(op.fieldStates[f].writeNeeded)ov[op.exerciseId][f]=op.fields[f];});}
    });
    const lifecycleRaw=JSON.stringify(lc),overridesRaw=JSON.stringify(ov),summary=p954BuildApplicationSummary(plan),snapshot=p954BuildPersistedPreApplySnapshot(proposal,rollback,{lifecycle:lifecycleRaw,overrides:overridesRaw},applicationId,plan,lc,ov),applied=Object.assign({},proposal,{status:"applied",appliedAt:now,applicationId,applicationSummary:summary,preApplySnapshot:snapshot,undoneAt:null,undoSummary:null});
    localStorage.setItem(LIFECYCLE_KEY,lifecycleRaw);localStorage.setItem(OVR,overridesRaw);localStorage.setItem(PROGRAM_PROPOSAL_KEY,JSON.stringify(p954NormalizeProposal(applied)));
    const verify=p954VerifyPlanApplied(plan,applicationId,before,beforeOvr);p954LastPostApplyValidationErrors=verify.errors.slice();const post=p954InspectStoredProposal();if(!verify.valid||!post.validation.valid||post.normalized.status!=="applied"||!post.normalized.appliedAt||!post.normalized.applicationId||!post.normalized.applicationSummary||!post.normalized.preApplySnapshot)throw new Error((verify.errors.join(" ")||"Applied proposal verification failed."));
    p954LastSafetyFacts={before:before.activeExerciseCount,after:verify.after.activeExerciseCount,idsUnchanged:p954StrictArrayEqual(before.exerciseIds,verify.after.exerciseIds)};return{ok:true,applicationId,summary};
  }catch(e){if(rollback)p954RestoreFromRollbackSnapshot(rollback);return{ok:false,error:"Application failed and all three keys were restored exactly: "+((e&&e.message)||"Unknown error")};}
}



// Console QA: mfBuildExerciseProposalFixture() is read-only;
// mfSaveExerciseProposalFixture() saves a draft only; neither helper applies it.
window.mfBuildExerciseProposalFixture = function(){
  const gymKey=p954GetRecognizedProposalGymKeys()[0],day=getResolvedDays(gymKey).find(function(d){return !isDayDisabled(gymKey,d._dayIdx)&&(d.exercises||[]).length>=4;});
  if(!day) throw new Error("Fixture needs an active day with at least four exercises.");
  const ex=day.exercises,proposal=p954GetDefaultProposal(); proposal.generatedAt=new Date().toISOString();proposal.sourceType="fixture";proposal.source="developer_fixture";proposal.sourceSummary={generatedAt:proposal.generatedAt,appVersion:APP_VERSION,proposalEngineVersion:PROGRAM_PROPOSAL_ENGINE_VERSION,profileUsed:false,onboardingUsed:false,coachingPrefsUsed:false,currentProgramUsed:true,lifecycleUsed:true,recentLogsUsed:false,profileFields:[],onboardingSections:[],lifecycleSignals:["fixture_live_day_lookup"],sourceWarnings:["Developer QA fixture: not a recommendation generated from user context.","Recent workout logs were not used."]};proposal.summary.gymModes=[gymKey];proposal.summary.affectedDayCount=1;
  proposal.dayPlans=[{gymKey:gymKey,dayIdx:day._dayIdx,dayName:day.name||day.day||("Day "+(day._dayIdx+1)),role:"lifting",action:"keep",tweaks:[],notes:"Deterministic 9.5.5 exercise application QA fixture.",rationale:"Exercises are intentionally reversed to verify same-day reorder safety while preserving IDs.",safetyTag:"safe_apply",confidence:"test_only",proposedExerciseOrder:ex.map(function(e){return e.id;}).reverse(),exerciseActions:[
    {exerciseId:ex[0].id,action:"modify",fields:{sets:(Number.isInteger(ex[0].sets)&&ex[0].sets>0)?ex[0].sets:3},rationale:"Metadata-only idempotency baseline; stable ID and history remain unchanged.",safetyTag:"safe_apply",confidence:"test_only"},
    {exerciseId:ex[1].id,action:"replace",fields:{},rationale:"Replacement is shown only to exercise review UI and validator coverage; risky lifecycle application remains deferred.",safetyTag:"deferred_lifecycle",confidence:"test_only"},
    {exerciseId:null,action:"add",fields:{name:"Deferred fixture exercise"},rationale:"Addition remains review-only because creating lifecycle records is outside this safe-apply phase.",safetyTag:"deferred_lifecycle",confidence:"test_only"},
    {exerciseId:ex[2].id,action:"remove",fields:{},rationale:"Removal remains review-only so the stable exercise ID and workout history cannot be disrupted.",safetyTag:"deferred_lifecycle",confidence:"test_only"},
    {exerciseId:ex[3].id,action:"reactivate",fields:{},rationale:"Reactivation remains review-only until lifecycle conflict handling is explicitly implemented.",safetyTag:"deferred_lifecycle",confidence:"test_only"}
  ]}]; return p954NormalizeProposal(proposal);
};
window.mfSaveExerciseProposalFixture = function(){return p954SaveProposal(window.mfBuildExerciseProposalFixture());};
var mfBuildExerciseProposalFixture=window.mfBuildExerciseProposalFixture;
var mfSaveExerciseProposalFixture=window.mfSaveExerciseProposalFixture;

// Read-only, concise application-focused debug helper (separate from the
// broader mfOnboardingProgramProposalDebug below, which also gets extended).
window.mfOnboardingProgramProposalApplicationDebug = function(){
  try {
    const proposal = p954GetProposal();
    const lc = getLifecycle();
    const undoPlan = p954BuildUndoPlan(proposal === null ? undefined : proposal);
    const result = {
      status: proposal ? proposal.status : null,
      applicationId: proposal ? proposal.applicationId : null,
      appliedAt: proposal ? proposal.appliedAt : null,
      undoneAt: proposal ? proposal.undoneAt : null,
      planCounts: proposal ? p954BuildApplicationPlan(proposal).counts : null,
      plannedReorderCount: proposal ? p954BuildApplicationPlan(proposal).counts.plannedReorderCount : 0,
      plannedExerciseModifyCount: proposal ? p954BuildApplicationPlan(proposal).counts.plannedExerciseModifyCount : 0,
      liveValidationErrors: p954LastLiveValidationErrors.slice(),
      postApplyValidationErrors: p954LastPostApplyValidationErrors.slice(),
      activeExerciseCountBefore: p954LastSafetyFacts.before,
      activeExerciseCountAfter: p954LastSafetyFacts.after,
      exerciseIdsUnchanged: p954LastSafetyFacts.idsUnchanged,
      disabledDaySummary: { total: getDisabledDayCount(lc), byGym: Object.keys(lc.disabledDays || {}).reduce(function(acc, g){ acc[g] = Object.keys(lc.disabledDays[g] || {}).length; return acc; }, {}) },
      proposalCreatedDayAdditions: Object.keys(lc.dayAdditions || {}).reduce(function(acc, g){
        acc[g] = Object.keys(lc.dayAdditions[g] || {}).filter(function(k){ return typeof lc.dayAdditions[g][k].reason === "string" && lc.dayAdditions[g][k].reason.indexOf("proposal:") === 0; }).length;
        return acc;
      }, {}),
      proposalCreatedDayOverrides: Object.keys(lc.dayOverrides || {}).reduce(function(acc, g){
        acc[g] = Object.keys(lc.dayOverrides[g] || {}).filter(function(k){ return typeof lc.dayOverrides[g][k].reason === "string" && lc.dayOverrides[g][k].reason.indexOf("proposal:") === 0; }).length;
        return acc;
      }, {}),
      snapshotAvailable: !!(proposal && proposal.preApplySnapshot),
      snapshotValidForUndo: proposal ? p954ValidateUndoSnapshot(proposal).valid : false,
      canUndo: undoPlan.canUndo,
      undoConflicts: undoPlan.conflicts,
      undoWarnings: undoPlan.warnings,
      lastUndoValidationErrors: p954LastUndoValidationErrors.slice(),
      lastPostUndoValidationErrors: p954LastPostUndoValidationErrors.slice(),
      exactRawRestorationVerified: p954LastUndoVerification.exactRawRestorationVerified,
      idempotencyStatus: undoPlan.alreadyUndone ? "already-undone/no-op" : p954LastUndoVerification.idempotencyStatus,
      validationErrors: proposal ? p954ValidateProgramProposal(proposal).errors : []
    };
    console.log("[MarcusFit] mfOnboardingProgramProposalApplicationDebug():", result);
    return result;
  } catch(e){
    const result = { error: (e && e.message) || "Unknown error" };
    console.warn("[MarcusFit] mfOnboardingProgramProposalApplicationDebug failed:", e && e.message);
    return result;
  }
};

// Read-only, safe-clone accessor for an applied proposal's pre-apply
// snapshot. Read-only accessor; 9.5.4E's guarded undo path validates and uses
// the snapshot separately and never mutates through this helper.
function p954GetApplicationSnapshot(){
  try {
    const proposal = p954GetProposal();
    if(!proposal || !proposal.preApplySnapshot) return null;
    return JSON.parse(JSON.stringify(proposal.preApplySnapshot));
  } catch(e){
    return null;
  }
}
window.p954GetApplicationSnapshot = p954GetApplicationSnapshot;

// ── PHASE 9.5.4E: USER-FACING APPLIED PROPOSAL UNDO ─────────────────────────
// One guarded reversal of the currently saved applied proposal. This is not
// an undo stack: only the exact raw lifecycle/override state captured by the
// application above can be restored, and the proposal remains as audit data.
let p954LastUndoValidationErrors = [];
let p954LastPostUndoValidationErrors = [];
let p954LastUndoVerification = {exactRawRestorationVerified:null,unrelatedStatePreserved:null,idempotencyStatus:null};

function p954ValidateUndoSnapshot(proposal){
  const result={available:false,valid:false,scopedAvailable:false,scopedValid:false,errors:[],warnings:[]},snap=proposal&&proposal.preApplySnapshot;
  if(!snap||typeof snap!=="object"||Array.isArray(snap)){result.errors.push("No pre-apply snapshot is available.");return result;}
  result.available=true;
  function validRawState(label,state){
    if(!state||typeof state!=="object"||Array.isArray(state)){result.errors.push(label+" raw snapshot is missing or malformed.");return;}
    if(typeof state.existed!=="boolean")result.errors.push(label+" raw snapshot has an invalid existed flag.");
    if(state.existed&&typeof state.rawText!=="string")result.errors.push(label+" raw snapshot is missing its original raw string.");
    if(!state.existed&&state.rawText!==null)result.errors.push(label+" raw snapshot must use null when the key was originally absent.");
    if(state.existed&&typeof state.rawText==="string"){try{const parsed=JSON.parse(state.rawText);if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("not an object");}catch(e){result.errors.push(label+" original raw value is not a valid JSON object.");}}
  }
  if(!snap.rawStorage||typeof snap.rawStorage!=="object"||Array.isArray(snap.rawStorage))result.errors.push("Exact pre-apply raw storage is unavailable (legacy snapshot).");
  else {validRawState("Exercise lifecycle",snap.rawStorage.lifecycle);validRawState("Exercise overrides",snap.rawStorage.overrides);}
  if(!snap.expectedAppliedRaw||typeof snap.expectedAppliedRaw!=="object"||Array.isArray(snap.expectedAppliedRaw))result.errors.push("Expected applied raw storage is unavailable (legacy snapshot).");
  else ["lifecycle","overrides"].forEach(function(f){
    const raw=snap.expectedAppliedRaw[f];
    if(typeof raw!=="string")result.errors.push("Expected applied "+f+" raw value is missing.");
    else try{const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("not an object");}catch(e){result.errors.push("Expected applied "+f+" raw value is malformed.");}
  });
  if(typeof snap.applicationId!=="string"||!snap.applicationId||snap.applicationId!==(proposal&&proposal.applicationId))result.errors.push("Snapshot application identity does not match this proposal.");
  if(!snap.proposal||typeof snap.proposal!=="object"||Array.isArray(snap.proposal))result.errors.push("Snapshot proposal identity is missing.");
  else if(proposal&&p954GenerateApplicationId(snap.proposal)!==proposal.applicationId)result.errors.push("Original proposal fingerprint no longer matches the application ID.");
  if(snap.scopedUndo===undefined){
    result.warnings.push("Scoped undo data is unavailable (legacy snapshot); only an exact whole-state fallback may be safe.");
  }else{
    const scoped=snap.scopedUndo;
    result.scopedAvailable=true;
    function validState(state,label){if(!state||typeof state!=="object"||typeof state.existed!=="boolean")result.errors.push("Scoped undo "+label+" state is malformed.");}
    if(!scoped||typeof scoped!=="object"||Array.isArray(scoped)||scoped.version!==1||!scoped.lifecycle||!scoped.overrides)result.errors.push("Scoped undo data is malformed.");
    else {
      const lifecycle=scoped.lifecycle,overrides=scoped.overrides;
      ["dayOverrideFields","dayAdditions","disabledDays","orderOverrides"].forEach(function(k){if(!Array.isArray(lifecycle[k]))result.errors.push("Scoped lifecycle "+k+" is invalid.");});
      if(!Array.isArray(overrides.fields))result.errors.push("Scoped exercise overrides are invalid.");
      (lifecycle.dayOverrideFields||[]).forEach(function(x,i){if(!x||typeof x.gymKey!=="string"||!Number.isInteger(x.dayIdx)||typeof x.field!=="string")result.errors.push("Scoped day override entry "+i+" is invalid.");else{validState(x.before,"day override before");validState(x.after,"day override after");}});
      ["dayAdditions","disabledDays","orderOverrides"].forEach(function(k){(lifecycle[k]||[]).forEach(function(x,i){if(!x||typeof x!=="object")result.errors.push("Scoped "+k+" entry "+i+" is invalid.");else{validState(x.before,k+" before");validState(x.after,k+" after");}});});
      (overrides.fields||[]).forEach(function(x,i){if(!x||typeof x.exerciseId!=="string"||typeof x.field!=="string")result.errors.push("Scoped override entry "+i+" is invalid.");else{validState(x.before,"override before");validState(x.after,"override after");}});
      result.scopedValid=result.errors.length===0;
    }
  }
  result.valid=result.errors.length===0;
  return result;
}

function p954UndoRawMatches(rawState,currentRaw){return rawState.existed?currentRaw===rawState.rawText:currentRaw===null;}
function p954UndoStateEqual(a,b){return !!a&&!!b&&a.existed===b.existed&&(!a.existed||p954UndoDeepEqual(a.value,b.value));}
function p954ParseUndoLiveState(){try{return{ok:true,lc:JSON.parse(localStorage.getItem(LIFECYCLE_KEY)||JSON.stringify(exLifecycleDefault())),ov:JSON.parse(localStorage.getItem(OVR)||"{}")};}catch(e){return{ok:false,error:"Current lifecycle or override storage is malformed."};}}
function p954FormatScopedUndoDayLabel(entry){const raw=entry&&typeof entry.gymLabel==="string"&&entry.gymLabel.trim()?entry.gymLabel.trim():(entry&&typeof entry.gymKey==="string"&&entry.gymKey?entry.gymKey:"Gym"),gym=raw.charAt(0).toUpperCase()+raw.slice(1),day=entry&&Number.isInteger(entry.dayIdx)?entry.dayIdx+1:null;return day===null?gym:gym+" Day "+day;}
function p954GetScopedUndoEntries(scoped){
  const l=scoped.lifecycle,o=scoped.overrides,entries=[];
  (l.dayOverrideFields||[]).forEach(function(x){entries.push({kind:"dayOverrideField",entry:x,before:x.before,after:x.after,label:"Day override "+x.gymKey+" day "+(x.dayIdx+1)+" · "+x.field,storage:"lifecycle"});});
  (l.dayAdditions||[]).forEach(function(x){entries.push({kind:"dayAddition",entry:x,before:x.before,after:x.after,label:"Day addition "+x.gymKey+" day "+(x.dayIdx+1),storage:"lifecycle"});});
  (l.disabledDays||[]).forEach(function(x){entries.push({kind:"disabledDay",entry:x,before:x.before,after:x.after,label:"Disabled day "+x.gymKey+" day "+(x.dayIdx+1),storage:"lifecycle"});});
  (l.orderOverrides||[]).forEach(function(x){entries.push({kind:"orderOverride",entry:x,before:x.before,after:x.after,label:"Exercise order — "+p954FormatScopedUndoDayLabel(x),storage:"lifecycle"});});
  (o.fields||[]).forEach(function(x){entries.push({kind:"overrideField",entry:x,before:x.before,after:x.after,label:"Exercise override "+x.exerciseId+" · "+x.field,storage:"overrides"});});
  return entries;
}
function p954GetScopedUndoCurrent(lc,ov,op){const x=op.entry;if(op.kind==="dayOverrideField")return p954OwnUndoState(p954UndoRecord(lc,"dayOverrides",x.gymKey,x.dayIdx),x.field);if(op.kind==="dayAddition")return p954OwnUndoState((lc.dayAdditions||{})[x.gymKey],String(x.dayIdx));if(op.kind==="disabledDay")return p954OwnUndoState((lc.disabledDays||{})[x.gymKey],String(x.dayIdx));if(op.kind==="orderOverride")return p954OwnUndoState(lc.orderOverrides||{},x.key);return p954OwnUndoState((ov||{})[x.exerciseId],x.field);}
function p954PruneUndoEmpty(obj){if(!obj||typeof obj!=="object"||Array.isArray(obj))return obj;Object.keys(obj).forEach(function(k){p954PruneUndoEmpty(obj[k]);if(obj[k]&&typeof obj[k]==="object"&&!Array.isArray(obj[k])&&!Object.keys(obj[k]).length)delete obj[k];});return obj;}
function p954ProjectUndoUnrelated(lc,ov,scoped){const a=p954CloneUndoValue(lc),b=p954CloneUndoValue(ov);p954GetScopedUndoEntries(scoped).forEach(function(op){const x=op.entry;if(op.kind==="dayOverrideField"){const r=p954UndoRecord(a,"dayOverrides",x.gymKey,x.dayIdx);if(r)delete r[x.field];}else if(op.kind==="dayAddition"&&a.dayAdditions&&a.dayAdditions[x.gymKey])delete a.dayAdditions[x.gymKey][String(x.dayIdx)];else if(op.kind==="disabledDay"&&a.disabledDays&&a.disabledDays[x.gymKey])delete a.disabledDays[x.gymKey][String(x.dayIdx)];else if(op.kind==="orderOverride"&&a.orderOverrides)delete a.orderOverrides[x.key];else if(op.kind==="overrideField"&&b[x.exerciseId])delete b[x.exerciseId][x.field];});return{lifecycle:p954PruneUndoEmpty(a),overrides:p954PruneUndoEmpty(b)};}
function p954RestoreScopedUndoOperation(lc,ov,op){const x=op.entry,b=op.before;if(op.kind==="dayOverrideField"){lc.dayOverrides=lc.dayOverrides||{};lc.dayOverrides[x.gymKey]=lc.dayOverrides[x.gymKey]||{};const key=String(x.dayIdx),r=lc.dayOverrides[x.gymKey][key]=lc.dayOverrides[x.gymKey][key]||{};if(b.existed)r[x.field]=p954CloneUndoValue(b.value);else delete r[x.field];if(!x.recordBeforeExisted&&!Object.keys(r).length){delete lc.dayOverrides[x.gymKey][key];if(!x.gymBeforeExisted&&!Object.keys(lc.dayOverrides[x.gymKey]).length)delete lc.dayOverrides[x.gymKey];}}
  else if(op.kind==="dayAddition"||op.kind==="disabledDay"){const section=op.kind==="dayAddition"?"dayAdditions":"disabledDays",map=lc[section]=lc[section]||{},gym=map[x.gymKey]=map[x.gymKey]||{},key=String(x.dayIdx);if(b.existed)gym[key]=p954CloneUndoValue(b.value);else delete gym[key];if(!x.gymBeforeExisted&&!Object.keys(gym).length)delete map[x.gymKey];}
  else if(op.kind==="orderOverride"){lc.orderOverrides=lc.orderOverrides||{};if(b.existed)lc.orderOverrides[x.key]=p954CloneUndoValue(b.value);else delete lc.orderOverrides[x.key];}
  else {const r=ov[x.exerciseId]=ov[x.exerciseId]||{};if(b.existed)r[x.field]=p954CloneUndoValue(b.value);else delete r[x.field];if(!x.recordBeforeExisted&&!Object.keys(r).length)delete ov[x.exerciseId];}}

// Authoritative read-only eligibility/planning function. It inspects only the
// proposal and the two storage keys that undo may restore. Unrelated keys do
// not affect eligibility.
function p954BuildUndoPlan(proposalArg){
  const result={canUndo:false,alreadyUndone:false,status:"unavailable",proposalStatus:null,applicationId:null,snapshotAvailable:false,snapshotValid:false,scopedUndoAvailable:false,operations:[],conflicts:[],errors:[],warnings:[],facts:{}};
  let proposal=proposalArg;
  if(proposal===undefined){
    const inspection=p954InspectStoredProposal();
    if(!inspection.exists){result.status="no_proposal";result.errors.push("No saved proposal exists.");return result;}
    if(!inspection.parses||!inspection.validation.valid||!inspection.normalized){result.status="invalid_proposal";result.errors=result.errors.concat(inspection.validation.errors.length?inspection.validation.errors:["The saved proposal is malformed."]);return result;}
    proposal=inspection.normalized;
  }
  result.proposalStatus=proposal&&proposal.status||null;
  result.applicationId=proposal&&proposal.applicationId||null;
  const snapshotValidation=p954ValidateUndoSnapshot(proposal);
  result.snapshotAvailable=snapshotValidation.available;
  result.snapshotValid=snapshotValidation.valid;
  result.scopedUndoAvailable=snapshotValidation.scopedAvailable&&snapshotValidation.scopedValid;
  result.warnings=result.warnings.concat(snapshotValidation.warnings);
  if(proposal&&proposal.status==="undone"){
    result.status="already_undone";result.alreadyUndone=true;result.facts.idempotencyStatus="already-undone/no-op";
    if(!snapshotValidation.valid)result.warnings=result.warnings.concat(snapshotValidation.errors);
    return result;
  }
  if(!proposal||proposal.status!=="applied"){
    result.status="wrong_status";result.errors.push("Only an applied proposal can be undone.");return result;
  }
  if(!snapshotValidation.valid){
    result.status=snapshotValidation.available?"malformed_snapshot":"no_snapshot";
    result.errors=result.errors.concat(snapshotValidation.errors);return result;
  }
  const snap=proposal.preApplySnapshot;
  if(result.scopedUndoAvailable){
    const live=p954ParseUndoLiveState();if(!live.ok){result.status="malformed_current_storage";result.errors.push(live.error);return result;}
    p954GetScopedUndoEntries(snap.scopedUndo).forEach(function(op){const current=p954GetScopedUndoCurrent(live.lc,live.ov,op),isApplied=p954UndoStateEqual(current,op.after),isRestored=p954UndoStateEqual(current,op.before);op.action=isRestored?"already-restored":"restore";op.currentState=isApplied?"expected-applied":isRestored?"already-restored":"conflict";result.operations.push(op);if(!isApplied&&!isRestored)result.conflicts.push(op.label+" changed after this proposal was applied. Automatic undo is blocked to avoid overwriting newer work.");});
    result.facts={applicationIdentityVerified:true,restorationScope:"proposal-affected-paths",affectedPathCount:result.operations.length,deferredActionCounts:{replace:(proposal.applicationSummary&&proposal.applicationSummary.skippedReplaceCount)||0,add:(proposal.applicationSummary&&proposal.applicationSummary.skippedAddCount)||0,remove:(proposal.applicationSummary&&proposal.applicationSummary.skippedRemoveCount)||0,reactivate:(proposal.applicationSummary&&proposal.applicationSummary.skippedReactivateCount)||0}};
  }else{
    [{key:LIFECYCLE_KEY,label:"Exercise lifecycle",pre:snap.rawStorage.lifecycle,expected:snap.expectedAppliedRaw.lifecycle},{key:OVR,label:"Exercise overrides",pre:snap.rawStorage.overrides,expected:snap.expectedAppliedRaw.overrides}].forEach(function(t){const current=localStorage.getItem(t.key),isApplied=current===t.expected,isRestored=p954UndoRawMatches(t.pre,current);result.operations.push({key:t.key,label:t.label,action:isRestored?"already-restored":(t.pre.existed?"restore":"remove"),currentState:isApplied?"expected-applied":isRestored?"already-restored":"conflict",legacy:true,pre:t.pre});if(!isApplied&&!isRestored)result.conflicts.push(t.label+" changed after this proposal was applied. Automatic undo is blocked to avoid overwriting newer work.");});
    result.facts={applicationIdentityVerified:true,restorationScope:"legacy-whole-storage",deferredActionCounts:{replace:(proposal.applicationSummary&&proposal.applicationSummary.skippedReplaceCount)||0,add:(proposal.applicationSummary&&proposal.applicationSummary.skippedAddCount)||0,remove:(proposal.applicationSummary&&proposal.applicationSummary.skippedRemoveCount)||0,reactivate:(proposal.applicationSummary&&proposal.applicationSummary.skippedReactivateCount)||0}};
  }
  const deferredTotal=Object.keys(result.facts.deferredActionCounts).reduce(function(n,k){return n+result.facts.deferredActionCounts[k];},0);
  if(deferredTotal)result.warnings.push(deferredTotal+" replace/add/remove/reactivate action(s) were deferred during application and require no restoration.");
  result.status=result.conflicts.length?"conflict":"ready";
  result.canUndo=!result.errors.length&&!result.conflicts.length;
  return result;
}
window.p954BuildUndoPlan=p954BuildUndoPlan;

function p954CaptureUntouchedStorage(){
  return Array.from({length:localStorage.length},function(_,i){return localStorage.key(i);}).filter(function(k){return k!==LIFECYCLE_KEY&&k!==OVR&&k!==PROGRAM_PROPOSAL_KEY;}).sort().map(function(k){return[k,localStorage.getItem(k)];});
}

function p954BuildUndoneProposal(proposal,plan,undoneAt){
  return Object.assign({},proposal,{status:"undone",undoneAt:undoneAt,undoSummary:{
    status:"success",
    applicationId:proposal.applicationId,
    storageResults:plan.operations.map(function(op){return{key:op.key||op.label,action:op.action==="already-restored"?"verified-already-restored":op.action};}),
    exactRawRestorationVerified:true,
    exactAffectedStateRestorationVerified:true,
    unrelatedStatePreserved:true,
    validationFacts:{applicationIdentityVerified:true,restorationScope:plan.facts.restorationScope,affectedPathCount:plan.facts.affectedPathCount||0,exactAffectedStateRestorationVerified:true,unrelatedStatePreserved:true,idempotencyAfterUndo:"already-undone/no-op"},
    deferredActionCounts:Object.assign({},plan.facts.deferredActionCounts)
  }});
}

function p954VerifyUndoPostState(proposalBefore,untouchedBefore,pBefore,unrelatedBefore,plan){
  const errors=[],snap=proposalBefore.preApplySnapshot,live=p954ParseUndoLiveState();
  if(!live.ok)errors.push(live.error);
  else if(plan.facts.restorationScope==="proposal-affected-paths"){
    plan.operations.forEach(function(op){if(!p954UndoStateEqual(p954GetScopedUndoCurrent(live.lc,live.ov,op),op.before))errors.push(op.label+" was not restored to its exact pre-apply value.");});
    const unrelatedAfter=p954ProjectUndoUnrelated(live.lc,live.ov,snap.scopedUndo);if(!p954UndoDeepEqual(unrelatedBefore,unrelatedAfter))errors.push("Unrelated lifecycle or override state changed during undo.");
  }else {if(!p954UndoRawMatches(snap.rawStorage.lifecycle,localStorage.getItem(LIFECYCLE_KEY)))errors.push("Exercise lifecycle exact raw restoration failed.");if(!p954UndoRawMatches(snap.rawStorage.overrides,localStorage.getItem(OVR)))errors.push("Exercise overrides exact raw restoration failed.");}
  const inspection=p954InspectStoredProposal(),post=inspection.normalized;
  if(!inspection.exists||!inspection.parses||!inspection.validation.valid||!post)errors.push("Undone proposal record failed validation.");
  else {
    if(post.status!=="undone")errors.push("Proposal status is not undone.");
    if(post.applicationId!==proposalBefore.applicationId||post.appliedAt!==proposalBefore.appliedAt||!post.applicationSummary||!post.preApplySnapshot)errors.push("Original application audit information was not preserved.");
    if(!post.undoneAt||!post.undoSummary||post.undoSummary.exactRawRestorationVerified!==true||post.undoSummary.exactAffectedStateRestorationVerified!==true||post.undoSummary.unrelatedStatePreserved!==true)errors.push("Undo audit metadata is missing or invalid.");
    const idempotent=p954BuildUndoPlan(post);if(!idempotent.alreadyUndone||idempotent.canUndo)errors.push("Undo is not idempotent after completion.");
  }
  if(JSON.stringify(P)!==pBefore)errors.push("Base program P changed during undo.");
  if(JSON.stringify(p954CaptureUntouchedStorage())!==JSON.stringify(untouchedBefore))errors.push("An unrelated storage key changed during undo.");
  return{valid:!errors.length,errors:errors};
}

// Final mutation path with an immediate direct-call preflight and byte-exact
// rollback of every touched key on any error.
function p954UndoAppliedProposal(){
  let rollback=null;
  try{
    const inspection=p954InspectStoredProposal();
    if(!inspection.exists||!inspection.parses||!inspection.validation.valid||!inspection.normalized)return{ok:false,error:"The saved proposal is missing, corrupted, or invalid."};
    const proposal=inspection.normalized;
    if(proposal.status==="undone"){p954LastUndoVerification.idempotencyStatus="already-undone/no-op";return{ok:true,alreadyUndone:true,noOp:true,applicationId:proposal.applicationId};}
    const plan=p954BuildUndoPlan(proposal);p954LastUndoValidationErrors=plan.errors.concat(plan.conflicts);
    if(!plan.canUndo)return{ok:false,error:"Cannot undo safely: "+p954LastUndoValidationErrors.join(" "),plan:plan};
    rollback=p954CaptureRollbackSnapshot();
    const untouchedBefore=p954CaptureUntouchedStorage(),pBefore=JSON.stringify(P),snap=proposal.preApplySnapshot,live=p954ParseUndoLiveState();
    if(!live.ok)throw new Error(live.error);
    const unrelatedBefore=plan.facts.restorationScope==="proposal-affected-paths"?p954ProjectUndoUnrelated(live.lc,live.ov,snap.scopedUndo):null;
    if(plan.facts.restorationScope==="proposal-affected-paths"){
      const needLifecycle=plan.operations.some(function(op){return op.storage==="lifecycle"&&op.action==="restore"}),needOverrides=plan.operations.some(function(op){return op.storage==="overrides"&&op.action==="restore"});
      plan.operations.forEach(function(op){if(op.action==="restore")p954RestoreScopedUndoOperation(live.lc,live.ov,op);});
      if(needLifecycle)localStorage.setItem(LIFECYCLE_KEY,JSON.stringify(live.lc));
      if(needOverrides)localStorage.setItem(OVR,JSON.stringify(live.ov));
    }else plan.operations.forEach(function(op){if(op.action!=="already-restored")op.pre.existed?localStorage.setItem(op.key,op.pre.rawText):localStorage.removeItem(op.key);});
    const undone=p954NormalizeProposal(p954BuildUndoneProposal(proposal,plan,new Date().toISOString()));
    localStorage.setItem(PROGRAM_PROPOSAL_KEY,JSON.stringify(undone));
    const verify=p954VerifyUndoPostState(proposal,untouchedBefore,pBefore,unrelatedBefore,plan);p954LastPostUndoValidationErrors=verify.errors.slice();
    if(!verify.valid)throw new Error(verify.errors.join(" "));
    p954LastUndoVerification={exactRawRestorationVerified:true,unrelatedStatePreserved:true,idempotencyStatus:"already-undone/no-op"};
    return{ok:true,applicationId:proposal.applicationId,summary:undone.undoSummary};
  }catch(e){
    const restored=rollback?p954RestoreFromRollbackSnapshot(rollback):true;
    p954LastPostUndoValidationErrors=[(e&&e.message)||"Unknown error"];
    p954LastUndoVerification={exactRawRestorationVerified:false,unrelatedStatePreserved:false,idempotencyStatus:null};
    return{ok:false,error:"Undo failed; "+(restored?"all touched keys were restored exactly":"exact failure rollback could not be completed")+": "+((e&&e.message)||"Unknown error")};
  }
}
window.p954UndoAppliedProposal=p954UndoAppliedProposal;

window.mfOnboardingProgramProposalUndoDebug=function(){
  try{
    const inspection=p954InspectStoredProposal(),proposal=inspection.normalized,plan=p954BuildUndoPlan(),snapshotValidation=p954ValidateUndoSnapshot(proposal);
    const result={readOnly:true,proposalStatus:proposal?proposal.status:null,applicationId:proposal?proposal.applicationId:null,appliedAt:proposal?proposal.appliedAt:null,undoneAt:proposal?proposal.undoneAt:null,snapshotAvailable:snapshotValidation.available,snapshotValid:snapshotValidation.valid,scopedUndoAvailable:snapshotValidation.scopedAvailable,scopedUndoValid:snapshotValidation.scopedValid,undoScopeMode:plan.facts.restorationScope||null,canUndo:plan.canUndo,undoStatus:plan.status,undoPlanOperations:plan.operations,undoConflicts:plan.conflicts,undoErrors:plan.errors,undoWarnings:plan.warnings,lastUndoValidationErrors:p954LastUndoValidationErrors.slice(),lastPostUndoValidationErrors:p954LastPostUndoValidationErrors.slice(),exactRawRestorationVerification:p954LastUndoVerification.exactRawRestorationVerified,unrelatedStatePreserved:p954LastUndoVerification.unrelatedStatePreserved,idempotencyStatus:plan.alreadyUndone?"already-undone/no-op":p954LastUndoVerification.idempotencyStatus};
    console.log("[MarcusFit] mfOnboardingProgramProposalUndoDebug():",result);return result;
  }catch(e){const result={readOnly:true,error:(e&&e.message)||"Unknown error"};console.warn("[MarcusFit] mfOnboardingProgramProposalUndoDebug failed:",e&&e.message);return result;}
};
var mfOnboardingProgramProposalUndoDebug=window.mfOnboardingProgramProposalUndoDebug;

// ── END PHASE 9.5.4E PROPOSAL APPLICATION + UNDO ENGINE ──────────────────────

// REQUIREMENT 10: read-only debug/inspection helper. Never writes storage.
window.mfOnboardingProgramProposalDebug = function(){
  try {
    const proposal = p954GetProposal();
    // 9.5.4B.1: raw-storage inspection drives validity/reviewability now —
    // p954ValidateProgramProposal() on the already-normalized proposal would
    // always look valid, since normalization repairs invalid fields first.
    const inspection = p954InspectStoredProposal();
    const validation = inspection.validation;
    // 9.5.4B.2: storedProposalNormalizedValid must reflect actual structural
    // validation of the normalized read model, not merely that normalization
    // returned an object (normalization always "succeeds" by coercing to
    // safe defaults, so !!inspection.normalized was true even for corrupted
    // structures where normalization also failed for unrelated reasons).
    const normalizedValidation = inspection.normalized ? p954ValidateProgramProposal(inspection.normalized) : { valid: false, errors: [] };
    const compatibility = proposal ? p954CheckProgramCompatibility(proposal) : null;
    // 9.5.4B: review-layer fields — UI-state only, never persisted.
    const canReview = !!proposal && validation.valid;
    const canDismiss = !!proposal && (proposal.status === "draft" || proposal.status === "dismissed");
    // 9.5.4C: application-engine fields. Plan is computed read-only purely
    // for debug visibility — never triggers a write.
    const appPlan = (proposal && validation.valid) ? p954BuildApplicationPlan(proposal) : null;
    const canApply = !!proposal && validation.valid && proposal.status === "draft";
    const undoPlan = p954BuildUndoPlan(proposal === null ? undefined : proposal);
    const lcForDebug = getLifecycle();
    let appliedDayOverrideCount = 0, appliedDayAdditionCount = 0;
    if(proposal && proposal.applicationId){
      const tag = "proposal:" + proposal.applicationId;
      Object.keys(lcForDebug.dayOverrides || {}).forEach(function(g){
        Object.keys(lcForDebug.dayOverrides[g] || {}).forEach(function(k){
          const rec = lcForDebug.dayOverrides[g][k];
          if(rec && typeof rec.reason === "string" && rec.reason.indexOf(tag) === 0) appliedDayOverrideCount++;
        });
      });
      Object.keys(lcForDebug.dayAdditions || {}).forEach(function(g){
        Object.keys(lcForDebug.dayAdditions[g] || {}).forEach(function(k){
          const rec = lcForDebug.dayAdditions[g][k];
          if(rec && typeof rec.reason === "string" && rec.reason.indexOf(tag) === 0) appliedDayAdditionCount++;
        });
      });
    }
    const result = {
      proposalExists: !!proposal,
      proposalStatus: proposal ? proposal.status : null,
      proposalVersion: proposal ? proposal.proposalVersion : null,
      sourceType: proposal ? proposal.sourceType : null,
      sourceSummary: proposal ? proposal.sourceSummary : null,
      sourceQuality: proposal ? p955GetProposalQualityMetrics(proposal) : null,
      validation: validation,
      summary: proposal ? proposal.summary : null,
      affectedDayCount: proposal ? proposal.summary.affectedDayCount : 0,
      actionCounts: proposal ? proposal.summary.actionCounts : null,
      currentProgramCompatibility: compatibility,
      warnings: proposal ? proposal.warnings : [],
      backupIncluded: p8IsMarcusFitKey(PROGRAM_PROPOSAL_KEY),
      reviewOpen: p954ReviewOpenFlag,
      canReview: canReview,
      canDismiss: canDismiss,
      dismissedAt: proposal ? proposal.dismissedAt : null,
      renderedGymGroups: p954RLastRenderedGymGroups,
      renderedDayCount: p954RLastRenderedDayCount,
      // 9.5.4B.1: concise raw-storage inspection fields only — no raw text,
      // no full parsed/normalized object dumps.
      storedProposalExists: inspection.exists,
      storedProposalParses: inspection.parses,
      storedProposalRawValid: inspection.validation.valid,
      storedProposalNormalizedValid: normalizedValidation.valid,
      storedProposalErrors: inspection.validation.errors,
      // 9.5.4C: application-engine debug fields.
      status: proposal ? proposal.status : null,
      appliedAt: proposal ? proposal.appliedAt : null,
      undoneAt: proposal ? proposal.undoneAt : null,
      applicationId: proposal ? proposal.applicationId : null,
      canApply: canApply,
      canUndo: undoPlan.canUndo,
      undoPlanOperations: undoPlan.operations,
      undoConflicts: undoPlan.conflicts,
      undoWarnings: undoPlan.warnings,
      undoSnapshotAvailable: undoPlan.snapshotAvailable,
      undoSnapshotValid: undoPlan.snapshotValid,
      lastUndoValidationErrors: p954LastUndoValidationErrors.slice(),
      lastPostUndoValidationErrors: p954LastPostUndoValidationErrors.slice(),
      exactRawRestorationVerified: p954LastUndoVerification.exactRawRestorationVerified,
      undoIdempotencyStatus: undoPlan.alreadyUndone ? "already-undone/no-op" : p954LastUndoVerification.idempotencyStatus,
      plannedKeepCount: appPlan ? appPlan.counts.keep : 0,
      plannedModifyCount: appPlan ? appPlan.counts.modify : 0,
      plannedRemoveCount: appPlan ? appPlan.counts.remove : 0,
      plannedOptionalAddCount: appPlan ? appPlan.counts.optional_add : 0,
      skippedExerciseActionCount: appPlan ? appPlan.counts.skippedExerciseActionCount : 0,
      plannedReorderCount: appPlan ? appPlan.counts.plannedReorderCount : 0,
      plannedExerciseModifyCount: appPlan ? appPlan.counts.plannedExerciseModifyCount : 0,
      skippedReplaceCount: appPlan ? appPlan.counts.skippedReplaceCount : 0,
      skippedAddCount: appPlan ? appPlan.counts.skippedAddCount : 0,
      skippedRemoveCount: appPlan ? appPlan.counts.skippedRemoveCount : 0,
      skippedReactivateCount: appPlan ? appPlan.counts.skippedReactivateCount : 0,
      appliedOrderOverrideCount: proposal && proposal.applicationSummary ? (proposal.applicationSummary.reorderedDayCount||0) : 0,
      appliedExerciseOverrideCount: proposal && proposal.applicationSummary ? (proposal.applicationSummary.modifiedExerciseCount||0) : 0,
      activeExerciseCountBefore: p954LastSafetyFacts.before,
      activeExerciseCountAfter: p954LastSafetyFacts.after,
      exerciseIdsUnchanged: p954LastSafetyFacts.idsUnchanged,
      liveValidationErrors: p954LastLiveValidationErrors.slice(),
      postApplyValidationErrors: p954LastPostApplyValidationErrors.slice(),
      applicationPlanValid: appPlan ? appPlan.valid : null,
      applicationPlanErrors: appPlan ? appPlan.errors : [],
      disabledDayCount: getDisabledDayCount(lcForDebug),
      appliedDayOverrideCount: appliedDayOverrideCount,
      appliedDayAdditionCount: appliedDayAdditionCount
    };
    console.log("[MarcusFit] mfOnboardingProgramProposalDebug():", result);
    return result;
  } catch(e){
    const result = { error: (e && e.message) || "Unknown error" };
    console.warn("[MarcusFit] mfOnboardingProgramProposalDebug failed:", e && e.message);
    return result;
  }
};

// ── REQUIREMENT 8: auto-generate a draft proposal after successful REAL
// onboarding completion only (never preview). Never blocks or reopens
// onboarding — failures here are swallowed (logged, not surfaced to the
// completion UI) since proposal generation is a bonus, not a requirement of
// completing onboarding.
// ── FUTURE MODULE: src/debug.js (proposal debug/export integration) ─────────
window.mfOnboardingProgramProposalSourceDebug = function(){
  try {
    const inspection=p954InspectStoredProposal(),proposal=inspection.normalized;
    const metrics=proposal?p955GetProposalQualityMetrics(proposal):null;
    const undo=proposal?p954BuildUndoPlan(proposal):{canUndo:false,status:"no_proposal"};
    const derivedActions=p955GetDerivedProposalActionCounts(proposal);
    const actionCountsByType=derivedActions.byType;
    const result={
      readOnly:true,
      proposalExists:inspection.exists,
      proposalParses:inspection.parses,
      proposalValid:inspection.validation.valid,
      proposalValidationErrors:inspection.validation.errors,
      proposalValidationWarnings:inspection.validation.warnings||[],
      proposalId:proposal?(proposal.applicationId||((proposal.generatedAt||"draft")+"|"+proposal.proposalVersion)):null,
      status:proposal?proposal.status:null,
      sourceType:proposal?proposal.sourceType:null,
      appearsFixture:!!(proposal&&proposal.sourceType==="fixture"),
      appearsLocallyGenerated:!!(proposal&&proposal.sourceType==="local_generated"),
      appearsLegacy:!!(proposal&&proposal.sourceType==="legacy"),
      sourceCoverage:metrics?metrics.sourceCoverage:null,
      sourceDetails:proposal?proposal.sourceSummary:null,
      sourceWarnings:proposal&&proposal.sourceSummary?proposal.sourceSummary.sourceWarnings:[],
      actionCountsByType:actionCountsByType,
      actionCounts:derivedActions.counts,
      flatDerivedCountSummary:p955FormatProposalActionCounts(derivedActions.counts),
      safeApplyCount:metrics?metrics.safeApplyCount:0,
      deferredCount:metrics?metrics.deferredCount:0,
      conflictCount:metrics?metrics.conflictCount:0,
      warningCount:metrics?metrics.warningCount:0,
      undoEligibility:{status:undo.status,canUndo:undo.canUndo,alreadyUndone:undo.alreadyUndone||false,snapshotAvailable:undo.snapshotAvailable||false,snapshotValid:undo.snapshotValid||false,conflictCount:(undo.conflicts||[]).length},
      visibleSummaryTextSafety:p955VisibleSummaryTextSafety(proposal)
    };
    console.log("[MarcusFit] mfOnboardingProgramProposalSourceDebug():",result);
    return result;
  } catch(e){
    const result={readOnly:true,error:(e&&e.message)||"Unknown error"};
    console.warn("[MarcusFit] mfOnboardingProgramProposalSourceDebug failed:",e&&e.message);
    return result;
  }
};
var mfOnboardingProgramProposalSourceDebug=window.mfOnboardingProgramProposalSourceDebug;

function p954MaybeGenerateProposalAfterRealCompletion(){
  try {
    p954GenerateAndSaveProposal();
  } catch(e){
    console.warn("[MarcusFit] p954MaybeGenerateProposalAfterRealCompletion failed safely:", e && e.message);
  }
}

