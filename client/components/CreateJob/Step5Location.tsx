import React from "react";
import { View, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { AddressInput } from "@/components/AddressInput";
import { Step5Props } from "./types";

export default function Step5Location({
  activeTab,
  courierForm,
  setCourierForm,
  otherCourierForm,
  setOtherCourierForm,
  coldTruckForm,
  setColdTruckForm,
  regionData,
  onOpenSelectModal,
  onNext,
  onBack,
  theme,
  isDark,
  bottomPadding,
}: Step5Props) {
  
  const isValid = 
    (activeTab === "택배사" && !!courierForm.regionLarge && !!courierForm.regionMedium && !!courierForm.campAddress) ||
    (activeTab === "기타택배" && !!otherCourierForm.regionLarge && !!otherCourierForm.regionMedium && !!otherCourierForm.campAddress) ||
    (activeTab === "냉탑전용" && !!coldTruckForm.loadingPoint);

  const handleNext = () => {
    if (isValid) onNext();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText style={[styles.stepTitle, { color: theme.text }]}>
            4단계: 배송지역 · 캠프/터미널 주소
          </ThemedText>
          <ThemedText style={[styles.stepDescription, { color: Colors.light.tabIconDefault }]}>
            {activeTab === "냉탑전용" ? "상차지 정보를 입력해주세요" : "배송 지역을 선택해주세요"}
          </ThemedText>
        </View>

        {(activeTab === "택배사" || activeTab === "기타택배") && (
          <>
            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                지역 선택 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
              </ThemedText>
              
              <Pressable
                style={[
                  styles.selectButton,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                  },
                ]}
                onPress={() => {
                  const regionLargeOptions = Object.keys(regionData);
                  onOpenSelectModal("대분류", regionLargeOptions, (value) => {
                    if (activeTab === "택배사") {
                      setCourierForm({ ...courierForm, regionLarge: value, regionMedium: "", regionSmall: "" });
                    } else {
                      setOtherCourierForm({ ...otherCourierForm, regionLarge: value, regionMedium: "", regionSmall: "" });
                    }
                  });
                }}
              >
                <ThemedText style={[
                  styles.selectButtonText,
                  { color: (activeTab === "택배사" ? courierForm.regionLarge : otherCourierForm.regionLarge) ? theme.text : Colors.light.tabIconDefault }
                ]}>
                  {(activeTab === "택배사" ? courierForm.regionLarge : otherCourierForm.regionLarge) || "대분류 선택"}
                </ThemedText>
                <Icon name="chevron-down-outline" size={20} color={theme.text} />
              </Pressable>
            </View>

            {(activeTab === "택배사" ? courierForm.regionLarge : otherCourierForm.regionLarge) && (
              <View style={styles.section}>
                <Pressable
                  style={[
                    styles.selectButton,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                    },
                  ]}
                  onPress={() => {
                    const currentRegionLarge = activeTab === "택배사" ? courierForm.regionLarge : otherCourierForm.regionLarge;
                    const regionMediumOptions = currentRegionLarge ? Object.keys(regionData[currentRegionLarge] || {}) : [];
                    onOpenSelectModal("중분류", regionMediumOptions, (value) => {
                      if (activeTab === "택배사") {
                        setCourierForm({ ...courierForm, regionMedium: value, regionSmall: "" });
                      } else {
                        setOtherCourierForm({ ...otherCourierForm, regionMedium: value, regionSmall: "" });
                      }
                    });
                  }}
                >
                  <ThemedText style={[
                    styles.selectButtonText,
                    { color: (activeTab === "택배사" ? courierForm.regionMedium : otherCourierForm.regionMedium) ? theme.text : Colors.light.tabIconDefault }
                  ]}>
                    {(activeTab === "택배사" ? courierForm.regionMedium : otherCourierForm.regionMedium) || "중분류 선택"}
                  </ThemedText>
                  <Icon name="chevron-down-outline" size={20} color={theme.text} />
                </Pressable>
              </View>
            )}

            {(activeTab === "택배사" ? courierForm.regionMedium : otherCourierForm.regionMedium) && (
              <View style={styles.section}>
                <ThemedText style={[styles.label, { color: theme.text }]}>
                  소분류 (법정동)
                </ThemedText>
                <Pressable
                  style={[
                    styles.selectButton,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                    },
                  ]}
                  onPress={() => {
                    const currentRegionLarge = activeTab === "택배사" ? courierForm.regionLarge : otherCourierForm.regionLarge;
                    const currentRegionMedium = activeTab === "택배사" ? courierForm.regionMedium : otherCourierForm.regionMedium;
                    const regionSmallOptions = (currentRegionLarge && currentRegionMedium)
                      ? (regionData[currentRegionLarge]?.[currentRegionMedium] || [])
                      : [];
                    onOpenSelectModal("소분류(법정동)", regionSmallOptions, (value) => {
                      if (activeTab === "택배사") {
                        setCourierForm({ ...courierForm, regionSmall: value });
                      } else {
                        setOtherCourierForm({ ...otherCourierForm, regionSmall: value });
                      }
                    });
                  }}
                >
                  <ThemedText style={[
                    styles.selectButtonText,
                    { color: (activeTab === "택배사" ? courierForm.regionSmall : otherCourierForm.regionSmall) ? theme.text : Colors.light.tabIconDefault }
                  ]}>
                    {(activeTab === "택배사" ? courierForm.regionSmall : otherCourierForm.regionSmall) || "법정동 선택"}
                  </ThemedText>
                  <Icon name="chevron-down-outline" size={20} color={theme.text} />
                </Pressable>
              </View>
            )}

            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                캠프 주소 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
              </ThemedText>
              {activeTab === "택배사" ? (
                <AddressInput
                  value={courierForm.campAddress}
                  onChange={(address) => setCourierForm({ ...courierForm, campAddress: address })}
                />
              ) : (
                <AddressInput
                  value={otherCourierForm.campAddress}
                  onChange={(address) => setOtherCourierForm({ ...otherCourierForm, campAddress: address })}
                />
              )}
            </View>

            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                캠프 주소 상세
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                  },
                ]}
                placeholder="상세 주소 입력"
                placeholderTextColor={Colors.light.tabIconDefault}
                value={activeTab === "택배사" ? courierForm.campAddressDetail : otherCourierForm.campAddressDetail}
                onChangeText={(value) => {
                  if (activeTab === "택배사") {
                    setCourierForm({ ...courierForm, campAddressDetail: value });
                  } else {
                    setOtherCourierForm({ ...otherCourierForm, campAddressDetail: value });
                  }
                }}
              />
            </View>
          </>
        )}

        {activeTab === "냉탑전용" && (
          <>
            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                상차지 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
              </ThemedText>
              <AddressInput
                value={coldTruckForm.loadingPoint}
                onChange={(address) => setColdTruckForm({ ...coldTruckForm, loadingPoint: address })}
              />
            </View>

            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                상차지 상세
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                  },
                ]}
                placeholder="상세 주소 입력"
                placeholderTextColor={Colors.light.tabIconDefault}
                value={coldTruckForm.loadingPointDetail}
                onChangeText={(value) => setColdTruckForm({ ...coldTruckForm, loadingPointDetail: value })}
              />
            </View>

            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                경유지
              </ThemedText>
              {coldTruckForm.waypoints.map((waypoint, index) => (
                <View key={index} style={styles.waypointRow}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.waypointInput,
                      {
                        backgroundColor: theme.backgroundDefault,
                        color: theme.text,
                        borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                      },
                    ]}
                    placeholder={`경유지 ${index + 1}`}
                    placeholderTextColor={Colors.light.tabIconDefault}
                    value={waypoint}
                    onChangeText={(value) => {
                      const newWaypoints = [...coldTruckForm.waypoints];
                      newWaypoints[index] = value;
                      setColdTruckForm({ ...coldTruckForm, waypoints: newWaypoints });
                    }}
                  />
                  {index > 0 && (
                    <Pressable
                      onPress={() => {
                        const newWaypoints = coldTruckForm.waypoints.filter((_, i) => i !== index);
                        setColdTruckForm({ ...coldTruckForm, waypoints: newWaypoints });
                      }}
                    >
                      <Icon name="close-circle-outline" size={24} color={BrandColors.error} />
                    </Pressable>
                  )}
                </View>
              ))}
              
              <Pressable
                style={[styles.addButton, { borderColor: BrandColors.requester }]}
                onPress={() => {
                  setColdTruckForm({ ...coldTruckForm, waypoints: [...coldTruckForm.waypoints, ""] });
                }}
              >
                <Icon name="add-outline" size={20} color={BrandColors.requester} />
                <ThemedText style={[styles.addButtonText, { color: BrandColors.requester }]}>
                  경유지 추가
                </ThemedText>
              </Pressable>
            </View>
          </>
        )}
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
            { backgroundColor: BrandColors.requester, opacity: isValid ? 1 : 0.6 },
          ]}
          onPress={handleNext}
          disabled={!isValid}
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
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  selectButtonText: {
    ...Typography.body,
  },
  input: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    ...Typography.body,
  },
  waypointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  waypointInput: {
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  addButtonText: {
    ...Typography.body,
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
