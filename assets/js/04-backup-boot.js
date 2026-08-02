
// ── PHASE 8: BACKUP / RESTORE / RECOVERY ──────────────────────────────────────

const SCHEMA_VERSION = 1;

// Identify all localStorage keys owned by MarcusFit
function p8IsMarcusFitKey(key){
  return key.startsWith("day-") || key === OVR || key === DRAFT_KEY || key === LIFECYCLE_KEY || key === RECS_KEY || key === AI_PREFS_KEY || key === USER_PROFILE_KEY || key === ONBOARDING_KEY || key === PROGRAM_PROPOSAL_KEY || key === "mf-recurring-items" || key === "mf-recurring-events" || key === "mf-habit-definitions" || key === "mf-habit-proposal";
}

function p8GetMarcusFitKeys(){
  return Object.keys(localStorage).filter(p8IsMarcusFitKey);
}

// Build a backup object from current localStorage
function p8BuildBackup(){
  const data = {};
  p8GetMarcusFitKeys().forEach(k => {
    data[k] = localStorage.getItem(k); // store as raw strings — do not re-parse
  });
  return {
    app: "MarcusFit",
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data
  };
}

// ── PHASE 9.4.9.2: Backup summary parser ──────────────────────────────────────
// Safely summarizes a backup (object or raw JSON string) without dumping raw
// data. Used by both p8CreateBackup() (create flow) and p8RestoreBackup()
// (restore preview flow). Never mutates anything — pure read/parse only.
function p8492SummarizeBackup(rawOrObj){
  const result = {
    valid: false,
    schemaVersion: null,
    appVersion: null,
    createdAt: null,
    keyCount: 0,
    dailyLogCount: 0,
    workoutLogCount: 0,
    hasLifecycle: false,
    hasOverrides: false,
    hasDraft: false,
    hasRecommendations: false,
    hasAiPrefs: false,
    hasUserProfile: false,
    userProfileSchemaVersion: null,
    userProfileDisplayName: null,
    hasOnboardingState: false,
    onboardingStatus: null,
    onboardingCurrentStep: null,
    hasRecurringItems: false,
    hasRecurringEvents: false,
    unknownKeyCount: 0,
    approxSizeBytes: 0,
    approxSizeKB: 0,
    warnings: [],
    errors: []
  };
  try {
    let backup = rawOrObj;
    if(typeof rawOrObj === "string"){
      try { backup = JSON.parse(rawOrObj); }
      catch(e){ result.errors.push("Invalid backup JSON."); return result; }
    }
    if(!backup || typeof backup !== "object"){
      result.errors.push("Backup is not a valid object.");
      return result;
    }
    if(backup.app !== "MarcusFit"){
      result.errors.push("Backup does not belong to MarcusFit.");
      return result;
    }
    result.schemaVersion = (backup.schemaVersion != null) ? backup.schemaVersion : null;
    result.appVersion = backup.appVersion || null;
    result.createdAt = backup.exportedAt || null;

    const data = backup.data || {};
    const keys = Object.keys(data);
    result.keyCount = keys.length;

    keys.forEach(function(k){
      if(k.startsWith("day-") && k.endsWith("-wo")) result.workoutLogCount++;
      else if(k.startsWith("day-")) result.dailyLogCount++;
      else if(k === OVR) result.hasOverrides = true;
      else if(k === DRAFT_KEY) result.hasDraft = true;
      else if(k === LIFECYCLE_KEY) result.hasLifecycle = true;
      else if(k === RECS_KEY) result.hasRecommendations = true;
      else if(k === AI_PREFS_KEY) result.hasAiPrefs = true;
      else if(k === USER_PROFILE_KEY){
        result.hasUserProfile = true;
        try {
          const pv = data[k];
          const profileObj = typeof pv === "string" ? JSON.parse(pv) : pv;
          const norm = p950NormalizeUserProfile(profileObj);
          result.userProfileSchemaVersion = norm.schemaVersion;
          result.userProfileDisplayName = norm.identity.displayName;
        } catch(e){
          result.warnings.push("User profile in this backup could not be parsed.");
        }
      }
      else if(k === ONBOARDING_KEY){
        result.hasOnboardingState = true;
        try {
          const ov = data[k];
          const onboardObj = typeof ov === "string" ? JSON.parse(ov) : ov;
          const norm = p951NormalizeOnboardingState(onboardObj);
          result.onboardingStatus = norm.status;
          result.onboardingCurrentStep = norm.currentStep;
        } catch(e){
          result.warnings.push("Onboarding state in this backup could not be parsed.");
        }
      }
      else if(k === "mf-recurring-items"){
        result.hasRecurringItems = true;
        try {
          const recurringItems = typeof data[k] === "string" ? JSON.parse(data[k]) : data[k];
          if(!recurringItems || recurringItems.schemaVersion == null) result.warnings.push("Recurring item store has no schemaVersion.");
        } catch(e){ result.warnings.push("Recurring item store could not be parsed."); }
      }
      else if(k === "mf-recurring-events"){
        result.hasRecurringEvents = true;
        try {
          const recurringEvents = typeof data[k] === "string" ? JSON.parse(data[k]) : data[k];
          if(!recurringEvents || recurringEvents.schemaVersion == null) result.warnings.push("Recurring event store has no schemaVersion.");
        } catch(e){ result.warnings.push("Recurring event store could not be parsed."); }
      }
      else result.unknownKeyCount++;
      try {
        const v = data[k];
        result.approxSizeBytes += (typeof v === "string" ? v : JSON.stringify(v) || "").length;
      } catch(e){ /* ignore size errors for a single key */ }
    });
    result.approxSizeKB = Math.round((result.approxSizeBytes / 1024) * 10) / 10;

    if(!backup.exportedAt) result.warnings.push("Backup has no createdAt/exportedAt timestamp.");
    if(result.keyCount === 0) result.warnings.push("Backup contains no MarcusFit data keys.");
    if(result.unknownKeyCount > 0) result.warnings.push(result.unknownKeyCount + " key(s) in this backup are not recognized by the current app version.");

    result.valid = true;
  } catch(e){
    result.errors.push("Failed to summarize backup: " + (e && e.message));
  }
  return result;
}

// Build a readable multi-line summary block from a p8492SummarizeBackup() result
function p8492FormatSummaryLines(s){
  const lines = [
    "App version: " + (s.appVersion || "unknown"),
    "Created: " + (s.createdAt || "unknown"),
    "Total keys: " + s.keyCount,
    "Daily logs: " + s.dailyLogCount + " | Workout logs: " + s.workoutLogCount,
    "Lifecycle: " + (s.hasLifecycle ? "yes" : "no") + " | Overrides: " + (s.hasOverrides ? "yes" : "no") + " | Draft: " + (s.hasDraft ? "yes" : "no"),
    "Recommendations: " + (s.hasRecommendations ? "yes" : "no") + " | AI coaching prefs: " + (s.hasAiPrefs ? "yes" : "no"),
    "User Profile: " + (s.hasUserProfile ? ("Yes — " + (s.userProfileDisplayName || "unknown") + " (schema v" + (s.userProfileSchemaVersion != null ? s.userProfileSchemaVersion : "?") + ")") : "Not included"),
    "Onboarding State: " + (s.hasOnboardingState ? ("Yes — status: " + (s.onboardingStatus || "unknown") + ", step: " + (s.onboardingCurrentStep != null ? s.onboardingCurrentStep : "?")) : "Not included"),
    "Recurring schedules: " + (s.hasRecurringItems ? "yes" : "no") + " | Recurring events: " + (s.hasRecurringEvents ? "yes" : "no"),
    "Approx size: " + s.approxSizeKB + " KB"
  ];
  if(s.warnings && s.warnings.length){
    lines.push("", "⚠ Warnings:");
    s.warnings.forEach(function(w){ lines.push("• " + w); });
  }
  return lines;
}
// ── END PHASE 9.4.9.2 BACKUP SUMMARY PARSER ───────────────────────────────────

// Render the backup object into the textarea
function p8CreateBackup(){
  const backup = p8BuildBackup();
  const json = JSON.stringify(backup, null, 2);
  document.getElementById("p8BackupTa").value = json;
  const s = p8492SummarizeBackup(backup);
  const lines = ["✅ Backup created successfully. Copy it and save somewhere safe.", ""].concat(p8492FormatSummaryLines(s));
  p8ShowResult(lines.join("\n"), "ok");
  console.log("[MarcusFit] Backup created");
}

// Copy backup textarea content to clipboard
function p8CopyBackup(){
  const val = document.getElementById("p8BackupTa").value.trim();
  if(!val){ p8ShowResult("❌ Nothing to copy. Create a backup first.", "err"); return; }
  navigator.clipboard.writeText(val).then(() => {
    p8ShowResult("✅ Backup copied to clipboard.", "ok");
  }).catch(() => {
    // Fallback
    const ta = document.createElement("textarea");
    ta.value = val;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    p8ShowResult("✅ Backup copied (fallback).", "ok");
  });
}

// Validate raw backup text and return parsed backup or throw with a friendly message
function p8ValidateBackup(raw){
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch(e){ throw new Error("❌ Invalid backup JSON. Make sure you pasted the full backup without modification."); }
  if(!parsed || parsed.app !== "MarcusFit"){
    throw new Error("❌ Backup does not belong to MarcusFit.");
  }
  if(!parsed.exportedAt || !parsed.data){
    throw new Error("❌ Backup is missing required fields (exportedAt or data).");
  }
  return parsed;
}

// Migration framework — no real migrations yet, but framework is ready
function p8MigrateBackup(backup){
  if(!backup || backup.app !== "MarcusFit"){
    throw new Error("Backup does not belong to MarcusFit.");
  }
  switch(backup.schemaVersion){
    case 1:
      return backup; // current version — no migration needed
    default:
      throw new Error("❌ Unsupported backup schema version (" + backup.schemaVersion + "). This backup was made by a newer version of MarcusFit.");
  }
}

// ── PHASE 9.4.9.2: Restore preview / two-step confirmation ───────────────────
// native confirm() is blocked/unreliable in iOS home-screen PWA mode (same
// issue documented for saveDay()'s future-date confirm — see p85ConfirmFutureSave
// pattern). Restore now uses that same in-app panel pattern instead.
//
// In-memory only — never persisted — holds the parsed+migrated backup between
// the initial RESTORE BACKUP click (preview) and the explicit CONFIRM RESTORE
// click (apply). Cleared on cancel, on apply, or if the textarea is edited.
let p8PendingRestoreBackup = null;

// Step 1: parse, validate, migrate, and show a preview — does NOT apply anything
function p8RestoreBackup(){
  p8HideRestoreConfirm();
  const raw = document.getElementById("p8BackupTa").value.trim();
  if(!raw){ p8ShowResult("❌ Paste a backup into the text area first.", "err"); return; }

  // Step 1: Validate
  let backup;
  try { backup = p8ValidateBackup(raw); }
  catch(e){ p8ShowResult(e.message, "err"); return; }

  // Step 2: Migrate
  try { backup = p8MigrateBackup(backup); }
  catch(e){ p8ShowResult(e.message, "err"); return; }

  // Step 3: Preview — hold the parsed backup and show summary + confirm panel
  p8PendingRestoreBackup = backup;
  const s = p8492SummarizeBackup(backup);
  const body = document.getElementById("p8RestoreConfirmBody");
  if(body){
    const lines = ["This backup contains:", ""].concat(p8492FormatSummaryLines(s));
    lines.push("", "Restoring will overwrite your current MarcusFit data on this device. A safety copy of your current data will be shown here automatically if anything goes wrong.");
    body.textContent = lines.join("\n");
  }
  const panel = document.getElementById("p8RestoreConfirmPanel");
  if(panel){
    panel.style.display = "block";
    panel.scrollIntoView({behavior:"smooth", block:"nearest"});
  }
  p8ShowResult("⚠ Restore preview ready. Review the summary below, then confirm to proceed.", "warn");
}

function p8HideRestoreConfirm(){
  const panel = document.getElementById("p8RestoreConfirmPanel");
  if(panel) panel.style.display = "none";
  p8PendingRestoreBackup = null;
}

function p8CancelRestore(){
  p8HideRestoreConfirm();
  p8ShowResult("Restore cancelled. No data was changed.", "ok");
}

// Step 2 (explicit second click): actually apply the previously-previewed backup
function p8ConfirmRestore(){
  const backup = p8PendingRestoreBackup;
  p8HideRestoreConfirm();
  if(!backup){ p8ShowResult("❌ Nothing to restore. Paste a backup and click Restore Backup again.", "err"); return; }
  p8ExecuteRestore(backup);
}

// Applies a validated+migrated backup object. Unchanged from prior restore
// logic — only the confirmation step that gates entry to this function changed.
function p8ExecuteRestore(backup){
  // Safety backup (in memory — shown in textarea on failure)
  const safetyBackup = JSON.stringify(p8BuildBackup(), null, 2);

  try {
    // Remove existing MarcusFit keys
    p8GetMarcusFitKeys().forEach(k => localStorage.removeItem(k));

    // Restore only MarcusFit-owned keys from backup data
    const restored = backup.data || {};
    Object.entries(restored).forEach(([k, v]) => {
      if(p8IsMarcusFitKey(k)){
        localStorage.setItem(k, v); // restore raw string — no re-stringify
      }
    });

    // 9C: Run lifecycle validation post-restore and show summary
    mfRunPostRestoreValidation();
    const recurringRestoreCheck = mfRecurringStorageDebug();
    if(recurringRestoreCheck.warnings.length || recurringRestoreCheck.orphanedEventReferences.length){
      console.warn("[MarcusFit] Recurring adherence restore warnings:", recurringRestoreCheck);
    }
    console.log("[MarcusFit] Backup restored");
    setTimeout(() => location.reload(), 1800);
  } catch(e) {
    // Restore failed — show the safety backup
    document.getElementById("p8BackupTa").value = safetyBackup;
    p8ShowResult("❌ Restore failed: " + e.message + "\n\nYour original data has been shown above. Copy it before refreshing.", "err");
  }
}
// ── END PHASE 9.4.9.2 RESTORE PREVIEW/CONFIRM ─────────────────────────────────

// ── PHASE 9.4.9.2: Clear data two-step confirmation ───────────────────────────
// Step 1: show warning panel only — clears nothing yet
function p8ClearData(){
  p8HideRestoreConfirm();
  const panel = document.getElementById("p8ClearConfirmPanel");
  if(panel){
    panel.style.display = "block";
    panel.scrollIntoView({behavior:"smooth", block:"nearest"});
  }
  p8ShowResult("⚠ This will permanently delete all MarcusFit data from this browser/device. Confirm below to proceed.", "warn");
}

// Step 2 (explicit second click): actually clear
function p8ConfirmClearData(){
  const panel = document.getElementById("p8ClearConfirmPanel");
  if(panel) panel.style.display = "none";
  p8GetMarcusFitKeys().forEach(k => localStorage.removeItem(k));
  p8ShowResult("✅ All MarcusFit data cleared. Reloading...", "ok");
  setTimeout(() => location.reload(), 1200);
}

function p8CancelClearData(){
  const panel = document.getElementById("p8ClearConfirmPanel");
  if(panel) panel.style.display = "none";
  p8ShowResult("Clear cancelled. No data was changed.", "ok");
}
// ── END PHASE 9.4.9.2 CLEAR DATA TWO-STEP CONFIRM ─────────────────────────────

