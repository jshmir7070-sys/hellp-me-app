import crypto from "crypto";

const isProduction = process.env.NODE_ENV === "production";

// JWT_SECRET: 프로덕션에서는 반드시 환경변수로 설정 필요
// 개발환경에서도 .env 파일에 JWT_SECRET 설정을 권장
let jwtSecret = process.env.JWT_SECRET || "";

if (!jwtSecret) {
  if (isProduction) {
    throw new Error("JWT_SECRET must be set in production environment");
  } else {
    // 개발환경: 랜덤 시크릿 자동 생성 (서버 재시작 시 기존 토큰 무효화됨)
    jwtSecret = crypto.randomBytes(32).toString("hex");
    console.warn("[JWT] JWT_SECRET not set. Generated random dev secret. Set JWT_SECRET in .env for persistent sessions.");
  }
}

export const EFFECTIVE_JWT_SECRET = jwtSecret;
