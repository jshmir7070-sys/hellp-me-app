import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useHeaderHeight } from '@react-navigation/elements';
import { Colors, BrandColors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { formatOrderNumber } from '@/lib/format-order-number';

interface Incident {
  id: number;
  orderId: number;
  incidentType: string;
  incidentDate: string;
  description: string;
  status: string;
  helperStatus: string | null;
  helperActionAt: string | null;
  helperNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  damage: '파손',
  loss: '분실',
  lost: '분실',
  misdelivery: '오배송',
  wrong_delivery: '오배송',
  delay: '지연',
  other: '기타',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  submitted: { label: '접수됨', color: BrandColors.warning },
  investigating: { label: '조사중', color: BrandColors.info },
  resolved: { label: '해결됨', color: BrandColors.success },
  closed: { label: '종료', color: BrandColors.neutral },
};

const HELPER_STATUS_LABELS: Record<string, string> = {
  item_found: '물건찾음',
  recovered: '회수완료',
  redelivered: '재배송완료',
  redelivery_in_progress: '재배송진행중',
  return_in_progress: '반납진행중',
  damage_confirmed: '파손확인',
  request_handling: '처리요망',
  confirmed: '확인완료',
  dispute: '이의제기',
};

export default function HelperIncidentListScreen({ route }: any) {
  const { theme, isDark } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();
  const colors = theme;
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const headerHeight = useHeaderHeight();
  const filterOrderId = route?.params?.orderId;

  const { data: rawIncidents, isLoading, refetch, isRefetching } = useQuery<Incident[]>({
    queryKey: ['/api/helper/incidents'],
  });

  // orderId 파라미터가 있으면 해당 오더만 필터
  const incidents = React.useMemo(() => {
    if (!rawIncidents) return [];
    if (!filterOrderId) return rawIncidents;
    return rawIncidents.filter(i => i.orderId === Number(filterOrderId));
  }, [rawIncidents, filterOrderId]);

  const renderItem = ({ item }: { item: Incident }) => {
    const statusInfo = STATUS_LABELS[item.status] || { label: item.status, color: BrandColors.neutral };
    const typeLabel = INCIDENT_TYPE_LABELS[item.incidentType] || item.incidentType;
    const helperStatusLabel = item.helperStatus ? HELPER_STATUS_LABELS[item.helperStatus] : null;

    return (
      <Pressable
        style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}
        onPress={() => navigation.navigate('HelperIncidentDetail', { incidentId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.typeContainer}>
            <Feather name="alert-triangle" size={16} color={BrandColors.warning} />
            <Text style={[styles.typeText, { color: colors.text }]}>
              {typeLabel}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        <Text
          style={[styles.description, { color: colors.tabIconDefault }]}
          numberOfLines={2}
        >
          {item.description}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.dateContainer}>
            <Feather name="calendar" size={12} color={colors.tabIconDefault} />
            <Text style={[styles.dateText, { color: colors.tabIconDefault }]}>
              {item.incidentDate && item.incidentDate.trim() !== ''
                ? new Date(item.incidentDate).toLocaleDateString('ko-KR')
                : new Date(item.createdAt).toLocaleDateString('ko-KR')}
            </Text>
          </View>
          {helperStatusLabel ? (
            <View style={[styles.helperStatusBadge, { backgroundColor: BrandColors.helper + '20' }]}>
              <Text style={[styles.helperStatusText, { color: BrandColors.helper }]}>
                내 응답: {helperStatusLabel}
              </Text>
            </View>
          ) : (
            <View style={[styles.helperStatusBadge, { backgroundColor: BrandColors.error + '20' }]}>
              <Text style={[styles.helperStatusText, { color: BrandColors.error }]}>
                응답 필요
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.helper} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundRoot }]}>
      <FlatList
        data={incidents}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, {
          paddingTop: headerHeight + Spacing.md,
          ...(showDesktopLayout && {
            maxWidth: containerMaxWidth,
            alignSelf: 'center' as const,
            width: '100%' as any,
          }),
        }]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="check-circle" size={48} color={BrandColors.success} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {filterOrderId ? '해당 오더 사고 내역 없음' : '사고 내역이 없습니다'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.tabIconDefault }]}>
              {filterOrderId ? `오더 #${filterOrderId}에 접수된 사고가 없습니다` : '접수된 사고가 없습니다'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing['5xl'],
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  typeText: {
    ...Typography.body,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    ...Typography.small,
    fontWeight: '600',
  },
  description: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dateText: {
    fontSize: 12,
  },
  helperStatusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  helperStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing['5xl'],
  },
  emptyTitle: {
    ...Typography.h4,
    marginTop: Spacing.md,
  },
  emptyText: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
});
