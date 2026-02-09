# 정산 자동화 시스템 - 테이블 구조 및 API 명세

## 1. 핵심 원칙

### 1-1. 금액 단위 규칙
- **통화**: KRW (원화)
- **저장 기준**:
  - `supply_*` = 공급가 (부가세 별도)
  - `vat_*` = 부가세 (10%)
  - `total_*` = 공급가 + 부가세 (최종 결제/정산 기준)
- **수수료 계산**: 총액(TOTAL) 기준으로 플랫폼 수수료 계산 (A안)

### 1-2. 정산 공식 (Canonical Formula)
```
baseSupply = (배송건수 + 반품건수 + 기타건수) × 단가
urgentFeeSupply = baseSupply × 긴급비율% 또는 고정금액
extraSupply = Σ(추가비용항목별 수량 × 단가)
finalSupply = baseSupply + urgentFeeSupply + extraSupply
VAT = finalSupply × 10%
finalTotal = finalSupply + VAT
platformFee = finalTotal × 플랫폼수수료율%
driverPayout = finalTotal - platformFee
```

---

## 2. 정책 테이블 (Admin Policy Tables)

### 2-1. carrier_pricing_policies (택배사별 단가표)
관리자가 책정하는 기본 단가표. 택배사/서비스타입/권역별 차등 단가 지원.

| 컬럼명 | 타입 | 필수 | 설명 |
|--------|------|:----:|------|
| id | serial | Y | PK |
| carrier_code | text | Y | CJ / LOTTE / HANJIN / ETC |
| service_type | text | Y | NORMAL / DAWN / SAME_DAY |
| region_code | text | N | 권역 코드 (optional) |
| vehicle_type | text | N | 차종 (optional) |
| unit_type | text | Y | BOX (기본), TRIP, HOUR |
| unit_price_supply | int | Y | **공급가 단가 (핵심)** |
| min_charge_supply | int | N | 최소 청구 공급가 |
| effective_from | text | Y | 적용 시작일 (YYYY-MM-DD) |
| effective_to | text | N | 적용 종료일 (NULL=무기한) |
| is_active | boolean | Y | 활성 여부 |
| created_by | varchar | N | 생성자 ID |
| created_at | timestamp | Y | 생성일 |
| updated_at | timestamp | Y | 수정일 |

**운영 규칙**:
- 같은 (carrier_code, service_type, region_code, vehicle_type) 조합은 동시에 active 1개만 허용

---

### 2-2. urgent_fee_policies (긴급 수수료 정책)
긴급 요청 시 자동 적용되는 추가 수수료.

| 컬럼명 | 타입 | 필수 | 설명 |
|--------|------|:----:|------|
| id | serial | Y | PK |
| carrier_code | text | N | 택배사별 적용 (NULL=전체) |
| apply_type | text | Y | **PERCENT** 또는 **FIXED** |
| value | int | Y | PERCENT면 %값(10=10%), FIXED면 공급가 금액 |
| max_urgent_fee_supply | int | N | 긴급비 상한 (optional) |
| effective_from | text | Y | 적용 시작일 |
| effective_to | text | N | 적용 종료일 |
| is_active | boolean | Y | 활성 |
| created_by | varchar | N | 생성자 ID |
| created_at | timestamp | Y | 생성 |
| updated_at | timestamp | Y | 수정 |

**적용 규칙**:
- PERCENT: urgentFeeSupply = baseSupply × (value / 100)
- FIXED: urgentFeeSupply = value
- 상한 적용: min(urgentFeeSupply, max_urgent_fee_supply)

---

### 2-3. platform_fee_policies (플랫폼 수수료 정책)
기사 지급액 계산의 핵심 정책. 총액 기준 수수료 차감.

