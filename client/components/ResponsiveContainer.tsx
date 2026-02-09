import React from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  centered?: boolean;
  maxWidth?: number;
  padding?: number;
  style?: any;
  contentContainerStyle?: any;
}

export function ResponsiveContainer({
  children,
  scrollable = true,
  centered = true,
  maxWidth,
  padding,
  style,
  contentContainerStyle,
}: ResponsiveContainerProps) {
  const { isDesktop, isTablet, containerMaxWidth, width } = useResponsive();
  const insets = useSafeAreaInsets();

  const finalMaxWidth = maxWidth || containerMaxWidth;
  const shouldCenter = centered && (isDesktop || isTablet);
  const horizontalPadding = padding ?? (isDesktop ? 32 : isTablet ? 24 : 16);

  const containerStyle = [
    styles.container,
    shouldCenter && {
      maxWidth: finalMaxWidth,
      marginHorizontal: 'auto' as any,
      width: '100%' as any,
    },
    style,
  ];

  const contentStyle = [
    styles.content,
    {
      paddingHorizontal: horizontalPadding,
      paddingBottom: insets.bottom + 16,
    },
    contentContainerStyle,
  ];

  if (scrollable) {
    return (
      <ScrollView
        style={containerStyle}
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[containerStyle, contentStyle]}>
      {children}
    </View>
  );
}

interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: number;
  gap?: number;
  style?: any;
}

export function ResponsiveGrid({
  children,
  columns: customColumns,
  gap = 16,
  style,
}: ResponsiveGridProps) {
  const { columns: autoColumns, isDesktop, isTablet } = useResponsive();
  const columns = customColumns ?? autoColumns;

  const gridStyle = [
    styles.grid,
    {
      gap,
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
    },
    style,
  ];

  const childArray = React.Children.toArray(children);

  return (
    <View style={gridStyle}>
      {childArray.map((child, index) => (
        <View
          key={index}
          style={{
            width: `${100 / columns}%` as any,
            paddingRight: (index + 1) % columns !== 0 ? gap / 2 : 0,
            paddingLeft: index % columns !== 0 ? gap / 2 : 0,
            marginBottom: gap,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

interface ResponsiveRowProps {
  children: React.ReactNode;
  gap?: number;
  wrap?: boolean;
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  style?: any;
}

export function ResponsiveRow({
  children,
  gap = 16,
  wrap = true,
  align = 'stretch',
  justify = 'flex-start',
  style,
}: ResponsiveRowProps) {
  const { isMobile } = useResponsive();

  return (
    <View
      style={[
        {
          flexDirection: isMobile ? 'column' : 'row',
          gap,
          flexWrap: wrap ? 'wrap' : 'nowrap',
          alignItems: align,
          justifyContent: justify,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface ResponsiveColumnProps {
  children: React.ReactNode;
  flex?: number;
  minWidth?: number;
  style?: any;
}

export function ResponsiveColumn({
  children,
  flex = 1,
  minWidth = 300,
  style,
}: ResponsiveColumnProps) {
  const { isMobile } = useResponsive();

  return (
    <View
      style={[
        {
          flex: isMobile ? undefined : flex,
          width: isMobile ? '100%' : undefined,
          minWidth: isMobile ? undefined : minWidth,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
