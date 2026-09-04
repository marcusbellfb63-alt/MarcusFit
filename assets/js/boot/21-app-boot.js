
// Lifecycle initialization and the 10.1.3 parent-day repair must precede all
// Program, History, export, Sync, and diagnostics consumers during boot.
exInitLifecycle();
mfRepairLegacyVirtualDays();

const MF_PRIMARY_SCREENS=["program","log","history","analytics","export"];
let mfActivePrimaryScreen="log",mfPrimaryTouch=null;

function mfSyncHeaderOffset(){const header=document.querySelector(".header");if(header)document.documentElement.style.setProperty("--mf-header-height",header.offsetHeight+"px");}

function showScreen(n){
  if(MF_PRIMARY_SCREENS.indexOf(n)<0)return false;
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
  document.getElementById("screen-"+n).classList.add("active");document.getElementById("tab-"+n).classList.add("active");document.querySelectorAll(".tab-btn").forEach(function(button){const selected=button.id==="tab-"+n;button.setAttribute("aria-selected",selected?"true":"false");button.tabIndex=selected?0:-1;});
  document.getElementById("gymRow").classList.toggle("visible",n==="program");
  if(n==="program"){renderProgram();}
  if(n==="history"){p7ApplyFilters();}
  if(n==="analytics"){p7RenderAnalytics();}
  if(n==="export"){if(typeof mfOnPrimarySyncOpen==="function")mfOnPrimarySyncOpen();updateExportMeta();mfRenderLifecycleHealth();p9RenderCoachPrefs();p950RenderUserProfile();p954RenderProgramPersonalization();const ds=document.getElementById("p945DiagSection");if(ds&&ds.classList.contains("open"))p945RenderDiag();}
  mfActivePrimaryScreen=n;if(typeof window.scrollTo==="function")window.scrollTo(0,0);return true;
}

function mfHandlePrimaryTabKeydown(event){
  const button=event&&event.currentTarget,id=button&&button.id||"",screen=id.indexOf("tab-")===0?id.slice(4):"",index=MF_PRIMARY_SCREENS.indexOf(screen);if(index<0)return false;
  let next=-1;if(event.key==="ArrowRight")next=(index+1)%MF_PRIMARY_SCREENS.length;else if(event.key==="ArrowLeft")next=(index+MF_PRIMARY_SCREENS.length-1)%MF_PRIMARY_SCREENS.length;else if(event.key==="Home")next=0;else if(event.key==="End")next=MF_PRIMARY_SCREENS.length-1;else return false;
  event.preventDefault();const target=MF_PRIMARY_SCREENS[next];if(!showScreen(target))return false;const selected=document.getElementById("tab-"+target);if(selected&&typeof selected.focus==="function")selected.focus();return true;
}

function mfPrimarySwipeTarget(input){
  if(!input||input.touchCount!==1||input.duration>700||input.duration<0)return null;
  const width=Number(input.width)||0,edge=24;if(input.startX<=edge||input.startX>=width-edge)return null;
  const dx=input.endX-input.startX,dy=input.endY-input.startY;if(Math.abs(dx)<70||Math.abs(dx)<Math.abs(dy)*1.25)return null;
  const index=MF_PRIMARY_SCREENS.indexOf(input.screen),next=index+(dx<0?1:-1);return index>=0&&next>=0&&next<MF_PRIMARY_SCREENS.length?MF_PRIMARY_SCREENS[next]:null;
}
function mfPrimarySwipeExcluded(target){
  if(!target||typeof target.closest!=="function")return false;
  if(target.closest("button,a,input,select,textarea,label,[contenteditable]:not([contenteditable='false']),details,summary,[data-mf-swipe-exempt],.mf-sync-nav,[role='dialog'],.p952-overlay,.p954r-overlay,.p960-overlay,.mf-basketball-structured"))return true;
  for(let node=target;node&&node!==document.body;node=node.parentElement){const style=typeof getComputedStyle==="function"?getComputedStyle(node):null;if(node.scrollWidth>node.clientWidth&&style&&/(auto|scroll)/.test(style.overflowX))return true;}
  return false;
}
function mfInitPrimaryNavigation(){
  mfSyncHeaderOffset();if(typeof ResizeObserver==="function"){const header=document.querySelector(".header");if(header)new ResizeObserver(mfSyncHeaderOffset).observe(header);}window.addEventListener("resize",mfSyncHeaderOffset);
  document.querySelectorAll(".tab-btn").forEach(function(button){button.addEventListener("keydown",mfHandlePrimaryTabKeydown);});
  document.addEventListener("touchstart",function(event){if(event.touches.length!==1||mfPrimarySwipeExcluded(event.target)){mfPrimaryTouch=null;return;}const touch=event.touches[0];mfPrimaryTouch={startX:touch.clientX,startY:touch.clientY,startedAt:Date.now(),touchCount:1,width:window.innerWidth,screen:mfActivePrimaryScreen};},{passive:true});
  document.addEventListener("touchend",function(event){if(!mfPrimaryTouch||event.changedTouches.length!==1){mfPrimaryTouch=null;return;}const touch=event.changedTouches[0],target=mfPrimarySwipeTarget(Object.assign({},mfPrimaryTouch,{endX:touch.clientX,endY:touch.clientY,duration:Date.now()-mfPrimaryTouch.startedAt}));mfPrimaryTouch=null;if(target)showScreen(target);},{passive:true});
}
mfInitPrimaryNavigation();
// 9.4.8.8: populate the coaching preferences textarea at load in case the
// export screen becomes active without a showScreen() transition.
p9RenderCoachPrefs();
// 9.5.0: initialize/migrate the user profile early in the load sequence, then
// populate the Sync-tab profile card in case the export screen becomes
// active without a showScreen() transition.
p950InitUserProfile();
p950ApplyTextSize();
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
