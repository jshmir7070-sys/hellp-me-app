import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { registerApiDocs } from "./api-docs";
import { serveStatic } from "./static";
import { checkDataIntegrity } from "./lib/data-integrity-check";
import { startScheduledSettingsChecker } from "./utils/scheduled-settings";
import { storage } from "./storage";
import { createServer } from "http";
import { notificationWS } from "./websocket";
import { randomUUID } from "crypto";

const app = express();
const httpServer = createServer(app);

notificationWS.initialize(httpServer);

// Security headers (Strict-Transport-Security, X-Content-Type-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: false, // CSP는 프론트엔드와 충돌 가능 → 별도 설정 필요
  crossOriginEmbedderPolicy: false, // Capacitor 앱 호환
}));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// CORS 정책 (T-16 확정)
// - 토큰 기반 인증 (Authorization Bearer + localStorage) 사용
// - 쿠키 미사용: refreshToken은 request body로 전송
// - credentials 설정은 호환성 목적으로만 유지 (실제 쿠키 미사용)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  const isProduction = process.env.NODE_ENV === 'production';

  // 운영에서 허용할 Origin 목록
  const allowedOrigins = [
    // 운영 도메인
    'https://hellp-me.com',
    'https://www.hellp-me.com',
    // Capacitor 네이티브 앱 (iOS/Android WebView)
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'https://localhost',
    // 개발 서버 (프로덕션에서는 제외)
    ...(isProduction ? [] : [
      'http://localhost:5000',
      'http://localhost:5173',
      'http://localhost:5174',  // Partner dev server
      'http://localhost:8081',  // Expo dev server
    ]),
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    // 허용된 origin: CORS 헤더 설정
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    // Origin 없음: 네이티브 앱(Capacitor) 직접 요청, 서버간 호출, 또는 Replit 개발환경
    // 모든 비-브라우저 요청은 Authorization Bearer 토큰으로 인증됨
    // CORS는 브라우저 전용 보안 메커니즘이므로 Origin 없는 요청에는 제한 불필요
    res.header('Access-Control-Allow-Origin', '*');
  } else if (process.env.NODE_ENV !== 'production') {
    // 개발 환경에서만 Replit 도메인 패턴 허용
    const isReplitDev = origin.includes('.replit.dev') || origin.includes('.repl.co');
    if (isReplitDev) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    // 그 외 origin: CORS 헤더 생략 → 브라우저가 차단
  }
  // 프로덕션에서 허용되지 않은 origin: CORS 헤더 생략 → 브라우저가 차단
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Idempotency-Key');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// 업로드 파일 정적 서빙 (이미지 접근용)
import path from "path";
import jwt from "jsonwebtoken";

// 공지사항 이미지는 공개 접근 허용 (앱 팝업에서 인증 헤더 전달 불가)
app.use("/uploads/announcements", express.static(path.join(process.cwd(), "uploads", "announcements")));

// 마감/증빙 이미지는 공개 접근 허용 (React Native Image 컴포넌트에서 인증 헤더 전달 불가)
app.use("/uploads/closing", express.static(path.join(process.cwd(), "uploads", "closing")));

// 오더 배송지 이미지는 공개 접근 허용 (admin 페이지 img 태그에서 인증 헤더 전달 불가)
app.use("/uploads/orders", express.static(path.join(process.cwd(), "uploads", "orders")));

// 나머지 업로드 파일은 인증 필요
app.use("/uploads", (req, res, next) => {
  // Authorization 헤더 또는 쿼리 파라미터에서 토큰 추출
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;

  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (queryToken) {
    token = queryToken;
  }

  if (!token) {
    return res.status(401).json({ message: "인증이 필요합니다" });
  }

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    return res.status(500).json({ message: "서버 인증 설정 오류" });
  }

  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err: any) {
    return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
  }
}, express.static(path.join(process.cwd(), "uploads")));

// Health check endpoint - responds immediately without any DB or async operations
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: Date.now() });
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// 요청 ID 타입 확장
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

