const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets/css/marcusfit.css"), "utf8");
const jsRoot = path.join(root, "assets/js");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
  );
}

const jsFiles = walk(jsRoot).filter(file => file.endsWith(".js"));
const relative = file => path.relative(root, file).replace(/\\/g, "/");
const protectedUiSources = new Map([
  ["assets/js/data/02-program-data.js", 47],
  ["assets/js/sync/12-ai-sync.js", 45]
]);
const pictographic = /\p{Extended_Pictographic}/u;
const explicitGlyphs = new Set([0x2713, 0x2715, 0x2716]);

function emojiLikeMatches(source) {
  const hits = [];
  for (const match of source.matchAll(/\p{Extended_Pictographic}/gu)) hits.push([match.index, match[0]]);
  for (const match of source.matchAll(/[✓✕✖]/gu)) hits.push([match.index, match[0]]);
  for (const match of source.matchAll(/&#(?:x([0-9a-f]+)|(\d+));/gi)) {
    const point = parseInt(match[1] || match[2], match[1] ? 16 : 10);
    if (pictographic.test(String.fromCodePoint(point)) || explicitGlyphs.has(point)) hits.push([match.index, match[0]]);
  }
  for (const match of source.matchAll(/\\u(d[89ab][0-9a-f]{2})\\u(d[c-f][0-9a-f]{2})/gi)) {
    const high = parseInt(match[1], 16);
    const low = parseInt(match[2], 16);
    const point = ((high - 0xd800) * 0x400) + (low - 0xdc00) + 0x10000;
    if (pictographic.test(String.fromCodePoint(point))) hits.push([match.index, match[0]]);
  }
  for (const match of source.matchAll(/\\u(?:\{([0-9a-f]+)\}|([0-9a-f]{4}))/gi)) {
    const point = parseInt(match[1] || match[2], 16);
    if (pictographic.test(String.fromCodePoint(point)) || explicitGlyphs.has(point)) hits.push([match.index, match[0]]);
  }
  return [...new Map(hits.map(hit => [hit[0], hit])).values()];
}

function normalizedSliceHash(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert(start >= 0 && end > start, `Could not isolate accepted export slice: ${startMarker}`);
  return crypto.createHash("sha256").update(source.slice(start, end).replace(/\r\n/g, "\n")).digest("hex");
}

assert(html.includes("MarcusFit 10.10.0"));
assert(css.includes("--brand:#b7f34a"));
assert(css.includes("--accent:var(--brand)"));
assert(css.includes(".logo span:first-child{color:var(--text-primary);}"), "MARCUS must resolve to primary near-white text");
assert(css.includes(".logo span:last-child{color:var(--brand);}"), "FIT must resolve to lightning lime");
assert(css.includes("--radius-control:7px;--radius-card:10px;--radius-modal:12px"));
assert(css.includes("--shadow-sticky:") && css.includes("--shadow-modal:"));
assert(!css.includes("text-shadow:"), "10.10 must not add or retain decorative text glows");

const exportSource = fs.readFileSync(path.join(jsRoot, "sync/11-ai-export.js"), "utf8");
const progressionSource = fs.readFileSync(path.join(jsRoot, "features/09-progression-base.js"), "utf8");
assert.strictEqual(normalizedSliceHash(exportSource, "function buildLogSection", "function p9489ClassifyExercise"), "cba1ce1740cfa86bbe92fc26c2cd153b2bc935501d9adf64263a47d47e48372d", "AI Export daily-log text must remain byte-equivalent to accepted 10.9");
assert.strictEqual(normalizedSliceHash(progressionSource, "function p9BuildProgressionExport", "// ── END PHASE 9A"), "c7f6b7083b9b30af17d6367e5b6cceb5fcb02ac80cd32202dee787566b8aff30", "Progression-export labels must remain byte-equivalent to accepted 10.9");

const symbols = [...html.matchAll(/<symbol\s+id="(mf-icon-[^"]+)"/g)].map(match => match[1]);
assert(symbols.length >= 30, "Expected a useful centralized local icon vocabulary");
assert.strictEqual(new Set(symbols).size, symbols.length, "SVG symbol IDs must be unique");
const symbolSet = new Set(symbols);
for (const match of html.matchAll(/href="#(mf-icon-[^"]+)"/g)) {
  assert(symbolSet.has(match[1]), `Static SVG reference does not resolve: ${match[1]}`);
}
for (const match of html.matchAll(/<svg\s+class="mf-icon[^"]*"([^>]*)>/g)) {
  assert(/aria-hidden="true"/.test(match[1]), "Decorative static icons must be hidden from assistive technology");
}

