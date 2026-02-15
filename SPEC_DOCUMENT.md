# Hellp Me - 네이티브 앱 전환 스펙 문서

## 개요

Hellp Me는 배송 기사(헬퍼)와 배송이 필요한 업체(요청자)를 연결하는 매칭 서비스 플랫폼입니다.
Expo React Native 기반 모바일 앱 + Express.js 백엔드 + PostgreSQL 데이터베이스로 구성됩니다.

---

## 1. 현재 구현 상태

### 1.1 클라이언트 화면 (구현 완료)

| 화면 | 파일 | 상태 | 설명 |
|------|------|------|------|
| 로그인 | LoginScreen.tsx | ✅ 완료 | 이메일/비밀번호 + 소셜 로그인 버튼 |
| 회원가입 | SignupScreen.tsx | ✅ 완료 | SMS 인증 + 역할 선택 |
| 홈 | HomeScreen.tsx | ✅ 완료 | 역할별 대시보드 |
| 프로필 | ProfileScreen.tsx | ✅ 완료 | 사용자 정보 조회 |
| 프로필 수정 | EditProfileScreen.tsx | ✅ 완료 | 사용자 정보 수정 |
| 설정 | SettingsScreen.tsx | ✅ 완료 | 앱 설정 |
| 알림 | NotificationsScreen.tsx | ✅ 완료 | 알림 목록 |
| 오더 목록 | JobListScreen.tsx | ✅ 완료 | 헬퍼용 오더 공고 목록 |
| 오더 상세 | JobDetailScreen.tsx | ✅ 완료 | 오더 상세 + 신청 |
| 내 업무 | MyJobsScreen.tsx | ✅ 완료 | 내가 신청/매칭된 오더 |
| 업무 확인 | WorkConfirmationScreen.tsx | ✅ 완료 | 업무 완료 확인 |
| 계약 목록 | ContractsScreen.tsx | ✅ 완료 | 계약 목록 조회 |
| 계약 상세 | ContractScreen.tsx | ✅ 완료 | 계약 상세 + 서명 |
| 결제 | PaymentScreen.tsx | ✅ 완료 | PortOne WebView 결제 |
| QR 스캐너 | QRScannerScreen.tsx | ✅ 완료 | QR 기반 체크인 |
| QR 체크인 | QRCheckinScreen.tsx | ✅ 완료 | QR 체크인 결과 |
| 업무 증빙 | WorkProofScreen.tsx | ✅ 완료 | 사진 촬영/업로드 |
| 헬퍼 온보딩 | HelperOnboardingScreen.tsx | ✅ 완료 | 서류 제출 |
| 오더 생성 | CreateJobScreen.tsx | ✅ 완료 | 요청자용 오더 생성 |
| 결제 설정 | PaymentSettingsScreen.tsx | ✅ 완료 | 결제 관련 설정 |
| 정산 내역 | SettlementHistoryScreen.tsx | ✅ 완료 | 정산 내역 조회 |
| 환불 계좌 | RefundAccountScreen.tsx | ✅ 완료 | 환불 계좌 등록 |
| 팀 관리 | TeamManagementScreen.tsx | ✅ 완료 | 팀장용 팀 관리 |
| 팀 생성 | CreateTeamScreen.tsx | ✅ 완료 | 팀 생성 |
| 채용 공고 | RecruitmentScreen.tsx | ✅ 완료 | 지입 채용 목록 |
| 채용 상세 | RecruitmentDetailScreen.tsx | ✅ 완료 | 채용 상세 |
| 리뷰 | ReviewsScreen.tsx | ✅ 완료 | 리뷰 작성/조회 |

### 1.2 컴포넌트 (구현 완료)

| 컴포넌트 | 파일 | 상태 | 설명 |
|----------|------|------|------|
| AddressInput | AddressInput.tsx | ✅ 완료 | 카카오 주소 자동완성 |
| ThemedText | ThemedText.tsx | ✅ 완료 | 테마 적용 텍스트 |
| ThemedView | ThemedView.tsx | ✅ 완료 | 테마 적용 뷰 |
| Card | Card.tsx | ✅ 완료 | 카드 컴포넌트 |
| Button | Button.tsx | ✅ 완료 | 버튼 컴포넌트 |
| ErrorBoundary | ErrorBoundary.tsx | ✅ 완료 | 에러 경계 |

### 1.3 서버 API 엔드포인트 (구현 완료)

