### Current Position
- **Phase**: Phase 24: Addon Persistence Fix
- **Task**: Implementation
- **Status**: COMPLETED

### What was just accomplished
- **UserStore.ts**: Split destructive `reset()` from safe `reloadFromStorage()`.
- **_layout.tsx**: Switched session init to use `reloadFromStorage()`.
- **Bug Fix**: Custom addons will no longer be wiped on app restart.

### Next Steps
- Verify visual state in tablet landscape mode.
- Monitor for any further hook order warnings.
