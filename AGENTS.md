# Agent Guidelines for crispy-native

This document provides essential information for AI agents working on the `crispy-native` repository.

## Project Overview
- **Framework**: React Native (Expo SDK 54)
- **Language**: TypeScript
- **Navigation**: Expo Router (File-based routing in `src/app`)
- **State Management**: Zustand, React Query
- **Styling**: StyleSheet (primary), NativeWind (configured but less used)

## Build & Test Commands

### Development
- **Start Server**: `npm run start` (Starts Expo Go)
- **Run Android**: `npm run android`
- **Run iOS**: `npm run ios`
- **Lint Code**: `npm run lint`

### Testing
*Note: No testing framework (Jest/Vitest) is currently configured in `package.json`.*
- If asked to run tests, inform the user that testing is not set up and suggest installing Jest/React Testing Library if appropriate.

## Code Style & Conventions

### File Organization
- **Routes**: `src/app` (Expo Router structure).
- **Features**: `src/features/<feature-name>` (contain components, hooks, specific to a feature).
- **Shared UI**: `components/` (kebab-case filenames).
- **Core**: `src/core` (Services, Contexts, Stores).
- **Hooks**: `src/hooks` (General purpose hooks).

### Naming Conventions
- **Components**: PascalCase (e.g., `HomeHeader.tsx`, `HeroCarousel.tsx`).
- **Shared UI Files**: kebab-case (e.g., `themed-text.tsx`).
- **Hooks**: camelCase (e.g., `useCatalogPreferences.ts`).
- **Classes/Services**: PascalCase (e.g., `SyncService.ts`).
- **Interfaces/Types**: PascalCase.

### TypeScript
- **Strictness**: `strict: true` is enabled.
- **Props**: Use `interface` for component props (e.g., `interface HomeHeaderProps { ... }`).
- **Exports**: Export types/interfaces alongside their consuming components.
- **Imports**: 
  - Use path aliases `@/*` (maps to project root) where possible (e.g., `import { ... } from '@/src/core/...'`).
  - Order: External libraries -> Internal absolute imports (`@/...`) -> Relative imports -> Styles/Assets.

### Styling
- **Primary Method**: `StyleSheet.create` is the dominant pattern in existing components.
- **NativeWind**: Configured (`tailwind.config.js` exists), but prefer `StyleSheet` for consistency unless refactoring to Tailwind is explicitly requested.
- **Theming**: Use `useThemeColor` or `ThemeContext` for dynamic light/dark mode support.

### State & Data Fetching
- **Global State**: Use **Zustand** stores (`src/core/stores`).
- **Async State**: Use **React Query** (`@tanstack/react-query`) for API calls.
- **Context**: Use React Context for application-wide providers (Auth, Theme).

### Error Handling
- Use `try/catch` blocks for async operations, especially within Services.
- Handle loading/error states in UI components (e.g., `if (loading) return <Loading />`).

## Best Practices
1. **Layout**: Use `Stack` from `expo-router` for navigation layouts.
2. **Performance**: Use `memo` for list items or expensive components (e.g., `export const HomeHeader = memo(HomeHeaderComponent)`).
3. **Images**: Use `expo-image` for optimized image loading.
4. **Icons**: Use `@expo/vector-icons` or `lucide-react-native`.
