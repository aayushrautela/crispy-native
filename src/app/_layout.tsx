import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ThemeProvider as NavigationThemeProvider, type Theme as NavigationTheme } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { AuthProvider, useAuth } from '../core/AuthContext';
import { DiscoveryProvider } from '../core/DiscoveryContext';
import { StorageService } from '../core/storage';
import { SyncService } from '../core/services/SyncService';
import { TraktService } from '../core/services/TraktService';
import { SessionManager } from '../core/SessionManager';
import { useUserStore } from '../core/stores/userStore';
import { ThemeProvider, useTheme } from '../core/ThemeContext';
import { CatalogActionsProvider } from '../features/catalog/context/CatalogActionsContext';
import { TraktProvider } from '../features/trakt/context/TraktContext';
import '../styles/global.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { theme, isDark } = useTheme();
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const navigationTheme = useMemo<NavigationTheme>(() => {
    return {
      dark: isDark,
      colors: {
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.onSurface,
        border: theme.colors.outlineVariant,
        notification: theme.colors.tertiary,
      },
      fonts: {
        regular: { fontFamily: 'GoogleSans-Regular', fontWeight: 'normal' },
        medium: { fontFamily: 'GoogleSans-Medium', fontWeight: '500' },
        bold: { fontFamily: 'GoogleSans-Bold', fontWeight: 'bold' },
        heavy: { fontFamily: 'GoogleSans-Bold', fontWeight: '800' },
      },
    };
  }, [theme, isDark]);

  const [loaded, error] = useFonts({
    'GoogleSans-Regular': require('../../assets/fonts/GoogleSans-Regular.ttf'),
    'GoogleSans-Medium': require('../../assets/fonts/GoogleSans-Medium.ttf'),
    'GoogleSans-SemiBold': require('../../assets/fonts/GoogleSans-SemiBold.ttf'),
    'GoogleSans-Bold': require('../../assets/fonts/GoogleSans-Bold.ttf'),
    'Nunito-Regular': require('../../assets/fonts/Nunito-Regular.ttf'),
    'Nunito-Medium': require('../../assets/fonts/Nunito-Medium.ttf'),
    'Nunito-SemiBold': require('../../assets/fonts/Nunito-SemiBold.ttf'),
    'Nunito-Bold': require('../../assets/fonts/Nunito-Bold.ttf'),
    'Nunito-Black': require('../../assets/fonts/Nunito-Black.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  useEffect(() => {
    if (loading || !loaded) return;

    const inAuthGroup = segments[0] === '(auth)';
    const guestFlag = StorageService.getGlobal<boolean | string>('crispy-guest-mode');
    const isGuestMode = guestFlag === true || guestFlag === 'true';
    const isAuthenticated = !!user || isGuestMode;

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (!!user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, loaded, segments, router]);

  // Listen for Account Switches
  useEffect(() => {
    const unsub = SessionManager.subscribe(() => {
      // When accounts change (login/logout/switch), reload the store
      // This ensures the store reads data for the *new* active user
      useUserStore.getState().reloadFromStorage(); // Reloads from disk (safe context switch)
      TraktService.getInstance().reset(); // Reset Trakt service to load new user tokens
    });
    return unsub;
  }, []);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <BottomSheetModalProvider>
        <CatalogActionsProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="meta/[id]" options={{ headerShown: false, animation: 'default' }} />
            <Stack.Screen name="player" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="catalog/[id]" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
            <Stack.Screen name="person/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="trakt/recommendations" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style={isDark ? 'light' : 'dark'} />
        </CatalogActionsProvider>
      </BottomSheetModalProvider>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <SyncService />
          <ThemeProvider>
            <DiscoveryProvider>
              <TraktProvider>
                <RootLayoutNav />
              </TraktProvider>
            </DiscoveryProvider>
          </ThemeProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
