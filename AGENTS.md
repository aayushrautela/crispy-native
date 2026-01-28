# Agent Guidelines for crispy-native

This file is for agentic coding tools operating in this repository. Prefer repo conventions over generic React Native advice.

## Project Overview
- Framework: React Native (Expo SDK 54), New Architecture enabled
- Language: TypeScript (`strict: true`)
- Navigation: Expo Router (file-based routing in `src/app`, typed routes enabled)
- State: Zustand for global state, React Query for async/server state
- Styling: Mixed `StyleSheet` + NativeWind (`className`) where already used

## Agent Rules Files
- Cursor rules: none found (`.cursor/rules/`, `.cursorrules`)
- Copilot instructions: none found (`.github/copilot-instructions.md`)

## Commands

### Install
- `npm install`

### Run (Development)
- Start Metro/Expo dev server: `npm run start` (same as `npx expo start`)
- Start for web: `npm run web`
- Start with cache reset (useful when Metro is stuck): `npx expo start -c`

### Native (Dev Client)
- Android: `npm run android` (runs `expo run:android`)
- iOS: `npm run ios` (runs `expo run:ios`)

### Lint
- `npm run lint` (Expo ESLint via `expo lint`; config in `eslint.config.js`)

### Typecheck
- No dedicated script; use: `npx tsc -p tsconfig.json --noEmit`

### Builds (EAS)
- Profiles are defined in `eas.json`: `development`, `preview`, `production`
- Examples (requires EAS auth/config):
  - `eas build -p android --profile development`
  - `eas build -p ios --profile preview`

### Reset Starter Template
- `npm run reset-project`

### Tests
- No test runner is currently configured (no Jest/Vitest scripts/config found).
- If you add tests later, document them here and add `npm run test`.

#### Running A Single Test (when tests are added)
- Jest (common for Expo): `npx jest path/to/file.test.ts` or `npx jest -t "test name"`
- Vitest: `npx vitest run path/to/file.test.ts` or `npx vitest -t "test name"`

## Repo Layout
- Routes: `src/app/**` (Expo Router)
  - Route groups use parentheses, e.g. `src/app/(tabs)`, `src/app/(auth)`
  - Layouts live in `_layout.tsx` within the folder
  - Dynamic routes use brackets, e.g. `src/app/meta/[id].tsx`
- Core (shared app infra): `src/core/**`
  - Contexts: `src/core/*Context.tsx` (e.g. Theme/Auth/Discovery)
  - Stores: `src/core/stores/**` (Zustand)
  - Services: `src/core/services/**` (API, sync, enrichment)
  - UI primitives/layout: `src/core/ui/**`
- Features: `src/features/<feature>/**` (feature-local UI, hooks, context)
- Shared components (template-era): `components/**` (kebab-case)
- Styling helpers: `src/styles/global.css` (NativeWind utilities)
- Native module: `modules/crispy-native-core/**` (do not refactor casually)
- Patch system: `patches/**` + `postinstall: patch-package`

## Naming Conventions
- Routes: match Expo Router conventions (folders like `(tabs)`, screens like `settings/appearance.tsx`, dynamic routes like `meta/[id].tsx`).
- Components: `PascalCase` filenames and exports (common in `src/**` and `src/features/**`).
- Template-era shared components: `components/**` uses kebab-case filenames (keep this pattern there).
- Hooks: `useSomething` (camelCase) and live near the feature or in `src/core/hooks/**` / `src/hooks/**`.
- Types/interfaces: `PascalCase`; prefer `type` for unions and `interface` for object shapes/props.

## Imports
- Path alias: `@/*` maps to repository root (see `tsconfig.json` + `babel.config.js`).
  - Common pattern inside `src/**`: `@/src/...`
  - Template components/hooks may use `@/components/...` and `@/hooks/...`
- Import order (keep consistent within a file):
  - External packages
  - Absolute internal (`@/...`)
  - Relative (`../` / `./`)
  - Side-effect imports (e.g. `'react-native-reanimated'`, CSS)
- Avoid large-scale import rewrites; do not reformat a whole file just to “clean up”.

## Formatting
- There is no Prettier configuration in the repo; formatting varies by area.
- Preserve the existing style/indentation of the file you touch.
- Prefer small, localized diffs; avoid sweeping whitespace-only changes.

## TypeScript Guidelines
- Keep `strict`-friendly types: avoid `any`; prefer `unknown` + narrowing.
- Props: use `interface` for component props; export types only when reused.
- Domain models: define explicit interfaces (see services like `TMDBService`).
- Unions: use string unions for finite options (e.g. `'movie' | 'series'`).
- Type assertions (`as any`) are allowed only as a last resort; add a short note nearby.
- Prefer returning typed fallbacks over throwing in UI-facing helpers (`[]`/`null`/`{}`), but re-throw in services when callers must handle it.

## React / React Native
- Prefer function components and hooks.
- Performance-sensitive lists: use `memo` for row items; watch `renderItem` closures.
- Avoid creating new inline objects/functions in hot render paths unless memoized.
- Reanimated/Gesture Handler:
  - Keep `'react-native-reanimated'` side-effect import intact where present.
  - Ensure root is wrapped in `GestureHandlerRootView` (see `src/app/_layout.tsx`).

## Styling & Theming
- Theming is handled in two places:
  - Template theming: `hooks/use-theme-color.ts` + `constants/theme`
  - App theming: `src/core/ThemeContext.tsx` (used heavily in `src/**`)
- Follow the local pattern:
  - If a component uses `StyleSheet.create`, continue with it.
  - If a component uses `className`, use `cn(...)` from `src/lib/utils.ts`.
- Fonts are loaded in `src/app/_layout.tsx` (GoogleSans + Nunito); avoid introducing new font families casually.

## Data / Network
- Prefer the existing pattern in the area you touch:
  - Some services use `axios` (e.g. `TMDBService`), others use `fetch` (e.g. `TraktService`).
  - Don’t mix clients within the same module unless there’s a clear reason.
- Keep API keys in env (`EXPO_PUBLIC_*`) and never hardcode credentials.

## State, Data Fetching, and Storage
- React Query: use for networked async state; keep query keys stable.
- Zustand: use `src/core/stores/**` for persisted user settings and app preferences.
- Storage:
  - MMKV wrapper is `src/core/storage.ts` (`StorageService.getUser/getGlobal/...`).
  - Keys are namespaced per active user; be careful changing key names.

## Error Handling & Logging
- Services should wrap network calls in `try/catch` and log with a clear tag (e.g. `[TraktService]`).
- Re-throw errors when callers need to handle them; otherwise return a safe default (`null` / `[]` / `{}`) consistently.
- Avoid swallowing exceptions with empty `catch {}` unless there is a clear fallback.
- Never log secrets (Supabase keys, tokens, `.env` contents).

## Repo Hygiene
- Do not edit `node_modules/`.
- Avoid editing `android/` and `ios/` unless the task explicitly requires native changes.
- If you must change dependency behavior, prefer adding/updating a `patches/*.patch` entry and keep changes minimal.

## Environment / Secrets
- Local env lives in `.env` (gitignored). Use `.env.example` as reference.
- Public Expo env vars use the `EXPO_PUBLIC_` prefix (e.g. `EXPO_PUBLIC_TMDB_API_KEY`).

## Editing Native Projects
- `android/` and `ios/` exist but are typically generated by Expo prebuild and are gitignored upstream.
- Prefer configuring via `app.json`, config plugins, or Expo APIs; only edit native code when explicitly required.
