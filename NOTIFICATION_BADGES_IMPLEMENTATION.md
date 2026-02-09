# 사이드바 알림 배지 시스템 구현 완료 ✅

## 개요
관리자 패널 사이드바에 실시간 알림 배지 시스템을 구현했습니다.
신규 오더, 헬퍼 승인, 이의제기, 사고, CS 등의 미처리 건수가 메뉴 아이템에 실시간으로 표시됩니다.

## 구현 내역

### 1. 새로운 Hook: `useMenuBadges` 📊
**파일**: `admin/src/hooks/useMenuBadges.ts`

#### 기능
- Task Queue API에서 미처리 작업 카운트 조회
- WebSocket을 통한 실시간 배지 업데이트
- 30초마다 자동 갱신

#### 배지 카운트 항목
```typescript
interface MenuBadgeCounts {
  // 오더 운영
  orders: number;              // 실시간 오더 관리 (승인 대기)
  closings: number;            // 오더 마감 자료

  // 헬퍼 관리
  helpersPending: number;      // 신규 헬퍼 승인 대기

  // 요청자 관리
  requestersPending: number;   // 신규 요청자 승인 대기

  // 이의제기/사고
  disputes: number;            // 이의제기 관리
  incidents: number;           // 화물사고 접수
  deductions: number;          // 화물사고 차감
  incidentRefunds: number;     // 화물사고 환불

  // CS
  cs: number;                  // CS 문의

  // 정산
  settlementDaily: number;     // 일정산
  settlementHelper: number;    // 헬퍼정산
  settlementRequester: number; // 요청자정산

  // 결제 및 환불
  paymentsDeposit: number;     // 계약금 결제
  paymentsBalance: number;     // 잔금 결제
  refunds: number;             // 환불

  // 업무 대기함
  taskQueue: number;           // 업무 대기함 총 개수
}
```

#### Task Type 매핑
- `order_approval` → orders (오더 승인 대기)
- `helper_verification` → helpersPending (헬퍼 인증 대기)
- `requester_verification` → requestersPending (요청자 인증 대기)
- `settlement_approval` → settlementHelper (정산 승인 대기)
- `dispute_resolution` → disputes (이의제기 처리)
- `incident_review` → incidents (사고 검토)
- `cs_inquiry` → cs (CS 문의)
- `refund_request` → refunds (환불 요청)
- `payment_confirmation` → paymentsDeposit (결제 확인)

### 2. Layout 컴포넌트 업데이트 🎨
**파일**: `admin/src/components/Layout.tsx`

#### 변경사항
1. **useMenuBadges Hook 추가**
   ```typescript
   const badges = useMenuBadges();
   ```

2. **동적 네비게이션 그룹 생성**
   ```typescript
   const navGroups = useMemo(() => createNavGroups(badges), [badges]);
   ```

3. **배지 표시 UI**
   - **확장 모드**: 텍스트 옆에 빨간 배지 표시
   - **축소 모드**: 아이콘 우측 상단에 작은 원형 배지 표시

#### 배지 디자인
- **색상**: `bg-destructive` (빨간색)
- **위치**:
  - 확장: `ml-auto` (오른쪽 정렬)
  - 축소: `absolute -top-1 -right-1` (아이콘 우측 상단)
- **크기**:
  - 확장: `px-1.5 py-0.5 rounded-full`
  - 축소: `h-4 w-4` (작은 원형)
- **최대값**: 9+ (10개 이상일 때)

### 3. WebSocket 실시간 업데이트 🔄

#### 구독 이벤트
```typescript
adminWebSocket.on('task_queue_updated', handleUpdate);
adminWebSocket.on('order_updated', handleUpdate);
adminWebSocket.on('settlement_updated', handleUpdate);
adminWebSocket.on('helper_verified', handleUpdate);
```

#### 업데이트 메커니즘
1. WebSocket 이벤트 수신
2. React Query 캐시 무효화
3. Task Queue API 재조회
4. 배지 카운트 재계산
5. UI 자동 업데이트

