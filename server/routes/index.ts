/**
 * 라우트 모듈 레지스트리
 *
 * routes.ts(레거시 32,000줄 모놀리식)를 도메인별 모듈로 점진적으로 분리합니다.
 *
 * === 마이그레이션 전략 ===
 * 1단계: 신규 기능은 새 모듈 파일에 작성
 * 2단계: 기존 라우트를 도메인별로 추출 (아래 목록 참고)
 * 3단계: routes.ts는 registerRoutes → registerLegacyRoutes로 축소
 *
 * === 도메인 모듈 목록 (예정) ===
 * routes/
 * ├── index.ts              ← 이 파일 (레지스트리)
 * ├── types.ts              ← 공유 타입
 * ├── health.routes.ts      ← 헬스체크, 메타 API        (완료)
 * ├── pg-payment.routes.ts  ← PG 결제 상태 확인 API      (완료)
 * ├── auth.routes.ts        ← 인증/가입/OAuth            (예정)
 * ├── helper.routes.ts      ← 헬퍼 워크플로우            (예정)
 * ├── requester.routes.ts   ← 요청자 워크플로우          (예정)
 * ├── settlement.routes.ts  ← 정산/회계                  (예정)
 * ├── admin/
 * │   ├── disputes.routes.ts     (예정)
 * │   ├── settlements.routes.ts  (예정)
 * │   ├── policies.routes.ts     (예정)
 * │   ├── incidents.routes.ts    (예정)
 * │   └── documents.routes.ts    (예정)
 * ├── team.routes.ts        ← 팀 관리                    (예정)
 * ├── push.routes.ts        ← 푸시 알림                  (예정)
 * └── shared/
 *     ├── middleware.ts      ← 공유 미들웨어              (예정)
 *     └── utils.ts          ← 공유 유틸리티              (예정)
 */

import type { RouteContext, RouteRegistrar } from "./types";
import { registerHealthRoutes } from "./health.routes";
import { registerPGPaymentRoutes } from "./pg-payment.routes";

/**
 * 모듈화된 라우트들을 등록합니다.
 * 레거시 routes.ts의 registerRoutes에서 호출됩니다.
 */
export async function registerModularRoutes(ctx: RouteContext): Promise<void> {
  const modules: Array<{ name: string; register: RouteRegistrar }> = [
    { name: "health", register: registerHealthRoutes },
    { name: "pg-payment", register: registerPGPaymentRoutes },
  ];

  for (const mod of modules) {
    try {
      await mod.register(ctx);
      console.log(`[Routes] ✓ ${mod.name} 모듈 등록 완료`);
    } catch (err) {
      console.error(`[Routes] ✗ ${mod.name} 모듈 등록 실패:`, err);
    }
  }

  console.log(`[Routes] 총 ${modules.length}개 모듈 등록 완료`);
}
