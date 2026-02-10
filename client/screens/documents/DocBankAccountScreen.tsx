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

type DocBankAccountScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const BANKS = [
  'KB국민은행', '신한은행', '우리은행', 'NH농협은행', '하나은행',
  'SC제일은행', '한국씨티은행', 'IBK기업은행', 'KEB하나은행', '카카오뱅크',
  '케이뱅크', '토스뱅크', '새마을금고', '신협', '우체국',
];

export default function DocBankAccountScreen({ navigation }: DocBankAccountScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { documents, selectImage } = useDocumentUpload();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountInfo, setAccountInfo] = useState({
    bankName: '',
    accountNumber: '',
    accountHolder: '',
  });

  const canSubmit = () => {
    return !!(
      accountInfo.bankName &&
      accountInfo.accountNumber &&
      accountInfo.accountHolder &&
      documents.bankAccountCert.uploaded
    );
  };

  const handleSave = async () => {
    if (!canSubmit()) {
      const missing: string[] = [];
      if (!accountInfo.bankName) missing.push('은행명');
      if (!accountInfo.accountNumber) missing.push('계좌번호');
      if (!accountInfo.accountHolder) missing.push('예금주');
      if (!documents.bankAccountCert.uploaded) missing.push('통장 사본');

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
        new URL('/api/helpers/me/bank-account', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            bankName: accountInfo.bankName,
            accountNumber: accountInfo.accountNumber,
            accountHolder: accountInfo.accountHolder,
            bankbookImageUrl: documents.bankAccountCert.url,
          }),
        }
      );

      if (response.ok) {
        if (Platform.OS === 'web') {
          alert('정산 계좌가 저장되었습니다');
        } else {
          Alert.alert('저장 완료', '정산 계좌가 저장되었습니다', [
            { text: '확인', onPress: () => navigation.goBack() }
          ]);
        }
      } else {
        throw new Error('정산 계좌 저장 실패');
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
          <ThemedText style={[styles.title, { color: theme.text }]}>수수료 통장 (정산계좌)</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
            정산받을 계좌 정보를 입력해주세요
          </ThemedText>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            은행 선택 <ThemedText style={styles.required}>*</ThemedText>
          </ThemedText>
          <View style={styles.bankGrid}>
            {BANKS.map((bank) => (
              <Pressable
                key={bank}
                style={[
                  styles.bankButton,
                  {
                    backgroundColor: accountInfo.bankName === bank ? BrandColors.helper : theme.backgroundDefault,
                    borderColor: accountInfo.bankName === bank ? BrandColors.helper : (isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary),
                  }
                ]}
                onPress={() => setAccountInfo(prev => ({ ...prev, bankName: bank }))}
              >
                <ThemedText style={[
                  styles.bankText,
                  { color: accountInfo.bankName === bank ? Colors.light.buttonText : theme.text }
                ]}>
                  {bank}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            계좌번호 <ThemedText style={styles.required}>*</ThemedText>
          </ThemedText>
          <TextInput
            style={[styles.input, {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary
            }]}
            placeholder="- 없이 입력"
            placeholderTextColor={Colors.light.tabIconDefault}
            keyboardType="number-pad"
            value={accountInfo.accountNumber}
            onChangeText={(text) => setAccountInfo(prev => ({ ...prev, accountNumber: text }))}
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            예금주 <ThemedText style={styles.required}>*</ThemedText>
          </ThemedText>
          <TextInput
            style={[styles.input, {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary
            }]}
            placeholder="예금주명"
            placeholderTextColor={Colors.light.tabIconDefault}
            value={accountInfo.accountHolder}
            onChangeText={(text) => setAccountInfo(prev => ({ ...prev, accountHolder: text }))}
          />
        </View>

        <DocumentUploader
          document={documents.bankAccountCert}
          title="통장 사본"
          description="통장 앞면 또는 계좌 정보가 보이도록 촬영해주세요"
          icon="wallet-outline"
          required={true}
          onSelect={() => selectImage('bankAccountCert')}
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
  bankGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  bankButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  bankText: {
    fontSize: 13,
    fontWeight: '500',
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
