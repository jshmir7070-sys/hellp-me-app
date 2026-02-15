/**
 * 데이터베이스 트랜잭션 유틸리티
 * 
 * 핵심 비즈니스 플로우에서 원자성(Atomicity) 보장:
 * - 오더 생성 + 계약 생성
 * - 계약 확정 + 정산 생성
 * - 정산 확정 + 상태 변경 + 감사로그
 */

import { db, pool } from "../db";
import { PoolClient } from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

export type TransactionClient = NodePgDatabase<typeof schema>;

/**
 * 트랜잭션 실행 래퍼
 * 
 * @param callback 트랜잭션 내에서 실행할 콜백
 * @returns 콜백의 반환값
 * @throws 에러 발생 시 자동 롤백 후 예외 재발생
 * 
 * @example
 * const result = await withTransaction(async (tx) => {
 *   const order = await tx.insert(orders).values(orderData).returning();
 *   const contract = await tx.insert(contracts).values(contractData).returning();
 *   return { order, contract };
 * });
 */
export async function withTransaction<T>(
  callback: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    return await callback(tx);
  });
}

/**
 * 트랜잭션 내에서 여러 작업을 순차적으로 실행
 * 하나라도 실패하면 전체 롤백
 * 
 * @param operations 순차 실행할 작업 배열
 * @returns 모든 작업의 결과 배열
 */
export async function executeInTransaction<T>(
  operations: Array<(tx: TransactionClient) => Promise<T>>
): Promise<T[]> {
  return await withTransaction(async (tx) => {
    const results: T[] = [];
    for (const operation of operations) {
      results.push(await operation(tx));
    }
    return results;
  });
}

/**
 * 수동 트랜잭션 관리용 헬퍼
 * (복잡한 비즈니스 로직에서 명시적 제어가 필요할 때 사용)
 */
export class TransactionManager {
  private client: PoolClient | null = null;
  private txClient: ReturnType<typeof drizzle> | null = null;
  
  async begin(): Promise<ReturnType<typeof drizzle>> {
    this.client = await pool.connect();
    await this.client.query("BEGIN");
    this.txClient = drizzle(this.client, { schema });
    return this.txClient;
  }
  
  async commit(): Promise<void> {
    if (!this.client) throw new Error("No active transaction");
    await this.client.query("COMMIT");
    this.client.release();
    this.client = null;
    this.txClient = null;
  }
  
  async rollback(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.query("ROLLBACK");
    } finally {
      this.client.release();
      this.client = null;
      this.txClient = null;
    }
  }
  
  get transaction(): ReturnType<typeof drizzle> | null {
    return this.txClient;
  }
}

/**
 * 트랜잭션 타임아웃 래퍼
 * 
 * @param callback 트랜잭션 콜백
 * @param timeoutMs 타임아웃 (밀리초, 기본 30초)
 */
export async function withTransactionTimeout<T>(
  callback: (tx: TransactionClient) => Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Transaction timeout")), timeoutMs);
  });
  
  return await Promise.race([
    withTransaction(callback),
    timeoutPromise,
  ]);
}