// Show a result message in the backup result div
function p8ShowResult(msg, type){
  const el = document.getElementById("p8BackupResult");
  if(!el) return;
  el.style.display = "block";
  el.style.color = type === "ok" ? "var(--green)" : type === "err" ? "var(--red)" : type === "warn" ? "var(--yellow)" : "var(--text)";
  el.style.whiteSpace = "pre-wrap";
  el.textContent = msg;
}

// ── PHASE 9.4.9.2: BACKUP HEALTH CHECK (read-only) ────────────────────────────
// Console diagnostic helper. Reports current backup readiness — recognized
// keys, coverage gaps in the p8IsMarcusFitKey() allowlist, and an in-memory
// preview of what a backup created right now would contain. Never writes
// localStorage, never mutates data, never touches the UI. Each section is
// wrapped so one broken section cannot crash the whole helper.
window.mfBackupDebug = function(){
  const summary = {
    appVersion: APP_VERSION,
    backupKeyFilter: {},
    currentStorage: {},
    backupPreview: {},
    coverage: {},
    warnings: [],
    risks: [],
    errors: []
  };

  try {
    summary.backupKeyFilter = {
      description: "p8IsMarcusFitKey() is a manual allowlist — recognized patterns below.",
      recognizedPatterns: ["day-* (daily logs)", "day-*-wo (workout logs)", OVR, DRAFT_KEY, LIFECYCLE_KEY, RECS_KEY, AI_PREFS_KEY, USER_PROFILE_KEY, ONBOARDING_KEY]
    };
  } catch(e){ summary.errors.push("backupKeyFilter section failed: " + (e && e.message)); }

  try {
    const keys = p8GetMarcusFitKeys();
    let dailyLogCount = 0, workoutLogCount = 0;
    keys.forEach(function(k){
      if(k.startsWith("day-") && k.endsWith("-wo")) workoutLogCount++;
      else if(k.startsWith("day-")) dailyLogCount++;
    });
    let lifecycleParseStatus = "not-present";
    try {
      const raw = localStorage.getItem(LIFECYCLE_KEY);
      if(raw){
        try { JSON.parse(raw); lifecycleParseStatus = "ok"; }
        catch(e){ lifecycleParseStatus = "parse-error"; }
      }
    } catch(e){ lifecycleParseStatus = "error"; }
    summary.currentStorage = {
      recognizedKeyCount: keys.length,
      dailyLogCount: dailyLogCount,
      workoutLogCount: workoutLogCount,
      lifecyclePresent: keys.indexOf(LIFECYCLE_KEY) !== -1,
      lifecycleParseStatus: lifecycleParseStatus,
      overridesPresent: keys.indexOf(OVR) !== -1,
      draftPresent: keys.indexOf(DRAFT_KEY) !== -1,
      recommendationsPresent: keys.indexOf(RECS_KEY) !== -1,
      aiPrefsPresent: keys.indexOf(AI_PREFS_KEY) !== -1,
      userProfilePresent: keys.indexOf(USER_PROFILE_KEY) !== -1,
      onboardingStatePresent: keys.indexOf(ONBOARDING_KEY) !== -1
    };
  } catch(e){ summary.errors.push("currentStorage section failed: " + (e && e.message)); }

  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    const profileStatus = { exists: raw !== null, parses: false, schemaVersion: null, displayName: null };
    if(raw !== null){
      try {
        const parsed = JSON.parse(raw);
        profileStatus.parses = true;
        const norm = p950NormalizeUserProfile(parsed);
        profileStatus.schemaVersion = norm.schemaVersion;
        profileStatus.displayName = norm.identity.displayName;
      } catch(e){
        summary.warnings.push("mf-user-profile exists but is not valid JSON.");
      }
    } else {
      summary.warnings.push("mf-user-profile does not exist yet — p950InitUserProfile() should create it on next load.");
    }
    profileStatus.includedByKeyFilter = p8IsMarcusFitKey(USER_PROFILE_KEY);
    summary.userProfile = profileStatus;
  } catch(e){ summary.errors.push("userProfile section failed: " + (e && e.message)); }

  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    const onboardingStatus = { exists: raw !== null, parses: false, schemaVersion: null, status: null, currentStep: null };
    if(raw !== null){
      try {
        const parsed = JSON.parse(raw);
        onboardingStatus.parses = true;
        const norm = p951NormalizeOnboardingState(parsed);
        onboardingStatus.schemaVersion = norm.schemaVersion;
        onboardingStatus.status = norm.status;
        onboardingStatus.currentStep = norm.currentStep;
      } catch(e){
        summary.warnings.push("mf-onboarding-state exists but is not valid JSON.");
      }
    } else {
      summary.warnings.push("mf-onboarding-state does not exist yet — p951InitOnboardingState() should create it on next load.");
    }
    onboardingStatus.includedByKeyFilter = p8IsMarcusFitKey(ONBOARDING_KEY);
    summary.onboardingState = onboardingStatus;
  } catch(e){ summary.errors.push("onboardingState section failed: " + (e && e.message)); }

  try {
    // In-memory only — builds the same object p8CreateBackup() would write to
    // the textarea, but never touches the DOM or writes anything to disk.
    const backup = p8BuildBackup();
    summary.backupPreview = p8492SummarizeBackup(backup);
  } catch(e){ summary.errors.push("backupPreview section failed: " + (e && e.message)); }

  try {
    const allKeys = Object.keys(localStorage);
    const excluded = allKeys.filter(function(k){
      return (k.startsWith("mf-") || k.startsWith("day-")) && !p8IsMarcusFitKey(k);
    });
    summary.coverage = {
      totalLocalStorageKeys: allKeys.length,
      marcusFitRecognizedKeys: p8GetMarcusFitKeys().length,
      marcusFitLookingExcludedKeys: excluded
    };
    if(excluded.length){
      summary.warnings.push(excluded.length + " MarcusFit-looking key(s) exist but are NOT included in backups: " + excluded.join(", "));
    }
  } catch(e){ summary.errors.push("coverage section failed: " + (e && e.message)); }

  summary.risks = [
    "p8IsMarcusFitKey() is a manual allowlist — any new localStorage key added in a future release must be added there or it silently falls outside backup/restore coverage.",
    "This helper is read-only: it never writes localStorage, never mutates data, and never creates an actual backup file — backupPreview is computed in memory only."
  ];

  console.log("[MarcusFit] mfBackupDebug():", summary);
  return summary;
};
var mfBackupDebug = window.mfBackupDebug;
// ── END PHASE 9.4.9.2 BACKUP HEALTH CHECK ─────────────────────────────────────

// ── PHASE 9.5.0: USER PROFILE DEBUG (read-only) ───────────────────────────────
// Console diagnostic helper for mf-user-profile. Reports existence/parse
// status, normalized field values, whether the key is covered by the backup
// allowlist, and a preview of its AI export block. Never writes localStorage,
// never "repairs" stored data — purely read/normalize-in-memory only.
window.mfUserProfileDebug = function(){
  const result = {
    key: USER_PROFILE_KEY,
    exists: false,
    parses: false,
    schemaVersion: null,
    profileVersion: null,
    displayName: null,
    heightInches: null,
    formattedHeight: null,
    primaryGoal: null,
    physiqueOutcome: null,
    preferences: {},
    appLabels: {},
    createdAt: null,
    updatedAt: null,
    backupIncluded: false,
    exportPreview: "",
    warnings: []
  };
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    result.exists = raw !== null;
    if(!result.exists){
      result.warnings.push("mf-user-profile does not exist yet — p950InitUserProfile() should create it on next page load.");
    } else {
      let parsed = null;
      try { parsed = JSON.parse(raw); result.parses = true; }
      catch(e){ result.warnings.push("mf-user-profile exists but is not valid JSON."); }
      const profile = p950NormalizeUserProfile(parsed || {});
      result.schemaVersion = profile.schemaVersion;
      result.profileVersion = profile.profileVersion;
      result.displayName = profile.identity.displayName;
      result.heightInches = profile.body.heightInches;
      result.formattedHeight = p950FormatHeight(profile.body.heightInches);
      result.primaryGoal = profile.goals.primaryGoal;
      result.physiqueOutcome = profile.goals.physiqueOutcome;
      result.preferences = profile.preferences;
      result.appLabels = { homeGymLabel: profile.app.homeGymLabel, partialGymLabel: profile.app.partialGymLabel };
      result.createdAt = profile.createdAt;
      result.updatedAt = profile.updatedAt;
    }
    result.backupIncluded = p8IsMarcusFitKey(USER_PROFILE_KEY);
    if(!result.backupIncluded){
      result.warnings.push("mf-user-profile is NOT currently recognized by p8IsMarcusFitKey() — it would be excluded from backups.");
    }
    try { result.exportPreview = p950BuildUserProfileExport(); }
    catch(e){ result.warnings.push("Failed to build export preview: " + (e && e.message)); }
  } catch(e){
    result.warnings.push("mfUserProfileDebug failed: " + (e && e.message));
  }
  console.log("[MarcusFit] mfUserProfileDebug():", result);
  return result;
};
var mfUserProfileDebug = window.mfUserProfileDebug;
// ── END PHASE 9.5.0 USER PROFILE DEBUG ────────────────────────────────────────

// ── END PHASE 8 ───────────────────────────────────────────────────────────────

// ── PHASE 9.4.9.1: ARCHITECTURE AUDIT / SYSTEM MAP ────────────────────────────
// Read-only console/debug helper. Documents current systems, storage, export/
// sync architecture, and hardcoded assumptions ahead of profile/intake/
// custom-habit/shareable-user work. Never mutates data, never calls save
// functions, never writes localStorage. Each section is wrapped so one
// broken section cannot crash the whole helper.
window.mfArchitecturePrepDebug = function(){
  const proposedModules=["src/program-data.js","src/storage-keys.js","src/storage-utils.js","src/lifecycle.js","src/resolved-program.js","src/onboarding.js","src/proposal-engine.js","src/proposal-apply-undo.js","src/proposal-ui.js","src/daily-log.js","src/history.js","src/analytics.js","src/export-sync.js","src/backup-restore.js","src/debug.js","src/app-init.js","src/styles.css"];
  const result={
    readOnly:true,
    appVersion:APP_VERSION,
    currentStructure:"single_file_html",
    targetStructure:"multi_file_static_github_pages",
    proposedModules:proposedModules.slice(),
    localStorageKeysUsed:["day-YYYY-MM-DD","day-YYYY-MM-DD-wo",OVR,DRAFT_KEY,LIFECYCLE_KEY,RECS_KEY,AI_PREFS_KEY,USER_PROFILE_KEY,ONBOARDING_KEY,PROGRAM_PROPOSAL_KEY,"mf-recurring-items","mf-recurring-events"],
    majorSystems:["program data","storage and backup","lifecycle and resolved program","onboarding","proposal engine","proposal apply/undo","proposal UI","daily log and history","recurring adherence","analytics","AI export/sync","debug and app initialization"],
    migrationReadiness:{readyForBoundaryExtraction:true,notes:["Future files must preserve current script dependency order.","Keep globals temporarily for backwards-compatible console helpers and inline handlers."],warnings:["Do not migrate storage schemas during file extraction.","Add browser smoke coverage before changing global initialization order."]},
    firstSyncBridge:{helpers:["p957GetSharedUserFirstSyncStatus","p957BuildFirstSyncExport","mfFirstSyncDebug"],futureOwners:["src/export-sync.js","src/onboarding.js","src/debug.js"],writesStorage:false},
    recommendationForNextPhase:"Extract storage keys/utilities and pure first-sync/proposal helpers first, preserving the single static GitHub Pages entry point and all existing globals."
  };
  console.log("[MarcusFit] mfArchitecturePrepDebug():",result);
  return result;
};
var mfArchitecturePrepDebug=window.mfArchitecturePrepDebug;

