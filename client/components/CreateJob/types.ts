// 공통 타입 정의
export type CategoryTab = "택배사" | "기타택배" | "냉탑전용";

export interface CourierFormData {
  company: string;
  avgQuantity: string;
  unitPrice: string;
  requestDate: string;
  requestDateEnd: string;
  arrivalHour: string;
  arrivalMinute: string;
  managerContact: string;
  vehicleType: string;
  regionLarge: string;
  regionMedium: string;
  regionSmall: string;
  campAddress: string;
  campAddressDetail: string;
  deliveryGuide: string;
  isUrgent: boolean;
  agreeToSubmit: boolean;
}

export interface OtherCourierFormData {
  companyName: string;
  boxCount: string;
  unitPrice: string;
  isDayDelivery: boolean;
  isNightDelivery: boolean;
  isPerBox: boolean;
  isPerDrop: boolean;
  requestDate: string;
  requestDateEnd: string;
  arrivalHour: string;
  arrivalMinute: string;
  vehicleType: string;
  campAddress: string;
  campAddressDetail: string;
  contact: string;
  deliveryGuide: string;
  isUrgent: boolean;
  agreeToSubmit: boolean;
  regionLarge: string;
  regionMedium: string;
  regionSmall: string;
}

export interface ColdTruckFormData {
  company: string;
  hasTachometer: boolean;
  hasPartition: boolean;
  requestDate: string;
  requestDateEnd: string;
  arrivalHour: string;
  arrivalMinute: string;
  vehicleType: string;
  contact: string;
  loadingPoint: string;
  loadingPointDetail: string;
  waypoints: string[];
  freight: string;
  recommendedFee: string;
  deliveryGuide: string;
  isUrgent: boolean;
  agreeToSubmit: boolean;
}

export type OrderFormData = CourierFormData | OtherCourierFormData | ColdTruckFormData;

// Step Props 공통 인터페이스
export interface BaseStepProps {
  activeTab: CategoryTab;
  onNext: () => void;
  onBack: () => void;
  theme: any;
  isDark: boolean;
}

export interface Step1Props extends BaseStepProps {
  courierForm: CourierFormData;
  setCourierForm: React.Dispatch<React.SetStateAction<CourierFormData>>;
  otherCourierForm: OtherCourierFormData;
  setOtherCourierForm: React.Dispatch<React.SetStateAction<OtherCourierFormData>>;
  coldTruckForm: ColdTruckFormData;
  setColdTruckForm: React.Dispatch<React.SetStateAction<ColdTruckFormData>>;
  courierOptions: string[];
  coldTruckOptions: string[];
  onOpenSelectModal: (type: string, options: string[], callback: (value: string) => void) => void;
  onImportPreviousOrder: () => void;
}

export interface Step2Props extends BaseStepProps {
  courierForm: CourierFormData;
  setCourierForm: React.Dispatch<React.SetStateAction<CourierFormData>>;
  otherCourierForm: OtherCourierFormData;
  setOtherCourierForm: React.Dispatch<React.SetStateAction<OtherCourierFormData>>;
  coldTruckForm: ColdTruckFormData;
  setColdTruckForm: React.Dispatch<React.SetStateAction<ColdTruckFormData>>;
  couriers: any;
  categoryPricing: any;
  tieredPricing: any;
  getMinDeliveryFee: (courierName: string) => number;
  getCourierPolicy: (courierName: string) => any;
  calcFinalPricePerBox: (basePricePerBox: number, boxCount: number, minTotal: number, urgentSurchargeRate: number, isUrgent: boolean) => any;
  onOpenSelectModal: (type: string, options: string[], callback: (value: string) => void) => void;
}

export interface Step3Props extends BaseStepProps {
  courierForm: CourierFormData;
  setCourierForm: React.Dispatch<React.SetStateAction<CourierFormData>>;
  otherCourierForm: OtherCourierFormData;
  setOtherCourierForm: React.Dispatch<React.SetStateAction<OtherCourierFormData>>;
  coldTruckForm: ColdTruckFormData;
  setColdTruckForm: React.Dispatch<React.SetStateAction<ColdTruckFormData>>;
  onOpenDatePicker: (mode: 'start' | 'end', target: 'courier' | 'other' | 'cold') => void;
}

export interface Step4Props extends BaseStepProps {
  courierForm: CourierFormData;
  setCourierForm: React.Dispatch<React.SetStateAction<CourierFormData>>;
  otherCourierForm: OtherCourierFormData;
  setOtherCourierForm: React.Dispatch<React.SetStateAction<OtherCourierFormData>>;
  coldTruckForm: ColdTruckFormData;
  setColdTruckForm: React.Dispatch<React.SetStateAction<ColdTruckFormData>>;
  vehicleOptions: string[];
  onOpenSelectModal: (type: string, options: string[], callback: (value: string) => void) => void;
}

export interface Step5Props extends BaseStepProps {
  courierForm: CourierFormData;
  setCourierForm: React.Dispatch<React.SetStateAction<CourierFormData>>;
  otherCourierForm: OtherCourierFormData;
  setOtherCourierForm: React.Dispatch<React.SetStateAction<OtherCourierFormData>>;
  coldTruckForm: ColdTruckFormData;
  setColdTruckForm: React.Dispatch<React.SetStateAction<ColdTruckFormData>>;
  regionData: any;
  onOpenSelectModal: (type: string, options: string[], callback: (value: string) => void) => void;
}

