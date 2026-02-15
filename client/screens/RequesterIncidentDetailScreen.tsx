import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BrandColors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Card } from '@/components/Card';
import { QueryErrorState } from "@/components/QueryErrorState";

interface Evidence {
  id: number;
  fileUrl: string;
  fileType: string;
  description: string | null;
}

interface IncidentDetail {
  id: number;
  orderId: number | null;
  incidentType: string;
  incidentDate: string | null;
  description: string;
  status: string;
  trackingNumber: string | null;
  deliveryAddress: string | null;
  customerName: string | null;
  customerPhone: string | null;
  damageAmount: number | null;
  helperStatus: string | null;
  helperActionAt: string | null;
  helperNote: string | null;
  adminMemo: string | null;
  deductionAmount: number | null;
  resolvedAt: string | null;
  createdAt: string | null;
  order: {
    id: number;
    campAddress: string | null;
    deliveryArea: string;
    scheduledDate: string;
    courierCompany: string | null;
    averageQuantity: string | null;
    pricePerUnit: number | null;
  } | null;
  helper: {
    id: string;
    name: string;
    nickname: string | null;
    phone: string;
  } | null;
  evidence: Evidence[];
}

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  damage: '파손',
  loss: '분실',
  lost: '분실',
  misdelivery: '오배송',
  wrong_delivery: '오배송',
  delay: '지연',
  dispute: '분쟁',
  complaint: '민원',
  other: '기타',
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '접수됨', color: '#F59E0B', bg: '#FEF3C7' },
  requested: { label: '접수됨', color: '#F59E0B', bg: '#FEF3C7' },
  submitted: { label: '접수됨', color: '#F59E0B', bg: '#FEF3C7' },
  reviewing: { label: '검토중', color: '#3B82F6', bg: '#DBEAFE' },
  investigating: { label: '조사중', color: '#3B82F6', bg: '#DBEAFE' },
  resolved: { label: '해결됨', color: '#10B981', bg: '#D1FAE5' },
  rejected: { label: '반려', color: '#EF4444', bg: '#FEE2E2' },
  closed: { label: '종료', color: '#6B7280', bg: '#F3F4F6' },
};

const HELPER_STATUS_LABELS: Record<string, string> = {
  item_found: '물건찾음',
  recovered: '회수완료',
  redelivered: '재배송완료',
  damage_confirmed: '파손확인',
  request_handling: '처리요망',
  confirmed: '확인완료',
  dispute: '이의제기',
};

