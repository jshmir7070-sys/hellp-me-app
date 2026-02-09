/**
 * ⚠️ LEGACY SETTLEMENT CALCULATOR - 특수 케이스 전용
 *
 * 이 파일은 정책 스냅샷 기반의 레거시 정산 계산을 처리합니다.
 *
 * 📌 사용 시나리오:
 * - 정책 스냅샷이 저장된 과거 주문의 재계산
 * - 복잡한 정책 기반 계산이 필요한 특수 케이스
 * - 긴급료, 최소 청구액 등 정책 기반 요금 적용
 *
 * ⚠️ 일반 정산 계산은 server/lib/settlement-calculator.ts 사용
 *
 * 📋 이 파일의 함수들:
 * - calculateSimpleSettlement() - 간단한 정산 계산
 * - calculateSettlementAmounts() - 정책 기반 정산 계산 (레거시)
 * - calculateAndSaveSettlement() - 정산 계산 및 DB 저장
 * - findActiveCarrierPricing() - 활성 운임 정책 조회
 * - getPolicySnapshotForOrder() - 주문의 정책 스냅샷 조회
 */

import { db } from "../db";
import { eq, and, lte, gte, or, isNull, desc } from "drizzle-orm";
import {
  carrierPricingPolicies,
  urgentFeePolicies,
  platformFeePolicies,
  extraCostCatalog,
  orderPolicySnapshots,
  settlementRecords,
  settlementAuditLogs,
  orders,
  closingReports,
  contracts,
} from "@shared/schema";

// ===== 단순화된 정산 인터페이스 =====

// 마감 데이터 입력 (헬퍼가 제출한 마감자료 기반)
export interface ClosingData {
  deliveredCount: number;    // 배송 박스수
  returnedCount: number;     // 반품 박스수
  otherCount?: number;       // 기타 수량
  extraCosts?: number;       // 기타비용 합계 (공급가)
  unitPrice: number;         // 박스당 단가 (공급가)
  depositAmount?: number;    // 계약금 (기 납부액)
}

// 정산 정책
export interface SettlementPolicy {
  platformFeeRate: number;   // 플랫폼 수수료율 (%)
  vatRate?: number;          // 부가세율 (기본 10%)
}

// 요청자 청구 내역
export interface RequesterInvoice {
  deliveredCount: number;    // 배송 박스수
  returnedCount: number;     // 반품 박스수
  otherCount: number;        // 기타 수량
  unitPrice: number;         // 단가
  boxTotal: number;          // 박스 합계 금액 (공급가)
  extraCosts: number;        // 기타비용 (공급가)
  supplyTotal: number;       // 공급가 합계
  vat: number;               // 부가세
  totalAmount: number;       // 총액 (부가세 포함)
  depositAmount: number;     // 계약금 (-)
  balanceDue: number;        // 잔금 = 청구할 금액
}

// 헬퍼 정산 내역
export interface HelperPayout {
  totalAmount: number;       // 총액 (부가세 포함)
  platformFee: number;       // 플랫폼 수수료 (-)
  damageDeduction: number;   // 화물사고 차감액 (-)
  damageReason?: string;     // 사고 내용/설명
  payoutAmount: number;      // 지급액 = totalAmount - platformFee - damageDeduction
}

// 통합 정산 결과
export interface SettlementResult {
  requesterInvoice: RequesterInvoice;
  helperPayout: HelperPayout;
}

// Legacy interfaces for backward compatibility
export interface ExtraCostItem {
  costCode: string;
  qty: number;
  unitPriceSupply: number;
  memo?: string;
}

export interface SettlementInput {
  deliveredCount: number;
  returnedCount: number;
  otherCount?: number;
  extraCostItems?: ExtraCostItem[];
  isUrgent: boolean;
}

