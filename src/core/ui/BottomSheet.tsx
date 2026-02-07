import React, { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { BackHandler, ViewStyle, View, StyleSheet, LayoutChangeEvent, TextStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useResponsive } from '@/src/core/hooks/useResponsive';
import { useTheme } from '@/src/core/ThemeContext';

export interface BottomSheetProps {
  title?: string;
  children: React.ReactNode;
  snapPoints?: (string | number)[];
  index?: number;
  scrollable?: boolean;
  enableDynamicSizing?: boolean;
  maxHeight?: number;
  onDismiss?: () => void;
  onChange?: (index: number) => void;
}

export type BottomSheetRef = BottomSheetModal;

const CustomBackdrop = React.memo((props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop
    {...props}
    disappearsOnIndex={-1}
    appearsOnIndex={0}
    opacity={0.5}
    pressBehavior="close"
  />
));

CustomBackdrop.displayName = 'CustomBackdrop';

export const CustomBottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(
  (
    {
      title,
      children,
      snapPoints,
      index = -1,
      scrollable = false,
      enableDynamicSizing = true,
      maxHeight,
      onDismiss,
      onChange,
    },
    ref
  ) => {
    // Internal ref to access modal methods if the parent doesn't provide one,
    // but since we are forwarding ref, we need to handle the case where ref is null.
    // However, BottomSheetModal requires a ref.
    // We can use a local ref and sync it, or just trust the parent to pass one?
    // Best practice with forwardRef and local access: use a merged ref or just internal logic without ref access if possible.
    // Here we need internal access for BackHandler.
    const internalRef = useRef<BottomSheetModal>(null);
    const isVisible = useRef(false);

    // Sync external ref with internal ref
    React.useImperativeHandle(ref, () => internalRef.current as BottomSheetModal);

    const { isTablet, width: windowWidth } = useResponsive();
    const { theme } = useTheme();
    const { bottom } = useSafeAreaInsets();

    // Track visibility for BackHandler
    const handleSheetChanges = useCallback((index: number) => {
      isVisible.current = index >= 0;
      onChange?.(index);
    }, [onChange]);

    // Handle Hardware Back Press
    React.useEffect(() => {
      const backAction = () => {
        if (isVisible.current && internalRef.current) {
          internalRef.current.dismiss();
          return true; // Prevent default behavior (exit app/go back)
        }
        return false; // Let default behavior happen
      };

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction
      );

      return () => backHandler.remove();
    }, []);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => <CustomBackdrop {...props} />,
      []
    );

    // Snap Points Logic
    // If dynamic sizing is enabled and no snapPoints are provided, pass undefined to let the library handle it.
    // If snapPoints ARE provided, they take precedence.
    const effectiveSnapPoints = useMemo(() => {
      if (snapPoints) return snapPoints;
      if (enableDynamicSizing) return undefined; // Standard for v5 dynamic sizing
      return ['50%'];
    }, [snapPoints, enableDynamicSizing]);

    // Tablet specific styles
    const sheetStyle = useMemo<ViewStyle>(() => {
      if (!isTablet) return {};
      return {
        width: Math.min(windowWidth * 0.9, 640),
        alignSelf: 'center',
      };
    }, [isTablet, windowWidth]);

    const backgroundStyle = useMemo<ViewStyle>(() => ({
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    }), [theme.colors.surface]);

    const handleIndicatorStyle = useMemo<ViewStyle>(() => ({
      backgroundColor: theme.colors.onSurfaceVariant,
      opacity: 0.4,
      width: 40,
      height: 4,
    }), [theme.colors.onSurfaceVariant]);

    // Content Styling
    const paddingBottom = Math.max(bottom, 16) + 16;
    
    const headerStyle = useMemo<ViewStyle>(() => ({
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 12,
      backgroundColor: theme.colors.surface,
    }), [theme.colors.surface]);

    const titleStyle = useMemo<TextStyle>(() => ({
      fontWeight: 'bold',
      color: theme.colors.onSurface,
    }), [theme.colors.onSurface]);

    const ContentComponent = scrollable ? BottomSheetScrollView : BottomSheetView;
    
    // BottomSheetScrollView uses contentContainerStyle, BottomSheetView uses style
    // We need to apply padding carefully.
    
    return (
      <BottomSheetModal
        ref={internalRef}
        index={index}
        snapPoints={effectiveSnapPoints}
        enablePanDownToClose={true}
        enableDismissOnClose={true}
        backdropComponent={renderBackdrop}
        maxDynamicContentSize={maxHeight}
        enableDynamicSizing={enableDynamicSizing}
        onDismiss={onDismiss}
        onChange={handleSheetChanges}
        style={sheetStyle}
        backgroundStyle={backgroundStyle}
        handleIndicatorStyle={handleIndicatorStyle}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        {title && (
          <View style={headerStyle}>
            <Text variant="titleLarge" style={titleStyle}>
              {title}
            </Text>
          </View>
        )}
        
        <ContentComponent
          style={!scrollable ? { paddingBottom, paddingHorizontal: 24 } : undefined}
          contentContainerStyle={scrollable ? { paddingBottom, paddingHorizontal: 24 } : undefined}
          stickyHeaderIndices={scrollable && title ? [0] : undefined} // Note: sticky headers inside the scrollview need the header IN the scrollview. 
          // Current implementation puts header OUTSIDE the content component (above it).
          // If the header is outside, we don't need stickyHeaderIndices.
        >
            {children}
        </ContentComponent>
      </BottomSheetModal>
    );
  }
);

CustomBottomSheet.displayName = 'CustomBottomSheet';

export default CustomBottomSheet;
