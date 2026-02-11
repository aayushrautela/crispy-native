import { useTheme } from '@/src/core/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';
import React, { useMemo } from 'react';
import { Platform } from 'react-native';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TabLayout() {
  const { theme } = useTheme();
  const indicatorColor = theme.colors.secondaryContainer;
  const unselectedTint = theme.colors.onSurfaceVariant;
  const selectedTint = theme.colors.onSecondaryContainer;
  const iconColor = useMemo(
    () => ({
      default: unselectedTint,
      selected: selectedTint,
    }),
    [unselectedTint, selectedTint]
  );

  const labelStyle = useMemo(
    () => ({
      default: {
        fontFamily: 'GoogleSans-Medium',
        fontSize: 11,
        color: unselectedTint,
      },
      selected: {
        fontFamily: 'GoogleSans-SemiBold',
        fontSize: 11,
        color: selectedTint,
      },
    }),
    [unselectedTint, selectedTint]
  );

  const blurEffect = Platform.OS === 'ios' ? 'systemChromeMaterialDark' : undefined;
  const minimizeBehavior = Platform.OS === 'ios' ? 'onScrollDown' : undefined;

  return (
    <NativeTabs
      backBehavior="history"
      disableTransparentOnScrollEdge
      minimizeBehavior={minimizeBehavior}
      blurEffect={blurEffect}
      indicatorColor={indicatorColor}
      backgroundColor={Platform.OS === 'android' ? theme.colors.surface : null}
      iconColor={iconColor}
      labelStyle={labelStyle}
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
