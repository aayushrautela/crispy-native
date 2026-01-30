import { useTheme } from '@/src/core/ThemeContext';
import { Screen } from '@/src/core/ui/layout/Screen';
import { Typography } from '@/src/core/ui/Typography';
import { CatalogCard } from '@/src/features/catalog/components/CatalogCard';
import { useTraktContext } from '@/src/features/trakt/context/TraktContext';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

const GAP = 12;

export default function TraktRecommendationsScreen() {
  const { theme } = useTheme();
  const { recommendations, isAuthenticated } = useTraktContext();
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();

  const data = useMemo(() => {
    return Array.isArray(recommendations) ? recommendations : [];
  }, [recommendations]);

  const numColumns = screenWidth >= 768 ? 5 : 3;
  const padding = 16;
  const itemWidth = Math.floor((screenWidth - (padding * 2) - (GAP * (numColumns - 1))) / numColumns);

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => {
    const isLastInRow = (index % numColumns) === (numColumns - 1);
    return (
      <View style={{ width: itemWidth, marginBottom: GAP, marginRight: isLastInRow ? 0 : GAP }}>
        <CatalogCard item={item} width={itemWidth} />
      </View>
    );
  }, [itemWidth, numColumns]);

  if (!isAuthenticated) {
    return (
      <Screen gradient={false} style={{ backgroundColor: theme.colors.background }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color={theme.colors.onSurface} size={22} />
          </Pressable>
          <Typography variant="title-large" weight="black">Trakt Top Picks</Typography>
        </View>
      </Screen>
    );
  }

  return (
    <Screen gradient={false} style={{ backgroundColor: theme.colors.background }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={theme.colors.onSurface} size={22} />
        </Pressable>
        <Typography variant="title-large" weight="black">Trakt Top Picks</Typography>
      </View>
      <FlashList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item: any) => String(item.id)}
        numColumns={numColumns}
        estimatedItemSize={itemWidth * 1.85}
        contentContainerStyle={{
          paddingHorizontal: padding,
          paddingTop: 8,
          paddingBottom: 32,
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
