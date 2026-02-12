import React, { useState, useCallback } from "react";
import {
  View,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
  ScrollView,
  ImageBackground,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "@/components/Icon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { Spacing, BorderRadius, Typography, BrandColors, PremiumGradients, Colors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface Review {
  id: number;
  rating: number;
  comment?: string;
  createdAt: string;
  requesterName?: string;
}

interface Applicant {
  id: number;
  helperId: string;
  helperName: string;
  helperNickname?: string | null;
  helperPhone?: string;
  category?: string;
  reviewCount: number;
  averageRating: number | null;
  status: string;
  appliedAt?: string;
  message?: string;
  expectedArrival?: string;
  recentReviews?: Review[];
}

function getDisplayName(applicant: Applicant): string {
  return applicant.helperNickname || applicant.helperName || "헬퍼";
}

type Props = NativeStackScreenProps<any, "ApplicantList">;

export default function ApplicantListScreen({ route, navigation }: Props) {
  const { orderId } = route.params as { orderId: number };
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const {
    data: applicants = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<Applicant[]>({
    queryKey: [`/api/orders/${orderId}/applications`],
  });

  const { data: order } = useQuery<any>({
    queryKey: [`/api/orders/${orderId}`],
  });

  const selectHelperMutation = useMutation({
    mutationFn: async (helperId: string) => {
      return apiRequest("POST", `/api/orders/${orderId}/select-helper`, {
        helperId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}/applications`] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/requester/orders"] });
      setConfirmModalVisible(false);
      setDetailModalVisible(false);
      Alert.alert("배정 완료", `${selectedApplicant ? getDisplayName(selectedApplicant) : '헬퍼'}님이 배정되었습니다.`, [
        { text: "확인", onPress: () => navigation.goBack() },
      ]);
    },
    onError: (error: any) => {
      Alert.alert("오류", error.message || "헬퍼 선택에 실패했습니다.");
    },
  });

  const handleSelectPress = useCallback((applicant: Applicant) => {
    setSelectedApplicant(applicant);
    setConfirmModalVisible(true);
  }, []);

  const handleDetailPress = useCallback((applicant: Applicant) => {
    setSelectedApplicant(applicant);
    setDetailModalVisible(true);
  }, []);

  const handleConfirmSelect = useCallback(() => {
    if (selectedApplicant) {
      selectHelperMutation.mutate(selectedApplicant.helperId);
    }
  }, [selectedApplicant, selectHelperMutation]);

  const renderStars = (rating: number | null, size: number = 14) => {
    const displayRating = rating || 0;
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Icon
          key={i}
          name={i <= displayRating ? "star" : "star-outline"}
          size={size}
          color={i <= displayRating ? BrandColors.warning : BrandColors.neutral}
          style={{ marginRight: 1 }}
        />
      );
    }
    return stars;
  };

  const renderApplicantRow = ({ item }: { item: Applicant }) => {
    const isApplied = item.status === "applied";
    const isSelected = item.status === "selected";
    const isRejected = item.status === "rejected";

    return (
      <Card variant="glass" padding="md" style={styles.applicantRow}>
        <View style={styles.rowContent}>
          <Pressable style={styles.rowLeft} onPress={() => handleDetailPress(item)}>
            <Avatar
              uri={(() => {
                const img = (item as any).profileImage || (item as any).helperProfileImage;
                if (!img) return undefined;
                return img.startsWith('http') ? img : `${getApiUrl()}${img}`;
              })()}
              size={48}
              border="gradient"
              badge={item.averageRating && item.averageRating >= 4.5 ? { text: "PRO", color: "gold" } : undefined}
            />
            <View style={styles.rowInfo}>
              <View style={styles.nameRow}>
                <ThemedText style={styles.helperName}>{getDisplayName(item)}</ThemedText>
                <Badge
                  variant="gradient"
                  color={isSelected ? "green" : isRejected ? "neutral" : "blue"}
                  size="sm"
                >
                  {isSelected ? "✓ 선택됨" : isRejected ? "미선택" : "지원중"}
                </Badge>
              </View>
              
              <View style={styles.ratingRow}>
                <View style={styles.starsContainer}>{renderStars(item.averageRating)}</View>
                <ThemedText style={styles.ratingText}>
                  {item.averageRating ? item.averageRating.toFixed(1) : "-"} ({item.reviewCount}건)
                </ThemedText>
              </View>

              {item.category ? (
                <ThemedText style={styles.categoryText}>{item.category}</ThemedText>
              ) : null}
            </View>
          </Pressable>

          <View style={styles.rowRight}>
            {isApplied ? (
              <Button
                variant="premium"
                size="sm"
                onPress={() => handleSelectPress(item)}
                style={styles.selectButton}
              >
                선택
              </Button>
            ) : isSelected ? (
              <Badge variant="gradient" color="green" size="md">
                <Icon name="checkmark-circle" size={16} color={Colors.light.buttonText} />
              </Badge>
            ) : null}
          </View>
        </View>
      </Card>
    );
  };

  const ListEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Icon name="people-outline" size={48} color={BrandColors.neutral} />
      <ThemedText style={styles.emptyText}>아직 지원자가 없습니다</ThemedText>
      <ThemedText style={styles.emptySubtext}>
        헬퍼들의 지원을 기다려주세요
      </ThemedText>
    </View>
  );

  const renderDetailModal = () => {
    if (!selectedApplicant) return null;
    
    const isApplied = selectedApplicant.status === "applied";
    const reviews = selectedApplicant.recentReviews || [];
    const profileImageUri = (() => {
      const img = (selectedApplicant as any).profileImage || (selectedApplicant as any).helperProfileImage;
      if (!img) return undefined;
      return img.startsWith('http') ? img : `${getApiUrl()}${img}`;
    })();

    const COVER_HEIGHT = 140;
    const AVATAR_SIZE = 100;
    const AVATAR_OFFSET = COVER_HEIGHT - AVATAR_SIZE / 2;

    return (
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.detailModalContent, { backgroundColor: theme.backgroundRoot }]}>
            <Pressable 
              style={styles.closeButton}
              onPress={() => setDetailModalVisible(false)}
            >
              <View style={styles.closeButtonBg}>
                <Icon name="close" size={20} color={Colors.light.buttonText} />
              </View>
            </Pressable>

            <ScrollView 
              style={styles.detailScrollView}
              contentContainerStyle={{ paddingBottom: Spacing.xl }}
              showsVerticalScrollIndicator={false}
            >
              <LinearGradient
                colors={[BrandColors.helper, BrandColors.primaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.coverPhoto, { height: COVER_HEIGHT }]}
              >
                <View style={styles.coverPattern}>
                  <Icon name="car-outline" size={60} color="rgba(255,255,255,0.1)" />
                  <Icon name="cube-outline" size={40} color="rgba(255,255,255,0.08)" style={{ marginLeft: 20 }} />
                </View>
              </LinearGradient>

              <View style={[styles.profileSection, { marginTop: -AVATAR_SIZE / 2 }]}>
                <View style={styles.avatarWrapper}>
                  <Avatar
                    uri={profileImageUri}
                    size={AVATAR_SIZE}
                    border="gradient"
                    badge={selectedApplicant.averageRating && selectedApplicant.averageRating >= 4.5 ? { text: "PRO", color: "gold" } : undefined}
                    online={true}
                  />
                </View>

                <ThemedText style={styles.profileName}>
                  {selectedApplicant.helperNickname || selectedApplicant.helperName}
                </ThemedText>
                
                {selectedApplicant.category ? (
                  <ThemedText style={styles.profileCategory}>{selectedApplicant.category}</ThemedText>
                ) : null}
                
                <View style={styles.profileRatingRow}>
                  <View style={styles.starsContainer}>{renderStars(selectedApplicant.averageRating, 20)}</View>
                  <ThemedText style={styles.profileRatingText}>
                    {selectedApplicant.averageRating ? selectedApplicant.averageRating.toFixed(1) : "-"}
                  </ThemedText>
                  <ThemedText style={styles.profileReviewCount}>
                    ({selectedApplicant.reviewCount}건)
                  </ThemedText>
                </View>
              </View>

              {selectedApplicant.message ? (
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeader}>
                    <Icon name="chatbubble-outline" size={18} color={BrandColors.helper} />
                    <ThemedText style={styles.sectionTitle}>지원 메시지</ThemedText>
                  </View>
                  <Card variant="outline" padding="sm" style={styles.messageCard}>
                    <ThemedText style={styles.messageText}>{selectedApplicant.message}</ThemedText>
                  </Card>
                </View>
              ) : null}

              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Icon name="star-outline" size={18} color={BrandColors.warning} />
                  <ThemedText style={styles.sectionTitle}>최근 리뷰</ThemedText>
                </View>
                {reviews.length > 0 ? (
                  reviews.slice(0, 5).map((review, idx) => (
                    <Card key={review.id || idx} variant="glass" padding="sm" style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <View style={styles.starsContainer}>{renderStars(review.rating, 14)}</View>
                        <ThemedText style={styles.reviewDate}>
                          {review.createdAt ? new Date(review.createdAt).toLocaleDateString('ko-KR') : ''}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.reviewText}>
                        {review.comment || "리뷰 내용이 없습니다."}
                      </ThemedText>
                      {review.requesterName ? (
                        <ThemedText style={styles.reviewerName}>- {review.requesterName}</ThemedText>
                      ) : null}
                    </Card>
                  ))
                ) : (
                  <Card variant="glass" padding="md" style={styles.emptyReviewCard}>
                    <Icon name="chatbubbles-outline" size={32} color={BrandColors.neutralLight} />
                    <ThemedText style={styles.emptyReviewText}>아직 리뷰가 없습니다</ThemedText>
                  </Card>
                )}
              </View>
            </ScrollView>

            {isApplied ? (
              <View style={styles.detailModalFooter}>
                <Button
                  variant="premium"
                  size="lg"
                  fullWidth
                  onPress={() => {
                    setDetailModalVisible(false);
                    setTimeout(() => handleSelectPress(selectedApplicant), 300);
                  }}
                  style={styles.selectButtonLarge}
                >
                  이 헬퍼 선택하기
                </Button>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    );
  };

  const appliedCount = applicants.filter((a) => a.status === "applied").length;
  const hasSelected = applicants.some((a) => a.status === "selected");

  return (
    <ThemedView style={[styles.container, { paddingTop: headerHeight }]}>
      <View style={styles.headerInfo}>
        <ThemedText style={styles.applicantCount}>
          지원자 {appliedCount}/3명
        </ThemedText>
        {hasSelected ? (
          <Badge variant="gradient" color="green" size="md">
            ✓ 배정완료
          </Badge>
        ) : null}
      </View>

      <FlatList
        data={applicants}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderApplicantRow}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={isLoading ? null : ListEmptyComponent}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl }
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.requester} />
        </View>
      ) : null}

      {renderDetailModal()}

      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
            <ThemedText style={styles.modalTitle}>헬퍼 선택 확인</ThemedText>
            <ThemedText style={styles.modalMessage}>
              {selectedApplicant ? getDisplayName(selectedApplicant) : ''}님을 이 오더에 배정하시겠습니까?{"\n"}
              다른 지원자들은 자동으로 미선택 처리됩니다.
            </ThemedText>
            <View style={styles.modalButtons}>
              <Button
                variant="outline"
                size="md"
                onPress={() => setConfirmModalVisible(false)}
                style={styles.modalButton}
              >
                취소
              </Button>
              <Button
                variant="premium"
                size="md"
                onPress={handleConfirmSelect}
                style={styles.modalButton}
                disabled={selectHelperMutation.isPending}
                loading={selectHelperMutation.isPending}
              >
                {selectHelperMutation.isPending ? "처리중..." : "배정하기"}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutralLight,
  },
  applicantCount: {
    ...Typography.h4,
    color: BrandColors.requester,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  applicantRow: {
    padding: Spacing.md,
  },
  rowContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  rowInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  helperName: {
    ...Typography.h4,
    fontSize: 16,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  starsContainer: {
    flexDirection: "row",
  },
  ratingText: {
    fontSize: 12,
    color: BrandColors.neutral,
  },
  categoryText: {
    ...Typography.small,
    color: BrandColors.neutral,
    fontSize: 12,
  },
  rowRight: {
    marginLeft: Spacing.md,
  },
  selectButton: {
    paddingHorizontal: Spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing["5xl"],
  },
  emptyText: {
    ...Typography.h4,
    marginTop: Spacing.lg,
  },
  emptySubtext: {
    ...Typography.small,
    color: BrandColors.neutral,
    marginTop: Spacing.xs,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    margin: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  modalTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  modalMessage: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.xl,
    color: BrandColors.neutral,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
  },
  detailModalContent: {
    height: "90%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  closeButton: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
  },
  closeButtonBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  detailScrollView: {
    flex: 1,
  },
  coverPhoto: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  coverPattern: {
    flexDirection: "row",
    alignItems: "center",
    opacity: 0.8,
  },
  profileSection: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutralLight,
  },
  avatarWrapper: {
    borderWidth: 4,
    borderColor: Colors.light.buttonText,
    borderRadius: 54,
    elevation: 4,
  },
  profileName: {
    ...Typography.h2,
    marginTop: Spacing.md,
    textAlign: "center",
  },
  profileCategory: {
    ...Typography.body,
    color: BrandColors.neutral,
    marginTop: Spacing.xs,
  },
  profileRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    backgroundColor: BrandColors.warningLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  profileRatingText: {
    ...Typography.h4,
    color: BrandColors.warning,
  },
  profileReviewCount: {
    ...Typography.body,
    color: BrandColors.neutral,
  },
  sectionContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
  },
  messageCard: {
    padding: Spacing.lg,
  },
  messageText: {
    ...Typography.body,
    lineHeight: 24,
  },
  reviewCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  reviewDate: {
    ...Typography.small,
    color: BrandColors.neutral,
  },
  reviewText: {
    ...Typography.body,
    lineHeight: 22,
  },
  reviewerName: {
    ...Typography.small,
    color: BrandColors.neutral,
    marginTop: Spacing.sm,
    textAlign: "right",
  },
  emptyReviewCard: {
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyReviewText: {
    ...Typography.body,
    color: BrandColors.neutral,
  },
  detailModalFooter: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutralLight,
  },
  selectButtonLarge: {
    height: 52,
  },
});
