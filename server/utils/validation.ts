import { z } from "zod";
import { Request, Response, NextFunction } from "express";

export function validateBody<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstError = result.error.errors[0];
      return res.status(400).json({
        message: firstError?.message || "입력값이 올바르지 않습니다",
        field: firstError?.path?.join("."),
        errors: result.error.errors.map(e => ({
          field: e.path.join("."),
          message: e.message
        }))
      });
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const firstError = result.error.errors[0];
      return res.status(400).json({
        message: firstError?.message || "쿼리 파라미터가 올바르지 않습니다",
        field: firstError?.path?.join("."),
      });
    }
    req.query = result.data;
    next();
  };
}

export function validateParams<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const firstError = result.error.errors[0];
      return res.status(400).json({
        message: firstError?.message || "경로 파라미터가 올바르지 않습니다",
        field: firstError?.path?.join("."),
      });
    }
    req.params = result.data;
    next();
  };
}

export const validationSchemas = {
  phoneNumber: z.string()
    .min(10, "전화번호는 10자리 이상이어야 합니다")
    .max(15, "전화번호는 15자리 이하여야 합니다")
    .regex(/^[0-9-]+$/, "전화번호 형식이 올바르지 않습니다"),
  
  email: z.string().email("올바른 이메일 형식을 입력해주세요"),
  
  name: z.string()
    .min(2, "이름은 2자 이상이어야 합니다")
    .max(50, "이름은 50자 이하여야 합니다"),
  
  uuid: z.string().uuid("올바른 ID 형식이 아닙니다"),
  
  positiveInt: z.number()
    .int("정수만 입력 가능합니다")
    .positive("양수만 입력 가능합니다"),
  
  nonNegativeInt: z.number()
    .int("정수만 입력 가능합니다")
    .min(0, "0 이상의 값만 입력 가능합니다"),
  
  price: z.number()
    .min(0, "가격은 0 이상이어야 합니다")
    .max(100000000, "가격이 너무 큽니다"),
  
  percentage: z.number()
    .min(0, "비율은 0 이상이어야 합니다")
    .max(100, "비율은 100 이하여야 합니다"),
  
  date: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    "올바른 날짜 형식이 아닙니다"
  ),
  
  reason: z.string()
    .min(1, "사유를 입력해주세요")
    .max(1000, "사유는 1000자 이하로 입력해주세요"),
};

export const authSchemas = {
  findEmail: z.object({
    phoneNumber: validationSchemas.phoneNumber,
    name: validationSchemas.name,
  }),
  
  resetPassword: z.object({
    email: validationSchemas.email,
    phoneNumber: validationSchemas.phoneNumber,
    name: validationSchemas.name,
  }),
  
  sendPhoneCode: z.object({
    phoneNumber: validationSchemas.phoneNumber,
  }),
  
  verifyPhone: z.object({
    phoneNumber: validationSchemas.phoneNumber,
    code: z.string().length(6, "인증번호는 6자리입니다"),
  }),
  
  changePassword: z.object({
    currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요"),
    newPassword: z.string()
      .min(8, "비밀번호는 8자리 이상이어야 합니다")
      .regex(/[a-zA-Z]/, "영문이 포함되어야 합니다")
      .regex(/[0-9]/, "숫자가 포함되어야 합니다")
      .regex(/[!@#$%^&*(),.?":{}|<>]/, "특수문자가 포함되어야 합니다"),
  }),
  
  refreshToken: z.object({
    refreshToken: z.string().min(1, "리프레시 토큰이 필요합니다"),
  }),
};

export const orderSchemas = {
  create: z.object({
    title: z.string().min(1, "제목을 입력해주세요").max(200, "제목은 200자 이하로 입력해주세요"),
    description: z.string().max(2000, "설명은 2000자 이하로 입력해주세요").optional(),
    pickupAddress: z.string().min(1, "픽업 주소를 입력해주세요"),
    pickupAddressDetail: z.string().optional(),
    deliveryAddress: z.string().min(1, "배송 주소를 입력해주세요"),
    deliveryAddressDetail: z.string().optional(),
    pickupDate: z.string().min(1, "픽업 날짜를 선택해주세요"),
    pickupTime: z.string().optional(),
    deliveryDate: z.string().optional(),
    deliveryTime: z.string().optional(),
    boxCount: validationSchemas.nonNegativeInt.optional(),
    pricePerBox: validationSchemas.price.optional(),
    totalPrice: validationSchemas.price.optional(),
    specialInstructions: z.string().max(1000, "특별 지시사항은 1000자 이하로 입력해주세요").optional(),
    cargoType: z.string().optional(),
    vehicleType: z.string().optional(),
    category: z.string().optional(),
    imageUrls: z.array(z.string()).optional(),
  }),
  
  update: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    pickupAddress: z.string().min(1).optional(),
    pickupAddressDetail: z.string().optional(),
    deliveryAddress: z.string().min(1).optional(),
    deliveryAddressDetail: z.string().optional(),
    pickupDate: z.string().optional(),
    pickupTime: z.string().optional(),
    deliveryDate: z.string().optional(),
    deliveryTime: z.string().optional(),
    boxCount: validationSchemas.nonNegativeInt.optional(),
    pricePerBox: validationSchemas.price.optional(),
    totalPrice: validationSchemas.price.optional(),
    specialInstructions: z.string().max(1000).optional(),
    status: z.enum(["pending", "matched", "in_progress", "completed", "cancelled"]).optional(),
  }),
  
  apply: z.object({
    message: z.string().max(500, "메시지는 500자 이하로 입력해주세요").optional(),
    proposedPrice: validationSchemas.price.optional(),
  }),
  
  confirmMatching: z.object({
    applicationId: z.union([z.string(), z.number()]).transform(val => 
      typeof val === 'string' ? parseInt(val, 10) : val
    ),
  }),
};

