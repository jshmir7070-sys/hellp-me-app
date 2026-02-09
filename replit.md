# Hellp Me - Helper Matching Service

## Overview

Hellp Me is a helper matching service platform that connects delivery drivers (헬퍼) with businesses needing delivery services. The platform's primary purpose is to provide efficient matching, transparent contracts, and reliable settlement systems. It's built as an Expo React Native mobile application with a Node.js/Express backend, supporting both iOS and Android platforms, including web compatibility. The project aims to streamline delivery operations for businesses and provide flexible work opportunities for drivers.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is an Expo React Native application (SDK 54, React Native 0.81) utilizing React Navigation, React Native Reanimated, and Expo modules. Server state is managed with TanStack React Query, and the codebase is written in TypeScript with strict mode. The design emphasizes a professional, corporate aesthetic with clean UI, dark/light theme support, and color-coded distinctions for helpers (blue) and requesters (green). Consistent spacing, border radius, and typography tokens maintain a cohesive design system.

### Backend Architecture

The backend is built with Express.js and TypeScript, providing a RESTful API. Key features include Zod validation, JWT-based authentication with refresh tokens, and WebSocket support for real-time notifications. Architectural patterns include middleware-based authentication, centralized validation, soft delete policies, optimistic locking, and comprehensive audit logging.

The matching model allows a maximum of 3 applicants per order, with the Requester selecting one and others being auto-rejected. A standardized state machine manages order statuses from `awaiting_deposit` to `closed`. A flexible, category-based pricing system (`courier_settings`) defines base prices, minimums, commission rates, and urgent surcharges. The `settlement_records` table acts as the single source of truth for all financial transactions, calculating supply price, VAT, total amount, platform fees, and driver payouts. Authentication supports email/password, SMS verification (Solapi), and social logins (Kakao, Naver), employing role-based access control (helper, requester, admin, HQ staff) and resource ownership verification.

### Data Storage

PostgreSQL is used as the database, managed with Drizzle ORM. Key tables include `users`, `teams`, `orders`, `order_applications`, `contracts`, and `settlement_records`. Replit Object Storage is utilized for file storage, with distinct paths for private and public assets.

### Core Features and Design Decisions

-   **Duplicate Application Prevention**: Helpers cannot apply for multiple orders scheduled on the same `scheduledDate` if they already have a matched order for that date.
-   **Refund Policy System**: A dynamic refund policy system is implemented via a `refund_policies` table, allowing configurable refund rates before and after matching.
-   **Tax Invoice System**: Supports both individual and monthly aggregated tax invoice issuance, integrated with Popbill for electronic tax invoice management (issuance, status, PDF).
-   **Team Commission Management**: Allows configuration of team-specific commission rates through extended fields in the `teams` table, impacting overall commission distribution.
-   **Payment Verification**: Enhanced server-side payment verification (`/api/payments/:paymentId/verify`) is in place to prevent client-side manipulation.
-   **Standardized Evidence Upload**: A unified API (`/api/upload/evidence`) for various proof uploads (e.g., incident, closing, contract) with defined categories and reference types.
-   **Settlement Calculation Module**: A single, consolidated `settlement-calculator.ts` module ensures consistent financial calculations across all API interactions.

## External Dependencies

### Third-Party Services

-   **SMS Provider**: Solapi (for phone verification)
-   **OAuth Providers**: Kakao Login, Naver Login
-   **Identity Verification**: PortOne SDK
-   **Address Autocomplete**: Daum Postcode API
-   **Tax Invoice Provider**: Popbill API (전자세금계산서)

### Database

-   **PostgreSQL**: Compatible with Neon serverless.

### File Storage

-   **Replit Object Storage**: For storing images and documents.

## 보안 및 안정성 개선사항 (2026-01-21)

### 금액 조작 방지
- `POST /api/orders/:id/select-helper`에서 totalAmount를 클라이언트에서 받지 않고 서버에서 재계산
- 계산 공식: boxCount × pricePerUnit → VAT 포함 → 계약금 20%

### 레이스 컨디션 방지
- 헬퍼 선택 시 조건부 업데이트 (WHERE matchedHelperId IS NULL)
- 동시 요청 시 첫 번째만 성공, 나머지는 409 Conflict

### 푸시 알림 통합
- Expo Push API 지원 추가 (`sendExpoPushToUser` 함수)
- 토큰 타입 자동 감지: `ExponentPushToken[...]` → Expo API, 그 외 → FCM
- Web Push, FCM, Expo Push 병렬 발송

### API URL 유연성
- `EXPO_PUBLIC_API_PROTOCOL` 환경변수로 프로토콜 선택 가능 (기본: https)
- 전체 URL 포함 시 그대로 사용

### 관리자 인증 호환성
- `adminAuth`에서 `req.user`도 설정 (기존 라우트 호환)
- reviewerId가 undefined되는 버그 수정

### 코드 품질 개선
- `phoneNumberNumber` 오타 수정 → `phoneNumber`
- 모든 multer 업로드에 10MB 파일 크기 제한 확인

## 향후 리팩토링 필요

### JWT 수동 파싱 라우트 통일 (124개)
- 현재 `jwt.verify(token, JWT_SECRET)` 직접 호출하는 라우트 124개
- 권장: `requireAuth` 미들웨어로 점진적 통일
- 위험도가 높아 점진적 접근 필요

### 정산 계산 로직 단일화 (P1)
- 현재 상태: lib/settlement-calculator.ts (순수 계산), utils/settlement-calculator.ts (정책+저장)
- 적절한 관심사 분리이나, 클라이언트 화면에서 별도 계산하는 곳 존재
- 권장: 서버에서 breakdown 반환 → 클라이언트는 표시만

