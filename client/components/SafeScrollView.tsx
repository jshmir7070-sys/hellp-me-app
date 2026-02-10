import React from 'react';
import { ScrollView, ScrollViewProps, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Spacing } from '@/constants/theme';

interface SafeScrollViewProps extends ScrollViewProps {
  children: React.ReactNode;
  /**
   * 하단에 고정 버튼이 있는 경우 추가 여백
   * @default 0
   */
  bottomButtonHeight?: number;
  /**
   * 상단 추가 여백
   * @default Spacing.lg
   */
  topPadding?: number;
  /**
   * 하단 추가 여백
   * @default Spacing.xl
   */
  bottomPadding?: number;
  /**
   * 헤더 높이 포함 여부
   * @default false (헤더는 이미 공간을 차지하므로 기본적으로 불필요)
   */
  includeHeaderHeight?: boolean;
  /**
   * 탭바 높이 포함 여부
   * @default true
   */
  includeTabBarHeight?: boolean;
}

/**
 * 자동으로 상단바(헤더), 하단바(탭바), Safe Area를 감지하고
 * 스크롤 영역을 적절히 조정하는 ScrollView 컴포넌트
 *
 * @example
 * ```tsx
 * <SafeScrollView bottomButtonHeight={80}>
 *   <YourContent />
 * </SafeScrollView>
 * ```
 */
export function SafeScrollView({
  children,
  bottomButtonHeight = 0,
  topPadding = Spacing.lg,
  bottomPadding = Spacing.xl,
  includeHeaderHeight = false,
  includeTabBarHeight = true,
  contentContainerStyle,
  ...scrollViewProps
}: SafeScrollViewProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const computedContentContainerStyle: ViewStyle = {
    paddingTop: topPadding + (includeHeaderHeight ? headerHeight + 94 : 0),
    paddingBottom: bottomPadding + bottomButtonHeight + (includeTabBarHeight ? tabBarHeight : 0) + insets.bottom,
    ...(contentContainerStyle as ViewStyle),
  };

  return (
    <ScrollView
      contentContainerStyle={computedContentContainerStyle}
      showsVerticalScrollIndicator={true}
      {...scrollViewProps}
    >
      {children}
    </ScrollView>
  );
}
