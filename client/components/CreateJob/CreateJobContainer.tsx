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
import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";
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
import { getToken } from "@/utils/secure-token-storage";
import { uploadImageWithRetry } from "@/lib/image-upload";
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
  const tabBarHeight = useSafeTabBarHeight();
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

  // 이전 오더 불러오기
  const [showImportModal, setShowImportModal] = useState(false);

  const { data: previousOrders = [] } = useQuery<any[]>({
    queryKey: ['/api/requester/orders'],
  });

  const recentOrders = useMemo(() => {
    return (previousOrders || []).slice(0, 10);
  }, [previousOrders]);

  // deliveryArea → regionLarge/regionMedium/regionSmall 파싱 (다양한 형식 대응)
  const parseDeliveryArea = useCallback((deliveryArea: string): { regionLarge: string; regionMedium: string; regionSmall: string } => {
    const empty = { regionLarge: '', regionMedium: '', regionSmall: '' };
    if (!deliveryArea) return empty;

    // regionData에서 소분류 찾기 헬퍼
    const findSmall = (large: string, medium: string, remaining: string): string => {
      if (!remaining) return '';
      const smallOptions = regionData[large]?.[medium] || [];
      return smallOptions.find((s: string) => s === remaining) || remaining;
    };

    // 1) " > " 구분자가 있는 경우 (앱에서 생성한 정상 포맷: "대분류 > 중분류 > 소분류")
    if (deliveryArea.includes(' > ')) {
      const parts = deliveryArea.split(' > ');
      return {
        regionLarge: parts[0] || '',
        regionMedium: parts[1] || '',
        regionSmall: parts[2] || '',
      };
    }

    // 2) 구분자 없는 경우 (시드 데이터 등) — regionData 키와 매칭 시도
    const regionLargeKeys = Object.keys(regionData);

    // 2-a) 정확히 대분류 키로 시작하는지 확인 (예: "서울특별시 강남구 역삼동")
    for (const largeKey of regionLargeKeys) {
      if (deliveryArea.startsWith(largeKey)) {
        const rest = deliveryArea.slice(largeKey.length).trim();
        if (!rest) return { regionLarge: largeKey, regionMedium: '', regionSmall: '' };
        // rest에서 중분류 매칭
        const mediumKeys = Object.keys(regionData[largeKey] || {});
        for (const mk of mediumKeys) {
          if (rest.startsWith(mk)) {
            const smallPart = rest.slice(mk.length).trim();
            return { regionLarge: largeKey, regionMedium: mk, regionSmall: findSmall(largeKey, mk, smallPart) };
          }
        }
        // 정확 매칭 실패 시 rest 전체를 중분류로
        return { regionLarge: largeKey, regionMedium: rest, regionSmall: '' };
      }
    }

    // 2-b) 축약형 매칭 (예: "서울시 강남구 역삼동" → "서울특별시" + "강남구" + "역삼동")
    const shortNameMap: Record<string, string> = {
      '서울시': '서울특별시',
      '서울': '서울특별시',
      '경기': '경기도',
      '인천시': '인천광역시',
      '인천': '인천광역시',
      '부산시': '부산광역시',
      '부산': '부산광역시',
      '대구시': '대구광역시',
      '대구': '대구광역시',
      '광주시': '광주광역시',
      '광주': '광주광역시',
      '대전시': '대전광역시',
      '대전': '대전광역시',
      '울산시': '울산광역시',
      '울산': '울산광역시',
      '세종시': '세종특별자치시',
      '세종': '세종특별자치시',
      '강원도': '강원특별자치도',
      '강원': '강원특별자치도',
      '전북': '전북특별자치도',
      '전라북도': '전북특별자치도',
      '제주도': '제주특별자치도',
      '제주': '제주특별자치도',
    };

    for (const [shortName, fullName] of Object.entries(shortNameMap)) {
      if (deliveryArea.startsWith(shortName + ' ') || deliveryArea === shortName) {
        const rest = deliveryArea.slice(shortName.length).trim();
        if (!rest) return { regionLarge: fullName, regionMedium: '', regionSmall: '' };

        const mediumKeys = Object.keys(regionData[fullName] || {});
        // 중분류 키로 시작하는지 확인 (예: rest="강남구 역삼동" → "강남구" 매칭, 나머지="역삼동")
        for (const mk of mediumKeys) {
          if (rest.startsWith(mk)) {
            const smallPart = rest.slice(mk.length).trim();
            return { regionLarge: fullName, regionMedium: mk, regionSmall: findSmall(fullName, mk, smallPart) };
          }
        }
        // 정확 매칭 안 되면 rest에서 중분류 부분 포함 매칭
        const partialMatch = mediumKeys.find(k => rest.includes(k));
        if (partialMatch) {
          const idx = rest.indexOf(partialMatch);
          const smallPart = rest.slice(idx + partialMatch.length).trim();
          return { regionLarge: fullName, regionMedium: partialMatch, regionSmall: findSmall(fullName, partialMatch, smallPart) };
        }
        return { regionLarge: fullName, regionMedium: rest, regionSmall: '' };
      }
    }

    // 3) 어떤 매칭도 안 되면 전체를 대분류에 넣음
    return { regionLarge: deliveryArea, regionMedium: '', regionSmall: '' };
  }, []);

  const handleImportOrder = useCallback((order: any) => {
    const { regionLarge, regionMedium, regionSmall } = parseDeliveryArea(order.deliveryArea || '');
    const category = order.courierCategory || 'parcel';

    if (category === 'parcel') {
      setActiveTab('택배사');
      setCourierForm({
        company: order.companyName || '',
        avgQuantity: String(order.averageQuantity || ''),
        unitPrice: String(order.pricePerUnit || ''),
        vehicleType: order.vehicleType || '',
        managerContact: order.contactPhone || '',
        campAddress: order.campAddress || '',
        campAddressDetail: order.campAddressDetail || '',
        deliveryGuide: order.deliveryGuide || '',
        regionLarge,
        regionMedium,
        regionSmall,
        requestDate: '',
        requestDateEnd: '',
        arrivalHour: '',
        arrivalMinute: '',
        isUrgent: false,
        agreeToSubmit: false,
      });
    } else if (category === 'other') {
      setActiveTab('기타택배');
      setOtherCourierForm({
        companyName: order.companyName || '',
        boxCount: String(order.averageQuantity || ''),
        unitPrice: String(order.pricePerUnit || ''),
        vehicleType: order.vehicleType || '',
        contact: order.contactPhone || '',
        campAddress: order.campAddress || '',
        campAddressDetail: order.campAddressDetail || '',
        deliveryGuide: order.deliveryGuide || '',
        isPerBox: order.pricingType === 'per_box',
        isPerDrop: order.pricingType === 'per_drop',
        isDayDelivery: false,
        isNightDelivery: false,
        regionLarge,
        regionMedium,
        regionSmall,
        requestDate: '',
        requestDateEnd: '',
        arrivalHour: '',
        arrivalMinute: '',
        isUrgent: false,
        agreeToSubmit: false,
      });
    } else {
      // cold
      setActiveTab('냉탑전용');
      setColdTruckForm({
        company: order.companyName || '',
        vehicleType: order.vehicleType || '',
        contact: order.contactPhone || '',
        loadingPoint: order.campAddress || '',
        loadingPointDetail: order.campAddressDetail || '',
        freight: String(order.freight || ''),
        recommendedFee: String(order.recommendedFee || '200000'),
        waypoints: order.waypoints?.length ? order.waypoints : [''],
        hasTachometer: order.hasTachometer || false,
        hasPartition: order.hasPartition || false,
        deliveryGuide: order.deliveryGuide || '',
        requestDate: '',
        requestDateEnd: '',
        arrivalHour: '',
        arrivalMinute: '',
        isUrgent: false,
        agreeToSubmit: false,
      });
    }

    setCurrentStep(1);
    setShowImportModal(false);
  }, []);

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'parcel': return '택배사';
      case 'other': return '기타택배';
      case 'cold': return '냉탑전용';
      default: return '택배사';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'parcel': return '#3B82F6';
      case 'other': return '#F59E0B';
      case 'cold': return '#06B6D4';
      default: return '#3B82F6';
    }
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
      // 배송지 이미지가 로컬 URI면 먼저 서버에 업로드
      if (orderData.imageUri && (orderData.imageUri.startsWith('file://') || orderData.imageUri.startsWith('content://') || orderData.imageUri.startsWith('ph://'))) {
        try {
          const token = await getToken();
          const result = await uploadImageWithRetry(
            orderData.imageUri,
            '/api/upload/order-image',
            'file',
            {},
            3,
            token
          );
          if (result.success && result.url) {
            orderData.imageUri = result.url; // 서버 URL로 교체
          } else {
            console.error('배송지 이미지 업로드 실패:', result.error);
          }
        } catch (uploadErr) {
          console.error('배송지 이미지 업로드 실패:', uploadErr);
          // 업로드 실패해도 오더 등록은 계속 진행
        }
      }
      const res = await apiRequest('POST', '/api/orders', orderData);
      return res.json();
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/requester/orders'] });
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
        deliveryArea: [courierForm.regionLarge, courierForm.regionMedium, courierForm.regionSmall].filter(Boolean).join(' > '),
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
        deliveryArea: [otherCourierForm.regionLarge, otherCourierForm.regionMedium, otherCourierForm.regionSmall].filter(Boolean).join(' > '),
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

    // 오더 등록 전 재확인
    if (Platform.OS === 'web') {
      if (confirm('오더를 등록하시겠습니까?')) {
        createJobMutation.mutate(orderData);
      }
    } else {
      Alert.alert(
        '오더 등록 확인',
        '입력하신 내용으로 오더를 등록하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '등록하기', onPress: () => createJobMutation.mutate(orderData) },
        ]
      );
    }
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
            onImportPreviousOrder={() => setShowImportModal(true)}
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

      {/* 이전 오더 불러오기 Modal */}
      <Modal visible={showImportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <Icon name="time-outline" size={20} color={BrandColors.requester} />
                <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                  이전 이력 불러오기
                </ThemedText>
              </View>
              <Pressable onPress={() => setShowImportModal(false)}>
                <Icon name="close-outline" size={24} color={theme.text} />
              </Pressable>
            </View>
            {recentOrders.length === 0 ? (
              <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                <Icon name="document-outline" size={48} color={Colors.light.tabIconDefault} />
                <ThemedText style={{ color: Colors.light.tabIconDefault, marginTop: Spacing.md, fontSize: 14 }}>
                  이전 오더 이력이 없습니다
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={recentOrders}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => {
                  const catLabel = getCategoryLabel(item.courierCategory);
                  const catColor = getCategoryColor(item.courierCategory);
                  const createdDate = item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                    : '';
                  return (
                    <Pressable
                      style={({ pressed }) => [
                        styles.importOrderItem,
                        { borderBottomColor: isDark ? '#374151' : '#F3F4F6', opacity: pressed ? 0.7 : 1 },
                      ]}
                      onPress={() => handleImportOrder(item)}
                    >
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                          <ThemedText style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>
                            {item.companyName || '이름 없음'}
                          </ThemedText>
                          <View style={{
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                            backgroundColor: catColor + '20',
                          }}>
                            <ThemedText style={{ fontSize: 11, fontWeight: '600', color: catColor }}>
                              {catLabel}
                            </ThemedText>
                          </View>
                        </View>
                        <ThemedText style={{ fontSize: 13, color: Colors.light.tabIconDefault }} numberOfLines={1}>
                          {item.deliveryArea || item.campAddress || '지역 미설정'}
                        </ThemedText>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <ThemedText style={{ fontSize: 12, color: Colors.light.tabIconDefault }}>
                          {createdDate}
                        </ThemedText>
                        <Icon name="chevron-forward-outline" size={16} color={Colors.light.tabIconDefault} />
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}
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
  importOrderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
});
