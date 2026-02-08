import type { AiInsightsResult, InsightCard } from '@/src/features/meta/hooks/useAiInsights';
import { useTheme } from '@/src/core/ThemeContext';
import { Typography } from '@/src/core/ui/Typography';
import { Brain, Flame, Lightbulb, Palette, Sparkles, User, X, Zap, AlertCircle } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View, Dimensions, SafeAreaView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AiInsightsStoryProps {
    visible: boolean;
    onClose: () => void;
    insights: AiInsightsResult | null;
}

const getIconForType = (type: string, size: number = 32) => {
    switch (type) {
        case 'consensus': return <Brain size={size} color="#60A5FA" />;
        case 'performance': return <Flame size={size} color="#34D399" />;
        case 'style': return <Palette size={size} color="#A78BFA" />;
        case 'vibe': return <Sparkles size={size} color="#FBBF24" />;
        case 'controversy': return <AlertCircle size={size} color="#F87171" />;
        case 'character': return <User size={size} color="#FB923C" />;
        default: return <Zap size={size} color="#E879F9" />;
    }
};

const getTextColorForType = (type: string) => {
    switch (type) {
        case 'consensus': return '#60A5FA';
        case 'performance': return '#34D399';
        case 'style': return '#A78BFA';
        case 'vibe': return '#FBBF24';
        case 'controversy': return '#F87171';
        case 'character': return '#FB923C';
        default: return '#E879F9';
    }
};

export const AiInsightsStory = ({ visible, onClose, insights }: AiInsightsStoryProps) => {
    const { theme } = useTheme();
    const [currentIndex, setCurrentIndex] = useState(0);

    const totalPages = (insights?.insights?.length || 0) + (insights?.trivia ? 1 : 0);

    useEffect(() => {
        if (visible) {
            setCurrentIndex(0);
        }
    }, [visible]);

    const handleNext = () => {
        if (currentIndex < totalPages - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const handlePress = (evt: any) => {
        const x = evt.nativeEvent.locationX;
        if (x < SCREEN_WIDTH * 0.3) {
            handlePrev();
        } else {
            handleNext();
        }
    };

    if (!insights || totalPages === 0) return null;

    const renderPage = () => {
        if (currentIndex < (insights.insights?.length || 0)) {
            const insight = insights.insights[currentIndex];
            return (
                <View style={styles.pageContent}>
                    <View style={styles.iconContainer}>
                        {getIconForType(insight.type)}
                    </View>
                    <Typography
                        variant="label"
                        weight="black"
                        style={{ color: getTextColorForType(insight.type), marginBottom: 8 }}
                    >
                        {insight.category}
                    </Typography>
                    <Typography variant="h2" weight="black" style={{ color: 'white', marginBottom: 16 }}>
                        {insight.title}
                    </Typography>
                    <Typography variant="body-large" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 28 }}>
                        {insight.content}
                    </Typography>
                </View>
            );
        } else {
            return (
                <View style={styles.pageContent}>
                    <View style={styles.iconContainer}>
                        <Lightbulb size={32} color="#EAB308" />
                    </View>
                    <Typography
                        variant="label"
                        weight="black"
                        style={{ color: '#EAB308', marginBottom: 8 }}
                    >
                        DID YOU KNOW?
                    </Typography>
                    <Typography variant="body-large" style={{ color: 'white', fontSize: 24, lineHeight: 34, fontWeight: '700' }}>
                        {insights.trivia}
                    </Typography>
                </View>
            );
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={false}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={[styles.container, { backgroundColor: '#050505' }]}>
                <SafeAreaView style={styles.safeArea}>
                    {/* Progress Bars */}
                    <View style={styles.progressContainer}>
                        {Array.from({ length: totalPages }).map((_, i) => (
                            <View key={i} style={styles.progressBarBg}>
                                <View
                                    style={[
                                        styles.progressBarFill,
                                        {
                                            width: i < currentIndex ? '100%' : i === currentIndex ? '50%' : '0%', // Static 50% for now as we don't have timer yet
                                            backgroundColor: 'white'
                                        }
                                    ]}
                                />
                            </View>
                        ))}
                    </View>

                    {/* Header */}
                    <View style={styles.header}>
                        <Typography variant="title-medium" weight="bold" style={{ color: 'white' }}>
                            AI Insights
                        </Typography>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <X color="white" size={24} />
                        </Pressable>
                    </View>

                    {/* Interaction Area */}
                    <Pressable onPress={handlePress} style={styles.touchArea}>
                        {renderPage()}
                    </Pressable>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Typography variant="label-small" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            Tap on sides to navigate
                        </Typography>
                    </View>
                </SafeAreaView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    progressContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 12,
        gap: 4,
    },
    progressBarBg: {
        flex: 1,
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 1,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    closeBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    touchArea: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    pageContent: {
        alignItems: 'flex-start',
    },
    iconContainer: {
        marginBottom: 24,
        padding: 12,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    footer: {
        paddingBottom: 32,
        alignItems: 'center',
    }
});
