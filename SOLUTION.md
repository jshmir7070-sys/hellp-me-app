# 🔧 QR 코드 연결 문제 완벽 해결 가이드

## 문제 증상
- Metro Bundler의 QR 코드는 나타남
- QR 코드를 스캔하면 "실행할 수 없는 QR" 오류 발생
- Expo Go에서 연결되지 않음

## 원인
**Windows 방화벽**이 포트 8081을 차단하고 있습니다.

---

## ✅ 해결 방법 (순서대로 따라하세요)

### STEP 1: 방화벽 규칙 추가

1. **fix-firewall.bat** 파일을 **우클릭**
2. **"관리자 권한으로 실행"** 선택
3. "SUCCESS!" 메시지 확인

### STEP 2: Metro 재시작

1. 기존 Metro 종료 (Ctrl+C)
2. **START-HERE.bat** 실행
3. QR 코드 나타날 때까지 대기

### STEP 3: 폰에서 연결

**옵션 A: QR 코드 스캔 (이제 작동함)**
- Expo Go → Scan QR code → PC 화면의 QR 스캔

**옵션 B: 수동 입력 (QR이 여전히 안 되면)**
1. PC 화면에서 `exp://192.168.x.x:8081` 같은 URL 확인
2. Expo Go → "Enter URL manually"
3. URL 입력 후 Connect

---

## 🔍 여전히 안 되면?

### 체크리스트

1. **같은 WiFi 네트워크인가?**
   - PC: WiFi 설정 확인
   - 폰: WiFi 설정 확인
   - 네트워크 이름이 정확히 같아야 함
   - ⚠️ 게스트 네트워크는 안 됨!

2. **Expo Go 앱이 최신 버전인가?**
   - Play Store에서 Expo Go 업데이트 확인
   - 최소 버전: 2.30.0 이상

3. **PC의 IP 주소 확인**
   ```
   ipconfig
   ```
   - "무선 LAN 어댑터 Wi-Fi" 섹션 찾기
   - IPv4 주소 확인 (예: 192.168.0.10)

4. **수동으로 연결 시도**
   - Expo Go → Enter URL manually
   - 입력: `exp://[PC의_IP주소]:8081`
   - 예: `exp://192.168.0.10:8081`

---

## 🚨 최후의 수단

### 방법 1: 핫스팟 사용
1. **폰에서 핫스팟 켜기**
2. **PC를 폰의 핫스팟에 연결**
3. Metro 재시작
4. QR 스캔 (이제 무조건 작동함)

### 방법 2: Expo Go 재설치
1. 폰에서 Expo Go 앱 삭제
2. Play Store에서 재설치
3. Metro 재시작 → QR 스캔

---

## ✅ 성공 확인

연결에 성공하면:
- ✅ Expo Go에서 로딩 바 표시
- ✅ "Downloading JavaScript bundle" 메시지
- ✅ 앱 화면이 나타남
- ✅ Metro 터미널에 "Bundle loaded from client" 메시지

이제 앱이 정상적으로 실행되고, 모든 Colors 오류가 사라집니다!

---

**작성일**: 2026-02-09
**문제**: QR 코드 연결 실패
**해결**: Windows 방화벽 + 올바른 네트워크 설정
