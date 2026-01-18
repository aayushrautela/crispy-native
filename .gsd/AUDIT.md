# Audit: Phase 4 Technical Gaps

## Symptoms & Issues
1. **ReferenceError: Property 'Pressable' doesn't exist** in `[id].tsx:106`: Missing import.
2. **Missing Default Export** in `player.tsx`: File evaluation is likely crashing due to `ExpoScreenOrientation` missing.
3. **Native Module Linking**: `Cannot find native module 'ExpoScreenOrientation'` and `CrispyNativeCore` view manager warnings.
4. **UI Inconsistency**: Home, Search, and Discover do not match the expected `crispy-webui` mobile layout.
5. **MetaDetails (id.tsx) empty**: Likely due to the `ReferenceError` crashing the screen.

## Root Causes
- **Missing Imports**: Sloppy export/import management during rapid implementation.
- **Environment**: User is likely running an old binary/Expo Go that doesn't have the newly installed `expo-screen-orientation` or updated `CrispyNativeCore`.
- **UI Design**: Initial UI was "functional" but lacks the polish of the webui reference.

## Closure Strategy
| Issue | Priority | Fix Strategy |
|-------|----------|--------------|
| Syntax Errors (`Pressable`) | 🔴 High | Add missing imports to `[id].tsx`. |
| Evaluation Failure (`player.tsx`) | 🔴 High | Wrap `ScreenOrientation` in defensive checks or ensure default export is clean. |
| View Manager Warning | 🟡 Medium | Verify native name mapping in bridge. |
| UI Refinement (M3) | 🟡 Medium | Refactor Home/Discover/Search screens to match `crispy-webui` mobile aesthetics. |
