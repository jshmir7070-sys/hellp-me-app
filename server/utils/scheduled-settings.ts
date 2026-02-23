/**
 * 예약 설정 적용 스케줄러
 *
 * 60초마다 실행되어 pending 상태의 설정 변경을 확인하고,
 * effectiveFrom이 현재 시간 이전인 경우 실제로 적용합니다.
 */

import { db } from "../db";
import type { IStorage } from "../storage";
import type { SettingChangeHistory } from "@shared/schema";
import {
  courierSettings,
  teamCommissionOverrides,
  platformFeePolicies,
  urgentFeePolicies,
  carrierPricingPolicies,
  refundPolicies,
} from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * pending 상태의 변경들을 확인하고 적용 시점이 된 것들을 활성화
 */
export async function activatePendingChanges(storage: IStorage): Promise<number> {
  const now = new Date();
  const pending = await storage.getPendingChanges(now);

  let activatedCount = 0;

  for (const change of pending) {
    try {
      await applyChange(storage, change);
      await storage.updateSettingChangeHistoryStatus(change.id, "active", new Date());
      activatedCount++;
      console.log(`[Scheduled] Setting change #${change.id} activated: ${change.settingType}/${change.entityId}`);
    } catch (error) {
      console.error(`[Scheduled] Failed to activate change #${change.id}:`, error);
    }
  }

  if (activatedCount > 0) {
    console.log(`[Scheduled] ${activatedCount} pending setting changes activated`);
  }

  return activatedCount;
}

/**
 * 설정 유형에 따라 실제 DB에 newValue를 적용
 */
async function applyChange(storage: IStorage, change: SettingChangeHistory): Promise<void> {
  const newValue = safeParseJSON(change.newValue);
  if (newValue === null && change.newValue !== null) {
    throw new Error(`Invalid JSON in newValue for change #${change.id}`);
  }

  switch (change.settingType) {
    case "courier_settings":
      await applyCourierSettings(storage, change.entityId!, newValue);
      break;

    case "team_commission":
      await applyTeamCommission(storage, change.entityId!, newValue);
      break;

    case "system_setting":
      await applySystemSetting(storage, change.entityId!, newValue);
      break;

    case "platform_fee":
      await applyPlatformFee(change.entityId!, newValue);
      break;

    case "urgent_fee":
      await applyUrgentFee(change.entityId!, newValue);
      break;

    case "carrier_pricing":
      await applyCarrierPricing(change.entityId!, newValue);
      break;

    case "refund_policy":
      await applyRefundPolicy(change.entityId!, newValue);
      break;

    case "commission_policy":
      // commissionPolicies는 storage 메소드 사용
      // 향후 필요 시 구현
      break;

    default:
      console.warn(`[Scheduled] Unknown settingType: ${change.settingType}`);
  }
}

// ==========================================
// 설정 유형별 적용 함수
// ==========================================

async function applyCourierSettings(storage: IStorage, entityId: string, newValue: any): Promise<void> {
  const id = Number(entityId);
  if (isNaN(id)) throw new Error(`Invalid courier setting id: ${entityId}`);
  await storage.updateCourierSetting(id, newValue);
}

async function applyTeamCommission(storage: IStorage, entityId: string, newValue: any): Promise<void> {
  const id = Number(entityId);
  if (isNaN(id)) throw new Error(`Invalid team commission id: ${entityId}`);
  await storage.updateTeamCommissionOverride(id, newValue);
}

async function applySystemSetting(storage: IStorage, entityId: string, newValue: any): Promise<void> {
  // entityId = settingKey, newValue = { value, description }
  const value = typeof newValue === 'object' ? String(newValue.value) : String(newValue);
  const description = typeof newValue === 'object' ? newValue.description : undefined;
  await storage.upsertSystemSetting(entityId, value, description);
}

async function applyPlatformFee(entityId: string, newValue: any): Promise<void> {
  const id = Number(entityId);
  if (isNaN(id)) throw new Error(`Invalid platform fee policy id: ${entityId}`);
  await db.update(platformFeePolicies)
    .set({ ...newValue, updatedAt: new Date() })
    .where(eq(platformFeePolicies.id, id));
}

async function applyUrgentFee(entityId: string, newValue: any): Promise<void> {
  const id = Number(entityId);
  if (isNaN(id)) throw new Error(`Invalid urgent fee policy id: ${entityId}`);
  await db.update(urgentFeePolicies)
    .set({ ...newValue, updatedAt: new Date() })
    .where(eq(urgentFeePolicies.id, id));
}

async function applyCarrierPricing(entityId: string, newValue: any): Promise<void> {
  const id = Number(entityId);
  if (isNaN(id)) throw new Error(`Invalid carrier pricing policy id: ${entityId}`);
  await db.update(carrierPricingPolicies)
    .set({ ...newValue, updatedAt: new Date() })
    .where(eq(carrierPricingPolicies.id, id));
}

async function applyRefundPolicy(entityId: string, newValue: any): Promise<void> {
  const id = Number(entityId);
  if (isNaN(id)) throw new Error(`Invalid refund policy id: ${entityId}`);
  await db.update(refundPolicies)
    .set({ ...newValue, updatedAt: new Date() })
    .where(eq(refundPolicies.id, id));
}

// ==========================================
// 유틸리티
// ==========================================

function safeParseJSON(str: string | null): any {
  if (str === null || str === undefined) return null;
  try {
    return JSON.parse(str);
  } catch {
    return str; // JSON이 아닌 단순 문자열이면 그대로 반환
  }
}

/**
 * 서버 시작 시 인터벌 등록 함수
 * 60초(1분) 간격으로 pending 변경 체크
 */
export function startScheduledSettingsChecker(storage: IStorage): NodeJS.Timeout {
  console.log("[Scheduled] Settings change checker started (60s interval)");
  return setInterval(async () => {
    try {
      await activatePendingChanges(storage);
    } catch (error) {
      console.error("[Scheduled] Error checking pending changes:", error);
    }
  }, 60_000);
}
