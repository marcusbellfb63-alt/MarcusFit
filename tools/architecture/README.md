# Runtime inventory scanner

Run from the repository root:

```text
node tools/architecture/inventory-runtime.js > runtime-inventory.json
```

The scanner is dependency-free and read-only. It reports the ordered production
scripts, line and byte counts, inline HTML event attributes, top-level
declarations, explicit `window.*` assignments, literal DOM ID lookups,
`localStorage` operation sites, listener registrations, and common wrapper
capture/reassignment patterns.

The JSON is supporting evidence, not a generated architectural conclusion. The
scanner uses regular expressions rather than a JavaScript or HTML parser. It can
miss dynamic property access, computed storage keys, multiline expressions,
indirect calls, aliases that do not use the recognized naming patterns, and DOM
references made through selectors or cached elements. It also cannot prove that
a symbol is top-level after considering every lexical construct, or that a
static call path executes at runtime. Human review of the source and tests is
required before changing module boundaries.
