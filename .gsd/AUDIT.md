# Home Screen UI Audit: "Native vs. Dream"

> **Status**: ⚠ Gaps Identified
> **Target**: Crispy WebUI (Mobile) Aesthetic

## 🎬 Component Breakdown

| Component | Current Implementation | The "Dream" Aesthetic | Verdict |
| :--- | :--- | :--- | :--- |
| **Header** | Static text ("Good Evening") + profile circle. | **Glassmorphic Floating Bar**: Blurred background on scroll, custom Logo/Branding on the left, "Live" notification bell. | ❌ Too Flat |
| **Hero / Featured** | Simple `ImageBackground` + basic gradient. | **Immersive Backdrop**: Edge-to-edge 21:9 image, "Mesh Gradient" masking, Title SVG/Typography with shadow, Metadata chips (Score, Genre). | ❌ MVB (Min Viable Backdrop) |
| **Catalog Row** | Standard horizontal scroll. | **Snap-to-Card Sections**: Gentle snapping, "See All" expressive buttons, high-intensity headers with accent typography. | ❌ Lacks Polish |
| **Catalog Cards** | Poster with a simple colored box badge. | **Premium Media Tiles**: 3D-effect on focus (TV), "Glass" type badges, Gradient-masked titles, Progress indicators for "Continuing". | ❌ Basic |
| **Color & Depth** | Standard Material 3 Colors. | **Vibrant Depth**: High-saturation accents (Crispy Blue), Deep shadows for elevation, subtle card outlines with 0.1 opacity white. | ❌ Dull |

## 🛌 The "Dream" Vision

### 1. The Immersive Header
Instead of a simple "Good Evening", the header should feel like a part of the content. On scroll, it should transition into a translucent frosted-glass bar (`blurView`).

### 2. The Cinema Hero
The Hero section shouldn't look like a card inside a container. It should feel like a cinematic poster. Use a `bottom-heavy` gradient that fades into the background color of the app to create a "seamless merge" effect.

### 3. The Responsive Grid
Catalog cards should vary in size based on content type—Portrait for Movies, Landscape for Live TV channels, and Square for Music/Addons.

## 🚀 Plan for "Crispy-fication"

1. **Refactor Design Tokens**: Move from raw hex colors to a vibrance-based system in `ThemeContext`.
2. **Rebuild HeroSection**: Implement a dedicated `HeroSection` component with internal `LinearGradient` masking.
3. **Enhance CatalogRow**: Add "See All" and improve header typography using `Inter-Black` or similar heavy fonts.
4. **Card Polish**: Update `CatalogCard` with better shadows and glassmorphic overlays for the "Type" badge.

---

### Comparison Summary
| Metric | Current | Target |
| :--- | :--- | :--- |
| **FPS** | 60 | 60 |
| **Fluidity** | Good | Fluid |
| **Aesthetic** | Functional | **Premium** |
| **Immersion** | Low | **High** |
