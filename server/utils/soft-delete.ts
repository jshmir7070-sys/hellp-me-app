/**
 * Soft Delete 정책 유틸리티 (T-28)
 * 
 * === 정책 ===
 * - 모든 주요 엔티티는 물리 삭제 대신 deletedAt 컬럼 사용
 * - 기본 조회: deletedAt IS NULL
 * - 삭제된 데이터 조회: 관리자 전용 API에서만 가능
 * 
 * === 적용 테이블 ===
 * - orders: 오더
 * - contracts: 계약
 * - settlementStatements: 정산
 * - disputes: 분쟁
 * - files/uploads: 파일
 * 
 * === 복구 정책 ===
 * - 삭제 후 30일 이내: 복구 가능
 * - 삭제 후 30일 이후: 완전 삭제 (배치 처리)
 */

import { isNull, and, SQL, AnyColumn } from "drizzle-orm";

/**
 * Soft delete 필터 조건 생성
 * 기본 조회에서 삭제되지 않은 항목만 반환
 */
export function notDeleted<T extends AnyColumn>(deletedAtColumn: T): SQL {
  return isNull(deletedAtColumn);
}

/**
 * Soft delete 수행 시 설정할 값
 */
export function getDeletedAtValue(): Date {
  return new Date();
}

/**
 * 삭제된 데이터 복구 시 설정할 값
 */
export function getRestoredValue(): null {
  return null;
}

/**
 * Soft delete 정책 상수
 */
export const SOFT_DELETE_POLICY = {
  retentionDays: 30,
  entityTypes: ["orders", "contracts", "settlementStatements", "disputes", "files"],
  description: `
    === Soft Delete 정책 ===
    
    1. 물리 삭제 금지: 모든 주요 테이블은 deletedAt 컬럼 사용
    2. 기본 조회: WHERE deletedAt IS NULL 조건 필수
    3. 삭제된 데이터: 관리자 콘솔에서만 조회 가능
    4. 복구 가능 기간: 삭제 후 30일
    5. 영구 삭제: 30일 경과 후 배치 작업으로 처리
    
    === 구현 가이드 ===
    
    // 조회 시
    const activeOrders = await db.select().from(orders)
      .where(isNull(orders.deletedAt));
    
    // 삭제 시 (soft delete)
    await db.update(orders)
      .set({ deletedAt: new Date() })
      .where(eq(orders.id, orderId));
    
    // 복구 시
    await db.update(orders)
      .set({ deletedAt: null })
      .where(eq(orders.id, orderId));
  `,
};

/**
 * Soft delete 열거형 상태
 * (deletedAt 컬럼이 없는 테이블에서 status로 관리)
 */
export const DELETED_STATUS = {
  ACTIVE: "active",
  DELETED: "deleted",
  ARCHIVED: "archived",
} as const;

/**
 * 영구 삭제 대상 판별
 * @param deletedAt 삭제 시각
 * @param retentionDays 보존 기간 (일)
 */
export function isPermanentDeleteTarget(deletedAt: Date, retentionDays: number = 30): boolean {
  const now = new Date();
  const threshold = new Date(deletedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
  return now > threshold;
}
