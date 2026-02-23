import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Pressable,
} from 'react-native';
import { ZoomableImageModal } from '@/components/ZoomableImageModal';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BrandColors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { useAuthImage } from '@/hooks/useAuthImage';
import { Card } from '@/components/Card';
import { getApiUrl } from '@/lib/query-client';
import { formatOrderNumber } from '@/lib/format-order-number';

interface Evidence {
  id: number;
  fileUrl: string;
  evidenceType: string;
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
  redelivery_in_progress: '재배송진행중',
  return_in_progress: '반납진행중',
  damage_confirmed: '파손확인',
  request_handling: '처리요망',
  confirmed: '확인완료',
  dispute: '이의제기',
};

export default function RequesterIncidentDetailScreen() {
  const { theme } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();
  const { getImageUrl: getEvidenceImageUrl } = useAuthImage();
  const [selectedEvidence, setSelectedEvidence] = useState<string | null>(null);
  const route = useRoute<RouteProp<{ params: { incidentId: number } }, 'params'>>();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { incidentId } = route.params;

  const { data: incident, isLoading } = useQuery<IncidentDetail>({
    queryKey: ['/api/incidents', incidentId],
  });

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
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: showDesktopLayout ? Spacing.xl : tabBarHeight + Spacing.xl,
          ...(showDesktopLayout && {
            maxWidth: containerMaxWidth,
            alignSelf: 'center' as const,
            width: '100%' as any,
          }),
        }
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
              <Text style={[styles.simpleInfoValue, { color: theme.text }]}>{formatOrderNumber(incident.order.orderNumber, incident.order.id)}</Text>
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
          <Text style={[styles.sectionTitle, { color: theme.text }]}>헬퍼 대응 결과</Text>

          <View style={[styles.helperResponseBadge, { backgroundColor: BrandColors.helper + '20' }]}>
            <Text style={[styles.helperResponseText, { color: BrandColors.helper }]}>
              {HELPER_STATUS_LABELS[incident.helperStatus] || incident.helperStatus}
            </Text>
          </View>

          {incident.helperNote ? (
            <View style={[styles.helperNoteBox, { backgroundColor: theme.backgroundDefault || '#f5f5f5' }]}>
              {/* 카테고리 태그가 [category] 형태로 포함된 경우 분리 표시 */}
              {incident.helperNote.startsWith('[') && incident.helperNote.includes(']') ? (
                <>
                  <View style={[styles.categoryTag, { backgroundColor: BrandColors.helper + '15' }]}>
                    <Feather name="tag" size={12} color={BrandColors.helper} />
                    <Text style={[styles.categoryTagText, { color: BrandColors.helper }]}>
                      {(() => {
                        const categoryMap: Record<string, string> = {
                          correction_delivery: '정정배송',
                          return_sendback: '반납 및 반송',
                          accident_request: '사고처리요청',
                        };
                        const match = incident.helperNote!.match(/^\[([^\]]+)\]/);
                        return match ? (categoryMap[match[1]] || match[1]) : '';
                      })()}
                    </Text>
                  </View>
                  <Text style={[styles.helperNote, { color: theme.tabIconDefault }]}>
                    {incident.helperNote.replace(/^\[[^\]]+\]\s*/, '')}
                  </Text>
                </>
              ) : (
                <Text style={[styles.helperNote, { color: theme.tabIconDefault }]}>
                  {incident.helperNote}
                </Text>
              )}
            </View>
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
        <>
          {/* 요청자/자동 증빙 자료 */}
          {incident.evidence.filter(ev => ev.evidenceType !== 'helper_photo').length > 0 ? (
            <Card style={styles.card}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                증빙 자료 ({incident.evidence.filter(ev => ev.evidenceType !== 'helper_photo').length}건)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {incident.evidence.filter(ev => ev.evidenceType !== 'helper_photo').map((ev) => {
                  const imgUrl = getEvidenceImageUrl(ev.fileUrl);
                  return (
                    <Pressable key={ev.id} style={styles.evidenceItem} onPress={() => setSelectedEvidence(imgUrl)}>
                      <Image
                        source={{ uri: imgUrl }}
                        style={styles.evidenceImage}
                        resizeMode="cover"
                        onError={() => console.warn('Evidence image load failed:', ev.fileUrl)}
                      />
                      <View style={[styles.evidenceTypeBadge, { backgroundColor: BrandColors.requester + '20' }]}>
                        <Text style={[styles.evidenceTypeText, { color: BrandColors.requester }]}>
                          {ev.evidenceType === 'delivery_history' ? '배송이력' : ev.evidenceType === 'photo' ? '접수사진' : '증빙'}
                        </Text>
                      </View>
                      {ev.description ? (
                        <Text style={[styles.evidenceDesc, { color: theme.tabIconDefault }]}>
                          {ev.description}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Card>
          ) : null}

          {/* 헬퍼 대응 증빙 사진 */}
          {incident.evidence.filter(ev => ev.evidenceType === 'helper_photo').length > 0 ? (
            <Card style={styles.card}>
              <View style={styles.helperEvidenceHeader}>
                <Feather name="camera" size={16} color={BrandColors.helper} />
                <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>
                  헬퍼 대응 사진 ({incident.evidence.filter(ev => ev.evidenceType === 'helper_photo').length}건)
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: Spacing.sm }}>
                {incident.evidence.filter(ev => ev.evidenceType === 'helper_photo').map((ev) => {
                  const imgUrl = getEvidenceImageUrl(ev.fileUrl);
                  return (
                    <Pressable key={ev.id} style={styles.evidenceItem} onPress={() => setSelectedEvidence(imgUrl)}>
                      <Image
                        source={{ uri: imgUrl }}
                        style={styles.evidenceImage}
                        resizeMode="cover"
                        onError={() => console.warn('Evidence image load failed:', ev.fileUrl)}
                      />
                      <View style={[styles.evidenceTypeBadge, { backgroundColor: BrandColors.helper + '20' }]}>
                        <Text style={[styles.evidenceTypeText, { color: BrandColors.helper }]}>헬퍼 증빙</Text>
                      </View>
                      {ev.description ? (
                        <Text style={[styles.evidenceDesc, { color: theme.tabIconDefault }]}>
                          {ev.description}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Card>
          ) : null}
        </>
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

      <ZoomableImageModal
        visible={!!selectedEvidence}
        imageUri={selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
      />
    </>
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
  helperNoteBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  categoryTagText: {
    ...Typography.small,
    fontWeight: '600',
  },
  helperNote: {
    ...Typography.body,
    lineHeight: 22,
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
  helperEvidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  evidenceItem: {
    marginRight: Spacing.md,
  },
  evidenceImage: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
  },
  evidenceTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  evidenceTypeText: {
    fontSize: 10,
    fontWeight: '600',
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