export const settlementSchemas = {
  confirm: z.object({
    reason: validationSchemas.reason.optional(),
  }),
  
  deduct: z.object({
    amount: validationSchemas.positiveInt,
    reason: validationSchemas.reason,
  }),
  
  adjust: z.object({
    amount: z.number().refine(val => val !== 0, "조정 금액은 0이 아니어야 합니다"),
    reason: validationSchemas.reason,
  }),
};

export const disputeSchemas = {
  create: z.object({
    orderId: z.union([z.string(), z.number()]),
    incidentType: z.enum(["damage", "delay", "dispute", "complaint", "other"]),
    description: z.string()
      .min(5, "분쟁 내용은 5자 이상 입력해주세요")
      .max(2000, "분쟁 내용은 2000자 이하로 입력해주세요"),
    evidenceUrls: z.array(z.string()).optional(),
  }),
  
  resolve: z.object({
    resolution: z.enum(["requester_favor", "helper_favor", "partial", "cancelled"]),
    resolutionNote: z.string()
      .min(1, "해결 사유를 입력해주세요")
      .max(1000, "해결 사유는 1000자 이하로 입력해주세요"),
    deductAmount: validationSchemas.nonNegativeInt.optional(),
  }),
};

export const contractSchemas = {
  create: z.object({
    requesterId: z.string().min(1, "요청자 ID가 필요합니다"),
    helperId: z.string().min(1, "헬퍼 ID가 필요합니다"),
    orderId: z.union([z.string(), z.number()]).optional(),
    startDate: validationSchemas.date,
    endDate: validationSchemas.date.optional(),
    terms: z.string().max(5000, "계약 조건은 5000자 이하로 입력해주세요").optional(),
    totalAmount: validationSchemas.price.optional(),
  }),
  
  updateStatus: z.object({
    status: z.enum(["pending", "active", "completed", "cancelled", "disputed"]),
    reason: z.string().max(500).optional(),
  }),
};

export const pushSchemas = {
  registerToken: z.object({
    token: z.string().min(1, "FCM 토큰이 필요합니다"),
    platform: z.enum(["web", "android", "ios"]).optional(),
    deviceId: z.string().optional(),
  }),
  
  sendNotification: z.object({
    userId: z.string().min(1, "사용자 ID가 필요합니다"),
    title: z.string().min(1, "제목이 필요합니다").max(100, "제목은 100자 이하로 입력해주세요"),
    body: z.string().min(1, "내용이 필요합니다").max(500, "내용은 500자 이하로 입력해주세요"),
    data: z.record(z.string()).optional(),
  }),
};

export const adminSchemas = {
  updateUserStatus: z.object({
    status: z.enum(["pending", "approved", "rejected", "suspended"]),
    reason: z.string().max(500).optional(),
  }),
  
  updateOnboardingStatus: z.object({
    status: z.enum(["pending", "approved", "rejected"]),
    rejectReason: z.string().max(500).optional(),
  }),
  
  commissionPolicy: z.object({
    helperCommissionRate: validationSchemas.percentage,
    platformRate: validationSchemas.percentage.optional(),
    teamLeaderRate: validationSchemas.percentage.optional(),
    minCommission: validationSchemas.nonNegativeInt.optional(),
    maxCommission: validationSchemas.nonNegativeInt.optional(),
    effectiveFrom: validationSchemas.date.optional(),
  }),
  
  actionWithReason: z.object({
    reason: validationSchemas.reason,
  }),
};

export const clientErrorSchema = z.object({
  timestamp: z.string().optional(),
  severity: z.enum(["critical", "error", "warning", "info"]),
  message: z.string().min(1).max(2000),
  stack: z.string().max(10000).optional(),
  context: z.record(z.unknown()).optional(),
  url: z.string().max(500).optional(),
});

export const idParamSchema = z.object({
  id: z.string().min(1, "ID가 필요합니다"),
});

export const orderIdParamSchema = z.object({
  orderId: z.string().min(1, "주문 ID가 필요합니다"),
});

export const paginationQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => {
    const parsed = val ? parseInt(val, 10) : 20;
    return Math.min(parsed, 100);
  }),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
});
