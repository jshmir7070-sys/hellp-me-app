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
  type ActionButton,
} from "@/domain/orderCardRules";
import { getApiUrl } from "@/lib/query-client";

export type CardContext =
  | "requester_home"
  | "helper_home"
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
      const u = quantityUnit;
      if (other > 0) {
        return `${delivered}${u} / ${returned}${u} / ${other}${u}`;
      }
      return `${delivered}${u} / ${returned}${u}`;
    }
    // 마감 전에는 예상 물량 표시
    if (data.averageQuantity) {
      return `평균 ${data.averageQuantity}${quantityUnit}`;
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

  const isCold = data.courierCategory === "cold";
  const isOther = data.courierCategory === "other";

  // 카테고리별 표시명: 냉탑전용/기타택배는 companyName, 택배사는 courierName
  const displayName = data.companyName || data.courierName || data.title || "오더";

  // 카테고리 라벨
  const categoryLabel = isCold ? "냉탑전용" : isOther ? "기타택배" : null;

  // 단가 라벨: 냉탑전용은 "운임", 기타택배는 박스당/착지당, 택배사는 "단가"
  const getPriceLabel = () => {
    if (isCold) return "운임";
    if (isOther && data.unitPriceType) {
      if (data.unitPriceType === "per_drop") return "착지당";
      if (data.unitPriceType === "per_box") return "박스당";
    }
    return "단가";
  };
  const priceLabel = getPriceLabel();

  // 물량 라벨/단위:
  // 냉탑전용→"착수"(경유지 수), 기타택배 per_box→"박스", per_drop→"착수"
  const getQuantityLabel = () => {
    if (isCold) return "착수";
    if (isOther && data.unitPriceType) {
      if (data.unitPriceType === "per_drop") return "착수";
      if (data.unitPriceType === "per_box") return "박스";
    }
    return "물량";
  };
  const quantityLabel = getQuantityLabel();
  const quantityUnit = isCold ? "착수" : isOther ? (data.unitPriceType === "per_drop" ? "착수" : "박스") : "건";

  // 주소: 대분류 중분류 소분류 표기
  const buildAddress = () => {
    if (data.deliveryArea) {
      // deliveryArea가 있으면 그대로 사용 (대분류 중분류 소분류 포함)
      return data.deliveryArea;
    }
    const parts: string[] = [];
    if (data.region1) parts.push(data.region1);
    if (data.region2) parts.push(data.region2);
    if (parts.length === 0 && data.addressShort) return data.addressShort;
    return parts.length > 0 ? parts.join(" ") : "위치 미정";
  };
  const displayAddress = buildAddress();

  return (
    <Card style={styles.card} onPress={handleCardPress}>
      <View style={styles.header}>
        <View style={styles.titleSection}>
          {data.isUrgent ? (
            <Animated.View style={[styles.urgentBadge, { opacity: flashAnim }]}>
              <Icon name="warning-outline" size={11} color="#fff" />
              <ThemedText style={styles.urgentText}>긴급</ThemedText>
            </Animated.View>
          ) : null}
          {categoryLabel ? (
            <View style={[styles.categoryBadge, isCold ? styles.categoryBadgeCold : styles.categoryBadgeOther]}>
              <ThemedText style={[styles.categoryBadgeText, isCold ? styles.categoryTextCold : styles.categoryTextOther]}>
                {categoryLabel}
              </ThemedText>
            </View>
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
          <Icon name="calendar-outline" size={11} color={theme.tabIconDefault} />
          <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>입차일</ThemedText>
          <ThemedText style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>
            {formatDateRange(data.startAt, data.endAt)}
          </ThemedText>
          <View style={styles.infoDivider} />
          <Icon name="car-outline" size={11} color={theme.tabIconDefault} />
          <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>차종</ThemedText>
          <ThemedText style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>
            {data.vehicleType || "-"}
          </ThemedText>
        </View>
        <View style={styles.infoRow}>
          <Icon name="cash-outline" size={11} color={theme.tabIconDefault} />
          <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>{priceLabel}</ThemedText>
          <ThemedText style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>
            {formatUnitPrice()}
          </ThemedText>
          <View style={styles.infoDivider} />
          <Icon name="cube-outline" size={11} color={theme.tabIconDefault} />
          <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>{quantityLabel}</ThemedText>
          <ThemedText style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>
            {formatDeliverySummary()}
          </ThemedText>
          {data.applicantCount !== undefined && data.applicantCount > 0 ? (
            <>
              <View style={styles.infoDivider} />
              <Icon name="people-outline" size={11} color={theme.tabIconDefault} />
              <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                {data.applicantCount}명
              </ThemedText>
            </>
          ) : null}
        </View>
      </View>

      <View style={[styles.addressRow, { borderTopColor: theme.backgroundSecondary }]}>
        <Icon name="location-outline" size={11} color={theme.tabIconDefault} />
        <ThemedText style={[styles.addressText, { color: theme.tabIconDefault }]} numberOfLines={1}>
          {data.campName ? `${data.campName} · ${displayAddress}` : displayAddress}
        </ThemedText>
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

      {data.viewerRole === "requester" && data.assignedHelperName ? (
        <View style={styles.personRow}>
          <Icon name="person-outline" size={12} color={theme.tabIconDefault} />
          <ThemedText style={[styles.personText, { color: theme.tabIconDefault }]}>
            헬퍼: {data.assignedHelperName}
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
                    const baseUrl = getApiUrl();
                    const response = await fetch(new URL(`/api/orders/${orderId}/send-account-sms`, baseUrl).href, {
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

function getButtonsForContext(_context: CardContext, _data: OrderCardDTO): ActionButton[] {
  // 모든 컨텍스트에서 버튼 제거 — 카드 탭으로 해당 페이지 이동
  return [];
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
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    marginBottom: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  titleSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  companyName: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
    marginLeft: Spacing.xs,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  urgentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: BrandColors.error,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  urgentText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  categoryBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  categoryBadgeCold: {
    backgroundColor: "#DBEAFE",
  },
  categoryBadgeOther: {
    backgroundColor: "#FEF3C7",
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  categoryTextCold: {
    color: "#1D4ED8",
  },
  categoryTextOther: {
    color: "#D97706",
  },
  infoGrid: {
    gap: 0,
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    minHeight: 16,
  },
  infoDivider: {
    width: 1,
    height: 8,
    backgroundColor: "rgba(128,128,128,0.3)",
    marginHorizontal: 3,
  },
  infoLabel: {
    fontSize: 10,
  },
  infoValue: {
    fontSize: 11,
    fontWeight: "600",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingTop: 2,
    borderTopWidth: 1,
  },
  addressText: {
    fontSize: 10,
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
    paddingTop: Spacing.xs,
    marginTop: 4,
    borderTopWidth: 1,
  },
  amountItem: {
    alignItems: "center",
  },
  amountLabel: {
    fontSize: 11,
    marginBottom: 1,
  },
  amountValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: 2,
  },
  personText: {
    fontSize: 11,
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
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  button: {
    flex: 1,
    minWidth: 80,
    height: 34,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "600",
  },
});

export default OrderCard;
