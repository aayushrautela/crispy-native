import React from 'react';
import { View, Platform, StyleSheet, ViewProps, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '@/src/lib/utils';
import { LinearGradient } from 'expo-linear-gradient';

interface ScreenProps extends ViewProps {
    scrollable?: boolean;
    safeArea?: boolean;
    gradient?: boolean; // iOS "Grid/Gradient" background
}

export const Screen = ({
    children,
    className,
    scrollable = false,
    safeArea = true,
    gradient = Platform.OS === 'ios',
    style,
    ...props
}: ScreenProps) => {

    const Container = safeArea ? SafeAreaView : View;
    const Wrapper = scrollable ? ScrollView : View;

    return (
        <View className="flex-1 bg-background">
            {/* Background Essentials */}
            {/* On Android, standard bg-background (zinc-900) is fine.
           On iOS, we replicate the WebUI's nicer gradient.
       */}
            {gradient && (
                <View className="absolute inset-0 pointer-events-none">
                    <LinearGradient
                        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']} // Subtle fade to black
                        style={StyleSheet.absoluteFill}
                    />
                    {/* Grid could go here if we made a native SVG grid component */}
                </View>
            )}

            <Container className="flex-1" edges={['top', 'left', 'right']}>
                <Wrapper
                    className={cn("flex-1", className)}
                    contentContainerStyle={scrollable ? { paddingBottom: 100 } : undefined} // Pad for Floating Pill
                    style={style}
                    {...props}
                >
                    {children}
                </Wrapper>
            </Container>
        </View>
    );
};