## 2026-01-21 추가 수정사항

### P0 버그 수정
- `ClosingReportScreen`: 이미지 업로드 필드명 `document-outline` → `file` 수정
- `ClosingReportScreen`: Authorization 헤더 추가 (401 에러 방지)
- 관리자 정산 API 추가: `/api/admin/settlements/daily`, `/helper`, `/requester`
- 권한 키 오타 수정: `settlement.view` → `settlements.view`
- 누락된 권한 15개 추가: settlements.edit/confirm/manage, orders.manage, payments.create/edit, disputes.edit, helpers.manage, users.view/edit, teams.delete, pricing.view/edit, support.view/edit
## 2026-01-21 정산 SSOT 구현

### 정산 스냅샷 시스템 (Single Source of Truth)
- **마감 시점 확정**: 헬퍼가 마감 제출 시 정산 금액이 스냅샷으로 저장됨
- **재계산 금지**: 정산 실행 및 요약 조회 시 스냅샷 값 우선 사용
- **정책 변경 대응**: 마감 후 정책 변경해도 기존 마감 건의 금액 불변

### closing_reports 테이블 추가 필드
- `supply_amount`: 공급가 (VAT 제외)
- `vat_amount`: 부가세 (10%)
- `total_amount`: 총액
- `platform_fee_rate`: 플랫폼 수수료율 (bp 단위)
- `platform_fee`: 플랫폼 수수료
- `net_amount`: 헬퍼 지급액
- `pricing_snapshot_json`: 정책 스냅샷

### 변경된 API 동작
- `POST /api/orders/:orderId/close`: 마감 시 정산 스냅샷 저장
- `POST /api/admin/orders/:orderId/settlement/execute`: 스냅샷 우선 사용
- `GET /api/orders/:orderId/closing-summary`: 스냅샷 우선 사용

### 기타 수정사항 (2026-01-21)
- Platform.OS "globe-outline" → "web" 수정 (5개 파일)
- 분쟁 라우트 권한 disputes.* 로 통일 (6개 라우트)
- extraCosts 스키마 통일 ({ code?, name?, amount, memo? })
- RBAC 삭제 로직 프로덕션 보호 (경고만, 삭제 안함)

## 2026-01-31 회원탈퇴 기능 구현

### Play Store 컴플라이언스 대응
- 계정 삭제 기능 필수 요구사항 충족

### 백엔드 API
- `POST /api/auth/withdraw`: 회원탈퇴 API
  - 비밀번호 확인 (소셜 로그인 제외)
  - 진행 중인 오더 검증
  - 미정산 건 검증
  - 감사 로그 기록
  - Soft delete 방식 (isActive: false, email 변경)
  - 모든 리프레시 토큰 무효화

### 프론트엔드
- `WithdrawAccountScreen.tsx`: 회원탈퇴 화면
  - 경고 안내 카드
  - 탈퇴 사유 선택 (5가지)
  - 2단계 확인 절차 (사유 선택 → 비밀번호 입력)
- `SettingsScreen.tsx`: 계정 관리 섹션에 회원탈퇴 메뉴 추가
- `ProfileStackNavigator.tsx`: 회원탈퇴 화면 네비게이션 등록

### 데이터베이스
- users 테이블에 `is_active`, `deleted_at` 컬럼 추가

## 2026-02-03 이의제기 시스템 앱 관리자 기능

### 시스템 구분
- **이의제기 (Dispute)**: 헬퍼 또는 요청자가 정산/결제 관련 분쟁 제기 → `disputes` 테이블
- **사고접수 (Incident Report)**: 요청자가 배송 사고 신고 → `incident_reports` 테이블

### 관리자 메뉴 구조 (4개 메뉴)
1. **이의제기관리**: 헬퍼/요청자의 서비스, 정산, 계산서 관련 민원 → 관리자 대응
2. **화물사고접수**: 분실/오배송/파손/지연 등 요청자 신고 → 헬퍼 대응, 관리자 결정
3. **화물사고차감**: 헬퍼 차감 금액 확정
4. **화물사고환불**: 요청자 환불 확정

### 앱 관리자용 API 엔드포인트
- `GET /api/admin/helper-disputes` - 전체 이의제기 목록
- `GET /api/admin/helper-disputes/:id` - 이의제기 상세 정보
- `PATCH /api/admin/helper-disputes/:id/status` - 상태 변경 및 관리자 답변
- `GET /api/admin/incident-reports` - 화물사고 접수 목록
- `GET /api/admin/incident-deductions` - 차감 대기/완료 목록
- `GET /api/admin/incident-refunds` - 환불 대기/완료 목록
- `PATCH /api/admin/incident-reports/:id/confirm-deduction` - 헬퍼 차감 확정
- `PATCH /api/admin/incident-reports/:id/confirm-refund` - 요청자 환불 확정

### 이의제기 유형
- settlement_error: 정산 금액 오류
- invoice_error: 세금계산서 오류  
- contract_dispute: 계약 조건 분쟁
- service_complaint: 서비스 불만
- delay: 일정 관련
- other: 기타

### 사고 유형
- damage: 파손
- loss: 분실
- misdelivery: 오배송
- delay: 지연배송
- other: 기타

### 관리자 답변 필드
- `adminReply`: 관리자 답변 내용
- `adminReplyAt`: 답변 시간
- `adminReplyBy`: 답변 관리자 ID

### 접근 권한
- admin 또는 superadmin 역할의 사용자가 설정 메뉴에서 관리자 기능 접근
- disputes.view, disputes.edit 권한 필요
