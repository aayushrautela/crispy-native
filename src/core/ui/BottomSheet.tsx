import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { BackHandler, Dimensions, StyleSheet, View, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useResponsive } from '@/src/core/hooks/useResponsive';

interface BottomSheetProps {
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

const MAX_TABLET_WIDTH = 640;
const TABLET_BREAKPOINT = 768;
const SHEET_WIDTH_PERCENTAGE = 0.9;

function useSheetDimensions() {
  const { width: windowWidth } = Dimensions.get('window');
  const isTablet = windowWidth >= TABLET_BREAKPOINT;

  return useMemo(() => {
    if (!isTablet) {
      return {
        isTablet: false,
        sheetWidth: windowWidth,
        hasHorizontalMargin: false,
      };
    }

    const calculatedWidth = Math.min(
      windowWidth * SHEET_WIDTH_PERCENTAGE,
      MAX_TABLET_WIDTH
    );

    return {
      isTablet: true,
      sheetWidth: calculatedWidth,
      hasHorizontalMargin: true,
    };
  }, [windowWidth, isTablet]);
}

const CustomBackdrop = React.memo((props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop
    {...props}
    disappearsOnIndex={-1}
    appearsOnIndex={0}
    opacity={0.5}
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
    const modalRef = useRef<BottomSheetModal>(null);
    const { isTablet, sheetWidth } = useSheetDimensions();
    const { bottom } = useSafeAreaInsets();

    useImperativeHandle(ref, () => modalRef.current!, []);

    React.useEffect(() => {
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (modalRef.current) {
            modalRef.current.dismiss();
            return true;
          }
          return false;
        }
      );

      return () => backHandler.remove();
    }, []);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => <CustomBackdrop {...props} />,
      []
    );

    const effectiveSnapPoints = useMemo(() => {
      if (snapPoints) return snapPoints;
      if (enableDynamicSizing) return undefined;
      return ['50%'];
    }, [snapPoints, enableDynamicSizing]);

    const Container = scrollable ? BottomSheetScrollView : BottomSheetView;

    const sheetContainerStyle: ViewStyle = useMemo(
      () => ({
        width: isTablet ? sheetWidth : '100%',
        alignSelf: isTablet ? 'center' : 'auto',
      }),
      [isTablet, sheetWidth]
    );

    const contentContainerStyle = useMemo(
      () => ({
        paddingBottom: Math.max(bottom, 16) + 16,
      }),
      [bottom]
    );

    return (
      <BottomSheetModal
        ref={modalRef}
        snapPoints={effectiveSnapPoints}
        index={index}
        enablePanDownToClose={true}
        enableDismissOnClose={true}
        backdropComponent={renderBackdrop}
        maxDynamicContentSize={maxHeight}
        animateOnMount={true}
        enableDynamicSizing={enableDynamicSizing}
        onDismiss={onDismiss}
        onChange={onChange}
        containerStyle={styles.modalContainer}
        style={sheetContainerStyle}
        handleIndicatorStyle={styles.handleIndicator}
        backgroundStyle={styles.background}
        keyboardBehavior="extend"
        keyboardBlurBehavior="none"
        android_keyboardInputMode="adjustResize"
      >
        <View style={styles.innerContainer}>
          {title && (
            <View style={styles.header}>
              <Text
                variant="titleLarge"
                style={styles.title}
                numberOfLines={2}
                adjustsFontSizeToFit={false}
              >
                {title}
              </Text>
            </View>
          )}
          <Container
            contentContainerStyle={
              scrollable ? [styles.content, contentContainerStyle] : undefined
            }
            style={!scrollable ? styles.content : undefined}
          >
            {children}
          </Container>
        </View>
      </BottomSheetModal>
    );
  }
);

CustomBottomSheet.displayName = 'CustomBottomSheet';

const styles = StyleSheet.create({
  modalContainer: {
    justifyContent: 'flex-end',
  },
  handleIndicator: {
    backgroundColor: 'rgba(128, 128, 128, 0.5)',
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  background: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  innerContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 0,
  },
  title: {
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
});

export default CustomBottomSheet;