export interface PolicySnapshot {
  unitPriceSupply: number;
  minChargeSupply?: number;
  urgentApplyType?: "PERCENT" | "FIXED";
  urgentValue?: number;
  urgentMaxFee?: number;
  platformBaseOn: "TOTAL" | "SUPPLY";
  platformRatePercent: number;
  platformMinFee?: number;
  platformMaxFee?: number;
}

export interface SettlementAmounts {
  baseSupply: number;
  urgentFeeSupply: number;
  extraSupply: number;
  finalSupply: number;
  vat: number;
  finalTotal: number;
  platformFee: number;
  driverPayout: number;
  breakdown: {
    deliveredCount: number;
    returnedCount: number;
    otherCount: number;
    unitPriceSupply: number;
    totalBoxCount: number;
    isUrgent: boolean;
    urgentApplyType?: string;
    urgentValue?: number;
    platformBaseOn: string;
    platformRatePercent: number;
    extraCostItems: Array<{
      costCode: string;
      qty: number;
      unitPriceSupply: number;
      amount: number;
      memo?: string;
    }>;
  };
  deductionItems: Array<{
    code: string;
    name: string;
    amount: number;
    reason?: string;
  }>;
}

// ===== 단순화된 정산 계산 함수 =====
// 마감자료 기반으로 요청자 청구 및 헬퍼 지급 계산
export function calculateSimpleSettlement(
  closing: ClosingData,
  policy: SettlementPolicy,
  damageDeduction: number = 0,  // 화물사고 차감액
  damageReason?: string         // 사고 내용/설명
): SettlementResult {
  const vatRate = policy.vatRate ?? 10;
  
  // 박스 수량 합계
  const totalBoxCount = closing.deliveredCount + closing.returnedCount + (closing.otherCount || 0);
  
  // 박스 금액 (공급가)
  const boxTotal = totalBoxCount * closing.unitPrice;
  
  // 기타비용 (공급가)
  const extraCosts = closing.extraCosts || 0;
  
  // 공급가 합계
  const supplyTotal = boxTotal + extraCosts;
  
  // 부가세
  const vat = Math.round(supplyTotal * (vatRate / 100));
  
  // 총액 (부가세 포함)
  const totalAmount = supplyTotal + vat;
  
  // 계약금
  const depositAmount = closing.depositAmount || 0;
  
  // 잔금 = 요청자에게 청구할 금액
  const balanceDue = totalAmount - depositAmount;
  
  // 플랫폼 수수료
  const platformFee = Math.round(totalAmount * (policy.platformFeeRate / 100));
  
  // 헬퍼 지급액 = 총액 - 플랫폼 수수료 - 화물사고 차감
  const payoutAmount = totalAmount - platformFee - damageDeduction;
  
  return {
    requesterInvoice: {
      deliveredCount: closing.deliveredCount,
      returnedCount: closing.returnedCount,
      otherCount: closing.otherCount || 0,
      unitPrice: closing.unitPrice,
      boxTotal,
      extraCosts,
      supplyTotal,
      vat,
      totalAmount,
      depositAmount,
      balanceDue,
    },
    helperPayout: {
      totalAmount,
      platformFee,
      damageDeduction,
      damageReason,
      payoutAmount,
    },
  };
}

// 정산 실행 시 사용할 인터페이스
export interface ExecuteSettlementInput {
  orderId: number;
  helperId: string;
  closingReportId: number;
  // 마감자료 기반
  deliveredCount: number;
  returnedCount: number;
  otherCount?: number;
  extraCosts?: number;
  unitPrice: number;
  depositAmount?: number;
  // 정책
  platformFeeRate: number;
  // 화물사고 차감 (관리자 입력)
  damageDeduction?: number;
  damageReason?: string;
}

