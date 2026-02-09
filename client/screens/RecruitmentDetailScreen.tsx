import React from "react";
import { View, ScrollView, Pressable, StyleSheet, Alert, Platform, ActivityIndicator, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, BrandColors, Colors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

import { RecruitmentStackParamList } from "@/navigation/RecruitmentStackNavigator";

type RecruitmentDetailScreenProps = NativeStackScreenProps<RecruitmentStackParamList, 'RecruitmentDetail'>;

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

export default function RecruitmentDetailScreen({ navigation, route }: RecruitmentDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { recruitmentId } = route.params;
  const queryClient = useQueryClient();

  const { data: recruitment, isLoading, error } = useQuery<Recruitment>({
    queryKey: [`/api/orders/${recruitmentId}`],
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/orders/apply/${recruitmentId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      if (Platform.OS === 'web') {
        alert('지원이 완료되었습니다!');
      } else {
        Alert.alert('지원 완료', '지원이 완료되었습니다. 담당자가 확인 후 연락드릴 예정입니다.');
      }
      navigation.goBack();
    },
    onError: (err: Error) => {
      const message = err.message || '지원에 실패했습니다.';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('오류', message);
      }
    },
  });

  const handleApply = () => {
    if (Platform.OS === 'web') {
      if (confirm('이 채용공고에 지원하시겠습니까?')) {
        applyMutation.mutate();
      }
    } else {
      Alert.alert(
        '지원 확인',
        '이 채용공고에 지원하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '지원하기', onPress: () => applyMutation.mutate() },
        ]
      );
    }
  };

  const handleCall = () => {
    if (recruitment?.contactInfo) {
      const phoneNumber = recruitment.contactInfo.replace(/[^0-9]/g, '');
      Linking.openURL(`tel:${phoneNumber}`);
    }
  };

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

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.helper} />
        <ThemedText style={[styles.loadingText, { color: theme.tabIconDefault }]}>
          정보를 불러오는 중...
        </ThemedText>
      </View>
    );
  }

  if (error || !recruitment) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <Icon name="alert-circle-outline" size={48} color={BrandColors.error} />
        <ThemedText style={[styles.loadingText, { color: theme.text }]}>
          채용공고를 찾을 수 없습니다
        </ThemedText>
        <Pressable
          style={[styles.backButton, { backgroundColor: BrandColors.helper }]}
          onPress={() => navigation.goBack()}
        >
          <ThemedText style={styles.backButtonText}>돌아가기</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: Spacing.lg,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: Spacing.lg,
        }}
      >
        <View style={styles.header}>
          <View style={[
            styles.typeBadge, 
            { backgroundColor: getEmploymentTypeColor(recruitment.employmentType) + '20' }
          ]}>
            <ThemedText style={[
              styles.typeText, 
              { color: getEmploymentTypeColor(recruitment.employmentType) }
            ]}>
              {recruitment.employmentType || '미정'}
            </ThemedText>
          </View>
          {recruitment.deadline ? (
            <ThemedText style={[styles.deadline, { color: BrandColors.warning }]}>
              마감: {recruitment.deadline}
            </ThemedText>
          ) : null}
        </View>

        <ThemedText style={[styles.title, { color: theme.text }]}>
          {recruitment.title || recruitment.companyName || '채용공고'}
        </ThemedText>

        <Card variant="glass" padding="lg" style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Icon name="briefcase-outline" size={18} color={BrandColors.helper} />
              <View>
                <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>회사명</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                  {recruitment.companyName || '미정'}
                </ThemedText>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Icon name="location-outline" size={18} color={BrandColors.helper} />
              <View>
                <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>근무지</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                  {recruitment.location || '미정'}
                </ThemedText>
              </View>
            </View>
          </View>
          {recruitment.salary ? (
            <View style={styles.salarySection}>
              <Icon name="cash-outline" size={18} color={BrandColors.helper} />
              <View>
                <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>급여</ThemedText>
                <ThemedText style={[styles.salaryValue, { color: BrandColors.helper }]}>
                  {recruitment.salary}
                </ThemedText>
              </View>
            </View>
          ) : null}
        </Card>

        {recruitment.description ? (
          <Card variant="glass" padding="lg" style={styles.sectionCard}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>상세 내용</ThemedText>
            <ThemedText style={[styles.sectionContent, { color: theme.text }]}>
              {recruitment.description}
            </ThemedText>
          </Card>
        ) : null}

        {recruitment.requirements ? (
          <Card variant="glass" padding="lg" style={styles.sectionCard}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>자격 요건</ThemedText>
            <ThemedText style={[styles.sectionContent, { color: theme.text }]}>
              {recruitment.requirements}
            </ThemedText>
          </Card>
        ) : null}

        {recruitment.benefits ? (
          <Card variant="glass" padding="lg" style={styles.sectionCard}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>복리후생</ThemedText>
            <ThemedText style={[styles.sectionContent, { color: theme.text }]}>
              {recruitment.benefits}
            </ThemedText>
          </Card>
        ) : null}

        {recruitment.contactInfo ? (
          <Card variant="glass" padding="lg" style={styles.sectionCard}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>연락처</ThemedText>
            <Pressable style={styles.contactRow} onPress={handleCall}>
              <Icon name="call-outline" size={16} color={BrandColors.helper} />
              <ThemedText style={[styles.contactText, { color: BrandColors.helper }]}>
                {recruitment.contactInfo}
              </ThemedText>
            </Pressable>
          </Card>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.backgroundRoot }]}>
        <Pressable
          style={[styles.applyButton, { backgroundColor: BrandColors.helper }]}
          onPress={handleApply}
          disabled={applyMutation.isPending}
        >
          {applyMutation.isPending ? (
            <ActivityIndicator color={Colors.light.buttonText} />
          ) : (
            <>
              <Icon name="send-outline" size={20} color={Colors.light.buttonText} />
              <ThemedText style={styles.applyButtonText}>지원하기</ThemedText>
            </>
          )}
        </Pressable>
      </View>
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
  backButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  backButtonText: {
    color: Colors.light.buttonText,
    ...Typography.body,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: Spacing.md,
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
    ...Typography.h2,
    marginBottom: Spacing.lg,
  },
  infoCard: {
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    flex: 1,
  },
  infoLabel: {
    ...Typography.small,
  },
  infoValue: {
    ...Typography.body,
    fontWeight: '500',
  },
  salarySection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.light.backgroundTertiary,
  },
  salaryValue: {
    ...Typography.h4,
    fontWeight: '700',
  },
  sectionCard: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.sm,
  },
  sectionContent: {
    ...Typography.body,
    lineHeight: 24,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  contactText: {
    ...Typography.body,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.light.backgroundTertiary,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  applyButtonText: {
    color: Colors.light.buttonText,
    ...Typography.body,
    fontWeight: '700',
  },
});
