import React, { useEffect, useRef } from "react";
import { View, Pressable, StyleSheet, Animated, Alert } from "react-native";
import { Icon } from "@/components/Icon";
import * as Clipboard from "expo-clipboard";

import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button as PremiumButton } from "@/components/Button";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors, PremiumGradients, PremiumColors } from "@/constants/theme";
import type { OrderCardDTO } from "@/adapters/orderCardAdapter";
import {
  getStatusLabel,
  getRequesterButtons,
  getHelperRecruitmentButtons,
  getHelperApplicationButtons,
  getHelperMyOrderButtons,
  getSettlementListButtons,
  getReviewListButtons,
  type ActionButton,
} from "@/domain/orderCardRules";

export type CardContext = 
  | "requester_home"
  | "helper_recruitment"
  | "helper_application"
  | "helper_my_orders"
  | "settlement_list"
  | "review_list"
  | "requester_history"
  | "helper_history"
  | "requester_closing";

interface OrderCardProps {
  data: OrderCardDTO;
  context: CardContext;
  onAction?: (action: string, data: OrderCardDTO) => void;
  onPress?: (data: OrderCardDTO) => void;
}

export function OrderCard({ data, context, onAction, onPress }: OrderCardProps) {
  const { theme } = useTheme();
  const flashAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (data.isUrgent) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
          Animated.timing(flashAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [data.isUrgent, flashAnim]);

  const statusLabel = getStatusLabel(
    data.viewerRole,
    data.orderStatus,
    data.closingReviewStatus,
    data.paymentStatus?.balance,
    data.settlementStatus,
    data.applicantCount,
    data.hasApplied
  );

  const buttons = getButtonsForContext(context, data);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } catch {
      return dateStr;
    }
  };

  const formatDateRange = (start?: string, end?: string) => {
    const startDate = formatDate(start);
    const endDate = formatDate(end);
    if (!startDate) return "-";
    if (!endDate || startDate === endDate) return startDate;
    return `${startDate} ~ ${endDate}`;
  };

  const formatDeliverySummary = () => {
    // 마감 제출된 경우 실제 수량 표시
    if (data.deliveredCount !== undefined && data.deliveredCount > 0) {
      const delivered = data.deliveredCount || 0;
      const returned = data.returnedCount || 0;
      const other = data.otherCount || 0;
      if (other > 0) {
        return `${delivered}건 / ${returned}건 / ${other}건`;
      }
      return `${delivered}건 / ${returned}건`;
    }
    // 마감 전에는 예상 물량 표시
    if (data.averageQuantity) {
      return `평균 ${data.averageQuantity}건`;
    }
    return "-";
  };

  const formatUnitPrice = () => {
    if (!data.unitPrice) return "-";
    const price = new Intl.NumberFormat("ko-KR").format(data.unitPrice);
    const vatLabel = data.includesVat === false ? "(VAT별도)" : "(VAT포함)";
    return `${price}원 ${vatLabel}`;
  };

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return "-";
    return new Intl.NumberFormat("ko-KR").format(amount) + "원";
  };

  const handleCardPress = () => {
    console.log("[OrderCard] Card pressed, orderId:", data.orderId);
    if (onPress) {
      onPress(data);
    }
  };

  const handleButtonPress = (action: string) => {
    if (onAction) {
      onAction(action, data);
    }
  };

  const displayName = data.courierName || data.companyName || data.title || "오더";
  const displayAddress = data.deliveryArea || data.addressShort || 
    (data.region1 ? `${data.region1} ${data.region2 || ""}`.trim() : "위치 미정");

  // 오더공고/신청내역 등 리스트용 컨텍스트인지 판별
  const isListContext = context === 'helper_recruitment' || context === 'helper_application' || context === 'helper_my_orders';

  // 상세 정보가 필요한 컨텍스트 (요청자 이력, 정산 등)
  const isDetailContext = context === 'requester_history' || context === 'settlement_list';

  return (
    <Card variant="glass" padding={isListContext ? "sm" : "lg"} style={isListContext ? styles.cardCompact : styles.card} onPress={handleCardPress}>
        {/* === 헤더: 업체명 + 상태뱃지 === */}
        <View style={isListContext ? styles.headerCompact : styles.header}>
          <View style={styles.titleSection}>
            {data.isUrgent ? (
              <Animated.View style={{ opacity: flashAnim }}>
                <Badge variant="gradient" color="red" size="sm" style={styles.urgentBadge}>
                  긴급
                </Badge>
              </Animated.View>
            ) : null}
            <ThemedText style={[isListContext ? styles.companyNameCompact : styles.companyName, { color: theme.text }]} numberOfLines={1}>
              {displayName}
            </ThemedText>
          </View>
          <Badge
            variant="gradient"
            color={getStatusBadgeColor(statusLabel.bgColor)}
            size="sm"
          >
            {statusLabel.text}
          </Badge>
        </View>

        {/* === 핵심 정보: 1줄로 압축 (리스트) 또는 기존 2행 (상세) === */}
        {isListContext ? (
          <View style={styles.infoRowCompact}>
            <ThemedText style={[styles.infoChip, { color: theme.text }]}>
              <ThemedText style={[styles.infoChipLabel, { color: theme.tabIconDefault }]}>기간 </ThemedText>
              {formatDateRange(data.startAt, data.endAt)}
            </ThemedText>
            <ThemedText style={[styles.infoChipSep, { color: theme.backgroundSecondary }]}>|</ThemedText>
            <ThemedText style={[styles.infoChip, { color: theme.text }]}>
              <ThemedText style={[styles.infoChipLabel, { color: theme.tabIconDefault }]}>차종 </ThemedText>
              {data.vehicleType || "-"}
            </ThemedText>
            <ThemedText style={[styles.infoChipSep, { color: theme.backgroundSecondary }]}>|</ThemedText>
            <ThemedText style={[styles.infoChip, { color: BrandColors.primary }]} numberOfLines={1}>
              {formatUnitPrice()}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Icon name="calendar-outline" size={14} color={theme.tabIconDefault} />
                <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>입차기간</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                  {formatDateRange(data.startAt, data.endAt)}
                </ThemedText>
              </View>
              <View style={styles.infoItem}>
                <Icon name="car-outline" size={14} color={theme.tabIconDefault} />
                <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>차종</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                  {data.vehicleType || "-"}
                </ThemedText>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Icon name="cash-outline" size={14} color={theme.tabIconDefault} />
                <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>단가</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                  {formatUnitPrice()}
                </ThemedText>
              </View>
              <View style={styles.infoItem}>
                <Icon name="cube-outline" size={14} color={theme.tabIconDefault} />
                <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>물량</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>
                  {formatDeliverySummary()}
                </ThemedText>
              </View>
            </View>
            {data.applicantCount !== undefined && data.applicantCount > 0 ? (
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Icon name="people-outline" size={14} color={theme.tabIconDefault} />
                  <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>지원자</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                    {data.applicantCount}명 / 3명
                  </ThemedText>
                </View>
              </View>
            ) : null}
          </View>
        )}

        {/* === 주소 + 지원자 (리스트에서는 1줄로 합침) === */}
        {isListContext ? (
          <View style={styles.addressRowCompact}>
            <Icon name="location-outline" size={12} color={theme.tabIconDefault} />
            <ThemedText style={[styles.addressTextCompact, { color: theme.tabIconDefault }]} numberOfLines={1}>
              {data.campName ? `${data.campName} · ` : ""}{displayAddress}
            </ThemedText>
            {data.applicantCount !== undefined && data.applicantCount > 0 ? (
              <View style={styles.applicantChip}>
                <Icon name="people-outline" size={10} color={BrandColors.helper} />
                <ThemedText style={styles.applicantChipText}>{data.applicantCount}/3</ThemedText>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.addressRow, { borderTopColor: theme.backgroundSecondary }]}>
            <Icon name="location-outline" size={14} color={theme.tabIconDefault} />
            <View style={styles.addressContent}>
              {data.campName ? (
                <ThemedText style={[styles.campName, { color: theme.text }]} numberOfLines={1}>
                  {data.campName}
                </ThemedText>
              ) : null}
              <ThemedText style={[styles.addressText, { color: theme.tabIconDefault }]} numberOfLines={1}>
                {displayAddress}
              </ThemedText>
            </View>
          </View>
        )}

        {/* === 금액 행 (리스트 컨텍스트에서는 숨김) === */}
        {!isListContext && context !== 'requester_home' && context !== 'requester_history' && (data.finalAmount !== undefined || data.downPaidAmount !== undefined || data.balanceAmount !== undefined) ? (
          <View style={[styles.amountRow, { borderTopColor: theme.backgroundSecondary }]}>
            {data.finalAmount !== undefined && data.finalAmount > 0 ? (
              <View style={styles.amountItem}>
                <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>총액</ThemedText>
                <ThemedText style={[styles.amountValue, { color: theme.text }]}>{formatCurrency(data.finalAmount)}</ThemedText>
              </View>
            ) : null}
            {data.downPaidAmount !== undefined && data.downPaidAmount > 0 ? (
              <View style={styles.amountItem}>
                <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>계약금</ThemedText>
                <ThemedText style={[styles.amountValue, { color: theme.text }]}>{formatCurrency(data.downPaidAmount)}</ThemedText>
              </View>
            ) : null}
            {data.balanceAmount !== undefined && data.balanceAmount > 0 ? (
              <View style={styles.amountItem}>
                <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>잔금</ThemedText>
                <ThemedText style={[styles.amountValue, { color: theme.text }]}>{formatCurrency(data.balanceAmount)}</ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* === 담당자 행 (리스트 컨텍스트에서는 숨김) === */}
        {!isListContext && (data.assignedHelperName || data.requesterName) ? (
          <View style={styles.personRow}>
            <Icon name="person-outline" size={14} color={theme.tabIconDefault} />
            <ThemedText style={[styles.personText, { color: theme.tabIconDefault }]}>
              {data.viewerRole === "requester"
                ? `헬퍼: ${data.assignedHelperName || "미배정"}`
                : `요청자: ${data.requesterName || "-"}`
              }
            </ThemedText>
          </View>
        ) : null}

        {/* === 정산 섹션 (요청자 이력에서만) === */}
        {context === 'requester_history' ? (
          <View style={[styles.settlementSection, { borderTopColor: theme.backgroundSecondary }]}>
            <View style={styles.paymentGrid}>
              <View style={styles.paymentItem}>
                <ThemedText style={[styles.paymentLabel, { color: theme.tabIconDefault }]}>총액</ThemedText>
                <ThemedText style={[styles.paymentValue, { color: theme.text }]}>
                  {formatCurrency(data.finalAmount)}
                </ThemedText>
              </View>
              <View style={styles.paymentItem}>
                <ThemedText style={[styles.paymentLabel, { color: theme.tabIconDefault }]}>계약금</ThemedText>
                <ThemedText style={[styles.paymentValue, { color: theme.text }]}>
                  {formatCurrency(data.downPaidAmount)}
                </ThemedText>
                <Badge
                  variant="gradient"
                  color={data.depositPaid ? "green" : "gold"}
                  size="sm"
                >
                  {data.depositPaid ? '결제' : '미결제'}
                </Badge>
              </View>
              <View style={styles.paymentItem}>
                <ThemedText style={[styles.paymentLabel, { color: theme.tabIconDefault }]}>잔금</ThemedText>
                <ThemedText style={[styles.paymentValue, { color: theme.text }]}>
                  {formatCurrency(data.balanceAmount)}
                </ThemedText>
                <Badge
                  variant="gradient"
                  color={data.balancePaid ? "green" : "gold"}
                  size="sm"
                >
                  {data.balancePaid ? '결제' : '미결제'}
                </Badge>
              </View>
              {data.balancePaidAt ? (
                <View style={styles.paymentItem}>
                  <ThemedText style={[styles.paymentLabel, { color: theme.tabIconDefault }]}>잔금 입금일</ThemedText>
                  <ThemedText style={[styles.paymentValue, { color: BrandColors.success }]}>
                    {new Date(data.balancePaidAt).toLocaleDateString('ko-KR')}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <View style={styles.settlementRow}>
              <View style={styles.settlementInfo}>
                <ThemedText style={[styles.settlementLabel, { color: theme.tabIconDefault }]}>총 정산금</ThemedText>
                <ThemedText style={[styles.settlementAmount, { color: theme.text }]}>
                  {formatCurrency(data.finalAmount)}
                </ThemedText>
              </View>
              {data.paymentStatus?.balance === 'PAID' ? (
                <Badge variant="gradient" color="green" size="md">
                  정산완료
                </Badge>
              ) : (
                <Pressable
                  style={[styles.accountButton, { backgroundColor: BrandColors.requester }]}
                  onPress={async () => {
                    try {
                      const orderId = Number(data.orderId);
                      const response = await fetch(`${process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : ''}/api/orders/${orderId}/send-account-sms`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                      });
                      const result = await response.json();
                      if (result.ok) {
                        Alert.alert("전송 완료", `계좌번호가 문자로 전송되었습니다.\n\n${result.accountInfo}`);
                      } else {
                        const accountInfo = "신한은행 110-123-456789 (주)헬프미";
                        await Clipboard.setStringAsync(accountInfo);
                        Alert.alert("복사 완료", `문자 전송이 실패하여 클립보드에 복사되었습니다.\n\n${accountInfo}`);
                      }
                    } catch (error) {
                      const accountInfo = "신한은행 110-123-456789 (주)헬프미";
                      await Clipboard.setStringAsync(accountInfo);
                      Alert.alert("복사 완료", `계좌번호가 클립보드에 복사되었습니다.\n\n${accountInfo}`);
                    }
                  }}
                >
                  <Icon name="send-outline" size={12} color="#fff" />
                  <ThemedText style={styles.accountButtonText}>계좌번호전송</ThemedText>
                </Pressable>
              )}
            </View>
          </View>
        ) : null}

        {/* === 버튼 행 (리스트 컨텍스트에서는 숨김 - 카드 탭으로 상세 이동) === */}
        {!isListContext && buttons.length > 0 ? (
          <View style={styles.buttonRow}>
            {buttons.map((btn, index) => (
              <PremiumButton
                key={`${btn.action}-${index}`}
                variant={getButtonVariant(btn.variant)}
                size="sm"
                onPress={() => handleButtonPress(btn.action)}
                disabled={btn.disabled}
                style={styles.button}
              >
                {btn.label}
              </PremiumButton>
            ))}
          </View>
        ) : null}
    </Card>
  );
}

function getStatusBadgeColor(bgColor: string): "purple" | "pink" | "gold" | "green" | "red" | "blue" | "neutral" {
  // Map background colors to Badge gradient colors
  if (bgColor.includes('#10B981') || bgColor.includes('#22C55E')) return "green";
  if (bgColor.includes('#EF4444') || bgColor.includes('#DC2626')) return "red";
  if (bgColor.includes('#F59E0B') || bgColor.includes('#FCD34D')) return "gold";
  if (bgColor.includes('#8B5CF6') || bgColor.includes('#A78BFA')) return "purple";
  if (bgColor.includes('#6B7280')) return "neutral";
  return "blue"; // default
}

function getButtonVariant(actionVariant: ActionButton["variant"]): "legacy" | "primary" | "secondary" | "outline" | "ghost" | "premium" | "glass" {
  switch (actionVariant) {
    case "primary":
      return "primary";
    case "secondary":
      return "secondary";
    case "destructive":
      return "primary"; // Will use default primary styling
    case "outline":
      return "outline";
    default:
      return "primary";
  }
}

function getButtonsForContext(context: CardContext, data: OrderCardDTO): ActionButton[] {
  switch (context) {
    case "requester_home":
      return getRequesterButtons(
        data.orderStatus,
        data.closingReviewStatus,
        data.paymentStatus?.down,
        data.paymentStatus?.balance,
        data.hasReview
      );
    case "helper_recruitment":
      return getHelperRecruitmentButtons(data.hasApplied || false);
    case "helper_application":
      return getHelperApplicationButtons(data.applicationStatus);
    case "helper_my_orders":
      return getHelperMyOrderButtons(
        data.orderStatus,
        data.closingReviewStatus,
        data.settlementStatus
      );
    case "settlement_list":
      return getSettlementListButtons(data.settlementStatus);
    case "review_list":
      return getReviewListButtons(data.hasReview || false);
    case "requester_history":
      return getRequesterHistoryButtons(data.hasReview || false);
    case "helper_history":
      return [{ label: "상세보기", action: "view_detail", variant: "outline" }];
    default:
      return [];
  }
}

function getRequesterHistoryButtons(hasReview: boolean): ActionButton[] {
  const buttons: ActionButton[] = [];
  if (!hasReview) {
    buttons.push({ label: "리뷰 작성", action: "write_review", variant: "primary" });
  }
  buttons.push({ label: "사고신고", action: "incident_report", variant: "outline" });
  buttons.push({ label: "이의제기", action: "dispute", variant: "outline" });
  return buttons;
}

const styles = StyleSheet.create({
  // ========== 기존 (상세 컨텍스트용) ==========
  card: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  titleSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  companyName: {
    ...Typography.body,
    fontWeight: "700",
    flex: 1,
  },
  urgentBadge: {
    marginRight: Spacing.xs,
  },
  infoGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    gap: Spacing.xl,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    minWidth: 120,
  },
  infoLabel: {
    fontSize: 12,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: Spacing.xs,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  addressContent: {
    flex: 1,
  },
  campName: {
    ...Typography.small,
    fontWeight: "600",
    marginBottom: 2,
  },
  addressText: {
    ...Typography.small,
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  statValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
  },
  amountItem: {
    alignItems: "center",
  },
  amountLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  amountValue: {
    ...Typography.small,
    fontWeight: "600",
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  personText: {
    ...Typography.small,
  },
  settlementSection: {
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
  },
  paymentGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  paymentItem: {
    alignItems: "center",
    flex: 1,
  },
  paymentLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  settlementRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  settlementInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  settlementLabel: {
    fontSize: 14,
  },
  settlementAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  accountButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  accountButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  button: {
    flex: 1,
    minWidth: 100,
  },

  // ========== 컴팩트 (리스트 컨텍스트용) ==========
  cardCompact: {
    marginBottom: 6,
  },
  headerCompact: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  companyNameCompact: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  infoRowCompact: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 4,
  },
  infoChip: {
    fontSize: 12,
    fontWeight: "600",
  },
  infoChipLabel: {
    fontSize: 11,
    fontWeight: "400",
  },
  infoChipSep: {
    fontSize: 11,
    opacity: 0.4,
  },
  addressRowCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addressTextCompact: {
    fontSize: 11,
    flex: 1,
  },
  applicantChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(30,64,175,0.08)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  applicantChipText: {
    fontSize: 10,
    fontWeight: "600",
    color: BrandColors.helper,
  },
});

export default OrderCard;
