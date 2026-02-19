import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Platform,
  Modal,
  FlatList,
  Pressable,
  Alert,
  Keyboard,
  BackHandler,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSystemNotification } from "@/components/notifications/SystemNotificationProvider";

import { useTheme } from "@/hooks/useTheme";
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

import { CategoryTab, CourierFormData, OtherCourierFormData, ColdTruckFormData } from "./types";
import Step1BasicInfo from "./Step1BasicInfo";
import Step2Quantity from "./Step2Quantity";
import Step3Schedule from "./Step3Schedule";
import Step4Vehicle from "./Step4Vehicle";
import Step5Location from "./Step5Location";
import Step6AdditionalInfo from "./Step6AdditionalInfo";
import Step7Confirmation from "./Step7Confirmation";

interface CreateJobContainerProps {
  navigation: NativeStackNavigationProp<any>;
}

const DRAFT_STORAGE_KEY = "order_draft_v2";

export default function CreateJobContainer({ navigation }: CreateJobContainerProps) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();
  const rootNavigation = useNavigation<any>();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const [currentStep, setCurrentStep] = useState(1);
  const [activeTab, setActiveTab] = useState<CategoryTab>("택배사");
  const [imageUri, setImageUri] = useState<string | null>(null);
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
    arrivalHour: "",
    arrivalMinute: "",
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
    arrivalHour: "",
    arrivalMinute: "",
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
    arrivalHour: "",
    arrivalMinute: "",
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

  // 임시 저장 로드
  useEffect(() => {
    loadDraft();
  }, []);

  // 임시 저장 자동 저장
  useEffect(() => {
    if (currentStep > 1) {
      saveDraft();
    }
  }, [currentStep, courierForm, otherCourierForm, coldTruckForm, activeTab]);

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

  // 폼 입력 여부 감지 (step 2 이상이거나 필수 필드에 값이 있으면 dirty)
  const hasUnsavedChanges = useMemo(() => {
    if (currentStep > 1) return true;
    // step 1에서도 회사 선택 등 입력이 있으면 dirty
    if (activeTab === "택배사" && courierForm.company) return true;
    if (activeTab === "기타택배" && otherCourierForm.companyName) return true;
    if (activeTab === "냉탑전용" && coldTruckForm.company) return true;
    return false;
  }, [currentStep, activeTab, courierForm.company, otherCourierForm.companyName, coldTruckForm.company]);

  // 폼 초기화 함수 (나가기 시 호출)
  const resetAllForms = useCallback(() => {
    setCurrentStep(1);
    setActiveTab("택배사");
    setCourierForm({
      company: "", avgQuantity: "", unitPrice: "", requestDate: "", requestDateEnd: "",
      arrivalHour: "", arrivalMinute: "",
      managerContact: "", vehicleType: "", regionLarge: "", regionMedium: "", regionSmall: "",
      campAddress: "", campAddressDetail: "", deliveryGuide: "", isUrgent: false, agreeToSubmit: false,
    });
    setOtherCourierForm({
      companyName: "", boxCount: "", unitPrice: "", isDayDelivery: false, isNightDelivery: false,
      isPerBox: false, isPerDrop: false, requestDate: "", requestDateEnd: "",
      arrivalHour: "", arrivalMinute: "",
      vehicleType: "", campAddress: "", campAddressDetail: "", contact: "", deliveryGuide: "",
      isUrgent: false, agreeToSubmit: false, regionLarge: "", regionMedium: "", regionSmall: "",
    });
    setColdTruckForm({
      company: "", hasTachometer: false, hasPartition: false, requestDate: "", requestDateEnd: "",
      arrivalHour: "", arrivalMinute: "",
      vehicleType: "", contact: "", loadingPoint: "", loadingPointDetail: "", waypoints: [""],
      freight: "", recommendedFee: "200000", deliveryGuide: "", isUrgent: false, agreeToSubmit: false,
    });
    setImageUri(null);
  }, []);

  // 시스템 알림
  const { sysAlert } = useSystemNotification();
  const hasUnsavedRef = useRef(hasUnsavedChanges);
  hasUnsavedRef.current = hasUnsavedChanges;
  const isFocused = useIsFocused();

  // 안드로이드 물리 뒤로가기 — 이 탭이 포커스된 경우에만 작동
  useEffect(() => {
    if (!isFocused) return; // ← 다른 탭에서는 BackHandler 등록 안 함

    const onBackPress = () => {
      if (!hasUnsavedRef.current) return false; // 변경사항 없으면 기본 동작

      sysAlert('오더 작성 중', '작성 중인 내용이 있습니다.\n나가시면 임시저장된 내용에서 이어서 작성할 수 있습니다.', [
        { text: '계속 작성', style: 'cancel' },
        {
          text: '나가기',
          style: 'destructive',
          onPress: () => {
            resetAllForms();
            navigation.goBack();
          },
        },
      ]);
      return true; // 기본 뒤로가기 방지
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isFocused, navigation, sysAlert, resetAllForms]);

  // 헤더 뒤로가기, iOS 스와이프 — beforeRemove 이벤트
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!hasUnsavedRef.current) return; // 변경사항 없으면 통과

      e.preventDefault();
      sysAlert('오더 작성 중', '작성 중인 내용이 있습니다.\n나가시면 임시저장된 내용에서 이어서 작성할 수 있습니다.', [
        { text: '계속 작성', style: 'cancel' },
        {
          text: '나가기',
          style: 'destructive',
          onPress: () => {
            resetAllForms();
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
    return unsubscribe;
  }, [navigation, sysAlert, resetAllForms]);

  // 하단 탭 전환 시에도 경고 (탭은 beforeRemove가 발동하지 않으므로 별도 처리)
  useEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;

    const unsubscribe = parent.addListener('tabPress' as any, (e: any) => {
      if (!isFocused) return;       // ← 이 탭이 아닐 때는 무시
      if (!hasUnsavedRef.current) return; // 변경사항 없으면 통과

      e.preventDefault();
      sysAlert('오더 작성 중', '작성 중인 내용이 있습니다.\n나가시면 임시저장된 내용에서 이어서 작성할 수 있습니다.', [
        { text: '계속 작성', style: 'cancel' },
        {
          text: '나가기',
          style: 'destructive',
          onPress: () => {
            resetAllForms();
            // 탭 전환 허용
            const targetRoute = (e as any).target;
            if (targetRoute) {
              const targetRouteName = targetRoute.split('-')[0];
              parent.navigate(targetRouteName);
            }
          },
        },
      ]);
    });

    return unsubscribe;
  }, [navigation, isFocused, sysAlert, resetAllForms]);

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
      await clearDraft();
      resetAllForms(); // 폼 초기화 → hasUnsavedChanges = false → 나가기 경고 방지
      if (data && data.id) {
        // 계약서 작성 화면으로 이동
        rootNavigation.navigate('CreateContract', { orderId: data.id });
      } else {
        Alert.alert("성공", "오더가 등록되었습니다", [
          { text: "확인", onPress: () => navigation.goBack() }
        ]);
      }
    },
    onError: (error: any) => {
      Alert.alert("오류", error.message || "오더 등록에 실패했습니다");
    },
  });

  const handleSubmit = async () => {
    let orderData: any = {};

    if (activeTab === "택배사") {
      orderData = {
        companyName: courierForm.company,
        carrierCode: courierForm.company,
        courierCompany: courierForm.company,
        courierCategory: "parcel",
        deliveryArea: `${courierForm.regionLarge} > ${courierForm.regionMedium}`,
        campAddress: courierForm.campAddress,
        campAddressDetail: courierForm.campAddressDetail,
        averageQuantity: courierForm.avgQuantity,
        pricePerUnit: parseInt(courierForm.unitPrice),
        scheduledDate: courierForm.requestDate,
        scheduledDateEnd: courierForm.requestDateEnd,
        arrivalTime: courierForm.arrivalHour && courierForm.arrivalMinute
          ? `${courierForm.arrivalHour.padStart(2, '0')}:${courierForm.arrivalMinute.padStart(2, '0')}`
          : null,
        vehicleType: courierForm.vehicleType,
        contactPhone: courierForm.managerContact,
        deliveryGuide: courierForm.deliveryGuide,
        isUrgent: courierForm.isUrgent,
        imageUri: imageUri || undefined,
      };
    } else if (activeTab === "기타택배") {
      orderData = {
        companyName: otherCourierForm.companyName,
        courierCategory: "other",
        pricingType: otherCourierForm.isPerDrop ? "per_drop" : "per_box",
        deliveryArea: `${otherCourierForm.regionLarge} > ${otherCourierForm.regionMedium}`,
        campAddress: otherCourierForm.campAddress,
        campAddressDetail: otherCourierForm.campAddressDetail,
        averageQuantity: otherCourierForm.boxCount,
        pricePerUnit: parseInt(otherCourierForm.unitPrice),
        scheduledDate: otherCourierForm.requestDate,
        scheduledDateEnd: otherCourierForm.requestDateEnd,
        arrivalTime: otherCourierForm.arrivalHour && otherCourierForm.arrivalMinute
          ? `${otherCourierForm.arrivalHour.padStart(2, '0')}:${otherCourierForm.arrivalMinute.padStart(2, '0')}`
          : null,
        vehicleType: otherCourierForm.vehicleType,
        contactPhone: otherCourierForm.contact,
        deliveryGuide: otherCourierForm.deliveryGuide,
        isUrgent: otherCourierForm.isUrgent,
        imageUri: imageUri || undefined,
      };
    } else {
      orderData = {
        companyName: coldTruckForm.company,
        courierCategory: "cold",
        campAddress: coldTruckForm.loadingPoint,
        campAddressDetail: coldTruckForm.loadingPointDetail,
        deliveryArea: coldTruckForm.waypoints.filter(w => w).join(' → ') || coldTruckForm.loadingPoint || '냉탑전용',
        averageQuantity: "1",
        pricePerUnit: parseInt(coldTruckForm.freight) || 0,
        scheduledDate: coldTruckForm.requestDate,
        scheduledDateEnd: coldTruckForm.requestDateEnd,
        arrivalTime: coldTruckForm.arrivalHour && coldTruckForm.arrivalMinute
          ? `${coldTruckForm.arrivalHour.padStart(2, '0')}:${coldTruckForm.arrivalMinute.padStart(2, '0')}`
          : null,
        vehicleType: coldTruckForm.vehicleType,
        contactPhone: coldTruckForm.contact,
        freight: parseInt(coldTruckForm.freight),
        recommendedFee: parseInt(coldTruckForm.recommendedFee),
        waypoints: coldTruckForm.waypoints.filter(w => w),
        hasTachometer: coldTruckForm.hasTachometer,
        hasPartition: coldTruckForm.hasPartition,
        deliveryGuide: coldTruckForm.deliveryGuide,
        isUrgent: coldTruckForm.isUrgent,
        imageUri: imageUri || undefined,
      };
    }

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

  const TOTAL_WORKFLOW_STEPS = 10;
  const stepLabels: Record<number, string> = {
    1: '업체 선택',
    2: '물량/단가',
    3: '일정',
    4: '차종/연락처',
    5: '배송지역',
    6: '추가정보',
    7: '최종확인',
    8: '계약서',
    9: '서명/인증',
    10: '결제확정',
  };

  const renderStepIndicator = () => (
    <View style={[styles.stepIndicator, { backgroundColor: isDark ? '#1a365d' : '#EBF8FF', borderBottomColor: isDark ? '#2c5282' : '#BEE3F8' }]}>
      <View style={styles.stepTopRow}>
        <View style={styles.stepDots}>
          {Array.from({ length: TOTAL_WORKFLOW_STEPS }, (_, i) => i + 1).map((step) => (
            <View
              key={step}
              style={[
                styles.stepDot,
                {
                  backgroundColor: step <= currentStep ? BrandColors.requester : Colors.light.backgroundSecondary,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  opacity: step <= currentStep ? 1 : 0.6,
                },
              ]}
            />
          ))}
        </View>
        <ThemedText style={[styles.stepText, { color: BrandColors.requester }]}>
          {currentStep}/{TOTAL_WORKFLOW_STEPS}
        </ThemedText>
      </View>
      <View style={styles.stepLabelRow}>
        <ThemedText style={[styles.stepLabelText, { color: BrandColors.requester }]}>
          {stepLabels[currentStep] || ''}
        </ThemedText>
        <View style={[styles.progressBar, { backgroundColor: isDark ? '#2d3748' : '#E0E0E0' }]}>
          <View style={[styles.progressFill, { width: `${(currentStep / TOTAL_WORKFLOW_STEPS) * 100}%`, backgroundColor: BrandColors.requester }]} />
        </View>
      </View>
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

  const renderCurrentStep = () => {
    const baseProps = {
      activeTab,
      theme,
      isDark,
      onNext: () => setCurrentStep(currentStep + 1),
      onBack: () => setCurrentStep(currentStep - 1),
    };

    switch (currentStep) {
      case 1:
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
      case 2:
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
      case 3:
        return (
          <Step3Schedule
            {...baseProps}
            courierForm={courierForm}
            setCourierForm={setCourierForm}
            otherCourierForm={otherCourierForm}
            setOtherCourierForm={setOtherCourierForm}
            coldTruckForm={coldTruckForm}
            setColdTruckForm={setColdTruckForm}
            onOpenDatePicker={() => {}}
          />
        );
      case 4:
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
      case 5:
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
      case 6:
        return (
          <Step6AdditionalInfo
            {...baseProps}
            courierForm={courierForm}
            setCourierForm={setCourierForm}
            otherCourierForm={otherCourierForm}
            setOtherCourierForm={setOtherCourierForm}
            coldTruckForm={coldTruckForm}
            setColdTruckForm={setColdTruckForm}
            imageUri={imageUri}
            setImageUri={setImageUri}
          />
        );
      case 7:
        return (
          <Step7Confirmation
            {...baseProps}
            courierForm={courierForm}
            otherCourierForm={otherCourierForm}
            coldTruckForm={coldTruckForm}
            setCourierForm={setCourierForm}
            setOtherCourierForm={setOtherCourierForm}
            setColdTruckForm={setColdTruckForm}
            imageUri={imageUri}
            onSubmit={handleSubmit}
            isSubmitting={createJobMutation.isPending}
          />
        );
      default:
        return null;
    }
  };

  const bottomOffset = keyboardHeight > 0 ? keyboardHeight - tabBarHeight : 0;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundRoot, marginBottom: tabBarHeight, paddingBottom: bottomOffset > 0 ? bottomOffset : 0 }]}
    >
      {renderStepIndicator()}
      <View style={{ paddingTop: Spacing.md, paddingHorizontal: Spacing.lg }}>
        {renderTabs()}
      </View>
      {renderCurrentStep()}

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
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
  stepTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  stepDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
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
  stepLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepLabelText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 55,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
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
