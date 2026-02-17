# Player Autoplay + State Machine Refactor Plan

Date: 2026-02-17

## Problem Statement

Two user-facing issues are happening today:

1) Autoplay is unreliable: opening a movie/show can land in a UI state that looks paused and requires a manual Play tap.

2) Seek UX is misleading: after a seek, controls can show a paused/play icon while the player is actually loading/buffering and will resume playing.

Additionally, VLC sometimes appears to "fail to play" even for normal codecs. In the failing runs we inspected, VLC is never given a media source (it stays IDLE), which is a state/hand-off issue, not decoding.

## Verified Current Behavior (Code Facts)

- Native player events are mapped to JS machine actions in `src/features/player/hooks/usePlayerLogic.ts`.
  - `isPlaying: false` is currently mapped to `PLAYBACK_PAUSED`.
  - `load` / `first-frame` and `isPlaying: true` are mapped to `PLAYBACK_READY`.

- Reducer behavior in `src/features/player/state/playerMachine.ts`:
  - `PLAYBACK_READY` always sets `status: 'playing'`.
  - `PLAYBACK_PAUSED` sets `status: 'paused'`.
  - The machine has no explicit concept of user intent ("user paused" vs "temporarily not playing due to buffering/seek/startup").

- Overlay controls in `src/features/player/overlay/PlayerOverlayRoot.tsx`:
  - Play/pause toggles call `nativePlayerSetPaused(nextPaused)` and do not dispatch a user-intent action; the comment explicitly says the machine “waits for native event”.
  - Bootstrap load dispatch is one-shot: if neither `url` nor `infoHash` is available at bootstrap time, it dispatches a fatal error and never retries.

- Android activity load gating:
  - `PlayerActivity.applyPendingLoadIfReady()` (native) returns early if `url` is blank.
  - Torrent sessions therefore require JS to resolve a localhost URL and call `nativePlayerLoad(url)` before native playback can begin.

- Transport of torrent init data into the overlay is currently fragile:
  - `openPlayerActivity(...)` does not pass torrent fields (`infoHash`, `fileIdx`) to native/overlay props.
  - Overlay bootstrap depends on `useNativePlayerSessionStore` (in-memory) to obtain torrent params.

## Root Causes

### A) Conflated Meanings: Observed Playback vs User Intent

`isPlaying: false` is treated as “paused”, but it can also mean:

- buffering during startup
- buffering after seek
- transient state while switching streams

Because the state machine lacks a separate “intent” dimension, transient native states overwrite the user-facing “paused” state. That produces:

- autoplay flows that look paused
- play/pause icon flipping to “play” during seek/buffer

### B) Missing Command/Intent Tracking

UI sends commands (pause/play) but the machine does not track intent or pending commands. The machine only changes when native events arrive.

That makes UI susceptible to race ordering and transient native event sequences.

### C) One-Shot Bootstrap + Fragile Torrent Handoff

Overlay bootstraps a stream exactly once, and errors fatally if source data is missing at that moment.

For torrents, the overlay must have `infoHash` (or a URL) before it can even begin the pipeline.

If the session handoff is delayed, missing, or out-of-sync, VLC never receives a source -> it stays IDLE.

## Desired Behavior (Product Rules)

1) Autoplay default: opening a title means intent is “play”. The user should not need to press Play.

2) Seeking while intent=play: show a loading/buffering indicator, but do not present a “paused” state or flip the play/pause icon to “play”.

3) Only explicit user actions create a user-paused state.

4) Torrent boot is deterministic: overlay always knows what to load for the session.

## Proposed Refactor (No Bandaids)

### 1) Split State Into Orthogonal Dimensions

Replace the single `status` interpretation with at least these independent concepts:

- Intent: what the user wants
  - `intent: 'play' | 'pause'`
  - `autoplay: boolean` (default true)
  - `lastUserActionAt` (optional, for debugging/telemetry)

- Phase: what the pipeline is doing
  - `phase: 'idle' | 'booting_torrent' | 'polling_localhost' | 'loading_media' | 'seeking' | 'buffering' | 'ready' | 'ended' | 'error'`

- Observed native playback (facts, not intent)
  - `observed: { isPlaying: boolean; isBuffering: boolean; hasLoaded: boolean; firstFrame: boolean }`

- Pending commands (for correctness)
  - `pending: { setPaused?: { value: boolean; issuedAt: number }; seek?: { toSec: number; issuedAt: number } }`

The key rule: native events update `observed` and may move `phase`, but must not mutate `intent`.

### 2) Redesign Event Taxonomy

Introduce explicit action types:

- User actions
  - `USER_INTENT_PLAY`
  - `USER_INTENT_PAUSE`
  - `USER_SEEK(toSec)`
  - `USER_CLOSE`

- Native observations
  - `NATIVE_LOAD`
  - `NATIVE_FIRST_FRAME`
  - `NATIVE_IS_PLAYING(true/false)`
  - `NATIVE_BUFFERING(true/false)`
  - `NATIVE_ERROR`
  - `NATIVE_END`

- Pipeline steps
  - `LOAD_SOURCE(stream)`
  - `TORRENT_ENGINE_STARTED(url)`
  - `LOCALHOST_READY`

