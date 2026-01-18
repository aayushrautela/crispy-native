# Debug Session: Gradle `afterEvaluate` Error

## Symptom
Build failed with `Cannot run Project.afterEvaluate(Closure) when the project is already evaluated`.

## Resolution

**Root Cause:**
- `allprojects { afterEvaluate { ... } }` attempted to add a hook to a project (likely the root project or an already-configured subproject) that had finished evaluation.
- `withJvm21.js` appends to `android/build.gradle` (root), which is evaluated last.

**Fix:**
- Switched to `subprojects` (skipping the root project).
- Added a check: `if (project.state.executed) { configure() } else { afterEvaluate { configure() } }`.
- This ensures the configuration is applied regardless of the project's current lifecycle state.

**Verified:** Code robustly handles both states.
