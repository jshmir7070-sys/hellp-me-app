# 관리자 권한 시스템 가이드

## 📋 개요

관리자 페이지의 모든 액션 메뉴 키가 표준화되었습니다. 이제 일관된 네이밍 규칙을 따르는 권한 시스템을 사용합니다.

## 🎯 네이밍 규칙

### 메뉴 그룹 키
```
MENU_{카테고리}
예: MENU_KEYS.ORDERS, MENU_KEYS.SETTLEMENTS
```

### 액션 권한 키
```
{모듈}.{액션}
예: orders.view, settlements.approve, helpers.create
```

### 액션 타입
- **view** - 조회
- **create** - 생성
- **update** - 수정
- **delete** - 삭제
- **approve** - 승인
- **manage** - 전체 관리

## 📦 사용 방법

### 1. 상수 import
```typescript
import { MENU_KEYS, PERMISSIONS } from '@/constants/permissions';
```

### 2. 컴포넌트에서 권한 확인
```typescript
import { useAuth } from '@/contexts/AuthContext';
import { PERMISSIONS } from '@/constants/permissions';

function OrdersPage() {
  const { hasPermission } = useAuth();

  // 권한 확인
  if (!hasPermission(PERMISSIONS.ORDERS_VIEW)) {
    return <AccessDenied />;
  }

  // 버튼 비활성화
  const canApprove = hasPermission(PERMISSIONS.ORDERS_APPROVE);

  return (
    <div>
      {/* 조회 권한이 있으면 표시 */}
      <OrderList />

      {/* 승인 권한이 있을 때만 표시 */}
      {canApprove && <ApproveButton />}
    </div>
  );
}
```

### 3. API 라우트에서 권한 확인
```typescript
// server/middleware/permissions.ts
import { PERMISSIONS } from '@/constants/permissions';

router.post('/orders/:id/approve',
  requirePermission(PERMISSIONS.ORDERS_APPROVE),
  async (req, res) => {
    // 승인 로직
  }
);
```

## 📚 전체 권한 목록

### 대시보드 & 업무 대기함
| 권한 키 | 설명 |
|---------|------|
| `PERMISSIONS.DASHBOARD_VIEW` | 대시보드 조회 |
| `PERMISSIONS.TASK_QUEUE_VIEW` | 업무 대기함 조회 |
| `PERMISSIONS.TASK_QUEUE_MANAGE` | 업무 대기함 관리 |

### 오더 관련
| 권한 키 | 설명 |
|---------|------|
| `PERMISSIONS.ORDERS_VIEW` | 오더 조회 |
| `PERMISSIONS.ORDERS_CREATE` | 오더 생성 |
| `PERMISSIONS.ORDERS_UPDATE` | 오더 수정 |
| `PERMISSIONS.ORDERS_DELETE` | 오더 삭제 |
| `PERMISSIONS.ORDERS_APPROVE` | 오더 승인 |
| `PERMISSIONS.ORDERS_CANCEL` | 오더 취소 |
| `PERMISSIONS.CLOSINGS_VIEW` | 마감 자료 조회 |
| `PERMISSIONS.CLOSINGS_UPDATE` | 마감 자료 수정 |
| `PERMISSIONS.CLOSINGS_APPROVE` | 마감 자료 승인 |

### 결제 & 환불
| 권한 키 | 설명 |
|---------|------|
| `PERMISSIONS.PAYMENTS_VIEW` | 결제 조회 |
| `PERMISSIONS.PAYMENTS_CREATE` | 결제 생성 |
| `PERMISSIONS.PAYMENTS_UPDATE` | 결제 수정 |
| `PERMISSIONS.PAYMENTS_APPROVE` | 결제 승인 |
| `PERMISSIONS.PAYMENTS_REFUND` | 결제 환불 |
| `PERMISSIONS.REFUNDS_VIEW` | 환불 조회 |
| `PERMISSIONS.REFUNDS_CREATE` | 환불 생성 |
| `PERMISSIONS.REFUNDS_APPROVE` | 환불 승인 |

