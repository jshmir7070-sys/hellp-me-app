import { Request, Response, NextFunction } from "express";
import { RATE_LIMIT_WINDOW_SECONDS } from "../constants/auth";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
}

class InMemoryRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const entries = Array.from(this.store.entries());
      for (const [key, entry] of entries) {
        if (entry.resetAt <= now) {
          this.store.delete(key);
        }
      }
    }, 60000);
  }

  check(key: string, windowMs: number, maxRequests: number): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetAt <= now) {
      const resetAt = now + windowMs;
      this.store.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: maxRequests - 1, resetAt };
    }

    if (entry.count >= maxRequests) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
  }

  reset(key: string) {
    this.store.delete(key);
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

const limiter = new InMemoryRateLimiter();

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim().replace(/^::ffff:/, "");
  }
  return req.ip?.replace(/^::ffff:/, "") || req.socket?.remoteAddress?.replace(/^::ffff:/, "") || "unknown";
}

export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.",
    keyGenerator = (req) => getClientIp(req),
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `rate:${req.path}:${keyGenerator(req)}`;
    const result = limiter.check(key, windowMs, maxRequests);

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", result.remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({
        message,
        retryAfter,
      });
    }

    next();
  };
}

export const authRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_WINDOW_SECONDS * 1000,
  maxRequests: 10,
  message: "로그인 시도가 너무 많습니다. 1분 후 다시 시도해주세요.",
});

export const signupRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  message: "회원가입 시도가 너무 많습니다. 1시간 후 다시 시도해주세요.",
});

export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 3,
  message: "비밀번호 재설정 요청이 너무 많습니다. 1시간 후 다시 시도해주세요.",
});

export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: "파일 업로드가 너무 많습니다. 1분 후 다시 시도해주세요.",
});

export const pushRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: "푸시 알림 요청이 너무 많습니다. 1분 후 다시 시도해주세요.",
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  message: "API 요청이 너무 많습니다. 1분 후 다시 시도해주세요.",
});

export const strictRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_WINDOW_SECONDS * 1000,
  maxRequests: 5,
  message: "요청이 너무 많습니다. 1분 후 다시 시도해주세요.",
});

export { limiter, getClientIp };
