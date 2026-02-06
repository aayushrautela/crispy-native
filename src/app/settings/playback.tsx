import { ExpressiveSwitch } from '@/src/core/ui/ExpressiveSwitch';
import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { SettingsItem } from '@/src/core/ui/SettingsItem';
import { Typography } from '@/src/core/ui/Typography';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { Cpu, FastForward, PlayCircle, Settings2, Zap } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const ENGINES = [
    { label: 'Auto', value: 'auto' },
    { label: 'MPV', value: 'mpv' },
] as const;

const DECODER_MODES = [
    { label: 'Auto', value: 'auto' },
    { label: 'HW+', value: 'hw+' },
    { label: 'HW', value: 'hw' },
    { label: 'SW', value: 'sw' },
] as const;

const GPU_MODES = [
    { label: 'Default (GPU)', value: 'gpu' },
    { label: 'GPU Next', value: 'gpu-next' },
];

const SKIP_MODES = [
    { label: 'Off', value: 'off' },
    { label: 'Manual', value: 'manual' },
    { label: 'Auto', value: 'auto' },
];

export default function PlaybackScreen() {
    const { theme } = useTheme();
    const { settings, updateSettings } = useUserStore();
    const { videoPlayerEngine, autoplayEnabled, introSkipMode, decoderMode, gpuMode } = settings;

    const surfaceContainerHigh = (theme.colors as any).surfaceContainerHigh || theme.colors.surfaceVariant;

    return (
        <SettingsSubpage title="Playback">
            <View>
                <SettingsGroup title="Player Engine">
                    <SettingsItem
                        icon={Settings2}
                        label="Video Engine"
                        description="Auto starts with ExoPlayer and falls back to MPV"
                        showChevron={false}
                    />
                    <View style={styles.pickerContainer}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.pickerScroll}
                        >
                            {ENGINES.map((engine) => {
                                const isSelected = videoPlayerEngine === engine.value;
                                return (
                                    <TouchableOpacity
                                        key={engine.value}
                                        onPress={() => updateSettings({ videoPlayerEngine: engine.value })}
                                        style={[
                                            styles.chip,
                                            {
                                                backgroundColor: isSelected ? theme.colors.primary : surfaceContainerHigh,
                                            }
                                        ]}
                                    >
                                        <Typography
                                            variant="label-large"
                                            style={{ color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface }}
                                        >
                                            {engine.label}
                                        </Typography>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </SettingsGroup>

                <SettingsGroup title="MPV Settings">
                    <SettingsItem
                        icon={Zap}
                        label="Decoder Mode"
                        description="Used by MPV (and Auto fallback)"
                        showChevron={false}
                    />
                    <View style={styles.pickerContainer}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.pickerScroll}
                        >
                            {DECODER_MODES.map((mode) => {
                                const isSelected = decoderMode === mode.value;
                                return (
                                    <TouchableOpacity
                                        key={mode.value}
                                        onPress={() => updateSettings({ decoderMode: mode.value })}
                                        style={[
                                            styles.chip,
                                            {
                                                backgroundColor: isSelected ? theme.colors.primary : surfaceContainerHigh,
                                            }
                                        ]}
                                    >
                                        <Typography
                                            variant="label-large"
                                            style={{ color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface }}
                                        >
                                            {mode.label}
                                        </Typography>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    <SettingsItem
                        icon={Cpu}
                        label="GPU Renderer"
                        description="Select GPU rendering quality"
                        showChevron={false}
                    />
                    <View style={styles.pickerContainer}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.pickerScroll}
                        >
                            {GPU_MODES.map((mode) => {
                                const isSelected = gpuMode === mode.value;
                                return (
                                    <TouchableOpacity
                                        key={mode.value}
                                        onPress={() => updateSettings({ gpuMode: mode.value as any })}
                                        style={[
                                            styles.chip,
                                            {
                                                backgroundColor: isSelected ? theme.colors.primary : surfaceContainerHigh,
                                            }
                                        ]}
                                    >
                                        <Typography
                                            variant="label-large"
                                            style={{ color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface }}
                                        >
                                            {mode.label}
                                        </Typography>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </SettingsGroup>

                <SettingsGroup title="Behavior">
                    <SettingsItem
                        icon={PlayCircle}
                        label="Autoplay"
                        description="Automatically play next episode"
                        rightElement={
                            <ExpressiveSwitch
                                value={autoplayEnabled}
                                onValueChange={(val) => updateSettings({ autoplayEnabled: val })}
                            />
                        }
                        showChevron={false}
                    />
                    <SettingsItem
                        icon={FastForward}
                        label="Intro Skip Mode"
                        description="How to handle intro skipping"
                        showChevron={false}
                    />
                    <View style={styles.pickerContainer}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.pickerScroll}
                        >
                            {SKIP_MODES.map((mode) => {
                                const isSelected = introSkipMode === mode.value;
                                return (
                                    <TouchableOpacity
                                        key={mode.value}
                                        onPress={() => updateSettings({ introSkipMode: mode.value as any })}
                                        style={[
                                            styles.chip,
                                            {
                                                backgroundColor: isSelected ? theme.colors.primary : surfaceContainerHigh,
                                            }
                                        ]}
                                    >
                                        <Typography
                                            variant="label-large"
                                            style={{ color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface }}
                                        >
                                            {mode.label}
                                        </Typography>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </SettingsGroup>
            </View>
        </SettingsSubpage>
    );
}

const styles = StyleSheet.create({
    pickerContainer: {
        paddingVertical: 12,
        paddingBottom: 20,
    },
    pickerScroll: {
        paddingHorizontal: 20,
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    }
});
