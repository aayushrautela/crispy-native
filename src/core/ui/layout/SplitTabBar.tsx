import React from 'react';
import { Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialTabBar } from './MaterialTabBar';
import { GlassTabBar } from './GlassTabBar';

export const SplitTabBar = (props: BottomTabBarProps) => {
    if (Platform.OS === 'android') {
        return <MaterialTabBar {...props} />;
    }
    return <GlassTabBar {...props} />;
};
