import { useTheme } from '@/src/core/ThemeContext';
import { useHousehold } from '@/src/core/HouseholdContext';
import { ExpressiveButton } from '@/src/core/ui/ExpressiveButton';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { SettingsItem } from '@/src/core/ui/SettingsItem';
import { Typography } from '@/src/core/ui/Typography';
import { useUserStore } from '@/src/core/stores/userStore';
import { Package, Plus, Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

export default function AddonsScreen() {
    const { theme } = useTheme();
    const { role, loading: membershipLoading } = useHousehold();
    const canManageAddons = role === 'owner';
    const addons = useUserStore((state) => state.addons);
    const manifests = useUserStore((state) => state.manifests);
    const addAddon = useUserStore((state) => state.addAddon);
    const removeAddon = useUserStore((state) => state.removeAddon);
    const [newAddonUrl, setNewAddonUrl] = useState('');

    const installButtonTitle = canManageAddons ? 'Install Addon' : 'Owner Only';
    const installButtonVariant = canManageAddons ? 'primary' : 'outline';
    const installButtonDisabled = canManageAddons ? !newAddonUrl : false;

    const showOwnerOnlyAlert = () => {
        Alert.alert(
            'Owner Only',
            'Only the household owner can install or remove addons. Ask the owner to manage addons for the whole household.'
        );
    };

    const handleAddAddon = async () => {
        if (!canManageAddons) {
            showOwnerOnlyAlert();
            return;
        }
        if (!newAddonUrl) return;
        try {
            await addAddon(newAddonUrl);
            setNewAddonUrl('');
            Alert.alert('Success', 'Addon added successfully!');
        } catch {
            Alert.alert('Error', 'Failed to add addon. Make sure the URL is valid.');
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
                        // Fallback to addon.name or URL if manifest not loaded yet
                        const name = manifest?.name || addon.name || 'Unknown Addon';
                        const description = manifest?.description || addon.url;

                        return (
                            <SettingsItem
                                key={addon.url}
                                icon={Package}
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
    }
});
