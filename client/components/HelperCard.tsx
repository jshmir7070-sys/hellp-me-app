import React from 'react';
import { View, Pressable, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { Avatar } from '@/components/Avatar';
import { Spacing, BorderRadius, Typography, BrandColors } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';

interface HelperCardProps {
  helper: {
    id: number;
    helperId: string;
    helperName: string;
    helperNickname?: string | null;
    helperPhone?: string;
    category?: string;
    reviewCount: number;
    averageRating: number | null;
    status: string;
    profileImageUrl?: string | null;
    appliedAt?: string;
    message?: string;
    expectedArrival?: string;
    completedJobs?: number;
    responseTime?: string;
    isVerified?: boolean;
    vehicleType?: string;
    location?: string;
  };
  onPress: () => void;
  onQuickAction?: (action: 'call' | 'message' | 'select') => void;
  compact?: boolean;
}

export function HelperCard({ helper, onPress, onQuickAction, compact = false }: HelperCardProps) {
  const displayName = helper.helperNickname || helper.helperName || '헬퍼';
  const rating = helper.averageRating || 0;
  const reviewCount = helper.reviewCount || 0;
  const completedJobs = helper.completedJobs || 0;

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Icon
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={14}
            color={star <= rating ? BrandColors.warning : '#D1D5DB'}
          />
        ))}
      </View>
    );
  };

  if (compact) {
    // 기존 미니 카드 스타일
    return (
      <Pressable
        style={({ pressed }) => [
          styles.compactCard,
          { opacity: pressed ? 0.7 : 1 },
        ]}
        onPress={onPress}
      >
        <LinearGradient
          colors={[BrandColors.helper, '#1976D2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.compactCover}
        />
        <View style={styles.compactProfileArea}>
          <View style={styles.compactAvatarCircle}>
            {helper.profileImageUrl ? (
              helper.profileImageUrl.startsWith('avatar:') ? (
                <Avatar uri={helper.profileImageUrl} size={36} isHelper={true} />
              ) : (
                <Image
                  source={{ uri: `${getApiUrl()}${helper.profileImageUrl}` }}
                  style={styles.compactAvatarImage}
                />
              )
            ) : (
              <Icon name="person" size={20} color={BrandColors.helper} />
            )}
          </View>
          <ThemedText style={styles.compactName} numberOfLines={1}>
            {displayName}
          </ThemedText>
          <View style={styles.compactRatingRow}>
            <Icon name="star" size={12} color={BrandColors.warning} />
            <ThemedText style={styles.compactRatingText}>
              {rating.toFixed(1)}
            </ThemedText>
          </View>
        </View>
      </Pressable>
    );
  }

  // 새로운 확장 카드 스타일
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { opacity: pressed ? 0.95 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={styles.cardContent}>
        {/* 왼쪽: 아바타 영역 */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            {helper.profileImageUrl ? (
              helper.profileImageUrl.startsWith('avatar:') ? (
                <Avatar uri={helper.profileImageUrl} size={56} isHelper={true} />
              ) : (
                <Image
                  source={{ uri: `${getApiUrl()}${helper.profileImageUrl}` }}
                  style={styles.avatarImage}
                />
              )
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Icon name="person" size={28} color={BrandColors.helper} />
              </View>
            )}
            {helper.isVerified && (
              <View style={styles.verifiedBadge}>
                <Icon name="checkmark-circle" size={18} color="#10B981" />
              </View>
            )}
          </View>
        </View>

        {/* 오른쪽: 정보 영역 */}
        <View style={styles.infoSection}>
          {/* 이름 및 평점 */}
          <View style={styles.headerRow}>
            <View style={styles.nameContainer}>
              <ThemedText style={styles.helperName} numberOfLines={1}>
                {displayName}
              </ThemedText>
              {helper.category && (
                <View style={styles.categoryBadge}>
                  <ThemedText style={styles.categoryText}>
                    {helper.category}
                  </ThemedText>
                </View>
              )}
            </View>
            <View style={styles.ratingContainer}>
              <Icon name="star" size={16} color={BrandColors.warning} />
              <ThemedText style={styles.ratingValue}>
                {rating.toFixed(1)}
              </ThemedText>
            </View>
          </View>

          {/* 통계 */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Icon name="checkmark-circle-outline" size={14} color="#6B7280" />
              <ThemedText style={styles.statText}>
                {completedJobs}건 완료
              </ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Icon name="chatbubble-outline" size={14} color="#6B7280" />
              <ThemedText style={styles.statText}>
                리뷰 {reviewCount}
              </ThemedText>
            </View>
          </View>

          {/* 메시지 미리보기 */}
          {helper.message && (
            <View style={styles.messagePreview}>
              <Icon name="mail-outline" size={14} color="#6B7280" />
              <ThemedText style={styles.messageText} numberOfLines={1}>
                {helper.message}
              </ThemedText>
            </View>
          )}

          {/* 추가 정보 */}
          <View style={styles.detailsRow}>
            {helper.location && (
              <View style={styles.detailItem}>
                <Icon name="location-outline" size={12} color="#9CA3AF" />
                <ThemedText style={styles.detailText}>
                  {helper.location}
                </ThemedText>
              </View>
            )}
            {helper.vehicleType && (
              <View style={styles.detailItem}>
                <Icon name="car-outline" size={12} color="#9CA3AF" />
                <ThemedText style={styles.detailText}>
                  {helper.vehicleType}
                </ThemedText>
              </View>
            )}
          </View>

          {/* 선택 버튼 */}
          {onQuickAction && (
            <Pressable
              style={({ pressed }) => [
                styles.selectButton,
                { opacity: pressed ? 0.9 : 1 },
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onQuickAction('select');
              }}
            >
              <Icon name="checkmark-circle-outline" size={18} color="#FFFFFF" />
              <ThemedText style={styles.selectButtonText}>
                선택하기
              </ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 확장 카드 스타일
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    padding: Spacing.lg,
  },
  avatarSection: {
    marginRight: Spacing.md,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BrandColors.helperLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSection: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  nameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  helperName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  categoryBadge: {
    backgroundColor: BrandColors.helperLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: BrandColors.helper,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#6B7280',
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#E5E7EB',
    marginHorizontal: Spacing.sm,
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: '#F9FAFB',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    color: '#4B5563',
    fontStyle: 'italic',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.helper,
    marginTop: Spacing.sm,
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // 컴팩트 카드 스타일 (기존 유지)
  compactCard: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  compactCover: {
    height: 32,
  },
  compactProfileArea: {
    alignItems: 'center',
    paddingBottom: Spacing.sm,
    marginTop: -18,
    backgroundColor: '#FFFFFF',
  },
  compactAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    overflow: 'hidden',
  },
  compactAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  compactName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  compactRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  compactRatingText: {
    fontSize: 11,
    color: '#666666',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
});
