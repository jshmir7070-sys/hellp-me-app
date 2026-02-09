# 📱 헬프미 앱 이미지 에셋 요구사항

**업데이트**: 2026-02-09
**상태**: app.json 설정 완료 ✅

---

## 📁 에셋 위치

모든 이미지 에셋은 다음 폴더에 배치해야 합니다:
```
client/assets/images/
```

---

## 🎨 필수 에셋 목록

### 1. iOS App Store 아이콘
**파일명**: `icon.png`
- **크기**: 1024×1024 픽셀
- **형식**: RGB (투명도 없음)
- **배경**: 흰색 또는 브랜드 컬러
- **용도**: iOS App Store 및 앱 아이콘
- **주의사항**:
  - 투명 배경 불가
  - 알파 채널 없음
  - 안전 영역: 중앙 820×820 픽셀 (가장자리 102px 여백)
  - iOS가 자동으로 둥근 모서리 적용

### 2. Android 적응형 아이콘 - 전경
**파일명**: `adaptive-icon.png`
- **크기**: 1024×1024 픽셀
- **형식**: RGBA (투명도 있음)
- **안전 영역**: 중앙 72% (약 737×737 픽셀)
- **용도**: Android 적응형 아이콘 전경 레이어
- **주의사항**:
  - 배경 투명
  - 중요한 로고 요소는 중앙 72% 원형 안에 배치
  - 외곽 부분은 기기별로 잘릴 수 있음