window.mfArchitectureDebug = function(){
  const summary = {
    app: {},
    storage: {},
    systems: {},
    dataSchemas: {},
    backupRestore: {},
    aiExportSync: {},
    programArchitecture: {},
    hardcodedAssumptions: {},
    debugHelpers: {},
    risksAndNextAbstractions: [],
    errors: []
  };

  // 1. App metadata
  try {
    const lc = getLifecycle();
    const gyms = Object.keys(P);
    const baseDayCounts = {}, resolvedDayCounts = {}, activeExerciseCounts = {};
    let virtualDayCount = 0;
    gyms.forEach(function(g){
      baseDayCounts[g] = (P[g]||[]).length;
      const resolvedDays = getResolvedDays(g);
      resolvedDayCounts[g] = resolvedDays.length;
      activeExerciseCounts[g] = resolvedDays.reduce(function(sum,d){return sum+((d.exercises||[]).length);},0);
      virtualDayCount += Object.keys((lc.dayAdditions||{})[g]||{}).length;
    });
    summary.app = {
      appVersion: APP_VERSION,
      lifecycleVersion: LIFECYCLE_VERSION,
      lifecycleSchema: (typeof LIFECYCLE_SCHEMA!=="undefined")?LIFECYCLE_SCHEMA:null,
      platform: "Single-file HTML / vanilla JS / localStorage / no backend / GitHub Pages hosted / iOS home-screen PWA",
      gyms: gyms,
      baseDayCountsByGym: baseDayCounts,
      resolvedDayCountsByGym: resolvedDayCounts,
      activeExerciseCountsByGym: activeExerciseCounts,
      customExerciseCount: Object.keys(lc.customExercises||{}).length,
      virtualAdditiveDayCount: virtualDayCount
    };
  } catch(e){ summary.errors.push("app section failed: "+(e&&e.message)); }

  // 2. localStorage inventory (summaries only — no raw log dumps)
  try {
    const keys = p8GetMarcusFitKeys();
    const categories = {};
    const unrecognized = [];
    function bump(cat){ categories[cat] = (categories[cat]||0)+1; }
    keys.forEach(function(k){
      if(k.startsWith("day-") && k.endsWith("-wo")) bump("workout logs");
      else if(k.startsWith("day-")) bump("daily logs (metrics/habits)");
      else if(k===OVR) bump("field overrides");
      else if(k===DRAFT_KEY) bump("drafts");
      else if(k===LIFECYCLE_KEY) bump("lifecycle state");
      else if(k===RECS_KEY) bump("recommendations");
      else if(k===AI_PREFS_KEY) bump("AI coaching preferences");
      else if(k===USER_PROFILE_KEY) bump("user profile");
      else if(k===ONBOARDING_KEY) bump("onboarding state");
      else bump("other");
    });
    Object.keys(localStorage).forEach(function(k){
      if((k.startsWith("mf-") || k.startsWith("day-")) && !p8IsMarcusFitKey(k)) unrecognized.push(k);
    });
    let approxTotalSizeBytes = 0;
    const approxSizeByCategory = {};
    keys.forEach(function(k){
      try{
        const len = (localStorage.getItem(k)||"").length;
        approxTotalSizeBytes += len;
      }catch(e){}
    });
    summary.storage = {
      totalRecognizedKeys: keys.length,
      categoryCounts: categories,
      unrecognizedMarcusFitLookingKeys: unrecognized,
      approxTotalSizeBytes: approxTotalSizeBytes,
      allKeysBackupCovered: true,
      note: "All recognized keys are backup-covered via p8GetMarcusFitKeys(). Raw log/workout contents are not dumped — counts and categories only."
    };
  } catch(e){ summary.errors.push("storage section failed: "+(e&&e.message)); }

  // 3. Known systems/modules
  try {
    summary.systems = {
      baseProgram_P: { storageKeys:["(hardcoded const P, not in localStorage)"], mutatesBaseP:false, backupCovered:false, exportSyncRelated:true, purpose:"Source-of-truth workout templates per gym/day/exercise. Never mutated at runtime." },
      fieldOverrides: { storageKeys:[OVR], functions:["getOvr","setOvr","resetOvr","getF"], mutatesBaseP:false, backupCovered:true, exportSyncRelated:false, purpose:"Per-exercise field overrides (name/load/rir/sets/reps) layered on top of base P." },
      exerciseLifecycle: { storageKeys:[LIFECYCLE_KEY], functions:["getLifecycle","saveLifecycle","exLifecycleDefault"], mutatesBaseP:false, backupCovered:true, exportSyncRelated:true, purpose:"Central state object: inactiveIds, replacements, orderOverrides, dayOverrides, dayAdditions, customExercises." },
      customExercises: { storageKeys:[LIFECYCLE_KEY+" → customExercises"], mutatesBaseP:false, backupCovered:true, exportSyncRelated:true, purpose:"AI/user-added exercises (base or virtual day) not present in base P, stable generated IDs." },
      orderOverrides: { storageKeys:[LIFECYCLE_KEY+" → orderOverrides"], mutatesBaseP:false, backupCovered:true, exportSyncRelated:true, purpose:"AI-driven exercise reordering per gym+day, applied inside getResolvedProgram()/getResolvedDays()." },
      dayOverrideEngine: { storageKeys:[LIFECYCLE_KEY+" → dayOverrides"], functions:["getDayOverride","getEffectiveDayMeta","mfDayOverrideDebug"], mutatesBaseP:false, backupCovered:true, exportSyncRelated:true, purpose:"Overrides day-level metadata (name/subtitle/focus/note/tag/meta) on base days." },
      virtualAdditiveDayEngine: { storageKeys:[LIFECYCLE_KEY+" → dayAdditions"], functions:["getResolvedDays","getSafeDayDisplayName","getSafeDayForLog","mfDayAdditionDebug"], mutatesBaseP:false, backupCovered:true, exportSyncRelated:true, purpose:"Virtual/additive days appended after base days (e.g. optional Day 7+)." },
      recommendationsEngine: { storageKeys:[RECS_KEY], mutatesBaseP:false, backupCovered:true, exportSyncRelated:true, purpose:"Short-term AI Sync coaching experiments/guidance, works on base and virtual days." },
      workoutLogging: { storageKeys:["day-YYYY-MM-DD-wo"], functions:["getTodayWoData","dKey"], mutatesBaseP:false, backupCovered:true, exportSyncRelated:true, purpose:"Per-day logged sets/loads/RIR for completed workouts." },
      dailyMetrics: { storageKeys:["day-YYYY-MM-DD"], mutatesBaseP:false, backupCovered:true, exportSyncRelated:true, purpose:"Daily vitals: weight, water, Zepbound dose, BM, hunger/recovery, etc." },
      recurringAdherence: { storageKeys:["mf-recurring-items","mf-recurring-events"], functions:["p9510NormalizeRecurringStore","p9510GetRecurringItems","p9510GetRecurringEvents","p9510GetOccurrenceForDate","p9510GetScheduleStatus","p9510GetNextDueDate","p9510GetPreviousDueDate","p9510ResolveOccurrence","p9510GetAdherenceSummary","mfRecurringAdherenceDebug","mfRecurringStorageDebug","mf9510RunScheduledAdherenceSelfTest"], mutatesBaseP:false, backupCovered:true, exportSyncRelated:true, purpose:"Optional schedule-aware recurring item definitions and explicit occurrence outcomes. Zepbound is the first UI consumer; legacy daily zep values remain read-only evidence and explicit actions dual-write for compatibility." },
      dailyHabits: { storageKeys:["mf-habit-definitions","day-YYYY-MM-DD (habit completion sub-fields)"], functions:["p960NormalizeHabitStore","p960GetHabitStore","p960GetActiveHabits","p960IsHabitDueOnDate","p960GetWeeklyHabitProgress","p960GetHabitAnalytics","mfHabitDefinitionsDebug","mfHabitDebug","mf960RunHabitSelfTest"], mutatesBaseP:false, backupCovered:true, exportSyncRelated:true, purpose:"Personalized, ordered, schedule-aware definitions remain separate from authoritative daily completion history." },
      habitProposal: { storageKeys:["mf-habit-proposal"], functions:["p960ValidateHabitProposal","p960ImportHabitProposal","p960ApplyHabitProposal","p960UndoHabitProposal","mfHabitProposalDebug"], mutatesBaseP:false, backupCovered:true, exportSyncRelated:true, purpose:"One reviewable AI habit proposal with explicit apply, conflict checking, and exact definition-store undo; never writes daily history, programs, or recurring medication stores." },
      draftSystem: { storageKeys:[DRAFT_KEY], functions:["getDraft","saveDraft"], mutatesBaseP:false, backupCovered:true, exportSyncRelated:false, purpose:"In-progress/unsaved workout entry state." },
      historyRenderingFiltering: { storageKeys:["day-* (read-only)"], mutatesBaseP:false, backupCovered:false, exportSyncRelated:false, purpose:"Phase 7 history screen: filters/renders past logs. Read-only consumer, not its own storage system." },
      analytics: { storageKeys:["day-* (read-only)"], mutatesBaseP:false, backupCovered:false, exportSyncRelated:false, purpose:"Phase 7 analytics screen: aggregates weight/recovery trends. Read-only consumer." },
      backupRestoreSystem: { storageKeys:["(all keys matched by p8IsMarcusFitKey)"], functions:["p8BuildBackup","p8CreateBackup","p8CopyBackup","p8ValidateBackup","p8MigrateBackup","p8RestoreBackup","p8ClearData"], mutatesBaseP:false, backupCovered:"n/a — this is the backup system itself", exportSyncRelated:false, purpose:"Full JSON export/import of all MarcusFit-owned localStorage keys, raw-string round-trip, schema-versioned." },
      aiExport: { storageKeys:["(reads multiple keys, writes none)"], functions:["genExport","p9489BuildSwapCandidateExport","p9489FormatSwapCandidateSection"], mutatesBaseP:false, backupCovered:false, exportSyncRelated:true, purpose:"Builds the full text block (coaching prefs + swap intelligence + program snapshot + logs + AI Sync format instructions) for pasting into an external AI." },
      aiSyncImport: { storageKeys:["(writes lifecycle/recommendations/overrides only)"], mutatesBaseP:false, backupCovered:true, exportSyncRelated:true, purpose:"Parses MARCUSFIT_UPDATE JSON blocks and applies safe lifecycle operations via _action types. Never touches base P." },
      progressionEngine: { storageKeys:["day-*-wo (read-only)"], functions:["p9GetExerciseHistory","p9GetProgressionStatus","p9BuildProgressionExport","p9GetTopActualLoad","p5ParseRir"], mutatesBaseP:false, backupCovered:false, exportSyncRelated:true, purpose:"Derives per-exercise progression status (7 statuses) from logged history." },
      swapCandidateIntelligence: { storageKeys:["day-*-wo (read-only)"], functions:["p9489AnalyzeExerciseRotation","p9489FormatSwapCandidateSection","p9489BuildSwapCandidateExport"], mutatesBaseP:false, backupCovered:false, exportSyncRelated:true, purpose:"Day-type-aware analysis surfacing stale/capped/redundant exercises as swap candidates in exports." },
      workoutReviewAfterSave: { storageKeys:["(derived at save time, no new key)"], functions:["p949BuildWorkoutReview","p949RenderReview","p949HideReview","p949GetPriorHistory"], mutatesBaseP:false, backupCovered:false, exportSyncRelated:false, purpose:"Local deterministic post-save summary of wins/watch items using existing logs and progression signals." },
      userProfile: { storageKeys:[USER_PROFILE_KEY], functions:["p950GetDefaultUserProfile","p950GetUserProfile","p950SaveUserProfile","p950NormalizeUserProfile","p950InitUserProfile","p950RenderUserProfile","p950SaveUserProfileFromUI","p950ResetUserProfileDefaults","p950BuildUserProfileExport","mfUserProfileDebug"], mutatesBaseP:false, backupCovered:true, exportSyncRelated:true, purpose:"Structured, schema-versioned general identity/goals/units/gym-label foundation for future shared-app support (added 9.5.0). Does not store live/current weight (owned by daily logs) or detailed bodybuilding philosophy (remains in AI_PREFS_KEY). Does not control workout/program behavior in this release; gym labels are stored but not globally applied yet." },
      onboardingState: { storageKeys:[ONBOARDING_KEY], functions:["p951GetDefaultOnboardingState","p951NormalizeOnboardingState","p951GetOnboardingState","p951SaveOnboardingState","p951HasMeaningfulExistingData","p951IsFreshInstall","p951InitOnboardingState","mfOnboardingDebug"], mutatesBaseP:false, backupCovered:true, exportSyncRelated:false, purpose:"Versioned onboarding-state storage + conservative fresh-install detection foundation (added 9.5.1). Storage-only in this release — no visible onboarding UI yet. Separate from and never merged into mf-user-profile. Existing/established installs are safely migrated straight to status 'completed' on first load so they are never shown onboarding they don't need; genuinely fresh installs start at 'not_started'. Not included in AI exports." },
      programProposal: { storageKeys:[PROGRAM_PROPOSAL_KEY], functions:["p954GetDefaultProposal","p954NormalizeProposal","p954ValidateProgramProposal","p955BuildProposalSourceContext","p954BuildProgramProposal","p954GenerateAndSaveProposal","p955GetProposalQualityMetrics","p954BuildApplicationPlan","p954ApplyProposal","p954BuildUndoPlan","p954UndoAppliedProposal","p955BuildProposalExport","mfOnboardingProgramProposalDebug","mfOnboardingProgramProposalSourceDebug","mfGenerateOnboardingProgramProposalPreview"], mutatesBaseP:false, backupCovered:true, exportSyncRelated:true, purpose:"9.5.5 deterministic local proposal generation records profile, onboarding, coaching-preference, resolved-program, lifecycle/override, and skipped-log source coverage. The compact Sync card, detailed review, debug helper, and AI export distinguish local, fixture, and legacy proposals. Same-day reorder and metadata-only operations remain validator-gated; optional add/remove and exercise replace/add/remove/reactivate remain deferred. Apply and scoped undo preserve base P, logs, history, and unrelated lifecycle/override state." }
    };
  } catch(e){ summary.errors.push("systems section failed: "+(e&&e.message)); }

  // 4. High-level data schema summaries (shapes only — no raw dumps)
  try {
    summary.dataSchemas = {
      "day-YYYY-MM-DD": { type:"object", shape:"Daily metrics: {date, weight?, water?, zep?, bm?, recovery:{...}, habits:{...}}", missingIsValid:true, corruptJsonHandled:"Yes — reads wrapped in try/catch with {} fallback throughout the app." },
      "day-YYYY-MM-DD-wo": { type:"object", shape:"Workout log: {gym, dayIdx, exercises:[{id, sets:[{load,reps,rir}, ...]}, ...]}", missingIsValid:true, corruptJsonHandled:"Yes — getTodayWoData() and history readers use try/catch with {} fallback." },
      "mf-current-draft (DRAFT_KEY)": { type:"object|null", shape:"In-progress unsaved workout entry, same rough shape as a workout log.", missingIsValid:true, corruptJsonHandled:"Yes — getDraft() try/catch returns null on parse failure." },
      "mf-overrides (OVR)": { type:"object", shape:"{ exerciseId: { field: value, ... }, ... } — sparse, only overridden fields present.", missingIsValid:true, corruptJsonHandled:"Yes — getOvr() try/catch returns {} on parse failure." },
      "mf-exercise-state (LIFECYCLE_KEY)": { type:"object", shape:"{schemaVersion, lifecycleVersion, customExercises, inactiveIds, replacements, orderOverrides, dayOverrides, dayAdditions}", missingIsValid:true, corruptJsonHandled:"Yes — getLifecycle() try/catch and missing schemaVersion both fall back to exLifecycleDefault()." },
      "mf-recommendations (RECS_KEY)": { type:"object", shape:"{ \"gymKey:dayIdx\": { items:[...], strategy, experimentTag, expiresAfterSessions, ... }, ... }", missingIsValid:true, corruptJsonHandled:"Yes — try/catch with {} fallback." },
      "mf-ai-coaching-preferences (AI_PREFS_KEY)": { type:"string", shape:"Free-text persistent coaching preferences block, defaults to AI_PREFS_STARTER_TEMPLATE when reset.", missingIsValid:true, corruptJsonHandled:"N/A — stored as raw string, not JSON." },
      "mf-user-profile (USER_PROFILE_KEY)": { type:"object", shape:"{schemaVersion, profileVersion, identity:{displayName}, body:{heightInches}, goals:{primaryGoal,physiqueOutcome}, preferences:{weightUnit,distanceUnit,firstDayOfWeek}, app:{homeGymLabel,partialGymLabel}, createdAt, updatedAt}", missingIsValid:true, corruptJsonHandled:"Yes — p950GetUserProfile()/p950InitUserProfile() try/catch, malformed JSON recovers to Marcus defaults without crashing." },
      "mf-onboarding-state (ONBOARDING_KEY)": { type:"object", shape:"{schemaVersion, onboardingVersion, status:'not_started'|'in_progress'|'completed'|'skipped', currentStep, startedAt, completedAt, skippedAt, updatedAt, draft:{}}", missingIsValid:true, corruptJsonHandled:"Yes — p951GetOnboardingState()/p951InitOnboardingState() try/catch; malformed JSON is recovered conservatively (re-runs fresh-install evaluation rather than blindly resetting to not_started), added 9.5.1." },
      "mf-onboarding-program-proposal (PROGRAM_PROPOSAL_KEY)": { type:"object|absent", shape:"{schemaVersion, proposalVersion, status:'draft'|'applied'|'dismissed'|'undone', source, generatedAt, appliedAt, undoneAt, dismissedAt, applicationId, applicationSummary, preApplySnapshot, undoSummary, summary, dayPlans, warnings}", missingIsValid:true, corruptJsonHandled:"Yes — raw inspection reports malformed JSON and genuinely invalid explicit values as a distinct error state. The additive undone status and audit metadata normalize, validate, back up, restore, and render without a new storage key." },
      "mf-habit-definitions": { type:"object", shape:"{schemaVersion, definitionVersion, habits:{stableId:definition}, order:[stableId], createdAt, updatedAt}", missingIsValid:true, corruptJsonHandled:"Yes — safe read fallback plus explicit debug and post-restore warnings; raw storage is not silently discarded." },
      "mf-habit-proposal": { type:"object|absent", shape:"{schemaVersion, proposalVersion, proposalId, status, source, summary, rationale, changes, validation, applyState, undoSnapshot}", missingIsValid:true, corruptJsonHandled:"Yes — malformed proposals are ignored for application and reported by read-only debug/post-restore validation." }
    };
  } catch(e){ summary.errors.push("dataSchemas section failed: "+(e&&e.message)); }

  // 5. Backup/restore coverage (documentation only — behavior unchanged)
  try {
    summary.backupRestore = {
      includedKeys: "Any key matched by p8IsMarcusFitKey(): day-* logs/workouts, "+OVR+", "+DRAFT_KEY+", "+LIFECYCLE_KEY+", "+RECS_KEY+", "+AI_PREFS_KEY+", "+USER_PROFILE_KEY+" (added 9.5.0), "+ONBOARDING_KEY+" (added 9.5.1), "+PROGRAM_PROPOSAL_KEY+" (added 9.5.4), mf-habit-definitions and mf-habit-proposal (added 9.6.0).",
      excludedKeys: "Any non-MarcusFit localStorage key, and any future 'mf-*' key not yet added to p8IsMarcusFitKey() (see storage.unrecognizedMarcusFitLookingKeys above).",
      detectionMechanism: "p8IsMarcusFitKey(key) allowlist checked against Object.keys(localStorage); p8GetMarcusFitKeys() filters the full key list through it.",
      restoreFlow: "p8ValidateBackup → p8MigrateBackup (schemaVersion switch, currently only v1) → p8492SummarizeBackup preview + in-app confirm panel (p8RestoreConfirmPanel, replaces native confirm() as of 9.4.9.2) → p8ExecuteRestore: remove existing MarcusFit keys → restore raw strings → mfRunPostRestoreValidation() → reload.",
      riskAreas: [
        "p8IsMarcusFitKey() is a manual allowlist — any new localStorage key added in a future release must be added here or it silently falls outside backup/restore coverage. mfBackupDebug() (9.4.9.2) surfaces this gap at runtime.",
        "Migration framework (p8MigrateBackup) only handles schemaVersion 1 today; a real future schema bump has no tested migration path yet.",
        "p8ClearData() now uses the same in-app two-step confirm pattern (p8ClearConfirmPanel) as restore, as of 9.4.9.2 — resolved native-confirm() risk for both flows."
      ]
    };
  } catch(e){ summary.errors.push("backupRestore section failed: "+(e&&e.message)); }

  // 6. AI export/sync map
  try {
    summary.aiExportSync = {
      mainExportFunction: "genExport()",
      majorExportSections: [
        "Header (version, generated date, export range, total logged days, weight trend)",
        "User Profile block (p950BuildUserProfileExport, added 9.5.0 — concise identity/goals/units/gym-labels, no raw JSON)",
        "Persistent AI Coaching Preferences block (p9GetCoachPrefs)",
        "Exercise Rotation / Swap Candidate Intelligence block (p9489BuildSwapCandidateExport)",
        "Current Program Templates snapshot (base + virtual/additive days, via getResolvedProgram/getResolvedDays)",
        "Log section (buildLogSection)",
        "AI Sync Format Instructions + supported _action reference + AI Sync philosophy/action-hierarchy guidance"
      ],
      aiCoachingPreferencesInclusion: "Always included near the top of every export, from AI_PREFS_KEY, defaulting to 'No persistent AI coaching preferences saved.' if empty.",
      swapCandidateSection: "p9489BuildSwapCandidateExport() → p9489FormatSwapCandidateSection(), day-type-aware, self-contained try/catch with a safe fallback string.",
      progressionExport: "p9BuildProgressionExport(ex) appended per-exercise inside the program snapshot.",
      aiSyncApplyFunction: "Main AI Sync parser (Phase 4, ~line 5626) processes MARCUSFIT_UPDATE JSON blocks in ordered pre-passes.",
      supportedActionTypes: ["replace","reactivate","remove","reorder","day_override","day_override_clear","day_addition","day_addition_clear","custom_exercise","recommendations"],
      noBaseP_MutationRule: "Explicitly documented in the export instructions themselves ('Never mutate the base program (P) through AI Sync') and enforced structurally — all AI Sync actions write to LIFECYCLE_KEY, RECS_KEY, or OVR, never to P.",
      virtualAdditiveDayCompatibility: "Program snapshot and recommendations both include/target virtual days explicitly (day_addition/day_addition_clear actions, _isVirtual flag).",
      recommendationsCompatibility: "recommendations action works on base and virtual Day 7+ via the same gymKey/dayIndex validation against getResolvedProgram()."
    };
  } catch(e){ summary.errors.push("aiExportSync section failed: "+(e&&e.message)); }

  // 7. Program architecture map
  try {
    summary.programArchitecture = {
      baseP: "Hardcoded source-of-truth templates per gym/day/exercise. Read-only at runtime.",
      resolvedProgram: "getResolvedProgram() — deep-derives from P + lifecycle (inactiveIds, customExercises, orderOverrides). Never mutates P or lifecycle.",
      resolvedDays: "getResolvedDays(gymKey) — resolvedProgram's base days plus virtual/additive days from dayAdditions, in display order.",
      overrides: "mf-overrides (OVR) — sparse per-exercise field overrides, applied via getF() at render/export time, layered on top of P.",
      customExerciseRole: "Exercises that don't exist in base P, created via AI Sync _action:custom_exercise or manual UI, stored in lifecycle.customExercises, addressable on base or virtual days.",
      orderOverrideRole: "Reorders (never adds/removes) exercises within a resolved day, stored per 'gym:dayIdx' key in lifecycle.orderOverrides.",
      dayOverrideRole: "Overrides day-level metadata (name/subtitle/focus/note/tag/meta) on base days only, via getEffectiveDayMeta().",
      dayAdditionRole: "Defines entirely new virtual days appended after the base program's day count, surfaced through getResolvedDays().",
      disabledDayRole: "9.5.4C: marks a base or virtual day as proposal-removed (lc.disabledDays[gym][dayIdx] = {disabledAt, source, proposalId, reason}). Read-safe only — never deletes the day, its exercises, or its history. Excluded from the Program tab and Daily Log day selector (via isDayDisabled() filters at render time, no renumbering); still resolvable through getResolvedDays()/getSafeDayForLog() for history and debugging.",
      applicationEngineRole: "9.5.4E: p954BuildApplicationPlan()/p954ApplyProposal() retain the accepted 9.5.4D day, reorder, and metadata application transaction. New applications also persist exact pre-apply and expected post-apply raw lifecycle/override values. p954BuildUndoPlan() permits one reversal only while those touched keys still match this application (or are already restored); p954UndoAppliedProposal() restores exact raw values, writes an undone audit record, verifies the result, and rolls all three touched keys back exactly on failure. Legacy C/D records remain readable but are not auto-undoable when exact raw snapshot fields are absent. Replace/add/remove/reactivate stay deferred. Base P, stable IDs, recommendations, logs, and history are never mutated by undo.",
      knownRule: "Base P must never be mutated by AI Sync or any runtime code — all dynamic behavior is layered through lifecycle state, overrides, and recommendations."
    };
  } catch(e){ summary.errors.push("programArchitecture section failed: "+(e&&e.message)); }

  // 8. Hardcoded Marcus-specific assumptions (mapped only — not removed in this release)
  try {
    summary.hardcodedAssumptions = {
      branding: "App name 'MarcusFit' hardcoded in <title>, Sync tab version box, and export header text.",
      gymNaming: "Gym keys/labels are personal: 'home' → HOME PROGRAM, 'partial' → TRANSITION GYM PROGRAM — not generic 'Gym A/B' naming.",
      programDefaults: "Base P exercise selection, loads, and rep ranges are tuned to Marcus's specific equipment access and current strength levels (e.g. specific DB weights, specific machines).",
      fixedDailyHabits: "HABITS array is Marcus-specific: Jawline/Posture, Desk Posture, Box Breathing, Kegel Holds, Water Intake, BM Tracking, Steps — not a general/customizable habit list.",
      fixedDailyMetrics: "Daily vitals fields include Zepbound dose tracking (d.zep) and BM tracking, both tied to Marcus's specific GLP-1/health context; would not apply to all users.",
      aiCoachingPreferencesDefaultTemplate: "AI_PREFS_STARTER_TEMPLATE hardcodes Marcus's specific physique priorities (lateral delts, upper chest, lat width, etc.) and programming philosophy as the reset/default text.",
      exportWording: "genExport()/AI Sync instructions hardcode 'Marcus is on Zepbound (GLP-1), down 60+ lbs, goal: fat loss + muscle retention' directly into the AI Sync philosophy guidance.",
      physiquePriorities: "Physique/aesthetic priority ordering (delts > chest > lats > rear delts > triceps > back > biceps > core) is Marcus's personal goal, hardcoded into the starter coaching template.",
      personalTrainingAssumptions: "Notes like 'warehouse' stair-climbing in the Steps habit instructions and workplace-specific phrasing assume Marcus's specific job/environment."
    };
  } catch(e){ summary.errors.push("hardcodedAssumptions section failed: "+(e&&e.message)); }

  // 9. Risks and suggested next abstractions
  try {
    summary.risksAndNextAbstractions = [
      "Profile/preferences foundation (name, height, goals, units, gym labels) landed in 9.5.0 via mf-user-profile — it does not yet drive any workout/program behavior or globally rename Home/Transition UI surfaces; that remains future work.",
      "Onboarding-state storage + conservative fresh-install detection landed in 9.5.1 via mf-onboarding-state — no visible onboarding screens exist yet; that UI is future work on top of this foundation.",
      "Custom/user-defined habits are needed before this becomes a shareable app — HABITS is currently a fixed array.",
      "Backup polish (see backupRestore.riskAreas) should land before any real schema migration is attempted.",
      "A compact export mode may eventually be needed for lower-tier/free-plan users with large history.",
      "If a custom-program foundation grows much further, consider a multi-file/module split before it does — current single-file size is already large.",
      "Hardcoded Marcus assumptions (branding, habits, daily metrics, AI coaching template, export wording) should move into a profile/settings system before sharing the app with anyone else.",
      "p8IsMarcusFitKey() allowlist should be reviewed any time a new localStorage key is introduced, to avoid silent backup/restore gaps.",
      "9.5.4E supports one user-facing undo of the currently saved applied proposal when its exact raw pre-apply snapshot remains valid and touched live state still matches the application. This is not a general undo/history stack. Unsupported structured replace, add, remove, and reactivate actions remain review-only/deferred and are never activated by undo.",
      "The deterministic 9.5.5 builder can propose same-day priority reorders and conservative metadata-only RIR/focus changes from saved physique and coaching-preference signals. It does not call an external AI or use recent logs.",
      "Optional add/remove and exercise replace/add/remove/reactivate actions remain review-only/deferred. They require a future lifecycle application phase with explicit conflict and history-safe behavior."
    ];
  } catch(e){ summary.errors.push("risksAndNextAbstractions section failed: "+(e&&e.message)); }

  // 10. Debug helper registry
  try {
    summary.debugHelpers = {
      APP_VERSION: { type: typeof APP_VERSION, purpose:"Current app version string." },
      mfLifecycleDebug: { available: typeof window.mfLifecycleDebug==="function", purpose:"Inspects/validates exercise lifecycle state (inactiveIds, replacements, orderOverrides, dayOverrides, dayAdditions)." },
      mfProgressionDebug: { available: typeof window.mfProgressionDebug==="function", purpose:"Per-exercise progression status/history debug (mfProgressionDebug(exId))." },
      mfProgressionAudit: { available: typeof window.mfProgressionAudit==="function", purpose:"Audits progression status across all active exercises." },
      mfDayOverrideDebug: { available: typeof window.mfDayOverrideDebug==="function", purpose:"Inspects day-level metadata overrides." },
      mfDayAdditionDebug: { available: typeof window.mfDayAdditionDebug==="function", purpose:"Inspects virtual/additive day state." },
      mfFixOrderOverrideIntegrity: { available: typeof window.mfFixOrderOverrideIntegrity==="function", purpose:"Repairs order override integrity issues (mutating — not read-only)." },
      p9489BuildSwapCandidateExport: { available: typeof window.p9489BuildSwapCandidateExport==="function", purpose:"Builds the exercise rotation/swap candidate export section." },
      mfWorkoutReviewDebug: { available: typeof window.mfWorkoutReviewDebug==="function", purpose:"Inspects the most recent workout-review-after-save computation." },
      mfArchitectureDebug: { available: true, purpose:"Read-only architecture/system inventory (added 9.4.9.1)." },
      mfBackupDebug: { available: typeof window.mfBackupDebug==="function", purpose:"Read-only backup readiness/coverage check — recognized keys, excluded MarcusFit-looking keys, in-memory backup preview (added 9.4.9.2)." },
      mfUserProfileDebug: { available: typeof window.mfUserProfileDebug==="function", purpose:"Read-only mf-user-profile inspection — existence/parse status, schema version, normalized field values, backup coverage, export preview (added 9.5.0)." },
      mfOnboardingDebug: { available: typeof window.mfOnboardingDebug==="function", purpose:"Read-only mf-onboarding-state inspection — existence/parse status, normalized fields, fresh-install evaluation, meaningful-data evidence, backup coverage (added 9.5.1); extended in 9.5.2 with overlayVisible + renderedStep." },
      mfOpenOnboardingPreview: { available: typeof window.mfOpenOnboardingPreview==="function", purpose:"Opens the onboarding overlay for visual/UI testing on any install without resetting or overwriting onboarding state (added 9.5.2)." },
      mfOnboardingCompletionDebug: { available: typeof window.mfOnboardingCompletionDebug==="function", purpose:"Read-only inspection of onboarding-completion validation/application state (added 9.5.3)." },
      mfOnboardingProgramProposalDebug: { available: typeof window.mfOnboardingProgramProposalDebug==="function", purpose:"Read-only proposal inspection covering application plus 9.5.4E undo eligibility, planned storage operations, conflicts/warnings, validation errors, exact-restoration verification, and idempotency. Never exposes raw storage." },
      mfGenerateOnboardingProgramProposalPreview: { available: typeof window.mfGenerateOnboardingProgramProposalPreview==="function", purpose:"Builds and returns a program proposal in memory without saving it — safe to call anytime for testing (added 9.5.4)." },
      mfOnboardingProgramProposalReviewDebug: { available: typeof window.mfOnboardingProgramProposalReviewDebug==="function", purpose:"Read-only detailed-review inspection including proposal validation, rendered groups/days/exercises, structured exercise details, warnings, apply-preview state/errors, applied summary, and fingerprint protection (extended through 9.5.4D)." },
      mfOnboardingProgramProposalApplicationDebug: { available: typeof window.mfOnboardingProgramProposalApplicationDebug==="function", purpose:"Concise application and undo debug: status/IDs, plan/deferred counts, apply/undo validation errors, snapshot validity, exact restoration, and idempotency. No raw storage or log dumps." },
      mfOnboardingProgramProposalUndoDebug: { available: typeof window.mfOnboardingProgramProposalUndoDebug==="function", purpose:"Read-only 9.5.4E undo inspection: status/audit timestamps, snapshot availability/validity, canUndo, operations, conflicts, warnings, validation errors, exact restoration, and idempotency." },
      p954GetApplicationSnapshot: { available: typeof window.p954GetApplicationSnapshot==="function", purpose:"Returns a safe clone of preApplySnapshot. E applications add exact raw pre/post state for guarded undo; accepted legacy C/D snapshots remain readable but may be unavailable for automatic undo." }
    };
  } catch(e){ summary.errors.push("debugHelpers section failed: "+(e&&e.message)); }

  console.log("[MarcusFit] mfArchitectureDebug():", summary);
  return summary;
};
var mfArchitectureDebug = window.mfArchitectureDebug;
// ── END PHASE 9.4.9.1 ──────────────────────────────────────────────────────────


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

