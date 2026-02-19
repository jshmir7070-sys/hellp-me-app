import React, { useRef, useMemo } from "react";
import { View, TextInput, Pressable, StyleSheet, ScrollView, Switch, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { Step6Props } from "./types";

// 배송 가이드 3개 고정 필드 키/라벨 정의
const GUIDE_FIELDS = [
  { key: 'router', label: '라우터 및 분류번호', icon: 'list-outline' as const },
  { key: 'difficulty', label: '지역 난이도', icon: 'alert-circle-outline' as const },
  { key: 'deliveryInfo', label: '배송지정보', icon: 'location-outline' as const },
] as const;

type GuideFieldKey = typeof GUIDE_FIELDS[number]['key'];

/** deliveryGuide 문자열을 3개 필드로 파싱 */
function parseGuideFields(guide: string): Record<GuideFieldKey, string> {
  const result: Record<GuideFieldKey, string> = { router: '', difficulty: '', deliveryInfo: '' };
  if (!guide) return result;

  // "라우터 및 분류번호:" / "지역 난이도:" / "배송지정보:" 으로 분할
  const routerMatch = guide.match(/라우터 및 분류번호:\s*([\s\S]*?)(?=지역 난이도:|배송지정보:|$)/);
  const difficultyMatch = guide.match(/지역 난이도:\s*([\s\S]*?)(?=라우터 및 분류번호:|배송지정보:|$)/);
  const deliveryMatch = guide.match(/배송지정보:\s*([\s\S]*?)(?=라우터 및 분류번호:|지역 난이도:|$)/);

  if (routerMatch) result.router = routerMatch[1].trim();
  if (difficultyMatch) result.difficulty = difficultyMatch[1].trim();
  if (deliveryMatch) result.deliveryInfo = deliveryMatch[1].trim();

  return result;
}

/** 3개 필드를 하나의 deliveryGuide 문자열로 조합 */
function combineGuideFields(fields: Record<GuideFieldKey, string>): string {
  const parts: string[] = [];
  if (fields.router || fields.difficulty || fields.deliveryInfo) {
    parts.push(`라우터 및 분류번호: ${fields.router}`);
    parts.push(`지역 난이도: ${fields.difficulty}`);
    parts.push(`배송지정보: ${fields.deliveryInfo}`);
  }
  return parts.join('\n');
}

export default function Step6AdditionalInfo({
  activeTab,
  courierForm,
  setCourierForm,
  otherCourierForm,
  setOtherCourierForm,
  coldTruckForm,
  setColdTruckForm,
  imageUri,
  setImageUri,
  onNext,
  onBack,
  theme,
  isDark,
}: Step6Props) {

  const inputRefs = useRef<Record<GuideFieldKey, TextInput | null>>({
    router: null,
    difficulty: null,
    deliveryInfo: null,
  });

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const removeImage = () => {
    setImageUri(null);
  };

  const getCurrentGuide = () => {
    if (activeTab === "택배사") return courierForm.deliveryGuide;
    if (activeTab === "기타택배") return otherCourierForm.deliveryGuide;
    return coldTruckForm.deliveryGuide;
  };

  const setGuideValue = (value: string) => {
    if (activeTab === "택배사") {
      setCourierForm({ ...courierForm, deliveryGuide: value });
    } else if (activeTab === "기타택배") {
      setOtherCourierForm({ ...otherCourierForm, deliveryGuide: value });
    } else {
      setColdTruckForm({ ...coldTruckForm, deliveryGuide: value });
    }
  };

  // 현재 가이드 문자열을 3개 필드로 파싱
  const guideFields = useMemo(() => parseGuideFields(getCurrentGuide()), [getCurrentGuide()]);

  // 특정 필드 값 변경 시 전체 deliveryGuide 문자열 업데이트
  const updateGuideField = (fieldKey: GuideFieldKey, value: string) => {
    const updated = { ...guideFields, [fieldKey]: value };
    setGuideValue(combineGuideFields(updated));
  };

  // 라벨 탭 시 해당 입력 필드에 포커스
  const focusField = (fieldKey: GuideFieldKey) => {
    inputRefs.current[fieldKey]?.focus();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText style={[styles.stepTitle, { color: theme.text }]}>
            6단계: 추가 정보
          </ThemedText>
          <ThemedText style={[styles.stepDescription, { color: Colors.light.tabIconDefault }]}>
            배송 가이드와 긴급 여부를 설정해주세요 (선택사항)
          </ThemedText>
        </View>

        {/* 배송지 사진 업로드 */}
        <View style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            배송지 사진
          </ThemedText>
          <ThemedText style={[styles.imageDescription, { color: Colors.light.tabIconDefault }]}>
            배송지 위치를 확인할 수 있는 사진을 업로드해주세요
          </ThemedText>

          {imageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <Pressable
                style={styles.removeImageButton}
                onPress={removeImage}
              >
                <Icon name="close-circle" size={28} color={BrandColors.error} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.imageUploadRow}>
              <Pressable
                style={[
                  styles.imageUploadButton,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                  },
                ]}
                onPress={pickImage}
              >
                <Icon name="image-outline" size={32} color={BrandColors.requester} />
                <ThemedText style={[styles.imageUploadText, { color: theme.text }]}>
                  갤러리
                </ThemedText>
              </Pressable>

              <Pressable
                style={[
                  styles.imageUploadButton,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                  },
                ]}
                onPress={takePhoto}
              >
                <Icon name="camera-outline" size={32} color={BrandColors.requester} />
                <ThemedText style={[styles.imageUploadText, { color: theme.text }]}>
                  카메라
                </ThemedText>
              </Pressable>
            </View>
          )}
        </View>

        {/* 배송 가이드 - 3개 고정 필드 */}
        <View style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            배송 가이드
          </ThemedText>

          {GUIDE_FIELDS.map((field) => (
            <Pressable
              key={field.key}
              style={[
                styles.guideFieldContainer,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                },
              ]}
              onPress={() => focusField(field.key)}
            >
              <View style={styles.guideFieldHeader}>
                <Icon name={field.icon} size={16} color={BrandColors.requester} />
                <ThemedText style={[styles.guideFieldLabel, { color: BrandColors.requester }]}>
                  {field.label}
                </ThemedText>
              </View>
              <TextInput
                ref={(ref) => { inputRefs.current[field.key] = ref; }}
                style={[
                  styles.guideFieldInput,
                  { color: theme.text },
                ]}
                placeholder="탭하여 입력"
                placeholderTextColor={Colors.light.tabIconDefault}
                multiline
                textAlignVertical="top"
                value={guideFields[field.key]}
                onChangeText={(value) => updateGuideField(field.key, value)}
              />
            </Pressable>
          ))}
        </View>

        {/* 긴급 오더 */}
        <View style={styles.section}>
          <View style={[
            styles.urgentBox,
            {
              backgroundColor: isDark ? '#4C0519' : '#FEE2E2',
              borderColor: isDark ? '#9F1239' : '#FECACA'
            }
          ]}>
            <View style={styles.urgentHeader}>
              <View style={styles.urgentTitleRow}>
                <Icon name="warning-outline" size={20} color={BrandColors.error} />
                <ThemedText style={[styles.urgentTitle, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>
                  긴급 오더
                </ThemedText>
              </View>
              <Switch
                value={
                  activeTab === "택배사"
                    ? courierForm.isUrgent
                    : activeTab === "기타택배"
                    ? otherCourierForm.isUrgent
                    : coldTruckForm.isUrgent
                }
                onValueChange={(value) => {
                  if (activeTab === "택배사") {
                    setCourierForm({ ...courierForm, isUrgent: value });
                  } else if (activeTab === "기타택배") {
                    setOtherCourierForm({ ...otherCourierForm, isUrgent: value });
                  } else {
                    setColdTruckForm({ ...coldTruckForm, isUrgent: value });
                  }
                }}
                trackColor={{ false: '#D1D5DB', true: BrandColors.error }}
                thumbColor={
                  (activeTab === "택배사" ? courierForm.isUrgent :
                   activeTab === "기타택배" ? otherCourierForm.isUrgent :
                   coldTruckForm.isUrgent) ? '#FFFFFF' : '#F3F4F6'
                }
              />
            </View>
            <ThemedText style={[styles.urgentDescription, { color: isDark ? '#FECACA' : '#DC2626' }]}>
              긴급 오더로 등록 시 추가 요금이 발생합니다
            </ThemedText>
          </View>
        </View>

        <View style={[styles.infoBox, { backgroundColor: isDark ? '#1E3A5F' : '#EBF8FF' }]}>
          <Icon name="information-circle-outline" size={20} color={BrandColors.requester} />
          <View style={styles.infoTextContainer}>
            <ThemedText style={[styles.infoText, { color: theme.text }]}>
              다음 단계에서 입력하신 모든 정보를 확인하실 수 있습니다.
            </ThemedText>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.backgroundRoot }]}>
        <Pressable
          style={[styles.button, styles.buttonSecondary, { borderColor: BrandColors.requester }]}
          onPress={onBack}
        >
          <ThemedText style={[styles.buttonText, { color: BrandColors.requester }]}>이전</ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.button,
            styles.buttonPrimary,
            { backgroundColor: BrandColors.requester },
          ]}
          onPress={onNext}
        >
          <ThemedText style={[styles.buttonText, { color: '#FFFFFF' }]}>다음</ThemedText>
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
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  stepTitle: {
    ...Typography.heading2,
    marginBottom: Spacing.xs,
  },
  stepDescription: {
    ...Typography.body,
  },
  label: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  imageDescription: {
    ...Typography.caption,
    marginBottom: Spacing.md,
  },
  imageUploadRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  imageUploadButton: {
    flex: 1,
    paddingVertical: Spacing.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  imageUploadText: {
    ...Typography.caption,
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
  },
  guideFieldContainer: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  guideFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  guideFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  guideFieldInput: {
    ...Typography.body,
    fontSize: 14,
    minHeight: 36,
    padding: 0,
  },
  urgentBox: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  urgentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  urgentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  urgentTitle: {
    ...Typography.body,
    fontWeight: 'bold',
  },
  urgentDescription: {
    ...Typography.caption,
  },
  infoBox: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoText: {
    ...Typography.caption,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    flexDirection: 'row',
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.light.backgroundSecondary,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: BrandColors.requester,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonText: {
    ...Typography.button,
  },
});
