const assert=require("assert"),fs=require("fs"),path=require("path"),vm=require("vm");
const root=path.resolve(__dirname,".."),source=fs.readFileSync(path.join(root,"assets/js/features/10-workout-logging.js"),"utf8"),progression=fs.readFileSync(path.join(root,"assets/js/features/18-progression-corrections.js"),"utf8");
function extractBalanced(text,startToken){const at=text.indexOf(startToken);assert(at>=0,"missing "+startToken);const brace=text.indexOf("{",at);let depth=0,quote=null,escaped=false;for(let i=brace;i<text.length;i++){const ch=text[i];if(quote){if(escaped)escaped=false;else if(ch==="\\")escaped=true;else if(ch===quote)quote=null;continue;}if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}if(ch==="{")depth++;if(ch==="}"&&--depth===0)return text.slice(at,i+1);}throw new Error("unbalanced "+startToken);}

let logHtml="",blocks=[],writes=0;
const logEl={get innerHTML(){return logHtml;},set innerHTML(value){logHtml=value;blocks=[];},appendChild(block){blocks.push(block);}};
const daySelect={value:"0"},note={textContent:""};
const day={_dayIdx:0,name:"Mixed metrics",note:"",exercises:[
  {id:"lift",name:"Assisted Pull-Up",sets:1,reps:"8–12",load:"100–120 lb assistance",rir:"2"},
  {id:"duration",name:"Plank",sets:1,reps:"20–40 sec",load:"Bodyweight",rir:"—"}
]};
const entered={
  'input[data-exid="lift"][data-set="0"][data-field="wt"]':{value:"Bodyweight + red band"},
  'input[data-exid="lift"][data-set="0"][data-field="reps"]':{value:"12"},
  'select[data-exid="lift"][data-set="0"][data-field="rir"]':{value:"2"},
  'input[data-exid="lift"][data-field="exnote"]':{value:"raw load retained"}
};
const document={getElementById(id){return id==="woDaySelect"?daySelect:id==="woDayNoteOut"?note:id==="woExerciseLog"?logEl:null;},createElement(){return {className:"",innerHTML:"",querySelectorAll(){return [];}};},querySelector(selector){return entered[selector]||null;}};
const context={document,localStorage:{setItem(){writes++;throw new Error("render/focus wrote storage");},removeItem(){writes++;throw new Error("render/focus wrote storage");}},logGym:"home",getResolvedDays(){return [day];},getEffectiveDayMeta(){return day;},getTodayWoData(){return {};},getF(id,key,fallback){return fallback;},p5GetLastEntry(){return null;},p9GetProgressionStatus(){return "new";},p9ComputePrefill(id){return {wt:id==="lift"?"Bodyweight + red band":"",reps:"",rir:"—"};},p5Block(){return "";},renderWoRecs(){}};context.window=context;vm.createContext(context);const helperSource=extractBalanced(source,"function mfWorkoutSetLoadKeyboardMode"),renderSource=source.slice(source.indexOf("function renderWoExercises()"),source.indexOf("function getTodayWoData")),collectSource=source.slice(source.indexOf("function collectWoData()"),source.indexOf("function updateTrackerDate"));vm.runInContext(helperSource+"\n"+renderSource+"\n"+collectSource,context);

context.renderWoExercises();assert.strictEqual(blocks.length,2);
assert(/class="wo-set-wt" type="text" inputmode="text"/.test(blocks[0].innerHTML)&&blocks[0].innerHTML.includes('aria-label="Use number keypad for this load"'),"existing flexible load did not rerender with a practical text keyboard");
assert(/class="wo-set-wt" type="text" inputmode="decimal"/.test(blocks[1].innerHTML)&&blocks[1].innerHTML.includes('aria-label="Use text keyboard for this load"'),"empty load did not default to a decimal keypad with a text-keyboard escape hatch");
assert(/class="wo-set-reps" type="text" inputmode="numeric"/.test(blocks[0].innerHTML),"reps/count did not request an integer keypad");
assert(/class="wo-set-reps" type="text" inputmode="decimal"/.test(blocks[1].innerHTML),"duration did not request a decimal keypad");
assert(blocks[0].innerHTML.includes('class="wo-set-rir"')&&blocks[0].innerHTML.includes('value="1–2"'),"native RIR choices changed");
assert(!blocks.map(block=>block.innerHTML).join("").includes('type="number"'),"flexible workout entry was converted to type=number");
context.renderWoExercises();assert.strictEqual(blocks.length,2);assert(blocks[0].innerHTML.includes('inputmode="text"')&&blocks[0].innerHTML.includes('inputmode="numeric"')&&blocks[1].innerHTML.includes('inputmode="decimal"'),"rerender lost keyboard hints");

const modeInput={attributes:{inputmode:"decimal"},focused:0,setAttribute(k,v){this.attributes[k]=v;},focus(){this.focused++;},getAttribute(k){return this.attributes[k];}},modeButton={attributes:{},textContent:"ABC",setAttribute(k,v){this.attributes[k]=v;}};
assert.strictEqual(context.mfWorkoutSetLoadKeyboardMode(modeInput,modeButton,true),true);assert.strictEqual(modeInput.attributes.inputmode,"text");assert.strictEqual(modeButton.textContent,"123");assert.strictEqual(modeButton.attributes["aria-pressed"],"true");assert.strictEqual(modeInput.focused,1);
assert.strictEqual(context.mfWorkoutSetLoadKeyboardMode(modeInput,modeButton,false),true);assert.strictEqual(modeInput.attributes.inputmode,"decimal");assert.strictEqual(modeButton.textContent,"ABC");assert.strictEqual(modeButton.attributes["aria-pressed"],"false");assert.strictEqual(modeInput.focused,2);

const saved=JSON.parse(JSON.stringify(context.collectWoData()));assert.deepStrictEqual(saved,{gym:"home",dayIdx:"0",dayName:"Mixed metrics",exercises:{lift:{sets:[{wt:"Bodyweight + red band",reps:"12",rir:"2"}],note:"raw load retained"}}},"workout storage shape or raw flexible load changed");
assert(progression.includes('input.setAttribute("inputmode",profile.type==="duration"?"decimal":"numeric")'),"metric-aware rerender enhancement does not preserve inputmode");
assert.strictEqual(writes,0,"rendering, rerendering, focusing, changing keyboard mode, or collecting workout fields wrote storage");
console.log("MarcusFit 10.7.0 workout mobile input modes: PASS");
