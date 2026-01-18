import React from 'react';
import { Screen } from '@/src/cdk/layout/Screen';
import { Typography } from '@/src/cdk/components/Typography';
import { View } from 'react-native';

export default function SearchScreen() {
    return (
        <Screen scrollable>
            <View className="px-6 py-8">
                <Typography variant="h1" className="text-white">Search</Typography>
                <Typography variant="body" className="text-zinc-400 mt-2">
                    Search for movies, shows, and addons.
                </Typography>
            </View>
        </Screen>
    );
}
