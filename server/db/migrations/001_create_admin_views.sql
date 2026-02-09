-- 관리자용 데이터베이스 뷰 생성 (실제 스키마 기반)
-- Week 1, Day 1
-- 작성일: 2026-02-08

-- =====================================================
-- 1. 관리자용 통합 오더 뷰
-- =====================================================
CREATE OR REPLACE VIEW admin_orders_view AS
SELECT
  o.id,
  o.status,
  o.is_urgent,
  o.created_at,
  o.updated_at as status_updated_at,
  NULL::timestamp as approved_at,

  -- 요청자 정보
  o.requester_id,
  requester.name as requester_name,
  requester.team_name as requester_company,
  requester.email as requester_email,
  requester.phone_number as requester_phone,
  requester.profile_image_url as requester_avatar,

  -- 헬퍼 정보
  o.matched_helper_id as helper_id,
  helper.name as helper_name,
  NULL::numeric as helper_rating,
  helper.profile_image_url as helper_avatar,
  helper.phone_number as helper_phone,

  -- 구간 정보 (현재 스키마에 없으므로 null)
  o.delivery_area as pickup,
  o.camp_address as delivery,
  NULL::timestamp as pickup_time,

  -- 금액 정보 (가격 계산)
  (o.price_per_unit * COALESCE(NULLIF(regexp_replace(o.average_quantity, '[^0-9]', '', 'g'), '')::integer, 0))::numeric as total_amount,
  (o.payment_status = 'deposit_confirmed' OR o.payment_status = 'balance_confirmed') as deposit_paid,
  (o.payment_status = 'balance_confirmed') as balance_paid,
  NULL::timestamp as deposit_paid_at,
  NULL::timestamp as balance_paid_at,

  -- 정산 정보 (현재 settlements 테이블이 없으므로 null)
  NULL::integer as settlement_id,
  NULL::text as settlement_status,
  NULL::numeric as settlement_amount,
  NULL::numeric as platform_fee,
  NULL::timestamp as settlement_submitted_at,

  -- 플랫폼 수익 (15% 수수료로 가정)
  ((o.price_per_unit * COALESCE(NULLIF(regexp_replace(o.average_quantity, '[^0-9]', '', 'g'), '')::integer, 0)) * 0.15)::numeric as platform_revenue,

  -- 대기 시간 (분)
  EXTRACT(EPOCH FROM (NOW() - o.updated_at)) / 60 as status_waiting_minutes

FROM orders o
LEFT JOIN users requester ON o.requester_id = requester.id
LEFT JOIN users helper ON o.matched_helper_id = helper.id;

COMMENT ON VIEW admin_orders_view IS '관리자용 통합 오더 뷰 - 오더/사용자 정보를 한 번에 조회';

-- =====================================================
-- 2. 작업 대기함 뷰
-- =====================================================
CREATE OR REPLACE VIEW task_queue_view AS
-- 오더 승인 대기
SELECT
  'order_approval' as task_type,
  o.id as reference_id,
  CASE
    WHEN o.is_urgent THEN 1
    ELSE 3
  END as priority,
  EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60 as waiting_minutes,
  json_build_object(
    'orderId', o.id,
    'requesterId', o.requester_id,
    'requesterName', u.name,
    'requesterCompany', u.team_name,
    'deliveryArea', o.delivery_area,
    'campAddress', o.camp_address,
    'amount', (o.price_per_unit * COALESCE(NULLIF(regexp_replace(o.average_quantity, '[^0-9]', '', 'g'), '')::integer, 0)),
    'isUrgent', o.is_urgent,
    'createdAt', o.created_at
  )::text as related_data
FROM orders o
LEFT JOIN users u ON o.requester_id = u.id
WHERE o.approval_status = 'pending'

UNION ALL

-- 헬퍼 인증 대기
SELECT
  'helper_verification' as task_type,
  iv.id as reference_id,
  2 as priority,
  EXTRACT(EPOCH FROM (NOW() - iv.created_at)) / 60 as waiting_minutes,
  json_build_object(
    'verificationId', iv.id,
    'userId', iv.user_id,
    'userName', u.name,
    'userEmail', u.email,
    'userPhone', u.phone_number,
    'verificationType', iv.provider,
    'createdAt', iv.created_at
  )::text as related_data
FROM identity_verifications iv
LEFT JOIN users u ON iv.user_id = u.id
WHERE iv.status = 'pending'

ORDER BY priority ASC, waiting_minutes DESC;

COMMENT ON VIEW task_queue_view IS '작업 대기함 뷰 - 관리자가 처리해야 할 작업 자동 수집 (우선순위순)';

