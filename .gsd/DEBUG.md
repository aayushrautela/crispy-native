# Debug Session: Compilation Errors in Native Core

## Symptom
Build failed with `Unresolved reference` errors for `TorrentStats` and `FileStats` classes and their properties in `CrispyServer.kt` and `TorrentService.kt`.

**When:** Compiling `crispy-native-core` during GitHub Actions build.
**Expected:** Successful compilation.
**Actual:**
```
e: .../CrispyServer.kt:101:38 Unresolved reference 'infoHash'.
e: .../TorrentService.kt:231:57 Unresolved reference 'TorrentStats'.
```

## Resolution

**Root Cause:** The `TorrentStats` and `FileStats` data classes were missing from `CrispyServer.kt` but were referenced as if they existed.
**Fix:** Added the missing data classes to `CrispyServer.kt` with the properties expected by the calling code.
```kotlin
data class TorrentStats(...)
data class FileStats(...)
```
**Verified:** Code review confirms property names (`streamProgress`, `streamLen`, etc.) match the consumption logic in `CrispyServer.kt` and instantiation logic in `TorrentService.kt`.
