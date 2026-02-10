import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Pressable, Alert, Platform } from 'react-native';
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

type DocVehicleScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const VEHICLE_TYPES = [
  { id: '1톤하이탑', label: '1톤 하이탑' },
  { id: '1톤정탑', label: '1톤 정탑' },
  { id: '1톤저탑', label: '1톤 저탑' },
  { id: '1톤냉탑', label: '1톤 냉탑' },
  { id: '쓰리밴', label: '쓰리밴' },
];

const REGIONS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const PLATE_LETTERS = ['아', '바', '사', '자'];

export default function DocVehicleScreen({ navigation }: DocVehicleScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { documents, selectImage } = useDocumentUpload();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehicleInfo, setVehicleInfo] = useState({
    region: '서울',
    plateNumber1: '',
    plateLetter: '아',
    plateNumber2: '',
    vehicleType: '',
  });

  const getFullPlateNumber = () => {
    const { region, plateNumber1, plateLetter, plateNumber2 } = vehicleInfo;
    if (plateNumber1 && plateLetter && plateNumber2) {
      return `${region} ${plateNumber1}${plateLetter} ${plateNumber2}`;
    }
    return '';
  };

  const canSubmit = () => {
    return !!(
      vehicleInfo.vehicleType &&
      vehicleInfo.plateNumber1 &&
      vehicleInfo.plateNumber2 &&
      documents.vehicleCert.uploaded
    );
  };

  const handleSave = async () => {
    if (!canSubmit()) {
      const missing: string[] = [];
      if (!vehicleInfo.vehicleType) missing.push('차량 종류');
      if (!vehicleInfo.plateNumber1 || !vehicleInfo.plateNumber2) missing.push('차량번호');
      if (!documents.vehicleCert.uploaded) missing.push('차량등록증 사진');

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
        new URL('/api/helpers/me/vehicle', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            vehicleType: vehicleInfo.vehicleType,
            plateNumber: getFullPlateNumber(),
            vehicleImageUrl: documents.vehicleCert.url,
          }),
        }
      );

      if (response.ok) {
        if (Platform.OS === 'web') {
          alert('차량 정보가 저장되었습니다');
        } else {
          Alert.alert('저장 완료', '차량 정보가 저장되었습니다', [
            { text: '확인', onPress: () => navigation.goBack() }
          ]);
        }
      } else {
        throw new Error('차량 정보 저장 실패');
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
          <ThemedText style={[styles.title, { color: theme.text }]}>차량 등록</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
            차량 정보와 차량등록증을 업로드해주세요
          </ThemedText>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            차량 종류 <ThemedText style={styles.required}>*</ThemedText>
          </ThemedText>
          <View style={styles.vehicleTypeGrid}>
            {VEHICLE_TYPES.map((type) => (
              <Pressable
                key={type.id}
                style={[
                  styles.vehicleTypeButton,
                  {
                    backgroundColor: vehicleInfo.vehicleType === type.id ? BrandColors.helper : theme.backgroundDefault,
                    borderColor: vehicleInfo.vehicleType === type.id ? BrandColors.helper : (isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary),
                  }
                ]}
                onPress={() => setVehicleInfo(prev => ({ ...prev, vehicleType: type.id }))}
              >
                <ThemedText style={[
                  styles.vehicleTypeText,
                  { color: vehicleInfo.vehicleType === type.id ? Colors.light.buttonText : theme.text }
                ]}>
                  {type.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            차량번호 <ThemedText style={styles.required}>*</ThemedText>
          </ThemedText>
          <View style={styles.plateInputRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionScroll}>
              {REGIONS.slice(0, 5).map((region) => (
                <Pressable
                  key={region}
                  style={[
                    styles.regionButton,
                    {
                      backgroundColor: vehicleInfo.region === region ? BrandColors.helper : theme.backgroundDefault,
                      borderColor: vehicleInfo.region === region ? BrandColors.helper : (isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary),
                    }
                  ]}
                  onPress={() => setVehicleInfo(prev => ({ ...prev, region }))}
                >
                  <ThemedText style={{ color: vehicleInfo.region === region ? Colors.light.buttonText : theme.text, fontSize: 12 }}>
                    {region}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <View style={styles.plateInputRow}>
            <TextInput
              style={[styles.plateInput, {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary
              }]}
              placeholder="12"
              placeholderTextColor={Colors.light.tabIconDefault}
              keyboardType="number-pad"
              maxLength={2}
              value={vehicleInfo.plateNumber1}
              onChangeText={(text) => setVehicleInfo(prev => ({ ...prev, plateNumber1: text }))}
            />
            <View style={styles.letterButtons}>
              {PLATE_LETTERS.map((letter) => (
                <Pressable
                  key={letter}
                  style={[
                    styles.letterButton,
                    {
                      backgroundColor: vehicleInfo.plateLetter === letter ? BrandColors.helper : theme.backgroundDefault,
                      borderColor: vehicleInfo.plateLetter === letter ? BrandColors.helper : (isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary),
                    }
                  ]}
                  onPress={() => setVehicleInfo(prev => ({ ...prev, plateLetter: letter }))}
                >
                  <ThemedText style={{ color: vehicleInfo.plateLetter === letter ? Colors.light.buttonText : theme.text, fontSize: 14 }}>
                    {letter}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[styles.plateInput, styles.plateInputLarge, {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary
              }]}
              placeholder="0000"
              placeholderTextColor={Colors.light.tabIconDefault}
              keyboardType="number-pad"
              maxLength={4}
              value={vehicleInfo.plateNumber2}
              onChangeText={(text) => setVehicleInfo(prev => ({ ...prev, plateNumber2: text }))}
            />
          </View>
          {getFullPlateNumber() ? (
            <View style={[styles.platePreview, { backgroundColor: BrandColors.helperLight }]}>
              <ThemedText style={{ color: BrandColors.helper, fontWeight: '600' }}>{getFullPlateNumber()}</ThemedText>
            </View>
          ) : null}
        </View>

        <DocumentUploader
          document={documents.vehicleCert}
          title="차량등록증"
          description="차량등록증 전체가 보이도록 촬영해주세요"
          icon="truck"
          required={true}
          onSelect={() => selectImage('vehicleCert')}
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
  vehicleTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  vehicleTypeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  vehicleTypeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  plateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  regionScroll: {
    flexGrow: 0,
  },
  regionButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginRight: Spacing.xs,
  },
  plateInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    width: 60,
    textAlign: 'center',
  },
  plateInputLarge: {
    width: 80,
  },
  letterButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  letterButton: {
    width: 32,
    height: 36,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platePreview: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
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
