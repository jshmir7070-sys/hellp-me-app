-- Phase 2: 채권추심 및 서류 검토 강화
-- 실행: psql -U postgres -d hellp_me_db -f migrations/002_phase2_contracts_payments.sql
-- 또는: npx tsx scripts/run-migration.ts 002_phase2_contracts_payments.sql

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. contracts 테이블 - 동의 항목 추가
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 요청자 동의 항목
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS agreed_late_payment BOOLEAN DEFAULT FALSE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS agreed_debt_collection BOOLEAN DEFAULT FALSE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS agreed_joint_guarantee BOOLEAN DEFAULT FALSE;

-- 헬퍼 동의 항목
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS agreed_doc_obligation BOOLEAN DEFAULT FALSE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS agreed_vehicle_mgmt BOOLEAN DEFAULT FALSE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS agreed_false_doc BOOLEAN DEFAULT FALSE;

-- 동의 타임스탬프
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS agreed_late_payment_at TIMESTAMP;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS agreed_debt_collection_at TIMESTAMP;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS agreed_joint_guarantee_at TIMESTAMP;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS agreed_doc_obligation_at TIMESTAMP;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS agreed_vehicle_mgmt_at TIMESTAMP;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS agreed_false_doc_at TIMESTAMP;

COMMENT ON COLUMN contracts.agreed_late_payment IS '연체이자 조항 동의 (연 15% 지연손해금)';
COMMENT ON COLUMN contracts.agreed_debt_collection IS '채권추심 조항 동의 (독촉→제한→추심→소송)';
COMMENT ON COLUMN contracts.agreed_joint_guarantee IS '연대보증 조항 동의 (법인 대표자)';
COMMENT ON COLUMN contracts.agreed_doc_obligation IS '서류 제출 의무 동의 (헬퍼)';
COMMENT ON COLUMN contracts.agreed_vehicle_mgmt IS '차량 정보 관리 의무 동의 (헬퍼)';
COMMENT ON COLUMN contracts.agreed_false_doc IS '허위 서류 시 법적 책임 동의 (헬퍼)';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. payments 테이블 - 연체 관리 추가
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 연체 상태 관리
ALTER TABLE payments ADD COLUMN IF NOT EXISTS overdue_status TEXT DEFAULT 'normal';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS overdue_days INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS late_interest NUMERIC(10, 2) DEFAULT 0;

-- 독촉 및 조치 이력
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reminder_sent_count INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS service_restricted_at TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS collection_started_at TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS legal_action_started_at TIMESTAMP;

COMMENT ON COLUMN payments.overdue_status IS '연체 상태: normal(정상), warning(경고), overdue(연체), collection(추심), legal(법적조치)';
COMMENT ON COLUMN payments.overdue_days IS '연체 일수 (입금기한 경과 일수)';
COMMENT ON COLUMN payments.late_interest IS '지연손해금 (연 15%, 일할 계산)';
COMMENT ON COLUMN payments.reminder_sent_count IS '독촉 발송 횟수';
COMMENT ON COLUMN payments.last_reminder_sent_at IS '마지막 독촉 발송 시각';
COMMENT ON COLUMN payments.service_restricted_at IS '서비스 이용 제한 시작 시각';
COMMENT ON COLUMN payments.collection_started_at IS '채권추심 위탁 시작 시각';
COMMENT ON COLUMN payments.legal_action_started_at IS '법적 조치(소송) 시작 시각';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. 인덱스 생성 (성능 최적화)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 연체 조회 최적화
CREATE INDEX IF NOT EXISTS idx_payments_overdue_status ON payments(overdue_status) WHERE overdue_status != 'normal';
CREATE INDEX IF NOT EXISTS idx_payments_overdue_days ON payments(overdue_days) WHERE overdue_days > 0;

-- 동의 항목 조회 최적화 (법적 증거 확인용)
CREATE INDEX IF NOT EXISTS idx_contracts_debt_collection ON contracts(agreed_debt_collection) WHERE agreed_debt_collection = TRUE;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. 마이그레이션 완료 확인
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DO $$
BEGIN
  RAISE NOTICE '✅ Phase 2 마이그레이션 완료!';
  RAISE NOTICE '- contracts 테이블: 동의 항목 12개 필드 추가';
  RAISE NOTICE '- payments 테이블: 연체 관리 8개 필드 추가';
  RAISE NOTICE '- 인덱스: 성능 최적화 3개 생성';
END $$;
