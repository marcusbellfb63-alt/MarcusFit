#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..", "..");
const htmlPath = path.join(root, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const scriptSources = [...html.matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)]
  .map(match => match[2]);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function extractBalanced(source, startToken) {
  const start = source.indexOf(startToken);
  if (start < 0) throw new Error(`Missing token: ${startToken}`);
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
    if (character === "'" || character === '"' || character === "`") quote = character;
    else if (character === "{") depth++;
    else if (character === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unbalanced token: ${startToken}`);
}

function lineAt(source, offset) {
  return source.slice(0, offset).split(/\r?\n/).length;
}

function physicalLineCount(source) {
  if (!source) return 0;
  const normalized = source.replace(/\r\n/g, "\n");
  return normalized.split("\n").length - (normalized.endsWith("\n") ? 1 : 0);
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function functionNames(expression) {
  return uniqueSorted([...expression.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)]
    .map(match => match[1])
    .filter(name => !["if", "for", "while", "switch"].includes(name)));
}

const inlineHandlers = [...html.matchAll(/<([a-z][\w-]*)\b([^>]*?)\s(on[a-z]+)\s*=\s*(["'])(.*?)\4([^>]*)>/gis)]
  .map(match => {
    const attributes = `${match[2]} ${match[6]}`;
    const id = (attributes.match(/\bid\s*=\s*["']([^"']+)["']/i) || [])[1] || null;
    return {
      line: lineAt(html, match.index),
      element: match[1].toLowerCase(),
      id,
      attribute: match[3].toLowerCase(),
      expression: match[5],
      functions: functionNames(match[5])
    };
  });

const scripts = scriptSources.map(relativePath => {
  const absolutePath = path.join(root, ...relativePath.split("/"));
  const source = fs.readFileSync(absolutePath, "utf8");
  const declarations = [...source.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/gm)]
    .map(match => ({ name: match[1] || match[2], line: lineAt(source, match.index) }));
  const windowAssignments = [...source.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)]
    .map(match => ({ name: match[1], line: lineAt(source, match.index) }));
  const storageOperations = [...source.matchAll(/localStorage\.(getItem|setItem|removeItem)\(\s*([^,\n\r)]+)/g)]
    .map(match => ({ operation: match[1], expression: match[2].trim(), line: lineAt(source, match.index) }));
  const domIds = [...source.matchAll(/getElementById\(\s*["']([^"']+)["']\s*\)/g)]
    .map(match => ({ id: match[1], line: lineAt(source, match.index) }));
  const listeners = [...source.matchAll(/(?:window|document|[A-Za-z_$][\w$]*)\.addEventListener\(\s*["']([^"']+)["']/g)]
    .map(match => ({ event: match[1], line: lineAt(source, match.index) }));
  const legacyCaptures = [...source.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*(?:Legacy|Original)[A-Za-z_$\w]*)\s*=\s*([A-Za-z_$][\w$]*)\s*;/gmi)]
    .map(match => ({ capture: match[1], target: match[2], line: lineAt(source, match.index) }));
  const functionReassignments = [...source.matchAll(/^([A-Za-z_$][\w$]*)\s*=\s*function\b/gm)]
    .map(match => ({ name: match[1], line: lineAt(source, match.index) }));
  return {
    file: relativePath,
    lines: physicalLineCount(source),
    bytes: fs.statSync(absolutePath).size,
    declarations,
    windowAssignments,
    storageOperations,
    domIds,
    listeners,
    legacyCaptures,
    functionReassignments
  };
});
const combinedSource = scriptSources
  .map(relativePath => fs.readFileSync(path.join(root, ...relativePath.split("/")), "utf8"))
  .join("");
const programSource = extractBalanced(combinedSource, "const P =");
const exerciseIds = [...programSource.matchAll(/\bid\s*:\s*["']([^"']+)["']/g)]
  .map(match => match[1])
  .sort();
const acceptedReleasePath = path.join(root, "Releases", "MarcusFit9_6_0.html");

const crossFileSymbols = [];
for (const definingScript of scripts) {
  for (const declaration of definingScript.declarations) {
    const escaped = declaration.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const consumers = scripts
      .filter(script => script.file !== definingScript.file)
      .filter(script => {
        const source = fs.readFileSync(path.join(root, ...script.file.split("/")), "utf8");
        return new RegExp(`\\b${escaped}\\b`).test(source);
      })
      .map(script => script.file);
    if (consumers.length) {
      crossFileSymbols.push({
        name: declaration.name,
        definedIn: definingScript.file,
        line: declaration.line,
        consumers
      });
    }
  }
}

const report = {
  generatedFrom: scriptSources,
  scriptOrder: scriptSources,
  inlineHandlers,
  inlineHandlerFunctions: uniqueSorted(inlineHandlers.flatMap(handler => handler.functions)),
  crossFileSymbols,
  scripts,
  totals: {
    inlineHandlerAttributes: inlineHandlers.length,
    inlineHandlerFunctions: uniqueSorted(inlineHandlers.flatMap(handler => handler.functions)).length,
    topLevelDeclarations: scripts.reduce((sum, script) => sum + script.declarations.length, 0),
    explicitWindowAssignments: scripts.reduce((sum, script) => sum + script.windowAssignments.length, 0),
    uniquePublicOrCrossFileNames: uniqueSorted([
      ...inlineHandlers.flatMap(handler => handler.functions),
      ...scripts.flatMap(script => script.windowAssignments.map(item => item.name)),
      ...crossFileSymbols.map(item => item.name)
    ]).length,
    uniqueDomIds: uniqueSorted(scripts.flatMap(script => script.domIds.map(item => item.id))).length,
    storageOperationSites: scripts.reduce((sum, script) => sum + script.storageOperations.length, 0),
    runtimeFiles: scripts.length,
    runtimeLines: scripts.reduce((sum, script) => sum + script.lines, 0),
    maximumFileLines: Math.max(...scripts.map(script => script.lines)),
    uniqueExplicitWindowNames: uniqueSorted(scripts.flatMap(script => script.windowAssignments.map(item => item.name))).length
  },
  protectedInvariants: {
    acceptedReleaseSha256: sha256(fs.readFileSync(acceptedReleasePath)),
    programSha256: sha256(programSource.replace(/\r\n/g, "\n")),
    exerciseIdCount: exerciseIds.length,
    exerciseIdSha256: sha256(exerciseIds.join("\n")),
    duplicateExerciseIds: exerciseIds.filter((id, index) => index > 0 && id === exerciseIds[index - 1]),
    combinedRuntimeSha256: sha256(combinedSource.replace(/\r\n/g, "\n"))
  }
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
