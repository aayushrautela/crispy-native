import React from 'react';
import { Screen } from '@/src/cdk/layout/Screen';
import { Typography } from '@/src/cdk/components/Typography';
import { View } from 'react-native';

export default function HomeScreen() {
  return (
    <Screen scrollable>
      <View className="px-6 py-8">
        <Typography variant="h1" className="text-white">Home</Typography>
        <Typography variant="body" className="text-zinc-400 mt-2">
          Welcome to Crispy Native. Content implementation follows.
        </Typography>
      </View>
    </Screen>
  );
}
