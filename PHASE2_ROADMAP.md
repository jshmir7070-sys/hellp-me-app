# 📋 Phase 2: 법적 완성도 강화 및 관리자 연동

## 🎯 목표

기본 시스템(Phase 1 - 100% 완료)에 다음 기능을 추가:
1. **법적 안전성**: 채권추심 가능한 계약서 시스템
2. **관리자 연동**: 헬퍼 서류/차량 검토 시스템
3. **연체 관리**: 자동 독촉 및 추심 프로세스

---

## ✅ 완료된 작업 (2026-02-09)

### C1: DB 스키마 수정
- [x] `contracts` 테이블에 동의 필드 12개 추가
  - 요청자: 연체이자, 채권추심, 연대보증
  - 헬퍼: 서류 의무, 차량 관리, 허위 서류 책임
  - 각 항목별 타임스탬프 (법적 증거력)
- [x] `payments` 테이블에 연체 필드 8개 추가
  - 상태: normal/warning/overdue/collection/legal
  - 연체일수, 지연손해금, 독촉 이력
  - 서비스 제한, 추심, 법적조치 시각
- [x] 마이그레이션 SQL 파일 생성 (`002_phase2_contracts_payments.sql`)

---

## 📌 진행 중 작업

### 1단계: DB + 서버 기반 (예상 2~3일)

#### A12: payment.routes.ts - 연체 엔드포인트 추가
```typescript
GET  /api/admin/payments/overdue           // 연체 목록
POST /api/admin/payments/:id/send-reminder // 독촉 발송
POST /api/admin/payments/:id/restrict      // 서비스 제한
POST /api/admin/payments/:id/collection    // 추심 위탁
GET  /api/payments/my-overdue              // 요청자용 연체 조회
```

#### A10, A11: payment.controller.ts + payment.service.ts
- 연체 체크 로직
- 연체이자 계산 (연 15%, 일할)
- 독촉 발송 트리거
- 서비스 이용 제한 API

#### A13: overdue-scheduler.ts (신규)
- 매일 자정 연체 오더 스캔
- 단계별 자동 독촉 (D+0, D+3, D+7, D+14, D+30)
- 지연손해금 자동 누적

#### B7: helper.routes.ts - 주석 해제 (⚡ 빠른 개선)
```typescript
// 이미 주석 처리된 11개 엔드포인트 활성화 (462~493줄)
GET  /api/admin/helper-vehicles               // 차량 목록
GET  /api/admin/helper-licenses               // 자격증 목록
GET  /api/admin/helper-credentials            // 전체 서류 목록
GET  /api/admin/document-review-tasks         // 서류 검토 대기열 ⭐
POST /api/admin/document-review-tasks/:taskId // 서류 승인/반려 ⭐
GET  /api/admin/helpers/onboarding            // 온보딩 현황 ⭐
POST /api/admin/helpers/:id/onboarding/approve // 온보딩 승인 ⭐
POST /api/admin/helpers/:id/onboarding/reject  // 온보딩 반려 ⭐
```

#### B8, B9: helper.controller.ts + helper.service.ts
- `getDocumentReviewTasks()` - 서류 검토 대기열
- `reviewDocument()` - 서류 개별 승인/반려
- `approveOnboarding()` - 온보딩 전체 승인
- `rejectOnboarding()` - 온보딩 반려 + 사유
- 서류 반려 시 Push 알림 발송

---

### 2단계: 앱 수정 (예상 2~3일)

#### A1: CreateContractScreen.tsx ⚠️ 법적 리스크
**현재 문제**: 아이콘만 표시, 실제 체크 없이 통과 가능
**수정 사항**:
- 아이콘(✓) → 실제 체크박스 변경
- 연체이자 조항 체크박스 추가
- 채권추심 동의 체크박스 추가
- 연대보증 체크박스 추가 (법인)
- `allTermsAgreed` 검증에 신규 항목 포함
- 서버 전송 시 각 동의 여부 + 타임스탬프

#### B1: ContractSigningScreen.tsx ⚠️ 법적 리스크
**수정 사항**:
- `CONTRACT_CONTENT`에 조항 추가:
  - 제○조 서류 제출 의무
  - 제○조 차량 정보 관리 의무
  - 제○조 허위 서류 시 법적 책임
- 동의 체크박스 3개 추가
- `allRequiredAgreed` 검증 강화

#### B2: HelperOnboardingScreen.tsx ⭐ 관리자 연동
**현재 문제**: 서류 업로드만 가능, 검토 상태 표시 없음
**수정 사항**:
- 서류별 검토 상태 실시간 표시 (대기중/승인/반려)
- 반려 시 사유 표시 + 재업로드 안내
- `GET /api/helpers/onboarding-status` 조회
- 전체 서류 승인 전까지 계약 버튼 비활성화

#### A3, A4: PaymentScreen.tsx + HomeScreen.tsx
- 잔금 결제 기한 경고 (D-3, D-1)
- 연체 시 경고 배너 + 지연손해금 표시

#### B3, B4: ProfileScreen.tsx + EditProfileScreen.tsx
- 서류 관리 섹션 추가
- 차량 정보 변경 시 재승인 안내

---

