/**
 * PG (Payment Gateway) 연동 서비스
 *
 * PortOne(구 아임포트) V2 API를 사용하여 결제/환불/조회를 처리합니다.
 * Toss Payments도 PortOne을 통해 지원됩니다.
 *
 * 환경변수:
 *   PORTONE_API_SECRET  – PortOne V2 API Secret Key
 *   PORTONE_STORE_ID    – PortOne 상점 ID (선택)
 *   PG_MODE             – "live" | "test" (기본: test)
 */

// ============================================
// 타입 정의
// ============================================

export interface PGRefundRequest {
  paymentId: string;         // 결제 건 ID (PG 트랜잭션 ID)
  amount?: number;           // 환불 금액 (미지정 시 전액 환불)
  reason: string;            // 환불 사유
  taxFreeAmount?: number;    // 면세 금액
}

export interface PGRefundResult {
  success: boolean;
  refundId?: string;         // PG사 환불 건 ID
  refundedAmount: number;    // 실제 환불 금액
  status: string;            // 환불 상태
  message: string;
  pgRawResponse?: any;       // PG사 원본 응답 (디버깅용)
}

export interface PGPaymentStatus {
  success: boolean;
  paymentId: string;         // 결제 건 ID
  status: PGPaymentStatusType;
  amount: number;
  paidAt?: string;
  cancelledAt?: string;
  method?: string;           // 결제 수단
  message: string;
  pgRawResponse?: any;
}

export type PGPaymentStatusType =
  | "READY"          // 결제 대기
  | "PAID"           // 결제 완료
  | "FAILED"         // 결제 실패
  | "CANCELLED"      // 전액 취소
  | "PARTIAL_CANCELLED"  // 부분 취소
  | "VIRTUAL_ACCOUNT_ISSUED"; // 가상계좌 발급됨

// 내부 상태 → DB 상태 매핑
export function mapPGStatusToDBStatus(pgStatus: PGPaymentStatusType): string {
  switch (pgStatus) {
    case "READY": return "pending";
    case "PAID": return "completed";
    case "FAILED": return "failed";
    case "CANCELLED": return "refunded";
    case "PARTIAL_CANCELLED": return "refunded";
    case "VIRTUAL_ACCOUNT_ISSUED": return "awaiting_deposit";
    default: return "pending";
  }
}

// ============================================
// PG 서비스 클래스
// ============================================

class PGService {
  private apiSecret: string;
  private storeId: string;
  private baseUrl: string;
  private isTestMode: boolean;

  constructor() {
    this.apiSecret = process.env.PORTONE_API_SECRET || "";
    this.storeId = process.env.PORTONE_STORE_ID || "";
    this.isTestMode = process.env.PG_MODE !== "live";
    this.baseUrl = "https://api.portone.io";
  }

  /**
   * 설정이 유효한지 확인
   */
  isConfigured(): boolean {
    return !!this.apiSecret;
  }

