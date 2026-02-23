/**
 * 설정 변경 추적 유틸리티
 *
 * 모든 관리자 설정 변경 시 공통으로 사용합니다.
 * - 즉시 적용: effectiveFrom이 없거나 과거/현재 → 바로 반영 + active 이력 기록
 * - 예약 적용: effectiveFrom이 미래 → pending 이력 저장, 실제 반영 안 함
 */

import { randomUUID } from "crypto";
import type { IStorage } from "../storage";
import type { InsertSettingChangeHistory } from "@shared/schema";

export interface TrackSettingChangeParams {
  settingType: string;       // "courier_settings" | "team_commission" | "system_setting" 등
  entityId?: string;         // courierId, teamId, settingKey 등
  fieldName?: string;        // 변경된 필드명 (null이면 전체 객체)
  oldValue: any;             // 변경 전 값
  newValue: any;             // 변경 후 값
  effectiveFrom?: string;    // YYYY-MM-DD HH:mm (미래 날짜면 예약)
  reason?: string;           // 변경 사유
  changedBy?: string;        // 관리자 userId
  changedByName?: string;    // 관리자 이름
  applyFn: () => Promise<any>;  // 실제 DB 반영 함수
}

export interface TrackSettingChangeResult {
  applied: boolean;          // 즉시 적용 여부
  scheduled: boolean;        // 예약 여부
  batchId: string;
  result?: any;              // applyFn 반환값 (즉시 적용 시)
  historyId: number;         // 이력 ID
}

/**
 * 설정 변경을 추적하고, 예약 또는 즉시 반영합니다.
 */
export async function trackSettingChange(
  storage: IStorage,
  params: TrackSettingChangeParams
): Promise<TrackSettingChangeResult> {
  const batchId = randomUUID();
  const isScheduled = params.effectiveFrom
    && new Date(params.effectiveFrom) > new Date();

  const historyEntry: InsertSettingChangeHistory = {
    settingType: params.settingType,
    entityId: params.entityId || null,
    fieldName: params.fieldName || null,
    oldValue: typeof params.oldValue === 'string' ? params.oldValue : JSON.stringify(params.oldValue),
    newValue: typeof params.newValue === 'string' ? params.newValue : JSON.stringify(params.newValue),
    effectiveFrom: params.effectiveFrom || null,
    status: isScheduled ? "pending" : "active",
    appliedAt: isScheduled ? null : new Date(),
    changedBy: params.changedBy || null,
    changedByName: params.changedByName || null,
    reason: params.reason || null,
    batchId,
  };

  if (isScheduled) {
    // 예약 적용: pending으로 저장, 실제 반영 안 함
    const history = await storage.createSettingChangeHistory(historyEntry);
    return { applied: false, scheduled: true, batchId, historyId: history.id };
  }

  // 즉시 적용: applyFn 실행 후 active 이력 기록
  const result = await params.applyFn();
  const history = await storage.createSettingChangeHistory(historyEntry);
  return { applied: true, scheduled: false, batchId, result, historyId: history.id };
}
