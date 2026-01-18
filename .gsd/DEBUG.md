# Debug Session: Missing `kotlinOptions` Method

## Symptom
Build fails with `Could not find method kotlinOptions() ... on extension 'android'`.

## Resolution

**Root Cause:**
- Pure Java modules (like `react-native-worklets`) do not have the `kotlinOptions` extension added to their `android` block.
- The global Config Plugin was trying to call it blindly on every project with an `android` extension.

**Fix:**
- Updated `plugins/withJvm21.js` to check for property existence before calling:
```groovy
if (project.android.hasProperty('kotlinOptions')) {
    project.android.kotlinOptions {
        jvmTarget = "21"
    }
}
```

**Verified:** Logic prevents calling non-existent methods on Java-only modules.
