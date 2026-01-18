# Debug Session: Missing expo-screen-orientation

## Symptom
Bundling fails with: `Unable to resolve "expo-screen-orientation" from "src/app/player.tsx"`.

**When:** During app bundling after implementing Phase 4 Player.
**Expected:** App bundles successfully.
**Actual:** Module resolution failure for `expo-screen-orientation`.

## Evidence
- `src/app/player.tsx` uses `import * as ScreenOrientation from 'expo-screen-orientation'`.
- This package was never explicitly installed in `package.json`.

## Hypotheses

| # | Hypothesis | Likelihood | Status |
|---|------------|------------|--------|
| 1 | Package `expo-screen-orientation` is not in `package.json`. | 95% | UNTESTED |
| 2 | Metro cache is stale. | 5% | UNTESTED |

## Attempts

### Attempt 1
**Testing:** H1 — Dependency presence.
**Action:** Check `package.json`.
**Result:** Package was missing.
**Conclusion:** CONFIRMED.

## Resolution

**Root Cause:**
- `expo-screen-orientation` was required by `src/app/player.tsx` but not listed in `dependencies`.

**Fix:**
- Installed via `npx expo install expo-screen-orientation`.

**Verified:**
- `package.json` now includes `expo-screen-orientation: ~9.0.8`.
- Bundler should now resolve the module correctly.