app.use((req, res, next) => {
  // 각 요청에 고유 ID 부여
  req.requestId = randomUUID().slice(0, 8);
  res.setHeader("X-Request-ID", req.requestId);
  
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // 운영 환경에서는 응답 본문 로깅 제거 (개인정보/토큰 유출 방지)
      let logLine = `[${req.requestId}] ${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // 개발 환경에서만 응답 본문 로깅 (민감 정보 마스킹)
      if (process.env.NODE_ENV !== "production" && capturedJsonResponse) {
        // 민감한 필드 마스킹 (재귀적으로 처리)
        const sensitiveFields = ['token', 'accessToken', 'refreshToken', 'password', 'phoneNumber', 'email', 'ci', 'di', 'accountNumber', 'bankAccount', 'secret', 'apiKey'];
        
        const maskSensitive = (obj: any): any => {
          if (!obj || typeof obj !== 'object') return obj;
          if (Array.isArray(obj)) return obj.map(maskSensitive);
          
          const result: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (sensitiveFields.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
              result[key] = '[MASKED]';
            } else if (typeof value === 'object' && value !== null) {
              result[key] = maskSensitive(value);
            } else {
              result[key] = value;
            }
          }
          return result;
        };
        
        const sanitized = maskSensitive(capturedJsonResponse);
        // 응답이 너무 길면 생략
        const jsonStr = JSON.stringify(sanitized);
        if (jsonStr.length < 500) {
          logLine += ` :: ${jsonStr}`;
        } else {
          logLine += ` :: [Response too large: ${jsonStr.length} chars]`;
        }
      }

      log(logLine);
    }
  });

  next();
});

// 서버 시작 시 환경변수 체크 (프로덕션에서는 필수)
function checkEnvironmentVariables() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const requiredEnvVars = [
    "DATABASE_URL",
    "SESSION_SECRET",
  ];
  
  // 프로덕션에서 필수인 환경변수 (결제, 인증, SMS, 푸시, 암호화)
  const productionRequiredEnvVars = [
    "JWT_SECRET",
    "ENCRYPTION_KEY",
    "PORTONE_API_SECRET",
    "SOLAPI_API_KEY",
    "SOLAPI_API_SECRET",
    "FIREBASE_SERVICE_ACCOUNT_KEY",
  ];
  
  const recommendedEnvVars = [
    "VAPID_PRIVATE_KEY",
    "FIREBASE_SERVICE_ACCOUNT_KEY",
    "KAKAO_REST_API_KEY",
    "NAVER_CLIENT_ID",
    "NAVER_CLIENT_SECRET",
  ];
  
  console.log("[Startup] Checking environment variables...");
  
  const missingRequired: string[] = [];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`[Startup] MISSING REQUIRED: ${envVar}`);
      missingRequired.push(envVar);
    }
  }
  
  const missingProductionRequired: string[] = [];
  if (isProduction) {
    for (const envVar of productionRequiredEnvVars) {
      if (!process.env[envVar]) {
        console.error(`[Startup] MISSING PRODUCTION REQUIRED: ${envVar}`);
        missingProductionRequired.push(envVar);
      }
    }
  }
  
  let missingRecommended = 0;
  for (const envVar of recommendedEnvVars) {
    if (!process.env[envVar]) {
      console.warn(`[Startup] Missing recommended: ${envVar}`);
      missingRecommended++;
    }
  }
  
  // 필수 환경변수가 없으면 프로덕션에서는 시작 중단
  if (missingRequired.length > 0) {
    const msg = `Required environment variables missing: ${missingRequired.join(', ')}`;
    if (isProduction) {
      throw new Error(msg);
    }
    console.error(`[Startup] ${msg}`);
  }
  
  if (missingProductionRequired.length > 0 && isProduction) {
    throw new Error(`Production required environment variables missing: ${missingProductionRequired.join(', ')}`);
  }
  
  if (missingRecommended > 0) {
    console.log(`[Startup] ${missingRecommended} recommended env vars missing (optional for dev)`);
  } else if (missingRequired.length === 0) {
    console.log("[Startup] All environment variables configured");
  }
}

(async () => {
  checkEnvironmentVariables();
  registerApiDocs(app);
  await registerRoutes(httpServer, app);

  // 서버 시작 시 데이터 무결성 체크 (비동기, 서버 시작 차단 안함)
  checkDataIntegrity().catch(err => console.error("[Startup] Integrity check error:", err));

  // 예약 설정 변경 스케줄러 시작 (60초 간격)
  startScheduledSettingsChecker(storage);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    const requestId = req.requestId || "unknown";

    // 에러 로깅 (요청 ID 포함)
    console.error(`[${requestId}] ERROR ${status}: ${message}`);
    if (status >= 500) {
      console.error(`[${requestId}] Stack:`, err.stack);
    }

    res.status(status).json({ message, requestId });
  });

  // Expo app uses separate Metro bundler, so we just serve static landing page
  serveStatic(app);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "0.0.0.0";
  httpServer.listen(
    {
      port,
      host,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
