import { Typography } from '@/src/core/ui/Typography';
import { useTheme } from '@/src/core/ThemeContext';
import { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    style?: ViewStyle;
}

export function EmptyState({ icon: Icon, title, description, style }: EmptyStateProps) {
    const { theme } = useTheme();

    return (
        <View style={[styles.container, style]}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
                <Icon size={32} color={theme.colors.onSurfaceVariant} />
            </View>
            <Typography
                variant="title-large"
                weight="bold"
                style={[styles.title, { color: theme.colors.onSurface }]}
            >
                {title}
            </Typography>
            {description && (
                <Typography
                    variant="body-medium"
                    style={[styles.description, { color: theme.colors.onSurfaceVariant }]}
                >
                    {description}
                </Typography>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        transform: [{ translateY: -120 }], // Move up by 120 pixels
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    title: {
        textAlign: 'center',
    },
    description: {
        marginTop: 8,
        textAlign: 'center',
    },
});
