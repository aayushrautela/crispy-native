# SPEC.md — Project Specification

> **Status**: `FINALIZED`

## Vision
To provide a premium, natively fluid media center experience that surpasses the responsiveness of WebView-based solutions. Crispy Native leverages Android's Material You (Expressive) aesthetics and high-performance React Native architecture to deliver seamless media discovery and streaming.

## Goals
1. **Natively Fluid UI**: Achieve 60+ FPS animations and "native feel" responsiveness. **1:1 layout copy of crispy-webui mobile.**
2. **Material You Expressive**: Use MD3 Expressive aesthetics for all native components.
3. **Multi-Device Support**: Scales from Mobile to Tablets (TV/D-Pad deferred).
4. **Addon-Powered Ecosystem**: Support dynamic addon catalogs and streams.
5. **Cloud Synchronization**: Sync user data via Supabase and Trakt.tv.

## Non-Goals (Out of Scope for v1.0)
- **D-Pad / TV Support**: Deferred to future release.
- **Settings Management on TV**: Deferred.
- **Native Torrent Engine (Local)**: Rely on existing HTTP bridge.

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