#### 인증 (Auth)
| 엔드포인트 | 메서드 | 상태 | 설명 |
|------------|--------|------|------|
| /api/auth/signup | POST | ✅ 완료 | 회원가입 |
| /api/auth/login | POST | ✅ 완료 | 로그인 |
| /api/auth/logout | POST | ✅ 완료 | 로그아웃 |
| /api/auth/refresh | POST | ✅ 완료 | 토큰 갱신 |
| /api/auth/me | GET | ✅ 완료 | 현재 사용자 정보 |
| /api/auth/check-email | POST | ✅ 완료 | 이메일 중복 확인 |
| /api/auth/find-email | POST | ✅ 완료 | 이메일 찾기 |
| /api/auth/reset-password | POST | ✅ 완료 | 비밀번호 재설정 |
| /api/auth/send-signup-code | POST | ✅ 완료 | 회원가입 인증 코드 발송 |
| /api/auth/verify-signup-code | POST | ✅ 완료 | 회원가입 인증 코드 확인 |
| /api/auth/send-phone-code | POST | ✅ 완료 | 휴대폰 인증 코드 발송 |
| /api/auth/verify-phone | POST | ✅ 완료 | 휴대폰 인증 확인 |
| /api/auth/create-identity-verification | POST | ✅ 완료 | 본인인증 세션 생성 |
| /api/auth/verify-identity | POST | ✅ 완료 | 본인인증 확인 |
| /api/auth/kakao | GET | ✅ 완료 | 카카오 로그인 |
| /api/auth/naver | GET | ✅ 완료 | 네이버 로그인 |

#### 오더 (Orders)
| 엔드포인트 | 메서드 | 상태 | 설명 |
|------------|--------|------|------|
| /api/orders | GET | ✅ 완료 | 오더 목록 |
| /api/orders/:id | GET | ✅ 완료 | 오더 상세 |
| /api/orders | POST | ✅ 완료 | 오더 생성 |
| /api/orders/:id/apply | POST | ✅ 완료 | 오더 신청 |
| /api/orders/my | GET | ✅ 완료 | 내 오더 목록 |
| /api/orders/scheduled | GET | ✅ 완료 | 예정된 오더 |
| /api/orders/my-applications | GET | ✅ 완료 | 내 신청 목록 |
| /api/requester/orders | GET | ✅ 완료 | 요청자 오더 목록 |

#### 계약 (Contracts)
| 엔드포인트 | 메서드 | 상태 | 설명 |
|------------|--------|------|------|
| /api/contracts | POST | ✅ 완료 | 계약 생성 |
| /api/contracts | GET | ✅ 완료 | 계약 목록 |
| /api/contracts/:id | GET | ✅ 완료 | 계약 상세 |
| /api/contracts/:id/payment | GET | ✅ 완료 | 계약 결제 정보 |
| /api/contracts/:id/deposit | PATCH | ✅ 완료 | 계약금 확인 |
| /api/contracts/:id/balance | PATCH | ✅ 완료 | 잔금 확인 |

#### 결제 (Payment)
| 엔드포인트 | 메서드 | 상태 | 설명 |
|------------|--------|------|------|
| /api/payment/virtual-account/request | POST | ✅ 완료 | 가상계좌 요청 |
| /api/payment/virtual-account/:orderId | GET | ✅ 완료 | 가상계좌 조회 |
| /api/webhook/portone/payment | POST | ✅ 완료 | PortOne 웹훅 |
| /api/payments/intent | POST | ❌ 미구현 | 결제 인텐트 생성 (필요) |

#### 헬퍼 (Helpers)
| 엔드포인트 | 메서드 | 상태 | 설명 |
|------------|--------|------|------|
| /api/helpers/credential | POST/GET | ✅ 완료 | 자격증명 |
| /api/helpers/vehicle | POST/GET | ✅ 완료 | 차량 정보 |
| /api/helpers/business | POST/GET | ✅ 완료 | 사업자 정보 |
| /api/helpers/bank-account | POST/GET | ✅ 완료 | 계좌 정보 |
| /api/helpers/license | POST/GET | ✅ 완료 | 면허 정보 |
| /api/helpers/onboarding-status | GET | ✅ 완료 | 온보딩 상태 |
| /api/helper/terms-agreement | POST/GET | ✅ 완료 | 약관 동의 |
| /api/helper/service-areas | POST/GET | ✅ 완료 | 서비스 지역 |
| /api/helper/work-history | GET | ✅ 완료 | 업무 이력 |
| /api/helper/disputes | POST/GET | ✅ 완료 | 분쟁 신청 |
| /api/helper/reviews | POST | ✅ 완료 | 리뷰 작성 |

