## 2026-01-18: Reference Mapping

- **Action**: Added `Crispy-webui` and legacy Android `app` to the knowledge base.
- **Rationale**: User requested access to UI and legacy logic for development reference.
- **Details**: 
  - `Crispy-webui` mapped at `../Crispy-webui` (Vite, React 19, Tailwind 4).
  - Legacy Android mapped at `../app` (Kotlin, jlibtorrent, NanoHTTPD).
  - Updated `STACK.md` and `ARCHITECTURE.md` with these details.

## 2026-01-18: GitHub Workflow Repair

- **Action**: Modernized `android-build.yml`.
- **Rationale**: Needed a reliable way to compile Android APKs in CI as local resources are limited.
- **Details**:
  - Enforced JDK 21 and Gradle 9.1.0.
  - Switched to `assembleDebug` for guaranteed APK generation without release secrets.
  - Added robust caching via `setup-gradle` action.

## 2026-01-18: Phase 2 Completion & Architecture Refinement

- **Action**: Finalized Addon Engine and Provider Layer.
- **Rationale**: Core infrastructure for content discovery and torrent streaming is now in place.
- **Details**:
  - Implemented `crispy-native-core` module for torrent streaming.
  - Built `AddonService` and `ProviderStore` for Stremio addon integration.
  - **Key Change**: Based on user feedback, removed the "Direct-then-Proxy" logic. Realized that since we are running in a pure React Native environment, browser-level CORS restrictions are non-existent for native fetches. This simplified the `CrispyServer` to a pure streaming engine and `AddonService` to standard direct fetches.
- **Decision**: Keep the local server purely for torrent piece serving (required for MPV playback) but stop using it as an API proxy.

## 2026-01-20

### AI Insights & Settings Integration
- **Action**: Integrated user-configurable AI insights and OpenRouter key management.
- **Rationale**: Allow users to use their own AI keys and models for personalized meta insights.
- **Details**:
    - Aligned `useAiInsights` prompt and logic with the WebUI implementation.
    - Updated `UserStore` and `SettingsScreen` with MD3 Expressive UI for AI configuration.
    - Enhanced `ExpressiveButton` with native loading indicators.


## Session: Player Stability & UI Refinement (2026-01-21)
### Summary
Focused on resolving widespread player instability and refining the bottom sheet interaction model.
### Decisions
- Standardized all timing to Double (Seconds) to eliminate unit conversion bugs.
- Implemented 'Loading' guards on 'onEnd' to prevent premature player closure during stream switching.
- Refactored Bottom Sheets to use `BottomSheetFlatList` and dynamic sizing for a native MD3 feel.
- Established a global 70% screen height limit for all bottom sheets to maintain visual balance.
### Outcome
Player is stable, seeking is reliable, and UI interactions (especially stream selection) feel fast and native.
