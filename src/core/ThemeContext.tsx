import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, MD3Theme, Provider as PaperProvider } from 'react-native-paper';
import { useUserStore } from './stores/userStore';

interface ThemeContextType {
    theme: MD3Theme;
    isDark: boolean;
    amoledMode: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const colorScheme = useColorScheme();
    const { settings } = useUserStore();
    const { amoledMode, accentColor } = settings;

    // Custom palettes for "Crispy" curated colors
    const fallbackSourceColor = useMemo(() => {
        switch (accentColor) {
            case 'Golden Amber': return '#FFC107';
            case 'Deep Amber': return '#FFA000';
            case 'Neon Purple': return '#9C27B0';
            case 'Crispy Blue': return '#2196F3';
            case 'Vibrant Red': return '#F44336';
            default: return undefined;
        }
    }, [accentColor]);

    const { theme } = useMaterial3Theme({
        fallbackSourceColor,
    });

    const isDark = colorScheme === 'dark';

    const paperTheme = useMemo(() => {
        const baseTheme = isDark ? MD3DarkTheme : MD3LightTheme;
        const m3Colors = isDark ? theme.dark : theme.light;

        const finalTheme = {
            ...baseTheme,
            colors: {
                ...baseTheme.colors,
                ...m3Colors,
                // Material You / AMOLED support
                ...(isDark && amoledMode ? {
                    background: '#000000',
                    surface: '#000000',
                    surfaceVariant: '#121212',
                    onSurface: '#ECEDEE',
                } : {}),
            },
        };

        return finalTheme;
    }, [isDark, theme, amoledMode]);

    const contextValue = useMemo(() => ({
        theme: paperTheme,
        isDark,
        amoledMode,
    }), [paperTheme, isDark, amoledMode]);

    return (
        <ThemeContext.Provider value={contextValue}>
            <PaperProvider theme={paperTheme}>
                {children}
            </PaperProvider>
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
