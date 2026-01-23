import { CrispyVideoView } from '@/modules/crispy-native-core';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

export interface MpvPlayerRef {
    seek: (positionSeconds: number) => void;
    setAudioTrack: (trackId: number) => void;
    setSubtitleTrack: (trackId: number) => void;
    setSubtitleSize: (size: number) => void;
    setSubtitleColor: (color: string) => void;
    setSubtitleBackgroundColor: (color: string, opacity: number) => void;
    setSubtitleBorderSize: (size: number) => void;
    setSubtitleBorderColor: (color: string) => void;
    setSubtitlePosition: (pos: number) => void;
    setSubtitleDelay: (delay: number) => void;
    setSubtitleBold: (bold: boolean) => void;
    setSubtitleItalic: (italic: boolean) => void;
    enterPiP: () => void;
}

export interface MpvPlayerProps {
    source: string;
    headers?: Record<string, string>;
    paused?: boolean;
    volume?: number;
    rate?: number;
    resizeMode?: 'contain' | 'cover' | 'stretch';
    decoderMode?: 'auto' | 'sw' | 'hw' | 'hw+';
    gpuMode?: 'gpu' | 'gpu-next';
    style?: any;
    onLoad?: (data: { duration: number; width: number; height: number }) => void;
    onProgress?: (data: { currentTime: number; duration: number }) => void;
    onEnd?: () => void;
    onError?: (error: { error: string }) => void;
    onTracksChanged?: (data: { audioTracks: any[]; subtitleTracks: any[] }) => void;
    metadata?: import('@/modules/crispy-native-core').CrispyMediaMetadata;
}

// ... existing code ...

return (
    <CrispyVideoView
        ref={nativeRef as any}
        style={[styles.container, props.style]}
        source={props.source}
        headers={props.headers}
        paused={props.paused ?? true}
        resizeMode={props.resizeMode ?? 'contain'}
        decoderMode={props.decoderMode ?? 'auto'}
        gpuMode={props.gpuMode ?? 'gpu'}
        metadata={props.metadata}
        onLoad={handleLoad}
        onProgress={handleProgress}
        onEnd={handleEnd}
        onError={handleError}
        onTracksChanged={handleTracksChanged}
    />
);
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
});

MpvPlayer.displayName = 'MpvPlayer';

export default MpvPlayer;
