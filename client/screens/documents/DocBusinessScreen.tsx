import React, { useState } from 'react';
import { View, StyleSheet, TextInput, Pressable, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/ThemedText';
import { Icon } from '@/components/Icon';
import { SafeScrollView } from '@/components/SafeScrollView';
import { DocumentUploader } from '@/components/documents/DocumentUploader';
import { useTheme } from '@/hooks/useTheme';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import { Spacing, BorderRadius, BrandColors, Colors } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';

type DocBusinessScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function DocBusinessScreen({ navigation }: DocBusinessScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { documents, selectImage } = useDocumentUpload();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [businessInfo, setBusinessInfo] = useState({
    businessNumber: '',
    businessName: '',
    representativeName: '',
    businessAddress: '',
    businessType: '',
    businessCategory: '',
    email: '',
  });

  const canSubmit = () => {
    return !!(
      businessInfo.businessNumber &&
      businessInfo.businessName &&
      businessInfo.representativeName &&
      businessInfo.businessAddress &&
      businessInfo.businessType &&
      businessInfo.businessCategory &&
      businessInfo.email &&
      documents.businessCert.uploaded
    );
  };

  const handleSave = async () => {
    if (!canSubmit()) {
      const missing: string[] = [];
      if (!businessInfo.businessNumber) missing.push('사업자등록번호');
      if (!businessInfo.businessName) missing.push('상호명');
      if (!businessInfo.representativeName) missing.push('대표자명');
      if (!businessInfo.businessAddress) missing.push('사업장 주소');
      if (!businessInfo.businessType) missing.push('업태');
      if (!businessInfo.businessCategory) missing.push('업종');
      if (!businessInfo.email) missing.push('이메일');
      if (!documents.businessCert.uploaded) missing.push('사업자등록증 사진');

      const message = `다음 항목을 확인해주세요:\n${missing.join(', ')}`;
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('필수 항목 누락', message);
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await AsyncStorage.getItem('auth_token');

      const response = await fetch(
        new URL('/api/helpers/me/business', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            businessNumber: businessInfo.businessNumber,
            businessName: businessInfo.businessName,
            representativeName: businessInfo.representativeName,
            address: businessInfo.businessAddress,
            businessType: businessInfo.businessType,
            businessCategory: businessInfo.businessCategory,
            email: businessInfo.email,
            businessImageUrl: documents.businessCert.url,
          }),
        }
      );

      if (response.ok) {
        if (Platform.OS === 'web') {
          alert('사업자 정보가 저장되었습니다');
        } else {
          Alert.alert('저장 완료', '사업자 정보가 저장되었습니다', [
            { text: '확인', onPress: () => navigation.goBack() }
          ]);
        }
      } else {
        throw new Error('사업자 정보 저장 실패');
      }
    } catch (error: any) {
      console.error('Save error:', error);
      if (Platform.OS === 'web') {
        alert('저장 실패: ' + (error.message || '다시 시도해주세요.'));
      } else {
        Alert.alert('저장 실패', error.message || '다시 시도해주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <SafeScrollView
        contentContainerStyle={styles.content}
        bottomButtonHeight={80}
        includeHeaderHeight={true}
        topPadding={Spacing.xl}
      >
        <View style={styles.headerSection}>
          <ThemedText style={[styles.title, { color: theme.text }]}>사업자등록증</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
            사업자 정보를 입력하고 사업자등록증을 업로드해주세요
          </ThemedText>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            사업자등록번호 <ThemedText style={styles.required}>*</ThemedText>
          </ThemedText>
          <TextInput
            style={[styles.input, {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary
            }]}
            placeholder="000-00-00000"
            placeholderTextColor={Colors.light.tabIconDefault}
            value={businessInfo.businessNumber}
            onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, businessNumber: text }))}
          />
        </View>

        <View style={styles.formRow}>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              상호명 <ThemedText style={styles.required}>*</ThemedText>
            </ThemedText>
            <TextInput
              style={[styles.input, {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary
              }]}
              placeholder="상호명"
              placeholderTextColor={Colors.light.tabIconDefault}
              value={businessInfo.businessName}
              onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, businessName: text }))}
            />
          </View>
          <View style={[styles.formGroup, { flex: 1, marginLeft: Spacing.md }]}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              대표자명 <ThemedText style={styles.required}>*</ThemedText>
            </ThemedText>
            <TextInput
              style={[styles.input, {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary
              }]}
              placeholder="대표자"
              placeholderTextColor={Colors.light.tabIconDefault}
              value={businessInfo.representativeName}
              onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, representativeName: text }))}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            사업장 주소 <ThemedText style={styles.required}>*</ThemedText>
          </ThemedText>
          <TextInput
            style={[styles.input, {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary
            }]}
            placeholder="사업장 주소"
            placeholderTextColor={Colors.light.tabIconDefault}
            value={businessInfo.businessAddress}
            onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, businessAddress: text }))}
          />
        </View>

        <View style={styles.formRow}>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              업태 <ThemedText style={styles.required}>*</ThemedText>
            </ThemedText>
            <TextInput
              style={[styles.input, {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary
              }]}
              placeholder="운수업"
              placeholderTextColor={Colors.light.tabIconDefault}
              value={businessInfo.businessType}
              onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, businessType: text }))}
            />
          </View>
          <View style={[styles.formGroup, { flex: 1, marginLeft: Spacing.md }]}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              업종 <ThemedText style={styles.required}>*</ThemedText>
            </ThemedText>
            <TextInput
              style={[styles.input, {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary
              }]}
              placeholder="화물운송"
              placeholderTextColor={Colors.light.tabIconDefault}
              value={businessInfo.businessCategory}
              onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, businessCategory: text }))}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            이메일 <ThemedText style={styles.required}>*</ThemedText>
          </ThemedText>
          <TextInput
            style={[styles.input, {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary
            }]}
            placeholder="example@email.com"
            placeholderTextColor={Colors.light.tabIconDefault}
            keyboardType="email-address"
            autoCapitalize="none"
            value={businessInfo.email}
            onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, email: text }))}
          />
        </View>

        <DocumentUploader
          document={documents.businessCert}
          title="사업자등록증"
          description="사업자등록증 전체가 보이도록 촬영해주세요"
          icon="file-document-outline"
          required={true}
          onSelect={() => selectImage('businessCert')}
        />
      </SafeScrollView>

      <View style={[styles.bottomBar, {
        paddingBottom: insets.bottom + Spacing.md,
        backgroundColor: theme.backgroundRoot
      }]}>
        <Pressable
          style={[
            styles.saveButton,
            {
              backgroundColor: canSubmit() ? BrandColors.helper : Colors.light.textTertiary,
              opacity: isSubmitting ? 0.7 : 1,
            }
          ]}
          onPress={handleSave}
          disabled={isSubmitting || !canSubmit()}
        >
          <Icon name="checkmark-outline" size={20} color={Colors.light.buttonText} />
          <ThemedText style={styles.saveButtonText}>저장</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  headerSection: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: Spacing.md,
  },
  formRow: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  required: {
    color: BrandColors.error,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.light.backgroundTertiary,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  saveButtonText: {
    color: Colors.light.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
});
