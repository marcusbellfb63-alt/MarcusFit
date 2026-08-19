# Implemented 10.1.2 module plan

The 10.1.1 proposal is implemented as a 22-file classic-script runtime. The
phase is behavior-preserving and is not accepted until Marcus completes manual
QA. Runtime version, title, and visible labels remain 10.1.0.

## Results

- Five coarse files became 22 ordered feature/system files.
- Maximum file size fell from 5,224 to 1,808 physical lines.
- Total runtime lines remain 14,275.
- The old five files were removed; there are no compatibility shells.
- The ordered legacy runtime recomposes byte-equivalently except for the
  already accepted 10.1.0 version substitution; basketball is byte-identical.

## Intentional deviations from the proposed 21-file tree

1. Final count is 22. Shared UI/load listeners are a separate 159-line file so
   History and Stats remain narrow and boot timing is auditable.
2. Runtime state, coaching preferences, and profile share file 04. They are a
   compact 407-line pre-onboarding state boundary and retain live bindings.
3. Backup/restore and compatibility diagnostics share file 16. The debug block
   immediately follows backup in accepted source and reads the full recovery
   surface; separating it would add another file without reducing the largest
   dependency set.
4. Progression remains two ordered files: base semantics in 09 and accepted
   9.5.9 corrections in 18. File 18 captures workout/review/export functions
   defined between them. Consolidating them would require reordering evaluation,
   which is outside a behavior-preserving extraction.
5. Boot is file 21 and basketball is file 22. Accepted 10.1.0 synchronously boots
   the base app before basketball captures final functions and initializes; the
   implemented order preserves that behavior.

## Deferred

ES modules, loaders, npm, TypeScript, bundlers, frameworks, handler migration,
CSS splitting, schema/key changes, wrapper redesign, progression cleanup, and
feature changes remain out of scope.
