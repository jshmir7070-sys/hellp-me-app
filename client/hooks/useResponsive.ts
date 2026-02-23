import { useState, useEffect } from 'react';
import { Dimensions, Platform } from 'react-native';

export type ScreenSize = 'mobile' | 'tablet' | 'desktop';

interface ResponsiveInfo {
  width: number;
  height: number;
  screenSize: ScreenSize;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWeb: boolean;
  columns: number;
  containerMaxWidth: number;
  sidebarWidth: number;
  contentWidth: number;
  showDesktopLayout: boolean;
}

const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
};

const getScreenSize = (width: number): ScreenSize => {
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
};

const getColumns = (screenSize: ScreenSize): number => {
  switch (screenSize) {
    case 'desktop': return 3;
    case 'tablet': return 2;
    default: return 1;
  }
};

const getContainerMaxWidth = (screenSize: ScreenSize): number => {
  switch (screenSize) {
    case 'desktop': return 1200;
    case 'tablet': return 900;
    default: return 600;
  }
};

const getSidebarWidth = (screenSize: ScreenSize): number => {
  switch (screenSize) {
    case 'desktop': return 280;
    case 'tablet': return 240;
    default: return 0;
  }
};

export function useResponsive(): ResponsiveInfo {
  const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const screenSize = getScreenSize(dimensions.width);
  const isWeb = Platform.OS === 'web';
  const isMobile = screenSize === 'mobile';
  const sidebarWidth = getSidebarWidth(screenSize);
  const containerMaxWidth = getContainerMaxWidth(screenSize);
  const showDesktopLayout = isWeb && !isMobile;

  // 사이드바를 제외한 실제 콘텐츠 영역 너비
  const contentWidth = showDesktopLayout
    ? Math.min(dimensions.width - sidebarWidth, containerMaxWidth)
    : dimensions.width;

  return {
    width: dimensions.width,
    height: dimensions.height,
    screenSize,
    isMobile,
    isTablet: screenSize === 'tablet',
    isDesktop: screenSize === 'desktop',
    isWeb,
    columns: getColumns(screenSize),
    containerMaxWidth,
    sidebarWidth,
    contentWidth,
    showDesktopLayout,
  };
}

export function useBreakpointValue<T>(values: { mobile: T; tablet?: T; desktop?: T }): T {
  const { screenSize } = useResponsive();
  
  if (screenSize === 'desktop' && values.desktop !== undefined) {
    return values.desktop;
  }
  if (screenSize === 'tablet' && values.tablet !== undefined) {
    return values.tablet;
  }
  return values.mobile;
}
