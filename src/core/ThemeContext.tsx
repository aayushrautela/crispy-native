import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { MD3DarkTheme, Provider as PaperProvider } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { useUserStore } from './stores/userStore';

type PaperMD3Colors = MD3Theme['colors'];

export type AppMD3Colors = PaperMD3Colors & {
    // Material 3 surface container roles (present in Material You schemes)
    surfaceContainer?: string;
    surfaceContainerLowest?: string;
    surfaceContainerLow?: string;
    surfaceContainerHigh?: string;
    surfaceContainerHighest?: string;
};

export type AppMD3Theme = Omit<MD3Theme, 'colors'> & { colors: AppMD3Colors };

interface ThemeContextType {
    theme: AppMD3Theme;
    isDark: boolean;
    amoledMode: boolean;
    useMaterialYou: boolean;
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
    const amoledMode = useUserStore((state) => state.settings.amoledMode);
    const accentColor = useUserStore((state) => state.settings.accentColor);
    const useMaterialYou = useUserStore((state) => state.settings.useMaterialYou);
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
    }, [accentColor, useMaterialYou, resetTheme, updateTheme]);

    const isDark = true; // App is dark mode only as per user request

    const paperTheme = useMemo((): AppMD3Theme => {
        const baseTheme = MD3DarkTheme;
        const m3Colors = theme.dark;

        const finalTheme: AppMD3Theme = {
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
            } as AppMD3Colors,
        };

        return finalTheme;
    }, [theme, amoledMode]);

    const contextValue = useMemo(() => ({
        theme: paperTheme,
        isDark,
        amoledMode,
        useMaterialYou,
    }), [paperTheme, isDark, amoledMode, useMaterialYou]);

    return (
        <ThemeContext.Provider value={contextValue}>
            <PaperProvider theme={paperTheme as MD3Theme}>
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

export const ThemeOverrideProvider = ({
    theme,
    children,
}: {
    theme: AppMD3Theme;
    children: React.ReactNode;
}) => {
    const parent = useContext(ThemeContext);
    if (!parent) {
        throw new Error('ThemeOverrideProvider must be used within a ThemeProvider');
    }

    const value = useMemo(() => ({
        ...parent,
        theme,
    }), [parent, theme]);

    return (
        <ThemeContext.Provider value={value}>
            <PaperProvider theme={theme as MD3Theme}>
                {children}
            </PaperProvider>
        </ThemeContext.Provider>
    );
};
