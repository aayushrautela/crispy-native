import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface CustomSubtitlesProps {
    visible: boolean;
    text: string;
    fontSize?: number;
    bottomOffset?: number;
    textColor?: string;
    backgroundColor?: string;
    textShadow?: boolean;
}

export const CustomSubtitles: React.FC<CustomSubtitlesProps> = ({
    visible,
    text,
    fontSize = 24,
    bottomOffset = 40,
    textColor = '#FFFFFF',
    backgroundColor = 'transparent',
    textShadow = true,
}) => {
    if (!visible || !text) return null;

    return (
        <View style={[styles.container, { bottom: bottomOffset }]} pointerEvents="none">
            <View style={[styles.wrapper, { backgroundColor }]}>
                <Text
                    style={[
                        styles.text,
                        { fontSize, color: textColor },
                        textShadow && styles.shadow
                    ]}
                >
                    {text}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    wrapper: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 4,
    },
    text: {
        textAlign: 'center',
        fontWeight: '500',
    },
    shadow: {
        textShadowColor: 'rgba(0, 0, 0, 0.9)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
});
