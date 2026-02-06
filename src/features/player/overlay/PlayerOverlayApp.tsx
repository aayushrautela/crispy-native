import { ThemeProvider } from '@/src/core/ThemeContext';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PlayerOverlayRoot from './PlayerOverlayRoot';

export default function PlayerOverlayApp(props: any) {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <ThemeProvider>
                    <PlayerOverlayRoot {...props} />
                </ThemeProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
