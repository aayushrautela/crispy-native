# Debug Session: Meta Dynamic Colors

## Symptom
Dynamic color extraction from the backdrop image is not triggering or applying to the UI in `MetaDetailsScreen`.

**When:** Navigating to the Media Details page.
**Expected:** `[MetaColors]` logs should appear in the terminal, and the UI (background, buttons) should update to match the backdrop palette.
**Actual:** No `[MetaColors]` logs appear. Standard meta logs from `TMDBService` are visible, but the dynamic colors are absent.

## Evidence
- Logs provided by user:
  - `LOG [useCatalog] manifests: {}`
  - `LOG [TMDBService] Resolved meta for tt3402138...`
- Observation: `backdropUrl` is used in `useEffect` BEFORE it is defined in the file.

## Attempts

### Attempt 1
**Testing:** H1 — `backdropUrl` used before definition.
**Action:** Move `backdropUrl` definition above the `useEffect` that uses it. Add extra logs to trace execution.
**Result:** Code refactored and logging improved.
**Conclusion:** POTENTIALLY FIXED (Waiting for user log confirmation).

## Resolution (Pending)
**Root Cause:** Variable used before definition in a `useEffect` closure/body.
**Fix:** Corrected declaration order and improved robust logging.
**Verified:** Ready for user to check logs for `[MetaColors]`.
