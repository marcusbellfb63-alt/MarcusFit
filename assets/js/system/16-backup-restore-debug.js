
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