| 컬럼명 | 타입 | 필수 | 설명 |
|--------|------|:----:|------|
| id | serial | Y | PK |
| name | text | Y | 정책명 (예: "기본 15%") |
| base_on | text | Y | **TOTAL** (A안 고정) 또는 SUPPLY |
| fee_type | text | Y | PERCENT (권장) 또는 FIXED |
| rate_percent | int | N | 수수료율 (%) |
| fixed_amount | int | N | 고정 수수료 (원) |
| min_fee | int | N | 최소 수수료 |
| max_fee | int | N | 최대 수수료 |
| effective_from | text | Y | 적용 시작일 |
| effective_to | text | N | 적용 종료일 |
| is_active | boolean | Y | 활성 |
| is_default | boolean | Y | 기본 정책 여부 |
| created_by | varchar | N | 생성자 ID |
| created_at | timestamp | Y | 생성 |
| updated_at | timestamp | Y | 수정 |

**적용 규칙**:
- TOTAL 기준: platformFee = finalTotal × (rate_percent / 100)
- min/max 적용: clamp(platformFee, min_fee, max_fee)
- 활성 정책은 1개만 유지 권장

---

### 2-4. extra_cost_catalog (추가비용 항목표)
헬퍼가 마감 시 선택할 수 있는 추가비용 항목 카탈로그.

| 컬럼명 | 타입 | 필수 | 설명 |
|--------|------|:----:|------|
| id | serial | Y | PK |
| cost_code | text | Y | EXTRA_WAIT / EXTRA_NIGHT 등 |
| label | text | Y | 표시명 (대기비, 야간비) |
| unit_label | text | N | 단위 ("분", "건" 등) |
| default_unit_price_supply | int | N | 기본 공급가 단가 |
| input_mode | text | Y | **QTY_PRICE** / FIXED / MANUAL |
| require_memo | boolean | Y | 메모 필수 여부 |
| sort_order | int | N | 정렬 순서 |
| is_active | boolean | Y | 활성 |
| created_by | varchar | N | 생성자 ID |
| created_at | timestamp | Y | 생성 |
| updated_at | timestamp | Y | 수정 |

**input_mode 설명**:
- `QTY_PRICE`: 수량 × 단가 입력
- `FIXED`: 고정 금액 (단가 변경 불가)
- `MANUAL`: 직접 금액 입력

---

## 3. 오더 정책 스냅샷

### 3-1. order_policy_snapshots (정책 스냅샷)
오더 생성 시점의 정책 값 보존. **정책 변경해도 기존 계약 금액 유지**.

| 컬럼명 | 타입 | 필수 | 설명 |
|--------|------|:----:|------|
| id | serial | Y | PK |
| order_id | int | Y | FK → orders.id |
| **단가 정책 스냅샷** |
| pricing_policy_id | int | N | 적용된 단가 정책 ID |
| snapshot_unit_price_supply | int | N | 스냅샷 단가 (공급가) |
| snapshot_min_charge_supply | int | N | 스냅샷 최소청구액 |
| **긴급 정책 스냅샷** |
| urgent_policy_id | int | N | 적용된 긴급 정책 ID |
| snapshot_urgent_apply_type | text | N | PERCENT / FIXED |
| snapshot_urgent_value | int | N | 스냅샷 긴급 값 |
| snapshot_urgent_max_fee | int | N | 스냅샷 긴급 상한 |
| **플랫폼 수수료 스냅샷** |
| platform_fee_policy_id | int | N | 적용된 수수료 정책 ID |
| snapshot_platform_base_on | text | N | TOTAL / SUPPLY |
| snapshot_platform_rate_percent | int | N | 스냅샷 수수료율 (%) |
| snapshot_platform_min_fee | int | N | 최소 수수료 |
| snapshot_platform_max_fee | int | N | 최대 수수료 |
| created_at | timestamp | Y | 생성일 |

**핵심 규칙**:
- 오더 생성 시점에 현재 활성 정책을 찾아 스냅샷 저장
- 마감/정산 계산 시 항상 스냅샷 값 사용
- 정책 변경으로 기존 오더 금액이 흔들리지 않음

---

## 4. 정산 테이블

### 4-1. settlement_records (정산 기록)
플랫폼 수수료 차감 후 기사 지급액 확정.

