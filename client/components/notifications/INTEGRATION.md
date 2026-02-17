# 시스템 알림 메시지 UI 개선 - 앱 통합 가이드

## 🚀 빠른 시작

### 1단계: Provider 추가

앱의 최상위 레이아웃 파일에 `SystemNotificationProvider`를 추가하세요.

#### Expo Router 사용 시 (_layout.tsx)

```tsx
// app/_layout.tsx
import { SystemNotificationProvider } from '@/components/notifications';

export default function RootLayout() {
  return (
    <SystemNotificationProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* 기타 스크린 */}
      </Stack>
    </SystemNotificationProvider>
  );
}
```

#### React Navigation 사용 시 (App.tsx)

```tsx
// App.tsx
import { SystemNotificationProvider } from '@/components/notifications';

export default function App() {
  return (
    <SystemNotificationProvider>
      <NavigationContainer>
        {/* 네비게이션 구조 */}
      </NavigationContainer>
    </SystemNotificationProvider>
  );
}
```

### 2단계: 기존 Alert/Toast 교체

#### 기존 코드 (Alert.alert 사용)

```tsx
// ❌ 기존 방식
import { Alert } from 'react-native';

Alert.alert('오류', '네트워크 연결을 확인해주세요.');
```

#### 새로운 코드 (SystemAlert 사용)

```tsx
// ✅ 새로운 방식
import { useSystemNotification } from '@/components/notifications';

function MyComponent() {
  const { alert } = useSystemNotification();

  const handleError = () => {
    alert.error('오류', '네트워크 연결을 확인해주세요.');
  };

  return <Button onPress={handleError}>테스트</Button>;
}
```

### 3단계: 타입별 알림 사용

```tsx
import { useSystemNotification } from '@/components/notifications';

function MyComponent() {
  const { alert, toast } = useSystemNotification();

  // Alert (모달)
  const showInfo = () => alert.info('정보', '새로운 업데이트가 있습니다.');
  const showSuccess = () => alert.success('완료', '저장되었습니다.');
  const showWarning = () => alert.warning('주의', '이 작업은 되돌릴 수 없습니다.');
  const showError = () => alert.error('오류', '서버 연결에 실패했습니다.');

  // Toast (알림 바)
  const showToast = () => toast.success('저장되었습니다');

  return (
    <View>
      <Button onPress={showInfo}>정보</Button>
      <Button onPress={showSuccess}>성공</Button>
      <Button onPress={showWarning}>경고</Button>
      <Button onPress={showError}>오류</Button>
      <Button onPress={showToast}>토스트</Button>
    </View>
  );
}
```

---

## 📝 실제 사용 사례

### 로그인 오류

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
          toast.success('결제가 완료되었습니다');
        },
      },
      { text: '취소', style: 'secondary' },
    ]
  );
};
```

### 파일 업로드

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

## 🎨 디자인 가이드라인

### 언제 Alert를 사용하나요?

- ✅ 사용자의 확인이 필요한 경우
- ✅ 중요한 정보를 전달할 때
- ✅ 되돌릴 수 없는 작업 전
- ✅ 오류가 발생했을 때

### 언제 Toast를 사용하나요?

- ✅ 간단한 피드백 제공
- ✅ 작업 완료 알림
- ✅ 상태 변경 알림
- ✅ 사용자 확인이 필요 없는 정보

### 타입 선택 가이드

| 타입 | 사용 시기 | 예시 |
|------|----------|------|
| **info** | 정보 안내 | 새로운 기능 안내, 업데이트 알림 |
| **success** | 성공 메시지 | 저장 완료, 결제 완료, 업로드 성공 |
| **warning** | 경고 메시지 | 삭제 확인, 중요한 변경 사항 |
| **error** | 오류 메시지 | 네트워크 오류, 로그인 실패 |

---

## 🔧 고급 사용법

### 커스텀 버튼

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

### 토스트 지속 시간 조절

```tsx
// 2초 후 자동 닫힘
toast.success('빠른 메시지', '성공', 2000);

// 6초 후 자동 닫힘
toast.warning('긴 메시지', '경고', 6000);
```

### 직접 훅 사용

```tsx
import { useSystemAlert, useSystemToast } from '@/components/notifications';

function MyComponent() {
  const showAlert = useSystemAlert();
  const showToast = useSystemToast();

  const handleCustom = () => {
    showAlert({
      type: 'info',
      title: '커스텀 알림',
      message: '이것은 커스텀 알림입니다.',
      buttons: [{ text: '확인', style: 'primary' }],
      cancelable: true,
    });
  };

  return <Button onPress={handleCustom}>커스텀</Button>;
}
```

---

## 📦 마이그레이션 체크리스트

- [ ] `SystemNotificationProvider`를 앱 최상위에 추가
- [ ] 기존 `Alert.alert()` 호출을 `alert.error()` 등으로 교체
- [ ] 기존 Toast 라이브러리를 `toast.success()` 등으로 교체
- [ ] 타입별 색상 시스템 적용 (info/success/warning/error)
- [ ] 버튼 스타일 적용 (primary/secondary/destructive)
- [ ] 토스트 지속 시간 조정
- [ ] 데모 화면에서 테스트

---

## 🎯 테스트 방법

### 1. 데모 화면 추가

```tsx
// app/(tabs)/demo.tsx
import { SystemNotificationDemo } from '@/components/notifications/SystemNotificationDemo';

export default function DemoScreen() {
  return <SystemNotificationDemo />;
}
```

### 2. 각 타입 테스트

- [ ] Info Alert (파란색 헤더)
- [ ] Success Alert (초록색 헤더)
- [ ] Warning Alert (노란색 헤더)
- [ ] Error Alert (빨간색 헤더)
- [ ] Info Toast (파란색 테두리)
- [ ] Success Toast (초록색 테두리)
- [ ] Warning Toast (노란색 테두리)
- [ ] Error Toast (빨간색 테두리)

### 3. 기능 테스트

- [ ] 버튼 클릭 동작
- [ ] 배경 클릭으로 닫기 (cancelable)
- [ ] Toast 스와이프로 닫기
- [ ] 다중 Toast 표시
- [ ] 애니메이션 확인

---

## 🐛 문제 해결

### Provider가 없다는 오류

```
Error: useSystemAlert must be used within SystemNotificationProvider
```

**해결**: 앱 최상위에 `SystemNotificationProvider` 추가

### 타입 오류

```
Type 'string' is not assignable to type 'SystemAlertType'
```

**해결**: 타입을 'info' | 'success' | 'warning' | 'error' 중 하나로 지정

### Toast가 표시되지 않음

**해결**: `SystemNotificationProvider`가 올바른 위치에 있는지 확인

---

## ✅ 완료

이제 앱에서 새로운 시스템 알림 메시지를 사용할 수 있습니다!

**구현 완료일**: 2026-02-17
