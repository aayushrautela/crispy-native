import { SettingsGroup } from '@/src/cdk/components/SettingsGroup';
import { SettingsItem } from '@/src/cdk/components/SettingsItem';
import { SettingsSubpage } from '@/src/cdk/layout/SettingsSubpage';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { Database, Image, Key } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

export default function MetadataScreen() {
    const { theme } = useTheme();
    const { settings, updateSettings } = useUserStore();
    const { tmdbKey, omdbKey } = settings;

    return (
        <SettingsSubpage title="Metadata">
            <View>
                <SettingsGroup title="TMDB API">
                    <SettingsItem
                        icon={Key}
                        label="API Key"
                        description="Personal key for fetching movie/show details"
                        showChevron={false}
                    />
                    <View style={styles.inputContainer}>
                        <TextInput
                            value={tmdbKey}
                            onChangeText={(text) => updateSettings({ tmdbKey: text })}
                            placeholder="e.g. 1a2b3c4d5e..."
                            placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                            style={[styles.input, { backgroundColor: theme.colors.surfaceContainerHighest, color: theme.colors.onSurface }]}
                        />
                    </View>
                </SettingsGroup>

                <SettingsGroup title="OMDB API">
                    <SettingsItem
                        icon={Database}
                        label="API Key"
                        description="For IMDb ratings and better data"
                        showChevron={false}
                    />
                    <View style={styles.inputContainer}>
                        <TextInput
                            value={omdbKey}
                            onChangeText={(text) => updateSettings({ omdbKey: text })}
                            placeholder="e.g. a1b2c3d4"
                            placeholderTextColor={theme.colors.onSurfaceVariant + '80'}
                            style={[styles.input, { backgroundColor: theme.colors.surfaceContainerHighest, color: theme.colors.onSurface }]}
                        />
                    </View>
                </SettingsGroup>

                <SettingsGroup title="Other Providers">
                    <SettingsItem
                        icon={Image}
                        label="Fanart.tv"
                        description="High quality background art (Optional)"
                        onPress={() => { }}
                    />
                </SettingsGroup>

                <SettingsGroup title="Customization">
                    <SettingsItem
                        label="Image Resolution"
                        description="Original (Highest)"
                        onPress={() => { }}
                    />
                </SettingsGroup>
            </View>
        </SettingsSubpage>
    );
}

const styles = StyleSheet.create({
    inputContainer: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    input: {
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
    }
});
