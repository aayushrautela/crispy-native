import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { SettingsItem } from '@/src/core/ui/SettingsItem';
import { Typography } from '@/src/core/ui/Typography';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { useTheme } from '@/src/core/ThemeContext';
import { Cpu, Info, RefreshCcw, Trash2 } from 'lucide-react-native';
import React from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

export default function SystemScreen() {
    const { theme } = useTheme();

    const handleClearCache = () => {
        Alert.alert(
            'Clear Cache',
            'This will remove all cached metadata and images. Are you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: () => { } }
            ]
        );
    };

    return (
        <SettingsSubpage title="System">
            <View>
                <SettingsGroup title="Maintenance">
                    <SettingsItem
                        icon={Trash2}
                        label="Clear Cache"
                        description="Free up storage space"
                        onPress={handleClearCache}
                        showChevron={false}
                    />
                    <SettingsItem
                        icon={RefreshCcw}
                        label="Reset All Settings"
                        description="Restore factory defaults"
                        onPress={() => { }}
                        showChevron={false}
                    />
                </SettingsGroup>

                <SettingsGroup title="Build Information">
                    <SettingsItem
                        icon={Info}
                        label="Version"
                        description="1.0.0-alpha (Build 20260120)"
                        showChevron={false}
                    />
                    <SettingsItem
                        icon={Platform.OS === 'android' ? Cpu : Info}
                        label="Platform"
                        description={`${Platform.OS} ${Platform.Version}`}
                        showChevron={false}
                    />
                    <SettingsItem
                        icon={Cpu}
                        label="JS Engine"
                        description={(global as any).HermesInternal ? 'Hermes' : 'JSC'}
                        showChevron={false}
                    />
                </SettingsGroup>

                <View style={styles.footer}>
                    <Typography variant="label-small" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                        Made with love by the Crispy Team
                    </Typography>
                </View>
            </View>
        </SettingsSubpage>
    );
}

const styles = StyleSheet.create({
    footer: {
        padding: 32,
        alignItems: 'center',
    }
});
