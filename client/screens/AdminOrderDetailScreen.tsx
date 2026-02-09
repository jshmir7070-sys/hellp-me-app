import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Modal,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Icon } from "@/components/Icon";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Spacing, Typography, BorderRadius, BrandColors, Colors } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

const { width: screenWidth } = Dimensions.get('window');
const TABS = ['기본정보', '증빙자료', '정산내역', '분쟁/사고'];

interface OrderEvidence {
  deliveryHistoryImages: string[];
  etcImages: string[];
  incidentEvidence: {
    id: number;
    type: string;
    imageUrl: string;
    uploadedAt: string;
  }[];
  closingMemo: string;
  qrEvents: {
    type: string;
    timestamp: string;
    helperName: string;
  }[];
}

interface OrderDetail {
  id: number;
  status: string;
  carrierName: string;
  workStartDate: string;
  workEndDate: string;
  pickupLocation: string;
  deliveryLocation: string;
  cargoType: string;
  pricePerUnit: number;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  helperName: string;
  helperPhone: string;
  requesterName: string;
  requesterPhone: string;
  createdAt: string;
}

type AdminOrderDetailScreenProps = NativeStackScreenProps<any, 'AdminOrderDetail'>;

export default function AdminOrderDetailScreen({ route }: AdminOrderDetailScreenProps) {
  const { orderId } = route.params || {};
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { data: orderDetail, isLoading: detailLoading } = useQuery<OrderDetail>({
    queryKey: ['/api/admin/orders', orderId],
    enabled: !!orderId,
  });

  const { data: evidence, isLoading: evidenceLoading } = useQuery<OrderEvidence>({
    queryKey: ['/api/admin/orders', orderId, 'evidence'],
    enabled: !!orderId && activeTab === 1,
  });

  const getImageUrl = (imagePath: string) => {
    if (imagePath.startsWith('http')) return imagePath;
    return new URL(imagePath, getApiUrl()).toString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      awaiting_deposit: '계약금 대기',
      open: '지원가능',
      scheduled: '배차완료',
      in_progress: '진행중',
      closing_submitted: '마감제출',
      final_amount_confirmed: '최종금액확정',
      balance_paid: '잔금완료',
      settlement_paid: '정산완료',
      closed: '완료',
      cancelled: '취소됨',
    };
    return statusMap[status] || status;
  };

  const renderBasicInfo = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Card variant="glass" padding="md" style={styles.card}>
        <View style={styles.cardHeader}>
          <ThemedText style={[styles.cardTitle, { color: theme.text }]}>오더 정보</ThemedText>
          <View style={[styles.statusBadge, { backgroundColor: BrandColors.helper + '20' }]}>
            <ThemedText style={[styles.statusText, { color: BrandColors.helper }]}>
              {getStatusLabel(orderDetail?.status || '')}
            </ThemedText>
          </View>
        </View>
        
        <View style={styles.infoRow}>
          <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>운송사</ThemedText>
          <ThemedText style={[styles.infoValue, { color: theme.text }]}>{orderDetail?.carrierName || '-'}</ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>작업기간</ThemedText>
          <ThemedText style={[styles.infoValue, { color: theme.text }]}>
            {orderDetail?.workStartDate || '-'} ~ {orderDetail?.workEndDate || '-'}
          </ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>출발지</ThemedText>
          <ThemedText style={[styles.infoValue, { color: theme.text }]}>{orderDetail?.pickupLocation || '-'}</ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>도착지</ThemedText>
          <ThemedText style={[styles.infoValue, { color: theme.text }]}>{orderDetail?.deliveryLocation || '-'}</ThemedText>
        </View>
      </Card>

      <Card variant="glass" padding="md" style={styles.card}>
        <ThemedText style={[styles.cardTitle, { color: theme.text }]}>담당자 정보</ThemedText>
        <View style={styles.infoRow}>
          <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>헬퍼</ThemedText>
          <ThemedText style={[styles.infoValue, { color: theme.text }]}>
            {orderDetail?.helperName || '-'} {orderDetail?.helperPhone ? `(${orderDetail.helperPhone})` : ''}
          </ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>요청자</ThemedText>
          <ThemedText style={[styles.infoValue, { color: theme.text }]}>
            {orderDetail?.requesterName || '-'} {orderDetail?.requesterPhone ? `(${orderDetail.requesterPhone})` : ''}
          </ThemedText>
        </View>
      </Card>

      <Card variant="glass" padding="md" style={styles.card}>
        <ThemedText style={[styles.cardTitle, { color: theme.text }]}>금액 정보</ThemedText>
        <View style={styles.infoRow}>
          <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>단가</ThemedText>
          <ThemedText style={[styles.infoValue, { color: theme.text }]}>{formatCurrency(orderDetail?.pricePerUnit || 0)}</ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>계약금</ThemedText>
          <ThemedText style={[styles.infoValue, { color: theme.text }]}>{formatCurrency(orderDetail?.depositAmount || 0)}</ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>잔금</ThemedText>
          <ThemedText style={[styles.infoValue, { color: BrandColors.requester, fontWeight: '600' }]}>
            {formatCurrency(orderDetail?.balanceAmount || 0)}
          </ThemedText>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.backgroundTertiary }]} />
        <View style={styles.infoRow}>
          <ThemedText style={[styles.infoLabel, { color: theme.text, fontWeight: '600' }]}>총액</ThemedText>
          <ThemedText style={[styles.infoValue, { color: theme.text, fontWeight: '700' }]}>
            {formatCurrency(orderDetail?.totalAmount || 0)}
          </ThemedText>
        </View>
      </Card>
    </ScrollView>
  );

  const renderEvidenceTab = () => {
    if (evidenceLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.helper} />
        </View>
      );
    }

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <Card variant="glass" padding="md" style={styles.card}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>집배송 이력 (필수)</ThemedText>
            <View style={[styles.requiredBadge, { backgroundColor: BrandColors.helper + '20' }]}>
              <ThemedText style={[styles.requiredText, { color: BrandColors.helper }]}>필수</ThemedText>
            </View>
          </View>
          <ThemedText style={[styles.sectionDesc, { color: theme.tabIconDefault }]}>
            분쟁/사고 발생 시 법적 증빙으로 활용되는 자료입니다
          </ThemedText>
          
          {evidence?.deliveryHistoryImages && evidence.deliveryHistoryImages.length > 0 ? (
            <View style={styles.imageGrid}>
              {evidence.deliveryHistoryImages.map((image, index) => (
                <Pressable
                  key={`delivery-${index}`}
                  style={styles.imageWrapper}
                  onPress={() => setSelectedImage(getImageUrl(image))}
                >
                  <Image source={{ uri: getImageUrl(image) }} style={styles.thumbnail} resizeMode="cover" />
                  <View style={[styles.imageIndex, { backgroundColor: BrandColors.helper }]}>
                    <ThemedText style={styles.imageIndexText}>{index + 1}</ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyImages, { backgroundColor: theme.backgroundSecondary }]}>
              <Icon name="image-outline" size={24} color={theme.tabIconDefault} />
              <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
                업로드된 이미지가 없습니다
              </ThemedText>
            </View>
          )}
        </Card>

        <Card variant="glass" padding="md" style={styles.card}>
          <ThemedText style={[styles.cardTitle, { color: theme.text }]}>기타 참고 이미지</ThemedText>
          {evidence?.etcImages && evidence.etcImages.length > 0 ? (
            <View style={styles.imageGrid}>
              {evidence.etcImages.map((image, index) => (
                <Pressable
                  key={`etc-${index}`}
                  style={styles.imageWrapper}
                  onPress={() => setSelectedImage(getImageUrl(image))}
                >
                  <Image source={{ uri: getImageUrl(image) }} style={styles.thumbnail} resizeMode="cover" />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyImages, { backgroundColor: theme.backgroundSecondary }]}>
              <Icon name="image-outline" size={24} color={theme.tabIconDefault} />
              <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
                업로드된 이미지가 없습니다
              </ThemedText>
            </View>
          )}
        </Card>

        <Card variant="glass" padding="md" style={styles.card}>
          <ThemedText style={[styles.cardTitle, { color: theme.text }]}>QR 이벤트 기록</ThemedText>
          {evidence?.qrEvents && evidence.qrEvents.length > 0 ? (
            <View style={styles.eventList}>
              {evidence.qrEvents.map((event, index) => (
                <View key={index} style={[styles.eventItem, { borderBottomColor: theme.backgroundTertiary }]}>
                  <View style={[styles.eventDot, { backgroundColor: event.type === 'start' ? BrandColors.requester : BrandColors.helper }]} />
                  <View style={styles.eventInfo}>
                    <ThemedText style={[styles.eventType, { color: theme.text }]}>
                      {event.type === 'start' ? '업무 시작' : '업무 종료'}
                    </ThemedText>
                    <ThemedText style={[styles.eventMeta, { color: theme.tabIconDefault }]}>
                      {event.helperName} • {format(new Date(event.timestamp), 'yyyy.MM.dd HH:mm', { locale: ko })}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
              QR 이벤트 기록이 없습니다
            </ThemedText>
          )}
        </Card>

        <Card variant="glass" padding="md" style={styles.card}>
          <ThemedText style={[styles.cardTitle, { color: theme.text }]}>헬퍼 마감 메모</ThemedText>
          <View style={[styles.memoBox, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText style={[styles.memoText, { color: theme.text }]}>
              {evidence?.closingMemo || '마감 메모 없음'}
            </ThemedText>
          </View>
        </Card>
      </ScrollView>
    );
  };

  const renderSettlementTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Card variant="glass" padding="md" style={styles.card}>
        <ThemedText style={[styles.cardTitle, { color: theme.text }]}>정산 내역</ThemedText>
        <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
          정산 내역이 없습니다
        </ThemedText>
      </Card>
    </ScrollView>
  );

  const renderDisputeTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Card variant="glass" padding="md" style={styles.card}>
        <ThemedText style={[styles.cardTitle, { color: theme.text }]}>분쟁/사고 내역</ThemedText>
        {evidence?.incidentEvidence && evidence.incidentEvidence.length > 0 ? (
          <View style={styles.incidentList}>
            {evidence.incidentEvidence.map((incident, index) => (
              <View key={incident.id} style={[styles.incidentItem, { borderBottomColor: theme.backgroundTertiary }]}>
                <View style={styles.incidentHeader}>
                  <View style={[styles.incidentTypeBadge, { backgroundColor: BrandColors.errorLight }]}>
                    <ThemedText style={[styles.incidentTypeText, { color: BrandColors.error }]}>
                      {incident.type === 'damage' ? '파손' :
                       incident.type === 'loss' ? '분실' :
                       incident.type === 'misdelivery' ? '오배송' :
                       incident.type === 'delay' ? '지연' : '기타'}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.incidentDate, { color: theme.tabIconDefault }]}>
                    {format(new Date(incident.uploadedAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                  </ThemedText>
                </View>
                {incident.imageUrl ? (
                  <Pressable onPress={() => setSelectedImage(getImageUrl(incident.imageUrl))}>
                    <Image source={{ uri: getImageUrl(incident.imageUrl) }} style={styles.incidentImage} resizeMode="cover" />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
            분쟁/사고 내역이 없습니다
          </ThemedText>
        )}
      </Card>
    </ScrollView>
  );

  if (detailLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.helper} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.tabBar, { paddingTop: headerHeight, backgroundColor: theme.backgroundDefault }]}>
        {TABS.map((tab, index) => (
          <Pressable
            key={tab}
            style={[
              styles.tabItem,
              activeTab === index && styles.tabItemActive,
              activeTab === index && { borderBottomColor: BrandColors.helper },
            ]}
            onPress={() => setActiveTab(index)}
          >
            <ThemedText
              style={[
                styles.tabLabel,
                { color: activeTab === index ? BrandColors.helper : theme.tabIconDefault },
              ]}
            >
              {tab}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom }]}>
        {activeTab === 0 && renderBasicInfo()}
        {activeTab === 1 && renderEvidenceTab()}
        {activeTab === 2 && renderSettlementTab()}
        {activeTab === 3 && renderDisputeTab()}
      </View>

      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedImage(null)}>
          <View style={styles.modalContent}>
            {selectedImage ? (
              <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />
            ) : null}
            <Pressable style={styles.closeButton} onPress={() => setSelectedImage(null)}>
              <Icon name="close-outline" size={24} color="#fff" />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tabItem: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomWidth: 2,
  },
  tabLabel: {
    ...Typography.small,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  card: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.h4,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    ...Typography.small,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    ...Typography.body,
  },
  infoValue: {
    ...Typography.body,
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  sectionDesc: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  requiredBadge: {
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  requiredText: {
    fontSize: 10,
    fontWeight: '600',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.xs,
  },
  imageWrapper: {
    width: (screenWidth - Spacing.lg * 2 - Spacing.lg * 2 - Spacing.xs * 4) / 3,
    aspectRatio: 1,
    margin: Spacing.xs,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  imageIndex: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageIndexText: {
    color: Colors.light.buttonText,
    fontSize: 10,
    fontWeight: '700',
  },
  emptyImages: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  emptyText: {
    ...Typography.body,
    textAlign: 'center',
  },
  eventList: {
    gap: Spacing.xs,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.md,
  },
  eventInfo: {
    flex: 1,
  },
  eventType: {
    ...Typography.body,
    fontWeight: '500',
  },
  eventMeta: {
    ...Typography.small,
  },
  memoBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  memoText: {
    ...Typography.body,
    lineHeight: 22,
  },
  incidentList: {
    gap: Spacing.md,
  },
  incidentItem: {
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  incidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  incidentTypeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  incidentTypeText: {
    ...Typography.small,
    fontWeight: '600',
  },
  incidentDate: {
    ...Typography.small,
  },
  incidentImage: {
    width: '100%',
    height: 150,
    borderRadius: BorderRadius.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: screenWidth,
    height: screenWidth,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
