import { Typography } from '@/src/core/ui/Typography';
import { useTheme } from '@/src/core/ThemeContext';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface SettingsGroupProps {
    title?: string;
    children: React.ReactNode;
    style?: ViewStyle;
}

export function SettingsGroup({ title, children, style }: SettingsGroupProps) {
    const { theme } = useTheme();

    // Clone children to add separators
    const childrenArray = React.Children.toArray(children);
    const childrenWithSeparators = childrenArray.map((child, index) => {
        const isLast = index === childrenArray.length - 1;
        return (
            <React.Fragment key={index}>
                {child}
                {!isLast && <View style={[styles.separator, { backgroundColor: theme.colors.outline, opacity: 0.1 }]} />}
            </React.Fragment>
        );
    });

    return (
        <View style={[styles.container, style]}>
            {title && (
                <Typography
                    variant="label-large"
                    weight="bold"
                    style={[styles.title, { color: theme.colors.primary }]}
                >
                    {title}
                </Typography>
            )}
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: theme.colors.surfaceContainerHigh,
                    }
                ]}
            >
                {childrenWithSeparators}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
    },
    title: {
        marginLeft: 20, // Align with card content indent
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        fontSize: 12,
        opacity: 0.8,
    },
    card: {
        borderRadius: 28, // Android 16 uses very large corner radii (approx 28dp)
        overflow: 'hidden',
        marginHorizontal: 16, // Increase side margins to create distinct card look
    },
    separator: {
        height: 1,
        marginLeft: 68, // Align with text start (Icon size + padding) to create indented separator
        marginRight: 20,
    }
});
