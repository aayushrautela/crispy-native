import { Typography } from '@/src/core/ui/Typography';
import { useTheme } from '@/src/core/ThemeContext';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

interface SettingsTabProps {
    playbackSpeed?: number;
    onSelectSpeed?: (speed: number) => void;
    currentEngine?: 'exo' | 'mpv';
    // Add more settings as needed
}

const SPEEDS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export function SettingsTab({
    playbackSpeed = 1.0,
    onSelectSpeed
}: SettingsTabProps) {
    const { theme } = useTheme();
    const surfaceContainerHigh = (theme.colors as any).surfaceContainerHigh || theme.colors.surfaceVariant;

    return (
        <ScrollView contentContainerStyle={styles.content}>
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
