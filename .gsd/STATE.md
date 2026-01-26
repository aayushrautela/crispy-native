### Current Position
- **Phase**: Debugging Torrent Issues
- **Task**: Added verbose logging to native stack
- **Status**: IN_PROGRESS

### What was just accomplished
- **Native Logging**: Added detailed alert and session logging to `TorrentService.kt`.
- **Server Logging**: Added request and timeout-loop logging to `CrispyServer.kt`.
- **Bridge Logging**: Added call-level logging to `CrispyNativeCoreModule.kt`.
- **Goal**: Enable precise tracing via `adb logcat` to identify why torrenting is failing.

### Next Steps
- Capture and analyze `adb logcat` output during failure.
- Fix issues identified by the logs.
