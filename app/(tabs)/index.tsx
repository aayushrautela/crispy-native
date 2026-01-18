import { StyleSheet, ScrollView, View, Text } from 'react-native';
import { useTheme } from '@/src/core/ThemeContext';
import { ContentRow } from '@/src/cdk/components/ContentRow';
import { useCatalog } from '@/src/core/hooks/useDiscovery';
import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { ExpressiveButton } from '@/src/cdk/components/ExpressiveButton';

export default function HomeScreen() {
  const { theme } = useTheme();

  // Mocking some initial catalogs until the user adds real ones
  // In a real scenario, we'd fetch these from addonStore
  const trendingMovies = useCatalog('movie', 'tmdb_trending');
  const familyMovies = useCatalog('movie', 'tmdb_family');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Hero / Featured section */}
      <View style={styles.hero}>
        <ExpressiveSurface variant="filled" rounding="xxl" style={styles.heroCard}>
          <View style={styles.heroContent}>
            <Text style={[styles.heroSub, { color: theme.colors.primary }]}>FEATURED</Text>
            <Text style={[styles.heroTitle, { color: theme.colors.onSurface }]}>Welcome to Crispy</Text>
            <Text style={[styles.heroDesc, { color: theme.colors.onSurfaceVariant }]}>
              Add your favorite addons to start browsing catalogs.
            </Text>
            <ExpressiveButton
              title="Add Addons"
              variant="primary"
              onPress={() => { }}
              style={styles.heroBtn}
            />
          </View>
        </ExpressiveSurface>
      </View>

      <ContentRow
        title="Trending Movies"
        items={trendingMovies.data?.metas}
        isLoading={trendingMovies.isLoading}
      />

      <ContentRow
        title="Family Favorites"
        items={familyMovies.data?.metas}
        isLoading={familyMovies.isLoading}
      />

      {/* Spacing for tab bar */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 64, // Status bar + some breathing room
  },
  hero: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  heroCard: {
    height: 240,
    justifyContent: 'flex-end',
    padding: 24,
  },
  heroContent: {
    gap: 4,
  },
  heroSub: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroDesc: {
    fontSize: 14,
    maxWidth: '80%',
    marginBottom: 12,
  },
  heroBtn: {
    alignSelf: 'flex-start',
  }
});
