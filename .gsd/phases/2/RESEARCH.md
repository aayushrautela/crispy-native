---
phase: 2
level: 1
researched_at: 2026-01-18
---

# Phase 2 Research: Testing Strategy

## Questions Investigated
1. How to verify the `AddonService` logic without making real network calls?
2. How to test Zustand store persistence with MMKV?
3. What is the best way to verify the `DiscoveryContext` orchestration?

## Findings

### 1. Mocking Stremio Addons
Since addons are external HTTP services following the Stremio protocol, we should use **Jest** and `jest-mock-axios` (or `msw` for more complex scenarios).

**Recommendation:**
- Create a `mocker/addons.ts` file that provides valid Stremio Manifest and Catalog JSON responses.
- Use `axios` interceptors or Jest mocks to return these when `AddonService` is called.

### 2. Testing Store Persistence
The `addonStore` uses `zustand/middleware` with `persist`. 
**Decision:**
- Mock the `StorageService` to verify that `setItem` is called when an addon is added.
- Verify that `getItem` is called during store initialization to hydrate the state.

### 3. Verification Commands
The following verification methods are recommended for Phase 2:
- **Unit Tests**: `src/core/api/AddonService.test.ts`
- **Unit Tests**: `src/core/stores/addonStore.test.ts`
- **Manual Proof**: Logging the `manifests` object from `useAddonStore` in a debug screen.

## Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Testing Library | Jest + RNTL | Standard and robust for React Native. |
| Network Mocking | axios-mock-adapter | Lightweight and fits the current `axios` implementation. |
| Persistence Mock | Mock `StorageService` | Easiest way to verify MMKV interaction without native dependencies. |

## Patterns to Follow
- **Behavior-Driven Tests**: Test what the user does (Add URL) rather than implementation details.
- **Data Validation**: Ensure the `AddonManifest` interface is strictly followed after fetching.

## Anti-Patterns to Avoid
- **Real Network Calls**: Avoid hitting real `baby-beamup.club` or other addon URLs during CI.
- **Deep Component Testing**: Focus on the logic layer (stores/services) first, as UI is still evolving.

## Dependencies Identified
| Package | Version | Purpose |
|---------|---------|---------|
| `jest` | ^29.x | Test runner. |
| `axios-mock-adapter` | ^2.x | Mocking addon HTTP responses. |
| `@testing-library/react-native` | ^12.x | UI testing if needed later. |

## Risks
- **Protocol Mismatch**: Real addons might change their response structure. 
- *Mitigation*: Implement a Zod schema validator in `AddonService` later to catch breaking changes.

## Ready for Planning
- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified
