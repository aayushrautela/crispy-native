import { useTheme } from '@/src/core/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';
import React from 'react';
import { Platform } from 'react-native';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <NativeTabs
      backBehavior="history"
      disableTransparentOnScrollEdge
      minimizeBehavior="onScrollDown"
      blurEffect="systemChromeMaterialDark"
      indicatorColor={theme.colors.primary}
      backgroundColor={Platform.OS === 'android' ? theme.colors.surface : null}
      iconColor={{
        default: theme.colors.onSurfaceVariant,
        selected: theme.colors.primary,
      }}
      labelStyle={{
        default: {
          fontFamily: 'GoogleSans-Medium',
          fontSize: 11,
          color: theme.colors.onSurfaceVariant,
        },
        selected: {
          fontFamily: 'GoogleSans-SemiBold',
          fontSize: 11,
          color: theme.colors.primary,
        },
      }}
      rippleColor={theme.colors.primary}
      badgeBackgroundColor={theme.colors.primary}
      badgeTextColor={theme.colors.onPrimary}
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="index">
        <Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="home-outline" />,
            selected: <VectorIcon family={Ionicons} name="home" />,
          }}
        />
        <Label>Home</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <Icon
          sf={{ default: 'magnifyingglass', selected: 'magnifyingglass' }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="search-outline" />,
            selected: <VectorIcon family={Ionicons} name="search" />,
          }}
        />
        <Label>Search</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="discover">
        <Icon
          sf={{ default: 'safari', selected: 'safari.fill' }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="compass-outline" />,
            selected: <VectorIcon family={Ionicons} name="compass" />,
          }}
        />
        <Label>Discover</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="library">
        <Icon
          sf={{ default: 'books.vertical', selected: 'books.vertical.fill' }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="library-outline" />,
            selected: <VectorIcon family={Ionicons} name="library" />,
          }}
        />
        <Label>Library</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Icon
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="settings-outline" />,
            selected: <VectorIcon family={Ionicons} name="settings" />,
          }}
        />
        <Label>Settings</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
