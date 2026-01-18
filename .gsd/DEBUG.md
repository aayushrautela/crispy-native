# Debug Session: JVM Target Mismatch

## Symptom
Build fails with `Inconsistent JVM-target compatibility` error in `:pchmn-expo-material3-theme`.

## Resolution

**Root Cause:**
- Third-party modules (like `expo-material3-theme`) do not strictly enforce JVM 21, inheriting project defaults.
- The project defaults were drifting between Java 17 and Kotlin 21 due to environment tooling.

**Fix:**
Created a custom Expo Config Plugin `plugins/withJvm21.js` that injects:
```groovy
allprojects {
    afterEvaluate {
        if (project.hasProperty("android")) {
            android {
                compileOptions { sourceCompatibility 21; targetCompatibility 21 }
                kotlinOptions { jvmTarget = "21" }
            }
        }
    }
}
```
This forces **every** module to comply with JVM 21.

**Verified:** Plugin added to `app.json`.
