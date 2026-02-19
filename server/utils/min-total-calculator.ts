/**
 * 카테고리별 운임 계산 유틸리티
 * 
 * 계산 순서:
 * 1. 기본 단가 결정 (카테고리 기본값 → 택배사 override)
 * 2. 긴급이면 먼저 할증 적용
 * 3. 총액이 최저운임 미달이면 박스단가를 올림(ceil)
 * 4. 요청자 메시지 생성
 */

export interface PricingCalcParams {
  basePricePerBox: number;     // 기본 박스단가 (카테고리/택배사에서 조회)
  boxCount: number;            // 박스 수량
  minTotalAmount: number;      // 최저운임 총액 (예: 300000원)
  urgentSurchargeRate: number; // 긴급 할증율 (%)
  isUrgent: boolean;           // 긴급 여부
}

export interface PricingCalcResult {
  basePricePerBox: number;     // 원래 단가 (할증 전)
  baseAfterUrgent: number;     // 긴급 할증 적용 후 단가
  finalPricePerBox: number;    // 최종 박스당 단가
  rawTotal: number;            // 할증 적용 후 기본 총액
  finalTotal: number;          // 최종 총액
  minApplied: boolean;         // 최저운임 적용 여부
  urgentApplied: boolean;      // 긴급 할증 적용 여부
  message: string | null;      // 안내 메시지
}

/**
 * 긴급 할증 + 최저운임 복합 적용
 * 
 * @example
 * calcPerBoxPricing({
 *   basePricePerBox: 1200,
 *   boxCount: 200,
 *   minTotalAmount: 300000,
 *   urgentSurchargeRate: 15,
 *   isUrgent: true,
 * })
 */
export function calcPerBoxPricing(params: PricingCalcParams): PricingCalcResult {
  const { basePricePerBox, boxCount, minTotalAmount, urgentSurchargeRate, isUrgent } = params;

  // 박스 수량이 0이면 계산 불가
  if (boxCount <= 0) {
    return {
      basePricePerBox,
      baseAfterUrgent: basePricePerBox,
      finalPricePerBox: basePricePerBox,
      rawTotal: 0,
      finalTotal: 0,
      minApplied: false,
      urgentApplied: false,
      message: null,
    };
  }

  // 1) 긴급 할증 먼저 적용 (100원 단위 반올림)
  const urgentMultiplier = isUrgent ? (1 + urgentSurchargeRate / 100) : 1;
  const rawAfterUrgent = basePricePerBox * urgentMultiplier;
  const baseAfterUrgent = Math.round(rawAfterUrgent / 100) * 100; // 100원 단위 반올림
  const urgentApplied = isUrgent && urgentSurchargeRate > 0;

  // 2) 기본 총액
  const rawTotal = baseAfterUrgent * boxCount;

  // 3) 최저운임 미달 시 박스단가 자동 상승
  if (minTotalAmount > 0 && rawTotal < minTotalAmount) {
    const requiredPerBox = Math.ceil(minTotalAmount / boxCount / 100) * 100; // 100원 단위 올림
    const finalPricePerBox = Math.max(baseAfterUrgent, requiredPerBox);
    const finalTotal = finalPricePerBox * boxCount;

    // 메시지 생성
    let message: string;
    if (urgentApplied) {
      message = `긴급 할증(${urgentSurchargeRate}%) 및 최저운임(${minTotalAmount.toLocaleString()}원) 적용으로 박스단가가 ${basePricePerBox.toLocaleString()}원 → ${finalPricePerBox.toLocaleString()}원으로 조정됩니다.`;
    } else {
      message = `최저운임(${minTotalAmount.toLocaleString()}원) 적용으로 박스단가가 ${basePricePerBox.toLocaleString()}원 → ${finalPricePerBox.toLocaleString()}원으로 조정됩니다.`;
    }

    return {
      basePricePerBox,
      baseAfterUrgent,
      finalPricePerBox,
      rawTotal,
      finalTotal,
      minApplied: true,
      urgentApplied,
      message,
    };
  }

  // 최저운임 적용 안됨 (이미 충족 또는 미설정)
  let message: string | null = null;
  if (urgentApplied) {
    message = `긴급 할증(${urgentSurchargeRate}%) 적용으로 박스단가가 ${basePricePerBox.toLocaleString()}원 → ${baseAfterUrgent.toLocaleString()}원으로 조정됩니다.`;
  }

  return {
    basePricePerBox,
    baseAfterUrgent,
    finalPricePerBox: baseAfterUrgent,
    rawTotal,
    finalTotal: rawTotal,
    minApplied: false,
    urgentApplied,
    message,
  };
}

/**
 * 수수료 계산 (긴급 여부에 따라 다른 수수료율 적용)
 */
export function calcCommission(params: {
  finalTotal: number;
  normalCommissionRate: number;
  urgentCommissionRate: number;
  isUrgent: boolean;
}): { commissionRate: number; commissionAmount: number } {
  const { finalTotal, normalCommissionRate, urgentCommissionRate, isUrgent } = params;
  const commissionRate = isUrgent ? urgentCommissionRate : normalCommissionRate;
  const commissionAmount = Math.floor(finalTotal * commissionRate / 100);
  return { commissionRate, commissionAmount };
}

/**
 * 정책 조회 함수 타입
 * 택배사 override → 카테고리 기본값 순으로 fallback
 */
export interface CourierPolicyData {
  category: string;
  basePricePerBox: number;
  minTotalAmount: number;
  normalCommissionRate: number;
  urgentCommissionRate: number;
  urgentSurchargeRate: number;
}

/**
 * 레거시 호환: calcFinalPricePerBox (기존 코드와 호환)
 */
export interface MinTotalCalcParams {
  basePricePerBox: number;
  boxCount: number;
  minTotal: number;
}

export interface MinTotalCalcResult {
  finalPricePerBox: number;
  finalTotal: number;
  minApplied: boolean;
  message: string | null;
  basePricePerBox: number;
  minTotalApplied: number;
}

export function calcFinalPricePerBox(params: MinTotalCalcParams): MinTotalCalcResult {
  const result = calcPerBoxPricing({
    basePricePerBox: params.basePricePerBox,
    boxCount: params.boxCount,
    minTotalAmount: params.minTotal,
    urgentSurchargeRate: 0,
    isUrgent: false,
  });

  return {
    finalPricePerBox: result.finalPricePerBox,
    finalTotal: result.finalTotal,
    minApplied: result.minApplied,
    message: result.message,
    basePricePerBox: result.basePricePerBox,
    minTotalApplied: result.minApplied ? params.minTotal : 0,
  };
}

/**
 * 레거시 호환: calcWithUrgent (기존 코드와 호환)
 */
export function calcWithUrgent(params: MinTotalCalcParams & { urgentRate?: number }): MinTotalCalcResult & { urgentApplied: boolean } {
  const result = calcPerBoxPricing({
    basePricePerBox: params.basePricePerBox,
    boxCount: params.boxCount,
    minTotalAmount: params.minTotal,
    urgentSurchargeRate: params.urgentRate || 0,
    isUrgent: (params.urgentRate || 0) > 0,
  });

  return {
    finalPricePerBox: result.finalPricePerBox,
    finalTotal: result.finalTotal,
    minApplied: result.minApplied,
    message: result.message,
    basePricePerBox: result.basePricePerBox,
    minTotalApplied: result.minApplied ? params.minTotal : 0,
    urgentApplied: result.urgentApplied,
  };
}
