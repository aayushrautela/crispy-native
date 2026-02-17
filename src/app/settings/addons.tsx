import { useTheme } from '@/src/core/ThemeContext';
import { useHousehold } from '@/src/core/HouseholdContext';
import { resolveAddonAssetUrl, type PreparedAddonInstall } from '@/src/core/addons/addonClient';
import { ExpressiveButton } from '@/src/core/ui/ExpressiveButton';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { SettingsItem } from '@/src/core/ui/SettingsItem';
import { Typography } from '@/src/core/ui/Typography';
import { useUserStore } from '@/src/core/stores/userStore';
import { Image } from 'expo-image';
import { Package, Plus, Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

export default function AddonsScreen() {
    const { theme } = useTheme();
    const { role, loading: membershipLoading } = useHousehold();
    const canManageAddons = role === 'owner';
    const addons = useUserStore((state) => state.addons);
    const manifests = useUserStore((state) => state.manifests);
    const prepareAddonInstall = useUserStore((state) => state.prepareAddonInstall);
    const confirmAddonInstall = useUserStore((state) => state.confirmAddonInstall);
    const removeAddon = useUserStore((state) => state.removeAddon);
    const [newAddonUrl, setNewAddonUrl] = useState('');
    const [checkingAddon, setCheckingAddon] = useState(false);
    const [installingAddon, setInstallingAddon] = useState(false);
    const [pendingInstall, setPendingInstall] = useState<PreparedAddonInstall | null>(null);
    const [imageLoadFailed, setImageLoadFailed] = useState<Record<string, boolean>>({});
    const [installImageFailed, setInstallImageFailed] = useState(false);

    const installButtonTitle = canManageAddons ? (checkingAddon ? 'Checking...' : 'Install Addon') : 'Owner Only';
    const installButtonVariant = canManageAddons ? 'primary' : 'outline';
    const installButtonDisabled = canManageAddons ? !newAddonUrl || checkingAddon : false;

    const showOwnerOnlyAlert = () => {
        Alert.alert(
            'Owner Only',
            'Only the household owner can install or remove addons. Ask the owner to manage addons for the whole household.'
        );
    };

    const closeInstallModal = () => {
        setPendingInstall(null);
        setInstallImageFailed(false);
        setInstallingAddon(false);
    };

    const handleAddAddon = async () => {
        if (!canManageAddons) {
            showOwnerOnlyAlert();
            return;
        }
        if (!newAddonUrl) return;

        setCheckingAddon(true);
        try {
            const prepared = await prepareAddonInstall(newAddonUrl);
            setPendingInstall(prepared);
        } catch (error: any) {
            const message = typeof error?.message === 'string'
                ? error.message
                : 'Failed to check addon. Make sure the URL points to a valid manifest.';
            Alert.alert('Error', message);
        } finally {
            setCheckingAddon(false);
        }
    };

    const handleConfirmAddon = async () => {
        if (!pendingInstall) return;

        setInstallingAddon(true);
        try {
            confirmAddonInstall(pendingInstall);
            setNewAddonUrl('');
            closeInstallModal();
            Alert.alert('Success', 'Addon installed successfully.');
        } catch (error: any) {
            const message = typeof error?.message === 'string' ? error.message : 'Failed to install addon.';
            Alert.alert('Error', message);
            setInstallingAddon(false);
        }
    };

    const handleRemoveAddon = (url: string) => {
        if (!canManageAddons) {
            showOwnerOnlyAlert();
            return;
        }
        Alert.alert(
            'Remove Addon',
            'Are you sure you want to remove this addon?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => removeAddon(url) }
            ]
        );
    };

    return (
        <SettingsSubpage title="Addons">
            <View>
                <SettingsGroup title="Add New Addon">
                    {!membershipLoading && role && !canManageAddons && (
                        <View style={styles.noteContainer}>
                            <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                You’re a household member. Addon management is owner-only.
                            </Typography>
                        </View>
                    )}
                    <View style={styles.inputGroup}>
                        <TextInput
                            value={newAddonUrl}
                            onChangeText={setNewAddonUrl}
                            placeholder="https://example.com/manifest.json"
                            editable={!checkingAddon && !installingAddon}
                            placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                            style={[
                                styles.input,
                                { backgroundColor: theme.colors.surfaceContainerHighest, color: theme.colors.onSurface },
                            ]}
                        />
                        <ExpressiveButton
                            title={installButtonTitle}
                            icon={Plus}
                            onPress={handleAddAddon}
                            variant={installButtonVariant}
                            disabled={installButtonDisabled}
                            style={!canManageAddons ? styles.ownerOnlyButton : undefined}
                        />
                    </View>
                </SettingsGroup>

                <SettingsGroup title="Installed Addons">
                    {addons.map((addon) => {
                        const manifest = manifests[addon.url];
                        const iconUrl = resolveAddonAssetUrl(addon.url, manifest?.icon);
                        // Fallback to addon.name or URL if manifest not loaded yet
                        const name = manifest?.name || addon.name || 'Unknown Addon';
                        const description = manifest?.description || addon.url;
                        const showIcon = !!iconUrl && !imageLoadFailed[addon.url];

                        return (
                            <SettingsItem
                                key={addon.url}
                                iconElement={showIcon ? (
                                    <Image
                                        source={{ uri: iconUrl }}
                                        contentFit="cover"
                                        style={styles.addonIcon}
                                        onError={() => setImageLoadFailed((prev) => ({ ...prev, [addon.url]: true }))}
                                    />
                                ) : (
                                    <View style={[styles.iconFallback, { backgroundColor: theme.colors.secondaryContainer }]}>
                                        <Package size={20} color={theme.colors.onSecondaryContainer} />
                                    </View>
                                )}
                                label={name}
                                description={description}
                                rightElement={
                                    <Pressable
                                        hitSlop={12}
                                        onPress={() => handleRemoveAddon(addon.url)}
                                        style={({ pressed }) => [
                                            styles.iconButton,
                                            !canManageAddons && styles.disabled,
                                            pressed && canManageAddons && { opacity: 0.7 },
                                        ]}
                                    >
                                        <Trash2 size={20} color={canManageAddons ? theme.colors.error : theme.colors.onSurfaceVariant} />
                                    </Pressable>
                                }
                                showChevron={false}
                            />
                        );
                    })}
                    {addons.length === 0 && (
                        <View style={styles.emptyContainer}>
                            <Typography variant="body-medium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                                No addons installed
                            </Typography>
                        </View>
                    )}
                </SettingsGroup>
            </View>

            <Modal
                visible={!!pendingInstall}
                transparent
                animationType="fade"
                onRequestClose={closeInstallModal}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
                        <Typography variant="title-large" weight="bold">
                            Confirm Addon Install
                        </Typography>

                        {pendingInstall && (
                            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
                                <View style={styles.previewRow}>
                                    {pendingInstall.iconUrl && !installImageFailed ? (
                                        <Image
                                            source={{ uri: pendingInstall.iconUrl }}
                                            contentFit="cover"
                                            style={styles.previewIcon}
                                            onError={() => setInstallImageFailed(true)}
                                        />
                                    ) : (
                                        <View style={[styles.previewFallback, { backgroundColor: theme.colors.secondaryContainer }]}>
                                            <Package size={24} color={theme.colors.onSecondaryContainer} />
                                        </View>
                                    )}
                                    <View style={styles.previewMeta}>
                                        <Typography variant="title-medium" weight="bold">
                                            {pendingInstall.manifest.name || 'Unknown Addon'}
                                        </Typography>
                                        <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {pendingInstall.manifest.description || 'No description provided.'}
                                        </Typography>
                                    </View>
                                </View>

                                <View style={styles.detailBlock}>
                                    <Typography variant="label-medium" weight="bold">ID</Typography>
                                    <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {pendingInstall.manifest.id || 'Unknown'}
                                    </Typography>
                                </View>

                                <View style={styles.detailBlock}>
                                    <Typography variant="label-medium" weight="bold">Version</Typography>
                                    <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {pendingInstall.manifest.version || 'Unknown'}
                                    </Typography>
                                </View>

                                <View style={styles.detailBlock}>
                                    <Typography variant="label-medium" weight="bold">Transport URL</Typography>
                                    <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {pendingInstall.transportUrl}
                                    </Typography>
                                </View>

                                <View style={styles.detailBlock}>
                                    <Typography variant="label-medium" weight="bold">Resources</Typography>
                                    <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {(pendingInstall.manifest.resources || [])
                                            .map((resource) => (typeof resource === 'string' ? resource : resource.name))
                                            .filter(Boolean)
                                            .join(', ') || 'None'}
                                    </Typography>
                                </View>

                                <View style={styles.detailBlock}>
                                    <Typography variant="label-medium" weight="bold">Types</Typography>
                                    <Typography variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {(pendingInstall.manifest.types || []).join(', ') || 'None'}
                                    </Typography>
                                </View>

                                {pendingInstall.warnings.length > 0 && (
                                    <View style={[styles.warningBox, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surfaceContainer }]}>
                                        <Typography variant="label-medium" weight="bold">Warnings</Typography>
                                        {pendingInstall.warnings.map((warning) => (
                                            <Typography key={warning} variant="body-small" style={{ color: theme.colors.onSurfaceVariant }}>
                                                • {warning}
                                            </Typography>
                                        ))}
                                    </View>
                                )}
                            </ScrollView>
                        )}

                        <View style={styles.modalActions}>
                            <ExpressiveButton
                                title="Cancel"
                                variant="outline"
                                onPress={closeInstallModal}
                                disabled={installingAddon}
                            />
                            <ExpressiveButton
                                title={installingAddon ? 'Installing...' : 'Install'}
                                variant="primary"
                                onPress={handleConfirmAddon}
                                disabled={installingAddon}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        </SettingsSubpage>
    );
}

const styles = StyleSheet.create({
    noteContainer: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    inputGroup: {
        padding: 20,
        gap: 12,
    },
    input: {
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
    },
    addonIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    iconFallback: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconButton: {
        padding: 6,
        borderRadius: 999,
    },
    ownerOnlyButton: {
        opacity: 0.75,
    },
    disabled: {
        opacity: 0.5,
    },
    emptyContainer: {
        padding: 32,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: 20,
        justifyContent: 'center',
    },
    modalCard: {
        borderRadius: 20,
        padding: 20,
        maxHeight: '80%',
        gap: 16,
    },
    modalScroll: {
        maxHeight: 420,
    },
    modalContent: {
        gap: 14,
        paddingBottom: 8,
    },
    previewRow: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    previewIcon: {
        width: 56,
        height: 56,
        borderRadius: 14,
    },
    previewFallback: {
        width: 56,
        height: 56,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewMeta: {
        flex: 1,
        gap: 4,
    },
    detailBlock: {
        gap: 4,
    },
    warningBox: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        gap: 6,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
});