// Legacy function for backward compatibility
export function calculateSettlementAmounts(
  input: SettlementInput,
  policy: PolicySnapshot
): SettlementAmounts {
  const { deliveredCount, returnedCount, otherCount = 0, extraCostItems = [], isUrgent } = input;
  const { unitPriceSupply, minChargeSupply, urgentApplyType, urgentValue, urgentMaxFee, platformBaseOn, platformRatePercent, platformMinFee, platformMaxFee } = policy;

  const totalBoxCount = deliveredCount + returnedCount + otherCount;
  let baseSupply = totalBoxCount * unitPriceSupply;
  if (minChargeSupply && baseSupply < minChargeSupply) {
    baseSupply = minChargeSupply;
  }

  let urgentFeeSupply = 0;
  if (isUrgent && urgentApplyType && urgentValue) {
    if (urgentApplyType === "PERCENT") {
      urgentFeeSupply = Math.round(baseSupply * (urgentValue / 100));
    } else if (urgentApplyType === "FIXED") {
      urgentFeeSupply = urgentValue;
    }
    if (urgentMaxFee && urgentFeeSupply > urgentMaxFee) {
      urgentFeeSupply = urgentMaxFee;
    }
  }

  let extraSupply = 0;
  const extraCostItemsWithAmount = extraCostItems.map(item => ({
    costCode: item.costCode,
    qty: item.qty,
    unitPriceSupply: item.unitPriceSupply,
    amount: item.qty * item.unitPriceSupply,
    memo: item.memo,
  }));
  for (const item of extraCostItemsWithAmount) {
    extraSupply += item.amount;
  }

  const finalSupply = baseSupply + urgentFeeSupply + extraSupply;
  const vat = Math.round(finalSupply * 0.1);
  const finalTotal = finalSupply + vat;

  let platformFeeBase = platformBaseOn === "TOTAL" ? finalTotal : finalSupply;
  let platformFee = Math.round(platformFeeBase * (platformRatePercent / 100));
  if (platformMinFee && platformFee < platformMinFee) {
    platformFee = platformMinFee;
  }
  if (platformMaxFee && platformFee > platformMaxFee) {
    platformFee = platformMaxFee;
  }

  const driverPayout = finalTotal - platformFee;

  // 차감항목 (플랫폼 수수료 포함)
  const deductionItems: Array<{ code: string; name: string; amount: number; reason?: string }> = [];
  if (platformFee > 0) {
    deductionItems.push({
      code: "PLATFORM_FEE",
      name: "플랫폼 수수료",
      amount: platformFee,
      reason: `${platformBaseOn} 기준 ${platformRatePercent}%`,
    });
  }

  return {
    baseSupply,
    urgentFeeSupply,
    extraSupply,
    finalSupply,
    vat,
    finalTotal,
    platformFee,
    driverPayout,
    breakdown: {
      deliveredCount,
      returnedCount,
      otherCount,
      unitPriceSupply,
      totalBoxCount,
      isUrgent,
      urgentApplyType,
      urgentValue,
      platformBaseOn,
      platformRatePercent,
      extraCostItems: extraCostItemsWithAmount,
    },
    deductionItems,
  };
}

export async function findActiveCarrierPricing(
  carrierCode: string,
  serviceType: string,
  date: string = new Date().toISOString().split("T")[0]
): Promise<typeof carrierPricingPolicies.$inferSelect | null> {
  const result = await db
    .select()
    .from(carrierPricingPolicies)
    .where(
      and(
        eq(carrierPricingPolicies.carrierCode, carrierCode),
        eq(carrierPricingPolicies.serviceType, serviceType),
        eq(carrierPricingPolicies.isActive, true),
        lte(carrierPricingPolicies.effectiveFrom, date),
        or(
          isNull(carrierPricingPolicies.effectiveTo),
          gte(carrierPricingPolicies.effectiveTo, date)
        )
      )
    )
    .orderBy(desc(carrierPricingPolicies.effectiveFrom))
    .limit(1);

  return result[0] || null;
}

