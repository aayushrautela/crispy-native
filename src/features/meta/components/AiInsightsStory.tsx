import React, { useState } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    Dimensions,
    Pressable 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/core/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

interface AiInsightsStoryProps {
    visible: boolean;
    insights: Array<{
        title: string;
        content: string;
        type: 'fact' | 'recommendation' | 'analysis';
    }> | null;
    onClose: () => void;
}

export const AiInsightsStory: React.FC<AiInsightsStoryProps> = ({ visible, insights, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();

    if (!visible || !insights || insights.length === 0) {
        return null;
    }

    const handleClose = () => {
        setCurrentIndex(0);
        onClose();
    };

    const handleNext = () => {
        if (currentIndex < insights.length - 1) {
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
        if (x < width / 3) {
            handlePrev();
        } else {
            handleNext();
        }
    };

    const currentInsight = insights[currentIndex];

    if (!currentInsight) {
        return null;
    }

    return (
        <View style={styles.container}>
            <Pressable style={styles.pressArea} onPress={handlePress}>
                <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
                    <View style={styles.header}>
                        <View style={styles.typeBadge}>
                            <Ionicons 
                                name={
                                    currentInsight.type === 'fact' ? 'bulb' :
                                    currentInsight.type === 'recommendation' ? 'star' : 'analytics'
                                } 
                                size={16} 
                                color="#FFD700" 
                            />
                            <Text style={styles.typeText}>{currentInsight.type.toUpperCase()}</Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Ionicons name="close" size={28} color="white" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.title}>{currentInsight.title}</Text>
                    <Text style={styles.bodyText}>{currentInsight.content}</Text>
                </View>
            </Pressable>

            {/* Indicators */}
            <View style={[styles.indicatorContainer, { top: insets.top + 20 }]}>
                {insights.map((_, i) => (
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
        backgroundColor: '#000',
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
});

