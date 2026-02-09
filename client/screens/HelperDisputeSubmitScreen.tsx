import React, { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, Alert, Platform, ActivityIndicator, TextInput, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Icon } from "@/components/Icon";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import { apiRequest, getApiUrl, getAuthToken } from "@/lib/query-client";
import DateTimePicker from "@react-native-community/datetimepicker";

type ProfileStackParamList = {
  HelperDisputeSubmit: undefined;
};

type HelperDisputeSubmitScreenProps = NativeStackScreenProps<ProfileStackParamList, 'HelperDisputeSubmit'>;

const DISPUTE_TYPES = [
  { value: "count_mismatch", label: "수량 오류" },
  { value: "lost", label: "분실" },
  { value: "wrong_delivery", label: "오배송" },
  { value: "amount_error", label: "금액 오류" },
  { value: "delivery_issue", label: "배송 문제" },
  { value: "other", label: "기타" },
];

interface Courier {
  id: number;
  courierName: string;
  category: string;
}

export default function HelperDisputeSubmitScreen({ navigation }: HelperDisputeSubmitScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [courierName, setCourierName] = useState("");
  const [workDate, setWorkDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [disputeType, setDisputeType] = useState("");
  const [description, setDescription] = useState("");
  const [evidencePhoto, setEvidencePhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: couriers = [] } = useQuery<Courier[]>({
    queryKey: ['/api/meta/couriers'],
  });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setUploading(true);
      try {
        const formData = new FormData();
        const uri = result.assets[0].uri;
        const filename = uri.split('/').pop() || 'photo.jpg';
        
        formData.append('file', {
          uri,
          name: filename,
          type: 'image/jpeg',
        } as any);

        const token = await getAuthToken();
        const response = await fetch(`${getApiUrl()}/api/upload/evidence`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          setEvidencePhoto(data.url);
        } else {
          Alert.alert("오류", "사진 업로드에 실패했습니다.");
        }
      } catch (err) {
        console.error("Upload error:", err);
        Alert.alert("오류", "사진 업로드 중 오류가 발생했습니다.");
      } finally {
        setUploading(false);
      }
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/helper/disputes", {
        courierName: courierName || null,
        workDate: workDate.toISOString().split('T')[0],
        invoiceNumber: invoiceNumber || null,
        disputeType,
        description,
        evidencePhotoUrl: evidencePhoto || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/helper/disputes"] });
      if (Platform.OS === "web") {
        alert("이의제기가 접수되었습니다.");
      } else {
        Alert.alert("접수 완료", "이의제기가 접수되었습니다. 관리자 검토 후 안내드리겠습니다.");
      }
      navigation.goBack();
    },
    onError: (err: Error) => {
      const message = err.message || "접수에 실패했습니다.";
      if (Platform.OS === "web") {
        alert(message);
      } else {
        Alert.alert("오류", message);
      }
    },
  });

  const handleSubmit = () => {
    if (!courierName) {
      Alert.alert("알림", "운송사를 선택해주세요.");
      return;
    }
    if (!disputeType) {
      Alert.alert("알림", "유형을 선택해주세요.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("알림", "상세 내용을 입력해주세요.");
      return;
    }
    submitMutation.mutate();
  };

  const formatDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const uniqueCouriers = [...new Set(couriers.map(c => c.courierName))];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{ paddingTop: headerHeight + insets.top + Spacing.lg, paddingBottom: insets.bottom + 120 }}
    >
      <View style={styles.content}>
        <Card variant="glass" padding="md" style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>이의제기 접수</ThemedText>
          <ThemedText style={[styles.description, { color: theme.tabIconDefault }]}>
            정산 오류, 수량 차이, 배송 문제 등에 대해 이의를 제기할 수 있습니다.
          </ThemedText>
        </Card>

        <Card variant="glass" padding="md" style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>운송사 선택 *</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.courierScroll}>
            <View style={styles.courierRow}>
              {uniqueCouriers.map((name) => (
                <Pressable
                  key={name}
                  style={[
                    styles.courierChip,
                    { borderColor: courierName === name ? BrandColors.helper : theme.backgroundTertiary },
                    courierName === name && { backgroundColor: BrandColors.helperLight },
                  ]}
                  onPress={() => setCourierName(name)}
                >
                  <ThemedText
                    style={[
                      styles.courierText,
                      courierName === name && { color: BrandColors.helper, fontWeight: "600" },
                    ]}
                  >
                    {name}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </Card>

        <Card variant="glass" padding="md" style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>근무일 *</ThemedText>
          <Pressable
            style={[styles.dateButton, { borderColor: theme.backgroundTertiary }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Icon name="calendar-outline" size={20} color={theme.text} />
            <ThemedText style={[styles.dateText, { color: theme.text }]}>
              {formatDate(workDate)}
            </ThemedText>
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={workDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  setWorkDate(selectedDate);
                }
              }}
              maximumDate={new Date()}
            />
          )}
        </Card>

        <Card variant="glass" padding="md" style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>송장번호 (선택)</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundTertiary, backgroundColor: theme.backgroundDefault }]}
            value={invoiceNumber}
            onChangeText={setInvoiceNumber}
            placeholder="송장번호를 입력하세요"
            placeholderTextColor={theme.tabIconDefault}
          />
        </Card>

        <Card variant="glass" padding="md" style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>유형 선택 *</ThemedText>
          <View style={styles.typeGrid}>
            {DISPUTE_TYPES.map((type) => (
              <Pressable
                key={type.value}
                style={[
                  styles.typeButton,
                  { borderColor: disputeType === type.value ? BrandColors.helper : theme.backgroundTertiary },
                  disputeType === type.value && { backgroundColor: BrandColors.helperLight },
                ]}
                onPress={() => setDisputeType(type.value)}
              >
                <ThemedText
                  style={[
                    styles.typeText,
                    disputeType === type.value && { color: BrandColors.helper, fontWeight: "600" },
                  ]}
                >
                  {type.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card variant="glass" padding="md" style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>상세 내용 *</ThemedText>
          <TextInput
            style={[styles.textArea, { color: theme.text, borderColor: theme.backgroundTertiary, backgroundColor: theme.backgroundDefault }]}
            value={description}
            onChangeText={setDescription}
            placeholder="이의제기 사유를 상세히 작성해주세요"
            placeholderTextColor={theme.tabIconDefault}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </Card>

        <Card variant="glass" padding="md" style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>증빙사진 (선택)</ThemedText>
          <ThemedText style={[styles.description, { color: theme.tabIconDefault, marginBottom: Spacing.md }]}>
            관련 증빙 자료가 있으면 첨부해주세요.
          </ThemedText>
          
          {evidencePhoto ? (
            <View style={styles.photoPreviewContainer}>
              <Image source={{ uri: evidencePhoto }} style={styles.photoPreview} />
              <Pressable
                style={styles.removePhotoButton}
                onPress={() => setEvidencePhoto(null)}
              >
                <Icon name="close-circle" size={24} color={BrandColors.error} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.uploadButton, { borderColor: theme.backgroundTertiary }]}
              onPress={pickImage}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={BrandColors.helper} />
              ) : (
                <>
                  <Icon name="camera-outline" size={32} color={theme.tabIconDefault} />
                  <ThemedText style={[styles.uploadText, { color: theme.tabIconDefault }]}>
                    사진 첨부
                  </ThemedText>
                </>
              )}
            </Pressable>
          )}
        </Card>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable
          style={[
            styles.submitButton,
            { backgroundColor: BrandColors.helper },
            submitMutation.isPending && { opacity: 0.7 },
          ]}
          onPress={handleSubmit}
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ThemedText style={styles.submitButtonText}>이의제기 접수</ThemedText>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  section: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  courierScroll: {
    marginHorizontal: -Spacing.xs,
  },
  courierRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  courierChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  courierText: {
    fontSize: 13,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  dateText: {
    fontSize: 15,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  typeButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  typeText: {
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
    minHeight: 120,
  },
  uploadButton: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  uploadText: {
    fontSize: 14,
  },
  photoPreviewContainer: {
    position: "relative",
  },
  photoPreview: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.md,
    resizeMode: "cover",
  },
  removePhotoButton: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: "white",
    borderRadius: 12,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  submitButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
