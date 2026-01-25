import { useTheme } from '@/src/core/ThemeContext';
import { useUserStore } from '@/src/core/stores/userStore';
import { ExpressiveSwitch } from '@/src/core/ui/ExpressiveSwitch';
import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { SettingsItem } from '@/src/core/ui/SettingsItem';
import { Touchable } from '@/src/core/ui/Touchable';
import { Typography } from '@/src/core/ui/Typography';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { getCatalogKey, useCatalogPreferences } from '@/src/hooks/useCatalogPreferences';
import { History, Power, Star } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

// 17. Removed AnimatedDraggableFlatList since we are using FlatList now

const CatalogListItem = ({ item: catalog, isDisabled, isHero, onToggle, onToggleHero }: any) => {
    const displayName = catalog.name || `${catalog.addonName} - ${catalog.type}`;

    return (
        <View style={[
            styles.catalogItem,
            isDisabled && { opacity: 0.5 }
        ]}>
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
    );
};

function HomeScreenContent() {
    const { theme } = useTheme();
    const { manifests, settings, updateSettings, traktAuth } = useUserStore();
    const {
        preferences,
        toggleCatalog,
        toggleHero,
        sortCatalogsByPreferences,
        toggleContinueWatching,
        toggleTraktTopPicks
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

    return (
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
                CATALOGS
            </Typography>

            {sortedCatalogs.map((item) => (
                <CatalogListItem
                    key={getCatalogKey(item)}
                    item={item}
                    isDisabled={preferences.disabled.has(getCatalogKey(item))}
                    isHero={preferences.hero.has(getCatalogKey(item))}
                    onToggle={() => toggleCatalog(item)}
                    onToggleHero={() => toggleHero(item)}
                />
            ))}
        </View>
    );
}

export default function HomeScreen() {
    return (
        <SettingsSubpage title="Home Screen">
            <HomeScreenContent />
        </SettingsSubpage>
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
