# 시스템 알림 메시지 UI 개선 가이드

## 📋 개요

앱 내 오류 메시지, 알림, 경고 등을 타입별 색상 헤더와 화이트/회색 톤 본문으로 구성된 새로운 디자인 시스템으로 개선했습니다.

---

## 🎨 디자인 시스템

### 알림 타입별 색상

| 타입 | 헤더 색상 | 용도 | 아이콘 |
|------|----------|------|--------|
| **info** | 파란색 (#3B82F6) | 정보 안내 | ℹ️ |
| **success** | 초록색 (#10B981) | 성공 메시지 | ✓ |
| **warning** | 노란색 (#F59E0B) | 경고 메시지 | ⚠️ |
| **error** | 빨간색 (#EF4444) | 오류 메시지 | ✕ |

### 디자인 구조

```
┌─────────────────────────────────┐
│  [색상 헤더]                     │ ← 타입별 색상 (파란/빨간/노란/초록)
│  아이콘 + 제목 (흰색 텍스트)     │
├─────────────────────────────────┤
│  [화이트/회색 톤 본문]           │ ← 흰색 배경
│  메시지 (회색 #6B7280)          │
│  [버튼]                          │
└─────────────────────────────────┘
```

---

## 🚀 사용 방법

### 1. Provider 설정

먼저 앱의 최상위에 `SystemNotificationProvider`를 추가하세요:

```tsx
// App.tsx 또는 _layout.tsx
import { SystemNotificationProvider } from '@/components/notifications';

export default function App() {
  return (
    <SystemNotificationProvider>
      {/* 나머지 앱 컴포넌트 */}
    </SystemNotificationProvider>
  );
}
```

### 2. Alert (모달) 사용

#### 기본 사용법

```tsx
import { useSystemNotification } from '@/components/notifications';

function MyComponent() {
  const { alert } = useSystemNotification();

  const handleError = () => {
    alert.error(
      '오류 발생',
      '네트워크 연결을 확인해주세요.',
      [
        { text: '다시 시도', style: 'primary', onPress: () => retry() },
        { text: '취소', style: 'secondary' },
      ]
    );
  };

  return <Button onPress={handleError}>테스트</Button>;
}
```

#### 타입별 예제

```tsx
// 정보 알림 (파란색)
alert.info('알림', '새로운 업데이트가 있습니다.');

// 성공 메시지 (초록색)
alert.success('완료', '주문이 성공적으로 등록되었습니다.');

// 경고 메시지 (노란색)
alert.warning('주의', '이 작업은 되돌릴 수 없습니다.');

// 오류 메시지 (빨간색)
alert.error('오류', '서버 연결에 실패했습니다.');
```

#### 버튼 스타일

```tsx
alert.warning('계정 삭제', '정말로 계정을 삭제하시겠습니까?', [
  {
    text: '삭제',
    style: 'destructive', // 빨간색 버튼
    onPress: () => deleteAccount(),
  },
  {
    text: '취소',
    style: 'secondary', // 투명 배경 + 테두리
  },
]);
```

### 3. Toast (알림 바) 사용

#### 기본 사용법

```tsx
import { useSystemNotification } from '@/components/notifications';

function MyComponent() {
  const { toast } = useSystemNotification();

  const handleSuccess = () => {
    toast.success('저장되었습니다', '성공', 3000);
  };

  return <Button onPress={handleSuccess}>저장</Button>;
}
```

#### 타입별 예제

```tsx
// 정보 토스트 (파란색 테두리)
toast.info('새로운 메시지가 도착했습니다');

// 성공 토스트 (초록색 테두리)
toast.success('파일 업로드 완료', '성공');

// 경고 토스트 (노란색 테두리)
toast.warning('배터리가 부족합니다', '경고');

// 오류 토스트 (빨간색 테두리)
toast.error('로그인에 실패했습니다', '오류');
```

#### 지속 시간 설정

```tsx
// 기본 4초
toast.info('기본 메시지');

// 2초 후 자동 닫힘
toast.success('빠른 메시지', '성공', 2000);

// 6초 후 자동 닫힘
toast.warning('긴 메시지', '경고', 6000);
```

---

## 📱 실제 사용 예제

### 로그인 오류 처리

```tsx
const handleLogin = async () => {
  try {
    await login(email, password);
    toast.success('로그인 성공!');
  } catch (error) {
    alert.error(
      '로그인 실패',
      '이메일 또는 비밀번호를 확인해주세요.',
      [
        { text: '비밀번호 찾기', style: 'primary', onPress: () => navigate('/reset-password') },
        { text: '확인', style: 'secondary' },
      ]
    );
  }
};
```

### 주문 확인

```tsx
const handleOrder = () => {
  alert.warning(
    '주문 확인',
    '총 금액 50,000원을 결제하시겠습니까?',
    [
      {
        text: '결제하기',
        style: 'primary',
        onPress: async () => {
          await processPayment();
          toast.success('결제가 완료되었습니다', '성공');
        },
      },
      { text: '취소', style: 'secondary' },
    ]
  );
};
```

### 네트워크 오류

```tsx
const fetchData = async () => {
  try {
    const data = await api.getData();
    toast.success('데이터를 불러왔습니다');
  } catch (error) {
    alert.error(
      '네트워크 오류',
      '서버와의 연결이 끊어졌습니다. 다시 시도해주세요.',
      [
        { text: '다시 시도', style: 'primary', onPress: () => fetchData() },
        { text: '닫기', style: 'secondary' },
      ]
    );
  }
};
```

### 파일 업로드 진행

```tsx
const uploadFile = async (file: File) => {
  toast.info('파일 업로드 중...', '진행 중');
  
  try {
    await api.upload(file);
    toast.success('파일 업로드 완료!', '성공');
  } catch (error) {
    toast.error('파일 업로드 실패', '오류');
  }
};
```

---

## 🎯 고급 사용법

### 직접 훅 사용

```tsx
import { useSystemAlert, useSystemToast } from '@/components/notifications';

function MyComponent() {
  const showAlert = useSystemAlert();
  const showToast = useSystemToast();

  const handleCustomAlert = () => {
    showAlert({
      type: 'info',
      title: '커스텀 알림',
      message: '이것은 커스텀 알림입니다.',
      buttons: [
        { text: '확인', style: 'primary' },
      ],
      cancelable: true, // 배경 클릭으로 닫기 가능
    });
  };

  const handleCustomToast = () => {
    showToast({
      type: 'success',
      title: '커스텀 토스트',
      message: '이것은 커스텀 토스트입니다.',
      duration: 5000,
    });
  };

  return (
    <>
      <Button onPress={handleCustomAlert}>커스텀 Alert</Button>
      <Button onPress={handleCustomToast}>커스텀 Toast</Button>
    </>
  );
}
```

---

## 🔧 기술 스펙

### 컴포넌트

- **SystemAlert**: 모달 형태의 알림 (중요한 메시지, 사용자 확인 필요)
- **SystemToast**: 화면 상단의 알림 바 (간단한 피드백, 자동 닫힘)

### 애니메이션

- **진입**: Spring 애니메이션 (scale + opacity)
- **종료**: Spring 애니메이션 (scale + opacity)
- **Toast 스와이프**: 위로 스와이프하여 닫기 가능

### 접근성

- 색상 대비: WCAG AA 기준 충족
- 아이콘 + 텍스트: 색맹 사용자 고려
- 키보드 네비게이션: 지원

---

## 📦 파일 구조

```
client/components/notifications/
├── SystemAlert.tsx              # Alert 컴포넌트
├── SystemToast.tsx              # Toast 컴포넌트
├── SystemNotificationProvider.tsx  # Context & Hooks
└── index.ts                     # Export
```

---

## 🎨 디자인 미리보기

### Alert (모달)

```
┌─────────────────────────────────┐
│  ⓘ  정보 안내                    │ ← 파란색 헤더
├─────────────────────────────────┤
│                                 │
│  새로운 업데이트가 있습니다.     │ ← 회색 텍스트
│                                 │
│  ┌─────────────────────────┐   │
│  │       확인 (파란색)      │   │ ← Primary 버튼
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

### Toast (알림 바)

```
┌─────────────────────────────────┐
│ ┃ [✓] 성공  저장되었습니다   [×] │ ← 초록색 테두리
└─────────────────────────────────┘
```

---

## ✅ 체크리스트

- [x] SystemAlert 컴포넌트 구현
- [x] SystemToast 컴포넌트 구현
- [x] SystemNotificationProvider 구현
- [x] useSystemAlert 훅 구현
- [x] useSystemToast 훅 구현
- [x] useSystemNotification 편의 훅 구현
- [x] 타입별 색상 시스템 (info/success/warning/error)
- [x] 화이트/회색 톤 본문 디자인
- [x] Spring 애니메이션
- [x] Toast 스와이프 제스처
- [x] TypeScript 타입 정의

---

**구현 완료일**: 2026-02-17  
**버전**: 1.0.0