#### 알림 (Notifications)
| 엔드포인트 | 메서드 | 상태 | 설명 |
|------------|--------|------|------|
| /api/notifications | GET | ✅ 완료 | 알림 목록 |
| /api/notifications/unread-count | GET | ✅ 완료 | 읽지 않은 알림 수 |
| /api/notifications/:id/read | POST | ✅ 완료 | 알림 읽음 처리 |
| /api/notifications/read-all | POST | ✅ 완료 | 전체 읽음 처리 |

#### 파일 업로드
| 엔드포인트 | 메서드 | 상태 | 설명 |
|------------|--------|------|------|
| /api/work-proof/upload | POST | ✅ 완료 | 업무 증빙 업로드 |
| /api/orders/image/upload | POST | ✅ 완료 | 오더 이미지 업로드 |
| /uploads/* | GET | ✅ 완료 | 파일 조회 |

---

## 2. 추가 필요 기능

### 2.1 백엔드 결제 API (우선순위: 높음)

**필요한 엔드포인트:**

```typescript
// POST /api/payments/intent
// 보안 결제 인텐트 생성 (토큰을 WebView에 노출하지 않음)
{
  orderId: string;
  contractId: string;
  amount: number;
  paymentType: 'deposit' | 'balance';
  orderTitle: string;
}

// Response
{
  paymentUrl: string; // PortOne 결제 페이지 URL
  paymentId: string;  // 결제 ID
  expiresAt: string;  // URL 만료 시간
}
```

**구현 파일:**
- `server/routes.ts` - `/api/payments/intent` 엔드포인트 추가
- PortOne API 연동 로직

### 2.2 본인인증 네이티브 연동 (우선순위: 높음)

**현재 상태:**
- 서버에 `/api/auth/create-identity-verification`, `/api/auth/verify-identity` 존재
- 네이티브 앱에서 PortOne 본인인증 SDK 호출 필요

**필요한 구현:**
| 파일 | 설명 |
|------|------|
| client/screens/IdentityVerificationScreen.tsx | 본인인증 화면 |
| client/utils/portone.ts | PortOne SDK 래퍼 |

**플로우:**
1. 서버에서 인증 세션 생성 (`/api/auth/create-identity-verification`)
2. 네이티브 WebView에서 PortOne 본인인증 페이지 로드
3. 인증 완료 후 결과 수신
4. 서버에서 결과 검증 (`/api/auth/verify-identity`)

### 2.3 푸시 알림 + 딥링크 (우선순위: 높음)

**필요한 구현:**

| 파일 | 설명 |
|------|------|
| client/utils/push-notifications.ts | FCM 토큰 관리 |
| client/utils/deep-linking.ts | 딥링크 라우팅 |
| server/push-service.ts | 푸시 발송 서비스 |

**서버 엔드포인트:**
```typescript
// POST /api/push/register-token
{
  token: string;
  platform: 'ios' | 'android';
}

// POST /api/push/unregister-token
{
  token: string;
}
```

**DB 스키마 추가:**
```typescript
export const pushTokens = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull(),
  platform: text("platform").notNull(), // ios, android
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

**푸시 알림 유형:**
- 매칭 성공/실패
- 오더 상태 변경
- 정산 완료
- 분쟁 접수/처리
- 공지사항

### 2.4 위치 추적 (우선순위: 중간)

**필요한 구현:**

| 파일 | 설명 |
|------|------|
| client/utils/location-service.ts | 위치 권한/업데이트 관리 |
| client/screens/LocationConsentScreen.tsx | 위치 동의 화면 |

**서버 엔드포인트:**
```typescript
// POST /api/location/update
{
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

// GET /api/location/latest/:userId (관리자용)
```

**플로우:**
1. 업무 시작 시 위치 동의 확인
2. 체크인 후 주기적 위치 업데이트 (5분 간격)
3. 체크아웃 시 위치 추적 중단

---

## 3. 데이터베이스 스키마

### 3.1 주요 테이블 (구현 완료)

| 테이블 | 설명 |
|--------|------|
| users | 사용자 (헬퍼/요청자/관리자) |
| teams | 팀 |
| team_members | 팀원 |
| helper_credentials | 헬퍼 자격증명 |
| helper_vehicles | 헬퍼 차량 |
| helper_businesses | 헬퍼 사업자 정보 |
| helper_bank_accounts | 헬퍼 계좌 |
| helper_licenses | 헬퍼 면허 |
| helper_service_areas | 헬퍼 서비스 지역 |
| helper_terms_agreements | 헬퍼 약관 동의 |
| requester_businesses | 요청자 사업자 정보 |
| requester_refund_accounts | 요청자 환불 계좌 |
| requester_service_agreements | 요청자 서비스 계약 |
| orders | 배송 오더 |
| order_applications | 오더 신청 |
| check_in_records | 체크인 기록 |
| notifications | 알림 |
| notification_logs | 알림 발송 로그 |
| job_postings | 채용 공고 |

### 3.2 추가 필요 테이블

```typescript
// 푸시 토큰
export const pushTokens = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  platform: text("platform").notNull(),
  deviceInfo: text("device_info"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 위치 로그 (이미 존재할 수 있음)
export const userLocationLogs = pgTable("user_location_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  accuracy: integer("accuracy"),
  recordedAt: timestamp("recorded_at").defaultNow(),
});
```

---

## 4. 작업 티켓 (스토리 포인트)

### Phase 3: 백엔드 결제 API

| 티켓 ID | 작업 | SP | 난이도 | 예상 시간 |
|---------|------|----|----|----------|
| BE-001 | /api/payments/intent 엔드포인트 구현 | 5 | 중 | 2시간 |
| BE-002 | PortOne 결제 URL 생성 로직 | 3 | 중 | 1시간 |
| BE-003 | 결제 상태 관리 및 검증 | 5 | 중 | 2시간 |
| **소계** | | **13** | | **5시간** |

### Phase 4: 본인인증 연동

| 티켓 ID | 작업 | SP | 난이도 | 예상 시간 |
|---------|------|----|----|----------|
| IV-001 | IdentityVerificationScreen 생성 | 5 | 중 | 2시간 |
| IV-002 | PortOne 본인인증 WebView 연동 | 8 | 상 | 4시간 |
| IV-003 | 인증 결과 처리 및 저장 | 3 | 중 | 1시간 |
| IV-004 | 회원가입 플로우 연동 | 3 | 하 | 1시간 |
| **소계** | | **19** | | **8시간** |

### Phase 5: 푸시 알림

| 티켓 ID | 작업 | SP | 난이도 | 예상 시간 |
|---------|------|----|----|----------|
| PN-001 | expo-notifications 설정 | 3 | 하 | 1시간 |
| PN-002 | FCM 토큰 등록/해제 API | 3 | 중 | 1시간 |
| PN-003 | 푸시 토큰 DB 스키마 추가 | 2 | 하 | 30분 |
| PN-004 | 서버 푸시 발송 서비스 | 8 | 상 | 4시간 |
| PN-005 | 딥링크 라우팅 구현 | 5 | 중 | 2시간 |
| PN-006 | 알림 클릭 시 화면 이동 | 3 | 중 | 1시간 |
| **소계** | | **24** | | **9.5시간** |

### Phase 6: 위치 추적

| 티켓 ID | 작업 | SP | 난이도 | 예상 시간 |
|---------|------|----|----|----------|
| LO-001 | expo-location 권한 요청 | 3 | 중 | 1시간 |
| LO-002 | 위치 동의 화면 | 3 | 하 | 1시간 |
| LO-003 | 위치 업데이트 서비스 | 5 | 중 | 2시간 |
| LO-004 | 서버 위치 저장 API | 3 | 하 | 1시간 |
| LO-005 | 업무 중 위치 추적 연동 | 5 | 중 | 2시간 |
| **소계** | | **19** | | **7시간** |

### 전체 요약

| Phase | 작업 | SP | 예상 시간 |
|-------|------|----|----|
| Phase 3 | 백엔드 결제 API | 13 | 5시간 |
| Phase 4 | 본인인증 연동 | 19 | 8시간 |
| Phase 5 | 푸시 알림 | 24 | 9.5시간 |
| Phase 6 | 위치 추적 | 19 | 7시간 |
| **총계** | | **75** | **29.5시간** |

---

## 5. 아키텍처 다이어그램

### 5.1 전체 시스템 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                        클라이언트 (Expo)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ 헬퍼 앱     │  │ 헬프미 앱   │  │ 공통 컴포넌트           │ │
│  │ - 오더 목록 │  │ - 오더 생성 │  │ - ThemedText/View      │ │
│  │ - QR 체크인 │  │ - 결제      │  │ - Card/Button          │ │
│  │ - 업무 증빙 │  │ - 계약 관리 │  │ - AddressInput         │ │
│  │ - 정산 조회 │  │ - 리뷰      │  │ - ErrorBoundary        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                            │                                    │
│  ┌─────────────────────────┴─────────────────────────────────┐ │
│  │               React Navigation + TanStack Query            │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      백엔드 (Express.js)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Auth        │  │ Orders      │  │ Payments                │ │
│  │ - JWT       │  │ - CRUD      │  │ - PortOne               │ │
│  │ - OAuth     │  │ - 매칭      │  │ - 가상계좌              │ │
│  │ - SMS 인증  │  │ - 상태관리  │  │ - 웹훅                  │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Helpers     │  │ Notifications│  │ Admin                   │ │
│  │ - 온보딩    │  │ - WebSocket │  │ - 정산 관리             │ │
│  │ - 서류 관리 │  │ - 푸시 (예정)│  │ - 분쟁 처리             │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     데이터베이스 (PostgreSQL)                    │
├─────────────────────────────────────────────────────────────────┤
│  users, teams, orders, contracts, settlements, notifications... │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 인증 플로우

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  앱      │────▶│  서버    │────▶│  SMS     │────▶│  사용자  │
│          │     │          │     │ (Solapi) │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                                  │
     │  1. 인증코드   │                                  │
     │     요청       │                                  │
     │───────────────▶│                                  │
     │                │  2. SMS 발송                     │
     │                │─────────────────────────────────▶│
     │                │                                  │
     │                │                    3. 코드 확인  │
     │                │◀─────────────────────────────────│
     │  4. 코드 검증  │                                  │
     │───────────────▶│                                  │
     │                │                                  │
     │  5. JWT 토큰   │                                  │
     │◀───────────────│                                  │
```

### 5.3 결제 플로우

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  앱      │────▶│  서버    │────▶│ PortOne  │────▶│  PG사    │
│          │     │          │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     │  1. 결제       │                │                │
     │     인텐트     │                │                │
     │───────────────▶│                │                │
     │                │  2. 결제 URL   │                │
     │  3. WebView    │◀───────────────│                │
     │     로드       │                │                │
     │◀───────────────│                │                │
     │                │                │  4. 결제 처리  │
     │────────────────────────────────▶│───────────────▶│
     │                │                │                │
     │                │  5. 웹훅       │                │
     │                │◀───────────────│                │
     │  6. 결제 완료  │                │                │
     │◀───────────────│                │                │
```

---

## 6. 환경 변수

### 6.1 필수 환경 변수

```bash
# 데이터베이스
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=your-secure-secret

# SMS (Solapi)
SOLAPI_API_KEY=...
SOLAPI_API_SECRET=...
SOLAPI_SENDER_ID=...

# OAuth
OAUTH_BASE_URL=https://your-domain.com
KAKAO_REST_API_KEY=...
KAKAO_CLIENT_SECRET=...
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...

# PortOne 결제
PORTONE_API_KEY=...
PORTONE_API_SECRET=...
PORTONE_STORE_ID=...
```

### 6.2 선택적 환경 변수

```bash
# 푸시 알림 (Phase 5에서 필요)
VAPID_PRIVATE_KEY=...
FIREBASE_SERVICE_ACCOUNT_KEY=...

# 파일 저장소
OBJECT_STORAGE_BUCKET=...
```

---

## 7. 다음 단계

1. **Phase 3**: 백엔드 결제 API 완성
   - `/api/payments/intent` 엔드포인트 구현
   - PortOne 결제 URL 생성 로직
   
2. **Phase 4**: 본인인증 네이티브 연동
   - IdentityVerificationScreen 생성
   - PortOne 본인인증 WebView 통합
   
3. **Phase 5**: 푸시 알림 + 딥링크
   - expo-notifications 설정
   - FCM 토큰 관리
   - 딥링크 라우팅
   
4. **Phase 6**: 위치 추적
   - expo-location 권한 관리
   - 업무 중 위치 업데이트

---

*문서 작성일: 2026년 1월 14일*
*버전: 1.0*
