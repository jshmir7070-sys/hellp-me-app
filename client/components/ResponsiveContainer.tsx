import React, { ReactNode } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';

interface ResponsiveContainerProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  maxWidth?: number; // override containerMaxWidth
}

/**
 * 데스크탑 웹에서 콘텐츠를 maxWidth로 제한하고 중앙 정렬하는 래퍼.
 * 모바일에서는 그대로 패스스루.
 */
export function ResponsiveContainer({ children, style, maxWidth }: ResponsiveContainerProps) {
  const { showDesktopLayout, containerMaxWidth } = useResponsive();

  if (!showDesktopLayout) {
    return <View style={style}>{children}</View>;
  }

  return (
    <View
      style={[
        {
          maxWidth: maxWidth ?? containerMaxWidth,
          width: '100%',
          alignSelf: 'center',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
