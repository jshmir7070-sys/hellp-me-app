import { db } from "./db";
import { 
  users, helperCredentials, helpPosts, helperVehicles, helperBusinesses, helperBankAccounts, 
  helperLicenses, helperServiceAreas, helperTermsAgreements, requesterServiceAgreements, requesterBusinesses, 
  orders, orderApplications, notifications, notificationLogs, contracts, workConfirmations, 
  reviews, teams, teamMembers, courierSettings, courierTieredPricing, carrierRateItems, adminBankAccounts, teamCommissionOverrides, systemSettings, 
  jobPostings, paymentReminders, announcements, announcementRecipients, jobContracts, 
  workSessions, workProofEvents, settlementStatements, settlementLineItems, instructionLogs, 
  incidentReports, incidentEvidence, substituteRequests, contractExecutionEvents, payments, 
  paymentStatusEvents, contractDocuments, incidentActions, vehicleTypeSettings, orderCategorySettings, 
  enterpriseAccounts, enterpriseOrderBatches, teamIncentives, priceConversionRules, dispatchRequests, 
  userSanctions, qrScanLogs, teamQrCodes, adminRoles, adminPermissions, adminRolePermissions, staffRoleAssignments,
  checkInRecords, pushSubscriptions, fcmTokens, customerServiceInquiries, taxInvoices, incentivePolicies, incentiveDetails,
  commissionPolicies, helperCommissionOverrides, disputes, refreshTokens,
  destinationPricing, coldChainSettings, virtualAccounts, phoneVerificationCodes, auditLogs,
  type User, type InsertUser, type HelperCredential, type InsertHelperCredential, 
  type HelpPost, type InsertHelpPost, type HelperVehicle, type InsertHelperVehicle, 
  type HelperBusiness, type InsertHelperBusiness, type HelperBankAccount, type InsertHelperBankAccount, 
  type HelperLicense, type InsertHelperLicense, type HelperServiceArea, type InsertHelperServiceArea, type HelperTermsAgreement, type InsertHelperTermsAgreement, 
  type RequesterServiceAgreement, type InsertRequesterServiceAgreement, type RequesterBusiness, 
  type InsertRequesterBusiness, type Order, type InsertOrder, type OrderApplication, 
  type InsertOrderApplication, type Notification, type InsertNotification, type NotificationLog, 
  type InsertNotificationLog, type Contract, type InsertContract, type WorkConfirmation, 
  type InsertWorkConfirmation, type Review, type InsertReview, type Team, type InsertTeam, 
  type TeamMember, type InsertTeamMember, type CourierSetting, type InsertCourierSetting, 
  type CourierTieredPricing, type InsertCourierTieredPricing,
  type CarrierRateItem, type InsertCarrierRateItem,
  type AdminBankAccount, type InsertAdminBankAccount,
  type TeamCommissionOverride, type InsertTeamCommissionOverride, type SystemSetting, 
  type InsertSystemSetting, type JobPosting, type InsertJobPosting, type PaymentReminder, 
  type InsertPaymentReminder, type Announcement, type InsertAnnouncement, type AnnouncementRecipient, 
  type InsertAnnouncementRecipient, type JobContract, type InsertJobContract, type EnterpriseAccount, type InsertEnterpriseAccount, type EnterpriseOrderBatch, type InsertEnterpriseOrderBatch, type WorkSession, type InsertWorkSession, type VehicleTypeSetting, type InsertVehicleTypeSetting, type OrderCategorySetting, type InsertOrderCategorySetting, type WorkProofEvent, type InsertWorkProofEvent, type SettlementStatement, type InsertSettlementStatement, type ContractExecutionEvent, type InsertContractExecutionEvent, type Payment, type InsertPayment, type PaymentStatusEvent, type InsertPaymentStatusEvent, type ContractDocument, type InsertContractDocument, type IncidentAction, type InsertIncidentAction, type SettlementLineItem, type InsertSettlementLineItem, type InstructionLog, type InsertInstructionLog, type IncidentReport, type InsertIncidentReport, type IncidentEvidence, type InsertIncidentEvidence, type SubstituteRequest, type InsertSubstituteRequest, type TeamIncentive, type InsertTeamIncentive, type PriceConversionRule, type InsertPriceConversionRule, type DispatchRequest, type InsertDispatchRequest, type UserSanction, type InsertUserSanction, type QrScanLog, type InsertQrScanLog,
  type AdminRole, type InsertAdminRole, type AdminPermission, type InsertAdminPermission, 
  type AdminRolePermission, type InsertAdminRolePermission, type StaffRoleAssignment, type InsertStaffRoleAssignment,
  type CheckInRecord, type InsertCheckInRecord,
  type PushSubscription, type InsertPushSubscription,
  type FcmToken, type InsertFcmToken,
  type CustomerServiceInquiry, type InsertCustomerServiceInquiry,
  type TaxInvoice, type InsertTaxInvoice, 
  type IncentivePolicy, type InsertIncentivePolicy, 
  type IncentiveDetail, type InsertIncentiveDetail,
  type TeamQrCode, type InsertTeamQrCode,
  type CommissionPolicy, type InsertCommissionPolicy,
  type HelperCommissionOverride, type InsertHelperCommissionOverride,
  type Dispute, type InsertDispute,
  type RefreshToken,
  type DestinationPricing, type InsertDestinationPricing,
  type ColdChainSetting, type InsertColdChainSetting,
  type VirtualAccount, type InsertVirtualAccount,
  type PhoneVerificationCode, type InsertPhoneVerificationCode,
  type AuditLog, type InsertAuditLog,
  type ClientError, type InsertClientError,
  clientErrors,
  documents, documentReviews, reassignments, webhookLogs, identityVerifications, orderStatusEvents,
  orderCandidates, helperRatingSummary, contactShareEvents, orderClosureReports,
  costItemTypes, orderCostItems, carrierProofUploads, pricingSnapshots, balanceInvoices, payouts, payoutEvents,
  type Document, type InsertDocument,
  type DocumentReview, type InsertDocumentReview,
  type Reassignment, type InsertReassignment,
  type WebhookLog, type InsertWebhookLog,
  type IdentityVerification, type InsertIdentityVerification,
  type OrderStatusEvent, type InsertOrderStatusEvent,
  type OrderCandidate, type InsertOrderCandidate,
  type HelperRatingSummary, type InsertHelperRatingSummary,
  type ContactShareEvent, type InsertContactShareEvent,
  type OrderClosureReport, type InsertOrderClosureReport,
  type CostItemType, type InsertCostItemType,
  type OrderCostItem, type InsertOrderCostItem,
  type CarrierProofUpload, type InsertCarrierProofUpload,
  type PricingSnapshot, type InsertPricingSnapshot,
  type BalanceInvoice, type InsertBalanceInvoice,
  type Payout, type InsertPayout,
  type PayoutEvent, type InsertPayoutEvent,
  monthlySettlementStatements,
  type MonthlySettlementStatement, type InsertMonthlySettlementStatement,
  settingChangeHistory,
  type SettingChangeHistory, type InsertSettingChangeHistory } from "@shared/schema";