export interface Step6Props extends BaseStepProps {
  courierForm: CourierFormData;
  setCourierForm: React.Dispatch<React.SetStateAction<CourierFormData>>;
  otherCourierForm: OtherCourierFormData;
  setOtherCourierForm: React.Dispatch<React.SetStateAction<OtherCourierFormData>>;
  coldTruckForm: ColdTruckFormData;
  setColdTruckForm: React.Dispatch<React.SetStateAction<ColdTruckFormData>>;
  imageUri: string | null;
  setImageUri: React.Dispatch<React.SetStateAction<string | null>>;
}

export interface Step7Props extends BaseStepProps {
  courierForm: CourierFormData;
  otherCourierForm: OtherCourierFormData;
  coldTruckForm: ColdTruckFormData;
  setCourierForm: React.Dispatch<React.SetStateAction<CourierFormData>>;
  setOtherCourierForm: React.Dispatch<React.SetStateAction<OtherCourierFormData>>;
  setColdTruckForm: React.Dispatch<React.SetStateAction<ColdTruckFormData>>;
  imageUri: string | null;
  onSubmit: () => void;
  isSubmitting: boolean;
}

// 유틸리티 함수
export const formatDateInput = (value: string): string => {
  const numbers = value.replace(/[^\d]/g, '');
  if (numbers.length <= 4) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 4)}-${numbers.slice(4)}`;
  return `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6, 8)}`;
};

export const getTodayDate = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatPhoneNumber = (value: string): string => {
  const numbers = value.replace(/[^\d]/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
};

// 단계별 필수 필드 검증
export const validateStep1 = (activeTab: CategoryTab, courierForm: CourierFormData, otherCourierForm: OtherCourierFormData, coldTruckForm: ColdTruckFormData): boolean => {
  if (activeTab === "택배사") {
    return !!courierForm.company;
  } else if (activeTab === "기타택배") {
    return !!otherCourierForm.companyName;
  } else {
    return !!coldTruckForm.company;
  }
};

export const validateStep2 = (activeTab: CategoryTab, courierForm: CourierFormData, otherCourierForm: OtherCourierFormData, coldTruckForm: ColdTruckFormData): boolean => {
  if (activeTab === "택배사") {
    return !!courierForm.avgQuantity && !!courierForm.unitPrice;
  } else if (activeTab === "기타택배") {
    return !!otherCourierForm.boxCount && !!otherCourierForm.unitPrice;
  } else {
    return !!coldTruckForm.freight;
  }
};

export const validateStep3 = (activeTab: CategoryTab, courierForm: CourierFormData, otherCourierForm: OtherCourierFormData, coldTruckForm: ColdTruckFormData): boolean => {
  if (activeTab === "택배사") {
    return !!courierForm.requestDate && !!courierForm.requestDateEnd;
  } else if (activeTab === "기타택배") {
    return !!otherCourierForm.requestDate && !!otherCourierForm.requestDateEnd;
  } else {
    return !!coldTruckForm.requestDate && !!coldTruckForm.requestDateEnd;
  }
};

export const validateStep4 = (activeTab: CategoryTab, courierForm: CourierFormData, otherCourierForm: OtherCourierFormData, coldTruckForm: ColdTruckFormData): boolean => {
  if (activeTab === "택배사") {
    return !!courierForm.vehicleType && !!courierForm.managerContact;
  } else if (activeTab === "기타택배") {
    return !!otherCourierForm.vehicleType && !!otherCourierForm.contact;
  } else {
    return !!coldTruckForm.vehicleType && !!coldTruckForm.contact;
  }
};

export const validateStep5 = (activeTab: CategoryTab, courierForm: CourierFormData, otherCourierForm: OtherCourierFormData, coldTruckForm: ColdTruckFormData): boolean => {
  if (activeTab === "택배사") {
    return !!courierForm.regionLarge && !!courierForm.regionMedium && !!courierForm.campAddress;
  } else if (activeTab === "기타택배") {
    return !!otherCourierForm.regionLarge && !!otherCourierForm.regionMedium && !!otherCourierForm.campAddress;
  } else {
    return !!coldTruckForm.loadingPoint;
  }
};

export const validateStep6 = (activeTab: CategoryTab, courierForm: CourierFormData, otherCourierForm: OtherCourierFormData, coldTruckForm: ColdTruckFormData): boolean => {
  // 배송 가이드와 긴급 여부는 선택사항이므로 항상 true
  return true;
};

export const validateStep7 = (activeTab: CategoryTab, courierForm: CourierFormData, otherCourierForm: OtherCourierFormData, coldTruckForm: ColdTruckFormData): boolean => {
  if (activeTab === "택배사") {
    return courierForm.agreeToSubmit;
  } else if (activeTab === "기타택배") {
    return otherCourierForm.agreeToSubmit;
  } else {
    return coldTruckForm.agreeToSubmit;
  }
};
