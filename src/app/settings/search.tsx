import { ExpressiveSwitch } from '@/src/cdk/components/ExpressiveSwitch';
import { SettingsGroup } from '@/src/cdk/components/SettingsGroup';
import { SettingsItem } from '@/src/cdk/components/SettingsItem';
import { SettingsSubpage } from '@/src/cdk/layout/SettingsSubpage';
import { useUserStore } from '@/src/core/stores/userStore';
import { useTheme } from '@/src/core/ThemeContext';
import { History, Search, Trash2 } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

export default function SearchScreen() {
    const { theme } = useTheme();
    const { settings, updateSettings } = useUserStore();
    const { addonSearchEnabled } = settings;

    return (
        <SettingsSubpage title="Search">
            <View>
                <SettingsGroup title="Scope">
                    <SettingsItem
                        icon={Search}
                        label="Universal Search"
                        description="Include results from installed addons"
                        rightElement={
                            <ExpressiveSwitch
                                value={addonSearchEnabled}
                                onValueChange={(val) => updateSettings({ addonSearchEnabled: val })}
                            />
                        }
                        showChevron={false}
                    />
                </SettingsGroup>

                <SettingsGroup title="Local History">
                    <SettingsItem
                        icon={History}
                        label="Store Search History"
                        description="Save recent queries locally"
                        rightElement={
                            <ExpressiveSwitch
                                value={true} // Default to true for now as native history is common
                                onValueChange={() => { }}
                            />
                        }
                        showChevron={false}
                    />
                    <SettingsItem
                        icon={Trash2}
                        label="Clear History"
                        description="Delete all local search data"
                        onPress={() => { }}
                        showChevron={false}
                    />
                </SettingsGroup>
            </View>
        </SettingsSubpage>
    );
}
