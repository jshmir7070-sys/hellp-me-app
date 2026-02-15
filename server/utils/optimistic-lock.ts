/**
 * 낙관적 락(Optimistic Lock) 유틸리티 (T-30)
 * 
 * 관리자 동시 작업 충돌 방지:
 * - version 또는 updatedAt 비교로 충돌 감지
 * - 충돌 시 "다른 관리자가 먼저 수정했습니다" 에러 반환
 */

import { Response } from "express";
import { concurrencyConflict } from "./error-response";

export interface VersionedEntity {
  version?: number;
  updatedAt?: Date | string | null;
}

/**
 * 버전 기반 낙관적 락 검증
 * 
 * @param entity 현재 DB의 엔티티
 * @param expectedVersion 클라이언트가 제출한 버전
 * @returns 일치 여부
 */
export function checkVersion(entity: VersionedEntity, expectedVersion: number): boolean {
  if (entity.version === undefined) return true;
  return entity.version === expectedVersion;
}

/**
 * updatedAt 기반 낙관적 락 검증
 * 
 * @param entity 현재 DB의 엔티티
 * @param expectedUpdatedAt 클라이언트가 제출한 updatedAt
 * @returns 일치 여부
 */
export function checkUpdatedAt(entity: VersionedEntity, expectedUpdatedAt: string | Date): boolean {
  if (!entity.updatedAt) return true;
  
  const entityTime = new Date(entity.updatedAt).getTime();
  const expectedTime = new Date(expectedUpdatedAt).getTime();
  
  return entityTime === expectedTime;
}

/**
 * 낙관적 락 검증 미들웨어 헬퍼
 * 
 * @param res Express Response
 * @param entity 현재 엔티티
 * @param clientVersion 클라이언트 버전 (version 또는 updatedAt)
 * @returns 충돌 여부 (true = 충돌 발생, 응답 전송됨)
 */
export function handleOptimisticLock(
  res: Response,
  entity: VersionedEntity,
  clientVersion?: { version?: number; updatedAt?: string | Date }
): boolean {
  if (!clientVersion) return false;
  
  if (clientVersion.version !== undefined) {
    if (!checkVersion(entity, clientVersion.version)) {
      concurrencyConflict(res);
      return true;
    }
  }
  
  if (clientVersion.updatedAt !== undefined) {
    if (!checkUpdatedAt(entity, clientVersion.updatedAt)) {
      concurrencyConflict(res);
      return true;
    }
  }
  
  return false;
}

/**
 * 버전 증가
 */
export function incrementVersion(currentVersion?: number): number {
  return (currentVersion || 0) + 1;
}

/**
 * 낙관적 락 정책 상수
 */
export const OPTIMISTIC_LOCK_POLICY = {
  strategyVersionBased: "version",
  strategyTimestampBased: "updatedAt",
  description: `
    === 낙관적 락(Optimistic Lock) 정책 ===
    
    1. 목적: 관리자 동시 수정 충돌 방지
    2. 방식: version 또는 updatedAt 비교
    
    === 클라이언트 요청 형식 ===
    
    // version 기반
    PUT /api/admin/orders/123
    {
      "status": "approved",
      "version": 5
    }
    
    // updatedAt 기반
    PUT /api/admin/orders/123
    {
      "status": "approved",
      "updatedAt": "2026-01-13T10:00:00.000Z"
    }
    
    === 충돌 응답 ===
    
    HTTP 409 Conflict
    {
      "code": "ERR_CONCURRENCY_CONFLICT",
      "message": "다른 사용자가 먼저 수정했습니다. 새로고침 후 다시 시도해주세요.",
      "traceId": "uuid"
    }
    
    === 적용 대상 ===
    - 정산 상태 변경
    - 오더 상태 변경
    - 분쟁 처리
    - 헬퍼 승인/거절
  `,
};
