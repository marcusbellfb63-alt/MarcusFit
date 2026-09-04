const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "assets/js/boot/21-app-boot.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets/css/marcusfit.css"), "utf8");
const start = source.indexOf("const MF_PRIMARY_SCREENS=");
const initCall = "mfInitPrimaryNavigation();";
const end = source.indexOf(initCall, start)+initCall.length;

function node(id){
  const classes=new Set();
  return {id,focused:0,attributes:{},listeners:{},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),toggle(k,on){on?classes.add(k):classes.delete(k);},contains:k=>classes.has(k)},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){this.listeners[k]=fn;},focus(){this.focused++;}};
}
const screens=Object.fromEntries(["program","log","history","analytics","export"].map(id=>[id,node("screen-"+id)]));
const tabs=Object.fromEntries(["program","log","history","analytics","export"].map(id=>[id,node("tab-"+id)]));
const gymRow=node("gymRow"),scrolls=[],documentListeners={};
const document={documentElement:{scrollTop:0,style:{setProperty(){}}},body:{},querySelectorAll(selector){return selector===".screen"?Object.values(screens):selector===".tab-btn"?Object.values(tabs):[];},querySelector(){return null;},getElementById(id){if(id==="gymRow")return gymRow;if(id==="p945DiagSection")return null;return Object.values(screens).concat(Object.values(tabs)).find(item=>item.id===id)||null;},addEventListener(name,handler){documentListeners[name]=handler;}};
const context={document,window:{scrollY:842,innerWidth:390,scrollTo(x,y){scrolls.push([x,y]);},addEventListener(){}},renderProgram(){},p7ApplyFilters(){},p7RenderAnalytics(){},mfOnPrimarySyncOpen(){},updateExportMeta(){},mfRenderLifecycleHealth(){},p9RenderCoachPrefs(){},p950RenderUserProfile(){},p954RenderProgramPersonalization(){}};
vm.createContext(context);vm.runInContext(source.slice(start,end),context);

const target = input => context.mfPrimarySwipeTarget(Object.assign({touchCount:1,duration:250,width:390,startX:150,startY:300,endY:305,screen:"log"},input));
assert.strictEqual(target({endX:70}), "history", "left swipe did not move forward");
assert.strictEqual(target({screen:"history",endX:230}), "log", "right swipe did not move backward");
assert.strictEqual(target({endX:90}), null, "sub-threshold swipe navigated");
assert.strictEqual(target({endX:60,endY:410}), null, "vertical gesture navigated");
assert.strictEqual(target({touchCount:2,endX:60}), null, "multi-touch gesture navigated");
assert.strictEqual(target({duration:900,endX:60}), null, "slow gesture navigated");
assert.strictEqual(target({startX:12,endX:100}), null, "left-edge gesture navigated");
assert.strictEqual(target({startX:378,endX:290}), null, "right-edge gesture navigated");
assert.strictEqual(target({screen:"program",endX:230}), null, "crossed first-tab boundary");
assert.strictEqual(target({screen:"export",endX:60}), null, "crossed last-tab boundary");

// Every successful primary route, including revisits, synchronously opens at the top.
["program","log","history","analytics","export","program"].forEach(screen=>{context.window.scrollY=999;assert.strictEqual(context.showScreen(screen),true);assert.deepStrictEqual(scrolls.at(-1),[0,0]);});
assert(!source.includes("mfPrimaryScrollPositions")&&!source.includes("mfPrimaryVisited"),"obsolete scroll restoration state remains");

function key(button,key){const event={key,currentTarget:button,prevented:false,preventDefault(){this.prevented=true;}};const handled=button.listeners.keydown(event);return {event,handled};}
let result=key(tabs.program,"ArrowRight");assert(result.handled&&result.event.prevented);assert.strictEqual(tabs.log.focused,1);assert.strictEqual(tabs.log.attributes["aria-selected"],"true");
result=key(tabs.program,"ArrowLeft");assert(result.handled&&result.event.prevented);assert.strictEqual(tabs.export.focused,1,"ArrowLeft did not wrap and focus the final tab");
result=key(tabs.history,"Home");assert(result.handled&&result.event.prevented);assert.strictEqual(tabs.program.focused,1);
result=key(tabs.log,"End");assert(result.handled&&result.event.prevented);assert.strictEqual(tabs.export.focused,2);
["Enter"," "].forEach(nativeKey=>{const native=key(tabs.program,nativeKey);assert.strictEqual(native.handled,false);assert.strictEqual(native.event.prevented,false,"native button activation was intercepted");});

const fieldTarget={closest(selector){return selector.includes("input")?this:null;}},activeBeforeFieldGesture=tabs.export.attributes["aria-selected"],scrollCountBeforeFieldGesture=scrolls.length;
documentListeners.touchstart({touches:[{clientX:220,clientY:300}],target:fieldTarget});documentListeners.touchend({changedTouches:[{clientX:80,clientY:305}],target:fieldTarget});
assert.strictEqual(tabs.export.attributes["aria-selected"],activeBeforeFieldGesture,"touch/swipe inside a workout input changed the primary tab");assert.strictEqual(scrolls.length,scrollCountBeforeFieldGesture,"excluded workout-field gesture routed through showScreen");

assert(source.includes("if(target)showScreen(target)"), "successful swipe bypasses showScreen");
assert(source.includes("button,a,input,select,textarea,label") && source.includes("[role='dialog']") && source.includes(".mf-basketball-structured"), "interactive/modal/courtside exclusions missing");
assert(!/localStorage\.|sessionStorage\.|history\.(?:pushState|replaceState)/.test(source.slice(start, source.indexOf("// 9.4.8.8"))), "primary navigation persists or mutates navigation state");
assert.strictEqual((html.match(/class="tab-btn[^\"]*"[^>]*role="tab"/g)||[]).length,5);assert.strictEqual((html.match(/role="tabpanel" aria-labelledby="tab-/g)||[]).length,5);
assert(html.includes('role="tablist" aria-label="Primary navigation"'));
assert(css.includes("html,body{overflow-x:clip;}"), "horizontal clipping must not create a sticky-breaking scroll container");

console.log("MarcusFit 10.7.0 primary navigation/swipe: PASS");
