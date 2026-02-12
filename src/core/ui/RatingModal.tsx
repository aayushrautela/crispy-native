
import { useTheme } from '@/src/core/ThemeContext';
import { BottomSheetRef, CustomBottomSheet } from '@/src/core/ui/BottomSheet';
import { Typography } from '@/src/core/ui/Typography';
import { Star } from 'lucide-react-native';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface RatingModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    initialRating?: number | null; // 1-10 scale from Trakt
    onRate: (rating: number) => void; // 1-5 scale internally
    onRemoveRating: () => void;
}

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
                    size={36} // Larger stars for sheet
                    color={filled ? '#FFD700' : theme.colors.outline}
                    fill={filled ? '#FFD700' : 'transparent'}
                />
            </Animated.View>
        </Pressable>
    );
};

export const RatingModal = ({ visible, onClose, title, initialRating, onRate, onRemoveRating }: RatingModalProps) => {
    const { theme } = useTheme();
    const sheetRef = useRef<BottomSheetRef>(null);
    const { height: windowHeight } = useWindowDimensions();
    const { bottom } = useSafeAreaInsets();

    // We maintain internal rating state for the UI interaction
    const [rating, setRating] = useState<number>(0);

    const normalizedInitialRating = useMemo(() => {
        if (!initialRating || initialRating <= 0) return 0;
        return Math.max(0, Math.min(5, Math.round(initialRating / 2)));
    }, [initialRating]);

    const hasExistingRating = useMemo(() => {
        return initialRating !== null && initialRating !== undefined && initialRating > 0;
    }, [initialRating]);

    const snapPoint = useMemo(() => {
        const targetHeight = Math.round(windowHeight * 0.5);
        return Math.max(340, Math.min(targetHeight, 460));
    }, [windowHeight]);

    const contentBottomPadding = useMemo(() => Math.max(bottom, 16), [bottom]);

    useLayoutEffect(() => {
        if (visible) {
            setRating(normalizedInitialRating);
        }
    }, [visible, normalizedInitialRating]);

    useEffect(() => {
        if (visible) {
            sheetRef.current?.present();
            return;
        }

        sheetRef.current?.dismiss();
    }, [visible]);

    const handleRate = () => {
        onRate(rating);
        onClose();
    };

    const handleRemove = () => {
        onRemoveRating();
        onClose();
    };

    return (
        <CustomBottomSheet
            ref={sheetRef}
            onDismiss={onClose}
            enableDynamicSizing={false}
            snapPoints={[snapPoint]}
            scrollable={false}
            contentPaddingHorizontal={0}
            contentPaddingBottom={contentBottomPadding}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Typography variant="title-large" weight="bold" style={{ color: theme.colors.onSurface, textAlign: 'center' }}>
                        Rate {`"${title}"`}
                    </Typography>
                    <Typography variant="body-medium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 4 }}>
                        What did you think?
                    </Typography>
                </View>

                {/* Stars */}
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

                {/* Actions */}
                <View style={styles.footer}>
                    {hasExistingRating && (
                        <Pressable
                            onPress={handleRemove}
                            style={({ pressed }) => [
                                styles.button,
                                styles.removeBtn,
                                {
                                    borderColor: theme.colors.error,
                                    backgroundColor: pressed ? theme.colors.error + '10' : 'transparent'
                                }
                            ]}
                        >
                            <Typography variant="label-large" weight="bold" style={{ color: theme.colors.error }}>
                                Remove
                            </Typography>
                        </Pressable>
                    )}
                    <Pressable
                        onPress={handleRate}
                        style={({ pressed }) => [
                            styles.button,
                            {
                                backgroundColor: theme.colors.primary,
                                opacity: pressed ? 0.9 : 1,
                                flex: 1
                            }
                        ]}
                    >
                        <Typography variant="label-large" weight="bold" style={{ color: theme.colors.onPrimary }}>
                            Rate {rating}/5
                        </Typography>
                    </Pressable>
                </View>

            </View>
        </CustomBottomSheet>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 24,
        gap: 24,
        paddingTop: 12,
        paddingBottom: 0, // Explicitly zero
    },
    header: {
        alignItems: 'center',
    },
    starsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    removeBtn: {
        borderWidth: 1,
    }
});