## 사용 예시

### 메뉴 아이템에 배지 표시
```typescript
{
  href: '/orders',
  label: '실시간오더관리',
  icon: <Package className="h-5 w-5" />,
  permission: PERMISSIONS.ORDERS_VIEW,
  badge: badges.orders  // 배지 카운트 적용
}
```

### 업무 대기함 총 개수
```typescript
{
  href: '/task-queue',
  label: '업무 대기함',
  icon: <Clock className="h-5 w-5" />,
  permission: PERMISSIONS.TASK_QUEUE_VIEW,
  badge: badges.taskQueue  // 모든 미처리 작업 합계
}
```

## 성능 최적화

1. **React Query 캐싱**
   - 30초 refetch interval
   - WebSocket 이벤트로 선택적 무효화

2. **useMemo 최적화**
   - navGroups를 메모이제이션하여 불필요한 재계산 방지

3. **조건부 렌더링**
   ```typescript
   {item.badge && item.badge > 0 ? (
     <span className="badge">{item.badge}</span>
   ) : null}
   ```

## API 엔드포인트

### Task Queue 조회
```
GET /api/admin/task-queue?limit=1000
```

**응답 예시**:
```json
{
  "success": true,
  "data": [
    {
      "taskType": "order_approval",
      "referenceId": 123,
      "priority": 1,
      "waitingMinutes": 45
    },
    {
      "taskType": "helper_verification",
      "referenceId": 456,
      "priority": 2,
      "waitingMinutes": 120
    }
  ],
  "total": 2
}
```

## 테스트

### 개발 서버 실행
```bash
cd admin && npm run dev
```

### 확인 사항
- ✅ 사이드바 확장 모드에서 배지 표시
- ✅ 사이드바 축소 모드에서 배지 표시 (아이콘 우측 상단)
- ✅ 배지 카운트 0일 때 숨김 처리
- ✅ 10개 이상일 때 "9+" 표시
- ✅ WebSocket 연결 시 실시간 업데이트
- ✅ 30초마다 자동 갱신

## 향후 개선 사항

### 1. 백엔드 확장
현재 Task Queue View에 다음 task_type 추가 필요:
- `requester_verification` (요청자 인증)
- `dispute_resolution` (이의제기 처리)
- `incident_review` (사고 검토)
- `cs_inquiry` (CS 문의)
- `refund_request` (환불 요청)
- `payment_confirmation` (결제 확인)

### 2. 알림 우선순위
긴급도에 따라 배지 색상 구분:
- 높음 (1순위): 빨간색 (destructive)
- 중간 (2순위): 주황색 (warning)
- 낮음 (3순위): 파란색 (primary)

### 3. 사운드 알림
새로운 작업 추가 시 알림음 재생 옵션

### 4. 배지 애니메이션
새 카운트 증가 시 펄스 애니메이션 효과

## 기술 스택

- **React 18**: UI 컴포넌트
- **TypeScript**: 타입 안정성
- **React Query**: 데이터 페칭 및 캐싱
- **WebSocket**: 실시간 업데이트
- **Tailwind CSS**: 스타일링
- **Lucide Icons**: 아이콘

## 참고 파일

1. `admin/src/hooks/useMenuBadges.ts` - 배지 카운트 Hook
2. `admin/src/components/Layout.tsx` - 사이드바 레이아웃
3. `admin/src/hooks/useAdminWebSocket.ts` - WebSocket Hook
4. `server/routes/admin.routes.ts` - API 엔드포인트
5. `server/db/views.ts` - Task Queue View 정의
6. `server/db/migrations/001_create_admin_views.sql` - DB 뷰 생성 SQL

## 완료 ✅

사이드바 알림 배지 시스템이 성공적으로 구현되었습니다!
- 실시간 카운트 업데이트
- WebSocket 연동
- 확장/축소 모드 모두 지원
- 성능 최적화 완료

관리자는 이제 좌측 메뉴에서 미처리 작업 건수를 한눈에 확인할 수 있습니다.