export async function findActiveUrgentFeePolicy(
  carrierCode?: string,
  date: string = new Date().toISOString().split("T")[0]
): Promise<typeof urgentFeePolicies.$inferSelect | null> {
  const result = await db
    .select()
    .from(urgentFeePolicies)
    .where(
      and(
        eq(urgentFeePolicies.isActive, true),
        or(
          eq(urgentFeePolicies.carrierCode, carrierCode || ""),
          isNull(urgentFeePolicies.carrierCode)
        ),
        lte(urgentFeePolicies.effectiveFrom, date),
        or(
          isNull(urgentFeePolicies.effectiveTo),
          gte(urgentFeePolicies.effectiveTo, date)
        )
      )
    )
    .orderBy(desc(urgentFeePolicies.effectiveFrom))
    .limit(1);

  return result[0] || null;
}

export async function findActivePlatformFeePolicy(
  date: string = new Date().toISOString().split("T")[0]
): Promise<typeof platformFeePolicies.$inferSelect | null> {
  const defaultPolicy = await db
    .select()
    .from(platformFeePolicies)
    .where(
      and(
        eq(platformFeePolicies.isActive, true),
        eq(platformFeePolicies.isDefault, true),
        lte(platformFeePolicies.effectiveFrom, date),
        or(
          isNull(platformFeePolicies.effectiveTo),
          gte(platformFeePolicies.effectiveTo, date)
        )
      )
    )
    .limit(1);

  if (defaultPolicy[0]) {
    return defaultPolicy[0];
  }

  const anyActive = await db
    .select()
    .from(platformFeePolicies)
    .where(
      and(
        eq(platformFeePolicies.isActive, true),
        lte(platformFeePolicies.effectiveFrom, date),
        or(
          isNull(platformFeePolicies.effectiveTo),
          gte(platformFeePolicies.effectiveTo, date)
        )
      )
    )
    .orderBy(desc(platformFeePolicies.effectiveFrom))
    .limit(1);

  return anyActive[0] || null;
}

export async function getActiveExtraCostCatalog(): Promise<typeof extraCostCatalog.$inferSelect[]> {
  return db
    .select()
    .from(extraCostCatalog)
    .where(eq(extraCostCatalog.isActive, true))
    .orderBy(extraCostCatalog.sortOrder);
}

export async function createPolicySnapshotForOrder(
  orderId: number,
  carrierCode: string,
  serviceType: string,
  isUrgent: boolean
): Promise<PolicySnapshot | null> {
  const date = new Date().toISOString().split("T")[0];

  const pricingPolicy = await findActiveCarrierPricing(carrierCode, serviceType, date);
  const urgentPolicy = isUrgent ? await findActiveUrgentFeePolicy(carrierCode, date) : null;
  const platformPolicy = await findActivePlatformFeePolicy(date);

  if (!pricingPolicy || !platformPolicy) {
    return null;
  }

  const snapshot = {
    orderId,
    pricingPolicyId: pricingPolicy.id,
    snapshotUnitPriceSupply: pricingPolicy.unitPriceSupply,
    snapshotMinChargeSupply: pricingPolicy.minChargeSupply,
    urgentPolicyId: urgentPolicy?.id || null,
    snapshotUrgentApplyType: urgentPolicy?.applyType || null,
    snapshotUrgentValue: urgentPolicy?.value || null,
    snapshotUrgentMaxFee: urgentPolicy?.maxUrgentFeeSupply || null,
    platformFeePolicyId: platformPolicy.id,
    snapshotPlatformBaseOn: platformPolicy.baseOn,
    snapshotPlatformRatePercent: platformPolicy.ratePercent,
    snapshotPlatformMinFee: platformPolicy.minFee,
    snapshotPlatformMaxFee: platformPolicy.maxFee,
  };

  await db.insert(orderPolicySnapshots).values(snapshot);

  return {
    unitPriceSupply: pricingPolicy.unitPriceSupply,
    minChargeSupply: pricingPolicy.minChargeSupply ?? undefined,
    urgentApplyType: (urgentPolicy?.applyType as "PERCENT" | "FIXED") || undefined,
    urgentValue: urgentPolicy?.value ?? undefined,
    urgentMaxFee: urgentPolicy?.maxUrgentFeeSupply ?? undefined,
    platformBaseOn: platformPolicy.baseOn as "TOTAL" | "SUPPLY",
    platformRatePercent: platformPolicy.ratePercent || 15,
    platformMinFee: platformPolicy.minFee ?? undefined,
    platformMaxFee: platformPolicy.maxFee ?? undefined,
  };
}

