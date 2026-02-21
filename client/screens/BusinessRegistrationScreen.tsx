import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from '@/constants/theme';
import { apiRequest } from '@/lib/query-client';

type Props = NativeStackScreenProps<any, 'BusinessRegistration'>;

interface BusinessProfile {
  businessNumber?: string;
  businessName?: string;
  representativeName?: string;
  address?: string;
  businessType?: string;
  businessCategory?: string;
}

export default function BusinessRegistrationScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const [businessNumber, setBusinessNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [address, setAddress] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');

  const { data: existingBusiness, isLoading } = useQuery<BusinessProfile>({
    queryKey: ['/api/requesters/business'],
  });

  useEffect(() => {
    if (existingBusiness) {
      setBusinessNumber(existingBusiness.businessNumber || '');
      setBusinessName(existingBusiness.businessName || '');
      setRepresentativeName(existingBusiness.representativeName || '');
      setAddress(existingBusiness.address || '');
      setBusinessType(existingBusiness.businessType || '');
      setBusinessCategory(existingBusiness.businessCategory || '');
    }
  }, [existingBusiness]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/requesters/business', {
        businessNumber: businessNumber.replace(/-/g, ''),
        businessName,
        representativeName,
        address,
        businessType,
        businessCategory,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/requesters/business'] });
      const msg = '사업자정보가 저장되었습니다';
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('완료', msg);
      }
      navigation.goBack();
    },
    onError: (err: Error) => {
      const msg = err.message || '저장에 실패했습니다';
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('오류', msg);
      }
    },
  });

  const formatBusinessNumber = (text: string) => {
    const numbers = text.replace(/[^\d]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5, 10)}`;
  };

  const handleSave = () => {
    const cleanNumber = businessNumber.replace(/-/g, '');
    if (cleanNumber.length !== 10) {
      const msg = '사업자등록번호는 10자리를 입력해주세요';
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('알림', msg);
      }
      return;
    }
    if (!businessName.trim() || !representativeName.trim() || !address.trim() || !businessType.trim() || !businessCategory.trim()) {
      const msg = '모든 필수 항목을 입력해주세요';
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('알림', msg);
      }
      return;
    }
    saveMutation.mutate();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <Card style={styles.card}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            사업자 등록정보
          </ThemedText>
          <ThemedText style={[styles.sectionDescription, { color: theme.tabIconDefault }]}>
            세금계산서 발행을 위해 사업자 정보를 등록해주세요
          </ThemedText>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              사업자등록번호 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText>
            </ThemedText>
            <TextInput
              style={[styles.input, { 
                backgroundColor: isDark ? '#374151' : '#F9FAFB',
                color: theme.text,
                borderColor: isDark ? '#4B5563' : '#E5E7EB'
              }]}
              value={businessNumber}
              onChangeText={(text) => setBusinessNumber(formatBusinessNumber(text))}
              placeholder="000-00-00000"
              placeholderTextColor={theme.tabIconDefault}
              keyboardType="number-pad"
              maxLength={12}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              상호명 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText>
            </ThemedText>
            <TextInput
              style={[styles.input, { 
                backgroundColor: isDark ? '#374151' : '#F9FAFB',
                color: theme.text,
                borderColor: isDark ? '#4B5563' : '#E5E7EB'
              }]}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="회사명을 입력하세요"
              placeholderTextColor={theme.tabIconDefault}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              대표자명 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText>
            </ThemedText>
            <TextInput
              style={[styles.input, { 
                backgroundColor: isDark ? '#374151' : '#F9FAFB',
                color: theme.text,
                borderColor: isDark ? '#4B5563' : '#E5E7EB'
              }]}
              value={representativeName}
              onChangeText={setRepresentativeName}
              placeholder="대표자 이름"
              placeholderTextColor={theme.tabIconDefault}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              사업장 주소 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText>
            </ThemedText>
            <TextInput
              style={[styles.input, { 
                backgroundColor: isDark ? '#374151' : '#F9FAFB',
                color: theme.text,
                borderColor: isDark ? '#4B5563' : '#E5E7EB'
              }]}
              value={address}
              onChangeText={setAddress}
              placeholder="사업장 주소"
              placeholderTextColor={theme.tabIconDefault}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              업태 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText>
            </ThemedText>
            <TextInput
              style={[styles.input, { 
                backgroundColor: isDark ? '#374151' : '#F9FAFB',
                color: theme.text,
                borderColor: isDark ? '#4B5563' : '#E5E7EB'
              }]}
              value={businessType}
              onChangeText={setBusinessType}
              placeholder="예: 도소매, 서비스업"
              placeholderTextColor={theme.tabIconDefault}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              업종 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText>
            </ThemedText>
            <TextInput
              style={[styles.input, { 
                backgroundColor: isDark ? '#374151' : '#F9FAFB',
                color: theme.text,
                borderColor: isDark ? '#4B5563' : '#E5E7EB'
              }]}
              value={businessCategory}
              onChangeText={setBusinessCategory}
              placeholder="예: 택배, 물류"
              placeholderTextColor={theme.tabIconDefault}
            />
          </View>
        </Card>

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            { 
              backgroundColor: BrandColors.requester,
              opacity: pressed || saveMutation.isPending ? 0.7 : 1,
            },
          ]}
          onPress={handleSave}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.submitButtonText}>
              {existingBusiness ? '수정하기' : '등록하기'}
            </ThemedText>
          )}
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  sectionDescription: {
    ...Typography.small,
    marginBottom: Spacing.xl,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.small,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  input: {
    ...Typography.body,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  submitButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  submitButtonText: {
    ...Typography.body,
    color: '#fff',
    fontWeight: '600',
  },
});
