import { Typography } from '@/src/core/ui/Typography';
import { useTheme } from '@/src/core/ThemeContext';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

interface SettingsTabProps {
    playbackSpeed?: number;
    onSelectSpeed?: (speed: number) => void;
    resizeMode?: 'contain' | 'cover' | 'stretch';
    onSelectResizeMode?: (mode: 'contain' | 'cover' | 'stretch') => void;
    
    // Engine Settings
    decoderMode?: 'auto' | 'sw' | 'hw' | 'hw+';
    onSelectDecoderMode?: (mode: 'auto' | 'sw' | 'hw' | 'hw+') => void;
    gpuMode?: 'gpu' | 'gpu-next';
    onSelectGpuMode?: (mode: 'gpu' | 'gpu-next') => void;
}

const SPEEDS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const RESIZE_MODES = [
    { label: 'Fit', value: 'contain' as const },
    { label: 'Fill', value: 'cover' as const },
    { label: 'Stretch', value: 'stretch' as const },
];

const DECODER_MODES = [
    { label: 'Auto', value: 'auto' as const },
    { label: 'HW', value: 'hw' as const },
    { label: 'HW+', value: 'hw+' as const },
    { label: 'SW', value: 'sw' as const },
];

const GPU_MODES = [
    { label: 'Default (GPU)', value: 'gpu' as const },
    { label: 'GPU Next (High Quality)', value: 'gpu-next' as const },
];

export function SettingsTab({
    playbackSpeed = 1.0,
    onSelectSpeed,
    resizeMode = 'contain',
    onSelectResizeMode,
    decoderMode = 'auto',
    onSelectDecoderMode,
    gpuMode = 'gpu',
    onSelectGpuMode
}: SettingsTabProps) {
    const { theme } = useTheme();
    const surfaceContainerHigh = (theme.colors as any).surfaceContainerHigh || theme.colors.surfaceVariant;

    return (
        <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.section}>
                <Typography variant="title-medium" style={{ color: theme.colors.onSurface, marginBottom: 12 }}>
                    Video Aspect Ratio
                </Typography>
                <View style={styles.grid}>
                    {RESIZE_MODES.map((mode) => {
                        const isSelected = mode.value === resizeMode;
                        return (
                            <Pressable
                                key={mode.value}
                                onPress={() => onSelectResizeMode?.(mode.value)}
                                style={[
                                    styles.pill,
                                    {
                                        backgroundColor: isSelected
                                            ? theme.colors.primary
                                            : surfaceContainerHigh
                                    }
                                ]}
                            >
                                <Typography
                                    variant="label-medium"
                                    style={{
                                        color: isSelected
                                            ? theme.colors.onPrimary
                                            : theme.colors.onSurface
                                    }}
                                >
                                    {mode.label}
                                </Typography>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            <View style={styles.section}>
                <Typography variant="title-medium" style={{ color: theme.colors.onSurface, marginBottom: 12 }}>
                    Playback Speed
                </Typography>
                <View style={styles.grid}>
                    {SPEEDS.map((speed) => {
                        const isSelected = speed === playbackSpeed;
                        return (
                            <Pressable
                                key={speed}
                                onPress={() => onSelectSpeed?.(speed)}
                                style={[
                                            styles.pill,
                                            {
                                                backgroundColor: isSelected
                                                    ? theme.colors.primary
                                                    : surfaceContainerHigh
                                            }
                                        ]}
                                    >
                                <Typography
                                    variant="label-medium"
                                    style={{
                                        color: isSelected
                                            ? theme.colors.onPrimary
                                            : theme.colors.onSurface
                                    }}
                                >
                                    {speed}x
                                </Typography>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            {/* Decoder Settings */}
            <View style={styles.section}>
                <Typography variant="title-medium" style={{ color: theme.colors.onSurface, marginBottom: 12 }}>
                    Decoder Mode (MPV)
                </Typography>
                <Typography variant="body-small" style={{ color: theme.colors.outline, marginBottom: 8 }}>
                    Controls hardware acceleration. Use 'Auto' usually. 'HW+' is mostly for Mediatek/Exynos.
                </Typography>
                <View style={styles.grid}>
                    {DECODER_MODES.map((mode) => {
                        const isSelected = mode.value === decoderMode;
                        return (
                            <Pressable
                                key={mode.value}
                                onPress={() => onSelectDecoderMode?.(mode.value)}
                                style={[
                                    styles.pill,
                                    {
                                        backgroundColor: isSelected
                                            ? theme.colors.primary
                                            : surfaceContainerHigh
                                    }
                                ]}
                            >
                                <Typography
                                    variant="label-medium"
                                    style={{
                                        color: isSelected
                                            ? theme.colors.onPrimary
                                            : theme.colors.onSurface
                                    }}
                                >
                                    {mode.label}
                                </Typography>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            {/* GPU Settings */}
            <View style={styles.section}>
                <Typography variant="title-medium" style={{ color: theme.colors.onSurface, marginBottom: 12 }}>
                    GPU Renderer (MPV)
                </Typography>
                <Typography variant="body-small" style={{ color: theme.colors.outline, marginBottom: 8 }}>
                    'GPU Next' offers higher quality scaling but uses more battery.
                </Typography>
                <View style={styles.grid}>
                    {GPU_MODES.map((mode) => {
                        const isSelected = mode.value === gpuMode;
                        return (
                            <Pressable
                                key={mode.value}
                                onPress={() => onSelectGpuMode?.(mode.value)}
                                style={[
                                    styles.pill,
                                    {
                                        backgroundColor: isSelected
                                            ? theme.colors.primary
                                            : surfaceContainerHigh
                                    }
                                ]}
                            >
                                <Typography
                                    variant="label-medium"
                                    style={{
                                        color: isSelected
                                            ? theme.colors.onPrimary
                                            : theme.colors.onSurface
                                    }}
                                >
                                    {mode.label}
                                </Typography>
                            </Pressable>
                        );
                    })}
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: {
        gap: 24,
    },
    section: {

    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    pill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    }
});
