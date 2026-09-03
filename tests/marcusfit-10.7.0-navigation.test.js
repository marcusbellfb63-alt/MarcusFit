const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "assets/js/boot/21-app-boot.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const start = source.indexOf("const MF_PRIMARY_SCREENS=");
const end = source.indexOf("function mfPrimarySwipeExcluded", start);
const context = {}; vm.createContext(context); vm.runInContext(source.slice(start, end), context);
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
assert(source.includes("if(target)showScreen(target)"), "successful swipe bypasses showScreen");
assert(source.includes("button,a,input,select,textarea,label") && source.includes("[role='dialog']") && source.includes(".mf-basketball-structured"), "interactive/modal/courtside exclusions missing");
assert(!/localStorage\./.test(source.slice(start, source.indexOf("// 9.4.8.8"))), "primary navigation writes storage");
assert.strictEqual((html.match(/role="tab"/g)||[]).length,5);assert.strictEqual((html.match(/role="tabpanel"/g)||[]).length,5);
assert(html.includes('role="tablist" aria-label="Primary navigation"'));

console.log("MarcusFit 10.7.0 primary navigation/swipe: PASS");
