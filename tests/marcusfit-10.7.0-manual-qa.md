# MarcusFit 10.7.0 manual QA

Use a localhost HTTP server, a desktop browser, and real iPhone Safari/home-screen mode. Back up real data first. This candidate must remain unmerged until Marcus explicitly accepts it.

## Startup and primary navigation

- Confirm the shell visibly reports 10.7.0 and starts without console errors.
- Visit Program, Daily Log, History, Stats, and Sync at compact, standard, large, and extra-large text sizes.
- On long pages, confirm the five tabs stay visible, content does not cover them, and scrolled targets are not hidden below the header.
- Scroll each tab to a different offset, leave it, and confirm return restores that tab's offset; confirm first visits start at top.
- Confirm Basketball History/Edit flows still open the intended primary screen and target.

## Swipe safety

- Swipe left/right through every adjacent primary pair and confirm boundaries do nothing.
- Confirm short, slow, diagonal/vertical, multi-touch, and outer-edge gestures do not navigate.
- Confirm gestures on buttons, links, fields, sliders, labels, details, horizontally scrolling content, Sync navigation, dialogs, onboarding, proposal reviews, Habit Manager, and Basketball courtside do not navigate.
- Confirm swipes never save, apply, dismiss, advance, delete, alter browser history, or write storage.

## Sync information architecture

- Open AI Sync, Personalize, Profile, and Data at narrow-phone, iPhone-like, 480 px, and desktop widths with no horizontal overflow or clipped controls.
- Confirm AI Sync is the first-visit default and later selection remains in memory only.
- Confirm Program/Habit/Basketball pending proposals show the Personalize Review badge without pulling the user off another page.
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
- Confirm recurring medication stays separate and occurrence-based.
- Confirm Basketball range totals, neutral skips, and program/version/session/drill/mode trend identity.
- Confirm Action Summary has at most three evidence-based observations and makes no causal, injury, recovery, calorie, or automatic-program claim.

## Regression sanity

- History filters/search, Daily Log sliders/inputs, workout logging/review/save, Basketball courtside skip/complete/review/save, proposal overlays, and Habit Manager.
- Confirm no horizontal overflow, hidden controls, console errors, unexpected warnings, storage/schema additions, or historical rewrites.
- Real iPhone Safari remains the final safe-area, browser-edge gesture, zoom/text-size, keyboard, overlay, and home-screen acceptance gate.
