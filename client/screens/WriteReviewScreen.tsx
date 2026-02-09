import React, { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, Alert, Platform, ActivityIndicator, TextInput, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

type ProfileStackParamList = {
  WriteReview: { orderId: number };
};

type WriteReviewScreenProps = NativeStackScreenProps<ProfileStackParamList, 'WriteReview'>;

const STAR_COUNT = 5;

export default function WriteReviewScreen({ navigation, route }: WriteReviewScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const orderId = route.params?.orderId;

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const { data: order, isLoading: isLoadingOrder } = useQuery<any>({
    queryKey: [`/api/requester/orders/${orderId}`],
    enabled: !!orderId,
  });

  const { data: contractsData } = useQuery<any[]>({
    queryKey: ['/api/contracts'],
    enabled: !!orderId,
  });

  const contract = React.useMemo(() => {
    if (!contractsData || !orderId) return null;
    return contractsData.find((c: any) => c.orderId === orderId || c.orderId === Number(orderId));
  }, [contractsData, orderId]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const helperId = order?.selectedHelperId || order?.matchedHelperId || contract?.helperId;
      const contractId = order?.contractId || contract?.id || null;
      
      if (!order || !helperId) {
        throw new Error("헬퍼 정보를 찾을 수 없습니다");
      }
      
      return apiRequest("POST", "/api/requester/reviews", {
        orderId: Number(orderId),
        helperId: helperId,
        contractId: contractId,
        rating,
        comment: comment.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requester/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/requester/orders"] });
      if (Platform.OS === "web") {
        alert("리뷰가 등록되었습니다.");
      } else {
        Alert.alert("완료", "리뷰가 등록되었습니다.");
      }
      navigation.goBack();
    },
    onError: (err: Error) => {
      const message = err.message || "리뷰 등록에 실패했습니다.";
      if (Platform.OS === "web") {
        alert(message);
      } else {
        Alert.alert("오류", message);
      }
    },
  });

  const handleSubmit = () => {
    if (rating === 0) {
      Alert.alert("알림", "별점을 선택해주세요.");
      return;
    }
    submitMutation.mutate();
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[...Array(STAR_COUNT)].map((_, index) => (
          <Pressable
            key={index}
            onPress={() => setRating(index + 1)}
            style={styles.starButton}
          >
            <Icon
              name={index < rating ? "star-outline" : "star-outline"}
              size={40}
              color={index < rating ? "BrandColors.warning" : theme.backgroundTertiary}
            />
          </Pressable>
        ))}
      </View>
    );
  };

  if (isLoadingOrder) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.requester} />
      </View>
    );
  }

  const helperName = order?.helperName || order?.assignedHelperName || "-";
  const helperProfileImageUrl = order?.helperProfileImageUrl || null;
  const vehicleType = order?.vehicleType || "-";
  const deliveryArea = order?.deliveryArea || order?.companyName || "-";
  const workDate = order?.workDate || order?.expectedDate || "-";
  const orderNumber = order?.orderNumber || `O-${orderId}`;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 120 }}
    >
      <View style={styles.content}>
        <Card variant="glass" padding="md" style={styles.orderCard}>
          <View style={styles.orderHeader}>
            <View style={styles.orderNumberBadge}>
              <ThemedText style={styles.orderNumberText}>{orderNumber}</ThemedText>
            </View>
            <ThemedText style={[styles.orderStatus, { color: BrandColors.requester }]}>
              {order?.status === 'closing_submitted' ? '마감제출' : ['closed', 'settlement_paid', 'balance_paid', 'final_amount_confirmed'].includes(order?.status) ? '완료' : '진행중'}
            </ThemedText>
          </View>
          
          <ThemedText style={[styles.orderTitle, { color: theme.text }]}>{deliveryArea}</ThemedText>
          
          <View style={styles.orderDetails}>
            <View style={styles.orderDetailRow}>
              <Icon name="calendar-outline" size={14} color={theme.tabIconDefault} />
              <ThemedText style={[styles.orderDetailText, { color: theme.tabIconDefault }]}>
                근무일: <ThemedText style={{ color: theme.text }}>{workDate}</ThemedText>
              </ThemedText>
            </View>
            <View style={styles.orderDetailRow}>
              <Icon name="car-outline" size={14} color={theme.tabIconDefault} />
              <ThemedText style={[styles.orderDetailText, { color: theme.tabIconDefault }]}>
                차량: <ThemedText style={{ color: theme.text }}>{vehicleType}</ThemedText>
              </ThemedText>
            </View>
          </View>
        </Card>

        <Card variant="glass" padding="md" style={styles.helperCard}>
          <View style={styles.helperHeader}>
            {helperProfileImageUrl ? (
              <Image 
                source={{ uri: helperProfileImageUrl.startsWith('http') ? helperProfileImageUrl : `${getApiUrl()}${helperProfileImageUrl}` }}
                style={styles.helperProfileImage}
              />
            ) : (
              <View style={[styles.helperAvatar, { backgroundColor: BrandColors.helperLight }]}>
                <Icon name="person-outline" size={28} color={BrandColors.helper} />
              </View>
            )}
            <View style={styles.helperInfo}>
              <ThemedText style={[styles.helperName, { color: theme.text }]}>{helperName}</ThemedText>
              <ThemedText style={[styles.helperDetail, { color: theme.tabIconDefault }]}>
                리뷰 대상 헬퍼
              </ThemedText>
            </View>
          </View>
        </Card>

        <Card variant="glass" padding="lg" style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>별점</ThemedText>
          <ThemedText style={[styles.ratingHint, { color: theme.tabIconDefault }]}>
            헬퍼의 서비스는 어떠셨나요?
          </ThemedText>
          {renderStars()}
          <ThemedText style={[styles.ratingText, { color: BrandColors.requester }]}>
            {rating > 0 ? `${rating}점` : "별점을 선택해주세요"}
          </ThemedText>
        </Card>

        <Card variant="glass" padding="lg" style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>리뷰 작성 (선택)</ThemedText>
          <TextInput
            style={[
              styles.textArea,
              { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.backgroundTertiary },
            ]}
            placeholder="헬퍼의 서비스에 대한 리뷰를 작성해주세요"
            placeholderTextColor={theme.tabIconDefault}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            value={comment}
            onChangeText={setComment}
          />
        </Card>

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            { backgroundColor: BrandColors.requester },
            (submitMutation.isPending || rating === 0) && { opacity: 0.6 },
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleSubmit}
          disabled={submitMutation.isPending || rating === 0}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.submitText}>리뷰 등록</ThemedText>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  orderCard: {
    padding: Spacing.lg,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  orderNumberBadge: {
    backgroundColor: BrandColors.requesterLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  orderNumberText: {
    fontSize: 12,
    fontWeight: "600",
    color: BrandColors.requester,
  },
  orderStatus: {
    fontSize: 12,
    fontWeight: "600",
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  orderDetails: {
    gap: Spacing.xs,
  },
  orderDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  orderDetailText: {
    fontSize: 13,
  },
  helperCard: {
    padding: Spacing.lg,
  },
  helperHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  helperAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  helperProfileImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  helperInfo: {
    flex: 1,
  },
  helperName: {
    fontSize: 18,
    fontWeight: "700",
  },
  helperDetail: {
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  ratingHint: {
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginVertical: Spacing.md,
  },
  starButton: {
    position: "relative",
  },
  starFill: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  ratingText: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 120,
    fontSize: 15,
  },
  submitButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
    minHeight: 52,
    zIndex: 10,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
