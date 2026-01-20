import { ExpressiveButton } from '@/src/cdk/components/ExpressiveButton';
import { ExpressiveSurface } from '@/src/cdk/components/ExpressiveSurface';
import { Typography } from '@/src/cdk/components/Typography';
import { Screen } from '@/src/cdk/layout/Screen';
import { useTheme } from '@/src/core/ThemeContext';
import { AddonService } from '@/src/core/api/AddonService';
import { TraktService } from '@/src/core/api/TraktService';
import { TraktDeviceCodeResponse } from '@/src/core/api/trakt-types';
import { useAddonStore } from '@/src/core/stores/addonStore';
import { useUserStore } from '@/src/core/stores/userStore';
import { Plus, Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

const HEADER_OFFSET = 64;

export default function SettingsScreen() {
    const { theme } = useTheme();
    const { addonUrls, manifests, addAddon, removeAddon, updateManifest } = useAddonStore();
    const [newUrl, setNewUrl] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    // Trakt State
    const traktAuth = useUserStore(s => s.traktAuth);
    const updateTraktAuth = useUserStore(s => s.updateTraktAuth);
    const [traktCode, setTraktCode] = useState<TraktDeviceCodeResponse | null>(null);
    const [isTraktLoading, setIsTraktLoading] = useState(false);

    // Polling Ref
    const pollInterval = React.useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, []);

    const handleConnectTrakt = async () => {
        setIsTraktLoading(true);
        try {
            const code = await TraktService.oauthDeviceCode();
            setTraktCode(code);

            // Start Polling
            pollInterval.current = setInterval(async () => {
                try {
                    await TraktService.oauthToken(code.device_code);
                    // Success (store updated)
                    if (pollInterval.current) clearInterval(pollInterval.current);
                    setTraktCode(null);
                    Alert.alert('Success', 'Trakt connected!');
                } catch (e) {
                    // Ignore pending, handle others?
                    // console.log('Polling...', e);
                }
            }, code.interval * 1000);

        } catch (e) {
            Alert.alert('Error', 'Failed to initialize Trakt auth');
        } finally {
            setIsTraktLoading(false);
        }
    };

    const handleDisconnectTrakt = () => {
        if (pollInterval.current) clearInterval(pollInterval.current);
        setTraktCode(null);
        updateTraktAuth({}); // Clear auth
    };

    const scrollY = useSharedValue(0);

    const onScroll = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const handleAddAddon = async () => {
        if (!newUrl.trim()) return;

        setIsAdding(true);
        try {
            // Validate manifest first
            const manifest = await AddonService.fetchManifest(newUrl);
            addAddon(newUrl);
            updateManifest(newUrl, manifest);
            setNewUrl('');
            Alert.alert('Success', `Added ${manifest.name}`);
        } catch (e) {
            Alert.alert('Error', 'Failed to fetch addon manifest. Ensure the URL is valid.');
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <Screen safeArea={false}>
            {/* Absolute Header - Matching Search/Discover alignment */}
            <Animated.View style={styles.header}>
                <Typography
                    variant="display-large"
                    weight="black"
                    rounded
                    style={{ fontSize: 40, lineHeight: 48, color: 'white' }}
                >
                    Settings
                </Typography>
                <Typography variant="body" className="text-zinc-400 mt-1">
                    Manage your addons and preferences.
                </Typography>
            </Animated.View>

            <Animated.ScrollView
                onScroll={onScroll}
                scrollEventThrottle={16}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >

                <View className="px-6 mb-8">
                    <Typography variant="h3" className="text-white mb-4">Account</Typography>

                    <ExpressiveSurface variant="filled" rounding="xl" style={{ padding: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <View>
                                <Typography variant="h4" className="text-white">Trakt.tv</Typography>
                                <Typography variant="caption" className="text-zinc-400">
                                    {traktAuth.accessToken ? 'Synced & Connected' : 'Sync your history & progress'}
                                </Typography>
                            </View>
                            <ExpressiveButton
                                title={traktAuth.accessToken ? "Disconnect" : "Connect"}
                                onPress={traktAuth.accessToken ? handleDisconnectTrakt : handleConnectTrakt}
                                variant={traktAuth.accessToken ? "tonal" : "primary"}
                                isLoading={isTraktLoading}
                            />
                        </View>

                        {/* Device Code Display */}
                        {traktCode && !traktAuth.accessToken && (
                            <View style={{ marginTop: 16, backgroundColor: theme.colors.surface, padding: 16, borderRadius: 12, alignItems: 'center' }}>
                                <Typography variant="body" className="text-zinc-300 mb-2">
                                    Visit <Typography variant="body" weight="bold" style={{ color: theme.colors.primary }}>{traktCode.verification_url}</Typography>
                                </Typography>
                                <Typography variant="display-small" weight="black" style={{ letterSpacing: 4, color: 'white', marginVertical: 8 }}>
                                    {traktCode.user_code}
                                </Typography>
                                <Typography variant="caption" className="text-zinc-500 text-center">
                                    Enter this code on your device to authorize Crispy.
                                </Typography>
                            </View>
                        )}
                    </ExpressiveSurface>
                </View>

                <View className="px-6 mb-8">
                    <Typography variant="h3" className="text-white mb-4">Addons</Typography>

                    <View className="flex-row gap-2 mb-6">
                        <TextInput
                            placeholder="https://addon.url/manifest.json"
                            placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                            style={{
                                flex: 1,
                                backgroundColor: theme.colors.surfaceVariant,
                                color: theme.colors.onSurface,
                                paddingHorizontal: 16,
                                height: 56,
                                borderRadius: 16,
                                fontSize: 14
                            }}
                            value={newUrl}
                            onChangeText={setNewUrl}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <ExpressiveButton
                            icon={<Plus size={20} color={theme.colors.onPrimary} />}
                            onPress={handleAddAddon}
                            variant="primary"
                            isLoading={isAdding}
                            style={{ height: 56, width: 56, justifyContent: 'center', alignItems: 'center' }}
                        />
                    </View>

                    {addonUrls.length > 0 ? (
                        <View className="gap-4">
                            {addonUrls.map(url => {
                                const manifest = manifests[url];
                                return (
                                    <ExpressiveSurface
                                        key={url}
                                        variant="filled"
                                        rounding="xl"
                                        style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Typography variant="body" className="text-white font-bold">
                                                {manifest?.name || 'Unknown Addon'}
                                            </Typography>
                                            <Typography variant="caption" className="text-zinc-500" numberOfLines={1}>
                                                {url}
                                            </Typography>
                                        </View>
                                        <ExpressiveButton
                                            icon={<Trash2 size={20} color={theme.colors.error} />}
                                            onPress={() => removeAddon(url)}
                                            variant="text"
                                        />
                                    </ExpressiveSurface>
                                );
                            })}
                        </View>
                    ) : (
                        <View className="py-10 items-center justify-center border-2 border-dashed border-zinc-800 rounded-3xl">
                            <Typography variant="body" className="text-zinc-500">No addons installed.</Typography>
                        </View>
                    )}
                </View>

                <View className="px-6 mb-8">
                    <Typography variant="h3" className="text-white mb-4">AI Insights</Typography>
                    <ExpressiveSurface variant="filled" rounding="xl" style={{ padding: 16 }}>
                        <Typography variant="label" className="text-zinc-500 mb-2">OpenRouter API Key</Typography>
                        <TextInput
                            placeholder="sk-or-v1-..."
                            placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                            style={{
                                backgroundColor: theme.colors.surfaceVariant,
                                color: theme.colors.onSurface,
                                paddingHorizontal: 16,
                                height: 56,
                                borderRadius: 16,
                                fontSize: 14,
                                marginBottom: 16
                            }}
                            value={useUserStore.getState().settings.openRouterKey}
                            onChangeText={(key) => useUserStore.getState().updateSettings({ openRouterKey: key })}
                            autoCapitalize="none"
                            autoCorrect={false}
                            secureTextEntry
                        />

                        <Typography variant="label" className="text-zinc-500 mb-2">Insights Mode</Typography>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                            {(['off', 'on-demand', 'always'] as const).map(mode => (
                                <ExpressiveButton
                                    key={mode}
                                    title={mode.charAt(0).toUpperCase() + mode.slice(1)}
                                    variant={useUserStore.getState().settings.aiInsightsMode === mode ? 'primary' : 'tonal'}
                                    onPress={() => useUserStore.getState().updateSettings({ aiInsightsMode: mode })}
                                    style={{ flex: 1 }}
                                    size="sm"
                                />
                            ))}
                        </View>

                        <Typography variant="label" className="text-zinc-500 mb-2">AI Model</Typography>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                            {(['deepseek-r1', 'nvidia-nemotron', 'custom'] as const).map(model => (
                                <ExpressiveButton
                                    key={model}
                                    title={model === 'deepseek-r1' ? 'R1' : model === 'nvidia-nemotron' ? 'Nvidia' : 'Custom'}
                                    variant={useUserStore.getState().settings.aiModelType === model ? 'primary' : 'tonal'}
                                    onPress={() => useUserStore.getState().updateSettings({ aiModelType: model })}
                                    style={{ flex: 1 }}
                                    size="sm"
                                />
                            ))}
                        </View>

                        {useUserStore.getState().settings.aiModelType === 'custom' && (
                            <>
                                <Typography variant="label" className="text-zinc-500 mb-2">Custom Model Name</Typography>
                                <TextInput
                                    placeholder="e.g. meta-llama/llama-3.1-405b"
                                    placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                                    style={{
                                        backgroundColor: theme.colors.surfaceVariant,
                                        color: theme.colors.onSurface,
                                        paddingHorizontal: 16,
                                        height: 56,
                                        borderRadius: 16,
                                        fontSize: 14
                                    }}
                                    value={useUserStore.getState().settings.aiCustomModelName}
                                    onChangeText={(name) => useUserStore.getState().updateSettings({ aiCustomModelName: name })}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </>
                        )}
                    </ExpressiveSurface>
                </View>

                <View className="px-6 mb-20">
                    <Typography variant="h3" className="text-white mb-4">Appearance</Typography>
                    <ExpressiveSurface variant="filled" rounding="xl" style={{ padding: 16 }}>
                        <Typography variant="body" className="text-white">AMOLED Mode</Typography>
                        <Typography variant="caption" className="text-zinc-500">Enable pitch black backgrounds for OLED screens.</Typography>
                    </ExpressiveSurface>
                </View>
            </Animated.ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: HEADER_OFFSET,
        paddingHorizontal: 24,
        zIndex: 100,
    },
    scrollContent: {
        paddingTop: 160,
        paddingBottom: 120,
    }
});
