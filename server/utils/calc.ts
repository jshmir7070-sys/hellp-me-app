/**
 * 정산/단가/VAT/계약금/잔금/수수료 서버 단일 계산 엔진
 * 모든 금액 계산은 이 모듈을 통해 일관되게 처리됨
 */

export interface SettlementInput {
  boxCount: number;
  unitPrice: number;
  vatRate?: number;         // 기본 0.1 (10%)
  depositRate?: number;     // 기본 0.2 (20%)
  commissionRate: number;   // 수수료율 (0~1, 예: 0.15 = 15%)
  deductions?: number;      // 차감액 (분쟁/분실/파손)
}

export interface SettlementResult {
  // 헬프미 청구
  grossTotal: number;       // 총액 (VAT 포함)
  supplyAmount: number;     // 공급가액
  vatAmount: number;        // 부가세
  deposit: number;          // 계약금 (20%)
  balance: number;          // 잔금 (80%)
  
  // 헬퍼 정산
  commission: number;       // 수수료
  deductions: number;       // 차감액
  helperPayout: number;     // 헬퍼 지급액
  
  // 헬퍼 세금계산서용
  helperInvoiceTotal: number;
  helperSupplyAmount: number;
  helperVatAmount: number;
}

/**
 * 정산 계산 (서버 단일 엔진)
 * 
 * 계산식:
 * - grossTotal = boxCount × unitPrice × 1.1 (VAT 포함)
 * - deposit = floor(grossTotal × 0.2)
 * - balance = grossTotal - deposit
 * - commission = round(grossTotal × commissionRate)
 * - helperPayout = grossTotal - commission - deductions
 */
export function calculateSettlement(input: SettlementInput): SettlementResult {
  const {
    boxCount,
    unitPrice,
    vatRate = 0.1,
    depositRate = 0.2,
    commissionRate,
    deductions = 0,
  } = input;

  // 총액 (VAT 포함)
  const grossTotal = Math.round(boxCount * unitPrice * (1 + vatRate));
  
  // 공급가/부가세 분리
  const supplyAmount = Math.round(grossTotal / (1 + vatRate));
  const vatAmount = grossTotal - supplyAmount;
  
  // 계약금/잔금
  const deposit = Math.floor(grossTotal * depositRate);
  const balance = grossTotal - deposit;
  
  // 수수료
  const commission = Math.round(grossTotal * commissionRate);
  
  // 헬퍼 지급액
  const helperPayout = grossTotal - commission - deductions;
  
  // 헬퍼 세금계산서용 (수수료 차감 후 금액 기준)
  const helperInvoiceTotal = grossTotal - commission;
  const helperSupplyAmount = Math.round(helperInvoiceTotal / (1 + vatRate));
  const helperVatAmount = helperInvoiceTotal - helperSupplyAmount;

  return {
    grossTotal,
    supplyAmount,
    vatAmount,
    deposit,
    balance,
    commission,
    deductions,
    helperPayout,
    helperInvoiceTotal,
    helperSupplyAmount,
    helperVatAmount,
  };
}

/**
 * 박스 수량 파싱 (문자열에서 숫자 추출)
 * 예: "400box" → 400, "500 박스" → 500
 */
export function parseBoxCount(quantityStr: string | number): number {
  if (typeof quantityStr === 'number') return quantityStr;
  const match = quantityStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * 100원 단위 올림 변환
 */
export function roundUp100(amount: number): number {
  return Math.ceil(amount / 100) * 100;
}

/**
 * 최저 요건 미달 시 단가 상향 계산
 */
export interface TieredPricingInput {
  boxCount: number;
  baseUnitPrice: number;
  minBoxCount: number;
  minTotalAmount: number;
  belowMinIncrementPerBox: number;
}

export function calculateAdjustedPrice(input: TieredPricingInput): number {
  const { boxCount, baseUnitPrice, minBoxCount, minTotalAmount, belowMinIncrementPerBox } = input;
  
  let adjustedPrice = baseUnitPrice;
  
  // 최저 박스 미달 시 단가 상향
  if (boxCount < minBoxCount) {
    adjustedPrice += belowMinIncrementPerBox;
  }
  
  // 최저 총액 확인 후 추가 상향 필요 시
  let estimatedTotal = boxCount * adjustedPrice * 1.1;
  while (estimatedTotal < minTotalAmount && adjustedPrice < baseUnitPrice * 2) {
    adjustedPrice = roundUp100(adjustedPrice + 100);
    estimatedTotal = boxCount * adjustedPrice * 1.1;
  }
  
  return roundUp100(adjustedPrice);
}

/**
 * 팀장 인센티브 계산
 * 팀원들의 총 매출에서 설정된 비율로 계산
 */
export interface TeamIncentiveInput {
  teamMembersTotalRevenue: number;
  incentiveRate: number;  // 0~1, 예: 0.05 = 5%
}

export function calculateTeamLeaderIncentive(input: TeamIncentiveInput): number {
  const { teamMembersTotalRevenue, incentiveRate } = input;
  return Math.round(teamMembersTotalRevenue * incentiveRate);
}
