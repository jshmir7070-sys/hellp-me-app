/**
 * 정산 계산 유틸리티 (T-18: 반올림 규칙 통일)
 * 
 * 반올림 규칙:
 * - 모든 금액 계산: Math.round() (반올림)
 * - 박스당 단가 계산: Math.ceil() (올림, 100원 단위)
 * 
 * 계산 순서:
 * 1. 공급가액 = 기본 금액 (박스수 × 단가)
 * 2. 부가세 = round(공급가액 × 0.1)
 * 3. 합계 = 공급가액 + 부가세
 * 4. 수수료 = round(합계 × 수수료율 / 100)
 * 5. 순지급액 = 합계 - 수수료
 */

export const ROUNDING_POLICY = {
  method: "round",
  currency: "KRW",
  precision: 0,
} as const;

export function roundAmount(value: number): number {
  return Math.round(value);
}

export function calculateVat(supplyAmount: number, rate: number = 0.1): number {
  return roundAmount(supplyAmount * rate);
}

export function calculateTotalWithVat(supplyAmount: number): number {
  const vat = calculateVat(supplyAmount);
  return supplyAmount + vat;
}

export function calculateCommission(
  totalAmount: number,
  commissionRate: number
): number {
  return roundAmount(totalAmount * commissionRate / 100);
}

export function calculatePlatformCommission(
  totalAmount: number,
  platformRate: number
): number {
  return roundAmount(totalAmount * platformRate / 100);
}

export function calculateTeamLeaderIncentive(
  totalAmount: number,
  teamLeaderRate: number
): number {
  return roundAmount(totalAmount * teamLeaderRate / 100);
}

export function calculateNetAmount(
  totalAmount: number,
  commissionAmount: number
): number {
  return totalAmount - commissionAmount;
}

export function calculateSupplyFromTotal(totalWithVat: number): number {
  return roundAmount(totalWithVat / 1.1);
}

export function calculateDepositAmount(
  totalAmount: number,
  depositRate: number = 0.2
): number {
  return roundAmount(totalAmount * depositRate);
}

export function calculatePricePerBox(
  netTotal: number,
  boxCount: number
): number {
  return Math.ceil(netTotal / boxCount / 100) * 100;
}

export interface SettlementCalculation {
  supplyAmount: number;
  vatAmount: number;
  totalAmount: number;
  totalCommissionRate: number;
  platformRate: number;
  teamLeaderRate: number;
  totalCommissionAmount: number;
  platformCommission: number;
  teamLeaderIncentive: number;
  netAmount: number;
}

export function calculateSettlement(
  supplyAmount: number,
  totalCommissionRate: number,
  platformRate: number,
  teamLeaderRate: number
): SettlementCalculation {
  const vatAmount = calculateVat(supplyAmount);
  const totalAmount = supplyAmount + vatAmount;
  
  const totalCommissionAmount = calculateCommission(totalAmount, totalCommissionRate);
  const platformCommission = calculatePlatformCommission(totalAmount, platformRate);
  const teamLeaderIncentive = calculateTeamLeaderIncentive(totalAmount, teamLeaderRate);
  
  const netAmount = calculateNetAmount(totalAmount, totalCommissionAmount);

  return {
    supplyAmount,
    vatAmount,
    totalAmount,
    totalCommissionRate,
    platformRate,
    teamLeaderRate,
    totalCommissionAmount,
    platformCommission,
    teamLeaderIncentive,
    netAmount,
  };
}
