import React from 'react';
import { View, StyleSheet, ActivityIndicator, FlatList, Text, Pressable } from 'react-native';
import { useTheme } from '@/src/core/ThemeContext';
import { SideSheet } from '@/src/core/ui/SideSheet';
import { AudioTab } from '@/src/features/player/components/tabs/AudioTab';
import { SubtitlesTab } from '@/src/features/player/components/tabs/SubtitlesTab';
import { StreamsTab } from '@/src/features/player/components/tabs/StreamsTab';
import { SettingsTab } from '@/src/features/player/components/tabs/SettingsTab';
import { InfoTab } from '@/src/features/player/components/tabs/InfoTab';
import CrispyNativeCore from '@/modules/crispy-native-core';

interface PlayerTabSystemProps {
    activeTab: string;
    onClose: () => void;
    audioTracks: any[];
    selectedAudioId?: number;
    setSelectedAudioId: (id?: number) => void;
    subtitleTracks: any[];
    selectedSubtitleId: number;
    setSelectedSubtitleId: (id: number) => void;
    externalSubtitlesLoading: boolean;
    subtitleFileLoading: boolean;
    subtitleOptions: any[];
    selectedExternalSubtitleUrl: string | null;
    setSelectedExternalSubtitleUrl: (url: string | null) => void;
    subtitleDelay: number;
    setSubtitleDelay: (delay: number) => void;
    subtitleSize: number;
    setSubtitleSize: (size: number) => void;
    subtitleOffset: number;
    setSubtitleOffset: (offset: number) => void;
    availableStreams: any[];
    streamsLoading: boolean;
    onSwitchToStream: (stream: any, options?: any) => void;
    playbackRate: number;
    onSelectSpeed: (rate: number) => void;
    resizeMode: 'contain' | 'cover' | 'stretch';
    onSelectResizeMode: (mode: 'contain' | 'cover' | 'stretch') => void;
    meta: any;
    enriched: any;
}

export const PlayerTabSystem: React.FC<PlayerTabSystemProps> = ({
    activeTab,
    onClose,
    audioTracks,
    selectedAudioId,
    setSelectedAudioId,
    subtitleTracks,
    selectedSubtitleId,
    setSelectedSubtitleId,
    externalSubtitlesLoading,
    subtitleFileLoading,
    subtitleOptions,
    selectedExternalSubtitleUrl,
    setSelectedExternalSubtitleUrl,
    subtitleDelay,
    setSubtitleDelay,
    subtitleSize,
    setSubtitleSize,
    subtitleOffset,
    setSubtitleOffset,
    availableStreams,
    streamsLoading,
    onSwitchToStream,
    playbackRate,
    onSelectSpeed,
    resizeMode,
    onSelectResizeMode,
    meta,
    enriched,
}) => {
    const { theme } = useTheme();

    return (
        <SideSheet
            isVisible={activeTab !== 'none'}
            onClose={onClose}
            title={activeTab !== 'none' ? activeTab.charAt(0).toUpperCase() + activeTab.slice(1) : undefined}
        >
            <View style={{ flex: 1 }}>
                {activeTab === 'audio' && (
                    <AudioTab
                        tracks={audioTracks}
                        selectedTrackId={selectedAudioId}
                        onSelectTrack={(track) => {
                            const id = Number(track.id);
                            setSelectedAudioId(Number.isFinite(id) ? id : undefined);
                            void CrispyNativeCore.nativePlayerSetAudioTrack(id);
                            onClose();
                        }}
                    />
                )}

                {activeTab === 'subtitles' && (
                    <SubtitlesTab
                        embeddedTracks={subtitleTracks}
                        selectedEmbeddedId={selectedSubtitleId}
                        externalOptions={subtitleOptions.filter(o => o.kind === 'external')}
                        selectedExternalUrl={selectedExternalSubtitleUrl}
                        loading={externalSubtitlesLoading || subtitleFileLoading}
                        delay={subtitleDelay}
                        fontSize={subtitleSize}
                        offset={subtitleOffset}
                        onSelectEmbedded={(id) => {
                            setSelectedSubtitleId(id);
                            setSelectedExternalSubtitleUrl(null);
                            void CrispyNativeCore.nativePlayerSetSubtitleTrack(id);
                        }}
                        onSelectExternal={(url) => {
                            setSelectedExternalSubtitleUrl(url);
                            setSelectedSubtitleId(-1);
                            void CrispyNativeCore.nativePlayerSetSubtitleTrack(-1);
                        }}
                        onSelectOff={() => {
                            setSelectedSubtitleId(-1);
                            setSelectedExternalSubtitleUrl(null);
                            void CrispyNativeCore.nativePlayerSetSubtitleTrack(-1);
                        }}
                        onUpdateDelay={(d) => {
                            setSubtitleDelay(d);
                            void CrispyNativeCore.nativePlayerSetSubtitleDelay(d);
                        }}
                        onUpdateFontSize={setSubtitleSize}
                        onUpdateOffset={setSubtitleOffset}
                    />
                )}

                {activeTab === 'streams' && (
                    <StreamsTab
                        streams={availableStreams}
                        loading={streamsLoading}
                        onSelectStream={onSwitchToStream}
                    />
                )}

                {activeTab === 'settings' && (
                    <SettingsTab
                        playbackRate={playbackRate}
                        onSelectPlaybackRate={onSelectSpeed}
                        resizeMode={resizeMode}
                        onSelectResizeMode={onSelectResizeMode}
                    />
                )}

                {activeTab === 'info' && (
                    <InfoTab
                        meta={meta}
                        enriched={enriched}
                    />
                )}
            </View>
        </SideSheet>
    );
};

const styles = StyleSheet.create({
    inlineLoadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        gap: 12,
    },
    inlineLoadingText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
    },
});
