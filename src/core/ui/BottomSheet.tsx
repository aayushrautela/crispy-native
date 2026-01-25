import { useTheme } from '@/src/core/ThemeContext';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { BackHandler, Dimensions, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    const { bottom } = useSafeAreaInsets();
    const { height: SCREEN_HEIGHT } = Dimensions.get('window');
    const modalRef = useRef<BottomSheetModal>(null);
    const [isOpen, setIsOpen] = useState(false);

    // Expose the modal ref to the parent
    useImperativeHandle(ref, () => modalRef.current!);

    // Handle Hardware Back Button on Android
    useEffect(() => {
        if (!isOpen) return;

        const onBackPress = () => {
            if (isOpen) {
                modalRef.current?.dismiss();
                return true; // Prevent default behavior (navigation)
            }
            return false;
        };

        // Add listener with a higher priority (10) to ensure it intercepts before navigation
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

        return () => subscription.remove();
    }, [isOpen]);

    const handleAnimate = useCallback((fromIndex: number, toIndex: number) => {
        // Sheet is "open" if it's moving to any index >= 0
        setIsOpen(toIndex > -1);
    }, []);

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
            ref={modalRef}
            index={index}
            snapPoints={finalSnapPoints}
            enableDynamicSizing={enableDynamicSizing}
            maxDynamicContentSize={finalMaxHeight}
            backdropComponent={renderBackdrop}
            backgroundStyle={backgroundStyle}
            handleIndicatorStyle={handleStyle}
            enablePanDownToClose={true}
            style={styles.modal}
            onDismiss={() => {
                setIsOpen(false);
                onDismiss?.();
            }}
            onAnimate={handleAnimate}
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
                    <BottomSheetScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(bottom, 24) + 80 }]}>
                        {children}
                    </BottomSheetScrollView>
                ) : (
                    <View style={[styles.container, { paddingBottom: Math.max(bottom, 24) + 80 }]}>
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
        // Padding bottom is handled dynamically based on safe area
    }
});
