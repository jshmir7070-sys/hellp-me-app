# Hellp Me - 로컬 설치 가이드

## 필수 소프트웨어

1. **Node.js** v20 이상
   - 다운로드: https://nodejs.org

2. **PostgreSQL** v14 이상
   - 다운로드: https://postgresql.org
   - Mac: `brew install postgresql@16`
   - Windows: 설치 파일 다운로드

3. **Git** (선택사항)

## 설치 순서

### 1. 코드 다운로드
Replit에서 zip 파일로 다운로드하거나 Git으로 클론

### 2. 의존성 설치
```bash
cd hellpme
npm install
```

### 3. 환경변수 설정
`.env.example` 파일을 `.env`로 복사 후 수정:
```bash
cp .env.example .env
```

최소 필수 설정:
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/hellpme
SESSION_SECRET=any-random-string-32-chars
JWT_SECRET=any-random-string-32-chars
```

### 4. 데이터베이스 설정

#### 새 데이터베이스 생성 (빈 상태로 시작)
```bash
createdb hellpme
npm run db:push
```

#### 백업에서 복원 (기존 데이터 포함)
```bash
createdb hellpme
psql hellpme < database_backup.sql
```

### 5. 서버 실행

백엔드 서버 (터미널 1):
```bash
npm run server:dev
```

프론트엔드 서버 (터미널 2):
```bash
npm run expo:dev
```

### 6. 접속
- 웹: http://localhost:8081
- 모바일: Expo Go 앱으로 QR 코드 스캔

## 주의사항

### Replit Object Storage
로컬에서는 Replit Object Storage가 작동하지 않습니다.
파일 업로드 기능을 사용하려면 로컬 파일 시스템 또는 S3 등으로 대체해야 합니다.

### SMS 인증
개발 모드(`NODE_ENV=development`)에서는 Mock SMS가 사용됩니다.
인증코드는 항상 `123456`입니다.

### 푸시 알림
Firebase 설정이 없으면 푸시 알림이 작동하지 않습니다.

## 선택적 API 키

| 서비스 | 용도 | 없을 경우 |
|--------|------|----------|
| Solapi | SMS 인증 | Mock 모드 (코드: 123456) |
| Kakao | 카카오 로그인 | 소셜 로그인 비활성화 |
| Naver | 네이버 로그인 | 소셜 로그인 비활성화 |
| Firebase | 푸시 알림 | 알림 비활성화 |
| Popbill | 세금계산서 | 세금계산서 기능 비활성화 |

## 문제 해결

### 포트 충돌
- 백엔드: 5000 포트
- 프론트엔드: 8081 포트

### 데이터베이스 연결 실패
1. PostgreSQL 서비스 실행 확인
2. DATABASE_URL 형식 확인
3. 사용자/비밀번호 확인

### npm install 실패
```bash
rm -rf node_modules package-lock.json
npm install
```
