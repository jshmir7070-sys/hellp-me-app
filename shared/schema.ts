import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, timestamp, serial, numeric, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  nickname: text("nickname"),
  zipCode: text("zip_code"),
  address: text("address"),
  addressDetail: text("address_detail"),
  birthDate: text("birth_date"),
  phoneNumber: text("phone_number"),
  role: text("role").notNull(),
  isTeamLeader: boolean("is_team_leader").default(false),
  isHqStaff: boolean("is_hq_staff").default(false),
  teamName: text("team_name"),
  dailyStatus: text("daily_status").default("waiting"),
  pushEnabled: boolean("push_enabled").default(true),
  locationConsent: boolean("location_consent").default(false),
  latitude: text("latitude"),
  longitude: text("longitude"),
  locationUpdatedAt: timestamp("location_updated_at"),
  taxInvoiceEnabled: boolean("tax_invoice_enabled").default(false),
  checkInToken: text("check_in_token"),
  onboardingStatus: text("onboarding_status").default("pending"),
  onboardingRejectReason: text("onboarding_reject_reason"),
  onboardingReviewedAt: timestamp("onboarding_reviewed_at"),
  onboardingReviewedBy: varchar("onboarding_reviewed_by"),
  identityVerified: boolean("identity_verified").default(false),
  identityCi: text("identity_ci"),
  identityDi: text("identity_di"),
  identityVerifiedAt: timestamp("identity_verified_at"),
  helperVerified: boolean("helper_verified").default(false), // 관리자 수기 승인 완료 여부
  helperVerifiedAt: timestamp("helper_verified_at"),
  helperVerifiedBy: varchar("helper_verified_by"),
  profileImageUrl: text("profile_image_url"),
  kakaoId: text("kakao_id"),
  naverId: text("naver_id"),
  mustChangePassword: boolean("must_change_password").default(false),
  adminStatus: text("admin_status").default("pending"), // pending, active, suspended (for admin staff only)
  notificationPreferences: text("notification_preferences"), // JSON string for notification settings
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by"),
  passwordChangedAt: timestamp("password_changed_at"),
  personalCode: text("personal_code").unique(), // 12자리 영문+숫자 개인식별 코드 (헬퍼용, 팀장 승인 시 팀 QR이 됨)
  position: text("position"), // 직책 (예: 팀장, 매니저)
  department: text("department"), // 부서 (예: 운영팀, 고객지원팀)
  menuPermissions: text("menu_permissions"), // JSON string - 메뉴 접근 권한 배열
  createdAt: timestamp("created_at").defaultNow(),
});