-- =====================================================
-- 3. 실시간 통계 뷰
-- =====================================================
CREATE OR REPLACE VIEW admin_stats_view AS
SELECT
  -- 진행 중 오더
  COUNT(*) FILTER (
    WHERE status IN ('registered', 'matching', 'scheduled', 'in_progress')
  )::integer as active_orders,

  -- 활성 헬퍼 수
  COUNT(DISTINCT helper_id) FILTER (
    WHERE status = 'in_progress'
  )::integer as active_helpers,

  -- 승인 대기 정산 총액 (settlements 테이블 없으므로 0)
  0::numeric as pending_settlement_total,

  -- 오늘의 플랫폼 수익
  COALESCE(
    SUM(platform_revenue) FILTER (WHERE DATE(created_at) = CURRENT_DATE),
    0
  )::numeric as today_revenue,

  -- 이번 달 플랫폼 수익
  COALESCE(
    SUM(platform_revenue) FILTER (
      WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
    ),
    0
  )::numeric as this_month_revenue,

  -- 완료된 오더 (오늘)
  COUNT(*) FILTER (
    WHERE status = 'settled' AND DATE(created_at) = CURRENT_DATE
  )::integer as today_completed_orders,

  -- 완료된 오더 (이번 달)
  COUNT(*) FILTER (
    WHERE status = 'settled'
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
  )::integer as this_month_completed_orders

FROM admin_orders_view;

COMMENT ON VIEW admin_stats_view IS '실시간 통계 뷰 - 관리자 대시보드 주요 지표';

-- =====================================================
-- 4. 헬퍼별 정산 요약 뷰 (settlements 테이블 없으므로 빈 뷰)
-- =====================================================
CREATE OR REPLACE VIEW helper_settlement_summary_view AS
SELECT
  u.id as helper_id,
  u.name as helper_name,
  u.email as helper_email,
  u.phone_number as helper_phone,
  0::bigint as total_settlements,
  0::numeric as total_earnings,
  0::numeric as pending_amount,
  0::numeric as approved_amount,
  0::numeric as paid_amount,
  0::numeric as avg_settlement,
  NULL::timestamp as last_settlement_date,
  NULL::timestamp as next_payout_date
FROM users u
WHERE u.role = 'helper'
LIMIT 0; -- Empty view for now

COMMENT ON VIEW helper_settlement_summary_view IS '헬퍼별 정산 요약 뷰 - 수익, 대기금액, 지급완료 등 (미구현)';

-- =====================================================
-- 5. 요청자별 청구 요약 뷰
-- =====================================================
CREATE OR REPLACE VIEW requester_billing_summary_view AS
SELECT
  o.requester_id,
  u.name as requester_name,
  u.team_name as requester_company,
  u.email as requester_email,
  u.phone_number as requester_phone,

  -- 총 오더 수
  COUNT(*)::bigint as total_orders,

  -- 진행 중 오더
  COUNT(*) FILTER (WHERE o.status IN ('registered', 'matching', 'in_progress'))::bigint as active_orders,

  -- 총 청구액
  COALESCE(SUM(o.price_per_unit * COALESCE(NULLIF(regexp_replace(o.average_quantity, '[^0-9]', '', 'g'), '')::integer, 0)), 0)::numeric as total_billed,

  -- 미결제액 (payment_status 기반)
  COALESCE(
    SUM(o.price_per_unit * COALESCE(NULLIF(regexp_replace(o.average_quantity, '[^0-9]', '', 'g'), '')::integer, 0) * 0.2)
    FILTER (WHERE o.payment_status = 'awaiting_deposit'),
    0
  )::numeric as unpaid_deposit,

  -- 잔금 미결제
  COALESCE(
    SUM(o.price_per_unit * COALESCE(NULLIF(regexp_replace(o.average_quantity, '[^0-9]', '', 'g'), '')::integer, 0) * 0.8)
    FILTER (WHERE o.payment_status = 'deposit_confirmed'),
    0
  )::numeric as unpaid_balance,

  -- 결제 완료 총액
  COALESCE(
    SUM(o.price_per_unit * COALESCE(NULLIF(regexp_replace(o.average_quantity, '[^0-9]', '', 'g'), '')::integer, 0))
    FILTER (WHERE o.payment_status = 'balance_confirmed'),
    0
  )::numeric as total_paid,

  -- 마지막 오더일
  MAX(o.created_at) as last_order_date

FROM orders o
LEFT JOIN users u ON o.requester_id = u.id
GROUP BY o.requester_id, u.name, u.team_name, u.email, u.phone_number;

COMMENT ON VIEW requester_billing_summary_view IS '요청자별 청구 요약 뷰 - 총청구액, 미결제액, 결제완료 등';

-- =====================================================
-- 인덱스 생성 (성능 최적화)
-- =====================================================

-- orders 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_requester_id ON orders(requester_id);
CREATE INDEX IF NOT EXISTS idx_orders_matched_helper_id ON orders(matched_helper_id);
CREATE INDEX IF NOT EXISTS idx_orders_approval_status ON orders(approval_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- identity_verifications 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_identity_verifications_status ON identity_verifications(status);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_user_id ON identity_verifications(user_id);

-- =====================================================
-- 완료 메시지
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ 관리자용 데이터베이스 뷰 생성 완료!';
  RAISE NOTICE '   - admin_orders_view';
  RAISE NOTICE '   - task_queue_view';
  RAISE NOTICE '   - admin_stats_view';
  RAISE NOTICE '   - helper_settlement_summary_view (빈 뷰)';
  RAISE NOTICE '   - requester_billing_summary_view';
  RAISE NOTICE '';
  RAISE NOTICE '📊 뷰 확인:';
  RAISE NOTICE '   SELECT * FROM task_queue_view LIMIT 10;';
  RAISE NOTICE '   SELECT * FROM admin_stats_view;';
END $$;
