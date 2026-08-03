# Global and inline-handler map

MarcusFit remains a classic-script application. Top-level `function`/`var`
declarations remain global-object properties and top-level `const`/`let`
declarations remain shared global lexical bindings.

## Accepted compatibility surface

| Contract | Before | After |
|---|---:|---:|
| Inline event attributes | 83 | 83 |
| Distinct referenced inline functions | 61 | 61 |
| Distinct explicit `window.*` names | 58 | 58 |
| Accepted public/cross-file compatibility names | 257 | 257 preserved |
| Explicit `window.*` assignment sites | 87 | 87 |

The scanner reports 313 raw public-or-cross-file candidates after extraction.
The additional 56 are not new APIs: they are existing top-level names that the
scanner now sees crossing a newly introduced file boundary. The accepted
257-name set is protected by source recomposition, explicit-window, inline
handler, and browser-load contracts.

## Required categories

- True public/debug APIs keep their existing `window.*` names and result shapes.
- All 61 inline-handler functions remain globally resolvable before interaction.
- Cross-file lexical bindings retain their names and ordered classic-script scope.
- `P`, `APP_VERSION`, mutable `tDate`, `showScreen`, `genExport`, `applySync`,
  `window._exp`, and `mfBasketballDebug` remain compatibility-critical.
- `window.__mfBasketballTest` remains Node-only and absent from normal browsers.

`index.html` retains the same 83 attributes. No inline handler was converted to
an event listener in this phase. The complete expressions remain in the HTML
and are reproducibly listed by `tools/architecture/inventory-runtime.js`.

## Wrapper order

- Export: base -> starter -> metric corrections -> adherence -> habits -> basketball.
- Stats calculation: base -> habits. Rendering: base -> adherence -> basketball.
- History: base -> habits -> basketball refresh/filter hook.
- Save: base -> habit-preserving shared-daily wrapper.
- Sync: base -> habit proposal interception; basketball remains absent.
- Backup: base predicate/summary/format/validation -> basketball.
