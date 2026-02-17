import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Colors, BrandColors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { apiRequest } from '@/lib/query-client';

interface Evidence {
  id: number;
  fileUrl: string;
  fileType: string;
  description: string | null;
}

interface IncidentDetail {
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
  trackingNumber: string | null;
  deliveryAddress: string | null;
  customerName: string | null;
  customerPhone: string | null;
  damageAmount: number | null;
  order: {
    id: number;
    campAddress: string | null;
    deliveryArea: string;
    scheduledDate: string;
    courierCompany: string | null;
    averageQuantity: string | null;
  } | null;
  requester: {
    name: string;
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
  other: '기타',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  submitted: { label: '접수됨', color: BrandColors.warning },
  investigating: { label: '조사중', color: BrandColors.info },
  resolved: { label: '해결됨', color: BrandColors.success },
  closed: { label: '종료', color: BrandColors.neutral },
};

const HELPER_ACTIONS = [
  { key: 'item_found', label: '물건찾음', icon: 'check-circle' as const, color: BrandColors.success },
  { key: 'recovered', label: '회수완료', icon: 'refresh-cw' as const, color: BrandColors.success },
  { key: 'redelivered', label: '재배송완료', icon: 'truck' as const, color: BrandColors.success },
  { key: 'damage_confirmed', label: '파손확인', icon: 'alert-triangle' as const, color: BrandColors.warning },
  { key: 'request_handling', label: '처리요망', icon: 'alert-circle' as const, color: BrandColors.warning },
  { key: 'confirmed', label: '확인완료', icon: 'check' as const, color: BrandColors.info },
  { key: 'dispute', label: '이의제기', icon: 'message-circle' as const, color: BrandColors.error },
];

export default function HelperIncidentDetailScreen() {
  const { theme, isDark } = useTheme();
  const colors = theme;
  const route = useRoute<RouteProp<{ params: { incidentId: number } }, 'params'>>();
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const { incidentId } = route.params;

  const [note, setNote] = useState('');
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const { data: incident, isLoading } = useQuery<IncidentDetail>({
    queryKey: ['/api/helper/incidents', incidentId],
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, note }: { action: string; note: string }) => {
      return apiRequest('POST', `/api/helper/incidents/${incidentId}/action`, { action, note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/helper/incidents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/helper/incidents', incidentId] });
      Alert.alert('완료', '응답이 전송되었습니다');
      setNote('');
      setSelectedAction(null);
    },
    onError: (error: any) => {
      Alert.alert('오류', error.message || '응답 전송에 실패했습니다');
    },
  });

  const handleAction = (action: string) => {
    setSelectedAction(action);
  };

  const submitAction = () => {
    if (!selectedAction) return;
    actionMutation.mutate({ action: selectedAction, note });
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.helper} />
      </View>
    );
  }

  if (!incident) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.backgroundRoot }]}>
        <Text style={{ color: colors.text }}>사고를 찾을 수 없습니다</Text>
      </View>
    );
  }

  const statusInfo = STATUS_LABELS[incident.status] || { label: incident.status, color: BrandColors.neutral };
  const typeLabel = INCIDENT_TYPE_LABELS[incident.incidentType] || incident.incidentType;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.backgroundRoot }]}
      contentContainerStyle={[styles.content, { paddingTop: headerHeight + Spacing.md }]}
    >
      <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={styles.header}>
          <View style={styles.typeContainer}>
            <Feather name="alert-triangle" size={20} color={BrandColors.warning} />
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

        <View style={styles.dateRow}>
          <Feather name="calendar" size={14} color={colors.tabIconDefault} />
          <Text style={[styles.dateText, { color: colors.tabIconDefault }]}>
            배송일: {(() => {
              const dateStr = incident.order?.scheduledDate;
              if (!dateStr) return '-';
              const date = new Date(dateStr);
              return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('ko-KR');
            })()}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          사고 내용
        </Text>
        <Text style={[styles.description, { color: colors.tabIconDefault }]}>
          {incident.description}
        </Text>

        {incident.trackingNumber ? (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              송장번호
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {incident.trackingNumber}
            </Text>
          </View>
        ) : null}

        {incident.deliveryAddress ? (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              배송지 주소
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {incident.deliveryAddress}
            </Text>
          </View>
        ) : null}

        {incident.customerName ? (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              수하인
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {incident.customerName}{incident.customerPhone ? ` (${incident.customerPhone})` : ''}
            </Text>
          </View>
        ) : null}

        {incident.damageAmount ? (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              피해금액
            </Text>
            <Text style={[styles.infoValue, { color: BrandColors.error }]}>
              {(incident.damageAmount || 0).toLocaleString()}원
            </Text>
          </View>
        ) : null}
      </View>

      {incident.order ? (
        <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            오더 정보
          </Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              운송사
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {incident.order.courierCompany || '-'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              배송지역
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {incident.order.deliveryArea || '-'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              오더번호
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              O-{incident.order.id}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              배송일
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {new Date(incident.order.scheduledDate).toLocaleDateString('ko-KR')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              수행헬퍼
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {(incident.order as any).helperName || '-'}
            </Text>
          </View>
        </View>
      ) : null}

      {incident.requester ? (
        <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            요청자 정보
          </Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              이름
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {incident.requester.name}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              연락처
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {incident.requester.phone}
            </Text>
          </View>
        </View>
      ) : null}

      {incident.evidence && incident.evidence.length > 0 ? (
        <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            증빙 자료 ({incident.evidence.length}건)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {incident.evidence.map((ev) => (
              <View key={ev.id} style={styles.evidenceItem}>
                <Image source={{ uri: ev.fileUrl }} style={styles.evidenceImage} />
                {ev.description ? (
                  <Text style={[styles.evidenceDesc, { color: colors.tabIconDefault }]}>
                    {ev.description}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {incident.helperStatus ? (
        <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            내 응답
          </Text>
          <View style={[styles.myResponseBadge, { backgroundColor: BrandColors.helper + '20' }]}>
            <Text style={[styles.myResponseText, { color: BrandColors.helper }]}>
              {HELPER_ACTIONS.find(a => a.key === incident.helperStatus)?.label || incident.helperStatus}
            </Text>
          </View>
          {incident.helperNote ? (
            <Text style={[styles.helperNoteText, { color: colors.tabIconDefault }]}>
              {incident.helperNote}
            </Text>
          ) : null}
          <Text style={[styles.responseTime, { color: colors.tabIconDefault }]}>
            {incident.helperActionAt ? new Date(incident.helperActionAt).toLocaleString('ko-KR') : ''}
          </Text>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            응답하기
          </Text>
          <Text style={[styles.actionHint, { color: colors.tabIconDefault }]}>
            아래 버튼 중 하나를 선택하여 응답해주세요
          </Text>

          <View style={styles.actionButtons}>
            {HELPER_ACTIONS.map((action) => (
              <Pressable
                key={action.key}
                style={[
                  styles.actionButton,
                  selectedAction === action.key && { borderColor: action.color, borderWidth: 2 },
                  { backgroundColor: action.color + '15' }
                ]}
                onPress={() => handleAction(action.key)}
              >
                <Feather name={action.icon} size={20} color={action.color} />
                <Text style={[styles.actionButtonText, { color: action.color }]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {selectedAction ? (
            <>
              <Text style={[styles.noteLabel, { color: colors.text }]}>
                메모 (선택)
              </Text>
              <TextInput
                style={[
                  styles.noteInput,
                  {
                    backgroundColor: colors.backgroundRoot,
                    color: colors.text,
                    borderColor: colors.backgroundTertiary,
                  }
                ]}
                placeholder="추가 설명을 입력하세요..."
                placeholderTextColor={colors.tabIconDefault}
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
              />
              <Pressable
                style={[styles.submitButton, actionMutation.isPending && styles.submitButtonDisabled]}
                onPress={submitAction}
                disabled={actionMutation.isPending}
              >
                {actionMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>응답 전송</Text>
                )}
              </Pressable>
            </>
          ) : null}
        </View>
      )}
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
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing['5xl'],
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  header: {
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
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  dateText: {
    ...Typography.small,
  },
  sectionTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  description: {
    ...Typography.small,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  infoLabel: {
    width: 60,
    ...Typography.small,
  },
  infoValue: {
    flex: 1,
    ...Typography.small,
  },
  evidenceItem: {
    marginRight: Spacing.sm,
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
  myResponseBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  myResponseText: {
    ...Typography.body,
    fontWeight: '600',
  },
  helperNoteText: {
    ...Typography.small,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  responseTime: {
    fontSize: 12,
  },
  actionHint: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  actionButtonText: {
    ...Typography.small,
    fontWeight: '500',
  },
  noteLabel: {
    ...Typography.small,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: Spacing.md,
  },
  submitButton: {
    backgroundColor: BrandColors.helper,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    ...Typography.body,
    fontWeight: '600',
  },
});
