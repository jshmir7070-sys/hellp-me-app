import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';
import { Spacing } from '@/constants/theme';

interface ColumnGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  columns?: number; // override useResponsive columns
  gap?: number;
  style?: StyleProp<ViewStyle>;
  keyExtractor?: (item: T, index: number) => string;
}

/**
 * 반응형 그리드 컴포넌트.
 * 데스크탑에서 카드를 2~3열로 배치, 모바일에서는 1열.
 */
export function ColumnGrid<T>({
  items,
  renderItem,
  columns: columnOverride,
  gap = Spacing.md,
  style,
  keyExtractor,
}: ColumnGridProps<T>) {
  const { columns: responsiveColumns } = useResponsive();
  const columns = columnOverride ?? responsiveColumns;

  if (columns <= 1) {
    // 1열: 기존과 동일하게 단순 나열
    return (
      <View style={style}>
        {items.map((item, index) => (
          <View key={keyExtractor?.(item, index) ?? String(index)} style={{ marginBottom: gap }}>
            {renderItem(item, index)}
          </View>
        ))}
      </View>
    );
  }

  // 멀티 컬럼: flexWrap 사용
  const itemWidth = `${(100 / columns).toFixed(2)}%` as any;

  return (
    <View style={[styles.grid, { gap }, style]}>
      {items.map((item, index) => (
        <View
          key={keyExtractor?.(item, index) ?? String(index)}
          style={{
            width: itemWidth,
            // gap 보정: 각 아이템에서 gap의 (columns-1)/columns 만큼 빼줌
            maxWidth: `calc(${itemWidth} - ${(gap * (columns - 1)) / columns}px)` as any,
          }}
        >
          {renderItem(item, index)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
