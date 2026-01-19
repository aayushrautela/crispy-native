---
phase: 8
sub_phase: "Home UI Premium Alignment"
level: 2
researched_at: 2026-01-18
---

# Phase 8 Research: "Crispy Dream" Home UI Alignment

## Questions Investigated
1. **Glassmorphism**: How to achieve a "frosted glass" floating header that reveals content on scroll without performance hit?
2. **Cinema Merge**: How to blend a Hero backdrop perfectly into the background using multi-stop gradients?
3. **Fluid Layouts**: What are the exact spacing and typography tokens used in `crispy-webui` mobile?
4. **Snapping UX**: How to implement Apple-style "Paginated Snapping" for catalog cards in horizontal rows?

## Findings

### 1. Glassmorphic Headers
To match the premium look, the header must be absolutely positioned with a `BlurView`.
- **Technique**: Use `paddingTop` on the ScrollView equals to header height (~90px) but keep the header `position: 'absolute'`.
- **Vibrancy**: Overlay a 0.05 opacity white/gray tint on the BlurView to enhance the "frosted" look on dark themes.

### 2. The "Stremio" Cinema Hero
The "card" look is out. The "Dream" Hero is a full-width experience.
- **Gradient Curve**: Instead of a simple `['transparent', '#000']`, use a 3-stop or 4-stop curve: `['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)', 'theme.colors.background']`.
- **Scaling**: Hero height should be dynamic (approx 45% of screen height) to feel cinematic.

### 3. Snapping & Momentum
- **Implementation**: use `snapToInterval={width + gap}` and `decelerationRate="fast"` on horizontal `ScrollView`. This creates the "premium" snap feel found in high-end streaming apps.
- **Gap Management**: 16dp spacing is the sweet spot for M3 Expressive grids.

### 4. Typography Hierarchy
- **Primary Headers**: `h1` should use `-1px` letter spacing and `900` weight (Black).
- **Secondary Details**: Use `label` variant with `tracking-widest` for info badges inside cards.

## Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Header Style** | Floating Blur | Immersion level is much higher than static headers. |
| **Hero Layout** | Edge-to-Edge | Card-based heroes feel like "blocks"; Edge-to-edge feels like "cinema". |
| **Animation** | Momentum Snapping | Standard scrolling feels "cheap"; snapping feels engineered. |

## Patterns to Follow
- **Masking**: Always fade the bottom of images into the background color. Never show a hard edge.
- **Elevation**: Use `shadowOpacity: 0.2` on cards instead of hard borders.

## Risks
- **Blur Performance**: Multiple BlurViews on old Androids can lag. 
- **Mitigation**: Only use Blur for the Header and maybe one small badge overlay. Avoid blur for the entire Hero.

## Ready for Planning
- [x] Aesthetic delta identified
- [x] Implementation techniques chosen
- [x] Performance risks mitigated
