import React, { useState } from "react";
import { View, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";

type RecruitmentScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

interface Recruitment {
  id: number;
  title: string;
  companyName?: string;
  location?: string;
  salary?: string;
  employmentType?: string;
  deadline?: string;
  description?: string;
  requirements?: string;
  benefits?: string;
  contactInfo?: string;
  createdAt: string;
  status: string;
}

export default function RecruitmentScreen({ navigation }: RecruitmentScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const [selectedFilter, setSelectedFilter] = useState<string>('전체');

  const { data: recruitments = [], isLoading, refetch, isRefetching } = useQuery<Recruitment[]>({
    queryKey: ['/api/orders?category=채용공고'],
  });

  const filters = ['전체', '정규직', '계약직', '일용직'];

  const filteredRecruitments = selectedFilter === '전체'
    ? recruitments
    : recruitments.filter(r => r.employmentType === selectedFilter);

  const getEmploymentTypeColor = (type?: string) => {
    switch (type) {
      case '정규직':
        return BrandColors.helper;
      case '계약직':
        return BrandColors.requester;
      case '일용직':
        return BrandColors.warning;
      default:
        return theme.tabIconDefault;
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <View style={styles.filterRow}>
        {filters.map((filter) => (
          <Pressable
            key={filter}
            style={[
              styles.filterChip,
              {
                backgroundColor: selectedFilter === filter
                  ? BrandColors.helper
                  : theme.backgroundDefault,
              },
            ]}
            onPress={() => setSelectedFilter(filter)}
          >
            <ThemedText
              style={[
                styles.filterChipText,
                {
                  color: selectedFilter === filter ? '#FFFFFF' : theme.text,
                },
              ]}
            >
              {filter}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.resultInfo}>
        <ThemedText style={[styles.resultCount, { color: theme.text }]}>
          {filteredRecruitments.length}개의 채용공고
        </ThemedText>
      </View>
    </View>
  );

  const renderRecruitment = ({ item }: { item: Recruitment }) => (
    <Pressable
      testID={`recruitment-card-${item.id}`}
      onPress={() => navigation.navigate('RecruitmentDetail', { recruitmentId: String(item.id) })}
    >
      <Card variant="glass" padding="lg" style={styles.recruitmentCard}>
        <View style={styles.cardHeader}>
          <View style={[
            styles.typeBadge, 
            { backgroundColor: getEmploymentTypeColor(item.employmentType) + '20' }
          ]}>
            <ThemedText style={[
              styles.typeText, 
              { color: getEmploymentTypeColor(item.employmentType) }
            ]}>
              {item.employmentType || '미정'}
            </ThemedText>
          </View>
          {item.deadline ? (
            <ThemedText style={[styles.deadline, { color: BrandColors.warning }]}>
              ~{item.deadline}
            </ThemedText>
          ) : null}
        </View>

        <ThemedText style={[styles.title, { color: theme.text }]} numberOfLines={2}>
          {item.title || item.companyName || '채용공고'}
        </ThemedText>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Icon name="briefcase-outline" size={14} color={theme.tabIconDefault} />
            <ThemedText style={[styles.infoText, { color: theme.tabIconDefault }]}>
              {item.companyName || '회사명 미정'}
            </ThemedText>
          </View>
          <View style={styles.infoItem}>
            <Icon name="location-outline" size={14} color={theme.tabIconDefault} />
            <ThemedText style={[styles.infoText, { color: theme.tabIconDefault }]}>
              {item.location || '지역 미정'}
            </ThemedText>
          </View>
        </View>

        {item.salary ? (
          <View style={styles.salaryRow}>
            <Icon name="cash-outline" size={16} color={BrandColors.helper} />
            <ThemedText style={[styles.salary, { color: BrandColors.helper }]}>
              {item.salary}
            </ThemedText>
          </View>
        ) : null}

        {item.benefits ? (
          <View style={styles.benefitsRow}>
            <ThemedText style={[styles.benefits, { color: theme.tabIconDefault }]} numberOfLines={1}>
              {item.benefits}
            </ThemedText>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );

  const renderEmptyState = () => (
    <Card variant="glass" padding="xl" style={styles.emptyCard}>
      <View style={[styles.emptyIconContainer, { backgroundColor: BrandColors.helperLight }]}>
        <Icon name="briefcase-outline" size={32} color={BrandColors.helper} />
      </View>
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        현재 등록된 채용 공고가 없습니다.
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
        새로운 지입채용 공고가 등록되면 알려드릴게요
      </ThemedText>
    </Card>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.helper} />
        <ThemedText style={[styles.loadingText, { color: theme.tabIconDefault }]}>
          채용공고를 불러오는 중...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={filteredRecruitments}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderRecruitment}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={BrandColors.helper}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
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
  loadingText: {
    marginTop: Spacing.md,
    ...Typography.body,
  },
  headerContent: {
    marginBottom: Spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  filterChipText: {
    ...Typography.small,
    fontWeight: '500',
  },
  resultInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultCount: {
    ...Typography.body,
    fontWeight: '600',
  },
  recruitmentCard: {
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  typeText: {
    ...Typography.small,
    fontWeight: '600',
  },
  deadline: {
    ...Typography.small,
  },
  title: {
    ...Typography.h4,
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  infoText: {
    ...Typography.small,
  },
  salaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  salary: {
    ...Typography.body,
    fontWeight: '700',
  },
  benefitsRow: {
    marginTop: Spacing.xs,
  },
  benefits: {
    ...Typography.small,
  },
  emptyCard: {
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h4,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
});
