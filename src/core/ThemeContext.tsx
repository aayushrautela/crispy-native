import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { MD3DarkTheme, MD3Theme, Provider as PaperProvider } from 'react-native-paper';
import { useUserStore } from '../features/trakt/stores/userStore';

interface ThemeContextType {
    theme: MD3Theme;
    isDark: boolean;
    amoledMode: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Map accent color names to hex values
const getAccentHex = (colorName: string): string => {
    switch (colorName) {
        case 'Golden Amber': return '#FFC107';
        case 'Sunset Orange': return '#FF5722';
        case 'Crimson Rose': return '#E91E63';
        case 'Neon Violet': return '#9C27B0';
        case 'Cosmic Purple': return '#673AB7';
        case 'Ocean Blue': return '#2196F3';
        case 'Cyber Teal': return '#00BCD4';
        case 'Toxic Emerald': return '#4CAF50';
        default: return '#FFC107';
    }
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const colorScheme = useColorScheme();
    const { settings } = useUserStore();
    const { amoledMode, accentColor, useMaterialYou } = settings;
    const isFirstMount = useRef(true);
    const prevAccentColor = useRef(accentColor);
    const prevUseMaterialYou = useRef(useMaterialYou);

    const fallbackSourceColor = getAccentHex(accentColor);

    const { theme, updateTheme, resetTheme } = useMaterial3Theme({
        fallbackSourceColor: fallbackSourceColor,
    });

    // Update theme ONLY when accent color or Material You setting actually changes
    // Skip the initial mount to prevent unnecessary re-renders
    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }

        // Only update if values actually changed
        if (accentColor !== prevAccentColor.current || useMaterialYou !== prevUseMaterialYou.current) {
            if (useMaterialYou) {
                resetTheme();
            } else {
                updateTheme(getAccentHex(accentColor));
            }
            prevAccentColor.current = accentColor;
            prevUseMaterialYou.current = useMaterialYou;
        }
    }, [accentColor, useMaterialYou]);

    const isDark = true; // App is dark mode only as per user request

    const paperTheme = useMemo(() => {
        const baseTheme = MD3DarkTheme;
        const m3Colors = theme.dark;

        const finalTheme = {
            ...baseTheme,
            colors: {
                ...baseTheme.colors,
                ...m3Colors,
                // Material You / AMOLED support
                ...(amoledMode ? {
                    background: '#000000',
                    surface: '#000000',
                    surfaceVariant: '#000000', // Deep black for surfaces in AMOLED
                    onSurface: '#ECEDEE',
                    elevation: {
                        level0: 'transparent',
                        level1: '#121212', // Subtle elevation even in AMOLED
                        level2: '#181818',
                        level3: '#1c1c1c',
                        level4: '#202020',
                        level5: '#242424',
                    }
                } : {
                    // Standard Dark Colors (Slightly tinted based on accent)
                    background: m3Colors.background,
                    surface: m3Colors.surface,
                }),
            },
        };

        return finalTheme;
    }, [theme, amoledMode, accentColor, useMaterialYou]);

    const contextValue = useMemo(() => ({
        theme: paperTheme,
        isDark,
        amoledMode,
        useMaterialYou,
    }), [paperTheme, isDark, amoledMode, useMaterialYou]);

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
