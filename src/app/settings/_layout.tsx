import { useTheme } from '@/src/core/ThemeContext';
import { Stack } from 'expo-router';
import React from 'react';

export default function SettingsLayout() {
    const { theme } = useTheme();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                contentStyle: { backgroundColor: theme.colors.background },
            }}
        >
            <Stack.Screen name="account" />
            <Stack.Screen name="trakt" />
            <Stack.Screen name="appearance" />
            <Stack.Screen name="language" />
            <Stack.Screen name="system" />
            <Stack.Screen name="playback" />
            <Stack.Screen name="subtitles" />
            <Stack.Screen name="home" />
            <Stack.Screen name="addons" />
            <Stack.Screen name="search" />
            <Stack.Screen name="metadata" />
            <Stack.Screen name="ai" />
            <Stack.Screen name="about" />
        </Stack>
    );
}
