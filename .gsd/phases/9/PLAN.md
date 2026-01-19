# Phase 9: Infinite Catalog Scroll

Implement horizontal lazy loading (infinity scroll) for catalog rows on the Home and Discover screens.

## User Review Required

> [!IMPORTANT]
> This change refactors the core `useCatalog` hook from `useQuery` to `useInfiniteQuery`.

## Proposed Changes

### Core Discovery Hook
#### [MODIFY] [useDiscovery.ts](file:///home/aayush/Downloads/crispy-native/src/core/hooks/useDiscovery.ts)
- Refactor `useCatalog` to use `useInfiniteQuery`.
- Implement `getNextPageParam` using the standard Stremio `skip` parameter (offset 20-100 depending on addon).
- Ensure ID deduplication persists across pages.

### Catalog Row Component
#### [MODIFY] [CatalogRow.tsx](file:///home/aayush/Downloads/crispy-native/src/components/CatalogRow.tsx)
- Connect to `useInfiniteQuery` result.
- Add `onEndReached` and `onEndReachedThreshold` to the `FlatList`.
- Add a loading indicator at the end of the list when `isFetchingNextPage` is true.

## Verification Plan

### Automated Tests
- N/A (Manual verification required for UI scroll behavior)

### Manual Verification
1. Open Home screen.
2. Scroll to the end of a long catalog (e.g., "Popular Movies").
3. Verify that more items are fetched and appended to the list.
4. Verify that deduplication works correctly.