### 정산
| 권한 키 | 설명 |
|---------|------|
| `PERMISSIONS.SETTLEMENTS_VIEW` | 정산 조회 |
| `PERMISSIONS.SETTLEMENTS_CREATE` | 정산 생성 |
| `PERMISSIONS.SETTLEMENTS_UPDATE` | 정산 수정 |
| `PERMISSIONS.SETTLEMENTS_APPROVE` | 정산 승인 |
| `PERMISSIONS.SETTLEMENTS_EXPORT` | 정산 내보내기 |
| `PERMISSIONS.DEDUCTIONS_VIEW` | 차감 조회 |
| `PERMISSIONS.DEDUCTIONS_CREATE` | 차감 생성 |
| `PERMISSIONS.DEDUCTIONS_UPDATE` | 차감 수정 |
| `PERMISSIONS.DEDUCTIONS_DELETE` | 차감 삭제 |

### 헬퍼 관리
| 권한 키 | 설명 |
|---------|------|
| `PERMISSIONS.HELPERS_VIEW` | 헬퍼 조회 |
| `PERMISSIONS.HELPERS_CREATE` | 헬퍼 생성 |
| `PERMISSIONS.HELPERS_UPDATE` | 헬퍼 수정 |
| `PERMISSIONS.HELPERS_DELETE` | 헬퍼 삭제 |
| `PERMISSIONS.HELPERS_APPROVE` | 헬퍼 승인 |
| `PERMISSIONS.HELPERS_SUSPEND` | 헬퍼 정지 |

### 요청자 관리
| 권한 키 | 설명 |
|---------|------|
| `PERMISSIONS.REQUESTERS_VIEW` | 요청자 조회 |
| `PERMISSIONS.REQUESTERS_CREATE` | 요청자 생성 |
| `PERMISSIONS.REQUESTERS_UPDATE` | 요청자 수정 |
| `PERMISSIONS.REQUESTERS_DELETE` | 요청자 삭제 |
| `PERMISSIONS.REQUESTERS_APPROVE` | 요청자 승인 |
| `PERMISSIONS.REQUESTERS_SUSPEND` | 요청자 정지 |

### 운임/정책
| 권한 키 | 설명 |
|---------|------|
| `PERMISSIONS.RATES_VIEW` | 운임 조회 |
| `PERMISSIONS.RATES_UPDATE` | 운임 수정 |
| `PERMISSIONS.REFUND_POLICY_VIEW` | 환불 정책 조회 |
| `PERMISSIONS.REFUND_POLICY_UPDATE` | 환불 정책 수정 |

### 이의제기 & 사고
| 권한 키 | 설명 |
|---------|------|
| `PERMISSIONS.DISPUTES_VIEW` | 이의제기 조회 |
| `PERMISSIONS.DISPUTES_CREATE` | 이의제기 생성 |
| `PERMISSIONS.DISPUTES_UPDATE` | 이의제기 수정 |
| `PERMISSIONS.DISPUTES_RESOLVE` | 이의제기 해결 |
| `PERMISSIONS.INCIDENTS_VIEW` | 사고 조회 |
| `PERMISSIONS.INCIDENTS_CREATE` | 사고 생성 |
| `PERMISSIONS.INCIDENTS_UPDATE` | 사고 수정 |
| `PERMISSIONS.INCIDENTS_RESOLVE` | 사고 해결 |

### CS
| 권한 키 | 설명 |
|---------|------|
| `PERMISSIONS.CS_VIEW` | CS 문의 조회 |
| `PERMISSIONS.CS_CREATE` | CS 문의 생성 |
| `PERMISSIONS.CS_UPDATE` | CS 문의 수정 |
| `PERMISSIONS.CS_RESOLVE` | CS 문의 해결 |

### 설정
| 권한 키 | 설명 |
|---------|------|
| `PERMISSIONS.NOTIFICATIONS_VIEW` | 알림 조회 |
| `PERMISSIONS.NOTIFICATIONS_CREATE` | 알림 생성 |
| `PERMISSIONS.NOTIFICATIONS_UPDATE` | 알림 수정 |
| `PERMISSIONS.NOTIFICATIONS_DELETE` | 알림 삭제 |
| `PERMISSIONS.NOTIFICATIONS_SEND` | 알림 발송 |
| `PERMISSIONS.AUDIT_LOGS_VIEW` | 감사 로그 조회 |
| `PERMISSIONS.AUDIT_LOGS_EXPORT` | 감사 로그 내보내기 |
| `PERMISSIONS.STAFF_VIEW` | 직원 조회 |
| `PERMISSIONS.STAFF_CREATE` | 직원 생성 |
| `PERMISSIONS.STAFF_UPDATE` | 직원 수정 |
| `PERMISSIONS.STAFF_DELETE` | 직원 삭제 |
| `PERMISSIONS.STAFF_MANAGE_PERMISSIONS` | 권한 관리 |
| `PERMISSIONS.SETTINGS_VIEW` | 설정 조회 |
| `PERMISSIONS.SETTINGS_UPDATE` | 설정 수정 |

