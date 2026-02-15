# Hellp Me - 배송 매칭 플랫폼

배송 기사(헬퍼)와 배송 요청자를 연결하는 매칭 서비스 플랫폼

## 🚀 빠른 시작

### 필수 요구사항
- Node.js 18 이상
- PostgreSQL 14 이상
- Expo CLI
- npm 또는 yarn

### 환경 설정

1. **의존성 설치**
```bash
npm install
```

2. **환경 변수 설정**
```bash
# .env 파일 생성 (.env.example 참고)
cp .env.example .env
```

`.env` 파일에 다음 정보를 입력하세요:
- `DATABASE_URL`: PostgreSQL 연결 문자열
- `JWT_SECRET`: JWT 토큰 시크릿 키
- `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`: SMS 인증 (Solapi)
- `PORTONE_API_KEY`, `PORTONE_API_SECRET`: 결제 (PortOne)
- 기타 필요한 API 키들

3. **데이터베이스 초기화**
```bash
npm run db:push
```

### 🎯 한 번에 모두 실행하기

#### 방법 1: 완전 초기화 + 실행 (첫 실행 시)
```bash
npm run dev
```
이 명령어는 다음을 순차적으로 실행합니다:
1. 데이터베이스 스키마 푸시 (`db:push`)
2. 서버 + Expo 동시 실행 (`start`)

#### 방법 2: 서버 + Expo만 실행 (일반적인 개발)
```bash
npm start
```
이 명령어는 다음을 동시에 실행합니다:
- 백엔드 서버 (포트 5000)
- Expo 개발 서버 (포트 8081)

### 📱 각각 실행하기

개별적으로 실행하려면:

```bash
# 백엔드 서버만
npm run server:dev

# Expo만
npm run expo:local

# 데이터베이스 스키마 푸시
npm run db:push

# Drizzle Studio (DB GUI)
npm run db:studio
```

## 📂 프로젝트 구조

```
Native-App/
├── client/              # React Native 모바일 앱
│   ├── screens/        # 화면 컴포넌트
│   ├── components/     # 공통 컴포넌트
│   ├── navigation/     # 네비게이션 설정
│   └── lib/           # 유틸리티
├── admin/              # React 관리자 웹앱
│   ├── src/
│   │   ├── pages/     # 관리자 페이지
│   │   └── components/ # 관리자 컴포넌트
├── server/             # Express.js 백엔드
│   ├── routes.ts      # API 라우트
│   ├── db.ts          # 데이터베이스 설정
│   ├── integrations/  # 외부 서비스 연동
│   └── utils/         # 유틸리티
├── shared/             # 클라이언트-서버 공유 코드
│   └── schema.ts      # DB 스키마 (Drizzle ORM)
└── uploads/            # 파일 업로드 디렉토리
```

## 🛠 기술 스택

### Frontend
- **모바일**: React Native (Expo)
- **관리자**: React + Vite + TailwindCSS
- **상태 관리**: TanStack Query (React Query)
- **UI**: Radix UI, Lucide Icons

### Backend
- **서버**: Express.js + TypeScript
- **데이터베이스**: PostgreSQL + Drizzle ORM
- **인증**: JWT + bcrypt
- **파일 업로드**: Multer

### 외부 서비스
- **SMS 인증**: Solapi
- **결제**: PortOne
- **세금계산서**: 팝빌 (Popbill)

## 📜 주요 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | DB 초기화 + 서버 + Expo 실행 (첫 실행) |
| `npm start` | 서버 + Expo 동시 실행 |
| `npm run server:dev` | 백엔드 서버만 실행 |
| `npm run expo:local` | Expo만 실행 |
| `npm run db:push` | DB 스키마 푸시 |
| `npm run db:studio` | Drizzle Studio 실행 |
| `npm run server:build` | 서버 프로덕션 빌드 |
| `npm run server:prod` | 서버 프로덕션 실행 |
| `npm run lint` | ESLint 실행 |
| `npm run lint:fix` | ESLint 자동 수정 |
| `npm run check:types` | TypeScript 타입 체크 |
| `npm run format` | Prettier 포맷팅 |
| `npm test` | 테스트 실행 |
| `npm run test:watch` | 테스트 watch 모드 |
| `npm run test:coverage` | 테스트 커버리지 |

## 🔐 보안 설정

### 필수 환경 변수
운영 환경에서는 반드시 다음을 설정하세요:

1. **강력한 JWT_SECRET** (32자 이상)
```bash
JWT_SECRET=$(openssl rand -base64 32)
```

2. **데이터베이스 암호화 키** (32바이트)
```bash
ENCRYPTION_KEY=$(openssl rand -hex 32)
```

3. **프로덕션 모드**
```bash
NODE_ENV=production
```

### 보안 체크리스트
- [ ] `.env` 파일이 `.gitignore`에 포함되어 있는지 확인
- [ ] JWT_SECRET이 안전하게 생성되었는지 확인
- [ ] 데이터베이스 접근 권한이 적절히 설정되었는지 확인
- [ ] HTTPS 사용 (프로덕션)
- [ ] CORS 설정 확인

## 📱 모바일 앱 실행

### iOS
```bash
npm start
# Expo Go 앱에서 QR 코드 스캔
# 또는
npx expo run:ios
```

### Android
```bash
npm start
# Expo Go 앱에서 QR 코드 스캔
# 또는
npx expo run:android
```

### 웹
```bash
npm start
# 그 후 브라우저에서 'w' 키 입력
```

## 🌐 관리자 페이지

서버가 실행되면 관리자 페이지는 다음 URL에서 접근 가능합니다:

```
http://localhost:5000/admin
```

기본 관리자 계정 (첫 실행 시):
- 이메일: admin@hellpme.com
- 비밀번호: (서버 로그 확인 또는 DB에서 직접 생성)

## 🚢 프로덕션 배포

### 1. 서버 빌드
```bash
npm run server:build
```

### 2. 서버 실행
```bash
NODE_ENV=production npm run server:prod
```

### 3. Expo 앱 빌드
```bash
# iOS
npx eas build --platform ios

# Android
npx eas build --platform android
```

## 📊 데이터베이스 관리

### Drizzle Studio 실행
```bash
npm run db:studio
```
브라우저에서 `https://local.drizzle.studio` 열림

### 마이그레이션
```bash
# 스키마 변경 후
npm run db:push
```

## 🧪 테스트

```bash
# 전체 테스트 실행
npm test

# Watch 모드
npm run test:watch

# 커버리지
npm run test:coverage
```

## 🐛 트러블슈팅

### 포트 충돌
서버 포트 5000이 이미 사용 중인 경우:
```bash
# .env 파일에서 PORT 변경
PORT=3000
```

### 데이터베이스 연결 오류
1. PostgreSQL이 실행 중인지 확인
2. `DATABASE_URL`이 올바른지 확인
3. 데이터베이스가 생성되었는지 확인

### Expo 실행 오류
```bash
# 캐시 삭제
npx expo start --clear

# node_modules 재설치
rm -rf node_modules
npm install
```

## 📞 지원

- 이슈: [GitHub Issues](https://github.com/jshmir7070-sys/hellp-me-app/issues)
- 문서: [SPEC_DOCUMENT.md](./SPEC_DOCUMENT.md)

## 📄 라이선스

Private - 상업용 프로젝트

---

**개발자**: Hellp Me Team
**버전**: 1.0.0
**마지막 업데이트**: 2026-02-15
