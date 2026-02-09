import { z } from "zod";
import { 
  insertUserSchema, 
  insertHelperCredentialSchema, 
  insertHelpPostSchema,
  insertHelperVehicleSchema,
  insertHelperBusinessSchema,
  insertHelperBankAccountSchema,
  insertHelperLicenseSchema,
  insertOrderSchema,
  insertOrderApplicationSchema,
  users,
  helperCredentials,
  helpPosts,
  helperVehicles,
  helperBusinesses,
  helperBankAccounts,
  helperLicenses,
  orders,
  orderApplications
} from "./schema";

// Error schemas
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// API Contract
export const api = {
  auth: {
    signup: {
      method: "POST" as const,
      path: "/api/auth/signup",
      input: z.object({
        email: z.string().email("올바른 이메일 형식을 입력해주세요"),
        password: z.string()
          .min(8, "비밀번호는 8자리 이상이어야 합니다")
          .regex(/[a-zA-Z]/, "영문이 포함되어야 합니다")
          .regex(/[0-9]/, "숫자가 포함되어야 합니다")
          .regex(/[!@#$%^&*(),.?":{}|<>]/, "특수문자가 포함되어야 합니다"),
        name: z.string().min(2, "이름은 2자 이상이어야 합니다"),
        address: z.string().optional(),
        birthDate: z.string().optional(),
        phoneNumber: z.string().optional(),
        role: z.enum(["helper", "requester"]),
        identityVerified: z.boolean().optional(),
        identityCi: z.string().optional(),
        identityDi: z.string().optional(),
        kakaoId: z.string().optional(),
        naverId: z.string().optional(),
      }),
      responses: {
        201: z.object({
          user: z.custom<typeof users.$inferSelect>(),
          token: z.string(),
        }),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: "POST" as const,
      path: "/api/auth/login",
      input: z.object({
        email: z.string().email("올바른 이메일 형식을 입력해주세요"),
        password: z.string(),
      }),
      responses: {
        200: z.object({
          user: z.custom<typeof users.$inferSelect>(),
          token: z.string(),
        }),
        401: errorSchemas.unauthorized,
      },
    },
    me: {
      method: "GET" as const,
      path: "/api/auth/me",
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    checkEmail: {
      method: "POST" as const,
      path: "/api/auth/check-email",
      input: z.object({
        email: z.string().email(),
      }),
      responses: {
        200: z.object({ available: z.boolean() }),
      },
    },
  },

  helpers: {
    createCredential: {
      method: "POST" as const,
      path: "/api/helpers/credential",
      input: insertHelperCredentialSchema,
      responses: {
        201: z.custom<typeof helperCredentials.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    getCredential: {
      method: "GET" as const,
      path: "/api/helpers/credential",
      responses: {
        200: z.custom<typeof helperCredentials.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    updateCredential: {
      method: "PATCH" as const,
      path: "/api/helpers/credential",
      input: insertHelperCredentialSchema.partial(),
      responses: {
        200: z.custom<typeof helperCredentials.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    createVehicle: {
      method: "POST" as const,
      path: "/api/helpers/vehicle",
      input: insertHelperVehicleSchema,
      responses: {
        201: z.custom<typeof helperVehicles.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    getVehicle: {
      method: "GET" as const,
      path: "/api/helpers/vehicle",
      responses: {
        200: z.custom<typeof helperVehicles.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    uploadVehicleImage: {
      method: "POST" as const,
      path: "/api/helpers/vehicle/image",
      responses: {
        200: z.object({ imageUrl: z.string() }),
        400: errorSchemas.validation,
      },
    },
    createBusiness: {
      method: "POST" as const,
      path: "/api/helpers/business",
      input: insertHelperBusinessSchema,
      responses: {
        201: z.custom<typeof helperBusinesses.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    getBusiness: {
      method: "GET" as const,
      path: "/api/helpers/business",
      responses: {
        200: z.custom<typeof helperBusinesses.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    uploadBusinessImage: {
      method: "POST" as const,
      path: "/api/helpers/business/image",
      responses: {
        200: z.object({ imageUrl: z.string() }),
        400: errorSchemas.validation,
      },
    },
    createBankAccount: {
      method: "POST" as const,
      path: "/api/helpers/bank-account",
      input: insertHelperBankAccountSchema,
      responses: {
        201: z.custom<typeof helperBankAccounts.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    getBankAccount: {
      method: "GET" as const,
      path: "/api/helpers/bank-account",
      responses: {
        200: z.custom<typeof helperBankAccounts.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    uploadBankbookImage: {
      method: "POST" as const,
      path: "/api/helpers/bank-account/image",
      responses: {
        200: z.object({ imageUrl: z.string() }),
        400: errorSchemas.validation,
      },
    },
    createLicense: {
      method: "POST" as const,
      path: "/api/helpers/license",
      input: insertHelperLicenseSchema,
      responses: {
        201: z.custom<typeof helperLicenses.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    getLicense: {
      method: "GET" as const,
      path: "/api/helpers/license",
      responses: {
        200: z.custom<typeof helperLicenses.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    uploadDriverLicenseImage: {
      method: "POST" as const,
      path: "/api/helpers/license/driver-image",
      responses: {
        200: z.object({ imageUrl: z.string() }),
        400: errorSchemas.validation,
      },
    },
    uploadCargoLicenseImage: {
      method: "POST" as const,
      path: "/api/helpers/license/cargo-image",
      responses: {
        200: z.object({ imageUrl: z.string() }),
        400: errorSchemas.validation,
      },
    },
  },

  helpPosts: {
    list: {
      method: "GET" as const,
      path: "/api/help-posts",
      input: z.object({
        status: z.enum(["open", "assigned", "completed"]).optional(),
        category: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof helpPosts.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/help-posts",
      input: insertHelpPostSchema,
      responses: {
        201: z.custom<typeof helpPosts.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/help-posts/:id",
      responses: {
        200: z.custom<typeof helpPosts.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/help-posts/:id",
      input: insertHelpPostSchema.partial(),
      responses: {
        200: z.custom<typeof helpPosts.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },

  orders: {
    list: {
      method: "GET" as const,
      path: "/api/orders",
      input: z.object({
        status: z.enum(["open", "applied", "scheduled", "closed"]).optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof orders.$inferSelect>()),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/orders/:id",
      responses: {
        200: z.custom<typeof orders.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/orders",
      input: insertOrderSchema,
      responses: {
        201: z.custom<typeof orders.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    apply: {
      method: "POST" as const,
      path: "/api/orders/:id/apply",
      responses: {
        201: z.custom<typeof orderApplications.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    myApplications: {
      method: "GET" as const,
      path: "/api/orders/my-applications",
      responses: {
        200: z.array(z.custom<typeof orderApplications.$inferSelect>()),
      },
    },
    scheduledOrders: {
      method: "GET" as const,
      path: "/api/orders/scheduled",
      responses: {
        200: z.array(z.custom<typeof orders.$inferSelect>()),
      },
    },
  },
};

// buildUrl helper
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

// Type helpers
export type SignupInput = z.infer<typeof api.auth.signup.input>;
export type LoginInput = z.infer<typeof api.auth.login.input>;
export type AuthResponse = z.infer<typeof api.auth.signup.responses[201]>;
export type HelperCredentialInput = z.infer<typeof api.helpers.createCredential.input>;
export type HelperCredentialResponse = z.infer<typeof api.helpers.createCredential.responses[201]>;
export type HelpPostInput = z.infer<typeof api.helpPosts.create.input>;
export type HelpPostResponse = z.infer<typeof api.helpPosts.create.responses[201]>;
