import { useTheme } from '@/src/core/ThemeContext';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { forwardRef, useCallback, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Typography } from './Typography';

interface BottomSheetProps {
    title?: string;
    children: React.ReactNode;
    snapPoints?: (string | number)[];
    index?: number;
    scrollable?: boolean;
    enableDynamicSizing?: boolean;
    maxHeight?: number;
    onDismiss?: () => void;
}

export type BottomSheetRef = BottomSheetModal;

export const CustomBottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(({
    title,
    children,
    snapPoints,
    index = 0,
    scrollable = true,
    enableDynamicSizing = true,
    maxHeight,
    onDismiss
}, ref) => {
    const { theme } = useTheme();
    const { height: SCREEN_HEIGHT } = Dimensions.get('window');

    const finalMaxHeight = maxHeight || SCREEN_HEIGHT * 0.7;

    const finalSnapPoints = useMemo(() => {
        if (enableDynamicSizing) return undefined;
        return snapPoints || ['50%', '90%'];
    }, [enableDynamicSizing, snapPoints]);

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
            snapPoints={finalSnapPoints}
            enableDynamicSizing={enableDynamicSizing}
            maxDynamicContentSize={finalMaxHeight}
            backdropComponent={renderBackdrop}
            backgroundStyle={backgroundStyle}
            handleIndicatorStyle={handleStyle}
            enablePanDownToClose={true}
            style={styles.modal}
            onDismiss={onDismiss}
        >
            <View style={styles.container}>
                {title && (
                    <View style={styles.header}>
                        <Typography
                            variant="display-small"
                            weight="black"
                            rounded={true}
                            style={{
                                color: theme.colors.onSurface,
                                letterSpacing: -0.5,
                                fontSize: 32,
                            }}
                        >
                            {title}
                        </Typography>
                    </View>
                )}
                {scrollable ? (
                    <BottomSheetScrollView contentContainerStyle={styles.content}>
                        {children}
                    </BottomSheetScrollView>
                ) : (
                    <View style={styles.container}>
                        {children}
                    </View>
                )}
            </View>
        </BottomSheetModal>
    );
});

const styles = StyleSheet.create({
    modal: {
        // MD3 sheets are full width on mobile
    },
    container: {
        // Removed flex: 1 to allow stable measurement with enableDynamicSizing
    },
    header: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: 12, // Space from handle
    },
    content: {
        paddingBottom: 40,
    }
});
