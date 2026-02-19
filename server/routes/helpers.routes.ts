/**
 * Helper profile, credentials, onboarding routes
 *
 * Credential upload, license, vehicle, business info, bank account,
 * requester business, refund account, onboarding flow, terms agreement
 */

import type { RouteContext } from "./types";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { api } from "@shared/routes";

export async function registerHelperRoutes(ctx: RouteContext): Promise<void> {
  const {
    app,
    requireAuth,
    storage,
    db,
    sql,
    eq,
    objectStorageService,
    encrypt,
    decrypt,
    hashForSearch,
    maskAccountNumber,
    broadcastToAllAdmins,
    notificationWS,
    sendPushToUser,
    getOrCreatePersonalCode,
  } = ctx;

  type AuthenticatedRequest = any;

  // Import shared schema tables
  const { requesterRefundAccounts, insertRequesterRefundAccountSchema } = await import("@shared/schema");
  const { isValidImageBuffer } = await import("../utils/file-validation");

  // Helper credential routes
  const credentialsUploadsDir = path.join(process.cwd(), "uploads", "credentials");
  await fs.promises.mkdir(credentialsUploadsDir, { recursive: true });

  const uploadCredentialImage = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, credentialsUploadsDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("이미지 파일만 업로드 가능합니다"));
      }
    },
  });

  // Vehicle image upload multer setup
  const vehicleUploadsDir = path.join(process.cwd(), "uploads", "vehicles");
  await fs.promises.mkdir(vehicleUploadsDir, { recursive: true });

  const uploadVehicleImage = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, vehicleUploadsDir),
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      if (extname && mimetype) {
        cb(null, true);
      } else {
        cb(new Error("이미지 파일만 업로드 가능합니다 (jpg, png, webp)"));
      }
    },
  });

  app.post("/api/helpers/credential/upload", uploadCredentialImage.single("file"), requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "파일을 선택해주세요" });
      }

      const docType = req.body.type || "document";
      const imageUrl = `/uploads/credentials/${req.file.filename}`;
      res.json({ success: true, url: imageUrl, type: docType });
    } catch (err: any) {
      console.error("Credential upload error:", err);
      res.status(500).json({ message: "업로드에 실패했습니다" });
    }
  });

  app.post(api.helpers.createCredential.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const input = api.helpers.createCredential.input.parse(req.body);
      const credential = await storage.createHelperCredential(userId, input);
      res.status(201).json(credential);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.helpers.getCredential.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const credential = await storage.getHelperCredential(userId);
      if (!credential) {
        return res.status(404).json({ message: "Credential not found" });
      }
      res.json(credential);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper license (운전면허증/화물자격증) endpoints
  app.get("/api/helpers/me/license", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }
      const license = await storage.getHelperLicense(user.id);
      if (!license) {
        return res.status(404).json({ message: "면허증 정보가 없습니다" });
      }
      res.json(license);
    } catch (err: any) {
      console.error("Get helper license error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/helpers/me/license", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }
      const existing = await storage.getHelperLicense(user.id);
      if (existing) {
        const updated = await storage.updateHelperLicense(user.id, {
          driverLicenseImageUrl: req.body.driverLicenseImageUrl || existing.driverLicenseImageUrl,
          cargoLicenseImageUrl: req.body.cargoLicenseImageUrl || existing.cargoLicenseImageUrl,
        });
        return res.json(updated);
      }
      const license = await storage.createHelperLicense(user.id, {
        driverLicenseImageUrl: req.body.driverLicenseImageUrl,
        cargoLicenseImageUrl: req.body.cargoLicenseImageUrl,
      });
      res.status(201).json(license);
    } catch (err: any) {
      console.error("Create helper license error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper vehicle (차량정보) endpoints
  app.get("/api/helpers/me/vehicle", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }
      const vehicle = await storage.getHelperVehicle(user.id);
      if (!vehicle) {
        return res.status(404).json({ message: "차량 정보가 없습니다" });
      }
      res.json(vehicle);
    } catch (err: any) {
      console.error("Get helper vehicle error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/helpers/me/vehicle", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }
      const { vehicleType, plateNumber, vehicleImageUrl } = req.body;
      if (!vehicleType || !plateNumber) {
        return res.status(400).json({ message: "차종과 차량번호는 필수입니다" });
      }
      const existing = await storage.getHelperVehicle(user.id);
      if (existing) {
        const updated = await storage.updateHelperVehicle(user.id, {
          vehicleType,
          plateNumber,
          vehicleImageUrl: vehicleImageUrl || existing.vehicleImageUrl,
        });
        return res.json(updated);
      }
      const vehicle = await storage.createHelperVehicle(user.id, {
        vehicleType,
        plateNumber,
        vehicleImageUrl,
      });
      res.status(201).json(vehicle);
    } catch (err: any) {
      console.error("Create helper vehicle error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper business (사업자등록) endpoints
  app.get("/api/helpers/me/business", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }
      const business = await storage.getHelperBusiness(user.id);
      if (!business) {
        return res.status(404).json({ message: "사업자 정보가 없습니다" });
      }
      res.json(business);
    } catch (err: any) {
      console.error("Get helper business error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/helpers/me/business", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }
      const { businessNumber, businessName, representativeName, address, businessType, businessCategory, email, businessImageUrl } = req.body;
      if (!businessNumber || !businessName || !representativeName || !address || !businessType || !businessCategory) {
        return res.status(400).json({ message: "필수 정보를 모두 입력해주세요" });
      }
      const existing = await storage.getHelperBusiness(user.id);
      if (existing) {
        const updated = await storage.updateHelperBusiness(user.id, {
          businessNumber,
          businessName,
          representativeName,
          address,
          businessType,
          businessCategory,
          email,
          businessImageUrl,
        });
        return res.json(updated);
      }
      const business = await storage.createHelperBusiness(user.id, {
        businessNumber,
        businessName,
        representativeName,
        address,
        businessType,
        businessCategory,
        email,
        businessImageUrl,
      });
      res.status(201).json(business);
    } catch (err: any) {
      console.error("Create helper business error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper bank account (정산계좌) endpoints
  app.get("/api/helpers/me/bank-account", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }
      const account = await storage.getHelperBankAccount(user.id);
      if (!account) {
        return res.status(404).json({ message: "계좌 정보가 없습니다" });
      }
      res.json({ ...account, accountNumber: decrypt(account.accountNumber) });
    } catch (err: any) {
      console.error("Get helper bank account error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/helpers/me/bank-account", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }
      const { accountHolder, bankName, accountNumber, bankbookImageUrl } = req.body;
      if (!accountHolder || !bankName || !accountNumber) {
        return res.status(400).json({ message: "예금주, 은행명, 계좌번호는 필수입니다" });
      }
      const existing = await storage.getHelperBankAccount(user.id);
      if (existing) {
        return res.status(400).json({ message: "이미 등록된 계좌 정보가 있습니다" });
      }
      const account = await storage.createHelperBankAccount(user.id, {
        accountHolder,
        bankName,
        accountNumber: encrypt(accountNumber),
        bankbookImageUrl,
      });
      res.status(201).json(account);
    } catch (err: any) {
      console.error("Create helper bank account error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Help posts routes
  app.get(api.helpPosts.list.path, async (req, res) => {
    try {
      const posts = await storage.getAllHelpPosts();
      res.json(posts);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.helpPosts.create.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const input = api.helpPosts.create.input.parse(req.body);
      const post = await storage.createHelpPost(userId, input);
      res.status(201).json(post);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.helpPosts.get.path, async (req, res) => {
    try {
      const post = await storage.getHelpPost(Number(req.params.id));
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      res.json(post);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch(api.helpPosts.update.path, async (req, res) => {
    try {
      const input = api.helpPosts.update.input.parse(req.body);
      const post = await storage.updateHelpPost(Number(req.params.id), input);
      res.json(post);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper vehicle routes
  app.post(api.helpers.createVehicle.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const input = api.helpers.createVehicle.input.parse(req.body);
      const vehicle = await storage.createHelperVehicle(userId, input);
      res.status(201).json(vehicle);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.helpers.getVehicle.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const vehicle = await storage.getHelperVehicle(userId);
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      res.json(vehicle);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.helpers.uploadVehicleImage.path, uploadVehicleImage.single("image"), requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "이미지를 선택해주세요" });
      }
      const imageUrl = `/uploads/vehicles/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper business routes
  const businessUploadsDir = path.join(process.cwd(), "uploads", "businesses");
  await fs.promises.mkdir(businessUploadsDir, { recursive: true });

  const uploadBusinessImage = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, businessUploadsDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("이미지 파일만 업로드 가능합니다"));
      }
    },
  });

  app.post(api.helpers.createBusiness.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const input = api.helpers.createBusiness.input.parse(req.body);

      const existing = await storage.getHelperBusiness(userId);
      let business;
      if (existing) {
        business = await storage.updateHelperBusiness(userId, input);
      } else {
        business = await storage.createHelperBusiness(userId, input);
      }
      res.status(201).json(business);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.helpers.getBusiness.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const business = await storage.getHelperBusiness(userId);
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      res.json(business);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.helpers.uploadBusinessImage.path, uploadBusinessImage.single("image"), requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "이미지를 선택해주세요" });
      }
      const imageUrl = `/uploads/businesses/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Requester business routes (의뢰인 사업자 등록)
  app.post("/api/requesters/business", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 의뢰인만 접근 가능
      if (user.role !== "requester") {
        return res.status(403).json({ message: "의뢰인만 접근 가능합니다" });
      }

      const { businessNumber, businessName, representativeName, address, businessType, businessCategory, businessImageUrl } = req.body;

      if (!businessNumber || !businessName || !representativeName || !address || !businessType || !businessCategory) {
        return res.status(400).json({ message: "필수 항목을 모두 입력해주세요" });
      }

      const existing = await storage.getRequesterBusiness(userId);
      let business;
      if (existing) {
        business = await storage.updateRequesterBusiness(userId, {
          businessNumber, businessName, representativeName, address, businessType, businessCategory, businessImageUrl
        });
      } else {
        business = await storage.createRequesterBusiness(userId, {
          businessNumber, businessName, representativeName, address, businessType, businessCategory, businessImageUrl
        });
      }

      // 세금계산서 발행 활성화
      await storage.updateUserPreferences(userId, { taxInvoiceEnabled: true });

      res.status(201).json(business);
    } catch (err: any) {
      console.error("Requester business error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/requesters/business", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 의뢰인만 접근 가능
      if (user.role !== "requester") {
        return res.status(403).json({ message: "의뢰인만 접근 가능합니다" });
      }

      const business = await storage.getRequesterBusiness(userId);
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      res.json(business);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/requesters/business/image", uploadBusinessImage.single("image"), requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;

      // 역할 검증: 의뢰인만 접근 가능
      if (user.role !== "requester") {
        return res.status(403).json({ message: "의뢰인만 접근 가능합니다" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "이미지를 선택해주세요" });
      }
      const imageUrl = `/uploads/businesses/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Requester refund account routes
  app.get("/api/requesters/refund-account", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      if (user.role !== "requester") {
        return res.status(403).json({ message: "의뢰인만 접근 가능합니다" });
      }

      const [account] = await db.select().from(requesterRefundAccounts).where(eq(requesterRefundAccounts.userId, userId));
      res.json({ account: account ? { ...account, accountNumber: decrypt(account.accountNumber) } : null });
    } catch (err: any) {
      console.error("[Refund Account GET] Error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/requesters/refund-account", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      if (user.role !== "requester") {
        return res.status(403).json({ message: "의뢰인만 접근 가능합니다" });
      }

      const parseResult = insertRequesterRefundAccountSchema.safeParse(req.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0];
        return res.status(400).json({ message: firstError?.message || "입력 데이터가 올바르지 않습니다" });
      }

      const { bankName, accountNumber, accountHolder } = parseResult.data;

      const [existing] = await db.select().from(requesterRefundAccounts).where(eq(requesterRefundAccounts.userId, userId));

      let account;
      if (existing) {
        [account] = await db.update(requesterRefundAccounts)
          .set({
            bankName,
            accountNumber: encrypt(accountNumber),
            accountHolder,
            updatedAt: new Date()
          })
          .where(eq(requesterRefundAccounts.userId, userId))
          .returning();
      } else {
        [account] = await db.insert(requesterRefundAccounts)
          .values({
            userId,
            bankName,
            accountNumber: encrypt(accountNumber),
            accountHolder
          })
          .returning();
      }

      res.json({ account });
    } catch (err: any) {
      console.error("[Refund Account POST] Error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper bank account routes
  const bankbookUploadsDir = path.join(process.cwd(), "uploads", "bankbooks");
  await fs.promises.mkdir(bankbookUploadsDir, { recursive: true });

  const uploadBankbookImage = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, bankbookUploadsDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("이미지 파일만 업로드 가능합니다"));
      }
    },
  });

  app.post(api.helpers.createBankAccount.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const input = api.helpers.createBankAccount.input.parse(req.body);

      const existing = await storage.getHelperBankAccount(userId);
      let account;
      if (existing) {
        account = await storage.updateHelperBankAccount(userId, input);
      } else {
        account = await storage.createHelperBankAccount(userId, input);
      }
      res.status(201).json(account);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.helpers.getBankAccount.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const account = await storage.getHelperBankAccount(userId);
      if (!account) {
        return res.status(404).json({ message: "Bank account not found" });
      }
      res.json(account);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.helpers.uploadBankbookImage.path, uploadBankbookImage.single("image"), requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "이미지를 선택해주세요" });
      }
      const imageUrl = `/uploads/bankbooks/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper onboarding status API
  app.get("/api/helpers/onboarding-status", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const [vehicle, business, license, bankAccount, termsAgreement] = await Promise.all([
        storage.getHelperVehicle(userId),
        storage.getHelperBusiness(userId),
        storage.getHelperLicense(userId),
        storage.getHelperBankAccount(userId),
        storage.getHelperTermsAgreement(userId),
      ]);

      const hasVehicle = !!vehicle;
      const hasBusiness = !!business;
      const hasLicense = !!license && !!(license.driverLicenseImageUrl || license.cargoLicenseImageUrl);
      const hasBankAccount = !!bankAccount;
      const hasTermsAgreement = !!termsAgreement;
      const isComplete = hasVehicle && hasBusiness && hasLicense && hasBankAccount && hasTermsAgreement;

      res.json({
        hasVehicle,
        hasBusiness,
        hasLicense,
        hasBankAccount,
        hasTermsAgreement,
        isComplete,
        onboardingStatus: user.onboardingStatus,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper submit onboarding for review
  app.post("/api/helpers/onboarding/submit", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      // Check if all documents are submitted
      const [vehicle, business, license] = await Promise.all([
        storage.getHelperVehicle(userId),
        storage.getHelperBusiness(userId),
        storage.getHelperLicense(userId),
      ]);

      if (!vehicle || !business || !license) {
        return res.status(400).json({ message: "모든 서류를 먼저 등록해주세요" });
      }

      // Update onboarding status to submitted
      await storage.updateUser(userId, {
        onboardingStatus: "submitted",
      });

      // Create notification for admin
      await storage.createNotification({
        userId,
        type: "onboarding_submitted",
        title: "심사 요청 완료",
        message: "서류 심사가 요청되었습니다. 승인까지 영업일 기준 1-2일 소요됩니다.",
        relatedId: null,
      });

      res.json({
        success: true,
        message: "심사 요청이 완료되었습니다. 승인까지 영업일 기준 1-2일 소요됩니다."
      });
    } catch (err: any) {
      console.error("Submit onboarding error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper license routes
  const licensesUploadsDir = path.join(process.cwd(), "uploads", "licenses");
  await fs.promises.mkdir(licensesUploadsDir, { recursive: true });

  const uploadLicenseImage = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, licensesUploadsDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("이미지 파일만 업로드 가능합니다"));
      }
    },
  });

  app.post(api.helpers.createLicense.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const input = api.helpers.createLicense.input.parse(req.body);

      const existing = await storage.getHelperLicense(userId);
      let license;
      if (existing) {
        license = await storage.updateHelperLicense(userId, input);
      } else {
        license = await storage.createHelperLicense(userId, input);
      }
      res.status(201).json(license);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.helpers.getLicense.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const license = await storage.getHelperLicense(userId);
      if (!license) {
        return res.status(404).json({ message: "License not found" });
      }
      res.json(license);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.helpers.uploadDriverLicenseImage.path, uploadLicenseImage.single("image"), requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "이미지를 선택해주세요" });
      }
      const imageUrl = `/uploads/licenses/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.helpers.uploadCargoLicenseImage.path, uploadLicenseImage.single("image"), requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "이미지를 선택해주세요" });
      }
      const imageUrl = `/uploads/licenses/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Work proof image uploads
  const workproofUploadsDir = path.join(process.cwd(), "uploads", "workproof");
  if (!fs.existsSync(workproofUploadsDir)) {
    fs.mkdirSync(workproofUploadsDir, { recursive: true });
  }
  const uploadWorkproofImage = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, workproofUploadsDir),
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      if (extname && mimetype) cb(null, true);
      else cb(new Error("이미지 파일만 업로드 가능합니다 (jpg, png, webp)"));
    },
  });

  app.post("/api/work-proof/upload", uploadWorkproofImage.single("image"), requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;

      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "이미지를 선택해주세요" });
      }

      const fileBuffer = fs.readFileSync(req.file.path);
      if (!isValidImageBuffer(fileBuffer)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "유효하지 않은 이미지 파일입니다" });
      }

      const imageUrl = `/uploads/workproof/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (err: any) {
      res.status(500).json({ message: "업로드 중 오류가 발생했습니다" });
    }
  });

  // Order reference image uploads
  const orderImagesDir = path.join(process.cwd(), "uploads", "orders");
  if (!fs.existsSync(orderImagesDir)) {
    fs.mkdirSync(orderImagesDir, { recursive: true });
  }
  const uploadOrderImage = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, orderImagesDir),
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      if (extname && mimetype) cb(null, true);
      else cb(new Error("이미지 파일만 업로드 가능합니다 (jpg, png, webp)"));
    },
  });

  app.post("/api/orders/image/upload", uploadOrderImage.single("image"), requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;

      if (user.role !== "requester") {
        return res.status(403).json({ message: "의뢰인만 접근 가능합니다" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "이미지를 선택해주세요" });
      }

      const fileBuffer = fs.readFileSync(req.file.path);
      if (!isValidImageBuffer(fileBuffer)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "유효하지 않은 이미지 파일입니다" });
      }

      const imageUrl = `/uploads/orders/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (err: any) {
      res.status(500).json({ message: "업로드 중 오류가 발생했습니다" });
    }
  });

  // Protected file access API - 민감 파일 접근 통제
  // PII 파일(licenses, bankbooks, businesses)은 관리자 또는 본인만 접근 가능
  // 소유권 검증: DB에서 해당 URL을 가진 사용자 확인

  app.get("/uploads/licenses/:filename", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      const isAdmin = user.isHqStaff === true;
      const requestedUrl = `/uploads/licenses/${req.params.filename}`;

      // 소유권 검증: 본인 파일인지 확인 (운전면허증 또는 화물자격증)
      const license = await storage.getHelperLicense(userId);
      const isOwner = license?.driverLicenseImageUrl === requestedUrl ||
        license?.cargoLicenseImageUrl === requestedUrl;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({ message: "접근 권한이 없습니다" });
      }

      const filePath = path.join(process.cwd(), "uploads", "licenses", req.params.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "파일을 찾을 수 없습니다" });
      }

      res.sendFile(filePath);
    } catch (err: any) {
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  app.get("/uploads/bankbooks/:filename", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      const isAdmin = user.isHqStaff === true;
      const requestedUrl = `/uploads/bankbooks/${req.params.filename}`;

      // 소유권 검증: 본인 통장사본인지 확인
      const bankAccount = await storage.getHelperBankAccount(userId);
      const isOwner = bankAccount?.bankbookImageUrl === requestedUrl;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({ message: "접근 권한이 없습니다" });
      }

      const filePath = path.join(process.cwd(), "uploads", "bankbooks", req.params.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "파일을 찾을 수 없습니다" });
      }

      res.sendFile(filePath);
    } catch (err: any) {
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  app.get("/uploads/businesses/:filename", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      const isAdmin = user.isHqStaff === true;
      const requestedUrl = `/uploads/businesses/${req.params.filename}`;

      // 소유권 검증: 본인 사업자등록증인지 확인
      const business = await storage.getHelperBusiness(userId);
      const isOwner = business?.businessImageUrl === requestedUrl;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({ message: "접근 권한이 없습니다" });
      }

      const filePath = path.join(process.cwd(), "uploads", "businesses", req.params.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "파일을 찾을 수 없습니다" });
      }

      res.sendFile(filePath);
    } catch (err: any) {
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  // vehicles는 관리자 또는 본인만 접근 가능
  app.get("/uploads/vehicles/:filename", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      const isAdmin = user.isHqStaff === true;
      const requestedUrl = `/uploads/vehicles/${req.params.filename}`;

      // 소유권 검증: 본인 차량 이미지인지 확인
      const vehicle = await storage.getHelperVehicle(userId);
      const isOwner = vehicle?.vehicleImageUrl === requestedUrl;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({ message: "접근 권한이 없습니다" });
      }

      const filePath = path.join(process.cwd(), "uploads", "vehicles", req.params.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "파일을 찾을 수 없습니다" });
      }

      res.sendFile(filePath);
    } catch (err: any) {
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  // credentials는 관리자 또는 본인만 접근 가능
  app.get("/uploads/credentials/:filename", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      const isAdmin = user.isHqStaff === true;
      const requestedUrl = `/uploads/credentials/${req.params.filename}`;

      // 소유권 검증: 본인 credential인지 확인
      if (!isAdmin) {
        const credential = await storage.getHelperCredential(userId);
        const isOwner =
          credential?.businessImageUrl === requestedUrl ||
          credential?.driverLicenseImageUrl === requestedUrl ||
          credential?.cargoLicenseImageUrl === requestedUrl ||
          credential?.vehicleImageUrl === requestedUrl ||
          credential?.bankbookImageUrl === requestedUrl ||
          credential?.transportContractImageUrl === requestedUrl;

        if (!isOwner) {
          return res.status(403).json({ message: "접근 권한이 없습니다" });
        }
      }

      const filePath = path.join(process.cwd(), "uploads", "credentials", req.params.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "파일을 찾을 수 없습니다" });
      }

      res.sendFile(filePath);
    } catch (err: any) {
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  // workproof는 관리자, 업로드한 헬퍼만 접근 가능 (DB에서 소유권 검증)
  // 마감 이미지 서빙 (closing reports)
  // closing 이미지는 디스크에 저장되므로 fs로 직접 서빙 (PII 아님, 공개 서빙)
  app.get("/uploads/closing/:filename", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const filename = req.params.filename;
      if (!filename || filename.includes("..") || filename.includes("/")) {
        return res.status(400).json({ message: "잘못된 파일명입니다" });
      }
      const filePath = path.join(process.cwd(), "uploads", "closing", filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "파일을 찾을 수 없습니다" });
      }

      res.sendFile(filePath);
    } catch (error) {
      console.error("Error serving closing image:", error);
      res.status(500).send("Error loading image");
    }
  });

  app.get("/uploads/workproof/:filename", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      const isAdmin = user.isHqStaff === true;
      const requestedUrl = `/uploads/workproof/${req.params.filename}`;

      if (!isAdmin) {
        // DB에서 해당 URL의 작업증빙 조회하여 소유권 확인
        const { pool } = await import("../db");
        const result = await pool.query(
          `SELECT helper_id FROM work_proof_events WHERE photo_url = $1 LIMIT 1`,
          [requestedUrl]
        );

        if (result.rows.length === 0) {
          // work_confirmations 테이블도 확인
          const confirmResult = await pool.query(
            `SELECT helper_id FROM work_confirmations WHERE proof_image_url = $1 LIMIT 1`,
            [requestedUrl]
          );

          if (confirmResult.rows.length === 0) {
            return res.status(404).json({ message: "파일을 찾을 수 없습니다" });
          }

          if (confirmResult.rows[0].helper_id !== userId) {
            return res.status(403).json({ message: "접근 권한이 없습니다" });
          }
        } else if (result.rows[0].helper_id !== userId) {
          return res.status(403).json({ message: "접근 권한이 없습니다" });
        }
      }

      const filePath = path.join(process.cwd(), "uploads", "workproof", req.params.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "파일을 찾을 수 없습니다" });
      }

      res.sendFile(filePath);
    } catch (err: any) {
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  // orders 이미지는 관리자 또는 해당 오더의 의뢰인만 접근 가능 (DB에서 소유권 검증)
  app.get("/uploads/orders/:filename", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      const isAdmin = user.isHqStaff === true;
      const requestedUrl = `/uploads/orders/${req.params.filename}`;

      if (!isAdmin) {
        // DB에서 해당 URL을 가진 오더 조회하여 소유권 확인
        const { pool } = await import("../db");
        const result = await pool.query(
          `SELECT requester_id FROM orders WHERE image_url = $1 LIMIT 1`,
          [requestedUrl]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ message: "파일을 찾을 수 없습니다" });
        }

        if (result.rows[0].requester_id !== userId) {
          return res.status(403).json({ message: "접근 권한이 없습니다" });
        }
      }

      const filePath = path.join(process.cwd(), "uploads", "orders", req.params.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "파일을 찾을 수 없습니다" });
      }

      res.sendFile(filePath);
    } catch (err: any) {
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  // Helper terms agreement
  app.post("/api/helper/terms-agreement", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const { agreements, signatureData, userAgent, consentLog, contractContent } = req.body;

      if (!agreements || !signatureData) {
        return res.status(400).json({ message: "모든 약관에 동의하고 서명해주세요" });
      }

      const requiredTerms = ["service", "vehicle", "liability", "settlement", "location", "privacy"];
      const allAgreed = requiredTerms.every(term => agreements[term] === true);
      if (!allAgreed) {
        return res.status(400).json({ message: "모든 필수 약관에 동의해주세요" });
      }

      if (!signatureData || signatureData.length < 1000) {
        return res.status(400).json({ message: "유효한 전자서명을 입력해주세요" });
      }

      const existingAgreement = await storage.getHelperTermsAgreement(userId);
      if (existingAgreement) {
        return res.status(400).json({ message: "이미 약관에 동의하셨습니다" });
      }

      // 클라이언트 IP 주소 추출
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

      const agreement = await storage.createHelperTermsAgreement({
        userId,
        serviceAgreed: true,
        vehicleAgreed: true,
        liabilityAgreed: true,
        settlementAgreed: true,
        locationAgreed: true,
        privacyAgreed: true,
        signatureData,
        ipAddress,
        userAgent: userAgent ?? null,
        consentLog: consentLog ?? null,
        contractContent: contractContent ?? null,
        agreedAt: new Date(),
      });

      res.json({ message: "약관 동의가 완료되었습니다", agreement });
    } catch (err: any) {
      console.error("Terms agreement error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/helper/terms-agreement", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // 역할 검증: 헬퍼만 접근 가능
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const agreement = await storage.getHelperTermsAgreement(userId);
      res.json(agreement || null);
    } catch (err: any) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // Helper Onboarding APIs (헬퍼 서류 제출/조회)
  // ============================================

  // Helper Credential (기본 정보)
  app.get(api.helpers.getCredential.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const credential = await storage.getHelperCredential(userId);
      if (!credential) {
        return res.status(404).json({ message: "자격증 정보가 없습니다" });
      }
      res.json(credential);
    } catch (err: any) {
      console.error("Get helper credential error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.helpers.createCredential.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const existing = await storage.getHelperCredential(userId);
      if (existing) {
        return res.status(400).json({ message: "이미 자격증 정보가 등록되어 있습니다" });
      }

      const input = api.helpers.createCredential.input.parse(req.body);
      const credential = await storage.createHelperCredential(userId, input);
      res.status(201).json(credential);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      console.error("Create helper credential error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch(api.helpers.updateCredential.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const input = api.helpers.updateCredential.input.parse(req.body);
      const credential = await storage.updateHelperCredential(userId, input);
      res.json(credential);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      console.error("Update helper credential error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper Vehicle (차량 정보)
  app.get(api.helpers.getVehicle.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const vehicle = await storage.getHelperVehicle(userId);
      if (!vehicle) {
        return res.status(404).json({ message: "차량 정보가 없습니다" });
      }
      res.json(vehicle);
    } catch (err: any) {
      console.error("Get helper vehicle error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.helpers.createVehicle.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const existing = await storage.getHelperVehicle(userId);
      if (existing) {
        // Update existing
        const input = api.helpers.createVehicle.input.parse(req.body);
        const vehicle = await storage.updateHelperVehicle(userId, input);
        return res.json(vehicle);
      }

      const input = api.helpers.createVehicle.input.parse(req.body);
      const vehicle = await storage.createHelperVehicle(userId, input);
      res.status(201).json(vehicle);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      console.error("Create helper vehicle error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper Business (사업자 정보)
  app.get(api.helpers.getBusiness.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const business = await storage.getHelperBusiness(userId);
      if (!business) {
        return res.status(404).json({ message: "사업자 정보가 없습니다" });
      }
      res.json(business);
    } catch (err: any) {
      console.error("Get helper business error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.helpers.createBusiness.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const existing = await storage.getHelperBusiness(userId);
      if (existing) {
        const input = api.helpers.createBusiness.input.parse(req.body);
        const business = await storage.updateHelperBusiness(userId, input);
        return res.json(business);
      }

      const input = api.helpers.createBusiness.input.parse(req.body);
      const business = await storage.createHelperBusiness(userId, input);
      res.status(201).json(business);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      console.error("Create helper business error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper Bank Account (정산 계좌)
  app.get(api.helpers.getBankAccount.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const account = await storage.getHelperBankAccount(userId);
      if (!account) {
        return res.status(404).json({ message: "계좌 정보가 없습니다" });
      }
      res.json(account);
    } catch (err: any) {
      console.error("Get helper bank account error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.helpers.createBankAccount.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const existing = await storage.getHelperBankAccount(userId);
      if (existing) {
        const input = api.helpers.createBankAccount.input.parse(req.body);
        const account = await storage.updateHelperBankAccount(userId, input);
        return res.json(account);
      }

      const input = api.helpers.createBankAccount.input.parse(req.body);
      const account = await storage.createHelperBankAccount(userId, input);
      res.status(201).json(account);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      console.error("Create helper bank account error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper License (면허 정보)
  app.get(api.helpers.getLicense.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const license = await storage.getHelperLicense(userId);
      if (!license) {
        return res.status(404).json({ message: "면허 정보가 없습니다" });
      }
      res.json(license);
    } catch (err: any) {
      console.error("Get helper license error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.helpers.createLicense.path, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const existing = await storage.getHelperLicense(userId);
      if (existing) {
        const input = api.helpers.createLicense.input.parse(req.body);
        const license = await storage.updateHelperLicense(userId, input);
        return res.json(license);
      }

      const input = api.helpers.createLicense.input.parse(req.body);
      const license = await storage.createHelperLicense(userId, input);
      res.status(201).json(license);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      console.error("Create helper license error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper Onboarding Submit (Signature & Agreements)
  app.post("/api/helpers/onboarding/submit", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = req.user!;

      // Role check
      if (user.role !== "helper") {
        return res.status(403).json({ message: "헬퍼만 접근 가능합니다" });
      }

      const {
        contractSigned,
        phoneVerified,
        identityVerificationId,
        signedAt,
        signatureData,
        agreedTerms
      } = req.body;

      if (!signatureData || signatureData.length < 100) {
        return res.status(400).json({ message: "유효한 서명이 필요합니다" });
      }

      // 1. Save Terms Agreement
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || undefined;

      // Check if agreement already exists
      const existingAgreement = await storage.getHelperTermsAgreement(userId);
      if (!existingAgreement) {
        await storage.createHelperTermsAgreement({
          userId,
          serviceAgreed: agreedTerms?.contract || false,
          vehicleAgreed: true, // Implicitly agreed via "all required"
          liabilityAgreed: agreedTerms?.accident || false,
          settlementAgreed: agreedTerms?.closing || false,
          locationAgreed: true, // Implicit
          privacyAgreed: agreedTerms?.privacy || false,
          signatureData,
          ipAddress,
          userAgent: userAgent ?? null,
          agreedAt: new Date(),
        });
      }

      // 2. Update User Profile (Onboarding Status)
      const updates: any = {
        onboardingStatus: "approved", // Auto-approve for now
        termsAgreed: true,
        termsAgreedAt: new Date(),
      };

      if (identityVerificationId) {
        updates.identityVerified = true;
        updates.identityVerifiedAt = new Date();
      }

      await storage.updateUser(userId, updates);

      res.json({ success: true, message: "온보딩이 완료되었습니다" });
    } catch (err: any) {
      console.error("Helper onboarding submit error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

}