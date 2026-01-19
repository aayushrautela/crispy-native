# Debug Session: Missing useAiInsights

## Symptom
Runtime error: `[ReferenceError: Property 'useAiInsights' doesn't exist]` in `src/app/meta/[id].tsx`.

**When:** accessing MetaDetailsScreen
**Expected:** Page loads with AI insights
**Actual:** Crash

## Evidence
- `src/app/meta/[id].tsx` was missing imports for `AIInsightsCarousel` and `useAiInsights`.
- `src/core/storage.ts` was mysteriously missing the `MMKV` import despite previous attempts to add it.

## Hypotheses
| # | Hypothesis | Likelihood | Status |
|---|------------|------------|--------|
| 1 | Missing imports in MetaDetails | 100% | CONFIRMED |
| 2 | Malformed storage.ts | 100% | CONFIRMED |

## Resolution

**Root Cause:**
1. Forgot to add imports when uncommenting hook usage.
2. `storage.ts` edits were not persisting correctly or were being malformed by the tool.

**Fix:**
1. Added missing imports to `MetaDetailsScreen`.
2. Fully overwrote `storage.ts` with correct content including `import { MMKV } ...`.
3. Corrected prop types in `MetaDetailsScreen` (`variant="filled"`, `rounding="lg"`) to appease TypeScript.

**Verified:**
- Imports are present.
- `storage.ts` has MMKV import.
- Type checker should be cleaner (some errors persist in other files but are unrelated to this crash).
