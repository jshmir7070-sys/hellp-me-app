import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Alert, Platform } from 'react-native';
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

type DocDriverLicenseScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function DocDriverLicenseScreen({ navigation }: DocDriverLicenseScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { documents, selectImage } = useDocumentUpload();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = () => {
    return documents.driverLicense.uploaded;
  };

  const handleSave = async () => {
    if (!canSubmit()) {
      const message = '운전면허증 사진을 업로드해주세요';
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
        new URL('/api/helpers/me/license', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            driverLicenseImageUrl: documents.driverLicense.url,
          }),
        }
      );

      if (response.ok) {
        if (Platform.OS === 'web') {
          alert('운전면허증이 저장되었습니다');
        } else {
          Alert.alert('저장 완료', '운전면허증이 저장되었습니다', [
            { text: '확인', onPress: () => navigation.goBack() }
          ]);
        }
      } else {
        throw new Error('운전면허증 저장 실패');
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
      >
        <View style={styles.headerSection}>
          <ThemedText style={[styles.title, { color: theme.text }]}>운전면허증</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
            운전면허증 앞면을 업로드해주세요
          </ThemedText>
        </View>

        <DocumentUploader
          document={documents.driverLicense}
          title="운전면허증"
          description="운전면허증 앞면 전체가 보이도록 촬영해주세요"
          icon="credit-card-outline"
          required={true}
          onSelect={() => selectImage('driverLicense')}
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