// -- PHASE 9.6.0: PERSONALIZED HABITS ---------------------------------------
const P960_HABIT_DEFINITIONS_KEY="mf-habit-definitions";
const P960_HABIT_PROPOSAL_KEY="mf-habit-proposal";
const P960_HABIT_SCHEMA_VERSION=1;
const P960_PROPOSAL_SCHEMA_VERSION=1;
const P960_WEEKDAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const P960_TARGET_TYPES=["checkbox","number","duration","count","text"];
const P960_SCHEDULE_TYPES=["daily","weekdays","weekly_count"];
const P960_SOURCES=["default","user","ai","imported"];
const P960_MODIFY_FIELDS=["name","icon","description","target","schedule","instructions","emphasis"];
let p960HabitManagerDraft=null;
let p960HabitManagerEditingId=null;

function p960Clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function p960Now(){return new Date().toISOString();}
function p960DateKey(value){
  if(typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
  const d=value instanceof Date?value:new Date(value||Date.now());
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function p960ParseDate(key){const p=String(key||"").split("-").map(Number);return new Date(p[0],p[1]-1,p[2],12,0,0,0);}
function p960AddDays(key,count){const d=p960ParseDate(key);d.setDate(d.getDate()+count);return p960DateKey(d);}
function p960StableStringify(value){
  if(Array.isArray(value))return "["+value.map(p960StableStringify).join(",")+"]";
  if(value&&typeof value==="object")return "{"+Object.keys(value).sort().map(function(k){return JSON.stringify(k)+":"+p960StableStringify(value[k]);}).join(",")+"}";
  return JSON.stringify(value);
}
function p960Fingerprint(value){
  const s=p960StableStringify(value);let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(16).padStart(8,"0");
}
function p960SafeId(name){
  const base="habit-"+String(name||"custom").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g,"").trim().replace(/[\s_]+/g,"-").replace(/-+/g,"-").slice(0,42).replace(/-$/,"")||"habit-custom";
  const used=new Set(Object.keys(p960GetHabitStore().habits));let id=base,n=2;while(used.has(id)){id=base+"-"+n++;}return id;
}
function p960DefaultTarget(display){
  const text=String(display||""),number=text.match(/(\d[\d,]*(?:\.\d+)?)/);let type="checkbox",unit="";
  if(number){type=/sec|min|hour/i.test(text)?"duration":/step|cycle|rep|hold|round|reset|set/i.test(text)?"count":"number";const m=text.match(/\b(oz|steps?|minutes?|mins?|hours?|hrs?|seconds?|secs?|reps?|sets?|rounds?|cycles?)\b/i);unit=m?m[1]:"";}
  return {type:type,value:number?Number(number[1].replace(/,/g,"")):null,unit:unit,display:text};
}
function p960BuildDefaultDefinitions(at){
  const stamp=at||p960Now(),habits={};
  HABITS.forEach(function(h){habits[h.id]={id:h.id,name:h.name,icon:h.icon,description:"",target:p960DefaultTarget(h.target),schedule:{type:"daily"},instructions:p960Clone(h.instructions),emphasis:"normal",active:true,archivedAt:null,source:"default",createdAt:stamp,updatedAt:stamp,legacyEligibilityInferred:true,aiMeta:{lastProposalId:null,lastChangedBy:null}};});
  return {schemaVersion:1,definitionVersion:"9.6.0",habits:habits,order:HABITS.map(function(h){return h.id;}),createdAt:stamp,updatedAt:stamp};
}
function p960EmptyHabitStore(at){const stamp=at||p960Now();return {schemaVersion:1,definitionVersion:"9.6.0",habits:{},order:[],createdAt:stamp,updatedAt:stamp};}
function p960NormalizeTarget(raw){
  const source=raw&&typeof raw==="object"?p960Clone(raw):{display:String(raw||"")};
  source.type=P960_TARGET_TYPES.includes(source.type)?source.type:"checkbox";source.display=String(source.display==null?"":source.display);source.unit=String(source.unit==null?"":source.unit);
  if(["number","duration","count"].includes(source.type)){const n=Number(source.value);source.value=Number.isFinite(n)&&n>=0?n:null;}else if(!Object.prototype.hasOwnProperty.call(source,"value"))source.value=null;
  return source;
}
function p960NormalizeSchedule(raw){
  const source=raw&&typeof raw==="object"?p960Clone(raw):{type:"daily"};source.type=P960_SCHEDULE_TYPES.includes(source.type)?source.type:"daily";
  if(source.type==="weekdays")source.weekdays=[...new Set((Array.isArray(source.weekdays)?source.weekdays:[]).map(Number).filter(function(n){return Number.isInteger(n)&&n>=0&&n<=6;}))].sort();
  if(source.type==="weekly_count"){const count=Math.floor(Number(source.targetCount));source.targetCount=count>0&&count<=14?count:1;source.weekStartsOn=Number.isInteger(Number(source.weekStartsOn))&&Number(source.weekStartsOn)>=0&&Number(source.weekStartsOn)<=6?Number(source.weekStartsOn):0;}
  return source;
}
function p960NormalizeHabit(raw,id){
  const source=raw&&typeof raw==="object"?p960Clone(raw):{},stable=String(id||source.id||"");source.id=stable;source.name=String(source.name||stable||"Unnamed habit");source.icon=String(source.icon||"✓");source.description=String(source.description||"");source.instructions=Array.isArray(source.instructions)?source.instructions.map(String):[];
  source.target=p960NormalizeTarget(source.target);source.schedule=p960NormalizeSchedule(source.schedule);source.emphasis=["low","normal","high"].includes(source.emphasis)?source.emphasis:"normal";source.active=source.active!==false;source.archivedAt=source.active?null:(source.archivedAt||null);source.source=P960_SOURCES.includes(source.source)?source.source:"imported";source.createdAt=source.createdAt||null;source.updatedAt=source.updatedAt||source.createdAt||null;source.aiMeta=Object.assign({lastProposalId:null,lastChangedBy:null},source.aiMeta&&typeof source.aiMeta==="object"?source.aiMeta:{});return source;
}
function p960NormalizeHabitStore(raw){
  const source=raw&&typeof raw==="object"?p960Clone(raw):p960EmptyHabitStore(),normalized=Object.assign({},source);normalized.schemaVersion=1;normalized.definitionVersion=String(source.definitionVersion||"9.6.0");normalized.habits={};
  const input=source.habits&&typeof source.habits==="object"?source.habits:{};Object.keys(input).forEach(function(id){if(/^habit-[a-z0-9][a-z0-9-]*$/i.test(id))normalized.habits[id]=p960NormalizeHabit(input[id],id);});
  const seen=new Set();normalized.order=[];(Array.isArray(source.order)?source.order:[]).forEach(function(id){if(normalized.habits[id]&&!seen.has(id)){seen.add(id);normalized.order.push(id);}});Object.keys(normalized.habits).forEach(function(id){if(!seen.has(id))normalized.order.push(id);});normalized.createdAt=source.createdAt||null;normalized.updatedAt=source.updatedAt||null;return normalized;
}
function p960HasHistoricalHabits(){return Object.keys(localStorage).some(function(k){if(!/^day-\d{4}-\d{2}-\d{2}$/.test(k))return false;try{const d=JSON.parse(localStorage.getItem(k));return !!(d&&d.habits&&Object.keys(d.habits).length);}catch(e){return false;}});}
function p960ShouldSeedMarcusDefaults(){
  if(p960HasHistoricalHabits())return true;
  try{const p=p950GetUserProfile();if(p&&String(p.firstName||p.name||"").trim().toLowerCase()==="marcus")return true;}catch(e){}
  try{const basis=getActiveProgramBasis();if(basis&&basis.explicit===true)return false;}catch(e){}
  try{const o=p951GetOnboardingState();if(o&&["not_started","in_progress","skipped"].includes(o.status))return false;}catch(e){}
  try{return !!p951HasMeaningfulExistingData();}catch(e){return false;}
}
function p960GetHabitStore(){const raw=localStorage.getItem(P960_HABIT_DEFINITIONS_KEY);if(raw!==null){try{return p960NormalizeHabitStore(JSON.parse(raw));}catch(e){return p960EmptyHabitStore();}}return p960ShouldSeedMarcusDefaults()?p960BuildDefaultDefinitions():p960EmptyHabitStore();}
function p960SaveHabitStore(store){const normalized=p960NormalizeHabitStore(store),now=p960Now();normalized.createdAt=normalized.createdAt||now;normalized.updatedAt=now;normalized.definitionVersion=APP_VERSION;localStorage.setItem(P960_HABIT_DEFINITIONS_KEY,JSON.stringify(normalized));return normalized;}
function p960InitHabitStore(){if(localStorage.getItem(P960_HABIT_DEFINITIONS_KEY)!==null)return {created:false,store:p960GetHabitStore()};const store=p960ShouldSeedMarcusDefaults()?p960BuildDefaultDefinitions():p960EmptyHabitStore();p960SaveHabitStore(store);return {created:true,seededDefaults:Object.keys(store.habits).length===7,store:store};}
function p960GetHabitDefinitions(){return p960GetHabitStore().habits;}
function p960GetActiveHabits(){const store=p960GetHabitStore();return store.order.map(function(id){return store.habits[id];}).filter(function(h){return h&&h.active;});}
function p960GetHabitById(id){return p960GetHabitStore().habits[id]||p960BuildDefaultDefinitions("legacy").habits[id]||null;}
function p960GetHabitWeekRange(habit,date){const key=p960DateKey(date),schedule=habit&&habit.schedule||{},startOn=schedule.type==="weekly_count"?Number(schedule.weekStartsOn||0):0,d=p960ParseDate(key),start=p960AddDays(key,-((d.getDay()-startOn+7)%7));return {start:start,end:p960AddDays(start,6)};}
function p960IsWithinActiveRange(habit,date){const key=p960DateKey(date);if(habit.createdAt&&!habit.legacyEligibilityInferred&&key<p960DateKey(habit.createdAt))return false;if(habit.archivedAt&&key>p960DateKey(habit.archivedAt))return false;return true;}
function p960IsHabitDueOnDate(habit,date){if(!habit||!p960IsWithinActiveRange(habit,date))return false;const schedule=p960NormalizeSchedule(habit.schedule),day=p960ParseDate(p960DateKey(date)).getDay();if(schedule.type==="daily")return true;if(schedule.type==="weekdays")return schedule.weekdays.includes(day);return schedule.type==="weekly_count";}
function p960ReadDay(date){try{return JSON.parse(localStorage.getItem("day-"+p960DateKey(date))||"null")||{};}catch(e){return {};}}
function p960GetWeeklyHabitProgress(habit,date){const range=p960GetHabitWeekRange(habit,date);let completed=0;for(let d=range.start;d<=range.end;d=p960AddDays(d,1)){const state=(p960ReadDay(d).habits||{})[habit.id];if(state&&state.completed)completed++;}const target=Math.max(1,Number(habit.schedule&&habit.schedule.targetCount)||1);return {start:range.start,end:range.end,completed:completed,target:target,met:completed>=target,label:completed+" / "+target+" this week"};}
function p960GetHabitDisplayState(habit,date){const key=p960DateKey(date),state=(p960ReadDay(key).habits||{})[habit.id]||{},weekly=habit.schedule.type==="weekly_count"?p960GetWeeklyHabitProgress(habit,key):null,due=p960IsHabitDueOnDate(habit,key);return {active:!!habit.active,archived:!habit.active,dueToday:due,notDue:!due,completed:!!state.completed,weeklyProgress:weekly,weeklyTargetMet:!!(weekly&&weekly.met),weeklyTargetNotYetMet:!!(weekly&&!weekly.met)};}
function p960HabitTargetText(h){const t=h.target||{};return t.display||([t.value,t.unit].filter(function(x){return x!==null&&x!=="";}).join(" "))||"Complete";}
function p960HabitScheduleText(h){const s=h.schedule||{};if(s.type==="weekdays")return (s.weekdays||[]).map(function(d){return P960_WEEKDAYS[d].slice(0,3);}).join(", ");if(s.type==="weekly_count")return s.targetCount+" times weekly";return "Daily";}
function p960GetRenderedHabits(date){const key=p960DateKey(date);return p960GetActiveHabits().filter(function(h){return h.schedule.type==="weekly_count"||p960IsHabitDueOnDate(h,key);});}

initHabitState=function(){return p960GetActiveHabits().reduce(function(acc,h){acc[h.id]={completed:false,notes:""};return acc;},{});};
renderHabits=function(){
  const container=document.getElementById("habitCards"),progress=document.getElementById("habitsProgress");if(!container||!progress)return;const openCards=new Set(Array.from(document.querySelectorAll(".habit-card.open")).map(function(el){return el.id;}));container.innerHTML="";const habits=p960GetRenderedHabits(p960DateKey(tDate));let done=0;
  if(!habits.length){const empty=document.createElement("div");empty.className="p960-empty";empty.textContent=p960GetActiveHabits().length?"No habits are due on this date.":"No active habits yet.";const button=document.createElement("button");button.type="button";button.textContent="Manage Habits";button.onclick=p960OpenHabitManager;empty.appendChild(button);container.appendChild(empty);}
  habits.forEach(function(h){const state=habitState[h.id]||{completed:false,notes:""};if(state.completed)done++;const card=document.createElement("div");card.className="habit-card"+(state.completed?" completed":"")+(openCards.has("hcard-"+h.id)?" open":"");card.id="hcard-"+h.id;
    const top=document.createElement("div");top.className="habit-card-top";top.onclick=function(){toggleHabitOpen(h.id);};const check=document.createElement("div");check.className="habit-check";check.textContent=state.completed?"✓":"";check.onclick=function(e){toggleHabitDone(e,h.id);};const info=document.createElement("div");info.className="habit-info";const name=document.createElement("div");name.className="habit-name";name.textContent=h.icon+" "+h.name;const target=document.createElement("div");target.className="habit-target";target.textContent=p960HabitTargetText(h)+" · "+p960HabitScheduleText(h);if(h.schedule.type==="weekly_count")target.textContent+=" · "+p960GetWeeklyHabitProgress(h,p960DateKey(tDate)).label;const expand=document.createElement("div");expand.className="habit-expand";expand.textContent="▼";info.append(name,target);top.append(check,info,expand);card.appendChild(top);
    const body=document.createElement("div");body.className="habit-body";if(h.description){const desc=document.createElement("div");desc.className="p960-description";desc.textContent=h.description;body.appendChild(desc);}const ul=document.createElement("ul");ul.className="habit-instructions";h.instructions.forEach(function(text){const li=document.createElement("li");li.textContent=text;ul.appendChild(li);});body.appendChild(ul);
    if(["number","duration","count","text"].includes(h.target.type)){const label=document.createElement("label");label.className="habit-note-label";label.textContent="Recorded value";const value=document.createElement("input");value.className="habit-note-input";value.type=h.target.type==="text"?"text":"number";value.value=state.value==null?"":state.value;value.placeholder=h.target.unit||"Optional value";value.oninput=function(){updateHabitValue(h.id,this.value,h.target.type);};body.append(label,value);}
    const noteLabel=document.createElement("label");noteLabel.className="habit-note-label";noteLabel.textContent="Notes";const note=document.createElement("input");note.className="habit-note-input";note.type="text";note.placeholder="Optional note...";note.value=state.notes||"";note.oninput=function(){updateHabitNote(h.id,this.value);};body.append(noteLabel,note);card.appendChild(body);container.appendChild(card);
  });progress.textContent=done+" / "+habits.length;progress.className="habits-progress"+(habits.length&&done===habits.length?" done":"");
};
function updateHabitValue(id,value,type){if(!habitState[id])habitState[id]={completed:false,notes:""};habitState[id].value=type==="text"?value:(value===""?null:Number(value));autoSaveDraft();}

function p960ValidateHabit(h){const errors=[];if(!h||!/^habit-[a-z0-9][a-z0-9-]*$/i.test(h.id||""))errors.push("Stable habit ID is invalid.");if(!String(h&&h.name||"").trim())errors.push("Name is required.");const rawSchedule=h&&h.schedule||{},s=p960NormalizeSchedule(rawSchedule);if(s.type==="weekdays"&&!s.weekdays.length)errors.push("Select at least one weekday.");if(s.type==="weekly_count"&&(!Number.isInteger(Number(rawSchedule.targetCount))||Number(rawSchedule.targetCount)<1||Number(rawSchedule.targetCount)>14))errors.push("Weekly target must be 1–14.");const t=p960NormalizeTarget(h&&h.target),rawValue=h&&h.target&&h.target.value;if(["number","duration","count"].includes(t.type)&&(rawValue===null||rawValue===""||!Number.isFinite(Number(rawValue))||Number(rawValue)<0))errors.push("A valid numeric target is required.");return {valid:errors.length===0,errors:errors};}
function p960EnsureManager(){
  let overlay=document.getElementById("p960HabitManager");if(overlay)return overlay;const style=document.createElement("style");style.textContent=`
  .p960-manage-link{border:1px solid var(--accent);background:transparent;color:var(--accent);border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700}.p960-empty{padding:20px;text-align:center;border:1px dashed var(--border);border-radius:12px;color:var(--muted)}.p960-empty button{display:block;margin:10px auto 0}
  .p960-overlay{display:none;position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,.72);padding:12px}.p960-overlay.open{display:flex}.p960-panel{margin:auto;width:min(720px,100%);max-height:94vh;overflow:auto;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px;box-sizing:border-box}.p960-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.p960-head h2{margin:0;font-size:20px}
  .p960-list{display:grid;gap:8px;margin:14px 0}.p960-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:10px;border:1px solid var(--border);border-radius:10px}.p960-row small{display:block;color:var(--muted);margin-top:3px}.p960-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.p960-actions button,.p960-footer button,.p960-form button{border:1px solid var(--border);background:var(--bg);color:var(--text);border-radius:8px;padding:7px 9px}
  .p960-form{display:none;border:1px solid var(--accent);border-radius:12px;padding:12px;margin:12px 0}.p960-form.open{display:block}.p960-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.p960-field{font-size:10px;color:var(--muted);font-weight:700}.p960-field input,.p960-field select,.p960-field textarea{display:block;width:100%;box-sizing:border-box;margin-top:4px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:9px}.p960-weekdays{display:flex;flex-wrap:wrap;gap:6px;margin-top:5px}.p960-weekdays label{font-size:10px;color:var(--text)}.p960-footer{display:flex;gap:8px;justify-content:flex-end;position:sticky;bottom:-16px;background:var(--card);padding:12px 0}.p960-primary{background:var(--accent)!important;color:#000!important;border-color:var(--accent)!important}.p960-msg{white-space:pre-wrap;color:var(--yellow);font-size:11px;margin:8px 0}.p960-proposal-action{padding:10px;border:1px solid var(--border);border-radius:10px;margin:8px 0;white-space:pre-wrap}.p960-badge{display:inline-block;color:#000;background:var(--accent2);padding:2px 6px;border-radius:5px;font-size:9px;font-weight:800;margin-right:6px}
  @media(max-width:480px){.p960-grid{grid-template-columns:1fr}.p960-panel{padding:12px}.p960-row{grid-template-columns:1fr}.p960-actions{justify-content:flex-start}}`;document.head.appendChild(style);
  overlay=document.createElement("div");overlay.id="p960HabitManager";overlay.className="p960-overlay";overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");const panel=document.createElement("div");panel.className="p960-panel";const head=document.createElement("div");head.className="p960-head";const title=document.createElement("h2");title.textContent="Manage Habits";const close=document.createElement("button");close.type="button";close.textContent="Close";close.onclick=p960CancelHabitManager;head.append(title,close);const msg=document.createElement("div");msg.id="p960ManagerMsg";msg.className="p960-msg";const list=document.createElement("div");list.id="p960HabitList";list.className="p960-list";const add=document.createElement("button");add.type="button";add.textContent="+ Add Habit";add.onclick=function(){p960EditHabit(null);};const form=document.createElement("div");form.id="p960HabitForm";form.className="p960-form";const footer=document.createElement("div");footer.className="p960-footer";const cancel=document.createElement("button");cancel.type="button";cancel.textContent="Cancel";cancel.onclick=p960CancelHabitManager;const save=document.createElement("button");save.type="button";save.className="p960-primary";save.textContent="Save Changes";save.onclick=p960SaveHabitManager;footer.append(cancel,save);panel.append(head,msg,list,add,form,footer);overlay.appendChild(panel);document.body.appendChild(overlay);return overlay;
}
function p960OpenHabitManager(){p960HabitManagerDraft=p960Clone(p960GetHabitStore());p960HabitManagerEditingId=null;const overlay=p960EnsureManager();document.getElementById("p960ManagerMsg").textContent="Changes are saved only when you choose Save Changes.";p960RenderHabitManager();overlay.classList.add("open");}
function p960CancelHabitManager(){const overlay=document.getElementById("p960HabitManager");if(overlay)overlay.classList.remove("open");p960HabitManagerDraft=null;p960HabitManagerEditingId=null;}
function p960RenderHabitManager(){
  if(!p960HabitManagerDraft)return;const list=document.getElementById("p960HabitList");list.innerHTML="";const ids=p960HabitManagerDraft.order.slice();Object.keys(p960HabitManagerDraft.habits).forEach(function(id){if(!ids.includes(id))ids.push(id);});
  ids.forEach(function(id){const h=p960HabitManagerDraft.habits[id],row=document.createElement("div");row.className="p960-row";const text=document.createElement("div"),strong=document.createElement("strong");strong.textContent=h.icon+" "+h.name+(h.active?"":" (Archived)");const small=document.createElement("small");small.textContent=p960HabitTargetText(h)+" · "+p960HabitScheduleText(h)+" · "+h.source;text.append(strong,small);const actions=document.createElement("div");actions.className="p960-actions";
    [["Edit",function(){p960EditHabit(id);}],["↑",function(){p960MoveHabit(id,-1);}],["↓",function(){p960MoveHabit(id,1);}],[h.active?"Archive":"Reactivate",function(){p960ToggleHabitActive(id);}]].forEach(function(a){const b=document.createElement("button");b.type="button";b.textContent=a[0];b.onclick=a[1];actions.appendChild(b);});row.append(text,actions);list.appendChild(row);
  });
}
function p960MoveHabit(id,delta){const order=p960HabitManagerDraft.order,i=order.indexOf(id),j=i+delta;if(i<0||j<0||j>=order.length)return;const temp=order[i];order[i]=order[j];order[j]=temp;p960RenderHabitManager();}
function p960ToggleHabitActive(id){const h=p960HabitManagerDraft.habits[id],now=p960Now();h.active=!h.active;h.archivedAt=h.active?null:now;h.updatedAt=now;p960RenderHabitManager();}
function p960EditHabit(id){
  p960HabitManagerEditingId=id;const existing=id?p960HabitManagerDraft.habits[id]:null,h=existing?p960Clone(existing):p960NormalizeHabit({id:"",name:"",icon:"✓",source:"user",target:{type:"checkbox",value:null,unit:"",display:""},schedule:{type:"daily"},active:true},"");const form=document.getElementById("p960HabitForm");form.innerHTML="";form.classList.add("open");const grid=document.createElement("div");grid.className="p960-grid";
  function field(label,key,type,value){const l=document.createElement("label");l.className="p960-field";l.textContent=label;let input;if(type==="select"){input=document.createElement("select");value.options.forEach(function(o){const op=document.createElement("option");op.value=o;op.textContent=o.replace("_"," ");input.appendChild(op);});input.value=value.value;}else if(type==="textarea"){input=document.createElement("textarea");input.rows=3;input.value=value||"";}else{input=document.createElement("input");input.type=type||"text";input.value=value==null?"":value;}input.dataset.key=key;l.appendChild(input);grid.appendChild(l);return input;}
  field("Name","name","text",h.name);field("Icon / emoji","icon","text",h.icon);field("Description","description","textarea",h.description);field("Target display","targetDisplay","text",h.target.display);field("Target type","targetType","select",{options:P960_TARGET_TYPES,value:h.target.type});field("Numeric target","targetValue","number",h.target.value);field("Unit","targetUnit","text",h.target.unit);field("Schedule","scheduleType","select",{options:P960_SCHEDULE_TYPES,value:h.schedule.type});field("Weekly target count","weeklyCount","number",h.schedule.targetCount||1);field("Instructions (one per line)","instructions","textarea",h.instructions.join("\n"));field("Emphasis","emphasis","select",{options:["low","normal","high"],value:h.emphasis});
  const weekdayWrap=document.createElement("div");weekdayWrap.className="p960-field";weekdayWrap.textContent="Selected weekdays";const weekdayBoxes=document.createElement("div");weekdayBoxes.className="p960-weekdays";P960_WEEKDAYS.forEach(function(day,i){const label=document.createElement("label"),box=document.createElement("input");box.type="checkbox";box.value=String(i);box.dataset.weekday="1";box.checked=(h.schedule.weekdays||[]).includes(i);label.append(box,document.createTextNode(day.slice(0,3)));weekdayBoxes.appendChild(label);});weekdayWrap.appendChild(weekdayBoxes);grid.appendChild(weekdayWrap);
  const idNote=document.createElement("div");idNote.className="p960-msg";idNote.textContent=existing?"Stable ID: "+existing.id:"A stable ID will be generated from the name.";const buttons=document.createElement("div");buttons.className="p960-actions";const discard=document.createElement("button");discard.type="button";discard.textContent="Cancel Edit";discard.onclick=function(){form.classList.remove("open");};const done=document.createElement("button");done.type="button";done.className="p960-primary";done.textContent=existing?"Update Draft":"Add to Draft";done.onclick=p960CommitHabitForm;buttons.append(discard,done);form.append(idNote,grid,buttons);form.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function p960CommitHabitForm(){
  const form=document.getElementById("p960HabitForm"),get=function(k){const el=form.querySelector('[data-key="'+k+'"]');return el?el.value:"";},existing=p960HabitManagerEditingId?p960HabitManagerDraft.habits[p960HabitManagerEditingId]:null,now=p960Now(),name=get("name").trim(),id=existing?existing.id:p960SafeId(name),weekdays=Array.from(form.querySelectorAll("[data-weekday]:checked")).map(function(x){return Number(x.value);});
  const next=p960NormalizeHabit(Object.assign({},existing||{},{id:id,name:name,icon:get("icon")||"✓",description:get("description"),target:Object.assign({},existing&&existing.target||{},{type:get("targetType"),value:get("targetValue")===""?null:Number(get("targetValue")),unit:get("targetUnit"),display:get("targetDisplay")}),schedule:get("scheduleType")==="weekdays"?{type:"weekdays",weekdays:weekdays}:get("scheduleType")==="weekly_count"?{type:"weekly_count",targetCount:Number(get("weeklyCount")),weekStartsOn:0}:{type:"daily"},instructions:get("instructions").split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean),emphasis:get("emphasis"),active:existing?existing.active:true,source:existing?existing.source:"user",createdAt:existing&&existing.createdAt||now,updatedAt:now}),id);const validation=p960ValidateHabit(next);if(!validation.valid){document.getElementById("p960ManagerMsg").textContent=validation.errors.join("\n");return;}p960HabitManagerDraft.habits[id]=next;if(!p960HabitManagerDraft.order.includes(id))p960HabitManagerDraft.order.push(id);form.classList.remove("open");p960RenderHabitManager();document.getElementById("p960ManagerMsg").textContent="Draft updated. Choose Save Changes to persist.";
}
function p960SaveHabitManager(){const errors=[];Object.values(p960HabitManagerDraft.habits).forEach(function(h){errors.push.apply(errors,p960ValidateHabit(h).errors.map(function(e){return h.name+": "+e;}));});if(errors.length){document.getElementById("p960ManagerMsg").textContent=errors.join("\n");return false;}p960SaveHabitStore(p960HabitManagerDraft);p960HabitManagerDraft=null;document.getElementById("p960HabitManager").classList.remove("open");renderHabits();return true;}

function p960EarliestHistoricalDate(id){let earliest=null;Object.keys(localStorage).filter(function(k){return /^day-\d{4}-\d{2}-\d{2}$/.test(k);}).forEach(function(k){const d=p960ReadDay(k.slice(4));if(d.habits&&d.habits[id]&&(!earliest||k.slice(4)<earliest))earliest=k.slice(4);});return earliest;}
function p960HabitEligibilityStart(h){return h.legacyEligibilityInferred?p960EarliestHistoricalDate(h.id):(h.createdAt?p960DateKey(h.createdAt):null);}
function p960AnalyzeHabit(h,start,end){
  const today=p960DateKey(new Date()),to=end&&end<today?end:today,from=start||p960AddDays(to,-29),out={id:h.id,name:h.name,icon:h.icon,active:h.active,schedule:p960Clone(h.schedule),eligible:0,completed:0,percentage:null,recentTrend:"insufficient data",weeklyCurrent:null,historySourceQuality:h.legacyEligibilityInferred?"legacy eligibility inferred":"definition timestamps",warnings:[]},effective=p960HabitEligibilityStart(h);if(h.legacyEligibilityInferred)out.warnings.push("Eligibility before the definition store is conservatively inferred from the first recorded habit entry.");
  if(h.schedule.type==="weekly_count"){let cursor=p960GetHabitWeekRange(h,from).start;while(p960AddDays(cursor,6)<to){const weekEnd=p960AddDays(cursor,6);if((!effective||weekEnd>=effective)&&(!h.archivedAt||cursor<=p960DateKey(h.archivedAt))){const w=p960GetWeeklyHabitProgress(h,cursor);out.eligible++;if(w.met)out.completed++;}cursor=p960AddDays(cursor,7);}out.weeklyCurrent=p960GetWeeklyHabitProgress(h,to);}
  else for(let date=from;date<=to;date=p960AddDays(date,1)){if(effective&&date<effective)continue;if(h.archivedAt&&date>p960DateKey(h.archivedAt))continue;if(!p960IsHabitDueOnDate(h,date))continue;out.eligible++;const s=(p960ReadDay(date).habits||{})[h.id];if(s&&s.completed)out.completed++;}
  out.percentage=out.eligible?Math.round(100*out.completed/out.eligible):null;return out;
}
function p960GetHabitAnalytics(start,end){const rows=Object.values(p960GetHabitDefinitions()).map(function(h){return p960AnalyzeHabit(h,start,end);}),active=rows.filter(function(r){return r.active;}),eligible=active.reduce(function(n,r){return n+r.eligible;},0),completed=active.reduce(function(n,r){return n+r.completed;},0),ranked=active.filter(function(r){return r.percentage!==null;}).sort(function(a,b){return b.percentage-a.percentage;});return {overallPercentage:eligible?Math.round(100*completed/eligible):null,eligibleOpportunities:eligible,completedOpportunities:completed,activeHabitCount:active.length,archivedHabitCount:rows.length-active.length,bestPerforming:ranked[0]||null,needsAttention:ranked[ranked.length-1]||null,habits:rows,sourceQualityWarnings:rows.flatMap(function(r){return r.warnings;})};}
const p960LegacyCalcAnalytics=p7CalcAnalytics;
p7CalcAnalytics=function(){const base=p960LegacyCalcAnalytics();if(!base)return base;const a=p960GetHabitAnalytics(),active=a.habits.filter(function(h){return h.active;}).map(function(h){return {id:h.id,name:h.name,icon:h.icon,done:h.completed,total:h.eligible,schedule:h.schedule};});base.habits={overall:a.overallPercentage||0,breakdown:active,best:active.slice().sort(function(x,y){return (y.total?y.done/y.total:0)-(x.total?x.done/x.total:0);})[0]||null,worst:active.slice().sort(function(x,y){return (x.total?x.done/x.total:0)-(y.total?y.done/y.total:0);})[0]||null,eligible:a.eligibleOpportunities,activeCount:a.activeHabitCount};return base;};

const p960LegacyHistoryRenderer=renderHistoryFromEntries;
renderHistoryFromEntries=function(entries){p960LegacyHistoryRenderer(entries);const cards=document.querySelectorAll("#histList .hist-entry");entries.slice(0,60).forEach(function(entry,i){const states=(entry.data||{}).habits||{},ids=Object.keys(states);if(!ids.length||!cards[i])return;const wrap=document.createElement("div");wrap.className="p960-history";ids.forEach(function(id){const state=states[id];if(!state||(!state.completed&&state.value==null&&!state.notes))return;const def=p960GetHabitById(id),line=document.createElement("div");line.className="hist-notes";const parts=[def?def.icon+" "+def.name:"Habit ("+id+")",state.completed?"Completed":"Recorded"];if(state.value!=null&&state.value!=="")parts.push(String(state.value)+(def&&def.target.unit?" "+def.target.unit:""));if(state.notes)parts.push(state.notes);line.textContent=parts.join(" · ");wrap.appendChild(line);});cards[i].appendChild(wrap);});};

const p960LegacyExecuteSave=p85ExecuteSave;
p85ExecuteSave=function(){const key=dKey(tDate),raw=localStorage.getItem(key);let before={};try{before=raw?JSON.parse(raw):{};}catch(e){}const priorHabits=before.habits&&typeof before.habits==="object"?before.habits:{};Object.keys(priorHabits).forEach(function(id){habitState[id]=Object.assign({},priorHabits[id],habitState[id]||{});});const result=p960LegacyExecuteSave(),saved=JSON.parse(localStorage.getItem(key)||"{}");Object.keys(before).forEach(function(k){if(!Object.prototype.hasOwnProperty.call(saved,k))saved[k]=before[k];});saved.habits=Object.assign({},priorHabits,saved.habits||{});localStorage.setItem(key,JSON.stringify(saved));return result;};

function p960BuildHabitExport(){const analytics=p960GetHabitAnalytics(),active=p960GetActiveHabits(),proposal=p960GetHabitProposal();let out="--- HABITS ---\n";if(!active.length)out+="Active habits: none configured.\n";active.forEach(function(h){const a=analytics.habits.find(function(x){return x.id===h.id;}),weekly=h.schedule.type==="weekly_count"?"; "+p960GetWeeklyHabitProgress(h,p960DateKey(new Date())).label:"";out+="- "+h.name+" ["+h.source+"]: target "+p960HabitTargetText(h)+"; schedule "+p960HabitScheduleText(h)+"; emphasis "+h.emphasis+"; recent eligible completion "+(a&&a.percentage!=null?a.percentage+"%":"n/a")+weekly+".\n";});out+="Archived habits: "+analytics.archivedHabitCount+".\n";if(analytics.sourceQualityWarnings.length)out+="Data quality: Legacy opportunity dates are conservatively inferred from first recorded evidence.\n";if(proposal&&proposal.status==="pending")out+="Pending habit proposal: "+proposal.summary+" ("+proposal.changes.length+" actions; requires review).\n";out+="Guidance: Only eligible scheduled opportunities count; non-due blanks are neutral; weekly-count habits are judged by weekly totals. AI may propose small sustainable changes but must never silently apply them. Medication schedules, including Zepbound, remain in the separate recurring-adherence system and must not be converted to habits.\n\n";return out;}
const p960LegacyGenExport=genExport;
genExport=function(){const out=p960LegacyGenExport(),section=p960BuildHabitExport(),updated=String(out||window._exp||"").replace(/(=== MARCUSFIT EXPORT ===\n)/,"$1"+section);window._exp=updated;const el=document.getElementById("exportOut");if(el)el.textContent=updated;return updated;};

function p960NormalizeProposal(raw){const source=raw&&typeof raw==="object"?p960Clone(raw):{},out=Object.assign({},source);out.schemaVersion=1;out.proposalVersion=String(source.proposalVersion||APP_VERSION);out.proposalId=String(source.proposalId||("habit-proposal-"+Date.now()));out.status=String(source.status||"pending");out.source=String(source.source||"ai_sync");out.createdAt=source.createdAt||p960Now();out.updatedAt=source.updatedAt||out.createdAt;out.summary=String(source.summary||"Habit proposal");out.rationale=String(source.rationale||"");out.changes=Array.isArray(source.changes)?source.changes.map(p960Clone):[];out.validation=source.validation&&typeof source.validation==="object"?p960Clone(source.validation):{valid:false,warnings:[],errors:[]};out.applyState=source.applyState||null;out.undoSnapshot=source.undoSnapshot||null;return out;}
function p960ValidateHabitProposal(raw,store){
  const proposal=p960NormalizeProposal(raw),current=store||p960GetHabitStore(),errors=[],warnings=[],supported=[],deferred=[],prohibited=/\b(stableId|history|habits|completion|program|workout|zepbound|medication|recurring|profile|baseP)\b/i;
  proposal.changes.forEach(function(change,index){const c=change&&typeof change==="object"?p960Clone(change):{},action=String(c.action||"").toLowerCase(),id=String(c.habitId||c.id||"");if(!["keep","add","modify","archive","reactivate","reorder"].includes(action)){errors.push("Action "+(index+1)+" is unsupported.");return;}
    if(action==="reorder"){const order=Array.isArray(c.order)?c.order:Array.isArray(c.habitOrder)?c.habitOrder:null;if(!order||new Set(order).size!==order.length||order.some(function(x){return !current.habits[x];})){errors.push("Reorder action is invalid.");return;}c.order=order.slice();supported.push(c);return;}
    if(action==="add"){const definition=c.definition||c.fields||{},newId=String(c.habitId||definition.id||"");if(!/^habit-[a-z0-9][a-z0-9-]*$/i.test(newId)){errors.push("Add action "+(index+1)+" needs a valid stable habit ID.");return;}if(current.habits[newId]){if(proposal.status==="applied"){c.habitId=newId;supported.push(c);return;}errors.push("Add action "+(index+1)+" needs a unique stable habit ID.");return;}if(prohibited.test(Object.keys(definition).filter(function(k){return k!=="id";}).join(" "))){errors.push("Add action contains a prohibited domain field.");return;}const h=p960NormalizeHabit(Object.assign({},definition,{id:newId,source:"ai"}),newId),v=p960ValidateHabit(h);if(!v.valid){errors.push.apply(errors,v.errors);return;}c.habitId=newId;c.definition=h;supported.push(c);return;}
    if(!current.habits[id]){errors.push(action+" references unknown habit "+id+".");return;}c.habitId=id;c.expectedFingerprint=c.expectedFingerprint||p960Fingerprint(current.habits[id]);
    if(action==="modify"){const fields=c.fields&&typeof c.fields==="object"?c.fields:{};if(Object.keys(fields).some(function(k){return prohibited.test(k);})){errors.push("Modify action for "+id+" contains a prohibited field.");return;}const safe={};Object.keys(fields).forEach(function(k){if(P960_MODIFY_FIELDS.includes(k))safe[k]=p960Clone(fields[k]);else deferred.push({habitId:id,field:k,reason:"Unsupported modify field"});});if(!Object.keys(safe).length){errors.push("Modify action for "+id+" has no supported fields.");return;}c.fields=safe;}supported.push(c);
  });proposal.changes=supported;proposal.validation={valid:errors.length===0,warnings:warnings,errors:errors,deferred:deferred};return {valid:errors.length===0,proposal:proposal,errors:errors,warnings:warnings,deferred:deferred,supported:supported};
}
function p960GetHabitProposal(){const raw=localStorage.getItem(P960_HABIT_PROPOSAL_KEY);if(!raw)return null;try{return p960NormalizeProposal(JSON.parse(raw));}catch(e){return null;}}
function p960ImportHabitProposal(raw){const validation=p960ValidateHabitProposal(raw);if(!validation.valid)return validation;validation.proposal.status="pending";validation.proposal.updatedAt=p960Now();localStorage.setItem(P960_HABIT_PROPOSAL_KEY,JSON.stringify(validation.proposal));return validation;}
function p960ApplyHabitProposal(confirmApply){
  const proposal=p960GetHabitProposal();if(!proposal)return {applied:false,errors:["No proposal exists."]};if(proposal.status!=="pending")return {applied:false,errors:["Only a pending habit proposal can be applied."],conflicts:[]};const store=p960GetHabitStore(),validation=p960ValidateHabitProposal(proposal,store);if(!validation.valid)return {applied:false,errors:validation.errors,conflicts:[]};const conflicts=[];validation.supported.forEach(function(c){if(c.habitId&&c.action!=="add"&&c.action!=="reorder"&&c.expectedFingerprint!==p960Fingerprint(store.habits[c.habitId]))conflicts.push(c.habitId);});if(conflicts.length)return {applied:false,errors:["User edits conflict with this proposal."],conflicts:[...new Set(conflicts)]};if(confirmApply!==true)return {applied:false,requiresConfirmation:true,expectedWrites:[P960_HABIT_DEFINITIONS_KEY,P960_HABIT_PROPOSAL_KEY],actions:validation.supported,deferred:validation.deferred};
  const beforeRaw=localStorage.getItem(P960_HABIT_DEFINITIONS_KEY),next=p960Clone(store),now=p960Now(),applied=[];validation.supported.forEach(function(c){if(c.action==="keep"){applied.push({action:"keep",habitId:c.habitId});return;}if(c.action==="add"){const h=p960NormalizeHabit(c.definition,c.habitId);h.source="ai";h.createdAt=h.createdAt||now;h.updatedAt=now;h.aiMeta=Object.assign({},h.aiMeta,{lastProposalId:proposal.proposalId,lastChangedBy:"ai_proposal"});next.habits[h.id]=h;if(!next.order.includes(h.id))next.order.push(h.id);}if(c.action==="modify"){const h=next.habits[c.habitId];Object.keys(c.fields).forEach(function(k){h[k]=p960Clone(c.fields[k]);});next.habits[c.habitId]=p960NormalizeHabit(h,c.habitId);next.habits[c.habitId].updatedAt=now;next.habits[c.habitId].aiMeta=Object.assign({},next.habits[c.habitId].aiMeta,{lastProposalId:proposal.proposalId,lastChangedBy:"ai_proposal"});}if(c.action==="archive"){next.habits[c.habitId].active=false;next.habits[c.habitId].archivedAt=now;next.habits[c.habitId].updatedAt=now;}if(c.action==="reactivate"){next.habits[c.habitId].active=true;next.habits[c.habitId].archivedAt=null;next.habits[c.habitId].updatedAt=now;if(!next.order.includes(c.habitId))next.order.push(c.habitId);}if(c.action==="reorder")next.order=c.order.concat(next.order.filter(function(id){return !c.order.includes(id);}));applied.push({action:c.action,habitId:c.habitId||null});});
  const saved=p960SaveHabitStore(next),savedRaw=localStorage.getItem(P960_HABIT_DEFINITIONS_KEY);proposal.status="applied";proposal.updatedAt=now;proposal.applyState={appliedAt:now,applied:applied,deferred:validation.deferred,definitionFingerprint:p960Fingerprint(saved)};proposal.undoSnapshot={definitionRaw:beforeRaw,appliedRaw:savedRaw,appliedFingerprint:p960Fingerprint(saved),createdAt:now};localStorage.setItem(P960_HABIT_PROPOSAL_KEY,JSON.stringify(proposal));renderHabits();return {applied:true,appliedChanges:applied,deferred:validation.deferred};
}
function p960UndoHabitProposal(confirmUndo){const proposal=p960GetHabitProposal(),snapshot=proposal&&proposal.undoSnapshot;if(!snapshot)return {undone:false,errors:["No valid undo snapshot exists."]};const currentRaw=localStorage.getItem(P960_HABIT_DEFINITIONS_KEY),current=p960GetHabitStore();if(currentRaw!==snapshot.appliedRaw||p960Fingerprint(current)!==snapshot.appliedFingerprint)return {undone:false,conflict:true,errors:["Habit definitions changed after apply; unsafe undo refused."]};if(confirmUndo!==true)return {undone:false,requiresConfirmation:true,expectedWrites:[P960_HABIT_DEFINITIONS_KEY,P960_HABIT_PROPOSAL_KEY]};snapshot.definitionRaw===null?localStorage.removeItem(P960_HABIT_DEFINITIONS_KEY):localStorage.setItem(P960_HABIT_DEFINITIONS_KEY,snapshot.definitionRaw);proposal.status="undone";proposal.updatedAt=p960Now();proposal.undoSnapshot=null;localStorage.setItem(P960_HABIT_PROPOSAL_KEY,JSON.stringify(proposal));renderHabits();return {undone:true};}
function p960DismissHabitProposal(){const p=p960GetHabitProposal();if(!p)return false;p.status="rejected";p.updatedAt=p960Now();localStorage.setItem(P960_HABIT_PROPOSAL_KEY,JSON.stringify(p));return true;}
function p960OpenHabitProposalReview(){
  const p=p960GetHabitProposal();if(!p)return false;let overlay=document.getElementById("p960ProposalReview");if(!overlay){overlay=document.createElement("div");overlay.id="p960ProposalReview";overlay.className="p960-overlay";document.body.appendChild(overlay);}overlay.innerHTML="";const panel=document.createElement("div");panel.className="p960-panel",head=document.createElement("div");head.className="p960-head";const title=document.createElement("h2");title.textContent="Habit Proposal Review";const close=document.createElement("button");close.textContent="Close / Review Later";close.onclick=function(){overlay.classList.remove("open");};head.append(title,close);panel.appendChild(head);const summary=document.createElement("p");summary.textContent=p.summary;const rationale=document.createElement("p");rationale.textContent=p.rationale;panel.append(summary,rationale);const validation=p960ValidateHabitProposal(p);validation.supported.forEach(function(c){const row=document.createElement("div");row.className="p960-proposal-action";const badge=document.createElement("span");badge.className="p960-badge";badge.textContent=String(c.action).toUpperCase();row.append(badge,document.createTextNode((c.habitId?" "+c.habitId:"")+(c.rationale?" — "+c.rationale:"")));panel.appendChild(row);});const expected=document.createElement("p");expected.textContent="Expected writes: mf-habit-definitions and mf-habit-proposal only. Explicit confirmation is required.";panel.appendChild(expected);const confirmPanel=document.createElement("div");confirmPanel.id="p960ProposalConfirm";confirmPanel.style.display="none";confirmPanel.className="p960-msg";confirmPanel.textContent="Apply these supported definition changes? Daily history, programs, and medication stores will not be touched.";const actions=document.createElement("div");actions.className="p960-footer";const keep=document.createElement("button");keep.textContent="Keep Current Habits";keep.onclick=function(){p960DismissHabitProposal();overlay.classList.remove("open");};const apply=document.createElement("button");apply.className="p960-primary";apply.textContent="Apply Supported Changes";apply.onclick=function(){if(confirmPanel.style.display==="none"){confirmPanel.style.display="block";apply.textContent="Confirm Apply";return;}p960ApplyHabitProposal(true);overlay.classList.remove("open");};actions.append(keep,apply);panel.append(confirmPanel,actions);overlay.appendChild(panel);overlay.classList.add("open");return true;
}
const p960LegacyApplySync=applySync;
applySync=function(){const input=document.getElementById("syncInput"),raw=input&&input.value||"",match=raw.match(/MARCUSFIT_UPDATE_START([\s\S]*?)MARCUSFIT_UPDATE_END/);if(match){const inner=match[1].trim().replace(/^```[a-zA-Z]*\n?/,"").replace(/\n?```$/,"").trim();try{const payload=JSON.parse(inner);if(payload&&!Array.isArray(payload)&&payload.habitProposal){const imported=p960ImportHabitProposal(payload.habitProposal),res=document.getElementById("syncResult");if(!imported.valid){if(res){res.style.display="block";res.style.color="var(--red)";res.textContent="Habit proposal rejected:\n"+imported.errors.join("\n");}return;}const updates=Array.isArray(payload.updates)?payload.updates:[];if(updates.length){input.value="MARCUSFIT_UPDATE_START\n"+JSON.stringify(updates,null,2)+"\nMARCUSFIT_UPDATE_END";p960LegacyApplySync();input.value=raw;}if(res){res.style.display="block";res.style.color="var(--accent)";res.textContent=(updates.length?"Program sync processed. ":"")+"Habit changes are pending explicit review.";}p960OpenHabitProposalReview();return;}}catch(e){}}return p960LegacyApplySync();};

function p960ValidateStoredHabitData(){
  const issues=[],definitionRaw=localStorage.getItem(P960_HABIT_DEFINITIONS_KEY),proposalRaw=localStorage.getItem(P960_HABIT_PROPOSAL_KEY);let store=null;
  if(definitionRaw!==null){try{const parsed=JSON.parse(definitionRaw);if(!parsed||typeof parsed!=="object")throw new Error("not an object");if(parsed.schemaVersion==null)issues.push({level:"warn",message:"Habit definition schemaVersion is missing."});const input=parsed.habits&&typeof parsed.habits==="object"?parsed.habits:{};Object.keys(input).forEach(function(id){if(!input[id]||input[id].id!==id)issues.push({level:"error",message:"Habit definition ID does not match object key: "+id});});const order=Array.isArray(parsed.order)?parsed.order:[];if(new Set(order).size!==order.length)issues.push({level:"warn",message:"Habit order contains duplicate IDs."});store=p960NormalizeHabitStore(parsed);}catch(e){issues.push({level:"error",message:"Habit definition store does not parse: "+e.message});}}
  if(proposalRaw!==null){try{const parsed=JSON.parse(proposalRaw);if(!parsed||typeof parsed!=="object")throw new Error("not an object");const validation=p960ValidateHabitProposal(parsed,store||p960GetHabitStore());if(!validation.valid)issues.push({level:"warn",message:"Habit proposal validation failed: "+validation.errors.join("; ")});if(parsed.undoSnapshot&&typeof parsed.undoSnapshot!=="object")issues.push({level:"warn",message:"Habit proposal undo snapshot is malformed."});}catch(e){issues.push({level:"error",message:"Habit proposal store does not parse: "+e.message});}}
  return issues;
}
function mfHabitDefinitionsDebug(){const raw=localStorage.getItem(P960_HABIT_DEFINITIONS_KEY),warnings=[],store=p960GetHabitStore(),ids=Object.keys(store.habits),duplicates=store.order.filter(function(id,i,a){return a.indexOf(id)!==i;}),missing=store.order.filter(function(id){return !store.habits[id];}),invalidSchedules=[];ids.forEach(function(id){const v=p960ValidateHabit(store.habits[id]);if(v.errors.some(function(x){return /weekday|Weekly|schedule/i.test(x);}))invalidSchedules.push(id);});const historical=new Set();Object.keys(localStorage).filter(function(k){return /^day-\d{4}-\d{2}-\d{2}$/.test(k);}).forEach(function(k){const d=p960ReadDay(k.slice(4));Object.keys(d.habits||{}).forEach(function(id){if(!store.habits[id]&&!p960BuildDefaultDefinitions("legacy").habits[id])historical.add(id);});});if(raw){try{JSON.parse(raw);}catch(e){warnings.push("Definition store does not parse.");}}p960ValidateStoredHabitData().forEach(function(i){warnings.push(i.message);});return {appVersion:APP_VERSION,keyExists:raw!==null,parseStatus:raw===null?"missing":warnings.length?"warning":"valid",schemaVersion:store.schemaVersion,totalDefinitions:ids.length,activeCount:ids.filter(function(id){return store.habits[id].active;}).length,archivedCount:ids.filter(function(id){return !store.habits[id].active;}).length,sourceCounts:ids.reduce(function(a,id){const s=store.habits[id].source;a[s]=(a[s]||0)+1;return a;},{}),order:store.order.slice(),duplicateIds:duplicates,missingOrderedIds:missing,invalidSchedules:invalidSchedules,unknownHistoricalIds:[...historical],backupCoverage:p8IsMarcusFitKey(P960_HABIT_DEFINITIONS_KEY),warnings:warnings,readOnly:true};}
function mfHabitDebug(habitId,date){const h=p960GetHabitById(habitId),when=p960DateKey(date||new Date()),warnings=[];if(!h)warnings.push("Habit definition is unknown.");const p=p960GetHabitProposal();return {appVersion:APP_VERSION,definition:h,active:!!(h&&h.active),archived:!!(h&&!h.active),source:h&&h.source,target:h&&h.target,schedule:h&&h.schedule,dueState:h?p960GetHabitDisplayState(h,when):null,completionState:((p960ReadDay(when).habits||{})[habitId]||null),weeklyProgress:h&&h.schedule.type==="weekly_count"?p960GetWeeklyHabitProgress(h,when):null,analytics:h?p960AnalyzeHabit(h,p960AddDays(when,-29),when):null,historySourceQuality:h&&h.legacyEligibilityInferred?"legacy inferred":"definition timestamps",proposalInvolvement:!!(p&&p.changes.some(function(c){return c.habitId===habitId;})),warnings:warnings,readOnly:true};}
function mfHabitProposalDebug(){const raw=localStorage.getItem(P960_HABIT_PROPOSAL_KEY),warnings=[];let proposal=null;if(raw){try{proposal=p960NormalizeProposal(JSON.parse(raw));}catch(e){warnings.push("Proposal store does not parse.");}}const validation=proposal?p960ValidateHabitProposal(proposal):null,preview=proposal?p960ApplyHabitProposal(false):null;return {proposalExists:!!proposal,parseStatus:raw===null?"missing":proposal?"valid":"invalid",proposalId:proposal&&proposal.proposalId,status:proposal&&proposal.status,actionCounts:proposal?proposal.changes.reduce(function(a,c){a[c.action]=(a[c.action]||0)+1;return a;},{}):{},validation:validation&&validation.proposal.validation,conflicts:preview&&preview.conflicts||[],supportedWrites:[P960_HABIT_DEFINITIONS_KEY,P960_HABIT_PROPOSAL_KEY],deferredActions:validation&&validation.deferred||[],undoAvailability:!!(proposal&&proposal.undoSnapshot),backupCoverage:p8IsMarcusFitKey(P960_HABIT_PROPOSAL_KEY),warnings:warnings,readOnly:true};}
window.mfHabitDefinitionsDebug=mfHabitDefinitionsDebug;window.mfHabitDebug=mfHabitDebug;window.mfHabitProposalDebug=mfHabitProposalDebug;

function mf960RunHabitSelfTest(){
  const keys=[P960_HABIT_DEFINITIONS_KEY,P960_HABIT_PROPOSAL_KEY,"day-2026-07-06","day-2026-07-08","day-2026-07-12"],before={};keys.forEach(function(k){before[k]=localStorage.getItem(k);});const assertions=[],failures=[];function check(name,pass,actual){assertions.push({name:name,pass:!!pass,actual:actual});if(!pass)failures.push(name);}
  try{const fixture=p960EmptyHabitStore("2026-07-01T12:00:00.000Z");fixture.habits["habit-daily"]=p960NormalizeHabit({id:"habit-daily",name:"Daily",target:{type:"checkbox"},schedule:{type:"daily"},active:true,source:"user",createdAt:"2026-07-01T12:00:00.000Z"},"habit-daily");fixture.habits["habit-weekday"]=p960NormalizeHabit({id:"habit-weekday",name:"Weekday",target:{type:"count",value:1},schedule:{type:"weekdays",weekdays:[1,3,5]},active:true,source:"user",createdAt:"2026-07-01T12:00:00.000Z",customField:"kept"},"habit-weekday");fixture.habits["habit-weekly"]=p960NormalizeHabit({id:"habit-weekly",name:"Weekly",target:{type:"checkbox"},schedule:{type:"weekly_count",targetCount:2,weekStartsOn:0},active:true,source:"user",createdAt:"2026-07-01T12:00:00.000Z"},"habit-weekly");fixture.order=["habit-daily","habit-weekday","habit-weekly"];p960SaveHabitStore(fixture);
    check("default template preserves seven IDs",Object.keys(p960BuildDefaultDefinitions().habits).length===7);check("weekday Monday due",p960IsHabitDueOnDate(fixture.habits["habit-weekday"],"2026-07-06"));check("weekday Tuesday neutral",!p960IsHabitDueOnDate(fixture.habits["habit-weekday"],"2026-07-07"));check("daily due",p960IsHabitDueOnDate(fixture.habits["habit-daily"],"2026-07-07"));localStorage.setItem("day-2026-07-06",JSON.stringify({habits:{"habit-weekly":{completed:true,notes:"keep",unknown:"yes"}},other:"same"}));localStorage.setItem("day-2026-07-08",JSON.stringify({habits:{"habit-weekly":{completed:true}}}));check("weekly progress",p960GetWeeklyHabitProgress(fixture.habits["habit-weekly"],"2026-07-08").met);check("weekday denominator",p960AnalyzeHabit(fixture.habits["habit-weekday"],"2026-07-05","2026-07-11").eligible===3);
    const edited=p960GetHabitStore();edited.habits["habit-weekday"].name="Edited";edited.habits["habit-weekday"].updatedAt=p960Now();p960SaveHabitStore(edited);check("unknown fields survive edit",p960GetHabitById("habit-weekday").customField==="kept");const archived=p960GetHabitStore();archived.habits["habit-weekday"].active=false;archived.habits["habit-weekday"].archivedAt="2026-07-10T12:00:00.000Z";p960SaveHabitStore(archived);check("archive preserves history",JSON.parse(localStorage.getItem("day-2026-07-06")).habits["habit-weekly"].unknown==="yes");archived.habits["habit-weekday"].active=true;archived.habits["habit-weekday"].archivedAt=null;archived.order=["habit-weekly","habit-daily","habit-weekday"];p960SaveHabitStore(archived);check("reactivate and reorder",p960GetActiveHabits()[0].id==="habit-weekly");
    const proposal={proposalId:"self-test",summary:"Test",changes:[{action:"modify",habitId:"habit-daily",fields:{name:"Daily Updated"}},{action:"add",habitId:"habit-added",definition:{id:"habit-added",name:"Added",target:{type:"checkbox"},schedule:{type:"daily"},instructions:[]}}]},imported=p960ImportHabitProposal(proposal);check("proposal validates",imported.valid);const dayBefore=localStorage.getItem("day-2026-07-06"),preview=p960ApplyHabitProposal(false);check("proposal preview writes no definitions",preview.requiresConfirmation);const applied=p960ApplyHabitProposal(true);check("proposal applies",applied.applied&&p960GetHabitById("habit-daily").name==="Daily Updated");check("daily history byte identical",localStorage.getItem("day-2026-07-06")===dayBefore);check("undo exact snapshot",p960UndoHabitProposal(true).undone&&p960GetHabitById("habit-daily").name==="Daily");p960ImportHabitProposal(proposal);p960ApplyHabitProposal(true);const conflict=p960GetHabitStore();conflict.habits["habit-daily"].name="User Later Edit";p960SaveHabitStore(conflict);check("unsafe undo refused",p960UndoHabitProposal(true).conflict===true);check("backup coverage",p8IsMarcusFitKey(P960_HABIT_DEFINITIONS_KEY)&&p8IsMarcusFitKey(P960_HABIT_PROPOSAL_KEY));
  }catch(e){failures.push("Unexpected error: "+(e&&e.message));}finally{keys.forEach(function(k){before[k]===null?localStorage.removeItem(k):localStorage.setItem(k,before[k]);});}
  const restored=keys.every(function(k){return localStorage.getItem(k)===before[k];});return {pass:failures.length===0&&restored,assertions:assertions,failures:failures,storageExactlyRestored:restored};
}
window.mf960RunHabitSelfTest=mf960RunHabitSelfTest;
p960InitHabitStore();
renderHabits();
// -- END PHASE 9.6.0 --------------------------------------------------------

function showScreen(n){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
  document.getElementById("screen-"+n).classList.add("active");document.getElementById("tab-"+n).classList.add("active");
  document.getElementById("gymRow").classList.toggle("visible",n==="program");
  if(n==="program"){renderProgram();}
  if(n==="history"){p7ApplyFilters();}
  if(n==="analytics"){p7RenderAnalytics();}
  if(n==="export"){updateExportMeta();mfRenderLifecycleHealth();p9RenderCoachPrefs();p950RenderUserProfile();p954RenderProgramPersonalization();const ds=document.getElementById("p945DiagSection");if(ds&&ds.classList.contains("open"))p945RenderDiag();}
}
// 9.4.8.8: populate the coaching preferences textarea at load in case the
// export screen becomes active without a showScreen() transition.
p9RenderCoachPrefs();
// 9.5.0: initialize/migrate the user profile early in the load sequence, then
// populate the Sync-tab profile card in case the export screen becomes
// active without a showScreen() transition.
p950InitUserProfile();
p950RenderUserProfile();
// 9.5.1: initialize/migrate onboarding state early in the load sequence.
// Storage-only — never opens any UI, never touches mf-user-profile.
p951InitOnboardingState();
// 9.5.2: after existing app render/init above has run, show the onboarding
// overlay only if the persisted state (source of truth) is "not_started" or
// "in_progress". Existing installs ("completed"/"skipped") never see it, and
// the overlay stays hidden by default (CSS) until this check runs, so there
// is no flash.
p952InitAutoShow();
// 9.5.4: populate the Sync-tab Program Personalization card in case the
// export screen becomes active without a showScreen() transition. Read-only
// render — never generates or clears a proposal on its own.
p954RenderProgramPersonalization();
// 9.5.8.4: This is the existing synchronous initialization completion point.
// Release the transient Program guard only after all starter inputs are ready,
// then render once through the same guarded path used by gym switching.
starterProgramStateReady=true;
renderProgram();
p9510RenderZepbound();
