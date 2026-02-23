/**
 * Hellp Me API 문서 (OpenAPI 3.0 / Swagger)
 *
 * 이 파일은 OpenAPI 3.0 스펙 기반 API 문서를 제공합니다.
 * 서버 시작 시 /api/docs (JSON) 및 /api/docs/ui (Swagger UI) 를 등록합니다.
 */

import type { Express } from "express";

const API_VERSION = "1.0.0";

export function registerApiDocs(app: Express): void {
  const spec = getOpenAPISpec();

  // OpenAPI JSON 스펙
  app.get("/api/docs", (_req, res) => {
    res.json(spec);
  });

  // 간이 Swagger UI (CDN 기반)
  app.get("/api/docs/ui", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>Hellp Me API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/docs',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'StandaloneLayout',
    });
  </script>
</body>
</html>`);
  });

  console.log("[API Docs] Swagger UI: /api/docs/ui | OpenAPI JSON: /api/docs");
}

function getOpenAPISpec() {
  return {
    openapi: "3.0.3",
    info: {
      title: "Hellp Me Platform API",
      description: "헬프미 플랫폼 - 헬퍼/요청자 매칭, 정산, 결제 관리 API",
      version: API_VERSION,
      contact: {
        name: "Hellp Me Dev Team",
      },
    },
    servers: [
      { url: "/", description: "현재 서버" },
    ],
    tags: [
      { name: "Health", description: "서버 상태 확인" },
      { name: "Auth", description: "인증 (회원가입, 로그인, OAuth)" },
      { name: "Helper", description: "헬퍼 관련 API (오더 지원, 마감, QR 체크인)" },
      { name: "Requester", description: "요청자 관련 API (오더 생성, 결제)" },
      { name: "Settlement", description: "정산 관리" },
      { name: "Payment", description: "결제 관리 (PG 연동)" },
      { name: "Admin", description: "관리자 API" },
      { name: "Admin-Settlement", description: "관리자 정산 관리" },
      { name: "Admin-Payment", description: "관리자 결제 관리" },
      { name: "Admin-Dispute", description: "관리자 이의제기 관리" },
      { name: "Admin-Incident", description: "관리자 사고 관리" },
      { name: "Admin-TaxInvoice", description: "관리자 세금계산서 관리" },
      { name: "Team", description: "팀 관리" },
      { name: "Push", description: "푸시 알림" },
      { name: "Partner-Auth", description: "파트너(팀장) 인증" },
      { name: "Partner-Dashboard", description: "파트너 대시보드" },
      { name: "Partner-Order", description: "파트너 오더 관리" },
      { name: "Partner-Member", description: "파트너 팀원 관리" },
      { name: "Partner-Settlement", description: "파트너 정산 조회" },
      { name: "Partner-CS", description: "파트너 CS 문의" },
      { name: "Partner-Incident", description: "파트너 사고 관리" },
      { name: "Partner-Settings", description: "파트너 설정" },
      { name: "Checkin", description: "출근 체크 (QR/코드)" },
      { name: "Notification", description: "알림 관리" },
      { name: "Review", description: "리뷰/평점" },
      { name: "Meta", description: "메타 데이터/주소 검색" },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT 토큰 인증. Authorization: Bearer {token}",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "NOT_FOUND" },
                message: { type: "string", example: "리소스를 찾을 수 없습니다" },
              },
            },
          },
        },
        Payment: {
          type: "object",
          properties: {
            id: { type: "integer" },
            orderId: { type: "integer" },
            amount: { type: "number" },
            status: {
              type: "string",
              enum: ["pending", "awaiting_deposit", "captured", "completed", "failed", "cancelled", "refunded"],
            },
            pgTransactionId: { type: "string", nullable: true },
            refundedAt: { type: "string", format: "date-time", nullable: true },
            refundReason: { type: "string", nullable: true },
          },
        },
        Settlement: {
          type: "object",
          properties: {
            id: { type: "integer" },
            orderId: { type: "integer" },
            helperId: { type: "integer" },
            deliveredCount: { type: "integer" },
            returnedCount: { type: "integer" },
            etcCount: { type: "integer" },
            supplyAmount: { type: "number" },
            vatAmount: { type: "number" },
            totalAmount: { type: "number" },
            platformFee: { type: "number" },
            driverPayout: { type: "number" },
            status: { type: "string", enum: ["CALCULATED", "CONFIRMED", "APPROVED", "PAID"] },
          },
        },
        TaxInvoice: {
          type: "object",
          properties: {
            id: { type: "integer" },
            targetType: { type: "string", enum: ["helper", "requester"] },
            targetId: { type: "string" },
            targetName: { type: "string" },
            businessName: { type: "string" },
            businessNumber: { type: "string" },
            supplyAmount: { type: "number" },
            vatAmount: { type: "number" },
            totalAmount: { type: "number" },
            status: { type: "string", enum: ["draft", "issued", "sent", "failed", "cancelled"] },
            issueDate: { type: "string", format: "date-time", nullable: true },
            year: { type: "integer" },
            month: { type: "integer" },
          },
        },
        PGInfo: {
          type: "object",
          properties: {
            configured: { type: "boolean" },
            testMode: { type: "boolean" },
            provider: { type: "string" },
          },
        },
        PartnerTeamInfo: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            commissionRate: { type: "integer" },
            businessType: { type: "string", nullable: true },
          },
        },
        TeamMember: {
          type: "object",
          properties: {
            id: { type: "integer" },
            helperId: { type: "string" },
            isActive: { type: "boolean" },
            joinedAt: { type: "string", format: "date-time" },
            user: { type: "object", nullable: true },
          },
        },
        CSInquiry: {
          type: "object",
          properties: {
            id: { type: "integer" },
            teamId: { type: "integer" },
            reporterId: { type: "string" },
            title: { type: "string" },
            content: { type: "string" },
            category: { type: "string", enum: ["order", "payment", "settlement", "member", "other"] },
            status: { type: "string", enum: ["pending", "in_progress", "resolved", "closed"] },
            priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        TeamIncident: {
          type: "object",
          properties: {
            id: { type: "integer" },
            teamId: { type: "integer" },
            helperId: { type: "string" },
            incidentType: { type: "string", enum: ["damage", "loss", "misdelivery", "delay", "accident", "other"] },
            description: { type: "string" },
            status: { type: "string", enum: ["reported", "investigating", "resolved", "closed"] },
            severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        PaginatedList: {
          type: "object",
          properties: {
            total: { type: "integer" },
            page: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
      },
    },
    paths: {
      // ===== Health =====
      "/api/health": {
        get: {
          tags: ["Health"],
          summary: "서버 상태 확인",
          description: "서버 및 데이터베이스 연결 상태를 확인합니다.",
          responses: {
            200: {
              description: "정상",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "ok" },
                      db: { type: "string", example: "connected" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/health/pg": {
        get: {
          tags: ["Health"],
          summary: "PG 서비스 상태 확인",
          description: "PG(PortOne) 연동 상태와 설정 정보를 확인합니다.",
          responses: {
            200: {
              description: "PG 상태 정보",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/PGInfo" },
                },
              },
            },
          },
        },
      },

      // ===== Auth =====
      "/api/auth/signup": {
        post: {
          tags: ["Auth"],
          summary: "회원가입",
          description: "이메일/비밀번호 기반 회원가입. 역할(helper/requester) 선택 필수.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password", "name", "phoneNumber", "role"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string", minLength: 8 },
                    name: { type: "string" },
                    phoneNumber: { type: "string", example: "01012345678" },
                    role: { type: "string", enum: ["helper", "requester"] },
                    agreedTerms: { type: "boolean" },
                    agreedPrivacy: { type: "boolean" },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "회원가입 성공. JWT 토큰 반환." },
            400: { description: "입력값 오류" },
            409: { description: "이메일 중복" },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "로그인",
          description: "이메일/비밀번호로 로그인하여 JWT 토큰을 발급받습니다.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "로그인 성공",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      token: { type: "string" },
                      refreshToken: { type: "string" },
                      user: { type: "object" },
                    },
                  },
                },
              },
            },
            401: { description: "인증 실패" },
          },
        },
      },

      // ===== Admin Payment =====
      "/api/admin/payments/{id}/refund": {
        post: {
          tags: ["Admin-Payment"],
          summary: "결제 환불 처리",
          description: "PG사를 통한 결제 환불을 처리합니다. 전액/부분 환불 지원.",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "integer" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["reason"],
                  properties: {
                    reason: { type: "string", minLength: 5, description: "환불 사유" },
                    amount: { type: "number", description: "부분 환불 금액 (미지정 시 전액)" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "환불 성공",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      payment: { $ref: "#/components/schemas/Payment" },
                      refund_amount: { type: "number" },
                      is_full_refund: { type: "boolean" },
                      pg_refund: {
                        type: "object",
                        nullable: true,
                        properties: {
                          refundId: { type: "string" },
                          status: { type: "string" },
                          message: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { description: "잘못된 요청 (사유 미입력, 이미 환불됨 등)" },
            502: { description: "PG 환불 처리 실패" },
          },
        },
      },
      "/api/admin/payments/{id}/sync": {
        post: {
          tags: ["Admin-Payment"],
          summary: "PG 결제 상태 동기화",
          description: "PG사에서 실제 결제 상태를 조회하여 DB와 동기화합니다.",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "integer" } },
          ],
          responses: {
            200: {
              description: "동기화 결과",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      synced_status: { type: "string" },
                      status_changed: { type: "boolean" },
                      pg_status: { type: "object", nullable: true },
                      message: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/admin/payments/bulk-sync": {
        post: {
          tags: ["Admin-Payment"],
          summary: "결제 일괄 PG 동기화",
          description: "여러 결제 건의 PG 상태를 일괄 동기화합니다. 최대 50건.",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["paymentIds"],
                  properties: {
                    paymentIds: {
                      type: "array",
                      items: { type: "integer" },
                      maxItems: 50,
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "일괄 동기화 결과",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      total: { type: "integer" },
                      synced: { type: "integer" },
                      changed: { type: "integer" },
                      failed: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/admin/payments/pg-info": {
        get: {
          tags: ["Admin-Payment"],
          summary: "PG 연동 정보 조회",
          description: "현재 PG 연동 상태와 지원 기능을 확인합니다.",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "PG 연동 정보" },
          },
        },
      },

      // ===== Admin Settlement =====
      "/api/admin/settlements/daily": {
        get: {
          tags: ["Admin-Settlement"],
          summary: "일정산 목록 조회",
          description: "날짜 범위 기반 일정산 목록을 조회합니다.",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "startDate", in: "query", required: true, schema: { type: "string", format: "date" } },
            { name: "endDate", in: "query", required: true, schema: { type: "string", format: "date" } },
            { name: "limit", in: "query", schema: { type: "integer", default: 100 } },
          ],
          responses: {
            200: { description: "일정산 목록" },
          },
        },
      },
      "/api/admin/settlements/helper": {
        get: {
          tags: ["Admin-Settlement"],
          summary: "헬퍼 정산 목록 조회",
          description: "월별 헬퍼 정산 합계를 조회합니다.",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "startDate", in: "query", required: true, schema: { type: "string", format: "date" } },
            { name: "endDate", in: "query", required: true, schema: { type: "string", format: "date" } },
          ],
          responses: {
            200: { description: "헬퍼 정산 목록" },
          },
        },
      },
      "/api/admin/settlements/requester": {
        get: {
          tags: ["Admin-Settlement"],
          summary: "요청자 정산 목록 조회",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "startDate", in: "query", required: true, schema: { type: "string", format: "date" } },
            { name: "endDate", in: "query", required: true, schema: { type: "string", format: "date" } },
          ],
          responses: {
            200: { description: "요청자 정산 목록" },
          },
        },
      },
      "/api/admin/settlements/bulk-transfer": {
        post: {
          tags: ["Admin-Settlement"],
          summary: "정산 일괄 송금 처리",
          description: "선택된 헬퍼들의 정산을 일괄로 송금 처리합니다.",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["helperIds", "transferDate"],
                  properties: {
                    helperIds: { type: "array", items: { type: "string" } },
                    transferDate: { type: "string", format: "date" },
                    transferNote: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "일괄 송금 처리 결과" },
          },
        },
      },
      "/api/admin/settlements/{id}/confirm": {
        patch: {
          tags: ["Admin-Settlement"],
          summary: "정산 확정",
          description: "일정산 건을 확정 처리합니다.",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "integer" } },
          ],
          responses: {
            200: { description: "확정 성공" },
          },
        },
      },

      // ===== Admin Tax Invoice =====
      "/api/admin/tax-invoices": {
        get: {
          tags: ["Admin-TaxInvoice"],
          summary: "세금계산서 목록 조회",
          description: "년/월 기준 세금계산서 목록을 조회합니다.",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "year", in: "query", required: true, schema: { type: "integer" } },
            { name: "month", in: "query", required: true, schema: { type: "integer", minimum: 1, maximum: 12 } },
            { name: "targetType", in: "query", schema: { type: "string", enum: ["helper", "requester"] } },
          ],
          responses: {
            200: {
              description: "세금계산서 목록",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/TaxInvoice" },
                  },
                },
              },
            },
          },
        },
      },
      "/api/admin/tax-invoices/{id}/issue": {
        post: {
          tags: ["Admin-TaxInvoice"],
          summary: "세금계산서 발행",
          description: "작성중인 세금계산서를 팝빌을 통해 국세청에 발행합니다.",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "integer" } },
          ],
          responses: {
            200: { description: "발행 성공" },
            400: { description: "발행 실패 (이미 발행됨 등)" },
          },
        },
      },
      "/api/admin/tax-invoices/{id}/popbill-pdf": {
        get: {
          tags: ["Admin-TaxInvoice"],
          summary: "세금계산서 PDF 다운로드",
          description: "발행된 세금계산서의 PDF URL을 반환합니다.",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "integer" } },
          ],
          responses: {
            200: {
              description: "PDF URL",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      pdfUrl: { type: "string", format: "uri" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/admin/tax-invoices/generate-monthly": {
        post: {
          tags: ["Admin-TaxInvoice"],
          summary: "월 일괄 세금계산서 생성",
          description: "해당 월의 정산 데이터를 기반으로 세금계산서를 일괄 생성합니다.",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["year", "month"],
                  properties: {
                    year: { type: "integer" },
                    month: { type: "integer", minimum: 1, maximum: 12 },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "일괄 생성 결과",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      created: { type: "integer" },
                      skipped: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ===== Admin Dispute =====
      "/api/admin/disputes": {
        get: {
          tags: ["Admin-Dispute"],
          summary: "이의제기 목록 조회",
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: "이의제기 목록" } },
        },
      },
      "/api/admin/disputes/{id}/resolve": {
        patch: {
          tags: ["Admin-Dispute"],
          summary: "이의제기 해결 처리",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "integer" } },
          ],
          responses: { 200: { description: "해결 처리 완료" } },
        },
      },

      // ===== Admin Refund =====
      "/api/admin/refunds/{id}": {
        patch: {
          tags: ["Admin-Payment"],
          summary: "환불 요청 승인/거절",
          description: "환불 요청을 승인 또는 거절합니다.",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "integer" } },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["approved", "rejected"] },
                    adminNotes: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "처리 완료" },
          },
        },
      },

      // ===== Webhook =====
      "/api/payments/webhook/portone": {
        post: {
          tags: ["Payment"],
          summary: "PortOne 웹훅 수신",
          description: "PortOne에서 결제 상태 변경 이벤트를 수신합니다.",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    type: { type: "string", example: "Transaction.Paid" },
                    data: { type: "object" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "웹훅 수신 확인" },
          },
        },
      },

      // ===== Helper =====
      "/api/helper/orders/open": {
        get: {
          tags: ["Helper"],
          summary: "오픈 오더 목록 조회",
          description: "지원 가능한 오더 목록을 조회합니다.",
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: "오더 목록" } },
        },
      },
      "/api/helper/settlement": {
        get: {
          tags: ["Helper"],
          summary: "헬퍼 월 정산 조회",
          description: "해당 월의 정산 요약 정보를 조회합니다.",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "year", in: "query", schema: { type: "integer" } },
            { name: "month", in: "query", schema: { type: "integer" } },
          ],
          responses: { 200: { description: "정산 요약" } },
        },
      },

      // ===== Requester =====
      "/api/requester/orders": {
        post: {
          tags: ["Requester"],
          summary: "오더 생성",
          description: "새로운 배송 오더를 생성합니다.",
          security: [{ BearerAuth: [] }],
          responses: { 201: { description: "오더 생성 성공" } },
        },
      },

      // ===== Admin Auth =====
      "/api/admin/auth/login": {
        post: {
          tags: ["Admin"],
          summary: "관리자 로그인",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email: { type: "string" },
                    password: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "로그인 성공, JWT 토큰 반환" },
            401: { description: "인증 실패" },
          },
        },
      },

      // ===== Partner Auth =====
      "/api/partner/auth/login": {
        post: {
          tags: ["Partner-Auth"],
          summary: "파트너 로그인",
          description: "팀장 계정으로 로그인. isTeamLeader=true 필수.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "로그인 성공",
              content: { "application/json": { schema: { type: "object", properties: { token: { type: "string" }, user: { type: "object" }, team: { $ref: "#/components/schemas/PartnerTeamInfo" } } } } },
            },
            400: { description: "이메일/비밀번호 미입력" },
            401: { description: "인증 실패" },
            403: { description: "팀장 계정 아님 또는 활성 팀 없음" },
          },
        },
      },
      "/api/partner/auth/me": {
        get: {
          tags: ["Partner-Auth"],
          summary: "현재 파트너 사용자 정보",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "사용자 + 팀 정보" },
            401: { description: "인증 필요" },
          },
        },
      },
      "/api/partner/auth/change-password": {
        post: {
          tags: ["Partner-Auth"],
          summary: "파트너 비밀번호 변경",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["currentPassword", "newPassword"], properties: { currentPassword: { type: "string" }, newPassword: { type: "string", minLength: 8 } } } } },
          },
          responses: {
            200: { description: "비밀번호 변경 성공" },
            400: { description: "입력값 오류" },
            401: { description: "현재 비밀번호 불일치" },
          },
        },
      },

      // ===== Partner Dashboard =====
      "/api/partner/dashboard": {
        get: {
          tags: ["Partner-Dashboard"],
          summary: "파트너 대시보드",
          description: "팀명, 팀원수, 활성 오더수, 월 정산 요약을 반환합니다.",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "대시보드 데이터",
              content: { "application/json": { schema: { type: "object", properties: { teamName: { type: "string" }, memberCount: { type: "integer" }, activeOrderCount: { type: "integer" }, monthlySettlement: { type: "number" }, currentMonth: { type: "string" } } } } },
            },
          },
        },
      },

      // ===== Partner Orders =====
      "/api/partner/orders": {
        get: {
          tags: ["Partner-Order"],
          summary: "팀 오더 목록",
          description: "팀원에게 매칭된 오더 목록. 상태/날짜/헬퍼별 필터 지원.",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "status", in: "query", schema: { type: "string" }, description: "오더 상태 필터" },
            { name: "helperId", in: "query", schema: { type: "string" }, description: "특정 팀원 필터" },
            { name: "startDate", in: "query", schema: { type: "string", format: "date" } },
            { name: "endDate", in: "query", schema: { type: "string", format: "date" } },
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: { 200: { description: "페이지네이션 오더 목록" } },
        },
      },
      "/api/partner/orders/available": {
        get: {
          tags: ["Partner-Order"],
          summary: "매칭 가능 오더 목록",
          description: "status=matching인 배정 가능 오더 조회.",
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: "매칭 가능 오더 목록" } },
        },
      },
      "/api/partner/orders/{orderId}": {
        get: {
          tags: ["Partner-Order"],
          summary: "오더 상세",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "orderId", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "오더 + 지원 목록" },
            403: { description: "팀 오더 아님" },
            404: { description: "오더 없음" },
          },
        },
      },
      "/api/partner/orders/{orderId}/assign": {
        post: {
          tags: ["Partner-Order"],
          summary: "팀원 오더 배정",
          description: "매칭중 오더에 팀원을 배정합니다.",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "orderId", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["helperId"], properties: { helperId: { type: "string" } } } } },
          },
          responses: {
            200: { description: "배정 성공" },
            400: { description: "잘못된 요청 (매칭 상태 아님, 팀원 아님)" },
            404: { description: "오더 없음" },
          },
        },
      },

      // ===== Partner Members =====
      "/api/partner/members": {
        get: {
          tags: ["Partner-Member"],
          summary: "팀원 목록",
          description: "팀원 목록 + 사용자 정보 + 초대 코드 반환.",
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: "팀원 목록" } },
        },
      },
      "/api/partner/members/{memberId}": {
        get: {
          tags: ["Partner-Member"],
          summary: "팀원 상세",
          description: "팀원 정보 + 최근 오더 이력.",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "memberId", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "팀원 상세 정보" },
            404: { description: "팀원 없음" },
          },
        },
        delete: {
          tags: ["Partner-Member"],
          summary: "팀원 제거",
          description: "팀원을 비활성화 (isActive=false).",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "memberId", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "제거 성공" },
            404: { description: "팀원 없음" },
          },
        },
      },
      "/api/partner/members/invite": {
        post: {
          tags: ["Partner-Member"],
          summary: "초대 코드 조회",
          description: "팀 QR 코드 토큰(초대 코드)을 반환합니다.",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "초대 코드", content: { "application/json": { schema: { type: "object", properties: { inviteCode: { type: "string" }, teamName: { type: "string" }, teamId: { type: "integer" } } } } } },
          },
        },
      },

      // ===== Partner Settlement =====
      "/api/partner/settlements": {
        get: {
          tags: ["Partner-Settlement"],
          summary: "팀 정산 내역",
          description: "월별 팀원 정산 내역 + 요약 + 팀 인센티브.",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "month", in: "query", schema: { type: "string", example: "2025-01" }, description: "YYYY-MM 형식 (미지정 시 현재 월)" },
          ],
          responses: { 200: { description: "정산 내역 + 요약" } },
        },
      },
      "/api/partner/settlements/summary": {
        get: {
          tags: ["Partner-Settlement"],
          summary: "월별 정산 요약",
          description: "최근 6개월 월별 정산 집계.",
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: "월별 요약 배열" } },
        },
      },

      // ===== Partner CS =====
      "/api/partner/cs": {
        get: {
          tags: ["Partner-CS"],
          summary: "CS 문의 목록",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "status", in: "query", schema: { type: "string", enum: ["pending", "in_progress", "resolved", "closed"] } },
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: { 200: { description: "페이지네이션 CS 목록" } },
        },
        post: {
          tags: ["Partner-CS"],
          summary: "CS 문의 생성",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["title", "content"], properties: { title: { type: "string" }, content: { type: "string" }, category: { type: "string", enum: ["order", "payment", "settlement", "member", "other"] }, priority: { type: "string", enum: ["low", "normal", "high", "urgent"] }, orderId: { type: "integer" } } } } },
          },
          responses: {
            201: { description: "문의 생성 성공" },
            400: { description: "제목/내용 미입력" },
          },
        },
      },
      "/api/partner/cs/{id}": {
        get: {
          tags: ["Partner-CS"],
          summary: "CS 문의 상세",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "문의 상세" },
            404: { description: "문의 없음" },
          },
        },
        patch: {
          tags: ["Partner-CS"],
          summary: "CS 문의 수정",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            content: { "application/json": { schema: { type: "object", properties: { content: { type: "string" }, priority: { type: "string" } } } } },
          },
          responses: {
            200: { description: "수정 성공" },
            404: { description: "문의 없음" },
          },
        },
      },

      // ===== Partner Incidents =====
      "/api/partner/incidents": {
        get: {
          tags: ["Partner-Incident"],
          summary: "사고 목록",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "status", in: "query", schema: { type: "string", enum: ["reported", "investigating", "resolved", "closed"] } },
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: { 200: { description: "페이지네이션 사고 목록" } },
        },
        post: {
          tags: ["Partner-Incident"],
          summary: "사고 보고 생성",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["helperId", "description"], properties: { helperId: { type: "string" }, orderId: { type: "integer" }, incidentType: { type: "string", enum: ["damage", "loss", "misdelivery", "delay", "accident", "other"] }, description: { type: "string" }, severity: { type: "string", enum: ["low", "medium", "high", "critical"] } } } } },
          },
          responses: {
            201: { description: "사고 보고 생성 성공" },
            400: { description: "필수값 미입력 또는 팀원 아님" },
          },
        },
      },
      "/api/partner/incidents/{id}": {
        get: {
          tags: ["Partner-Incident"],
          summary: "사고 상세",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            200: { description: "사고 상세 + 헬퍼명" },
            404: { description: "사고 없음" },
          },
        },
        patch: {
          tags: ["Partner-Incident"],
          summary: "사고 수정",
          description: "팀장 메모 추가 또는 상태 변경.",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            content: { "application/json": { schema: { type: "object", properties: { teamLeaderNote: { type: "string" }, status: { type: "string", enum: ["reported", "investigating", "resolved", "closed"] } } } } },
          },
          responses: {
            200: { description: "수정 성공" },
            404: { description: "사고 없음" },
          },
        },
      },

      // ===== Partner Settings =====
      "/api/partner/settings": {
        get: {
          tags: ["Partner-Settings"],
          summary: "팀 설정 조회",
          description: "팀 정보, 팀장 정보, 팀원 통계 반환.",
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: "팀 설정 정보" } },
        },
        patch: {
          tags: ["Partner-Settings"],
          summary: "팀 설정 수정",
          description: "긴급연락처, 업무유형 등 수정 가능.",
          security: [{ BearerAuth: [] }],
          requestBody: {
            content: { "application/json": { schema: { type: "object", properties: { emergencyPhone: { type: "string" }, businessType: { type: "string" } } } } },
          },
          responses: {
            200: { description: "설정 저장 성공" },
            400: { description: "수정 항목 없음" },
          },
        },
      },

      // ===== Checkin =====
      "/api/checkin/qr": {
        post: {
          tags: ["Checkin"],
          summary: "QR 코드 출근 체크",
          description: "의뢰인 QR 코드를 스캔하여 출근 처리.",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["qrData"], properties: { qrData: { type: "string", description: "QR JSON 데이터" }, latitude: { type: "string" }, longitude: { type: "string" }, address: { type: "string" } } } } },
          },
          responses: {
            200: { description: "출근 성공" },
            400: { description: "잘못된 QR / 배정 없음" },
          },
        },
      },
      "/api/checkin": {
        post: {
          tags: ["Checkin"],
          summary: "오더 기반 직접 출근",
          security: [{ BearerAuth: [] }],
          requestBody: {
            content: { "application/json": { schema: { type: "object", properties: { orderId: { type: "integer" }, latitude: { type: "string" }, longitude: { type: "string" } } } } },
          },
          responses: { 200: { description: "출근 성공" } },
        },
      },
      "/api/checkin/today": {
        get: {
          tags: ["Checkin"],
          summary: "오늘 출근 기록",
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: "오늘의 출근 기록 목록" } },
        },
      },
      "/api/checkin/qr-data": {
        get: {
          tags: ["Checkin"],
          summary: "의뢰인 QR 코드 데이터",
          description: "의뢰인용 영구 QR 코드 데이터 반환.",
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: "QR JSON 데이터" } },
        },
      },
      "/api/checkin/by-code": {
        post: {
          tags: ["Checkin"],
          summary: "요청자 코드로 출근",
          security: [{ BearerAuth: [] }],
          requestBody: {
            content: { "application/json": { schema: { type: "object", properties: { code: { type: "string" } } } } },
          },
          responses: { 200: { description: "출근 성공" } },
        },
      },
      "/api/checkin/verify-helper-code": {
        post: {
          tags: ["Checkin"],
          summary: "헬퍼 코드 출근 확인",
          security: [{ BearerAuth: [] }],
          requestBody: {
            content: { "application/json": { schema: { type: "object", properties: { helperCode: { type: "string" }, orderId: { type: "integer" } } } } },
          },
          responses: { 200: { description: "확인 성공" } },
        },
      },

      // ===== Notifications =====
      "/api/notifications": {
        get: {
          tags: ["Notification"],
          summary: "알림 목록 조회",
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: "알림 목록" } },
        },
      },
      "/api/notifications/unread-count": {
        get: {
          tags: ["Notification"],
          summary: "읽지 않은 알림 수",
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: "읽지 않은 알림 수", content: { "application/json": { schema: { type: "object", properties: { count: { type: "integer" } } } } } } },
        },
      },
      "/api/notifications/{id}/read": {
        post: {
          tags: ["Notification"],
          summary: "알림 읽음 처리",
          security: [{ BearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { 200: { description: "읽음 처리 완료" } },
        },
      },
      "/api/notifications/read-all": {
        post: {
          tags: ["Notification"],
          summary: "전체 알림 읽음 처리",
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: "전체 읽음 처리 완료" } },
        },
      },

      // ===== Reviews =====
      "/api/reviews": {
        post: {
          tags: ["Review"],
          summary: "리뷰 작성",
          description: "의뢰인이 헬퍼에 대한 리뷰 작성.",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", properties: { contractId: { type: "integer" }, orderId: { type: "integer" }, helperId: { type: "string" }, rating: { type: "integer", minimum: 1, maximum: 5 }, comment: { type: "string" } } } } },
          },
          responses: {
            201: { description: "리뷰 작성 성공" },
            400: { description: "이미 리뷰 작성됨" },
          },
        },
      },
      "/api/reviews/helper/{helperId}": {
        get: {
          tags: ["Review"],
          summary: "헬퍼 리뷰 목록",
          parameters: [{ name: "helperId", in: "path", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "리뷰 목록 + 평균 평점" } },
        },
      },
      "/api/reviews/my": {
        get: {
          tags: ["Review"],
          summary: "내가 작성한 리뷰",
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: "내 리뷰 목록" } },
        },
      },
      "/api/orders/review-pending": {
        get: {
          tags: ["Review"],
          summary: "리뷰 대기 오더",
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: "리뷰 대기 오더 목록" } },
        },
      },

      // ===== Push =====
      "/api/push/vapid-public-key": {
        get: {
          tags: ["Push"],
          summary: "VAPID 공개키 조회",
          responses: { 200: { description: "VAPID 공개키", content: { "application/json": { schema: { type: "object", properties: { publicKey: { type: "string" } } } } } } },
        },
      },
      "/api/push/subscribe": {
        post: {
          tags: ["Push"],
          summary: "웹 푸시 구독",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["subscription"], properties: { subscription: { type: "object", properties: { endpoint: { type: "string" }, keys: { type: "object", properties: { p256dh: { type: "string" }, auth: { type: "string" } } } } }, userAgent: { type: "string" } } } } },
          },
          responses: { 201: { description: "구독 성공" } },
        },
      },
      "/api/push/unsubscribe": {
        post: {
          tags: ["Push"],
          summary: "웹 푸시 구독 해제",
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: "구독 해제 성공" } },
        },
      },
      "/api/push/status": {
        get: {
          tags: ["Push"],
          summary: "푸시 구독 상태",
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: "구독 상태 정보" } },
        },
      },
      "/api/push/register-fcm": {
        post: {
          tags: ["Push"],
          summary: "FCM 토큰 등록",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["token"], properties: { token: { type: "string" }, platform: { type: "string", enum: ["android", "ios", "web"] } } } } },
          },
          responses: { 200: { description: "등록 성공" } },
        },
      },
      "/api/push/unregister-fcm": {
        post: {
          tags: ["Push"],
          summary: "FCM 토큰 해제",
          security: [{ BearerAuth: [] }],
          requestBody: {
            content: { "application/json": { schema: { type: "object", properties: { token: { type: "string" } } } } },
          },
          responses: { 200: { description: "해제 성공" } },
        },
      },

      // ===== Meta =====
      "/api/meta/couriers": {
        get: {
          tags: ["Meta"],
          summary: "택배사 목록",
          description: "활성화된 택배사 목록 + 단가 정보.",
          responses: { 200: { description: "택배사 목록" } },
        },
      },
      "/api/meta/category-pricing": {
        get: {
          tags: ["Meta"],
          summary: "카테고리별 단가",
          responses: { 200: { description: "카테고리별 단가 설정" } },
        },
      },
      "/api/meta/contract-settings": {
        get: {
          tags: ["Meta"],
          summary: "계약 설정 조회",
          responses: { 200: { description: "계약 관련 설정값" } },
        },
      },
      "/api/meta/couriers/{courierName}/rate-items": {
        get: {
          tags: ["Meta"],
          summary: "택배사별 단가 항목",
          parameters: [{ name: "courierName", in: "path", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "단가 항목 목록" } },
        },
      },
      "/api/meta/couriers/{courierName}/tiered-pricing": {
        get: {
          tags: ["Meta"],
          summary: "택배사별 구간 단가",
          parameters: [{ name: "courierName", in: "path", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "구간별 단가 목록" } },
        },
      },
      "/api/meta/vehicle-types": {
        get: {
          tags: ["Meta"],
          summary: "차량 유형 목록",
          responses: { 200: { description: "차량 유형 목록" } },
        },
      },
      "/api/meta/order-categories": {
        get: {
          tags: ["Meta"],
          summary: "오더 카테고리 목록",
          responses: { 200: { description: "오더 카테고리 목록" } },
        },
      },
      "/api/address/search": {
        get: {
          tags: ["Meta"],
          summary: "주소 검색",
          description: "Kakao 주소 검색 API 프록시.",
          parameters: [{ name: "query", in: "query", required: true, schema: { type: "string" }, description: "검색어" }],
          responses: { 200: { description: "주소 검색 결과" } },
        },
      },
    },
  };
}
