# ROADMAP: Trakt Integration & Comments

## Phase 1: Core API & Hooks 🏗️
- [ ] Extend `TraktService.ts` with comments fetching methods.
- [ ] Implement `useTraktWatchState` hook for dynamic button logic.
- [ ] Implement `useTraktComments` hook for fetching and pagination.

## Phase 2: Watch Now Enhancement ⌚
- [ ] Integrate `useTraktWatchState` into `HeroSection`.
- [ ] Update "Watch Now" button UI to support dynamic labels (Resume, Rewatch).
- [ ] Add progress indicator to "Resume" button if applicable.

## Phase 3: Trakt Comments Section 💬
- [ ] Create `CommentCard` component (Compact, horizontal scroll).
- [ ] Create `CommentsSection` wrapper component.
- [ ] Implement Markdown renderer for simple formatting and spoilers.
- [ ] Implement `ReviewBottomSheet` for detailed review viewing.
- [ ] Integrate `CommentsSection` into `MetaDetailsScreen`.

## Phase 4: Verification & Polish ✨
- [ ] Verify dynamic button states across different content.
- [ ] Verify comment loading, pagination, and spoiler revealing.
- [ ] UI/UX polish (Material 3 Expressive compliance).
- [ ] Documentation update.
