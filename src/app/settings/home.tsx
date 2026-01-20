import { SettingsGroup } from '@/src/cdk/components/SettingsGroup';
import { SettingsItem } from '@/src/cdk/components/SettingsItem';
import { SettingsSubpage } from '@/src/cdk/layout/SettingsSubpage';
import { useTheme } from '@/src/core/ThemeContext';
import React from 'react';
import { Switch, View } from 'react-native';

export default function HomeScreen() {
    const { theme } = useTheme();

    return (
        <SettingsSubpage title="Home Screen">
            <View>
                <SettingsGroup title="Content Rows">
                    <SettingsItem
                        label="Continue Watching"
                        description="Show your latest progress"
                        rightElement={<Switch value={true} onValueChange={() => { }} trackColor={{ true: theme.colors.primary }} />}
                        showChevron={false}
                    />
                    <SettingsItem
                        label="Trakt Predictions"
                        description="Personalized picks"
                        rightElement={<Switch value={true} onValueChange={() => { }} trackColor={{ true: theme.colors.primary }} />}
                        showChevron={false}
                    />
                </SettingsGroup>

                <SettingsGroup title="Display">
                    <SettingsItem
                        label="Show Ratings"
                        description="Display IMDb/TMDB ratings"
                        rightElement={<Switch value={false} onValueChange={() => { }} trackColor={{ true: theme.colors.primary }} />}
                        showChevron={false}
                    />
                    <SettingsItem
                        label="Grid Layout"
                        description="Use posters instead of wide cards"
                        rightElement={<Switch value={true} onValueChange={() => { }} trackColor={{ true: theme.colors.primary }} />}
                        showChevron={false}
                    />
                </SettingsGroup>
            </View>
        </SettingsSubpage>
    );
}
