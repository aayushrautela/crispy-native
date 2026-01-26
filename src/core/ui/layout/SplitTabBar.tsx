import React from 'react';
import { Platform } from 'react-native';
import { GlassTabBar } from './GlassTabBar';
import { MaterialTabBar } from './MaterialTabBar';

export const SplitTabBar = () => {
    if (Platform.OS === 'android') {
        return <MaterialTabBar />;
    }
    return <GlassTabBar />;
};
