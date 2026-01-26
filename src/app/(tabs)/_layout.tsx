import { useTheme } from '@/src/core/ThemeContext';
import { MaterialNavigationRail } from '@/src/core/ui/layout/MaterialNavigationRail';
import { SplitTabBar } from '@/src/core/ui/layout/SplitTabBar';
import { Tabs } from 'expo-router';
import React from 'react';
import { useWindowDimensions, View } from 'react-native';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const isTablet = width >= 768;


  return (
    <View style={{ flex: 1, flexDirection: isTablet ? 'row' : 'column' }}>
      {/* Tablet: Side Rail */}
      {isTablet && <MaterialNavigationRail />}

      <View style={{ flex: 1 }}>
        <Tabs
          tabBar={() => null}
          backBehavior="firstRoute"
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            // No sceneContainerStyle needed anymore! Flex layout handles it.
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              // We still define options for the router, even if we don't use them for rendering standard tabs
            }}
          />
          <Tabs.Screen
            name="search"
            options={{
              title: 'Search',
            }}
          />
          <Tabs.Screen
            name="discover"
            options={{
              title: 'Discover',
            }}
          />
          <Tabs.Screen
            name="library"
            options={{
              title: 'Library',
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Settings',
            }}
          />
        </Tabs>
      </View>

      {/* Mobile: Bottom Bar */}
      {!isTablet && <SplitTabBar />}
    </View>
  );
}