## 👥 권한 그룹

미리 정의된 역할별 권한 세트를 사용할 수 있습니다:

```typescript
import { PERMISSION_GROUPS, getPermissionsByGroup } from '@/constants/permissions';

// 슈퍼 관리자 - 모든 권한
const superAdminPermissions = getPermissionsByGroup('SUPER_ADMIN');

// 일반 관리자 - 직원 관리 제외
const adminPermissions = getPermissionsByGroup('ADMIN');

// CS 담당자 - 고객 지원 중심
const csPermissions = getPermissionsByGroup('CS_OPERATOR');

// 정산 담당자 - 정산 업무 중심
const settlementPermissions = getPermissionsByGroup('SETTLEMENT_OPERATOR');

// 오더 관리자 - 오더 운영 중심
const orderPermissions = getPermissionsByGroup('ORDER_OPERATOR');

// 읽기 전용 - 조회만 가능
const viewerPermissions = getPermissionsByGroup('VIEWER');
```

## 🔧 유틸리티 함수

### 권한 유효성 검사
```typescript
import { isValidPermission, isValidMenuKey } from '@/constants/permissions';

if (isValidPermission('orders.view')) {
  // 유효한 권한
}

if (isValidMenuKey('menu.orders')) {
  // 유효한 메뉴 키
}
```

### 권한 그룹 병합
```typescript
import { mergePermissionGroups } from '@/constants/permissions';

// CS + 정산 담당자 권한 합치기
const combinedPermissions = mergePermissionGroups('CS_OPERATOR', 'SETTLEMENT_OPERATOR');
```

### 액션별 권한 필터링
```typescript
import { filterPermissionsByAction } from '@/constants/permissions';

// 모든 'view' 권한만 가져오기
const viewPermissions = filterPermissionsByAction('view');

// 모든 'approve' 권한만 가져오기
const approvePermissions = filterPermissionsByAction('approve');
```

## ✅ 체크리스트

새로운 페이지나 기능을 추가할 때:

- [ ] `constants/permissions.ts`에 필요한 권한 추가
- [ ] `Layout.tsx`의 `navGroups`에 메뉴 항목 추가
- [ ] 컴포넌트에서 `hasPermission()` 사용하여 권한 확인
- [ ] API 라우트에 권한 미들웨어 추가
- [ ] 관련 권한을 적절한 PERMISSION_GROUPS에 추가

## 🎨 예제: 전체 흐름

```typescript
// 1. constants/permissions.ts에 권한 추가
export const PERMISSIONS = {
  // ... 기존 권한들
  NEW_FEATURE_VIEW: 'newFeature.view',
  NEW_FEATURE_CREATE: 'newFeature.create',
} as const;

// 2. Layout.tsx에 메뉴 추가
{
  title: '새 기능',
  icon: <Star className="h-4 w-4" />,
  menuKey: MENU_KEYS.NEW_FEATURE,
  items: [
    {
      href: '/new-feature',
      label: '새 기능 관리',
      icon: <Star className="h-5 w-5" />,
      permission: PERMISSIONS.NEW_FEATURE_VIEW
    },
  ],
}

// 3. 페이지 컴포넌트
function NewFeaturePage() {
  const { hasPermission } = useAuth();

  if (!hasPermission(PERMISSIONS.NEW_FEATURE_VIEW)) {
    return <Navigate to="/" />;
  }

  return (
    <div>
      <h1>새 기능</h1>
      {hasPermission(PERMISSIONS.NEW_FEATURE_CREATE) && (
        <Button>생성</Button>
      )}
    </div>
  );
}

// 4. API 라우트
router.post('/new-feature',
  requirePermission(PERMISSIONS.NEW_FEATURE_CREATE),
  createNewFeature
);
```

## 🚨 주의사항

1. **하드코딩 금지**: 권한 키를 문자열로 직접 입력하지 마세요.
   ```typescript
   // ❌ 나쁜 예
   hasPermission('orders.view')

   // ✅ 좋은 예
   hasPermission(PERMISSIONS.ORDERS_VIEW)
   ```

2. **일관성 유지**: 새 권한 추가 시 네이밍 규칙을 따르세요.

3. **최소 권한 원칙**: 필요한 최소한의 권한만 부여하세요.

4. **테스트**: 권한 변경 후 모든 역할에서 테스트하세요.
