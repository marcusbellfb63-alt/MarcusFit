# MarcusFit 10.1.0 basketball logging manual QA

Keep the pull request in draft until Marcus completes this checklist and
explicitly accepts the feature. Back up production data before using it on
localhost. Serve the repository over HTTP; never open `index.html` through
`file://`.

## Start

```powershell
python -m http.server 8000
```

Open `http://127.0.0.1:8000/` and confirm the title and visible Sync label show
10.1.0. Confirm there are no console errors.

## Clean state and logging

- Confirm Basketball appears in Daily Log without creating storage by itself.
- Open Basketball and verify its date matches the selected Daily Log date.
- Save a minimal Skills Practice session with only date, type, and minutes.
- Save a detailed Shooting session with dribbling, shooting, free throws, and
  notes. Save two sessions on one date.
- Confirm missing required fields, zero/negative minutes, makes above attempts,
  and free throws made above attempted all show readable validation errors.
- Rapidly tap Save and confirm only one record is created.
- Refresh and confirm every session remains.

## Manage records

- Expand a History basketball record and verify only supplied metrics appear.
- Start an edit, change a field, cancel, and confirm nothing changed.
- Save an edit and confirm the stable ID and original `createdAt` remain while
  `updatedAt` changes (inspect with `mfBasketballDebug()` plus a backup when
  needed).
- Start a delete, cancel, and confirm the record remains.
- Confirm a delete and verify only that basketball session disappears; lifting,
  daily logs, habits, program data, and proposals remain unchanged.

## History and Stats

- Confirm same-date sessions appear newest-first and are visually distinct from
  daily/lifting entries.
- Exercise the History date, search, notes, gym, and workout filters.
- Confirm Stats totals for sessions, minutes, average minutes, shooting, and
  free throws. Verify zero attempts never render `NaN`, `Infinity`, or a fake
  percentage.
- Confirm basketball does not increase lifting workouts, volume, streaks,
  progression, or habit adherence.

## Backup, export, and AI Sync isolation

- Create a backup and confirm its preview reports the basketball session count.
- Restore it, wait for reload, refresh again, and verify IDs, dates, metrics,
  notes, and timestamps survive.
- Restore an older backup without `mf-basketball-sessions`; confirm restore
  succeeds and basketball shows a clean zero state.
- Generate an export whose range contains sessions and verify a concise
  `BASKETBALL ACTIVITY` section. Generate Program Only or a range without
  sessions and confirm the section is omitted.
- Apply the existing valid AI Sync fixture and an invalid Sync payload. Confirm
  established behavior is unchanged and neither operation creates, edits, or
  deletes basketball sessions.

## Layout

- At representative phone and desktop widths, confirm no horizontal overflow,
  touch targets remain usable, optional fields are secondary, History cards and
  Stats cards remain readable, and the delete dialog is keyboard-usable.
- Recheck the existing Program, Daily Log, History, Stats, and Sync screens.
