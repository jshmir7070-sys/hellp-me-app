# 🔧 Hellp Me 프로젝트 리팩토링 가이드

> **작성일**: 2026-02-07
> **목적**: 32,380줄의 모놀리식 routes.ts를 모듈화하고 코드 품질 개선

---

## 📋 목차

1. [개요](#개요)
2. [현재 상태 분석](#현재-상태-분석)
3. [리팩토링 목표](#리팩토링-목표)
4. [완료된 작업](#완료된-작업)
5. [진행 방법](#진행-방법)
6. [모듈 구조](#모듈-구조)
7. [마이그레이션 체크리스트](#마이그레이션-체크리스트)
8. [베스트 프랙티스](#베스트-프랙티스)

---

## 개요

### 문제점
- **routes.ts**: 32,380줄, 1.2MB, 757개 API 엔드포인트
- **테스트 부재**: 0% 커버리지
- **TypeScript any 남용**: 463회
- **console.log 남발**: 732회
- **거대한 컴포넌트**: CreateJobScreen (2,064줄), HomeScreen (1,922줄)

### 해결 방안
모놀리식 아키텍처를 **모듈화된 Controller/Service 패턴**으로 전환

---

## 현재 상태 분석

### API 엔드포인트 분포
```
📊 총 757개 엔드포인트
├── admin       462개 (61%)  🔴 가장 큰 문제
├── orders       52개 (7%)
├── helpers      39개 (5%)
├── auth         22개 (3%)
├── requesters   17개 (2%)
├── contracts    10개 (1%)
├── payments     10개(1%)
└── 기타        145개 (19%)
```

### 기술 부채 점수
| 항목 | 점수 | 상태 |
|------|------|------|
| 전체 | 4.5/10 | ⚠️ 주의 |
| 코드 품질 | 3/10 | 🔴 위험 |
| 아키텍처 | 4/10 | 🟠 높음 |
| 테스트 | 1/10 | 🔴 치명적 |
| 문서화 | 7/10 | 🟢 양호 |

---

## 리팩토링 목표

### 단기 목표 (1-2개월)
- ✅ routes.ts를 10개 모듈로 분리
- ✅ Controller/Service 패턴 도입
- ✅ 핵심 비즈니스 로직 테스트 작성
- ✅ 구조화된 로깅 시스템 구축

### 중기 목표 (3-4개월)
- 🎯 테스트 커버리지 60% 달성
- 🎯 대형 React 컴포넌트 리팩토링
- 🎯 TypeScript any 제거
- 🎯 schema.ts 모듈화

### 장기 목표 (6개월)
- 📅 테스트 커버리지 80% 달성
- 📅 기술 부채 비율 15% 이하로 감소
- 📅 개발 생산성 40% 향상

---

## 완료된 작업

### ✅ Phase 1: 기반 구축 (완료)
1. **백업 파일 정리**
   - .gitignore 업데이트
   - routes.ts.backup, routes.ts.bak 제거

2. **테스트 인프라 설정**
   - Jest + Testing Library 설치 및 설정
   - jest.config.js, jest.setup.js 생성
   - 샘플 테스트 작성 및 실행 성공

3. **디렉토리 구조 생성**
   ```
   server/
   ├── types/          # 타입 정의
   ├── services/       # 비즈니스 로직
   ├── controllers/    # HTTP 요청/응답
   └── routes/         # 라우트 정의
   ```

### ✅ Phase 2: Auth 모듈 분리 (완료)
```
server/
├── types/auth.types.ts              ✨
├── services/auth.service.ts         ✨
├── controllers/auth.controller.ts   ✨
└── routes/auth.routes.ts            ✨ 22 endpoints
```

**기능**:
- 회원가입/로그인
- JWT 토큰 관리
- 비밀번호 재설정
- 계정 관리
- OAuth 준비 (TODO)

### ✅ Phase 3: Orders 모듈 분리 (완료)
```
server/
├── types/order.types.ts             ✨
├── services/order.service.ts        ✨
├── controllers/order.controller.ts  ✨
└── routes/order.routes.ts           ✨ 52 endpoints
```

**기능**:
- 주문 생성/조회/수정/삭제
- 주문 필터링
- 헬퍼 지원
- 헬퍼 선택

### ✅ Phase 4: 로깅 시스템 (완료)
```
server/lib/logger.ts                 ✨
```

**기능**:
- 구조화된 로깅 (debug, info, warn, error)
- 민감 정보 자동 마스킹
- 환경별 로그 레벨
- HTTP 요청 로깅

---

## 진행 방법

### 1단계: 기존 코드 분석
```bash
# 특정 모듈의 엔드포인트 찾기
grep -n "app\.(get|post|put|patch|delete).*\/api\/payments\/" server/routes.ts
```

### 2단계: 타입 정의 작성
```typescript
// types/payment.types.ts
export interface CreatePaymentData {
  orderId: number;
  amount: number;
  method: 'card' | 'virtual_account';
}
```

### 3단계: 서비스 레이어 작성
```typescript
// services/payment.service.ts
export class PaymentService {
  async createPayment(data: CreatePaymentData) {
    // 비즈니스 로직
  }
}
```

### 4단계: 컨트롤러 작성
```typescript
// controllers/payment.controller.ts
export class PaymentController {
  async createPayment(req: AuthenticatedRequest, res: Response) {
    // HTTP 요청/응답 처리
  }
}
```

### 5단계: 라우터 작성
```typescript
// routes/payment.routes.ts
export function registerPaymentRoutes(app: Express) {
  app.post('/api/payments', requireAuth, paymentController.createPayment);
}
```

### 6단계: 테스트 작성
```typescript
// services/__tests__/payment.service.test.ts
describe('PaymentService', () => {
  it('should create payment', async () => {
    // 테스트 코드
  });
});
```

### 7단계: routes/index.ts에 등록
```typescript
// routes/index.ts
import { registerPaymentRoutes } from './payment.routes';

export function registerRoutes(app: Express) {
  registerAuthRoutes(app);
  registerOrderRoutes(app);
  registerPaymentRoutes(app);  // 추가
}
```

---

## 모듈 구조

### 표준 모듈 구조
```
server/
├── types/
│   └── [module].types.ts       # 타입 정의
├── services/
│   ├── [module].service.ts     # 비즈니스 로직
│   └── __tests__/
│       └── [module].service.test.ts
├── controllers/
│   └── [module].controller.ts  # HTTP 처리
├── routes/
│   └── [module].routes.ts      # 라우트 정의
└── routes/
    └── index.ts                # 통합
```

### 파일별 역할

#### Types (타입 정의)
- 인터페이스, 타입 정의
- 요청/응답 데이터 구조
- 도메인 모델

#### Services (비즈니스 로직)
- 데이터베이스 접근
- 비즈니스 규칙 구현
- 외부 API 호출
- 에러 처리

#### Controllers (HTTP 처리)
- 요청 파라미터 추출
- 응답 포맷팅
- HTTP 상태 코드 설정
- 기본 검증

#### Routes (라우트 정의)
- URL 경로 정의
- 미들웨어 적용
- 컨트롤러 바인딩
- 문서화 주석

---

## 마이그레이션 체크리스트

### 모듈 분리 전
- [ ] routes.ts에서 해당 엔드포인트 찾기
- [ ] 의존성 파악 (다른 모듈과의 연관성)
- [ ] 공통 로직 추출 가능 여부 확인

### 모듈 분리 중
- [ ] types 파일 작성
- [ ] service 파일 작성 (비즈니스 로직)
- [ ] controller 파일 작성 (HTTP 처리)
- [ ] routes 파일 작성 (라우트 정의)
- [ ] 테스트 작성
- [ ] routes/index.ts에 등록

### 모듈 분리 후
- [ ] 기존 routes.ts에서 해당 코드 주석 처리
- [ ] 로컬 테스트 실행
- [ ] Postman/Thunder Client로 API 테스트
- [ ] 문서 업데이트

---

## 베스트 프랙티스

### 1. 타입 안전성
```typescript
// ❌ Bad
async function getOrder(id: any) {
  const order: any = await storage.getOrder(id);
  return order;
}

// ✅ Good
async function getOrder(id: number): Promise<Order> {
  const order = await storage.getOrder(id);
  if (!order) {
    throw new Error('Order not found');
  }
  return order;
}
```

### 2. 에러 처리
```typescript
// ❌ Bad
try {
  const result = await service.doSomething();
  res.json(result);
} catch (err) {
  res.status(500).json({ error: 'Error' });
}

// ✅ Good
try {
  const result = await service.doSomething();
  res.json({ success: true, data: result });
} catch (error: any) {
  logger.error('Failed to do something', error, { userId: req.user.id });
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Internal server error',
  });
}
```

### 3. 로깅
```typescript
// ❌ Bad
console.log('[DepositInfo] Calculating for order:', orderId);
console.log('User:', user);

// ✅ Good
logger.debug('Calculating deposit info', {
  module: 'DepositInfo',
  orderId,
  userId: user.id,
});
```

### 4. 비동기 처리
```typescript
// ❌ Bad
const user = await getUser(userId);
const orders = await getOrders(userId);
const contracts = await getContracts(userId);

// ✅ Good (병렬 처리)
const [user, orders, contracts] = await Promise.all([
  getUser(userId),
  getOrders(userId),
  getContracts(userId),
]);
```

### 5. 환경 변수
```typescript
// ❌ Bad
const apiKey = 'hardcoded-key';

// ✅ Good
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error('API_KEY environment variable is required');
}
```

---

## 다음 단계

### 즉시 시작 가능
1. **Payments 모듈 분리** (~10 endpoints)
2. **Contracts 모듈 분리** (~10 endpoints)
3. **Settlements 모듈 분리** (~5 endpoints)

### 주의 필요
4. **Admin 모듈 분리** (462 endpoints - 추가 세분화 필요)
   - admin/users.routes.ts
   - admin/orders.routes.ts
   - admin/settlements.routes.ts
   - admin/system.routes.ts

### 프론트엔드
5. **CreateJobScreen 리팩토링** (2,064줄)
6. **HomeScreen 리팩토링** (1,922줄)

---

## 📊 진행 상황 추적

### 백엔드 모듈 (757 endpoints)
- [x] Auth (22) - 100% ✅
- [x] Orders (52) - 100% ✅
- [ ] Payments (10) - 진행중 🔄
- [ ] Contracts (10) - 진행중 🔄
- [ ] Settlements (5) - 0%
- [ ] Helpers (39) - 0%
- [ ] Requesters (17) - 0%
- [ ] Admin (462) - 0%
- [ ] Misc (140) - 0%

### 프론트엔드 컴포넌트
- [ ] CreateJobScreen (2,064줄)
- [ ] HomeScreen (1,922줄)
- [ ] CreateContractScreen (1,453줄)

### 코드 품질
- [x] 테스트 인프라 ✅
- [x] 로깅 시스템 ✅
- [ ] TypeScript any 제거 (463회)
- [ ] schema.ts 모듈화 (4,531줄)

---

## 🎯 예상 효과

### 개발 생산성
- **현재**: 새 기능 추가 시 평균 5-7일
- **목표**: 새 기능 추가 시 평균 2-3일
- **향상**: **40-60% 생산성 증가**

### 버그 감소
- **현재**: 월평균 15-20개 버그
- **목표**: 월평균 5-8개 버그
- **감소**: **60-70% 버그 감소**

### 온보딩 시간
- **현재**: 신규 개발자 온보딩 2-3주
- **목표**: 신규 개발자 온보딩 3-5일
- **단축**: **70-80% 시간 단축**

---

## 📞 문의 및 지원

### 이슈 및 질문
- 기술 부채 관련 질문: [GitHub Issues](https://github.com/your-repo/issues)
- 리팩토링 지원 요청: [Slack #tech-debt](slack://channel/tech-debt)

### 참고 자료
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/)
- [Express.js Patterns](https://expressjs.com/en/guide/routing.html)
- [Jest Testing Guide](https://jestjs.io/docs/getting-started)

---

**Last Updated**: 2026-02-07
**Version**: 1.0.0
**Author**: Claude Code Assistant
