# MarcusFit 10.10.0 visual-system audit

## Scope and baseline

MarcusFit 10.10.0 starts from accepted 10.9.0 production merge
`d4a8f4d85ecb66e6c30a192ab4c3ae5bc8399dd3`. This release changes
presentation only. Program `P`, stable exercise IDs, storage, schemas, history
identity, progression, AI contracts, Basketball logic, script count/order, and
accepted `Releases/` artifacts remain protected.

The accepted stylesheet is retained as a compatibility prefix. The 10.10
system is a scoped final cascade so accepted component contracts remain
reviewable while the effective tokens and shared geometry are centralized.

## Phase 1 inventory

### Color system

The accepted root exposed four neutral foundation tokens, two cyan/orange
brand accents, three semantic colors, and six workout-domain colors. The audit
classified them as follows:

| Class | Accepted examples | 10.10 treatment |
| --- | --- | --- |
| Brand | `--accent: #00e5ff`, `--accent2: #ff6b35` | Both compatibility aliases resolve to canonical lightning lime `#b7f34a`. |
| Neutral | `--bg`, `--surface`, `--surface2`, `--border`, `--text`, `--muted` | Resolve to near-black, three deliberate charcoal surface levels, restrained borders, and four text levels. |
| Semantic | `--green`, `--red`, `--yellow` | Resolve to dedicated success, error, and warning tokens; info is added for neutral rest/information states. |
| Workout domain | push, lower, cardio, pull, pump, arms | Remain distinct and muted. They are not converted to lime because they communicate workout category. |
| Legacy/decorative | direct cyan/orange `rgba`, component mixes, glows | Effective rules use semantic/brand mixes and the two-level elevation scale; old declarations survive only inside the accepted compatibility prefix. |

Across runtime CSS/HTML/JS, the accepted baseline contained 10 direct RGB/A
forms and 68 distinct `color-mix()` expressions, plus repeated inline color
styles. The 10.10 cascade makes brand, semantic, neutral, category, text, and
contrast ownership explicit instead of treating every accent as interchangeable.

### Surfaces and geometry

The accepted stylesheet contained 21 distinct radius declarations (including
compound corners and circles) and four shadow declarations. Cards, fields,
buttons, sticky controls, and modals mixed 6–20 px radii with pill geometry.

10.10 establishes:

- control radius: 7 px
- card radius: 10 px
- modal radius: 12 px
- pill radius: 999 px, reserved for status/tag forms
- sticky elevation: `0 8px 24px rgba(0,0,0,.28)`
- modal elevation: `0 20px 60px rgba(0,0,0,.58)`

Cards and ordinary controls carry no shadow. Sticky bars/header and modal
overlays are the only elevated layers. The audit also found 128 inline-style
attributes in accepted runtime HTML/JS. Repeated critical-panel, action-stack,
field-label, field-row, and icon-label presentation moved to shared classes;
behavioral handlers and genuinely local layout styles remain inline.

### Emoji and UI glyphs

A deterministic scan of accepted `index.html` plus all 22 runtime scripts found
315 emoji or emoji-like UI glyph source instances. It covers literal extended
pictographs, emoji-producing numeric entities, Unicode escapes, and explicit
check/warning/X glyphs. Structural arrows are not counted or banned.

| Source class | Findings | Treatment |
| --- | ---: | --- |
| Editable normal-UI presentation sources | 220 | Replaced with local SVG icons or clear text-only semantic copy. |
| Intentional AI Export payload text | 3 | Accepted calendar heading and progression warning labels remain exact; the static test exempts only these named output locations. |
| Protected `data/02-program-data.js` | 47 | File remains byte-identical. Its legacy Habit/recommendation icon values are ignored by current renderers and mapped to local SVG. |
| Protected `sync/12-ai-sync.js` | 45 | File remains byte-identical and the sole `applySync`. A presentation observer adapts only exact known application-owned status prefixes in `syncResult`. |

Three legacy check glyph defaults remain inside the Habit storage
normalization path to preserve stored-definition compatibility. They are
explicit static-test exceptions and are never rendered. User notes, imported
text, raw debug data, and AI Export payload Unicode are not rewritten. The
core-Sync adapter has no general pictographic matcher, preserves the raw-input
tail without inspection, and leaves pictographs inside user/AI reason text
unchanged after adapting an exact application-owned line prefix.

### Selector and behavior risk

The accepted runtime contains 616 selector/order-sensitive touchpoints across
ID lookups, query selectors, class toggles, child access, and text checks.
Accordingly, 10.10 preserves:

- every existing ID and inline handler
- tab roles, `aria-selected`, `aria-controls`, and current keyboard routing
- disclosure, modal, and `aria-expanded` behavior
- the five primary routes and four internal Tools routes
- all 22 classic deferred scripts in their accepted order

Markup changes are content-level icon substitutions plus presentation classes;
they do not restructure route ownership or data entry workflows.

## Production tokens

The canonical 10.10 values are:

```css
--app-bg: #090b09;
--surface-base: #121511;
--surface-raised: #181c17;
--surface-interactive: #20251f;
--border-subtle: #2d332c;
--divider-strong: #3a4238;
--text-primary: #f3f5ef;
--text-secondary: #c7cdc2;
--text-muted: #969f91;
--text-disabled: #687066;
--brand: #b7f34a;
--brand-strong: #a8ff3e;
--brand-contrast: #11150c;
--success: #55d37a;
--warning: #f2bf55;
--error: #ff6174;
--info: #80b5f4;
```

`#b7f34a` was selected over the brighter alternative for a controlled athletic
look while retaining strong contrast as text on charcoal and with
`#11150c` text on lime controls.

## Icon architecture

`index.html` owns one local SVG symbol sprite. `features/13-shared-ui.js` owns
the reusable DOM/markup helpers. All icons use `currentColor`, one stroke
language, four standardized sizes, no network request, and no runtime file or
dependency. Decorative icons are `aria-hidden`; icon-only controls keep an
explicit accessible label and at least a 44 px target where applicable.

`tests/marcusfit-10.10.0-visual-system.test.js` fails on unapproved UI glyphs,
duplicate symbol IDs, unresolved static/dynamic icon references, missing
decorative accessibility treatment, changed protected exception counts, or a
return to direct stored-Habit icon rendering. It also locks the near-white /
lime wordmark split, hashes the accepted 10.9 daily-log and progression-export
formatters, and exercises the bounded core-Sync adapter against known owned
statuses, arbitrary emoji-bearing text, owned messages with emoji-bearing
reasons, and raw imported content.

## Browser evidence

Local Chromium QA on 2026-09-13 exercised all five primary screens at 320,
390, 480, and 1024 px with Compact, Standard, Large, and Extra Large text (80
primary-screen combinations). A focused narrow pass also exercised all four
Tools sub-tabs and expanded Basketball at 320 px / Extra Large. There was no
document overflow, rendered runtime-owned emoji, missing SVG target, zero-size
visible icon, or console warning/error. A narrow Daily Log header correction
keeps titles intact, truncates closed status badges, and removes the redundant
badge while a section is open. Real-iPhone Safari/Home Screen QA remains an
acceptance gate.

The focused review-correction smoke repeated all five primary screens at 320
and 390 px with Standard and Extra Large text. Computed wordmark colors were
`rgb(243, 245, 239)` for `MARCUS` and `rgb(183, 243, 74)` for `FIT`. A known
empty-array core-Sync status rendered without its owned glyph, while the raw
imported text `User note 😀 stays intact` remained exact in `syncResult`.
There were no overflow, icon-resolution, or console failures.
