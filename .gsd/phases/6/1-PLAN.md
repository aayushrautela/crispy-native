---
phase: 6
plan: 1
wave: 1
---

# Plan 6.1: Update HeroSection

## Objective
Implement "My List" and "Rate" buttons in `HeroSection` using `TraktContext`.

## Context
- src/components/meta/HeroSection.tsx
- src/core/context/TraktContext.tsx

## Tasks

<task type="auto">
  <name>Add Buttons to HeroSection</name>
  <files>src/components/meta/HeroSection.tsx</files>
  <action>
    - Import `useTraktContext`.
    - Add "My List" button:
        - Icon: Plus (or Check if in list).
        - Action: `addToWatchlist` / `removeFromWatchlist`.
    - Add "Rate" button:
        - Icon: Star.
        - Action: Open Rating Modal (callback).
    - Style buttons to match `MetaDetailsDesktop` from `Crispy-webui` (Action buttons row).
  </action>
  <verify>grep "addToWatchlist" src/components/meta/HeroSection.tsx</verify>
  <done>Buttons are visible and functional.</done>
</task>

## Success Criteria
- [ ] Users can toggle "My List" status from Details page.
- [ ] Users can trigger Rating flow.
