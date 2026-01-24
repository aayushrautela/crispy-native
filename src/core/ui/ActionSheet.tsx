
import { BottomSheetRef, CustomBottomSheet } from '@/src/core/ui/BottomSheet';
import { Typography } from '@/src/core/ui/Typography';
import { useTheme } from '@/src/core/ThemeContext';
import { Check } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
    const { bottom } = useSafeAreaInsets();
    // We strictly use the sheet's state to determine visibility from the UI

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
            enableDynamicSizing={true}
            scrollable={true}
        >
            <View style={[styles.content, { paddingBottom: bottom + 12 }]}>
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
