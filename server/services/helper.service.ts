/**
 * Helper Service
 * 헬퍼 비즈니스 로직
 */

import { storage, db } from '../storage';
import { eq, and, desc, or, like, gte, lte, inArray } from 'drizzle-orm';
import {
  HelperProfile,
  HelperCredential,
  CreateCredentialData,
  UpdateCredentialData,
  HelperLicense,
  CreateLicenseData,
  HelperVehicle,
  CreateVehicleData,
  HelperBusiness,
  CreateBusinessData,
  HelperBankAccount,
  CreateBankAccountData,
  OnboardingStatus,
  OnboardingSubmission,
  HelperServiceArea,
  CreateServiceAreaData,
  HelperWorkDetail,
  HelperWorkHistory,
  HelperDispute,
  CreateDisputeData,
  UpdateDisputeData,
  HelperIncident,
  IncidentAction,
  HelperTermsAgreement,
  CreateTermsAgreementData,
  HelperReview,
  CreateReviewData,
  HelperTeam,
  HelperPersonalCode,
  HelperCommissionOverride,
  CreateCommissionOverrideData,
  HelperAvailability,
  HelperStats,
  DocumentReviewTask,
  IdentityVerification,
  HelperListFilters,
  HelperDetailAdmin,
  VerifyHelperData,
  RejectHelperData,
} from '../types/helper.types';
import { logger } from '../lib/logger';
import {
  users,
  helperCredentials,
  helperLicenses,
  helperVehicles,
  helperBusinesses,
  helperBankAccounts,
  helperServiceAreas,
  helperDisputes,
  helperIncidents,
  helperTermsAgreements,
  helperReviews,
  helperTeams,
  helperCommissionOverrides,
  orders,
} from '@shared/schema';

class HelperService {
  // ================================
  // Profile Management
  // ================================

  /**
   * 헬퍼 프로필 조회
   */
  async getHelperProfile(userId: string): Promise<HelperProfile | null> {
    const user = await storage.getUserById(userId);
    if (!user || user.role !== 'helper') {
      return null;
    }

    // Get stats
    const stats = await this.getHelperStats(userId);

    return {
      userId: user.id,
      name: user.name,
      phoneNumber: user.phoneNumber || '',
      email: user.email,
      isVerified: user.isVerified || false,
      verificationStatus: (user.verificationStatus as any) || 'pending',
      profileImage: user.profileImage,
      bio: user.bio,
      rating: stats.rating,
      totalOrders: stats.totalOrders,
      completedOrders: stats.completedOrders,
      joinedAt: user.createdAt,
      lastActiveAt: user.updatedAt,
    };
  }

  /**
   * 헬퍼 프로필 업데이트
   */
  async updateHelperProfile(
    userId: string,
    data: Partial<HelperProfile>
  ): Promise<HelperProfile> {
    logger.info('Updating helper profile', { userId });

    await db
      .update(users)
      .set({
        name: data.name,
        phoneNumber: data.phoneNumber,
        email: data.email,
        profileImage: data.profileImage,
        bio: data.bio,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    const updated = await this.getHelperProfile(userId);
    if (!updated) {
      throw new Error('Failed to update profile');
    }

    return updated;
  }

  /**
   * 헬퍼 통계 조회
   */
  async getHelperStats(userId: string): Promise<HelperStats> {
    // Get all orders for this helper
    const helperOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.assignedHelperId, userId));

    const completedOrders = helperOrders.filter((o) => o.status === 'completed');
    const cancelledOrders = helperOrders.filter((o) => o.status === 'cancelled');

    // Get reviews
    const reviews = await db
      .select()
      .from(helperReviews)
      .where(eq(helperReviews.helperId, userId));

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
        : 0;

    // Calculate earnings
    const totalEarnings = completedOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    // Calculate on-time delivery rate
    const onTimeOrders = completedOrders.filter((o) => {
      if (!o.completedAt || !o.scheduledDate) return false;
      return o.completedAt <= o.scheduledDate;
    });

    const onTimeRate =
      completedOrders.length > 0 ? (onTimeOrders.length / completedOrders.length) * 100 : 0;

    return {
      userId,
      totalOrders: helperOrders.length,
      completedOrders: completedOrders.length,
      cancelledOrders: cancelledOrders.length,
      rating: Math.round(avgRating * 10) / 10,
      totalReviews: reviews.length,
      totalEarnings,
      onTimeDeliveryRate: Math.round(onTimeRate * 10) / 10,
      acceptanceRate: 0, // TODO: Calculate from application data
      responseTime: 0, // TODO: Calculate from response timestamps
    };
  }

