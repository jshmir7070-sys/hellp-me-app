/**
 * 정산 계산 통합 모듈 (Single Source of Truth)
 * 
 * 모든 정산 금액은 이 함수를 통해서만 계산됩니다.
 * 헬퍼 앱, 요청자 앱, 관리자 패널 모두 동일한 결과를 반환합니다.
 */

export interface ClosingData {
  deliveredCount: number;
  returnedCount: number;
  etcCount: number;
  unitPrice: number;
  etcPricePerUnit: number;
  extraCosts: Array<{ code?: string; name?: string; amount: number; memo?: string }>;
}

export interface SettlementResult {
  // 수량
  deliveredCount: number;
  returnedCount: number;
  etcCount: number;
  totalBillableCount: number;
  
  // 금액 계산
  deliveryReturnAmount: number;  // (배송+반품) × 단가
  etcAmount: number;              // 기타 × 기타단가
  extraCostsTotal: number;        // 기타비용 합계
  supplyAmount: number;           // 공급가 (VAT 제외)
  vatAmount: number;              // VAT (10%)
  totalAmount: number;            // 총액 (공급가 + VAT)
  
  // 결제 정보
  depositAmount: number;          // 계약금 (총액의 20%)
  balanceAmount: number;          // 잔금 (총액 - 계약금)
}

export interface HelperPayoutResult extends SettlementResult {
  platformFeeRate: number;        // 플랫폼 수수료율 (%)
  platformFee: number;            // 플랫폼 수수료
  damageDeduction: number;        // 화물사고 차감
  driverPayout: number;           // 헬퍼 지급액
}

/**
 * 마감 데이터 기반 정산 금액 계산
 * 
 * 공식:
 * - 공급가 = (배송 + 반품) × 단가 + 기타 × 기타단가 + 기타비용
 * - VAT = 공급가 × 10%
 * - 총액 = 공급가 + VAT
 * - 계약금 = 총액 × 20%
 * - 잔금 = 총액 - 계약금
 */
export function calculateSettlement(data: ClosingData): SettlementResult {
  const deliveredCount = data.deliveredCount || 0;
  const returnedCount = data.returnedCount || 0;
  const etcCount = data.etcCount || 0;
  const unitPrice = data.unitPrice || 0;
  const etcPricePerUnit = data.etcPricePerUnit || 1800;
  
  // 기타비용 합계
  let extraCostsTotal = 0;
  if (data.extraCosts && Array.isArray(data.extraCosts)) {
    extraCostsTotal = data.extraCosts.reduce((sum, c) => sum + (c.amount || 0), 0);
  }
  
  // 금액 계산
  const totalBillableCount = deliveredCount + returnedCount;
  const deliveryReturnAmount = totalBillableCount * unitPrice;
  const etcAmount = etcCount * etcPricePerUnit;
  const supplyAmount = deliveryReturnAmount + etcAmount + extraCostsTotal;
  const vatAmount = Math.round(supplyAmount * 0.1);
  const totalAmount = supplyAmount + vatAmount;
  
  // 계약금/잔금
  const depositAmount = Math.floor(totalAmount * 0.2);
  const balanceAmount = totalAmount - depositAmount;
  
  return {
    deliveredCount,
    returnedCount,
    etcCount,
    totalBillableCount,
    deliveryReturnAmount,
    etcAmount,
    extraCostsTotal,
    supplyAmount,
    vatAmount,
    totalAmount,
    depositAmount,
    balanceAmount,
  };
}

/**
 * 헬퍼 지급액 계산 (정산 결과 + 수수료 차감)
 * 
 * 공식:
 * - 플랫폼 수수료 = 총액 × 수수료율
 * - 헬퍼 지급액 = 총액 - 플랫폼 수수료 - 화물사고 차감
 */
export function calculateHelperPayout(
  data: ClosingData,
  platformFeeRate: number,
  damageDeduction: number = 0
): HelperPayoutResult {
  const settlement = calculateSettlement(data);
  
  const platformFee = Math.round(settlement.totalAmount * (platformFeeRate / 100));
  const driverPayout = settlement.totalAmount - platformFee - damageDeduction;
  
  return {
    ...settlement,
    platformFeeRate,
    platformFee,
    damageDeduction,
    driverPayout,
  };
}

/**
 * DB 마감 보고서에서 ClosingData 추출
 */
export function parseClosingReport(closingReport: any, order: any): ClosingData {
  let extraCosts: Array<{ code?: string; name?: string; amount: number; memo?: string }> = [];
  
  if (closingReport.extraCostsJson) {
    try {
      const parsed = JSON.parse(closingReport.extraCostsJson);
      if (Array.isArray(parsed)) {
        extraCosts = parsed;
      }
    } catch { /* ignore */ }
  }
  
  return {
    deliveredCount: closingReport.deliveredCount || 0,
    returnedCount: closingReport.returnedCount || 0,
    etcCount: closingReport.etcCount || 0,
    unitPrice: order.pricePerUnit || 0,
    etcPricePerUnit: closingReport.etcPricePerUnit || 1800,
    extraCosts,
  };
}
