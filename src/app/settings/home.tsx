import { useTheme } from '@/src/core/ThemeContext';
import { useUserStore } from '@/src/core/stores/userStore';
import { ExpressiveSwitch } from '@/src/core/ui/ExpressiveSwitch';
import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { SettingsItem } from '@/src/core/ui/SettingsItem';
import { Touchable } from '@/src/core/ui/Touchable';
import { Typography } from '@/src/core/ui/Typography';
import { SettingsSubpage, useSettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { getCatalogKey, useCatalogPreferences } from '@/src/hooks/useCatalogPreferences';
import { GripVertical, History, Power, Star } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

const AnimatedDraggableFlatList = Animated.createAnimatedComponent(DraggableFlatList);

const CatalogListItem = ({ item: catalog, drag, isActive, isDisabled, isHero, onToggle, onToggleHero }: any) => {
    const displayName = catalog.name || `${catalog.addonName} - ${catalog.type}`;

    return (
        <ScaleDecorator>
            <View style={[
                styles.catalogItem,
                isDisabled && { opacity: 0.5 },
                isActive && { backgroundColor: 'rgba(255,255,255,0.1)' }
            ]}>
                <Touchable onLongPress={drag} delayLongPress={100} style={styles.dragHandle}>
                    <GripVertical size={20} color="rgba(255,255,255,0.3)" />
                </Touchable>

                <View style={styles.catalogInfo}>
                    <Typography variant="body-large" weight="bold" style={{ color: 'white' }}>
                        {displayName}
                    </Typography>
                    <Typography variant="body-small" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {catalog.addonName} • {catalog.type}
                    </Typography>
                </View>

                <View style={styles.catalogActions}>
                    <Touchable onPress={onToggleHero} style={styles.actionBtn}>
                        <Star size={20} color={isHero ? '#FFCC00' : 'rgba(255,255,255,0.4)'} fill={isHero ? '#FFCC00' : 'transparent'} />
                    </Touchable>
                    <Touchable onPress={onToggle} style={styles.actionBtn}>
                        <Power size={20} color={isDisabled ? 'rgba(255,255,255,0.3)' : '#4ADE80'} />
                    </Touchable>
                </View>
            </View>
        </ScaleDecorator>
    );
};

function HomeScreenContent() {
    const { theme } = useTheme();
    const { manifests, settings, updateSettings, traktAuth } = useUserStore();
    const { onScroll, insets } = useSettingsSubpage();
    const {
        preferences,
        toggleCatalog,
        toggleHero,
        sortCatalogsByPreferences,
        toggleContinueWatching,
        toggleTraktTopPicks,
        updateCatalogPrefs
    } = useCatalogPreferences();

    const isAuthenticated = !!traktAuth.accessToken;

    const allCatalogs = useMemo(() => {
        if (!manifests) return [];
        return Object.entries(manifests).flatMap(([url, m]) =>
            (m?.catalogs || []).map(c => ({
                ...c,
                addonName: m.name,
                addonUrl: url,
                addonId: m.id || url
            }))
        );
    }, [manifests]);

    const sortedCatalogs = useMemo(() => {
        return sortCatalogsByPreferences(allCatalogs);
    }, [allCatalogs, sortCatalogsByPreferences]);

    const handleDragEnd = useCallback(({ data }: { data: any[] }) => {
        const newOrder = data.map(c => getCatalogKey(c));
        updateCatalogPrefs({ order: newOrder });
    }, [updateCatalogPrefs]);

    const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<any>) => {
        const key = getCatalogKey(item);
        return (
            <CatalogListItem
                item={item}
                drag={drag}
                isActive={isActive}
                isDisabled={preferences.disabled.has(key)}
                isHero={preferences.hero.has(key)}
                onToggle={() => toggleCatalog(item)}
                onToggleHero={() => toggleHero(item)}
            />
        );
    }, [preferences.disabled, preferences.hero, toggleCatalog, toggleHero]);

    return (
        <AnimatedDraggableFlatList
            data={sortedCatalogs}
            onDragEnd={handleDragEnd}
            keyExtractor={(item: any) => getCatalogKey(item)}
            renderItem={renderItem}
            onScroll={onScroll}
            scrollEventThrottle={16}
            ListHeaderComponent={() => (
                <View style={{ paddingBottom: 16 }}>
                    <SettingsGroup title="Display">
                        <SettingsItem
                            label="Show Ratings"
                            description="Display rating badges on media posters"
                            icon={Star}
                            rightElement={
                                <ExpressiveSwitch
                                    value={settings.showRatingBadges}
                                    onValueChange={(val) => updateSettings({ showRatingBadges: val })}
                                />
                            }
                            showChevron={false}
                        />
                    </SettingsGroup>

                    <SettingsGroup title="Personalized Content">
                        <SettingsItem
                            label="Continue Watching"
                            description="Show your latest progress"
                            icon={History}
                            rightElement={
                                <ExpressiveSwitch
                                    value={preferences.continueWatching}
                                    onValueChange={toggleContinueWatching}
                                />
                            }
                            showChevron={false}
                        />
                        <SettingsItem
                            label="Trakt Top Picks"
                            description={isAuthenticated ? "Personal recommendations" : "Login to Trakt to enable"}
                            icon={Star}
                            rightElement={
                                <ExpressiveSwitch
                                    value={preferences.traktTopPicks}
                                    onValueChange={toggleTraktTopPicks}
                                    disabled={!isAuthenticated}
                                />
                            }
                            showChevron={false}
                        />
                    </SettingsGroup>

                    <Typography variant="label-medium" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 20, marginTop: 16, marginBottom: 8 }}>
                        CATALOGS (LONG PRESS TO DRAG)
                    </Typography>
                </View>
            )}
            contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 80 }]}
            showsVerticalScrollIndicator={false}
        />
    );
}

export default function HomeScreen() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SettingsSubpage title="Home Screen" noScroll>
                <HomeScreenContent />
            </SettingsSubpage>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingBottom: 120,
    },
    catalogItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        marginBottom: 8,
        marginHorizontal: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    dragHandle: {
        marginRight: 12,
        padding: 4,
    },
    catalogInfo: {
        flex: 1,
        marginRight: 12,
    },
    catalogActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    actionBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
});
