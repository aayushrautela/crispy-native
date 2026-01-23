---
phase: 6
plan: 2
wave: 1
---

# Plan 6.2: Rating Modal Component

## Objective
Create the `RatingModal` component to allow users to rate content.

## Context
- src/components/ui/RatingModal.tsx (New)

## Tasks

<task type="auto">
  <name>Create RatingModal</name>
  <files>src/components/ui/RatingModal.tsx</files>
  <action>
    Create a modal component similar to `Crispy-webui`:
    - Display title.
    - Star rating input (1-10 or 1-5 mapped to 10).
    - "Rate" and "Remove Rating" buttons.
    - Use `rateContent` from `TraktContext`.
  </action>
  <verify>test -f src/components/ui/RatingModal.tsx</verify>
  <done>Modal exists and handles rating submission.</done>
</task>

<task type="auto">
  <name>Integrate Modal in MetaDetails</name>
  <files>src/components/meta/HeroSection.tsx</files>
  <action>
    Render `RatingModal` when "Rate" button is clicked.
  </action>
  <verify>grep "RatingModal" src/components/meta/HeroSection.tsx</verify>
  <done>Modal appears on click.</done>
</task>

## Success Criteria
- [ ] Users can submit ratings.
- [ ] Users can remove ratings.
