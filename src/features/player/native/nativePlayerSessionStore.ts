import { create } from 'zustand';

export type PlayerContentType = 'movie' | 'series';
export type NativePlayerEngine = 'exoplayer' | 'mpv';

export interface NativePlayerSessionContext {
    sessionId: string;
    id: string;
    type: PlayerContentType;

    title?: string;
    poster?: string;
    episodeTitle?: string;

    url?: string;
    headers?: Record<string, string>;
    streams?: unknown[];

    infoHash?: string;
    fileIdx?: number;

    engine?: NativePlayerEngine;
    paused?: boolean;
    artist?: string;
    artworkUrl?: string;

    createdAt: number;
}

interface NativePlayerSessionStore {
    sessionsById: Record<string, NativePlayerSessionContext>;
    upsertSession: (ctx: Omit<NativePlayerSessionContext, 'createdAt'> & { createdAt?: number }) => void;
    patchSession: (sessionId: string, patch: Partial<NativePlayerSessionContext>) => void;
    removeSession: (sessionId: string) => void;
    clearAllSessions: () => void;
}

export const useNativePlayerSessionStore = create<NativePlayerSessionStore>((set) => ({
    sessionsById: {},
    upsertSession: (ctx) => {
        if (!ctx.sessionId) return;
        set((state) => {
            const existing = state.sessionsById[ctx.sessionId];
            const createdAt = ctx.createdAt ?? existing?.createdAt ?? Date.now();
            return {
                sessionsById: {
                    ...state.sessionsById,
                    [ctx.sessionId]: {
                        ...(existing ?? ({} as NativePlayerSessionContext)),
                        ...ctx,
                        createdAt,
                    },
                },
            };
        });
    },
    patchSession: (sessionId, patch) => {
        if (!sessionId) return;
        set((state) => {
            const existing = state.sessionsById[sessionId];
            if (!existing) return state;
            return {
                sessionsById: {
                    ...state.sessionsById,
                    [sessionId]: {
                        ...existing,
                        ...patch,
                    },
                },
            };
        });
    },
    removeSession: (sessionId) => {
        if (!sessionId) return;
        set((state) => {
            if (!state.sessionsById[sessionId]) return state;
            const next = { ...state.sessionsById };
            delete next[sessionId];
            return { sessionsById: next };
        });
    },
    clearAllSessions: () => {
        set({ sessionsById: {} });
    },
}));
