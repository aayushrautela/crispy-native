import { MaterialNavigationRail } from '@/src/cdk/layout/MaterialNavigationRail';
import { SplitTabBar } from '@/src/cdk/layout/SplitTabBar';
import { useTheme } from '@/src/core/ThemeContext';
import { Tabs } from 'expo-router';
import { Compass, Home, Library, Search, Settings as SettingsIcon } from 'lucide-react-native';
import React from 'react';
import { useWindowDimensions } from 'react-native';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const isTablet = width >= 768;

  return (
    <Tabs
      tabBar={(props) => isTablet ? <MaterialNavigationRail {...props} /> : <SplitTabBar {...props} />}
      backBehavior="firstRoute"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        tabBarStyle: isTablet ? {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 80,
          borderRightWidth: 1,
          borderRightColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surface,
        } : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, size }) => <Library color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

