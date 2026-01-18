# Phase 1 Execution Plan: Foundation & Identity

## Goal
Establish the core technical foundation including a high-performance theme engine (M3 Expressive + AMOLED), a secure yet flexible authentication flow (Supabase + Guest Mode), and a fluid navigation structure optimized for different form factors.

## Proposed Changes

### [Component] Theme Engine (M3 Expressive)
- **[MODIFY] [storage.ts](file:///home/aayush/Downloads/crispy-android/crispy-native/src/core/storage.ts)**: Ensure `crispy-amoled-mode` and `crispy-accent-color` are correctly typed and accessible globally.
- **[MODIFY] [userStore.ts](file:///home/aayush/Downloads/crispy-android/crispy-native/src/core/stores/userStore.ts)**: Ensure defaults for `amoledMode` and `accentColor` align with the new design.
- **[NEW] [ThemeContext.tsx](file:///home/aayush/Downloads/crispy-android/crispy-native/src/core/ThemeContext.tsx)**: Create a unified provider that:
    - Uses `@pchmn/expo-material3-theme` for dynamic colors.
    - Implements an `AMOLED_BLACK` override.
    - Provides "Crispy" override palettes.
    - Exports a consistent `Theme` object for components.

### [Component] Navigation & Authentication
- **[DELETE] [app/](file:///home/aayush/Downloads/crispy-android/crispy-native/app)**: Refactor current `app/` structure to support groups.
- **[NEW] [app/(auth)/login.tsx](file:///home/aayush/Downloads/crispy-android/crispy-native/app/(auth)/login.tsx)**: Implementation of Supabase login.
- **[NEW] [app/(tabs)/_layout.tsx](file:///home/aayush/Downloads/crispy-android/crispy-native/app/(tabs)/_layout.tsx)**: Adaptive layout (Bottom tabs for mobile, Side rail for tablet).
- **[MODIFY] [app/_layout.tsx](file:///home/aayush/Downloads/crispy-android/crispy-native/app/_layout.tsx)**: 
    - Wrap with `ThemeProvider`.
    - Implement root navigation guard (Redirect to `/login` on TV if no session; allow guest on mobile).

### [Component] Design System (Atoms)
- **[NEW] [src/cdk/components/ExpressiveButton.tsx](file:///home/aayush/Downloads/crispy-android/crispy-native/src/cdk/components/ExpressiveButton.tsx)**: Focus-aware button with M3 Expressive shapes.
- **[NEW] [src/cdk/components/ExpressiveSurface.tsx](file:///home/aayush/Downloads/crispy-android/crispy-native/src/cdk/components/ExpressiveSurface.tsx)**: Card/Surface component with expressive rounding.
- **[MODIFY] [src/styles/global.css](file:///home/aayush/Downloads/crispy-android/crispy-native/src/styles/global.css)**: Add custom tailwind utilities for the expressive shape scale (e.g., `rounded-m3-xl`).

## Verification Plan

### Automated Tests
- No unit tests in Phase 1; focus on qualitative manual verification of the design system.

### Manual Verification
1. **Theme Toggle**: 
    - Command: `npx expo start`
    - Step: Toggle "AMOLED Mode" in a test screen.
    - Result: Background changes to `#000000`.
2. **Dynamic Colors**:
    - Step: Change Android system wallpaper (in emulator).
    - Result: App accent colors update automatically (if system colors enabled).
3. **Guest Mode Guard**:
    - Step: Launch app on "Phone" simulator without logging in.
    - Result: App navigates to `(tabs)/index.tsx`.
4. **TV Login Requirement**:
    - Step: Mock device as "Android TV" (via Constants).
    - Result: App redirects to `(auth)/login.tsx` on boot if no session.
5. **D-Pad Navigation**:
    - Step: Use keyboard arrows in emulator.
    - Result: `ExpressiveButton` shows clear "Focused" state.
