import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { TraktService } from '@/src/core/services/TraktService';

interface UseTraktScrobblerProps {
    id: string; // IMDB ID, Trakt ID, or composite "id:season:episode"
    type: 'movie' | 'series';
    progress: number; // 0-100 or seconds? Trakt expects 0-100. Native player gives seconds. We need duration.
    duration: number; // In seconds
    paused: boolean;
    enabled?: boolean;
    season?: number;
    episode?: number;
}

export function useTraktScrobbler({
    id,
    type,
    progress: currentPositionSeconds,
    duration,
    paused,
    enabled = true,
    season,
    episode
}: UseTraktScrobblerProps) {
    const scrobbleThreshold = 85.0; // Scrobble at 85%
    const progressPercentage = duration > 0 ? (currentPositionSeconds / duration) * 100 : 0;
    
    // State to track scrobble status
    const isScrobblingRef = useRef(false);
    const lastScrobbleProgressRef = useRef(0);
    const lastScrobbleTimeRef = useRef(0);
    const appStateRef = useRef(AppState.currentState);

    // Helper to send scrobble events
    const sendScrobble = useCallback(async (action: 'start' | 'pause' | 'stop') => {
        if (!enabled) return;
        if (!TraktService.getInstance().isAuthenticated()) return;
        
        // Don't spam 'pause' if we haven't started
        if (action === 'pause' && !isScrobblingRef.current) return;
        
        // Don't start if nearly finished or barely started? 
        // Trakt docs: "start" when watching begins.
        
        // Minimum progress delta to avoid spamming updates (e.g. every second)
        // Only update every 5% or if action changes
        const now = Date.now();
        if (action === 'start' && isScrobblingRef.current) {
            // If already scrobbling, this is an update (keep alive)
            // Send update every 5% progress or 15 minutes?
            // Actually 'start' is the "I am watching" signal.
            // We should send it periodically? Trakt says "start" initially. 
            // Most implementations send "start" then "pause" or "stop".
            // Some send periodic "start" to keep "watching now" status alive?
            // Official Trakt Docs: "Send this request when playback starts."
            // "If you want to keep the watching status active, send this request every 15 minutes."
        }

        try {
            console.log(`[TraktScrobbler] ${action.toUpperCase()} ${progressPercentage.toFixed(1)}%`);
            await TraktService.getInstance().scrobble(
                action, 
                id, 
                type, 
                progressPercentage, 
                season, 
                episode
            );
            
            if (action === 'start') isScrobblingRef.current = true;
            if (action === 'stop') isScrobblingRef.current = false;
            
            lastScrobbleProgressRef.current = progressPercentage;
            lastScrobbleTimeRef.current = now;
        } catch (e) {
            console.warn('[TraktScrobbler] Failed to scrobble:', e);
        }
    }, [id, type, progressPercentage, season, episode, enabled]);

    // Effect: Handle Play/Pause and Initial Start
    useEffect(() => {
        if (!enabled || duration === 0) return;

        // If progress is very low (< 0.5%) treat as start
        // If progress is very high (> 85% or > 95%), maybe stop?
        
        if (paused) {
            if (isScrobblingRef.current) {
                sendScrobble('pause');
            }
        } else {
            // Playing
            // Debounce "start" if we just sent it recently?
            // Trakt recommends sending 'start' every 15 mins.
            const timeSinceLast = Date.now() - lastScrobbleTimeRef.current;
            const progressDelta = Math.abs(progressPercentage - lastScrobbleProgressRef.current);
            
            // If we are not scrobbling, start.
            if (!isScrobblingRef.current) {
                sendScrobble('start');
            } else {
                // Check if we need to send keep-alive
                if (timeSinceLast > 15 * 60 * 1000 || progressDelta > 5) { // 15 mins or 5% change
                     sendScrobble('start');
                }
            }
        }
    }, [paused, enabled, duration, sendScrobble, progressPercentage]);

    // Effect: App Background/Foreground handling
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
                // App came to foreground
                if (!paused && enabled) {
                    sendScrobble('start');
                }
            } else if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
                // App went to background
                if (isScrobblingRef.current) {
                    sendScrobble('pause');
                }
            }
            appStateRef.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, [paused, enabled, sendScrobble]);

    // Effect: Cleanup on Unmount (Stop Scrobble)
    useEffect(() => {
        return () => {
            if (isScrobblingRef.current) {
                // Use the ref value for progress as the closure might be stale?
                // Actually `sendScrobble` is in dependency array, so if it changes, this effect re-runs?
                // No, cleanup runs with the values captured at effect instantiation? 
                // Wait, if `sendScrobble` changes, the effect cleans up and re-runs.
                // We only want to send STOP when the COMPONENT unmounts, not when dependencies change.
                // BUT we need the LATEST progress.
                
                // Best practice for "on unmount with latest state": use a ref for the latest state.
            }
        };
    }, []); // Empty dependency array = mount/unmount only? 
    // Issue: if deps are empty, `sendScrobble` is stale.
    
    // Better Unmount Handling using Refs for latest values
    const latestState = useRef({ id, type, progressPercentage, season, episode, enabled });
    useEffect(() => {
        latestState.current = { id, type, progressPercentage, season, episode, enabled };
    }, [id, type, progressPercentage, season, episode, enabled]);

    useEffect(() => {
        return () => {
            // Final Stop
            const state = latestState.current;
            if (state.enabled && TraktService.getInstance().isAuthenticated() && state.progressPercentage > 0) {
                 // Determine if we should mark as WATCHED (stop) or just PAUSE?
                 // Usually 'stop' is sent when done watching. 
                 // If the user backs out at 50%, sending 'stop' updates the progress on Trakt.
                 // Trakt automatically marks as "watched" if progress > 80% (or server logic).
                 // So we always send 'stop' on exit.
                 
                 console.log('[TraktScrobbler] Unmounting - Sending STOP');
                 TraktService.getInstance().scrobble('stop', state.id, state.type, state.progressPercentage, state.season, state.episode)
                    .catch(e => console.warn('Failed to stop scrobble', e));
            }
        };
    }, []);
}
