const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const source = fs.readFileSync(path.join(root, "assets/js/features/13-shared-ui.js"), "utf8");
const boot = fs.readFileSync(path.join(root, "assets/js/boot/21-app-boot.js"), "utf8");
const ids = ["exportRangeSelect","exportMeta","exportOut","syncInput","syncResult","p950DisplayName","coachPrefsTa","p954Container","p960SettingsStatus","p8BackupTa","lcSummaryGrid","p945DiagSection"];

ids.forEach(id => assert.strictEqual((html.match(new RegExp(`id="${id}"`, "g"))||[]).length,1,`duplicated/missing ${id}`));
assert.strictEqual((html.match(/class="mf-sync-nav-btn/g)||[]).length,4);
["ai","personalize","profile","data"].forEach(page => assert(html.includes(`data-mf-sync-page="${page}"`)));
assert(html.includes('data-mf-swipe-exempt') && html.includes('role="tablist" aria-label="Sync and settings"'));
assert(source.includes('coaching:"personalize",program:"personalize",habits:"personalize",profile:"profile",backup:"data",diagnostics:"data"'));
assert(source.includes('mfSyncVisibleCriticalPanel') && source.includes('page!==mfActiveSyncPage'));
assert(source.includes('program&&program.status==="draft"') && source.includes('habit&&habit.status==="pending"') && source.includes('basketball&&basketball.status==="pending"'));
assert(boot.includes('mfOnPrimarySyncOpen()'));
assert(!/localStorage\./.test(source.slice(source.indexOf("const MF_SYNC_PAGES"),source.indexOf("function mfUpdateProgramSettingsStatus"))),"Sync page navigation writes storage");

const pageNodes = Object.fromEntries(["ai","personalize","profile","data"].map(page => [page,{dataset:{mfSyncPage:page},hidden:false,classList:{toggle(name,on){this.active=name==="active"&&on;}}}]));
Object.values(pageNodes).forEach(node=>{node.criticalPanels=[];node.querySelectorAll=()=>node.criticalPanels;});
const tabNodes = Object.fromEntries(["Ai","Personalize","Profile","Data"].map(name => [`mfSyncTab${name}`,{id:`mfSyncTab${name}`,classList:{toggle(key,on){this[key]=on;}},setAttribute(key,value){this[key]=value;},tabIndex:-1}]));
const badge={hidden:true},opened=[];
const document = {
  querySelector(selector){return selector===".mf-sync-page.active"?Object.values(pageNodes).find(node=>node.classList.active)||null:null;},
  querySelectorAll(selector){return selector==="[data-mf-sync-page]"?Object.values(pageNodes):Object.values(tabNodes);},
  getElementById(id){return id==="mfSyncPersonalizePending"?badge:tabNodes[id]||null;}
};
const context={document,localStorage:{setItem(){throw new Error("Sync navigation wrote storage");},removeItem(){throw new Error("Sync navigation wrote storage");}},mfSetSettingsSectionOpen(key,open){opened.push([key,open]);return true;},p954GetProposal(){return {status:"draft"};},p960GetHabitProposal(){return null;},mfBasketballGetProposal(){return null;}};context.window=context;vm.createContext(context);
const start=source.indexOf("const MF_SYNC_PAGES"),end=source.indexOf("function mfUpdateProgramSettingsStatus",start);vm.runInContext(source.slice(start,end),context);
assert.strictEqual(context.mfSelectSyncPage("profile"),true);assert.strictEqual(pageNodes.profile.hidden,false);assert.strictEqual(pageNodes.ai.hidden,true);assert.strictEqual(tabNodes.mfSyncTabProfile["aria-selected"],"true");
const critical={style:{display:"block"},focused:false,scrolled:false,focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;}};pageNodes.profile.criticalPanels.push(critical);
assert.strictEqual(context.mfSelectSyncPage("data"),false);assert.strictEqual(tabNodes.mfSyncTabProfile["aria-selected"],"true");assert(critical.focused&&critical.scrolled,"critical confirmation did not retain page/focus");
critical.style.display="none";assert.strictEqual(context.mfOpenSettingsSection("backup"),true);assert.strictEqual(tabNodes.mfSyncTabData["aria-selected"],"true");assert.deepStrictEqual(opened,[['backup',true]]);
assert.strictEqual(context.mfUpdateSyncPendingStatus(),true);assert.strictEqual(badge.hidden,false);assert.strictEqual(tabNodes.mfSyncTabPersonalize.classList['has-pending'],true);
["genExport()","doCopy()","applySync()","p950SaveUserProfileFromUI()","p8CreateBackup()","p8RestoreBackup()"].forEach(handler=>assert(html.includes(`onclick="${handler}"`),`handler changed: ${handler}`));

console.log("MarcusFit 10.7.0 Sync information architecture: PASS");
