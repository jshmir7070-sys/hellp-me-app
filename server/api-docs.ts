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
    },
  };
}
