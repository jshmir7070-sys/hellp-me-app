# TypeScript 타입 안전성 개선 가이드

> **목표**: 463개의 `any` 타입을 제거하고 타입 안전성 향상

---

## 📊 현황

### 문제점
- **any 사용**: 463회 (주로 server/routes.ts)
- **타입 추론 실패**: Express Request/Response 타입
- **동적 타입**: JSON.parse(), metadata 필드

### 영향
- IDE 자동완성 부족
- 런타임 에러 가능성
- 리팩토링 어려움

---

## 🎯 개선 전략

### 1단계: Express Request 타입 명확화

#### Before
```typescript
app.post('/api/orders', requireAuth, async (req, res) => {
  const userId = (req as any).user.id;  // ❌
  const data: any = req.body;           // ❌
});
```

#### After
```typescript
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: 'helper' | 'requester' | 'admin';
  };
}

app.post('/api/orders', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user.id;           // ✅ 타입 안전
  const data: CreateOrderData = req.body;  // ✅ 검증된 타입
});
```

### 2단계: API 응답 타입 정의

#### Before
```typescript
res.json({
  success: true,
  data: result,  // any
});
```

#### After
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface OrderResponse {
  id: number;
  title: string;
  status: string;
  // ...
}

res.json<ApiResponse<OrderResponse>>({
  success: true,
  data: order,
});
```

### 3단계: Zod로 런타임 검증 + 타입 추론

```typescript
import { z } from 'zod';

// 스키마 정의
const CreateOrderSchema = z.object({
  title: z.string().min(1).max(200),
  pickupAddress: z.string(),
  deliveryAddress: z.string(),
  scheduledDate: z.string().datetime(),
  pricePerUnit: z.number().positive(),
});

// 자동 타입 추론
type CreateOrderData = z.infer<typeof CreateOrderSchema>;

// 사용
app.post('/api/orders', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const result = CreateOrderSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error.message,
    });
  }

  const data: CreateOrderData = result.data;  // ✅ 타입 안전 + 검증됨
});
```

### 4단계: 제네릭 활용

#### Before
```typescript
async function getItems(type: string): Promise<any> {  // ❌
  return await db.select().from(items);
}
```

#### After
```typescript
async function getItems<T>(
  table: PgTable,
  where?: SQL
): Promise<T[]> {  // ✅
  const query = db.select().from(table);
  if (where) {
    query.where(where);
  }
  return await query as T[];
}

// 사용
const orders = await getItems<Order>(orders, eq(orders.status, 'pending'));
```

### 5단계: Record 타입 개선

#### Before
```typescript
const metadata: Record<string, any> = {  // ❌
  orderId: order.id,
  amount: order.amount,
};
```

#### After
```typescript
interface OrderMetadata {
  orderId: number;
  amount: number;
  timestamp: Date;
  source: 'web' | 'mobile';
}

const metadata: OrderMetadata = {  // ✅
  orderId: order.id,
  amount: order.amount,
  timestamp: new Date(),
  source: 'web',
};
```

### 6단계: Unknown 타입 활용 (any 대신)

```typescript
// ❌ Bad
function processData(data: any) {
  return data.value;
}

// ✅ Good
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value;
  }
  throw new Error('Invalid data format');
}

// 🌟 Better (with type guard)
interface DataWithValue {
  value: string;
}

function isDataWithValue(data: unknown): data is DataWithValue {
  return (
    typeof data === 'object' &&
    data !== null &&
    'value' in data &&
    typeof (data as any).value === 'string'
  );
}

function processData(data: unknown) {
  if (isDataWithValue(data)) {
    return data.value;  // ✅ 타입 안전
  }
  throw new Error('Invalid data format');
}
```

---

## 🔍 실전 예시

### 예시 1: JSON.parse()

#### Before
```typescript
const config: any = JSON.parse(configString);  // ❌
const port = config.port;
```

#### After
```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  port: z.number(),
  host: z.string(),
  database: z.object({
    url: z.string(),
  }),
});

type Config = z.infer<typeof ConfigSchema>;

function parseConfig(configString: string): Config {
  const parsed = JSON.parse(configString);
  return ConfigSchema.parse(parsed);  // ✅ 검증 + 타입 안전
}

const config = parseConfig(configString);
const port = config.port;  // ✅ 타입 추론됨
```

### 예시 2: 외부 API 응답

#### Before
```typescript
const response: any = await fetch('/api/data');  // ❌
const data: any = await response.json();
```

#### After
```typescript
interface ApiData {
  id: number;
  name: string;
  status: 'active' | 'inactive';
}

const response = await fetch('/api/data');
const data: unknown = await response.json();

// Type guard로 검증
function isApiData(data: unknown): data is ApiData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data &&
    'status' in data
  );
}

if (isApiData(data)) {
  console.log(data.name);  // ✅ 타입 안전
}
```

### 예시 3: 이벤트 핸들러

#### Before
```typescript
const handleSubmit = (e: any) => {  // ❌
  e.preventDefault();
  const value = e.target.value;
};
```

#### After
```typescript
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {  // ✅
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
  const value = formData.get('fieldName') as string;
};
```

---

## 🛠 도구 및 설정

### ESLint 규칙 추가

```json
// .eslintrc.json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",  // 경고로 시작
    "@typescript-eslint/no-unsafe-assignment": "warn",
    "@typescript-eslint/no-unsafe-member-access": "warn",
    "@typescript-eslint/no-unsafe-call": "warn"
  }
}
```

### tsconfig.json 강화

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noUncheckedIndexedAccess": true
  }
}
```

---

## 📋 마이그레이션 체크리스트

### 파일별 작업
- [ ] Express Request/Response 타입 정의
- [ ] API 응답 타입 정의
- [ ] Zod 스키마 작성
- [ ] any를 unknown으로 변경
- [ ] Type guards 작성
- [ ] 제네릭 활용

### 우선순위
1. **High**: 외부 입력 (req.body, JSON.parse)
2. **Medium**: 내부 API 호출
3. **Low**: 유틸리티 함수

---

## 🎯 목표

- [ ] any 사용 463개 → 50개 이하 (90% 감소)
- [ ] ESLint 경고 0개
- [ ] 타입 커버리지 95% 이상

**예상 작업 기간**: 3-4주
**예상 효과**:
- 런타임 에러 60% 감소
- IDE 생산성 40% 향상
- 리팩토링 안전성 향상

---

**Created**: 2026-02-07
