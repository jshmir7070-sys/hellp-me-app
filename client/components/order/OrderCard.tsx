import React, { useEffect, useRef } from "react";
import { View, Pressable, StyleSheet, Animated, Alert } from "react-native";
import { Icon } from "@/components/Icon";
import * as Clipboard from "expo-clipboard";

import { Card } from "@/components/Card";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
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
    // 날짜 순서 보정: 시작일이 종료일보다 뒤면 교환
    let s = start;
    let e = end;
    if (s && e && new Date(s) > new Date(e)) {
      [s, e] = [e, s];
    }
    const startDate = formatDate(s);
    const endDate = formatDate(e);
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
  // 배송지 표기: "서울특별시 > 강남구" → "서울특별시 \ 강남구 \ 역삼동" 형식
  const formatAddress = () => {
    const raw = data.deliveryArea || data.addressShort ||
      (data.region1 ? `${data.region1} ${data.region2 || ""}`.trim() : "");
    if (!raw) return "위치 미정";
    // ">" 구분자를 "\" 구분자로 변경
    return raw.replace(/\s*>\s*/g, " \\ ");
  };
  const displayAddress = formatAddress();

  return (
    <Card style={styles.card} onPress={handleCardPress}>
        <View style={styles.header}>
          <View style={styles.titleSection}>
            {data.isUrgent ? (
              <Animated.View style={[styles.urgentBadge, { opacity: flashAnim }]}>
                <Icon name="warning-outline" size={14} color="#fff" />
                <ThemedText style={styles.urgentText}>긴급</ThemedText>
              </Animated.View>
            ) : null}
            <ThemedText style={[styles.companyName, { color: theme.text }]} numberOfLines={1}>
              {displayName}
            </ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusLabel.bgColor }]}>
            <ThemedText style={[styles.statusText, { color: statusLabel.color }]}>
              {statusLabel.text}
            </ThemedText>
          </View>
        </View>

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

        {context !== 'requester_home' && context !== 'requester_history' && (data.finalAmount !== undefined || data.downPaidAmount !== undefined || data.balanceAmount !== undefined) ? (
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

        {data.assignedHelperName || data.requesterName ? (
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
                <View style={[
                  styles.paymentBadge,
                  { backgroundColor: data.depositPaid ? BrandColors.successLight : '#FEF3C7' }
                ]}>
                  <ThemedText style={[
                    styles.paymentBadgeText,
                    { color: data.depositPaid ? BrandColors.success : '#D97706' }
                  ]}>
                    {data.depositPaid ? '결제' : '미결제'}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.paymentItem}>
                <ThemedText style={[styles.paymentLabel, { color: theme.tabIconDefault }]}>잔금</ThemedText>
                <ThemedText style={[styles.paymentValue, { color: theme.text }]}>
                  {formatCurrency(data.balanceAmount)}
                </ThemedText>
                <View style={[
                  styles.paymentBadge,
                  { backgroundColor: data.balancePaid ? BrandColors.successLight : '#FEF3C7' }
                ]}>
                  <ThemedText style={[
                    styles.paymentBadgeText,
                    { color: data.balancePaid ? BrandColors.success : '#D97706' }
                  ]}>
                    {data.balancePaid ? '결제' : '미결제'}
                  </ThemedText>
                </View>
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
                <View style={[styles.settlementBadge, { backgroundColor: BrandColors.successLight }]}>
                  <ThemedText style={[styles.settlementBadgeText, { color: BrandColors.success }]}>
                    정산완료
                  </ThemedText>
                </View>
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
                        // 문자 전송 실패 시 클립보드 복사로 대체
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

        {buttons.length > 0 ? (
          <View style={styles.buttonRow}>
            {buttons.map((btn, index) => (
              <Pressable
                key={`${btn.action}-${index}`}
                style={[
                  styles.button,
                  getButtonStyle(btn.variant, theme),
                  btn.disabled && styles.buttonDisabled,
                ]}
                onPress={() => handleButtonPress(btn.action)}
                disabled={btn.disabled}
              >
                <ThemedText style={[styles.buttonText, getButtonTextStyle(btn.variant, theme)]}>
                  {btn.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}
    </Card>
  );
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
      return [
        { label: "이의제기", action: "dispute", variant: "primary" },
        { label: "상세보기", action: "view_detail", variant: "outline" },
      ];
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

function getButtonStyle(variant: ActionButton["variant"], theme: any): any {
  switch (variant) {
    case "primary":
      return { backgroundColor: theme.text === "#F9FAFB" ? "#3B82F6" : "#1E40AF" };
    case "secondary":
      return { backgroundColor: theme.backgroundSecondary };
    case "destructive":
      return { backgroundColor: "#DC2626" };
    case "outline":
      return { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.backgroundTertiary };
    default:
      return {};
  }
}

function getButtonTextStyle(variant: ActionButton["variant"], theme: any): any {
  switch (variant) {
    case "primary":
    case "destructive":
      return { color: "#FFFFFF" };
    case "secondary":
    case "outline":
      return { color: theme.text };
    default:
      return { color: theme.text };
  }
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
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
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginLeft: Spacing.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  urgentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: BrandColors.error,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  urgentText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  infoGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flex: 1,
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
  paymentValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  paymentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  paymentBadgeText: {
    fontSize: 10,
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
  settlementBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  settlementBadgeText: {
    fontSize: 12,
    fontWeight: "600",
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
    height: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});

export default OrderCard;