  /**
   * PortOne API 호출 공통 메서드
   */
  private async callAPI<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new PGServiceError(
        "PG_NOT_CONFIGURED",
        "PortOne API Secret이 설정되지 않았습니다. PORTONE_API_SECRET 환경변수를 확인해주세요."
      );
    }

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Authorization": `PortOne ${this.apiSecret}`,
      "Content-Type": "application/json",
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new PGServiceError(
          responseData.code || "PG_API_ERROR",
          responseData.message || `PG API 요청 실패 (HTTP ${response.status})`,
          responseData
        );
      }

      return responseData as T;
    } catch (err) {
      if (err instanceof PGServiceError) throw err;
      throw new PGServiceError(
        "PG_NETWORK_ERROR",
        `PG API 연결 실패: ${(err as Error).message}`
      );
    }
  }

  // ============================================
  // 결제 조회
  // ============================================

  /**
   * PG사에서 결제 상태를 조회합니다.
   * @param paymentId PG 결제 건 ID (pgTransactionId)
   */
  async getPaymentStatus(paymentId: string): Promise<PGPaymentStatus> {
    if (!paymentId) {
      return {
        success: false,
        paymentId: "",
        status: "READY",
        amount: 0,
        message: "pgTransactionId가 없어 PG 상태를 조회할 수 없습니다.",
      };
    }

    // 테스트 모드에서 API키 미설정 시 시뮬레이션
    if (!this.isConfigured() && this.isTestMode) {
      console.warn("[PG] 테스트 모드 - API키 미설정으로 시뮬레이션 응답 반환");
      return {
        success: true,
        paymentId,
        status: "PAID",
        amount: 0,
        message: "[테스트 모드] PG 연동 시 실제 상태가 표시됩니다.",
      };
    }

    try {
      const data = await this.callAPI<any>("GET", `/payments/${encodeURIComponent(paymentId)}`);

      const pgStatus = this.mapPortOneStatus(data.status);

      return {
        success: true,
        paymentId,
        status: pgStatus,
        amount: data.amount?.total || 0,
        paidAt: data.paidAt,
        cancelledAt: data.cancelledAt,
        method: data.method?.type,
        message: "결제 상태 조회 성공",
        pgRawResponse: data,
      };
    } catch (err) {
      if (err instanceof PGServiceError) {
        return {
          success: false,
          paymentId,
          status: "READY",
          amount: 0,
          message: err.message,
          pgRawResponse: err.rawResponse,
        };
      }
      return {
        success: false,
        paymentId,
        status: "READY",
        amount: 0,
        message: `결제 상태 조회 실패: ${(err as Error).message}`,
      };
    }
  }

  // ============================================
  // 환불 처리
  // ============================================

  /**
   * PG사를 통해 결제를 환불 처리합니다.
   * 전액 환불 및 부분 환불을 지원합니다.
   */
  async processRefund(request: PGRefundRequest): Promise<PGRefundResult> {
    if (!request.paymentId) {
      return {
        success: false,
        refundedAmount: 0,
        status: "FAILED",
        message: "pgTransactionId가 없어 PG 환불을 처리할 수 없습니다. DB 상태만 업데이트됩니다.",
      };
    }

    // 테스트 모드에서 API키 미설정 시 시뮬레이션
    if (!this.isConfigured() && this.isTestMode) {
      console.warn("[PG] 테스트 모드 - 환불 시뮬레이션");
      return {
        success: true,
        refundId: `test_refund_${Date.now()}`,
        refundedAmount: request.amount || 0,
        status: "SUCCEEDED",
        message: "[테스트 모드] PG 환불 시뮬레이션 성공",
      };
    }

    try {
      const body: any = {
        reason: request.reason,
      };

      // 부분 환불인 경우 금액 지정
      if (request.amount) {
        body.amount = request.amount;
        if (request.taxFreeAmount !== undefined) {
          body.taxFreeAmount = request.taxFreeAmount;
        }
      }

      const data = await this.callAPI<any>(
        "POST",
        `/payments/${encodeURIComponent(request.paymentId)}/cancel`,
        body
      );

      return {
        success: true,
        refundId: data.cancellation?.id,
        refundedAmount: data.cancellation?.totalAmount || request.amount || 0,
        status: data.cancellation?.status || "SUCCEEDED",
        message: "환불 처리 성공",
        pgRawResponse: data,
      };
    } catch (err) {
      if (err instanceof PGServiceError) {
        return {
          success: false,
          refundedAmount: 0,
          status: "FAILED",
          message: err.message,
          pgRawResponse: err.rawResponse,
        };
      }
      return {
        success: false,
        refundedAmount: 0,
        status: "FAILED",
        message: `환불 처리 실패: ${(err as Error).message}`,
      };
    }
  }

  // ============================================
  // 유틸리티
  // ============================================

  /**
   * PortOne 결제 상태를 내부 상태로 매핑
   */
  private mapPortOneStatus(portoneStatus: string): PGPaymentStatusType {
    switch (portoneStatus) {
      case "READY":
      case "PENDING":
        return "READY";
      case "PAID":
        return "PAID";
      case "FAILED":
        return "FAILED";
      case "CANCELLED":
        return "CANCELLED";
      case "PARTIAL_CANCELLED":
        return "PARTIAL_CANCELLED";
      case "VIRTUAL_ACCOUNT_ISSUED":
        return "VIRTUAL_ACCOUNT_ISSUED";
      default:
        return "READY";
    }
  }

  /**
   * 서비스 상태 확인 (Health Check)
   */
  getServiceInfo() {
    return {
      configured: this.isConfigured(),
      testMode: this.isTestMode,
      provider: "PortOne V2",
      storeId: this.storeId ? `${this.storeId.substring(0, 8)}...` : "미설정",
    };
  }
}

// ============================================
// 커스텀 에러
// ============================================

export class PGServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public rawResponse?: any
  ) {
    super(message);
    this.name = "PGServiceError";
  }
}

// ============================================
// 싱글톤 인스턴스 내보내기
// ============================================

export const pgService = new PGService();
