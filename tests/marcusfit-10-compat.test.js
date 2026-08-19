const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const childProcess = require("child_process");

const root = path.resolve(__dirname, "..");
const acceptedPath = path.join(root, "Releases", "MarcusFit9_6_0.html");
const accepted = fs.readFileSync(acceptedPath, "utf8");
const currentPath = path.join(root, "index.html");
const current = fs.readFileSync(currentPath, "utf8");
const acceptedSha256 = crypto.createHash("sha256").update(fs.readFileSync(acceptedPath)).digest("hex");
const acceptedGitBytes = Buffer.from(fs.readFileSync(acceptedPath, "utf8").replace(/\r\n/g, "\n"));
const acceptedBlob = crypto.createHash("sha1")
  .update(`blob ${acceptedGitBytes.length}\0`)
  .update(acceptedGitBytes)
  .digest("hex");
const expectedScriptOrder = JSON.parse(fs.readFileSync(
  path.join(root, "tests", "fixtures", "runtime-script-order.json"),
  "utf8"
));

const EXPECTED_ACCEPTED_SHA256 = "69a3a66541d14290a6a7b73bf313365176169fd0d659e6effb29edcaf7a4e34b";
const EXPECTED_ACCEPTED_GIT_BLOB = "c10e4a488296b7ba83311d7fc7bdd1dcd4c4b7e8";
const EXPECTED_BASKETBALL_SHA256 = "897f46401adf7264843a11a3fe9ba11d647f083b1bc048bffc980c96572a8b92";
const TARGET_APP_VERSION = "10.1.3";

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

function extractBalanced(source, startToken) {
  const start = source.indexOf(startToken);
  assert(start >= 0, `Missing token: ${startToken}`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = brace; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth++;
    if (character === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unbalanced token: ${startToken}`);
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
assert.strictEqual(acceptedBlob, EXPECTED_ACCEPTED_GIT_BLOB, "Accepted 9.6.0 Git blob changed");
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
  const currentStylesheet = normalizeEol(fs.readFileSync(stylesheetPath, "utf8"));
  assert(
    currentStylesheet.startsWith(normalizeEol(acceptedStyle)),
    "Accepted stylesheet content changed instead of receiving a scoped append"
  );
  assert(currentStylesheet.includes("MarcusFit 10.1.0: isolated basketball session logging"),
    "Scoped basketball stylesheet boundary is missing");
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
  assert.deepStrictEqual(currentExternalScripts, expectedScriptOrder, "External script order changed");
  for (const block of blocks(current, "script")) {
    assert(/\bdefer(?:\s|>|$)/i.test(block.attributes), "Every production script must use defer");
    assert(!/\btype=["']module["']/i.test(block.attributes), "Production scripts must remain classic scripts");
  }
  const externalSources = currentExternalScripts.map(source => {
    const sourcePath = path.join(root, ...source.split("/"));
    const content = fs.readFileSync(sourcePath, "utf8");
    new vm.Script(content, { filename: source });
    return content;
  });
  const basketballSource = externalSources[externalSources.length - 1];
  const combinedExternalSource = externalSources.join("");
  new vm.Script(combinedExternalSource, { filename: "MarcusFit10.combined.js" });
  assert.strictEqual(
    crypto.createHash("sha256").update(basketballSource).digest("hex"),
    EXPECTED_BASKETBALL_SHA256,
    "Accepted basketball runtime changed"
  );
  const acceptedRuntimeInventory = extractInventory(`<script>${acceptedScript}</script>`);
  const currentRuntimeInventory = extractInventory(`<script>${combinedExternalSource}</script>`);
  acceptedRuntimeInventory.inlineHandlerFunctions.forEach(name => assert(
    currentRuntimeInventory.inlineHandlerFunctions.includes(name),
    `Accepted inline-handler function disappeared: ${name}`
  ));
  acceptedRuntimeInventory.windowGlobals.forEach(name => assert(
    currentRuntimeInventory.windowGlobals.includes(name),
    `Accepted explicit window global disappeared: ${name}`
  ));
  assert.strictEqual(
    crypto.createHash("sha256").update(normalizeEol(extractBalanced(combinedExternalSource, "const P ="))).digest("hex"),
    crypto.createHash("sha256").update(normalizeEol(extractBalanced(acceptedScript, "const P ="))).digest("hex"),
    "Base program P changed"
  );
  const restoreSequence = [
    "p8ValidateBackup(raw)",
    "p8MigrateBackup(backup)",
    "p8492SummarizeBackup(backup)",
    "p8ExecuteRestore(backup)",
    "mfRunPostRestoreValidation()",
    "location.reload()"
  ];
  const restoreFlowStart = combinedExternalSource.indexOf("function p8RestoreBackup");
  assert(restoreFlowStart >= 0, "Restore flow is missing");
  const restoreFlow = combinedExternalSource.slice(restoreFlowStart);
  const restoreOffsets = restoreSequence.map(token => restoreFlow.indexOf(token));
  assert(restoreOffsets.every(offset => offset >= 0), "Backup/restore sequence token is missing");
  assert(
    restoreOffsets.every((offset, index) => index === 0 || restoreOffsets[index - 1] < offset),
    "Backup/restore sequence order changed"
  );
}
assert(current.includes(`<title>MarcusFit ${TARGET_APP_VERSION}</title>`), "Current title version is incorrect");
assert(
  current.includes(`MarcusFit ${TARGET_APP_VERSION}</strong>`),
  "Current visible version is incorrect"
);

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

const currentHtmlInventory = extractInventory(current);
assert.strictEqual(
  [...current.matchAll(/\s(on[a-z]+)\s*=\s*(["'])(.*?)\2/gis)].length,
  83,
  "Inline attribute count changed"
);
assert.strictEqual(currentHtmlInventory.inlineHandlerFunctions.length, 61, "Inline handler function count changed");

const scanner = JSON.parse(childProcess.execFileSync(process.execPath, [
  path.join(root, "tools", "architecture", "inventory-runtime.js")
], { encoding: "utf8" }));
assert.strictEqual(scanner.totals.inlineHandlerAttributes, 83, "Scanner inline attribute contract changed");
assert.strictEqual(scanner.totals.inlineHandlerFunctions, 61, "Scanner handler function contract changed");
assert(
  scanner.totals.uniquePublicOrCrossFileNames >= 257,
  "The accepted 257-name compatibility surface lost scanner-visible names"
);

const ownedStorageTokens = [
  "day-", "mf-overrides", "mf-current-draft", "mf-exercise-state", "mf-recommendations",
  "mf-ai-coaching-preferences", "mf-user-profile", "mf-onboarding-state",
  "mf-onboarding-program-proposal", "mf-recurring-items", "mf-recurring-events",
  "mf-habit-definitions", "mf-habit-proposal", "mf-basketball-sessions"
];
const orderedRuntimeSource = expectedScriptOrder
  .map(source => fs.readFileSync(path.join(root, ...source.split("/")), "utf8"))
  .join("");
ownedStorageTokens.forEach(token => assert(orderedRuntimeSource.includes(token), `Owned storage token disappeared: ${token}`));

if (process.argv.includes("--inventory")) {
  process.stdout.write(JSON.stringify({
    acceptedSha256,
    acceptedBytes: fs.statSync(acceptedPath).size,
    ...inventory
  }, null, 2) + "\n");
}

console.log("MarcusFit 10 compatibility baseline: PASS");
