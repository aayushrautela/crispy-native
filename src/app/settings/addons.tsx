import { useTheme } from '@/src/core/ThemeContext';
import { ExpressiveButton } from '@/src/core/ui/ExpressiveButton';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { SettingsItem } from '@/src/core/ui/SettingsItem';
import { Typography } from '@/src/core/ui/Typography';
import { useUserStore } from '@/src/core/stores/userStore';
import { Package, Plus, Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

export default function AddonsScreen() {
    const { theme } = useTheme();
    const { addons, manifests, addAddon, removeAddon } = useUserStore();
    const [newAddonUrl, setNewAddonUrl] = useState('');

    const handleAddAddon = async () => {
        if (!newAddonUrl) return;
        try {
            await addAddon(newAddonUrl);
            setNewAddonUrl('');
            Alert.alert('Success', 'Addon added successfully!');
        } catch (e) {
            Alert.alert('Error', 'Failed to add addon. Make sure the URL is valid.');
        }
    };

    const handleRemoveAddon = (url: string) => {
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
                    <View style={styles.inputGroup}>
                        <TextInput
                            value={newAddonUrl}
                            onChangeText={setNewAddonUrl}
                            placeholder="https://example.com/manifest.json"
                            placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                            style={[styles.input, { backgroundColor: theme.colors.surfaceContainerHighest, color: theme.colors.onSurface }]}
                        />
                        <ExpressiveButton
                            title="Install Addon"
                            icon={Plus}
                            onPress={handleAddAddon}
                            variant="primary"
                            disabled={!newAddonUrl}
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
                                    <Trash2
                                        size={20}
                                        color={theme.colors.error}
                                        onPress={() => handleRemoveAddon(addon.url)}
                                    />
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
    emptyContainer: {
        padding: 32,
    }
});
