import { useCatalog } from '@/src/core/hooks/useDiscovery';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { Typography } from '@/src/core/ui/Typography';
import { CatalogRow } from '@/src/features/catalog/components/CatalogRow';
import { HomeHeader } from '@/src/features/home/components/HomeHeader';
import { getCatalogKey, useCatalogPreferences } from '@/src/hooks/useCatalogPreferences';
import { useRouter } from 'expo-router';
import { CircleUser } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';

const HEADER_HEIGHT = 96;

export default function HomeScreen() {
  const { theme } = useTheme();
  const { manifests } = useUserStore();
  const { preferences, sortCatalogsByPreferences } = useCatalogPreferences();
  const router = useRouter();

  const scrollY = useSharedValue(0);
  const headerTranslateY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentScrollY = event.contentOffset.y;
      const diff = currentScrollY - lastScrollY.value;

      if (currentScrollY <= 0) {
        headerTranslateY.value = 0;
      } else if (diff > 0 && currentScrollY > 50) {
        // Scrolling Down - Hide
        headerTranslateY.value = Math.max(headerTranslateY.value - diff, -HEADER_HEIGHT);
      } else if (diff < 0) {
        // Scrolling Up - Show
        headerTranslateY.value = Math.min(headerTranslateY.value - diff, 0);
      }

      lastScrollY.value = currentScrollY;
      scrollY.value = currentScrollY;
    },
  });

  const headerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: headerTranslateY.value }],
      opacity: interpolate(headerTranslateY.value, [-HEADER_HEIGHT, 0], [0, 1])
    };
  });

  const homeCatalogs = useMemo(() => {
    if (!manifests) return [];

    // 1. Flatten all catalogs from manifests
    const catalogs = Object.entries(manifests).flatMap(([url, m]) =>
      (m?.catalogs || []).map(c => ({ ...c, addonName: m.name, addonUrl: url }))
    );

    // 2. Filter by visibility and deduplicate
    const seen = new Set();
    const filtered = catalogs.filter(c => {
      const key = getCatalogKey(c);
      if (preferences.disabled.has(key)) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 3. Sort by preferences
    return sortCatalogsByPreferences(filtered);
  }, [manifests, preferences.disabled, sortCatalogsByPreferences]);

  // Determine Hero Catalog
  const heroCatalog = useMemo(() => {
    if (homeCatalogs.length === 0) return null;

    // Find first catalog that is marked as hero
    const hero = homeCatalogs.find(c => preferences.hero.has(getCatalogKey(c)));
    return hero || homeCatalogs[0];
  }, [homeCatalogs, preferences.hero]);

  const { data: heroData, isLoading: heroLoading } = useCatalog(
    heroCatalog?.type || '',
    heroCatalog?.id || '',
    heroCatalog?.extra ? { ...heroCatalog.extra } : undefined,
    heroCatalog?.addonUrl
  );

  const carouselItems = useMemo(() => {
    if (heroData?.metas && heroData.metas.length > 0) {
      return heroData.metas.slice(0, 10);
    }
    return [
      { id: 'tt1160419', type: 'movie', name: 'Dune: Part Two' },
      { id: 'tt1536537', type: 'movie', name: 'Oppenheimer' },
      { id: 'tt1386697', type: 'movie', name: 'The Batman' },
    ];
  }, [heroData]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Collapsible Header */}
      <Animated.View style={[
        styles.header,
        headerStyle
      ]}>
        <View style={styles.branding}>
          <Typography
            weight="black"
            style={{
              color: 'white',
              fontSize: 22,
              letterSpacing: -0.5,
              lineHeight: 22,
              marginTop: 4,
            }}
          >
            Crispy
          </Typography>
        </View>
        <View style={styles.headerActions}>
          <Animated.View style={{ opacity: 0.9 }}>
            <CircleUser
              size={34}
              color="white"
              strokeWidth={1.5}
              onPress={() => router.push('/(tabs)/settings')}
            />
          </Animated.View>
        </View>
      </Animated.View>

      <Animated.FlatList
        data={homeCatalogs}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyExtractor={(item) => getCatalogKey(item)}
        ListHeaderComponent={
          <HomeHeader
            carouselItems={carouselItems}
            showContinueWatching={preferences.continueWatching}
            showTraktRecommendations={preferences.traktTopPicks}
            isEmpty={homeCatalogs.length === 0}
          />
        }
        renderItem={({ item: catalog, index }) => (
          <CatalogRow
            key={`${catalog.id}-${catalog.type}-${index}`}
            title={catalog.name || `${catalog.addonName} - ${catalog.type}`}
            catalogType={catalog.type}
            catalogId={catalog.id}
            addonUrl={(catalog as any).addonUrl}
          />
        )}
        ListFooterComponent={() => <View style={{ height: 120 }} />}
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingBottom: 0,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 100,
  },
  branding: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
    paddingTop: 0,
  },
  sections: {
    gap: 12,
  },
  emptyPrompt: {
    paddingTop: 0,
  }
});