import { eq, and, desc, inArray, notInArray, gte, isNull, isNotNull, lte, sql, not, or } from "drizzle-orm";
import { ne } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // Auth
  createUser(user: InsertUser): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByDi(di: string): Promise<User | undefined>;
  getUserByKakaoId(kakaoId: string): Promise<User | undefined>;
  getUserByNaverId(naverId: string): Promise<User | undefined>;
  getUserByPersonalCode(code: string): Promise<User | undefined>;
  getUserByPhoneAndName(phoneNumber: string, name: string): Promise<User | undefined>;
  getUser(id: string): Promise<User | undefined>;

  // Helper credentials
  createHelperCredential(userId: string, credential: InsertHelperCredential): Promise<HelperCredential>;
  getHelperCredential(userId: string): Promise<HelperCredential | undefined>;
  getHelperCredentialById(id: number): Promise<HelperCredential | undefined>;
  updateHelperCredential(userId: string, updates: Partial<InsertHelperCredential>): Promise<HelperCredential>;

  // Helper vehicles
  createHelperVehicle(userId: string, vehicle: InsertHelperVehicle): Promise<HelperVehicle>;
  getHelperVehicle(userId: string): Promise<HelperVehicle | undefined>;
  updateHelperVehicle(userId: string, updates: Partial<InsertHelperVehicle>): Promise<HelperVehicle>;

  // Helper businesses
  createHelperBusiness(userId: string, business: InsertHelperBusiness): Promise<HelperBusiness>;
  getHelperBusiness(userId: string): Promise<HelperBusiness | undefined>;
  updateHelperBusiness(userId: string, updates: Partial<InsertHelperBusiness>): Promise<HelperBusiness>;

  // Requester businesses
  createRequesterBusiness(userId: string, business: InsertRequesterBusiness): Promise<RequesterBusiness>;
  getRequesterBusiness(userId: string): Promise<RequesterBusiness | undefined>;
  updateRequesterBusiness(userId: string, updates: Partial<InsertRequesterBusiness>): Promise<RequesterBusiness>;
  getAllRequesterBusinesses(): Promise<RequesterBusiness[]>;

  // Helper bank accounts
  createHelperBankAccount(userId: string, account: InsertHelperBankAccount): Promise<HelperBankAccount>;
  getHelperBankAccount(userId: string): Promise<HelperBankAccount | undefined>;
  updateHelperBankAccount(userId: string, updates: Partial<InsertHelperBankAccount>): Promise<HelperBankAccount>;

  // Helper licenses
  createHelperLicense(userId: string, license: InsertHelperLicense): Promise<HelperLicense>;
  getHelperLicense(userId: string): Promise<HelperLicense | undefined>;
  updateHelperLicense(userId: string, updates: Partial<InsertHelperLicense>): Promise<HelperLicense>;

  // Helper service areas
  getHelperServiceAreas(userId: string): Promise<HelperServiceArea[]>;
  setHelperServiceAreas(userId: string, areas: { region: string; district?: string }[]): Promise<HelperServiceArea[]>;

  // Helper terms agreements
  createHelperTermsAgreement(agreement: InsertHelperTermsAgreement): Promise<HelperTermsAgreement>;
  getHelperTermsAgreement(userId: string): Promise<HelperTermsAgreement | undefined>;

  // Requester service agreements
  createRequesterServiceAgreement(agreement: InsertRequesterServiceAgreement): Promise<RequesterServiceAgreement>;
  getRequesterServiceAgreement(userId: string): Promise<RequesterServiceAgreement | undefined>;
  getAllRequesterServiceAgreements(): Promise<RequesterServiceAgreement[]>;

  // Help posts
  getAllHelpPosts(): Promise<HelpPost[]>;
  getHelpPost(id: number): Promise<HelpPost | undefined>;
  createHelpPost(userId: string, post: InsertHelpPost): Promise<HelpPost>;
  updateHelpPost(id: number, updates: Partial<InsertHelpPost>): Promise<HelpPost>;

  // Orders
  getAllOrders(status?: string, options?: { includeHidden?: boolean }): Promise<Order[]>;
  getOrdersByRequesterId(requesterId: string, options?: { includeHidden?: boolean }): Promise<Order[]>;
  getOrdersByMatchedHelper(helperId: string): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, updates: Partial<InsertOrder>): Promise<Order>;
  getOrdersPendingAutoHide(): Promise<Order[]>;

  // Order applications
  getOrderApplications(orderId: number): Promise<OrderApplication[]>;
  getHelperApplications(helperId: string): Promise<OrderApplication[]>;
  getOrderApplication(orderId: number, helperId: string): Promise<OrderApplication | undefined>;
  createOrderApplication(application: InsertOrderApplication): Promise<OrderApplication>;
  updateOrderApplication(id: number, updates: Partial<InsertOrderApplication>): Promise<OrderApplication>;
  getHelperScheduledOrders(helperId: string): Promise<Order[]>;

  // Notifications
  getUserNotifications(userId: string): Promise<Notification[]>;
  getNotification(id: number): Promise<Notification | undefined>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification>;
  markAllNotificationsAsRead(userId: string): Promise<void>;

  // Notification logs (본사 서버 기록)
  createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog>;
  getAllNotificationLogs(): Promise<NotificationLog[]>;
  getNotificationLogsByUser(userId: string): Promise<NotificationLog[]>;
  markNotificationLogAsRead(id: number): Promise<NotificationLog>;
  markNotificationLogAsDelivered(id: number): Promise<NotificationLog>;

  // Check-in records (QR 기반 출근 기록)
  createCheckInRecord(record: InsertCheckInRecord): Promise<CheckInRecord>;
  getCheckInRecordsByHelper(helperId: string, fromDate?: Date): Promise<CheckInRecord[]>;
  getCheckInRecordsByRequester(requesterId: string, fromDate?: Date): Promise<CheckInRecord[]>;
  updateCheckInRecord(id: number, updates: Partial<InsertCheckInRecord>): Promise<CheckInRecord>;

  // User preferences (푸시 알림/위치 설정 및 기본 정보)
  updateUserPreferences(userId: string, updates: { pushEnabled?: boolean; locationConsent?: boolean; latitude?: string; longitude?: string; locationUpdatedAt?: Date; taxInvoiceEnabled?: boolean; phoneNumber?: string; email?: string; address?: string }): Promise<User>;

  // Contracts
  createContract(contract: InsertContract): Promise<Contract>;
  getContract(id: number): Promise<Contract | undefined>;
  getContractByOrderAndHelper(orderId: number, helperId: string): Promise<Contract | undefined>;
  getRequesterContracts(requesterId: string): Promise<Contract[]>;
  getHelperContracts(helperId: string): Promise<Contract[]>;
  updateContract(id: number, updates: Partial<InsertContract>): Promise<Contract>;

  // Work confirmations
  createWorkConfirmation(confirmation: InsertWorkConfirmation): Promise<WorkConfirmation>;
  getWorkConfirmation(id: number): Promise<WorkConfirmation | undefined>;
  getWorkConfirmationByContract(contractId: number): Promise<WorkConfirmation | undefined>;
  getWorkConfirmationsByOrder(orderId: number): Promise<WorkConfirmation[]>;
  updateWorkConfirmation(id: number, updates: Partial<InsertWorkConfirmation>): Promise<WorkConfirmation>;

  // Reviews
  createReview(review: InsertReview): Promise<Review>;
  getReview(id: number): Promise<Review | undefined>;
  getReviewByContract(contractId: number): Promise<Review | undefined>;
  getReviewByContractAndType(contractId: number, reviewerType: string): Promise<Review | undefined>;
  getReviewsByReviewer(reviewerId: string): Promise<Review[]>;
  getHelperReviews(helperId: string): Promise<Review[]>;
  getRequesterReviews(requesterId: string): Promise<Review[]>;
  getHelperAverageRating(helperId: string): Promise<number>;
  getRequesterAverageRating(requesterId: string): Promise<number>;
  
  // Order contracts
  getOrderContracts(orderId: number): Promise<Contract[]>;
  getOrderContract(orderId: number): Promise<Contract | null>;

  // Admin
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  updateUserRoles(id: string, updates: { isTeamLeader?: boolean; isHqStaff?: boolean }): Promise<User>;
  getOrders(): Promise<Order[]>;
  getAllContracts(): Promise<Contract[]>;
  getAllNotifications(): Promise<Notification[]>;
  getAllHelperCredentials(): Promise<HelperCredential[]>;
  getAllHelperVehicles(): Promise<HelperVehicle[]>;
  getAllHelperBusinesses(): Promise<HelperBusiness[]>;
  getAllHelperBankAccounts(): Promise<HelperBankAccount[]>;
  getAllHelperLicenses(): Promise<HelperLicense[]>;

  // Teams
  createTeam(team: InsertTeam): Promise<Team>;
  getTeam(id: number): Promise<Team | undefined>;
  getTeamByLeader(leaderId: string): Promise<Team | undefined>;
  getTeamByToken(token: string): Promise<Team | undefined>;
  getAllTeams(): Promise<Team[]>;
  updateTeam(id: number, updates: Partial<InsertTeam>): Promise<Team>;
  deleteTeam(id: number): Promise<void>;
  regenerateTeamQrToken(id: number): Promise<Team>;

  // Team members
  addTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  getTeamMembers(teamId: number): Promise<TeamMember[]>;
  getHelperTeam(helperId: string): Promise<{ team: Team; membership: TeamMember } | undefined>;
  getTeamMemberByUserId(userId: string): Promise<TeamMember | undefined>;
  updateTeamMember(id: number, updates: Partial<InsertTeamMember>): Promise<TeamMember>;
  removeTeamMember(teamId: number, helperId: string): Promise<void>;
  isHelperInTeam(teamId: number, helperId: string): Promise<boolean>;
  
  // Team QR codes
  getTeamQrCodes(teamId: number): Promise<TeamQrCode[]>;

  // Courier settings
  getAllCourierSettings(): Promise<CourierSetting[]>;
  getAllCourierSettingsIncludingDeleted(): Promise<CourierSetting[]>;
  getCourierSetting(id: number): Promise<CourierSetting | undefined>;
  getCourierSettingByName(name: string): Promise<CourierSetting | undefined>;
  getDefaultCourierSetting(): Promise<CourierSetting | undefined>;
  createCourierSetting(setting: InsertCourierSetting): Promise<CourierSetting>;
  updateCourierSetting(id: number, updates: Partial<InsertCourierSetting>): Promise<CourierSetting>;
  getCourierSettingById(id: number): Promise<CourierSetting | undefined>;
  getCourierSettingByCategory(category: string): Promise<CourierSetting | undefined>;
  updateCourierSettingsByCategory(category: string, updates: Partial<InsertCourierSetting>): Promise<void>;
  deleteCourierSetting(id: number): Promise<void>;

  // Courier tiered pricing
  getAllCourierTieredPricing(): Promise<CourierTieredPricing[]>;
  getCourierTieredPricingByCourier(courierId: number): Promise<CourierTieredPricing[]>;
  createCourierTieredPricing(tier: InsertCourierTieredPricing): Promise<CourierTieredPricing>;
  updateCourierTieredPricing(id: number, updates: Partial<InsertCourierTieredPricing>): Promise<CourierTieredPricing>;
  deleteCourierTieredPricing(id: number): Promise<void>;

  // Carrier rate items (택배사별 품목 단가)
  getAllCarrierRateItems(): Promise<CarrierRateItem[]>;
  getCarrierRateItemsByCourier(courierId: number): Promise<CarrierRateItem[]>;
  getCarrierRateItem(id: number): Promise<CarrierRateItem | undefined>;
  createCarrierRateItem(item: InsertCarrierRateItem): Promise<CarrierRateItem>;
  updateCarrierRateItem(id: number, updates: Partial<InsertCarrierRateItem>): Promise<CarrierRateItem>;
  deleteCarrierRateItem(id: number): Promise<void>;

  // Admin bank accounts (입금 통장 관리)
  getAllAdminBankAccounts(): Promise<AdminBankAccount[]>;
  getAdminBankAccountsByType(accountType: string): Promise<AdminBankAccount[]>;
  getAdminBankAccount(id: number): Promise<AdminBankAccount | undefined>;
  createAdminBankAccount(account: InsertAdminBankAccount): Promise<AdminBankAccount>;
  updateAdminBankAccount(id: number, updates: Partial<InsertAdminBankAccount>): Promise<AdminBankAccount>;
  deleteAdminBankAccount(id: number): Promise<void>;

  // Vehicle type settings
  getAllVehicleTypeSettings(): Promise<VehicleTypeSetting[]>;
  getVehicleTypeSetting(id: number): Promise<VehicleTypeSetting | undefined>;
  getVehicleTypeSettingByName(name: string): Promise<VehicleTypeSetting | undefined>;
  createVehicleTypeSetting(setting: InsertVehicleTypeSetting): Promise<VehicleTypeSetting>;
  updateVehicleTypeSetting(id: number, updates: Partial<InsertVehicleTypeSetting>): Promise<VehicleTypeSetting>;

  // Order category settings
  getAllOrderCategorySettings(): Promise<OrderCategorySetting[]>;
  getOrderCategorySetting(id: number): Promise<OrderCategorySetting | undefined>;
  getOrderCategorySettingByName(name: string): Promise<OrderCategorySetting | undefined>;
  createOrderCategorySetting(setting: InsertOrderCategorySetting): Promise<OrderCategorySetting>;
  updateOrderCategorySetting(id: number, updates: Partial<InsertOrderCategorySetting>): Promise<OrderCategorySetting>;

  // Team commission overrides
  getAllTeamCommissionOverrides(): Promise<TeamCommissionOverride[]>;
  getTeamCommissionOverride(teamId: number): Promise<TeamCommissionOverride | undefined>;
  createTeamCommissionOverride(override: InsertTeamCommissionOverride): Promise<TeamCommissionOverride>;
  updateTeamCommissionOverride(id: number, updates: Partial<InsertTeamCommissionOverride>): Promise<TeamCommissionOverride>;
  deleteTeamCommissionOverride(id: number): Promise<void>;

  // Commission policies (글로벌 수수료 정책)
  getAllCommissionPolicies(): Promise<CommissionPolicy[]>;
  getCommissionPolicy(policyType: string): Promise<CommissionPolicy | undefined>;
  createCommissionPolicy(policy: InsertCommissionPolicy): Promise<CommissionPolicy>;
  updateCommissionPolicy(id: number, updates: Partial<InsertCommissionPolicy>): Promise<CommissionPolicy>;

  // Helper commission overrides (헬퍼별 수수료)
  getAllHelperCommissionOverrides(): Promise<HelperCommissionOverride[]>;
  getHelperCommissionOverride(helperId: string): Promise<HelperCommissionOverride | undefined>;
  createHelperCommissionOverride(override: InsertHelperCommissionOverride): Promise<HelperCommissionOverride>;
  updateHelperCommissionOverride(id: number, updates: Partial<InsertHelperCommissionOverride>): Promise<HelperCommissionOverride>;
  deleteHelperCommissionOverride(id: number): Promise<void>;

  // 수수료율 조회 (우선순위: 헬퍼별 > 팀별 > 글로벌 기본값)
  getEffectiveCommissionRate(helperId: string): Promise<{ rate: number; source: string }>;

  // System settings
  getAllSystemSettings(): Promise<SystemSetting[]>;
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  upsertSystemSetting(key: string, value: string, description?: string): Promise<SystemSetting>;

  // Job postings
  getAllJobPostings(): Promise<JobPosting[]>;
  getJobPosting(id: number): Promise<JobPosting | undefined>;
  createJobPosting(posting: InsertJobPosting): Promise<JobPosting>;
  updateJobPosting(id: number, updates: Partial<InsertJobPosting>): Promise<JobPosting>;
  deleteJobPosting(id: number): Promise<void>;

  // Payment reminders
  getAllPaymentReminders(): Promise<PaymentReminder[]>;
  getPaymentReminder(id: number): Promise<PaymentReminder | undefined>;
  getPaymentRemindersByRequester(requesterId: string): Promise<PaymentReminder[]>;
  createPaymentReminder(reminder: InsertPaymentReminder): Promise<PaymentReminder>;
  updatePaymentReminder(id: number, updates: Partial<InsertPaymentReminder>): Promise<PaymentReminder>;
  deletePaymentReminder(id: number): Promise<void>;

  // Announcements
  getAllAnnouncements(): Promise<Announcement[]>;
  getAnnouncement(id: number): Promise<Announcement | undefined>;
  getAnnouncementsByTarget(targetAudience: string): Promise<Announcement[]>;
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  deleteAnnouncement(id: number): Promise<void>;
  addAnnouncementRecipient(recipient: InsertAnnouncementRecipient): Promise<AnnouncementRecipient>;
  getAnnouncementRecipients(announcementId: number): Promise<AnnouncementRecipient[]>;
  getUserAnnouncements(userId: string, userRole: string): Promise<Announcement[]>;
  getPopupAnnouncements(userRole: string): Promise<Announcement[]>;
  getBannerAnnouncements(userRole: string): Promise<Announcement[]>;

  // Job contracts (건별 전자계약)
  createJobContract(contract: InsertJobContract): Promise<JobContract>;
  getJobContract(id: number): Promise<JobContract | undefined>;
  getJobContractByOrder(orderId: number): Promise<JobContract | undefined>;
  getHelperJobContracts(helperId: string): Promise<JobContract[]>;
  updateJobContract(id: number, updates: Partial<InsertJobContract>): Promise<JobContract>;
  getAllJobContracts(): Promise<JobContract[]>;

  // Work sessions (근무 세션)
  createWorkSession(session: InsertWorkSession): Promise<WorkSession>;
  getWorkSession(id: number): Promise<WorkSession | undefined>;
  getWorkSessionByOrder(orderId: number): Promise<WorkSession | undefined>;
  getWorkSessionByOrderAndHelper(orderId: number, helperId: string): Promise<WorkSession | undefined>;
  getWorkSessionByContract(jobContractId: number): Promise<WorkSession | undefined>;
  updateWorkSession(id: number, updates: Partial<InsertWorkSession>): Promise<WorkSession>;
  getHelperWorkSessions(helperId: string): Promise<WorkSession[]>;

  // Work proof events (근무 증빙)
  createWorkProofEvent(event: InsertWorkProofEvent): Promise<WorkProofEvent>;
  getWorkProofEventsBySession(workSessionId: number): Promise<WorkProofEvent[]>;

  // Settlement statements (정산 명세서)
  createSettlementStatement(statement: InsertSettlementStatement): Promise<SettlementStatement>;
  getSettlementStatement(id: number): Promise<SettlementStatement | undefined>;
  getSettlementStatementByOrder(orderId: number): Promise<SettlementStatement | undefined>;
  getSettlementsByOrderId(orderId: number): Promise<SettlementStatement[]>;
  getHelperSettlementStatements(helperId: string): Promise<SettlementStatement[]>;
  updateSettlementStatement(id: number, updates: Partial<InsertSettlementStatement>): Promise<SettlementStatement>;
  getAllSettlementStatements(): Promise<SettlementStatement[]>;

  // Settlement line items (정산 항목)
  createSettlementLineItem(item: InsertSettlementLineItem): Promise<SettlementLineItem>;
  getSettlementLineItems(statementId: number): Promise<SettlementLineItem[]>;
  getSettlementLineItemByIncident(statementId: number, incidentId: number): Promise<SettlementLineItem | undefined>;
  updateSettlementLineItem(id: number, updates: Partial<InsertSettlementLineItem>): Promise<SettlementLineItem>;
  deleteSettlementLineItem(id: number): Promise<void>;

  // Instruction logs (지시 이력)
  createInstructionLog(log: InsertInstructionLog): Promise<InstructionLog>;
  getInstructionLogsByOrder(orderId: number): Promise<InstructionLog[]>;
  getInstructionLogsByContract(jobContractId: number): Promise<InstructionLog[]>;
  getAllInstructionLogs(): Promise<InstructionLog[]>;

  // Incident reports (사고/분쟁)
  createIncidentReport(report: InsertIncidentReport): Promise<IncidentReport>;
  getIncidentReport(id: number): Promise<IncidentReport | undefined>;
  getIncidentReportsByOrder(orderId: number): Promise<IncidentReport[]>;
  getIncidentReportsByUser(userId: string): Promise<IncidentReport[]>;
  updateIncidentReport(id: number, updates: Partial<InsertIncidentReport>): Promise<IncidentReport>;
  getAllIncidentReports(): Promise<IncidentReport[]>;

  // Incident evidence (사고 증빙)
  createIncidentEvidence(evidence: InsertIncidentEvidence): Promise<IncidentEvidence>;
  getIncidentEvidence(incidentId: number): Promise<IncidentEvidence[]>;

  // Substitute requests (대체근무 요청)
  createSubstituteRequest(request: InsertSubstituteRequest): Promise<SubstituteRequest>;
  getSubstituteRequest(id: number): Promise<SubstituteRequest | undefined>;
  getPendingSubstituteRequests(): Promise<SubstituteRequest[]>;
  getRequesterSubstituteRequests(requesterId: string): Promise<SubstituteRequest[]>;
  updateSubstituteRequest(id: number, updates: Partial<InsertSubstituteRequest>): Promise<SubstituteRequest>;
  getAllSubstituteRequests(): Promise<SubstituteRequest[]>;

  // Contract execution events (계약 실행 이벤트)
  createContractExecutionEvent(event: InsertContractExecutionEvent): Promise<ContractExecutionEvent>;
  getContractExecutionEvent(id: number): Promise<ContractExecutionEvent | undefined>;
  getContractExecutionEventsByContract(contractId: number, contractType: string): Promise<ContractExecutionEvent[]>;

  // Payments (결제)
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPayment(id: number): Promise<Payment | undefined>;
  getPaymentByContract(contractId: number): Promise<Payment | undefined>;
  getPaymentByJobContract(jobContractId: number): Promise<Payment | undefined>;
  getPaymentByProviderPaymentId(providerPaymentId: string): Promise<Payment | undefined>;
  updatePayment(id: number, updates: Partial<InsertPayment>): Promise<Payment>;
  getAllPayments(): Promise<Payment[]>;
  getAllSettlementStatements(): Promise<SettlementStatement[]>;

  // Payment status events (결제 상태 이벤트)
  createPaymentStatusEvent(event: InsertPaymentStatusEvent): Promise<PaymentStatusEvent>;
  getPaymentStatusEvents(paymentId: number): Promise<PaymentStatusEvent[]>;

  // Contract documents (계약서 문서)
  createContractDocument(document: InsertContractDocument): Promise<ContractDocument>;
  getContractDocument(id: number): Promise<ContractDocument | undefined>;
  getContractDocuments(contractId: number): Promise<ContractDocument[]>;
  getJobContractDocuments(jobContractId: number): Promise<ContractDocument[]>;

  // Incident actions (분쟁 처리 액션)
  createIncidentAction(action: InsertIncidentAction): Promise<IncidentAction>;
  getIncidentActions(incidentId: number): Promise<IncidentAction[]>;

  // User sanctions (사용자 제재)
  getAllUserSanctions(): Promise<UserSanction[]>;
  getUserSanction(id: number): Promise<UserSanction | undefined>;
  createUserSanction(sanction: InsertUserSanction): Promise<UserSanction>;
  updateUserSanction(id: number, updates: Partial<InsertUserSanction>): Promise<UserSanction>;

  // Team incentives (팀장 인센티브)
  getAllTeamIncentives(): Promise<TeamIncentive[]>;
  getTeamIncentive(id: number): Promise<TeamIncentive | undefined>;
  createTeamIncentive(incentive: InsertTeamIncentive): Promise<TeamIncentive>;
  updateTeamIncentive(id: number, updates: Partial<InsertTeamIncentive>): Promise<TeamIncentive>;

  // Dispatch requests (대행배차)
  getAllDispatchRequests(): Promise<DispatchRequest[]>;
  getDispatchRequest(id: number): Promise<DispatchRequest | undefined>;
  createDispatchRequest(request: InsertDispatchRequest): Promise<DispatchRequest>;
  updateDispatchRequest(id: number, updates: Partial<InsertDispatchRequest>): Promise<DispatchRequest>;

  // Enterprise accounts (본사 계약 업체)
  getAllEnterpriseAccounts(): Promise<EnterpriseAccount[]>;
  getEnterpriseAccount(id: number): Promise<EnterpriseAccount | undefined>;
  createEnterpriseAccount(account: InsertEnterpriseAccount): Promise<EnterpriseAccount>;
  updateEnterpriseAccount(id: number, updates: Partial<InsertEnterpriseAccount>): Promise<EnterpriseAccount>;

  // Enterprise order batches (본사 오더 배치)
  getAllEnterpriseOrderBatches(): Promise<EnterpriseOrderBatch[]>;
  getEnterpriseOrderBatch(id: number): Promise<EnterpriseOrderBatch | undefined>;
  createEnterpriseOrderBatch(batch: InsertEnterpriseOrderBatch): Promise<EnterpriseOrderBatch>;
  updateEnterpriseOrderBatch(id: number, updates: Partial<InsertEnterpriseOrderBatch>): Promise<EnterpriseOrderBatch>;

  // QR scan logs
  createQrScanLog(log: InsertQrScanLog): Promise<QrScanLog>;
  getAllQrScanLogs(): Promise<QrScanLog[]>;

  // Team QR codes (팀 QR 코드)
  getAllTeamQrCodes(): Promise<TeamQrCode[]>;
  getTeamQrCode(id: number): Promise<TeamQrCode | undefined>;
  getTeamQrCodeByCode(code: string): Promise<TeamQrCode | undefined>;
  createTeamQrCode(qr: InsertTeamQrCode): Promise<TeamQrCode>;
  updateTeamQrCode(id: number, updates: Partial<InsertTeamQrCode>): Promise<TeamQrCode>;
  revokeTeamQrCode(id: number): Promise<void>;
  
  // Transactional team leader assignment
  assignTeamLeaderTransactional(params: {
    helperId: string;
    teamName: string;
    teamQrToken: string;
    commissionRate: number;
  }): Promise<{ team: Team; qrCode: TeamQrCode }>;

  // RBAC - Admin Roles
  getAllAdminRoles(): Promise<AdminRole[]>;
  getAdminRole(id: number): Promise<AdminRole | undefined>;
  createAdminRole(role: InsertAdminRole): Promise<AdminRole>;
  updateAdminRole(id: number, updates: Partial<InsertAdminRole>): Promise<AdminRole>;
  deleteAdminRole(id: number): Promise<void>;
  
  // RBAC - Admin Permissions
  getAllAdminPermissions(): Promise<AdminPermission[]>;
  getAdminPermission(id: number): Promise<AdminPermission | undefined>;
  createAdminPermission(permission: InsertAdminPermission): Promise<AdminPermission>;
  deleteAdminPermission(id: number): Promise<void>;
  
  // RBAC - Role-Permission mapping
  getRolePermissions(roleId: number): Promise<AdminPermission[]>;
  assignPermissionToRole(roleId: number, permissionId: number): Promise<AdminRolePermission>;
  removePermissionFromRole(roleId: number, permissionId: number): Promise<void>;
  
  // RBAC - Staff Role Assignments
  getStaffRoleAssignments(userId: string): Promise<StaffRoleAssignment[]>;
  assignRoleToStaff(userId: string, roleId: number, assignedBy: string): Promise<StaffRoleAssignment>;
  removeRoleFromStaff(userId: string, roleId: number): Promise<void>;
  
  // RBAC - Permission Check
  getUserPermissions(userId: string): Promise<string[]>;

  // Customer Service Inquiries (고객센터 문의)
  getAllCustomerServiceInquiries(): Promise<CustomerServiceInquiry[]>;
  getCustomerServiceInquiry(id: number): Promise<CustomerServiceInquiry | undefined>;
  getCustomerServiceInquiriesByUser(userId: string): Promise<CustomerServiceInquiry[]>;
  createCustomerServiceInquiry(inquiry: InsertCustomerServiceInquiry): Promise<CustomerServiceInquiry>;
  updateCustomerServiceInquiry(id: number, updates: Partial<InsertCustomerServiceInquiry>): Promise<CustomerServiceInquiry>;

  // Tax Invoices (세금계산서)
  getAllTaxInvoices(): Promise<TaxInvoice[]>;
  getTaxInvoice(id: number): Promise<TaxInvoice | undefined>;
  getTaxInvoicesByHelper(helperId: string): Promise<TaxInvoice[]>;
  getTaxInvoicesByPeriod(period: string): Promise<TaxInvoice[]>;
  createTaxInvoice(invoice: InsertTaxInvoice): Promise<TaxInvoice>;
  updateTaxInvoice(id: number, updates: Partial<InsertTaxInvoice>): Promise<TaxInvoice>;

  // Incentive Policies (인센티브 정책)
  getAllIncentivePolicies(): Promise<IncentivePolicy[]>;
  getIncentivePolicy(teamId: number): Promise<IncentivePolicy | undefined>;
  createIncentivePolicy(policy: InsertIncentivePolicy): Promise<IncentivePolicy>;
  updateIncentivePolicy(id: number, updates: Partial<InsertIncentivePolicy>): Promise<IncentivePolicy>;

  // Incentive Details (인센티브 상세)
  getIncentiveDetails(incentiveId: number): Promise<IncentiveDetail[]>;
  createIncentiveDetail(detail: InsertIncentiveDetail): Promise<IncentiveDetail>;

  // Disputes (분쟁/이의제기)
  getAllDisputes(): Promise<Dispute[]>;
  getDispute(id: number): Promise<Dispute | undefined>;
  getDisputesByHelper(helperId: string): Promise<Dispute[]>;
  createDispute(dispute: InsertDispute): Promise<Dispute>;
  getDisputesByRequester(requesterId: string): Promise<Dispute[]>;
  getDisputesByOrder(orderId: number): Promise<Dispute[]>;
  updateDispute(id: number, updates: Partial<InsertDispute>): Promise<Dispute>;

  // Refresh tokens (토큰 갱신)
  createRefreshToken(userId: string, token: string, expiresAt: Date, deviceInfo?: string): Promise<RefreshToken>;
  getRefreshToken(token: string): Promise<RefreshToken | undefined>;
  revokeRefreshToken(token: string): Promise<void>;
  revokeAllUserRefreshTokens(userId: string): Promise<void>;
  cleanupExpiredRefreshTokens(): Promise<void>;

  // Destination Pricing (착지별/시간대별 단가)
  getAllDestinationPricing(): Promise<DestinationPricing[]>;
  getDestinationPricing(id: number): Promise<DestinationPricing | undefined>;
  getDestinationPricingByCategory(workCategory: string): Promise<DestinationPricing[]>;
  createDestinationPricing(pricing: InsertDestinationPricing): Promise<DestinationPricing>;
  updateDestinationPricing(id: number, updates: Partial<InsertDestinationPricing>): Promise<DestinationPricing>;
  deleteDestinationPricing(id: number): Promise<void>;

  // Cold Chain Settings (냉탑 최저가)
  getAllColdChainSettings(): Promise<ColdChainSetting[]>;
  getColdChainSetting(id: number): Promise<ColdChainSetting | undefined>;
  createColdChainSetting(setting: InsertColdChainSetting): Promise<ColdChainSetting>;
  updateColdChainSetting(id: number, updates: Partial<InsertColdChainSetting>): Promise<ColdChainSetting>;
  deleteColdChainSetting(id: number): Promise<void>;

  // Virtual Accounts (가상계좌)
  createVirtualAccount(account: InsertVirtualAccount): Promise<VirtualAccount>;
  getVirtualAccount(id: number): Promise<VirtualAccount | undefined>;
  getVirtualAccountByOrder(orderId: number): Promise<VirtualAccount | undefined>;
  getVirtualAccountByPaymentId(paymentId: string): Promise<VirtualAccount | undefined>;
  updateVirtualAccount(id: number, updates: Partial<InsertVirtualAccount>): Promise<VirtualAccount>;
  getUserVirtualAccounts(userId: string): Promise<VirtualAccount[]>;

  // Phone verification codes
  createPhoneVerificationCode(code: InsertPhoneVerificationCode): Promise<PhoneVerificationCode>;
  getRecentPhoneVerificationCodes(phoneNumber: string, withinSeconds: number): Promise<PhoneVerificationCode[]>;
  getRecentPhoneVerificationCodesByIp(ipAddress: string, withinSeconds: number): Promise<PhoneVerificationCode[]>;
  getValidPhoneVerificationCode(phoneNumber: string, purpose: string): Promise<PhoneVerificationCode | undefined>;
  markPhoneVerificationCodeUsed(id: number): Promise<void>;
  incrementPhoneVerificationAttempts(id: number): Promise<void>;

  // Client errors (클라이언트 에러)
  createClientError(error: InsertClientError): Promise<ClientError>;
  getAllClientErrors(filters?: { severity?: string; isResolved?: boolean; limit?: number }): Promise<ClientError[]>;
  getClientError(id: number): Promise<ClientError | undefined>;
  updateClientError(id: number, updates: Partial<InsertClientError>): Promise<ClientError>;

  // Documents (서류)
  getAllDocuments(filters?: { userId?: string; status?: string; docType?: string; limit?: number }): Promise<Document[]>;
  getUserDocuments(userId: string): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: number, updates: Partial<InsertDocument>): Promise<Document>;

  // Document Reviews (서류 검토)
  getAllDocumentReviews(): Promise<DocumentReview[]>;
  getDocumentReviews(documentId: number): Promise<DocumentReview[]>;
  createDocumentReview(review: InsertDocumentReview): Promise<DocumentReview>;

  // Reassignments (재배정)
  getAllReassignments(): Promise<Reassignment[]>;
  getOrderReassignments(orderId: number): Promise<Reassignment[]>;
  createReassignment(reassignment: InsertReassignment): Promise<Reassignment>;

  // Webhook Logs (웹훅 로그)
  getAllWebhookLogs(filters?: { source?: string; status?: string; limit?: number }): Promise<WebhookLog[]>;
  getWebhookLog(id: number): Promise<WebhookLog | undefined>;
  createWebhookLog(log: InsertWebhookLog): Promise<WebhookLog>;
  updateWebhookLog(id: number, updates: Partial<InsertWebhookLog>): Promise<WebhookLog>;

  // Identity Verifications (본인인증)
  getUserIdentityVerifications(userId: string): Promise<IdentityVerification[]>;
  createIdentityVerification(verification: InsertIdentityVerification): Promise<IdentityVerification>;
  updateIdentityVerification(id: number, updates: Partial<InsertIdentityVerification>): Promise<IdentityVerification>;

  // Order Status Events (오더 상태 이벤트)
  getOrderStatusEvents(orderId: number): Promise<OrderStatusEvent[]>;
  createOrderStatusEvent(event: InsertOrderStatusEvent): Promise<OrderStatusEvent>;

  // Monthly Settlement Statements (월 정산서)
  createMonthlySettlementStatement(data: InsertMonthlySettlementStatement): Promise<MonthlySettlementStatement>;
  getMonthlySettlementStatementsByHelper(helperId: string): Promise<MonthlySettlementStatement[]>;
  getMonthlySettlementStatementByHelperAndMonth(helperId: string, year: number, month: number): Promise<MonthlySettlementStatement | undefined>;
  getMonthlySettlementStatementById(id: number): Promise<MonthlySettlementStatement | undefined>;
  updateMonthlySettlementStatement(id: number, updates: Partial<InsertMonthlySettlementStatement>): Promise<MonthlySettlementStatement>;
  markMonthlyStatementViewed(id: number): Promise<MonthlySettlementStatement>;

  // Setting Change History (설정 변경 이력)
  createSettingChangeHistory(entry: InsertSettingChangeHistory): Promise<SettingChangeHistory>;
  getSettingChangeHistory(filters?: {
    settingType?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: SettingChangeHistory[]; total: number }>;
  getPendingChanges(beforeDate?: Date): Promise<SettingChangeHistory[]>;
  updateSettingChangeHistoryStatus(id: number, status: string, appliedAt?: Date): Promise<SettingChangeHistory>;
  getSettingChangeHistoryById(id: number): Promise<SettingChangeHistory | undefined>;
}

