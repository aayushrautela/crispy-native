import { ExpressiveSwitch } from '@/src/core/ui/ExpressiveSwitch';
import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { SettingsItem } from '@/src/core/ui/SettingsItem';
import { Typography } from '@/src/core/ui/Typography';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { FastForward, PlayCircle, Settings2 } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const ENGINES = [
    { label: 'Auto', value: 'auto' },
    { label: 'ExoPlayer', value: 'exoplayer' },
    { label: 'MPV', value: 'mpv' },
];

const SKIP_MODES = [
    { label: 'Off', value: 'off' },
    { label: 'Manual', value: 'manual' },
    { label: 'Auto', value: 'auto' },
];

export default function PlaybackScreen() {
    const { theme } = useTheme();
    const { settings, updateSettings } = useUserStore();
    const { videoPlayerEngine, autoplayEnabled, introSkipMode } = settings;

    return (
        <SettingsSubpage title="Playback">
            <View>
                <SettingsGroup title="Player Engine">
                    <SettingsItem
                        icon={Settings2}
                        label="Video Engine"
                        description="Select the library used for playback"
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
                                        onPress={() => updateSettings({ videoPlayerEngine: engine.value as any })}
                                        style={[
                                            styles.chip,
                                            {
                                                backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceContainerHigh,
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
                                                backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceContainerHigh,
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
