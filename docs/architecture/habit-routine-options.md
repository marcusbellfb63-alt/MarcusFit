# MarcusFit 10.12.2 Habit Routine Options — draft candidate

An existing daily Habit can offer mutually exclusive routines while retaining
one schedule, one completion flag, and its existing stable Habit ID. No additional
Habit definition or independent adherence obligation is created for an option.
This candidate has not been accepted or merged; real-iPhone Safari and installed
Home Screen/PWA QA remain required.

## Definition and proposal contract

`routineOptions` is an optional Habit definition field and an allowed `modify`
field. Add proposals may include it in `definition`. It is an empty array to
remove choices, or an array of 2–6 objects with only these properties:

| Property | Rule |
| --- | --- |
| `id` | Required, unique within the Habit; `/^[a-z][a-z0-9-]{0,39}$/`. Retain IDs when editing a routine. |
| `name` | Required nonblank string, at most 100 UTF-16 code units. |
| `target` | Required standard Habit target object, validated by the existing strict target validator. |
| `instructions` | Required array of at most 20 strings, each at most 400 UTF-16 code units. |
| `weeklyGoal` | Optional integer 1–14. Informational frequency goal only. |
| `avoidConsecutiveDays` | Optional boolean. Produces an adjacent-completion recovery reminder; does not prevent selection. |

The resolved parent schedule must be `{"type":"daily"}`. Validation checks the
merged definition, so omitting `schedule` preserves an existing daily schedule;
changing the schedule of a Habit that still has choices is rejected. Omitted
`routineOptions` preserves existing choices; `[]` removes them explicitly.
Unknown properties, completion data, non-object targets, string instruction
lists, duplicate routine IDs, and invalid limits are rejected before writes.

The existing schema-1 definition/proposal envelopes and storage keys remain.
This is an additive extension: old definitions and daily records remain readable,
with no eager migration. Older app versions do not support this proposal field;
import the example only into a version containing this feature.

## Daily selection and completion

The Daily Log presents a native labelled selector inside the existing Habit
card. Only the selected routine's instructions appear. Selecting a different
routine clears `completed` and the optional recorded value, retaining notes.
No completion is allowed for a new routine-based entry until a choice is made.
Selecting the current choice is a no-op. Recovery guidance never switches a
routine automatically and never blocks an Easy completion.

The existing `day-YYYY-MM-DD.habits[habitId]` entry gains optional `routineId`,
`routineName`, and `routineTarget` properties. The name and target are snapshots
so later edits/removal cannot relabel an explicitly recorded routine or its
units. Existing draft collection, form restoration, daily saves, and raw backup
strings retain these properties. No sibling Habit completion entry is created.

Historical entries without routine metadata remain valid completions and show
the parent name with “routine unspecified” while choices are configured. They
are never inferred to be Challenging or Easy. Import/apply/undo changes only
definitions/proposal storage; it never rewrites daily history.

## Calculations and export

The parent Habit remains one daily opportunity in the existing eligibility and
tracking-preference-aware adherence functions. A selected completed routine
counts once; the other options have no denominator and no missed status. A day
with no completion still leaves the single daily parent opportunity unmet.

Weekly guidance counts saved completed entries with an explicit matching
`routineId`, replacing the viewed date's saved state with the live form state
when shown in the Daily Log. Weeks run Sunday–Saturday. Adjacent-day reminders
check saved completions on either side of the viewed date. Guidance is separate
from adherence, does not penalize recovery choices, and does not infer legacy
routine sessions. AI Export includes the definitions, counts, and this boundary;
AI Sync cannot import selections or completion history.

## Example and validation

`docs/examples/hip-routine-options.sync.txt` modifies only the description,
parent instruction list, and routine options of `habit-mobility-reset`. It
preserves the stored ID, daily schedule, target, and completion history. Each
option has an independent concise 8–10-minute instruction list. Challenging
has an approximate three-session weekly goal and a nonconsecutive-day reminder.
The payload is also retained as `tests/fixtures/hip-routine-options.json`.

`tests/marcusfit-habit-routine-options.test.js` exercises the actual composite
importer, pending review, apply/undo, schema rejection, selector rendering,
draft collection/autosave, saved-day restoration, daily save, one-opportunity
adherence, legacy history, routine snapshots, manager draft/save, raw backup
validation, and read-only export. It verifies unrelated saved lifting and
Basketball data remain byte-identical.

The 10.x regression suites, architecture inventory, syntax checks, and
`git diff --check` are required. The representative export fixture adds 719
characters for the new contract, retaining its 366-line layout. The visual
contract assertion follows the new snapshot-aware Habit history helper.

In the managed environment, nested Node `spawnSync` returns `EPERM`. For the
three suites using subprocesses, their inventory/Basketball subcommands are run
against the same source in-process and real captured stdout is supplied to the
unchanged assertions through a temporary, untracked preloader. No test assertion
or runtime behavior is disabled. All 25 test files pass with this workaround.
Localhost Chromium QA at a 390 × 844 touch viewport verifies the proposal,
Challenging/Easy selection, switch clearing, focus, save/reload persistence,
one-opportunity adherence, and unrelated-store preservation. Safari and an
installed iPhone Home Screen app were not available and remain required before
acceptance.