  // ================================
  // Credentials Management
  // ================================

  /**
   * 자격증명 생성
   */
  async createCredential(
    userId: string,
    data: CreateCredentialData
  ): Promise<HelperCredential> {
    logger.info('Creating helper credential', { userId, type: data.credentialType });

    const [credential] = await db
      .insert(helperCredentials)
      .values({
        userId,
        ...data,
        status: 'pending',
      })
      .returning();

    return credential as HelperCredential;
  }

  /**
   * 자격증명 조회
   */
  async getCredential(userId: string): Promise<HelperCredential | null> {
    const [credential] = await db
      .select()
      .from(helperCredentials)
      .where(eq(helperCredentials.userId, userId))
      .limit(1);

    return credential as HelperCredential || null;
  }

  /**
   * 자격증명 업데이트
   */
  async updateCredential(
    userId: string,
    data: UpdateCredentialData
  ): Promise<HelperCredential> {
    const [updated] = await db
      .update(helperCredentials)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(helperCredentials.userId, userId))
      .returning();

    return updated as HelperCredential;
  }

  // ================================
  // License Management
  // ================================

  /**
   * 면허 생성
   */
  async createLicense(userId: string, data: CreateLicenseData): Promise<HelperLicense> {
    logger.info('Creating helper license', { userId });

    const [license] = await db
      .insert(helperLicenses)
      .values({
        userId,
        ...data,
        status: 'pending',
      })
      .returning();

    return license as HelperLicense;
  }

  /**
   * 면허 조회
   */
  async getLicense(userId: string): Promise<HelperLicense | null> {
    const [license] = await db
      .select()
      .from(helperLicenses)
      .where(eq(helperLicenses.userId, userId))
      .limit(1);

    return license as HelperLicense || null;
  }

  // ================================
  // Vehicle Management
  // ================================

  /**
   * 차량 생성
   */
  async createVehicle(userId: string, data: CreateVehicleData): Promise<HelperVehicle> {
    logger.info('Creating helper vehicle', { userId });

    const [vehicle] = await db
      .insert(helperVehicles)
      .values({
        userId,
        ...data,
        status: 'pending',
      })
      .returning();

    return vehicle as HelperVehicle;
  }

  /**
   * 차량 조회
   */
  async getVehicle(userId: string): Promise<HelperVehicle | null> {
    const [vehicle] = await db
      .select()
      .from(helperVehicles)
      .where(eq(helperVehicles.userId, userId))
      .limit(1);

    return vehicle as HelperVehicle || null;
  }

  // ================================
  // Business Management
  // ================================

  /**
   * 사업자 정보 생성
   */
  async createBusiness(userId: string, data: CreateBusinessData): Promise<HelperBusiness> {
    logger.info('Creating helper business', { userId });

    const [business] = await db
      .insert(helperBusinesses)
      .values({
        userId,
        ...data,
        status: 'pending',
      })
      .returning();

    return business as HelperBusiness;
  }

  /**
   * 사업자 정보 조회
   */
  async getBusiness(userId: string): Promise<HelperBusiness | null> {
    const [business] = await db
      .select()
      .from(helperBusinesses)
      .where(eq(helperBusinesses.userId, userId))
      .limit(1);

    return business as HelperBusiness || null;
  }

  // ================================
  // Bank Account Management
  // ================================

  /**
   * 계좌 정보 생성
   */
  async createBankAccount(
    userId: string,
    data: CreateBankAccountData
  ): Promise<HelperBankAccount> {
    logger.info('Creating helper bank account', { userId });

    const [account] = await db
      .insert(helperBankAccounts)
      .values({
        userId,
        ...data,
        status: 'pending',
      })
      .returning();

    return account as HelperBankAccount;
  }

  /**
   * 계좌 정보 조회
   */
  async getBankAccount(userId: string): Promise<HelperBankAccount | null> {
    const [account] = await db
      .select()
      .from(helperBankAccounts)
      .where(eq(helperBankAccounts.userId, userId))
      .limit(1);

    return account as HelperBankAccount || null;
  }

  // ================================
  // Onboarding
  // ================================

  /**
   * 온보딩 상태 조회
   */
  async getOnboardingStatus(userId: string): Promise<OnboardingStatus> {
    const [credential, license, vehicle, business, bankAccount, termsAgreement] =
      await Promise.all([
        this.getCredential(userId),
        this.getLicense(userId),
        this.getVehicle(userId),
        this.getBusiness(userId),
        this.getBankAccount(userId),
        this.getTermsAgreement(userId),
      ]);

    const hasCredential = !!credential;
    const hasLicense = !!license;
    const hasVehicle = !!vehicle;
    const hasBusiness = !!business;
    const hasBankAccount = !!bankAccount;
    const hasTermsAgreement = !!termsAgreement;

    const completedSteps = [
      hasCredential,
      hasLicense,
      hasVehicle,
      hasBusiness,
      hasBankAccount,
      hasTermsAgreement,
    ].filter(Boolean).length;

    const totalSteps = 6;
    const isComplete = completedSteps === totalSteps;

    const missingSteps: string[] = [];
    if (!hasCredential) missingSteps.push('credential');
    if (!hasLicense) missingSteps.push('license');
    if (!hasVehicle) missingSteps.push('vehicle');
    if (!hasBusiness) missingSteps.push('business');
    if (!hasBankAccount) missingSteps.push('bankAccount');
    if (!hasTermsAgreement) missingSteps.push('termsAgreement');

    return {
      userId,
      hasCredential,
      hasLicense,
      hasVehicle,
      hasBusiness,
      hasBankAccount,
      hasTermsAgreement,
      isComplete,
      completedSteps,
      totalSteps,
      missingSteps,
    };
  }

  /**
   * 온보딩 제출
   */
  async submitOnboarding(userId: string): Promise<OnboardingSubmission> {
    logger.info('Submitting onboarding', { userId });

    const status = await this.getOnboardingStatus(userId);

    if (!status.isComplete) {
      throw new Error(
        `Onboarding incomplete. Missing: ${status.missingSteps.join(', ')}`
      );
    }

    // Update user status to pending verification
    await db
      .update(users)
      .set({
        verificationStatus: 'in_review',
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return {
      userId,
      submittedAt: new Date(),
      status: 'pending',
    };
  }

  // ================================
  // Service Areas
  // ================================

  /**
   * 서비스 지역 조회
   */
  async getServiceAreas(userId: string): Promise<HelperServiceArea[]> {
    const areas = await db
      .select()
      .from(helperServiceAreas)
      .where(eq(helperServiceAreas.userId, userId));

    return areas as HelperServiceArea[];
  }

  /**
   * 서비스 지역 추가
   */
  async createServiceArea(
    userId: string,
    data: CreateServiceAreaData
  ): Promise<HelperServiceArea> {
    logger.info('Creating service area', { userId, area: data.areaName });

    const [area] = await db
      .insert(helperServiceAreas)
      .values({
        userId,
        ...data,
        isActive: true,
      })
      .returning();

    return area as HelperServiceArea;
  }

  // ================================
  // Disputes & Incidents
  // ================================

  /**
   * 분쟁 목록 조회
   */
  async getDisputes(userId: string): Promise<HelperDispute[]> {
    const disputes = await db
      .select()
      .from(helperDisputes)
      .where(eq(helperDisputes.helperId, userId))
      .orderBy(desc(helperDisputes.createdAt));

    return disputes as HelperDispute[];
  }

  /**
   * 분쟁 상세 조회
   */
  async getDisputeById(id: number): Promise<HelperDispute | null> {
    const [dispute] = await db
      .select()
      .from(helperDisputes)
      .where(eq(helperDisputes.id, id))
      .limit(1);

    return dispute as HelperDispute || null;
  }

  /**
   * 분쟁 생성
   */
  async createDispute(userId: string, data: CreateDisputeData): Promise<HelperDispute> {
    logger.info('Creating dispute', { userId, title: data.title });

    const [dispute] = await db
      .insert(helperDisputes)
      .values({
        helperId: userId,
        ...data,
        status: 'open',
        priority: data.priority || 'medium',
      })
      .returning();

    return dispute as HelperDispute;
  }

  /**
   * 사고 목록 조회
   */
  async getIncidents(userId: string): Promise<HelperIncident[]> {
    const incidents = await db
      .select()
      .from(helperIncidents)
      .where(eq(helperIncidents.helperId, userId))
      .orderBy(desc(helperIncidents.reportedAt));

    return incidents as HelperIncident[];
  }

  /**
   * 사고 상세 조회
   */
  async getIncidentById(id: number): Promise<HelperIncident | null> {
    const [incident] = await db
      .select()
      .from(helperIncidents)
      .where(eq(helperIncidents.id, id))
      .limit(1);

    return incident as HelperIncident || null;
  }

  /**
   * 사고 조치
   */
  async handleIncidentAction(
    userId: string,
    action: IncidentAction
  ): Promise<HelperIncident> {
    logger.info('Handling incident action', {
      userId,
      incidentId: action.incidentId,
      action: action.action,
    });

    const incident = await this.getIncidentById(action.incidentId);
    if (!incident) {
      throw new Error('Incident not found');
    }

    if (incident.helperId !== userId) {
      throw new Error('Not authorized');
    }

    // Update incident based on action
    // This is a simplified version - real implementation would be more complex
    const [updated] = await db
      .update(helperIncidents)
      .set({
        status: action.action === 'acknowledge' ? 'under_investigation' : incident.status,
        resolution: action.notes,
      })
      .where(eq(helperIncidents.id, action.incidentId))
      .returning();

    return updated as HelperIncident;
  }

  // ================================
  // Terms Agreement
  // ================================

  /**
   * 약관 동의 조회
   */
  async getTermsAgreement(userId: string): Promise<HelperTermsAgreement | null> {
    const [agreement] = await db
      .select()
      .from(helperTermsAgreements)
      .where(eq(helperTermsAgreements.userId, userId))
      .orderBy(desc(helperTermsAgreements.agreedAt))
      .limit(1);

    return agreement as HelperTermsAgreement || null;
  }

  /**
   * 약관 동의
   */
  async createTermsAgreement(
    userId: string,
    data: CreateTermsAgreementData
  ): Promise<HelperTermsAgreement> {
    logger.info('Creating terms agreement', { userId, version: data.termsVersion });

    const [agreement] = await db
      .insert(helperTermsAgreements)
      .values({
        userId,
        ...data,
      })
      .returning();

    return agreement as HelperTermsAgreement;
  }

  // ================================
  // Reviews
  // ================================

  /**
   * 완료된 주문 목록 (리뷰용)
   */
  async getCompletedOrdersForReview(userId: string): Promise<any[]> {
    const completedOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.assignedHelperId, userId),
          eq(orders.status, 'completed')
        )
      )
      .orderBy(desc(orders.completedAt))
      .limit(50);

    // Filter out orders that already have reviews
    const ordersWithoutReviews = [];
    for (const order of completedOrders) {
      const [existingReview] = await db
        .select()
        .from(helperReviews)
        .where(eq(helperReviews.orderId, order.id))
        .limit(1);

      if (!existingReview) {
        ordersWithoutReviews.push(order);
      }
    }

    return ordersWithoutReviews;
  }

  /**
   * 리뷰 생성
   */
  async createReview(userId: string, data: CreateReviewData): Promise<HelperReview> {
    logger.info('Creating review', { userId, orderId: data.orderId, rating: data.rating });

    // Verify order belongs to this helper
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, data.orderId))
      .limit(1);

    if (!order || order.assignedHelperId !== userId) {
      throw new Error('Order not found or not assigned to this helper');
    }

    const [review] = await db
      .insert(helperReviews)
      .values({
        orderId: data.orderId,
        helperId: userId,
        requesterId: order.requesterId,
        rating: data.rating,
        comment: data.comment,
      })
      .returning();

    return review as HelperReview;
  }

  // ================================
  // Work History
  // ================================

  /**
   * 작업 세부사항 조회
   */
  async getWorkDetail(userId: string, date: Date): Promise<HelperWorkDetail> {
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const dayOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.assignedHelperId, userId),
          eq(orders.status, 'completed'),
          gte(orders.completedAt, startOfDay),
          lte(orders.completedAt, endOfDay)
        )
      );

    const ordersCompleted = dayOrders.length;
    const totalEarnings = dayOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    // Get reviews for these orders
    const orderIds = dayOrders.map((o) => o.id);
    const reviews = await db
      .select()
      .from(helperReviews)
      .where(inArray(helperReviews.orderId, orderIds));

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
        : 0;

    return {
      date: startOfDay,
      ordersCompleted,
      totalEarnings,
      averageRating: Math.round(avgRating * 10) / 10,
      orders: dayOrders.map((o) => {
        const review = reviews.find((r) => r.orderId === o.id);
        return {
          orderId: o.id,
          title: o.title,
          completedAt: o.completedAt || new Date(),
          earnings: o.totalPrice || 0,
          rating: review?.rating,
        };
      }),
    };
  }

  /**
   * 작업 이력 조회
   */
  async getWorkHistory(
    userId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<HelperWorkHistory> {
    const periodOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.assignedHelperId, userId),
          gte(orders.createdAt, periodStart),
          lte(orders.createdAt, periodEnd)
        )
      );

    const completedOrders = periodOrders.filter((o) => o.status === 'completed');
    const cancelledOrders = periodOrders.filter((o) => o.status === 'cancelled');

    const totalEarnings = completedOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    // Get reviews
    const orderIds = completedOrders.map((o) => o.id);
    const reviews = await db
      .select()
      .from(helperReviews)
      .where(inArray(helperReviews.orderId, orderIds));

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
        : 0;

    // Calculate orders per day
    const ordersPerDay: Record<string, number> = {};
    completedOrders.forEach((o) => {
      if (o.completedAt) {
        const dateKey = o.completedAt.toISOString().split('T')[0];
        ordersPerDay[dateKey] = (ordersPerDay[dateKey] || 0) + 1;
      }
    });

    // Find top performing days
    const topPerformingDays = Object.entries(ordersPerDay)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([date]) => new Date(date));

    return {
      userId,
      period: {
        start: periodStart,
        end: periodEnd,
      },
      totalOrders: periodOrders.length,
      completedOrders: completedOrders.length,
      cancelledOrders: cancelledOrders.length,
      totalEarnings,
      averageRating: Math.round(avgRating * 10) / 10,
      topPerformingDays,
      ordersPerDay,
    };
  }

  // ================================
  // Admin Functions
  // ================================

  /**
   * 헬퍼 목록 조회 (관리자)
   */
  async getHelpers(filters?: HelperListFilters): Promise<HelperProfile[]> {
    let query = db.select().from(users).where(eq(users.role, 'helper'));

    // Apply filters
    // This is simplified - real implementation would need more complex filtering

    const helpers = await query.orderBy(desc(users.createdAt));

    const profiles = await Promise.all(
      helpers.map(async (h) => {
        const profile = await this.getHelperProfile(h.id);
        return profile!;
      })
    );

    return profiles.filter((p) => p !== null);
  }

  /**
   * 헬퍼 상세 조회 (관리자)
   */
  async getHelperDetail(userId: string): Promise<HelperDetailAdmin | null> {
    const profile = await this.getHelperProfile(userId);
    if (!profile) return null;

    const [
      credential,
      license,
      vehicle,
      business,
      bankAccount,
      stats,
      serviceAreas,
      recentDisputes,
      recentIncidents,
    ] = await Promise.all([
      this.getCredential(userId),
      this.getLicense(userId),
      this.getVehicle(userId),
      this.getBusiness(userId),
      this.getBankAccount(userId),
      this.getHelperStats(userId),
      this.getServiceAreas(userId),
      this.getDisputes(userId),
      this.getIncidents(userId),
    ]);

    // Get recent orders
    const recentOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.assignedHelperId, userId))
      .orderBy(desc(orders.createdAt))
      .limit(10);

    return {
      profile,
      credential: credential || undefined,
      license: license || undefined,
      vehicle: vehicle || undefined,
      business: business || undefined,
      bankAccount: bankAccount || undefined,
      stats,
      serviceAreas,
      recentOrders,
      recentDisputes: recentDisputes.slice(0, 5),
      recentIncidents: recentIncidents.slice(0, 5),
    };
  }

  /**
   * 헬퍼 검증
   */
  async verifyHelper(data: VerifyHelperData): Promise<void> {
    logger.info('Verifying helper', { userId: data.userId, verifiedBy: data.verifiedBy });

    await db
      .update(users)
      .set({
        isVerified: true,
        verificationStatus: 'verified',
        updatedAt: new Date(),
      })
      .where(eq(users.id, data.userId));

    // Also verify all credentials
    await Promise.all([
      db
        .update(helperCredentials)
        .set({ status: 'verified', verifiedAt: new Date(), verifiedBy: data.verifiedBy })
        .where(eq(helperCredentials.userId, data.userId)),
      db
        .update(helperLicenses)
        .set({ status: 'verified', verifiedAt: new Date(), verifiedBy: data.verifiedBy })
        .where(eq(helperLicenses.userId, data.userId)),
      db
        .update(helperVehicles)
        .set({ status: 'verified', verifiedAt: new Date(), verifiedBy: data.verifiedBy })
        .where(eq(helperVehicles.userId, data.userId)),
      db
        .update(helperBusinesses)
        .set({ status: 'verified', verifiedAt: new Date(), verifiedBy: data.verifiedBy })
        .where(eq(helperBusinesses.userId, data.userId)),
      db
        .update(helperBankAccounts)
        .set({ status: 'verified', verifiedAt: new Date(), verifiedBy: data.verifiedBy })
        .where(eq(helperBankAccounts.userId, data.userId)),
    ]);
  }

  /**
   * 헬퍼 검증 거부
   */
  async rejectHelper(data: RejectHelperData): Promise<void> {
    logger.info('Rejecting helper', { userId: data.userId, rejectedBy: data.rejectedBy });

    await db
      .update(users)
      .set({
        isVerified: false,
        verificationStatus: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(users.id, data.userId));
  }

  /**
   * 헬퍼 검증 취소
   */
  async unverifyHelper(userId: string, unverifiedBy: string): Promise<void> {
    logger.info('Unverifying helper', { userId, unverifiedBy });

    await db
      .update(users)
      .set({
        isVerified: false,
        verificationStatus: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  // ================================
  // Commission Overrides
  // ================================

  /**
   * 수수료 오버라이드 조회
   */
  async getCommissionOverride(helperId: string): Promise<HelperCommissionOverride | null> {
    const now = new Date();
    const [override] = await db
      .select()
      .from(helperCommissionOverrides)
      .where(
        and(
          eq(helperCommissionOverrides.helperId, helperId),
          lte(helperCommissionOverrides.effectiveFrom, now),
          or(
            eq(helperCommissionOverrides.effectiveTo, null),
            gte(helperCommissionOverrides.effectiveTo, now)
          )
        )
      )
      .limit(1);

    return override as HelperCommissionOverride || null;
  }

  /**
   * 수수료 오버라이드 생성
   */
  async createCommissionOverride(
    data: CreateCommissionOverrideData,
    createdBy: string
  ): Promise<HelperCommissionOverride> {
    logger.info('Creating commission override', {
      helperId: data.helperId,
      rate: data.commissionRate,
    });

    const [override] = await db
      .insert(helperCommissionOverrides)
      .values({
        ...data,
        createdBy,
      })
      .returning();

    return override as HelperCommissionOverride;
  }
}

export const helperService = new HelperService();