// Teams table (팀)
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  leaderId: varchar("leader_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  qrCodeToken: text("qr_code_token").notNull().unique(),
  businessType: text("business_type"), // 업무
  emergencyPhone: text("emergency_phone"), // 긴급전화번호
  commissionRate: integer("commission_rate").default(0), // 팀장 수수료율 (%, 부가세 포함)
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Team members table (팀원)
export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  helperId: varchar("helper_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(true),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Helper credentials table
export const helperCredentials = pgTable("helper_credentials", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  category: text("category").notNull(), // e.g., "delivery", "counseling"
  serviceDescription: text("service_description"),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  accountHolder: text("account_holder"),
  idPhotoUrl: text("id_photo_url"),
  verificationStatus: text("verification_status").default("pending"), // pending, approved, rejected
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  rejectReason: text("reject_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Helper vehicles table
export const helperVehicles = pgTable("helper_vehicles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  vehicleType: text("vehicle_type").notNull(), // 1톤 하이탑, 1톤 정탑, 1톤 저탑, 1톤 냉탑, 쓰리밴
  plateNumber: text("plate_number").notNull(), // 서울81자0000
  vehicleImageUrl: text("vehicle_image_url"),
  verificationStatus: text("verification_status").default("pending"), // pending, approved, rejected
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  rejectReason: text("reject_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Helper businesses table (사업자 등록)
export const helperBusinesses = pgTable("helper_businesses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  businessNumber: text("business_number").notNull(), // 사업자등록번호 (xxx-xx-xxxxx)
  businessName: text("business_name").notNull(), // 상호
  representativeName: text("representative_name").notNull(), // 대표자성함
  address: text("address").notNull(), // 사업장 주소
  businessType: text("business_type").notNull(), // 업태
  businessCategory: text("business_category").notNull(), // 업종/종목
  email: text("email"), // 이메일
  businessImageUrl: text("business_image_url"), // 사업자등록증 이미지
  verificationStatus: text("verification_status").default("pending"), // pending, verified, rejected
  createdAt: timestamp("created_at").defaultNow(),
});

// Helper bank accounts table (수수료 계좌)
export const helperBankAccounts = pgTable("helper_bank_accounts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountHolder: text("account_holder").notNull(), // 예금주명
  bankName: text("bank_name").notNull(), // 은행명
  accountNumber: text("account_number").notNull(), // 계좌번호
  bankbookImageUrl: text("bankbook_image_url"), // 통장사본 이미지
  verificationStatus: text("verification_status").default("pending"), // pending, verified, rejected
  createdAt: timestamp("created_at").defaultNow(),
});

// Helper licenses table (면허증/자격증)
export const helperLicenses = pgTable("helper_licenses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  driverLicenseImageUrl: text("driver_license_image_url"), // 운전면허증 이미지
  cargoLicenseImageUrl: text("cargo_license_image_url"), // 화물운송자격증 이미지
  verificationStatus: text("verification_status").default("pending"), // pending, verified, rejected
  createdAt: timestamp("created_at").defaultNow(),
});

// Helper service areas table (배송가능 지역)
export const helperServiceAreas = pgTable("helper_service_areas", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  region: text("region").notNull(), // 시/도 (예: 서울특별시, 경기도)
  district: text("district"), // 구/시/군 (예: 강남구, 수원시)
  createdAt: timestamp("created_at").defaultNow(),
});

// Helper terms agreement table (약관 동의)
export const helperTermsAgreements = pgTable("helper_terms_agreements", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  serviceAgreed: boolean("service_agreed").default(false),
  vehicleAgreed: boolean("vehicle_agreed").default(false),
  liabilityAgreed: boolean("liability_agreed").default(false),
  settlementAgreed: boolean("settlement_agreed").default(false),
  locationAgreed: boolean("location_agreed").default(false),
  privacyAgreed: boolean("privacy_agreed").default(false),
  signatureData: text("signature_data"), // Base64 encoded signature image
  // 법적 보호 기록 필드
  ipAddress: text("ip_address"), // 접속 IP 주소
  trackingNumber: text("tracking_number"), // 운송장번호
  userAgent: text("user_agent"), // 기기 정보 (OS/브라우저)
  consentLog: text("consent_log"), // 동의 버튼 클릭 로그 (JSON)
  contractContent: text("contract_content"), // 계약 내용 전문 (변조 방지용)
  agreedAt: timestamp("agreed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Requester service agreements table (화주 서비스 이용계약서)
export const requesterServiceAgreements = pgTable("requester_service_agreements", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  contractAgreed: boolean("contract_agreed").default(false), // 계약 내용 동의
  depositAmount: integer("deposit_amount"), // 계약금 금액
  balanceAmount: integer("balance_amount"), // 잔금 금액
  balanceDueDate: text("balance_due_date"), // 잔금 지급일
  signatureData: text("signature_data"), // Base64 encoded signature image
  phoneNumber: text("phone_number"), // 인증된 휴대폰 번호
  phoneVerified: boolean("phone_verified").default(false), // 휴대폰 인증 여부
  phoneVerifiedAt: timestamp("phone_verified_at"), // 휴대폰 인증 시간
  // 법적 보호 기록 필드
  ipAddress: text("ip_address"), // 접속 IP 주소
  trackingNumber: text("tracking_number"), // 운송장번호
  userAgent: text("user_agent"), // 기기 정보 (OS/브라우저)
  consentLog: text("consent_log"), // 동의 버튼 클릭 로그 (JSON)
  contractContent: text("contract_content"), // 계약 내용 전문 (변조 방지용)
  agreedAt: timestamp("agreed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Requester businesses table (의뢰인 사업자 정보)
export const requesterBusinesses = pgTable("requester_businesses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  businessNumber: text("business_number").notNull(), // 사업자등록번호 (xxx-xx-xxxxx)
  businessName: text("business_name").notNull(), // 상호
  representativeName: text("representative_name").notNull(), // 대표자성함
  address: text("address").notNull(), // 주소
  businessType: text("business_type").notNull(), // 업태
  businessCategory: text("business_category").notNull(), // 종목
  businessImageUrl: text("business_image_url"), // 사업자등록증 이미지
  verificationStatus: text("verification_status").default("pending"), // pending, verified, rejected
  createdAt: timestamp("created_at").defaultNow(),
});

// Requester refund accounts table (의뢰인 환불 계좌)
export const requesterRefundAccounts = pgTable("requester_refund_accounts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  bankName: text("bank_name").notNull(), // 은행명
  accountNumber: text("account_number").notNull(), // 계좌번호
  accountHolder: text("account_holder").notNull(), // 예금주명
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Hellp me posts table
export const helpPosts = pgTable("help_posts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  location: text("location").notNull(),
  budget: integer("budget"), // null이면 협의
  budgetType: text("budget_type").default("fixed"), // fixed(금액지정), negotiable(협의)
  status: text("status").default("open"), // open, assigned, completed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Orders table (배송 오더 공고)
// 헬프미(의뢰인) 상태 흐름: awaiting_deposit → registered → matching → scheduled → in_progress → closed
// 헬퍼 상태 흐름: registered(오더보임) → applied(신청) → selected(선택됨) → scheduled(매칭완료) → in_progress(출근) → completed(마감)
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  requesterId: varchar("requester_id")
    .references(() => users.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(), // 회사명 (예: 쿠팡 주간, CJ대한통운)
  pricePerUnit: integer("price_per_unit").notNull(), // 단가 (예: 1200원)
  averageQuantity: text("average_quantity").notNull(), // 평균수량 (예: 400box)
  deliveryArea: text("delivery_area").notNull(), // 배송지역 (예: 서울시 강남구 역삼동일부)
  scheduledDate: text("scheduled_date").notNull(), // 일정 (예: 12월 22일)
  scheduledDateEnd: text("scheduled_date_end"), // 일정 종료일 (범위인 경우)
  vehicleType: text("vehicle_type").notNull(), // 차종 (예: 1톤 저탑)
  isUrgent: boolean("is_urgent").default(false), // 긴급 오더 표시 (냉탑, 기타택배)
  // 오더 상태 체계 (ORDER_STATUS enum)
  // awaiting_deposit: 승인대기 (계약금입금확인)
  // registered: 등록중 (본사승인완료, 헬퍼앱오더등록)
  // matching: 매칭중 (헬퍼 신청 있음, 3명 제한)
  // scheduled: 예정중 (헬퍼선택/매칭완료)
  // in_progress: 업무중 (QR출근)
  // closing_submitted: 마감제출 (헬퍼 마감 완료)
  // dispute_requested: 분쟁접수 (요청자가 화물사고 접수)
  // dispute_reviewing: 분쟁검토 (관리자 검토 중)
  // dispute_resolved: 분쟁해결 (관리자 판단 완료)
  // dispute_rejected: 분쟁기각 (관리자 기각)
  // settled: 정산완료 (최종 정산 확정)
  status: text("status").default("awaiting_deposit"),
  approvalStatus: text("approval_status").default("pending"), // pending(승인중), approved(승인완료), rejected(거절)
  paymentStatus: text("payment_status").default("awaiting_deposit"), // awaiting_deposit(계약금 대기), deposit_confirmed(계약금 확인), balance_confirmed(잔금 확인)
  maxHelpers: integer("max_helpers").default(3), // 최대 모집 인원 (기본 3명)
  currentHelpers: integer("current_helpers").default(0), // 현재 모집된 인원
  matchedHelperId: varchar("matched_helper_id").references(() => users.id), // 매칭된 헬퍼 ID
  regionMapUrl: text("region_map_url"), // 배송지 이미지 URL (사진촬영/업로드)
  deliveryGuide: text("delivery_guide"), // 배송가이드 텍스트
  deliveryGuideUrl: text("delivery_guide_url"), // 배송가이드 URL (외부 링크)
  campAddress: text("camp_address"), // 캠프 및 터미널주소
  deliveryLat: text("delivery_lat"), // 배송지 위도
  deliveryLng: text("delivery_lng"), // 배송지 경도
  courierCompany: text("courier_company"), // 택배사명 (예: CJ대한통운, 로젠)
  requesterPhone: text("requester_phone"), // 담당자 연락처 (매칭 후 공유)
  helperPhoneShared: boolean("helper_phone_shared").default(false), // 헬퍼 전화번호 공유 여부
  matchedAt: timestamp("matched_at"), // 매칭 완료 시간
  checkedInAt: timestamp("checked_in_at"), // 출근 시간 (QR 스캔)
  closedAt: timestamp("closed_at"), // 업무 마감 시간
  autoHideAt: timestamp("auto_hide_at"), // 완료 후 24시간 뒤 자동 숨김 시간
  hiddenAt: timestamp("hidden_at"), // 실제 숨김 처리된 시간
  // 수수료 정책 스냅샷 (오더 생성 시점의 값 보존)
  snapshotCommissionRate: integer("snapshot_commission_rate"), // 오더 생성 시점 총 수수료율 (%)
  snapshotPlatformRate: integer("snapshot_platform_rate"), // 오더 생성 시점 본사 수수료율 (%)
  snapshotTeamLeaderRate: integer("snapshot_team_leader_rate"), // 오더 생성 시점 팀장 인센티브율 (%)
  // 최저운임 스냅샷 (오더 생성 시점의 값 보존)
  basePricePerBox: integer("base_price_per_box"), // 원래 박스당 단가
  finalPricePerBox: integer("final_price_per_box"), // 최저운임 적용 후 최종 박스당 단가
  minTotalApplied: integer("min_total_applied"), // 적용된 최저운임 총액 (0이면 미적용)
  // 계약 확정 정보
  contractConfirmed: boolean("contract_confirmed").default(false), // 의뢰인 계약 동의 여부
  contractConfirmedAt: timestamp("contract_confirmed_at"), // 계약 확정 시간
  balancePaymentDueDate: text("balance_payment_due_date"), // 잔금 결제 예정일 (필수)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order Start Tokens (QR 시작 토큰 - 1회성/만료)
export const orderStartTokens = pgTable("order_start_tokens", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(), // UUID 토큰
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }), // 발급자 (관리자/요청자/시스템)
  createdByRole: text("created_by_role"), // ADMIN, REQUESTER, SYSTEM
  expiresAt: timestamp("expires_at").notNull(), // 만료 시간 (기본 24시간)
  usedAt: timestamp("used_at"), // 사용 시간 (1회성 소비)
  usedBy: varchar("used_by").references(() => users.id, { onDelete: "set null" }), // 사용자 (헬퍼)
  isRevoked: boolean("is_revoked").default(false), // 취소 여부
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications table (알림)
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // matching_success, matching_failed, announcement, phone_shared
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedId: integer("related_id"), // orderId or other related entity
  phoneNumber: text("phone_number"), // 매칭 시 공유할 전화번호
  payload: text("payload"), // JSON string for additional data (order card info, etc.)
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Check-in records table (QR 기반 출근 기록)
export const checkInRecords = pgTable("check_in_records", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
  helperId: varchar("helper_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  requesterId: varchar("requester_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  requesterName: text("requester_name"),
  checkInTime: timestamp("check_in_time").defaultNow(),
  checkOutTime: timestamp("check_out_time"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  address: text("address"),
  status: text("status").default("checked_in"), // checked_in, checked_out
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCheckInRecordSchema = createInsertSchema(checkInRecords).omit({
  id: true,
  createdAt: true,
});

// Notification logs table (알림 발송 기록 - 본사 서버용)
export const notificationLogs = pgTable("notification_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // matching_success, matching_failed, announcement, phone_shared
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedId: integer("related_id"),
  payload: text("payload"),
  deliveryChannel: text("delivery_channel").notNull(), // websocket, polling
  sentAt: timestamp("sent_at").defaultNow(),
  isDelivered: boolean("is_delivered").default(false),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
});

// Order applications table (오더 신청)
// 헬퍼 상태 흐름: applied → selected → scheduled → in_progress → completed
// A안: 오더당 최대 3명 지원 가능, 중복 지원 불가 (orderId + helperId unique constraint)
export const orderApplications = pgTable("order_applications", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .unique() // orderId당 1개만 존재 (중복 정산 생성 구조적 차단)
    .references(() => orders.id, { onDelete: "cascade" }),
  helperId: varchar("helper_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // 헬퍼 관점 상태:
  // applied: 신청중 (헬퍼가 신청함)
  // selected: 매칭중 (헬프미가 선택함)
  // scheduled: 예정중 (매칭완료 클릭)
  // in_progress: 업무중 (QR출근)
  // completed: 마감 (업무완료 전송)
  // closing_submitted: 마감 제출됨 (관리자 승인 대기)
  // rejected: 거절됨
  status: text("status").default("applied"),
  appliedAt: timestamp("applied_at").defaultNow(),
  selectedAt: timestamp("selected_at"), // 헬프미가 선택한 시간
  scheduledAt: timestamp("scheduled_at"), // 매칭완료 시간
  checkedInAt: timestamp("checked_in_at"), // QR 출근 시간
  completedAt: timestamp("completed_at"), // 업무마감 시간
  processedAt: timestamp("processed_at"),
  // 수수료 스냅샷 (매칭 시점의 헬퍼별 실효 수수료율 보존)
  snapshotCommissionRate: integer("snapshot_commission_rate"), // 총 수수료율 (%)
  snapshotPlatformRate: integer("snapshot_platform_rate"), // 본사 수수료율 (%)
  snapshotTeamLeaderRate: integer("snapshot_team_leader_rate"), // 팀장 인센티브율 (%)
  snapshotTeamLeaderId: varchar("snapshot_team_leader_id").references(() => users.id), // 매칭 시점 팀장 ID
  snapshotSource: text("snapshot_source"), // 수수료 소스 (helper_override, team_override, global, default)
}, (table) => ({
  // 동일 오더에 동일 헬퍼가 중복 지원 불가
  uniqueOrderHelper: unique().on(table.orderId, table.helperId),
}));

// ============================================
// 새 운영 체계 테이블 (3명 후보 → 선택 → 연락처 공개 → 마감 재정산)
// ============================================

// 오더 후보 목록 (최대 3명)
// 헬퍼가 오더에 지원하면 후보로 등록, 요청자가 1명 선택
export const orderCandidates = pgTable("order_candidates", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  helperUserId: varchar("helper_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // APPLIED: 지원, SHORTLISTED: 후보확정, SELECTED: 선택됨, REJECTED: 미선택, WITHDRAWN: 철회
  status: text("status").default("applied").notNull(),
  appliedAt: timestamp("applied_at").defaultNow(),
  selectedAt: timestamp("selected_at"),
  rejectedAt: timestamp("rejected_at"),
  withdrawnAt: timestamp("withdrawn_at"),
  // 지원 당시 평점/완료율 스냅샷
  rankSnapshot: text("rank_snapshot"), // JSON: {avgRating, reviewCount, completionRate, last30dJobs}
  note: text("note"), // 기사 코멘트 (200자)
});

// 헬퍼 평점 요약 테이블 (캐싱용)
// 리뷰가 많아질 경우 실시간 계산 비용 절감
export const helperRatingSummary = pgTable("helper_rating_summary", {
  helperUserId: varchar("helper_user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  avgRating: integer("avg_rating"), // 평균별점 (x100, 예: 450 = 4.50)
  reviewCount: integer("review_count").default(0),
  completionRate: integer("completion_rate"), // 완료율 (x100, 예: 9850 = 98.50%)
  last30dJobs: integer("last_30d_jobs").default(0), // 최근 30일 작업수
  totalJobs: integer("total_jobs").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 연락처 공개 이벤트 (분쟁 대비 감사 로그)
// 요청자가 헬퍼를 선택하면 연락처가 서로 공개됨
export const contactShareEvents = pgTable("contact_share_events", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  requesterUserId: varchar("requester_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  helperUserId: varchar("helper_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sharedFields: text("shared_fields"), // JSON: {"phone":true,"name":true}
  // REQUESTER_SELECTION: 요청자 선택, SYSTEM: 시스템 자동, ADMIN: 관리자
  triggeredBy: text("triggered_by").default("requester_selection"),
  triggerActorId: varchar("trigger_actor_id").references(() => users.id), // 관리자 또는 시스템
  createdAt: timestamp("created_at").defaultNow(),
});

// 오더 마감 보고서 (기사가 제출)
// 배송수/반품수/기타 텍스트
export const orderClosureReports = pgTable("order_closure_reports", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  helperUserId: varchar("helper_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  deliveredCount: integer("delivered_count").default(0), // 배송수
  returnedCount: integer("returned_count").default(0), // 반품수
  otherText: text("other_text"), // 기타 자유 입력 (요청사항/특이사항)
  submittedAt: timestamp("submitted_at").defaultNow(),
  confirmedBy: varchar("confirmed_by").references(() => users.id), // 관리자 확인자
  confirmedAt: timestamp("confirmed_at"),
  isLocked: boolean("is_locked").default(false), // 확정 후 잠금
});

// 마감 필드 설정 (관리자가 추가하는 동적 입력 필드)
// 헬퍼/요청자 마감 페이지에 동적으로 표시됨
export const closingFieldSettings = pgTable("closing_field_settings", {
  id: serial("id").primaryKey(),
  fieldName: text("field_name").notNull(), // 필드명 (예: "배송 기사 메모")
  fieldType: text("field_type").default("text").notNull(), // text, number, textarea
  isRequired: boolean("is_required").default(false), // 필수 여부
  placeholder: text("placeholder"), // 입력 힌트
  description: text("description"), // 설명
  targetRole: text("target_role").default("helper"), // helper, requester, both
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 오더 등록 필수 입력 항목 설정 (관리자가 관리)
// 요청자가 오더 등록 시 입력해야 하는 필드 정의
export const orderRegistrationFields = pgTable("order_registration_fields", {
  id: serial("id").primaryKey(),
  fieldCode: text("field_code").notNull().unique(), // 시스템 코드 (예: "courier_company", "box_count")
  fieldName: text("field_name").notNull(), // 표시명 (예: "택배사", "박스수")
  fieldType: text("field_type").default("text").notNull(), // text, number, select, date, textarea
  isRequired: boolean("is_required").default(true), // 필수 여부
  placeholder: text("placeholder"), // 입력 힌트
  description: text("description"), // 설명/도움말
  options: text("options"), // select 타입인 경우 옵션 (JSON 배열)
  defaultValue: text("default_value"), // 기본값
  validationRule: text("validation_rule"), // 유효성 규칙 (예: "min:1,max:9999")
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 비용 항목 유형 마스터 (관리자에서 추가 가능)
// 예: "추가배송", "회수", "주차비", "야간할증", "위자료(조정)"
export const costItemTypes = pgTable("cost_item_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // 예: "위자료(조정)"
  sign: text("sign").default("plus").notNull(), // plus(가산) / minus(차감)
  description: text("description"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// 오더별 비용 라인 항목
// 실적 기반 조정 및 위자료 등을 라인별로 기록
export const orderCostItems = pgTable("order_cost_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  typeId: integer("type_id")
    .notNull()
    .references(() => costItemTypes.id, { onDelete: "restrict" }),
  quantity: integer("quantity").default(1), // 수량 (x100, 예: 100 = 1.00)
  unitPrice: integer("unit_price").notNull(), // 단가
  amount: integer("amount").notNull(), // 금액 (quantity * unitPrice / 100)
  note: text("note"), // 메모 (200자)
  createdBy: varchar("created_by")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// 택배사 이력 캡쳐/증빙 사진 업로드
export const carrierProofUploads = pgTable("carrier_proof_uploads", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  carrierId: integer("carrier_id"), // 택배사 ID (있으면)
  carrierName: text("carrier_name"), // 택배사명
  // HISTORY_SCREENSHOT: 택배사 이력 캡쳐, PHOTO: 사진, RECEIPT: 영수증
  proofType: text("proof_type").default("photo").notNull(),
  fileUrl: text("file_url").notNull(), // 이미지 URL
  note: text("note"), // 메모
  uploadedBy: varchar("uploaded_by")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// 오더 금액 산정 스냅샷 (재정산용)
// 마감 시 최종금액 계산 결과 저장
export const pricingSnapshots = pgTable("pricing_snapshots", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  baseSupplyAmount: integer("base_supply_amount").notNull(), // 공급가
  vatAmount: integer("vat_amount").notNull(), // VAT (10%)
  grossAmount: integer("gross_amount").notNull(), // 부가세 포함 총액
  depositAmount: integer("deposit_amount").notNull(), // 계약금 (20%)
  balanceAmount: integer("balance_amount").notNull(), // 잔여금 (gross - deposit)
  costPlusTotal: integer("cost_plus_total").default(0), // 가산 비용 합계
  costMinusTotal: integer("cost_minus_total").default(0), // 차감 비용 합계
  finalGrossAmount: integer("final_gross_amount"), // 최종 부가세 포함 총액
  finalBalanceAmount: integer("final_balance_amount"), // 최종 잔여금
  platformFee: integer("platform_fee"), // 플랫폼 수수료
  helperPayout: integer("helper_payout"), // 기사 정산액
  computedAt: timestamp("computed_at").defaultNow(),
  isFinalized: boolean("is_finalized").default(false),
});

// 잔여금 청구/결제 추적
export const balanceInvoices = pgTable("balance_invoices", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  pricingSnapshotId: integer("pricing_snapshot_id")
    .references(() => pricingSnapshots.id, { onDelete: "set null" }),
  amount: integer("amount").notNull(), // 잔여금 금액
  // PENDING: 대기, PAID: 결제완료, FAILED: 실패, REFUNDED: 환불
  status: text("status").default("pending").notNull(),
  paymentId: integer("payment_id").references(() => payments.id), // 결제 FK
  paidAt: timestamp("paid_at"),
  failedAt: timestamp("failed_at"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Job postings table (채용공고)
export const jobPostings = pgTable("job_postings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(), // 회사명
  workDays: text("work_days").notNull(), // 근무일 (월~금, 월~토 등)
  vehicleType: text("vehicle_type").notNull(), // 차종 (1톤냉탑 영업용 등)
  fuelCost: text("fuel_cost").notNull(), // 유류비 (무제, 본인부담 등)
  commission: text("commission").notNull(), // 수수료/급여 (350만vat별도 등)
  contact: text("contact").notNull(), // 연락처
  workDetails: text("work_details").notNull(), // 업무내용 (JSON)
  note: text("note"), // 비고
  recruitCount: integer("recruit_count").default(1), // 모집 인원
  workStartTime: text("work_start_time"), // 출근시간
  workEndTime: text("work_end_time"), // 마감시간
  status: text("status").default("open"), // open(모집중), closed(마감)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod schemas
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true })
  .extend({
    password: z.string()
      .min(8, "비밀번호는 8자리 이상이어야 합니다")
      .regex(/[a-zA-Z]/, "영문이 포함되어야 합니다")
      .regex(/[0-9]/, "숫자가 포함되어야 합니다")
      .regex(/[!@#$%^&*(),.?":{}|<>]/, "특수문자가 포함되어야 합니다"),
    email: z.string().email("올바른 이메일 형식을 입력해주세요"),
    name: z.string().min(2, "이름은 2자 이상이어야 합니다"),
    phoneNumber: z.string().optional(),
    zipCode: z.string().optional(),
    address: z.string().optional(),
    addressDetail: z.string().optional(),
    birthDate: z.string().optional(),
    identityVerified: z.boolean().optional(),
    identityCi: z.string().optional(),
    identityDi: z.string().optional(),
    identityVerifiedAt: z.date().optional(),
  });
export const insertHelperCredentialSchema = createInsertSchema(helperCredentials).omit({ 
  id: true, 
  createdAt: true,
  userId: true 
});
export const insertHelpPostSchema = createInsertSchema(helpPosts).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true,
  userId: true 
});

// Vehicle schemas
const vehicleTypes = ["1톤 하이탑", "1톤정탑", "1톤저탑", "1톤 냉탑", "무관"] as const;
const plateRegions = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"] as const;

export const insertHelperVehicleSchema = createInsertSchema(helperVehicles)
  .omit({ id: true, createdAt: true, userId: true, verificationStatus: true })
  .extend({
    vehicleType: z.enum(vehicleTypes, { errorMap: () => ({ message: "차종을 선택해주세요" }) }),
    plateNumber: z.string()
      .regex(/^(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)\d{2}[아바사자]\d{4}$/, 
        "올바른 차량번호 형식을 입력해주세요 (예: 서울81자0000)"),
  });

export const vehicleTypesArray = vehicleTypes;
export const plateRegionsArray = plateRegions;

// Business schema
export const insertHelperBusinessSchema = createInsertSchema(helperBusinesses)
  .omit({ id: true, createdAt: true, userId: true, verificationStatus: true })
  .extend({
    businessNumber: z.string()
      .regex(/^\d{3}-\d{2}-\d{5}$/, "올바른 사업자등록번호 형식을 입력해주세요 (예: 123-45-67890)"),
    businessName: z.string().min(1, "상호를 입력해주세요"),
    representativeName: z.string().min(2, "대표자 성함을 입력해주세요"),
    address: z.string().min(1, "사업장 주소를 입력해주세요"),
    businessType: z.string().min(1, "업태를 입력해주세요"),
    businessCategory: z.string().min(1, "업종을 입력해주세요"),
    email: z.string().email("올바른 이메일 형식을 입력해주세요").nullable().optional(),
    businessImageUrl: z.string().nullable().optional(),
  });

// Requester business schema
export const insertRequesterBusinessSchema = createInsertSchema(requesterBusinesses)
  .omit({ id: true, createdAt: true, userId: true, verificationStatus: true })
  .extend({
    businessNumber: z.string()
      .regex(/^\d{3}-\d{2}-\d{5}$/, "올바른 사업자등록번호 형식을 입력해주세요 (예: 123-45-67890)"),
    businessName: z.string().min(1, "상호를 입력해주세요"),
    representativeName: z.string().min(2, "대표자 성함을 입력해주세요"),
    address: z.string().min(1, "주소를 입력해주세요"),
    businessType: z.string().min(1, "업태를 입력해주세요"),
    businessCategory: z.string().min(1, "종목을 입력해주세요"),
    businessImageUrl: z.string().nullable().optional(),
  });

// Bank account schema
const koreanBanks = [
  "국민은행", "신한은행", "우리은행", "하나은행", "농협은행", "기업은행", 
  "SC제일은행", "씨티은행", "케이뱅크", "카카오뱅크", "토스뱅크",
  "부산은행", "대구은행", "광주은행", "전북은행", "경남은행", "제주은행",
  "수협은행", "산업은행", "새마을금고", "신협", "우체국", "저축은행"
] as const;

export const koreanBanksArray = koreanBanks;

export const insertHelperBankAccountSchema = createInsertSchema(helperBankAccounts)
  .omit({ id: true, createdAt: true, userId: true, verificationStatus: true })
  .extend({
    accountHolder: z.string().min(2, "예금주명을 입력해주세요"),
    bankName: z.enum(koreanBanks, { errorMap: () => ({ message: "은행을 선택해주세요" }) }),
    accountNumber: z.string().min(10, "올바른 계좌번호를 입력해주세요").max(20),
    bankbookImageUrl: z.string().nullable().optional(),
  });

// Requester refund account schema
export const insertRequesterRefundAccountSchema = createInsertSchema(requesterRefundAccounts)
  .omit({ id: true, createdAt: true, updatedAt: true, userId: true })
  .extend({
    accountHolder: z.string().trim().min(2, "예금주명을 입력해주세요").max(20, "예금주명은 20자 이내로 입력해주세요"),
    bankName: z.enum(koreanBanks, { errorMap: () => ({ message: "은행을 선택해주세요" }) }),
    accountNumber: z.string().trim().regex(/^[0-9-]+$/, "계좌번호는 숫자와 하이픈만 입력 가능합니다").min(10, "올바른 계좌번호를 입력해주세요").max(20, "계좌번호는 20자 이내로 입력해주세요"),
  });

// License schema
export const insertHelperLicenseSchema = createInsertSchema(helperLicenses)
  .omit({ id: true, createdAt: true, userId: true });

export const insertHelperServiceAreaSchema = createInsertSchema(helperServiceAreas)
  .omit({ id: true, createdAt: true })
  .extend({
    userId: z.string(),
    region: z.string().min(1, "지역을 선택해주세요"),
    district: z.string().nullable().optional(),
  });

// Terms agreement schema
export const insertHelperTermsAgreementSchema = createInsertSchema(helperTermsAgreements)
  .omit({ id: true, createdAt: true })
  .extend({
    userId: z.string(),
    serviceAgreed: z.boolean(),
    vehicleAgreed: z.boolean(),
    liabilityAgreed: z.boolean(),
    settlementAgreed: z.boolean(),
    locationAgreed: z.boolean(),
    privacyAgreed: z.boolean(),
    signatureData: z.string().min(1000, "유효한 서명이 필요합니다"),
    // 법적 보호 기록 필드
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    consentLog: z.string().optional(),
    contractContent: z.string().optional(),
    agreedAt: z.date().optional(),
  });

// Requester service agreement schema
export const insertRequesterServiceAgreementSchema = createInsertSchema(requesterServiceAgreements)
  .omit({ id: true, createdAt: true })
  .extend({
    userId: z.string(),
    contractAgreed: z.boolean(),
    depositAmount: z.number().nullable().optional(),
    balanceAmount: z.number().nullable().optional(),
    balanceDueDate: z.string().nullable().optional(),
    signatureData: z.string().min(1000, "유효한 서명이 필요합니다"),
    phoneNumber: z.string().optional(),
    phoneVerified: z.boolean().optional(),
    phoneVerifiedAt: z.date().optional(),
    // 법적 보호 기록 필드
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    consentLog: z.string().optional(),
    contractContent: z.string().optional(),
    agreedAt: z.date().optional(),
  });

// Order schema - 새로운 상태 체계 (SP 문서 기준)
// 오더 상태 흐름: OPEN → ASSIGNED → IN_PROGRESS → CLOSING_SUBMITTED → FINAL_AMOUNT_CONFIRMED → BALANCE_PAID → SETTLEMENT_PAID
const orderStatuses = [
  "awaiting_deposit",         // 승인대기 (계약금입금확인) - 레거시
  "registered",               // 등록중 (본사승인완료, 헬퍼앱오더등록) - 레거시
  "open",                     // 매칭중 (SP: OPEN, 지원자 ≤ 3)
  "matching",                 // 매칭중 (레거시 호환)
  "scheduled",                // 예정중 (SP: ASSIGNED, 헬퍼선택완료)
  "in_progress",              // 업무중 (SP: IN_PROGRESS, 헬퍼 업무 시작)
  "closing_submitted",        // 마감 검수중 (SP: CLOSING_SUBMITTED, 헬퍼 마감 제출)
  "final_amount_confirmed",   // 잔금 결제대기 (SP: FINAL_AMOUNT_CONFIRMED, 관리자 승인)
  "balance_paid",             // 마감 (SP: BALANCE_PAID, 요청자 잔금 결제)
  "settlement_paid",          // 완료 (SP: SETTLEMENT_PAID, 관리자 정산)
  "closed"                    // 마감 (레거시 호환)
] as const;
export const orderStatusesArray = orderStatuses;

// 상태 한글 매핑 - 요청자(헬프미) 기준 (SP 문서 4.1)
export const orderStatusLabels: Record<string, string> = {
  awaiting_deposit: "승인대기",
  registered: "등록중",
  open: "매칭중",
  matching: "매칭중",
  scheduled: "예정",
  in_progress: "업무중",
  closing_submitted: "마감 검수중",
  final_amount_confirmed: "잔금 결제대기",
  balance_paid: "마감",
  settlement_paid: "완료",
  closed: "마감"
};

// 상태 한글 매핑 - 헬퍼 기준 (SP 문서 4.2)
export const helperOrderStatusLabels: Record<string, string> = {
  open: "공고중",
  matching: "공고중",
  scheduled: "예정",
  in_progress: "업무중",
  closing_submitted: "마감 제출완료",
  final_amount_confirmed: "잔금 대기",
  balance_paid: "정산대기",
  settlement_paid: "정산완료",
  closed: "정산완료"
};

// 중복 접수 불가 상태 - 헬퍼가 이 상태의 오더를 가지고 있으면 신규 지원 불가
// (selected 이상: 이미 일을 잡은 상태)
export const ACTIVE_ORDER_STATUSES = [
  "scheduled",
  "in_progress",
  "closing_submitted",
  "final_amount_confirmed",
  "balance_paid",
] as const;

export type ActiveOrderStatus = typeof ACTIVE_ORDER_STATUSES[number];

export const insertOrderSchema = createInsertSchema(orders)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    requesterId: z.string().nullable().optional(),
    companyName: z.string().min(1, "회사명을 입력해주세요"),
    pricePerUnit: z.number().min(1, "단가를 입력해주세요"),
    averageQuantity: z.string().min(1, "평균수량을 입력해주세요"),
    deliveryArea: z.string().min(1, "배송지역을 입력해주세요"),
    scheduledDate: z.string().min(1, "일정을 입력해주세요"),
    scheduledDateEnd: z.string().nullable().optional(),
    vehicleType: z.string().min(1, "차종을 입력해주세요"),
    status: z.enum(orderStatuses).default("awaiting_deposit"),
    maxHelpers: z.number().default(3),  // A안: 최대 3명 지원자 제한
    currentHelpers: z.number().default(0),
  });

// Order application schema - 헬퍼 관점 상태
const applicationStatuses = [
  "applied",       // 신청중 (헬퍼가 신청함)
  "selected",      // 매칭중 (헬프미가 선택함)
  "scheduled",     // 예정중 (매칭완료 클릭)
  "in_progress",   // 업무중 (QR출근)
  "completed",     // 마감 (업무완료 전송)
  "rejected",      // 거절됨
  "cancelled",     // 자동취소 (동일 날짜 중복 매칭 방지)
  "approved"       // 레거시: 관리자 배정
] as const;
export const applicationStatusesArray = applicationStatuses;

// 헬퍼 상태 한글 매핑
export const applicationStatusLabels: Record<string, string> = {
  applied: "신청중",
  selected: "매칭중",
  scheduled: "예정중",
  in_progress: "업무중",
  completed: "마감",
  rejected: "거절됨"
};

export const insertOrderApplicationSchema = createInsertSchema(orderApplications)
  .omit({ id: true, appliedAt: true })
  .extend({
    orderId: z.number(),
    helperId: z.string(),
    status: z.enum(applicationStatuses).default("applied"),
    processedAt: z.date().nullable().optional(),
  });

// Notification schema
const notificationTypes = [
  "matching_success", 
  "matching_failed", 
  "announcement", 
  "phone_shared", 
  "order_completed", 
  "onboarding_approved", 
  "onboarding_rejected",
  "new_order",           // 신규 오더 등록
  "order_application",   // 헬퍼가 오더 신청
  "application_rejected", // 오더 신청 반려
  "contract_sign_request", // 계약서 서명 요청
  "settlement_completed", // 정산 완료
  "dispute_submitted",   // 분쟁 접수
  "dispute_resolved",    // 분쟁 해결
  // 새로운 상태 변화 알림
  "order_registered",    // 등록중 (본사승인완료) → 헬퍼앱에 오더 생성
  "helper_applied",      // 헬퍼가 업무 신청 → 헬프미에게 알림
  "helper_selected",     // 헬프미가 헬퍼 선택 → 헬퍼에게 알림
  "matching_completed",  // 매칭완료 → 헬퍼/헬프미 양쪽 알림
  "helper_checked_in",   // 헬퍼 출근(QR) → 헬프미에게 알림
  "work_closed",         // 업무마감 → 헬프미/관리자에게 알림
  "order_created",       // 오더 생성 (입금대기)
  "order_approved",      // 오더 승인 (관리자 입금확인)
  "application_auto_cancelled" // 동일 날짜 중복 매칭으로 자동취소
] as const;
export const notificationTypesArray = notificationTypes;

export const insertNotificationSchema = createInsertSchema(notifications)
  .omit({ id: true, createdAt: true, isRead: true })
  .extend({
    userId: z.string(),
    type: z.enum(notificationTypes),
    title: z.string().min(1),
    message: z.string().min(1),
    relatedId: z.number().nullable().optional(),
    phoneNumber: z.string().nullable().optional(),
  });

// Notification log schema (알림 발송 기록)
const deliveryChannels = ["websocket", "polling"] as const;
export const deliveryChannelsArray = deliveryChannels;

export const insertNotificationLogSchema = createInsertSchema(notificationLogs)
  .omit({ id: true, sentAt: true, isDelivered: true, isRead: true, readAt: true })
  .extend({
    userId: z.string(),
    type: z.enum(notificationTypes),
    title: z.string().min(1),
    message: z.string().min(1),
    relatedId: z.number().nullable().optional(),
    payload: z.string().nullable().optional(),
    deliveryChannel: z.enum(deliveryChannels),
  });

// Contracts table (계약) - 예치금 제거, 계약금/잔금 체계
export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  helperId: varchar("helper_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  requesterId: varchar("requester_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  totalAmount: integer("total_amount").notNull(),
  depositAmount: integer("deposit_amount").notNull(), // 20% deposit (legacy, maps to downPaymentAmount)
  balanceAmount: integer("balance_amount").notNull(), // 80% balance
  depositPaid: boolean("deposit_paid").default(false),
  balancePaid: boolean("balance_paid").default(false),
  depositPaidAt: timestamp("deposit_paid_at"),
  balancePaidAt: timestamp("balance_paid_at"),
  balanceDueDate: text("balance_due_date"),
  status: text("status").default("pending"), // pending, deposit_paid, completed, cancelled
  // 예치금 제거 후 새 필드들 (계약금/잔금 체계)
  downPaymentAmount: integer("down_payment_amount"), // 계약금 (기존 depositAmount와 동일)
  downPaymentStatus: text("down_payment_status").default("pending"), // pending, paid
  downPaymentPaidAt: timestamp("down_payment_paid_at"),
  finalAmount: integer("final_amount"), // 마감자료 기반 최종 금액
  finalAmountConfirmedAt: timestamp("final_amount_confirmed_at"),
  calculatedBalanceAmount: integer("calculated_balance_amount"), // 잔금 = finalAmount - downPaymentAmount
  balanceStatus: text("balance_status").default("pending"), // pending, paid
  closingReportId: integer("closing_report_id"), // 연결된 마감자료 ID
  // 채권추심 관련 동의 항목 (Phase 2)
  agreedLatePayment: boolean("agreed_late_payment").default(false), // 연체이자 동의
  agreedDebtCollection: boolean("agreed_debt_collection").default(false), // 채권추심 동의
  agreedJointGuarantee: boolean("agreed_joint_guarantee").default(false), // 연대보증 동의
  agreedDocObligation: boolean("agreed_doc_obligation").default(false), // 서류 제출 의무 동의 (헬퍼)
  agreedVehicleMgmt: boolean("agreed_vehicle_mgmt").default(false), // 차량 관리 동의 (헬퍼)
  agreedFalseDoc: boolean("agreed_false_doc").default(false), // 허위 서류 법적 책임 동의 (헬퍼)
  agreedLatePaymentAt: timestamp("agreed_late_payment_at"), // 동의 시각
  agreedDebtCollectionAt: timestamp("agreed_debt_collection_at"),
  agreedJointGuaranteeAt: timestamp("agreed_joint_guarantee_at"),
  agreedDocObligationAt: timestamp("agreed_doc_obligation_at"),
  agreedVehicleMgmtAt: timestamp("agreed_vehicle_mgmt_at"),
  agreedFalseDocAt: timestamp("agreed_false_doc_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Closing Reports table (마감자료) - 헬퍼가 업무 종료 시 제출
export const closingReports = pgTable("closing_reports", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  helperId: varchar("helper_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  contractId: integer("contract_id")
    .references(() => contracts.id, { onDelete: "set null" }),
  // 실적 데이터
  deliveredCount: integer("delivered_count").default(0).notNull(),
  returnedCount: integer("returned_count").default(0).notNull(),
  etcCount: integer("etc_count").default(0), // 기타 항목 수량
  etcPricePerUnit: integer("etc_price_per_unit"), // 기타 항목 단가 (저장 시점)
  // 기타비용 (JSON: [{code, amount, memo}])
  extraCostsJson: text("extra_costs_json"),
  // 증빙 파일들 (JSON 배열)
  courierEvidenceFilesJson: text("courier_evidence_files_json"), // 택배사별 이력 캡쳐
  proofFilesJson: text("proof_files_json"), // 증빙 사진
  deliveryHistoryImagesJson: text("delivery_history_images_json"), // 집배송 이력 이미지 (필수)
  etcImagesJson: text("etc_images_json"), // 기타 참고 이미지 (선택)
  dynamicFieldsJson: text("dynamic_fields_json"), // 관리자 설정 동적 필드 값
  memo: text("memo"),
  // 상태
  status: text("status").default("submitted"), // submitted, approved, rejected
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by"),
  rejectReason: text("reject_reason"),
  // 계산된 금액 (정산 스냅샷 - SSOT)
  calculatedAmount: integer("calculated_amount"), // 서버가 계산한 최종 금액
  supplyAmount: integer("supply_amount"), // 공급가 (VAT 제외)
  vatAmount: integer("vat_amount"), // 부가세 (10%)
  totalAmount: integer("total_amount"), // 총액 (공급가 + VAT)
  platformFeeRate: integer("platform_fee_rate"), // 플랫폼 수수료율 (저장 시점, bp 단위)
  platformFee: integer("platform_fee"), // 플랫폼 수수료 금액
  netAmount: integer("net_amount"), // 헬퍼 지급액 (공급가 - 수수료)
  pricingSnapshotJson: text("pricing_snapshot_json"), // 정책 스냅샷 JSON
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Work confirmations table (작업 완료 확인)
export const workConfirmations = pgTable("work_confirmations", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id")
    .notNull()
    .references(() => contracts.id, { onDelete: "cascade" }),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  helperId: varchar("helper_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  proofImageUrl: text("proof_image_url"),
  helperSubmittedAt: timestamp("helper_submitted_at"),
  requesterConfirmedAt: timestamp("requester_confirmed_at"),
  status: text("status").default("pending"), // pending, submitted, confirmed
  notes: text("notes"),
  deliveryCount: integer("delivery_count").default(0),
  returnCount: integer("return_count").default(0),
  pickupCount: integer("pickup_count").default(0),
  otherCount: integer("other_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Reviews table (리뷰)
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id")
    .notNull()
    .references(() => contracts.id, { onDelete: "cascade" }),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  helperId: varchar("helper_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  requesterId: varchar("requester_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reviewerType: text("reviewer_type").default("requester"), // "requester" (requester->helper) or "helper" (helper->requester)
  rating: integer("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Contract schema
const contractStatuses = ["pending", "deposit_paid", "completed", "cancelled"] as const;
export const contractStatusesArray = contractStatuses;

export const contractStatusLabels: Record<string, string> = {
  pending: "대기중",
  deposit_paid: "계약금완료",
  completed: "완료",
  cancelled: "취소됨"
};

export const insertContractSchema = createInsertSchema(contracts)
  .omit({ id: true, createdAt: true, depositPaidAt: true, balancePaidAt: true })
  .extend({
    orderId: z.number(),
    helperId: z.string(),
    requesterId: z.string(),
    totalAmount: z.number().min(1),
    depositAmount: z.number().min(1),
    balanceAmount: z.number().min(1),
    depositPaid: z.boolean().default(false),
    balancePaid: z.boolean().default(false),
    balanceDueDate: z.string().nullable().optional(),
    status: z.enum(contractStatuses).default("pending"),
  });

// Closing Report schema (마감자료)
const closingReportStatuses = ["submitted", "approved", "rejected"] as const;
export const closingReportStatusesArray = closingReportStatuses;

export const insertClosingReportSchema = createInsertSchema(closingReports)
  .omit({ id: true, createdAt: true, updatedAt: true, reviewedAt: true })
  .extend({
    orderId: z.number(),
    helperId: z.string(),
    contractId: z.number().nullable().optional(),
    deliveredCount: z.number().min(0).default(0),
    returnedCount: z.number().min(0).default(0),
    extraCostsJson: z.string().nullable().optional(),
    courierEvidenceFilesJson: z.string().nullable().optional(),
    proofFilesJson: z.string().nullable().optional(),
    memo: z.string().nullable().optional(),
    status: z.enum(closingReportStatuses).default("submitted"),
    calculatedAmount: z.number().nullable().optional(),
  });

// Work confirmation schema
const workConfirmationStatuses = ["pending", "submitted", "confirmed"] as const;
export const workConfirmationStatusesArray = workConfirmationStatuses;

export const insertWorkConfirmationSchema = createInsertSchema(workConfirmations)
  .omit({ id: true, createdAt: true, helperSubmittedAt: true, requesterConfirmedAt: true })
  .extend({
    contractId: z.number(),
    orderId: z.number(),
    helperId: z.string(),
    proofImageUrl: z.string().nullable().optional(),
    status: z.enum(workConfirmationStatuses).default("pending"),
    notes: z.string().nullable().optional(),
    deliveryCount: z.number().default(0),
    returnCount: z.number().default(0),
    pickupCount: z.number().default(0),
    otherCount: z.number().default(0),
  });

// Review schema
export const insertReviewSchema = createInsertSchema(reviews)
  .omit({ id: true, createdAt: true })
  .extend({
    contractId: z.number(),
    orderId: z.number(),
    helperId: z.string(),
    requesterId: z.string(),
    rating: z.number().min(1).max(5),
    comment: z.string().nullable().optional(),
  });

// Team schema
export const insertTeamSchema = createInsertSchema(teams)
  .omit({ id: true, createdAt: true })
  .extend({
    leaderId: z.string(),
    name: z.string().min(1, "팀 이름을 입력해주세요"),
    qrCodeToken: z.string(),
    isActive: z.boolean().default(true),
  });

// Team member schema
export const insertTeamMemberSchema = createInsertSchema(teamMembers)
  .omit({ id: true, joinedAt: true })
  .extend({
    teamId: z.number(),
    helperId: z.string(),
    isActive: z.boolean().default(true),
  });

// 카테고리 타입: parcel(택배사), other(기타택배), cold(냉탑전용)
export type CourierCategory = "parcel" | "other" | "cold";

// Courier settings table (택배사별 설정 - 카테고리 기본값 + 개별 override)
// PAGE1: (DEFAULT)parcel, (DEFAULT)other, (DEFAULT)cold 3개 행으로 카테고리 기본값 관리
// PAGE2: 개별 택배사 override 설정
export const courierSettings = pgTable("courier_settings", {
  id: serial("id").primaryKey(),
  courierName: text("courier_name").notNull().unique(),
  category: text("category").notNull().default("parcel"), // parcel, other, cold
  basePricePerBox: integer("base_price_per_box").notNull().default(0), // 기본 박스단가
  etcPricePerBox: integer("etc_price_per_box").default(0), // 기타 항목 단가
  minDeliveryFee: integer("min_delivery_fee").notNull().default(0), // 최저운송료 (레거시)
  minTotal: integer("min_total").notNull().default(0), // 최저운임 총액 (예: 300000원)
  commissionRate: integer("commission_rate").notNull().default(0), // 일반 수수료율 (%)
  urgentCommissionRate: integer("urgent_commission_rate").notNull().default(0), // 긴급 수수료율 (%)
  urgentSurchargeRate: integer("urgent_surcharge_rate").notNull().default(0), // 긴급 할증율 (%)
  isDefault: boolean("is_default").default(false), // 카테고리 기본값 여부 (예: (DEFAULT)parcel)
  isActive: boolean("is_active").default(true), // 활성화 여부
  sortOrder: integer("sort_order").default(0), // 정렬 순서
  deletedAt: timestamp("deleted_at"), // soft delete
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Courier tiered pricing table (택배사별 박스 수량 차등 가격)
export const courierTieredPricing = pgTable("courier_tiered_pricing", {
  id: serial("id").primaryKey(),
  courierId: integer("courier_id")
    .notNull()
    .references(() => courierSettings.id, { onDelete: "cascade" }),
  minBoxCount: integer("min_box_count").notNull().default(1), // 최소 박스 수량
  maxBoxCount: integer("max_box_count"), // 최대 박스 수량 (null = 무제한)
  minTotalVatInclusive: integer("min_total_vat_inclusive"), // 최소 요청 부가세 포함 합계금액 (관리자 입력값)
  pricePerBox: integer("price_per_box").notNull(), // 박스당 단가 (자동 계산)
  belowMinIncrementPerBox: integer("below_min_increment_per_box").default(100), // 최저 합계금액 미달 시 박스당 인상액 (자동 계산)
  description: text("description"), // 설명 (예: "100박스 이상")
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Team commission overrides table (팀별 수수료)
// 총 수수료 = 본사 수수료 + 팀장 인센티브 (예: 10% = 8% + 2%)
export const teamCommissionOverrides = pgTable("team_commission_overrides", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  commissionRate: integer("commission_rate").notNull(), // 총 수수료율 (%) - 본사 + 팀장
  platformRate: integer("platform_rate").default(8), // 본사 수수료율 (%)
  teamLeaderRate: integer("team_leader_rate").default(2), // 팀장 인센티브율 (%)
  notes: text("notes"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Global commission policies table (글로벌 수수료 정책)
// 적용 우선순위: 헬퍼별 > 팀별 > 글로벌 기본값
// 총 수수료 = 본사 수수료 + 팀장 인센티브 (예: 10% = 8% + 2%)
export const commissionPolicies = pgTable("commission_policies", {
  id: serial("id").primaryKey(),
  policyType: text("policy_type").notNull(), // "helper" (기사 기본), "team_leader" (팀장 인센티브)
  defaultRate: integer("default_rate").notNull().default(10), // 총 수수료율 (%) - 본사 + 팀장
  platformRate: integer("platform_rate").notNull().default(8), // 본사 수수료율 (%)
  teamLeaderRate: integer("team_leader_rate").notNull().default(2), // 팀장 인센티브율 (%)
  description: text("description"),
  isActive: boolean("is_active").default(true),
  modifiedBy: varchar("modified_by").references(() => users.id),
  effectiveFrom: timestamp("effective_from").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Helper commission overrides table (헬퍼별 개별 수수료율)
export const helperCommissionOverrides = pgTable("helper_commission_overrides", {
  id: serial("id").primaryKey(),
  helperId: varchar("helper_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  commissionRate: integer("commission_rate").notNull(), // 수수료율 (%)
  notes: text("notes"),
  modifiedBy: varchar("modified_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment reminders table (연체 독촉장)
export const paymentReminders = pgTable("payment_reminders", {
  id: serial("id").primaryKey(),
  requesterId: varchar("requester_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  orderId: integer("order_id"),
  orderNumber: text("order_number").notNull(),
  unpaidAmount: integer("unpaid_amount").notNull(),
  dueDate: text("due_date").notNull(),
  overdueDate: text("overdue_date"),
  reminderLevel: integer("reminder_level").default(0), // 0=미발송, 1=1차, 2=2차, 3=3차(내용증명)
  
  // 전자서명 정보
  signatureData: text("signature_data"), // base64 encoded signature image
  agreedAt: timestamp("agreed_at"),
  
  // 휴대폰 인증 정보
  phoneNumber: text("phone_number"),
  phoneVerified: boolean("phone_verified").default(false),
  phoneVerifiedAt: timestamp("phone_verified_at"),
  
  // 법적 보호 기록 (새로 추가)
  ipAddress: text("ip_address"),
  trackingNumber: text("tracking_number"),
  userAgent: text("user_agent"),
  consentLog: text("consent_log"),
  contractContent: text("contract_content"),
  firstReminderSentAt: timestamp("first_reminder_sent_at"),
  secondReminderSentAt: timestamp("second_reminder_sent_at"),
  thirdReminderSentAt: timestamp("third_reminder_sent_at"),
  certifiedMailPrintedAt: timestamp("certified_mail_printed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Courier settings schema
export const insertCourierSettingSchema = createInsertSchema(courierSettings)
  .omit({ id: true, updatedAt: true })
  .extend({
    courierName: z.string().min(1, "택배사 이름을 입력해주세요"),
    category: z.enum(["parcel", "other", "cold"]).default("parcel"),
    basePricePerBox: z.number().min(0, "기본 박스단가는 0 이상이어야 합니다").default(0),
    minDeliveryFee: z.number().min(0, "최저운송료는 0 이상이어야 합니다").default(0),
    minTotal: z.number().min(0, "최저운임 총액은 0 이상이어야 합니다").default(0),
    commissionRate: z.number().min(0).max(100, "일반 수수료율은 0~100% 사이여야 합니다").default(0),
    urgentCommissionRate: z.number().min(0).max(100, "긴급 수수료율은 0~100% 사이여야 합니다").default(0),
    urgentSurchargeRate: z.number().min(0).max(100, "긴급 할증율은 0~100% 사이여야 합니다").default(0),
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
  });

// Courier tiered pricing schema
export const insertCourierTieredPricingSchema = createInsertSchema(courierTieredPricing)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    courierId: z.number(),
    minBoxCount: z.number().min(1, "최소 박스 수량은 1 이상이어야 합니다"),
    maxBoxCount: z.number().nullable().optional(),
    minTotalVatInclusive: z.number().min(1000, "최소 요청 합계금액은 1,000원 이상이어야 합니다").optional(),
    pricePerBox: z.number().min(0, "박스당 단가는 0 이상이어야 합니다").optional(),
    belowMinIncrementPerBox: z.number().min(0).default(100).optional(),
    description: z.string().nullable().optional(),
    isActive: z.boolean().default(true),
  });

// Carrier rate items table (택배사별 품목 단가 설정)
export const carrierRateItems = pgTable("carrier_rate_items", {
  id: serial("id").primaryKey(),
  courierId: integer("courier_id")
    .notNull()
    .references(() => courierSettings.id, { onDelete: "cascade" }),
  itemName: text("item_name").notNull(), // 품목명 (배송, 반품, 기타 등)
  itemType: text("item_type").notNull(), // delivery, return, pickup, other
  unitPrice: integer("unit_price").notNull().default(0), // 품목당 단가
  includeVat: boolean("include_vat").default(false), // VAT 포함 여부
  displayOrder: integer("display_order").default(0), // 표시 순서
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Carrier rate items schema
export const insertCarrierRateItemSchema = createInsertSchema(carrierRateItems)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    courierId: z.number(),
    itemName: z.string().min(1, "품목명을 입력해주세요"),
    itemType: z.enum(["delivery", "return", "pickup", "other"]),
    unitPrice: z.number().min(0, "단가는 0 이상이어야 합니다"),
    includeVat: z.boolean().default(false),
    displayOrder: z.number().default(0),
    isActive: z.boolean().default(true),
  });

export type InsertCarrierRateItem = z.infer<typeof insertCarrierRateItemSchema>;
export type CarrierRateItem = typeof carrierRateItems.$inferSelect;

// Team commission override schema
export const insertTeamCommissionOverrideSchema = createInsertSchema(teamCommissionOverrides)
  .omit({ id: true, updatedAt: true })
  .extend({
    teamId: z.number(),
    commissionRate: z.number().min(0).max(100, "수수료율은 0~100% 사이여야 합니다"),
    notes: z.string().nullable().optional(),
  });

export type InsertTeamCommissionOverride = z.infer<typeof insertTeamCommissionOverrideSchema>;
export type TeamCommissionOverride = typeof teamCommissionOverrides.$inferSelect;

// Commission policy schema
export const insertCommissionPolicySchema = createInsertSchema(commissionPolicies)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    policyType: z.enum(["helper", "team_leader"]),
    defaultRate: z.number().min(0).max(100, "수수료율은 0~100% 사이여야 합니다"),
    description: z.string().nullable().optional(),
    isActive: z.boolean().default(true),
    modifiedBy: z.string().nullable().optional(),
  });

export type InsertCommissionPolicy = z.infer<typeof insertCommissionPolicySchema>;
export type CommissionPolicy = typeof commissionPolicies.$inferSelect;

// Helper commission override schema
export const insertHelperCommissionOverrideSchema = createInsertSchema(helperCommissionOverrides)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    helperId: z.string(),
    commissionRate: z.number().min(0).max(100, "수수료율은 0~100% 사이여야 합니다"),
    notes: z.string().nullable().optional(),
    modifiedBy: z.string().nullable().optional(),
  });

export type InsertHelperCommissionOverride = z.infer<typeof insertHelperCommissionOverrideSchema>;
export type HelperCommissionOverride = typeof helperCommissionOverrides.$inferSelect;

// Admin bank accounts table (입금 통장 관리)
export const adminBankAccounts = pgTable("admin_bank_accounts", {
  id: serial("id").primaryKey(),
  accountType: text("account_type").notNull(), // deposit (계약금), balance (잔금)
  bankName: text("bank_name").notNull(), // 은행명
  accountNumber: text("account_number").notNull(), // 계좌번호
  accountHolder: text("account_holder").notNull(), // 예금주
  bankBranch: text("bank_branch"), // 지점명 (선택)
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  notes: text("notes"), // 메모 (선택)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAdminBankAccountSchema = createInsertSchema(adminBankAccounts)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    accountType: z.enum(["deposit", "balance"]),
    bankName: z.string().min(1, "은행명을 입력해주세요"),
    accountNumber: z.string().min(1, "계좌번호를 입력해주세요"),
    accountHolder: z.string().min(1, "예금주를 입력해주세요"),
    bankBranch: z.string().nullable().optional(),
    displayOrder: z.number().default(0),
    isActive: z.boolean().default(true),
    notes: z.string().nullable().optional(),
  });

export type InsertAdminBankAccount = z.infer<typeof insertAdminBankAccountSchema>;
export type AdminBankAccount = typeof adminBankAccounts.$inferSelect;

// System settings table (시스템 설정)
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: text("setting_value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings)
  .omit({ id: true, updatedAt: true })
  .extend({
    settingKey: z.string().min(1),
    settingValue: z.string(),
    description: z.string().nullable().optional(),
  });

// Payment reminder schema
export const insertPaymentReminderSchema = createInsertSchema(paymentReminders)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    requesterId: z.string(),
    orderId: z.number().optional().nullable(),
    orderNumber: z.string(),
    unpaidAmount: z.number().min(1),
    dueDate: z.string(),
    overdueDate: z.string().optional().nullable(),
    reminderLevel: z.number().default(0),
    signatureData: z.string().optional().nullable(),
    phoneNumber: z.string().optional().nullable(),
    phoneVerified: z.boolean().optional().default(false),
    ipAddress: z.string().optional().nullable(),
    userAgent: z.string().optional().nullable(),
    consentLog: z.string().optional().nullable(),
    contractContent: z.string().optional().nullable(),
  });

// Announcements table (본사 공지)
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  targetAudience: text("target_audience").notNull(), // all, helper, requester
  createdBy: varchar("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Announcement recipients table (공지 수신자 추적)
export const announcementRecipients = pgTable("announcement_recipients", {
  id: serial("id").primaryKey(),
  announcementId: integer("announcement_id")
    .notNull()
    .references(() => announcements.id, { onDelete: "cascade" }),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  deliveredAt: timestamp("delivered_at").defaultNow(),
});

// Announcement schemas
const targetAudiences = ["all", "helper", "requester"] as const;
export const targetAudiencesArray = targetAudiences;

export const insertAnnouncementSchema = createInsertSchema(announcements)
  .omit({ id: true, createdAt: true })
  .extend({
    title: z.string().min(1, "제목을 입력해주세요"),
    content: z.string().min(1, "내용을 입력해주세요"),
    targetAudience: z.enum(targetAudiences),
    createdBy: z.string(),
  });

export const insertAnnouncementRecipientSchema = createInsertSchema(announcementRecipients)
  .omit({ id: true, deliveredAt: true })
  .extend({
    announcementId: z.number(),
    userId: z.string(),
  });

// ==================== 법적 안전장치 테이블 ====================

// 계약 실행 이벤트 로그 (법적 효력 발생 시점 기록)
export const contractExecutionEvents = pgTable("contract_execution_events", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id"), // jobContracts 또는 contracts 참조
  contractType: text("contract_type").notNull(), // job_contract, service_contract
  triggerType: text("trigger_type").notNull(), // terms_checked, payment_confirmed, execution_recorded
  initiatedBy: varchar("initiated_by").references(() => users.id, { onDelete: "set null" }),
  initiatorRole: text("initiator_role"), // helper, requester
  paymentId: integer("payment_id"), // payments 테이블 참조
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: text("metadata"),
  executedAt: timestamp("executed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 결제 정보 테이블 (계약-결제 1:1 매핑)
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id"), // contracts 테이블 참조 (unique)
  jobContractId: integer("job_contract_id"), // jobContracts 테이블 참조
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
  payerId: varchar("payer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // manual, stripe, nicepay, etc.
  providerPaymentId: text("provider_payment_id"), // 외부 결제 ID
  amount: integer("amount").notNull(),
  currency: text("currency").default("KRW"),
  paymentType: text("payment_type").notNull(), // deposit (계약금), balance (잔금), full (전액)
  status: text("status").default("initiated"), // initiated, authorized, captured, canceled, refunded
  depositFlag: boolean("deposit_flag").default(false), // 계약금 여부
  paidAt: timestamp("paid_at"),
  canceledAt: timestamp("canceled_at"),
  refundedAt: timestamp("refunded_at"),
  cancelReason: text("cancel_reason"),
  refundReason: text("refund_reason"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  // 연체 관리 (Phase 2)
  overdueStatus: text("overdue_status").default("normal"), // normal, warning, overdue, collection, legal
  overdueDays: integer("overdue_days").default(0), // 연체 일수
  lateInterest: numeric("late_interest", { precision: 10, scale: 2 }).default("0"), // 지연손해금 (연 15%)
  reminderSentCount: integer("reminder_sent_count").default(0), // 독촉 발송 횟수
  lastReminderSentAt: timestamp("last_reminder_sent_at"), // 마지막 독촉 발송 시각
  serviceRestrictedAt: timestamp("service_restricted_at"), // 서비스 제한 시작 시각
  collectionStartedAt: timestamp("collection_started_at"), // 추심 위탁 시작 시각
  legalActionStartedAt: timestamp("legal_action_started_at"), // 법적 조치 시작 시각
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 결제 상태 변경 이벤트 로그
export const paymentStatusEvents = pgTable("payment_status_events", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  changedBy: varchar("changed_by").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason"),
  metadata: text("metadata"), // JSON
  createdAt: timestamp("created_at").defaultNow(),
});

// 계약서 문서 저장 (PDF 등)
export const contractDocuments = pgTable("contract_documents", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id"), // contracts 참조
  jobContractId: integer("job_contract_id"), // jobContracts 참조
  documentType: text("document_type").notNull(), // contract_pdf, settlement_pdf, etc.
  storagePath: text("storage_path").notNull(),
  fileSize: integer("file_size"),
  checksum: text("checksum"), // 파일 무결성 검증용 해시
  mimeType: text("mime_type").default("application/pdf"),
  generatedAt: timestamp("generated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 건별 전자계약 (대체근무 계약)
export const jobContracts = pgTable("job_contracts", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
  helperId: varchar("helper_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  requesterId: varchar("requester_id").references(() => users.id, { onDelete: "set null" }),
  instructionIssuerId: varchar("instruction_issuer_id").references(() => users.id, { onDelete: "set null" }),
  instructionIssuerName: text("instruction_issuer_name"),
  instructionIssuerType: text("instruction_issuer_type"),
  workDate: text("work_date").notNull(),
  workStartTime: text("work_start_time"),
  workEndTime: text("work_end_time"),
  workContent: text("work_content").notNull(),
  taskTypes: text("task_types"),
  paymentAmount: integer("payment_amount").notNull(),
  liabilityScope: text("liability_scope"),
  disputeResponsibility: text("dispute_responsibility"),
  contractContent: text("contract_content"),
  helperSignature: text("helper_signature"),
  helperSignedAt: timestamp("helper_signed_at"),
  requesterSignature: text("requester_signature"),
  requesterSignedAt: timestamp("requester_signed_at"),
  status: text("status").default("pending"), // pending, signed, executed, voided, refunded
  // 계약 실행 관련 필드
  executionEventId: integer("execution_event_id"), // contractExecutionEvents 참조
  executedAt: timestamp("executed_at"), // 법적 효력 발생 시점
  executionStatus: text("execution_status").default("pending"), // pending, executed, voided
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 근무 세션 (출퇴근 체크)
export const workSessions = pgTable("work_sessions", {
  id: serial("id").primaryKey(),
  jobContractId: integer("job_contract_id").references(() => jobContracts.id, { onDelete: "cascade" }),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
  helperId: varchar("helper_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  checkInTime: timestamp("check_in_time"),
  checkInLatitude: text("check_in_latitude"),
  checkInLongitude: text("check_in_longitude"),
  checkInAddress: text("check_in_address"),
  checkOutTime: timestamp("check_out_time"),
  checkOutLatitude: text("check_out_latitude"),
  checkOutLongitude: text("check_out_longitude"),
  checkOutAddress: text("check_out_address"),
  checkOutPhotoUrl: text("check_out_photo_url"),
  workConfirmed: boolean("work_confirmed").default(false),
  workConfirmedAt: timestamp("work_confirmed_at"),
  status: text("status").default("pending"), // pending, started, in_progress, completed, cancelled
  // 업무 시작 시점 명확화 필드
  startTriggerSource: text("start_trigger_source"), // check_in, first_proof, requester_manual
  startEventId: integer("start_event_id"), // workProofEvents 참조 (첫 번째 증빙)
  startedAt: timestamp("started_at"), // 업무 시작 시점
  startedBy: varchar("started_by").references(() => users.id, { onDelete: "set null" }), // 시작 트리거 발동자
  createdAt: timestamp("created_at").defaultNow(),
});

// 근무 증빙 이벤트 (사진+위치+시간)
export const workProofEvents = pgTable("work_proof_events", {
  id: serial("id").primaryKey(),
  workSessionId: integer("work_session_id").references(() => workSessions.id, { onDelete: "cascade" }),
  helperId: varchar("helper_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // delivery, pickup, return, incident, etc.
  photoUrl: text("photo_url"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  address: text("address"),
  notes: text("notes"),
  // 업무 시작 시점 확인용
  isFirstProof: boolean("is_first_proof").default(false), // 첫 번째 증빙 여부
  verifiedAt: timestamp("verified_at"), // 검증 시점
  capturedAt: timestamp("captured_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 정산 명세서
export const settlementStatements = pgTable("settlement_statements", {
  id: serial("id").primaryKey(),
  jobContractId: integer("job_contract_id").references(() => jobContracts.id, { onDelete: "cascade" }),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
  helperId: varchar("helper_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  requesterId: varchar("requester_id").references(() => users.id, { onDelete: "set null" }),
  workDate: text("work_date"),
  deliveryCount: integer("delivery_count").default(0),
  returnCount: integer("return_count").default(0),
  pickupCount: integer("pickup_count").default(0),
  otherCount: integer("other_count").default(0),
  basePay: integer("base_pay").default(0),
  additionalPay: integer("additional_pay").default(0),
  penalty: integer("penalty").default(0),
  deduction: integer("deduction").default(0),
  commissionRate: integer("commission_rate").default(0), // 총 수수료율 (%)
  commissionAmount: integer("commission_amount").default(0), // 총 수수료 (본사 + 팀장)
  platformCommission: integer("platform_commission").default(0), // 본사 수수료
  teamLeaderIncentive: integer("team_leader_incentive").default(0), // 팀장 인센티브
  teamLeaderId: varchar("team_leader_id").references(() => users.id), // 팀장 ID
  supplyAmount: integer("supply_amount").default(0), // 공급가액
  vatAmount: integer("vat_amount").default(0), // 부가세
  totalAmount: integer("total_amount").default(0),
  netAmount: integer("net_amount").default(0),
  helperConfirmed: boolean("helper_confirmed").default(false),
  helperConfirmedAt: timestamp("helper_confirmed_at"),
  helperSignature: text("helper_signature"),
  helperIpAddress: text("helper_ip_address"),
  helperUserAgent: text("helper_user_agent"),
  statementContent: text("statement_content"),
  status: text("status").default("pending"), // pending, confirmed, paid, disputed, on_hold
  // 분쟁 시 정산 보류 필드
  isOnHold: boolean("is_on_hold").default(false), // 정산 보류 상태
  holdReason: text("hold_reason"), // 보류 사유
  holdIncidentId: integer("hold_incident_id"), // 연관 분쟁 ID
  holdStartedAt: timestamp("hold_started_at"), // 보류 시작 시점
  holdReleasedAt: timestamp("hold_released_at"), // 보류 해제 시점
  // 정산 락(Lock) 필드 - 확정 후 수정 불가
  isLocked: boolean("is_locked").default(false), // 정산 락 상태
  lockedAt: timestamp("locked_at"), // 락 설정 시점
  lockedBy: varchar("locked_by").references(() => users.id, { onDelete: "set null" }), // 락 설정자
  lockReason: text("lock_reason"), // 락 사유
  // 버전 관리 (Optimistic Locking)
  version: integer("version").default(1), // 버전 번호 (동시성 제어)
  lastModifiedBy: varchar("last_modified_by").references(() => users.id, { onDelete: "set null" }),
  lastModifiedAt: timestamp("last_modified_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 정산 항목 상세
export const settlementLineItems = pgTable("settlement_line_items", {
  id: serial("id").primaryKey(),
  statementId: integer("statement_id").notNull().references(() => settlementStatements.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull(),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").default(0),
  unitPrice: integer("unit_price").default(0),
  amount: integer("amount").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 지시 이력 로그 (책임 분리)
export const instructionLogs = pgTable("instruction_logs", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
  jobContractId: integer("job_contract_id").references(() => jobContracts.id, { onDelete: "cascade" }),
  issuerId: varchar("issuer_id").references(() => users.id, { onDelete: "set null" }),
  issuerName: text("issuer_name"),
  issuerType: text("issuer_type"),
  instructionType: text("instruction_type").notNull(),
  instructionContent: text("instruction_content").notNull(),
  previousContent: text("previous_content"),
  changedFields: text("changed_fields"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 사고/분쟁 접수
export const incidentReports = pgTable("incident_reports", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
  jobContractId: integer("job_contract_id").references(() => jobContracts.id, { onDelete: "cascade" }),
  settlementId: integer("settlement_id"), // 연관 정산 ID
  reporterId: varchar("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reporterType: text("reporter_type"), // helper, requester, hq_staff
  helperId: varchar("helper_id").references(() => users.id, { onDelete: "set null" }),
  requesterId: varchar("requester_id").references(() => users.id, { onDelete: "set null" }),
  incidentType: text("incident_type").notNull(), // damage, loss, misdelivery, delay, other
  incidentDate: text("incident_date"),
  description: text("description").notNull(),
  damageAmount: integer("damage_amount"),
  responsibilityParty: text("responsibility_party"),
  suggestedResponsibility: text("suggested_responsibility"),
  resolution: text("resolution"),
  resolutionAmount: integer("resolution_amount"),
  resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at"),
  // 분쟁 상태 (DISPUTE_STATUS enum)
  // requested: 접수됨 (요청자가 분쟁 접수)
  // reviewing: 검토중 (관리자 검토 시작)
  // resolved: 해결됨 (관리자 인정/부분인정)
  // rejected: 기각됨 (관리자 기각)
  status: text("status").default("requested"),
  // 관리자 판단 필드
  adminMemo: text("admin_memo"), // 관리자 판단 메모 (resolved/rejected 시 필수)
  deductionAmount: integer("deduction_amount").default(0), // 차감 금액 (부분인정 시)
  deductionReason: text("deduction_reason"), // 차감 사유
  deductionMethod: text("deduction_method"), // helper_deduct (헬퍼 정산 공제), requester_refund (요청자 환불), both (둘 다)
  deductionConfirmedAt: timestamp("deduction_confirmed_at"), // 차감 확정 시점
  helperDeductionApplied: boolean("helper_deduction_applied").default(false), // 헬퍼 정산 반영 여부
  requesterRefundApplied: boolean("requester_refund_applied").default(false), // 요청자 환불 반영 여부
  // 분쟁 처리 워크플로우 필드
  evidenceDueAt: timestamp("evidence_due_at"), // 증빙 제출 기한 (24~48시간)
  settlementHoldId: integer("settlement_hold_id"), // 보류된 정산 ID
  reviewStartedAt: timestamp("review_started_at"), // 검토 시작 시점
  reviewerId: varchar("reviewer_id").references(() => users.id, { onDelete: "set null" }), // 담당자
  escalatedAt: timestamp("escalated_at"), // 에스컬레이션 시점
  escalatedTo: varchar("escalated_to").references(() => users.id, { onDelete: "set null" }), // 상위 담당자
  ipAddress: text("ip_address"),
  trackingNumber: text("tracking_number"), // 운송장번호
  deliveryAddress: text("delivery_address"), // 배송지 주소
  customerName: text("customer_name"), // 수하인 이름
  customerPhone: text("customer_phone"), // 수하인 연락처
  userAgent: text("user_agent"),
  // 헬퍼 대응 필드
  helperStatus: text("helper_status"), // item_found, request_handling, confirmed, dispute
  helperActionAt: timestamp("helper_action_at"),
  helperNote: text("helper_note"),
  // 헬퍼 응답 기한 관련 필드
  helperResponseDeadline: timestamp("helper_response_deadline"), // 헬퍼 응답 기한 (기본 48시간)
  helperResponseRequired: boolean("helper_response_required").default(true), // 헬퍼 응답 필수 여부
  adminForceProcessed: boolean("admin_force_processed").default(false), // 관리자 강제 처리 여부
  adminForceProcessedAt: timestamp("admin_force_processed_at"), // 강제 처리 시점
  adminForceProcessedBy: varchar("admin_force_processed_by").references(() => users.id, { onDelete: "set null" }),
  adminForceProcessedReason: text("admin_force_processed_reason"),
  updatedAt: timestamp("updated_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 분쟁 처리 이력 (워크플로우 액션 로그)
export const incidentActions = pgTable("incident_actions", {
  id: serial("id").primaryKey(),
  incidentId: integer("incident_id").notNull().references(() => incidentReports.id, { onDelete: "cascade" }),
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  actorRole: text("actor_role"), // helper, requester, hq_staff, system
  actionType: text("action_type").notNull(), // submitted, evidence_requested, evidence_submitted, hold_settlement, review_started, resolved, escalated, closed
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  notes: text("notes"),
  metadata: text("metadata"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 사고 증빙 자료
export const incidentEvidence = pgTable("incident_evidence", {
  id: serial("id").primaryKey(),
  incidentId: integer("incident_id").notNull().references(() => incidentReports.id, { onDelete: "cascade" }),
  evidenceType: text("evidence_type").notNull(),
  fileUrl: text("file_url"),
  description: text("description"),
  uploadedBy: varchar("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// 대체근무 요청 (급한 요청 관리)
export const substituteRequests = pgTable("substitute_requests", {
  id: serial("id").primaryKey(),
  requesterId: varchar("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
  urgencyLevel: text("urgency_level").default("normal"),
  requestDate: text("request_date").notNull(),
  workDate: text("work_date").notNull(),
  workContent: text("work_content"),
  basePayment: integer("base_payment"),
  urgencyPremium: integer("urgency_premium").default(0),
  totalPayment: integer("total_payment"),
  matchedHelperId: varchar("matched_helper_id").references(() => users.id, { onDelete: "set null" }),
  matchedAt: timestamp("matched_at"),
  matchingScore: integer("matching_score"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// 운영 차종 설정 (Vehicle Type Settings)
// ============================================

export const vehicleTypeSettings = pgTable("vehicle_type_settings", {
  id: serial("id").primaryKey(),
  vehicleTypeName: text("vehicle_type_name").notNull().unique(), // 앱 값 그대로
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// 오더 카테고리 설정 (Order Category Settings)
// ============================================

export const orderCategorySettings = pgTable("order_category_settings", {
  id: serial("id").primaryKey(),
  categoryName: text("category_name").notNull().unique(), // 택배사, 기타택배, 냉잡전용, 채용공고
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  allowedCourierNames: text("allowed_courier_names"), // JSON array of allowed courier names (optional)
  isAdminOnly: boolean("is_admin_only").default(false), // 채용공고는 관리자만
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// 본사 계약 업체 (Enterprise Accounts)
// ============================================

export const enterpriseAccounts = pgTable("enterprise_accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // 업체명 (예: CJ대한통운)
  businessNumber: text("business_number").notNull(), // 사업자등록번호
  contactName: text("contact_name"), // 담당자명
  contactPhone: text("contact_phone"), // 담당자 연락처
  contactEmail: text("contact_email"), // 담당자 이메일
  contractStartDate: text("contract_start_date"), // 계약 시작일
  contractEndDate: text("contract_end_date"), // 계약 종료일
  settlementModel: text("settlement_model").default("per_order"), // per_order, monthly, weekly
  taxType: text("tax_type").default("exclusive"), // inclusive(포함), exclusive(별도)
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// 본사 계약 오더 배치 (Enterprise Order Batches)
export const enterpriseOrderBatches = pgTable("enterprise_order_batches", {
  id: serial("id").primaryKey(),
  enterpriseId: integer("enterprise_id")
    .notNull()
    .references(() => enterpriseAccounts.id, { onDelete: "cascade" }),
  projectCode: text("project_code").notNull(), // 프로젝트 코드 (예: CJ-2024-001)
  slaType: text("sla_type").default("next_day"), // same_day, next_day, scheduled
  orderCount: integer("order_count").default(0), // 오더 수량
  totalAmount: integer("total_amount").default(0), // 총액
  status: text("status").default("pending"), // pending, processing, completed
  uploadedFile: text("uploaded_file"), // CSV 업로드 파일명
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// 팀장 인센티브 정산 (Team Leader Incentives)
// ============================================

export const incentivePolicies = pgTable("incentive_policies", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }),
  defaultRate: integer("default_rate").default(10), // 기본 배분율 (%)
  minThreshold: integer("min_threshold").default(0), // 최소 수수료 기준
  paymentCycle: text("payment_cycle").default("monthly"), // weekly, biweekly, monthly
  autoApprove: boolean("auto_approve").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teamIncentives = pgTable("team_incentives", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  period: text("period").notNull(), // YYYY-MM 형식
  totalFees: integer("total_fees").default(0), // 총 수수료 발생액
  incentiveRate: integer("incentive_rate").default(10), // 배분율 (%)
  incentiveAmount: integer("incentive_amount").default(0), // 인센티브 금액
  status: text("status").default("pending"), // pending(산출완료), approved(승인완료), paid(지급완료)
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const incentiveDetails = pgTable("incentive_details", {
  id: serial("id").primaryKey(),
  incentiveId: integer("incentive_id")
    .notNull()
    .references(() => teamIncentives.id, { onDelete: "cascade" }),
  contractId: integer("contract_id").references(() => contracts.id),
  helperId: varchar("helper_id").references(() => users.id),
  contractAmount: integer("contract_amount").default(0),
  feeRate: integer("fee_rate").default(0),
  feeAmount: integer("fee_amount").default(0),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// 세금계산서 (Tax Invoices)
// ============================================

export const taxInvoices = pgTable("tax_invoices", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").references(() => contracts.id),
  orderId: integer("order_id").references(() => orders.id),
  settlementId: integer("settlement_id").references(() => settlementRecords.id),
  
  // 팝빌 연동 필드
  popbillNtsconfirmNum: text("popbill_ntsconfirm_num"), // 국세청 승인번호
  popbillItemKey: text("popbill_item_key"), // 팝빌 문서번호
  popbillMgtKey: text("popbill_mgt_key"), // 관리번호 (우리 시스템에서 생성)
  
  invoiceNumber: text("invoice_number"), // 세금계산서 번호
  issueType: text("issue_type").default("forward"), // forward(정발행), reverse(역발행)
  invoiceKind: text("invoice_kind").default("tax"), // tax(세금계산서), taxmod(수정세금계산서)
  
  // 공급자 정보 (정발행 시 우리, 역발행 시 요청자)
  supplierCorpNum: text("supplier_corp_num"), // 공급자 사업자번호
  supplierCorpName: text("supplier_corp_name"), // 공급자 상호
  supplierCeoName: text("supplier_ceo_name"), // 공급자 대표자
  supplierAddr: text("supplier_addr"), // 공급자 주소
  supplierBizType: text("supplier_biz_type"), // 공급자 업태
  supplierBizClass: text("supplier_biz_class"), // 공급자 종목
  supplierEmail: text("supplier_email"), // 공급자 이메일
  
  // 공급받는자 정보 (정발행 시 헬퍼, 역발행 시 우리)
  buyerCorpNum: text("buyer_corp_num"), // 공급받는자 사업자번호
  buyerCorpName: text("buyer_corp_name"), // 공급받는자 상호
  buyerCeoName: text("buyer_ceo_name"), // 공급받는자 대표자
  buyerAddr: text("buyer_addr"), // 공급받는자 주소
  buyerBizType: text("buyer_biz_type"), // 공급받는자 업태
  buyerBizClass: text("buyer_biz_class"), // 공급받는자 종목
  buyerEmail: text("buyer_email"), // 공급받는자 이메일
  
  // 금액 정보
  supplyAmount: integer("supply_amount").default(0), // 공급가
  vatAmount: integer("vat_amount").default(0), // 부가세
  totalAmount: integer("total_amount").default(0), // 총액
  
  // 날짜 정보
  writeDate: text("write_date"), // 작성일자 (YYYYMMDD)
  issueDate: text("issue_date"), // 발행일자 (YYYYMMDD)
  
  // 품목 정보 (JSON)
  detailList: text("detail_list"), // JSON: [{sn, purchaseDT, itemName, spec, qty, unitCost, supplyCost, tax}]
  
  // 상태 정보
  status: text("status").default("draft"), // draft(임시저장), pending(발행대기), issued(발행완료), accepted(국세청접수), cancelled(취소)
  popbillStatus: text("popbill_status"), // 팝빌 상태코드
  ntsResult: text("nts_result"), // 국세청 처리결과
  ntsSendDT: timestamp("nts_send_dt"), // 국세청 전송일시
  ntsResultDT: timestamp("nts_result_dt"), // 국세청 처리일시
  
  // 비고
  remark1: text("remark1"), // 비고1
  remark2: text("remark2"), // 비고2
  remark3: text("remark3"), // 비고3
  
  // 취소 정보
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: varchar("cancelled_by").references(() => users.id),
  cancelReason: text("cancel_reason"),
  
  // 파일 정보
  pdfUrl: text("pdf_url"), // PDF 파일 URL
  
  // 월별 합산 세금계산서 필드
  invoiceScope: text("invoice_scope").default("individual"), // individual(개별), monthly(월별합산)
  targetMonth: text("target_month"), // 월별합산 대상월 (YYYY-MM)
  targetUserId: varchar("target_user_id").references(() => users.id), // 대상 사용자
  targetUserType: text("target_user_type"), // helper, requester
  settlementIds: text("settlement_ids"), // 포함된 정산ID목록 (JSON array)
  
  // 메타 정보
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  trackingNumber: text("tracking_number"), // 운송장번호
  updatedAt: timestamp("updated_at"),
});

// ============================================
// 단가 변환 규칙 (Price Conversion Rules)
// ============================================

export const priceConversionRules = pgTable("price_conversion_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // 규칙명
  courierId: integer("courier_id").references(() => courierSettings.id),
  workType: text("work_type"), // 업무 유형
  timeSlot: text("time_slot"), // 시간대 (예: 22:00-06:00)
  conversionType: text("conversion_type").default("ceiling"), // floor(내림), ceiling(올림), round(반올림)
  unit: integer("unit").default(100), // 단위 (100원)
  priority: integer("priority").default(0), // 우선순위
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// 대행배차 신청 (Dispatch Requests)
// ============================================

export const dispatchRequests = pgTable("dispatch_requests", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  requesterId: varchar("requester_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pickupAddress: text("pickup_address").notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  urgency: text("urgency").default("normal"), // normal, urgent, emergency
  status: text("status").default("pending"), // pending, assigned, rejected
  assignedHelperId: varchar("assigned_helper_id").references(() => users.id),
  assignedAt: timestamp("assigned_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// 사용자 제재 (User Sanctions)
// ============================================

export const userSanctions = pgTable("user_sanctions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sanctionType: text("sanction_type").notNull(), // warning, suspension, blacklist
  reason: text("reason").notNull(),
  evidence: text("evidence"), // 증거 자료 (URL 등)
  startDate: text("start_date"),
  endDate: text("end_date"), // null이면 영구
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// 팀 QR 코드 (Team QR Codes)
// ============================================

export const teamQrCodes = pgTable("team_qr_codes", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  qrType: text("qr_type").default("TEAM_JOIN_QR"),
  expiresAt: timestamp("expires_at"),
  scanCount: integer("scan_count").default(0),
  status: text("status").default("active"), // active, expired, revoked
  createdAt: timestamp("created_at").defaultNow(),
});

export const qrScanLogs = pgTable("qr_scan_logs", {
  id: serial("id").primaryKey(),
  qrId: integer("qr_id")
    .notNull()
    .references(() => teamQrCodes.id, { onDelete: "cascade" }),
  scannedUserId: varchar("scanned_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  result: text("result").notNull(), // joined, transferred, rejected
  previousTeamId: integer("previous_team_id"),
  scannedAt: timestamp("scanned_at").defaultNow(),
});

// ============================================
// RBAC 권한 관리 테이블 (Admin Permission System)
// ============================================

// 관리자 역할 테이블
export const adminRoles = pgTable("admin_roles", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // STAFF, MANAGER, TEAM_LEAD, FINANCE, ADMIN, SUPER_ADMIN
  name: text("name").notNull(), // 표시명
  description: text("description"),
  level: integer("level").notNull().default(0), // 권한 레벨 (높을수록 상위)
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// 권한 정의 테이블 (domain.resource.action 형식)
export const adminPermissions = pgTable("admin_permissions", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // e.g., "contract.update.balance_due_date"
  domain: text("domain").notNull(), // e.g., "contract", "payment", "settlement"
  resource: text("resource").notNull(), // e.g., "list", "view", "update"
  action: text("action"), // e.g., "balance_due_date", "amounts" (nullable for simple actions)
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// 역할-권한 매핑 테이블
export const adminRolePermissions = pgTable("admin_role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").notNull().references(() => adminRoles.id, { onDelete: "cascade" }),
  permissionId: integer("permission_id").notNull().references(() => adminPermissions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// 직원 역할 할당 테이블
export const staffRoleAssignments = pgTable("staff_role_assignments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => adminRoles.id, { onDelete: "cascade" }),
  assignedBy: varchar("assigned_by").references(() => users.id),
  scopeType: text("scope_type"), // "team", "region", "requester_group"
  scopeValue: text("scope_value"), // 담당 범위 값
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// 감사 로그 테이블 (법적 방어/감사 필수)
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  // 행위자 정보
  actorRole: text("actor_role"), // ADMIN, HELPER, REQUESTER, SYSTEM
  userId: varchar("user_id").references(() => users.id),
  // 액션 정보
  action: text("action").notNull(), // ORDER_STATUS_CHANGED, DISPUTE_RESOLVED, SETTLEMENT_CONFIRMED, EVIDENCE_REQUESTED
  // 대상 정보
  targetType: text("target_type"), // order, incident, settlement, contract
  targetId: text("target_id"),
  orderId: integer("order_id"), // 오더 관련 로그용
  incidentId: integer("incident_id"), // 분쟁 관련 로그용
  settlementId: integer("settlement_id"), // 정산 관련 로그용
  // 변경 내역
  reason: text("reason"), // 변경 사유 (필수 권장)
  oldValue: text("old_value"), // JSON string (변경 전)
  newValue: text("new_value"), // JSON string (변경 후)
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 멱등성 키 테이블 (T-17: 중복 요청 방지)
export const idempotencyKeys = pgTable("idempotency_keys", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(), // UUID from client
  userId: varchar("user_id").notNull(),
  endpoint: text("endpoint").notNull(), // e.g., "/api/orders"
  requestHash: text("request_hash"), // 요청 payload 해시 (충돌 감지용)
  responseStatus: integer("response_status").notNull(),
  responseBody: text("response_body").notNull(), // JSON string
  status: text("status").default("COMPLETED"), // IN_PROGRESS, COMPLETED, FAILED
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // TTL: createdAt + 24시간
});

// 외부 연동 이벤트 로그 테이블 (T-22: 연동 실패 추적/재시도)
export const integrationEvents = pgTable("integration_events", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(), // 'sms', 'push', 'payment', 'identity'
  action: text("action").notNull(), // 'SEND_SMS', 'SEND_PUSH', 'PAYMENT_WEBHOOK', 'VERIFY_IDENTITY'
  payload: text("payload").notNull(), // JSON string (요청 내용)
  response: text("response"), // JSON string (응답 내용)
  status: text("status").notNull().default("PENDING"), // 'PENDING', 'SUCCESS', 'FAILED', 'RETRYING'
  retryCount: integer("retry_count").default(0),
  lastError: text("last_error"), // 마지막 에러 메시지
  nextRetryAt: timestamp("next_retry_at"), // 다음 재시도 시간
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Vehicle Type / Order Category Insert Schemas
export const insertVehicleTypeSettingSchema = createInsertSchema(vehicleTypeSettings)
  .omit({ id: true, createdAt: true });
export const insertOrderCategorySettingSchema = createInsertSchema(orderCategorySettings)
  .omit({ id: true, createdAt: true });

// Enterprise/Incentive/Tax Insert Schemas
export const insertEnterpriseAccountSchema = createInsertSchema(enterpriseAccounts)
  .omit({ id: true, createdAt: true });
export const insertEnterpriseOrderBatchSchema = createInsertSchema(enterpriseOrderBatches)
  .omit({ id: true, createdAt: true });
export const insertIncentivePolicySchema = createInsertSchema(incentivePolicies)
  .omit({ id: true, createdAt: true });
export const insertTeamIncentiveSchema = createInsertSchema(teamIncentives)
  .omit({ id: true, createdAt: true });
export const insertIncentiveDetailSchema = createInsertSchema(incentiveDetails)
  .omit({ id: true, createdAt: true });
export const insertTaxInvoiceSchema = createInsertSchema(taxInvoices)
  .omit({ id: true, createdAt: true });
export const insertPriceConversionRuleSchema = createInsertSchema(priceConversionRules)
  .omit({ id: true, createdAt: true });
export const insertDispatchRequestSchema = createInsertSchema(dispatchRequests)
  .omit({ id: true, createdAt: true });
export const insertUserSanctionSchema = createInsertSchema(userSanctions)
  .omit({ id: true, createdAt: true });
export const insertTeamQrCodeSchema = createInsertSchema(teamQrCodes)
  .omit({ id: true, createdAt: true });
export const insertQrScanLogSchema = createInsertSchema(qrScanLogs)
  .omit({ id: true });

// RBAC Insert Schemas
export const insertAdminRoleSchema = createInsertSchema(adminRoles)
  .omit({ id: true, createdAt: true });
export const insertAdminPermissionSchema = createInsertSchema(adminPermissions)
  .omit({ id: true, createdAt: true });
export const insertAdminRolePermissionSchema = createInsertSchema(adminRolePermissions)
  .omit({ id: true, createdAt: true });
export const insertStaffRoleAssignmentSchema = createInsertSchema(staffRoleAssignments)
  .omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs)
  .omit({ id: true, createdAt: true });

// Insert schemas for new tables

// 계약 실행 이벤트 스키마
export const insertContractExecutionEventSchema = createInsertSchema(contractExecutionEvents)
  .omit({ id: true, createdAt: true });

// 결제 스키마
export const insertPaymentSchema = createInsertSchema(payments)
  .omit({ id: true, createdAt: true, updatedAt: true });

// 결제 상태 변경 이벤트 스키마
export const insertPaymentStatusEventSchema = createInsertSchema(paymentStatusEvents)
  .omit({ id: true, createdAt: true });

// 계약서 문서 스키마
export const insertContractDocumentSchema = createInsertSchema(contractDocuments)
  .omit({ id: true, createdAt: true });

// 분쟁 처리 액션 스키마
export const insertIncidentActionSchema = createInsertSchema(incidentActions)
  .omit({ id: true, createdAt: true });

export const insertJobContractSchema = createInsertSchema(jobContracts)
  .omit({ id: true, createdAt: true });

export const insertWorkSessionSchema = createInsertSchema(workSessions)
  .omit({ id: true, createdAt: true });

export const insertWorkProofEventSchema = createInsertSchema(workProofEvents)
  .omit({ id: true, createdAt: true });

// 정산 상태 체계
const settlementStatuses = [
  "pending",     // 정산대기 (정산 생성됨)
  "confirmed",   // 헬퍼확인 (헬퍼가 정산 확인/서명)
  "paid",        // 지급완료 (실제 출금 완료)
  "disputed",    // 분쟁중 (분쟁 접수됨)
  "on_hold",     // 보류중 (분쟁/조사로 인한 보류)
  "cancelled"    // 취소됨 (정산 취소)
] as const;
export const settlementStatusesArray = settlementStatuses;

export const settlementStatusLabels: Record<string, string> = {
  pending: "정산대기",
  confirmed: "헬퍼확인",
  paid: "지급완료",
  disputed: "분쟁중",
  on_hold: "보류중",
  cancelled: "취소됨"
};

// 결제 상태 체계
const paymentStatuses = [
  "initiated",    // 결제요청 (가상계좌 발급 등)
  "authorized",   // 승인대기 (입금확인)
  "captured",     // 결제완료 (정상 완료)
  "canceled",     // 취소됨
  "refunded"      // 환불완료
] as const;
export const paymentStatusesArray = paymentStatuses;

export const paymentStatusLabels: Record<string, string> = {
  initiated: "결제요청",
  authorized: "승인대기",
  captured: "결제완료",
  canceled: "취소됨",
  refunded: "환불완료"
};

// 분쟁 상태 체계
const incidentStatuses = [
  "submitted",         // 접수됨
  "awaiting_evidence", // 증빙대기
  "under_review",      // 검토중
  "resolved",          // 해결됨
  "escalated",         // 에스컬레이션
  "closed"             // 종결
] as const;
export const incidentStatusesArray = incidentStatuses;

export const incidentStatusLabels: Record<string, string> = {
  submitted: "접수됨",
  awaiting_evidence: "증빙대기",
  under_review: "검토중",
  resolved: "해결됨",
  escalated: "에스컬레이션",
  closed: "종결"
};

// 팀 인센티브 상태 체계
const incentiveStatuses = [
  "pending",   // 산출완료
  "approved",  // 승인완료
  "paid"       // 지급완료
] as const;
export const incentiveStatusesArray = incentiveStatuses;

export const incentiveStatusLabels: Record<string, string> = {
  pending: "산출완료",
  approved: "승인완료",
  paid: "지급완료"
};

export const insertSettlementStatementSchema = createInsertSchema(settlementStatements)
  .omit({ id: true, createdAt: true });

export const insertSettlementLineItemSchema = createInsertSchema(settlementLineItems)
  .omit({ id: true, createdAt: true });

export const insertInstructionLogSchema = createInsertSchema(instructionLogs)
  .omit({ id: true, createdAt: true });

export const insertIncidentReportSchema = createInsertSchema(incidentReports)
  .omit({ id: true, createdAt: true });

export const insertIncidentEvidenceSchema = createInsertSchema(incidentEvidence)
  .omit({ id: true, createdAt: true });

export const insertSubstituteRequestSchema = createInsertSchema(substituteRequests)
  .omit({ id: true, createdAt: true });

// Type exports for new tables
export type ContractExecutionEvent = typeof contractExecutionEvents.$inferSelect;
export type InsertContractExecutionEvent = z.infer<typeof insertContractExecutionEventSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type PaymentStatusEvent = typeof paymentStatusEvents.$inferSelect;
export type InsertPaymentStatusEvent = z.infer<typeof insertPaymentStatusEventSchema>;
export type ContractDocument = typeof contractDocuments.$inferSelect;
export type InsertContractDocument = z.infer<typeof insertContractDocumentSchema>;
export type IncidentAction = typeof incidentActions.$inferSelect;
export type InsertIncidentAction = z.infer<typeof insertIncidentActionSchema>;
export type JobContract = typeof jobContracts.$inferSelect;
export type InsertJobContract = z.infer<typeof insertJobContractSchema>;
export type WorkSession = typeof workSessions.$inferSelect;
export type InsertWorkSession = z.infer<typeof insertWorkSessionSchema>;
export type WorkProofEvent = typeof workProofEvents.$inferSelect;
export type InsertWorkProofEvent = z.infer<typeof insertWorkProofEventSchema>;
export type SettlementStatement = typeof settlementStatements.$inferSelect;
export type InsertSettlementStatement = z.infer<typeof insertSettlementStatementSchema>;
export type SettlementLineItem = typeof settlementLineItems.$inferSelect;
export type InsertSettlementLineItem = z.infer<typeof insertSettlementLineItemSchema>;
export type InstructionLog = typeof instructionLogs.$inferSelect;
export type InsertInstructionLog = z.infer<typeof insertInstructionLogSchema>;
export type IncidentReport = typeof incidentReports.$inferSelect;
export type InsertIncidentReport = z.infer<typeof insertIncidentReportSchema>;
export type IncidentEvidence = typeof incidentEvidence.$inferSelect;
export type InsertIncidentEvidence = z.infer<typeof insertIncidentEvidenceSchema>;
export type SubstituteRequest = typeof substituteRequests.$inferSelect;
export type InsertSubstituteRequest = z.infer<typeof insertSubstituteRequestSchema>;

// RBAC Type exports
export type AdminRole = typeof adminRoles.$inferSelect;
export type InsertAdminRole = z.infer<typeof insertAdminRoleSchema>;
export type AdminPermission = typeof adminPermissions.$inferSelect;
export type InsertAdminPermission = z.infer<typeof insertAdminPermissionSchema>;
export type AdminRolePermission = typeof adminRolePermissions.$inferSelect;
export type InsertAdminRolePermission = z.infer<typeof insertAdminRolePermissionSchema>;
export type StaffRoleAssignment = typeof staffRoleAssignments.$inferSelect;
export type InsertStaffRoleAssignment = z.infer<typeof insertStaffRoleAssignmentSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// Vehicle Type / Order Category Type exports
export type VehicleTypeSetting = typeof vehicleTypeSettings.$inferSelect;
export type InsertVehicleTypeSetting = z.infer<typeof insertVehicleTypeSettingSchema>;
export type OrderCategorySetting = typeof orderCategorySettings.$inferSelect;
export type InsertOrderCategorySetting = z.infer<typeof insertOrderCategorySettingSchema>;

// Enterprise/Incentive/Tax Type exports
export type EnterpriseAccount = typeof enterpriseAccounts.$inferSelect;
export type InsertEnterpriseAccount = z.infer<typeof insertEnterpriseAccountSchema>;
export type EnterpriseOrderBatch = typeof enterpriseOrderBatches.$inferSelect;
export type InsertEnterpriseOrderBatch = z.infer<typeof insertEnterpriseOrderBatchSchema>;
export type IncentivePolicy = typeof incentivePolicies.$inferSelect;
export type InsertIncentivePolicy = z.infer<typeof insertIncentivePolicySchema>;
export type TeamIncentive = typeof teamIncentives.$inferSelect;
export type InsertTeamIncentive = z.infer<typeof insertTeamIncentiveSchema>;
export type IncentiveDetail = typeof incentiveDetails.$inferSelect;
export type InsertIncentiveDetail = z.infer<typeof insertIncentiveDetailSchema>;
export type TaxInvoice = typeof taxInvoices.$inferSelect;
export type InsertTaxInvoice = z.infer<typeof insertTaxInvoiceSchema>;
export type PriceConversionRule = typeof priceConversionRules.$inferSelect;
export type InsertPriceConversionRule = z.infer<typeof insertPriceConversionRuleSchema>;
export type DispatchRequest = typeof dispatchRequests.$inferSelect;
export type InsertDispatchRequest = z.infer<typeof insertDispatchRequestSchema>;
export type UserSanction = typeof userSanctions.$inferSelect;
export type InsertUserSanction = z.infer<typeof insertUserSanctionSchema>;
export type TeamQrCode = typeof teamQrCodes.$inferSelect;
export type InsertTeamQrCode = z.infer<typeof insertTeamQrCodeSchema>;
export type QrScanLog = typeof qrScanLogs.$inferSelect;
export type InsertQrScanLog = z.infer<typeof insertQrScanLogSchema>;

// Type exports
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type WorkConfirmation = typeof workConfirmations.$inferSelect;
export type InsertWorkConfirmation = z.infer<typeof insertWorkConfirmationSchema>;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type HelperCredential = typeof helperCredentials.$inferSelect;
export type InsertHelperCredential = z.infer<typeof insertHelperCredentialSchema>;
export type HelperVehicle = typeof helperVehicles.$inferSelect;
export type InsertHelperVehicle = z.infer<typeof insertHelperVehicleSchema>;
export type HelperBusiness = typeof helperBusinesses.$inferSelect;
export type InsertHelperBusiness = z.infer<typeof insertHelperBusinessSchema>;
export type RequesterBusiness = typeof requesterBusinesses.$inferSelect;
export type InsertRequesterBusiness = z.infer<typeof insertRequesterBusinessSchema>;
export type RequesterRefundAccount = typeof requesterRefundAccounts.$inferSelect;
export type InsertRequesterRefundAccount = z.infer<typeof insertRequesterRefundAccountSchema>;
export type HelperBankAccount = typeof helperBankAccounts.$inferSelect;
export type InsertHelperBankAccount = z.infer<typeof insertHelperBankAccountSchema>;
export type HelperLicense = typeof helperLicenses.$inferSelect;
export type HelperServiceArea = typeof helperServiceAreas.$inferSelect;
export type InsertHelperServiceArea = z.infer<typeof insertHelperServiceAreaSchema>;
export type InsertHelperLicense = z.infer<typeof insertHelperLicenseSchema>;
export type HelperTermsAgreement = typeof helperTermsAgreements.$inferSelect;
export type InsertHelperTermsAgreement = z.infer<typeof insertHelperTermsAgreementSchema>;
export type RequesterServiceAgreement = typeof requesterServiceAgreements.$inferSelect;
export type InsertRequesterServiceAgreement = z.infer<typeof insertRequesterServiceAgreementSchema>;
export type HelpPost = typeof helpPosts.$inferSelect;
export type InsertHelpPost = z.infer<typeof insertHelpPostSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderApplication = typeof orderApplications.$inferSelect;
export type InsertOrderApplication = z.infer<typeof insertOrderApplicationSchema>;
export type CourierSetting = typeof courierSettings.$inferSelect;
export type InsertCourierSetting = z.infer<typeof insertCourierSettingSchema>;
export type CourierTieredPricing = typeof courierTieredPricing.$inferSelect;
export type InsertCourierTieredPricing = z.infer<typeof insertCourierTieredPricingSchema>;
export type PaymentReminder = typeof paymentReminders.$inferSelect;
export type InsertPaymentReminder = z.infer<typeof insertPaymentReminderSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type AnnouncementRecipient = typeof announcementRecipients.$inferSelect;
export type InsertAnnouncementRecipient = z.infer<typeof insertAnnouncementRecipientSchema>;
export type JobPosting = typeof jobPostings.$inferSelect;
export type InsertJobPosting = {
  companyName: string;
  workDays: string;
  vehicleType: string;
  fuelCost: string;
  commission: string;
  contact: string;
  workDetails: string;
  note?: string | null;
  recruitCount?: number;
  workStartTime?: string | null;
  workEndTime?: string | null;
  status?: string;
};

// Push subscriptions table for web push notifications
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  platform: text("platform").notNull().default("web"), // 'web', 'expo', 'fcm'
  expoPushToken: text("expo_push_token"), // ExponentPushToken[xxx] 형식
  fcmToken: text("fcm_token"), // Firebase Cloud Messaging 토큰
  webEndpoint: text("web_endpoint"), // Web Push endpoint
  webP256dh: text("web_p256dh"), // Web Push p256dh key
  webAuth: text("web_auth"), // Web Push auth key
  endpoint: text("endpoint").default(""), // 레거시 호환
  p256dh: text("p256dh").default(""), // 레거시 호환
  auth: text("auth").default(""), // 레거시 호환
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true });
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;

// FCM tokens table for native mobile push notifications
export const fcmTokens = pgTable("fcm_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  platform: varchar("platform", { length: 50 }).default("native"),
  deviceInfo: text("device_info"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFcmTokenSchema = createInsertSchema(fcmTokens).omit({ id: true, createdAt: true, updatedAt: true });
export type FcmToken = typeof fcmTokens.$inferSelect;
export type InsertFcmToken = z.infer<typeof insertFcmTokenSchema>;

// Customer Service Inquiries table (고객센터 문의)
export const customerServiceInquiries = pgTable("customer_service_inquiries", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  userRole: text("user_role").notNull(), // helper, requester
  category: text("category").notNull(), // 문의유형: order, payment, settlement, technical, other
  title: text("title").notNull(),
  content: text("content").notNull(),
  attachmentUrls: text("attachment_urls").array(), // 첨부파일
  status: text("status").default("pending"), // pending, in_progress, resolved, closed
  priority: text("priority").default("normal"), // low, normal, high, urgent
  assignedTo: varchar("assigned_to").references(() => users.id), // 담당 관리자
  adminNote: text("admin_note"), // 관리자 메모
  response: text("response"), // 답변 내용
  respondedAt: timestamp("responded_at"),
  respondedBy: varchar("responded_by").references(() => users.id),
  orderId: integer("order_id"), // 관련 오더 ID (있는 경우)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCustomerServiceInquirySchema = createInsertSchema(customerServiceInquiries).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  respondedAt: true,
  respondedBy: true,
  assignedTo: true,
  adminNote: true,
  response: true
});

export const updateCustomerServiceInquirySchema = z.object({
  status: z.enum(["pending", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedTo: z.string().optional().nullable(),
  adminNote: z.string().optional().nullable(),
  response: z.string().optional().nullable(),
});

export type CustomerServiceInquiry = typeof customerServiceInquiries.$inferSelect;
export type InsertCustomerServiceInquiry = z.infer<typeof insertCustomerServiceInquirySchema>;
export type UpdateCustomerServiceInquiry = z.infer<typeof updateCustomerServiceInquirySchema>;

// API Request/Response types
export type LoginRequest = { email: string; password: string };
export type SignupRequest = { 
  email: string; 
  password: string; 
  name: string;
  address?: string;
  birthDate?: string;
  phoneNumber?: string;
  role: "helper" | "requester";
};
export type HelperCredentialRequest = InsertHelperCredential;
export type HelpPostRequest = InsertHelpPost;
export type AuthResponse = { user: User; token: string };
export type CheckInRecord = typeof checkInRecords.$inferSelect;
export type InsertCheckInRecord = z.infer<typeof insertCheckInRecordSchema>;

// ===== Native App Management Tables (가이드라인 기반) =====

// User devices table (디바이스/토큰 관리)
export const userDevices = pgTable("user_devices", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: varchar("platform", { length: 20 }).notNull(), // android, ios
  deviceId: varchar("device_id", { length: 128 }).notNull(),
  model: varchar("model", { length: 128 }),
  osVersion: varchar("os_version", { length: 64 }),
  appVersion: varchar("app_version", { length: 64 }),
  pushToken: text("push_token"),
  pushTokenUpdatedAt: timestamp("push_token_updated_at"),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserDeviceSchema = createInsertSchema(userDevices).omit({ id: true, createdAt: true, updatedAt: true });
export type UserDevice = typeof userDevices.$inferSelect;
export type InsertUserDevice = z.infer<typeof insertUserDeviceSchema>;

// User permissions table (권한 상태 - CS 대응용)
export const userPermissions = pgTable("user_permissions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  deviceId: varchar("device_id", { length: 128 }).notNull(),
  cameraStatus: varchar("camera_status", { length: 32 }).notNull().default("unknown"), // granted, denied, prompt, unknown
  locationStatus: varchar("location_status", { length: 32 }).notNull().default("unknown"),
  notificationStatus: varchar("notification_status", { length: 32 }).notNull().default("unknown"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserPermissionSchema = createInsertSchema(userPermissions).omit({ id: true, updatedAt: true });
export type UserPermission = typeof userPermissions.$inferSelect;
export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;

// Push messages table (푸시 발송 기록)
export const pushMessages = pgTable("push_messages", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  payload: text("payload"), // JSON string
  targetType: varchar("target_type", { length: 32 }).notNull(), // broadcast, user, group
  targetId: varchar("target_id"), // userId or groupId
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPushMessageSchema = createInsertSchema(pushMessages).omit({ id: true, createdAt: true });
export type PushMessage = typeof pushMessages.$inferSelect;
export type InsertPushMessage = z.infer<typeof insertPushMessageSchema>;

// Push deliveries table (푸시 발송 상태)
export const pushDeliveries = pgTable("push_deliveries", {
  id: serial("id").primaryKey(),
  pushId: integer("push_id")
    .notNull()
    .references(() => pushMessages.id, { onDelete: "cascade" }),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  deviceId: varchar("device_id", { length: 128 }).notNull(),
  pushToken: text("push_token").notNull(),
  status: varchar("status", { length: 32 }).notNull(), // sent, failed, invalid_token
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow(),
});

export const insertPushDeliverySchema = createInsertSchema(pushDeliveries).omit({ id: true, sentAt: true });
export type PushDelivery = typeof pushDeliveries.$inferSelect;
export type InsertPushDelivery = z.infer<typeof insertPushDeliverySchema>;

// Push events table (푸시 수신/클릭 로그)
export const pushEvents = pgTable("push_events", {
  id: serial("id").primaryKey(),
  pushId: integer("push_id")
    .notNull()
    .references(() => pushMessages.id, { onDelete: "cascade" }),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  deviceId: varchar("device_id", { length: 128 }).notNull(),
  eventType: varchar("event_type", { length: 32 }).notNull(), // received, opened
  eventAt: timestamp("event_at").defaultNow(),
  meta: text("meta"), // JSON string
});

export const insertPushEventSchema = createInsertSchema(pushEvents).omit({ id: true, eventAt: true });
export type PushEvent = typeof pushEvents.$inferSelect;
export type InsertPushEvent = z.infer<typeof insertPushEventSchema>;

// User location latest table (최신 위치)
export const userLocationLatest = pgTable("user_location_latest", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  latitude: text("latitude"),
  longitude: text("longitude"),
  accuracy: text("accuracy"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserLocationLatestSchema = createInsertSchema(userLocationLatest).omit({ updatedAt: true });
export type UserLocationLatest = typeof userLocationLatest.$inferSelect;
export type InsertUserLocationLatest = z.infer<typeof insertUserLocationLatestSchema>;

// User location logs table (위치 로그)
export const userLocationLogs = pgTable("user_location_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  accuracy: text("accuracy"),
  capturedAt: timestamp("captured_at").defaultNow(),
  source: varchar("source", { length: 32 }).notNull(), // foreground, background
});

export const insertUserLocationLogSchema = createInsertSchema(userLocationLogs).omit({ id: true, capturedAt: true });
export type UserLocationLog = typeof userLocationLogs.$inferSelect;
export type InsertUserLocationLog = z.infer<typeof insertUserLocationLogSchema>;

// ============================================
// 분쟁/이의제기 (Disputes)
// ============================================

export const disputes = pgTable("disputes", {
  id: serial("id").primaryKey(),
  helperId: varchar("helper_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  submitterRole: text("submitter_role").default("helper"), // helper, requester
  courierName: text("courier_name"), // 운송사 (택배사명)
  invoiceNumber: text("invoice_number"), // 송장번호
  evidencePhotoUrl: text("evidence_photo_url"), // 증빙사진 URL
  settlementId: integer("settlement_id")
    .references(() => settlementStatements.id, { onDelete: "set null" }),
  orderId: integer("order_id")
    .references(() => orders.id, { onDelete: "set null" }),
  workDate: text("work_date").notNull(),
  disputeType: text("dispute_type").notNull(), // count_mismatch, amount_error, delivery_issue, other
  description: text("description").notNull(),
  requestedDeliveryCount: integer("requested_delivery_count"),
  requestedReturnCount: integer("requested_return_count"),
  requestedPickupCount: integer("requested_pickup_count"),
  requestedOtherCount: integer("requested_other_count"),
  status: text("status").default("pending"), // pending, reviewing, resolved, rejected
  resolution: text("resolution"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  adminReply: text("admin_reply"),
  adminReplyAt: timestamp("admin_reply_at"),
  adminReplyBy: varchar("admin_reply_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDisputeSchema = createInsertSchema(disputes).omit({ id: true, createdAt: true, resolvedAt: true });
export type Dispute = typeof disputes.$inferSelect;
export type InsertDispute = z.infer<typeof insertDisputeSchema>;

// ============================================
// 인증 감사 로그 (Auth Audit Logs)
// ============================================

export const authAuditLogs = pgTable("auth_audit_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  provider: varchar("provider", { length: 30 }),
  status: varchar("status", { length: 20 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  requestId: varchar("request_id", { length: 36 }),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuthAuditLogSchema = createInsertSchema(authAuditLogs).omit({ id: true, createdAt: true });
export type AuthAuditLog = typeof authAuditLogs.$inferSelect;
export type InsertAuthAuditLog = z.infer<typeof insertAuthAuditLogSchema>;

// Refresh Tokens table (토큰 갱신)
// ============================================
export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  deviceInfo: text("device_info"),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRefreshTokenSchema = createInsertSchema(refreshTokens).omit({ id: true, createdAt: true });
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = z.infer<typeof insertRefreshTokenSchema>;

// ============================================
// 착지별/시간대별 단가 설정 (Destination Pricing)
// ============================================

// 착지(목적지) 지역 정의
export const destinationRegions = ["수도권", "충청", "영남", "호남", "강원", "제주"] as const;
export type DestinationRegion = typeof destinationRegions[number];

// 시간대 정의
export const timeSlots = ["주간", "야간"] as const;
export type TimeSlot = typeof timeSlots[number];

// 업무 카테고리 정의
export const workCategories = ["택배사", "기타택배", "냉잡전용"] as const;
export type WorkCategory = typeof workCategories[number];

// 착지별/시간대별 단가 설정 테이블
export const destinationPricing = pgTable("destination_pricing", {
  id: serial("id").primaryKey(),
  workCategory: text("work_category").notNull(), // 택배사, 기타택배
  courierId: integer("courier_id").references(() => courierSettings.id, { onDelete: "cascade" }), // 택배사인 경우
  destinationRegion: text("destination_region").notNull(), // 수도권, 충청, 영남, 호남, 강원, 제주
  timeSlot: text("time_slot").notNull(), // 주간, 야간
  pricePerBox: integer("price_per_box").notNull().default(0), // 박스당 단가
  minimumFee: integer("minimum_fee").default(0), // 최저가
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDestinationPricingSchema = createInsertSchema(destinationPricing)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    workCategory: z.enum(["택배사", "기타택배"]),
    courierId: z.number().nullable().optional(),
    destinationRegion: z.enum(destinationRegions),
    timeSlot: z.enum(timeSlots),
    pricePerBox: z.number().min(0, "박스당 단가는 0 이상이어야 합니다"),
    minimumFee: z.number().min(0, "최저가는 0 이상이어야 합니다").optional(),
    isActive: z.boolean().default(true),
  });

export type DestinationPricing = typeof destinationPricing.$inferSelect;
export type InsertDestinationPricing = z.infer<typeof insertDestinationPricingSchema>;

// ============================================
// 냉잡전용 최저가 설정 (Cold Chain Settings)
// ============================================

export const coldChainSettings = pgTable("cold_chain_settings", {
  id: serial("id").primaryKey(),
  settingName: text("setting_name").notNull(), // 설정명 (예: 기본 최저가)
  minimumFee: integer("minimum_fee").notNull().default(0), // 최저가
  description: text("description"), // 설명
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertColdChainSettingSchema = createInsertSchema(coldChainSettings)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    settingName: z.string().min(1, "설정명을 입력해주세요"),
    minimumFee: z.number().min(0, "최저가는 0 이상이어야 합니다"),
    description: z.string().nullable().optional(),
    isActive: z.boolean().default(true),
  });

export type ColdChainSetting = typeof coldChainSettings.$inferSelect;
export type InsertColdChainSetting = z.infer<typeof insertColdChainSettingSchema>;

// ============================================
// 가상계좌 (Virtual Accounts)
// ============================================

export const virtualAccounts = pgTable("virtual_accounts", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  paymentId: text("payment_id").notNull(), // PortOne 결제 ID
  bankCode: text("bank_code").notNull(), // 은행 코드
  bankName: text("bank_name").notNull(), // 은행명
  accountNumber: text("account_number").notNull(), // 가상계좌번호
  accountHolder: text("account_holder").notNull(), // 예금주명 (보통 PG사명)
  amount: integer("amount").notNull(), // 입금 금액
  dueDate: timestamp("due_date"), // 입금 기한
  status: text("status").default("pending"), // pending, paid, expired, cancelled
  paidAt: timestamp("paid_at"), // 입금 확인 시간
  paidAmount: integer("paid_amount"), // 실제 입금 금액
  webhookReceivedAt: timestamp("webhook_received_at"), // 웹훅 수신 시간
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVirtualAccountSchema = createInsertSchema(virtualAccounts).omit({ 
  id: true, 
  createdAt: true 
});
export type VirtualAccount = typeof virtualAccounts.$inferSelect;
export type InsertVirtualAccount = z.infer<typeof insertVirtualAccountSchema>;

// ============================================
// 휴대폰 인증 코드 (Phone Verification Codes)
// ============================================

export const phoneVerificationCodes = pgTable("phone_verification_codes", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  code: text("code").notNull(), // 6자리 인증코드
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // 로그인한 사용자인 경우
  purpose: text("purpose").default("phone_verify"), // phone_verify, password_reset, signup
  isUsed: boolean("is_used").default(false),
  expiresAt: timestamp("expires_at").notNull(), // 만료시간 (보통 3분)
  attempts: integer("attempts").default(0), // 시도 횟수 (최대 5회)
  ipAddress: text("ip_address"), // 요청 IP (레이트 리밋용)
  trackingNumber: text("tracking_number"), // 운송장번호
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPhoneVerificationCodeSchema = createInsertSchema(phoneVerificationCodes).omit({ 
  id: true, 
  createdAt: true 
});
export type PhoneVerificationCode = typeof phoneVerificationCodes.$inferSelect;
export type InsertPhoneVerificationCode = z.infer<typeof insertPhoneVerificationCodeSchema>;

// ============================================
// 클라이언트 에러 로그 (Client Error Logs)
// ============================================

export const clientErrors = pgTable("client_errors", {
  id: serial("id").primaryKey(),
  severity: text("severity").notNull(), // critical, error, warning, info
  message: text("message").notNull(),
  stack: text("stack"),
  context: text("context"), // JSON string with page, component, etc.
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  userAgent: text("user_agent"),
  url: text("url"),
  ipAddress: text("ip_address"),
  isResolved: boolean("is_resolved").default(false),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientErrorSchema = createInsertSchema(clientErrors).omit({ 
  id: true, 
  createdAt: true,
  resolvedAt: true
});
export type ClientError = typeof clientErrors.$inferSelect;
export type InsertClientError = z.infer<typeof insertClientErrorSchema>;

// ============================================
// 약관/정책 동의 버전 관리 (Policy Consents) - T-40
// ============================================

export const policyConsents = pgTable("policy_consents", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  policyType: text("policy_type").notNull(), // terms_of_service, privacy_policy, location_policy, etc.
  policyVersion: text("policy_version").notNull(), // 버전 (예: "1.0.0", "2024-01-01")
  agreedAt: timestamp("agreed_at").defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  consentMethod: text("consent_method").default("click"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPolicyConsentSchema = createInsertSchema(policyConsents).omit({ 
  id: true, 
  createdAt: true,
  agreedAt: true
});
export type PolicyConsent = typeof policyConsents.$inferSelect;
export type InsertPolicyConsent = z.infer<typeof insertPolicyConsentSchema>;

// 정책 버전 정보 (관리자가 관리)
export const policyVersions = pgTable("policy_versions", {
  id: serial("id").primaryKey(),
  policyType: text("policy_type").notNull(), // terms_of_service, privacy_policy, etc.
  version: text("version").notNull(), // 버전 (예: "1.0.0")
  title: text("title").notNull(), // 정책 제목
  content: text("content").notNull(), // 정책 내용 전문
  effectiveDate: timestamp("effective_date").notNull(), // 시행일
  isActive: boolean("is_active").default(true), // 현재 활성 버전 여부
  requiresReagreement: boolean("requires_reagreement").default(false), // 재동의 필요 여부
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPolicyVersionSchema = createInsertSchema(policyVersions).omit({ 
  id: true, 
  createdAt: true
});
export type PolicyVersion = typeof policyVersions.$inferSelect;
export type InsertPolicyVersion = z.infer<typeof insertPolicyVersionSchema>;

// ==================== 운영 핵심 기능 테이블 ====================

// 정산 감사 로그 (Settlement Audit Logs)
// 정산 금액 변경, 상태 변경, 락 처리 등 모든 변경 기록
export const settlementAuditLogs = pgTable("settlement_audit_logs", {
  id: serial("id").primaryKey(),
  settlementId: integer("settlement_id")
    .notNull()
    .references(() => settlementStatements.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(), // created, amount_changed, status_changed, locked, unlocked, hold_started, hold_released, approved, paid
  previousValue: text("previous_value"), // JSON: 변경 전 값
  newValue: text("new_value"), // JSON: 변경 후 값
  changedFields: text("changed_fields"), // JSON: 변경된 필드 목록
  reason: text("reason"), // 변경 사유
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  actorRole: text("actor_role"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 정산 지급 시도 로그 (Settlement Payout Attempts)
// 지급 성공/실패 기록, 재시도 관리
export const settlementPayoutAttempts = pgTable("settlement_payout_attempts", {
  id: serial("id").primaryKey(),
  settlementId: integer("settlement_id")
    .notNull()
    .references(() => settlementStatements.id, { onDelete: "cascade" }),
  attemptNumber: integer("attempt_number").default(1), // 시도 횟수
  amount: integer("amount").notNull(), // 지급 시도 금액
  bankName: text("bank_name"), // 은행명
  accountNumber: text("account_number"), // 계좌번호 (마스킹)
  accountHolder: text("account_holder"), // 예금주
  status: text("status").default("pending"), // pending, processing, success, failed, cancelled
  failureReason: text("failure_reason"), // 실패 사유 (계좌오류, 잔액부족 등)
  failureCode: text("failure_code"), // 은행 에러 코드
  transactionId: text("transaction_id"), // 은행 거래 ID
  processedAt: timestamp("processed_at"), // 처리 시점
  processedBy: varchar("processed_by").references(() => users.id, { onDelete: "set null" }),
  retryScheduledAt: timestamp("retry_scheduled_at"), // 재시도 예정 시간
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 지역별 운임 규칙 (Region Pricing Rules)
// 택배사별, 지역별 차등 운임 설정
export const regionPricingRules = pgTable("region_pricing_rules", {
  id: serial("id").primaryKey(),
  courierId: integer("courier_id")
    .references(() => courierSettings.id, { onDelete: "cascade" }),
  regionCode: text("region_code").notNull(), // 시도 코드 (예: SEOUL, GYEONGGI)
  regionName: text("region_name").notNull(), // 시도명 (예: 서울특별시, 경기도)
  districtCode: text("district_code"), // 구/시/군 코드 (null = 시도 전체)
  districtName: text("district_name"), // 구/시/군명
  priceAdjustmentType: text("price_adjustment_type").default("fixed"), // fixed(고정금액), percent(%)
  priceAdjustmentValue: integer("price_adjustment_value").default(0), // 조정 금액/비율
  minDeliveryFee: integer("min_delivery_fee"), // 해당 지역 최저운송료
  distanceRate: integer("distance_rate"), // 거리당 추가 요금 (원/km)
  isRemoteArea: boolean("is_remote_area").default(false), // 도서산간 여부
  remoteAreaSurcharge: integer("remote_area_surcharge").default(0), // 도서산간 추가요금
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0), // 우선순위 (높을수록 먼저 적용)
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveTo: timestamp("effective_to"), // null = 무기한
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// VAT 설정 (VAT Settings)
// 택배사별, 거래유형별 VAT 설정
export const vatSettings = pgTable("vat_settings", {
  id: serial("id").primaryKey(),
  courierId: integer("courier_id")
    .references(() => courierSettings.id, { onDelete: "cascade" }), // null = 전체 택배사 기본값
  transactionType: text("transaction_type").notNull(), // order_fee(오더비), settlement(정산), platform_fee(수수료)
  vatIncluded: boolean("vat_included").default(true), // VAT 포함 여부
  vatRate: integer("vat_rate").default(10), // VAT 비율 (%, 기본 10%)
  description: text("description"),
  isActive: boolean("is_active").default(true),
  effectiveFrom: timestamp("effective_from").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 최소 수입 보장 규칙 (Minimum Guarantee Rules)
// 기사 1일 최소 보장 금액 설정
export const minimumGuaranteeRules = pgTable("minimum_guarantee_rules", {
  id: serial("id").primaryKey(),
  courierId: integer("courier_id")
    .references(() => courierSettings.id, { onDelete: "cascade" }), // null = 전체 택배사 기본값
  vehicleType: text("vehicle_type"), // 차종 (null = 전체 차종)
  guaranteeType: text("guarantee_type").default("daily"), // daily(일), weekly(주), monthly(월)
  minGuaranteeAmount: integer("min_guarantee_amount").notNull(), // 최소 보장 금액
  calculationBase: text("calculation_base").default("net_amount"), // gross_amount, net_amount
  supplementMethod: text("supplement_method").default("auto"), // auto(자동보전), manual(수동보전)
  conditions: text("conditions"), // JSON: 적용 조건 (최소 근무일수, 출근률 등)
  isActive: boolean("is_active").default(true),
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveTo: timestamp("effective_to"), // null = 무기한
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 최소 수입 보장 적용 기록 (Minimum Guarantee Applications)
// 실제 보전 금액 기록
export const minimumGuaranteeApplications = pgTable("minimum_guarantee_applications", {
  id: serial("id").primaryKey(),
  helperId: varchar("helper_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ruleId: integer("rule_id")
    .notNull()
    .references(() => minimumGuaranteeRules.id, { onDelete: "cascade" }),
  periodStart: text("period_start").notNull(), // 적용 기간 시작 (YYYY-MM-DD)
  periodEnd: text("period_end").notNull(), // 적용 기간 종료
  actualEarnings: integer("actual_earnings").notNull(), // 실제 수입
  guaranteeAmount: integer("guarantee_amount").notNull(), // 보장 금액
  supplementAmount: integer("supplement_amount").notNull(), // 보전 금액 (guarantee - actual, 0 이상)
  workDays: integer("work_days").default(0), // 근무 일수
  completedOrders: integer("completed_orders").default(0), // 완료 오더 수
  status: text("status").default("calculated"), // calculated, approved, paid, cancelled
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  settlementId: integer("settlement_id").references(() => settlementStatements.id), // 연결된 정산 ID
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 오더 상태 강제 변경 로그 (Order Force Status Logs)
// 관리자에 의한 오더 상태 강제 변경 기록
export const orderForceStatusLogs = pgTable("order_force_status_logs", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  previousStatus: text("previous_status").notNull(),
  newStatus: text("new_status").notNull(),
  reason: text("reason").notNull(), // 변경 사유 (기사이탈, 사고발생, 비정상종료 등)
  actorId: varchar("actor_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  actorRole: text("actor_role"), // admin, superadmin, hq_staff
  forceOverrideUsed: boolean("force_override_used").default(false), // 상태 머신 우회 여부
  relatedIncidentId: integer("related_incident_id"), // 연관 사고/분쟁 ID
  affectedHelperId: varchar("affected_helper_id").references(() => users.id), // 영향받는 헬퍼
  affectedSettlementIds: text("affected_settlement_ids"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 수동 배차 기록 (Manual Dispatch Logs)
// 관리자에 의한 수동 헬퍼 배정 기록
export const manualDispatchLogs = pgTable("manual_dispatch_logs", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  helperId: varchar("helper_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  dispatchType: text("dispatch_type").notNull(), // emergency(긴급), replacement(대체), manual(수동)
  reason: text("reason").notNull(), // 배정 사유
  previousHelperId: varchar("previous_helper_id").references(() => users.id), // 이전 헬퍼 (대체 배차 시)
  actorId: varchar("actor_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  actorRole: text("actor_role"), // admin, superadmin, hq_staff
  helperConfirmed: boolean("helper_confirmed").default(false), // 헬퍼 수락 여부
  helperConfirmedAt: timestamp("helper_confirmed_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 증빙 사진 업로드 실패 큐 (Proof Upload Failure Queue)
// 업로드 실패한 증빙 사진 재시도 관리
export const proofUploadFailures = pgTable("proof_upload_failures", {
  id: serial("id").primaryKey(),
  helperId: varchar("helper_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  orderId: integer("order_id")
    .references(() => orders.id, { onDelete: "cascade" }),
  sessionId: integer("session_id")
    .references(() => workSessions.id, { onDelete: "cascade" }),
  proofType: text("proof_type").notNull(), // delivery, pickup, return, incident
  localFilePath: text("local_file_path"), // 클라이언트 로컬 경로 (참조용)
  failureReason: text("failure_reason"), // network_error, timeout, server_error
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  lastRetryAt: timestamp("last_retry_at"),
  nextRetryAt: timestamp("next_retry_at"),
  status: text("status").default("pending"), // pending, retrying, uploaded, failed_permanently
  uploadedProofId: integer("uploaded_proof_id"), // 성공 시 workProofEvents ID
  metadata: text("metadata"), // JSON: 원본 위치정보, 시간 등
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// Wave 1: 추가 운영 테이블 (T-01, T-07, T-08)
// ============================================

// 택배사 최저운임 설정 (Carrier Minimum Rates) - T-01
// 택배사/지역/차종별 최저단가 설정
export const carrierMinRates = pgTable("carrier_min_rates", {
  id: serial("id").primaryKey(),
  courierId: integer("courier_id")
    .notNull()
    .references(() => courierSettings.id, { onDelete: "cascade" }),
  vehicleType: text("vehicle_type").notNull(), // 1톤하이탑, 1톤정탑, 1톤저탑, 1톤냉탑, 쓰리밴
  region: text("region"), // 시/도 (null = 전국)
  district: text("district"), // 구/시/군 (null = 해당 시/도 전체)
  minRate: integer("min_rate").notNull(), // 최저단가 (100원 단위)
  effectiveFrom: timestamp("effective_from").notNull(), // 적용 시작일
  effectiveTo: timestamp("effective_to"), // 적용 종료일 (null = 무기한)
  roundingRule: text("rounding_rule").default("round_up_100"), // round_up_100, round_down_100, round_nearest_100
  vatIncluded: boolean("vat_included").default(false), // VAT 포함 여부
  notes: text("notes"), // 비고
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 표준 운임표 (Pricing Tables)
// 규격/거리/구간별 표준 단가
export const pricingTables = pgTable("pricing_tables", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // 운임표 이름
  courierId: integer("courier_id").references(() => courierSettings.id), // null = 공통
  vehicleType: text("vehicle_type"), // null = 전체 차종
  effectiveFrom: timestamp("effective_from").notNull(),
  effectiveTo: timestamp("effective_to"),
  vatIncluded: boolean("vat_included").default(false),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 운임표 행 (Pricing Table Rows)
export const pricingTableRows = pgTable("pricing_table_rows", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id")
    .notNull()
    .references(() => pricingTables.id, { onDelete: "cascade" }),
  distanceFrom: integer("distance_from"), // 거리 시작 (km), null = 기본요금
  distanceTo: integer("distance_to"), // 거리 종료 (km)
  weightFrom: integer("weight_from"), // 중량 시작 (kg)
  weightTo: integer("weight_to"), // 중량 종료 (kg)
  sizeCategory: text("size_category"), // small, medium, large, extra_large
  baseRate: integer("base_rate").notNull(), // 기본 요금
  perKmRate: integer("per_km_rate"), // km당 추가 요금
  surcharge: integer("surcharge").default(0), // 할증료
  surchargeReason: text("surcharge_reason"), // 할증 사유
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// 본인인증 결과/이력 (Identity Verifications) - T-07
// 본인인증(PortOne/KG) 결과 및 이력 관리
export const identityVerifications = pgTable("identity_verifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // portone, kg_inicis, pass, kakao
  verificationId: text("verification_id"), // 외부 서비스 인증 ID
  status: text("status").notNull().default("pending"), // pending, verified, failed, expired
  verifiedName: text("verified_name"), // 인증된 실명
  verifiedPhone: text("verified_phone"), // 인증된 전화번호
  verifiedBirthDate: text("verified_birth_date"), // 인증된 생년월일
  verifiedGender: text("verified_gender"), // M, F
  ci: text("ci"), // 연계정보 (CI)
  di: text("di"), // 중복가입정보 (DI)
  failureReason: text("failure_reason"), // 실패 사유
  failureCode: text("failure_code"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at"),
  rawResponse: text("raw_response"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 서류 검토 작업 (Document Review Tasks) - T-07
// 서류 승인/반려 워크플로우 관리
export const documentReviewTasks = pgTable("document_review_tasks", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(), // license, vehicle, business, bank_account, id_photo, cargo_license
  documentId: integer("document_id"), // 관련 테이블 ID (helper_licenses.id, helper_vehicles.id 등)
  documentUrl: text("document_url"), // 파일 URL
  status: text("status").notNull().default("pending"), // pending, in_review, approved, rejected, revision_requested
  priority: text("priority").default("normal"), // low, normal, high, urgent
  assignedTo: varchar("assigned_to").references(() => users.id), // 담당자
  assignedAt: timestamp("assigned_at"),
  reviewedBy: varchar("reviewed_by").references(() => users.id), // 검토자
  reviewedAt: timestamp("reviewed_at"),
  rejectReason: text("reject_reason"), // 반려 사유
  rejectCategory: text("reject_category"), // unclear, invalid, expired, mismatch, other
  revisionNote: text("revision_note"), // 수정 요청 메모
  dueDate: timestamp("due_date"), // 처리 기한
  slaBreached: boolean("sla_breached").default(false), // SLA 위반 여부
  metadata: text("metadata"), // JSON: 추가 정보
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 오더 상태 변경 이벤트 (Order Status Events)
// 오더 상태 변경 타임라인 기록
export const orderStatusEvents = pgTable("order_status_events", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  triggeredBy: varchar("triggered_by").references(() => users.id), // 상태 변경 주체
  triggerType: text("trigger_type").notNull(), // user, system, admin, webhook
  reason: text("reason"), // 변경 사유
  metadata: text("metadata"), // JSON: 추가 정보
  ipAddress: text("ip_address"),
  trackingNumber: text("tracking_number"), // 운송장번호
  createdAt: timestamp("created_at").defaultNow(),
});

// CS 문의 (Customer Inquiries) - 고객 문의/티켓
export const customerInquiries = pgTable("customer_inquiries", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  userName: text("user_name"),
  userEmail: text("user_email"),
  userPhone: text("user_phone"),
  category: text("category").notNull(), // general, order, payment, settlement, technical, complaint, other
  type: text("type"), // question, request, complaint, feedback
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  orderId: integer("order_id").references(() => orders.id),
  attachmentUrls: text("attachment_urls"), // JSON array
  status: text("status").notNull().default("pending"), // pending, in_progress, waiting_response, resolved, closed
  priority: text("priority").default("normal"), // low, normal, high, urgent
  assigneeId: varchar("assignee_id").references(() => users.id),
  assigneeName: text("assignee_name"),
  responseContent: text("response_content"),
  respondedAt: timestamp("responded_at"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  satisfactionRating: integer("satisfaction_rating"), // 1-5
  satisfactionComment: text("satisfaction_comment"),
  source: text("source").default("app"), // app, web, email, phone
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CS 문의 댓글 (Inquiry Comments)
export const inquiryComments = pgTable("inquiry_comments", {
  id: serial("id").primaryKey(),
  inquiryId: integer("inquiry_id").notNull().references(() => customerInquiries.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").references(() => users.id),
  authorName: text("author_name"),
  authorRole: text("author_role"), // user, admin, system
  content: text("content").notNull(),
  attachmentUrls: text("attachment_urls"), // JSON array
  isInternal: boolean("is_internal").default(false), // 내부 메모 (사용자에게 보이지 않음)
  createdAt: timestamp("created_at").defaultNow(),
});

// 티켓 에스컬레이션 (Ticket Escalations)
export const ticketEscalations = pgTable("ticket_escalations", {
  id: serial("id").primaryKey(),
  inquiryId: integer("inquiry_id").notNull().references(() => customerInquiries.id, { onDelete: "cascade" }),
  escalationType: text("escalation_type").notNull(), // priority_upgrade, manager_review, legal, refund_request
  reason: text("reason").notNull(),
  priority: text("priority").notNull().default("high"), // high, critical
  escalatedBy: varchar("escalated_by").references(() => users.id),
  escalatedByName: text("escalated_by_name"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  assignedToName: text("assigned_to_name"),
  dueDate: timestamp("due_date"),
  status: text("status").notNull().default("pending"), // pending, in_progress, resolved
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 푸시 알림 로그 (Push Notification Logs)
export const pushNotificationLogs = pgTable("push_notification_logs", {
  id: serial("id").primaryKey(),
  recipientUserId: varchar("recipient_user_id").references(() => users.id),
  recipientDeviceToken: text("recipient_device_token"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  data: text("data"), // JSON payload
  category: text("category"), // order, settlement, system, marketing
  relatedEntityType: text("related_entity_type"), // order, settlement, contract
  relatedEntityId: text("related_entity_id"),
  status: text("status").notNull().default("pending"), // pending, sent, delivered, failed, clicked
  provider: text("provider").default("expo"), // expo, fcm, apns
  providerId: text("provider_id"), // 외부 서비스 메시지 ID
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  clickedAt: timestamp("clicked_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// SMS 템플릿 (SMS Templates) - T-08
export const smsTemplates = pgTable("sms_templates", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // verification, order_created, dispatch_assigned, etc.
  name: text("name").notNull(), // 템플릿 이름
  category: text("category").notNull(), // auth, order, settlement, notice, marketing
  content: text("content").notNull(), // 메시지 내용 (변수: {{name}}, {{orderNumber}} 등)
  variables: text("variables"), // JSON: 사용 가능한 변수 목록
  senderType: text("sender_type").default("default"), // default, marketing, notification
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SMS 발송 로그 (SMS Logs) - T-08
export const smsLogs = pgTable("sms_logs", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => smsTemplates.id),
  recipientPhone: text("recipient_phone").notNull(),
  recipientUserId: varchar("recipient_user_id").references(() => users.id),
  content: text("content").notNull(), // 실제 발송된 내용
  status: text("status").notNull().default("pending"), // pending, sent, delivered, failed
  provider: text("provider"), // solapi, aligo, etc.
  providerId: text("provider_id"), // 외부 서비스 메시지 ID
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  cost: integer("cost"), // 발송 비용 (원)
  retryCount: integer("retry_count").default(0),
  metadata: text("metadata"), // JSON: 관련 오더/정산 ID 등
  createdAt: timestamp("created_at").defaultNow(),
});

// 웹훅 로그 (Webhook Logs)
// PG/본인인증/외부 서비스 웹훅 수신 기록
export const webhookLogs = pgTable("webhook_logs", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(), // portone, kakao_pay, naver_pay, kg_inicis, solapi
  eventType: text("event_type").notNull(), // payment.confirmed, identity.verified, etc.
  webhookId: text("webhook_id"), // 외부 서비스 웹훅 ID
  payload: text("payload").notNull(), // JSON: 원본 페이로드
  status: text("status").notNull().default("received"), // received, processing, processed, failed, duplicate
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  relatedEntityType: text("related_entity_type"), // payment, order, user
  relatedEntityId: text("related_entity_id"),
  idempotencyKey: text("idempotency_key"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 연동 상태 (Integration Health)
// 외부 서비스 연동 상태 모니터링
export const integrationHealth = pgTable("integration_health", {
  id: serial("id").primaryKey(),
  serviceName: text("service_name").notNull(), // portone, solapi, kakao_login, naver_login, object_storage
  serviceType: text("service_type").notNull(), // payment, sms, oauth, storage, webhook
  status: text("status").notNull().default("unknown"), // healthy, degraded, down, unknown
  lastCheckAt: timestamp("last_check_at"),
  lastSuccessAt: timestamp("last_success_at"),
  lastFailureAt: timestamp("last_failure_at"),
  successCount24h: integer("success_count_24h").default(0),
  failureCount24h: integer("failure_count_24h").default(0),
  avgResponseMs: integer("avg_response_ms"),
  lastErrorMessage: text("last_error_message"),
  lastErrorCode: text("last_error_code"),
  metadata: text("metadata"), // JSON: 추가 상태 정보
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 시스템 이벤트 로그 (System Events)
// 시스템 레벨 이벤트 기록
export const systemEvents = pgTable("system_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(), // scheduler_run, integration_error, rate_limit, security_alert
  severity: text("severity").notNull().default("info"), // debug, info, warning, error, critical
  source: text("source").notNull(), // scheduler, api, webhook, auth
  message: text("message").notNull(),
  details: text("details"), // JSON: 상세 정보
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// 환불 기록 (Refunds)
// 환불 처리 상세 기록
export const refunds = pgTable("refunds", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id")
    .references(() => payments.id, { onDelete: "cascade" }),
  orderId: integer("order_id").references(() => orders.id),
  incidentId: integer("incident_id").references(() => incidentReports.id), // 사고 연동
  requesterId: varchar("requester_id").references(() => users.id), // 환불 대상 요청자
  amount: integer("amount").notNull(), // 환불 금액
  reason: text("reason").notNull(), // 환불 사유
  reasonCategory: text("reason_category"), // customer_request, order_cancel, dispute, error, incident
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  refundMethod: text("refund_method"), // card_cancel, bank_transfer, point
  pgRefundId: text("pg_refund_id"), // PG사 환불 ID
  requestedBy: varchar("requested_by").references(() => users.id),
  requestedAt: timestamp("requested_at").defaultNow(),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  failureReason: text("failure_reason"),
  metadata: text("metadata"), // JSON: 추가 정보
  createdAt: timestamp("created_at").defaultNow(),
});

// 결제 Intent (Payment Intents) - 결제 시작~완료 추적
// 결제 시작 시 생성, 완료/실패 시 상태 업데이트
export const paymentIntents = pgTable("payment_intents", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
  contractId: integer("contract_id").references(() => jobContracts.id, { onDelete: "cascade" }),
  payerId: varchar("payer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  payerRole: text("payer_role").notNull(), // requester, helper
  paymentType: text("payment_type").notNull(), // deposit(계약금), balance(잔금), full(전액)
  amount: integer("amount").notNull(),
  currency: text("currency").default("KRW"),
  status: text("status").notNull().default("created"), // created, processing, succeeded, failed, cancelled, expired
  pgProvider: text("pg_provider"), // portone, kakao_pay, naver_pay, toss
  pgPaymentId: text("pg_payment_id"), // PG사 결제 ID
  pgOrderId: text("pg_order_id"), // PG사 주문 ID
  paymentMethod: text("payment_method"), // card, bank_transfer, virtual_account, kakao_pay
  cardInfo: text("card_info"), // JSON: 카드 정보 (마스킹된)
  virtualAccountInfo: text("virtual_account_info"), // JSON: 가상계좌 정보
  failureCode: text("failure_code"),
  failureMessage: text("failure_message"),
  metadata: text("metadata"), // JSON: 추가 정보
  expiresAt: timestamp("expires_at"), // 결제 만료 시점
  confirmedAt: timestamp("confirmed_at"), // 결제 확정 시점
  cancelledAt: timestamp("cancelled_at"),
  idempotencyKey: text("idempotency_key").unique(),
  clientIp: text("client_ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CS 티켓 확장 필드 추가 (Support Tickets)
// customer_service_inquiries에서 확장하여 더 상세한 티켓 관리
export const supportTicketEscalations = pgTable("support_ticket_escalations", {
  id: serial("id").primaryKey(),
  inquiryId: integer("inquiry_id")
    .notNull()
    .references(() => customerServiceInquiries.id, { onDelete: "cascade" }),
  escalationType: text("escalation_type").notNull(), // manager, legal, executive
  escalatedBy: varchar("escalated_by")
    .notNull()
    .references(() => users.id),
  escalatedTo: varchar("escalated_to").references(() => users.id),
  reason: text("reason").notNull(),
  priority: text("priority").default("high"), // medium, high, critical
  dueDate: timestamp("due_date"),
  resolvedAt: timestamp("resolved_at"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schemas for new tables
export const insertSettlementAuditLogSchema = createInsertSchema(settlementAuditLogs).omit({
  id: true,
  createdAt: true,
});
export type SettlementAuditLog = typeof settlementAuditLogs.$inferSelect;
export type InsertSettlementAuditLog = z.infer<typeof insertSettlementAuditLogSchema>;

export const insertSettlementPayoutAttemptSchema = createInsertSchema(settlementPayoutAttempts).omit({
  id: true,
  createdAt: true,
});
export type SettlementPayoutAttempt = typeof settlementPayoutAttempts.$inferSelect;
export type InsertSettlementPayoutAttempt = z.infer<typeof insertSettlementPayoutAttemptSchema>;

export const insertPaymentIntentSchema = createInsertSchema(paymentIntents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PaymentIntent = typeof paymentIntents.$inferSelect;
export type InsertPaymentIntent = z.infer<typeof insertPaymentIntentSchema>;

export const insertRegionPricingRuleSchema = createInsertSchema(regionPricingRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type RegionPricingRule = typeof regionPricingRules.$inferSelect;
export type InsertRegionPricingRule = z.infer<typeof insertRegionPricingRuleSchema>;

export const insertVatSettingSchema = createInsertSchema(vatSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type VatSetting = typeof vatSettings.$inferSelect;
export type InsertVatSetting = z.infer<typeof insertVatSettingSchema>;

export const insertMinimumGuaranteeRuleSchema = createInsertSchema(minimumGuaranteeRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type MinimumGuaranteeRule = typeof minimumGuaranteeRules.$inferSelect;
export type InsertMinimumGuaranteeRule = z.infer<typeof insertMinimumGuaranteeRuleSchema>;

export const insertMinimumGuaranteeApplicationSchema = createInsertSchema(minimumGuaranteeApplications).omit({
  id: true,
  createdAt: true,
});
export type MinimumGuaranteeApplication = typeof minimumGuaranteeApplications.$inferSelect;
export type InsertMinimumGuaranteeApplication = z.infer<typeof insertMinimumGuaranteeApplicationSchema>;

export const insertOrderForceStatusLogSchema = createInsertSchema(orderForceStatusLogs).omit({
  id: true,
  createdAt: true,
});
export type OrderForceStatusLog = typeof orderForceStatusLogs.$inferSelect;
export type InsertOrderForceStatusLog = z.infer<typeof insertOrderForceStatusLogSchema>;

export const insertManualDispatchLogSchema = createInsertSchema(manualDispatchLogs).omit({
  id: true,
  createdAt: true,
});
export type ManualDispatchLog = typeof manualDispatchLogs.$inferSelect;
export type InsertManualDispatchLog = z.infer<typeof insertManualDispatchLogSchema>;

export const insertProofUploadFailureSchema = createInsertSchema(proofUploadFailures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ProofUploadFailure = typeof proofUploadFailures.$inferSelect;
export type InsertProofUploadFailure = z.infer<typeof insertProofUploadFailureSchema>;

// Wave 1 추가 테이블 Zod 스키마
export const insertCarrierMinRateSchema = createInsertSchema(carrierMinRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CarrierMinRate = typeof carrierMinRates.$inferSelect;
export type InsertCarrierMinRate = z.infer<typeof insertCarrierMinRateSchema>;

export const insertPricingTableSchema = createInsertSchema(pricingTables).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PricingTable = typeof pricingTables.$inferSelect;
export type InsertPricingTable = z.infer<typeof insertPricingTableSchema>;

export const insertPricingTableRowSchema = createInsertSchema(pricingTableRows).omit({
  id: true,
  createdAt: true,
});
export type PricingTableRow = typeof pricingTableRows.$inferSelect;
export type InsertPricingTableRow = z.infer<typeof insertPricingTableRowSchema>;

export const insertIdentityVerificationSchema = createInsertSchema(identityVerifications).omit({
  id: true,
  createdAt: true,
});
export type IdentityVerification = typeof identityVerifications.$inferSelect;
export type InsertIdentityVerification = z.infer<typeof insertIdentityVerificationSchema>;

export const insertDocumentReviewTaskSchema = createInsertSchema(documentReviewTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type DocumentReviewTask = typeof documentReviewTasks.$inferSelect;
export type InsertDocumentReviewTask = z.infer<typeof insertDocumentReviewTaskSchema>;

export const insertOrderStatusEventSchema = createInsertSchema(orderStatusEvents).omit({
  id: true,
  createdAt: true,
});
export type OrderStatusEvent = typeof orderStatusEvents.$inferSelect;
export type InsertOrderStatusEvent = z.infer<typeof insertOrderStatusEventSchema>;

export const insertCustomerInquirySchema = createInsertSchema(customerInquiries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CustomerInquiry = typeof customerInquiries.$inferSelect;
export type InsertCustomerInquiry = z.infer<typeof insertCustomerInquirySchema>;

export const insertInquiryCommentSchema = createInsertSchema(inquiryComments).omit({
  id: true,
  createdAt: true,
});
export type InquiryComment = typeof inquiryComments.$inferSelect;
export type InsertInquiryComment = z.infer<typeof insertInquiryCommentSchema>;

export const insertTicketEscalationSchema = createInsertSchema(ticketEscalations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type TicketEscalation = typeof ticketEscalations.$inferSelect;
export type InsertTicketEscalation = z.infer<typeof insertTicketEscalationSchema>;

export const insertPushNotificationLogSchema = createInsertSchema(pushNotificationLogs).omit({
  id: true,
  createdAt: true,
});
export type PushNotificationLog = typeof pushNotificationLogs.$inferSelect;
export type InsertPushNotificationLog = z.infer<typeof insertPushNotificationLogSchema>;

export const insertSmsTemplateSchema = createInsertSchema(smsTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SmsTemplate = typeof smsTemplates.$inferSelect;
export type InsertSmsTemplate = z.infer<typeof insertSmsTemplateSchema>;

export const insertSmsLogSchema = createInsertSchema(smsLogs).omit({
  id: true,
  createdAt: true,
});
export type SmsLog = typeof smsLogs.$inferSelect;
export type InsertSmsLog = z.infer<typeof insertSmsLogSchema>;

export const insertWebhookLogSchema = createInsertSchema(webhookLogs).omit({
  id: true,
  createdAt: true,
});
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;

export const insertIntegrationHealthSchema = createInsertSchema(integrationHealth).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type IntegrationHealth = typeof integrationHealth.$inferSelect;
export type InsertIntegrationHealth = z.infer<typeof insertIntegrationHealthSchema>;

export const insertSystemEventSchema = createInsertSchema(systemEvents).omit({
  id: true,
  createdAt: true,
});
export type SystemEvent = typeof systemEvents.$inferSelect;
export type InsertSystemEvent = z.infer<typeof insertSystemEventSchema>;

export const insertRefundSchema = createInsertSchema(refunds).omit({
  id: true,
  createdAt: true,
});
export type Refund = typeof refunds.$inferSelect;
export type InsertRefund = z.infer<typeof insertRefundSchema>;

export const insertSupportTicketEscalationSchema = createInsertSchema(supportTicketEscalations).omit({
  id: true,
  createdAt: true,
});
export type SupportTicketEscalation = typeof supportTicketEscalations.$inferSelect;
export type InsertSupportTicketEscalation = z.infer<typeof insertSupportTicketEscalationSchema>;

// ============================================
// Wave 3: 관리자-앱 연동 테이블 (추가)
// ============================================

// 서류 파일 메타 (Documents)
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  docType: text("doc_type").notNull(), // ID, DRIVER_LICENSE, VEHICLE_REG, INSURANCE, BUSINESS_REG
  fileUrl: text("file_url").notNull(),
  issuedDate: text("issued_date"), // 발급일
  expireDate: text("expire_date"), // 만료일
  status: text("status").notNull().default("UPLOADED"), // UPLOADED, UNDER_REVIEW, APPROVED, REJECTED, EXPIRED
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 서류 검토 이력 (Document Reviews)
export const documentReviews = pgTable("document_reviews", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  adminId: varchar("admin_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(), // APPROVE, REJECT, REQUEST_MORE
  reason: text("reason").notNull(), // 사유 (필수)
  createdAt: timestamp("created_at").defaultNow(),
});

// 재배정 기록 (Reassignments)
export const reassignments = pgTable("reassignments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  fromHelperId: varchar("from_helper_id").references(() => users.id),
  toHelperId: varchar("to_helper_id").references(() => users.id),
  reason: text("reason").notNull(),
  createdBy: varchar("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// Wave 2: 운영 테이블 확장 (문서 기반 재설계)
// ============================================

// 택배사 최저운임 세트 (Carrier Min Rate Sets)
// 운임 세트 상위 테이블 (DRAFT/ACTIVE/ARCHIVED 상태 관리)
export const carrierMinRateSets = pgTable("carrier_min_rate_sets", {
  id: serial("id").primaryKey(),
  courierId: integer("courier_id")
    .notNull()
    .references(() => courierSettings.id, { onDelete: "cascade" }),
  title: text("title").notNull(), // 2~120자, 세트 표시명
  effectiveFrom: text("effective_from").notNull(), // YYYY-MM-DD, 적용 시작일
  effectiveTo: text("effective_to"), // NULL 허용, 종료일
  vatMode: text("vat_mode").default("EXCLUSIVE"), // EXCLUSIVE/INCLUSIVE
  roundingUnit: integer("rounding_unit").default(100), // 1/10/100만 허용
  status: text("status").default("DRAFT"), // DRAFT, ACTIVE, ARCHIVED
  clonedFromId: integer("cloned_from_id"), // 복제 원본 ID
  activatedAt: timestamp("activated_at"), // 활성화 시점
  activatedBy: varchar("activated_by").references(() => users.id),
  archivedAt: timestamp("archived_at"), // 아카이브 시점
  archivedBy: varchar("archived_by").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 택배사 최저운임 규칙 (Carrier Min Rate Rules)
// 세트에 속하는 개별 최저운임 규칙
export const carrierMinRateRules = pgTable("carrier_min_rate_rules", {
  id: serial("id").primaryKey(),
  setId: integer("set_id")
    .notNull()
    .references(() => carrierMinRateSets.id, { onDelete: "cascade" }),
  regionCode: text("region_code").notNull(), // SEOUL_GANGNAM 등 권역/시군구 코드
  vehicleType: text("vehicle_type").notNull(), // CAR, 1TON 등
  serviceType: text("service_type").notNull(), // DELIVERY, PICKUP 등
  priceType: text("price_type").default("PER_BOX"), // PER_BOX, PER_KM, FLAT
  minUnitPrice: integer("min_unit_price").notNull(), // 최저단가 (원)
  minTotalPrice: integer("min_total_price"), // 최저총액 (NULL 허용)
  minBoxes: integer("min_boxes"), // 최소 박스 수
  minDistanceKm: numeric("min_distance_km", { precision: 10, scale: 2 }), // 최소 거리 (km)
  priority: integer("priority").default(10), // 1~999, 낮을수록 우선
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// MG 플랜 (Minimum Guarantee Plans)
// MG 정책 설정 (문서 스펙 기반)
export const mgPlans = pgTable("mg_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // 플랜 이름
  periodUnit: text("period_unit").notNull(), // DAILY, WEEKLY, MONTHLY
  guaranteeAmount: integer("guarantee_amount").notNull(), // 보장액
  eligibilityMinOrders: integer("eligibility_min_orders"), // 최소 완료건수
  eligibilityMinOnlineMinutes: integer("eligibility_min_online_minutes"), // 최소 가동시간
  maxTopupAmount: integer("max_topup_amount"), // 보전 상한
  budgetMonthlyCap: integer("budget_monthly_cap"), // 월간 예산 상한
  scopeRegionCode: text("scope_region_code"), // 권역 조건
  vehicleType: text("vehicle_type"), // 차종 조건
  effectiveFrom: text("effective_from").notNull(), // 적용 시작일
  effectiveTo: text("effective_to"), // 적용 종료일
  status: text("status").default("DRAFT"), // DRAFT, ACTIVE, PAUSED, ARCHIVED
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// MG 등록 (MG Enrollments)
// 기사별 MG 등록 상태
export const mgEnrollments = pgTable("mg_enrollments", {
  id: serial("id").primaryKey(),
  helperId: varchar("helper_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  planId: integer("plan_id")
    .notNull()
    .references(() => mgPlans.id, { onDelete: "cascade" }),
  status: text("status").default("ENROLLED"), // ENROLLED, PAUSED, TERMINATED
  enrolledAt: timestamp("enrolled_at").defaultNow(),
  enrolledBy: varchar("enrolled_by").references(() => users.id),
  terminatedAt: timestamp("terminated_at"),
  terminatedBy: varchar("terminated_by").references(() => users.id),
  terminationReason: text("termination_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// MG 기간 집계 (MG Period Summaries)
// 일/주/월 단위 집계 데이터
export const mgPeriodSummaries = pgTable("mg_period_summaries", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id")
    .notNull()
    .references(() => mgEnrollments.id, { onDelete: "cascade" }),
  periodStart: text("period_start").notNull(), // YYYY-MM-DD
  periodEnd: text("period_end").notNull(), // YYYY-MM-DD
  grossEarnings: integer("gross_earnings").default(0), // 총 수입
  completedOrders: integer("completed_orders").default(0), // 완료 건수
  onlineMinutes: integer("online_minutes").default(0), // 가동 시간 (분)
  eligible: boolean("eligible").default(false), // 자격 충족 여부
  guaranteeAmount: integer("guarantee_amount"), // 보장액
  calculatedTopup: integer("calculated_topup"), // 계산된 보전액
  locked: boolean("locked").default(false), // 확정 여부
  lockedAt: timestamp("locked_at"),
  lockedBy: varchar("locked_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// MG 보전 지급 (MG Topups)
// 실제 보전 지급 기록
export const mgTopups = pgTable("mg_topups", {
  id: serial("id").primaryKey(),
  summaryId: integer("summary_id")
    .notNull()
    .references(() => mgPeriodSummaries.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // 보전 금액
  status: text("status").default("PENDING"), // PENDING, APPLIED, CANCELLED
  settlementId: integer("settlement_id").references(() => settlementStatements.id),
  appliedAt: timestamp("applied_at"),
  appliedBy: varchar("applied_by").references(() => users.id),
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: varchar("cancelled_by").references(() => users.id),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 지급 (Payouts)
// 은행 지급 추적
export const payouts = pgTable("payouts", {
  id: serial("id").primaryKey(),
  settlementId: integer("settlement_id")
    .notNull()
    .references(() => settlementStatements.id, { onDelete: "cascade" }),
  helperId: varchar("helper_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // 지급 금액
  bankName: text("bank_name").notNull(),
  accountNumber: text("account_number").notNull(),
  accountHolder: text("account_holder").notNull(),
  status: text("status").default("REQUESTED"), // REQUESTED, SENT, SUCCEEDED, FAILED
  requestedAt: timestamp("requested_at").defaultNow(),
  sentAt: timestamp("sent_at"),
  succeededAt: timestamp("succeeded_at"),
  failedAt: timestamp("failed_at"),
  failureCode: text("failure_code"),
  failureMessage: text("failure_message"),
  retryCount: integer("retry_count").default(0),
  externalRef: text("external_ref"), // 외부 은행 참조 ID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 지급 이벤트 (Payout Events)
// 지급 상태 변경 이력
export const payoutEvents = pgTable("payout_events", {
  id: serial("id").primaryKey(),
  payoutId: integer("payout_id")
    .notNull()
    .references(() => payouts.id, { onDelete: "cascade" }),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  reason: text("reason"),
  actorId: varchar("actor_id").references(() => users.id),
  metadata: text("metadata"), // JSON
  createdAt: timestamp("created_at").defaultNow(),
});

// 정책 스냅샷 (Policy Snapshots)
// 오더/정산 시점 정책 스냅샷
export const policySnapshots = pgTable("policy_snapshots", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
  settlementId: integer("settlement_id").references(() => settlementStatements.id, { onDelete: "cascade" }),
  snapshotType: text("snapshot_type").notNull(), // rate, commission, mg, vat
  rateSetId: integer("rate_set_id"), // 적용된 운임 세트 ID
  rateRuleId: integer("rate_rule_id"), // 적용된 운임 규칙 ID
  mgPlanId: integer("mg_plan_id"), // 적용된 MG 플랜 ID
  commissionPolicyId: integer("commission_policy_id"), // 적용된 수수료 정책 ID
  snapshotData: text("snapshot_data").notNull(), // JSON: 전체 정책 스냅샷
  vatMode: text("vat_mode"), // VAT 모드
  roundingUnit: integer("rounding_unit"), // 라운딩 단위
  createdAt: timestamp("created_at").defaultNow(),
});

// 운임 변경 로그 (Rate Change Logs)
// 운임 세트/규칙 변경 이력
export const rateChangeLogs = pgTable("rate_change_logs", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(), // rate_set, rate_rule, pricing_table
  entityId: integer("entity_id").notNull(),
  changeType: text("change_type").notNull(), // CREATE, UPDATE, ACTIVATE, ARCHIVE, CLONE
  previousData: text("previous_data"), // JSON: 변경 전 데이터
  newData: text("new_data"), // JSON: 변경 후 데이터
  reason: text("reason"),
  actorId: varchar("actor_id")
    .notNull()
    .references(() => users.id),
  ipAddress: text("ip_address"),
  trackingNumber: text("tracking_number"), // 운송장번호
  createdAt: timestamp("created_at").defaultNow(),
});

// Note: idempotencyKeys table already exists at line ~1750

// Insert schemas and types for new tables
export const insertCarrierMinRateSetSchema = createInsertSchema(carrierMinRateSets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CarrierMinRateSet = typeof carrierMinRateSets.$inferSelect;
export type InsertCarrierMinRateSet = z.infer<typeof insertCarrierMinRateSetSchema>;

export const insertCarrierMinRateRuleSchema = createInsertSchema(carrierMinRateRules).omit({
  id: true,
  createdAt: true,
});
export type CarrierMinRateRule = typeof carrierMinRateRules.$inferSelect;
export type InsertCarrierMinRateRule = z.infer<typeof insertCarrierMinRateRuleSchema>;

export const insertMgPlanSchema = createInsertSchema(mgPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type MgPlan = typeof mgPlans.$inferSelect;
export type InsertMgPlan = z.infer<typeof insertMgPlanSchema>;

export const insertMgEnrollmentSchema = createInsertSchema(mgEnrollments).omit({
  id: true,
  createdAt: true,
});
export type MgEnrollment = typeof mgEnrollments.$inferSelect;
export type InsertMgEnrollment = z.infer<typeof insertMgEnrollmentSchema>;

export const insertMgPeriodSummarySchema = createInsertSchema(mgPeriodSummaries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type MgPeriodSummary = typeof mgPeriodSummaries.$inferSelect;
export type InsertMgPeriodSummary = z.infer<typeof insertMgPeriodSummarySchema>;

export const insertMgTopupSchema = createInsertSchema(mgTopups).omit({
  id: true,
  createdAt: true,
});
export type MgTopup = typeof mgTopups.$inferSelect;
export type InsertMgTopup = z.infer<typeof insertMgTopupSchema>;

export const insertPayoutSchema = createInsertSchema(payouts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Payout = typeof payouts.$inferSelect;
export type InsertPayout = z.infer<typeof insertPayoutSchema>;

export const insertPayoutEventSchema = createInsertSchema(payoutEvents).omit({
  id: true,
  createdAt: true,
});
export type PayoutEvent = typeof payoutEvents.$inferSelect;
export type InsertPayoutEvent = z.infer<typeof insertPayoutEventSchema>;

export const insertPolicySnapshotSchema = createInsertSchema(policySnapshots).omit({
  id: true,
  createdAt: true,
});
export type PolicySnapshot = typeof policySnapshots.$inferSelect;
export type InsertPolicySnapshot = z.infer<typeof insertPolicySnapshotSchema>;

export const insertRateChangeLogSchema = createInsertSchema(rateChangeLogs).omit({
  id: true,
  createdAt: true,
});
export type RateChangeLog = typeof rateChangeLogs.$inferSelect;
export type InsertRateChangeLog = z.infer<typeof insertRateChangeLogSchema>;

// Note: insertIdempotencyKeySchema already defined elsewhere

// Wave 3: Admin-App Integration Insert Schemas and Types (추가)
export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export const insertDocumentReviewSchema = createInsertSchema(documentReviews).omit({
  id: true,
  createdAt: true,
});
export type DocumentReview = typeof documentReviews.$inferSelect;
export type InsertDocumentReview = z.infer<typeof insertDocumentReviewSchema>;

export const insertReassignmentSchema = createInsertSchema(reassignments).omit({
  id: true,
  createdAt: true,
});
export type Reassignment = typeof reassignments.$inferSelect;
export type InsertReassignment = z.infer<typeof insertReassignmentSchema>;

// ============================================
// 새 운영 체계 Insert Schemas and Types
// ============================================

export const insertOrderCandidateSchema = createInsertSchema(orderCandidates).omit({
  id: true,
  appliedAt: true,
});
export type OrderCandidate = typeof orderCandidates.$inferSelect;
export type InsertOrderCandidate = z.infer<typeof insertOrderCandidateSchema>;

export const insertHelperRatingSummarySchema = createInsertSchema(helperRatingSummary).omit({
  updatedAt: true,
});
export type HelperRatingSummary = typeof helperRatingSummary.$inferSelect;
export type InsertHelperRatingSummary = z.infer<typeof insertHelperRatingSummarySchema>;

export const insertContactShareEventSchema = createInsertSchema(contactShareEvents).omit({
  id: true,
  createdAt: true,
});
export type ContactShareEvent = typeof contactShareEvents.$inferSelect;
export type InsertContactShareEvent = z.infer<typeof insertContactShareEventSchema>;

export const insertOrderClosureReportSchema = createInsertSchema(orderClosureReports).omit({
  id: true,
  submittedAt: true,
});
export type OrderClosureReport = typeof orderClosureReports.$inferSelect;
export type InsertOrderClosureReport = z.infer<typeof insertOrderClosureReportSchema>;

export const insertCostItemTypeSchema = createInsertSchema(costItemTypes).omit({
  id: true,
  createdAt: true,
});
export type CostItemType = typeof costItemTypes.$inferSelect;
export type InsertCostItemType = z.infer<typeof insertCostItemTypeSchema>;

export const insertOrderCostItemSchema = createInsertSchema(orderCostItems).omit({
  id: true,
  createdAt: true,
});
export type OrderCostItem = typeof orderCostItems.$inferSelect;
export type InsertOrderCostItem = z.infer<typeof insertOrderCostItemSchema>;

export const insertCarrierProofUploadSchema = createInsertSchema(carrierProofUploads).omit({
  id: true,
  createdAt: true,
});
export type CarrierProofUpload = typeof carrierProofUploads.$inferSelect;
export type InsertCarrierProofUpload = z.infer<typeof insertCarrierProofUploadSchema>;

export const insertPricingSnapshotSchema = createInsertSchema(pricingSnapshots).omit({
  id: true,
  computedAt: true,
});
export type PricingSnapshot = typeof pricingSnapshots.$inferSelect;
export type InsertPricingSnapshot = z.infer<typeof insertPricingSnapshotSchema>;

export const insertBalanceInvoiceSchema = createInsertSchema(balanceInvoices).omit({
  id: true,
  createdAt: true,
});
export type BalanceInvoice = typeof balanceInvoices.$inferSelect;
export type InsertBalanceInvoice = z.infer<typeof insertBalanceInvoiceSchema>;

// ============================================
// 정산 자동화 정책 테이블 (Pricing Policy Tables)
// ============================================

// 택배사별 단가 정책 (Carrier Pricing Policies)
// 관리자가 책정하는 기본 단가표
export const carrierPricingPolicies = pgTable("carrier_pricing_policies", {
  id: serial("id").primaryKey(),
  carrierCode: text("carrier_code").notNull(), // CJ, LOTTE, HANJIN, ETC
  serviceType: text("service_type").notNull(), // NORMAL, DAWN, SAME_DAY
  regionCode: text("region_code"), // 권역 코드 (optional)
  vehicleType: text("vehicle_type"), // 차종 (optional)
  unitType: text("unit_type").default("BOX"), // BOX, TRIP, HOUR
  unitPriceSupply: integer("unit_price_supply").notNull(), // 공급가 단가 (원)
  minChargeSupply: integer("min_charge_supply"), // 최소 청구액 (optional)
  effectiveFrom: text("effective_from").notNull(), // YYYY-MM-DD 적용 시작일
  effectiveTo: text("effective_to"), // 종료일 (NULL = 무기한)
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 긴급 수수료 정책 (Urgent Fee Policies)
// 긴급 체크 시 자동 적용되는 추가수수료
export const urgentFeePolicies = pgTable("urgent_fee_policies", {
  id: serial("id").primaryKey(),
  carrierCode: text("carrier_code"), // NULL = 전체 적용
  applyType: text("apply_type").notNull(), // PERCENT, FIXED
  value: integer("value").notNull(), // 퍼센트(10=10%) 또는 고정금액(원)
  maxUrgentFeeSupply: integer("max_urgent_fee_supply"), // 긴급비 상한 (optional)
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 플랫폼 수수료 정책 (Platform Fee Policies)
// 기사 지급액 계산의 핵심 정책
export const platformFeePolicies = pgTable("platform_fee_policies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // 정책 이름
  baseOn: text("base_on").notNull(), // TOTAL (총액 기준), SUPPLY (공급가 기준)
  feeType: text("fee_type").default("PERCENT"), // PERCENT, FIXED
  ratePercent: integer("rate_percent"), // 수수료율 (%)
  fixedAmount: integer("fixed_amount"), // 고정 수수료 (원)
  minFee: integer("min_fee"), // 최소 수수료
  maxFee: integer("max_fee"), // 최대 수수료
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false), // 기본 정책 여부
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 환불 정책 (Refund Policies)
// 취소 시점별 환불율 설정
export const refundPolicies = pgTable("refund_policies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  beforeMatchingRefundRate: integer("before_matching_refund_rate").notNull().default(100), // 매칭 전 취소 환불율 (%)
  afterMatchingRefundRate: integer("after_matching_refund_rate").notNull().default(70), // 매칭 후 취소 환불율 (%)
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRefundPolicySchema = createInsertSchema(refundPolicies).omit({
  id: true, createdAt: true, updatedAt: true
});

export type RefundPolicy = typeof refundPolicies.$inferSelect;

// 추가비용 항목 카탈로그 (Extra Cost Catalog)
// 헬퍼가 선택할 수 있는 추가비용 항목 (텍스트 입력 방지)
export const extraCostCatalog = pgTable("extra_cost_catalog", {
  id: serial("id").primaryKey(),
  costCode: text("cost_code").notNull().unique(), // EXTRA_WAIT, EXTRA_NIGHT, etc.
  label: text("label").notNull(), // 표시명 (대기비, 야간비)
  unitLabel: text("unit_label"), // 단위 (분, 건, 회)
  defaultUnitPriceSupply: integer("default_unit_price_supply"), // 기본 단가 (공급가)
  inputMode: text("input_mode").default("QTY_PRICE"), // QTY_PRICE, FIXED, MANUAL
  requireMemo: boolean("require_memo").default(false), // 메모 필수 여부
  sortOrder: integer("sort_order").default(100),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 오더 정책 스냅샷 (Order Policy Snapshots)
// 오더 생성 시점의 정책 값 보존 (나중에 정책 변경해도 기존 계약 금액 유지)
export const orderPolicySnapshots = pgTable("order_policy_snapshots", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  // 단가 정책 스냅샷
  pricingPolicyId: integer("pricing_policy_id"),
  snapshotUnitPriceSupply: integer("snapshot_unit_price_supply"), // 스냅샷 단가
  snapshotMinChargeSupply: integer("snapshot_min_charge_supply"), // 스냅샷 최소청구액
  // 긴급 정책 스냅샷
  urgentPolicyId: integer("urgent_policy_id"),
  snapshotUrgentApplyType: text("snapshot_urgent_apply_type"), // PERCENT, FIXED
  snapshotUrgentValue: integer("snapshot_urgent_value"), // 스냅샷 긴급 값
  snapshotUrgentMaxFee: integer("snapshot_urgent_max_fee"), // 스냅샷 긴급 상한
  // 플랫폼 수수료 정책 스냅샷
  platformFeePolicyId: integer("platform_fee_policy_id"),
  snapshotPlatformBaseOn: text("snapshot_platform_base_on"), // TOTAL, SUPPLY
  snapshotPlatformRatePercent: integer("snapshot_platform_rate_percent"), // 스냅샷 수수료율
  snapshotPlatformMinFee: integer("snapshot_platform_min_fee"),
  snapshotPlatformMaxFee: integer("snapshot_platform_max_fee"),
  // 메타
  createdAt: timestamp("created_at").defaultNow(),
});

// 정산 테이블 (Settlement Records) - 최종 정산 기록
// 플랫폼 수수료 차감 후 기사 지급액 확정
export const settlementRecords = pgTable("settlement_records", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  helperId: varchar("helper_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  closingReportId: integer("closing_report_id")
    .references(() => closingReports.id, { onDelete: "set null" }),
  contractId: integer("contract_id")
    .references(() => contracts.id, { onDelete: "set null" }),
  // 계산된 금액 (정답 공식 기반)
  baseSupply: integer("base_supply").notNull(), // 기본금액 (공급가)
  urgentFeeSupply: integer("urgent_fee_supply").default(0), // 긴급수수료 (공급가)
  extraSupply: integer("extra_supply").default(0), // 추가비용 (공급가)
  finalSupply: integer("final_supply").notNull(), // 최종 공급가
  vat: integer("vat").notNull(), // 부가세
  finalTotal: integer("final_total").notNull(), // 최종 총액
  // 플랫폼 수수료 차감
  platformFeeBaseOn: text("platform_fee_base_on"), // TOTAL, SUPPLY
  platformFeeRate: integer("platform_fee_rate"), // 수수료율 (%)
  platformFee: integer("platform_fee").notNull(), // 플랫폼 수수료
  // 화물사고 차감
  damageDeduction: integer("damage_deduction").default(0), // 화물사고 차감액
  damageReason: text("damage_reason"), // 사고 내용/설명
  // 헬퍼 지급액 = final_total - platform_fee - damage_deduction
  driverPayout: integer("driver_payout").notNull(), // 기사 지급액
  // 세부 정산 내역 JSON (레거시)
  breakdownJson: text("breakdown_json"),
  deductionItemsJson: text("deduction_items_json"),
  // 단순화된 정산 내역 (신규)
  requesterInvoiceJson: text("requester_invoice_json"), // 요청자 청구: {deliveredCount, returnedCount, unitPrice, boxTotal, extraCosts, supplyTotal, vat, totalAmount, depositAmount, balanceDue}
  helperPayoutJson: text("helper_payout_json"), // 헬퍼 정산: {totalAmount, platformFee, deductions, payoutAmount}
  // 팀장 인센티브 (있는 경우)
  teamLeaderId: varchar("team_leader_id").references(() => users.id),
  teamLeaderIncentive: integer("team_leader_incentive").default(0),
  // 상태
  status: text("status").default("CALCULATED"), // CALCULATED, APPROVED, PAID
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  paidAt: timestamp("paid_at"),
  paidBy: varchar("paid_by").references(() => users.id),
  paymentReference: text("payment_reference"), // 지급 참조번호
  // 메타
  calculatedAt: timestamp("calculated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 차감 내역 테이블 (이의제기 확정 시 생성)
export const deductions = pgTable("deductions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
  incidentId: integer("incident_id").references(() => incidentReports.id, { onDelete: "set null" }),
  helperId: varchar("helper_id").references(() => users.id, { onDelete: "set null" }),
  requesterId: varchar("requester_id").references(() => users.id, { onDelete: "set null" }),
  // 차감 대상: helper(헬퍼), requester(요청자)
  targetType: text("target_type").notNull(), // helper, requester
  targetId: varchar("target_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // 차감 금액 및 사유
  amount: integer("amount").notNull(), // 차감 금액
  reason: text("reason").notNull(), // 차감 사유
  category: text("category"), // damage(화물사고), delay(지연), dispute(분쟁), other(기타)
  // 상태: pending(대기), applied(적용됨), cancelled(취소됨)
  status: text("status").default("pending"),
  // 정산 적용 정보
  appliedToSettlementId: integer("applied_to_settlement_id"),
  appliedAt: timestamp("applied_at"),
  appliedBy: varchar("applied_by").references(() => users.id, { onDelete: "set null" }),
  // 관리자 정보
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  memo: text("memo"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDeductionSchema = createInsertSchema(deductions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Deduction = typeof deductions.$inferSelect;
export type InsertDeduction = z.infer<typeof insertDeductionSchema>;

// 정책 테이블 스키마 & 타입
export const insertCarrierPricingPolicySchema = createInsertSchema(carrierPricingPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CarrierPricingPolicy = typeof carrierPricingPolicies.$inferSelect;
export type InsertCarrierPricingPolicy = z.infer<typeof insertCarrierPricingPolicySchema>;

export const insertUrgentFeePolicySchema = createInsertSchema(urgentFeePolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type UrgentFeePolicy = typeof urgentFeePolicies.$inferSelect;
export type InsertUrgentFeePolicy = z.infer<typeof insertUrgentFeePolicySchema>;

export const insertPlatformFeePolicySchema = createInsertSchema(platformFeePolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PlatformFeePolicy = typeof platformFeePolicies.$inferSelect;
export type InsertPlatformFeePolicy = z.infer<typeof insertPlatformFeePolicySchema>;

export const insertExtraCostCatalogSchema = createInsertSchema(extraCostCatalog).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ExtraCostCatalogItem = typeof extraCostCatalog.$inferSelect;
export type InsertExtraCostCatalogItem = z.infer<typeof insertExtraCostCatalogSchema>;

export const insertOrderPolicySnapshotSchema = createInsertSchema(orderPolicySnapshots).omit({
  id: true,
  createdAt: true,
});
export type OrderPolicySnapshot = typeof orderPolicySnapshots.$inferSelect;
export type InsertOrderPolicySnapshot = z.infer<typeof insertOrderPolicySnapshotSchema>;

export const insertSettlementRecordSchema = createInsertSchema(settlementRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  calculatedAt: true,
});
export type SettlementRecord = typeof settlementRecords.$inferSelect;
export type InsertSettlementRecord = z.infer<typeof insertSettlementRecordSchema>;
