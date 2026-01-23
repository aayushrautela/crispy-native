
import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { Typography } from '@/src/cdk/components/Typography';
import { useTheme } from '@/src/core/ThemeContext';
import { Star, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface RatingModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    initialRating?: number | null; // 1-10 scale from Trakt
    onRate: (rating: number) => void; // 1-5 scale internally but we might map 1-10
    onRemoveRating: () => void;
}

const { width } = Dimensions.get('window');

const RatingStar = ({ index, filled, onPress }: { index: number, filled: boolean, onPress: () => void }) => {
    const { theme } = useTheme();
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    return (
        <Pressable
            onPress={() => {
                scale.value = withSpring(1.3, {}, () => {
                    scale.value = withSpring(1);
                });
                onPress();
            }}
            hitSlop={8}
        >
            <Animated.View style={animatedStyle}>
                <Star
                    size={32}
                    color={filled ? '#FFD700' : theme.colors.outline}
                    fill={filled ? '#FFD700' : 'transparent'}
                />
            </Animated.View>
        </Pressable>
    );
};

export const RatingModal = ({ visible, onClose, title, initialRating, onRate, onRemoveRating }: RatingModalProps) => {
    const { theme } = useTheme();
    // Trakt uses 1-10, but UI typically shows 5 stars (with halves? or just 10 stars?)
    // WebUI uses 10-star rating. Let's do 10 stars for precision if space allows, or 5 stars.
    // Spec says "Rate (1-10)". Let's try 5 stars where each star is 2 points, OR 10 stars.
    // 10 stars on mobile might be tight. Let's do 5 stars effectively mapping 1-10 (each click is +2)
    // Actually, Trakt is granular.
    // Let's implement 5 stars for now which map to 2, 4, 6, 8, 10.

    // Better: 10 stars in 2 rows? Or just 5 stars mapping to 2/4/6/8/10.
    // Let's stick to 5 stars UI = 2 points each for specific simplicity matching Mobile webui usually.
    // WAIT, WebUI desktop code showed: `onRate((rating) => ... rateContent(..., rating))`
    // Let's Assume 1-10 input.
    // Let's render 5 stars, but allow half-stars?
    // Let's keep it simple: 10 stars row might be too wide.
    // Let's do 5 stars. Rating 1 = 2 pt, 2 = 4 pt ... 5 = 10 pt.

    const [rating, setRating] = useState<number>(0);

    useEffect(() => {
        if (visible) {
            setRating(initialRating ? Math.round(initialRating / 2) : 0);
        }
    }, [visible, initialRating]);

    const handleRate = () => {
        onRate(rating); // Pass 1-5
        onClose();
    };

    const handleRemove = () => {
        onRemoveRating();
        onClose();
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <ExpressiveSurface
                    variant="elevated"
                    rounding="xl"
                    style={[styles.container, { backgroundColor: theme.colors.surface }]}
                >
                    <View style={styles.header}>
                        <Typography variant="h6" weight="bold" style={{ color: theme.colors.onSurface, flex: 1 }}>
                            Rate "{title}"
                        </Typography>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <X size={20} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                    </View>

                    <View style={styles.starsContainer}>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <RatingStar
                                key={i}
                                index={i}
                                filled={i <= rating}
                                onPress={() => setRating(i)}
                            />
                        ))}
                    </View>

                    <View style={styles.footer}>
                        {initialRating !== null && initialRating !== undefined && (
                            <Pressable
                                onPress={handleRemove}
                                style={[styles.button, styles.removeBtn]}
                            >
                                <Typography variant="label" weight="bold" style={{ color: theme.colors.error }}>
                                    Remove
                                </Typography>
                            </Pressable>
                        )}
                        <Pressable
                            onPress={handleRate}
                            style={[styles.button, { backgroundColor: theme.colors.primary, flex: 1 }]}
                        >
                            <Typography variant="label" weight="bold" style={{ color: theme.colors.onPrimary }}>
                                Rate {rating * 2}/10
                            </Typography>
                        </Pressable>
                    </View>
                </ExpressiveSurface>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    container: {
        width: '100%',
        maxWidth: 340,
        padding: 24,
        gap: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    closeBtn: {
        padding: 4,
    },
    starsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    button: {
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    removeBtn: {
        borderWidth: 1,
        borderColor: 'rgba(255,0,0,0.2)',
    }
});
