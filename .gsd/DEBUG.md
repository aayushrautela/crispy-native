# Debug Session: Subtitle Selection

## Symptom
Subtitle selection always uses the first embedded subtitle, regardless of user selection.

**When:** User selects any subtitle track from the SubtitlesTab
**Expected:** Selected subtitle track should be displayed
**Actual:** First embedded subtitle is always displayed

## Evidence Gathering

### Data Flow to Trace
1. `SubtitlesTab.tsx` - User clicks on track → calls `onSelectTrack(track)`
2. `player.tsx` - `setSelectedSubtitleTrack({ type: 'index', value: track.id })`
3. `VideoSurface.tsx` - `selectedTextTrack` prop → `mpvPlayerRef.current.setSubtitleTrack(value)`
4. `CrispyVideoView.kt` - `setSubtitleTrack(trackId)` → `MPVLib.setPropertyInt("sid", trackId)`

### Key Questions
- Is `track.id` correct in SubtitlesTab? (embedded vs external ID mismatch?)
- Is `selectedSubtitleTrack` state updating correctly in player.tsx?
- Is the effect in VideoSurface.tsx firing when selection changes?
- Is MPV receiving the correct `sid` value?

## Hypotheses

| # | Hypothesis | Likelihood | Status |
|---|------------|------------|--------|
| 1 | Track ID mismatch: embedded tracks have different IDs than expected | 40% | UNTESTED |
| 2 | useEffect in VideoSurface not triggering on selection change | 30% | UNTESTED |
| 3 | MPV `sid` property not accepting the correct value type | 20% | UNTESTED |
| 4 | State not propagating from player.tsx to VideoSurface | 10% | UNTESTED |

## Attempts

(None yet)