### 3단계: 관리자 패널 (예상 2~3일)

#### A15: OverduePaymentsPage.tsx (신규) ⭐
**완전히 새로운 페이지**:
- 연체 오더 목록 (입금일, 연체일수, 지연손해금)
- 단계별 상태 (경고→독촉→제한→추심→소송)
- 독촉 발송 버튼 (SMS/내용증명)
- 채권추심 위탁 기록
- 연체 이력 타임라인

#### B11: DocumentReviewPage.tsx (신규) ⭐
**서류 검토 전용 페이지**:
- 대기/승인/반려 필터 탭
- 서류별 이미지 미리보기
- 이미지 확대 모달
- 승인/반려 버튼 (인라인 액션)
- 반려 사유 입력 모달

#### B12: HelperOnboardingPage.tsx (신규) ⭐
**온보딩 현황 매트릭스**:
- 헬퍼별 서류 5종 + 계약 + 본인인증 상태
- 컬러코드: ✅승인 / ⏳대기 / ❌반려 / ⬜미제출
- 헬퍼 클릭 → 서류 상세 드로어
- 전체 승인/반려 액션

#### A14, B13, B14, A16: 기존 페이지 보강
- `BalancePaymentsPage.tsx`: 연체 탭 추가
- `HelpersPendingPage.tsx`: 서류 상태 컬럼
- `HelperDetailPage.tsx`: 서류 탭 추가
- `RequesterDetailPage.tsx`: 연체 이력

#### A18, A19, B16, B17: 라우팅 & 메뉴
- 신규 라우트 3개 추가
- 사이드바 메뉴 3개 추가

---

## 📊 진행 상황

```
[███████░░░░░░░░░░░] 35% 완료

✅ Phase 1: 기본 시스템                    100%
✅ Phase 2-C1: DB 스키마                  100%
⏳ Phase 2-1단계: 서버 기반                 0%
⏳ Phase 2-2단계: 앱 수정                  0%
⏳ Phase 2-3단계: 관리자 패널               0%
```

---

## 🚀 다음 작업

### 즉시 시작 가능 (1~2시간)
1. **B7**: `helper.routes.ts` 주석 해제 (간단!)
2. **A1**: `CreateContractScreen` 체크박스 수정
3. **B1**: `ContractSigningScreen` 조항 추가

### 우선순위 높음 (법적 리스크)
- A1, B1: 계약 체크박스 실제 동작
- A12, A10, A11, A13: 연체 관리 시스템

### 관리자 연동 우선
- B7~B9: 서류 검토 API
- B11, B12: 관리자 서류 검토 페이지

---

## 💡 작업 순서 (권장)

### 옵션 1: 법적 안전성 우선
```
A1 → B1 → A12 → A10 → A11 → A13
(계약 체크박스 → 연체 시스템 구축)
예상 소요: 3~4일
```

### 옵션 2: 관리자 연동 우선
```
B7 → B8 → B9 → B11 → B12 → B2
(서류 검토 API → 관리자 페이지 → 앱 연동)
예상 소요: 3~4일
```

### 옵션 3: 병렬 진행 (팀 작업)
```
팀 A: A1, B1, A3, A4 (앱 UI)
팀 B: A12, A10, A11, A13 (연체 시스템)
팀 C: B7, B8, B9 (서류 검토 API)
팀 D: A15, B11, B12 (관리자 페이지)
예상 소요: 2~3일 (병렬)
```

---

## 📋 체크리스트

### DB & 인프라
- [x] contracts 스키마 수정
- [x] payments 스키마 수정
- [x] 마이그레이션 SQL 생성
- [ ] 마이그레이션 실행
- [ ] WebSocket 이벤트 추가
- [ ] SMS 템플릿 추가
- [ ] Push 알림 템플릿 추가

### 서버 API
- [ ] helper.routes.ts 주석 해제
- [ ] payment.routes.ts 연체 엔드포인트
- [ ] helper.controller.ts 서류 검토 메서드
- [ ] payment.controller.ts 연체 관리 메서드
- [ ] overdue-scheduler.ts 생성
- [ ] contract.service.ts PDF 생성

### 앱 (client)
- [ ] CreateContractScreen 체크박스 수정
- [ ] ContractSigningScreen 조항 추가
- [ ] HelperOnboardingScreen 상태 표시
- [ ] PaymentScreen 연체 경고
- [ ] HomeScreen 배너 추가
- [ ] ProfileScreen 서류 관리
- [ ] SignupScreen 약관 강화

### 관리자 패널
- [ ] OverduePaymentsPage 생성
- [ ] DocumentReviewPage 생성
- [ ] HelperOnboardingPage 생성
- [ ] 기존 페이지 보강 (4개)
- [ ] 라우팅 설정
- [ ] 사이드바 메뉴 추가

---

## 📌 참고

- **작업 파일 맵**: 상세 내역은 별도 문서 참조
- **예상 총 소요 기간**: 7~11일 (단독), 2~3일 (팀 병렬)
- **우선순위**: 법적 리스크(A1, B1) > 연체 관리 > 서류 검토

---

**마지막 업데이트**: 2026-02-09
**현재 상태**: DB 스키마 완료, 서버 개발 대기 중
