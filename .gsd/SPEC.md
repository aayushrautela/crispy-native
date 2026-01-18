# SPEC.md — Project Specification

> **Status**: `FINALIZED`

## Vision
To provide a premium, natively fluid media center experience that surpasses the responsiveness of WebView-based solutions. Crispy Native leverages Android's Material You (Expressive) aesthetics and high-performance React Native architecture to deliver seamless media discovery and streaming.

## Goals
1. **Natively Fluid UI**: Achieve 60+ FPS animations and "native feel" responsiveness across all interactions.
2. **Multi-Device Support**: Deliver a single codebase that scales from Mobile (Android/iOS) to Tablets and Android TV (Remote-controlled).
3. **Addon-Powered Ecosystem**: Support a dynamic system of addons for media catalogs and streams (HTTP/Torrents).
4. **Cloud Synchronization**: Seamlessly sync user settings, addons, and watch progress via Supabase and Trakt.tv.
5. **Design Excellence**: Implement Material You Expressive (Android) with a clear architecture to support "Liquid Glass" (iOS) in the future.

## Non-Goals (Out of Scope for v1.0)
- **Settings Management on TV**: TV version will be "Read-Only" for configuration; management must happen on Mobile/Web.
- **Support for non-Stremio addons**: Only standard Stremio-compatible manifests/addons.
- **Native Torrent Engine (Local)**: Initially rely on HTTP torrent streaming or external bridge if complex.
- **Full Social Features**: Comments or peer-to-peer sharing.

## Users
- **Mobile Users**: Primary interface for discovery, management, and viewing.
- **TV Enthusiasts**: Lean-back experience with remote-optimized navigation.
- **Power Users**: Who sync their collection across multiple devices.

## Constraints
- **Remote Navigation**: TV version must be fully navigable via D-Pad (Up, Down, Left, Right, Select, Back).
- **Architecture Integrity**: Must maintain a clean separation between UI logic and native look-and-feel to allow platform-specific "Expressive" vs "Liquid Glass" designs.
- **Performance**: Torrent/HTTP streaming must be optimized for mobile network conditions.

## Success Criteria
- [ ] **Fluidity**: Zero stutter during list scrolling and view transitions (captured via 60fps recording).
- [ ] **TV Navigability**: Full functional walkthrough using only remote keys.
- [ ] **Sync Integrity**: Login on Mobile → Change Addon → Instantly see change on TV.
- [ ] **User Feedback**: Positive manual testing confirmation for "Native Feel".
