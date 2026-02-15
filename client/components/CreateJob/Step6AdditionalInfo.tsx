import React, { useState } from "react";
import { View, TextInput, Pressable, StyleSheet, ScrollView, Switch, Image, Alert } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { Step6Props } from "./types";
import { pickImage } from "@/lib/image-upload";

export default function Step6AdditionalInfo({
  activeTab,
  courierForm,
  setCourierForm,
  otherCourierForm,
  setOtherCourierForm,
  coldTruckForm,
  setColdTruckForm,
  onNext,
  onBack,
  theme,
  isDark,
  bottomPadding,
}: Step6Props) {
  const [uploadedFiles, setUploadedFiles] = useState<{ uri: string; name: string }[]>([]);

  const handlePickFile = async () => {
    const uri = await pickImage({ source: 'library', allowsEditing: false, quality: 0.8 });
    if (uri) {
      const fileName = uri.split('/').pop() || '배송지_파일';
      setUploadedFiles((prev) => [...prev, { uri, name: fileName }]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText style={[styles.stepTitle, { color: theme.text }]}>
            5단계: 배송가이드 · 파일 업로드
          </ThemedText>
          <ThemedText style={[styles.stepDescription, { color: Colors.light.tabIconDefault }]}>
            배송 가이드, 배송지 파일 업로드, 긴급 여부를 설정해주세요 (선택사항)
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            배송 가이드
          </ThemedText>
          <TextInput
            style={[
              styles.textArea,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
              },
            ]}
            placeholder="배송 시 특이사항이나 가이드를 입력해주세요"
            placeholderTextColor={Colors.light.tabIconDefault}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={
              activeTab === "택배사" 
                ? courierForm.deliveryGuide 
                : activeTab === "기타택배" 
                ? otherCourierForm.deliveryGuide 
                : coldTruckForm.deliveryGuide
            }
            onChangeText={(value) => {
              if (activeTab === "택배사") {
                setCourierForm({ ...courierForm, deliveryGuide: value });
              } else if (activeTab === "기타택배") {
                setOtherCourierForm({ ...otherCourierForm, deliveryGuide: value });
              } else {
                setColdTruckForm({ ...coldTruckForm, deliveryGuide: value });
              }
            }}
          />
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            배송지 파일 업로드
          </ThemedText>
          <ThemedText style={[styles.uploadDescription, { color: Colors.light.tabIconDefault }]}>
            배송지 지도, 엑셀 파일 등을 사진으로 촬영하여 업로드해주세요
          </ThemedText>

          {uploadedFiles.map((file, index) => (
            <View key={index} style={[styles.fileItem, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
              <Image source={{ uri: file.uri }} style={styles.fileThumbnail} />
              <ThemedText style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
                {file.name}
              </ThemedText>
              <Pressable onPress={() => handleRemoveFile(index)}>
                <Icon name="close-circle-outline" size={22} color={BrandColors.error} />
              </Pressable>
            </View>
          ))}

          <Pressable
            style={[styles.uploadButton, { borderColor: BrandColors.requester }]}
            onPress={handlePickFile}
          >
            <Icon name="cloud-upload-outline" size={24} color={BrandColors.requester} />
            <ThemedText style={[styles.uploadButtonText, { color: BrandColors.requester }]}>
              파일 선택
            </ThemedText>
          </Pressable>
        </View>

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

      <View style={[styles.footer, { backgroundColor: theme.backgroundRoot, paddingBottom: bottomPadding || 0 }]}>
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
  textArea: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    ...Typography.body,
    minHeight: 100,
  },
  uploadDescription: {
    ...Typography.caption,
    marginBottom: Spacing.md,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  fileThumbnail: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
  },
  fileName: {
    ...Typography.caption,
    flex: 1,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  uploadButtonText: {
    ...Typography.body,
    fontWeight: '600',
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
