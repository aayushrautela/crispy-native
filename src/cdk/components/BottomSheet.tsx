import { useTheme } from '@/src/core/ThemeContext';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { forwardRef, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Typography } from './Typography';

interface BottomSheetProps {
    title?: string;
    children: React.ReactNode;
    snapPoints?: string[];
    index?: number;
}

export type BottomSheetRef = BottomSheetModal;

export const CustomBottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(({
    title,
    children,
    snapPoints = ['45%', '90%'],
    index = 0
}, ref) => {
    const { theme } = useTheme();

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                pressBehavior="close"
            />
        ),
        []
    );

    const backgroundStyle = useMemo(() => ({
        backgroundColor: theme.colors.surfaceContainerHigh || theme.colors.surfaceVariant,
    }), [theme.colors.surfaceContainerHigh, theme.colors.surfaceVariant]);

    const handleStyle = useMemo(() => ({
        backgroundColor: theme.colors.outlineVariant,
    }), [theme.colors.outlineVariant]);

    return (
        <BottomSheetModal
            ref={ref}
            index={index}
            snapPoints={snapPoints}
            backdropComponent={renderBackdrop}
            backgroundStyle={backgroundStyle}
            handleIndicatorStyle={handleStyle}
            enablePanDownToClose={true}
        >
            <View style={styles.container}>
                {title && (
                    <View style={styles.header}>
                        <Typography
                            variant="display-small"
                            weight="bold"
                            rounded={true}
                            style={{
                                color: theme.colors.onSurface,
                                letterSpacing: -0.5,
                                fontSize: 34,
                            }}
                        >
                            {title}
                        </Typography>
                    </View>
                )}
                <BottomSheetScrollView contentContainerStyle={styles.content}>
                    {children}
                </BottomSheetScrollView>
            </View>
        </BottomSheetModal>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 26,
        paddingBottom: 24,
        paddingTop: 24,
    },
    content: {
        paddingBottom: 40,
    }
});
