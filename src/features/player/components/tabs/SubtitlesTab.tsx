import { useTheme } from '@/src/core/ThemeContext';
import { Typography } from '@/src/core/ui/Typography';
import { Clock, Minus, Plus } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

interface SubtitlesTabProps {
    delay?: number;
    onUpdateDelay?: (delay: number) => void;
}

export function SubtitlesTab({
    delay = 0,
    onUpdateDelay,
}: SubtitlesTabProps) {
    const { theme } = useTheme();
    const surfaceContainerHigh = (theme.colors as any).surfaceContainerHigh || theme.colors.surfaceVariant;

    return (
        <View style={styles.container}>
            {onUpdateDelay && (
                <View style={styles.content}>
                    <View style={styles.row}>
                        <View style={[styles.row, { flex: 1 }]}> 
                            <Clock size={16} color={theme.colors.onSurfaceVariant} />
                            <Typography variant="label-medium" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}>
                                DELAY
                            </Typography>
                        </View>
                        <Pressable onPress={() => onUpdateDelay(0)}>
                            <Typography variant="label-medium" style={{ color: theme.colors.primary }}>
                                RESET
                            </Typography>
                        </Pressable>
                    </View>
                    <View style={[styles.row, { marginTop: 12 }]}> 
                        <Pressable
                            onPress={() => onUpdateDelay((delay || 0) - 0.25)}
                            style={[styles.controlBtn, { backgroundColor: theme.colors.surfaceVariant }]}
                        >
                            <Minus size={20} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                        <View style={styles.valueBox}>
                            <Typography variant="title-medium" style={{ color: theme.colors.onSurface }}>
                                {(delay || 0).toFixed(2)}s
                            </Typography>
                        </View>
                        <Pressable
                            onPress={() => onUpdateDelay((delay || 0) + 0.25)}
                            style={[styles.controlBtn, { backgroundColor: theme.colors.surfaceVariant }]}
                        >
                            <Plus size={20} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        gap: 12,
    },
    content: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    controlBtn: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    valueBox: {
        flex: 1,
        alignItems: 'center',
    },
});
