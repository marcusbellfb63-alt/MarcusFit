const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const acceptedPath = path.join(root, "Releases", "MarcusFit9_6_0.html");
const accepted = fs.readFileSync(acceptedPath, "utf8");
const currentPath = path.join(root, "index.html");
const current = fs.readFileSync(currentPath, "utf8");
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

function normalizeEol(value) {
  return value.replace(/\r\n/g, "\n");
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

const acceptedStyle = blocks(accepted, "style")[0].content;
const currentStyles = blocks(current, "style");
const stylesheetMatch = current.match(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/i);
if (stylesheetMatch) {
  const stylesheetPath = path.join(root, ...stylesheetMatch[1].split("/"));
  assert.strictEqual(
    normalizeEol(fs.readFileSync(stylesheetPath, "utf8")),
    normalizeEol(acceptedStyle),
    "Extracted stylesheet differs from accepted CSS"
  );
  assert.strictEqual(currentStyles.length, 0, "Current entry point unexpectedly retains inline CSS");
}

const currentInlineScripts = blocks(current, "script").filter(block => !/\bsrc\s*=/.test(block.attributes));
if (currentInlineScripts.length === 1) {
  assert.strictEqual(
    normalizeEol(currentInlineScripts[0].content),
    normalizeEol(acceptedScript),
    "CSS-only extraction changed the inline runtime"
  );
  new vm.Script(currentInlineScripts[0].content, { filename: "index.inline.js" });
}
const currentExternalScripts = blocks(current, "script")
  .map(block => {
    const sourceMatch = block.attributes.match(/\bsrc=["']([^"']+)["']/i);
    return sourceMatch ? sourceMatch[1] : null;
  })
  .filter(Boolean);
if (currentExternalScripts.length) {
  const externalSources = currentExternalScripts.map(source => {
    const sourcePath = path.join(root, ...source.split("/"));
    const content = fs.readFileSync(sourcePath, "utf8");
    new vm.Script(content, { filename: source });
    return content;
  });
  const combinedExternalSource = externalSources.join("");
  new vm.Script(combinedExternalSource, { filename: "MarcusFit10.combined.js" });
  assert.strictEqual(
    normalizeEol(combinedExternalSource),
    normalizeEol(acceptedScript),
    "External runtime source order/content differs from accepted runtime"
  );
  const acceptedRuntimeInventory = extractInventory(`<script>${acceptedScript}</script>`);
  const currentRuntimeInventory = extractInventory(`<script>${combinedExternalSource}</script>`);
  assert.deepStrictEqual(
    currentRuntimeInventory.inlineHandlerFunctions,
    acceptedRuntimeInventory.inlineHandlerFunctions,
    "Public inline-handler function surface changed"
  );
  assert.deepStrictEqual(
    currentRuntimeInventory.windowGlobals,
    acceptedRuntimeInventory.windowGlobals,
    "Explicit window global surface changed"
  );
}

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