export async function getPolicySnapshotForOrder(orderId: number): Promise<PolicySnapshot | null> {
  const snapshot = await db
    .select()
    .from(orderPolicySnapshots)
    .where(eq(orderPolicySnapshots.orderId, orderId))
    .limit(1);

  if (!snapshot[0]) {
    return null;
  }

  const s = snapshot[0];
  return {
    unitPriceSupply: s.snapshotUnitPriceSupply || 0,
    minChargeSupply: s.snapshotMinChargeSupply ?? undefined,
    urgentApplyType: (s.snapshotUrgentApplyType as "PERCENT" | "FIXED") || undefined,
    urgentValue: s.snapshotUrgentValue ?? undefined,
    urgentMaxFee: s.snapshotUrgentMaxFee ?? undefined,
    platformBaseOn: (s.snapshotPlatformBaseOn as "TOTAL" | "SUPPLY") || "TOTAL",
    platformRatePercent: s.snapshotPlatformRatePercent || 15,
    platformMinFee: s.snapshotPlatformMinFee ?? undefined,
    platformMaxFee: s.snapshotPlatformMaxFee ?? undefined,
  };
}

export async function calculateAndSaveSettlement(
  orderId: number,
  helperId: string,
  closingReportId: number,
  input: SettlementInput,
  performedBy: string
): Promise<SettlementAmounts | null> {
  const policy = await getPolicySnapshotForOrder(orderId);
  if (!policy) {
    return null;
  }

  const amounts = calculateSettlementAmounts(input, policy);

  const [contract] = await db
    .select()
    .from(contracts)
    .where(and(eq(contracts.orderId, orderId), eq(contracts.helperId, helperId)))
    .limit(1);

  const [record] = await db
    .insert(settlementRecords)
    .values({
      orderId,
      helperId,
      closingReportId,
      contractId: contract?.id ?? null,
      baseSupply: amounts.baseSupply,
      urgentFeeSupply: amounts.urgentFeeSupply,
      extraSupply: amounts.extraSupply,
      finalSupply: amounts.finalSupply,
      vat: amounts.vat,
      finalTotal: amounts.finalTotal,
      platformFeeBaseOn: policy.platformBaseOn,
      platformFeeRate: policy.platformRatePercent,
      platformFee: amounts.platformFee,
      driverPayout: amounts.driverPayout,
      breakdownJson: JSON.stringify(amounts.breakdown),
      deductionItemsJson: JSON.stringify(amounts.deductionItems),
      status: "CALCULATED",
    })
    .returning();

  await db.insert(settlementAuditLogs).values({
    settlementId: record.id,
    actionType: "created",
    newValue: JSON.stringify({ status: "CALCULATED", amounts }),
    changedFields: JSON.stringify(amounts.breakdown),
    reason: "정산 자동 계산",
    actorId: performedBy,
    actorRole: "admin",
  });

  return amounts;
}

export function formatKoreanCurrency(amount: number): string {
  return amount.toLocaleString("ko-KR") + "원";
}

export function calculateDeposit(estimatedTotal: number, depositPercent: number = 20): number {
  return Math.round(estimatedTotal * (depositPercent / 100));
}

export function calculateBalance(finalTotal: number, depositAmount: number): number {
  return finalTotal - depositAmount;
}
