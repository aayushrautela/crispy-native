---
phase: 7
plan: 1
wave: 1
---

# Plan 7.1: Bottom Sheet & Catalog Interactions

## Objective
Implement a Bottom Sheet for `CatalogCard` long-press actions.

## Context
- src/components/ui/BottomSheet.tsx (New or check existing Library)
- src/components/CatalogCard.tsx

## Tasks

<task type="auto">
  <name>Create BottomSheet Component</name>
  <files>src/components/ui/ActionSheet.tsx</files>
  <action>
    Create a reusable Action Sheet / Bottom Sheet component.
    - Native styling (or custom styled View with animations).
    - Supported Actions: List of { label, icon, onPress, variant }.
  </action>
  <verify>test -f src/components/ui/ActionSheet.tsx</verify>
  <done>Reusable action sheet available.</done>
</task>

<task type="auto">
  <name>Update CatalogCard LongPress</name>
  <files>src/components/CatalogCard.tsx</files>
  <action>
    - Add `onLongPress` to `ExpressiveSurface`.
    - Trigger `ActionSheet` with options:
        - Add/Remove from Library.
        - Add/Remove from Watchlist.
        - Mark Watched/Unwatched.
        - Rate.
    - Use `TraktContext` statuses to determine button labels (e.g. "Add to..." vs "Remove from...").
  </action>
  <verify>grep "onLongPress" src/components/CatalogCard.tsx</verify>
  <done>Long press triggers menu.</done>
</task>

## Success Criteria
- [ ] Long press on any catalog card opens the menu.
- [ ] Context-aware actions (correct state displayed).
