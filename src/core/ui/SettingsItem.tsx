import { useTheme } from '@/src/core/ThemeContext';
import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Touchable } from './Touchable';
import { Typography } from './Typography';

interface SettingsItemProps {
    label: string;
    icon?: React.ElementType; // Better type for Lucide icons
    rightElement?: React.ReactNode;
    onPress?: () => void;
    showChevron?: boolean;
    description?: string;
    iconColor?: string; // Allow custom icon colors
}

export function SettingsItem({
    label,
    icon: Icon,
    rightElement,
    onPress,
    showChevron = true,
    description,
    iconColor,
}: SettingsItemProps) {
    const { theme } = useTheme();

    const activeIconColor = iconColor || theme.colors.primary;

    return (
        <Touchable
            onPress={onPress}
            style={styles.container}
            feedbackType="opacity"
        >
            <View style={styles.left}>
                {Icon && (
                    <View style={[styles.iconCircle, { backgroundColor: theme.colors.secondaryContainer }]}>
                        <Icon size={24} color={theme.colors.onSecondaryContainer} />
                    </View>
                )}
                <View style={styles.textContainer}>
                    <Typography
                        variant="body-large" // M3 uses larger body text for lists
                        weight="regular"     // Regular weight is cleaner
                        style={{ color: theme.colors.onSurface }}
                    >
                        {label}
                    </Typography>
                    {description && (
                        <Typography
                            variant="body-small"
                            style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
                        >
                            {description}
                        </Typography>
                    )}
                </View>
            </View>

            <View style={styles.right}>
                {rightElement}
                {showChevron && !rightElement && (
                    <ChevronRight size={24} color={theme.colors.outline} />
                )}
            </View>
        </Touchable>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 18, // Increase touch target
        paddingHorizontal: 20, // Match card margins
        minHeight: 72, // Android standards
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 16,
    },
    iconCircle: {
        width: 48, // Large touch-friendly circle
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
        flex: 1,
        paddingRight: 8,
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 8,
    }
});
