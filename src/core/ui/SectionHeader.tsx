import { useTheme } from '@/src/core/ThemeContext';
import { ExpressiveButton } from '@/src/core/ui/ExpressiveButton';
import { Typography } from '@/src/core/ui/Typography';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface SectionHeaderProps {
    title: string;
    onAction?: () => void;
    actionLabel?: string;
    hideAction?: boolean;
    style?: ViewStyle;
    textColor?: string;
}

export const SectionHeader = ({
    title,
    onAction,
    actionLabel = 'See All',
    hideAction = false,
    style,
    textColor
}: SectionHeaderProps) => {
    const { theme } = useTheme();
    const showAction = !!onAction && !hideAction;

    return (
        <View style={[styles.header, style]}>
            <View style={styles.titleWrap}>
                <Typography
                    variant="h3"
                    weight="black"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                        color: textColor || theme.colors.onSurface,
                        letterSpacing: -0.5,
                        fontSize: 20,
                        lineHeight: 28,
                        paddingRight: 2,
                    }}
                >
                    {title}
                </Typography>
            </View>
            {showAction && (
                <ExpressiveButton
                    title={actionLabel}
                    variant="text"
                    onPress={onAction}
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
    titleWrap: {
        flex: 1,
        minWidth: 0,
        paddingRight: 12,
    },
    actionBtn: {
        marginRight: -12,
    },
});
