const assert = require("assert");
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

assert(html.includes("MarcusFit 10.10.0"));
assert(css.includes("--brand:#b7f34a"));
assert(css.includes("--accent:var(--brand)"));
assert(css.includes("--radius-control:7px;--radius-card:10px;--radius-modal:12px"));
assert(css.includes("--shadow-sticky:") && css.includes("--shadow-modal:"));
assert(!css.includes("text-shadow:"), "10.10 must not add or retain decorative text glows");

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
  const matches = emojiLikeMatches(source);
  assert.strictEqual(matches.length, 0, `${rel} contains runtime-owned emoji/glyph token(s): ${matches.map(hit => hit[1]).join(" ")}`);
}
assert.strictEqual(emojiLikeMatches(html).length, 0, "index.html contains runtime-owned emoji/glyph tokens");

const shared = fs.readFileSync(path.join(jsRoot, "features/13-shared-ui.js"), "utf8");
const habits = fs.readFileSync(path.join(jsRoot, "features/20-habits.js"), "utf8");
assert(shared.includes("mfLegacyRenderWoRecs") && shared.includes("mfInitProtectedUiSanitizers"), "Protected source glyphs must be neutralized at the presentation boundary");
assert(!/name\.textContent\s*=\s*h\.icon/.test(habits), "Stored Habit icons must not render as platform glyphs");
assert(!/def\s*\?\s*def\.icon/.test(habits), "Habit history must not render stored platform glyphs");

console.log(`MarcusFit 10.10.0 visual system: PASS (${symbols.length} SVG symbols, ${dynamicNames.size} dynamic icon names)`);
