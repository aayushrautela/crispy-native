import { ExpressiveButton } from '@/src/cdk/components/ExpressiveButton';
import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { useAddonStore } from '@/src/core/stores/addonStore';
import { useTheme } from '@/src/core/ThemeContext';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CatalogRow } from '../../components/CatalogRow';

export default function HomeScreen() {
  const { theme } = useTheme();
  const { manifests } = useAddonStore();
  const router = useRouter();

  // Pick top catalogs for the home screen
  const homeCatalogs = useMemo(() => {
    // Flatten all catalogs and pick unique ones or first few
    const catalogs = Object.values(manifests).flatMap(m =>
      (m.catalogs || []).map(c => ({ ...c, addonName: m.name }))
    );
    // Deduplicate by ID
    const seen = new Set();
    return catalogs.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    }).slice(0, 5); // Show first 5 on home
  }, [manifests]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Header Area */}
      <View style={styles.headerArea}>
        <View>
          <Text style={[styles.welcome, { color: theme.colors.onSurfaceVariant }]}>Good Evening,</Text>
          <Text style={[styles.appTitle, { color: theme.colors.onSurface }]}>Crispy</Text>
        </View>
        <ExpressiveSurface variant="filled" rounding="full" style={styles.profileBtn}>
          <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>G</Text>
        </ExpressiveSurface>
      </View>

      {/* Hero / Featured section */}
      <View style={styles.hero}>
        <ExpressiveSurface variant="filled" rounding="xxl" style={[styles.heroCard, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
          <View style={styles.heroContent}>
            <View style={[styles.badge, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text style={[styles.heroSub, { color: theme.colors.onPrimaryContainer }]}>FEATURED</Text>
            </View>
            <Text style={[styles.heroTitle, { color: theme.colors.onSurface }]}>Discover Content</Text>
            <Text style={[styles.heroDesc, { color: theme.colors.onSurfaceVariant }]}>
              {homeCatalogs.length > 0
                ? "Browse your favorite catalogs across all your addons."
                : "Add your favorite addons to start browsing catalogs."}
            </Text>
            {homeCatalogs.length === 0 && (
              <ExpressiveButton
                title="Add Addons"
                variant="primary"
                onPress={() => router.push('/(tabs)/settings')}
                style={styles.heroBtn}
              />
            )}
          </View>
        </ExpressiveSurface>
      </View>

      <View style={styles.sections}>
        {homeCatalogs.length > 0 ? (
          homeCatalogs.map(catalog => (
            <CatalogRow
              key={`${catalog.id}-${catalog.type}`}
              title={catalog.name || `${catalog.addonName} - ${catalog.type}`}
              catalogType={catalog.type}
              catalogId={catalog.id}
            />
          ))
        ) : (
          <>
            <CatalogRow
              title="Trending Movies"
              catalogType="movie"
              catalogId="tmdb_trending"
            />
            <View style={{ height: 16 }} />
            <CatalogRow
              title="Popular Shows"
              catalogType="series"
              catalogId="tmdb_popular"
            />
          </>
        )}
      </View>

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
    paddingTop: 64,
  },
  headerArea: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcome: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  profileBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  heroCard: {
    height: 200,
    justifyContent: 'center',
    padding: 24,
  },
  heroContent: {
    gap: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroDesc: {
    fontSize: 14,
    maxWidth: '90%',
    lineHeight: 20,
  },
  heroBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  sections: {
    gap: 32,
  }
});