export class DatabaseStorage implements IStorage {
  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByDi(di: string): Promise<User | undefined> {
    const { hashForSearch } = await import("./utils/encryption");
    const hashedDi = hashForSearch(di);
    const [user] = await db.select().from(users).where(eq(users.identityDi, hashedDi));
    return user;
  }

  async getUserByKakaoId(kakaoId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.kakaoId, kakaoId));
    return user;
  }

  async getUserByNaverId(naverId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.naverId, naverId));
    return user;
  }

  async getUserByPersonalCode(code: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.personalCode, code));
    return user;
  }

  async getUserByPhoneAndName(phoneNumber: string, name: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      and(eq(users.phoneNumber, phoneNumber), eq(users.name, name), eq(users.isHqStaff, false))
    );
    return user;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createHelperCredential(userId: string, credential: InsertHelperCredential): Promise<HelperCredential> {
    const [created] = await db.insert(helperCredentials).values({ ...credential, userId }).returning();
    return created;
  }

  async getHelperCredential(userId: string): Promise<HelperCredential | undefined> {
    const [credential] = await db.select().from(helperCredentials).where(eq(helperCredentials.userId, userId));
    return credential;
  }

  async getHelperCredentialById(id: number): Promise<HelperCredential | undefined> {
    const [credential] = await db.select().from(helperCredentials).where(eq(helperCredentials.id, id));
    return credential;
  }

  async updateHelperCredential(userId: string, updates: Partial<InsertHelperCredential>): Promise<HelperCredential> {
    const [updated] = await db.update(helperCredentials).set(updates).where(eq(helperCredentials.userId, userId)).returning();
    return updated;
  }

  async createHelperVehicle(userId: string, vehicle: InsertHelperVehicle): Promise<HelperVehicle> {
    const [created] = await db.insert(helperVehicles).values({ ...vehicle, userId }).returning();
    return created;
  }

  async getHelperVehicle(userId: string): Promise<HelperVehicle | undefined> {
    const [vehicle] = await db.select().from(helperVehicles).where(eq(helperVehicles.userId, userId));
    return vehicle;
  }

  async updateHelperVehicle(userId: string, updates: Partial<InsertHelperVehicle>): Promise<HelperVehicle> {
    const [updated] = await db.update(helperVehicles).set(updates).where(eq(helperVehicles.userId, userId)).returning();
    return updated;
  }

  async createHelperBusiness(userId: string, business: InsertHelperBusiness): Promise<HelperBusiness> {
    const [created] = await db.insert(helperBusinesses).values({ ...business, userId }).returning();
    return created;
  }

  async getHelperBusiness(userId: string): Promise<HelperBusiness | undefined> {
    const [business] = await db.select().from(helperBusinesses).where(eq(helperBusinesses.userId, userId));
    return business;
  }

  async updateHelperBusiness(userId: string, updates: Partial<InsertHelperBusiness>): Promise<HelperBusiness> {
    const [updated] = await db.update(helperBusinesses).set(updates).where(eq(helperBusinesses.userId, userId)).returning();
    return updated;
  }

  async createRequesterBusiness(userId: string, business: InsertRequesterBusiness): Promise<RequesterBusiness> {
    const [created] = await db.insert(requesterBusinesses).values({ ...business, userId }).returning();
    return created;
  }

  async getRequesterBusiness(userId: string): Promise<RequesterBusiness | undefined> {
    const [business] = await db.select().from(requesterBusinesses).where(eq(requesterBusinesses.userId, userId));
    return business;
  }

  async updateRequesterBusiness(userId: string, updates: Partial<InsertRequesterBusiness>): Promise<RequesterBusiness> {
    const [updated] = await db.update(requesterBusinesses).set(updates).where(eq(requesterBusinesses.userId, userId)).returning();
    return updated;
  }

  async getAllRequesterBusinesses(): Promise<RequesterBusiness[]> {
    return await db.select().from(requesterBusinesses).orderBy(desc(requesterBusinesses.createdAt));
  }

  async createHelperBankAccount(userId: string, account: InsertHelperBankAccount): Promise<HelperBankAccount> {
    const [created] = await db.insert(helperBankAccounts).values({ ...account, userId }).returning();
    return created;
  }

  async getHelperBankAccount(userId: string): Promise<HelperBankAccount | undefined> {
    const [account] = await db.select().from(helperBankAccounts).where(eq(helperBankAccounts.userId, userId));
    return account;
  }

  async updateHelperBankAccount(userId: string, updates: Partial<InsertHelperBankAccount>): Promise<HelperBankAccount> {
    const [updated] = await db.update(helperBankAccounts).set(updates).where(eq(helperBankAccounts.userId, userId)).returning();
    return updated;
  }

  async createHelperLicense(userId: string, license: InsertHelperLicense): Promise<HelperLicense> {
    const [created] = await db.insert(helperLicenses).values({ ...license, userId }).returning();
    return created;
  }

  async getHelperLicense(userId: string): Promise<HelperLicense | undefined> {
    const [license] = await db.select().from(helperLicenses).where(eq(helperLicenses.userId, userId));
    return license;
  }

  async updateHelperLicense(userId: string, updates: Partial<InsertHelperLicense>): Promise<HelperLicense> {
    const [updated] = await db.update(helperLicenses).set(updates).where(eq(helperLicenses.userId, userId)).returning();
    return updated;
  }

  async getHelperServiceAreas(userId: string): Promise<HelperServiceArea[]> {
    return await db.select().from(helperServiceAreas).where(eq(helperServiceAreas.userId, userId));
  }

  async setHelperServiceAreas(userId: string, areas: { region: string; district?: string }[]): Promise<HelperServiceArea[]> {
    await db.delete(helperServiceAreas).where(eq(helperServiceAreas.userId, userId));
    if (areas.length === 0) return [];
    const created = await db.insert(helperServiceAreas)
      .values(areas.map(a => ({ userId, region: a.region, district: a.district || null })))
      .returning();
    return created;
  }

  async createHelperTermsAgreement(agreement: InsertHelperTermsAgreement): Promise<HelperTermsAgreement> {
    const [created] = await db.insert(helperTermsAgreements).values(agreement).returning();
    return created;
  }

  async getHelperTermsAgreement(userId: string): Promise<HelperTermsAgreement | undefined> {
    const [agreement] = await db.select().from(helperTermsAgreements).where(eq(helperTermsAgreements.userId, userId));
    return agreement;
  }

  async createRequesterServiceAgreement(agreement: InsertRequesterServiceAgreement): Promise<RequesterServiceAgreement> {
    const [created] = await db.insert(requesterServiceAgreements).values(agreement).returning();
    return created;
  }

  async getRequesterServiceAgreement(userId: string): Promise<RequesterServiceAgreement | undefined> {
    const [agreement] = await db.select().from(requesterServiceAgreements).where(eq(requesterServiceAgreements.userId, userId));
    return agreement;
  }

  async getAllRequesterServiceAgreements(): Promise<RequesterServiceAgreement[]> {
    return await db.select().from(requesterServiceAgreements);
  }

  async getAllHelpPosts(): Promise<HelpPost[]> {
    return await db.select().from(helpPosts);
  }

  async getHelpPost(id: number): Promise<HelpPost | undefined> {
    const [post] = await db.select().from(helpPosts).where(eq(helpPosts.id, id));
    return post;
  }

  async createHelpPost(userId: string, post: InsertHelpPost): Promise<HelpPost> {
    const [created] = await db.insert(helpPosts).values({ ...post, userId }).returning();
    return created;
  }

  async updateHelpPost(id: number, updates: Partial<InsertHelpPost>): Promise<HelpPost> {
    const [updated] = await db.update(helpPosts).set(updates).where(eq(helpPosts.id, id)).returning();
    return updated;
  }

  // Orders
  async getAllOrders(status?: string, options?: { includeHidden?: boolean }): Promise<Order[]> {
    const conditions: any[] = [];
    
    if (status) {
      conditions.push(eq(orders.status, status));
    }
    
    // Filter out hidden orders by default (24h after completion or expired)
    if (!options?.includeHidden) {
      conditions.push(isNull(orders.hiddenAt));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(orders).where(and(...conditions)).orderBy(desc(orders.createdAt));
    }
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }
  
  async getOrdersPendingAutoHide(): Promise<Order[]> {
    const now = new Date();
    return await db.select().from(orders)
      .where(and(
        isNotNull(orders.autoHideAt),
        isNull(orders.hiddenAt),
        lte(orders.autoHideAt, now)
      ))
      .orderBy(desc(orders.createdAt));
  }

  async getOrdersByRequesterId(requesterId: string, options?: { includeHidden?: boolean }): Promise<Order[]> {
    const conditions: any[] = [eq(orders.requesterId, requesterId)];
    
    // Filter out hidden orders by default
    if (!options?.includeHidden) {
      conditions.push(isNull(orders.hiddenAt));
    }
    
    return await db.select().from(orders).where(and(...conditions)).orderBy(desc(orders.createdAt));
  }

  async getOrdersByMatchedHelper(helperId: string): Promise<Order[]> {
    return await db.select().from(orders)
      .where(eq(orders.matchedHelperId, helperId))
      .orderBy(desc(orders.createdAt));
  }

  // T-03: 헬퍼 중복 접수 제한용 - 헬퍼의 활성 오더 조회
  async getHelperActiveOrders(helperId: string, activeStatuses: string[]): Promise<Order[]> {
    return await db.select().from(orders)
      .where(and(
        eq(orders.matchedHelperId, helperId),
        inArray(orders.status, activeStatuses)
      ))
      .orderBy(desc(orders.createdAt));

  }
  // 입차일 기준 매칭된 오더 조회 (중복 지원 방지용)
  async getHelperMatchedOrderByDate(helperId: string, scheduledDate: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders)
      .where(and(
        eq(orders.matchedHelperId, helperId),
        eq(orders.scheduledDate, scheduledDate),
        inArray(orders.status, ["scheduled", "in_progress", "closing_submitted"])
      ));
    return order;
  }

  // 입차일 기준 헬퍼의 applied 상태 지원 목록 조회 (자동 취소용)
  async getHelperAppliedApplicationsByDate(helperId: string, scheduledDate: string, excludeOrderId?: number): Promise<{ applicationId: number; orderId: number }[]> {
    let conditions = and(
      eq(orderApplications.helperId, helperId),
      eq(orders.scheduledDate, scheduledDate),
      eq(orderApplications.status, "applied")
    );
    if (excludeOrderId) {
      conditions = and(conditions, ne(orderApplications.orderId, excludeOrderId));
    }
    const results = await db.select({
      applicationId: orderApplications.id,
      orderId: orderApplications.orderId,
    })
    .from(orderApplications)
    .innerJoin(orders, eq(orderApplications.orderId, orders.id))
    .where(conditions);
    return results;
  }

  // 지원 자동 취소 (같은 날짜 다른 오더 매칭 시)
  async cancelApplicationsByIds(applicationIds: number[]): Promise<void> {
    if (applicationIds.length === 0) return;
    await db.update(orderApplications)
      .set({ status: "auto_cancelled" })
      .where(inArray(orderApplications.id, applicationIds));
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [created] = await db.insert(orders).values(order).returning();
    return created;
  }

  async updateOrder(id: number, updates: Partial<InsertOrder>): Promise<Order> {
    const [updated] = await db.update(orders).set(updates).where(eq(orders.id, id)).returning();
    return updated;
  }

  async deleteOrder(id: number): Promise<void> {
    await db.delete(orderApplications).where(eq(orderApplications.orderId, id));
    await db.delete(orders).where(eq(orders.id, id));
  }

  // Order applications
  async getOrderApplications(orderId: number): Promise<OrderApplication[]> {
    return await db.select().from(orderApplications).where(eq(orderApplications.orderId, orderId));
  }

  async getHelperApplications(helperId: string): Promise<OrderApplication[]> {
    return await db.select().from(orderApplications).where(
      and(
        eq(orderApplications.helperId, helperId),
        notInArray(orderApplications.status, ["auto_cancelled", "rejected", "cancelled", "withdrawn"])
      )
    );
  }

  async getOrderApplication(orderId: number, helperId: string): Promise<OrderApplication | undefined> {
    const [application] = await db.select().from(orderApplications)
      .where(and(eq(orderApplications.orderId, orderId), eq(orderApplications.helperId, helperId)));
    return application;
  }

  async createOrderApplication(application: InsertOrderApplication): Promise<OrderApplication> {
    const [created] = await db.insert(orderApplications).values(application).returning();
    return created;
  }

  async updateOrderApplication(id: number, updates: Partial<InsertOrderApplication>): Promise<OrderApplication> {
    const [updated] = await db.update(orderApplications).set(updates).where(eq(orderApplications.id, id)).returning();
    return updated;
  }

  async getHelperScheduledOrders(helperId: string): Promise<Order[]> {
    try {
      // 방법 1: matchedHelperId로 직접 배정된 오더
      const directOrders = await db.select().from(orders)
        .where(and(
          eq(orders.matchedHelperId, helperId),
          inArray(orders.status, ["scheduled", "in_progress", "checked_in", "closing_submitted"])
        ));
      
      // 방법 2: 지원 후 선정된 오더 (selected 상태)
      const applications = await db.select().from(orderApplications)
        .where(and(eq(orderApplications.helperId, helperId), eq(orderApplications.status, "selected")));
      
      if (applications.length === 0) return directOrders;
      
      const orderIds = applications.map(a => a.orderId);
      if (orderIds.length === 0) return directOrders;
      
      const selectedOrders = await db.select().from(orders)
        .where(and(
          inArray(orders.id, orderIds),
          inArray(orders.status, ["scheduled", "in_progress", "checked_in", "closing_submitted"])
        ));
      
      // 중복 제거 후 합치기
      const allOrders = [...directOrders];
      selectedOrders.forEach(order => {
        if (!allOrders.find(o => o.id === order.id)) {
          allOrders.push(order);
        }
      });
      
      return allOrders;
    } catch (error) {
      console.error("Error in getHelperScheduledOrders:", error);
      throw error;
    }
  }

  // Notifications
  async getUserNotifications(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async getNotification(id: number): Promise<Notification | undefined> {
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notification;
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const unread = await db.select().from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return unread.length;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async markNotificationAsRead(id: number): Promise<Notification> {
    const [updated] = await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id)).returning();
    return updated;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
  }

  // Notification logs (본사 서버 기록)
  async createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog> {
    const [created] = await db.insert(notificationLogs).values(log).returning();
    return created;
  }

  async getAllNotificationLogs(): Promise<NotificationLog[]> {
    return await db.select().from(notificationLogs).orderBy(desc(notificationLogs.sentAt));
  }

  async getNotificationLogsByUser(userId: string): Promise<NotificationLog[]> {
    return await db.select().from(notificationLogs).where(eq(notificationLogs.userId, userId)).orderBy(desc(notificationLogs.sentAt));
  }

  async markNotificationLogAsRead(id: number): Promise<NotificationLog> {
    const [updated] = await db.update(notificationLogs).set({ isRead: true, readAt: new Date() }).where(eq(notificationLogs.id, id)).returning();
    return updated;
  }

  async markNotificationLogAsDelivered(id: number): Promise<NotificationLog> {
    const [updated] = await db.update(notificationLogs).set({ isDelivered: true }).where(eq(notificationLogs.id, id)).returning();
    return updated;
  }

  // Check-in records (QR 기반 출근 기록)
  async createCheckInRecord(record: InsertCheckInRecord): Promise<CheckInRecord> {
    const [created] = await db.insert(checkInRecords).values(record).returning();
    return created;
  }

  async getCheckInRecordsByHelper(helperId: string, fromDate?: Date): Promise<CheckInRecord[]> {
    if (fromDate) {
      return await db.select().from(checkInRecords)
        .where(and(eq(checkInRecords.helperId, helperId), gte(checkInRecords.checkInTime, fromDate)))
        .orderBy(desc(checkInRecords.checkInTime));
    }
    return await db.select().from(checkInRecords)
      .where(eq(checkInRecords.helperId, helperId))
      .orderBy(desc(checkInRecords.checkInTime));
  }

  async getCheckInRecordsByRequester(requesterId: string, fromDate?: Date): Promise<CheckInRecord[]> {
    if (fromDate) {
      return await db.select().from(checkInRecords)
        .where(and(eq(checkInRecords.requesterId, requesterId), gte(checkInRecords.checkInTime, fromDate)))
        .orderBy(desc(checkInRecords.checkInTime));
    }
    return await db.select().from(checkInRecords)
      .where(eq(checkInRecords.requesterId, requesterId))
      .orderBy(desc(checkInRecords.checkInTime));
  }

  async updateCheckInRecord(id: number, updates: Partial<InsertCheckInRecord>): Promise<CheckInRecord> {
    const [updated] = await db.update(checkInRecords).set(updates).where(eq(checkInRecords.id, id)).returning();
    return updated;
  }

  // User preferences (푸시 알림/위치 설정 및 기본 정보)
  async updateUserPreferences(userId: string, updates: { pushEnabled?: boolean; locationConsent?: boolean; latitude?: string; longitude?: string; locationUpdatedAt?: Date; taxInvoiceEnabled?: boolean; phoneNumber?: string; email?: string; address?: string }): Promise<User> {
    const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
    return updated;
  }

  // Contracts
  async createContract(contract: InsertContract): Promise<Contract> {
    const [created] = await db.insert(contracts).values(contract).returning();
    return created;
  }

  async getContract(id: number): Promise<Contract | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    return contract;
  }

  async getContractByOrderAndHelper(orderId: number, helperId: string): Promise<Contract | undefined> {
    const [contract] = await db.select().from(contracts)
      .where(and(eq(contracts.orderId, orderId), eq(contracts.helperId, helperId)));
    return contract;
  }

  async getRequesterContracts(requesterId: string): Promise<Contract[]> {
    return await db.select().from(contracts)
      .where(eq(contracts.requesterId, requesterId))
      .orderBy(desc(contracts.createdAt));
  }

  async getHelperContracts(helperId: string): Promise<Contract[]> {
    return await db.select().from(contracts)
      .where(eq(contracts.helperId, helperId))
      .orderBy(desc(contracts.createdAt));
  }

  async updateContract(id: number, updates: Partial<InsertContract>): Promise<Contract> {
    const [updated] = await db.update(contracts).set(updates).where(eq(contracts.id, id)).returning();
    return updated;
  }

  // Work confirmations
  async createWorkConfirmation(confirmation: InsertWorkConfirmation): Promise<WorkConfirmation> {
    const [created] = await db.insert(workConfirmations).values(confirmation).returning();
    return created;
  }

  async getWorkConfirmation(id: number): Promise<WorkConfirmation | undefined> {
    const [confirmation] = await db.select().from(workConfirmations).where(eq(workConfirmations.id, id));
    return confirmation;
  }

  async getWorkConfirmationByContract(contractId: number): Promise<WorkConfirmation | undefined> {
    const [confirmation] = await db.select().from(workConfirmations)
      .where(eq(workConfirmations.contractId, contractId));
    return confirmation;
  }

  async getWorkConfirmationsByOrder(orderId: number): Promise<WorkConfirmation[]> {
    return await db.select().from(workConfirmations)
      .where(eq(workConfirmations.orderId, orderId))
      .orderBy(desc(workConfirmations.createdAt));
  }

  async updateWorkConfirmation(id: number, updates: Partial<InsertWorkConfirmation>): Promise<WorkConfirmation> {
    const [updated] = await db.update(workConfirmations).set(updates).where(eq(workConfirmations.id, id)).returning();
    return updated;
  }

  // Reviews
  async createReview(review: InsertReview): Promise<Review> {
    const [created] = await db.insert(reviews).values(review).returning();
    return created;
  }

  async getReview(id: number): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id));
    return review;
  }

  async getReviewByContract(contractId: number): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.contractId, contractId));
    return review;
  }

  async getReviewByContractAndType(contractId: number, reviewerType: string): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews)
      .where(and(eq(reviews.contractId, contractId), eq(reviews.reviewerType, reviewerType)));
    return review;
  }

  async getHelperReviews(helperId: string): Promise<Review[]> {
    // Reviews where helpers are being reviewed (by requesters)
    return await db.select().from(reviews)
      .where(and(eq(reviews.helperId, helperId), eq(reviews.reviewerType, "requester")))
      .orderBy(desc(reviews.createdAt));
  }

  async getRequesterReviews(requesterId: string): Promise<Review[]> {
    // Reviews where requesters are being reviewed (by helpers)
    return await db.select().from(reviews)
      .where(and(eq(reviews.requesterId, requesterId), eq(reviews.reviewerType, "helper")))
      .orderBy(desc(reviews.createdAt));
  }

  async getHelperAverageRating(helperId: string): Promise<number> {
    const helperReviews = await this.getHelperReviews(helperId);
    if (helperReviews.length === 0) return 0;
    const sum = helperReviews.reduce((acc, r) => acc + r.rating, 0);
    return sum / helperReviews.length;
  }

  async getRequesterAverageRating(requesterId: string): Promise<number> {
    const requesterReviews = await this.getRequesterReviews(requesterId);
    if (requesterReviews.length === 0) return 0;
    const sum = requesterReviews.reduce((acc, r) => acc + r.rating, 0);
    return sum / requesterReviews.length;
  }

  async getReviewsByReviewer(reviewerId: string): Promise<Review[]> {
    return await db.select().from(reviews)
      .where(eq(reviews.requesterId, reviewerId))
      .orderBy(desc(reviews.createdAt));
  }

  async getOrderContracts(orderId: number): Promise<Contract[]> {
    return await db.select().from(contracts)
      .where(eq(contracts.orderId, orderId))
      .orderBy(desc(contracts.createdAt));
  }

  async getOrderContract(orderId: number): Promise<Contract | null> {
    const results = await db.select().from(contracts)
      .where(eq(contracts.orderId, orderId))
      .orderBy(desc(contracts.createdAt))
      .limit(1);
    return results[0] || null;
  }

  // Admin methods
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updated;
  }

  async getOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getAllContracts(): Promise<Contract[]> {
    return await db.select().from(contracts).orderBy(desc(contracts.createdAt));
  }

  async getAllNotifications(): Promise<Notification[]> {
    return await db.select().from(notifications).orderBy(desc(notifications.createdAt));
  }

  async getAllHelperCredentials(): Promise<HelperCredential[]> {
    return await db.select().from(helperCredentials).orderBy(desc(helperCredentials.createdAt));
  }

  async getAllHelperVehicles(): Promise<HelperVehicle[]> {
    return await db.select().from(helperVehicles).orderBy(desc(helperVehicles.createdAt));
  }

  async getAllHelperBusinesses(): Promise<HelperBusiness[]> {
    return await db.select().from(helperBusinesses).orderBy(desc(helperBusinesses.createdAt));
  }

  async getAllHelperBankAccounts(): Promise<HelperBankAccount[]> {
    return await db.select().from(helperBankAccounts).orderBy(desc(helperBankAccounts.createdAt));
  }

  async getAllHelperLicenses(): Promise<HelperLicense[]> {
    return await db.select().from(helperLicenses).orderBy(desc(helperLicenses.createdAt));
  }

  async updateUserRoles(id: string, updates: { isTeamLeader?: boolean; isHqStaff?: boolean }): Promise<User> {
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updated;
  }

  // Teams
  async createTeam(team: InsertTeam): Promise<Team> {
    const [created] = await db.insert(teams).values(team).returning();
    return created;
  }

  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async getTeamByLeader(leaderId: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.leaderId, leaderId));
    return team;
  }

  async getTeamByToken(token: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.qrCodeToken, token));
    return team;
  }

  async getAllTeams(): Promise<Team[]> {
    return await db.select().from(teams).orderBy(desc(teams.createdAt));
  }

  async updateTeam(id: number, updates: Partial<InsertTeam>): Promise<Team> {
    const [updated] = await db.update(teams).set(updates).where(eq(teams.id, id)).returning();
    return updated;
  }

  async deleteTeam(id: number): Promise<void> {
    await db.delete(teams).where(eq(teams.id, id));
  }

  async regenerateTeamQrToken(id: number): Promise<Team> {
    const newToken = randomUUID();
    const [updated] = await db.update(teams).set({ qrCodeToken: newToken }).where(eq(teams.id, id)).returning();
    return updated;
  }

  // Team members
  async addTeamMember(member: InsertTeamMember): Promise<TeamMember> {
    const [created] = await db.insert(teamMembers).values(member).returning();
    return created;
  }

  async getTeamMembers(teamId: number): Promise<TeamMember[]> {
    return await db.select().from(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.isActive, true)));
  }

  async getHelperTeam(helperId: string): Promise<{ team: Team; membership: TeamMember } | undefined> {
    const [membership] = await db.select().from(teamMembers)
      .where(and(eq(teamMembers.helperId, helperId), eq(teamMembers.isActive, true)));
    if (!membership) return undefined;
    const team = await this.getTeam(membership.teamId);
    if (!team) return undefined;
    return { team, membership };
  }

  async removeTeamMember(teamId: number, helperId: string): Promise<void> {
    await db.update(teamMembers)
      .set({ isActive: false })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.helperId, helperId)));
  }

  async isHelperInTeam(teamId: number, helperId: string): Promise<boolean> {
    const [member] = await db.select().from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.helperId, helperId), eq(teamMembers.isActive, true)));
    return !!member;
  }

  async getTeamMemberByUserId(userId: string): Promise<TeamMember | undefined> {
    const [member] = await db.select().from(teamMembers)
      .where(and(eq(teamMembers.helperId, userId), eq(teamMembers.isActive, true)));
    return member;
  }

  async updateTeamMember(id: number, updates: Partial<InsertTeamMember>): Promise<TeamMember> {
    const [updated] = await db.update(teamMembers)
      .set(updates)
      .where(eq(teamMembers.id, id))
      .returning();
    return updated;
  }

  async getTeamQrCodes(teamId: number): Promise<TeamQrCode[]> {
    return await db.select().from(teamQrCodes).where(eq(teamQrCodes.teamId, teamId));
  }

  // Courier settings
  async getAllCourierSettings(): Promise<CourierSetting[]> {
    return await db.select().from(courierSettings)
      .where(isNull(courierSettings.deletedAt))
      .orderBy(courierSettings.sortOrder, courierSettings.courierName);
  }

  async getAllCourierSettingsIncludingDeleted(): Promise<CourierSetting[]> {
    return await db.select().from(courierSettings)
      .orderBy(courierSettings.sortOrder, courierSettings.courierName);
  }

  async getCourierSetting(id: number): Promise<CourierSetting | undefined> {
    const [setting] = await db.select().from(courierSettings).where(eq(courierSettings.id, id));
    return setting;
  }

  async getCourierSettingByName(name: string): Promise<CourierSetting | undefined> {
    const [setting] = await db.select().from(courierSettings).where(eq(courierSettings.courierName, name));
    return setting;
  }

  async getDefaultCourierSetting(): Promise<CourierSetting | undefined> {
    const [setting] = await db.select().from(courierSettings).where(eq(courierSettings.isDefault, true));
    return setting;
  }

  async createCourierSetting(setting: InsertCourierSetting): Promise<CourierSetting> {
    const [created] = await db.insert(courierSettings).values(setting).returning();
    return created;
  }

  async updateCourierSetting(id: number, updates: Partial<InsertCourierSetting>): Promise<CourierSetting> {
    const [updated] = await db.update(courierSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(courierSettings.id, id))
      .returning();
    return updated;
  }

  async deleteCourierSetting(id: number): Promise<void> {
    await db.update(courierSettings)
      .set({ deletedAt: new Date() })
      .where(eq(courierSettings.id, id));
  }

  async getCourierSettingById(id: number): Promise<CourierSetting | undefined> {
    const [setting] = await db.select().from(courierSettings).where(eq(courierSettings.id, id));
    return setting;
  }

  async getCourierSettingByCategory(category: string): Promise<CourierSetting | undefined> {
    const [setting] = await db.select().from(courierSettings)
      .where(and(
        eq(courierSettings.category, category),
        sql`courier_name LIKE '(DEFAULT)%'`
      ));
    return setting;
  }

  async updateCourierSettingsByCategory(category: string, updates: Partial<InsertCourierSetting>): Promise<void> {
    await db.update(courierSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(courierSettings.category, category),
        not(sql`courier_name LIKE '(DEFAULT)%'`)
      ));
  }

  // Courier tiered pricing
  async getAllCourierTieredPricing(): Promise<CourierTieredPricing[]> {
    return await db.select().from(courierTieredPricing).orderBy(courierTieredPricing.courierId, courierTieredPricing.minBoxCount);
  }

  async getCourierTieredPricingByCourier(courierId: number): Promise<CourierTieredPricing[]> {
    return await db.select().from(courierTieredPricing)
      .where(eq(courierTieredPricing.courierId, courierId))
      .orderBy(courierTieredPricing.minBoxCount);
  }

  async createCourierTieredPricing(tier: InsertCourierTieredPricing): Promise<CourierTieredPricing> {
    const [created] = await db.insert(courierTieredPricing).values(tier as any).returning();
    return created;
  }

  async updateCourierTieredPricing(id: number, updates: Partial<InsertCourierTieredPricing>): Promise<CourierTieredPricing> {
    const [updated] = await db.update(courierTieredPricing)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(courierTieredPricing.id, id))
      .returning();
    return updated;
  }

  async deleteCourierTieredPricing(id: number): Promise<void> {
    await db.delete(courierTieredPricing).where(eq(courierTieredPricing.id, id));
  }

  // Carrier rate items (택배사별 품목 단가)
  async getAllCarrierRateItems(): Promise<CarrierRateItem[]> {
    return await db.select().from(carrierRateItems).orderBy(carrierRateItems.displayOrder);
  }

  async getCarrierRateItemsByCourier(courierId: number): Promise<CarrierRateItem[]> {
    return await db.select().from(carrierRateItems)
      .where(and(eq(carrierRateItems.courierId, courierId), eq(carrierRateItems.isActive, true)))
      .orderBy(carrierRateItems.displayOrder);
  }

  async getCarrierRateItem(id: number): Promise<CarrierRateItem | undefined> {
    const [item] = await db.select().from(carrierRateItems).where(eq(carrierRateItems.id, id));
    return item;
  }

  async createCarrierRateItem(item: InsertCarrierRateItem): Promise<CarrierRateItem> {
    const [created] = await db.insert(carrierRateItems).values(item).returning();
    return created;
  }

  async updateCarrierRateItem(id: number, updates: Partial<InsertCarrierRateItem>): Promise<CarrierRateItem> {
    const [updated] = await db.update(carrierRateItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(carrierRateItems.id, id))
      .returning();
    return updated;
  }

  async deleteCarrierRateItem(id: number): Promise<void> {
    await db.delete(carrierRateItems).where(eq(carrierRateItems.id, id));
  }

  // Admin bank accounts (입금 통장 관리)
  async getAllAdminBankAccounts(): Promise<AdminBankAccount[]> {
    return await db.select().from(adminBankAccounts).orderBy(adminBankAccounts.accountType, adminBankAccounts.displayOrder);
  }

  async getAdminBankAccountsByType(accountType: string): Promise<AdminBankAccount[]> {
    return await db.select().from(adminBankAccounts)
      .where(and(eq(adminBankAccounts.accountType, accountType), eq(adminBankAccounts.isActive, true)))
      .orderBy(adminBankAccounts.displayOrder);
  }

  async getAdminBankAccount(id: number): Promise<AdminBankAccount | undefined> {
    const [account] = await db.select().from(adminBankAccounts).where(eq(adminBankAccounts.id, id));
    return account;
  }

  async createAdminBankAccount(account: InsertAdminBankAccount): Promise<AdminBankAccount> {
    const [created] = await db.insert(adminBankAccounts).values(account).returning();
    return created;
  }

  async updateAdminBankAccount(id: number, updates: Partial<InsertAdminBankAccount>): Promise<AdminBankAccount> {
    const [updated] = await db.update(adminBankAccounts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(adminBankAccounts.id, id))
      .returning();
    return updated;
  }

  async deleteAdminBankAccount(id: number): Promise<void> {
    await db.delete(adminBankAccounts).where(eq(adminBankAccounts.id, id));
  }

  // Vehicle type settings
  async getAllVehicleTypeSettings(): Promise<VehicleTypeSetting[]> {
    return await db.select().from(vehicleTypeSettings).orderBy(vehicleTypeSettings.sortOrder);
  }

  async getVehicleTypeSetting(id: number): Promise<VehicleTypeSetting | undefined> {
    const [setting] = await db.select().from(vehicleTypeSettings).where(eq(vehicleTypeSettings.id, id));
    return setting;
  }

  async getVehicleTypeSettingByName(name: string): Promise<VehicleTypeSetting | undefined> {
    const [setting] = await db.select().from(vehicleTypeSettings).where(eq(vehicleTypeSettings.vehicleTypeName, name));
    return setting;
  }

  async createVehicleTypeSetting(setting: InsertVehicleTypeSetting): Promise<VehicleTypeSetting> {
    const [created] = await db.insert(vehicleTypeSettings).values(setting).returning();
    return created;
  }

  async updateVehicleTypeSetting(id: number, updates: Partial<InsertVehicleTypeSetting>): Promise<VehicleTypeSetting> {
    const [updated] = await db.update(vehicleTypeSettings)
      .set(updates)
      .where(eq(vehicleTypeSettings.id, id))
      .returning();
    return updated;
  }

  async deleteVehicleTypeSetting(id: number): Promise<void> {
    await db.delete(vehicleTypeSettings).where(eq(vehicleTypeSettings.id, id));
  }

  // Order category settings
  async getAllOrderCategorySettings(): Promise<OrderCategorySetting[]> {
    return await db.select().from(orderCategorySettings).orderBy(orderCategorySettings.sortOrder);
  }

  async getOrderCategorySetting(id: number): Promise<OrderCategorySetting | undefined> {
    const [setting] = await db.select().from(orderCategorySettings).where(eq(orderCategorySettings.id, id));
    return setting;
  }

  async getOrderCategorySettingByName(name: string): Promise<OrderCategorySetting | undefined> {
    const [setting] = await db.select().from(orderCategorySettings).where(eq(orderCategorySettings.categoryName, name));
    return setting;
  }

  async createOrderCategorySetting(setting: InsertOrderCategorySetting): Promise<OrderCategorySetting> {
    const [created] = await db.insert(orderCategorySettings).values(setting).returning();
    return created;
  }

  async updateOrderCategorySetting(id: number, updates: Partial<InsertOrderCategorySetting>): Promise<OrderCategorySetting> {
    const [updated] = await db.update(orderCategorySettings)
      .set(updates)
      .where(eq(orderCategorySettings.id, id))
      .returning();
    return updated;
  }

  async deleteOrderCategorySetting(id: number): Promise<void> {
    await db.delete(orderCategorySettings).where(eq(orderCategorySettings.id, id));
  }

  // Team commission overrides
  async getAllTeamCommissionOverrides(): Promise<TeamCommissionOverride[]> {
    return await db.select().from(teamCommissionOverrides).orderBy(desc(teamCommissionOverrides.updatedAt));
  }

  async getTeamCommissionOverride(teamId: number): Promise<TeamCommissionOverride | undefined> {
    const [override] = await db.select().from(teamCommissionOverrides).where(eq(teamCommissionOverrides.teamId, teamId));
    return override;
  }

  async createTeamCommissionOverride(override: InsertTeamCommissionOverride): Promise<TeamCommissionOverride> {
    const [created] = await db.insert(teamCommissionOverrides).values(override).returning();
    return created;
  }

  async updateTeamCommissionOverride(id: number, updates: Partial<InsertTeamCommissionOverride>): Promise<TeamCommissionOverride> {
    const [updated] = await db.update(teamCommissionOverrides)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(teamCommissionOverrides.id, id))
      .returning();
    return updated;
  }

  async deleteTeamCommissionOverride(id: number): Promise<void> {
    await db.delete(teamCommissionOverrides).where(eq(teamCommissionOverrides.id, id));
  }

  // Commission policies (글로벌 수수료 정책)
  async getAllCommissionPolicies(): Promise<CommissionPolicy[]> {
    return await db.select().from(commissionPolicies).orderBy(desc(commissionPolicies.updatedAt));
  }

  async getCommissionPolicy(policyType: string): Promise<CommissionPolicy | undefined> {
    const [policy] = await db.select().from(commissionPolicies)
      .where(and(eq(commissionPolicies.policyType, policyType), eq(commissionPolicies.isActive, true)));
    return policy;
  }

  async createCommissionPolicy(policy: InsertCommissionPolicy): Promise<CommissionPolicy> {
    const [created] = await db.insert(commissionPolicies).values(policy).returning();
    return created;
  }

  async updateCommissionPolicy(id: number, updates: Partial<InsertCommissionPolicy>): Promise<CommissionPolicy> {
    const [updated] = await db.update(commissionPolicies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(commissionPolicies.id, id))
      .returning();
    return updated;
  }

  // Helper commission overrides (헬퍼별 수수료)
  async getAllHelperCommissionOverrides(): Promise<HelperCommissionOverride[]> {
    return await db.select().from(helperCommissionOverrides).orderBy(desc(helperCommissionOverrides.updatedAt));
  }

  async getHelperCommissionOverride(helperId: string): Promise<HelperCommissionOverride | undefined> {
    const [override] = await db.select().from(helperCommissionOverrides)
      .where(eq(helperCommissionOverrides.helperId, helperId));
    return override;
  }

  async createHelperCommissionOverride(override: InsertHelperCommissionOverride): Promise<HelperCommissionOverride> {
    const [created] = await db.insert(helperCommissionOverrides).values(override).returning();
    return created;
  }

  async updateHelperCommissionOverride(id: number, updates: Partial<InsertHelperCommissionOverride>): Promise<HelperCommissionOverride> {
    const [updated] = await db.update(helperCommissionOverrides)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(helperCommissionOverrides.id, id))
      .returning();
    return updated;
  }

  async deleteHelperCommissionOverride(id: number): Promise<void> {
    await db.delete(helperCommissionOverrides).where(eq(helperCommissionOverrides.id, id));
  }

  // 수수료율 조회 (우선순위: 헬퍼별 > 팀별 > 글로벌 기본값)
  // 반환: totalRate(총 수수료), platformRate(본사), teamLeaderRate(팀장), teamLeaderId
  async getEffectiveCommissionRate(helperId: string): Promise<{ 
    rate: number; 
    platformRate: number; 
    teamLeaderRate: number; 
    source: string;
    teamLeaderId: string | null;
  }> {
    let teamLeaderId: string | null = null;
    
    // 헬퍼의 팀 정보 조회 (팀장 ID 필요)
    const helperTeam = await this.getHelperTeam(helperId);
    if (helperTeam) {
      teamLeaderId = helperTeam.team.leaderId;
    }
    
    // 1. 헬퍼별 수수료 오버라이드 확인 (개별 설정은 본사/팀장 분리 없이 전액 본사로)
    const helperOverride = await this.getHelperCommissionOverride(helperId);
    if (helperOverride) {
      return { 
        rate: helperOverride.commissionRate, 
        platformRate: helperOverride.commissionRate, 
        teamLeaderRate: 0, 
        source: "helper",
        teamLeaderId: null
      };
    }
    
    // 2. 헬퍼의 팀 수수료 확인
    if (helperTeam) {
      const teamOverride = await this.getTeamCommissionOverride(helperTeam.team.id);
      if (teamOverride) {
        return { 
          rate: teamOverride.commissionRate, 
          platformRate: teamOverride.platformRate || 8, 
          teamLeaderRate: teamOverride.teamLeaderRate || 2, 
          source: "team",
          teamLeaderId
        };
      }
    }
    
    // 3. 글로벌 기본 수수료율 확인
    const policy = await this.getCommissionPolicy("helper");
    if (policy) {
      return { 
        rate: policy.defaultRate, 
        platformRate: policy.platformRate, 
        teamLeaderRate: policy.teamLeaderRate, 
        source: "global",
        teamLeaderId
      };
    }
    
    // 4. 기본값 (총 10% = 본사 8% + 팀장 2%)
    return { 
      rate: 10, 
      platformRate: 8, 
      teamLeaderRate: 2, 
      source: "default",
      teamLeaderId
    };
  }

  // System settings
  async getAllSystemSettings(): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings);
  }

  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, key));
    return setting;
  }

  async upsertSystemSetting(key: string, value: string, description?: string): Promise<SystemSetting> {
    const existing = await this.getSystemSetting(key);
    if (existing) {
      const [updated] = await db.update(systemSettings)
        .set({ settingValue: value, description: description ?? existing.description, updatedAt: new Date() })
        .where(eq(systemSettings.settingKey, key))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(systemSettings).values({
        settingKey: key,
        settingValue: value,
        description: description ?? null,
      }).returning();
      return created;
    }
  }

  // Job postings
  async getAllJobPostings(): Promise<JobPosting[]> {
    return await db.select().from(jobPostings).orderBy(desc(jobPostings.createdAt));
  }

  async getJobPosting(id: number): Promise<JobPosting | undefined> {
    const [posting] = await db.select().from(jobPostings).where(eq(jobPostings.id, id));
    return posting;
  }

  async createJobPosting(posting: InsertJobPosting): Promise<JobPosting> {
    const [created] = await db.insert(jobPostings).values(posting).returning();
    return created;
  }

  async updateJobPosting(id: number, updates: Partial<InsertJobPosting>): Promise<JobPosting> {
    const [updated] = await db.update(jobPostings).set(updates).where(eq(jobPostings.id, id)).returning();
    return updated;
  }

  async deleteJobPosting(id: number): Promise<void> {
    await db.delete(jobPostings).where(eq(jobPostings.id, id));
  }

  // Payment reminders
  async getAllPaymentReminders(): Promise<PaymentReminder[]> {
    return await db.select().from(paymentReminders).orderBy(desc(paymentReminders.createdAt));
  }

  async getPaymentReminder(id: number): Promise<PaymentReminder | undefined> {
    const [reminder] = await db.select().from(paymentReminders).where(eq(paymentReminders.id, id));
    return reminder;
  }

  async getPaymentRemindersByRequester(requesterId: string): Promise<PaymentReminder[]> {
    return await db.select().from(paymentReminders)
      .where(eq(paymentReminders.requesterId, requesterId))
      .orderBy(desc(paymentReminders.createdAt));
  }

  async createPaymentReminder(reminder: InsertPaymentReminder): Promise<PaymentReminder> {
    const [created] = await db.insert(paymentReminders).values(reminder).returning();
    return created;
  }

  async updatePaymentReminder(id: number, updates: Partial<InsertPaymentReminder>): Promise<PaymentReminder> {
    const [updated] = await db.update(paymentReminders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(paymentReminders.id, id))
      .returning();
    return updated;
  }

  async deletePaymentReminder(id: number): Promise<void> {
    await db.delete(paymentReminders).where(eq(paymentReminders.id, id));
  }

  // Announcements
  async getAllAnnouncements(): Promise<Announcement[]> {
    return await db.select().from(announcements).orderBy(desc(announcements.createdAt));
  }

  async getAnnouncement(id: number): Promise<Announcement | undefined> {
    const [announcement] = await db.select().from(announcements).where(eq(announcements.id, id));
    return announcement;
  }

  async getAnnouncementsByTarget(targetAudience: string): Promise<Announcement[]> {
    return await db.select().from(announcements)
      .where(eq(announcements.targetAudience, targetAudience))
      .orderBy(desc(announcements.createdAt));
  }

  async createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement> {
    const [created] = await db.insert(announcements).values(announcement).returning();
    return created;
  }

  async deleteAnnouncement(id: number): Promise<void> {
    await db.delete(announcements).where(eq(announcements.id, id));
  }

  async addAnnouncementRecipient(recipient: InsertAnnouncementRecipient): Promise<AnnouncementRecipient> {
    const [created] = await db.insert(announcementRecipients).values(recipient).returning();
    return created;
  }

  async getAnnouncementRecipients(announcementId: number): Promise<AnnouncementRecipient[]> {
    return await db.select().from(announcementRecipients)
      .where(eq(announcementRecipients.announcementId, announcementId));
  }

  async getUserAnnouncements(userId: string, userRole: string): Promise<Announcement[]> {
    const allAnnouncements = await db.select().from(announcements).orderBy(desc(announcements.createdAt));
    const now = new Date();
    return allAnnouncements
      .filter(a =>
        (a.targetAudience === 'all' || a.targetAudience === userRole) &&
        (!a.expiresAt || new Date(a.expiresAt) > now)
      )
      .sort((a, b) => {
        // priority 정렬: urgent > high > normal
        const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2 };
        const pa = priorityOrder[a.priority || 'normal'] ?? 2;
        const pb = priorityOrder[b.priority || 'normal'] ?? 2;
        if (pa !== pb) return pa - pb;
        // 동일 우선순위면 최신순
        return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
      });
  }

  async getPopupAnnouncements(userRole: string): Promise<Announcement[]> {
    const results = await db.select().from(announcements)
      .where(and(
        eq(announcements.isPopup, true),
        or(
          eq(announcements.targetAudience, 'all'),
          eq(announcements.targetAudience, userRole)
        ),
        or(
          isNull(announcements.expiresAt),
          gte(announcements.expiresAt, new Date())
        )
      ))
      .orderBy(desc(announcements.createdAt));
    // priority 정렬: urgent > high > normal
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2 };
    results.sort((a, b) => {
      const pa = priorityOrder[a.priority || 'normal'] ?? 2;
      const pb = priorityOrder[b.priority || 'normal'] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
    });
    // 공지 최대 5개, 광고 최대 10개 분리 후 합쳐서 반환 (클라이언트에서 type으로 분리)
    const notices = results.filter(r => r.type !== 'ad').slice(0, 5);
    const ads = results.filter(r => r.type === 'ad').slice(0, 10);
    return [...notices, ...ads];
  }

  async getBannerAnnouncements(userRole: string): Promise<Announcement[]> {
    const results = await db.select().from(announcements)
      .where(and(
        eq(announcements.isBanner, true),
        eq(announcements.type, 'ad'),
        or(
          eq(announcements.targetAudience, 'all'),
          eq(announcements.targetAudience, userRole)
        ),
        or(
          isNull(announcements.expiresAt),
          gte(announcements.expiresAt, new Date())
        )
      ))
      .orderBy(desc(announcements.createdAt));
    // priority 정렬: urgent > high > normal
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2 };
    results.sort((a, b) => {
      const pa = priorityOrder[a.priority || 'normal'] ?? 2;
      const pb = priorityOrder[b.priority || 'normal'] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
    });
    // 최대 3개 배너만 반환
    return results.slice(0, 3);
  }

  // Job contracts (건별 전자계약)
  async createJobContract(contract: InsertJobContract): Promise<JobContract> {
    const [created] = await db.insert(jobContracts).values(contract).returning();
    return created;
  }

  async getJobContract(id: number): Promise<JobContract | undefined> {
    const [contract] = await db.select().from(jobContracts).where(eq(jobContracts.id, id));
    return contract;
  }

  async getJobContractByOrder(orderId: number): Promise<JobContract | undefined> {
    const [contract] = await db.select().from(jobContracts).where(eq(jobContracts.orderId, orderId));
    return contract;
  }

  async getHelperJobContracts(helperId: string): Promise<JobContract[]> {
    return await db.select().from(jobContracts)
      .where(eq(jobContracts.helperId, helperId))
      .orderBy(desc(jobContracts.createdAt));
  }

  async updateJobContract(id: number, updates: Partial<InsertJobContract>): Promise<JobContract> {
    const [updated] = await db.update(jobContracts).set(updates).where(eq(jobContracts.id, id)).returning();
    return updated;
  }

  async getAllJobContracts(): Promise<JobContract[]> {
    return await db.select().from(jobContracts).orderBy(desc(jobContracts.createdAt));
  }

  // Work sessions (근무 세션)
  async createWorkSession(session: InsertWorkSession): Promise<WorkSession> {
    const [created] = await db.insert(workSessions).values(session).returning();
    return created;
  }

  async getWorkSession(id: number): Promise<WorkSession | undefined> {
    const [session] = await db.select().from(workSessions).where(eq(workSessions.id, id));
    return session;
  }

  async getWorkSessionByOrder(orderId: number): Promise<WorkSession | undefined> {
    const [session] = await db.select().from(workSessions).where(eq(workSessions.orderId, orderId));
    return session;
  }

  async getWorkSessionByOrderAndHelper(orderId: number, helperId: string): Promise<WorkSession | undefined> {
    const [session] = await db.select().from(workSessions)
      .where(and(eq(workSessions.orderId, orderId), eq(workSessions.helperId, helperId)));
    return session;
  }

  async getWorkSessionByContract(jobContractId: number): Promise<WorkSession | undefined> {
    const [session] = await db.select().from(workSessions).where(eq(workSessions.jobContractId, jobContractId));
    return session;
  }

  async updateWorkSession(id: number, updates: Partial<InsertWorkSession>): Promise<WorkSession> {
    const [updated] = await db.update(workSessions).set(updates).where(eq(workSessions.id, id)).returning();
    return updated;
  }

  async getHelperWorkSessions(helperId: string): Promise<WorkSession[]> {
    return await db.select().from(workSessions)
      .where(eq(workSessions.helperId, helperId))
      .orderBy(desc(workSessions.createdAt));
  }

  // Work proof events (근무 증빙)
  async createWorkProofEvent(event: InsertWorkProofEvent): Promise<WorkProofEvent> {
    const [created] = await db.insert(workProofEvents).values(event).returning();
    return created;
  }

  async getWorkProofEventsBySession(workSessionId: number): Promise<WorkProofEvent[]> {
    return await db.select().from(workProofEvents)
      .where(eq(workProofEvents.workSessionId, workSessionId))
      .orderBy(desc(workProofEvents.createdAt));
  }

  // Settlement statements (정산 명세서)
  async createSettlementStatement(statement: InsertSettlementStatement): Promise<SettlementStatement> {
    const [created] = await db.insert(settlementStatements).values(statement).returning();
    return created;
  }

  async getSettlementStatement(id: number): Promise<SettlementStatement | undefined> {
    const [statement] = await db.select().from(settlementStatements).where(eq(settlementStatements.id, id));
    return statement;
  }

  async getSettlementStatementByOrder(orderId: number): Promise<SettlementStatement | undefined> {
    const [statement] = await db.select().from(settlementStatements).where(eq(settlementStatements.orderId, orderId));
    return statement;
  }

  async getSettlementsByOrderId(orderId: number): Promise<SettlementStatement[]> {
    return await db.select().from(settlementStatements)
      .where(eq(settlementStatements.orderId, orderId))
      .orderBy(desc(settlementStatements.createdAt));
  }

  async getHelperSettlementStatements(helperId: string): Promise<SettlementStatement[]> {
    return await db.select().from(settlementStatements)
      .where(eq(settlementStatements.helperId, helperId))
      .orderBy(desc(settlementStatements.createdAt));
  }

  async updateSettlementStatement(id: number, updates: Partial<InsertSettlementStatement>): Promise<SettlementStatement> {
    const [updated] = await db.update(settlementStatements).set(updates).where(eq(settlementStatements.id, id)).returning();
    return updated;
  }

  async getAllSettlementStatements(): Promise<SettlementStatement[]> {
    return await db.select().from(settlementStatements).orderBy(desc(settlementStatements.createdAt));
  }

  // Settlement line items (정산 항목)
  async createSettlementLineItem(item: InsertSettlementLineItem): Promise<SettlementLineItem> {
    const [created] = await db.insert(settlementLineItems).values(item).returning();
    return created;
  }

  async getSettlementLineItems(statementId: number): Promise<SettlementLineItem[]> {
    return await db.select().from(settlementLineItems)
      .where(eq(settlementLineItems.statementId, statementId));
  }

  async getSettlementLineItemByIncident(statementId: number, incidentId: number): Promise<SettlementLineItem | undefined> {
    const items = await db.select().from(settlementLineItems)
      .where(and(
        eq(settlementLineItems.statementId, statementId),
        eq(settlementLineItems.itemType, "deduction"),
        sql`${settlementLineItems.notes} LIKE ${'%"incidentId":' + incidentId + '%'}`
      ));
    return items[0];
  }

  async updateSettlementLineItem(id: number, updates: Partial<InsertSettlementLineItem>): Promise<SettlementLineItem> {
    const [updated] = await db.update(settlementLineItems).set(updates).where(eq(settlementLineItems.id, id)).returning();
    return updated;
  }

  async deleteSettlementLineItem(id: number): Promise<void> {
    await db.delete(settlementLineItems).where(eq(settlementLineItems.id, id));
  }

  // Instruction logs (지시 이력)
  async createInstructionLog(log: InsertInstructionLog): Promise<InstructionLog> {
    const [created] = await db.insert(instructionLogs).values(log).returning();
    return created;
  }

  async getInstructionLogsByOrder(orderId: number): Promise<InstructionLog[]> {
    return await db.select().from(instructionLogs)
      .where(eq(instructionLogs.orderId, orderId))
      .orderBy(desc(instructionLogs.createdAt));
  }

  async getInstructionLogsByContract(jobContractId: number): Promise<InstructionLog[]> {
    return await db.select().from(instructionLogs)
      .where(eq(instructionLogs.jobContractId, jobContractId))
      .orderBy(desc(instructionLogs.createdAt));
  }

  async getAllInstructionLogs(): Promise<InstructionLog[]> {
    return await db.select().from(instructionLogs).orderBy(desc(instructionLogs.createdAt));
  }

  // Incident reports (사고/분쟁)
  async createIncidentReport(report: InsertIncidentReport): Promise<IncidentReport> {
    const [created] = await db.insert(incidentReports).values(report).returning();
    return created;
  }

  async getIncidentReport(id: number): Promise<IncidentReport | undefined> {
    const [report] = await db.select().from(incidentReports).where(eq(incidentReports.id, id));
    return report;
  }

  async getIncidentReportsByOrder(orderId: number): Promise<IncidentReport[]> {
    return await db.select().from(incidentReports)
      .where(eq(incidentReports.orderId, orderId))
      .orderBy(desc(incidentReports.createdAt));
  }

  async getIncidentReportsByUser(userId: string): Promise<IncidentReport[]> {
    return await db.select().from(incidentReports)
      .where(eq(incidentReports.reporterId, userId))
      .orderBy(desc(incidentReports.createdAt));
  }

  async updateIncidentReport(id: number, updates: Partial<InsertIncidentReport>): Promise<IncidentReport> {
    const [updated] = await db.update(incidentReports).set(updates).where(eq(incidentReports.id, id)).returning();
    return updated;
  }

  async getAllIncidentReports(): Promise<IncidentReport[]> {
    return await db.select().from(incidentReports).orderBy(desc(incidentReports.createdAt));
  }

  // Incident evidence (사고 증빙)
  async createIncidentEvidence(evidence: InsertIncidentEvidence): Promise<IncidentEvidence> {
    const [created] = await db.insert(incidentEvidence).values(evidence).returning();
    return created;
  }

  async getIncidentEvidence(incidentId: number): Promise<IncidentEvidence[]> {
    return await db.select().from(incidentEvidence)
      .where(eq(incidentEvidence.incidentId, incidentId));
  }

  // Substitute requests (대체근무 요청)
  async createSubstituteRequest(request: InsertSubstituteRequest): Promise<SubstituteRequest> {
    const [created] = await db.insert(substituteRequests).values(request).returning();
    return created;
  }

  async getSubstituteRequest(id: number): Promise<SubstituteRequest | undefined> {
    const [request] = await db.select().from(substituteRequests).where(eq(substituteRequests.id, id));
    return request;
  }

  async getPendingSubstituteRequests(): Promise<SubstituteRequest[]> {
    return await db.select().from(substituteRequests)
      .where(eq(substituteRequests.status, 'pending'))
      .orderBy(desc(substituteRequests.createdAt));
  }

  async getRequesterSubstituteRequests(requesterId: string): Promise<SubstituteRequest[]> {
    return await db.select().from(substituteRequests)
      .where(eq(substituteRequests.requesterId, requesterId))
      .orderBy(desc(substituteRequests.createdAt));
  }

  async updateSubstituteRequest(id: number, updates: Partial<InsertSubstituteRequest>): Promise<SubstituteRequest> {
    const [updated] = await db.update(substituteRequests).set(updates).where(eq(substituteRequests.id, id)).returning();
    return updated;
  }

  async getAllSubstituteRequests(): Promise<SubstituteRequest[]> {
    return await db.select().from(substituteRequests).orderBy(desc(substituteRequests.createdAt));
  }

  // Contract execution events (계약 실행 이벤트)
  async createContractExecutionEvent(event: InsertContractExecutionEvent): Promise<ContractExecutionEvent> {
    const [created] = await db.insert(contractExecutionEvents).values(event).returning();
    return created;
  }

  async getContractExecutionEvent(id: number): Promise<ContractExecutionEvent | undefined> {
    const [event] = await db.select().from(contractExecutionEvents).where(eq(contractExecutionEvents.id, id));
    return event;
  }

  async getContractExecutionEventsByContract(contractId: number, contractType: string): Promise<ContractExecutionEvent[]> {
    return await db.select().from(contractExecutionEvents)
      .where(and(
        eq(contractExecutionEvents.contractId, contractId),
        eq(contractExecutionEvents.contractType, contractType)
      ))
      .orderBy(desc(contractExecutionEvents.createdAt));
  }

  // Payments (결제)
  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [created] = await db.insert(payments).values(payment).returning();
    return created;
  }

  async getPayment(id: number): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment;
  }

  async getPaymentByContract(contractId: number): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.contractId, contractId));
    return payment;
  }

  async getPaymentByJobContract(jobContractId: number): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.jobContractId, jobContractId));
    return payment;
  }

  async getPaymentByProviderPaymentId(providerPaymentId: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.providerPaymentId, providerPaymentId));
    return payment;
  }

  async getPaymentByOrderId(orderId: number): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.orderId, orderId));
    return payment;
  }

  async updatePayment(id: number, updates: Partial<InsertPayment>): Promise<Payment> {
    const [updated] = await db.update(payments).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(payments.id, id)).returning();
    return updated;
  }

  async getAllPayments(): Promise<Payment[]> {
    return await db.select().from(payments).orderBy(desc(payments.createdAt));
  }

  // Payment status events (결제 상태 이벤트)
  async createPaymentStatusEvent(event: InsertPaymentStatusEvent): Promise<PaymentStatusEvent> {
    const [created] = await db.insert(paymentStatusEvents).values(event).returning();
    return created;
  }

  async getPaymentStatusEvents(paymentId: number): Promise<PaymentStatusEvent[]> {
    return await db.select().from(paymentStatusEvents)
      .where(eq(paymentStatusEvents.paymentId, paymentId))
      .orderBy(desc(paymentStatusEvents.createdAt));
  }

  // Contract documents (계약서 문서)
  async createContractDocument(document: InsertContractDocument): Promise<ContractDocument> {
    const [created] = await db.insert(contractDocuments).values(document).returning();
    return created;
  }

  async getContractDocument(id: number): Promise<ContractDocument | undefined> {
    const [doc] = await db.select().from(contractDocuments).where(eq(contractDocuments.id, id));
    return doc;
  }

  async getContractDocuments(contractId: number): Promise<ContractDocument[]> {
    return await db.select().from(contractDocuments)
      .where(eq(contractDocuments.contractId, contractId))
      .orderBy(desc(contractDocuments.createdAt));
  }

  async getJobContractDocuments(jobContractId: number): Promise<ContractDocument[]> {
    return await db.select().from(contractDocuments)
      .where(eq(contractDocuments.jobContractId, jobContractId))
      .orderBy(desc(contractDocuments.createdAt));
  }

  // Incident actions (분쟁 처리 액션)
  async createIncidentAction(action: InsertIncidentAction): Promise<IncidentAction> {
    const [created] = await db.insert(incidentActions).values(action).returning();
    return created;
  }

  async getIncidentActions(incidentId: number): Promise<IncidentAction[]> {
    return await db.select().from(incidentActions)
      .where(eq(incidentActions.incidentId, incidentId))
      .orderBy(desc(incidentActions.createdAt));
  }

  // Enterprise accounts (본사 계약 업체)
  async getAllEnterpriseAccounts(): Promise<EnterpriseAccount[]> {
    return await db.select().from(enterpriseAccounts).orderBy(enterpriseAccounts.name);
  }

  async getEnterpriseAccount(id: number): Promise<EnterpriseAccount | undefined> {
    const [account] = await db.select().from(enterpriseAccounts).where(eq(enterpriseAccounts.id, id));
    return account;
  }

  async createEnterpriseAccount(account: InsertEnterpriseAccount): Promise<EnterpriseAccount> {
    const [created] = await db.insert(enterpriseAccounts).values(account).returning();
    return created;
  }

  async updateEnterpriseAccount(id: number, updates: Partial<InsertEnterpriseAccount>): Promise<EnterpriseAccount> {
    const [updated] = await db.update(enterpriseAccounts)
      .set(updates)
      .where(eq(enterpriseAccounts.id, id))
      .returning();
    return updated;
  }

  // Enterprise order batches (본사 오더 배치)
  async getAllEnterpriseOrderBatches(): Promise<EnterpriseOrderBatch[]> {
    return await db.select().from(enterpriseOrderBatches).orderBy(desc(enterpriseOrderBatches.createdAt));
  }

  async getEnterpriseOrderBatch(id: number): Promise<EnterpriseOrderBatch | undefined> {
    const [batch] = await db.select().from(enterpriseOrderBatches).where(eq(enterpriseOrderBatches.id, id));
    return batch;
  }

  async getEnterpriseOrderBatchesByEnterprise(enterpriseId: number): Promise<EnterpriseOrderBatch[]> {
    return await db.select().from(enterpriseOrderBatches)
      .where(eq(enterpriseOrderBatches.enterpriseId, enterpriseId))
      .orderBy(desc(enterpriseOrderBatches.createdAt));
  }

  async createEnterpriseOrderBatch(batch: InsertEnterpriseOrderBatch): Promise<EnterpriseOrderBatch> {
    const [created] = await db.insert(enterpriseOrderBatches).values(batch).returning();
    return created;
  }

  async updateEnterpriseOrderBatch(id: number, updates: Partial<InsertEnterpriseOrderBatch>): Promise<EnterpriseOrderBatch> {
    const [updated] = await db.update(enterpriseOrderBatches)
      .set(updates)
      .where(eq(enterpriseOrderBatches.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // 헬퍼 온보딩 승인 관련
  // ============================================
  async getHelperCredentialsByStatus(status: string): Promise<HelperCredential[]> {
    return await db.select().from(helperCredentials)
      .where(eq(helperCredentials.verificationStatus, status))
      .orderBy(desc(helperCredentials.createdAt));
  }

  async updateHelperCredentialStatus(
    id: number, 
    status: string, 
    reviewerId?: string,
    rejectReason?: string
  ): Promise<HelperCredential> {
    const [updated] = await db.update(helperCredentials)
      .set({
        verificationStatus: status,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectReason: rejectReason,
      })
      .where(eq(helperCredentials.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // 헬퍼 정산/인센티브 조회
  // ============================================
  async getSettlementsByHelper(helperId: string): Promise<SettlementStatement[]> {
    return await db.select().from(settlementStatements)
      .where(eq(settlementStatements.helperId, helperId))
      .orderBy(desc(settlementStatements.createdAt));
  }

  async getIncentivesByTeamLeader(leaderId: string): Promise<TeamIncentive[]> {
    const leaderTeams = await db.select().from(teams).where(eq(teams.leaderId, leaderId));
    if (leaderTeams.length === 0) return [];
    const teamIds = leaderTeams.map(t => t.id);
    const allIncentives: TeamIncentive[] = [];
    for (const teamId of teamIds) {
      const incentives = await db.select().from(teamIncentives)
        .where(eq(teamIncentives.teamId, teamId))
        .orderBy(desc(teamIncentives.createdAt));
      allIncentives.push(...incentives);
    }
    return allIncentives;
  }

  // ============================================
  // 대행배차 관련
  // ============================================
  async getDispatchRequestsForHelper(helperId: string): Promise<DispatchRequest[]> {
    return await db.select().from(dispatchRequests)
      .where(eq(dispatchRequests.status, "pending"))
      .orderBy(desc(dispatchRequests.createdAt));
  }

  async acceptDispatchRequest(requestId: number, helperId: string): Promise<DispatchRequest> {
    const [updated] = await db.update(dispatchRequests)
      .set({ assignedHelperId: helperId, status: "assigned" })
      .where(eq(dispatchRequests.id, requestId))
      .returning();
    return updated;
  }

  async rejectDispatchRequest(requestId: number, reason?: string): Promise<DispatchRequest> {
    const [updated] = await db.update(dispatchRequests)
      .set({ status: "rejected" })
      .where(eq(dispatchRequests.id, requestId))
      .returning();
    return updated;
  }

  // ============================================
  // 팀 QR 스캔 로그
  // ============================================
  async getQrScanLogsByTeam(qrId: number): Promise<QrScanLog[]> {
    return await db.select().from(qrScanLogs)
      .where(eq(qrScanLogs.qrId, qrId))
      .orderBy(desc(qrScanLogs.scannedAt));
  }

  async createQrScanLog(log: InsertQrScanLog): Promise<QrScanLog> {
    const [created] = await db.insert(qrScanLogs).values(log).returning();
    return created;
  }

  async getAllQrScanLogs(): Promise<QrScanLog[]> {
    return await db.select().from(qrScanLogs).orderBy(desc(qrScanLogs.scannedAt));
  }

  // ============================================
  // Team QR codes CRUD
  // ============================================
  async getAllTeamQrCodes(): Promise<TeamQrCode[]> {
    return await db.select().from(teamQrCodes).orderBy(desc(teamQrCodes.createdAt));
  }

  async getTeamQrCode(id: number): Promise<TeamQrCode | undefined> {
    const [qr] = await db.select().from(teamQrCodes).where(eq(teamQrCodes.id, id));
    return qr;
  }

  async getTeamQrCodeByCode(code: string): Promise<TeamQrCode | undefined> {
    const [qr] = await db.select().from(teamQrCodes).where(eq(teamQrCodes.code, code));
    return qr;
  }

  async createTeamQrCode(qr: InsertTeamQrCode): Promise<TeamQrCode> {
    const [created] = await db.insert(teamQrCodes).values(qr).returning();
    return created;
  }

  async updateTeamQrCode(id: number, updates: Partial<InsertTeamQrCode>): Promise<TeamQrCode> {
    const [updated] = await db.update(teamQrCodes).set(updates).where(eq(teamQrCodes.id, id)).returning();
    return updated;
  }

  async revokeTeamQrCode(id: number): Promise<void> {
    await db.update(teamQrCodes).set({ status: "revoked" }).where(eq(teamQrCodes.id, id));
  }

  // ============================================
  // Transactional Team Leader Assignment
  // ============================================
  async assignTeamLeaderTransactional(params: {
    helperId: string;
    teamName: string;
    teamQrToken: string;
    commissionRate: number;
  }): Promise<{ team: Team; qrCode: TeamQrCode }> {
    const { helperId, teamName, teamQrToken, commissionRate } = params;
    
    return await db.transaction(async (tx) => {
      const [team] = await tx.insert(teams).values({
        leaderId: helperId,
        name: teamName,
        qrCodeToken: teamQrToken,
        isActive: true,
      }).returning();
      
      await tx.update(users).set({ isTeamLeader: true }).where(eq(users.id, helperId));
      
      await tx.insert(teamCommissionOverrides).values({
        teamId: team.id,
        commissionRate,
        notes: "관리자가 팀장 지정 시 설정",
      });
      
      const [qrCode] = await tx.insert(teamQrCodes).values({
        teamId: team.id,
        code: teamQrToken,
        qrType: "TEAM_JOIN_QR",
        status: "active",
      }).returning();
      
      return { team, qrCode };
    });
  }

  // ============================================
  // 긴급 대타 수락
  // ============================================
  async acceptSubstituteRequest(requestId: number, helperId: string): Promise<SubstituteRequest> {
    const [updated] = await db.update(substituteRequests)
      .set({ matchedHelperId: helperId, matchedAt: new Date(), status: "matched" })
      .where(eq(substituteRequests.id, requestId))
      .returning();
    return updated;
  }

  // ============================================
  // 단가 변환 규칙
  // ============================================
  async getAllPriceConversionRules(): Promise<PriceConversionRule[]> {
    return await db.select().from(priceConversionRules)
      .orderBy(priceConversionRules.priority);
  }

  async createPriceConversionRule(data: InsertPriceConversionRule): Promise<PriceConversionRule> {
    const [created] = await db.insert(priceConversionRules).values(data).returning();
    return created;
  }

  async getPriceConversionRule(id: number): Promise<PriceConversionRule | undefined> {
    const [rule] = await db.select().from(priceConversionRules).where(eq(priceConversionRules.id, id));
    return rule;
  }

  async updatePriceConversionRule(id: number, updates: Partial<InsertPriceConversionRule>): Promise<PriceConversionRule | undefined> {
    const [updated] = await db.update(priceConversionRules)
      .set(updates)
      .where(eq(priceConversionRules.id, id))
      .returning();
    return updated;
  }

  async deletePriceConversionRule(id: number): Promise<boolean> {
    const result = await db.delete(priceConversionRules).where(eq(priceConversionRules.id, id));
    return true;
  }

  // ============================================
  // 감사 로그 (Audit Logs)
  // ============================================
  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(data).returning();
    return created;
  }

  async getAuditLogs(filters?: { userId?: string; action?: string; targetType?: string; targetId?: string; limit?: number }): Promise<AuditLog[]> {
    let query = db.select().from(auditLogs);
    const conditions: any[] = [];
    
    if (filters?.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters?.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters?.targetType) {
      conditions.push(eq(auditLogs.targetType, filters.targetType));
    }
    if (filters?.targetId) {
      conditions.push(eq(auditLogs.targetId, filters.targetId));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    return await query.orderBy(desc(auditLogs.createdAt)).limit(filters?.limit || 100);
  }

  // ============================================
  // 제재/분쟁 조회
  // ============================================
  async getSanctionsByUser(userId: string): Promise<UserSanction[]> {
    return await db.select().from(userSanctions)
      .where(eq(userSanctions.userId, userId))
      .orderBy(desc(userSanctions.createdAt));
  }

  async getIncidentsByUser(userId: string): Promise<IncidentReport[]> {
    return await db.select().from(incidentReports)
      .where(eq(incidentReports.reporterId, userId))
      .orderBy(desc(incidentReports.createdAt));
  }

  // ============================================
  // User sanctions (사용자 제재)
  // ============================================
  async getAllUserSanctions(): Promise<UserSanction[]> {
    return await db.select().from(userSanctions).orderBy(desc(userSanctions.createdAt));
  }

  async getUserSanction(id: number): Promise<UserSanction | undefined> {
    const [sanction] = await db.select().from(userSanctions).where(eq(userSanctions.id, id));
    return sanction;
  }

  async createUserSanction(sanction: InsertUserSanction): Promise<UserSanction> {
    const [created] = await db.insert(userSanctions).values(sanction).returning();
    return created;
  }

  async updateUserSanction(id: number, updates: Partial<InsertUserSanction>): Promise<UserSanction> {
    const [updated] = await db.update(userSanctions).set(updates).where(eq(userSanctions.id, id)).returning();
    return updated;
  }

  // ============================================
  // Team incentives (팀장 인센티브)
  // ============================================
  async getAllTeamIncentives(): Promise<TeamIncentive[]> {
    return await db.select().from(teamIncentives).orderBy(desc(teamIncentives.createdAt));
  }

  async getTeamIncentive(id: number): Promise<TeamIncentive | undefined> {
    const [incentive] = await db.select().from(teamIncentives).where(eq(teamIncentives.id, id));
    return incentive;
  }

  async createTeamIncentive(incentive: InsertTeamIncentive): Promise<TeamIncentive> {
    const [created] = await db.insert(teamIncentives).values(incentive).returning();
    return created;
  }

  async updateTeamIncentive(id: number, updates: Partial<InsertTeamIncentive>): Promise<TeamIncentive> {
    const [updated] = await db.update(teamIncentives).set(updates).where(eq(teamIncentives.id, id)).returning();
    return updated;
  }

  // ============================================
  // Dispatch requests (대행배차)
  // ============================================
  async getAllDispatchRequests(): Promise<DispatchRequest[]> {
    return await db.select().from(dispatchRequests).orderBy(desc(dispatchRequests.createdAt));
  }

  async getDispatchRequest(id: number): Promise<DispatchRequest | undefined> {
    const [request] = await db.select().from(dispatchRequests).where(eq(dispatchRequests.id, id));
    return request;
  }

  async createDispatchRequest(request: InsertDispatchRequest): Promise<DispatchRequest> {
    const [created] = await db.insert(dispatchRequests).values(request).returning();
    return created;
  }

  async updateDispatchRequest(id: number, updates: Partial<InsertDispatchRequest>): Promise<DispatchRequest> {
    const [updated] = await db.update(dispatchRequests).set(updates).where(eq(dispatchRequests.id, id)).returning();
    return updated;
  }

  // ============================================
  // RBAC - Admin Roles
  // ============================================
  async getAllAdminRoles(): Promise<AdminRole[]> {
    return await db.select().from(adminRoles).orderBy(adminRoles.id);
  }

  async getAdminRole(id: number): Promise<AdminRole | undefined> {
    const [role] = await db.select().from(adminRoles).where(eq(adminRoles.id, id));
    return role;
  }

  async createAdminRole(role: InsertAdminRole): Promise<AdminRole> {
    const [created] = await db.insert(adminRoles).values(role).returning();
    return created;
  }

  async updateAdminRole(id: number, updates: Partial<InsertAdminRole>): Promise<AdminRole> {
    const [updated] = await db.update(adminRoles).set(updates).where(eq(adminRoles.id, id)).returning();
    return updated;
  }

  async deleteAdminRole(id: number): Promise<void> {
    // First delete all role-permission mappings for this role
    await db.delete(adminRolePermissions).where(eq(adminRolePermissions.roleId, id));
    // Then delete the role
    await db.delete(adminRoles).where(eq(adminRoles.id, id));
  }

  // ============================================
  // RBAC - Admin Permissions
  // ============================================
  async getAllAdminPermissions(): Promise<AdminPermission[]> {
    return await db.select().from(adminPermissions).orderBy(adminPermissions.id);
  }

  async getAdminPermission(id: number): Promise<AdminPermission | undefined> {
    const [permission] = await db.select().from(adminPermissions).where(eq(adminPermissions.id, id));
    return permission;
  }

  async createAdminPermission(permission: InsertAdminPermission): Promise<AdminPermission> {
    const [created] = await db.insert(adminPermissions).values(permission).returning();
    return created;
  }

  async deleteAdminPermission(id: number): Promise<void> {
    // First delete all role-permission mappings for this permission
    await db.delete(adminRolePermissions).where(eq(adminRolePermissions.permissionId, id));
    // Then delete the permission
    await db.delete(adminPermissions).where(eq(adminPermissions.id, id));
  }

  // ============================================
  // RBAC - Role-Permission mapping
  // ============================================
  async getRolePermissions(roleId: number): Promise<AdminPermission[]> {
    const results = await db.select({ permission: adminPermissions })
      .from(adminRolePermissions)
      .innerJoin(adminPermissions, eq(adminRolePermissions.permissionId, adminPermissions.id))
      .where(eq(adminRolePermissions.roleId, roleId));
    return results.map(r => r.permission);
  }

  async assignPermissionToRole(roleId: number, permissionId: number): Promise<AdminRolePermission> {
    const [created] = await db.insert(adminRolePermissions).values({ roleId, permissionId }).returning();
    return created;
  }

  async removePermissionFromRole(roleId: number, permissionId: number): Promise<void> {
    await db.delete(adminRolePermissions).where(
      and(eq(adminRolePermissions.roleId, roleId), eq(adminRolePermissions.permissionId, permissionId))
    );
  }

  // ============================================
  // RBAC - Staff Role Assignments
  // ============================================
  async getStaffRoleAssignments(userId: string): Promise<StaffRoleAssignment[]> {
    return await db.select().from(staffRoleAssignments).where(eq(staffRoleAssignments.userId, userId));
  }

  async assignRoleToStaff(userId: string, roleId: number, assignedBy: string): Promise<StaffRoleAssignment> {
    const [created] = await db.insert(staffRoleAssignments).values({ 
      userId, 
      roleId, 
      assignedBy,
      scopeType: 'global',
      isActive: true 
    }).returning();
    return created;
  }

  async removeRoleFromStaff(userId: string, roleId: number): Promise<void> {
    await db.delete(staffRoleAssignments).where(
      and(eq(staffRoleAssignments.userId, userId), eq(staffRoleAssignments.roleId, roleId))
    );
  }

  // ============================================
  // RBAC - Permission Check
  // ============================================
  async getUserPermissions(userId: string): Promise<string[]> {
    const assignments = await db.select({ roleId: staffRoleAssignments.roleId })
      .from(staffRoleAssignments)
      .where(and(eq(staffRoleAssignments.userId, userId), eq(staffRoleAssignments.isActive, true)));
    
    if (assignments.length === 0) return [];
    
    const roleIds = assignments.map(a => a.roleId);
    const permissions = new Set<string>();
    
    for (const roleId of roleIds) {
      const rolePerms = await this.getRolePermissions(roleId);
      rolePerms.forEach(p => permissions.add(p.key));
    }
    
    return Array.from(permissions);
  }

  // ============================================
  // Push Subscriptions
  // ============================================
  async createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription> {
    const [created] = await db.insert(pushSubscriptions).values(subscription).returning();
    return created;
  }

  async getPushSubscriptionsByUser(userId: string): Promise<PushSubscription[]> {
    return await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  async getPushSubscriptionByEndpoint(endpoint: string): Promise<PushSubscription | undefined> {
    const results = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).limit(1);
    return results[0];
  }

  async deletePushSubscription(id: number): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
  }

  async deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async deletePushSubscriptionsByUser(userId: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  // ============================================
  // FCM Tokens (Native Push Notifications)
  // ============================================
  async createOrUpdateFcmToken(data: InsertFcmToken): Promise<FcmToken> {
    // Delete any existing entries with this token (handles device account switching)
    await db.delete(fcmTokens).where(eq(fcmTokens.token, data.token));
    
    const [newToken] = await db.insert(fcmTokens).values(data).returning();
    return newToken;
  }

  async getFcmTokensByUser(userId: string): Promise<FcmToken[]> {
    return await db.select().from(fcmTokens).where(eq(fcmTokens.userId, userId));
  }

  async deleteFcmToken(token: string): Promise<void> {
    await db.delete(fcmTokens).where(eq(fcmTokens.token, token));
  }

  async deleteFcmTokensByUser(userId: string): Promise<void> {
    await db.delete(fcmTokens).where(eq(fcmTokens.userId, userId));
  }

  // ============================================
  // Customer Service Inquiries (고객센터 문의)
  // ============================================
  async getAllCustomerServiceInquiries(): Promise<CustomerServiceInquiry[]> {
    return await db.select().from(customerServiceInquiries).orderBy(desc(customerServiceInquiries.createdAt));
  }

  async getCustomerServiceInquiry(id: number): Promise<CustomerServiceInquiry | undefined> {
    const [inquiry] = await db.select().from(customerServiceInquiries).where(eq(customerServiceInquiries.id, id));
    return inquiry;
  }

  async getCustomerServiceInquiriesByUser(userId: string): Promise<CustomerServiceInquiry[]> {
    return await db.select().from(customerServiceInquiries).where(eq(customerServiceInquiries.userId, userId)).orderBy(desc(customerServiceInquiries.createdAt));
  }

  async createCustomerServiceInquiry(inquiry: InsertCustomerServiceInquiry): Promise<CustomerServiceInquiry> {
    const [created] = await db.insert(customerServiceInquiries).values(inquiry).returning();
    return created;
  }

  async updateCustomerServiceInquiry(id: number, updates: Partial<InsertCustomerServiceInquiry>): Promise<CustomerServiceInquiry> {
    const [updated] = await db.update(customerServiceInquiries).set({ ...updates, updatedAt: new Date() }).where(eq(customerServiceInquiries.id, id)).returning();
    return updated;
  }

  // ============================================
  // Tax Invoices (세금계산서)
  // ============================================
  async getAllTaxInvoices(): Promise<TaxInvoice[]> {
    return await db.select().from(taxInvoices).orderBy(desc(taxInvoices.createdAt));
  }

  async getTaxInvoice(id: number): Promise<TaxInvoice | undefined> {
    const [invoice] = await db.select().from(taxInvoices).where(eq(taxInvoices.id, id));
    return invoice;
  }

  async getTaxInvoicesByHelper(helperId: string): Promise<TaxInvoice[]> {
    return await db.select().from(taxInvoices).where(eq(taxInvoices.supplierCorpNum, helperId)).orderBy(desc(taxInvoices.createdAt));
  }

  async getTaxInvoicesByPeriod(period: string): Promise<TaxInvoice[]> {
    return await db.select().from(taxInvoices).where(eq(taxInvoices.issueDate, period)).orderBy(desc(taxInvoices.createdAt));
  }

  async createTaxInvoice(invoice: InsertTaxInvoice): Promise<TaxInvoice> {
    const [created] = await db.insert(taxInvoices).values(invoice).returning();
    return created;
  }

  async updateTaxInvoice(id: number, updates: Partial<InsertTaxInvoice>): Promise<TaxInvoice> {
    const [updated] = await db.update(taxInvoices).set(updates).where(eq(taxInvoices.id, id)).returning();
    return updated;
  }

  // ============================================
  // Incentive Policies (인센티브 정책)
  // ============================================
  async getAllIncentivePolicies(): Promise<IncentivePolicy[]> {
    return await db.select().from(incentivePolicies).orderBy(desc(incentivePolicies.createdAt));
  }

  async getIncentivePolicy(teamId: number): Promise<IncentivePolicy | undefined> {
    const [policy] = await db.select().from(incentivePolicies).where(eq(incentivePolicies.teamId, teamId));
    return policy;
  }

  async createIncentivePolicy(policy: InsertIncentivePolicy): Promise<IncentivePolicy> {
    const [created] = await db.insert(incentivePolicies).values(policy).returning();
    return created;
  }

  async updateIncentivePolicy(id: number, updates: Partial<InsertIncentivePolicy>): Promise<IncentivePolicy> {
    const [updated] = await db.update(incentivePolicies).set(updates).where(eq(incentivePolicies.id, id)).returning();
    return updated;
  }

  // ============================================
  // Incentive Details (인센티브 상세)
  // ============================================
  async getIncentiveDetails(incentiveId: number): Promise<IncentiveDetail[]> {
    return await db.select().from(incentiveDetails).where(eq(incentiveDetails.incentiveId, incentiveId));
  }

  async createIncentiveDetail(detail: InsertIncentiveDetail): Promise<IncentiveDetail> {
    const [created] = await db.insert(incentiveDetails).values(detail).returning();
    return created;
  }

  // ============================================
  // Disputes (분쟁/이의제기)
  // ============================================
  async getAllDisputes(): Promise<Dispute[]> {
    return await db.select().from(disputes).orderBy(desc(disputes.createdAt));
  }

  async getDispute(id: number): Promise<Dispute | undefined> {
    const [dispute] = await db.select().from(disputes).where(eq(disputes.id, id));
    return dispute;
  }

  async getDisputesByHelper(helperId: string): Promise<Dispute[]> {
    return await db.select().from(disputes).where(eq(disputes.helperId, helperId)).orderBy(desc(disputes.createdAt));
  }

  async getDisputesByRequester(requesterId: string): Promise<Dispute[]> {
    // Get disputes where submitterRole is requester and order belongs to this requester
    const result = await db.select()
      .from(disputes)
      .innerJoin(orders, eq(disputes.orderId, orders.id))
      .where(
        and(
          eq(disputes.submitterRole, "requester"),
          eq(orders.requesterId, requesterId)
        )
      )
      .orderBy(desc(disputes.createdAt));
    return result.map(r => r.disputes);
  }

  async getDisputesByOrder(orderId: number): Promise<Dispute[]> {
    return await db.select()
      .from(disputes)
      .where(eq(disputes.orderId, orderId))
      .orderBy(desc(disputes.createdAt));
  }

  async createDispute(dispute: InsertDispute): Promise<Dispute> {
    const [created] = await db.insert(disputes).values(dispute).returning();
    return created;
  }

  async updateDispute(id: number, updates: Partial<InsertDispute>): Promise<Dispute> {
    const [updated] = await db.update(disputes).set(updates).where(eq(disputes.id, id)).returning();
    return updated;
  }

  // ============================================
  // Refresh Tokens (토큰 갱신)
  // ============================================
  async createRefreshToken(userId: string, token: string, expiresAt: Date, deviceInfo?: string): Promise<RefreshToken> {
    const [created] = await db.insert(refreshTokens).values({
      userId,
      token,
      expiresAt,
      deviceInfo,
    }).returning();
    return created;
  }

  async getRefreshToken(token: string): Promise<RefreshToken | undefined> {
    const [refreshToken] = await db.select().from(refreshTokens)
      .where(and(
        eq(refreshTokens.token, token),
        isNull(refreshTokens.revokedAt)
      ));
    return refreshToken;
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await db.update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.token, token));
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await db.update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(refreshTokens.userId, userId),
        isNull(refreshTokens.revokedAt)
      ));
  }

  async cleanupExpiredRefreshTokens(): Promise<void> {
    await db.delete(refreshTokens)
      .where(lte(refreshTokens.expiresAt, new Date()));
  }

  // ============================================
  // Destination Pricing (착지별/시간대별 단가)
  // ============================================
  async getAllDestinationPricing(): Promise<DestinationPricing[]> {
    return await db.select().from(destinationPricing).orderBy(destinationPricing.workCategory, destinationPricing.destinationRegion, destinationPricing.timeSlot);
  }

  async getDestinationPricing(id: number): Promise<DestinationPricing | undefined> {
    const [pricing] = await db.select().from(destinationPricing).where(eq(destinationPricing.id, id));
    return pricing;
  }

  async getDestinationPricingByCategory(workCategory: string): Promise<DestinationPricing[]> {
    return await db.select().from(destinationPricing).where(eq(destinationPricing.workCategory, workCategory));
  }

  async createDestinationPricing(pricing: InsertDestinationPricing): Promise<DestinationPricing> {
    const [created] = await db.insert(destinationPricing).values(pricing).returning();
    return created;
  }

  async updateDestinationPricing(id: number, updates: Partial<InsertDestinationPricing>): Promise<DestinationPricing> {
    const [updated] = await db.update(destinationPricing).set({ ...updates, updatedAt: new Date() }).where(eq(destinationPricing.id, id)).returning();
    return updated;
  }

  async deleteDestinationPricing(id: number): Promise<void> {
    await db.delete(destinationPricing).where(eq(destinationPricing.id, id));
  }

  // ============================================
  // Cold Chain Settings (냉탑 최저가)
  // ============================================
  async getAllColdChainSettings(): Promise<ColdChainSetting[]> {
    return await db.select().from(coldChainSettings).orderBy(coldChainSettings.createdAt);
  }

  async getColdChainSetting(id: number): Promise<ColdChainSetting | undefined> {
    const [setting] = await db.select().from(coldChainSettings).where(eq(coldChainSettings.id, id));
    return setting;
  }

  async createColdChainSetting(setting: InsertColdChainSetting): Promise<ColdChainSetting> {
    const [created] = await db.insert(coldChainSettings).values(setting).returning();
    return created;
  }

  async updateColdChainSetting(id: number, updates: Partial<InsertColdChainSetting>): Promise<ColdChainSetting> {
    const [updated] = await db.update(coldChainSettings).set({ ...updates, updatedAt: new Date() }).where(eq(coldChainSettings.id, id)).returning();
    return updated;
  }

  async deleteColdChainSetting(id: number): Promise<void> {
    await db.delete(coldChainSettings).where(eq(coldChainSettings.id, id));
  }

  // ============================================
  // Virtual Accounts (가상계좌)
  // ============================================
  async createVirtualAccount(account: InsertVirtualAccount): Promise<VirtualAccount> {
    const [created] = await db.insert(virtualAccounts).values(account).returning();
    return created;
  }

  async getVirtualAccount(id: number): Promise<VirtualAccount | undefined> {
    const [account] = await db.select().from(virtualAccounts).where(eq(virtualAccounts.id, id));
    return account;
  }

  async getVirtualAccountByOrder(orderId: number): Promise<VirtualAccount | undefined> {
    const [account] = await db.select().from(virtualAccounts).where(eq(virtualAccounts.orderId, orderId));
    return account;
  }

  async getVirtualAccountByPaymentId(paymentId: string): Promise<VirtualAccount | undefined> {
    const [account] = await db.select().from(virtualAccounts).where(eq(virtualAccounts.paymentId, paymentId));
    return account;
  }

  async updateVirtualAccount(id: number, updates: Partial<InsertVirtualAccount>): Promise<VirtualAccount> {
    const [updated] = await db.update(virtualAccounts).set(updates).where(eq(virtualAccounts.id, id)).returning();
    return updated;
  }

  async getUserVirtualAccounts(userId: string): Promise<VirtualAccount[]> {
    return await db.select().from(virtualAccounts).where(eq(virtualAccounts.userId, userId)).orderBy(desc(virtualAccounts.createdAt));
  }

  // Phone verification codes
  async createPhoneVerificationCode(code: InsertPhoneVerificationCode): Promise<PhoneVerificationCode> {
    const [created] = await db.insert(phoneVerificationCodes).values(code).returning();
    return created;
  }

  async getRecentPhoneVerificationCodes(phoneNumber: string, withinSeconds: number): Promise<PhoneVerificationCode[]> {
    const since = new Date(Date.now() - withinSeconds * 1000);
    return await db.select()
      .from(phoneVerificationCodes)
      .where(and(
        eq(phoneVerificationCodes.phoneNumber, phoneNumber),
        gte(phoneVerificationCodes.createdAt, since)
      ));
  }

  async getRecentPhoneVerificationCodesByIp(ipAddress: string, withinSeconds: number): Promise<PhoneVerificationCode[]> {
    const since = new Date(Date.now() - withinSeconds * 1000);
    return await db.select()
      .from(phoneVerificationCodes)
      .where(and(
        eq(phoneVerificationCodes.ipAddress, ipAddress),
        gte(phoneVerificationCodes.createdAt, since)
      ));
  }

  async getValidPhoneVerificationCode(phoneNumber: string, purpose: string): Promise<PhoneVerificationCode | undefined> {
    const now = new Date();
    const [code] = await db.select()
      .from(phoneVerificationCodes)
      .where(and(
        eq(phoneVerificationCodes.phoneNumber, phoneNumber),
        eq(phoneVerificationCodes.purpose, purpose),
        eq(phoneVerificationCodes.isUsed, false),
        gte(phoneVerificationCodes.expiresAt, now)
      ))
      .orderBy(desc(phoneVerificationCodes.createdAt))
      .limit(1);
    return code;
  }

  async markPhoneVerificationCodeUsed(id: number): Promise<void> {
    await db.update(phoneVerificationCodes)
      .set({ isUsed: true })
      .where(eq(phoneVerificationCodes.id, id));
  }

  async incrementPhoneVerificationAttempts(id: number): Promise<void> {
    await db.update(phoneVerificationCodes)
      .set({ attempts: sql`${phoneVerificationCodes.attempts} + 1` })
      .where(eq(phoneVerificationCodes.id, id));
  }

  // Client errors
  async createClientError(error: InsertClientError): Promise<ClientError> {
    const [created] = await db.insert(clientErrors).values(error).returning();
    return created;
  }

  async getAllClientErrors(filters?: { severity?: string; isResolved?: boolean; limit?: number }): Promise<ClientError[]> {
    let query = db.select().from(clientErrors).orderBy(desc(clientErrors.createdAt));
    
    if (filters?.severity) {
      query = query.where(eq(clientErrors.severity, filters.severity)) as typeof query;
    }
    if (filters?.isResolved !== undefined) {
      query = query.where(eq(clientErrors.isResolved, filters.isResolved)) as typeof query;
    }
    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    
    return await query;
  }

  async getClientError(id: number): Promise<ClientError | undefined> {
    const [error] = await db.select().from(clientErrors).where(eq(clientErrors.id, id));
    return error;
  }

  async updateClientError(id: number, updates: Partial<InsertClientError>): Promise<ClientError> {
    const [updated] = await db.update(clientErrors).set(updates).where(eq(clientErrors.id, id)).returning();
    return updated;
  }

  // Documents
  async getAllDocuments(filters?: { userId?: string; status?: string; docType?: string; limit?: number }): Promise<Document[]> {
    const conditions: any[] = [];
    
    if (filters?.userId) {
      conditions.push(eq(documents.userId, filters.userId));
    }
    if (filters?.status) {
      conditions.push(eq(documents.status, filters.status));
    }
    if (filters?.docType) {
      conditions.push(eq(documents.docType, filters.docType));
    }
    
    let query;
    if (conditions.length === 0) {
      query = db.select().from(documents).orderBy(desc(documents.createdAt));
    } else if (conditions.length === 1) {
      query = db.select().from(documents).where(conditions[0]).orderBy(desc(documents.createdAt));
    } else {
      query = db.select().from(documents).where(and(...conditions)).orderBy(desc(documents.createdAt));
    }
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    
    return await query;
  }

  async getUserDocuments(userId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.createdAt));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const [created] = await db.insert(documents).values(doc).returning();
    return created;
  }

  async updateDocument(id: number, updates: Partial<InsertDocument>): Promise<Document> {
    const [updated] = await db.update(documents).set({ ...updates, updatedAt: new Date() }).where(eq(documents.id, id)).returning();
    return updated;
  }

  // Document Reviews
  async getAllDocumentReviews(): Promise<DocumentReview[]> {
    return await db.select().from(documentReviews).orderBy(desc(documentReviews.createdAt));
  }

  async getDocumentReviews(documentId: number): Promise<DocumentReview[]> {
    return await db.select().from(documentReviews).where(eq(documentReviews.documentId, documentId)).orderBy(desc(documentReviews.createdAt));
  }

  async createDocumentReview(review: InsertDocumentReview): Promise<DocumentReview> {
    const [created] = await db.insert(documentReviews).values(review).returning();
    return created;
  }

  // Reassignments
  async getAllReassignments(): Promise<Reassignment[]> {
    return await db.select().from(reassignments).orderBy(desc(reassignments.createdAt));
  }

  async getOrderReassignments(orderId: number): Promise<Reassignment[]> {
    return await db.select().from(reassignments).where(eq(reassignments.orderId, orderId)).orderBy(desc(reassignments.createdAt));
  }

  async createReassignment(reassignment: InsertReassignment): Promise<Reassignment> {
    const [created] = await db.insert(reassignments).values(reassignment).returning();
    return created;
  }

  // Webhook Logs
  async getAllWebhookLogs(filters?: { source?: string; status?: string; limit?: number }): Promise<WebhookLog[]> {
    let query = db.select().from(webhookLogs).orderBy(desc(webhookLogs.createdAt));
    
    if (filters?.source) {
      query = query.where(eq(webhookLogs.source, filters.source)) as typeof query;
    }
    if (filters?.status) {
      query = query.where(eq(webhookLogs.status, filters.status)) as typeof query;
    }
    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    
    return await query;
  }

  async getWebhookLog(id: number): Promise<WebhookLog | undefined> {
    const [log] = await db.select().from(webhookLogs).where(eq(webhookLogs.id, id));
    return log;
  }

  async createWebhookLog(log: InsertWebhookLog): Promise<WebhookLog> {
    const [created] = await db.insert(webhookLogs).values(log).returning();
    return created;
  }

  async updateWebhookLog(id: number, updates: Partial<InsertWebhookLog>): Promise<WebhookLog> {
    const [updated] = await db.update(webhookLogs).set(updates).where(eq(webhookLogs.id, id)).returning();
    return updated;
  }

  // Identity Verifications
  async getUserIdentityVerifications(userId: string): Promise<IdentityVerification[]> {
    return await db.select().from(identityVerifications).where(eq(identityVerifications.userId, userId)).orderBy(desc(identityVerifications.createdAt));
  }

  async createIdentityVerification(verification: InsertIdentityVerification): Promise<IdentityVerification> {
    const [created] = await db.insert(identityVerifications).values(verification).returning();
    return created;
  }

  async updateIdentityVerification(id: number, updates: Partial<InsertIdentityVerification>): Promise<IdentityVerification> {
    const [updated] = await db.update(identityVerifications).set(updates).where(eq(identityVerifications.id, id)).returning();
    return updated;
  }

  // Order Status Events
  async getOrderStatusEvents(orderId: number): Promise<OrderStatusEvent[]> {
    return await db.select().from(orderStatusEvents).where(eq(orderStatusEvents.orderId, orderId)).orderBy(desc(orderStatusEvents.createdAt));
  }

  async createOrderStatusEvent(event: InsertOrderStatusEvent): Promise<OrderStatusEvent> {
    const [created] = await db.insert(orderStatusEvents).values(event).returning();
    return created;
  }

  // ============================================
  // 새 운영 체계 Storage Methods
  // ============================================

  // Order Candidates (최대 3명 후보)
  async getOrderCandidates(orderId: number): Promise<OrderCandidate[]> {
    return await db.select().from(orderCandidates).where(eq(orderCandidates.orderId, orderId)).orderBy(orderCandidates.appliedAt);
  }

  async getActiveOrderCandidates(orderId: number): Promise<OrderCandidate[]> {
    return await db.select()
      .from(orderCandidates)
      .where(and(
        eq(orderCandidates.orderId, orderId),
        inArray(orderCandidates.status, ["applied", "shortlisted"])
      ))
      .orderBy(orderCandidates.appliedAt);
  }

  async getOrderCandidate(orderId: number, helperUserId: string): Promise<OrderCandidate | undefined> {
    const [candidate] = await db.select()
      .from(orderCandidates)
      .where(and(
        eq(orderCandidates.orderId, orderId),
        eq(orderCandidates.helperUserId, helperUserId)
      ));
    return candidate;
  }

  async getOrderCandidateById(candidateId: number): Promise<OrderCandidate | undefined> {
    const [candidate] = await db.select()
      .from(orderCandidates)
      .where(eq(orderCandidates.id, candidateId));
    return candidate;
  }

  async createOrderCandidate(candidate: InsertOrderCandidate): Promise<OrderCandidate> {
    const [created] = await db.insert(orderCandidates).values(candidate).returning();
    return created;
  }

  async updateOrderCandidate(id: number, updates: Partial<InsertOrderCandidate>): Promise<OrderCandidate> {
    const [updated] = await db.update(orderCandidates).set(updates).where(eq(orderCandidates.id, id)).returning();
    return updated;
  }

  async countActiveOrderCandidates(orderId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(orderCandidates)
      .where(and(
        eq(orderCandidates.orderId, orderId),
        inArray(orderCandidates.status, ["applied", "shortlisted"])
      ));
    return result[0]?.count || 0;
  }

  async getOrderCandidateCounts(orderIds: number[]): Promise<Map<number, number>> {
    if (orderIds.length === 0) return new Map();
    
    const results = await db.select({
      orderId: orderCandidates.orderId,
      count: sql<number>`count(*)`
    })
      .from(orderCandidates)
      .where(and(
        inArray(orderCandidates.orderId, orderIds),
        inArray(orderCandidates.status, ["applied", "shortlisted"])
      ))
      .groupBy(orderCandidates.orderId);
    
    const countMap = new Map<number, number>();
    for (const r of results) {
      countMap.set(r.orderId, Number(r.count));
    }
    return countMap;
  }

  async getOrderApplicationCounts(orderIds: number[]): Promise<Map<number, number>> {
    if (orderIds.length === 0) return new Map();

    const results = await db.select({
      orderId: orderApplications.orderId,
      count: sql<number>`count(*)`
    })
      .from(orderApplications)
      .where(and(
        inArray(orderApplications.orderId, orderIds),
        inArray(orderApplications.status, ["applied", "selected", "scheduled"])
      ))
      .groupBy(orderApplications.orderId);

    const countMap = new Map<number, number>();
    for (const r of results) {
      countMap.set(r.orderId, Number(r.count));
    }
    return countMap;
  }

  async getHelperApplicationStatuses(helperUserId: string, orderIds: number[]): Promise<Map<number, string>> {
    if (orderIds.length === 0) return new Map();

    const results = await db.select({
      orderId: orderApplications.orderId,
      status: orderApplications.status,
    })
      .from(orderApplications)
      .where(and(
        inArray(orderApplications.orderId, orderIds),
        eq(orderApplications.helperId, helperUserId)
      ));

    const statusMap = new Map<number, string>();
    for (const r of results) {
      statusMap.set(r.orderId, r.status as string);
    }
    return statusMap;
  }

  async getHelperCandidateStatuses(helperUserId: string, orderIds: number[]): Promise<Map<number, string>> {
    if (orderIds.length === 0) return new Map();
    
    const results = await db.select({
      orderId: orderCandidates.orderId,
      status: orderCandidates.status
    })
      .from(orderCandidates)
      .where(and(
        eq(orderCandidates.helperUserId, helperUserId),
        inArray(orderCandidates.orderId, orderIds)
      ));
    
    const statusMap = new Map<number, string>();
    for (const r of results) {
      statusMap.set(r.orderId, r.status);
    }
    return statusMap;
  }

  // Check if helper has an active order assignment (duplicate assignment prevention)
  async hasActiveOrderAssignment(helperUserId: string): Promise<{ hasActive: boolean; activeOrder?: { id: number; status: string; companyName: string } }> {
    const activeStatuses = ["scheduled", "in_progress", "closing_submitted", "final_amount_confirmed", "balance_paid"];
    
    const [activeOrder] = await db.select({
      id: orders.id,
      status: orders.status,
      companyName: orders.companyName,
    })
      .from(orders)
      .where(and(
        eq(orders.matchedHelperId, helperUserId),
        inArray(orders.status, activeStatuses)
      ))
      .limit(1);
    
    if (activeOrder && activeOrder.status) {
      return { 
        hasActive: true, 
        activeOrder: {
          id: activeOrder.id,
          status: activeOrder.status,
          companyName: activeOrder.companyName,
        }
      };
    }
    return { hasActive: false };
  }

  // Helper Rating Summary
  async getHelperRatingSummary(helperUserId: string): Promise<HelperRatingSummary | undefined> {
    const [summary] = await db.select().from(helperRatingSummary).where(eq(helperRatingSummary.helperUserId, helperUserId));
    return summary;
  }

  async upsertHelperRatingSummary(summary: InsertHelperRatingSummary): Promise<HelperRatingSummary> {
    const existing = await this.getHelperRatingSummary(summary.helperUserId);
    if (existing) {
      const [updated] = await db.update(helperRatingSummary)
        .set({ ...summary, updatedAt: new Date() })
        .where(eq(helperRatingSummary.helperUserId, summary.helperUserId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(helperRatingSummary).values(summary).returning();
    return created;
  }

  // Contact Share Events
  async getContactShareEvents(orderId: number): Promise<ContactShareEvent[]> {
    return await db.select().from(contactShareEvents).where(eq(contactShareEvents.orderId, orderId)).orderBy(desc(contactShareEvents.createdAt));
  }

  async createContactShareEvent(event: InsertContactShareEvent): Promise<ContactShareEvent> {
    const [created] = await db.insert(contactShareEvents).values(event).returning();
    return created;
  }

  // Order Closure Reports
  async getOrderClosureReport(orderId: number): Promise<OrderClosureReport | undefined> {
    const [report] = await db.select().from(orderClosureReports).where(eq(orderClosureReports.orderId, orderId));
    return report;
  }

  async createOrderClosureReport(report: InsertOrderClosureReport): Promise<OrderClosureReport> {
    const [created] = await db.insert(orderClosureReports).values(report).returning();
    return created;
  }

  async updateOrderClosureReport(id: number, updates: Partial<InsertOrderClosureReport>): Promise<OrderClosureReport> {
    const [updated] = await db.update(orderClosureReports).set(updates).where(eq(orderClosureReports.id, id)).returning();
    return updated;
  }

  // Cost Item Types
  async getAllCostItemTypes(): Promise<CostItemType[]> {
    return await db.select().from(costItemTypes).where(eq(costItemTypes.isActive, true)).orderBy(costItemTypes.sortOrder);
  }

  async getCostItemType(id: number): Promise<CostItemType | undefined> {
    const [type] = await db.select().from(costItemTypes).where(eq(costItemTypes.id, id));
    return type;
  }

  async createCostItemType(type: InsertCostItemType): Promise<CostItemType> {
    const [created] = await db.insert(costItemTypes).values(type).returning();
    return created;
  }

  async updateCostItemType(id: number, updates: Partial<InsertCostItemType>): Promise<CostItemType> {
    const [updated] = await db.update(costItemTypes).set(updates).where(eq(costItemTypes.id, id)).returning();
    return updated;
  }

  // Order Cost Items
  async getOrderCostItems(orderId: number): Promise<OrderCostItem[]> {
    return await db.select().from(orderCostItems).where(eq(orderCostItems.orderId, orderId)).orderBy(orderCostItems.createdAt);
  }

  async createOrderCostItem(item: InsertOrderCostItem): Promise<OrderCostItem> {
    const [created] = await db.insert(orderCostItems).values(item).returning();
    return created;
  }

  async updateOrderCostItem(id: number, updates: Partial<InsertOrderCostItem>): Promise<OrderCostItem> {
    const [updated] = await db.update(orderCostItems).set(updates).where(eq(orderCostItems.id, id)).returning();
    return updated;
  }

  async deleteOrderCostItem(id: number): Promise<void> {
    await db.delete(orderCostItems).where(eq(orderCostItems.id, id));
  }

  // Carrier Proof Uploads
  async getOrderCarrierProofs(orderId: number): Promise<CarrierProofUpload[]> {
    return await db.select().from(carrierProofUploads).where(eq(carrierProofUploads.orderId, orderId)).orderBy(desc(carrierProofUploads.createdAt));
  }

  async createCarrierProofUpload(proof: InsertCarrierProofUpload): Promise<CarrierProofUpload> {
    const [created] = await db.insert(carrierProofUploads).values(proof).returning();
    return created;
  }

  async deleteCarrierProofUpload(id: number): Promise<void> {
    await db.delete(carrierProofUploads).where(eq(carrierProofUploads.id, id));
  }

  // Pricing Snapshots
  async getOrderPricingSnapshot(orderId: number): Promise<PricingSnapshot | undefined> {
    const [snapshot] = await db.select().from(pricingSnapshots).where(eq(pricingSnapshots.orderId, orderId)).orderBy(desc(pricingSnapshots.computedAt)).limit(1);
    return snapshot;
  }

  async createPricingSnapshot(snapshot: InsertPricingSnapshot): Promise<PricingSnapshot> {
    const [created] = await db.insert(pricingSnapshots).values(snapshot).returning();
    return created;
  }

  async updatePricingSnapshot(id: number, updates: Partial<InsertPricingSnapshot>): Promise<PricingSnapshot> {
    const [updated] = await db.update(pricingSnapshots).set(updates).where(eq(pricingSnapshots.id, id)).returning();
    return updated;
  }

  // Balance Invoices
  async getOrderBalanceInvoice(orderId: number): Promise<BalanceInvoice | undefined> {
    const [invoice] = await db.select().from(balanceInvoices).where(eq(balanceInvoices.orderId, orderId)).orderBy(desc(balanceInvoices.createdAt)).limit(1);
    return invoice;
  }

  async createBalanceInvoice(invoice: InsertBalanceInvoice): Promise<BalanceInvoice> {
    const [created] = await db.insert(balanceInvoices).values(invoice).returning();
    return created;
  }

  async updateBalanceInvoice(id: number, updates: Partial<InsertBalanceInvoice>): Promise<BalanceInvoice> {
    const [updated] = await db.update(balanceInvoices).set(updates).where(eq(balanceInvoices.id, id)).returning();
    return updated;
  }

  // Payouts (지급)
  async getPayout(id: number): Promise<Payout | undefined> {
    const [payout] = await db.select().from(payouts).where(eq(payouts.id, id));
    return payout;
  }

  async getPayoutBySettlement(settlementId: number): Promise<Payout | undefined> {
    const [payout] = await db.select().from(payouts).where(eq(payouts.settlementId, settlementId)).orderBy(desc(payouts.createdAt)).limit(1);
    return payout;
  }

  async getAllPayouts(filters?: { status?: string; helperId?: string; limit?: number }): Promise<Payout[]> {
    const conditions: any[] = [];
    if (filters?.status) {
      conditions.push(eq(payouts.status, filters.status));
    }
    if (filters?.helperId) {
      conditions.push(eq(payouts.helperId, filters.helperId));
    }
    
    let query;
    if (conditions.length > 0) {
      query = db.select().from(payouts).where(and(...conditions)).orderBy(desc(payouts.createdAt));
    } else {
      query = db.select().from(payouts).orderBy(desc(payouts.createdAt));
    }
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    return await query;
  }

  async createPayout(payout: InsertPayout): Promise<Payout> {
    const [created] = await db.insert(payouts).values(payout).returning();
    return created;
  }

  async updatePayout(id: number, updates: Partial<InsertPayout>): Promise<Payout> {
    const [updated] = await db.update(payouts).set({ ...updates, updatedAt: new Date() }).where(eq(payouts.id, id)).returning();
    return updated;
  }

  // Payout Events (지급 이벤트)
  async getPayoutEvents(payoutId: number): Promise<PayoutEvent[]> {
    return await db.select().from(payoutEvents).where(eq(payoutEvents.payoutId, payoutId)).orderBy(desc(payoutEvents.createdAt));
  }

  async createPayoutEvent(event: InsertPayoutEvent): Promise<PayoutEvent> {
    const [created] = await db.insert(payoutEvents).values(event).returning();
    return created;
  }

  async checkUserPermission(userId: string, permissionCode: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(staffRoleAssignments)
      .innerJoin(adminRolePermissions, eq(staffRoleAssignments.roleId, adminRolePermissions.roleId))
      .innerJoin(adminPermissions, eq(adminRolePermissions.permissionId, adminPermissions.id))
      .where(
        and(
          eq(staffRoleAssignments.userId, userId),
          eq(staffRoleAssignments.isActive, true),
          eq(adminPermissions.key, permissionCode),
          eq(adminPermissions.isActive, true)
        )
      );
    
    return (result[0]?.count || 0) > 0;
  }

  async getAdminAndHQStaffUsers(): Promise<{ id: string; name: string | null; email: string }[]> {
    const result = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(
      or(
        eq(users.role, "superadmin"),
        eq(users.role, "hq_staff"),
        eq(users.role, "admin")
      )
    );
    return result;
  }

  // Monthly Settlement Statements (월 정산서)
  async createMonthlySettlementStatement(data: InsertMonthlySettlementStatement): Promise<MonthlySettlementStatement> {
    const [created] = await db.insert(monthlySettlementStatements).values(data).returning();
    return created;
  }

  async getMonthlySettlementStatementsByHelper(helperId: string): Promise<MonthlySettlementStatement[]> {
    return await db.select().from(monthlySettlementStatements)
      .where(eq(monthlySettlementStatements.helperId, helperId))
      .orderBy(desc(monthlySettlementStatements.year), desc(monthlySettlementStatements.month));
  }

  async getMonthlySettlementStatementByHelperAndMonth(helperId: string, year: number, month: number): Promise<MonthlySettlementStatement | undefined> {
    const [statement] = await db.select().from(monthlySettlementStatements)
      .where(and(
        eq(monthlySettlementStatements.helperId, helperId),
        eq(monthlySettlementStatements.year, year),
        eq(monthlySettlementStatements.month, month)
      ));
    return statement;
  }

  async getMonthlySettlementStatementById(id: number): Promise<MonthlySettlementStatement | undefined> {
    const [statement] = await db.select().from(monthlySettlementStatements)
      .where(eq(monthlySettlementStatements.id, id));
    return statement;
  }

  async updateMonthlySettlementStatement(id: number, updates: Partial<InsertMonthlySettlementStatement>): Promise<MonthlySettlementStatement> {
    const [updated] = await db.update(monthlySettlementStatements)
      .set(updates)
      .where(eq(monthlySettlementStatements.id, id))
      .returning();
    return updated;
  }

  async markMonthlyStatementViewed(id: number): Promise<MonthlySettlementStatement> {
    const [updated] = await db.update(monthlySettlementStatements)
      .set({ status: "viewed", viewedAt: new Date() })
      .where(eq(monthlySettlementStatements.id, id))
      .returning();
    return updated;
  }

  // ==========================================
  // Setting Change History (설정 변경 이력)
  // ==========================================
  async createSettingChangeHistory(entry: InsertSettingChangeHistory): Promise<SettingChangeHistory> {
    const [created] = await db.insert(settingChangeHistory).values(entry).returning();
    return created;
  }

  async getSettingChangeHistory(filters?: {
    settingType?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: SettingChangeHistory[]; total: number }> {
    const conditions: any[] = [];
    if (filters?.settingType) {
      conditions.push(eq(settingChangeHistory.settingType, filters.settingType));
    }
    if (filters?.status) {
      conditions.push(eq(settingChangeHistory.status, filters.status));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 총 개수 조회
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(settingChangeHistory)
      .where(whereClause);
    const total = Number(countResult?.count || 0);

    // 페이징
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    const data = await db.select().from(settingChangeHistory)
      .where(whereClause)
      .orderBy(desc(settingChangeHistory.createdAt))
      .limit(limit)
      .offset(offset);

    return { data, total };
  }

  async getPendingChanges(beforeDate?: Date): Promise<SettingChangeHistory[]> {
    const now = beforeDate || new Date();
    const nowStr = now.toISOString().slice(0, 16).replace('T', ' ');

    return db.select().from(settingChangeHistory)
      .where(and(
        eq(settingChangeHistory.status, "pending"),
        lte(settingChangeHistory.effectiveFrom, nowStr)
      ))
      .orderBy(settingChangeHistory.effectiveFrom);
  }

  async updateSettingChangeHistoryStatus(id: number, status: string, appliedAt?: Date): Promise<SettingChangeHistory> {
    const updates: any = { status };
    if (appliedAt) updates.appliedAt = appliedAt;
    const [updated] = await db.update(settingChangeHistory)
      .set(updates)
      .where(eq(settingChangeHistory.id, id))
      .returning();
    return updated;
  }

  async getSettingChangeHistoryById(id: number): Promise<SettingChangeHistory | undefined> {
    const [record] = await db.select().from(settingChangeHistory)
      .where(eq(settingChangeHistory.id, id));
    return record;
  }
}

export const storage = new DatabaseStorage();
export { db };
