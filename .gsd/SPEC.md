# SPEC: Trakt Integration & Comments

Status: FINALIZED

## Goal
Properly integrate Trakt into `crispy-native` to provide a production-grade experience. This includes dynamic "Watch Now" button logic based on watched state and a comprehensive comments section with spoiler handling.

## Requirements

### 1. Watch Now Button Logic
- The button on the details page must reflect the Trakt watched state.
- **Watch Now**: Default state if not watched.
- **Resume from xyz%**: If in progress (between 2% and 85% on Trakt).
- **Rewatch**: If already marked as watched on Trakt but not currently in progress.
- This logic should be encapsulated in a reusable hook or utility.

### 2. Trakt Comments
- Display Trakt comments on the Movie/Series details screen.
- Layout: Use horizontal card-style rows (similar to episode cards).
- Fetching: Fetch comments for movies, shows, seasons, and episodes.
- Data points: Username, VIP status, rating (1-10), comment text, likes, timestamp.

### 3. Spoiler Handling & Reviews
- Comments marked as spoilers must be blurred/masked.
- Users must explicitly tap to reveal spoiler content.
- Support for inline `[spoiler]` tags within comment text.
- Comprehensive review viewing via a dedicated Bottom Sheet for long-form content.

### 4. Technical Constraints
- Use existing `TraktService.ts` for API interactions.
- Maintain Material 3 Expressive design aesthetic.
- Production-grade performance (no main thread blocking, efficient fetching).

## Reference Implementations
- Logic: `Crispy-webui/src/hooks/useTraktIntegration.ts`
- Comments & Spoilers: `NuvioStreaming/src/components/metadata/CommentsSection.tsx`
- Comments API: `NuvioStreaming/src/services/traktService.ts`
