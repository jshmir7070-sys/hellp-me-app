import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";

const isProduction = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? "" : "dev-secret-key-change-in-production");
if (!JWT_SECRET && isProduction) {
  throw new Error("JWT_SECRET must be set in production environment");
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    isHqStaff?: boolean | null;
    [key: string]: any;
  };
  adminUser?: {
    id: string;
    role: string;
    isHqStaff?: boolean | null;
    [key: string]: any;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: "Unauthorized" });
  }
}

// Admin roles that are allowed to access admin routes
const ADMIN_ROLES = ["admin", "superadmin"];

export async function adminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await storage.getUser(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // User must have an admin role to access admin routes
    // isHqStaff alone is not sufficient - must also have admin role
    const hasAdminRole = ADMIN_ROLES.includes(user.role);
    
    if (!hasAdminRole) {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    req.adminUser = user;
    req.user = user; // 호환성: 기존 라우트가 req.user 사용
    next();
  } catch (err) {
    res.status(401).json({ message: "Unauthorized" });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ message: "인증이 필요합니다" });
    }
    
    if (user.isHqStaff || user.role === "admin") {
      return next();
    }
    
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: "권한이 없습니다" });
    }
    
    next();
  };
}

export function requireOwner(entityType: "order" | "settlement" | "contract" | "application") {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ message: "인증이 필요합니다" });
    }
    
    if (user.isHqStaff || user.role === "admin") {
      return next();
    }
    
    const entityId = Number(req.params.id || req.params.orderId || req.params.settlementId || req.params.contractId);
    
    if (isNaN(entityId)) {
      return res.status(400).json({ message: "잘못된 요청입니다" });
    }
    
    try {
      let isOwner = false;
      
      switch (entityType) {
        case "order": {
          const order = await storage.getOrder(entityId);
          if (!order) {
            return res.status(404).json({ message: "주문을 찾을 수 없습니다" });
          }
          isOwner = order.requesterId === user.id || 
                    (await checkHelperOrderAccess(user.id, entityId));
          break;
        }
        case "settlement": {
          const settlement = await storage.getSettlementStatement(entityId);
          if (!settlement) {
            return res.status(404).json({ message: "정산을 찾을 수 없습니다" });
          }
          isOwner = settlement.helperId === user.id || settlement.requesterId === user.id;
          break;
        }
        case "contract": {
          const contract = await storage.getJobContract(entityId);
          if (!contract) {
            return res.status(404).json({ message: "계약을 찾을 수 없습니다" });
          }
          isOwner = contract.helperId === user.id || contract.requesterId === user.id;
          break;
        }
        case "application": {
          const applications = await storage.getHelperApplications(user.id);
          const application = applications.find((a: { id: number }) => a.id === entityId);
          if (!application) {
            return res.status(404).json({ message: "지원 내역을 찾을 수 없습니다" });
          }
          isOwner = true;
          break;
        }
      }
      
      if (!isOwner) {
        return res.status(403).json({ message: "해당 데이터에 대한 접근 권한이 없습니다" });
      }
      
      next();
    } catch (error) {
      console.error("[OwnershipCheck] Error:", error);
      return res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  };
}

async function checkHelperOrderAccess(helperId: string, orderId: number): Promise<boolean> {
  const applications = await storage.getOrderApplications(orderId);
  return applications.some((app: { helperId: string }) => app.helperId === helperId);
}

export function requirePermission(permissionCode: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.adminUser || req.user;
    
    if (!user) {
      return res.status(401).json({ message: "인증이 필요합니다" });
    }
    
    if (user.role === "superadmin") {
      return next();
    }
    
    try {
      const hasPermission = await storage.checkUserPermission(user.id, permissionCode);
      if (!hasPermission) {
        console.log(`[Permission] Denied: user=${user.id}, permission=${permissionCode}`);
        return res.status(403).json({ 
          message: "해당 작업에 대한 권한이 없습니다",
          requiredPermission: permissionCode
        });
      }
      next();
    } catch (error) {
      console.error("[Permission] Check error:", error);
      return res.status(500).json({ message: "권한 확인 중 오류가 발생했습니다" });
    }
  };
}

export function requireHelperVerified(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ message: "인증이 필요합니다" });
  }
  
  if (user.role !== 'helper') {
    return next();
  }
  
  if (!user.helperVerified) {
    return res.status(403).json({ 
      message: "헬퍼 인증이 완료되지 않았습니다. 관리자 승인을 기다려주세요.",
      code: "HELPER_NOT_VERIFIED"
    });
  }
  
  next();
}

export function sanitizeForLog(data: any): any {
  if (!data || typeof data !== "object") return data;
  
  const sensitiveFields = [
    "password", "token", "accessToken", "refreshToken",
    "phoneNumber", "email", "ci", "di", "accountNumber",
    "bankAccount", "ssn", "birthDate", "licenseNumber"
  ];
  
  const sanitized: any = Array.isArray(data) ? [] : {};
  
  for (const key of Object.keys(data)) {
    if (sensitiveFields.includes(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof data[key] === "object" && data[key] !== null) {
      sanitized[key] = sanitizeForLog(data[key]);
    } else {
      sanitized[key] = data[key];
    }
  }
  
  return sanitized;
}