const dynamicNames = new Set();
for (const file of jsFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/\b(?:mfIcon|mfIconMarkup|p810Icon|p810IconMarkup|p9IconMarkup|p1080IconMarkup|p7HistoryIcon)\(\s*["']([a-z0-9-]+)["']/g)) dynamicNames.add(match[1]);
  for (const match of source.matchAll(/\b(?:mfSetIconLabel|p810SetIconLabel|p954SetIconLabel|mfBasketballSetIconLabel)\([^,]+,\s*["']([a-z0-9-]+)["']/g)) dynamicNames.add(match[1]);
}
for (const name of dynamicNames) assert(symbolSet.has(`mf-icon-${name}`), `Dynamic SVG reference does not resolve: ${name}`);

for (const file of jsFiles) {
  const rel = relative(file);
  let source = fs.readFileSync(file, "utf8");
  if (protectedUiSources.has(rel)) {
    assert.strictEqual(emojiLikeMatches(source).length, protectedUiSources.get(rel), `${rel} protected exception inventory changed`);
    continue;
  }
  if (rel === "assets/js/features/20-habits.js") {
    const storageOnly = [
      'source.icon=String(source.icon||"✓")',
      'icon:"✓",source:"user"',
      '||(existing&&existing.icon)||"✓"'
    ];
    for (const token of storageOnly) {
      assert.strictEqual(source.split(token).length - 1, 1, `Habit storage-only glyph exception changed: ${token}`);
      source = source.replace(token, token.replace("✓", "stored-icon"));
    }
  }
  if (rel === "assets/js/sync/11-ai-export.js") {
    const acceptedDateHeading = 'logSection+="\\uD83D\\uDCC5 "+dt+"\\n";';
    assert.strictEqual(source.split(acceptedDateHeading).length - 1, 1, "Accepted AI Export date heading must remain exact");
    source = source.replace(acceptedDateHeading, 'logSection+=dt+"\\n";');
  }
  if (rel === "assets/js/features/09-progression-base.js") {
    const acceptedExportLabels = [
      'status==="target_reset"||status==="reduce" ? "⚠ RESET HOLD" :',
      'status==="safer_hold"||status==="safer-hold" ? "⚠ SAFER HOLD" :'
    ];
    for (const token of acceptedExportLabels) {
      assert.strictEqual(source.split(token).length - 1, 1, `Accepted progression-export label changed: ${token}`);
      source = source.replace(token, token.replace("⚠ ", ""));
    }
  }
  if (rel === "assets/js/features/13-shared-ui.js") {
    const adapter = source.match(/function mfAdaptCoreSyncOwnedStatusText\(value\)\{[\s\S]*?\n\}(?=\nfunction mfAdaptCoreSyncResultPresentation)/);
    assert(adapter, "Expected the bounded core-Sync presentation adapter");
    assert(!adapter[0].includes("Extended_Pictographic"), "Core-Sync adapter must not generically strip pictographs");
    assert(!adapter[0].includes("localStorage"), "Core-Sync adapter must remain presentation-only");
    source = source.replace(adapter[0], "");
  }
  const matches = emojiLikeMatches(source);
  assert.strictEqual(matches.length, 0, `${rel} contains runtime-owned emoji/glyph token(s): ${matches.map(hit => hit[1]).join(" ")}`);
}
assert.strictEqual(emojiLikeMatches(html).length, 0, "index.html contains runtime-owned emoji/glyph tokens");

const shared = fs.readFileSync(path.join(jsRoot, "features/13-shared-ui.js"), "utf8");
const habits = fs.readFileSync(path.join(jsRoot, "features/20-habits.js"), "utf8");
assert(shared.includes("mfLegacyRenderWoRecs") && shared.includes("mfInitProtectedUiSanitizers"), "Protected source glyphs must be neutralized at the presentation boundary");
const adapterSource = shared.match(/function mfAdaptCoreSyncOwnedStatusText\(value\)\{[\s\S]*?\n\}(?=\nfunction mfAdaptCoreSyncResultPresentation)/);
assert(adapterSource, "Core-Sync presentation adapter must remain independently testable");
const adaptCoreSyncText = Function(adapterSource[0] + ";return mfAdaptCoreSyncOwnedStatusText;")();
const ownedStatusSamples = [
  "❌ No MARCUSFIT_UPDATE block found.",
  "ℹ️ Sync block contained an empty array — no changes to apply.",
  "⚠ recommendations (home d0): 1 non-string/empty item(s) ignored",
  "✓ Recommendations set for home Day 1 (1 item)",
  "🔀 1 day reordered",
  "💬 1 recommendation set applied",
  "🏷️ 1 day override applied",
  "🗑️📅 1 virtual day cleared",
  "🗑️ 1 day override cleared",
  "➕📅 1 virtual day set",
  "➕💪 1 custom exercise added",
  "✅ 1 exercise updated",
  "➕ 1 exercise added",
  "🧠 1 habit updated",
  "⚠️ Skipped (1):"
];
for (const sample of ownedStatusSamples) {
  assert.strictEqual(emojiLikeMatches(adaptCoreSyncText(sample)).length, 0, `Known core-Sync status glyph was not adapted: ${sample}`);
}
const arbitraryText = "User note 😀 stays intact";
assert.strictEqual(adaptCoreSyncText(arbitraryText), arbitraryText, "Arbitrary pictographic content must remain byte-for-byte identical");
const prefixedArbitraryText = "❌ User note 😀 stays intact";
assert.strictEqual(adaptCoreSyncText(prefixedArbitraryText), prefixedArbitraryText, "Unknown prefixed content must remain byte-for-byte identical");
const ownedWithUserReason = "✓ Recommendations set for home Day 1 (1 item) — User note 😀 stays intact";
assert.strictEqual(adaptCoreSyncText(ownedWithUserReason), "Recommendations set for home Day 1 (1 item) — User note 😀 stays intact", "Only the owned prefix may be removed from a known status");
const rawTail = "✅ User note 😀 stays intact";
const parseResult = "❌ JSON parse error: example\n\nRaw content detected:\n" + rawTail;
assert.strictEqual(adaptCoreSyncText(parseResult), "JSON parse error: example\n\nRaw content detected:\n" + rawTail, "Raw imported content must remain byte-for-byte identical");
assert(!/name\.textContent\s*=\s*h\.icon/.test(habits), "Stored Habit icons must not render as platform glyphs");
assert(!/def\s*\?\s*def\.icon/.test(habits), "Habit history must not render stored platform glyphs");

console.log(`MarcusFit 10.10.0 visual system: PASS (${symbols.length} SVG symbols, ${dynamicNames.size} dynamic icon names)`);
