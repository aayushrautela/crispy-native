import type { AiInsightsResult, InsightCard } from '@/src/core/hooks/useAiInsights';
import { useTheme } from '@/src/core/ThemeContext';
import { ExpressiveSurface } from '@/src/core/ui/ExpressiveSurface';
import { Typography } from '@/src/core/ui/Typography';
import { AlertCircle, Brain, Flame, Lightbulb, Palette, Sparkles, User, X, Zap } from 'lucide-react-native';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AIInsightsCarouselProps {
    insights: AiInsightsResult | null;
    isLoading: boolean;
    onGenerate: () => void;
}

const getIconForType = (type: string, size: number = 16) => {
    switch (type) {
        case 'consensus': return <Brain size={size} color="#60A5FA" />; // blue-400
        case 'performance': return <Flame size={size} color="#34D399" />; // emerald-400
        case 'style': return <Palette size={size} color="#A78BFA" />; // purple-400
        case 'vibe': return <Sparkles size={size} color="#FBBF24" />; // amber-400
        case 'controversy': return <AlertCircle size={size} color="#F87171" />; // red-400
        case 'character': return <User size={size} color="#FB923C" />; // orange-400
        default: return <Zap size={size} color="#E879F9" />;
    }
};

const getTextColorForType = (type: string, theme: any) => {
    switch (type) {
        case 'consensus': return '#60A5FA';
        case 'performance': return '#34D399';
        case 'style': return '#A78BFA';
        case 'vibe': return '#FBBF24';
        case 'controversy': return '#F87171';
        case 'character': return '#FB923C';
        default: return theme.colors.primary;
    }
};

export const AIInsightsCarousel = ({ insights, isLoading, onGenerate }: AIInsightsCarouselProps) => {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const [selectedInsight, setSelectedInsight] = useState<InsightCard | string | null>(null);

    if (!insights && !isLoading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Sparkles size={20} color={theme.colors.primary} />
                        <Typography variant="h3" weight="black" style={{ color: 'white' }}>AI Insights</Typography>
                    </View>
                    <Pressable onPress={onGenerate}>
                        <ExpressiveSurface variant="filled" rounding="3xl" style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                            <Typography variant="label" weight="bold" style={{ color: theme.colors.primary }}>Generate</Typography>
                        </ExpressiveSurface>
                    </Pressable>
                </View>
            </View>
        );
    }

    if (isLoading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Sparkles size={20} color={theme.colors.primary} />
                        <Typography variant="h3" weight="black" style={{ color: 'white' }}>Generating...</Typography>
                    </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
                    {[1, 2, 3].map(i => (
                        <View key={i} style={[styles.cardStub, { backgroundColor: theme.colors.surfaceVariant }]} />
                    ))}
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={20} color={theme.colors.primary} />
                    <Typography variant="h3" weight="black" style={{ color: 'white' }}>AI Insights</Typography>
                </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
                {insights?.insights.map((insight, i) => (
                    <Pressable key={i} onPress={() => setSelectedInsight(insight)}>
                        <ExpressiveSurface variant="filled" rounding="lg" style={styles.card}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                {getIconForType(insight.type, 14)}
                                <Typography
                                    variant="label"
                                    weight="black"
                                    style={{ fontSize: 10, color: getTextColorForType(insight.type, theme), textTransform: 'uppercase' }}
                                >
                                    {insight.category}
                                </Typography>
                            </View>
                            <Typography variant="body" weight="bold" numberOfLines={2} style={{ color: 'white', fontSize: 13, marginBottom: 4 }}>
                                {insight.title}
                            </Typography>
                            <Typography variant="label" numberOfLines={3} style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
                                {insight.content}
                            </Typography>
                        </ExpressiveSurface>
                    </Pressable>
                ))}

                {insights?.trivia && (
                    <Pressable onPress={() => setSelectedInsight(insights.trivia)}>
                        <ExpressiveSurface variant="filled" rounding="lg" style={styles.card}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <Lightbulb size={14} color="#EAB308" />
                                <Typography variant="label" weight="black" style={{ fontSize: 10, color: '#EAB308', textTransform: 'uppercase' }}>
                                    DID YOU KNOW?
                                </Typography>
                            </View>
                            <Typography variant="label" numberOfLines={5} style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
                                {insights.trivia}
                            </Typography>
                        </ExpressiveSurface>
                    </Pressable>
                )}
            </ScrollView>

            <Modal visible={!!selectedInsight} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedInsight(null)}>
                <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
                    <View style={styles.modalHeader}>
                        <Pressable onPress={() => setSelectedInsight(null)} style={styles.closeBtn}>
                            <X color={theme.colors.onSurface} size={24} />
                        </Pressable>
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 24 }}>
                        {typeof selectedInsight === 'string' ? (
                            <>
                                <View style={[styles.pill, { backgroundColor: '#EAB3081A', borderColor: '#EAB30833' }]}>
                                    <Lightbulb size={24} color="#EAB308" />
                                    <Typography variant="h3" weight="black" style={{ color: '#EAB308' }}>FUN FACT</Typography>
                                </View>
                                <Typography variant="body" style={{ color: theme.colors.onSurface, fontSize: 18, lineHeight: 28, marginTop: 24 }}>
                                    {selectedInsight}
                                </Typography>
                            </>
                        ) : selectedInsight && (
                            <>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                                    {getIconForType(selectedInsight.type, 32)}
                                    <Typography
                                        variant="h2"
                                        weight="black"
                                        style={{ color: getTextColorForType(selectedInsight.type, theme), textTransform: 'uppercase' }}
                                    >
                                        {selectedInsight.category}
                                    </Typography>
                                </View>
                                <Typography variant="h3" weight="black" style={{ color: 'white', marginBottom: 16 }}>
                                    {selectedInsight.title}
                                </Typography>
                                <Typography variant="body" style={{ color: theme.colors.onSurfaceVariant, fontSize: 16, lineHeight: 24 }}>
                                    {selectedInsight.content}
                                </Typography>
                            </>
                        )}
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    card: {
        width: 180,
        height: 140,
        padding: 16,
    },
    cardStub: {
        width: 180,
        height: 140,
        borderRadius: 12,
    },
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        padding: 16,
        alignItems: 'flex-end',
    },
    closeBtn: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        alignSelf: 'flex-start',
    }
});
