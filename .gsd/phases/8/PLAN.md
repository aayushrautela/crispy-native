# Phase 8: Performance Optimization - Execution Plan

## Objective
Address the performance lag in `VirtualizedList` and ensure a fluid 1:1 mobile experience matching the WebUI's responsiveness.

## Strategy

### 1. Component Level Optimization (Memoization)
*   **Target:** `MetaCard`, `CatalogRow`, `HeroSlide`.
*   **Action:** Wrap components in `React.memo` with custom comparison functions if props contain complex objects.
*   **Reasoning:** Prevent unnecessary re-renders when parent lists update or when sibling components change.

### 2. List Tuning
*   **Target:** `SectionList` or `FlatList` used in `DiscoverScreen`.
*   **Action:**
    *   Implement `getItemLayout` for fixed-height rows/cards to bypass dynamic measurement.
    *   Tune `windowSize` (default 21 → try 5-10) and `maxToRenderPerBatch` (default 10 → try 5).
    *   Set `removeClippedSubviews={true}` (Android optimization).
    *   Ensure `keyExtractor` uses unique stable IDs (e.g., `item.id`).

### 3. Image Optimization
*   **Target:** Poster and backdrop images.
*   **Action:** Use `expo-image` (already in project) with proper `cachePolicy` and `transition`.
*   **Priority:** Ensure images don't block the JS thread during decoding.

### 4. Verification Plan
*   **Manual:** Monitor logs for `VirtualizedList` warnings during rapid scrolling.
*   **Manual:** Use React Native Performance Monitor (top overlay) to track FPS and JS thread usage.
*   **Empirical:** Record screen while scrolling and analyze for dropped frames.
