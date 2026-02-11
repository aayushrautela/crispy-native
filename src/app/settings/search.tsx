import { ExpressiveSwitch } from '@/src/core/ui/ExpressiveSwitch';
import { SettingsGroup } from '@/src/core/ui/SettingsGroup';
import { SettingsItem } from '@/src/core/ui/SettingsItem';
import { SettingsSubpage } from '@/src/core/ui/layout/SettingsSubpage';
import { useUserStore } from '@/src/core/stores/userStore';
import { History, Search, Trash2 } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

export default function SearchScreen() {
    const addonSearchEnabled = useUserStore((state) => state.settings.addonSearchEnabled);
    const updateSettings = useUserStore((state) => state.updateSettings);

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