| 컬럼명 | 타입 | 필수 | 설명 |
|--------|------|:----:|------|
| id | serial | Y | PK |
| order_id | int | Y | FK → orders.id |
| helper_id | varchar | Y | FK → users.id |
| closing_report_id | int | N | FK → closing_reports.id |
| contract_id | int | N | FK → contracts.id |
| **계산된 금액** |
| base_supply | int | Y | 기본금액 (공급가) |
| urgent_fee_supply | int | N | 긴급수수료 (공급가) |
| extra_supply | int | N | 추가비용 (공급가) |
| final_supply | int | Y | 최종 공급가 |
| vat | int | Y | 부가세 (10%) |
| final_total | int | Y | 최종 총액 |
| **플랫폼 수수료** |
| platform_fee_base_on | text | N | TOTAL / SUPPLY |
| platform_fee_rate | int | N | 수수료율 (%) |
| platform_fee | int | Y | 플랫폼 수수료 |
| driver_payout | int | Y | **기사 지급액 (핵심)** |
| **팀장 인센티브** |
| team_leader_id | varchar | N | 팀장 ID |
| team_leader_incentive | int | N | 팀장 인센티브 |
| **상태** |
| status | text | Y | CALCULATED / APPROVED / PAID |
| approved_at | timestamp | N | 승인일시 |
| approved_by | varchar | N | 승인자 ID |
| paid_at | timestamp | N | 지급완료일시 |
| paid_by | varchar | N | 지급처리자 ID |
| payment_reference | text | N | 지급 참조번호 |
| calculated_at | timestamp | Y | 계산일시 |
| created_at | timestamp | Y | 생성일 |
| updated_at | timestamp | Y | 수정일 |

---

## 5. API 명세

### 5-1. 관리자 정책 CRUD

#### 단가표 조회
```
GET /api/admin/pricing-policies/carrier
Query: carrierCode, serviceType, isActive
```

#### 단가표 등록
```
POST /api/admin/pricing-policies/carrier
Body: {
  "carrierCode": "CJ",
  "serviceType": "NORMAL",
  "unitType": "BOX",
  "unitPriceSupply": 1200,
  "minChargeSupply": 0,
  "effectiveFrom": "2026-01-01",
  "isActive": true
}
```

#### 긴급 정책 조회/등록
```
GET /api/admin/pricing-policies/urgent
POST /api/admin/pricing-policies/urgent
Body: {
  "carrierCode": "CJ",
  "applyType": "PERCENT",
  "value": 10,
  "maxUrgentFeeSupply": 30000,
  "effectiveFrom": "2026-01-01",
  "isActive": true
}
```

#### 플랫폼 수수료 정책 조회/등록
```
GET /api/admin/pricing-policies/platform
POST /api/admin/pricing-policies/platform
Body: {
  "name": "기본 15%",
  "baseOn": "TOTAL",
  "feeType": "PERCENT",
  "ratePercent": 15,
  "minFee": 500,
  "maxFee": 50000,
  "effectiveFrom": "2026-01-01",
  "isActive": true
}
```

#### 추가비용 항목 조회/등록
```
GET /api/admin/pricing-policies/extra-costs
POST /api/admin/pricing-policies/extra-costs
Body: {
  "costCode": "EXTRA_WAIT",
  "label": "대기비",
  "unitLabel": "분",
  "defaultUnitPriceSupply": 500,
  "inputMode": "QTY_PRICE",
  "requireMemo": false,
  "isActive": true
}
```

---

### 5-2. 오더 생성 (정책 스냅샷 자동 저장)
```
POST /api/orders
Body: {
  "carrierCode": "CJ",
  "serviceType": "NORMAL",
  "isUrgent": true,
  "scheduledAt": "2026-01-18T03:00:00+09:00"
}

Response: {
  "order": {
    "id": 1001,
    "status": "OPEN",
    "carrierCode": "CJ",
    "serviceType": "NORMAL",
    "isUrgent": true
  },
  "policySnapshot": {
    "unitPriceSupply": 1200,
    "urgentApplyType": "PERCENT",
    "urgentValue": 10,
    "platformRatePercent": 15
  }
}
```

