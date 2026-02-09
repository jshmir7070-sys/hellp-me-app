# Metro Bundler 문제 해결 가이드 (Windows)

## 🔴 문제 상황

```
Starting Metro Bundler
warning: Bundler cache is empty, rebuilding (this may take a minute)
[무한 대기...]
```

또는

```
TypeError: Body is unusable: Body has already been read
```

## 🎯 원인 분석

### 1. Expo CLI 버그
- `Body is unusable` 에러는 Expo CLI의 의존성 검증 버그
- Fetch API를 중복 호출하면서 발생

### 2. Windows 파일 와처 타임아웃
- Metro가 `node_modules` (1500+ 패키지)를 감시하려다 타임아웃
- Windows의 파일 시스템 API가 Unix 계열보다 느림
- Watchman이 Windows에서 제대로 동작 안 함

## ✅ 해결 방법 (우선순위 순)

### 방법 1: WSL2 사용 (가장 안정적) ⭐⭐⭐⭐⭐

WSL2는 Linux 환경이므로 Metro가 완벽하게 동작합니다.

```powershell
# Windows PowerShell (관리자 권한)
wsl --install
```

설치 후:
```bash
# WSL2 터미널에서
cd /mnt/c/Users/jshmi/Downloads/Native-App/Native-App

# Node.js 설치 (WSL 내부)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# 프로젝트 실행
npm install
npm run server:dev  # 터미널 1
npx expo start      # 터미널 2 (완벽하게 동작!)
```

**장점**: Metro 100% 정상 작동, 빠른 속도
**단점**: WSL2 설치 필요 (10분 소요)

---

### 방법 2: EAS Build 사용 (스토어 제출 준비 겸) ⭐⭐⭐⭐

로컬 개발을 건너뛰고 바로 빌드:

```cmd
cd C:\Users\jshmi\Downloads\Native-App\Native-App

# EAS CLI 설치
npm install -g eas-cli

# Expo 로그인
eas login

# EAS 프로젝트 설정
eas build:configure

# Preview 빌드 (내부 테스트용)
eas build --platform android --profile preview
```

**장점**: Metro 문제 완전 우회, 실제 디바이스 테스트 가능
**단점**: 빌드마다 5-15분 소요, 월 30회 무료 제한

---

### 방법 3: Expo Go App + QR 코드 (Metro가 조금이라도 시작되면) ⭐⭐⭐

Metro가 멈춰 있어도 **포트 8081이 열려 있으면** QR 코드로 접속 가능:

1. **스마트폰에 Expo Go 앱 설치**:
   - Android: Google Play Store
   - iOS: App Store

2. **Metro가 조금이라도 시작된 상태에서**:
   ```cmd
   # 새 터미널
   cd C:\Users\jshmi\Downloads\Native-App\Native-App
   npx expo start --tunnel
   ```

3. **QR 코드 스캔**:
   - Expo Go 앱에서 QR 스캔
   - 앱이 로드됨 (Metro가 완전히 시작 안 돼도 가능!)

**장점**: 실제 디바이스에서 테스트
**단점**: Metro가 최소한 포트만이라도 열어야 함

---

### 방법 4: React Native CLI 사용 (Expo 없이) ⭐⭐

```cmd
cd C:\Users\jshmi\Downloads\Native-App\Native-App

# React Native 빌드 준비
npx expo prebuild

# Metro 직접 실행 (Expo CLI 우회)
npx react-native start --reset-cache
```

**장점**: Expo CLI 버그 완전 우회
**단점**: prebuild 필요, native 설정 복잡

---

### 방법 5: 패키지 최소화 (임시 방편) ⭐

`node_modules`를 줄여서 파일 와처 부담 감소:

```cmd
# 불필요한 dev 패키지 제거
npm uninstall @types/jest jest

# .gitignore에 추가할 폴더 제외
# metro.config.js에서 blockList 확장
```

**장점**: 즉시 시도 가능
**단점**: 근본적 해결 아님

---

## 🛠️ 추가 트러블슈팅

### 모든 Node 프로세스 종료
```cmd
taskkill /F /IM node.exe /T
```

### 모든 캐시 삭제
```cmd
rd /s /q .expo
rd /s /q node_modules\.cache
del /q /s %TEMP%\metro-*
del /q /s %TEMP%\react-native-*
del /q /s %TEMP%\haste-map-*
```

### Expo Doctor 실행
```cmd
npx expo-doctor
```

---

## 📊 현재 프로젝트 상태

✅ **작동하는 것**:
- 백엔드 서버: `http://localhost:5000`
- 관리자 페이지: `http://localhost:5000/admin`
- LoginScreen 보안 수정 완료
- Phase 2 법적 조항 구현 완료
- 가격 연동 시스템 완료

❌ **안 되는 것**:
- Metro Bundler (Windows 파일 와처 타임아웃)

---

## 🎯 권장 조치

### 단기 (오늘):
1. **WSL2 설치** (10분)
2. WSL2에서 `npx expo start` 실행
3. Expo Go 앱으로 QR 스캔

### 중기 (이번 주):
1. EAS Build 설정
2. Preview 빌드로 내부 테스트
3. 스토어 제출 준비

### 장기:
- WSL2를 메인 개발 환경으로 사용
- Windows는 IDE/브라우저만 사용

---

**작성자**: Claude Sonnet 4.5
**날짜**: 2026-02-09
**문제**: Windows Metro Bundler 파일 와처 타임아웃
**권장 해결**: WSL2 또는 EAS Build
