# 🚀 Hellp Me - 완전한 빌드 및 실행 가이드

> **Windows 환경 기준** | 로컬 개발 환경 구축 가이드

---

## 📋 목차

1. [필수 소프트웨어 설치](#1-필수-소프트웨어-설치)
2. [PostgreSQL 데이터베이스 설정](#2-postgresql-데이터베이스-설정)
3. [프로젝트 설정](#3-프로젝트-설정)
4. [환경 변수 설정](#4-환경-변수-설정)
5. [데이터베이스 초기화](#5-데이터베이스-초기화)
6. [빌드 및 실행](#6-빌드-및-실행)
7. [테스트 및 검증](#7-테스트-및-검증)
8. [문제 해결](#8-문제-해결)

---

## 1. 필수 소프트웨어 설치

### ✅ 1.1. Node.js 설치 (v20 이상)

```bash
# 설치 확인
node --version  # v20.x.x 이상
npm --version   # 10.x.x 이상
```

**설치 방법**:
- 다운로드: https://nodejs.org (LTS 버전 추천)
- Windows: 설치 파일 실행 후 기본 옵션으로 설치

### ✅ 1.2. PostgreSQL 설치 (v14 이상)

```bash
# 설치 확인
psql --version  # PostgreSQL 14.x 이상
```

**설치 방법**:
1. **다운로드**: https://www.postgresql.org/download/windows/
2. **설치 시 설정**:
   - Port: `5432` (기본값)
   - 비밀번호: 기억하기 쉬운 것으로 (예: `postgres`)
   - Locale: `Korean, Korea` 또는 `English`

**설치 후 확인**:
```bash
# Windows 검색에서 "SQL Shell (psql)" 실행
# 또는 PowerShell에서
psql -U postgres
# 비밀번호 입력 후 접속 확인
```

### ✅ 1.3. Git (선택사항)

```bash
# 설치 확인
git --version
```

---

## 2. PostgreSQL 데이터베이스 설정

### 📦 2.1. 데이터베이스 생성

**방법 1: psql 사용** (추천)
```bash
# SQL Shell (psql) 실행 또는 PowerShell에서
psql -U postgres

# PostgreSQL 접속 후
CREATE DATABASE hellpme;

# 생성 확인
\l

# 종료
\q
```

**방법 2: pgAdmin 사용**
1. pgAdmin 실행
2. PostgreSQL 서버 우클릭 → Create → Database
3. Database name: `hellpme`
4. Save

### 📦 2.2. 데이터베이스 사용자 설정 (선택사항)

보안을 위해 별도 사용자 생성:

```sql
-- psql에서 실행
CREATE USER hellpme_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE hellpme TO hellpme_user;
```

---

## 3. 프로젝트 설정

### 📁 3.1. 프로젝트 디렉토리 이동

```bash
cd c:\Users\jshmi\Downloads\Native-App\Native-App
```

### 📦 3.2. 의존성 설치

```bash
# NPM 패키지 설치 (3-5분 소요)
npm install

# 설치 완료 확인
npm list --depth=0
```

**설치 중 경고 발생 시**:
```bash
# 경고는 무시해도 됨 (deprecated 패키지 알림)
# 에러가 발생하면:
rm -rf node_modules package-lock.json
npm install
```

---

## 4. 환경 변수 설정

### 🔧 4.1. .env 파일 생성

```bash
# PowerShell에서
Copy-Item .env.sample .env

# 또는 수동으로 .env.sample을 복사하여 .env로 이름 변경
```

### 🔧 4.2. .env 파일 편집

**최소 필수 설정** (개발 환경):

```env
# ====================================
# 필수 설정
# ====================================

# 데이터베이스 연결 (PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hellpme

# JWT 시크릿 (임의의 32자 이상 문자열)
JWT_SECRET=your-super-secret-jwt-key-32chars-minimum-length
JWT_REFRESH_SECRET=your-refresh-secret-jwt-key-32chars-minimum

# 세션 시크릿
SESSION_SECRET=your-session-secret-32chars-minimum-length

# 서버 URL
BASE_URL=http://localhost:5000

# ====================================
# Mock 모드 (실제 연동 없이 개발 가능)
# ====================================

# 개발 모드에서는 모두 mock으로 설정
NODE_ENV=development
SMS_PROVIDER=mock                  # SMS 인증 (코드: 123456)
PUSH_PROVIDER=mock                 # 푸시 알림
PAYMENT_PROVIDER=mock              # 결제
IDENTITY_PROVIDER=mock             # 본인인증

# 파일 저장소
FILE_STORAGE=local                 # 로컬 파일 시스템 사용

# ====================================
# 선택 설정 (나중에 필요 시)
# ====================================

# OAuth (소셜 로그인)
# KAKAO_REST_API_KEY=
# NAVER_CLIENT_ID=
# NAVER_CLIENT_SECRET=
# OAUTH_BASE_URL=http://localhost:5000

# 실제 SMS 연동 (Solapi)
# SOLAPI_API_KEY=
# SOLAPI_API_SECRET=
# SOLAPI_SENDER_ID=
```

**DATABASE_URL 형식**:
```
postgresql://[사용자명]:[비밀번호]@[호스트]:[포트]/[데이터베이스명]

예시:
postgresql://postgres:postgres@localhost:5432/hellpme
postgresql://hellpme_user:your_password@localhost:5432/hellpme
```

---

## 5. 데이터베이스 초기화

### 🗃️ 5.1. 스키마 생성

**방법 1: Drizzle ORM으로 자동 생성** (추천)

```bash
npm run db:push
```

이 명령어가 하는 일:
- `shared/schema.ts`의 스키마를 읽어서
- PostgreSQL 데이터베이스에 테이블 자동 생성
- 인덱스, 관계 등 모두 설정

**성공 메시지**:
```
✓ Pushing schema to database...
✓ Done!
```

### 🗃️ 5.2. 기존 데이터 복원 (선택사항)

백업 데이터가 있다면:

```bash
# PowerShell에서
Get-Content database_backup.sql | psql -U postgres -d hellpme

# 또는 SQL Shell (psql)에서
psql -U postgres -d hellpme
\i C:/Users/jshmi/Downloads/Native-App/Native-App/database_backup.sql
```

### 🗃️ 5.3. 데이터베이스 확인

```bash
psql -U postgres -d hellpme

# 테이블 목록 확인
\dt

# 예상 테이블:
# users, orders, contracts, payments, settlements 등
```

---

## 6. 빌드 및 실행

### 🚀 6.1. 개발 모드 실행

**터미널 2개 필요**:

#### 터미널 1: 백엔드 서버
```bash
cd c:\Users\jshmi\Downloads\Native-App\Native-App
npm run server:dev
```

**성공 시 출력**:
```
[Startup] Checking environment variables...
[Startup] All environment variables configured
🚀 Registering modular routes...
✅ Auth routes registered
✅ Order routes registered
✅ All modular routes registered
serving on port 5000
```

#### 터미널 2: 프론트엔드 (Expo)
```bash
cd c:\Users\jshmi\Downloads\Native-App\Native-App
npm run expo:dev
```

**성공 시 출력**:
```
› Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

› Press a │ open Android
› Press w │ open web

› Press j │ open debugger
› Press r │ reload app
› Press m │ toggle menu
› Press ? │ show all commands
```

### 🚀 6.2. 프로덕션 빌드

#### 백엔드 빌드
```bash
npm run server:build
```

빌드 결과: `server_dist/index.js`

#### 백엔드 실행 (프로덕션)
```bash
npm run server:prod
```

#### 프론트엔드 빌드
```bash
npm run expo:static:build
```

---

## 7. 테스트 및 검증

### ✅ 7.1. 서버 Health Check

```bash
# 브라우저에서
http://localhost:5000/api/health

# 또는 curl로
curl http://localhost:5000/api/health
```

**예상 응답**:
```json
{
  "status": "ok",
  "timestamp": 1707289200000
}
```

### ✅ 7.2. API 테스트

**Postman 또는 Thunder Client로 테스트**:

#### 1. 회원가입
```http
POST http://localhost:5000/api/auth/signup
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123",
  "name": "테스트 사용자",
  "phone": "010-1234-5678",
  "role": "requester"
}
```

#### 2. 로그인
```http
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

**예상 응답**:
```json
{
  "success": true,
  "user": {
    "id": "...",
    "email": "test@example.com",
    "name": "테스트 사용자",
    "role": "requester"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

#### 3. 내 정보 조회
```http
GET http://localhost:5000/api/auth/me
Authorization: Bearer [accessToken]
```

### ✅ 7.3. 테스트 실행

```bash
# 전체 테스트
npm test

# 서버 테스트만
npm run test:server

# 커버리지 포함
npm run test:coverage
```

### ✅ 7.4. 프론트엔드 확인

#### 웹 브라우저
```bash
# Expo 실행 후 'w' 키 누르기
# 또는 브라우저에서 직접 접속
http://localhost:8081
```

#### 모바일 (Expo Go)
1. 스마트폰에 **Expo Go** 앱 설치
   - Android: Google Play Store
   - iOS: App Store

2. 같은 Wi-Fi 네트워크에 연결

3. Expo Go 앱에서 QR 코드 스캔

---

## 8. 문제 해결

### ❌ 8.1. PostgreSQL 연결 실패

**증상**:
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**해결 방법**:

1. **PostgreSQL 서비스 확인**:
```bash
# Windows 서비스 관리자
services.msc

# "postgresql-x64-14" 서비스 확인
# 시작되어 있지 않으면 시작
```

2. **포트 확인**:
```bash
netstat -an | findstr 5432
# LISTENING 상태여야 함
```

3. **DATABASE_URL 확인**:
   - 사용자명, 비밀번호, 포트 번호 확인
   - 특수문자가 있으면 URL 인코딩 필요

### ❌ 8.2. 포트 충돌

**증상**:
```
Error: listen EADDRINUSE: address already in use :::5000
```

**해결 방법**:

1. **사용 중인 프로세스 확인**:
```bash
netstat -ano | findstr :5000
```

2. **프로세스 종료**:
```bash
# PID 확인 후
taskkill /PID [PID번호] /F
```

3. **다른 포트 사용**:
```env
# .env 파일에서
PORT=5001
```

### ❌ 8.3. npm install 실패

**해결 방법**:

```bash
# 1. 캐시 정리
npm cache clean --force

# 2. node_modules 삭제
rm -rf node_modules package-lock.json

# 3. 재설치
npm install
```

### ❌ 8.4. Expo 실행 실패

**증상**:
```
Error: EXPO_PUBLIC_DOMAIN is not defined
```

**해결 방법**:

Windows에서는 환경 변수 설정 방식이 다릅니다:

```bash
# PowerShell에서
$env:EXPO_PUBLIC_DOMAIN="localhost:5000"
npm run expo:dev

# 또는 package.json 스크립트 수정
# "expo:dev": "set EXPO_PUBLIC_DOMAIN=localhost:5000 && npx expo start"
```

### ❌ 8.5. 데이터베이스 스키마 오류

**증상**:
```
relation "users" does not exist
```

**해결 방법**:

```bash
# 스키마 재생성
npm run db:push
```

### ❌ 8.6. 테스트 실패

**증상**:
```
Test suite failed to run
```

**해결 방법**:

1. **타입 확인**:
```bash
npm run check:types
```

2. **Jest 캐시 정리**:
```bash
npx jest --clearCache
npm test
```

---

## 🎯 빠른 시작 체크리스트

모든 단계를 순서대로 체크하세요:

- [ ] Node.js 설치 완료 (`node --version` 확인)
- [ ] PostgreSQL 설치 완료 (`psql --version` 확인)
- [ ] 데이터베이스 `hellpme` 생성
- [ ] `npm install` 완료
- [ ] `.env` 파일 생성 및 설정
- [ ] `npm run db:push` 실행 (스키마 생성)
- [ ] `npm run server:dev` 실행 (터미널 1)
- [ ] `npm run expo:dev` 실행 (터미널 2)
- [ ] http://localhost:5000/api/health 접속 확인
- [ ] API 테스트 (Postman/Thunder Client)
- [ ] 프론트엔드 확인 (웹 또는 모바일)

---

## 📊 서버 포트 정보

| 서비스 | 포트 | URL |
|--------|------|-----|
| 백엔드 API | 5000 | http://localhost:5000 |
| Expo Metro | 8081 | http://localhost:8081 |
| PostgreSQL | 5432 | localhost:5432 |

---

## 🔗 추가 리소스

### 프로젝트 문서
- [REFACTORING_GUIDE.md](./REFACTORING_GUIDE.md) - 리팩토링 가이드
- [QUICK_START.md](./QUICK_START.md) - 빠른 시작
- [LOCAL_SETUP.md](./LOCAL_SETUP.md) - 로컬 설정 (원본)
- [SPEC_DOCUMENT.md](./SPEC_DOCUMENT.md) - 프로젝트 스펙

### 외부 문서
- [PostgreSQL 설치 가이드](https://www.postgresql.org/docs/)
- [Node.js 공식 문서](https://nodejs.org/docs/)
- [Expo 공식 문서](https://docs.expo.dev/)

---

## 🎉 성공!

모든 설정이 완료되면:

✅ **백엔드 서버**: http://localhost:5000
✅ **프론트엔드**: http://localhost:8081
✅ **API 테스트**: Postman/Thunder Client
✅ **데이터베이스**: PostgreSQL (hellpme)

**이제 개발을 시작할 수 있습니다!** 🚀

---

**작성일**: 2026-02-07
**작성자**: Claude Code Assistant
**버전**: 1.0.0
