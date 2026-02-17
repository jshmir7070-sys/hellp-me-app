import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Platform,
  Modal,
  FlatList,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { 
  regionData, 
  courierCompanies, 
  vehicleTypes, 
  coldTruckCompanies,
} from "@/constants/regionData";

import { CategoryTab, CourierFormData, OtherCourierFormData, ColdTruckFormData, ContractSettings, ContractSubmitData } from "./types";
import Step1BasicInfo from "./Step1BasicInfo";
import Step2Quantity from "./Step2Quantity";
import Step4Vehicle from "./Step4Vehicle";
import Step5Location from "./Step5Location";
import Step6AdditionalInfo from "./Step6AdditionalInfo";
import Step7Confirmation from "./Step7Confirmation";
import Step7Contract from "./Step7Contract";
import Step8Payment from "./Step8Payment";

interface CreateJobContainerProps {
  navigation: NativeStackNavigationProp<any>;
}

const DRAFT_STORAGE_KEY = "order_draft_v2";

export default function CreateJobContainer({ navigation }: CreateJobContainerProps) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const { isDesktop, isTablet } = useResponsive();
  // 웹 사이드바 모드일 때는 하단 탭바가 없으므로 bottomPadding 불필요
  // 탭바가 position: absolute이므로 tabBarHeight 전체를 사용해야 콘텐츠가 탭바 아래로 가려지지 않음
  const showSidebar = (isDesktop || isTablet) && Platform.OS === 'web';
  const effectiveBottomPadding = showSidebar ? 0 : tabBarHeight;
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [activeTab, setActiveTab] = useState<CategoryTab>("택배사");
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [selectModalType, setSelectModalType] = useState<string>("");
  const [selectModalOptions, setSelectModalOptions] = useState<string[]>([]);
  const [selectModalCallback, setSelectModalCallback] = useState<((value: string) => void) | null>(null);

  const [courierForm, setCourierForm] = useState<CourierFormData>({
    company: "",
    avgQuantity: "",
    unitPrice: "",
    requestDate: "",
    requestDateEnd: "",
    managerContact: "",
    vehicleType: "",
    regionLarge: "",
    regionMedium: "",
    regionSmall: "",
    campAddress: "",
    campAddressDetail: "",
    deliveryGuide: "",
    isUrgent: false,
    agreeToSubmit: false,
  });

  const [otherCourierForm, setOtherCourierForm] = useState<OtherCourierFormData>({
    companyName: "",
    boxCount: "",
    unitPrice: "",
    isDayDelivery: false,
    isNightDelivery: false,
    isPerBox: false,
    isPerDrop: false,
    requestDate: "",
    requestDateEnd: "",
    vehicleType: "",
    campAddress: "",
    campAddressDetail: "",
    contact: "",
    deliveryGuide: "",
    isUrgent: false,
    agreeToSubmit: false,
    regionLarge: "",
    regionMedium: "",
    regionSmall: "",
  });

  const [coldTruckForm, setColdTruckForm] = useState<ColdTruckFormData>({
    company: "",
    hasTachometer: false,
    hasPartition: false,
    requestDate: "",
    requestDateEnd: "",
    vehicleType: "",
    contact: "",
    loadingPoint: "",
    loadingPointDetail: "",
    waypoints: [""],
    freight: "",
    recommendedFee: "200000",
    deliveryGuide: "",
    isUrgent: false,
    agreeToSubmit: false,
  });

  // 작성 중 여부 (1단계 이후 진행 시 true)
  const hasUnsavedProgress = useRef(false);

  // 화면 포커스 시 임시 저장 체크 (탭 전환 후 돌아왔을 때도 동작)
  useFocusEffect(
    useCallback(() => {
      const checkDraft = async () => {
        // 이미 작성 중이면 다시 물어보지 않음
        if (hasUnsavedProgress.current && currentStep > 1) return;

        try {
          const draft = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);
          if (draft) {
            const parsed = JSON.parse(draft);
            if (parsed.currentStep && parsed.currentStep > 1) {
              Alert.alert(
                "임시 저장된 오더",
                "작성 중이던 오더가 있습니다. 이어서 작성하시겠습니까?",
                [
                  {
                    text: "처음부터",
                    style: "destructive",
                    onPress: async () => {
                      await clearDraft();
                      resetForm();
                    },
                  },
                  {
                    text: "이어서 작성",
                    onPress: () => {
                      loadDraft();
                    },
                  },
                ]
              );
            }
          }
        } catch (error) {
          console.error("Failed to check draft:", error);
        }
      };
      checkDraft();
    }, [])
  );

  // 임시 저장 자동 저장
  useEffect(() => {
    if (currentStep > 1) {
      hasUnsavedProgress.current = true;
      saveDraft();
    } else {
      hasUnsavedProgress.current = false;
    }
  }, [currentStep, courierForm, otherCourierForm, coldTruckForm, activeTab]);

  // 다른 탭으로 이동 시 저장/초기화 확인 다이얼로그
  // 탭 전환 시: 자동으로 임시 저장하고, 돌아왔을 때 이어서 할지 물어봄
  // (탭 전환은 preventDefault가 불가하므로 blur 시 자동 저장)
  useEffect(() => {
    const parentNav = navigation.getParent(); // CreateJobStack의 부모 = TabNavigator
    if (!parentNav) return;

    const unsubscribe = parentNav.addListener('blur', () => {
      if (hasUnsavedProgress.current) {
        saveDraft();
      }
    });

    return () => unsubscribe();
  }, [navigation]);

  // 스택 내에서 뒤로가기(back 버튼, 제스처) 시 확인 다이얼로그
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!hasUnsavedProgress.current) return;

      e.preventDefault();

      Alert.alert(
        "오더 작성 중",
        "작성 중인 오더를 어떻게 하시겠습니까?",
        [
          {
            text: "취소",
            style: "cancel",
          },
          {
            text: "초기화",
            style: "destructive",
            onPress: async () => {
              await clearDraft();
              resetForm();
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: "저장",
            onPress: async () => {
              await saveDraft();
              hasUnsavedProgress.current = false;
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    });

    return () => unsubscribe();
  }, [navigation]);

  const loadDraft = async () => {
    try {
      const draft = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.currentStep) setCurrentStep(parsed.currentStep);
        if (parsed.activeTab) setActiveTab(parsed.activeTab);
        if (parsed.courierForm) setCourierForm(parsed.courierForm);
        if (parsed.otherCourierForm) setOtherCourierForm(parsed.otherCourierForm);
        if (parsed.coldTruckForm) setColdTruckForm(parsed.coldTruckForm);
      }
    } catch (error) {
      console.error("Failed to load draft:", error);
    }
  };

  const saveDraft = async () => {
    try {
      const draft = {
        currentStep,
        activeTab,
        courierForm,
        otherCourierForm,
        coldTruckForm,
        savedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (error) {
      console.error("Failed to save draft:", error);
    }
  };

  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear draft:", error);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setActiveTab("택배사");
    setCourierForm({
      company: "",
      avgQuantity: "",
      unitPrice: "",
      requestDate: "",
      requestDateEnd: "",
      managerContact: "",
      vehicleType: "",
      regionLarge: "",
      regionMedium: "",
      regionSmall: "",
      campAddress: "",
      campAddressDetail: "",
      deliveryGuide: "",
      isUrgent: false,
      agreeToSubmit: false,
    });
    setOtherCourierForm({
      companyName: "",
      boxCount: "",
      unitPrice: "",
      isDayDelivery: false,
      isNightDelivery: false,
      isPerBox: false,
      isPerDrop: false,
      requestDate: "",
      requestDateEnd: "",
      vehicleType: "",
      campAddress: "",
      campAddressDetail: "",
      contact: "",
      deliveryGuide: "",
      isUrgent: false,
      agreeToSubmit: false,
      regionLarge: "",
      regionMedium: "",
      regionSmall: "",
    });
    setColdTruckForm({
      company: "",
      hasTachometer: false,
      hasPartition: false,
      requestDate: "",
      requestDateEnd: "",
      vehicleType: "",
      contact: "",
      loadingPoint: "",
      loadingPointDetail: "",
      waypoints: [""],
      freight: "",
      recommendedFee: "200000",
      deliveryGuide: "",
      isUrgent: false,
      agreeToSubmit: false,
    });
    hasUnsavedProgress.current = false;
  };

  // API 쿼리
  const { data: couriers } = useQuery({
    queryKey: ['/api/meta/couriers'],
  });

  const { data: categoryPricing } = useQuery({
    queryKey: ['/api/meta/category-pricing'],
  });

  const { data: tieredPricing } = useQuery({
    queryKey: ['/api/meta/couriers', courierForm.company, 'tiered-pricing'],
    enabled: !!courierForm.company,
  });

  const { data: contractSettingsData } = useQuery<ContractSettings>({
    queryKey: ['/api/meta/contract-settings'],
  });

  const contractSettings: ContractSettings = contractSettingsData ?? {
    depositRate: 10,
  };

  const getMinDeliveryFee = (courierName: string): number => {
    if (couriers && Array.isArray(couriers)) {
      const courier = couriers.find((c: any) => c.label === courierName);
      return courier?.minDeliveryFee || 1000;
    }
    return 1000;
  };

  const getCourierPolicy = (courierName: string) => {
    if (couriers && Array.isArray(couriers)) {
      const courier = couriers.find((c: any) => c.label === courierName);
      return {
        basePricePerBox: courier?.basePricePerBox || 0,
        minTotal: courier?.minTotal || 0,
        urgentSurchargeRate: courier?.urgentSurchargeRate || 0,
        urgentCommissionRate: courier?.urgentCommissionRate || 0,
        commissionRate: courier?.commissionRate || 0,
      };
    }
    return { basePricePerBox: 0, minTotal: 0, urgentSurchargeRate: 0, urgentCommissionRate: 0, commissionRate: 0 };
  };

  const calcFinalPricePerBox = (basePricePerBox: number, boxCount: number, minTotal: number, urgentSurchargeRate: number, isUrgent: boolean) => {
    if (boxCount <= 0) {
      return { finalPricePerBox: basePricePerBox, minApplied: false, urgentApplied: false, message: null };
    }
    
    const urgentApplied = isUrgent && urgentSurchargeRate > 0;
    const baseAfterUrgent = urgentApplied 
      ? Math.ceil(basePricePerBox * (1 + urgentSurchargeRate / 100))
      : basePricePerBox;
    
    const rawTotal = baseAfterUrgent * boxCount;
    
    if (minTotal > 0 && rawTotal < minTotal) {
      const requiredPerBox = Math.ceil(minTotal / boxCount);
      const finalPricePerBox = Math.max(baseAfterUrgent, requiredPerBox);
      
      let message: string;
      if (urgentApplied) {
        message = `긴급 할증(${urgentSurchargeRate}%) 및 최저운임(${minTotal.toLocaleString()}원) 적용`;
      } else {
        message = `최저운임(${minTotal.toLocaleString()}원) 적용`;
      }
      
      return { finalPricePerBox, minApplied: true, urgentApplied, message };
    }
    
    let message: string | null = null;
    if (urgentApplied) {
      message = `긴급 할증(${urgentSurchargeRate}%) 적용`;
    }
    
    return { finalPricePerBox: baseAfterUrgent, minApplied: false, urgentApplied, message };
  };

  const courierOptions = (couriers && Array.isArray(couriers) && couriers.length > 0)
    ? couriers.filter((c: any) => c.category === 'parcel').map((c: any) => c.label)
    : courierCompanies;

  const coldTruckOptions = (couriers && Array.isArray(couriers) && couriers.length > 0)
    ? couriers.filter((c: any) => c.category === 'cold').map((c: any) => c.label)
    : coldTruckCompanies;

  const createJobMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const res = await apiRequest('POST', '/api/orders', orderData);
      return res.json();
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      if (data?.id) setOrderId(data.id.toString());
      // Step7에서 오더 제출 후 Step8(결제)로 이동
      setCurrentStep(currentStep + 1);
    },
    onError: (error: any) => {
      Alert.alert("오류", error.message || "오더 등록에 실패했습니다");
    },
  });

  const handleSubmit = async (contractData: ContractSubmitData) => {
    let orderData: any = {};

    if (activeTab === "택배사") {
      orderData = {
        companyName: courierForm.company,
        carrierCode: courierForm.company,
        courierCompany: courierForm.company,
        courierCategory: "parcel",
        deliveryArea: [courierForm.regionLarge, courierForm.regionMedium, courierForm.regionSmall].filter(Boolean).join(' \\ '),
        campAddress: courierForm.campAddress,
        campAddressDetail: courierForm.campAddressDetail,
        averageQuantity: courierForm.avgQuantity,
        pricePerUnit: parseInt(courierForm.unitPrice),
        scheduledDate: courierForm.requestDate,
        scheduledDateEnd: courierForm.requestDateEnd,
        vehicleType: courierForm.vehicleType,
        contactPhone: courierForm.managerContact,
        deliveryGuide: courierForm.deliveryGuide,
        isUrgent: courierForm.isUrgent,
      };
    } else if (activeTab === "기타택배") {
      orderData = {
        companyName: otherCourierForm.companyName,
        courierCategory: "other",
        deliveryArea: [otherCourierForm.regionLarge, otherCourierForm.regionMedium, otherCourierForm.regionSmall].filter(Boolean).join(' \\ '),
        campAddress: otherCourierForm.campAddress,
        campAddressDetail: otherCourierForm.campAddressDetail,
        averageQuantity: otherCourierForm.boxCount,
        pricePerUnit: parseInt(otherCourierForm.unitPrice),
        scheduledDate: otherCourierForm.requestDate,
        scheduledDateEnd: otherCourierForm.requestDateEnd,
        vehicleType: otherCourierForm.vehicleType,
        contactPhone: otherCourierForm.contact,
        deliveryGuide: otherCourierForm.deliveryGuide,
        isUrgent: otherCourierForm.isUrgent,
      };
    } else {
      orderData = {
        companyName: coldTruckForm.company,
        courierCategory: "cold",
        campAddress: coldTruckForm.loadingPoint,
        campAddressDetail: coldTruckForm.loadingPointDetail,
        scheduledDate: coldTruckForm.requestDate,
        scheduledDateEnd: coldTruckForm.requestDateEnd,
        vehicleType: coldTruckForm.vehicleType,
        contactPhone: coldTruckForm.contact,
        freight: parseInt(coldTruckForm.freight),
        recommendedFee: parseInt(coldTruckForm.recommendedFee),
        waypoints: coldTruckForm.waypoints.filter(w => w),
        hasTachometer: coldTruckForm.hasTachometer,
        hasPartition: coldTruckForm.hasPartition,
        deliveryGuide: coldTruckForm.deliveryGuide,
        isUrgent: coldTruckForm.isUrgent,
      };
    }

    // 날짜 순서 보정: 시작일이 종료일보다 뒤면 교환
    if (orderData.scheduledDate && orderData.scheduledDateEnd && orderData.scheduledDate > orderData.scheduledDateEnd) {
      [orderData.scheduledDate, orderData.scheduledDateEnd] = [orderData.scheduledDateEnd, orderData.scheduledDate];
    }

    // 계약서 데이터 추가 (잔금입금예정일, 서명, 인증전화번호)
    orderData.balancePaymentDueDate = contractData.balancePaymentDueDate;
    orderData.signatureName = contractData.signatureName;
    orderData.verificationPhone = contractData.verificationPhone;

    createJobMutation.mutate(orderData);
  };

  const openSelectModal = (type: string, options: string[], callback: (value: string) => void) => {
    setSelectModalType(type);
    setSelectModalOptions(options);
    setSelectModalCallback(() => callback);
    setShowSelectModal(true);
  };

  const handleSelectModalConfirm = (value: string) => {
    if (selectModalCallback) {
      selectModalCallback(value);
    }
    setShowSelectModal(false);
  };

  const [orderId, setOrderId] = useState<string>("");
  const totalSteps = activeTab === "냉탑전용" ? 7 : 8;
  const displayStep = Math.min(currentStep, totalSteps);

  const renderStepIndicator = () => (
    <View style={[styles.stepIndicator, { paddingTop: headerHeight + Spacing.sm, backgroundColor: isDark ? '#1a365d' : '#EBF8FF', borderBottomColor: isDark ? '#2c5282' : '#BEE3F8' }]}>
      <View style={styles.stepDots}>
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
          <View
            key={step}
            style={[
              styles.stepDot,
              {
                backgroundColor: step <= displayStep ? BrandColors.requester : Colors.light.backgroundSecondary,
              },
            ]}
          />
        ))}
      </View>
      <ThemedText style={[styles.stepText, { color: BrandColors.requester }]}>
        {displayStep}/{totalSteps} 단계
      </ThemedText>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {(["택배사", "기타택배", "냉탑전용"] as CategoryTab[]).map((tab) => (
        <Pressable
          key={tab}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === tab ? BrandColors.requester : theme.backgroundDefault,
              borderColor: activeTab === tab ? BrandColors.requester : '#E0E0E0',
            },
          ]}
          onPress={() => {
            setActiveTab(tab);
            setCurrentStep(1);
          }}
        >
          <ThemedText
            style={[
              styles.tabText,
              { color: activeTab === tab ? '#FFFFFF' : theme.text },
            ]}
          >
            {tab}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );

  const handleComplete = async () => {
    await clearDraft();
    hasUnsavedProgress.current = false;
    resetForm();
    Alert.alert("완료", "오더 등록이 최종 완료되었습니다!", [
      { text: "확인", onPress: () => navigation.goBack() }
    ]);
  };

  const renderCurrentStep = () => {
    const baseProps = {
      activeTab,
      theme,
      isDark,
      bottomPadding: effectiveBottomPadding,
      onNext: () => setCurrentStep(currentStep + 1),
      onBack: () => setCurrentStep(currentStep - 1),
    };

    switch (currentStep) {
      case 1: // 기본 정보
        return (
          <Step1BasicInfo
            {...baseProps}
            courierForm={courierForm}
            setCourierForm={setCourierForm}
            otherCourierForm={otherCourierForm}
            setOtherCourierForm={setOtherCourierForm}
            coldTruckForm={coldTruckForm}
            setColdTruckForm={setColdTruckForm}
            courierOptions={courierOptions}
            coldTruckOptions={coldTruckOptions}
            onOpenSelectModal={openSelectModal}
          />
        );
      case 2: // 수량·단가 + 요청일
        return (
          <Step2Quantity
            {...baseProps}
            courierForm={courierForm}
            setCourierForm={setCourierForm}
            otherCourierForm={otherCourierForm}
            setOtherCourierForm={setOtherCourierForm}
            coldTruckForm={coldTruckForm}
            setColdTruckForm={setColdTruckForm}
            couriers={couriers}
            categoryPricing={categoryPricing}
            tieredPricing={tieredPricing}
            getMinDeliveryFee={getMinDeliveryFee}
            getCourierPolicy={getCourierPolicy}
            calcFinalPricePerBox={calcFinalPricePerBox}
            onOpenSelectModal={openSelectModal}
          />
        );
      case 3: // 차종·담당자 연락처
        return (
          <Step4Vehicle
            {...baseProps}
            courierForm={courierForm}
            setCourierForm={setCourierForm}
            otherCourierForm={otherCourierForm}
            setOtherCourierForm={setOtherCourierForm}
            coldTruckForm={coldTruckForm}
            setColdTruckForm={setColdTruckForm}
            vehicleOptions={vehicleTypes}
            onOpenSelectModal={openSelectModal}
          />
        );
      case 4: // 배송지역·캠프/터미널 주소
        return (
          <Step5Location
            {...baseProps}
            courierForm={courierForm}
            setCourierForm={setCourierForm}
            otherCourierForm={otherCourierForm}
            setOtherCourierForm={setOtherCourierForm}
            coldTruckForm={coldTruckForm}
            setColdTruckForm={setColdTruckForm}
            regionData={regionData}
            onOpenSelectModal={openSelectModal}
          />
        );
      case 5: // 배송가이드·파일 업로드 (선택)
        return (
          <Step6AdditionalInfo
            {...baseProps}
            courierForm={courierForm}
            setCourierForm={setCourierForm}
            otherCourierForm={otherCourierForm}
            setOtherCourierForm={setOtherCourierForm}
            coldTruckForm={coldTruckForm}
            setColdTruckForm={setColdTruckForm}
          />
        );
      case 6: // 오더확인·계약금확인·동의
        return (
          <Step7Confirmation
            {...baseProps}
            courierForm={courierForm}
            otherCourierForm={otherCourierForm}
            coldTruckForm={coldTruckForm}
            setCourierForm={setCourierForm}
            setOtherCourierForm={setOtherCourierForm}
            setColdTruckForm={setColdTruckForm}
            onSubmit={handleSubmit}
            isSubmitting={createJobMutation.isPending}
          />
        );
      case 7: // 계약서 작성·서명·본인인증
        return (
          <Step7Contract
            {...baseProps}
            courierForm={courierForm}
            otherCourierForm={otherCourierForm}
            coldTruckForm={coldTruckForm}
            setCourierForm={setCourierForm}
            setOtherCourierForm={setOtherCourierForm}
            setColdTruckForm={setColdTruckForm}
            onSubmit={handleSubmit}
            isSubmitting={createJobMutation.isPending}
            contractSettings={contractSettings}
          />
        );
      case 8: // 계약금 입금·최종 완료
        return (
          <Step8Payment
            activeTab={activeTab}
            courierForm={courierForm}
            otherCourierForm={otherCourierForm}
            coldTruckForm={coldTruckForm}
            orderId={orderId}
            onComplete={handleComplete}
            onBack={() => setCurrentStep(currentStep - 1)}
            theme={theme}
            isDark={isDark}
            bottomPadding={effectiveBottomPadding}
            contractSettings={contractSettings}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
    >
      {renderStepIndicator()}
      <View style={{ paddingTop: Spacing.md, paddingHorizontal: Spacing.lg }}>
        {renderTabs()}
      </View>
      <View style={{ flex: 1, marginBottom: effectiveBottomPadding }}>
        {renderCurrentStep()}
      </View>

      {/* Select Modal */}
      <Modal visible={showSelectModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                {selectModalType}
              </ThemedText>
              <Pressable onPress={() => setShowSelectModal(false)}>
                <Icon name="close-outline" size={24} color={theme.text} />
              </Pressable>
            </View>
            <FlatList
              data={selectModalOptions}
              keyExtractor={(item, index) => `${item}-${index}`}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.modalOption, { borderBottomColor: Colors.light.backgroundSecondary }]}
                  onPress={() => handleSelectModalConfirm(item)}
                >
                  <ThemedText style={[styles.modalOptionText, { color: theme.text }]}>
                    {item}
                  </ThemedText>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepIndicator: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepDots: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepText: {
    ...Typography.caption,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabText: {
    ...Typography.button,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSecondary,
  },
  modalTitle: {
    ...Typography.heading3,
  },
  modalOption: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalOptionText: {
    ...Typography.body,
  },
});
