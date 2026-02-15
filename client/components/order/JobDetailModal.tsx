import React, { useState } from "react";
import { View, Modal, ScrollView, Pressable, StyleSheet, Dimensions, Platform, Alert, Linking, Image, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, BrandColors, Typography } from "@/constants/theme";
import type { OrderCardDTO } from "@/adapters/orderCardAdapter";

interface ClosingSummary {
  orderId: string;
  closingText: string | null;
  closingStatus: string | null;
  submittedAt: string | null;
  deliveredCount: number | null;
  returnedCount: number | null;
  deliveryHistoryAttachments: { fileKey: string; url: string }[];
  etcAttachments: { fileKey: string; url: string }[];
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface JobDetailModalProps {
  visible: boolean;
  onClose: () => void;
  order: OrderCardDTO | null;
  fullOrderData?: any;
  hideButtons?: boolean;
  isRequester?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onHide?: () => void;
}

export function JobDetailModal({ visible, onClose, order, fullOrderData, hideButtons = false, isRequester = false, onEdit, onDelete, onHide }: JobDetailModalProps) {
  const [mapExpanded, setMapExpanded] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isHelper = user?.role === "helper";

  // Fetch closing summary for completed/closed orders
  const showClosingReport = order?.orderStatus && ['COMPLETED', 'CLOSED', 'completed', 'closed', 'pending_close', 'PENDING_CLOSE'].includes(order.orderStatus);
  
  const { data: closingSummary, isLoading: isLoadingClosing } = useQuery<ClosingSummary>({
    queryKey: ['/api/orders', order?.orderId, 'closing-summary'],
    enabled: visible && !!order?.orderId && !!showClosingReport,
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!order) return;
      const res = await apiRequest("POST", `/api/orders/${order.orderId}/apply`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/my-applications"] });
      if (Platform.OS === "web") {
        alert("지원이 완료되었습니다!");
      } else {
        Alert.alert("지원 완료", "지원이 완료되었습니다.");
      }
      onClose();
    },
    onError: (err: Error) => {
      const message = err.message || "지원에 실패했습니다.";
      if (Platform.OS === "web") {
        alert(message);
      } else {
        Alert.alert("오류", message);
      }
    },
  });

  if (!order) return null;

  const data = fullOrderData || order;