export default function RequesterIncidentDetailScreen() {
  const { theme } = useTheme();
  const route = useRoute<RouteProp<{ params: { incidentId: number } }, 'params'>>();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { incidentId } = route.params;

  const { data: incident, isLoading, isError, error, refetch } = useQuery<IncidentDetail>({
    queryKey: ['/api/incidents', incidentId],
  });

  if (isError) return <QueryErrorState error={error as Error} onRetry={refetch} />;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.requester} />
      </View>
    );
  }

  if (!incident) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <Feather name="alert-circle" size={48} color={theme.tabIconDefault} />
        <Text style={[styles.emptyText, { color: theme.text }]}>사고를 찾을 수 없습니다</Text>
      </View>
    );
  }

  const statusInfo = STATUS_LABELS[incident.status] || STATUS_LABELS.pending;
  const typeLabel = INCIDENT_TYPE_LABELS[incident.incidentType] || incident.incidentType;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl }
      ]}
    >
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.typeContainer}>
            <Feather name="alert-triangle" size={20} color={BrandColors.error} />
            <Text style={[styles.typeText, { color: theme.text }]}>
              {typeLabel}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>사고 내용</Text>
          <Text style={[styles.description, { color: theme.tabIconDefault }]}>
            {incident.description}
          </Text>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>상세 정보</Text>
        
        <View style={styles.infoGrid}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrapper}>
              <Feather name="tag" size={16} color={BrandColors.requester} />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.tabIconDefault }]}>사고 유형</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{typeLabel}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrapper}>
              <Feather name="calendar" size={16} color={BrandColors.requester} />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.tabIconDefault }]}>접수일</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{formatDate(incident.createdAt)}</Text>
            </View>
          </View>

          {incident.incidentDate ? (
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrapper}>
                <Feather name="clock" size={16} color={BrandColors.requester} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.tabIconDefault }]}>사고일시</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{formatDate(incident.incidentDate)}</Text>
              </View>
            </View>
          ) : null}

          {incident.trackingNumber ? (
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrapper}>
                <Feather name="hash" size={16} color={BrandColors.requester} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.tabIconDefault }]}>송장번호</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{incident.trackingNumber}</Text>
              </View>
            </View>
          ) : null}

          {incident.order?.courierCompany ? (
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrapper}>
                <Feather name="truck" size={16} color={BrandColors.requester} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.tabIconDefault }]}>운송사</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{incident.order.courierCompany}</Text>
              </View>
            </View>
          ) : null}

          {incident.deliveryAddress ? (
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrapper}>
                <Feather name="map-pin" size={16} color={BrandColors.requester} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.tabIconDefault }]}>배송지</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{incident.deliveryAddress}</Text>
              </View>
            </View>
          ) : null}

          {incident.customerName ? (
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrapper}>
                <Feather name="user" size={16} color={BrandColors.requester} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.tabIconDefault }]}>수하인</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>
                  {incident.customerName}{incident.customerPhone ? ` (${incident.customerPhone})` : ''}
                </Text>
              </View>
            </View>
          ) : null}

          {incident.damageAmount ? (
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrapper}>
                <Feather name="dollar-sign" size={16} color={BrandColors.error} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.tabIconDefault }]}>피해금액</Text>
                <Text style={[styles.infoValue, { color: BrandColors.error }]}>
                  {incident.damageAmount.toLocaleString()}원
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </Card>

      {incident.order ? (
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>오더 정보</Text>
          
          <View style={styles.infoGrid}>
            <View style={styles.simpleInfoRow}>
              <Text style={[styles.simpleInfoLabel, { color: theme.tabIconDefault }]}>운송사</Text>
              <Text style={[styles.simpleInfoValue, { color: theme.text }]}>{incident.order.courierCompany || '-'}</Text>
            </View>
            <View style={styles.simpleInfoRow}>
              <Text style={[styles.simpleInfoLabel, { color: theme.tabIconDefault }]}>배송지역</Text>
              <Text style={[styles.simpleInfoValue, { color: theme.text }]}>{incident.order.deliveryArea || '-'}</Text>
            </View>
            <View style={styles.simpleInfoRow}>
              <Text style={[styles.simpleInfoLabel, { color: theme.tabIconDefault }]}>오더번호</Text>
              <Text style={[styles.simpleInfoValue, { color: theme.text }]}>O-{incident.order.id}</Text>
            </View>
            <View style={styles.simpleInfoRow}>
              <Text style={[styles.simpleInfoLabel, { color: theme.tabIconDefault }]}>배송일</Text>
              <Text style={[styles.simpleInfoValue, { color: theme.text }]}>{formatDate(incident.order.scheduledDate)}</Text>
            </View>
            {incident.helper ? (
              <View style={styles.simpleInfoRow}>
                <Text style={[styles.simpleInfoLabel, { color: theme.tabIconDefault }]}>수행헬퍼</Text>
                <Text style={[styles.simpleInfoValue, { color: theme.text }]}>{incident.helper.name || '-'}</Text>
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}

      {incident.helper ? (
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>헬퍼 정보</Text>
          
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrapper}>
                <Feather name="user" size={16} color={BrandColors.helper} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.tabIconDefault }]}>이름</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>
                  {incident.helper.nickname || incident.helper.name}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIconWrapper}>
                <Feather name="phone" size={16} color={BrandColors.helper} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.tabIconDefault }]}>연락처</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{incident.helper.phone}</Text>
              </View>
            </View>
          </View>
        </Card>
      ) : null}

      {incident.helperStatus ? (
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>헬퍼 응답</Text>
          
          <View style={[styles.helperResponseBadge, { backgroundColor: BrandColors.helper + '20' }]}>
            <Text style={[styles.helperResponseText, { color: BrandColors.helper }]}>
              {HELPER_STATUS_LABELS[incident.helperStatus] || incident.helperStatus}
            </Text>
          </View>

          {incident.helperNote ? (
            <Text style={[styles.helperNote, { color: theme.tabIconDefault }]}>
              {incident.helperNote}
            </Text>
          ) : null}

          {incident.helperActionAt ? (
            <Text style={[styles.responseTime, { color: theme.tabIconDefault }]}>
              응답일시: {formatDateTime(incident.helperActionAt)}
            </Text>
          ) : null}
        </Card>
      ) : (
        <Card style={styles.card}>
          <View style={styles.waitingResponse}>
            <Feather name="clock" size={24} color={BrandColors.warning} />
            <Text style={[styles.waitingText, { color: theme.text }]}>헬퍼 응답 대기중</Text>
            <Text style={[styles.waitingSubtext, { color: theme.tabIconDefault }]}>
              헬퍼가 사고에 대해 응답하면 알려드립니다
            </Text>
          </View>
        </Card>
      )}

      {incident.evidence && incident.evidence.length > 0 ? (
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            증빙 자료 ({incident.evidence.length}건)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {incident.evidence.map((ev) => (
              <View key={ev.id} style={styles.evidenceItem}>
                <Image source={{ uri: ev.fileUrl }} style={styles.evidenceImage} />
                {ev.description ? (
                  <Text style={[styles.evidenceDesc, { color: theme.tabIconDefault }]}>
                    {ev.description}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </Card>
      ) : null}

      {incident.adminMemo ? (
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>관리자 메모</Text>
          <View style={[styles.adminMemoBox, { backgroundColor: theme.backgroundDefault }]}>
            <Text style={[styles.adminMemoText, { color: theme.text }]}>
              {incident.adminMemo}
            </Text>
          </View>
        </Card>
      ) : null}

      {incident.resolvedAt ? (
        <Card style={styles.card}>
          <View style={styles.resolvedInfo}>
            <Feather name="check-circle" size={20} color={BrandColors.success} />
            <Text style={[styles.resolvedText, { color: theme.text }]}>
              해결됨: {formatDateTime(incident.resolvedAt)}
            </Text>
          </View>
          {incident.deductionAmount ? (
            <Text style={[styles.deductionAmount, { color: BrandColors.error }]}>
              차감 금액: {incident.deductionAmount.toLocaleString()}원
            </Text>
          ) : null}
        </Card>
      ) : null}
    </ScrollView>
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
    gap: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    marginTop: Spacing.md,
  },
  content: {
    padding: Spacing.md,
  },
  card: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  typeText: {
    ...Typography.h4,
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
  section: {
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  description: {
    ...Typography.body,
    lineHeight: 24,
  },
  infoGrid: {
    gap: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  simpleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  simpleInfoLabel: {
    ...Typography.small,
    minWidth: 70,
  },
  simpleInfoValue: {
    ...Typography.small,
    flex: 1,
    textAlign: 'right',
  },
  infoIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    ...Typography.small,
    marginBottom: 2,
  },
  infoValue: {
    ...Typography.body,
  },
  helperResponseBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  helperResponseText: {
    ...Typography.body,
    fontWeight: '600',
  },
  helperNote: {
    ...Typography.body,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  responseTime: {
    ...Typography.small,
  },
  waitingResponse: {
    alignItems: 'center',
    padding: Spacing.lg,
  },
  waitingText: {
    ...Typography.body,
    fontWeight: '600',
    marginTop: Spacing.sm,
  },
  waitingSubtext: {
    ...Typography.small,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  evidenceItem: {
    marginRight: Spacing.md,
  },
  evidenceImage: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
  },
  evidenceDesc: {
    fontSize: 12,
    marginTop: Spacing.xs,
    maxWidth: 100,
  },
  adminMemoBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  adminMemoText: {
    ...Typography.body,
    lineHeight: 22,
  },
  resolvedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  resolvedText: {
    ...Typography.body,
  },
  deductionAmount: {
    ...Typography.body,
    fontWeight: '600',
    marginTop: Spacing.sm,
  },
});