### 3. Android 적응형 아이콘 - 배경
**파일명**: `adaptive-icon-bg.png`
- **크기**: 1024×1024 픽셀
- **형식**: RGB
- **색상**: 흰색 (#FFFFFF) 또는 브랜드 컬러
- **용도**: Android 적응형 아이콘 배경 레이어

### 4. 스플래시 화면
**파일명**: `splash.png`
- **크기**: 1284×2778 픽셀 (iPhone 15 Pro Max 기준)
- **형식**: RGB
- **비율**: 9:19.5
- **용도**: 앱 시작 시 보이는 스플래시 화면
- **주의사항**:
  - 중앙에 로고 배치 (세이프 존 고려)
  - 배경색은 app.json의 splash.backgroundColor와 매칭
  - 다양한 화면 비율 고려 (상단/하단 잘림 가능)

### 5. 웹 파비콘
**파일명**: `favicon.png`
- **크기**: 48×48 픽셀
- **형식**: RGB
- **용도**: 웹 버전 파비콘
- **주의사항**: 작은 크기에서도 인식 가능한 심플한 디자인

### 6. Android 알림 아이콘
**파일명**: `notification-icon.png`
- **크기**: 96×96 픽셀
- **형식**: RGBA (투명도 있음)
- **색상**: 흰색 실루엣 (#FFFFFF)
- **용도**: Android 푸시 알림 아이콘
- **주의사항**:
  - 배경 투명
  - 흰색 단색 실루엣만 사용
  - 그라데이션 불가
  - 안티앨리어싱 최소화

### 7. 앱 내 로고 (라이트 모드)
**파일명**: `logo-light.png`
- **크기**: 512×512 픽셀
- **형식**: RGB
- **용도**: 밝은 배경에서 사용할 로고
- **주의사항**: 흰색/밝은 배경에서 잘 보이는 색상

### 8. 앱 내 로고 (다크 모드)
**파일명**: `logo-dark.png`
- **크기**: 512×512 픽셀
- **형식**: RGB
- **용도**: 다크 모드에서 사용할 로고
- **주의사항**: 검은색/어두운 배경에서 잘 보이는 색상

### 9. Google Play 대표 이미지
**파일명**: `feature-graphic.png`
- **크기**: 1024×500 픽셀
- **형식**: RGB
- **용도**: Google Play Store 대표 이미지
- **주의사항**:
  - 텍스트 최소화 (앱 이름, 주요 기능만)
  - 브랜드 그라데이션 활용
  - 고해상도 이미지 사용

---

## 📋 에셋 체크리스트

### 제작 전 확인사항
- [ ] 디자이너와 브랜드 컬러 확정 (#1E40AF 기본)
- [ ] 로고 디자인 완성
- [ ] 다크모드 버전 로고 준비

### 필수 에셋 (9개)
- [ ] icon.png (1024×1024, RGB)
- [ ] adaptive-icon.png (1024×1024, RGBA)
- [ ] adaptive-icon-bg.png (1024×1024, RGB)
- [ ] splash.png (1284×2778, RGB)
- [ ] favicon.png (48×48, RGB)
- [ ] notification-icon.png (96×96, RGBA)
- [ ] logo-light.png (512×512, RGB)
- [ ] logo-dark.png (512×512, RGB)
- [ ] feature-graphic.png (1024×500, RGB)

### 배치 완료
- [ ] 모든 에셋을 `client/assets/images/` 폴더에 복사
- [ ] app.json 경로 설정 확인
- [ ] 앱 재시작 후 아이콘 확인

---

## 🔧 app.json 설정 (✅ 완료)

다음 경로가 자동으로 설정되었습니다:

```json
{
  "expo": {
    "icon": "./client/assets/images/icon.png",
    "splash": {
      "image": "./client/assets/images/splash.png",
      "backgroundColor": "#FFFFFF"
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#FFFFFF",
        "foregroundImage": "./client/assets/images/adaptive-icon.png",
        "backgroundImage": "./client/assets/images/adaptive-icon-bg.png"
      }
    },
    "web": {
      "favicon": "./client/assets/images/favicon.png"
    },
    "plugins": [
      ["expo-splash-screen", {
        "image": "./client/assets/images/splash.png"
      }],
      ["expo-notifications", {
        "icon": "./client/assets/images/notification-icon.png",
        "color": "#1E40AF"
      }]
    ]
  }
}
```

---

## 🎨 디자인 가이드

### 브랜드 컬러
```typescript
Primary: #1E40AF (Blue)
Helper: #3B82F6 (Light Blue)
Requester: #EC4899 (Pink)
Success: #10B981 (Green)
Warning: #F59E0B (Amber)
Error: #EF4444 (Red)
```

### 로고 사용 가이드

#### icon.png (iOS)
```
┌────────────────────────────┐
│ 102px 여백                  │
│    ┌──────────────────┐    │
│    │                  │    │
│    │   로고 (820px)   │    │
│    │                  │    │
│    └──────────────────┘    │
│ 102px 여백                  │
└────────────────────────────┘
1024×1024 (흰 배경)
```

#### adaptive-icon.png (Android)
```
┌────────────────────────────┐
│ 외곽 영역 (잘림 가능)       │
│  ┌────────────────────┐    │
│  │  72% 안전 영역     │    │
│  │  ┌──────────┐      │    │
│  │  │   로고   │      │    │
│  │  └──────────┘      │    │
│  └────────────────────┘    │
└────────────────────────────┘
1024×1024 (투명 배경)
```

#### splash.png
```
┌────────────────┐
│ Safe zone top  │
│                │
│   ┌────────┐   │
│   │  로고  │   │ ← 중앙 배치
│   └────────┘   │
│                │
│ Safe zone btm  │
└────────────────┘
1284×2778
```

---

## 🛠️ 제작 도구 추천

### 온라인 도구
1. **App Icon Generator** - https://www.appicon.co/
   - 1024×1024 이미지 업로드 시 모든 크기 자동 생성

2. **Figma** - https://www.figma.com/
   - 벡터 기반 디자인
   - iOS/Android 템플릿 제공

3. **Canva** - https://www.canva.com/
   - 간단한 로고 제작
   - 템플릿 활용

### 로컬 도구
1. **Adobe Photoshop** - 정밀한 픽셀 작업
2. **Sketch** - macOS 전용, 앱 디자인 특화
3. **GIMP** - 무료 대안

---

## ✅ 검증 방법

### 1. 로컬 개발 환경
```bash
# Metro 재시작 (캐시 클리어)
npx expo start -c

# iOS 시뮬레이터
i

# Android 에뮬레이터
a
```

### 2. 아이콘 확인
- **iOS**: 홈 화면에서 아이콘 확인
- **Android**:
  - 홈 화면 아이콘
  - 설정 > 앱 목록 아이콘
  - 다양한 런처에서 확인 (원형, 정사각형, 둥근 모서리)

### 3. 스플래시 화면 확인
- 앱 재시작 시 스플래시 화면 표시 확인
- 다양한 화면 크기에서 테스트

### 4. 알림 아이콘 확인
- 푸시 알림 전송 후 상단바 아이콘 확인
- 다크모드/라이트모드 모두 테스트

---

## 📦 스토어 제출 시 추가 에셋

### Apple App Store
- **스크린샷** (필수):
  - iPhone 15 Pro Max: 1290×2796 (5-10장)
  - iPhone 8 Plus: 1242×2208 (5-10장)
  - iPad Pro 12.9": 2048×2732 (5-10장, 선택)
- **앱 미리보기 영상** (선택):
  - .mov 형식, 15-30초

### Google Play Store
- **스크린샷** (필수):
  - 전화: 1080×1920 이상 (2-8장)
  - 태블릿: 1920×1080 이상 (2-8장, 권장)
- **대표 이미지**: feature-graphic.png (1024×500, 필수)
- **홍보 영상** (선택): YouTube 링크

---

## 🚨 주의사항

### 금지 사항
- ❌ 저작권 침해 이미지 사용
- ❌ 타사 브랜드 로고 무단 사용
- ❌ 성인/폭력/차별적 이미지
- ❌ 오해의 소지가 있는 이미지

### 권장 사항
- ✅ 벡터 기반 로고 사용 (확대/축소 시 깨끗함)
- ✅ 단순하고 인식하기 쉬운 디자인
- ✅ 브랜드 컬러 일관성 유지
- ✅ 다양한 배경에서 테스트

---

## 📞 도움이 필요한 경우

### 디자이너가 없는 경우
1. **온라인 로고 생성기 활용**:
   - https://looka.com/
   - https://www.canva.com/
   - https://www.hatchful.com/

2. **임시 에셋으로 시작**:
   - 단색 배경 + 텍스트 로고
   - 나중에 전문 디자이너와 교체

3. **외주 플랫폼**:
   - Fiverr (해외)
   - 크몽 (국내)
   - 프리랜서코리아

---

**작성자**: Claude Sonnet 4.5
**프로젝트**: Hellp Me App
**마지막 업데이트**: 2026-02-09