---

### 5-3. 헬퍼 마감 제출
```
POST /api/orders/{orderId}/closing-report
Body: {
  "deliveredCount": 180,
  "returnedCount": 5,
  "otherCount": 0,
  "extraCostItems": [
    { "costCode": "EXTRA_WAIT", "qty": 30, "unitPriceSupply": 500 }
  ],
  "evidenceImages": ["https://.../img1.png"]
}

Response: {
  "closingReport": { ... },
  "calculatedAmount": 285120,
  "settlement": {
    "baseSupply": 222000,
    "urgentFeeSupply": 22200,
    "extraSupply": 15000,
    "finalSupply": 259200,
    "vat": 25920,
    "finalTotal": 285120,
    "platformFee": 42768,
    "driverPayout": 242352
  }
}
```

---

### 5-4. 관리자 마감 승인
```
POST /api/admin/orders/{orderId}/closing/approve
Body: {
  "adjustedAmount": 285120,  // optional: 금액 조정
  "reason": "증빙 확인 완료"
}

Response: {
  "success": true,
  "closingReportId": 123,
  "finalAmount": 285120,
  "balanceAmount": 185120,
  "status": "approved"
}
```

---

### 5-5. 정산 실행
```
POST /api/admin/orders/{orderId}/settlement/execute

Response: {
  "success": true,
  "settlement": {
    "id": 1,
    "baseSupply": 222000,
    "urgentFeeSupply": 22200,
    "extraSupply": 15000,
    "finalSupply": 259200,
    "vat": 25920,
    "finalTotal": 285120,
    "platformFee": 42768,
    "driverPayout": 242352,
    "status": "APPROVED"
  }
}
```

---

## 6. 관리자 화면 구성

### 6-1. 정산정책 관리 (PricingPoliciesPage)
4개 탭으로 구성:
- **단가 정책**: carrier_pricing_policies CRUD
- **긴급비 정책**: urgent_fee_policies CRUD
- **플랫폼 수수료**: platform_fee_policies CRUD
- **추가비용 항목**: extra_cost_catalog CRUD

### 6-2. 마감 검수 (ClosureReportsPage)
| 표시 컬럼 | 필터 | 버튼 조건 |
|----------|------|----------|
| order_id, helper_id, delivered_count, returned_count, computed_total, submitted_at, 승인상태 | 승인 전/후, 날짜 | [마감 승인] orders.status == CLOSING_SUBMITTED |

### 6-3. 정산 관리 (SettlementsPage)
| 표시 컬럼 | 필터 | 버튼 조건 |
|----------|------|----------|
| order_id, helper_id, final_supply, vat, final_total, platform_fee, driver_payout, status, paid_at | 상태, 택배사, 기간 | [정산 실행] BALANCE_PAID AND final_total NOT NULL<br>[지급 완료] status == CALCULATED<br>[엑셀 다운로드] 항상 |

---

## 7. 운영 필수 규칙 (분쟁 방지)

1. ✅ 오더 생성 시 단가/긴급/수수료 정책 **반드시 스냅샷 저장**
2. ✅ 마감 제출은 **단 하나의 API**로만 처리
3. ✅ 마감 승인(FINAL_CONFIRMED) 이후 금액 **수정 불가**
4. ✅ 정산은 **BALANCE_PAID 이후**에만 가능
5. ✅ 정산 테이블 null/누락 데이터 시 버튼 비활성 + 오류 표시
6. ✅ 정산/승인/상태 변경은 **이벤트 로그 기록** (감사 대응)

---

## 8. 엑셀 다운로드 형식

```
정산ID | 오더ID | 택배사 | 서비스 | 긴급여부 | 요청자ID | 기사ID | 배송수 | 반품수 | 기타수 | 추가비용공급가 | 긴급비공급가 | 최종공급가 | VAT | 최종총액 | 플랫폼수수료율(%) | 플랫폼수수료 | 기사지급액 | 정산상태 | 잔금확인일 | 정산생성일 | 지급완료일 | 관리자메모
```