  const formatCurrency = (amount?: number) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("ko-KR").format(amount) + "원";
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return `${date.getMonth() + 1}월 ${date.getDate()}일`;
    } catch {
      return dateStr;
    }
  };

  const handleCopyAddress = async () => {
    const address = data.campAddress || data.pickupAddress || data.deliveryAddress || data.addressShort;
    if (address) {
      await Clipboard.setStringAsync(address);
      if (Platform.OS === "web") {
        alert("주소가 복사되었습니다.");
      } else {
        Alert.alert("복사됨", "주소가 클립보드에 복사되었습니다.");
      }
    }
  };

  const handleOpenMap = () => {
    const address = data.campAddress || data.pickupAddress || data.deliveryAddress || data.addressShort;
    if (address) {
      const encodedAddress = encodeURIComponent(address);
      const url = Platform.select({
        ios: `maps:?q=${encodedAddress}`,
        android: `geo:0,0?q=${encodedAddress}`,
        default: `https://maps.google.com?q=${encodedAddress}`,
      });
      Linking.openURL(url);
    }
  };

  const displayTitle = data.title || data.courierName || data.companyName || "오더";
  const displayAddress = data.campAddress || data.pickupAddress || data.deliveryAddress || 
    data.addressShort || data.deliveryArea || 
    (data.region1 ? `${data.region1} ${data.region2 || ""}`.trim() : "위치 미정");

  const canApply = isHelper && 
    !order.hasApplied && 
    order.orderStatus === "OPEN" && 
    (order.applicantCount || 0) < 3;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View 
          style={[
            styles.modalContainer, 
            { 
              backgroundColor: theme.backgroundRoot,
              paddingBottom: insets.bottom + Spacing.lg,
            }
          ]}
        >
          <View style={styles.handle} />
          
          <View style={[styles.header, { borderBottomColor: theme.backgroundSecondary }]}>
            <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
              오더 상세
            </ThemedText>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Icon name="close-outline" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView 
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Card style={styles.infoCard}>
              <View style={styles.titleSection}>
                {order.isUrgent ? (
                  <View style={styles.urgentBadge}>
                    <Icon name="warning-outline" size={14} color="#fff" />
                    <ThemedText style={styles.urgentText}>긴급</ThemedText>
                  </View>
                ) : null}
                <ThemedText style={[styles.orderTitle, { color: theme.text }]}>
                  {displayTitle}
                </ThemedText>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <Icon name="calendar-outline" size={16} color={theme.tabIconDefault} />
                    <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>
                      입차일
                    </ThemedText>
                    <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                      {formatDate(order.startAt)}
                      {order.endAt && order.endAt !== order.startAt ? ` ~ ${formatDate(order.endAt)}` : ""}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <Icon name="car-outline" size={16} color={theme.tabIconDefault} />
                    <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>
                      차종
                    </ThemedText>
                    <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                      {data.vehicleType || "-"}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <Icon name="cash-outline" size={16} color={theme.tabIconDefault} />
                    <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>
                      단가
                    </ThemedText>
                    <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                      {formatCurrency(order.unitPrice)}
                      {order.includesVat !== false ? " (VAT포함)" : " (VAT별도)"}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <Icon name="cube-outline" size={16} color={theme.tabIconDefault} />
                    <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>
                      물량
                    </ThemedText>
                    <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                      {order.averageQuantity ? `배송 ${order.averageQuantity}` : 
                       order.expectedCount ? `${order.expectedCount}건` : "-"}
                    </ThemedText>
                  </View>
                </View>

                {order.applicantCount !== undefined ? (
                  <View style={styles.infoRow}>
                    <View style={styles.infoItem}>
                      <Icon name="people-outline" size={16} color={theme.tabIconDefault} />
                      <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>
                        지원자
                      </ThemedText>
                      <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                        {order.applicantCount}명 / 3명
                      </ThemedText>
                    </View>
                  </View>
                ) : null}

                {order.requesterName ? (
                  <View style={styles.infoRow}>
                    <View style={styles.infoItem}>
                      <Icon name="person-outline" size={16} color={theme.tabIconDefault} />
                      <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>
                        요청자
                      </ThemedText>
                      <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                        {order.requesterName}
                      </ThemedText>
                    </View>
                  </View>
                ) : null}
              </View>
            </Card>

            <Card style={styles.addressCard}>
              <View style={styles.addressHeader}>
                <Icon name="location-outline" size={18} color={BrandColors.helper} />
                <ThemedText style={[styles.addressTitle, { color: theme.text }]}>
                  캠프 및 터미널주소
                </ThemedText>
              </View>
              {data.campName ? (
                <ThemedText style={[styles.campNameText, { color: theme.text }]}>
                  {data.campName}
                </ThemedText>
              ) : null}
              <ThemedText style={[styles.addressText, { color: theme.tabIconDefault }]}>
                {displayAddress}
              </ThemedText>
              <View style={styles.addressActions}>
                <Pressable 
                  style={[styles.addressButton, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={handleCopyAddress}
                >
                  <Icon name="copy-outline" size={16} color={theme.text} />
                  <ThemedText style={[styles.addressButtonText, { color: theme.text }]}>
                    복사
                  </ThemedText>
                </Pressable>
                <Pressable 
                  style={[styles.addressButton, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={handleOpenMap}
                >
                  <Icon name="map-outline" size={16} color={theme.text} />
                  <ThemedText style={[styles.addressButtonText, { color: theme.text }]}>
                    지도
                  </ThemedText>
                </Pressable>
              </View>
            </Card>

            {data.regionMapUrl ? (
              <Card style={styles.mapCard}>
                <View style={styles.addressHeader}>
                  <Icon name="image-outline" size={18} color={BrandColors.helper} />
                  <ThemedText style={[styles.addressTitle, { color: theme.text }]}>
                    배송지 이미지
                  </ThemedText>
                </View>
                <Pressable onPress={() => setMapExpanded(true)}>
                  <Image 
                    source={{ uri: data.regionMapUrl }} 
                    style={styles.mapImage}
                    resizeMode="cover"
                  />
                  <View style={styles.mapOverlay}>
                    <Icon name="fullscreen" size={20} color="#fff" />
                    <ThemedText style={styles.mapOverlayText}>
                      탭하여 확대
                    </ThemedText>
                  </View>
                </Pressable>
              </Card>
            ) : null}

            <Modal
              visible={mapExpanded}
              animationType="fade"
              transparent
              onRequestClose={() => setMapExpanded(false)}
            >
              <Pressable 
                style={styles.expandedImageOverlay} 
                onPress={() => setMapExpanded(false)}
              >
                <Image 
                  source={{ uri: data.regionMapUrl || '' }} 
                  style={styles.expandedImage}
                  resizeMode="contain"
                />
                <Pressable 
                  style={styles.closeExpandedButton}
                  onPress={() => setMapExpanded(false)}
                >
                  <Icon name="close-circle-outline" size={36} color="#fff" />
                </Pressable>
              </Pressable>
            </Modal>

            {data.deliveryGuide || data.deliveryGuideUrl ? (
              <Card style={styles.descriptionCard}>
                <ThemedText style={[styles.descriptionTitle, { color: theme.text }]}>
                  배송 가이드
                </ThemedText>
                {data.deliveryGuide ? (
                  <ScrollView 
                    style={styles.guideScrollView}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                  >
                    <ThemedText style={[styles.descriptionText, { color: theme.tabIconDefault }]}>
                      {data.deliveryGuide}
                    </ThemedText>
                  </ScrollView>
                ) : null}
                {data.deliveryGuideUrl ? (
                  <Pressable 
                    style={[styles.guideLink, { backgroundColor: theme.backgroundSecondary }]}
                    onPress={() => data.deliveryGuideUrl && Linking.openURL(data.deliveryGuideUrl)}
                  >
                    <Icon name="open-in-new" size={16} color={BrandColors.helper} />
                    <ThemedText style={[styles.guideLinkText, { color: BrandColors.helper }]}>
                      배송 가이드 보기
                    </ThemedText>
                  </Pressable>
                ) : null}
              </Card>
            ) : null}

            {data.description || data.requirements ? (
              <Card style={styles.descriptionCard}>
                <ThemedText style={[styles.descriptionTitle, { color: theme.text }]}>
                  상세 정보
                </ThemedText>
                {data.description ? (
                  <ThemedText style={[styles.descriptionText, { color: theme.tabIconDefault }]}>
                    {data.description}
                  </ThemedText>
                ) : null}
                {data.requirements ? (
                  <>
                    <ThemedText style={[styles.requirementsTitle, { color: theme.text }]}>
                      요구사항
                    </ThemedText>
                    <ThemedText style={[styles.descriptionText, { color: theme.tabIconDefault }]}>
                      {data.requirements}
                    </ThemedText>
                  </>
                ) : null}
              </Card>
            ) : null}

            {showClosingReport ? (
              <Card style={styles.closingReportCard}>
                <View style={styles.closingReportHeader}>
                  <Icon name="clipboard-outline" size={18} color={BrandColors.requester} />
                  <ThemedText style={[styles.closingReportTitle, { color: theme.text }]}>
                    마감 보고서
                  </ThemedText>
                </View>

                {isLoadingClosing ? (
                  <View style={styles.closingLoadingContainer}>
                    <ActivityIndicator size="small" color={BrandColors.requester} />
                    <ThemedText style={[styles.closingLoadingText, { color: theme.tabIconDefault }]}>
                      마감 정보 불러오는 중...
                    </ThemedText>
                  </View>
                ) : closingSummary ? (
                  <>
                    <View style={styles.closingCountsRow}>
                      <View style={[styles.closingCountBox, { backgroundColor: theme.backgroundSecondary }]}>
                        <Icon name="cube-outline" size={20} color={BrandColors.helper} />
                        <ThemedText style={[styles.closingCountValue, { color: theme.text }]}>
                          {closingSummary.deliveredCount ?? '-'}
                        </ThemedText>
                        <ThemedText style={[styles.closingCountLabel, { color: theme.tabIconDefault }]}>
                          배송 완료
                        </ThemedText>
                      </View>
                      <View style={[styles.closingCountBox, { backgroundColor: theme.backgroundSecondary }]}>
                        <Icon name="refresh-outline" size={20} color={BrandColors.warning} />
                        <ThemedText style={[styles.closingCountValue, { color: theme.text }]}>
                          {closingSummary.returnedCount ?? '-'}
                        </ThemedText>
                        <ThemedText style={[styles.closingCountLabel, { color: theme.tabIconDefault }]}>
                          반품
                        </ThemedText>
                      </View>
                    </View>

                    {closingSummary.closingText ? (
                      <View style={styles.closingMemoSection}>
                        <ThemedText style={[styles.closingMemoLabel, { color: theme.tabIconDefault }]}>
                          특이사항
                        </ThemedText>
                        <ThemedText style={[styles.closingMemoText, { color: theme.text }]}>
                          {closingSummary.closingText}
                        </ThemedText>
                      </View>
                    ) : null}

                    {closingSummary.deliveryHistoryAttachments && closingSummary.deliveryHistoryAttachments.length > 0 ? (
                      <View style={styles.closingImagesSection}>
                        <ThemedText style={[styles.closingImagesLabel, { color: theme.tabIconDefault }]}>
                          집배송 이력 증빙 ({closingSummary.deliveryHistoryAttachments.length}장)
                        </ThemedText>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.closingImagesScroll}>
                          {closingSummary.deliveryHistoryAttachments.map((img, idx) => (
                            <Pressable 
                              key={idx} 
                              onPress={() => setSelectedImage(img.url)}
                              style={styles.closingImageContainer}
                            >
                              <Image 
                                source={{ uri: img.url }} 
                                style={styles.closingImageThumbnail}
                                resizeMode="cover"
                              />
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    ) : null}

                    {closingSummary.etcAttachments && closingSummary.etcAttachments.length > 0 ? (
                      <View style={styles.closingImagesSection}>
                        <ThemedText style={[styles.closingImagesLabel, { color: theme.tabIconDefault }]}>
                          기타 첨부 ({closingSummary.etcAttachments.length}장)
                        </ThemedText>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.closingImagesScroll}>
                          {closingSummary.etcAttachments.map((img, idx) => (
                            <Pressable 
                              key={idx} 
                              onPress={() => setSelectedImage(img.url)}
                              style={styles.closingImageContainer}
                            >
                              <Image 
                                source={{ uri: img.url }} 
                                style={styles.closingImageThumbnail}
                                resizeMode="cover"
                              />
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    ) : null}

                    {closingSummary.submittedAt ? (
                      <ThemedText style={[styles.closingSubmittedAt, { color: theme.tabIconDefault }]}>
                        제출일시: {new Date(closingSummary.submittedAt).toLocaleString('ko-KR')}
                      </ThemedText>
                    ) : null}
                  </>
                ) : (
                  <View style={styles.closingEmptyContainer}>
                    <Icon name="document-text-outline" size={24} color={theme.tabIconDefault} />
                    <ThemedText style={[styles.closingEmptyText, { color: theme.tabIconDefault }]}>
                      아직 마감 보고서가 제출되지 않았습니다
                    </ThemedText>
                  </View>
                )}
              </Card>
            ) : null}

            <Modal
              visible={!!selectedImage}
              animationType="fade"
              transparent
              onRequestClose={() => setSelectedImage(null)}
            >
              <Pressable 
                style={styles.expandedImageOverlay} 
                onPress={() => setSelectedImage(null)}
              >
                <Image 
                  source={{ uri: selectedImage || '' }} 
                  style={styles.expandedImage}
                  resizeMode="contain"
                />
                <Pressable 
                  style={styles.closeExpandedButton}
                  onPress={() => setSelectedImage(null)}
                >
                  <Icon name="close-circle-outline" size={36} color="#fff" />
                </Pressable>
              </Pressable>
            </Modal>
          </ScrollView>

          {!hideButtons && canApply ? (
            <View style={styles.footer}>
              <Pressable
                style={[styles.applyButton, { backgroundColor: BrandColors.helper }]}
                onPress={() => applyMutation.mutate()}
                disabled={applyMutation.isPending}
              >
                <ThemedText style={styles.applyButtonText}>
                  {applyMutation.isPending ? "처리 중..." : "지원하기"}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          {isRequester && (onEdit || onDelete || onHide) ? (
            <View style={styles.requesterFooter}>
              {onEdit ? (
                <Pressable
                  style={[styles.requesterButton, styles.editButton, { backgroundColor: BrandColors.requester }]}
                  onPress={onEdit}
                >
                  <Icon name="create-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <ThemedText style={styles.requesterButtonText}>수정</ThemedText>
                </Pressable>
              ) : null}
              {onDelete ? (
                <Pressable
                  style={[styles.requesterButton, styles.deleteButton]}
                  onPress={() => {
                    if (Platform.OS === "web") {
                      if (confirm("정말 삭제하시겠습니까?")) {
                        onDelete();
                      }
                    } else {
                      Alert.alert(
                        "삭제 확인",
                        "정말 삭제하시겠습니까?",
                        [
                          { text: "취소", style: "cancel" },
                          { text: "삭제", style: "destructive", onPress: onDelete },
                        ]
                      );
                    }
                  }}
                >
                  <Icon name="trash-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <ThemedText style={styles.requesterButtonText}>삭제</ThemedText>
                </Pressable>
              ) : null}
              {onHide ? (
                <Pressable
                  style={[styles.requesterButton, { backgroundColor: '#6B7280' }]}
                  onPress={() => {
                    if (Platform.OS === "web") {
                      if (confirm("이 업무를 숨기시겠습니까? 목록에서 더 이상 표시되지 않습니다.")) {
                        onHide();
                      }
                    } else {
                      Alert.alert(
                        "숨기기",
                        "이 업무를 숨기시겠습니까? 목록에서 더 이상 표시되지 않습니다.",
                        [
                          { text: "취소", style: "cancel" },
                          { text: "숨기기", onPress: onHide },
                        ]
                      );
                    }
                  }}
                >
                  <Icon name="eye-off-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <ThemedText style={styles.requesterButtonText}>숨기기</ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContainer: {
    maxHeight: screenHeight * 0.85,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  closeButton: {
    padding: Spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  infoCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  titleSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  urgentBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EF4444",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  urgentText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  orderTitle: {
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
  },
  infoGrid: {
    gap: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  infoLabel: {
    fontSize: 14,
    minWidth: 50,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "500",
  },
  addressCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  campNameText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  addressText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  mapCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  mapPreview: {
    height: 120,
    borderRadius: BorderRadius.md,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
  },
  mapPreviewText: {
    fontSize: 14,
  },
  mapImage: {
    width: "100%",
    height: 160,
    borderRadius: BorderRadius.md,
  },
  mapOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderBottomLeftRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  mapOverlayText: {
    color: "#fff",
    fontSize: 14,
  },
  expandedImageOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  expandedImage: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
  closeExpandedButton: {
    position: "absolute",
    top: 60,
    right: 20,
  },
  guideScrollView: {
    maxHeight: 200,
  },
  guideLink: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
  },
  guideLinkText: {
    fontSize: 14,
    fontWeight: "500",
  },
  addressActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  addressButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  addressButtonText: {
    fontSize: 14,
  },
  descriptionCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  applyButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  applyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  requesterFooter: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  requesterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  editButton: {},
  deleteButton: {
    backgroundColor: "#EF4444",
  },
  requesterButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  closingReportCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  closingReportHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  closingReportTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  closingLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  closingLoadingText: {
    fontSize: 14,
  },
  closingCountsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  closingCountBox: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  closingCountValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  closingCountLabel: {
    fontSize: 12,
  },
  closingMemoSection: {
    marginBottom: Spacing.md,
  },
  closingMemoLabel: {
    fontSize: 12,
    marginBottom: Spacing.xs,
  },
  closingMemoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  closingImagesSection: {
    marginBottom: Spacing.md,
  },
  closingImagesLabel: {
    fontSize: 12,
    marginBottom: Spacing.sm,
  },
  closingImagesScroll: {
    flexDirection: "row",
  },
  closingImageContainer: {
    marginRight: Spacing.sm,
  },
  closingImageThumbnail: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
  },
  closingSubmittedAt: {
    fontSize: 12,
    marginTop: Spacing.sm,
    textAlign: "right" as const,
  },
  closingEmptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  closingEmptyText: {
    fontSize: 14,
    textAlign: "center" as const,
  },
});
