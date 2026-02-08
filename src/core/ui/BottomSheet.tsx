import React, { forwardRef, useCallback, useMemo, useRef } from 'react';
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  BottomSheetFlatList,
} from '@gorhom/bottom-sheet';
import { BackHandler, ViewStyle, View, TextStyle, FlatListProps } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useResponsive } from '@/src/core/hooks/useResponsive';
import { useTheme } from '@/src/core/ThemeContext';

export interface BottomSheetProps {
  title?: string;
  children?: React.ReactNode;
  snapPoints?: (string | number)[];
  index?: number;
  scrollable?: boolean;
  enableDynamicSizing?: boolean;
  maxHeight?: number;
  onDismiss?: () => void;
  onChange?: (index: number) => void;
  /**
   * Props for rendering a FlatList inside the bottom sheet.
   * If provided, this takes precedence over `children` and `scrollable`.
   * Use this for long lists to ensure proper virtualization and gesture handling.
   */
  flatListProps?: Omit<FlatListProps<any>, 'ref'>;
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
      flatListProps,
    },
    ref
  ) => {
    // Internal ref to access modal methods if the parent doesn't provide one,
    // and for BackHandler support.
    const internalRef = useRef<BottomSheetModal>(null);
    const isVisible = useRef(false);

    // Sync external ref with internal ref using a callback ref
    const handleRef = useCallback((node: BottomSheetModal | null) => {
      console.log('[CustomBottomSheet] handleRef', !!node);
      internalRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<BottomSheetModal | null>).current = node;
      }
    }, [ref]);

    const { theme } = useTheme();
    const { bottom } = useSafeAreaInsets();

    // Snap Points Logic
    const effectiveSnapPoints = useMemo(() => {
      if (snapPoints) return snapPoints;
      if (enableDynamicSizing) return undefined; // Standard for v5 dynamic sizing
      return ['50%'];
    }, [snapPoints, enableDynamicSizing]);

    console.log('[CustomBottomSheet] render', { title, index, snapPoints: effectiveSnapPoints });

    // Track visibility for BackHandler
    const handleSheetChanges = useCallback((idx: number) => {
      console.log('[CustomBottomSheet] handleSheetChanges', idx);
      isVisible.current = idx >= 0;
      onChange?.(idx);
    }, [onChange]);

    // Handle Hardware Back Press
    React.useEffect(() => {
      console.log('[CustomBottomSheet] mounting BackHandler');
      const backAction = () => {
        if (isVisible.current && internalRef.current) {
          console.log('[CustomBottomSheet] backAction: dismissing sheet');
          internalRef.current.dismiss();
          return true; // Prevent default behavior (exit app/go back)
        }
        return false; // Let default behavior happen
      };

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction
      );

      return () => {
        console.log('[CustomBottomSheet] unmounting BackHandler');
        backHandler.remove();
      };
    }, []);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => <CustomBackdrop {...props} />,
      []
    );


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
    const paddingBottom = Math.max(bottom, 20) + 32;
    
    const headerStyle = useMemo<ViewStyle>(() => ({
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 12,
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      alignItems: 'center', // Center the title
    }), [theme.colors.surface]);

    const titleStyle = useMemo<TextStyle>(() => ({
      fontWeight: 'bold',
      color: theme.colors.onSurface,
      textAlign: 'center',
    }), [theme.colors.onSurface]);

    const renderContent = () => {
      if (flatListProps) {
        return (
          <BottomSheetFlatList
            {...flatListProps}
            contentContainerStyle={[
              { paddingBottom },
              flatListProps.contentContainerStyle,
            ]}
          />
        );
      }

      // v5 optimization: If enableDynamicSizing is false, we want the content to fill the sheet.
      // We use a regular View instead of BottomSheetView to avoid gesture conflicts with nested lists.
      if (!scrollable && enableDynamicSizing === false) {
        return (
          <View style={[{ paddingBottom, paddingHorizontal: 24, flex: 1 }]}>
            {children}
          </View>
        );
      }

      if (scrollable) {
        return (
          <BottomSheetScrollView
            contentContainerStyle={{ paddingBottom, paddingHorizontal: 24 }}
          >
            {children}
          </BottomSheetScrollView>
        );
      }

      return (
        <BottomSheetView style={[{ paddingBottom, paddingHorizontal: 24 }, !enableDynamicSizing && { flex: 1 }]}>
          {children}
        </BottomSheetView>
      );
    };

    const handleDismiss = useCallback(() => {
      console.log('[CustomBottomSheet] onDismiss');
      onDismiss?.();
    }, [onDismiss]);

    return (
      <BottomSheetModal
        ref={handleRef}
        index={index === -1 ? undefined : index}
        snapPoints={effectiveSnapPoints}
        enablePanDownToClose={true}
        enableDismissOnClose={true}
        backdropComponent={renderBackdrop}
        maxDynamicContentSize={maxHeight}
        enableDynamicSizing={enableDynamicSizing}
        onDismiss={handleDismiss}
        onChange={handleSheetChanges}
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
        
        {renderContent()}
      </BottomSheetModal>
    );
  }
);

CustomBottomSheet.displayName = 'CustomBottomSheet';

export default CustomBottomSheet;
