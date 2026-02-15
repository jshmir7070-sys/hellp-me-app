/**
 * 헬스체크 & 메타 API 라우트
 *
 * - GET /api/health          – 서버 상태 점검
 * - GET /api/health/pg       – PG 연동 상태 확인
 * - GET /api/meta/routes     – 등록된 라우트 모듈 정보
 */

import type { RouteContext } from "./types";

export function registerHealthRoutes(ctx: RouteContext): void {
  const { app, pgService } = ctx;

  /**
   * PG 서비스 상태 확인
   * GET /api/health/pg
   */
  app.get("/api/health/pg", (_req, res) => {
    const info = pgService.getServiceInfo();
    res.json({
      status: info.configured ? "connected" : "not_configured",
      ...info,
      message: info.configured
        ? "PG 서비스가 정상 연동되어 있습니다."
        : "PORTONE_API_SECRET 환경변수를 설정해주세요.",
    });
  });

  /**
   * 라우트 모듈 정보
   * GET /api/meta/routes
   */
  app.get("/api/meta/routes", (_req, res) => {
    res.json({
      version: "2.0",
      modules: [
        { name: "health", status: "active", description: "헬스체크 및 메타 API" },
        { name: "pg-payment", status: "active", description: "PG 결제 상태 확인 API" },
        { name: "legacy", status: "active", description: "레거시 routes.ts (점진적 분리 진행 중)" },
      ],
      totalEndpoints: "32,000+ lines in legacy, gradually migrating to modules",
    });
  });
}
