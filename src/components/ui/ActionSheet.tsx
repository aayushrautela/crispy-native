
import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { Typography } from '@/src/cdk/components/Typography';
import { useTheme } from '@/src/core/ThemeContext';
import { Check } from 'lucide-react-native';
import React from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';

const { width } = Dimensions.get('window');

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

    return (
        <Modal
            transparent
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <ExpressiveSurface
                    variant="elevated"
                    rounding="xl"
                    style={[styles.container, { backgroundColor: theme.colors.surface }]}
                >
                    {title && (
                        <View style={styles.header}>
                            <Typography variant="label" weight="black" style={{ color: theme.colors.onSurfaceVariant, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
                                {title}
                            </Typography>
                        </View>
                    )}

                    <View style={styles.content}>
                        {actions.map((action) => (
                            <Pressable
                                key={action.id}
                                onPress={() => {
                                    action.onPress();
                                    onClose();
                                }}
                                style={({ pressed }) => [
                                    styles.actionItem,
                                    { backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent' }
                                ]}
                            >
                                <View style={styles.iconContainer}>
                                    {action.icon}
                                </View>
                                <Typography
                                    variant="body"
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

                    {/* Safe Area Spacer for Bottom Sheet */}
                    <View style={{ height: 20 }} />
                </ExpressiveSurface>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    container: {
        width: '100%',
        paddingHorizontal: 16,
        paddingTop: 16,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    header: {
        paddingVertical: 12,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        marginBottom: 8,
    },
    content: {
        gap: 4,
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
    iconContainer: {
        width: 32,
        alignItems: 'flex-start',
    }
});
