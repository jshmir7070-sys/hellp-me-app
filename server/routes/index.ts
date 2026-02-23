/**
 * 라우트 모듈 레지스트리
 *
 * routes.ts(원래 34,000줄 모놀리식)를 도메인별 11개 모듈로 분리 완료.
 * routes.ts는 현재 1,382줄 (헬퍼 함수, 시드 데이터, 컨텍스트 구성만 남음).
 *
 * === 도메인 모듈 목록 (전체 완료) ===
 * routes/
 * ├── index.ts                 ← 이 파일 (레지스트리)
 * ├── types.ts                 ← 공유 타입 (RouteContext)
 * ├── health.routes.ts         ← 헬스체크, 메타 API         (2 routes)
 * ├── pg-payment.routes.ts     ← PG 결제 상태 확인 API       (3 routes)
 * ├── notifications.routes.ts  ← 알림 CRUD                   (5 routes)
 * ├── reviews.routes.ts        ← 리뷰/평점                   (4 routes)
 * ├── checkin.routes.ts        ← 출근 체크 (QR/코드)         (7 routes)
 * ├── push.routes.ts           ← 푸시 알림 관리              (7 routes)
 * ├── meta.routes.ts           ← 메타 데이터/주소 검색        (8 routes)
 * ├── auth.routes.ts           ← 인증/가입/OAuth/SMS         (~30 routes)
 * ├── helpers.routes.ts        ← 헬퍼 프로필/자격증/온보딩    (~40 routes)
 * ├── orders.routes.ts         ← 주문/계약/워크플로우         (~100 routes)
 * └── admin.routes.ts          ← 관리자 전체                  (~200 routes)
 */

import type { RouteContext, RouteRegistrar } from "./types";
import { registerHealthRoutes } from "./health.routes";
import { registerPGPaymentRoutes } from "./pg-payment.routes";
import { registerNotificationRoutes } from "./notifications.routes";
import { registerReviewRoutes } from "./reviews.routes";
import { registerCheckinRoutes } from "./checkin.routes";
import { registerPushRoutes } from "./push.routes";
import { registerMetaRoutes } from "./meta.routes";
import { registerAuthRoutes } from "./auth.routes";
import { registerHelperRoutes } from "./helpers.routes";
import { registerOrderRoutes } from "./orders.routes";
import { registerAdminRoutes } from "./admin";
import { registerPartnerRoutes } from "./partner";

/**
 * 모듈화된 라우트들을 등록합니다.
 * 레거시 routes.ts의 registerRoutes에서 호출됩니다.
 */
export async function registerModularRoutes(ctx: RouteContext): Promise<void> {
  const modules: Array<{ name: string; register: RouteRegistrar }> = [
    { name: "health", register: registerHealthRoutes },
    { name: "pg-payment", register: registerPGPaymentRoutes },
    { name: "notifications", register: registerNotificationRoutes },
    { name: "reviews", register: registerReviewRoutes },
    { name: "checkin", register: registerCheckinRoutes },
    { name: "push", register: registerPushRoutes },
    { name: "meta", register: registerMetaRoutes },
    { name: "auth", register: registerAuthRoutes },
    { name: "helpers", register: registerHelperRoutes },
    { name: "orders", register: registerOrderRoutes },
    { name: "admin", register: registerAdminRoutes },
    { name: "partner", register: registerPartnerRoutes },
  ];

  for (const mod of modules) {
    try {
      await mod.register(ctx);
      console.log(`[Routes] ✓ ${mod.name} 모듈 등록 완료`);
    } catch (err: any) {
      console.error(`[Routes] ✗ ${mod.name} 모듈 등록 실패:`, err);
    }
  }

  console.log(`[Routes] 총 ${modules.length}개 모듈 등록 완료`);
}
