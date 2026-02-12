import { drizzle } from "drizzle-orm/node-postgres";
// @ts-ignore
import pg from "pg";
import * as schema from "@shared/schema";
import * as views from "./db/views";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// SSL 옵션: 운영 환경에서 SSL 연결 지원
const isProduction = process.env.NODE_ENV === "production";
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
  // 연결 풀 설정
  max: 20,                        // 최대 연결 수
  min: 2,                         // 최소 유지 연결 수
  idleTimeoutMillis: 10000,       // 유휴 연결 타임아웃 (10초 - Neon 호환)
  connectionTimeoutMillis: 5000,  // 연결 타임아웃 (5초)
  allowExitOnIdle: false,         // 유휴 상태에서 프로세스 종료 방지
  // Neon serverless 호환 설정
  keepAlive: true,                // TCP keepalive 활성화
  keepAliveInitialDelayMillis: 10000, // 10초 후 keepalive 시작
});

// Neon 연결 끊김 시 서버 충돌 방지
pool.on("error", (err: Error) => {
  console.error("[DB Pool] Unexpected error on idle client:", err.message);
  // 에러 로깅만 하고 서버는 계속 실행 (새 연결 자동 생성됨)
});

// Merge schema with views for complete database structure
const fullSchema = { ...schema, ...views };

export const db = drizzle(pool, { schema: fullSchema });

// DB 연결 테스트 함수
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    console.log("[DB] Database connection successful");
    return true;
  } catch (error) {
    console.error("[DB] Database connection failed:", error);
    return false;
  }
}
