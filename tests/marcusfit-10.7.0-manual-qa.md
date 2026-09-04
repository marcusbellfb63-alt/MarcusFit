# MarcusFit 10.7.0 manual QA

Use a localhost HTTP server, a desktop browser, and real iPhone Safari/home-screen mode. Back up real data first. This candidate must remain unmerged until Marcus explicitly accepts it.

## Startup and primary navigation

- Confirm the shell visibly reports 10.7.0 and starts without console errors.
- Visit Program, Daily Log, History, Stats, and Tools at compact, standard, large, and extra-large text sizes; confirm Tools fits without overflow and still opens the internal AI Sync page.
- On a fresh load, confirm Vitals, Habits, Workout, Basketball, Notes, and every other Daily Log disclosure starts collapsed. Open one manually, visit another primary tab, return, and confirm it remains open. Confirm selecting/editing a workout and starting/editing Basketball still opens the required section.
- At 320 px, approximately 390 px, and 480 px, confirm the mobile Save Day bar appears only on Daily Log, returns when revisiting Daily Log, and is absent from Program, History, Stats, and Tools without reserving space or covering AI Sync's Apply Update button.
- On long pages, confirm the five tabs stay visible, content does not cover them, and scrolled targets are not hidden below the header.
- Scroll each tab down, leave it, and confirm every tap, keyboard selection, and successful swipe into Program, Daily Log, History, Stats, or Tools opens at the top rather than restoring a prior offset.
- On both tablists, verify ArrowLeft/ArrowRight (including wrapping) and Home/End activate and focus the expected tab; verify Enter and Space still activate the focused native button.
- Confirm Basketball History/Edit flows still open the intended primary screen and target.

## Swipe safety

- Swipe left/right through every adjacent primary pair and confirm boundaries do nothing.
- Confirm short, slow, diagonal/vertical, multi-touch, and outer-edge gestures do not navigate.
- Confirm touching, selecting, editing, or swiping inside workout fields never changes the primary tab, including while the iPhone keyboard is open. Also confirm gestures on buttons, links, sliders, labels, details, horizontally scrolling content, Sync navigation, dialogs, onboarding, proposal reviews, Habit Manager, and Basketball courtside do not navigate.
- Confirm swipes never save, apply, dismiss, advance, delete, alter browser history, or write storage.

## Sync information architecture

- Open AI Sync, Personalize, Profile, and Data at narrow-phone, iPhone-like, 480 px, and desktop widths with no horizontal overflow or clipped controls.
- Confirm AI Sync is the first-visit default and later selection remains in memory only.
- Scroll down on each internal page and confirm every successful tap or keyboard change to AI Sync, Personalize, Profile, or Data returns the Sync screen to the top.
- Confirm Program/Habit/Basketball pending proposals show the Personalize Review badge without pulling the user off another page.
- For a pending Habit proposal, confirm the static control says Review Pending Habit Proposal and the review shows Dismiss Proposal plus its history-safety explanation. Confirm the first click asks for confirmation and the second records rejected, immediately removes the Review badge, refreshes the summary, and leaves definitions/history unchanged. Confirm applied-with-Undo is reviewable and rejected, undone, and absent states show a disabled No Pending Habit Proposal control rather than a dead action.
- Open Profile reset, Backup restore, and Clear Data confirmations; confirm another internal page is refused and focus/scroll returns to the confirmation. Cancel each safely.
- Confirm settings-section deep links route to the correct internal page.
- Exercise export generation/copy, invalid Sync, and valid core-only, Habit-only, Basketball-only, and mixed fixtures. Confirm accepted review/apply/stale/undo behavior.
- Preview a non-production backup and cancel restore. Do not destructively restore or clear real production data during candidate QA.

## Stats

- Exercise 7, 30, 90, and All ranges with empty, sparse, representative, and malformed records.
- Confirm calendar boundaries, prior-window comparisons, all-time labels, averages, and sample counts.
- Confirm Training Load distinguishes lifting, lower body, cardio, Basketball, Basketball minutes, and work sets without tonnage.
- Confirm today's saved workout appears by stable exercise ID; weight-only sets do not become rep progression.
- Confirm assistance, bodyweight, and duration semantics; archived/same-name different-ID exercises are not merged as active work.
- Confirm scheduled Habit denominators ignore non-due blanks and respect weekly counts and activation/archive dates.
- Confirm All history includes eligible Habit evidence older than 30 days while the 30-day range excludes it; a legacy-inferred Habit with no evidence must remain neutral.
- Confirm recurring medication stays separate and occurrence-based.
- Confirm Basketball range totals, neutral skips, and program/version/session/drill/mode trend identity.
- Confirm Action Summary has at most three evidence-based observations and makes no causal, injury, recovery, calorie, or automatic-program claim.

## Regression sanity

- History filters/search, Daily Log sliders/inputs, workout logging/review/save, Basketball courtside skip/complete/review/save, proposal overlays, and Habit Manager.
- Confirm no horizontal overflow, hidden controls, console errors, unexpected warnings, storage/schema additions, or historical rewrites.

## Real-iPhone workout keyboard

- On real iPhone Safari and home-screen mode, confirm reps/count opens an integer keypad and every weight/load field opens a decimal-capable keypad by default, including a field prefilled with nonnumeric text.
- Confirm duration entry accepts decimals where supported, RIR choices remain usable, and deletion/correction works without value normalization. Use the load field's `ABC`/`123` control to switch between text and decimal keyboards and confirm focus returns to the same field.
- Move between sets and verify the keyboard does not cover the active input, cause a layout jump, or trigger an accidental primary-tab swipe.
- Exercise assistance, bodyweight, and duration rows. Confirm supported nonnumeric load text (including bands, bodyweight, assistance, ranges, and unit-bearing values) can still be entered exactly and saved unchanged.
- Dismiss the keyboard by the available platform controls and confirm focus, sticky-header layout, safe areas, and the current primary tab remain correct.

The targeted real-iPhone recheck remains required for the actual Weight decimal keyboard, `ABC`/`123` switching, keyboard viewport behavior, safe-area bottom behavior, Save Day visibility by tab, and the Tools label at installed/home-screen width.
