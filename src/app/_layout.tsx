import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ThemeProvider as NavigationThemeProvider, type Theme as NavigationTheme } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../core/AuthContext';
import { clearDiscoveryCache, DiscoveryProvider } from '../core/DiscoveryContext';
import { ProfileProvider, useProfiles } from '../core/ProfileContext';
import { SyncService } from '../core/services/SyncService';
import { TraktService } from '../core/services/TraktService';
import { useTraktStore } from '../core/stores/traktStore';
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

function AuthRouteGuard({ loaded }: { loaded: boolean }) {
  const { loading, user } = useAuth();
  const { loading: profilesLoading, activeProfileId } = useProfiles();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading || !loaded) return;
    if (user && profilesLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const authSegment = String(segments[1] ?? '');
    const inLoginScreen = inAuthGroup && authSegment === 'login';
    const inProfilesScreen = inAuthGroup && authSegment === 'profiles';

    if (!user) {
      if (!inLoginScreen) {
        router.replace('/(auth)/login');
      }
      return;
    }

    if (!activeProfileId) {
      if (!inProfilesScreen) {
        router.replace('/(auth)/profiles' as never);
      }
      return;
    }

    if (inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [activeProfileId, loaded, loading, profilesLoading, router, segments, user]);

  return null;
}

function RootLayoutNav() {
  const { theme, isDark } = useTheme();
  const { activeProfileId } = useProfiles();
  const lastProfileIdRef = useRef<string | null>(null);

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
    if (!loaded) return;
    if (lastProfileIdRef.current === activeProfileId) return;

    queryClient.clear();
    clearDiscoveryCache();
    useUserStore.getState().reloadFromStorage();
    useTraktStore.getState().hydrate();
    TraktService.getInstance().reset();
    lastProfileIdRef.current = activeProfileId;
  }, [activeProfileId, loaded]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <AuthRouteGuard loaded={loaded} />
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
        <SafeAreaProvider>
          <AuthProvider>
            <ProfileProvider>
              <SyncService />
              <ThemeProvider>
                <DiscoveryProvider>
                  <TraktProvider>
                    <RootLayoutNav />
                  </TraktProvider>
                </DiscoveryProvider>
              </ThemeProvider>
            </ProfileProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