### 3) Define UI Mapping Rules (Fixes Both UX Issues)

Play/pause icon should be derived from intent, not from transient `observed.isPlaying`:

- If `intent === 'play'`: render the Pause icon (tap means “pause”).
- If `intent === 'pause'`: render the Play icon (tap means “play”).

Show a spinner/“loading” affordance based on phase/observed:

- If `phase in {booting_torrent, polling_localhost, loading_media, seeking, buffering}`: show loading.

This ensures:

- seeking does not look “paused”
- startup buffering does not look “paused”
- autoplay never requires a tap unless the user explicitly paused

### 4) Command Application With Acknowledgement

Move to a “desired vs observed” control loop:

- Reducer sets `intent` immediately on user action.
- Side effects send native commands to converge native state toward intent:
  - if intent=play -> `nativePlayerSetPaused(false)`
  - if intent=pause -> `nativePlayerSetPaused(true)`
- Track a `pending.setPaused` command until native events confirm the new observed condition.

This removes dependence on event ordering (no more “isPlaying false” accidentally turning into user-paused).

### 5) Fix Torrent/Overlay Initialization Deterministically

Stop relying on an in-memory JS store as the source of truth for initial torrent params.

Recommended path:

- Extend `openPlayerActivity(...)` to accept and pass torrent init fields via native Intent extras:
  - `infoHash`, `fileIdx` (and optionally a magnet link if that’s a supported entrypoint)

- Update `PlayerActivity.getLaunchOptions()` to include these fields in initial props to `PlayerOverlayRoot`.

- Update overlay bootstrap to read source from props (not only from `useNativePlayerSessionStore`) and to be retryable:
  - no fatal error on first mount unless a short timeout expires
  - if source arrives later (rare, but possible), bootstrap proceeds

The goal is: overlay always has the minimum needed to begin the pipeline without race-prone cross-root state.

## Implementation Phases

### Phase 0: Instrumentation (Fast Feedback)

- Add structured debug logs (dev only) with:
  - `sessionId`, `intent`, `phase`, `observed`, `pending`, `engine`
  - last native event type + timestamp

Acceptance: we can definitively tell when/why UI shows play vs pause and why native is not playing.

### Phase 1: New State Model (Reducer Only)

- Create a v2 machine in `src/features/player/state/` (new files, keep v1 intact initially).
- Implement the new reducer logic with the intent/phase/observed split.

Acceptance: reducer transitions are deterministic and do not rely on inferred intent.

### Phase 2: Update `usePlayerLogic` To Emit v2 Actions

- Replace `isPlaying:false => PLAYBACK_PAUSED` behavior.
- Emit `NATIVE_IS_PLAYING(false)` as observation.
- Ensure buffering/seek states move `phase` without touching `intent`.
- Keep torrent pipeline effects but wire them to v2 actions.

Acceptance: on open (intent=play), transient `isPlaying:false` cannot force `intent=pause` or a “paused” UI.

### Phase 3: Update Overlay + PlayerScreen UI Wiring

- Change play/pause icon derivation to use `intent`.
- Add/adjust a loading affordance for phases (`seeking`, `buffering`, `loading_media`, torrent phases).
- Make toggle actions dispatch `USER_INTENT_PLAY/PAUSE` (and then side effects drive native).

Acceptance:

- Seek shows loading but keeps pause icon when intent=play.
- Autoplay always shows pause icon + loading until playback begins.

### Phase 4: Deterministic Torrent Init Handoff

- Extend `openPlayerActivity` params and native extras to carry `infoHash`/`fileIdx`.
- Pass these through to overlay initial props.
- Update overlay bootstrap to prefer props and be retryable (timeout-based error instead of one-shot fatal).

Acceptance: torrent sessions cannot fail solely because JS session store was missing/not-ready.

### Phase 5: Cleanup + Removal of v1 Assumptions

- Remove v1-only status mappings and any UI logic reading `status==='paused'` as intent.
- Consolidate native event consumption (optional): move progress/tracks into the same state container to avoid multiple listeners.

Acceptance: single source of truth for playback state across overlay and non-overlay player UI.

## Test Plan (Manual + Static)

Manual scenarios (Android, both engines if supported):

1) Open a title (direct URL): should autoplay, never requires Play tap.
2) Open a title (torrent): should show loading -> play automatically.
3) Seek forward/back repeatedly:
   - shows loading during seek/buffer
   - does not flip to “paused” icon unless user paused
4) Pause then seek while paused:
   - stays in intent=pause and play icon stays visible
5) Background/foreground and PiP transitions:
   - intent preserved
   - no spurious paused state when returning
6) Fast open/close/open:
   - no stuck sessions; no missing-source bootstrap fatal error

Static checks:

- `npm run lint`
- `npx tsc -p tsconfig.json --noEmit`

## Risk Notes

- This refactor changes semantics used by multiple screens (overlay + `src/app/player.tsx`). Plan assumes shared intent/phase model for consistent UX.
- Native event ordering differs by engine/device; separating intent from observed state is the core mitigation.

## Deliverables

- New v2 player machine with intent/phase split
- Updated event mapping + command loop
- UI wiring that is intent-driven
- Deterministic torrent init handoff to overlay props
