
import { useTheme } from '@/src/core/ThemeContext';
import { BottomSheetRef, CustomBottomSheet } from '@/src/core/ui/BottomSheet';
import { Typography } from '@/src/core/ui/Typography';
import { Check } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ActionItem {
    id: string;
    label: string;
    icon?: React.ReactNode;
    onPress: () => void;
    destructive?: boolean;
    active?: boolean;
}

interface ActionSheetProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    actions: ActionItem[];
}

export const ActionSheet = ({ visible, onClose, title, actions }: ActionSheetProps) => {
    const { theme } = useTheme();
    const sheetRef = useRef<BottomSheetRef>(null);
    const { height: windowHeight } = useWindowDimensions();
    const { bottom } = useSafeAreaInsets();

    const estimatedContentHeight = useMemo(() => {
        const titleHeight = title ? 60 : 0;
        const actionRowsHeight = actions.length * 64;
        const verticalPadding = Math.max(bottom, 16);
        return titleHeight + actionRowsHeight + verticalPadding;
    }, [actions.length, bottom, title]);

    const maxSheetHeight = useMemo(() => Math.round(windowHeight * 0.75), [windowHeight]);
    const minSheetHeight = 180;

    const snapPoint = useMemo(() => {
        return Math.min(Math.max(estimatedContentHeight, minSheetHeight), maxSheetHeight);
    }, [estimatedContentHeight, maxSheetHeight]);

    const shouldScroll = estimatedContentHeight > maxSheetHeight;
    const contentBottomPadding = Math.max(bottom, 16);

    useEffect(() => {
        if (visible) {
            sheetRef.current?.present();
        } else {
            sheetRef.current?.dismiss();
        }
    }, [visible]);

    return (
        <CustomBottomSheet
            ref={sheetRef}
            title={title}
            onDismiss={onClose}
            enableDynamicSizing={false}
            snapPoints={[snapPoint]}
            scrollable={shouldScroll}
            contentPaddingHorizontal={0}
            contentPaddingBottom={contentBottomPadding}
        >
            <View style={styles.content}>
                {actions.map((action) => (
                    <Pressable
                        key={action.id}
                        onPress={() => {
                            // Dismiss first to allow animation
                            // Handling dismiss manually via onClose will re-trigger the effect
                            // So we just call onPress and let the sheet close via parent logic or internal dismiss
                            action.onPress();
                            onClose();
                        }}
                        style={({ pressed }) => [
                            styles.actionItem,
                            { backgroundColor: pressed ? theme.colors.surfaceContainerHighest : 'transparent' }
                        ]}
                    >
                        <View style={styles.iconContainer}>
                            {action.icon}
                        </View>
                        <Typography
                            variant="body-large" // updated to pair with new sheet
                            weight="bold"
                            style={{
                                color: action.destructive ? theme.colors.error : theme.colors.onSurface,
                                flex: 1
                            }}
                        >
                            {action.label}
                        </Typography>
                        {action.active && (
                            <Check size={20} color={theme.colors.primary} />
                        )}
                    </Pressable>
                ))}
            </View>
        </CustomBottomSheet>
    );
};

const styles = StyleSheet.create({
    content: {
        gap: 0,
        paddingBottom: 0,
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 24,
    },
    iconContainer: {
        width: 40,
        alignItems: 'flex-start',
    }
});
