import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    Dimensions,
    Pressable,
    BackHandler
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/core/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InsightCard } from '../hooks/useAiInsights';
import { ExpressiveImage } from './ExpressiveImage';
import { TMDBMeta } from '@/src/core/services/TMDBService';

interface AiInsightsStoryProps {
    visible: boolean;
    insights: InsightCard[];
    trivia?: string;
    onClose: () => void;
    meta?: Partial<TMDBMeta>;
    backgroundColor?: string;
}

const getIconForType = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
        case 'consensus': return 'people';
        case 'performance': return 'flash';
        case 'theme': return 'color-palette';
        case 'vibe': return 'musical-notes';
        case 'style': return 'brush';
        case 'performance_actor': return 'person';
        case 'controversy': return 'alert-circle';
        case 'character': return 'body';
        case 'trivia': return 'bulb';
        default: return 'analytics';
    }
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const AiInsightsStory: React.FC<AiInsightsStoryProps> = ({ visible, insights, trivia, onClose, meta, backgroundColor }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const insets = useSafeAreaInsets();
    const { theme } = useTheme();

    const effectiveBg = backgroundColor || (theme.dark ? '#000' : '#fff');
    const isDark = theme.dark; // Or calculate brightness of effectiveBg if needed, but project uses theme.dark usually

    const allInsights = React.useMemo(() => {
        const base = [...insights];
        if (trivia) {
            base.push({
                type: 'trivia',
                category: 'DID YOU KNOW?',
                title: 'Fun Fact',
                content: trivia
            });
        }
        return base;
    }, [insights, trivia]);

    const storyImage = React.useMemo(() => {
        if (!meta || !meta.backdrops || meta.backdrops.length === 0) {
            console.log(`[AiInsightsStory] No backdrops available, using poster: ${meta?.poster ? 'YES' : 'NO'}`);
            return meta?.poster;
        }
        // Use the index to cycle through backdrops for each slide
        // We skip index 0 (main backdrop) if possible, starting from index 1
        const galleryIndex = (currentIndex + 1) % meta.backdrops.length;
        const selected = meta.backdrops[galleryIndex];
        console.log(`[AiInsightsStory] Slide ${currentIndex}, Gallery index: ${galleryIndex}, Total backdrops: ${meta.backdrops.length}`);
        console.log(`[AiInsightsStory] Selected backdrop: ${selected.substring(0, 60)}...`);
        return selected;
    }, [meta, currentIndex]);

    if (!visible || allInsights.length === 0) {
        return null;
    }

    const handleClose = () => {
        setCurrentIndex(0);
        onClose();
    };

    const handleNext = () => {
        if (currentIndex < allInsights.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            handleClose();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const handlePress = (evt: any) => {
        const x = evt.nativeEvent.locationX;
        if (x < SCREEN_WIDTH / 3) {
            handlePrev();
        } else {
            handleNext();
        }
    };

    const currentInsight = allInsights[currentIndex];

    if (!currentInsight) {
        return null;
    }

    return (
        <View style={[styles.container, { backgroundColor: effectiveBg }]}>
            <Pressable style={styles.pressArea} onPress={handlePress}>
                <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
                    <View style={styles.header}>
                        <View style={styles.typeBadge}>
                            <Ionicons 
                                name={getIconForType(currentInsight.type)} 
                                size={16} 
                                color="#FFD700" 
                            />
                            <Text style={styles.typeText}>{(currentInsight.category || currentInsight.type).toUpperCase()}</Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Ionicons name="close" size={28} color="white" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.title}>{currentInsight.title}</Text>
                    {storyImage && (
                        <View style={styles.imageContainer}>
                            <ExpressiveImage uri={storyImage} size={SCREEN_WIDTH * 0.7} />
                        </View>
                    )}
                    <Text style={styles.bodyText}>{currentInsight.content}</Text>
                </View>
            </Pressable>

            {/* Indicators */}
            <View style={[styles.indicatorContainer, { top: insets.top + 20 }]}>
                {allInsights.map((_, i) => (
                    <View key={i} style={styles.indicatorBackground}>
                        <View 
                            style={[
                                styles.indicatorFill,
                                { width: i <= currentIndex ? '100%' : '0%' }
                            ]} 
                        />
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
    },
    pressArea: {
        flex: 1,
    },
    indicatorContainer: {
        flexDirection: 'row',
        paddingHorizontal: 10,
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 10,
    },
    indicatorBackground: {
        flex: 1,
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.3)',
        marginHorizontal: 2,
        borderRadius: 1,
        overflow: 'hidden',
    },
    indicatorFill: {
        height: '100%',
        backgroundColor: 'white',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 6,
    },
    typeText: {
        color: '#FFD700',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    closeButton: {
        padding: 4,
    },
    title: {
        color: 'white',
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 20,
        lineHeight: 40,
    },
    bodyText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 18,
        lineHeight: 28,
    },
    imageContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 40,
    },
});

