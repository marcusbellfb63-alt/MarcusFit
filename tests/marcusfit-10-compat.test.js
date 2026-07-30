const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const acceptedPath = path.join(root, "Releases", "MarcusFit9_6_0.html");
const accepted = fs.readFileSync(acceptedPath, "utf8");
const acceptedSha256 = crypto.createHash("sha256").update(fs.readFileSync(acceptedPath)).digest("hex");

const EXPECTED_ACCEPTED_SHA256 = "69a3a66541d14290a6a7b73bf313365176169fd0d659e6effb29edcaf7a4e34b";

function blocks(source, tagName) {
  return [...source.matchAll(new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, "gi"))]
    .map((match, index) => ({
      index,
      offset: match.index,
      attributes: match[1].trim(),
      content: match[2]
    }));
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function extractInventory(source) {
  const scriptBlocks = blocks(source, "script");
  const styleBlocks = blocks(source, "style");
  const inlineHandlers = [...source.matchAll(/\s(on[a-z]+)\s*=\s*(["'])(.*?)\2/gis)];
  const handlerFunctions = [];
  for (const match of inlineHandlers) {
    for (const call of match[3].matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (!["if", "for", "while", "switch"].includes(call[1])) handlerFunctions.push(call[1]);
    }
  }
  const scripts = scriptBlocks.map(block => block.content).join("\n");
  const storageKeys = [...scripts.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*(["'`])([^"'`]+)\1/g)]
    .map(match => match[2]);
  const windowGlobals = [...scripts.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)]
    .map(match => match[1]);
  const topLevelNames = [];
  for (const match of scripts.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) {
    topLevelNames.push(match[1] || match[2]);
  }
  return {
    styleBlocks: styleBlocks.map(block => ({
      index: block.index,
      offset: block.offset,
      attributes: block.attributes,
      characters: block.content.length
    })),
    scriptBlocks: scriptBlocks.map(block => ({
      index: block.index,
      offset: block.offset,
      attributes: block.attributes,
      characters: block.content.length
    })),
    inlineHandlerAttributes: sortedUnique(inlineHandlers.map(match => match[1].toLowerCase())),
    inlineHandlerFunctions: sortedUnique(handlerFunctions),
    windowGlobals: sortedUnique(windowGlobals),
    storageKeyLiterals: sortedUnique(storageKeys),
    topLevelNames: sortedUnique(topLevelNames),
    domContentLoadedReferences: (scripts.match(/DOMContentLoaded/g) || []).length,
    windowLoadListeners: (scripts.match(/addEventListener\s*\(\s*["']load["']/g) || []).length
  };
}

assert.strictEqual(acceptedSha256, EXPECTED_ACCEPTED_SHA256, "Accepted 9.6.0 release hash changed");
assert.strictEqual(blocks(accepted, "style").length, 1, "Accepted release must retain one style block");
assert.strictEqual(blocks(accepted, "script").length, 1, "Accepted release must retain one script block");
assert(accepted.includes('const APP_VERSION = "9.6.0";'), "Accepted APP_VERSION changed");
assert(accepted.includes('key === "mf-habit-definitions" || key === "mf-habit-proposal"'),
  "Habit keys are missing from backup ownership");

const acceptedScript = blocks(accepted, "script")[0].content;
new vm.Script(acceptedScript, { filename: "MarcusFit9_6_0.inline.js" });

const inventory = extractInventory(accepted);
const requiredGlobals = [
  ...inventory.inlineHandlerFunctions,
  ...inventory.windowGlobals,
  "mfRunPostRestoreValidation",
  "p8IsMarcusFitKey",
  "p8ValidateBackup",
  "p8MigrateBackup",
  "p8492SummarizeBackup",
  "p8ExecuteRestore"
];
for (const name of sortedUnique(requiredGlobals)) {
  assert(
    new RegExp(`(?:function\\s+${name}\\s*\\(|(?:const|let|var)\\s+${name}\\s*=|window\\.${name}\\s*=)`).test(acceptedScript),
    `Required public/global function is absent from accepted release: ${name}`
  );
}

if (process.argv.includes("--inventory")) {
  process.stdout.write(JSON.stringify({
    acceptedSha256,
    acceptedBytes: fs.statSync(acceptedPath).size,
    ...inventory
  }, null, 2) + "\n");
}

console.log("MarcusFit 10 compatibility baseline: PASS");
