import { ExpressiveButton } from '@/src/cdk/components/ExpressiveButton';
import { Typography } from '@/src/cdk/components/Typography';
import { useTheme } from '@/src/core/ThemeContext';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface SectionHeaderProps {
    title: string;
    onAction?: () => void;
    actionLabel?: string;
    hideAction?: boolean;
    style?: ViewStyle;
}

export const SectionHeader = ({
    title,
    onAction,
    actionLabel = 'See All',
    hideAction = false,
    style
}: SectionHeaderProps) => {
    const { theme } = useTheme();

    return (
        <View style={[styles.header, style]}>
            <Typography
                variant="title-large"
                weight="black"
                style={{
                    color: theme.colors.onSurface,
                    letterSpacing: -0.5
                }}
            >
                {title}
            </Typography>
            {!hideAction && (
                <ExpressiveButton
                    title={actionLabel}
                    variant="text"
                    onPress={onAction || (() => { })}
                    size="sm"
                    style={styles.actionBtn}
                    textStyle={{ color: theme.colors.primary, fontWeight: '900' }}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        marginBottom: 8,
    },
    actionBtn: {
        marginRight: -12,
    },
});
