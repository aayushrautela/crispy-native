## Phase 1: Foundation & Identity

**Date:** 2026-01-18

### Design System: Material You Expressive
- **Approach**: Implement a dynamic theme provider that supports:
    - Android System Accents (Dynamic Color).
    - "Crispy" Curated Palette (Fallback/Override).
    - AMOLED Black toggle.
- **Shapes**: Adopt M3 Expressive corner scale (Large: 20dp, XL: 32dp, XXL: 48dp).
- **Navigation**: 
    - Mobile: Bottom Tab navigation (following webui mobile layout).
    - Tablet: Multi-column side navigation (following webui desktop layout).
    - TV: Custom layout (Phase 5).

### Authentication & Access
- **Decision**: 
    - **Guest Mode**: Allowed on Mobile and Tablet for discovery/browsing.
    - **Enforced Login**: Required on TV to enable sync-first architecture (no local management on TV).
- **Structure**: Root guard in `_layout.tsx` using `(auth)` and `(tabs)` route groups.

### Accessibility & Interaction
- **D-Pad**: All Phase 1 UI components (Buttons, Inputs, Tab items) MUST be focus-aware from the start to support TV/Remote navigation natively.
- **Animations**: Use `react-native-reanimated` for fluid transitions. Expansion/Zoom style for detail transitions.
